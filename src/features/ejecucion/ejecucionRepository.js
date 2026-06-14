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
  calcularProyeccionOT,
  listarOperacionesOT,
  listarOrdenesV2
} from "../ordenes/ordenesRepository";
import {
  actualizarResumenEstandar,
  actualizarRankingPlanta,
  calcularMedicionEstandar,
  calcularResumenAcumulado,
  referenciasResumenReporte
} from "../resumenes/resumenesRepository";
import {
  datosTurnoParaSesion,
  normalizarSubprocesosHabilitados
} from "../turnos/turnosRepository";

const limpiarTexto = (valor) =>
  (valor || "").toString().trim();

const slug = (valor) =>
  limpiarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const idOcupacionOperario = ({
  empresaId,
  plantaId,
  operarioCodigo
}) => [
  empresaId,
  plantaId,
  limpiarTexto(operarioCodigo)
    .toUpperCase()
    .replace(/\s+/g, "")
].join("__");

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
  const evaluarEficiencia = esperado > 0;
  const rendimiento = evaluarEficiencia
    ? (total / esperado) * 100
    : null;
  const calidad = total > 0
    ? (ok / total) * 100
    : 0;
  const eficienciaCalidad = evaluarEficiencia
    ? (rendimiento * calidad) / 100
    : null;

  return {
    evaluar_eficiencia: evaluarEficiencia,
    produccion_total: total,
    produccion_esperada: Number(
      esperado.toFixed(2)
    ),
    rendimiento_pct: evaluarEficiencia
      ? Number(rendimiento.toFixed(2))
      : null,
    calidad_pct: Number(
      calidad.toFixed(2)
    ),
    eficiencia_calidad_pct:
      evaluarEficiencia
        ? Number(
          eficienciaCalidad.toFixed(2)
        )
        : null
  };
};

export const calcularTiemposSesion = ({
  inicio,
  fin,
  tiempoParoSeg = 0,
  tiempoParoDescontableSeg = tiempoParoSeg
}) => {
  const inicioMs = typeof inicio?.toMillis ===
    "function"
    ? inicio.toMillis()
    : new Date(inicio).getTime();
  const finMs = typeof fin?.toMillis === "function"
    ? fin.toMillis()
    : new Date(fin).getTime();
  const tiempoTotalSeg = Math.max(
    1,
    Math.round((finMs - inicioMs) / 1000)
  );
  const paroTotal = Math.max(
    0,
    Number(tiempoParoSeg || 0)
  );
  const paroDescontable = Math.max(
    0,
    Number(tiempoParoDescontableSeg || 0)
  );

  return {
    tiempo_total_seg: tiempoTotalSeg,
    tiempo_paro_seg: paroTotal,
    tiempo_paro_descontable_seg:
      paroDescontable,
    tiempo_productivo_seg: Math.max(
      1,
      tiempoTotalSeg - paroDescontable
    )
  };
};

export const validarDatosCalidadReporte = ({
  cantidadDefectuosa = 0,
  cantidadReproceso = 0,
  defecto,
  causa
}) => {
  const tieneNoConformidad =
    Number(cantidadDefectuosa || 0) > 0 ||
    Number(cantidadReproceso || 0) > 0;
  const errores = [];

  if (tieneNoConformidad && !defecto) {
    errores.push(
      "Selecciona el defecto detectado."
    );
  }

  if (tieneNoConformidad && !causa) {
    errores.push(
      "Selecciona la causa probable."
    );
  }

  return errores;
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
  const estados = ["activa", "pausada"];
  const snapshots = await Promise.all(
    estados.map(estado =>
      getDocs(
        query(
          collection(
            db,
            "sesiones_produccion"
          ),
          where(
            "empresa_id",
            "==",
            empresaId
          ),
          where("planta_id", "==", plantaId),
          where("estado", "==", estado)
        )
      )
    )
  );

  return snapshots.flatMap(snapshot =>
    snapshot.docs.map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
  );
};

export const iniciarSesionProduccion = async ({
  db,
  perfil,
  orden,
  operacion,
  operarioCodigo,
  operarioNombre,
  programacion = null
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
  const programacionRef = programacion?.id
    ? doc(
      db,
      "programacion_turnos",
      programacion.id
    )
    : null;
  let codigo = limpiarTexto(
    operarioCodigo
  ).toUpperCase();
  let nombre = limpiarTexto(operarioNombre);
  let datosTurno =
    datosTurnoParaSesion(programacion);
  let estandarCongelado = Number(
    operacion.unidades_por_hora || 0
  );
  const ocupacionRef = doc(
    db,
    "ocupacion_operarios",
    idOcupacionOperario({
      empresaId: perfil.empresa_id,
      plantaId: orden.planta_id,
      operarioCodigo:
        programacion?.operario_codigo ||
        operarioCodigo ||
        slug(operarioNombre)
    })
  );

  await runTransaction(db, async transaccion => {
    const operacionSnap =
      await transaccion.get(operacionRef);
    const ocupacionSnap =
      await transaccion.get(ocupacionRef);
    const programacionSnap = programacionRef
      ? await transaccion.get(programacionRef)
      : null;

    if (!operacionSnap.exists()) {
      throw new Error(
        "La operación ya no existe."
      );
    }

    if (
      ocupacionSnap.exists() &&
      ocupacionSnap.data().activa === true
    ) {
      throw new Error(
        `El operario ya está ocupado en ${ocupacionSnap.data().ot_codigo || "otra producción"}.`
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

    if (
      programacionRef &&
      (
        !programacionSnap.exists() ||
        programacionSnap.data().empresa_id !==
          perfil.empresa_id ||
        programacionSnap.data().planta_id !==
          orden.planta_id
      )
    ) {
      throw new Error(
        "La programación del operario ya no es válida para esta planta."
      );
    }

    if (programacionSnap?.exists()) {
      const programacionVigente = {
        id: programacionSnap.id,
        ...programacionSnap.data()
      };

      codigo = limpiarTexto(
        programacionVigente.operario_codigo
      ).toUpperCase();
      nombre = limpiarTexto(
        programacionVigente.operario_nombre
      );
      datosTurno = datosTurnoParaSesion(
        programacionVigente
      );
      const subprocesoOperacion =
        normalizarSubprocesosHabilitados([
          operacionSnap.data().subproceso_id
        ])[0];

      if (
        !normalizarSubprocesosHabilitados(
          programacionVigente
            .subprocesos_habilitados
        ).includes(subprocesoOperacion)
      ) {
        throw new Error(
          `El operario no está habilitado para ${subprocesoOperacion}.`
        );
      }
    }

    estandarCongelado = Number(
      operacionSnap.data()
        .unidades_por_hora || 0
    );

    transaccion.set(sesionRef, {
      empresa_id: perfil.empresa_id,
      planta_id: orden.planta_id,
      ...datosTurno,
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
      tiempo_paro_descontable_seg: 0,
      paro_inicio: null,
      motivo_paro_id: "",
      motivo_paro_codigo: "",
      motivo_paro_nombre: "",
      paro_afecta_eficiencia: true,
      estandar_unidades_hora:
        estandarCongelado,
      estandar_estado:
        estandarCongelado > 0
          ? "vigente"
          : "en_medicion",
      ruta_version: orden.ruta_version,
      fecha_operativa: fechaOperativa(),
      modelo_version: 2
    });
    transaccion.set(ocupacionRef, {
      empresa_id: perfil.empresa_id,
      planta_id: orden.planta_id,
      operario_id: codigo || slug(nombre),
      operario_codigo: codigo,
      operario_nombre: nombre,
      sesion_id: sesionRef.id,
      ot_id: orden.id,
      ot_codigo: orden.codigo,
      operacion_codigo:
        operacion.operacion_codigo,
      activa: true,
      actualizado_por_id: perfil.uid,
      actualizado_en: serverTimestamp(),
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
    ...datosTurno,
    estado: "activa",
    estandar_unidades_hora:
      estandarCongelado,
    estandar_estado:
      estandarCongelado > 0
        ? "vigente"
        : "en_medicion"
  };
};

export const actualizarEstandarOperacionOT =
  async ({
    db,
    perfil,
    orden,
    operacion,
    unidadesPorHora,
    motivo
  }) => {
    const nuevoEstandar = Number(
      unidadesPorHora
    );
    const motivoLimpio = limpiarTexto(motivo);

    if (
      !Number.isFinite(nuevoEstandar) ||
      nuevoEstandar <= 0
    ) {
      throw new Error(
        "El estándar debe ser mayor que cero."
      );
    }

    if (motivoLimpio.length < 10) {
      throw new Error(
        "Indica un motivo de al menos 10 caracteres."
      );
    }

    const operacionRef = doc(
      db,
      "ordenes_trabajo",
      orden.id,
      "operaciones",
      operacion.id
    );
    const eventoRef = doc(
      collection(db, "eventos_produccion")
    );
    let anterior = 0;

    await runTransaction(db, async transaccion => {
      const snapshot =
        await transaccion.get(operacionRef);

      if (!snapshot.exists()) {
        throw new Error(
          "La operación ya no existe."
        );
      }

      anterior = Number(
        snapshot.data().unidades_por_hora || 0
      );

      if (anterior === nuevoEstandar) {
        throw new Error(
          "El nuevo estándar debe ser diferente al vigente."
        );
      }

      transaccion.update(operacionRef, {
        unidades_por_hora: nuevoEstandar,
        estandar_estado: "vigente",
        estandar_anterior: anterior,
        estandar_motivo: motivoLimpio,
        estandar_actualizado_por: perfil.uid,
        estandar_actualizado_en:
          serverTimestamp(),
        fecha_actualizacion:
          serverTimestamp()
      });
      transaccion.set(eventoRef, {
        sesion_id: "",
        empresa_id: perfil.empresa_id,
        planta_id: orden.planta_id,
        ot_id: orden.id,
        ot_operacion_id: operacion.id,
        operario_id: "",
        tipo: "cambio_estandar",
        estandar_anterior: anterior,
        estandar_nuevo: nuevoEstandar,
        observacion: motivoLimpio,
        timestamp: serverTimestamp(),
        registrado_por_id: perfil.uid,
        modelo_version: 2
      });
    });

    return {
      estandar_anterior: anterior,
      estandar_nuevo: nuevoEstandar
    };
  };

export const pausarSesionProduccion = async ({
  db,
  perfil,
  sesion,
  motivo,
  observacion
}) => {
  if (!sesion || sesion.estado !== "activa") {
    throw new Error(
      "Selecciona una sesión activa."
    );
  }

  if (!motivo) {
    throw new Error(
      "Selecciona un motivo de paro."
    );
  }

  const sesionRef = doc(
    db,
    "sesiones_produccion",
    sesion.id
  );
  const eventoRef = doc(
    collection(db, "eventos_produccion")
  );

  await runTransaction(db, async transaccion => {
    const sesionSnap =
      await transaccion.get(sesionRef);

    if (
      !sesionSnap.exists() ||
      sesionSnap.data().estado !== "activa"
    ) {
      throw new Error(
        "La sesión ya no está activa."
      );
    }

    const inicioParo = Timestamp.now();

    transaccion.update(sesionRef, {
      estado: "pausada",
      paro_inicio: inicioParo,
      motivo_paro_id: motivo.id,
      motivo_paro_codigo: motivo.codigo,
      motivo_paro_nombre: motivo.nombre,
      paro_afecta_eficiencia:
        motivo.afecta_eficiencia !== false
    });
    transaccion.set(eventoRef, {
      sesion_id: sesion.id,
      empresa_id: perfil.empresa_id,
      planta_id: sesion.planta_id,
      ot_id: sesion.ot_id,
      ot_operacion_id:
        sesion.ot_operacion_id,
      operario_id: sesion.operario_id,
      tipo: "pausa",
      motivo_id: motivo.id,
      motivo_codigo: motivo.codigo,
      motivo_nombre: motivo.nombre,
      motivo_categoria: motivo.categoria,
      afecta_eficiencia:
        motivo.afecta_eficiencia !== false,
      cantidad_ok: 0,
      cantidad_defectuosa: 0,
      cantidad_reproceso: 0,
      observacion:
        limpiarTexto(observacion),
      timestamp: inicioParo,
      registrado_por_id: perfil.uid,
      modelo_version: 2
    });
  });
};

export const reanudarSesionProduccion =
  async ({
    db,
    perfil,
    sesion,
    observacion
  }) => {
    if (!sesion || sesion.estado !== "pausada") {
      throw new Error(
        "Selecciona una sesión pausada."
      );
    }

    const sesionRef = doc(
      db,
      "sesiones_produccion",
      sesion.id
    );
    const eventoRef = doc(
      collection(db, "eventos_produccion")
    );

    await runTransaction(db, async transaccion => {
      const sesionSnap =
        await transaccion.get(sesionRef);

      if (
        !sesionSnap.exists() ||
        sesionSnap.data().estado !== "pausada"
      ) {
        throw new Error(
          "La sesión ya no está pausada."
        );
      }

      const datos = sesionSnap.data();
      const finParo = Timestamp.now();
      const inicioParo = datos.paro_inicio;

      if (!inicioParo) {
        throw new Error(
          "La pausa no tiene hora de inicio."
        );
      }

      const duracionSeg = Math.max(
        1,
        Math.round(
          (
            finParo.toMillis() -
            inicioParo.toMillis()
          ) / 1000
        )
      );
      const tiempoParoTotal = Number(
        datos.tiempo_paro_seg || 0
      ) + duracionSeg;
      const tiempoParoDescontable = Number(
        datos.tiempo_paro_descontable_seg ??
        datos.tiempo_paro_seg ??
        0
      ) + (
        datos.paro_afecta_eficiencia ===
          false
          ? 0
          : duracionSeg
      );

      transaccion.update(sesionRef, {
        estado: "activa",
        tiempo_paro_seg: tiempoParoTotal,
        tiempo_paro_descontable_seg:
          tiempoParoDescontable,
        paro_inicio: null,
        motivo_paro_id: "",
        motivo_paro_codigo: "",
        motivo_paro_nombre: "",
        paro_afecta_eficiencia: true
      });
      transaccion.set(eventoRef, {
        sesion_id: sesion.id,
        empresa_id: perfil.empresa_id,
        planta_id: sesion.planta_id,
        ot_id: sesion.ot_id,
        ot_operacion_id:
          sesion.ot_operacion_id,
        operario_id: sesion.operario_id,
        tipo: "reanudacion",
        motivo_id: datos.motivo_paro_id || "",
        motivo_codigo:
          datos.motivo_paro_codigo || "",
        motivo_nombre:
          datos.motivo_paro_nombre || "",
        duracion_paro_seg: duracionSeg,
        cantidad_ok: 0,
        cantidad_defectuosa: 0,
        cantidad_reproceso: 0,
        observacion:
          limpiarTexto(observacion),
        timestamp: finParo,
        registrado_por_id: perfil.uid,
        modelo_version: 2
      });
    });
  };

export const registrarReporteProduccion =
  async ({
    db,
    perfil,
    sesion,
    cantidadOk,
    cantidadDefectuosa,
    cantidadReproceso,
    defecto,
    causa,
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

    const erroresCalidad =
      validarDatosCalidadReporte({
        cantidadDefectuosa: valores[1],
        cantidadReproceso: valores[2],
        defecto,
        causa
      });

    if (erroresCalidad.length > 0) {
      throw new Error(
        erroresCalidad.join(" ")
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
    const calidadRef =
      valores[1] > 0 || valores[2] > 0
        ? doc(
          collection(db, "registros_calidad")
        )
        : null;
    const fecha = fechaOperativa();
    const resumenRefs =
      referenciasResumenReporte(db, {
        plantaId: sesion.planta_id,
        fecha,
        operarioId: sesion.operario_id,
        otId: sesion.ot_id,
        otOperacionId:
          sesion.ot_operacion_id
      });
    const resumenEstandarRef = doc(
      db,
      "resumenes_estandar_operacion",
      `${sesion.ot_id}__${sesion.ot_operacion_id}`
    );
    const ocupacionRef = doc(
      db,
      "ocupacion_operarios",
      idOcupacionOperario({
        empresaId: perfil.empresa_id,
        plantaId: sesion.planta_id,
        operarioCodigo:
          sesion.operario_codigo ||
          sesion.operario_id
      })
    );
    let resultadoReporte;

    await runTransaction(
      db,
      async transaccion => {
        const sesionSnap =
          await transaccion.get(sesionRef);
        const otSnap =
          await transaccion.get(otRef);

        if (!sesionSnap.exists()) {
          throw new Error(
            "La sesión ya no existe."
          );
        }

        if (!otSnap.exists()) {
          throw new Error(
            "La OT ya no existe."
          );
        }

        if (
          sesionSnap.data().estado !== "activa"
        ) {
          throw new Error(
            sesionSnap.data().estado === "pausada"
              ? "Reanuda la sesión antes de finalizar."
              : "La sesión ya fue finalizada."
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
        const resumenSnapshots = {};

        for (
          const [tipo, referencia] of
          Object.entries(resumenRefs)
        ) {
          resumenSnapshots[tipo] =
            await transaccion.get(referencia);
        }
        const resumenEstandarSnap =
          await transaccion.get(
            resumenEstandarRef
          );

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
        actualizado.cantidad_merma =
          Number(
            objetivo.cantidad_merma ||
            objetivo.cantidad_defectuosa ||
            0
          ) + valores[1];
        actualizado.reproceso_pendiente =
          Number(
            objetivo.reproceso_pendiente || 0
          ) + valores[2];
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
              cantidad_merma:
                actualizado.cantidad_merma,
              reproceso_pendiente:
                actualizado.reproceso_pendiente,
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

        const proyeccion =
          calcularProyeccionOT(
            posteriores,
            Timestamp.now().toDate()
          );
        const operacionesCompletadas =
          posteriores.every(
          operacion =>
            Number(
              operacion.cantidad_pendiente
            ) <= 0
        );
        const reprocesosPendientes =
          Number(
            otSnap.data()
              .reprocesos_pendientes || 0
          ) + valores[2];
        const completada =
          operacionesCompletadas &&
          reprocesosPendientes === 0;
        const fin = Timestamp.now();
        const inicio =
          sesionSnap.data().inicio;
        const tiempos = calcularTiemposSesion({
          inicio,
          fin,
          tiempoParoSeg:
            sesionSnap.data().tiempo_paro_seg,
          tiempoParoDescontableSeg:
            sesionSnap.data()
              .tiempo_paro_descontable_seg ??
            sesionSnap.data().tiempo_paro_seg
        });
        const tiempoProductivoSeg =
          tiempos.tiempo_productivo_seg;
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
        const medicionEstandar =
          calcularMedicionEstandar({
            cantidadOk: valores[0],
            cantidadDefectuosa: valores[1],
            cantidadReproceso: valores[2],
            tiempoProductivoSeg,
            estandarAplicado:
              sesionSnap.data()
                .estandar_unidades_hora,
            fechaOperativa: fecha,
            sesionId: sesion.id
          });
        const resumenEstandar =
          actualizarResumenEstandar(
            resumenEstandarSnap.exists()
              ? resumenEstandarSnap.data()
              : {},
            medicionEstandar
          );
        const incrementoResumen = {
          cantidad_ok: valores[0],
          cantidad_defectuosa: valores[1],
          cantidad_reproceso: valores[2],
          produccion_esperada:
            indicadores.produccion_esperada,
          tiempo_productivo_seg:
            tiempoProductivoSeg
        };
        const resumenes = Object.fromEntries(
          Object.entries(
            resumenSnapshots
          ).map(([tipo, snapshot]) => [
            tipo,
            calcularResumenAcumulado(
              snapshot.exists()
                ? snapshot.data()
                : {},
              incrementoResumen
            )
          ])
        );
        const resumenOperarioRanking = {
          ...resumenes.operario,
          operario_id: sesion.operario_id,
          operario_codigo:
            sesion.operario_codigo || "",
          operario_nombre:
            sesion.operario_nombre
        };
        const rankingPlanta =
          actualizarRankingPlanta(
            resumenSnapshots.planta.exists()
              ? resumenSnapshots.planta.data()
                  .ranking_operarios || []
              : [],
            resumenOperarioRanking
          );

        transaccion.update(sesionRef, {
          estado: "finalizada",
          fin,
          tiempo_productivo_seg:
            tiempoProductivoSeg,
          tiempo_paro_seg:
            tiempos.tiempo_paro_seg,
          tiempo_paro_descontable_seg:
            tiempos
              .tiempo_paro_descontable_seg,
          tiempo_total_seg:
            tiempos.tiempo_total_seg,
          cantidad_ok: valores[0],
          cantidad_defectuosa: valores[1],
          cantidad_reproceso: valores[2],
          ...indicadores
        });
        transaccion.set(
          ocupacionRef,
          {
            empresa_id: perfil.empresa_id,
            planta_id: sesion.planta_id,
            operario_id: sesion.operario_id,
            operario_codigo:
              sesion.operario_codigo || "",
            operario_nombre:
              sesion.operario_nombre,
            sesion_id: sesion.id,
            ot_id: sesion.ot_id,
            ot_codigo: sesion.ot_codigo,
            operacion_codigo:
              sesion.operacion_codigo,
            activa: false,
            actualizado_por_id: perfil.uid,
            actualizado_en: serverTimestamp(),
            modelo_version: 2
          },
          { merge: true }
        );
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
          defecto_id: defecto?.id || "",
          defecto_codigo:
            defecto?.codigo || "",
          defecto_nombre:
            defecto?.nombre || "",
          defecto_severidad:
            defecto?.severidad || "",
          causa_id: causa?.id || "",
          causa_codigo: causa?.codigo || "",
          causa_nombre: causa?.nombre || "",
          observacion:
            limpiarTexto(observacion),
          fecha_operativa: fecha,
          tiempo_productivo_seg:
            tiempoProductivoSeg,
          ...indicadores,
          timestamp: serverTimestamp(),
          registrado_por_id: perfil.uid,
          modelo_version: 2
        });
        if (calidadRef) {
          transaccion.set(calidadRef, {
            empresa_id: perfil.empresa_id,
            planta_id: sesion.planta_id,
            sesion_id: sesion.id,
            evento_id: eventoRef.id,
            ot_id: sesion.ot_id,
            ot_codigo: sesion.ot_codigo,
            ot_operacion_id:
              sesion.ot_operacion_id,
            operacion_codigo:
              sesion.operacion_codigo,
            operacion_nombre:
              sesion.operacion_nombre,
            operario_id: sesion.operario_id,
            operario_codigo:
              sesion.operario_codigo || "",
            operario_nombre:
              sesion.operario_nombre,
            cantidad_inspeccionada:
              valores[0] +
              valores[1] +
              valores[2],
            cantidad_ok: valores[0],
            cantidad_merma: valores[1],
            cantidad_defectuosa: valores[1],
            cantidad_reproceso: valores[2],
            cantidad_reproceso_pendiente:
              valores[2],
            estado_reproceso:
              valores[2] > 0
                ? "pendiente"
                : "no_aplica",
            defecto_id: defecto.id,
            defecto_codigo: defecto.codigo,
            defecto_nombre: defecto.nombre,
            defecto_severidad:
              defecto.severidad,
            causa_id: causa.id,
            causa_codigo: causa.codigo,
            causa_nombre: causa.nombre,
            observacion:
              limpiarTexto(observacion),
            registrado_por_id: perfil.uid,
            timestamp: serverTimestamp(),
            modelo_version: 2
          });
        }
        transaccion.update(otRef, {
          ...proyeccion,
          estado: completada
            ? "completada"
            : "en_produccion",
          fecha_real_fin: completada
            ? serverTimestamp()
            : null,
          estimado_horas_restantes:
            completada
              ? 0
              : proyeccion
                .estimado_horas_restantes,
          fecha_estimada_fin:
            completada
              ? serverTimestamp()
              : proyeccion.fecha_estimada_fin,
          merma_total:
            Number(
              otSnap.data().merma_total || 0
            ) + valores[1],
          reprocesos_pendientes:
            reprocesosPendientes,
          fecha_actualizacion: serverTimestamp()
        });
        if (indicadores.evaluar_eficiencia) {
          transaccion.set(
            resumenRefs.operario,
            {
              ...resumenes.operario,
              empresa_id: perfil.empresa_id,
              planta_id: sesion.planta_id,
              fecha,
              operario_id: sesion.operario_id,
              operario_codigo:
                sesion.operario_codigo || "",
              operario_nombre:
                sesion.operario_nombre,
              actualizado_por_id: perfil.uid,
              actualizado_en:
                serverTimestamp(),
              modelo_version: 2
            },
            { merge: true }
          );
          transaccion.set(
            resumenRefs.planta,
            {
              ...resumenes.planta,
              empresa_id: perfil.empresa_id,
              planta_id: sesion.planta_id,
              fecha,
              turno_id: "dia",
              ranking_operarios:
                rankingPlanta,
              actualizado_por_id: perfil.uid,
              actualizado_en:
                serverTimestamp(),
              modelo_version: 2
            },
            { merge: true }
          );
          transaccion.set(
            resumenRefs.ot,
            {
              ...resumenes.ot,
              empresa_id: perfil.empresa_id,
              planta_id: sesion.planta_id,
              ot_id: sesion.ot_id,
              ot_codigo: sesion.ot_codigo,
              actualizado_por_id: perfil.uid,
              actualizado_en:
                serverTimestamp(),
              modelo_version: 2
            },
            { merge: true }
          );
          transaccion.set(
            resumenRefs.operacion,
            {
              ...resumenes.operacion,
              empresa_id: perfil.empresa_id,
              planta_id: sesion.planta_id,
              ot_id: sesion.ot_id,
              ot_codigo: sesion.ot_codigo,
              ot_operacion_id:
                sesion.ot_operacion_id,
              operacion_codigo:
                sesion.operacion_codigo,
              operacion_nombre:
                sesion.operacion_nombre,
              actualizado_por_id: perfil.uid,
              actualizado_en:
                serverTimestamp(),
              modelo_version: 2
            },
            { merge: true }
          );
        }
        transaccion.set(
          resumenEstandarRef,
          {
            ...resumenEstandar,
            empresa_id: perfil.empresa_id,
            planta_id: sesion.planta_id,
            ot_id: sesion.ot_id,
            ot_codigo: sesion.ot_codigo,
            ot_operacion_id:
              sesion.ot_operacion_id,
            operacion_codigo:
              sesion.operacion_codigo,
            operacion_nombre:
              sesion.operacion_nombre,
            estandar_vigente: Number(
              objetivo.unidades_por_hora || 0
            ),
            actualizado_por_id: perfil.uid,
            actualizado_en: serverTimestamp(),
            modelo_version: 2
          },
          { merge: true }
        );

        resultadoReporte = {
          tiempo_productivo_seg:
            tiempoProductivoSeg,
          ...indicadores
        };
      }
    );

    return resultadoReporte;
  };
