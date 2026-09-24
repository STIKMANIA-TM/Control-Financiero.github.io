import { store } from './store.js';
import { WILSON_DEFAULTS } from './config.js';
import { notifyAlert } from './notifications.js';

class WilsonInventory {
  /**
   * Calcular cantidad óptima de pedido (Q*)
   * Fórmula: Q* = √(2·D·S / g)
   * @param {number} D - Demanda anual
   * @param {number} S - Costo por pedido
   * @param {number} g - Costo de almacenamiento por unidad
   */
  static calcularPedidoOptimo(D, S = WILSON_DEFAULTS.costoPedido, g = WILSON_DEFAULTS.costoAlmacenamiento) {
    return Math.sqrt((2 * D * S) / g);
  }

  /**
   * Calcular punto de reorden
   * Fórmula: Pp = (Demanda diaria × Plazo entrega) + Stock seguridad
   */
  static calcularPuntoReorden(demandaDiaria, plazoEntregaDias, stockSeguridad = 0) {
    return (demandaDiaria * plazoEntregaDias) + stockSeguridad;
  }

  /**
   * Calcular stock de seguridad
   * Fórmula: SS = (Demanda máxima - Demanda promedio) × Plazo entrega
   */
  static calcularStockSeguridad(demandaMaxima, demandaPromedio, plazoEntrega) {
    return (demandaMaxima - demandaPromedio) * plazoEntrega;
  }

  /**
   * Calcular costo total de inventario
   * CT = (D/Q × S) + (Q/2 × g) + (SS × g)
   */
  static calcularCostoTotal(D, Q, S, g, SS = 0) {
    const costoPedido = (D / Q) * S;
    const costoAlmacenamiento = (Q / 2 + SS) * g;
    return costoPedido + costoAlmacenamiento;
  }

  /**
   * Calcular número óptimo de pedidos al año
   * N = D / Q*
   */
  static calcularNumeroPedidos(D, Q) {
    return D / Q;
  }

  /**
   * Calcular tiempo entre pedidos
   * T = 365 / N
   */
  static calcularTiempoEntrePedidos(N) {
    return 365 / N;
  }

  /**
   * Analizar inventario y generar alertas
   */
  static async analizarInventario() {
    const inventario = await store.getAll('inventario');
    const alertas = [];

    for (const item of inventario) {
      const { material, cantidad, demandaMensual, plazoEntrega, stockMinimo } = item;
      
      // Calcular métricas
      const demandaAnual = demandaMensual * 12;
      const Q = this.calcularPedidoOptimo(demandaAnual);
      const puntoReorden = this.calcularPuntoReorden(demandaMensual / 30, plazoEntrega, stockMinimo);
      
      // Verificar si necesita reorder
      if (cantidad <= puntoReorden) {
        const cantidadPedir = Q - cantidad;
        alertas.push({
          tipo: 'reorder',
          material,
          cantidadActual: cantidad,
          cantidadSugerida: Math.round(cantidadPedir),
          puntoReorden: Math.round(puntoReorden),
          prioridad: cantidad <= stockMinimo ? 'alta' : 'media'
        });
      }
    }

    return alertas;
  }

  /**
   * Generar recomendación de compra
   */
  static async generarRecomendacionCompra(materialId) {
    const item = await this.getMaterial(materialId);
    if (!item) return null;

    const demandaAnual = item.demandaMensual * 12;
    const Q = this.calcularPedidoOptimo(demandaAnual);
    const costoTotal = this.calcularCostoTotal(demandaAnual, Q, WILSON_DEFAULTS.costoPedido, WILSON_DEFAULTS.costoAlmacenamiento);
    const N = this.calcularNumeroPedidos(demandaAnual, Q);
    const T = this.calcularTiempoEntrePedidos(N);

    return {
      material: item.material,
      cantidadOptima: Math.round(Q),
      frecuenciaDias: Math.round(T),
      pedidosPorAño: Math.round(N),
      costoTotalAnual: costoTotal.toFixed(2),
      puntoReorden: this.calcularPuntoReorden(item.demandaMensual / 30, item.plazoEntrega, item.stockMinimo)
    };
  }

  static async getMaterial(id) {
    const materiales = await store.getAll('inventario');
    return materiales.find(m => m.id === id);
  }

  static async agregarMaterial(material) {
    return await store.add('inventario', {
      ...material,
      created_at: new Date().toISOString()
    });
  }

  static async actualizarMaterial(id, updates) {
    const material = await this.getMaterial(id);
    if (!material) throw new Error('Material no encontrado');
    
    return await store.update('inventario', {
      ...material,
      ...updates,
      updated_at: new Date().toISOString()
    });
  }
}

export default WilsonInventory;