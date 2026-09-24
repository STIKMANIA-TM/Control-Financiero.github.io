import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_CONFIG } from './config.js';
import { store } from './store.js';
import { notifySync } from './notifications.js';

class SyncManager {
  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    this.lastSync = null;
    this.isOnline = navigator.onLine;
    this.syncInterval = null;
    
    this.init();
  }

  async init() {
    // Escuchar cambios de conexión
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Suscribirse a cambios en tiempo real
    this.subscribeToChanges();
    
    // Sync periódico cada 30s
    this.startPeriodicSync();
    
    // Cargar último sync
    const config = await store.getAll('config');
    const lastSyncConfig = config.find(c => c.key === 'lastSync');
    this.lastSync = lastSyncConfig?.value || null;
  }

  handleOnline() {
    this.isOnline = true;
    notifySync('online', 'Conexión restablecida - Sincronizando...');
    this.syncToCloud();
  }

  handleOffline() {
    this.isOnline = false;
    notifySync('offline', 'Modo offline - Los cambios se guardarán localmente');
  }

  subscribeToChanges() {
    // Suscribirse a cambios en movimientos
    this.supabase
      .channel('movimientos')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'movimientos' },
        (payload) => this.handleRemoteChange(payload)
      )
      .subscribe();
  }

  async handleRemoteChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;
    
    if (eventType === 'INSERT') {
      await store.add('movimientos', newRow);
      notifySync('sync', `Nuevo movimiento sincronizado: $${newRow.monto}`);
    } else if (eventType === 'UPDATE') {
      await store.update('movimientos', newRow);
    } else if (eventType === 'DELETE') {
      await store.delete('movimientos', oldRow.id);
    }
  }

  async syncToCloud() {
    if (!this.isOnline) return;
    
    try {
      const movimientos = await store.getAll('movimientos');
      
      // Subir todos los movimientos locales
      for (const mov of movimientos) {
        const { data, error } = await this.supabase
          .from('movimientos')
          .upsert(mov, { onConflict: 'id' });
        
        if (error) throw error;
      }
      
      this.lastSync = new Date().toISOString();
      await store.update('config', { key: 'lastSync', value: this.lastSync });
      
      notifySync('sync', '✓ Sincronización completada');
    } catch (error) {
      console.error('Sync error:', error);
      notifySync('error', 'Error al sincronizar con la nube');
    }
  }

  startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncToCloud();
      }
    }, 30000); // Cada 30 segundos
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const syncManager = new SyncManager();