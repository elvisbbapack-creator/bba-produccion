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
  RESERVA_OT: "reserva_ot",
  LIBERACION_RESERVA: "liberacion_reserva",
  CONSUMO_OT: "consumo_ot"
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
    stock < 0 ||
    reservado < 0
  ) {
    errores.push(
      "El stock actual no puede ser negativo."
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
