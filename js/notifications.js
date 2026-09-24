/**
 * notifications.js — Notificaciones locales (Notification API)
 * Versión corregida: el init NO bloquea el arranque de la app
 */

import { NOTIFICATION_CONFIG } from './config.js';

class NotificationManager {
  constructor() {
    this.permission = ('Notification' in window) ? Notification.permission : 'denied';
    this._pedidoEnCurso = false;
  }

  /**
   * Init no bloqueante:
   * - Si ya hay permiso, no hace nada
   * - Si es la primera vez, pide permiso en el primer click del usuario
   *   (mejor UX y cumple políticas de navegadores)
   */
  async init() {
    if (!('Notification' in window)) {
      console.warn('🔕 Notificaciones no soportadas en este navegador');
      return;
    }

    if (this.permission === 'default' && !this._pedidoEnCurso) {
      const pedir = async () => {
        if (this._pedidoEnCurso) return;
        this._pedidoEnCurso = true;
        try {
          this.permission = await Notification.requestPermission();
        } catch (err) {
          console.warn('No se pudo pedir permiso de notificaciones:', err);
        }
      };
      // Se pide con la primera interacción del usuario (no bloquea el boot)
      window.addEventListener('click', pedir, { once: true });
    }
  }

  show(title, options = {}) {
    if (!('Notification' in window) || this.permission !== 'granted') return null;
    try {
      const n = new Notification(title, {
        icon: 'logo.svg',
        badge: 'logo.svg',
        ...options,
        timestamp: Date.now()
      });
      setTimeout(() => n.close(), 5000);
      return n;
    } catch (err) {
      console.warn('Error mostrando notificación:', err);
      return null;
    }
  }

  showIngreso(monto, fuente) {
    this.show('💰 Ingreso Registrado', { body: `$${monto} de ${fuente}`, tag: 'ingreso' });
  }

  showGasto(monto, categoria) {
    this.show('💸 Gasto Registrado', { body: `$${monto} en ${categoria}`, tag: 'gasto' });
  }

  showAlert(message, priority = 'normal') {
    this.show('⚠️ Alerta', {
      body: message,
      tag: 'alert',
      requireInteraction: priority === 'alta'
    });
  }

  showSync(status, message) {
    const icons = { online: '🟢', offline: '🔴', sync: '🔄', error: '❌' };
    this.show('Sincronización', { body: message, tag: 'sync', icon: icons[status] || '🔄' });
  }

  showWilsonAlert(material, cantidad, puntoReorden) {
    this.show('📦 Stock Bajo - Modelo Wilson', {
      body: `${material}: stock ${cantidad} ≤ punto de reorden ${puntoReorden}. Es momento de pedir.`,
      tag: 'wilson-reorder',
      requireInteraction: true
    });
  }

  showCicloPropinas(monto, asignacion) {
    this.show('🔄 Ciclo de Propinas Cerrado', {
      body: `Propina mayor de $${monto} asignada a ${asignacion}`,
      tag: 'ciclo-propinas'
    });
  }
}

export const notifier = new NotificationManager();

export function notifySync(status, message) { notifier.showSync(status, message); }
export function notifyAlert(message, priority = 'normal') { notifier.showAlert(message, priority); }
export function notifyWilson(material, cantidad, puntoReorden) { notifier.showWilsonAlert(material, cantidad, puntoReorden); }