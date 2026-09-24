// Supabase config (REEMPLAZA CON TUS DATOS)
export const SUPABASE_CONFIG = {
  url: 'https://TU_PROJECT_ID.supabase.co',
  anonKey: 'TU_ANON_KEY'
};

// IndexedDB config
export const DB_CONFIG = {
  name: 'ControlFinancieroDB',
  version: 1,
  stores: {
    movimientos: { keyPath: 'id', indexes: ['tipo', 'fecha', 'estado', 'fuente'] },
    cicloPropinas: { keyPath: 'id' },
    inventario: { keyPath: 'id', indexes: ['material', 'stock'] },
    config: { keyPath: 'key' }
  }
};

// Reglas de distribución
export const DISTRIBUTION_RULES = {
  Salario: { 'Gastos Fijos': 0.50, 'Ocio': 0.30, 'Ahorro': 0.20 },
  Stikmania: { 'Inversión': 0.50, 'Gastos Fijos': 0.30, 'Ahorro': 0.20 },
  Propina: { 'Ahorro': 1.00 },
  Otro: { 'Ahorro': 1.00 }
};

// Ciclo de propinas
export const CICLO_PROPINAS = {
  total: 3,
  distribucion: ['Gastos Fijos', 'Ocio', 'Inversión'] // Mayor, Intermedia, Menor
};

// Notificaciones
export const NOTIFICATION_CONFIG = {
  enabled: true,
  icons: {
    ingreso: '💰',
    gasto: '💸',
    alerta: '⚠️',
    sync: '🔄'
  }
};

// Modelo Wilson - parámetros por defecto
export const WILSON_DEFAULTS = {
  costoPedido: 50,        // Costo fijo por pedido (S)
  costoAlmacenamiento: 2, // Costo por unidad almacenada (g)
  stockSeguridad: 7       // Días de stock de seguridad
};