import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where
} from "firebase/firestore";
import {
  calcularDisponibilidadRF,
  dependenciasCumplidas,
  registrarResultadoOperacion
} from "../../domain/produccionV2";
import {
  listarOperacionesOT,
  listarOrdenesV2
} from "../ordenes/ordenesRepository";

const limpiarTexto = (valor) =>
  (valor || "").toString().trim();

const slug = (valor) =>
  limpiarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const fechaOperativa = () =>
  new Date().toISOString().slice(0, 10);

export const calcularDisponibilidadPorMaterial = (
  operaciones = []
) => {
  const disponibilidad = {};

  operaciones.forEach(operacion => {
    const materialId =
      operacion.material_salida_id;

    disponibilidad[materialId] =
      (disponibilidad[materialId] || 0) +
      calcularDisponibilidadRF({
        cantidadProducidaOk:
          operacion.cantidad_ok,
        cantidadConsumida: 0,
        cantidadDescartada: 0
      });
  });

  operaciones.forEach(operacion => {
    const materialId =
      operacion.material_entrada_id;

    if (
      Object.prototype.hasOwnProperty.call(
        disponibilidad,
        materialId
      )
    ) {
      disponibilidad[materialId] = Math.max(
        0,
        disponibilidad[materialId] -
          Number(
            operacion.cantidad_consumida || 0
          )
      );
    }
  });

  return disponibilidad;
};

export const obtenerOperacionesDisponibles = (
  operaciones = []
) => {
  const porId = Object.fromEntries(
    operaciones.map(operacion => [
      operacion.ruta_operacion_id ||
        operacion.id,
      operacion
    ])
  );
  const disponibilidad =
    calcularDisponibilidadPorMaterial(
      operaciones
    );

  return operaciones.filter(operacion => {
    if (
      Number(operacion.cantidad_pendiente) <= 0 ||
      operacion.estado === "completada"
    ) {
      return false;
    }

    if (
      (operacion.dependencias || []).length === 0
    ) {
      return true;
    }

    return dependenciasCumplidas(
      operacion,
      porId,
      disponibilidad
    );
  });
};

export const validarInicioSesion = ({
  orden,
  operacion,
  operarioCodigo,
  operarioNombre
}) => {
  const errores = [];

  if (!orden) {
    errores.push("Selecciona una OT.");
  }

  if (!operacion) {
    errores.push(
      "Selecciona una operación disponible."
    );
  }

  if (!limpiarTexto(operarioCodigo)) {
    errores.push(
      "Ingresa el código del operario."
    );
  }

  if (!limpiarTexto(operarioNombre)) {
    errores.push(
      "Ingresa el nombre del operario."
    );
  }

  return errores;
};

export const calcularIndicadoresSesion = ({
  cantidadOk = 0,
  cantidadDefectuosa = 0,
  cantidadReproceso = 0,
  unidadesPorHora = 0,
  tiempoProductivoSeg = 0
}) => {
  const ok = Number(cantidadOk);
  const defectuosa = Number(
    cantidadDefectuosa
  );
  const reproceso = Number(cantidadReproceso);
  const total =
    ok + defectuosa + reproceso;
  const esperado =
    Number(unidadesPorHora) *
    (Number(tiempoProductivoSeg) / 3600);
  const rendimiento = esperado > 0
    ? (total / esperado) * 100
    : 0;
  const calidad = total > 0
    ? (ok / total) * 100
    : 0;
  const eficienciaCalidad =
    (rendimiento * calidad) / 100;

  return {
    produccion_total: total,
    produccion_esperada: Number(
      esperado.toFixed(2)
    ),
    rendimiento_pct: Number(
      rendimiento.toFixed(2)
    ),
    calidad_pct: Number(
      calidad.toFixed(2)
    ),
    eficiencia_calidad_pct: Number(
      eficienciaCalidad.toFixed(2)
    )
  };
};

export const listarOrdenesEjecutables = async (
  db,
  empresaId,
  plantaId
) => {
  const ordenes = await listarOrdenesV2(
    db,
    empresaId,
    plantaId
  );

  return ordenes.filter(orden =>
    [
      "liberada",
      "en_produccion",
      "pausada"
    ].includes(orden.estado)
  );
};

export const listarSesionesActivas = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "sesiones_produccion"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId),
      where("estado", "==", "activa")
    )
  );

  return snapshot.docs.map(documento => ({
    id: documento.id,
    ...documento.data()
  }));
};

export const iniciarSesionProduccion = async ({
  db,
  perfil,
  orden,
  operacion,
  operarioCodigo,
  operarioNombre
}) => {
  const errores = validarInicioSesion({
    orden,
    operacion,
    operarioCodigo,
    operarioNombre
  });

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const sesionRef = doc(
    collection(db, "sesiones_produccion")
  );
  const eventoRef = doc(
    collection(db, "eventos_produccion")
  );
  const otRef = doc(
    db,
    "ordenes_trabajo",
    orden.id
  );
  const operacionRef = doc(
    db,
    "ordenes_trabajo",
    orden.id,
    "operaciones",
    operacion.id
  );
  const codigo = limpiarTexto(
    operarioCodigo
  ).toUpperCase();
  const nombre = limpiarTexto(operarioNombre);

  await runTransaction(db, async transaccion => {
    const operacionSnap =
      await transaccion.get(operacionRef);

    if (!operacionSnap.exists()) {
      throw new Error(
        "La operación ya no existe."
      );
    }

    if (
      Number(
        operacionSnap.data().cantidad_pendiente
      ) <= 0
    ) {
      throw new Error(
        "La operación ya está completada."
      );
    }

    transaccion.set(sesionRef, {
      empresa_id: perfil.empresa_id,
      planta_id: orden.planta_id,
      turno_id: "",
      ot_id: orden.id,
      ot_codigo: orden.codigo,
      ot_operacion_id: operacion.id,
      operacion_id: operacion.operacion_id,
      operacion_codigo:
        operacion.operacion_codigo,
      operacion_nombre:
        operacion.operacion_nombre,
      operario_id: codigo || slug(nombre),
      operario_codigo: codigo,
      operario_nombre: nombre,
      supervisor_id: perfil.uid,
      supervisor_nombre: perfil.nombre,
      estado: "activa",
      inicio: serverTimestamp(),
      fin: null,
      tiempo_productivo_seg: 0,
      tiempo_paro_seg: 0,
      estandar_unidades_hora: Number(
        operacion.unidades_por_hora
      ),
      ruta_version: orden.ruta_version,
      fecha_operativa: fechaOperativa(),
      modelo_version: 2
    });
    transaccion.set(eventoRef, {
      sesion_id: sesionRef.id,
      empresa_id: perfil.empresa_id,
      planta_id: orden.planta_id,
      ot_id: orden.id,
      ot_operacion_id: operacion.id,
      operario_id: codigo || slug(nombre),
      tipo: "inicio",
      cantidad_ok: 0,
      cantidad_defectuosa: 0,
      cantidad_reproceso: 0,
      observacion: "",
      timestamp: serverTimestamp(),
      registrado_por_id: perfil.uid,
      modelo_version: 2
    });
    transaccion.update(operacionRef, {
      estado: "en_proceso",
      fecha_inicio:
        operacionSnap.data().fecha_inicio ||
        serverTimestamp(),
      fecha_actualizacion: serverTimestamp()
    });
    transaccion.update(otRef, {
      estado: "en_produccion",
      fecha_real_inicio:
        orden.fecha_real_inicio ||
        serverTimestamp(),
      fecha_actualizacion: serverTimestamp()
    });
  });

  return {
    id: sesionRef.id,
    ot_id: orden.id,
    ot_codigo: orden.codigo,
    ot_operacion_id: operacion.id,
    operacion_codigo:
      operacion.operacion_codigo,
    operacion_nombre:
      operacion.operacion_nombre,
    operario_id: codigo || slug(nombre),
    operario_codigo: codigo,
    operario_nombre: nombre,
    planta_id: orden.planta_id,
    estado: "activa"
  };
};

export const registrarReporteProduccion =
  async ({
    db,
    perfil,
    sesion,
    cantidadOk,
    cantidadDefectuosa,
    cantidadReproceso,
    observacion
  }) => {
    const valores = [
      cantidadOk,
      cantidadDefectuosa,
      cantidadReproceso
    ].map(valor => Number(valor || 0));

    if (
      valores.some(
        valor =>
          !Number.isFinite(valor) ||
          valor < 0
      ) ||
      valores.every(valor => valor === 0)
    ) {
      throw new Error(
        "Reporta al menos una cantidad válida."
      );
    }

    if (!sesion) {
      throw new Error(
        "Selecciona una sesión activa."
      );
    }

    const operaciones = await listarOperacionesOT(
      db,
      perfil.empresa_id,
      sesion.planta_id,
      sesion.ot_id
    );
    const referencias = operaciones.map(
      operacion => ({
        operacion,
        ref: doc(
          db,
          "ordenes_trabajo",
          sesion.ot_id,
          "operaciones",
          operacion.id
        )
      })
    );
    const sesionRef = doc(
      db,
      "sesiones_produccion",
      sesion.id
    );
    const otRef = doc(
      db,
      "ordenes_trabajo",
      sesion.ot_id
    );
    const eventoRef = doc(
      collection(db, "eventos_produccion")
    );
    let resultadoReporte;

    await runTransaction(
      db,
      async transaccion => {
        const sesionSnap =
          await transaccion.get(sesionRef);

        if (!sesionSnap.exists()) {
          throw new Error(
            "La sesión ya no existe."
          );
        }

        if (
          sesionSnap.data().estado !== "activa"
        ) {
          throw new Error(
            "La sesión ya fue finalizada."
          );
        }

        const snapshots = [];

        for (const item of referencias) {
          snapshots.push({
            ...item,
            snapshot:
              await transaccion.get(item.ref)
          });
        }

        const actuales = snapshots.map(
          item => ({
            id: item.ref.id,
            ...item.snapshot.data()
          })
        );
        const objetivo = actuales.find(
          operacion =>
            operacion.id ===
            sesion.ot_operacion_id
        );

        if (!objetivo) {
          throw new Error(
            "No se encontró la operación de la sesión."
          );
        }

        const actualizado =
          registrarResultadoOperacion(
            objetivo,
            {
              cantidadOk: valores[0],
              cantidadDefectuosa: valores[1],
              cantidadReproceso: valores[2]
            }
          );
        actualizado.cantidad_consumida =
          Number(
            objetivo.cantidad_consumida || 0
          ) +
          valores[0] +
          valores[1] +
          valores[2];

        const posteriores = actuales.map(
          operacion =>
            operacion.id === actualizado.id
              ? actualizado
              : operacion
        );
        const disponibilidad =
          calcularDisponibilidadPorMaterial(
            posteriores
          );
        const porId = Object.fromEntries(
          posteriores.map(operacion => [
            operacion.ruta_operacion_id ||
              operacion.id,
            operacion
          ])
        );

        snapshots.forEach(item => {
          const operacion = posteriores.find(
            actual => actual.id === item.ref.id
          );
          const cambios = {
            fecha_actualizacion:
              serverTimestamp()
          };

          if (operacion.id === actualizado.id) {
            Object.assign(cambios, {
              cantidad_ok:
                actualizado.cantidad_ok,
              cantidad_defectuosa:
                actualizado.cantidad_defectuosa,
              cantidad_reproceso:
                actualizado.cantidad_reproceso,
              cantidad_consumida:
                actualizado.cantidad_consumida,
              cantidad_pendiente:
                actualizado.cantidad_pendiente,
              avance_pct:
                actualizado.avance_pct,
              estado: actualizado.estado,
              fecha_fin:
                actualizado.estado ===
                "completada"
                  ? serverTimestamp()
                  : null
            });
          } else if (
            operacion.estado === "pendiente" &&
            dependenciasCumplidas(
              operacion,
              porId,
              disponibilidad
            )
          ) {
            cambios.estado = "disponible";
          }

          transaccion.update(
            item.ref,
            cambios
          );
        });

        const totalRequerido = posteriores.reduce(
          (total, operacion) =>
            total +
            Number(
              operacion.cantidad_requerida || 0
            ),
          0
        );
        const totalOk = posteriores.reduce(
          (total, operacion) =>
            total +
            Number(operacion.cantidad_ok || 0),
          0
        );
        const completada = posteriores.every(
          operacion =>
            Number(
              operacion.cantidad_pendiente
            ) <= 0
        );
        const fin = Timestamp.now();
        const inicio =
          sesionSnap.data().inicio;
        const tiempoProductivoSeg = Math.max(
          1,
          Math.round(
            (
              fin.toMillis() -
              inicio.toMillis()
            ) / 1000
          )
        );
        const indicadores =
          calcularIndicadoresSesion({
            cantidadOk: valores[0],
            cantidadDefectuosa: valores[1],
            cantidadReproceso: valores[2],
            unidadesPorHora:
              sesionSnap.data()
                .estandar_unidades_hora,
            tiempoProductivoSeg
          });

        transaccion.update(sesionRef, {
          estado: "finalizada",
          fin,
          tiempo_productivo_seg:
            tiempoProductivoSeg,
          cantidad_ok: valores[0],
          cantidad_defectuosa: valores[1],
          cantidad_reproceso: valores[2],
          ...indicadores
        });
        transaccion.set(eventoRef, {
          sesion_id: sesion.id,
          empresa_id: perfil.empresa_id,
          planta_id: sesion.planta_id,
          ot_id: sesion.ot_id,
          ot_operacion_id:
            sesion.ot_operacion_id,
          operario_id: sesion.operario_id,
          tipo: "reporte",
          cantidad_ok: valores[0],
          cantidad_defectuosa: valores[1],
          cantidad_reproceso: valores[2],
          observacion:
            limpiarTexto(observacion),
          tiempo_productivo_seg:
            tiempoProductivoSeg,
          ...indicadores,
          timestamp: serverTimestamp(),
          registrado_por_id: perfil.uid,
          modelo_version: 2
        });
        transaccion.update(otRef, {
          avance_pct:
            totalRequerido > 0
              ? Number(
                  (
                    (totalOk / totalRequerido) *
                    100
                  ).toFixed(2)
                )
              : 0,
          estado: completada
            ? "completada"
            : "en_produccion",
          fecha_real_fin: completada
            ? serverTimestamp()
            : null,
          fecha_actualizacion: serverTimestamp()
        });

        resultadoReporte = {
          tiempo_productivo_seg:
            tiempoProductivoSeg,
          ...indicadores
        };
      }
    );

    return resultadoReporte;
  };
