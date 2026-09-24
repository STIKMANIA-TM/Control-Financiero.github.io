import { router } from './router.js';
import { store } from './store.js';
import { syncManager } from './sync.js';
import { notifier } from './notifications.js';
import WilsonInventory from './wilson.js';

// Importar screens
import { renderInicio } from './screens/inicio.js';
import { renderPilares } from './screens/pilares.js';
import { renderNegocio } from './screens/negocio.js';
import { renderPendientes } from './screens/pendientes.js';
import { renderHistorial } from './screens/historial.js';

// Registrar rutas
router.register('inicio', renderInicio);
router.register('pilares', renderPilares);
router.register('negocio', renderNegocio);
router.register('pendientes', renderPendientes);
router.register('historial', renderHistorial);

// Inicializar app
async function init() {
  try {
    // Esperar a que IndexedDB esté listo
    await new Promise(resolve => {
      const unsubscribe = store.subscribe('db:ready', () => {
        unsubscribe();
        resolve();
      });
    });

    // Iniciar sync
    await syncManager.init();

    // Solicitar permiso de notificaciones
    await notifier.init();

    // Renderizar ruta inicial
    router.handleRouteChange();

    // Suscribirse a cambios globales
    store.subscribe('movimientos:*', () => {
      // Re-renderizar pantalla actual
      const currentRoute = router.getCurrentRoute();
      if (currentRoute) {
        router.handleRouteChange();
      }
    });

    console.log('✅ App inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
    notifier.showAlert('Error al iniciar la aplicación', 'alta');
  }
}

// Iniciar
init();