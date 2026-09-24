/**
 * screens/inicio.js — Dashboard: asignación del mes, ciclo de propinas, respaldos
 */
import { store } from '../store.js';
import { notifier } from '../notifications.js';
import {
  CICLO_PROPINAS, DISTRIBUTION_RULES_TEXT, FUENTES, TIPOS, METODOS, ESTADOS, SYNC_STATUS,
  formatMoney, formatDateTime, esMesActual, calcularSaldos, generarId, settings
} from '../config.js';

// Base64 seguro para Unicode
const encodeBase64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
};
const decodeBase64 = (b64) => {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

function timelineItem(m) {
  const ing = m.tipo === TIPOS.INGRESO;
  return `
    <div class="timeline-item">
      <div class="timeline-icon ${ing ? 'ingreso' : 'gasto'}">${ing ? '💰' : '💸'}</div>
      <div class="timeline-content">
        <div class="timeline-title">${m.fuente}${m.estado === ESTADOS.PENDIENTE ? ' ⏳' : ''}</div>
        <div class="timeline-meta">${m.pilar || '—'} · ${m.metodo} · ${formatDateTime(m.created_at)}</div>
      </div>
      <div class="timeline-amount ${ing ? 'ingreso' : 'gasto'}">${ing ? '+' : '-'}${formatMoney(m.monto)}</div>
    </div>`;
}

export async function renderInicio(container) {
  await settings.load(store);

  const movs = await store.getAll('movimientos');
  const ciclo = (await store.getAll('cicloPropinas'))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const sMes = calcularSaldos(movs.filter(m => esMesActual(m.created_at)));
  const recientes = movs.slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5);

  const backupParam = new URLSearchParams(location.search).get('backup');

  container.innerHTML = `
    ${backupParam ? `
    <div class="banner-import">
      <div>📥 Se detectó un respaldo de datos en el enlace.</div>
      <div class="banner-actions">
        <button class="btn-small btn-primary" id="btnImportLink">Importar</button>
        <button class="btn-small" id="btnCancelLink">Cancelar</button>
      </div>
    </div>` : ''}

    <section class="card">
      <h3 class="card-title">🎯 Asignación automática del mes</h3>
      <div class="kpi-grid kpi-3">
        <div class="kpi-card"><div class="kpi-label">Ingresos pagados</div><div class="kpi-value">${formatMoney(sMes.ingresos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Asignado</div><div class="kpi-value ok">${formatMoney(sMes.asignado)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Sin asignar</div><div class="kpi-value ${sMes.sinAsignar > 0 ? 'warn' : ''}">${formatMoney(sMes.sinAsignar)}</div></div>
      </div>
      <p class="rule-text">${Object.entries(DISTRIBUTION_RULES_TEXT).map(([f, t]) => `<strong>${f}:</strong> ${t}`).join(' · ')}</p>
    </section>

    <section class="card cycle-card">
      <h3 class="card-title">🔄 Ciclo de propinas <span class="chip">${ciclo.length}/${CICLO_PROPINAS.total}</span></h3>
      <p class="muted">Mayor → ${CICLO_PROPINAS.distribucion[0]} · Intermedia → ${CICLO_PROPINAS.distribucion[1]} · Menor → ${CICLO_PROPINAS.distribucion[2]}</p>
      <div class="cycle-dots">
        ${[0, 1, 2].map(i => ciclo[i]
          ? `<div class="cycle-dot active">${formatMoney(ciclo[i].monto)}</div>`
          : `<div class="cycle-dot">${i + 1}</div>`).join('')}
      </div>
      <div class="cycle-form">
        <input type="number" id="cicloMonto" class="form-input" step="0.01" min="0.01" placeholder="Monto de propina">
        <button class="btn-small btn-primary" id="btnAddCiclo">+ Agregar</button>
      </div>
      <div class="cycle-actions">
        <button class="btn-small btn-success" id="btnCerrarCiclo" ${ciclo.length < CICLO_PROPINAS.total ? 'disabled' : ''}>Cerrar ciclo</button>
        <button class="btn-small btn-danger-soft" id="btnBorrarCiclo" ${ciclo.length === 0 ? 'disabled' : ''}>Borrar ciclo</button>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">🕐 Movimientos recientes</h3>
      ${recientes.length
        ? recientes.map(timelineItem).join('')
        : '<div class="empty-state"><div class="empty-icon">📭</div>Aún no hay movimientos</div>'}
    </section>

    <section class="card">
      <h3 class="card-title">🛟 Respaldo y configuración</h3>
      <div class="backup-actions">
        <button class="btn-small" id="btnGenLink">🔗 Enlace de sincronización</button>
        <button class="btn-small" id="btnExport">📤 Exportar JSON</button>
        <button class="btn-small" id="btnImport">📥 Importar JSON</button>
        <button class="btn-small" id="btnSettings">⚙️ Límites y moneda</button>
        <input type="file" id="fileImport" accept="application/json" hidden>
      </div>
    </section>
  `;

  bindInicio(container, ciclo, backupParam);
}

// ============================================================================
// EVENTOS
// ============================================================================
async function bindInicio(container, ciclo, backupParam) {
  // --- Ciclo de propinas ---
  container.querySelector('#btnAddCiclo')?.addEventListener('click', async () => {
    const input = container.querySelector('#cicloMonto');
    const monto = parseFloat(input.value);
    if (!monto || monto <= 0) return notifier.showAlert('Ingresa un monto válido', 'normal');
    if (ciclo.length >= CICLO_PROPINAS.total) return notifier.showAlert('El ciclo ya tiene 3 propinas', 'normal');
    await store.add('cicloPropinas', { id: generarId(), monto });
    renderInicio(container);
  });

  container.querySelector('#btnCerrarCiclo')?.addEventListener('click', async () => {
    if (ciclo.length < CICLO_PROPINAS.total) return;
    if (!confirm('¿Cerrar el ciclo y asignar las 3 propinas a sus pilares?')) return;

    const orden = [...ciclo].sort((a, b) => b.monto - a.monto);
    const nuevos = orden.map((p, i) => ({
      id: generarId(),
      tipo: TIPOS.INGRESO,
      monto: p.monto,
      metodo: METODOS.EFECTIVO,
      fuente: FUENTES.PROPINA,
      pilar: null,
      nota: `Ciclo propinas · ${CICLO_PROPINAS.etiquetas[i]}`,
      estado: ESTADOS.PAGADO,
      ciclo_propina: i + 1,
      distribucion: { [CICLO_PROPINAS.distribucion[i]]: p.monto },
      sync_status: SYNC_STATUS.PENDING
    }));

    await store.bulkAdd('movimientos', nuevos);
    await store.clear('cicloPropinas');
    notifier.showCicloPropinas(orden[0].monto, CICLO_PROPINAS.distribucion[0]);
    renderInicio(container);
  });

  container.querySelector('#btnBorrarCiclo')?.addEventListener('click', async () => {
    if (!confirm('¿Borrar las propinas registradas en el ciclo actual?')) return;
    await store.clear('cicloPropinas');
    renderInicio(container);
  });

  // --- Respaldos ---
  container.querySelector('#btnExport')?.addEventListener('click', async () => {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `respaldo-financiero-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  container.querySelector('#btnImport')?.addEventListener('click', () => {
    container.querySelector('#fileImport').click();
  });

  container.querySelector('#fileImport')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importData(text, container);
    } catch (err) {
      notifier.showAlert('Archivo de respaldo inválido', 'alta');
    }
  });

  container.querySelector('#btnGenLink')?.addEventListener('click', async () => {
    const data = await store.exportAll();
    const url = `${location.origin}${location.pathname}?backup=${encodeURIComponent(encodeBase64(JSON.stringify(data)))}`;
    showLinkModal(url);
  });

  // --- Importar desde enlace ---
  if (backupParam) {
    container.querySelector('#btnImportLink')?.addEventListener('click', async () => {
      try {
        await importData(decodeBase64(decodeURIComponent(backupParam)), container);
        limpiarUrl();
      } catch {
        notifier.showAlert('El enlace de respaldo es inválido', 'alta');
      }
    });
    container.querySelector('#btnCancelLink')?.addEventListener('click', () => {
      limpiarUrl();
      renderInicio(container);
    });
  }

  // --- Settings ---
  container.querySelector('#btnSettings')?.addEventListener('click', () => openSettingsModal(container));
}

async function importData(json, container) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data?.data) throw new Error('Respaldo inválido');
  const total = Object.values(data.data).reduce((a, arr) => a + arr.length, 0);
  if (!confirm(`¿Importar ${total} registros? Se reemplazarán los datos locales actuales.`)) return;
  await store.importAll(data);
  notifier.showSync('sync', 'Respaldo importado correctamente');
  renderInicio(container);
}

function limpiarUrl() {
  history.replaceState(null, '', location.pathname + location.hash);
}

function showLinkModal(url) {
  const wrap = document.createElement('div');
  wrap.className = 'modal active';
  wrap.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>🔗 Enlace de sincronización</h2><button class="modal-close" data-close>×</button></div>
      <div class="modal-body">
        <p class="muted">⚠️ Este enlace contiene TODOS tus datos financieros. No lo compartas.</p>
        <textarea class="form-input" rows="4" readonly id="linkOutput">${url}</textarea>
        <div class="form-actions"><button class="btn-primary btn-full" id="btnCopyLink">📋 Copiar enlace</button></div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-close]').onclick = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  wrap.querySelector('#btnCopyLink').onclick = async () => {
    await navigator.clipboard.writeText(url);
    wrap.querySelector('#btnCopyLink').textContent = '✓ Copiado';
  };
}

async function openSettingsModal(container) {
  const lim = settings.limites;
  const mon = settings.moneda;
  const wrap = document.createElement('div');
  wrap.className = 'modal active';
  wrap.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>⚙️ Límites y moneda</h2><button class="modal-close" data-close>×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>% máx de Ocio sobre gastos</label><input id="setOcio" type="number" step="1" class="form-input" value="${Math.round(lim.maxOcioPct * 100)}"></div>
        <div class="form-group"><label>Margen mínimo Stikmania %</label><input id="setMargen" type="number" step="1" class="form-input" value="${Math.round(lim.margenMinimoStikmania * 100)}"></div>
        <div class="form-group"><label>Umbral de gasto alto</label><input id="setUmbral" type="number" step="1" class="form-input" value="${lim.umbralGastoAlto}"></div>
        <div class="form-group"><label>Símbolo de moneda</label><input id="setSimbolo" type="text" class="form-input" value="${mon.simbolo}"></div>
        <div class="form-group"><label>Código ISO (USD, MXN, COP...)</label><input id="setCodigo" type="text" class="form-input" value="${mon.codigo}"></div>
        <div class="form-actions"><button class="btn-primary btn-full" id="btnSaveSettings">Guardar</button></div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-close]').onclick = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  wrap.querySelector('#btnSaveSettings').onclick = async () => {
    await settings.saveLimites(store, {
      maxOcioPct: Number(wrap.querySelector('#setOcio').value) / 100,
      margenMinimoStikmania: Number(wrap.querySelector('#setMargen').value) / 100,
      umbralGastoAlto: Number(wrap.querySelector('#setUmbral').value)
    });
    await settings.saveMoneda(store, {
      simbolo: wrap.querySelector('#setSimbolo').value || '$',
      codigo: (wrap.querySelector('#setCodigo').value || 'USD').toUpperCase()
    });
    wrap.remove();
    renderInicio(container);
  };
}