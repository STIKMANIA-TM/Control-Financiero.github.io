import { NOTIFICATION_CONFIG } from './config.js';

class NotificationManager {
  constructor() {
    this.permission = Notification.permission;
    this.init();
  }

  async init() {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Suscribirse a push notifications (opcional, requiere backend)
      // Por ahora usamos notificaciones locales
    }

    if (this.permission !== 'granted') {
      await this.requestPermission();
    }
  }

  async requestPermission() {
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission();
    }
  }

  show(title, options = {}) {
    if (this.permission !== 'granted') return;

    const notification = new Notification(title, {
      icon: '/logo.svg',
      badge: '/logo.svg',
      ...options,
      timestamp: Date.now()
    });

    // Auto-close after 5s
    setTimeout(() => notification.close(), 5000);

    return notification;
  }

  showIngreso(monto, fuente) {
    this.show('💰 Ingreso Registrado', {
      body: `$${monto} de ${fuente}`,
      tag: 'ingreso',
      icon: '💰'
    });
  }

  showGasto(monto, categoria) {
    this.show('💸 Gasto Registrado', {
      body: `$${monto} en ${categoria}`,
      tag: 'gasto',
      icon: '💸'
    });
  }

  showAlert(message, priority = 'normal') {
    const urgency = priority === 'alta' ? 'high' : 'normal';
    this.show('⚠️ Alerta', {
      body: message,
      tag: 'alert',
      requireInteraction: priority === 'alta',
      urgency
    });
  }

  showSync(status, message) {
    const icons = {
      online: '',
      offline: '🔴',
      sync: '🔄',
      error: '❌'
    };

    this.show('Sincronización', {
      body: message,
      tag: 'sync',
      icon: icons[status] || '🔄'
    });
  }

  showWilsonAlert(material, cantidad, puntoReorden) {
    this.show('📦 Stock Bajo - Modelo Wilson', {
      body: `${material}: Stock actual ${cantidad} ≤ Punto de reorden ${puntoReorden}. Es momento de pedir.`,
      tag: 'wilson-reorder',
      requireInteraction: true
    });
  }

  showCicloPropinas(monto, asignacion) {
    this.show('🔄 Ciclo de Propinas Cerrado', {
      body: `Propina de $${monto} asignada a ${asignacion}`,
      tag: 'ciclo-propinas'
    });
  }
}

export const notifier = new NotificationManager();

// Helpers
export function notifySync(status, message) {
  notifier.showSync(status, message);
}

export function notifyAlert(message, priority = 'normal') {
  notifier.showAlert(message, priority);
}

export function notifyWilson(material, cantidad, puntoReorden) {
  notifier.showWilsonAlert(material, cantidad, puntoReorden);
}