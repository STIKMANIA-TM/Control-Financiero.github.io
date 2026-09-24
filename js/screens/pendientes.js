/**
 * screens/pendientes.js — Cuentas por cobrar y por pagar
 */
import { store } from '../store.js';
import { notifier } from '../notifications.js';
import { TIPOS, ESTADOS, SYNC_STATUS, formatMoney, formatDate, diasRestantes } from '../config.js';

function badgeVencimiento(m) {
  if (!m.fecha_vencimiento) return '<span class="badge badge-sin">Sin fecha</span>';
  const dias = diasRestantes(m.fecha_vencimiento);
  if (dias < 0) return `<span class="badge badge-vencido">Vencido hace ${Math.abs(dias)} d</span>`;
  if (dias <= 3) return `<span class="badge badge-pronto">Vence en ${dias} d</span>`;
  return `<span class="badge badge-ok">En ${dias} d</span>`;
}

function itemPendiente(m) {
  const cobrar = m.tipo === TIPOS.INGRESO;
  return `
  <div class="pend-item ${!m.fecha_vencimiento || diasRestantes(m.fecha_vencimiento) >= 0 ? '' : 'vencido'}">
    <div class="pend-head">
      <div>
        <div class="pend-title">${cobrar ? '📥' : '📤'} ${m.fuente}${m.pilar ? ` · ${m.pilar}` : ''}</div>
        <div class="pend-meta">${m.nota || 'Sin nota'} ${m.fecha_vencimiento ? `· 📅 ${formatDate(m.fecha_vencimiento)}` : ''}</div>
      </div>
      <div class="pend-right">
        <div class="pend-amount ${cobrar ? 'ingreso' : 'gasto'}">${cobrar ? '+' : '-'}${formatMoney(m.monto)}</div>
        ${badgeVencimiento(m)}
      </div>
    </div>
    <div class="pend-actions">
      <input type="date" class="form-input pend-date" data-date-id="${m.id}" value="${m.fecha_vencimiento ? m.fecha_vencimiento.slice(0, 10) : ''}">
      <button class="btn-small btn-success" data-pagar="${m.id}">✓ Marcar pagado</button>
      <button class="btn-small btn-danger-soft" data-del="${m.id}">🗑️</button>
    </div>
  </div>`;
}

export async function renderPendientes(container) {
  const movs = await store.getAll('movimientos');
  const pendientes = movs.filter(m => m.estado === ESTADOS.PENDIENTE)
    .sort((a, b) => (a.fecha_vencimiento || '9999').localeCompare(b.fecha_vencimiento || '9999'));

  const cobrar = pendientes.filter(m => m.tipo === TIPOS.INGRESO);
  const pagar = pendientes.filter(m => m.tipo === TIPOS.GASTO);
  const totalCobrar = cobrar.reduce((a, m) => a + Number(m.monto), 0);
  const totalPagar = pagar.reduce((a, m) => a + Number(m.monto), 0);
  const vencidos = pendientes.filter(m => m.fecha_vencimiento && diasRestantes(m.fecha_vencimiento) < 0);

  container.innerHTML = `
    <section class="card">
      <h3 class="card-title">⏳ Resumen de pendientes</h3>
      <div class="kpi-grid kpi-3">
        <div class="kpi-card"><div class="kpi-label">Por cobrar</div><div class="kpi-value ok">${formatMoney(totalCobrar)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Por pagar</div><div class="kpi-value bad">${formatMoney(totalPagar)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Vencidos</div><div class="kpi-value ${vencidos.length ? 'bad' : ''}">${vencidos.length}</div></div>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">📥 Cuentas por cobrar <span class="chip">${cobrar.length}</span></h3>
      ${cobrar.length ? cobrar.map(itemPendiente).join('') : '<div class="empty-state">Nada por cobrar 🎉</div>'}
    </section>

    <section class="card">
      <h3 class="card-title">📤 Cuentas por pagar <span class="chip">${pagar.length}</span></h3>
      ${pagar.length ? pagar.map(itemPendiente).join('') : '<div class="empty-state">Nada por pagar 🎉</div>'}
    </section>
  `;

  // Marcar pagado
  container.querySelectorAll('[data-pagar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await store.patch('movimientos', btn.dataset.pagar, {
        estado: ESTADOS.PAGADO,
        sync_status: SYNC_STATUS.PENDING
      });
      notifier.showSync('sync', 'Movimiento marcado como pagado');
      renderPendientes(container);
    });
  });

  // Editar fecha
  container.querySelectorAll('[data-date-id]').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.dataset.dateId;
      const value = input.value ? new Date(`${input.value}T12:00:00`).toISOString() : null;
      await store.patch('movimientos', id, { fecha_vencimiento: value, sync_status: SYNC_STATUS.PENDING });
      renderPendientes(container);
    });
  });

  // Eliminar
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este pendiente?')) return;
      await store.delete('movimientos', btn.dataset.del);
      renderPendientes(container);
    });
  });
}