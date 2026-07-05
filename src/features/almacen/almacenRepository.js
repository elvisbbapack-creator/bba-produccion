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
  const siguienteReservado = reservado +
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
