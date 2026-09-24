/**
 * config.js — Configuración central + helpers puros
 * Control Financiero - Adrián
 */

// ============================================================================
// 🔐 SUPABASE
// ============================================================================
export const SUPABASE_CONFIG = {
  url: 'https://cfrasjcgqogvlzdlmkqz.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmcmFzamNncW9ndmx6ZGxta3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDE0MzAsImV4cCI6MjEwNTc3NzQzMH0.oqN-P4zXQXYZQP4VMf59q057HITdnhFuqqW8v8INXZ0',
  restUrl: 'https://cfrasjcgqogvlzdlmkqz.supabase.co/rest/v1/',
  tables: { movimientos: 'movimientos' }
};

// ============================================================================
// 💾 INDEXEDDB
// ============================================================================
export const DB_CONFIG = {
  name: 'ControlFinancieroDB',
  version: 1,
  stores: {
    movimientos: {
      keyPath: 'id',
      indexes: ['tipo', 'estado', 'fuente', 'pilar', 'sync_status', 'created_at']
    },
    cicloPropinas: { keyPath: 'id' },
    inventario: { keyPath: 'id', indexes: ['material'] },
    config: { keyPath: 'key' },
    cache: { keyPath: 'key' }
  }
};

// ============================================================================
// 📊 ENUMS
// ============================================================================
export const TIPOS = Object.freeze({ INGRESO: 'ingreso', GASTO: 'gasto' });
export const METODOS = Object.freeze({ EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia' });
export const FUENTES = Object.freeze({
  PROPINA: 'Propina', STIKMANIA: 'Stikmania', SALARIO: 'Salario', OTRO: 'Otro', PERSONAL: 'Personal'
});
export const PILARES = Object.freeze({
  FIJOS: 'Gastos Fijos', OCIO: 'Ocio', INVERSION: 'Inversión', AHORRO: 'Ahorro'
});
export const ESTADOS = Object.freeze({ PAGADO: 'Pagado', PENDIENTE: 'Pendiente' });
export const SYNC_STATUS = Object.freeze({
  SYNCED: 'synced', PENDING: 'pending', CONFLICT: 'conflict', ERROR: 'error'
});

// ============================================================================
// 📐 REGLAS DE DISTRIBUCIÓN
// ============================================================================
export const DISTRIBUTION_RULES = Object.freeze({
  [FUENTES.SALARIO]:   { [PILARES.FIJOS]: 0.50, [PILARES.OCIO]: 0.30, [PILARES.AHORRO]: 0.20 },
  [FUENTES.STIKMANIA]: { [PILARES.INVERSION]: 0.50, [PILARES.FIJOS]: 0.30, [PILARES.AHORRO]: 0.20 },
  [FUENTES.PROPINA]:   { [PILARES.AHORRO]: 1.00 },
  [FUENTES.OTRO]:      { [PILARES.AHORRO]: 1.00 }
});

export const DISTRIBUTION_RULES_TEXT = Object.freeze({
  [FUENTES.SALARIO]: '50% Fijos / 30% Ocio / 20% Ahorro',
  [FUENTES.STIKMANIA]: '50% Inversión / 30% Fijos / 20% Ahorro',
  [FUENTES.PROPINA]: 'Ciclo 3 propinas: Mayor→Fijos / Inter→Ocio / Menor→Inversión',
  [FUENTES.OTRO]: '100% Ahorro'
});

// ============================================================================
// 🔄 CICLO DE PROPINAS
// ============================================================================
export const CICLO_PROPINAS = Object.freeze({
  total: 3,
  distribucion: [PILARES.FIJOS, PILARES.OCIO, PILARES.INVERSION],
  etiquetas: ['Mayor', 'Intermedia', 'Menor']
});

// ============================================================================
// 📦 MODELO WILSON
// ============================================================================
export const WILSON_DEFAULTS = Object.freeze({
  costoPedido: 50,
  costoAlmacenamiento: 2,
  stockSeguridad: 7,
  plazoEntregaDefault: 5
});

// ============================================================================
// 🔔 NOTIFICACIONES
// ============================================================================
export const NOTIFICATION_CONFIG = Object.freeze({
  enabled: true,
  triggers: { gastoAlto: true, cicloCerrado: true, stockBajo: true, syncError: true, pendienteVencido: true }
});

// ============================================================================
// 💱 MONEDA Y LÍMITES
// ============================================================================
export const MONEDA_CONFIG = Object.freeze({ simbolo: '$', codigo: 'USD', locale: 'es-ES', decimales: 2 });

export const LIMITES_DEFAULTS = Object.freeze({
  maxOcioPct: 0.25,
  minEmergenciaMeses: 3,
  margenMinimoStikmania: 0.30,
  umbralGastoAlto: 100,
  diasMaximosCiclo: 7
});

// ============================================================================
// 🌐 SYNC
// ============================================================================
export const SYNC_CONFIG = Object.freeze({
  intervaloMs: 30000,
  timeoutMs: 10000,
  maxReintentos: 3,
  delayReintentoMs: 2000
});

export const SYNC_TABLES = Object.freeze([
  { store: 'movimientos',   table: 'movimientos' },
  { store: 'inventario',    table: 'inventario' },
  { store: 'cicloPropinas', table: 'ciclo_propinas' }
]);

// ============================================================================
// 🗺️ RUTAS Y NAV
// ============================================================================
export const ROUTES = Object.freeze({
  INICIO: 'inicio', PILARES: 'pilares', NEGOCIO: 'negocio',
  PENDIENTES: 'pendientes', HISTORIAL: 'historial'
});

export const NAV_ITEMS = Object.freeze([
  { id: ROUTES.INICIO, label: 'Inicio', icon: '🏠' },
  { id: ROUTES.PILARES, label: 'Pilares', icon: '📊' },
  { id: ROUTES.NEGOCIO, label: 'Negocio', icon: '💼' },
  { id: ROUTES.PENDIENTES, label: 'Pendientes', icon: '⏳' },
  { id: ROUTES.HISTORIAL, label: 'Historial', icon: '📜' }
]);

export const PILAR_COLORS = Object.freeze({
  [PILARES.FIJOS]: '#1976d2',
  [PILARES.OCIO]: '#f57f17',
  [PILARES.INVERSION]: '#2e7d32',
  [PILARES.AHORRO]: '#c62828'
});

export const VALIDATIONS = Object.freeze({
  monto: { min: 0.01, max: 1000000 },
  texto: { maxLength: 500 }
});

// ============================================================================
// ⚙️ SETTINGS MANAGER
// ============================================================================
export const settings = {
  _cache: null,

  async load(store) {
    const [lim, mon] = await Promise.all([
      store.getById('config', 'limites'),
      store.getById('config', 'moneda')
    ]);
    this._cache = {
      limites: { ...LIMITES_DEFAULTS, ...(lim?.value || {}) },
      moneda: { ...MONEDA_CONFIG, ...(mon?.value || {}) }
    };
    return this._cache;
  },

  get limites() { return this._cache?.limites || LIMITES_DEFAULTS; },
  get moneda() { return this._cache?.moneda || MONEDA_CONFIG; },

  async saveLimites(store, partial) {
    const value = { ...this.limites, ...partial };
    await store.update('config', { key: 'limites', value });
    this._cache = { ...(this._cache || {}), limites: value };
    return value;
  },

  async saveMoneda(store, partial) {
    const value = { ...this.moneda, ...partial };
    await store.update('config', { key: 'moneda', value });
    this._cache = { ...(this._cache || {}), moneda: value };
    return value;
  }
};

// ============================================================================
// 🛠️ HELPERS PUROS
// ============================================================================
export function formatMoney(amount) {
  const mon = settings.moneda;
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(mon.locale, {
      style: 'currency', currency: mon.codigo,
      minimumFractionDigits: mon.decimales, maximumFractionDigits: mon.decimales
    }).format(n);
  } catch {
    return `${mon.simbolo}${n.toFixed(mon.decimales)}`;
  }
}

export function formatDate(date) {
  return new Intl.DateTimeFormat(settings.moneda.locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat(settings.moneda.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

export function mesKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function mesLabel(key) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString(settings.moneda.locale, { month: 'long', year: 'numeric' });
}

export function esMesActual(date) {
  return mesKey(date) === mesKey(new Date());
}

export function diasRestantes(fecha) {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
}

export function isValidMonto(monto) {
  const n = parseFloat(monto);
  return !isNaN(n) && n >= VALIDATIONS.monto.min && n <= VALIDATIONS.monto.max;
}

export function generarId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Distribución automática de un ingreso según su fuente */
export function calcularDistribucion(fuente, monto) {
  const regla = DISTRIBUTION_RULES[fuente];
  if (!regla) return { [PILARES.AHORRO]: monto };
  const dist = {};
  Object.entries(regla).forEach(([pilar, pct]) => {
    dist[pilar] = Math.round(monto * pct * 100) / 100;
  });
  const suma = Object.values(dist).reduce((a, b) => a + b, 0);
  const primer = Object.keys(dist)[0];
  dist[primer] = Math.round((dist[primer] + (monto - suma)) * 100) / 100;
  return dist;
}

/** Impacto con signo de un movimiento sobre un pilar */
export function impactoPilar(m, pilar) {
  if (m.tipo === TIPOS.INGRESO) return Number(m.distribucion?.[pilar]) || 0;
  if (m.pilar === pilar && m.fuente !== FUENTES.STIKMANIA) return -(Number(m.monto) || 0);
  return 0;
}

/** Saldos agregados (solo pagados cuentan para saldo y pilares) */
export function calcularSaldos(movs = []) {
  const pilaresInit = () => ({ [PILARES.FIJOS]: 0, [PILARES.OCIO]: 0, [PILARES.INVERSION]: 0, [PILARES.AHORRO]: 0 });
  const s = {
    total: 0, efectivo: 0, transferencia: 0,
    ingresos: 0, gastos: 0, asignado: 0, sinAsignar: 0,
    pilares: pilaresInit(), pilaresIn: pilaresInit(), pilaresOut: pilaresInit(),
    porFuente: {},
    stik: { ingresos: 0, gastos: 0 },
    pendientesCobrar: 0, pendientesPagar: 0
  };

  for (const m of movs) {
    const monto = Number(m.monto) || 0;

    if (m.estado === ESTADOS.PENDIENTE) {
      m.tipo === TIPOS.INGRESO ? s.pendientesCobrar += monto : s.pendientesPagar += monto;
      continue;
    }

    const signo = m.tipo === TIPOS.INGRESO ? 1 : -1;
    s.total += signo * monto;
    m.metodo === METODOS.EFECTIVO ? s.efectivo += signo * monto : s.transferencia += signo * monto;

    if (m.tipo === TIPOS.INGRESO) {
      s.ingresos += monto;
      s.porFuente[m.fuente] = (s.porFuente[m.fuente] || 0) + monto;
      if (m.fuente === FUENTES.STIKMANIA) s.stik.ingresos += monto;
      if (m.distribucion && Object.keys(m.distribucion).length) {
        s.asignado += monto;
        for (const [p, v] of Object.entries(m.distribucion)) {
          const val = Number(v) || 0;
          if (p in s.pilares) { s.pilares[p] += val; s.pilaresIn[p] += val; }
        }
      } else {
        s.sinAsignar += monto;
      }
    } else {
      s.gastos += monto;
      // Gasto de negocio: afecta Stikmania y saldo total, NO pilares personales
      if (m.fuente === FUENTES.STIKMANIA) s.stik.gastos += monto;
      else if (m.pilar in s.pilares) { s.pilares[m.pilar] -= monto; s.pilaresOut[m.pilar] += monto; }
    }
  }
  return s;
}