import { DB_CONFIG } from './config.js';

class ObservableStore {
  constructor() {
    this.db = null;
    this.observers = new Map();
    this.init();
  }

  async init() {
    this.db = await this.openDB();
    this.notify('db:ready', this.db);
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Crear object stores
        Object.entries(DB_CONFIG.stores).forEach(([name, config]) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: config.keyPath });
            config.indexes?.forEach(idx => store.createIndex(idx, idx, { unique: false }));
          }
        });
      };
    });
  }

  // Observer pattern
  subscribe(channel, callback) {
    if (!this.observers.has(channel)) {
      this.observers.set(channel, new Set());
    }
    this.observers.get(channel).add(callback);
    
    // Return unsubscribe function
    return () => this.observers.get(channel).delete(callback);
  }

  notify(channel, data) {
    const callbacks = this.observers.get(channel) || new Set();
    callbacks.forEach(cb => cb(data));
    
    // Notify wildcard
    if (channel.includes(':')) {
      const [prefix] = channel.split(':');
      this.observers.get(`${prefix}:*`)?.forEach(cb => cb(data, channel));
    }
  }

  // CRUD operations
  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, item) {
    item.created_at = new Date().toISOString();
    item.updated_at = item.created_at;
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(item);
      
      request.onsuccess = () => {
        this.notify(`${storeName}:create`, { id: request.result, ...item });
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async update(storeName, item) {
    item.updated_at = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);
      
      request.onsuccess = () => {
        this.notify(`${storeName}:update`, item);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        this.notify(`${storeName}:delete`, { id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Query helpers
  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const store = new ObservableStore();