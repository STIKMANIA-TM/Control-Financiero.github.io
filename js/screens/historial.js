/**
 * screens/historial.js — Timeline completo con filtros
 */
import { store } from '../store.js';
import {
  TIPOS, FUENTES, ESTADOS, SYNC_STATUS, formatMoney, formatDateTime, mesKey, mesLabel, calcularSaldos
} from '../config.js';

// Estado de filtros (persiste entre re-renders de la sesión)
let filtros = { tipo: '', fuente: '', mes: '' };

export async function renderHistorial(container) {
  const movs = await store.getAll('movimientos');
  const meses = [...new Set(movs.map(m => mesKey(m.created_at)))].sort().reverse();

  const filtrados = movs
    .filter(m => !filtros.tipo || m.tipo === filtros.tipo)
    .filter(m => !filtros.fuente || m.fuente === filtros.fuente)
    .filter(m => !filtros.mes || mesKey(m.created_at) === filtros.mes)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const s = calcularSaldos(filtrados);

  container.innerHTML = `
    <section class="card">
      <h3 class="card-title">🔍 Filtros</h3>
      <div class="filter-bar">
        <select id="fTipo" class="form-input">
          <option value="">Todos los tipos</option>
          <option value="${TIPOS.INGRESO}" ${filtros.tipo === TIPOS.INGRESO ? 'selected' : ''}>Ingresos</option>
          <option value="${TIPOS.GASTO}" ${filtros.tipo === TIPOS.GASTO ? 'selected' : ''}>Gastos</option>
        </select>
        <select id="fFuente" class="form-input">
          <option value="">Todas las fuentes</option>
          ${Object.values(FUENTES).map(f => `<option value="${f}" ${filtros.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
        <select id="fMes" class="form-input">
          <option value="">Todos los meses</option>
          ${meses.map(k => `<option value="${k}" ${filtros.mes === k ? 'selected' : ''}>${mesLabel(k)}</option>`).join('')}
        </select>
        <button id="fClear" class="btn-small">Limpiar</button>
      </div>
      <div class="kpi-grid kpi-3" style="margin-top:12px">
        <div class="kpi-card"><div class="kpi-label">Ingresos (filtro)</div><div class="kpi-value ok">${formatMoney(s.ingresos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Gastos (filtro)</div><div class="kpi-value bad">${formatMoney(s.gastos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Neto</div><div class="kpi-value">${formatMoney(s.ingresos - s.gastos)}</div></div>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">📜 Historial <span class="chip">${filtrados.length}</span></h3>
      ${filtrados.length ? filtrados.map(itemHistorial).join('') : '<div class="empty-state"><div class="empty-icon">📭</div>Sin resultados con estos filtros</div>'}
    </section>
  `;

  // Eventos de filtros
  container.querySelector('#fTipo').addEventListener('change', (e) => { filtros.tipo = e.target.value; renderHistorial(container); });
  container.querySelector('#fFuente').addEventListener('change', (e) => { filtros.fuente = e.target.value; renderHistorial(container); });
  container.querySelector('#fMes').addEventListener('change', (e) => { filtros.mes = e.target.value; renderHistorial(container); });
  container.querySelector('#fClear').addEventListener('click', () => { filtros = { tipo: '', fuente: '', mes: '' }; renderHistorial(container); });

  // Eliminar
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este movimiento?')) return;
      await store.delete('movimientos', btn.dataset.del);
      renderHistorial(container);
    });
  });
}

function itemHistorial(m) {
  const ing = m.tipo === TIPOS.INGRESO;
  const syncChip = m.sync_status !== SYNC_STATUS.SYNCED ? '<span class="badge badge-pronto">☁️ pendiente nube</span>' : '';
  const dist = m.distribucion && Object.keys(m.distribucion).length
    ? Object.entries(m.distribucion).map(([p, v]) => `${p}: ${formatMoney(v)}`).join(' · ')
    : (m.pilar || '');
  return `
  <div class="timeline-item">
    <div class="timeline-icon ${ing ? 'ingreso' : 'gasto'}">${ing ? '💰' : '💸'}</div>
    <div class="timeline-content">
      <div class="timeline-title">
        ${m.fuente} ${m.estado === ESTADOS.PENDIENTE ? '⏳' : ''} ${syncChip}
      </div>
      <div class="timeline-meta">${formatDateTime(m.created_at)} · ${m.metodo}</div>
      <div class="timeline-dist">${dist}${m.nota ? ` · 📝 ${m.nota}` : ''}</div>
    </div>
    <div class="timeline-right">
      <div class="timeline-amount ${ing ? 'ingreso' : 'gasto'}">${ing ? '+' : '-'}${formatMoney(m.monto)}</div>
      <button class="btn-delete" data-del="${m.id}">🗑️</button>
    </div>
  </div>`;
}