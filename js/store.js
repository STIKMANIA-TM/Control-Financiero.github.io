/**
 * store.js — IndexedDB con patrón Observer
 */

import { DB_CONFIG } from './config.js';

class ObservableStore {
  constructor() {
    this.db = null;
    this.observers = new Map();
    this._ready = false;
    this._readyPromise = this.init();
  }

  // ==========================================================================
  // 🚀 INICIALIZACIÓN
  // ==========================================================================
  async init() {
    try {
      this.db = await this.openDB();
      this._ready = true;
      this.notify('db:ready', this.db);
      return this.db;
    } catch (error) {
      console.error('❌ Error inicializando IndexedDB:', error);
      throw error;
    }
  }

  async waitForReady() {
    if (this._ready) return this.db;
    return this._readyPromise;
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        Object.entries(DB_CONFIG.stores).forEach(([name, config]) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: config.keyPath });
            if (config.indexes) {
              config.indexes.forEach(idx => store.createIndex(idx, idx, { unique: false }));
            }
          }
        });
      };
    });
  }

  // ==========================================================================
  // 👁️ OBSERVER PATTERN
  // ==========================================================================
  subscribe(channel, callback) {
    if (!this.observers.has(channel)) this.observers.set(channel, new Set());
    this.observers.get(channel).add(callback);
    return () => this.observers.get(channel)?.delete(callback);
  }

  notify(channel, data) {
    const callbacks = this.observers.get(channel);
    if (callbacks) {
      callbacks.forEach(cb => {
        try { cb(data); } catch (err) { console.error(`❌ Subscriber error en ${channel}:`, err); }
      });
    }
    if (channel.includes(':')) {
      const [prefix] = channel.split(':');
      this.observers.get(`${prefix}:*`)?.forEach(cb => cb(data, channel));
    }
  }

  // ==========================================================================
  // 🔧 HELPERS INTERNOS
  // ==========================================================================
  _ensureDB() {
    if (!this.db) throw new Error('IndexedDB no inicializada');
    return this.db;
  }

  _store(storeName, mode = 'readonly') {
    return this._ensureDB().transaction(storeName, mode).objectStore(storeName);
  }

  // ==========================================================================
  // 📖 LECTURA
  // ==========================================================================
  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const req = this._store(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getById(storeName, id) {
    return new Promise((resolve, reject) => {
      const req = this._store(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const req = this._store(storeName).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    return new Promise((resolve, reject) => {
      const req = this._store(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async find(storeName, predicate) {
    const all = await this.getAll(storeName);
    return all.filter(predicate);
  }

  async findOne(storeName, predicate) {
    const all = await this.getAll(storeName);
    return all.find(predicate) || null;
  }

  // ==========================================================================
  // ✍️ ESCRITURA
  // ==========================================================================
  async add(storeName, item) {
    const ts = new Date().toISOString();
    const full = { ...item, created_at: item.created_at || ts, updated_at: item.updated_at || ts };
    return new Promise((resolve, reject) => {
      const req = this._store(storeName, 'readwrite').add(full);
      req.onsuccess = () => { this.notify(`${storeName}:create`, full); resolve(full); };
      req.onerror = () => reject(req.error);
    });
  }

  /** Actualiza tocando updated_at (edición local real) */
  async update(storeName, item) {
    const full = { ...item, updated_at: new Date().toISOString() };
    return new Promise((resolve, reject) => {
      const req = this._store(storeName, 'readwrite').put(full);
      req.onsuccess = () => { this.notify(`${storeName}:update`, full); resolve(full); };
      req.onerror = () => reject(req.error);
    });
  }

  /** Actualiza SIN tocar timestamps (crítico para last-write-wins y sync) */
  async updateSilent(storeName, item) {
    return new Promise((resolve, reject) => {
      const req = this._store(storeName, 'readwrite').put(item);
      req.onsuccess = () => { this.notify(`${storeName}:update`, item); resolve(item); };
      req.onerror = () => reject(req.error);
    });
  }

  async patch(storeName, id, updates) {
    const existing = await this.getById(storeName, id);
    if (!existing) throw new Error(`Registro ${id} no encontrado en ${storeName}`);
    return this.update(storeName, { ...existing, ...updates });
  }

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const req = this._store(storeName, 'readwrite').delete(id);
      req.onsuccess = () => { this.notify(`${storeName}:delete`, { id }); resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const req = this._store(storeName, 'readwrite').clear();
      req.onsuccess = () => { this.notify(`${storeName}:clear`, {}); resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  async bulkAdd(storeName, items) {
    return new Promise((resolve, reject) => {
      const tx = this._ensureDB().transaction(storeName, 'readwrite');
      const os = tx.objectStore(storeName);
      const ts = new Date().toISOString();
      const fulls = items.map(i => ({ ...i, created_at: i.created_at || ts, updated_at: i.updated_at || ts }));
      fulls.forEach(f => os.add(f));
      tx.oncomplete = () => {
        fulls.forEach(f => this.notify(`${storeName}:create`, f));
        resolve(fulls);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==========================================================================
  // 💾 BACKUP
  // ==========================================================================
  async exportAll() {
    const data = {};
    for (const name of Object.keys(DB_CONFIG.stores)) {
      data[name] = await this.getAll(name);
    }
    return { exported_at: new Date().toISOString(), version: DB_CONFIG.version, data };
  }

  async importAll(backup) {
    if (!backup?.data) throw new Error('Backup inválido');
    for (const [name, items] of Object.entries(backup.data)) {
      if (DB_CONFIG.stores[name]) {
        await this.clear(name);
        if (items.length) await this.bulkAdd(name, items);
      }
    }
    this.notify('db:imported', backup);
  }
}

export const store = new ObservableStore();
export default store;