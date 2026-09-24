/**
 * screens/pilares.js — Detalle y historial por pilar
 */
import { store } from '../store.js';
import {
  PILARES, PILAR_COLORS, TIPOS, formatMoney, formatDateTime,
  esMesActual, calcularSaldos, impactoPilar, settings
} from '../config.js';

const CLAVES = [PILARES.FIJOS, PILARES.OCIO, PILARES.INVERSION, PILARES.AHORRO];

export async function renderPilares(container) {
  await settings.load(store);
  const movs = await store.getAll('movimientos');
  const s = calcularSaldos(movs);
  const sMes = calcularSaldos(movs.filter(m => esMesActual(m.created_at)));
  const capital = Math.max(CLAVES.reduce((a, p) => a + s.pilares[p], 0), 0);

  // Alertas
  const alertas = [];
  if (s.gastos > 0) {
    const pctOcio = s.pilaresOut[PILARES.OCIO] / s.gastos;
    if (pctOcio > settings.limites.maxOcioPct) {
      alertas.push(`⚠️ Ocio consume ${(pctOcio * 100).toFixed(1)}% de tus gastos (límite: ${settings.limites.maxOcioPct * 100}%)`);
    }
  }
  if (s.pilares[PILARES.AHORRO] < 0) alertas.push('🚨 Tu pilar de Ahorro está en negativo');

  container.innerHTML = `
    ${alertas.length ? `<div class="card">${alertas.map(a => `<div class="alert danger">${a}</div>`).join('')}</div>` : ''}

    <section class="card">
      <h3 class="card-title">📊 Capital por pilar</h3>
      <div class="pilares-detail-grid">
        ${CLAVES.map(p => {
          const pct = capital > 0 ? (s.pilares[p] / capital) * 100 : 0;
          return `
          <div class="pilar-detail" style="border-left: 4px solid ${PILAR_COLORS[p]}">
            <div class="pilar-detail-head">
              <span class="pilar-detail-name">${p}</span>
              <span class="pilar-detail-pct">${pct.toFixed(1)}%</span>
            </div>
            <div class="pilar-detail-valor">${formatMoney(s.pilares[p])}</div>
            <div class="pilar-bar"><div class="pilar-bar-fill" style="width:${Math.min(100, Math.max(0, pct))}%; background:${PILAR_COLORS[p]}"></div></div>
            <div class="pilar-detail-flujo">
              <span class="in">↑ ${formatMoney(sMes.pilaresIn[p])} este mes</span>
              <span class="out">↓ ${formatMoney(sMes.pilaresOut[p])}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">📜 Historial por pilar</h3>
      ${CLAVES.map(p => {
        const items = movs
          .filter(m => impactoPilar(m, p) !== 0)
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          .slice(0, 6);
        return `
        <details class="details-card">
          <summary>${p} <span class="chip">${items.length} recientes</span></summary>
          ${items.length ? items.map(m => {
            const imp = impactoPilar(m, p);
            return `
            <div class="timeline-item">
              <div class="timeline-icon ${imp > 0 ? 'ingreso' : 'gasto'}">${imp > 0 ? '💰' : '💸'}</div>
              <div class="timeline-content">
                <div class="timeline-title">${m.fuente}${m.nota ? ` · ${m.nota}` : ''}</div>
                <div class="timeline-meta">${formatDateTime(m.created_at)}</div>
              </div>
              <div class="timeline-amount ${imp > 0 ? 'ingreso' : 'gasto'}">${imp > 0 ? '+' : '-'}${formatMoney(Math.abs(imp))}</div>
            </div>`;
          }).join('') : '<div class="empty-state">Sin movimientos en este pilar</div>'}
        </details>`;
      }).join('')}
    </section>
  `;
}