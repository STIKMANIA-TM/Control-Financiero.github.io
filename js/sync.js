/**
 * sync.js — SyncManager multi-tabla (Supabase + IndexedDB)
 * Sincroniza: movimientos, inventario, ciclo_propinas
 * Cola offline persistida + realtime + reconciliación last-write-wins
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_CONFIG, SYNC_CONFIG, SYNC_STATUS, SYNC_TABLES } from './config.js';
import { store } from './store.js';
import { notifier } from './notifications.js';

class SyncManager {
  constructor() {
    this.supabase = null;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.lastSync = null;
    this.retryCount = 0;
    this.syncInterval = null;

    this.queue = new Map();
    SYNC_TABLES.forEach(t => this.queue.set(t.store, { upserts: new Set(), deletes: new Set() }));

    this._suppress = false;
    this._flushing = false;
    this._flushTimer = null;
    this.realtimeChannel = null;

    this._handleOnline = this._handleOnline.bind(this);
    this._handleOffline = this._handleOffline.bind(this);
    this._handleVisibility = this._handleVisibility.bind(this);
  }

  // ==========================================================================
  // 🚀 INIT
  // ==========================================================================
  async init() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: false }
    });

    await this._testConnection();
    this._registerListeners();
    this._subscribeToRealtime();
    this._subscribeToStoreChanges();
    await this._loadState();
    this._startPeriodicSync();

    if (this.isOnline) await this.fullSync();
    console.log('✅ SyncManager multi-tabla inicializado');
  }

  async _testConnection() {
    const { error } = await this.supabase.from(SYNC_TABLES[0].table).select('id').limit(1);
    if (error) throw new Error('Sin conexión a Supabase: ' + error.message);
  }

  _registerListeners() {
    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);
    document.addEventListener('visibilitychange', this._handleVisibility);
  }

  async _handleOnline() {
    if (this.isOnline) return;
    this.isOnline = true;
    notifier.showSync('online', 'Conexión restablecida');
    await this.fullSync();
  }

  _handleOffline() {
    if (!this.isOnline) return;
    this.isOnline = false;
    notifier.showSync('offline', 'Modo offline: cambios en cola local');
  }

  async _handleVisibility() {
    if (!document.hidden && this.isOnline) await this.fullSync();
  }

  // ==========================================================================
  // 📡 REALTIME
  // ==========================================================================
  _subscribeToRealtime() {
    let channel = this.supabase.channel('sync-channel');
    SYNC_TABLES.forEach(def => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: def.table },
        (payload) => this._handleRemoteEvent(def, payload)
      );
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('📡 Realtime activo en', SYNC_TABLES.length, 'tablas');
    });
    this.realtimeChannel = channel;
  }

  async _handleRemoteEvent(def, payload) {
    const { eventType, new: newRow, old: oldRow } = payload;
    this._suppress = true;
    try {
      if (eventType === 'DELETE') {
        if (oldRow?.id) await store.delete(def.store, oldRow.id);
        return;
      }
      if (!newRow?.id) return;
      const row = def.store === 'movimientos'
        ? { ...newRow, sync_status: SYNC_STATUS.SYNCED }
        : newRow;
      await store.updateSilent(def.store, row);
    } catch (err) {
      console.error(`❌ Error aplicando evento remoto (${def.table}):`, err);
    } finally {
      this._suppress = false;
    }
  }

  // ==========================================================================
  // 📥 CAMBIOS LOCALES → COLA
  // ==========================================================================
  _subscribeToStoreChanges() {
    SYNC_TABLES.forEach(def => {
      store.subscribe(`${def.store}:create`, (data) => {
        if (this._suppress) return;
        this._enqueue(def.store, data.id, 'upsert');
      });
      store.subscribe(`${def.store}:update`, (data) => {
        if (this._suppress) return;
        if (def.store === 'movimientos' && data.sync_status === SYNC_STATUS.SYNCED) return;
        this._enqueue(def.store, data.id, 'upsert');
      });
      store.subscribe(`${def.store}:delete`, (data) => {
        if (this._suppress) return;
        this._enqueue(def.store, data.id, 'delete');
      });
    });
  }

  async _enqueue(storeName, id, action) {
    const q = this.queue.get(storeName);
    if (!q) return;

    if (action === 'upsert') {
      q.deletes.delete(id);
      q.upserts.add(id);
      if (storeName === 'movimientos') {
        this._suppress = true;
        try {
          const item = await store.getById(storeName, id);
          if (item) await store.updateSilent(storeName, { ...item, sync_status: SYNC_STATUS.PENDING });
        } finally { this._suppress = false; }
      }
    } else {
      q.upserts.delete(id);
      q.deletes.add(id);
    }

    this._persistQueue();
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (!this.isOnline) return;
    clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(() => this._flush(), 400);
  }

  // ==========================================================================
  // 📤 FLUSH → NUBE
  // ==========================================================================
  async _flush() {
    if (!this.isOnline || this._flushing) return;
    this._flushing = true;
    this.isSyncing = true;
    let errores = 0;

    for (const def of SYNC_TABLES) {
      const q = this.queue.get(def.store);

      for (const id of [...q.upserts]) {
        try {
          const item = await store.getById(def.store, id);
          if (!item) { q.upserts.delete(id); continue; }

          const payload = { ...item };
          delete payload.sync_status; // solo local

          const { error } = await this.supabase.from(def.table).upsert(payload, { onConflict: 'id' });
          if (error) throw error;

          q.upserts.delete(id);

          this._suppress = true;
          try {
            if (def.store === 'movimientos') {
              await store.updateSilent(def.store, { ...item, sync_status: SYNC_STATUS.SYNCED });
            }
          } finally { this._suppress = false; }
        } catch (err) {
          errores++;
          console.error(`❌ Upsert falló (${def.table}/${id}):`, err);
        }
      }

      for (const id of [...q.deletes]) {
        try {
          const { error } = await this.supabase.from(def.table).delete().eq('id', id);
          if (error) throw error;
          q.deletes.delete(id);
        } catch (err) {
          errores++;
          console.error(`❌ Delete falló (${def.table}/${id}):`, err);
        }
      }
    }

    this._flushing = false;
    this.isSyncing = false;
    this._persistQueue();

    if (errores === 0) this.retryCount = 0;
    else await this._handleSyncError(new Error(`${errores} operaciones fallidas`));
  }

  // ==========================================================================
  // 📥 DESCARGA + RECONCILIACIÓN
  // ==========================================================================
  async syncFromCloud() {
    if (!this.isOnline) return false;

    for (const def of SYNC_TABLES) {
      let query = this.supabase.from(def.table).select('*');
      if (this.lastSync) query = query.gt('updated_at', this.lastSync);

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) continue;

      for (const row of data) await this._reconcile(def, row);
    }

    this.lastSync = new Date().toISOString();
    await store.update('config', { key: 'lastSync', value: this.lastSync });
    return true;
  }

  async _reconcile(def, remoteRow) {
    const local = await store.getById(def.store, remoteRow.id);
    const row = def.store === 'movimientos'
      ? { ...remoteRow, sync_status: SYNC_STATUS.SYNCED }
      : remoteRow;

    this._suppress = true;
    try {
      if (!local) {
        await store.updateSilent(def.store, row);
        return;
      }
      const localTs = new Date(local.updated_at || 0).getTime();
      const remoteTs = new Date(remoteRow.updated_at || 0).getTime();
      if (remoteTs > localTs) await store.updateSilent(def.store, row);
    } finally {
      this._suppress = false;
    }
  }

  // ==========================================================================
  // 🔄 SYNC COMPLETO
  // ==========================================================================
  async fullSync() {
    if (!this.isOnline || this._flushing) return false;
    try {
      await this._flush();
      await this.syncFromCloud();
      return true;
    } catch (err) {
      await this._handleSyncError(err);
      return false;
    }
  }

  async forceSync() {
    if (!this.isOnline) {
      notifier.showAlert('Sin conexión a internet', 'normal');
      return false;
    }
    notifier.showSync('sync', 'Sincronizando...');
    const ok = await this.fullSync();
    if (ok) notifier.showSync('sync', '✓ Sincronización completada');
    return ok;
  }

  // ==========================================================================
  // 💾 ESTADO PERSISTIDO
  // ==========================================================================
  async _persistQueue() {
    const serializable = {};
    this.queue.forEach((q, storeName) => {
      serializable[storeName] = { upserts: [...q.upserts], deletes: [...q.deletes] };
    });
    try { await store.update('cache', { key: 'syncQueue', value: serializable }); } catch {}
  }

  async _loadState() {
    try {
      const last = await store.getById('config', 'lastSync');
      if (last?.value) this.lastSync = last.value;

      const saved = await store.getById('cache', 'syncQueue');
      if (saved?.value) {
        Object.entries(saved.value).forEach(([storeName, q]) => {
          const target = this.queue.get(storeName);
          if (target) {
            target.upserts = new Set(q.upserts || []);
            target.deletes = new Set(q.deletes || []);
          }
        });
      }
    } catch (err) {
      console.error('❌ Error cargando estado de sync:', err);
    }
  }

  // ==========================================================================
  // ⏰ PERIÓDICO + ERRORES
  // ==========================================================================
  _startPeriodicSync() {
    clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this._flushing) this.fullSync();
    }, SYNC_CONFIG.intervaloMs);
  }

  async _handleSyncError(error) {
    this.retryCount++;
    if (this.retryCount >= SYNC_CONFIG.maxReintentos) {
      notifier.showAlert('Error de sincronización. Cambios en cola local.', 'alta');
      this.retryCount = 0;
      return;
    }
    const delay = SYNC_CONFIG.delayReintentoMs * Math.pow(2, this.retryCount - 1);
    setTimeout(() => { if (this.isOnline) this.fullSync(); }, delay);
  }

  // ==========================================================================
  // 📊 ESTADO PÚBLICO
  // ==========================================================================
  getStatus() {
    let pending = 0;
    this.queue.forEach(q => { pending += q.upserts.size + q.deletes.size; });
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSync: this.lastSync,
      pendingChanges: pending,
      retryCount: this.retryCount
    };
  }

  destroy() {
    clearInterval(this.syncInterval);
    clearTimeout(this._flushTimer);
    if (this.realtimeChannel) this.supabase.removeChannel(this.realtimeChannel);
    window.removeEventListener('online', this._handleOnline);
    window.removeEventListener('offline', this._handleOffline);
    document.removeEventListener('visibilitychange', this._handleVisibility);
  }
}

export const syncManager = new SyncManager();
export default syncManager;