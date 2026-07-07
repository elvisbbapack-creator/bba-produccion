import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "firebase/firestore";

export const TIPOS_MOVIMIENTO_ALMACEN = {
  RECEPCION: "recepcion",
  AJUSTE_POSITIVO: "ajuste_positivo",
  AJUSTE_NEGATIVO: "ajuste_negativo",
  MERMA: "merma",
  RESERVA_OT: "reserva_ot",
  LIBERACION_RESERVA: "liberacion_reserva",
  CONSUMO_OT: "consumo_ot",
  TRASPASO_SALIDA: "traspaso_salida",
  TRASPASO_RECEPCION: "traspaso_recepcion"
};

export const ESTADOS_TRASPASO_ALMACEN = {
  EN_TRANSITO: "en_transito",
  RECIBIDO: "recibido",
  ANULADO: "anulado"
};

export const ESTADOS_SOLICITUD_REPOSICION = {
  PENDIENTE: "pendiente",
  EN_REVISION: "en_revision",
  APROBADA: "aprobada",
  CERRADA: "cerrada",
  ANULADA: "anulada"
};

export const TIPOS_SOLICITUD_REPOSICION = {
  COMPRA: "compra",
  REPOSICION_INTERNA: "reposicion_interna"
};

export const MOVIMIENTOS_ALMACEN = [
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.RECEPCION,
    nombre: "Recepción",
    signo_stock: 1,
    signo_reserva: 0
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.AJUSTE_POSITIVO,
    nombre: "Ajuste positivo",
    signo_stock: 1,
    signo_reserva: 0
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.AJUSTE_NEGATIVO,
    nombre: "Ajuste negativo",
    signo_stock: -1,
    signo_reserva: 0
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.MERMA,
    nombre: "Merma / pérdida",
    signo_stock: -1,
    signo_reserva: 0
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT,
    nombre: "Reserva para OT",
    signo_stock: 0,
    signo_reserva: 1
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.LIBERACION_RESERVA,
    nombre: "Liberar reserva",
    signo_stock: 0,
    signo_reserva: -1
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT,
    nombre: "Consumo por OT",
    signo_stock: -1,
    signo_reserva: 0
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.TRASPASO_SALIDA,
    nombre: "Traspaso salida",
    signo_stock: -1,
    signo_reserva: 0
  },
  {
    tipo: TIPOS_MOVIMIENTO_ALMACEN.TRASPASO_RECEPCION,
    nombre: "Traspaso recepción",
    signo_stock: 1,
    signo_reserva: 0
  }
];

const limpiarTexto = valor =>
  (valor || "").toString().trim();

export const idStockMaterial = ({
  empresaId,
  plantaId,
  materialId
}) => [
  limpiarTexto(empresaId),
  limpiarTexto(plantaId),
  limpiarTexto(materialId)
].join("__");

export const obtenerDefinicionMovimiento = tipo =>
  MOVIMIENTOS_ALMACEN.find(
    movimiento => movimiento.tipo === tipo
  ) || null;

export const TIPOS_AJUSTE_AUTORIZADO = [
  TIPOS_MOVIMIENTO_ALMACEN.AJUSTE_POSITIVO,
  TIPOS_MOVIMIENTO_ALMACEN.AJUSTE_NEGATIVO,
  TIPOS_MOVIMIENTO_ALMACEN.MERMA
];

export const esMovimientoAjusteAutorizado = tipo =>
  TIPOS_AJUSTE_AUTORIZADO.includes(tipo);

export const obtenerOrigenMovimientoAlmacen = tipo =>
  esMovimientoAjusteAutorizado(tipo)
    ? "ajuste_autorizado"
    : "manual";

export const calcularStockDisponible = stock =>
  Math.max(
    0,
    Number(stock?.stock_actual || 0) -
      Number(stock?.stock_reservado || 0)
  );

export const prepararMovimientoAlmacen = ({
  empresaId,
  plantaId,
  material,
  tipo,
  cantidad,
  otCodigo = "",
  referencia = "",
  observacion = "",
  usuario
}) => {
  const definicion =
    obtenerDefinicionMovimiento(tipo);
  const cantidadNumero = Number(cantidad);

  return {
    empresa_id: limpiarTexto(empresaId),
    planta_id: limpiarTexto(plantaId),
    material_id: limpiarTexto(material?.id),
    material_codigo: limpiarTexto(
      material?.codigo
    ),
    material_nombre: limpiarTexto(
      material?.nombre
    ),
    material_tipo: limpiarTexto(material?.tipo),
    unidad_medida: limpiarTexto(
      material?.unidad_medida
    ),
    tipo,
    tipo_nombre: definicion?.nombre || "",
    cantidad: Number.isFinite(cantidadNumero)
      ? cantidadNumero
      : 0,
    signo_stock: Number(
      definicion?.signo_stock || 0
    ),
    signo_reserva: Number(
      definicion?.signo_reserva || 0
    ),
    ot_codigo: limpiarTexto(otCodigo)
      .toUpperCase(),
    referencia: limpiarTexto(referencia),
    observacion: limpiarTexto(observacion),
    usuario_id: limpiarTexto(usuario?.uid),
    usuario_nombre: limpiarTexto(
      usuario?.nombre
    ),
    ...(esMovimientoAjusteAutorizado(tipo)
      ? {
        autorizacion_tipo: "ajuste_autorizado",
        autorizado_por_id: limpiarTexto(
          usuario?.uid
        ),
        autorizado_por_nombre: limpiarTexto(
          usuario?.nombre
        )
      }
      : {}),
    modelo_version: 2
  };
};

export const validarMovimientoAlmacen = (
  movimiento,
  stockActual = {}
) => {
  const errores = [];
  const definicion =
    obtenerDefinicionMovimiento(
      movimiento?.tipo
    );
  const cantidad = Number(
    movimiento?.cantidad || 0
  );
  const stock = Number(
    stockActual?.stock_actual || 0
  );
  const reservado = Number(
    stockActual?.stock_reservado || 0
  );
  const disponible =
    calcularStockDisponible(stockActual);

  if (!definicion) {
    errores.push(
      "Selecciona un tipo de movimiento válido."
    );
  }

  if (!movimiento?.material_id) {
    errores.push("Selecciona un material.");
  }

  if (
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    errores.push(
      "La cantidad debe ser mayor que cero."
    );
  }

  if (
    movimiento?.tipo ===
      TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT &&
    cantidad > stock
  ) {
    errores.push(
      `Stock físico insuficiente. Stock: ${stock}.`
    );
  }

  if (
    movimiento?.tipo !==
      TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT &&
    definicion?.signo_stock < 0 &&
    cantidad > disponible
  ) {
    errores.push(
      `Stock disponible insuficiente. Disponible: ${disponible}.`
    );
  }

  if (
    definicion?.signo_reserva > 0 &&
    cantidad > disponible
  ) {
    errores.push(
      `No puedes reservar más que el stock disponible (${disponible}).`
    );
  }

  if (
    definicion?.signo_reserva < 0 &&
    cantidad > reservado
  ) {
    errores.push(
      `No puedes liberar más que el stock reservado (${reservado}).`
    );
  }

  if (
    [
      TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT,
      TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT
    ].includes(movimiento?.tipo) &&
    !movimiento?.ot_codigo
  ) {
    errores.push(
      "Indica la OT asociada al movimiento."
    );
  }

  if (
    esMovimientoAjusteAutorizado(
      movimiento?.tipo
    ) &&
    !limpiarTexto(movimiento?.observacion)
  ) {
    errores.push(
      "Indica el motivo del ajuste o merma."
    );
  }

  if (
    stock < 0 ||
    reservado < 0
  ) {
    errores.push(
      "El stock actual no puede ser negativo."
    );
  }

  return errores;
};

export const prepararTraspasoAlmacen = ({
  empresaId,
  plantaOrigenId,
  plantaDestinoId,
  material,
  cantidad,
  referencia = "",
  observacion = "",
  usuario
}) => {
  const cantidadNumero = Number(cantidad);

  return {
    empresa_id: limpiarTexto(empresaId),
    tipo_operacion: "traspaso_interno",
    planta_id: limpiarTexto(plantaOrigenId),
    planta_origen_id: limpiarTexto(plantaOrigenId),
    planta_destino_id: limpiarTexto(plantaDestinoId),
    material_id: limpiarTexto(material?.id),
    material_codigo: limpiarTexto(material?.codigo),
    material_nombre: limpiarTexto(material?.nombre),
    material_tipo: limpiarTexto(material?.tipo),
    unidad_medida: limpiarTexto(material?.unidad_medida),
    cantidad: Number.isFinite(cantidadNumero)
      ? cantidadNumero
      : 0,
    cantidad_recibida: 0,
    estado: ESTADOS_TRASPASO_ALMACEN.EN_TRANSITO,
    referencia: limpiarTexto(referencia),
    observacion: limpiarTexto(observacion),
    creado_por_id: limpiarTexto(usuario?.uid),
    creado_por_nombre: limpiarTexto(usuario?.nombre),
    modelo_version: 2
  };
};

export const validarTraspasoSalida = (
  traspaso,
  stockOrigen = {}
) => {
  const errores = [];
  const cantidad = Number(traspaso?.cantidad || 0);
  const disponible =
    calcularStockDisponible(stockOrigen);

  if (!traspaso?.planta_origen_id) {
    errores.push("Selecciona el almacén origen.");
  }

  if (!traspaso?.planta_destino_id) {
    errores.push("Selecciona el almacén destino.");
  }

  if (
    traspaso?.planta_origen_id &&
    traspaso?.planta_destino_id &&
    traspaso.planta_origen_id ===
      traspaso.planta_destino_id
  ) {
    errores.push(
      "El almacén destino debe ser distinto al almacén origen."
    );
  }

  if (!traspaso?.material_id) {
    errores.push("Selecciona un material.");
  }

  if (
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    errores.push(
      "La cantidad del traspaso debe ser mayor que cero."
    );
  }

  if (cantidad > disponible) {
    errores.push(
      `Stock disponible insuficiente para traspaso interno. Disponible: ${disponible}.`
    );
  }

  return errores;
};

export const prepararConteoFisico = ({
  empresaId,
  plantaId,
  material,
  stockSistema,
  stockReservado,
  cantidadContada,
  referencia = "",
  observacion = "",
  usuario
}) => {
  const sistema = Number(stockSistema || 0);
  const reservado = Number(stockReservado || 0);
  const contado = Number(cantidadContada);
  const diferencia =
    Number.isFinite(contado)
      ? contado - sistema
      : 0;

  return {
    empresa_id: limpiarTexto(empresaId),
    planta_id: limpiarTexto(plantaId),
    material_id: limpiarTexto(material?.id),
    material_codigo: limpiarTexto(material?.codigo),
    material_nombre: limpiarTexto(material?.nombre),
    material_tipo: limpiarTexto(material?.tipo),
    unidad_medida: limpiarTexto(material?.unidad_medida),
    stock_sistema: sistema,
    stock_reservado: reservado,
    stock_contado: Number.isFinite(contado)
      ? contado
      : 0,
    diferencia,
    estado:
      diferencia === 0
        ? "cuadrado"
        : "ajustado",
    referencia: limpiarTexto(referencia),
    observacion: limpiarTexto(observacion),
    contado_por_id: limpiarTexto(usuario?.uid),
    contado_por_nombre: limpiarTexto(usuario?.nombre),
    modelo_version: 2
  };
};

export const validarConteoFisico = conteo => {
  const errores = [];
  const contado = Number(conteo?.stock_contado);
  const reservado = Number(
    conteo?.stock_reservado || 0
  );

  if (!conteo?.material_id) {
    errores.push("Selecciona un material.");
  }

  if (
    !Number.isFinite(contado) ||
    contado < 0
  ) {
    errores.push(
      "La cantidad contada debe ser cero o mayor."
    );
  }

  if (contado < reservado) {
    errores.push(
      `El conteo no puede quedar bajo el stock reservado (${reservado}). Libera reservas antes de ajustar.`
    );
  }

  if (
    conteo?.diferencia !== 0 &&
    !limpiarTexto(conteo?.observacion)
  ) {
    errores.push(
      "Indica el motivo de la diferencia del conteo físico."
    );
  }

  return errores;
};

export const prepararPoliticaStock = ({
  empresaId,
  plantaId,
  material,
  stockMinimo,
  puntoReposicion,
  stockObjetivo,
  leadTimeDias,
  usuario
}) => {
  const minimo = Number(stockMinimo || 0);
  const reposicion = Number(puntoReposicion || 0);
  const objetivo = Number(stockObjetivo || 0);
  const leadTime = Number(leadTimeDias || 0);

  return {
    empresa_id: limpiarTexto(empresaId),
    planta_id: limpiarTexto(plantaId),
    material_id: limpiarTexto(material?.id),
    material_codigo: limpiarTexto(material?.codigo),
    material_nombre: limpiarTexto(material?.nombre),
    material_tipo: limpiarTexto(material?.tipo),
    unidad_medida: limpiarTexto(material?.unidad_medida),
    stock_minimo: Number.isFinite(minimo)
      ? minimo
      : 0,
    punto_reposicion: Number.isFinite(reposicion)
      ? reposicion
      : 0,
    stock_objetivo: Number.isFinite(objetivo)
      ? objetivo
      : 0,
    lead_time_dias: Number.isFinite(leadTime)
      ? leadTime
      : 0,
    actualizado_por_id: limpiarTexto(usuario?.uid),
    actualizado_por_nombre: limpiarTexto(usuario?.nombre),
    modelo_version: 2
  };
};

export const validarPoliticaStock = politica => {
  const errores = [];
  const minimo = Number(politica?.stock_minimo || 0);
  const reposicion = Number(
    politica?.punto_reposicion || 0
  );
  const objetivo = Number(
    politica?.stock_objetivo || 0
  );
  const leadTime = Number(
    politica?.lead_time_dias || 0
  );

  if (!politica?.material_id) {
    errores.push("Selecciona un material.");
  }

  if (minimo < 0 || reposicion < 0 || objetivo < 0) {
    errores.push(
      "Los niveles de stock deben ser cero o mayores."
    );
  }

  if (leadTime < 0) {
    errores.push(
      "Los días de reposición deben ser cero o mayores."
    );
  }

  if (reposicion > 0 && reposicion < minimo) {
    errores.push(
      "El punto de reposición no puede ser menor que el stock mínimo."
    );
  }

  if (objetivo > 0 && objetivo < reposicion) {
    errores.push(
      "El stock objetivo no puede ser menor que el punto de reposición."
    );
  }

  return errores;
};

export const calcularAlertasStock = ({
  materiales = [],
  stocks = []
} = {}) => {
  const stocksPorMaterial = new Map(
    stocks.map(stock => [
      stock.material_id,
      stock
    ])
  );

  return materiales
    .filter(material => material.activo !== false)
    .map(material => {
      const stock =
        stocksPorMaterial.get(material.id) || {};
      const stockActual = Number(
        stock.stock_actual || 0
      );
      const stockReservado = Number(
        stock.stock_reservado || 0
      );
      const disponible =
        calcularStockDisponible(stock);
      const minimo = Number(
        stock.stock_minimo || 0
      );
      const reposicion = Number(
        stock.punto_reposicion || 0
      );
      const objetivo = Number(
        stock.stock_objetivo || 0
      );
      const umbralReposicion =
        reposicion > 0 ? reposicion : minimo;
      const objetivoReposicion =
        objetivo > 0
          ? objetivo
          : Math.max(umbralReposicion, minimo);
      const cantidadSugerida = Math.max(
        0,
        objetivoReposicion - disponible
      );
      const estado =
        minimo <= 0 && reposicion <= 0
          ? "sin_politica"
          : stockActual <= 0
            ? "sin_stock"
            : minimo > 0 && disponible < minimo
              ? "bajo_minimo"
              : umbralReposicion > 0 &&
                disponible <= umbralReposicion
                ? "reponer"
                : "ok";
      const prioridad =
        estado === "sin_stock"
          ? 1
          : estado === "bajo_minimo"
            ? 2
            : estado === "reponer"
              ? 3
              : estado === "sin_politica"
                ? 4
                : 5;
      const recomendacion =
        estado === "sin_stock"
          ? "Sin stock disponible: comprar, recibir o solicitar traspaso interno antes de producir."
          : estado === "bajo_minimo"
            ? "Bajo mínimo: priorizar reposición o traspaso interno."
            : estado === "reponer"
              ? "Llegó al punto de reposición: planificar compra o movimiento interno."
              : estado === "sin_politica"
                ? "Configura mínimo y punto de reposición para activar alertas."
                : "Stock dentro de política.";

      return {
        material_id: material.id,
        material_codigo: material.codigo,
        material_nombre: material.nombre,
        material_tipo: material.tipo,
        unidad_medida: material.unidad_medida,
        stock_actual: stockActual,
        stock_reservado: stockReservado,
        stock_disponible: disponible,
        stock_minimo: minimo,
        punto_reposicion: reposicion,
        stock_objetivo: objetivo,
        lead_time_dias: Number(
          stock.lead_time_dias || 0
        ),
        cantidad_sugerida: cantidadSugerida,
        estado,
        prioridad,
        recomendacion
      };
    })
    .sort((a, b) => {
      if (a.prioridad !== b.prioridad) {
        return a.prioridad - b.prioridad;
      }
      return (a.material_codigo || "")
        .localeCompare(b.material_codigo || "");
    });
};

export const calcularNecesidadesMaterialesOTs = ({
  ordenes = [],
  operacionesPorOrden = [],
  stocks = []
} = {}) => {
  const stocksPorMaterial = new Map(
    stocks.map(stock => [
      stock.material_id,
      stock
    ])
  );
  const ordenesPorId = new Map(
    ordenes.map(orden => [
      orden.id,
      orden
    ])
  );
  const necesidades = new Map();

  operacionesPorOrden.forEach(item => {
    const orden =
      item.orden ||
      ordenesPorId.get(item.orden_id) ||
      {};

    (item.operaciones || []).forEach(operacion => {
      const cantidadOperacion = Number(
        operacion.cantidad_pendiente ??
        operacion.cantidad_requerida ??
        0
      );

      if (cantidadOperacion <= 0) {
        return;
      }

      (operacion.materiales_entrada || [])
        .forEach(material => {
          const materialId =
            limpiarTexto(material.material_id);

          if (!materialId) {
            return;
          }

          const cantidadPorUnidad = Number(
            material.cantidad || 1
          );
          const requerida =
            cantidadOperacion * cantidadPorUnidad;
          const actual =
            necesidades.get(materialId) || {
              material_id: materialId,
              material_codigo: limpiarTexto(
                material.material_codigo
              ),
              material_nombre: limpiarTexto(
                material.material_nombre
              ),
              material_tipo: limpiarTexto(
                material.material_tipo
              ),
              cantidad_requerida: 0,
              ots: []
            };

          actual.cantidad_requerida += requerida;
          actual.ots.push({
            ot_id:
              orden.id ||
              item.orden_id ||
              "",
            ot_codigo:
              orden.codigo ||
              item.orden_codigo ||
              "",
            producto_nombre:
              orden.producto_nombre || "",
            operacion_codigo:
              operacion.operacion_codigo || "",
            operacion_nombre:
              operacion.operacion_nombre || "",
            cantidad_requerida: requerida
          });

          necesidades.set(materialId, actual);
        });
    });
  });

  return Array.from(necesidades.values())
    .map(necesidad => {
      const stock =
        stocksPorMaterial.get(
          necesidad.material_id
        ) || {};
      const disponible =
        calcularStockDisponible(stock);
      const brecha = Math.max(
        0,
        Number(necesidad.cantidad_requerida || 0) -
          disponible
      );
      const estado =
        brecha > 0
          ? "faltante_ot"
          : "cubre_ots";

      return {
        ...necesidad,
        stock_actual: Number(
          stock.stock_actual || 0
        ),
        stock_reservado: Number(
          stock.stock_reservado || 0
        ),
        stock_disponible: disponible,
        brecha,
        estado,
        prioridad: brecha > 0 ? 1 : 2,
        recomendacion:
          brecha > 0
            ? "No alcanza para las OTs abiertas: comprar, recibir, solicitar traspaso interno o reprogramar."
            : "Stock disponible cubre las OTs abiertas revisadas."
      };
    })
    .sort((a, b) => {
      if (a.prioridad !== b.prioridad) {
        return a.prioridad - b.prioridad;
      }
      if (b.brecha !== a.brecha) {
        return b.brecha - a.brecha;
      }
      return (a.material_codigo || "")
        .localeCompare(b.material_codigo || "");
    });
};

export const priorizarOrdenesPorMaterial = ({
  ordenes = [],
  operacionesPorOrden = [],
  stocks = []
} = {}) => {
  const stockDisponiblePorMaterial = new Map(
    stocks.map(stock => [
      stock.material_id,
      calcularStockDisponible(stock)
    ])
  );
  const ordenesPorId = new Map(
    ordenes.map(orden => [
      orden.id,
      orden
    ])
  );

  return operacionesPorOrden.map((item, indice) => {
    const orden =
      item.orden ||
      ordenesPorId.get(item.orden_id) ||
      {};
    const requerimientos = new Map();

    (item.operaciones || []).forEach(operacion => {
      const cantidadOperacion = Number(
        operacion.cantidad_pendiente ??
        operacion.cantidad_requerida ??
        0
      );

      if (cantidadOperacion <= 0) {
        return;
      }

      (operacion.materiales_entrada || [])
        .forEach(material => {
          const materialId =
            limpiarTexto(material.material_id);

          if (!materialId) {
            return;
          }

          const cantidad = cantidadOperacion *
            Number(material.cantidad || 1);
          const actual =
            requerimientos.get(materialId) || {
              material_id: materialId,
              material_codigo: limpiarTexto(
                material.material_codigo
              ),
              material_nombre: limpiarTexto(
                material.material_nombre
              ),
              cantidad_requerida: 0
            };

          actual.cantidad_requerida += cantidad;
          requerimientos.set(materialId, actual);
        });
    });

    const materiales = Array.from(
      requerimientos.values()
    );
    const faltantes = materiales
      .map(material => {
        const disponible = Number(
          stockDisponiblePorMaterial.get(
            material.material_id
          ) || 0
        );
        const faltante = Math.max(
          0,
          Number(material.cantidad_requerida || 0) -
            disponible
        );

        return {
          ...material,
          stock_disponible_previo: disponible,
          faltante
        };
      })
      .filter(material => material.faltante > 0);
    const estado =
      materiales.length === 0
        ? "sin_materiales"
        : faltantes.length === 0
          ? "puede_avanzar"
          : faltantes.length < materiales.length
            ? "avance_parcial"
            : "bloqueada";

    if (estado === "puede_avanzar") {
      materiales.forEach(material => {
        const disponible = Number(
          stockDisponiblePorMaterial.get(
            material.material_id
          ) || 0
        );
        stockDisponiblePorMaterial.set(
          material.material_id,
          Math.max(
            0,
            disponible -
              Number(
                material.cantidad_requerida || 0
              )
          )
        );
      });
    }

    return {
      ot_id: orden.id || item.orden_id || "",
      ot_codigo:
        orden.codigo || item.orden_codigo || "",
      producto_nombre: orden.producto_nombre || "",
      estado_ot: orden.estado || "",
      prioridad_sugerida: indice + 1,
      materiales_requeridos: materiales,
      materiales_faltantes: faltantes,
      estado,
      recomendacion:
        estado === "puede_avanzar"
          ? "Puede avanzar con el stock disponible si se prioriza antes de las OTs siguientes."
          : estado === "avance_parcial"
            ? "Puede avanzar parcialmente; revisar materiales faltantes antes de liberar toda la OT."
            : estado === "bloqueada"
              ? "Bloqueada por falta de materiales disponibles."
              : "OT sin materiales de entrada configurados."
    };
  });
};

export const prepararSolicitudReposicion = ({
  empresaId,
  plantaId,
  material,
  cantidadSugerida,
  prioridad = "alta",
  tipoSugerido =
    TIPOS_SOLICITUD_REPOSICION.COMPRA,
  origen = "brecha_ot",
  otsAfectadas = [],
  stockDisponible = 0,
  cantidadRequerida = 0,
  brecha = 0,
  observacion = "",
  usuario
}) => {
  const cantidad = Number(cantidadSugerida || 0);

  return {
    empresa_id: limpiarTexto(empresaId),
    planta_id: limpiarTexto(plantaId),
    material_id: limpiarTexto(material?.id),
    material_codigo: limpiarTexto(material?.codigo),
    material_nombre: limpiarTexto(material?.nombre),
    material_tipo: limpiarTexto(material?.tipo),
    unidad_medida: limpiarTexto(material?.unidad_medida),
    cantidad_sugerida: Number.isFinite(cantidad)
      ? cantidad
      : 0,
    prioridad: limpiarTexto(prioridad) || "alta",
    tipo_sugerido:
      limpiarTexto(tipoSugerido) ||
      TIPOS_SOLICITUD_REPOSICION.COMPRA,
    origen: limpiarTexto(origen) || "brecha_ot",
    estado:
      ESTADOS_SOLICITUD_REPOSICION.PENDIENTE,
    stock_disponible: Number(stockDisponible || 0),
    cantidad_requerida: Number(
      cantidadRequerida || 0
    ),
    brecha: Number(brecha || 0),
    ots_afectadas: (otsAfectadas || [])
      .slice(0, 20)
      .map(ot => ({
        ot_id: limpiarTexto(ot.ot_id),
        ot_codigo: limpiarTexto(ot.ot_codigo),
        producto_nombre: limpiarTexto(
          ot.producto_nombre
        ),
        operacion_codigo: limpiarTexto(
          ot.operacion_codigo
        ),
        operacion_nombre: limpiarTexto(
          ot.operacion_nombre
        ),
        cantidad_requerida: Number(
          ot.cantidad_requerida || 0
        )
      })),
    observacion: limpiarTexto(observacion),
    solicitado_por_id: limpiarTexto(usuario?.uid),
    solicitado_por_nombre: limpiarTexto(
      usuario?.nombre
    ),
    modelo_version: 2
  };
};

export const validarSolicitudReposicion =
  solicitud => {
    const errores = [];
    const cantidad = Number(
      solicitud?.cantidad_sugerida || 0
    );

    if (!solicitud?.material_id) {
      errores.push("Selecciona un material.");
    }

    if (
      !Number.isFinite(cantidad) ||
      cantidad <= 0
    ) {
      errores.push(
        "La cantidad sugerida debe ser mayor que cero."
      );
    }

    if (
      ![
        TIPOS_SOLICITUD_REPOSICION.COMPRA,
        TIPOS_SOLICITUD_REPOSICION
          .REPOSICION_INTERNA
      ].includes(solicitud?.tipo_sugerido)
    ) {
      errores.push(
        "Selecciona compra o reposición interna."
      );
    }

    if (!solicitud?.solicitado_por_id) {
      errores.push(
        "La solicitud debe tener usuario solicitante."
      );
    }

    return errores;
  };

export const calcularStockTrasMovimiento = (
  stockActual,
  movimiento
) => {
  const stock = Number(
    stockActual?.stock_actual || 0
  );
  const reservado = Number(
    stockActual?.stock_reservado || 0
  );
  const cantidad = Number(
    movimiento?.cantidad || 0
  );
  const siguienteStock = stock +
    cantidad *
      Number(movimiento?.signo_stock || 0);
  const siguienteReservado =
    movimiento?.tipo ===
      TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT
      ? Math.max(
        0,
        reservado - Math.min(reservado, cantidad)
      )
      : reservado +
        cantidad *
          Number(movimiento?.signo_reserva || 0);

  return {
    stock_actual: siguienteStock,
    stock_reservado: siguienteReservado,
    stock_disponible: Math.max(
      0,
      siguienteStock - siguienteReservado
    )
  };
};

export const calcularRequerimientosMaterialesOT = (
  operaciones = [],
  stocks = []
) => {
  const stockPorMaterial = new Map(
    stocks.map(stock => [
      stock.material_id,
      stock
    ])
  );
  const requerimientos = new Map();

  operaciones.forEach(operacion => {
    const cantidadOperacion = Number(
      operacion.cantidad_pendiente ??
      operacion.cantidad_requerida ??
      0
    );

    (operacion.materiales_entrada || [])
      .forEach(material => {
        const materialId =
          limpiarTexto(material.material_id);

        if (!materialId) {
          return;
        }

        const cantidadPorUnidad = Number(
          material.cantidad || 1
        );
        const cantidadRequerida =
          cantidadOperacion *
          cantidadPorUnidad;
        const actual =
          requerimientos.get(materialId) || {
            material_id: materialId,
            material_codigo:
              limpiarTexto(
                material.material_codigo
              ),
            material_nombre:
              limpiarTexto(
                material.material_nombre
              ),
            cantidad_requerida: 0,
            operaciones: []
          };

        actual.cantidad_requerida +=
          cantidadRequerida;
        actual.operaciones.push({
          operacion_id:
            operacion.id ||
            operacion.ruta_operacion_id ||
            "",
          operacion_codigo:
            operacion.operacion_codigo || "",
          operacion_nombre:
            operacion.operacion_nombre || "",
          cantidad_requerida:
            cantidadRequerida
        });

        requerimientos.set(
          materialId,
          actual
        );
      });
  });

  return Array.from(requerimientos.values())
    .map(requerimiento => {
      const stock =
        stockPorMaterial.get(
          requerimiento.material_id
        ) || {};
      const disponible =
        calcularStockDisponible(stock);

      return {
        ...requerimiento,
        stock_actual: Number(
          stock.stock_actual || 0
        ),
        stock_reservado: Number(
          stock.stock_reservado || 0
        ),
        stock_disponible: disponible,
        brecha: Math.max(
          0,
          requerimiento.cantidad_requerida -
            disponible
        )
      };
    })
    .sort((a, b) =>
      a.material_codigo.localeCompare(
        b.material_codigo
      )
    );
};

export const calcularDisponibilidadOT = (
  operaciones = [],
  stocks = []
) => {
  const requerimientos =
    calcularRequerimientosMaterialesOT(
      operaciones,
      stocks
    );
  const produccionPorSalida = new Map();
  const consumoPorEntrada = new Map();

  operaciones.forEach(operacion => {
    const salidaId = limpiarTexto(
      operacion.material_salida_id
    );
    const entradaId = limpiarTexto(
      operacion.material_entrada_id
    );

    if (salidaId) {
      const actual =
        produccionPorSalida.get(salidaId) || {
          cantidad_ok: 0,
          cantidad_pendiente: 0,
          avance_pct: 0,
          operaciones: []
        };

      actual.cantidad_ok += Number(
        operacion.cantidad_ok || 0
      );
      actual.cantidad_pendiente += Number(
        operacion.cantidad_pendiente || 0
      );
      actual.avance_pct = Math.max(
        actual.avance_pct,
        Number(operacion.avance_pct || 0)
      );
      actual.operaciones.push({
        operacion_codigo:
          operacion.operacion_codigo || "",
        operacion_nombre:
          operacion.operacion_nombre || "",
        cantidad_ok: Number(
          operacion.cantidad_ok || 0
        ),
        cantidad_pendiente: Number(
          operacion.cantidad_pendiente || 0
        )
      });

      produccionPorSalida.set(
        salidaId,
        actual
      );
    }

    if (entradaId) {
      consumoPorEntrada.set(
        entradaId,
        (
          consumoPorEntrada.get(entradaId) ||
          0
        ) +
          Number(
            operacion.cantidad_consumida || 0
          )
      );
    }
  });

  return requerimientos.map(
    requerimiento => {
      const materialTipo =
        requerimiento.material_codigo
          .startsWith("RF")
          ? "RF"
          : "MP";
      const producido =
        produccionPorSalida.get(
          requerimiento.material_id
        );
      const consumido = Number(
        consumoPorEntrada.get(
          requerimiento.material_id
        ) || 0
      );
      const disponibleFlujo = Math.max(
        0,
        Number(producido?.cantidad_ok || 0) -
          consumido
      );

      if (materialTipo === "RF") {
        const estado =
          disponibleFlujo > 0
            ? "rf_disponible"
            : Number(
              producido?.cantidad_pendiente || 0
            ) > 0
              ? "rf_en_flujo"
              : "rf_sin_fuente";

        return {
          ...requerimiento,
          material_tipo: materialTipo,
          disponible_flujo: disponibleFlujo,
          producido_ok: Number(
            producido?.cantidad_ok || 0
          ),
          producido_pendiente: Number(
            producido?.cantidad_pendiente || 0
          ),
          consumido,
          avance_fuente_pct: Number(
            producido?.avance_pct || 0
          ),
          operaciones_fuente:
            producido?.operaciones || [],
          estado,
          recomendacion:
            estado === "rf_disponible"
              ? "RF disponible para alimentar el siguiente proceso."
              : estado === "rf_en_flujo"
                ? "RF en flujo: balancear ritmo con el proceso anterior."
                : "RF sin proceso productor identificado en esta OT."
        };
      }

      const estado =
        requerimiento.brecha > 0
          ? "falta_mp"
          : "mp_ok";

      return {
        ...requerimiento,
        material_tipo: materialTipo,
        disponible_flujo: 0,
        producido_ok: 0,
        producido_pendiente: 0,
        consumido,
        avance_fuente_pct: 0,
        operaciones_fuente: [],
        estado,
        recomendacion:
          estado === "mp_ok"
            ? "MP disponible según stock de almacén."
            : "Falta MP: recibir, ajustar o comprar antes de producir."
      };
    }
  );
};

export const resumirMovimientosAlmacenOT = (
  movimientos = []
) => movimientos.reduce(
  (resumen, movimiento) => {
    const codigo =
      movimiento.material_codigo ||
      "SIN_CODIGO";
    const actual =
      resumen[codigo] || {
        material_codigo: codigo,
        material_nombre:
          movimiento.material_nombre || "",
        material_tipo:
          movimiento.material_tipo || "",
        consumido: 0,
        producido: 0,
        reservado: 0,
        liberado: 0
      };

    if (
      movimiento.tipo ===
      TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT
    ) {
      actual.consumido += Number(
        movimiento.cantidad || 0
      );
    } else if (
      movimiento.tipo ===
      TIPOS_MOVIMIENTO_ALMACEN.RECEPCION
    ) {
      actual.producido += Number(
        movimiento.cantidad || 0
      );
    } else if (
      movimiento.tipo ===
      TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT
    ) {
      actual.reservado += Number(
        movimiento.cantidad || 0
      );
    } else if (
      movimiento.tipo ===
      TIPOS_MOVIMIENTO_ALMACEN
        .LIBERACION_RESERVA
    ) {
      actual.liberado += Number(
        movimiento.cantidad || 0
      );
    }

    return {
      ...resumen,
      [codigo]: actual
    };
  },
  {}
);

export const calcularCuadraturaAlmacenOT = ({
  operaciones = [],
  stocks = [],
  movimientos = []
} = {}) => {
  const resumenMovimientos =
    resumirMovimientosAlmacenOT(movimientos);
  const disponibilidad =
    calcularDisponibilidadOT(
      operaciones,
      stocks
    );
  const items = disponibilidad.map(item => {
    const movimientosItem =
      resumenMovimientos[
        item.material_codigo
      ] || {};
    const consumido = Number(
      movimientosItem.consumido || 0
    );
    const producido = Number(
      movimientosItem.producido || 0
    );
    const reservadoNeto = Math.max(
      0,
      Number(movimientosItem.reservado || 0) -
        Number(movimientosItem.liberado || 0) -
        consumido
    );
    const requerido = Number(
      item.cantidad_requerida || 0
    );
    const faltante =
      item.material_tipo === "MP"
        ? Math.max(
          0,
          requerido - consumido - reservadoNeto
        )
        : Math.max(0, requerido - producido);
    const estado =
      item.material_tipo === "MP"
        ? faltante > 0
          ? "mp_pendiente"
          : "mp_cuadrado"
        : producido > 0
          ? "rf_producido"
          : item.estado === "rf_en_flujo"
            ? "rf_en_flujo"
            : "rf_pendiente";

    return {
      ...item,
      consumido,
      producido,
      reservado_neto: reservadoNeto,
      faltante,
      estado_cuadratura: estado
    };
  });
  const totales = items.reduce(
    (acumulado, item) => {
      if (item.material_tipo === "MP") {
        acumulado.mp_total += 1;
        if (item.faltante > 0) {
          acumulado.mp_pendientes += 1;
        }
      } else {
        acumulado.rf_total += 1;
        if (item.faltante > 0) {
          acumulado.rf_pendientes += 1;
        }
        if (
          item.estado_cuadratura === "rf_en_flujo"
        ) {
          acumulado.rf_en_flujo += 1;
        }
      }
      acumulado.materiales_pendientes +=
        item.faltante > 0 ? 1 : 0;
      acumulado.unidades_pendientes += Number(
        item.faltante || 0
      );
      return acumulado;
    },
    {
      mp_total: 0,
      mp_pendientes: 0,
      rf_total: 0,
      rf_pendientes: 0,
      rf_en_flujo: 0,
      materiales_pendientes: 0,
      unidades_pendientes: 0
    }
  );
  const estadoGeneral =
    items.length === 0
      ? "sin_materiales"
      : totales.mp_pendientes > 0
        ? "bloqueada_por_mp"
        : totales.rf_pendientes > 0
          ? "rf_en_flujo"
          : "cuadrada";
  const recomendacion =
    estadoGeneral === "bloqueada_por_mp"
      ? "Prioridad: recibir, comprar o ajustar MP antes de exigir avance a producción."
      : estadoGeneral === "rf_en_flujo"
        ? "Prioridad: balancear el proceso anterior para alimentar el siguiente sin bloquear la OT."
        : estadoGeneral === "cuadrada"
          ? "La OT está cuadrada en almacén para los materiales revisados."
          : "Esta OT no tiene materiales de entrada configurados para cuadratura.";

  return {
    items,
    resumen_movimientos: resumenMovimientos,
    totales,
    estado_general: estadoGeneral,
    recomendacion
  };
};

export const listarStockMateriales = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "inventario_materiales"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) =>
      (a.material_codigo || "").localeCompare(
        b.material_codigo || ""
      )
    );
};

export const listarMovimientosAlmacen = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "movimientos_almacen"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) => {
      const derecha = b.fecha?.toMillis?.() || 0;
      const izquierda = a.fecha?.toMillis?.() || 0;
      return derecha - izquierda;
    });
};

export const listarMovimientosAlmacenOT = async (
  db,
  empresaId,
  plantaId,
  otCodigo
) => {
  const codigo = limpiarTexto(otCodigo)
    .toUpperCase();

  if (!codigo) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "movimientos_almacen"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId),
      where("ot_codigo", "==", codigo)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) => {
      const derecha = b.fecha?.toMillis?.() || 0;
      const izquierda = a.fecha?.toMillis?.() || 0;
      return derecha - izquierda;
    });
};

export const listarTraspasosAlmacen = async (
  db,
  empresaId,
  plantaId
) => {
  const [salidasSnapshot, recepcionesSnapshot] =
    await Promise.all([
      getDocs(
        query(
          collection(db, "traspasos_almacen"),
          where("empresa_id", "==", empresaId),
          where("planta_origen_id", "==", plantaId)
        )
      ),
      getDocs(
        query(
          collection(db, "traspasos_almacen"),
          where("empresa_id", "==", empresaId),
          where("planta_destino_id", "==", plantaId)
        )
      )
    ]);

  const registros = new Map();

  [
    ...salidasSnapshot.docs,
    ...recepcionesSnapshot.docs
  ].forEach(documento => {
    registros.set(documento.id, {
      id: documento.id,
      ...documento.data()
    });
  });

  return Array.from(registros.values()).sort(
    (a, b) => {
      const fechaB =
        b.recibido_en?.toMillis?.() ||
        b.creado_en?.toMillis?.() ||
        0;
      const fechaA =
        a.recibido_en?.toMillis?.() ||
        a.creado_en?.toMillis?.() ||
        0;
      return fechaB - fechaA;
    }
  );
};

export const listarConteosFisicos = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "conteos_fisicos"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) => {
      const derecha =
        b.contado_en?.toMillis?.() || 0;
      const izquierda =
        a.contado_en?.toMillis?.() || 0;
      return derecha - izquierda;
    });
};

export const listarSolicitudesReposicion = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "solicitudes_reposicion"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) => {
      const derecha =
        b.solicitado_en?.toMillis?.() || 0;
      const izquierda =
        a.solicitado_en?.toMillis?.() || 0;
      return derecha - izquierda;
    });
};

export const registrarMovimientoAlmacen =
  async ({
    db,
    perfil,
    plantaId,
    material,
    tipo,
    cantidad,
    otCodigo,
    referencia,
    observacion
  }) => {
    const stockRef = doc(
      db,
      "inventario_materiales",
      idStockMaterial({
        empresaId: perfil.empresa_id,
        plantaId,
        materialId: material?.id
      })
    );
    const movimientoRef = doc(
      collection(db, "movimientos_almacen")
    );
    const movimiento =
      prepararMovimientoAlmacen({
        empresaId: perfil.empresa_id,
        plantaId,
        material,
        tipo,
        cantidad,
        otCodigo,
        referencia,
        observacion,
        usuario: perfil
      });

    await runTransaction(db, async transaccion => {
      const stockSnapshot =
        await transaccion.get(stockRef);
      const stockActual = stockSnapshot.exists()
        ? stockSnapshot.data()
        : {
          stock_actual: 0,
          stock_reservado: 0
        };
      const errores =
        validarMovimientoAlmacen(
          movimiento,
          stockActual
        );

      if (errores.length > 0) {
        throw new Error(errores.join(" "));
      }

      const siguiente =
        calcularStockTrasMovimiento(
          stockActual,
          movimiento
        );

      transaccion.set(stockRef, {
        empresa_id: perfil.empresa_id,
        planta_id: plantaId,
        material_id: material.id,
        material_codigo: material.codigo,
        material_nombre: material.nombre,
        material_tipo: material.tipo,
        unidad_medida: material.unidad_medida,
        ...siguiente,
        actualizado_por_id: perfil.uid,
        actualizado_por_nombre:
          perfil.nombre || "",
        actualizado_en: serverTimestamp(),
        modelo_version: 2
      });
      transaccion.set(movimientoRef, {
        ...movimiento,
        origen:
          obtenerOrigenMovimientoAlmacen(
            movimiento.tipo
          ),
        stock_anterior:
          Number(
            stockActual.stock_actual || 0
          ),
        stock_reservado_anterior:
          Number(
            stockActual.stock_reservado || 0
          ),
        stock_nuevo: siguiente.stock_actual,
        stock_reservado_nuevo:
          siguiente.stock_reservado,
        stock_disponible_nuevo:
          siguiente.stock_disponible,
        fecha: serverTimestamp()
      });
    });

    return {
      id: movimientoRef.id,
      ...movimiento
    };
  };

export const registrarConteoFisico =
  async ({
    db,
    perfil,
    plantaId,
    material,
    cantidadContada,
    referencia,
    observacion
  }) => {
    const stockRef = doc(
      db,
      "inventario_materiales",
      idStockMaterial({
        empresaId: perfil.empresa_id,
        plantaId,
        materialId: material?.id
      })
    );
    const conteoRef = doc(
      collection(db, "conteos_fisicos")
    );
    const movimientoRef = doc(
      collection(db, "movimientos_almacen")
    );

    await runTransaction(db, async transaccion => {
      const stockSnapshot =
        await transaccion.get(stockRef);
      const stockActual = stockSnapshot.exists()
        ? stockSnapshot.data()
        : {
          stock_actual: 0,
          stock_reservado: 0
        };
      const conteo = prepararConteoFisico({
        empresaId: perfil.empresa_id,
        plantaId,
        material,
        stockSistema:
          stockActual.stock_actual,
        stockReservado:
          stockActual.stock_reservado,
        cantidadContada,
        referencia,
        observacion,
        usuario: perfil
      });
      const erroresConteo =
        validarConteoFisico(conteo);

      if (erroresConteo.length > 0) {
        throw new Error(
          erroresConteo.join(" ")
        );
      }

      const diferencia = Number(
        conteo.diferencia || 0
      );

      if (diferencia === 0) {
        transaccion.set(conteoRef, {
          ...conteo,
          contado_en: serverTimestamp()
        });
        return;
      }

      const tipo =
        diferencia > 0
          ? TIPOS_MOVIMIENTO_ALMACEN
            .AJUSTE_POSITIVO
          : TIPOS_MOVIMIENTO_ALMACEN
            .AJUSTE_NEGATIVO;
      const movimiento =
        prepararMovimientoAlmacen({
          empresaId: perfil.empresa_id,
          plantaId,
          material,
          tipo,
          cantidad: Math.abs(diferencia),
          referencia:
            limpiarTexto(referencia) ||
            `conteo:${conteoRef.id}`,
          observacion:
            limpiarTexto(observacion) ||
            "Diferencia por conteo físico",
          usuario: perfil
        });
      const erroresMovimiento =
        validarMovimientoAlmacen(
          movimiento,
          stockActual
        );

      if (erroresMovimiento.length > 0) {
        throw new Error(
          erroresMovimiento.join(" ")
        );
      }

      const siguiente =
        calcularStockTrasMovimiento(
          stockActual,
          movimiento
        );

      transaccion.set(stockRef, {
        empresa_id: perfil.empresa_id,
        planta_id: plantaId,
        material_id: material.id,
        material_codigo: material.codigo,
        material_nombre: material.nombre,
        material_tipo: material.tipo,
        unidad_medida: material.unidad_medida,
        ...siguiente,
        actualizado_por_id: perfil.uid,
        actualizado_por_nombre:
          perfil.nombre || "",
        actualizado_en: serverTimestamp(),
        modelo_version: 2
      });
      transaccion.set(movimientoRef, {
        ...movimiento,
        origen: "ajuste_autorizado",
        conteo_fisico_id: conteoRef.id,
        stock_anterior:
          Number(
            stockActual.stock_actual || 0
          ),
        stock_reservado_anterior:
          Number(
            stockActual.stock_reservado || 0
          ),
        stock_nuevo: siguiente.stock_actual,
        stock_reservado_nuevo:
          siguiente.stock_reservado,
        stock_disponible_nuevo:
          siguiente.stock_disponible,
        fecha: serverTimestamp()
      });
      transaccion.set(conteoRef, {
        ...conteo,
        movimiento_ajuste_id:
          movimientoRef.id,
        contado_en: serverTimestamp()
      });
    });

    return {
      id: conteoRef.id
    };
  };

export const actualizarPoliticaStock =
  async ({
    db,
    perfil,
    plantaId,
    material,
    stockMinimo,
    puntoReposicion,
    stockObjetivo,
    leadTimeDias
  }) => {
    const politica = prepararPoliticaStock({
      empresaId: perfil.empresa_id,
      plantaId,
      material,
      stockMinimo,
      puntoReposicion,
      stockObjetivo,
      leadTimeDias,
      usuario: perfil
    });
    const errores =
      validarPoliticaStock(politica);

    if (errores.length > 0) {
      throw new Error(errores.join(" "));
    }

    const stockRef = doc(
      db,
      "inventario_materiales",
      idStockMaterial({
        empresaId: perfil.empresa_id,
        plantaId,
        materialId: material?.id
      })
    );

    await runTransaction(db, async transaccion => {
      const stockSnapshot =
        await transaccion.get(stockRef);
      const stockActual = stockSnapshot.exists()
        ? stockSnapshot.data()
        : {
          stock_actual: 0,
          stock_reservado: 0,
          stock_disponible: 0
        };

      transaccion.set(stockRef, {
        ...stockActual,
        ...politica,
        stock_actual: Number(
          stockActual.stock_actual || 0
        ),
        stock_reservado: Number(
          stockActual.stock_reservado || 0
        ),
        stock_disponible:
          calcularStockDisponible(stockActual),
        actualizado_en: serverTimestamp()
      });
    });

    return politica;
  };

export const registrarSolicitudReposicion =
  async ({
    db,
    perfil,
    plantaId,
    material,
    cantidadSugerida,
    prioridad,
    tipoSugerido,
    origen,
    otsAfectadas,
    stockDisponible,
    cantidadRequerida,
    brecha,
    observacion
  }) => {
    const solicitud = prepararSolicitudReposicion({
      empresaId: perfil.empresa_id,
      plantaId,
      material,
      cantidadSugerida,
      prioridad,
      tipoSugerido,
      origen,
      otsAfectadas,
      stockDisponible,
      cantidadRequerida,
      brecha,
      observacion,
      usuario: perfil
    });
    const errores =
      validarSolicitudReposicion(solicitud);

    if (errores.length > 0) {
      throw new Error(errores.join(" "));
    }

    const solicitudRef = doc(
      collection(db, "solicitudes_reposicion")
    );

    const abiertasSnapshot = await getDocs(
      query(
        collection(
          db,
          "solicitudes_reposicion"
        ),
        where("empresa_id", "==", perfil.empresa_id),
        where("planta_id", "==", plantaId)
      )
    );
    const tieneSolicitudAbierta =
      abiertasSnapshot.docs.some(documento => {
        const data = documento.data();
        return data.material_id === material?.id &&
          [
            ESTADOS_SOLICITUD_REPOSICION.PENDIENTE,
            ESTADOS_SOLICITUD_REPOSICION.EN_REVISION,
            ESTADOS_SOLICITUD_REPOSICION.APROBADA
          ].includes(data.estado);
      });

    if (tieneSolicitudAbierta) {
      throw new Error(
        "Ya existe una solicitud abierta para este material en este almacén."
      );
    }

    await runTransaction(db, async transaccion => {
      transaccion.set(solicitudRef, {
        ...solicitud,
        solicitado_en: serverTimestamp(),
        actualizado_en: serverTimestamp()
      });
    });

    return {
      id: solicitudRef.id,
      ...solicitud
    };
  };

export const resolverSolicitudReposicion =
  async ({
    db,
    perfil,
    solicitud,
    nuevoEstado,
    observacion = ""
  }) => {
    const estado = limpiarTexto(nuevoEstado);
    const comentario = limpiarTexto(observacion);

    if (!Object.values(
      ESTADOS_SOLICITUD_REPOSICION
    ).includes(estado)) {
      throw new Error(
        "Selecciona un estado válido para la solicitud."
      );
    }

    if (!comentario) {
      throw new Error(
        "Indica una observación para resolver la solicitud."
      );
    }

    const solicitudRef = doc(
      db,
      "solicitudes_reposicion",
      solicitud.id
    );

    await runTransaction(db, async transaccion => {
      const snapshot =
        await transaccion.get(solicitudRef);

      if (!snapshot.exists()) {
        throw new Error(
          "La solicitud ya no existe."
        );
      }

      const actual = snapshot.data();

      if (
        actual.empresa_id !== perfil.empresa_id ||
        actual.planta_id !== solicitud.planta_id
      ) {
        throw new Error(
          "La solicitud no pertenece a este almacén."
        );
      }

      if (
        [
          ESTADOS_SOLICITUD_REPOSICION.CERRADA,
          ESTADOS_SOLICITUD_REPOSICION.ANULADA
        ].includes(actual.estado)
      ) {
        throw new Error(
          "La solicitud ya está cerrada o anulada."
        );
      }

      transaccion.update(solicitudRef, {
        estado,
        observacion_resolucion: comentario,
        resuelto_por_id: perfil.uid,
        resuelto_por_nombre:
          perfil.nombre || "",
        resuelto_en: serverTimestamp(),
        actualizado_en: serverTimestamp()
      });
    });

    return {
      id: solicitud.id,
      estado
    };
  };

export const registrarTraspasoSalida =
  async ({
    db,
    perfil,
    plantaOrigenId,
    plantaDestinoId,
    material,
    cantidad,
    referencia,
    observacion
  }) => {
    const traspasoRef = doc(
      collection(db, "traspasos_almacen")
    );
    const stockOrigenRef = doc(
      db,
      "inventario_materiales",
      idStockMaterial({
        empresaId: perfil.empresa_id,
        plantaId: plantaOrigenId,
        materialId: material?.id
      })
    );
    const movimientoRef = doc(
      collection(db, "movimientos_almacen")
    );
    const traspaso = prepararTraspasoAlmacen({
      empresaId: perfil.empresa_id,
      plantaOrigenId,
      plantaDestinoId,
      material,
      cantidad,
      referencia,
      observacion,
      usuario: perfil
    });
    const movimiento =
      prepararMovimientoAlmacen({
        empresaId: perfil.empresa_id,
        plantaId: plantaOrigenId,
        material,
        tipo: TIPOS_MOVIMIENTO_ALMACEN
          .TRASPASO_SALIDA,
        cantidad,
        referencia:
          traspaso.referencia ||
          `traspaso:${traspasoRef.id}`,
        observacion,
        usuario: perfil
      });

    await runTransaction(db, async transaccion => {
      const stockSnapshot =
        await transaccion.get(stockOrigenRef);
      const stockActual = stockSnapshot.exists()
        ? stockSnapshot.data()
        : {
          stock_actual: 0,
          stock_reservado: 0
        };
      const errores = Array.from(new Set([
        ...validarTraspasoSalida(
          traspaso,
          stockActual
        ),
        ...validarMovimientoAlmacen(
          movimiento,
          stockActual
        )
      ]));

      if (errores.length > 0) {
        throw new Error(errores.join(" "));
      }

      const siguiente =
        calcularStockTrasMovimiento(
          stockActual,
          movimiento
        );

      transaccion.set(stockOrigenRef, {
        empresa_id: perfil.empresa_id,
        planta_id: plantaOrigenId,
        material_id: material.id,
        material_codigo: material.codigo,
        material_nombre: material.nombre,
        material_tipo: material.tipo,
        unidad_medida: material.unidad_medida,
        ...siguiente,
        actualizado_por_id: perfil.uid,
        actualizado_por_nombre:
          perfil.nombre || "",
        actualizado_en: serverTimestamp(),
        modelo_version: 2
      });
      transaccion.set(movimientoRef, {
        ...movimiento,
        origen: "traspaso",
        traspaso_id: traspasoRef.id,
        planta_destino_id: plantaDestinoId,
        stock_anterior:
          Number(
            stockActual.stock_actual || 0
          ),
        stock_reservado_anterior:
          Number(
            stockActual.stock_reservado || 0
          ),
        stock_nuevo: siguiente.stock_actual,
        stock_reservado_nuevo:
          siguiente.stock_reservado,
        stock_disponible_nuevo:
          siguiente.stock_disponible,
        fecha: serverTimestamp()
      });
      transaccion.set(traspasoRef, {
        ...traspaso,
        movimiento_salida_id:
          movimientoRef.id,
        creado_en: serverTimestamp(),
        actualizado_en: serverTimestamp()
      });
    });

    return {
      id: traspasoRef.id,
      ...traspaso
    };
  };

export const registrarTraspasoRecepcion =
  async ({
    db,
    perfil,
    traspaso
  }) => {
    const traspasoRef = doc(
      db,
      "traspasos_almacen",
      traspaso.id
    );
    const stockDestinoRef = doc(
      db,
      "inventario_materiales",
      idStockMaterial({
        empresaId: perfil.empresa_id,
        plantaId: traspaso.planta_destino_id,
        materialId: traspaso.material_id
      })
    );
    const movimientoRef = doc(
      collection(db, "movimientos_almacen")
    );
    const material = {
      id: traspaso.material_id,
      codigo: traspaso.material_codigo,
      nombre: traspaso.material_nombre,
      tipo: traspaso.material_tipo,
      unidad_medida: traspaso.unidad_medida
    };
    const movimiento =
      prepararMovimientoAlmacen({
        empresaId: perfil.empresa_id,
        plantaId: traspaso.planta_destino_id,
        material,
        tipo: TIPOS_MOVIMIENTO_ALMACEN
          .TRASPASO_RECEPCION,
        cantidad: traspaso.cantidad,
        referencia:
          traspaso.referencia ||
          `traspaso:${traspaso.id}`,
        observacion:
          traspaso.observacion ||
          "Recepción de traspaso",
        usuario: perfil
      });

    await runTransaction(db, async transaccion => {
      const traspasoSnapshot =
        await transaccion.get(traspasoRef);

      if (!traspasoSnapshot.exists()) {
        throw new Error(
          "El traspaso ya no existe."
        );
      }

      const traspasoActual =
        traspasoSnapshot.data();

      if (
        traspasoActual.estado !==
        ESTADOS_TRASPASO_ALMACEN.EN_TRANSITO
      ) {
        throw new Error(
          "Este traspaso ya fue recibido o cerrado."
        );
      }

      const stockSnapshot =
        await transaccion.get(stockDestinoRef);
      const stockActual = stockSnapshot.exists()
        ? stockSnapshot.data()
        : {
          stock_actual: 0,
          stock_reservado: 0
        };
      const errores = validarMovimientoAlmacen(
        movimiento,
        stockActual
      );

      if (errores.length > 0) {
        throw new Error(errores.join(" "));
      }

      const siguiente =
        calcularStockTrasMovimiento(
          stockActual,
          movimiento
        );

      transaccion.set(stockDestinoRef, {
        empresa_id: perfil.empresa_id,
        planta_id:
          traspasoActual.planta_destino_id,
        material_id:
          traspasoActual.material_id,
        material_codigo:
          traspasoActual.material_codigo,
        material_nombre:
          traspasoActual.material_nombre,
        material_tipo:
          traspasoActual.material_tipo,
        unidad_medida:
          traspasoActual.unidad_medida,
        ...siguiente,
        actualizado_por_id: perfil.uid,
        actualizado_por_nombre:
          perfil.nombre || "",
        actualizado_en: serverTimestamp(),
        modelo_version: 2
      });
      transaccion.set(movimientoRef, {
        ...movimiento,
        origen: "traspaso",
        traspaso_id: traspaso.id,
        planta_origen_id:
          traspasoActual.planta_origen_id,
        stock_anterior:
          Number(
            stockActual.stock_actual || 0
          ),
        stock_reservado_anterior:
          Number(
            stockActual.stock_reservado || 0
          ),
        stock_nuevo: siguiente.stock_actual,
        stock_reservado_nuevo:
          siguiente.stock_reservado,
        stock_disponible_nuevo:
          siguiente.stock_disponible,
        fecha: serverTimestamp()
      });
      transaccion.update(traspasoRef, {
        estado:
          ESTADOS_TRASPASO_ALMACEN.RECIBIDO,
        cantidad_recibida:
          Number(traspasoActual.cantidad || 0),
        recibido_por_id: perfil.uid,
        recibido_por_nombre:
          perfil.nombre || "",
        recibido_en: serverTimestamp(),
        movimiento_recepcion_id:
          movimientoRef.id,
        actualizado_en: serverTimestamp()
      });
    });

    return {
      id: traspaso.id,
      estado:
        ESTADOS_TRASPASO_ALMACEN.RECIBIDO
    };
  };
