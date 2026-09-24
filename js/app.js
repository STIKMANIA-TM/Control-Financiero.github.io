/**
 * app.js — Entry point: layout, router, modal y reactividad global
 */

import { store } from './store.js';
import { syncManager } from './sync.js';
import { notifier } from './notifications.js';
import { router } from './router.js';
import {
  ROUTES, NAV_ITEMS, TIPOS, METODOS, FUENTES, PILARES, ESTADOS, SYNC_STATUS,
  formatMoney, calcularDistribucion, calcularSaldos, generarId, isValidMonto, settings,
  DISTRIBUTION_RULES_TEXT
} from './config.js';

import { renderInicio } from './screens/inicio.js';
import { renderPilares } from './screens/pilares.js';
import { renderNegocio } from './screens/negocio.js';
import { renderPendientes } from './screens/pendientes.js';
import { renderHistorial } from './screens/historial.js';

const RENDERERS = {
  [ROUTES.INICIO]: renderInicio,
  [ROUTES.PILARES]: renderPilares,
  [ROUTES.NEGOCIO]: renderNegocio,
  [ROUTES.PENDIENTES]: renderPendientes,
  [ROUTES.HISTORIAL]: renderHistorial
};

// Estado del modal
let modalTipo = TIPOS.GASTO;
let modalMetodo = METODOS.EFECTIVO;

// ============================================================================
// 🎨 LAYOUT
// ============================================================================
function renderLayout() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <header class="app-header">
      <div class="header-top">
        <h1 class="app-title">💰 Control Financiero</h1>
        <div class="header-actions">
          <button id="btnSyncManual" class="btn-sync" title="Sincronizar ahora"><span class="sync-icon">🔄</span></button>
          <div id="syncBadge" class="sync-badge offline"><span class="sync-dot"></span><span class="sync-text">Offline</span></div>
        </div>
      </div>
      <div class="header-saldo">
        <div class="saldo-label">Saldo Total Disponible</div>
        <div id="saldoTotal" class="saldo-amount">$0.00</div>
        <div class="saldo-methods">
          <div class="saldo-method">💵 <span id="efectivoTotal">$0.00</span></div>
          <div class="saldo-method">💳 <span id="transferenciaTotal">$0.00</span></div>
        </div>
      </div>
    </header>

    <main class="screens-container">
      <div id="screen-inicio" class="screen"></div>
      <div id="screen-pilares" class="screen"></div>
      <div id="screen-negocio" class="screen"></div>
      <div id="screen-pendientes" class="screen"></div>
      <div id="screen-historial" class="screen"></div>
    </main>

    <button id="fabNuevo" class="fab" title="Nuevo movimiento">+</button>

    <nav class="nav-bottom">
      ${NAV_ITEMS.map(item => `
        <button class="nav-item" data-route="${item.id}">
          <div class="nav-icon">${item.icon}</div>
          <span>${item.label}</span>
        </button>`).join('')}
    </nav>

    <div id="modalNuevo" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Nuevo Movimiento</h2>
          <button class="modal-close" id="modalClose">×</button>
        </div>
        <div class="modal-body" id="modalBody"></div>
      </div>
    </div>
  `;

  bindGlobalEvents();
}

function bindGlobalEvents() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });

  document.getElementById('btnSyncManual')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.classList.add('spinning');
    try { await syncManager.forceSync(); }
    finally {
      setTimeout(() => { btn.disabled = false; btn.classList.remove('spinning'); }, 800);
    }
  });

  document.getElementById('fabNuevo')?.addEventListener('click', () => window.openModal());
  document.getElementById('modalClose')?.addEventListener('click', () => window.closeModal());

  document.getElementById('modalNuevo')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalNuevo') window.closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeModal();
  });
}

// ============================================================================
// 🔄 REACTIVIDAD
// ============================================================================
async function updateHeaderSaldo() {
  try {
    const movs = await store.getAll('movimientos');
    const s = calcularSaldos(movs);
    const saldoEl = document.getElementById('saldoTotal');
    if (saldoEl) {
      saldoEl.textContent = formatMoney(s.total);
      saldoEl.className = 'saldo-amount' + (s.total < 0 ? ' negative' : '');
    }
    const ef = document.getElementById('efectivoTotal');
    const tr = document.getElementById('transferenciaTotal');
    if (ef) ef.textContent = formatMoney(s.efectivo);
    if (tr) tr.textContent = formatMoney(s.transferencia);
  } catch (err) {
    console.error('Error actualizando saldo:', err);
  }
}

function updateSyncBadge() {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  const st = syncManager.getStatus();
  let state, text;
  if (!st.isOnline) { state = 'offline'; text = 'Offline'; }
  else if (st.isSyncing) { state = 'syncing'; text = 'Sincronizando...'; }
  else if (st.pendingChanges > 0) { state = 'pending'; text = `${st.pendingChanges} pendientes`; }
  else { state = 'online'; text = 'Sincronizado'; }
  badge.className = `sync-badge ${state}`;
  badge.innerHTML = `<span class="sync-dot"></span><span class="sync-text">${text}</span>`;
}

function updateActiveNav(routeId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === routeId);
  });
}

async function renderActiveScreen(routeId) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.innerHTML = ''; });
  const el = document.getElementById(`screen-${routeId}`);
  if (el) el.classList.add('active');

  const renderer = RENDERERS[routeId];
  if (renderer && el) {
    try { await renderer(el); }
    catch (err) {
      console.error(`Error renderizando ${routeId}:`, err);
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>Error al cargar la pantalla</div>';
    }
  }
}

function setupGlobalEvents() {
  // Re-render ante cambios locales o remotos en cualquier tabla sincronizada
  ['movimientos', 'inventario', 'cicloPropinas'].forEach(storeName => {
    store.subscribe(`${storeName}:*`, async () => {
      await updateHeaderSaldo();
      const current = router.getCurrentRoute();
      if (current) await renderActiveScreen(current);
    });
  });

  setInterval(updateSyncBadge, 2000);
}

// ============================================================================
// 📝 MODAL NUEVO MOVIMIENTO
// ============================================================================
window.openModal = () => {
  modalTipo = TIPOS.GASTO;
  modalMetodo = METODOS.EFECTIVO;
  document.getElementById('modalNuevo')?.classList.add('active');
  renderModalForm();
};

window.closeModal = () => {
  document.getElementById('modalNuevo')?.classList.remove('active');
};

function renderModalForm() {
  const body = document.getElementById('modalBody');
  if (!body) return;

  body.innerHTML = `
    <form id="formMovimiento">
      <div class="form-group">
        <label>Tipo</label>
        <div class="tipo-selector">
          <button type="button" class="tipo-btn ${modalTipo === TIPOS.GASTO ? 'active' : ''}" data-tipo="${TIPOS.GASTO}">💸 Gasto</button>
          <button type="button" class="tipo-btn ${modalTipo === TIPOS.INGRESO ? 'active' : ''}" data-tipo="${TIPOS.INGRESO}">💰 Ingreso</button>
        </div>
      </div>

      <div class="form-group">
        <label>Monto</label>
        <input type="number" id="movMonto" class="form-input" step="0.01" min="0.01" placeholder="0.00" required>
      </div>

      <div class="form-group">
        <label>Método</label>
        <div class="metodo-selector">
          <button type="button" class="metodo-btn ${modalMetodo === METODOS.EFECTIVO ? 'active' : ''}" data-metodo="${METODOS.EFECTIVO}">💵 Efectivo</button>
          <button type="button" class="metodo-btn ${modalMetodo === METODOS.TRANSFERENCIA ? 'active' : ''}" data-metodo="${METODOS.TRANSFERENCIA}">💳 Transferencia</button>
        </div>
      </div>

      <div class="form-group">
        <label>Fuente</label>
        <select id="movFuente" class="form-input"></select>
      </div>

      <div class="form-group" id="grpPilar">
        <label>Pilar</label>
        <select id="movPilar" class="form-input">
          ${Object.values(PILARES).map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>

      <p id="notaNegocio" class="rule-text" style="display:none">
        Gasto de negocio: afecta Stikmania y el saldo total, pero no los pilares personales.
      </p>

      <div class="form-group">
        <label>Nota</label>
        <input type="text" id="movNota" class="form-input" maxlength="500" placeholder="Descripción opcional">
      </div>

      <div class="form-group">
        <label>Estado</label>
        <select id="movEstado" class="form-input">
          <option value="${ESTADOS.PAGADO}">Pagado</option>
          <option value="${ESTADOS.PENDIENTE}">Pendiente</option>
        </select>
      </div>

      <div class="form-group">
        <label>Fecha de vencimiento</label>
        <input type="date" id="movVencimiento" class="form-input">
      </div>

      <div id="previewAsignacion" class="preview-box" style="display:none">
        <div class="preview-title">Asignación automática:</div>
        <div id="previewContent"></div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary btn-full">💾 Guardar</button>
      </div>
    </form>
  `;

  bindModalEvents();
  fillFuentes();
  toggleGastoUI();
  updatePreview();
}

function bindModalEvents() {
  const form = document.getElementById('formMovimiento');
  if (!form) return;

  form.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modalTipo = btn.dataset.tipo;
      form.querySelectorAll('.tipo-btn').forEach(b => b.classList.toggle('active', b === btn));
      fillFuentes();
      toggleGastoUI();
      updatePreview();
    });
  });

  form.querySelectorAll('.metodo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modalMetodo = btn.dataset.metodo;
      form.querySelectorAll('.metodo-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('movFuente')?.addEventListener('change', () => { toggleGastoUI(); updatePreview(); });
  document.getElementById('movMonto')?.addEventListener('input', updatePreview);

  form.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(); });
}

function fillFuentes() {
  const select = document.getElementById('movFuente');
  if (!select) return;
  const opciones = modalTipo === TIPOS.INGRESO
    ? [FUENTES.PROPINA, FUENTES.STIKMANIA, FUENTES.SALARIO, FUENTES.OTRO]
    : [FUENTES.PERSONAL, FUENTES.STIKMANIA];
  select.innerHTML = opciones.map(f => `<option value="${f}">${f}</option>`).join('');
}

function toggleGastoUI() {
  const grpPilar = document.getElementById('grpPilar');
  const notaNegocio = document.getElementById('notaNegocio');
  const fuente = document.getElementById('movFuente')?.value;
  if (!grpPilar || !notaNegocio) return;

  if (modalTipo === TIPOS.INGRESO) {
    grpPilar.style.display = 'none';
    notaNegocio.style.display = 'none';
  } else if (fuente === FUENTES.STIKMANIA) {
    grpPilar.style.display = 'none';
    notaNegocio.style.display = 'block';
  } else {
    grpPilar.style.display = 'block';
    notaNegocio.style.display = 'none';
  }
}

function updatePreview() {
  const box = document.getElementById('previewAsignacion');
  const content = document.getElementById('previewContent');
  if (!box || !content) return;

  const monto = parseFloat(document.getElementById('movMonto')?.value) || 0;
  const fuente = document.getElementById('movFuente')?.value;

  if (modalTipo === TIPOS.INGRESO && monto > 0) {
    const dist = calcularDistribucion(fuente, monto);
    box.style.display = 'block';
    content.innerHTML = Object.entries(dist).map(([p, v]) =>
      `<div class="preview-item"><span>${p}</span><strong>${formatMoney(v)}</strong></div>`).join('')
      + `<div class="preview-item muted">${DISTRIBUTION_RULES_TEXT[fuente] || ''}</div>`;
  } else {
    box.style.display = 'none';
  }
}

async function handleFormSubmit() {
  const monto = parseFloat(document.getElementById('movMonto').value);
  if (!isValidMonto(monto)) return notifier.showAlert('Ingresa un monto válido', 'normal');

  const fuenteSelect = document.getElementById('movFuente').value;
  const nota = document.getElementById('movNota').value.trim() || null;
  const estado = document.getElementById('movEstado').value;
  const venc = document.getElementById('movVencimiento').value;

  let fuente, pilar = null, distribucion = null;

  if (modalTipo === TIPOS.INGRESO) {
    fuente = fuenteSelect;
    distribucion = calcularDistribucion(fuente, monto);
  } else {
    if (fuenteSelect === FUENTES.STIKMANIA) {
      fuente = FUENTES.STIKMANIA; // gasto de negocio
      pilar = null;
    } else {
      fuente = FUENTES.PERSONAL;
      pilar = document.getElementById('movPilar').value;
    }
  }

  const movimiento = {
    id: generarId(),
    tipo: modalTipo,
    monto,
    metodo: modalMetodo,
    fuente,
    pilar,
    nota,
    estado,
    fecha_vencimiento: venc ? new Date(`${venc}T12:00:00`).toISOString() : null,
    distribucion,
    ciclo_propina: null,
    sync_status: SYNC_STATUS.PENDING
  };

  try {
    await store.add('movimientos', movimiento);

    if (modalTipo === TIPOS.INGRESO) notifier.showIngreso(monto, fuente);
    else notifier.showGasto(monto, pilar || 'Stikmania');

    if (modalTipo === TIPOS.GASTO && monto >= settings.limites.umbralGastoAlto) {
      notifier.showAlert(`Gasto alto: ${formatMoney(monto)}`, 'normal');
    }

    window.closeModal();
  } catch (err) {
    console.error('Error guardando movimiento:', err);
    notifier.showAlert('Error al guardar el movimiento', 'alta');
  }
}

// ============================================================================
// 🎯 INIT
// ============================================================================
async function init() {
  console.log('🚀 Inicializando Control Financiero...');
  try {
    renderLayout();
    await store.waitForReady();
    await settings.load(store);
    await syncManager.init();
    await notifier.init();

    Object.values(ROUTES).forEach(routeId => {
      router.register(routeId, async () => {
        updateActiveNav(routeId);
        await renderActiveScreen(routeId);
      });
    });

    setupGlobalEvents();
    await updateHeaderSaldo();
    updateSyncBadge();
    router.handleRouteChange();

    console.log('🎉 App lista');
  } catch (err) {
    console.error('❌ Error crítico al inicializar:', err);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-critical">
          <div class="error-icon">🚨</div>
          <h2>Error al iniciar la aplicación</h2>
          <p>${err.message}</p>
          <button onclick="location.reload()" class="btn-primary">🔄 Reintentar</button>
        </div>`;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}