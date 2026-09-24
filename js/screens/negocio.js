/**
 * screens/negocio.js — Stikmania: KPIs, cuentas e inventario (Modelo Wilson)
 */
import { store } from '../store.js';
import { notifier } from '../notifications.js';
import {
  WILSON_DEFAULTS, ESTADOS, formatMoney, esMesActual, calcularSaldos, generarId, settings
} from '../config.js';

// Fórmulas del Modelo Wilson
const wilson = {
  Q: (D, S, g) => Math.sqrt((2 * D * S) / g),
  reorden: (demDiaria, plazo, ss) => (demDiaria * plazo) + ss,
  costoTotal: (D, Q, S, g, ss = 0) => (D / Q) * S + (Q / 2 + ss) * g,
  pedidos: (D, Q) => D / Q,
  entrePedidos: (N) => 365 / N
};

function analizarMaterial(it) {
  const D = (Number(it.demandaMensual) || 0) * 12;
  const S = WILSON_DEFAULTS.costoPedido;
  const g = WILSON_DEFAULTS.costoAlmacenamiento;
  const Q = wilson.Q(D, S, g);
  const Rp = wilson.reorden((Number(it.demandaMensual) || 0) / 30, Number(it.plazoEntrega) || WILSON_DEFAULTS.plazoEntregaDefault, Number(it.stockMinimo) || 0);
  const N = wilson.pedidos(D, Q);
  const T = wilson.entrePedidos(N);
  const CT = wilson.costoTotal(D, Q, S, g, Number(it.stockMinimo) || 0);

  let estado = 'ok', badge = '🟢 Stock OK';
  if ((Number(it.cantidad) || 0) <= (Number(it.stockMinimo) || 0)) { estado = 'critico'; badge = '🔴 Crítico'; }
  else if ((Number(it.cantidad) || 0) <= Rp) { estado = 'pedir'; badge = '🟡 Pedir pronto'; }

  return { D, Q, Rp, N, T, CT, estado, badge };
}

export async function renderNegocio(container) {
  await settings.load(store);
  const movs = await store.getAll('movimientos');
  const s = calcularSaldos(movs);
  const sMes = calcularSaldos(movs.filter(m => esMesActual(m.created_at)));
  const inventario = await store.getAll('inventario');

  const margenMes = sMes.stik.ingresos > 0 ? ((sMes.stik.ingresos - sMes.stik.gastos) / sMes.stik.ingresos) : 0;
  const margenHist = s.stik.ingresos > 0 ? ((s.stik.ingresos - s.stik.gastos) / s.stik.ingresos) : 0;
  const margenBajo = sMes.stik.ingresos > 0 && margenMes < settings.limites.margenMinimoStikmania;

  container.innerHTML = `
    <section class="card">
      <h3 class="card-title">💼 Stikmania: este mes</h3>
      <div class="kpi-grid kpi-4">
        <div class="kpi-card"><div class="kpi-label">Ingresos</div><div class="kpi-value ok">${formatMoney(sMes.stik.ingresos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Gastos</div><div class="kpi-value bad">${formatMoney(sMes.stik.gastos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Neto</div><div class="kpi-value ${sMes.stik.ingresos - sMes.stik.gastos >= 0 ? 'ok' : 'bad'}">${formatMoney(sMes.stik.ingresos - sMes.stik.gastos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Margen</div><div class="kpi-value ${margenBajo ? 'warn' : ''}">${(margenMes * 100).toFixed(1)}%</div></div>
      </div>
      ${margenBajo ? `<div class="alert danger">💼 Margen por debajo del mínimo (${settings.limites.margenMinimoStikmania * 100}%). Revisa costos o precios.</div>` : ''}
    </section>

    <section class="card">
      <h3 class="card-title">📈 Stikmania: histórico</h3>
      <div class="kpi-grid kpi-4">
        <div class="kpi-card"><div class="kpi-label">Ingresos</div><div class="kpi-value">${formatMoney(s.stik.ingresos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Gastos</div><div class="kpi-value">${formatMoney(s.stik.gastos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Neto</div><div class="kpi-value ${s.stik.ingresos - s.stik.gastos >= 0 ? 'ok' : 'bad'}">${formatMoney(s.stik.ingresos - s.stik.gastos)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Margen</div><div class="kpi-value">${(margenHist * 100).toFixed(1)}%</div></div>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">🧾 Cuentas del negocio</h3>
      <div class="kpi-grid kpi-2">
        <div class="kpi-card"><div class="kpi-label">Por cobrar</div><div class="kpi-value ok">${formatMoney(s.pendientesCobrar)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Por pagar</div><div class="kpi-value bad">${formatMoney(s.pendientesPagar)}</div></div>
      </div>
      <button class="btn-small btn-primary" style="margin-top:12px" onclick="window.appNavigate('pendientes')">Gestionar pendientes →</button>
    </section>

    <section class="card">
      <h3 class="card-title">📦 Inventario · Modelo Wilson</h3>
      <p class="muted">Q* = √(2·D·S/g) · Punto de reorden = (demanda diaria × plazo) + stock mínimo</p>
      ${inventario.length ? inventario.map(it => {
        const a = analizarMaterial(it);
        return `
        <details class="details-card inv-item ${a.estado}">
          <summary>
            <strong>${it.material}</strong>
            <span class="chip">${it.cantidad} uds</span>
            <span class="badge badge-${a.estado}">${a.badge}</span>
          </summary>
          <div class="inv-detail">
            <div class="inv-row"><span>Punto de reorden (Pp)</span><strong>${a.Rp.toFixed(1)} uds</strong></div>
            <div class="inv-row"><span>Pedido óptimo (Q*)</span><strong>${a.Q.toFixed(1)} uds</strong></div>
            <div class="inv-row"><span>Pedidos por año (N)</span><strong>${a.N.toFixed(1)}</strong></div>
            <div class="inv-row"><span>Días entre pedidos (T)</span><strong>${a.T.toFixed(0)} días</strong></div>
            <div class="inv-row"><span>Costo total anual</span><strong>${formatMoney(a.CT)}</strong></div>
            ${a.estado !== 'ok' ? `<div class="alert">📦 Pedir ~${Math.max(0, Math.round(a.Q - it.cantidad))} uds de ${it.material}</div>` : ''}
            <button class="btn-small btn-danger-soft" data-del-inv="${it.id}">🗑️ Eliminar material</button>
          </div>
        </details>`;
      }).join('') : '<div class="empty-state"><div class="empty-icon">📦</div>Sin materiales registrados</div>'}

      <details class="details-card" style="margin-top:12px">
        <summary>➕ Agregar material</summary>
        <form id="formInventario" class="inv-form">
          <div class="form-group"><label>Material</label><input id="invMaterial" class="form-input" required placeholder="Ej: Vinil blanco"></div>
          <div class="kpi-grid kpi-2">
            <div class="form-group"><label>Stock actual</label><input id="invCantidad" type="number" step="1" min="0" class="form-input" required></div>
            <div class="form-group"><label>Demanda mensual</label><input id="invDemanda" type="number" step="1" min="0" class="form-input" required></div>
            <div class="form-group"><label>Plazo entrega (días)</label><input id="invPlazo" type="number" step="1" min="0" class="form-input" value="${WILSON_DEFAULTS.plazoEntregaDefault}"></div>
            <div class="form-group"><label>Stock mínimo</label><input id="invMin" type="number" step="1" min="0" class="form-input" value="0"></div>
          </div>
          <button type="submit" class="btn-primary btn-full">Guardar material</button>
        </form>
      </details>
    </section>
  `;

  // Eventos
  container.querySelector('#formInventario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = {
      id: generarId(),
      material: container.querySelector('#invMaterial').value.trim(),
      cantidad: Number(container.querySelector('#invCantidad').value) || 0,
      demandaMensual: Number(container.querySelector('#invDemanda').value) || 0,
      plazoEntrega: Number(container.querySelector('#invPlazo').value) || WILSON_DEFAULTS.plazoEntregaDefault,
      stockMinimo: Number(container.querySelector('#invMin').value) || 0
    };
    if (!item.material) return;
    await store.add('inventario', item);
    const a = analizarMaterial(item);
    if (a.estado === 'critico') notifier.showWilsonAlert(item.material, item.cantidad, a.Rp.toFixed(0));
    renderNegocio(container);
  });

  container.querySelectorAll('[data-del-inv]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este material del inventario?')) return;
      await store.delete('inventario', btn.dataset.delInv);
      renderNegocio(container);
    });
  });
}