export const TIPOS_MATERIAL = {
  MATERIA_PRIMA: "MP",
  RECURSO_FABRICACION: "RF",
  SUMINISTRO: "SUM",
  EPP: "EPP"
};

const numeroPositivo = (valor) =>
  Number.isFinite(Number(valor)) &&
  Number(valor) > 0;

const codigoValido = (codigo, prefijo) =>
  typeof codigo === "string" &&
  new RegExp(`^${prefijo}\\d{4,}$`).test(codigo);

const factorComposicionOperacion = (
  operacion = {},
  composicionProducto = []
) => {
  const objetivo = operacion.subproducto_id
    ? {
        tipo: "SUBPRODUCTO",
        item_id: operacion.subproducto_id
      }
    : operacion.pieza_id
      ? {
          tipo: "PIEZA",
          item_id: operacion.pieza_id
        }
      : null;
  const item = objetivo
    ? composicionProducto.find(
        componente =>
          componente.tipo === objetivo.tipo &&
          componente.item_id ===
            objetivo.item_id
      )
    : null;
  const cantidad = Number(item?.cantidad || 0);

  return {
    factor: cantidad > 0 ? cantidad : 1,
    item
  };
};

const materialesEntradaOperacion = (
  operacion = {}
) => {
  const entradas = Array.isArray(
    operacion.materiales_entrada
  )
    ? operacion.materiales_entrada
    : [];

  if (entradas.length > 0) {
    return entradas;
  }

  return operacion.material_entrada_id
    ? [{
        material_id:
          operacion.material_entrada_id,
        cantidad: 1
      }]
    : [];
};

export const autocompletarDependenciasRf = (
  ruta = {},
  materiales = []
) => {
  const operaciones = Array.isArray(ruta.operaciones)
    ? ruta.operaciones
    : [];
  const materialesPorId = new Map(
    materiales.map(material => [
      material.id,
      material
    ])
  );
  const productoresRf = new Map();

  operaciones.forEach(operacion => {
    const salida = materialesPorId.get(
      operacion.material_salida_id
    );

    if (
      salida?.tipo ===
        TIPOS_MATERIAL.RECURSO_FABRICACION &&
      !productoresRf.has(salida.id)
    ) {
      productoresRf.set(salida.id, operacion);
    }
  });

  const cambios = [];
  const operacionesActualizadas = operaciones.map(
    operacion => {
      const dependencias = [
        ...(operacion.dependencias || [])
      ];
      const dependenciasUsadas = new Set(
        dependencias
          .map(dependencia =>
            dependencia.ruta_operacion_id
          )
          .filter(Boolean)
      );

      materialesEntradaOperacion(operacion)
        .forEach(entradaOperacion => {
          const entrada = materialesPorId.get(
            entradaOperacion.material_id
          );

          if (
            entrada?.tipo !==
              TIPOS_MATERIAL.RECURSO_FABRICACION ||
            entrada.es_comprado
          ) {
            return;
          }

          const productora =
            productoresRf.get(entrada.id);

          if (
            !productora ||
            productora.id === operacion.id ||
            dependenciasUsadas.has(productora.id)
          ) {
            return;
          }

          dependencias.push({
            ruta_operacion_id: productora.id,
            porcentaje_minimo_avance: 100,
            requiere_material_disponible: true
          });
          dependenciasUsadas.add(productora.id);
          cambios.push({
            operacion_id: operacion.id,
            operacion_codigo:
              operacion.operacion_codigo,
            rf_id: entrada.id,
            rf_codigo: entrada.codigo,
            productora_id: productora.id,
            productora_codigo:
              productora.operacion_codigo
          });
        });

      if (dependencias.length ===
        (operacion.dependencias || []).length) {
        return operacion;
      }

      return {
        ...operacion,
        dependencias,
        dependencia_id:
          dependencias[0]?.ruta_operacion_id || "",
        porcentaje_minimo_avance:
          dependencias[0]
            ?.porcentaje_minimo_avance ?? "0"
      };
    }
  );

  return {
    operaciones: operacionesActualizadas,
    cambios
  };
};

export const validarMaterial = (material = {}) => {
  const errores = [];

  if (!material.id) {
    errores.push("El material requiere ID.");
  }

  if (
    !Object.values(TIPOS_MATERIAL).includes(
      material.tipo
    )
  ) {
    errores.push("El tipo de material debe ser MP, RF, SUM o EPP.");
  }

  if (
    material.tipo &&
    !codigoValido(material.codigo, material.tipo)
  ) {
    errores.push(
      `El codigo debe comenzar con ${material.tipo} y usar un correlativo.`
    );
  }

  if (!material.nombre?.trim()) {
    errores.push("El material requiere nombre.");
  }

  if (!material.unidad_medida?.trim()) {
    errores.push("El material requiere unidad de medida.");
  }

  return errores;
};

const detectarCiclo = (operaciones) => {
  const dependenciasPorId = new Map(
    operaciones.map(operacion => [
      operacion.id,
      (operacion.dependencias || []).map(
        dependencia =>
          dependencia.ruta_operacion_id
      )
    ])
  );
  const visitando = new Set();
  const visitados = new Set();

  const visitar = (operacionId) => {
    if (visitando.has(operacionId)) {
      return true;
    }

    if (visitados.has(operacionId)) {
      return false;
    }

    visitando.add(operacionId);

    const tieneCiclo =
      (dependenciasPorId.get(operacionId) || [])
        .some(visitar);

    visitando.delete(operacionId);
    visitados.add(operacionId);

    return tieneCiclo;
  };

  return operaciones.some(
    operacion => visitar(operacion.id)
  );
};

export const validarRuta = (
  ruta = {},
  materiales = []
) => {
  const errores = [];
  const operaciones = Array.isArray(ruta.operaciones)
    ? ruta.operaciones
    : [];
  const materialesPorId = new Map(
    materiales.map(material => [
      material.id,
      material
    ])
  );
  const idsOperacion = new Set();
  const codigosOperacion = new Set();
  const productoresRf = new Map();

  materiales.forEach(material => {
    validarMaterial(material).forEach(error => {
      errores.push(
        `${material.codigo || material.id || "Material"}: ${error}`
      );
    });
  });

  if (!ruta.producto_id) {
    errores.push("La ruta requiere producto_id.");
  }

  if (!numeroPositivo(ruta.version)) {
    errores.push("La ruta requiere una version positiva.");
  }

  if (operaciones.length === 0) {
    errores.push("La ruta requiere al menos una operacion.");
  }

  operaciones.forEach((operacion, indice) => {
    const referencia =
      operacion.operacion_codigo ||
      operacion.id ||
      `indice ${indice}`;

    if (!operacion.id) {
      errores.push(
        `La operacion ${referencia} requiere ID.`
      );
    } else if (idsOperacion.has(operacion.id)) {
      errores.push(
        `La operacion ${operacion.id} esta duplicada.`
      );
    } else {
      idsOperacion.add(operacion.id);
    }

    if (!operacion.operacion_id) {
      errores.push(
        `La operacion ${referencia} requiere operacion_id.`
      );
    }

    if (!operacion.operacion_codigo) {
      errores.push(
        `La operacion ${referencia} requiere codigo.`
      );
    } else if (
      codigosOperacion.has(
        operacion.operacion_codigo
      )
    ) {
      errores.push(
        `El codigo ${operacion.operacion_codigo} esta duplicado.`
      );
    } else {
      codigosOperacion.add(
        operacion.operacion_codigo
      );
    }

    if (!numeroPositivo(operacion.secuencia)) {
      errores.push(
        `La operacion ${referencia} requiere secuencia positiva.`
      );
    }

    if (
      !numeroPositivo(
        operacion.unidades_por_producto
      )
    ) {
      errores.push(
        `La operacion ${referencia} requiere unidades_por_producto positivas.`
      );
    }

    if (
      !Number.isFinite(
        Number(operacion.unidades_por_hora)
      ) ||
      Number(operacion.unidades_por_hora) < 0
    ) {
      errores.push(
        `La operacion ${referencia} requiere unidades_por_hora iguales o mayores que cero.`
      );
    }

    const entradas =
      materialesEntradaOperacion(operacion);
    const entradasMateriales = entradas.map(
      entrada => ({
        ...entrada,
        material: materialesPorId.get(
          entrada.material_id
        )
      })
    );
    const salida = materialesPorId.get(
      operacion.material_salida_id
    );

    if (entradas.length === 0) {
      errores.push(
        `La operacion ${referencia} usa un material de entrada inexistente.`
      );
    }

    const entradasUsadas = new Set();
    entradasMateriales.forEach(
      (entrada, entradaIndice) => {
        if (!entrada.material) {
          errores.push(
            `La operacion ${referencia} usa un material de entrada inexistente.`
          );
        }

        if (
          !numeroPositivo(entrada.cantidad)
        ) {
          errores.push(
            `La operacion ${referencia} requiere cantidades de entrada positivas.`
          );
        }

        if (
          entrada.material_id &&
          entradasUsadas.has(
            entrada.material_id
          )
        ) {
          errores.push(
            `La operacion ${referencia} repite un material de entrada.`
          );
        }

        if (entrada.material_id) {
          entradasUsadas.add(
            entrada.material_id
          );
        }

        if (
          entradaIndice === 0 &&
          operacion.material_entrada_id &&
          entrada.material_id !==
            operacion.material_entrada_id
        ) {
          errores.push(
            `La operacion ${referencia} no coincide con su primer material de entrada.`
          );
        }
      }
    );

    if (
      salida &&
      entradasMateriales.some(
        entrada =>
          entrada.material &&
          entrada.material.id === salida.id
      )
    ) {
      errores.push(
        `La operacion ${referencia} no puede tener el mismo material de entrada y salida.`
      );
    }

    if (!salida) {
      errores.push(
        `La operacion ${referencia} usa un material de salida inexistente.`
      );
    } else if (
      salida.tipo !==
      TIPOS_MATERIAL.RECURSO_FABRICACION
    ) {
      errores.push(
        `La salida de ${referencia} debe ser un RF.`
      );
    } else if (
      productoresRf.has(salida.id)
    ) {
      errores.push(
        `El RF ${salida.codigo} tiene mas de una operacion productora.`
      );
    } else {
      productoresRf.set(
        salida.id,
        operacion.id
      );
    }

    const dependenciasUsadas = new Set();

    (operacion.dependencias || [])
      .forEach(dependencia => {
        const porcentaje = Number(
          dependencia.porcentaje_minimo_avance
        );

        if (
          dependencia.ruta_operacion_id ===
          operacion.id
        ) {
          errores.push(
            `La operacion ${referencia} no puede depender de si misma.`
          );
        }

        if (
          !Number.isFinite(porcentaje) ||
          porcentaje < 0 ||
          porcentaje > 100
        ) {
          errores.push(
            `La dependencia de ${referencia} requiere un porcentaje entre 0 y 100.`
          );
        }

        if (
          dependencia.ruta_operacion_id &&
          dependenciasUsadas.has(
            dependencia.ruta_operacion_id
          )
        ) {
          errores.push(
            `La operacion ${referencia} tiene dependencias repetidas.`
          );
        }

        if (dependencia.ruta_operacion_id) {
          dependenciasUsadas.add(
            dependencia.ruta_operacion_id
          );
        }
      });
  });

  operaciones.forEach(operacion => {
    (operacion.dependencias || [])
      .forEach(dependencia => {
        if (
          !idsOperacion.has(
            dependencia.ruta_operacion_id
          )
        ) {
          errores.push(
            `La operacion ${operacion.operacion_codigo} depende de una operacion inexistente.`
          );
        }
      });

    materialesEntradaOperacion(operacion)
      .forEach(entradaOperacion => {
        const entrada = materialesPorId.get(
          entradaOperacion.material_id
        );

        if (
          entrada?.tipo !==
            TIPOS_MATERIAL.RECURSO_FABRICACION ||
          entrada.es_comprado
        ) {
          return;
        }

      const productorId =
        productoresRf.get(entrada.id);

      if (!productorId) {
        errores.push(
          `El RF ${entrada.codigo} no tiene una operacion productora en la ruta.`
        );
      } else {
        const dependencias = new Set(
          (operacion.dependencias || []).map(
            dependencia =>
              dependencia.ruta_operacion_id
          )
        );

        if (!dependencias.has(productorId)) {
          errores.push(
            `La operacion ${operacion.operacion_codigo} debe depender de quien produce ${entrada.codigo}.`
          );
        }
      }
      });
  });

  if (
    operaciones.length > 0 &&
    detectarCiclo(operaciones)
  ) {
    errores.push(
      "La ruta contiene dependencias ciclicas."
    );
  }

  return errores;
};

export const congelarRutaParaOT = ({
  ruta,
  materiales,
  cantidadProducto,
  composicionProducto = []
}) => {
  if (!numeroPositivo(cantidadProducto)) {
    throw new Error(
      "La cantidad de producto debe ser positiva."
    );
  }

  const errores = validarRuta(ruta, materiales);

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const materialesPorId = new Map(
    materiales.map(material => [
      material.id,
      material
    ])
  );

  return [...ruta.operaciones]
    .sort(
      (a, b) =>
        Number(a.secuencia) -
        Number(b.secuencia)
    )
    .map(operacion => {
      const entradas =
        materialesEntradaOperacion(operacion)
          .map(entrada => {
            const material =
              materialesPorId.get(
                entrada.material_id
              );
            return {
              material_id: material.id,
              material_codigo: material.codigo,
              material_nombre: material.nombre,
              cantidad: Number(
                entrada.cantidad || 1
              )
            };
          });
      const entrada = entradas[0];
      const salida = materialesPorId.get(
        operacion.material_salida_id
      );
      const unidadesPorItemBase = Number(
        operacion.unidades_por_producto
      );
      const composicion =
        factorComposicionOperacion(
          operacion,
          composicionProducto
        );
      const unidadesPorProducto =
        unidadesPorItemBase *
        composicion.factor;
      const cantidadRequerida =
        Number(cantidadProducto) *
        unidadesPorProducto;
      const dependencias =
        (operacion.dependencias || []).map(
          dependencia => ({
            ruta_operacion_id:
              dependencia.ruta_operacion_id,
            porcentaje_minimo_avance:
              Number(
                dependencia
                  .porcentaje_minimo_avance
              ),
            requiere_material_disponible:
              dependencia
                .requiere_material_disponible !==
              false
          })
        );

      return {
        ruta_operacion_id: operacion.id,
        operacion_id: operacion.operacion_id,
        operacion_codigo:
          operacion.operacion_codigo,
        operacion_nombre:
          operacion.operacion_nombre,
        proceso_id: operacion.proceso_id,
        proceso_nombre:
          operacion.proceso_nombre,
        subproceso_id:
          operacion.subproceso_id,
        subproceso_nombre:
          operacion.subproceso_nombre,
        secuencia: Number(operacion.secuencia),
        material_entrada_id:
          entrada.material_id,
        material_entrada_codigo:
          entrada.material_codigo,
        materiales_entrada: entradas,
        material_salida_id: salida.id,
        material_salida_codigo:
          salida.codigo,
        medida: operacion.medida || "",
        unidades_por_producto:
          unidadesPorProducto,
        unidades_por_item_base:
          unidadesPorItemBase,
        item_base_tipo:
          composicion.item?.tipo ||
          (operacion.subproducto_id
            ? "SUBPRODUCTO"
            : operacion.pieza_id
              ? "PIEZA"
              : "PRODUCTO"),
        item_base_id:
          composicion.item?.item_id ||
          operacion.subproducto_id ||
          operacion.pieza_id ||
          ruta.producto_id ||
          "",
        item_base_codigo:
          composicion.item?.item_codigo ||
          operacion.subproducto_codigo ||
          operacion.pieza_codigo ||
          "",
        item_base_nombre:
          composicion.item?.item_nombre ||
          operacion.subproducto_nombre ||
          operacion.pieza_nombre ||
          "",
        factor_composicion:
          composicion.factor,
        cantidad_requerida:
          cantidadRequerida,
        cantidad_ok: 0,
        cantidad_defectuosa: 0,
        cantidad_reproceso: 0,
        cantidad_merma: 0,
        reproceso_pendiente: 0,
        cantidad_consumida: 0,
        cantidad_pendiente:
          cantidadRequerida,
        unidades_por_hora: Number(
          operacion.unidades_por_hora
        ),
        dependencias,
        estado:
          dependencias.length === 0
            ? "disponible"
            : "pendiente",
        avance_pct: 0,
        fecha_inicio: null,
        fecha_fin: null,
        modelo_version: 2
      };
    });
};

export const calcularDisponibilidadRF = ({
  cantidadProducidaOk = 0,
  cantidadConsumida = 0,
  cantidadDescartada = 0
}) => {
  return Math.max(
    0,
    Number(cantidadProducidaOk) -
      Number(cantidadConsumida) -
      Number(cantidadDescartada)
  );
};

export const registrarResultadoOperacion = (
  operacion,
  {
    cantidadOk = 0,
    cantidadDefectuosa = 0,
    cantidadReproceso = 0
  }
) => {
  const valores = [
    cantidadOk,
    cantidadDefectuosa,
    cantidadReproceso
  ].map(Number);

  if (
    valores.some(
      valor =>
        !Number.isFinite(valor) ||
        valor < 0
    )
  ) {
    throw new Error(
      "Las cantidades reportadas deben ser numeros no negativos."
    );
  }

  const [
    ok,
    defectuosa,
    reproceso
  ] = valores;
  const cantidadRequerida = Number(
    operacion.cantidad_requerida || 0
  );
  const totalOk =
    Number(operacion.cantidad_ok || 0) + ok;
  const totalDefectuosa =
    Number(
      operacion.cantidad_defectuosa || 0
    ) + defectuosa;
  const totalReproceso =
    Number(
      operacion.cantidad_reproceso || 0
    ) + reproceso;
  const cantidadPendiente = Math.max(
    0,
    cantidadRequerida - totalOk
  );
  const avance = cantidadRequerida > 0
    ? Math.min(
        100,
        (totalOk / cantidadRequerida) * 100
      )
    : 0;

  return {
    ...operacion,
    cantidad_ok: totalOk,
    cantidad_defectuosa: totalDefectuosa,
    cantidad_reproceso: totalReproceso,
    cantidad_pendiente: cantidadPendiente,
    avance_pct: Number(avance.toFixed(2)),
    estado:
      cantidadPendiente === 0
        ? "completada"
        : "en_proceso"
  };
};

export const dependenciasCumplidas = (
  operacion,
  operacionesPorId,
  disponibilidadPorMaterial = {}
) => {
  return (operacion.dependencias || [])
    .every(dependencia => {
      const predecesora =
        operacionesPorId[
          dependencia.ruta_operacion_id
        ];

      if (!predecesora) {
        return false;
      }

      const cumpleAvance =
        Number(predecesora.avance_pct || 0) >=
        Number(
          dependencia.porcentaje_minimo_avance
        );
      const cumpleMaterial =
        !dependencia
          .requiere_material_disponible ||
        materialesEntradaOperacion(operacion)
          .every(entrada =>
            Number(
              disponibilidadPorMaterial[
                entrada.material_id
              ] || 0
            ) > 0
          );

      return cumpleAvance && cumpleMaterial;
    });
};
