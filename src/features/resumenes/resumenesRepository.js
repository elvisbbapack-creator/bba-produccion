import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

const numero = (valor) =>
  Number.isFinite(Number(valor))
    ? Number(valor)
    : 0;

export const calcularResumenAcumulado = (
  actual = {},
  incremento = {}
) => {
  const cantidadOk =
    numero(actual.cantidad_ok) +
    numero(incremento.cantidad_ok);
  const cantidadDefectuosa =
    numero(actual.cantidad_defectuosa) +
    numero(incremento.cantidad_defectuosa);
  const cantidadReproceso =
    numero(actual.cantidad_reproceso) +
    numero(incremento.cantidad_reproceso);
  const produccionTotal =
    cantidadOk +
    cantidadDefectuosa +
    cantidadReproceso;
  const produccionEsperada =
    numero(actual.produccion_esperada) +
    numero(incremento.produccion_esperada);
  const tiempoProductivoSeg =
    numero(actual.tiempo_productivo_seg) +
    numero(incremento.tiempo_productivo_seg);
  const rendimiento = produccionEsperada > 0
    ? (produccionTotal / produccionEsperada) *
      100
    : 0;
  const calidad = produccionTotal > 0
    ? (cantidadOk / produccionTotal) * 100
    : 0;

  return {
    sesiones:
      numero(actual.sesiones) + 1,
    tiempo_productivo_seg:
      tiempoProductivoSeg,
    cantidad_ok: cantidadOk,
    cantidad_defectuosa:
      cantidadDefectuosa,
    cantidad_reproceso: cantidadReproceso,
    produccion_total: produccionTotal,
    produccion_esperada: Number(
      produccionEsperada.toFixed(2)
    ),
    rendimiento_pct: Number(
      rendimiento.toFixed(2)
    ),
    calidad_pct: Number(
      calidad.toFixed(2)
    ),
    eficiencia_calidad_pct: Number(
      (
        (rendimiento * calidad) /
        100
      ).toFixed(2)
    )
  };
};

const mediana = valores => {
  const ordenados = [...valores].sort(
    (a, b) => a - b
  );
  const mitad = Math.floor(
    ordenados.length / 2
  );

  return ordenados.length % 2 === 0
    ? (
      ordenados[mitad - 1] +
      ordenados[mitad]
    ) / 2
    : ordenados[mitad];
};

export const calcularMedicionEstandar = ({
  cantidadOk = 0,
  cantidadDefectuosa = 0,
  cantidadReproceso = 0,
  tiempoProductivoSeg = 0,
  estandarAplicado = 0,
  fechaOperativa = "",
  sesionId = ""
}) => {
  const tiempo = numero(tiempoProductivoSeg);
  const ok = numero(cantidadOk);
  const total =
    ok +
    numero(cantidadDefectuosa) +
    numero(cantidadReproceso);
  const calidad = total > 0
    ? (ok / total) * 100
    : 0;
  const unidadesOkHora = tiempo > 0
    ? ok / (tiempo / 3600)
    : 0;

  return {
    sesion_id: sesionId,
    fecha_operativa: fechaOperativa,
    tiempo_productivo_seg: tiempo,
    cantidad_ok: ok,
    produccion_total: total,
    calidad_pct: Number(calidad.toFixed(2)),
    unidades_ok_hora: Number(
      unidadesOkHora.toFixed(2)
    ),
    estandar_aplicado:
      numero(estandarAplicado),
    valida_para_sugerencia:
      tiempo >= 2700 &&
      total > 0 &&
      calidad >= 95
  };
};

export const actualizarResumenEstandar = (
  actual = {},
  medicion
) => {
  const recientes = [
    ...(actual.mediciones_recientes || []),
    medicion
  ].slice(-12);
  const validas = recientes.filter(
    item => item.valida_para_sugerencia
  );
  const sugerido = validas.length > 0
    ? mediana(
      validas.map(item =>
        numero(item.unidades_ok_hora)
      )
    )
    : 0;

  return {
    sesiones_medidas:
      numero(actual.sesiones_medidas) + 1,
    mediciones_validas: validas.length,
    mediciones_recientes: recientes,
    estandar_sugerido: Number(
      sugerido.toFixed(2)
    ),
    confianza:
      validas.length >= 5
        ? "alta"
        : validas.length >= 2
          ? "media"
          : validas.length === 1
            ? "inicial"
            : "insuficiente"
  };
};

export const idsResumenReporte = ({
  plantaId,
  fecha,
  operarioId,
  otId,
  otOperacionId
}) => ({
  operario:
    `${plantaId}__${fecha}__${operarioId}`,
  planta: `${plantaId}__${fecha}__dia`,
  ot: otId,
  operacion: `${otId}__${otOperacionId}`
});

export const actualizarRankingPlanta = (
  rankingActual = [],
  resumenOperario = {}
) => {
  const ranking = rankingActual.filter(
    item =>
      item.operario_id !==
      resumenOperario.operario_id
  );

  ranking.push({
    operario_id: resumenOperario.operario_id,
    operario_codigo:
      resumenOperario.operario_codigo || "",
    operario_nombre:
      resumenOperario.operario_nombre,
    sesiones: resumenOperario.sesiones,
    cantidad_ok: resumenOperario.cantidad_ok,
    calidad_pct: resumenOperario.calidad_pct,
    rendimiento_pct:
      resumenOperario.rendimiento_pct,
    eficiencia_calidad_pct:
      resumenOperario
        .eficiencia_calidad_pct
  });

  return ranking.sort(
    (a, b) =>
      numero(b.eficiencia_calidad_pct) -
      numero(a.eficiencia_calidad_pct)
  );
};

export const referenciasResumenReporte = (
  db,
  datos
) => {
  const ids = idsResumenReporte(datos);

  return {
    operario: doc(
      db,
      "resumenes_operario_dia",
      ids.operario
    ),
    planta: doc(
      db,
      "resumenes_planta_turno",
      ids.planta
    ),
    ot: doc(
      db,
      "resumenes_ot",
      ids.ot
    ),
    operacion: doc(
      db,
      "resumenes_ot_operacion",
      ids.operacion
    )
  };
};

export const listarRankingDiario = async (
  db,
  empresaId,
  plantaId,
  fecha
) => {
  const snapshot = await getDocs(
    query(
      collection(
        db,
        "resumenes_operario_dia"
      ),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId),
      where("fecha", "==", fecha)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort(
      (a, b) =>
        numero(b.eficiencia_calidad_pct) -
        numero(a.eficiencia_calidad_pct)
    );
};

export const obtenerResumenPlanta = async (
  db,
  plantaId,
  fecha
) => {
  const referencia = doc(
    db,
    "resumenes_planta_turno",
    `${plantaId}__${fecha}__dia`
  );
  const snapshot = await getDoc(referencia);

  return snapshot.exists()
    ? {
        id: snapshot.id,
        ...snapshot.data()
      }
    : null;
};

export const obtenerResumenEstandar = async (
  db,
  otId,
  otOperacionId
) => {
  const referencia = doc(
    db,
    "resumenes_estandar_operacion",
    `${otId}__${otOperacionId}`
  );
  const snapshot = await getDoc(referencia);

  return snapshot.exists()
    ? {
        id: snapshot.id,
        ...snapshot.data()
      }
    : null;
};

export const observarResumenPlanta = (
  db,
  plantaId,
  fecha,
  alCambiar,
  alFallar
) => {
  const referencia = doc(
    db,
    "resumenes_planta_turno",
    `${plantaId}__${fecha}__dia`
  );

  return onSnapshot(
    referencia,
    snapshot => {
      alCambiar(
        snapshot.exists()
          ? {
              id: snapshot.id,
              ...snapshot.data()
            }
          : null
      );
    },
    alFallar
  );
};

const fechaAValor = valor => {
  if (!valor) {
    return null;
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

export const clasificarRiesgoOT = (
  orden,
  fechaReferencia = new Date()
) => {
  const entrega = fechaAValor(
    orden.fecha_planificada_entrega
  );
  const estimada = fechaAValor(
    orden.fecha_estimada_fin
  );
  const referencia = fechaAValor(fechaReferencia) ||
    new Date();
  let nivel = "sin_fecha";
  let prioridad = 2;

  if (
    entrega &&
    entrega.getTime() < referencia.getTime()
  ) {
    nivel = "atrasada";
    prioridad = 6;
  } else if (
    entrega &&
    estimada &&
    estimada.getTime() >
      entrega.getTime()
  ) {
    nivel = "en_riesgo";
    prioridad = 5;
  } else if (
    Number(
      orden?.cuello_carga?.cantidad_pendiente || 0
    ) > 0 &&
    orden?.cuello_carga?.pendiente_estandar
  ) {
    nivel = "sin_estandar";
    prioridad = 4;
  } else if (entrega && estimada) {
    nivel = "en_fecha";
    prioridad = 1;
  }

  return {
    ...orden,
    riesgo_entrega: nivel,
    prioridad_riesgo: prioridad,
    desviacion_horas:
      entrega && estimada
        ? Number(
          (
            (
              estimada.getTime() -
              entrega.getTime()
            ) /
            (60 * 60 * 1000)
          ).toFixed(2)
        )
        : null
  };
};

export const ordenarOrdenesActivas = (
  ordenes = [],
  fechaReferencia = new Date()
) => ordenes
  .map(orden =>
    clasificarRiesgoOT(orden, fechaReferencia)
  )
  .sort((a, b) =>
    b.prioridad_riesgo -
      a.prioridad_riesgo ||
    Number(b.correlativo || 0) -
      Number(a.correlativo || 0)
  );

export const resumirRiesgosDashboard = (
  ordenes = []
) => {
  const resumen = ordenes.reduce(
    (acumulado, orden) => {
      const riesgo =
        orden.riesgo_entrega || "sin_fecha";
      const pendiente = Number(
        orden.cuello_carga
          ?.cantidad_pendiente ??
        orden.cantidad_total_pendiente ??
        0
      );

      acumulado.total_ots += 1;
      acumulado.unidades_pendientes +=
        pendiente;
      acumulado.por_riesgo[riesgo] =
        (acumulado.por_riesgo[riesgo] || 0) +
        1;

      if (
        ["atrasada", "en_riesgo"].includes(
          riesgo
        )
      ) {
        acumulado.ots_criticas += 1;
      }

      if (
        orden.cuello_carga?.pendiente_estandar ||
        riesgo === "sin_estandar"
      ) {
        acumulado.sin_estandar += 1;
      }

      if (pendiente > 0) {
        acumulado.con_cuello_pendiente += 1;
      }

      return acumulado;
    },
    {
      total_ots: 0,
      ots_criticas: 0,
      sin_estandar: 0,
      con_cuello_pendiente: 0,
      unidades_pendientes: 0,
      por_riesgo: {
        atrasada: 0,
        en_riesgo: 0,
        sin_estandar: 0,
        sin_fecha: 0,
        en_fecha: 0
      }
    }
  );
  const estado_general =
    resumen.ots_criticas > 0
      ? "critico"
      : resumen.sin_estandar > 0
        ? "estandar_pendiente"
        : resumen.con_cuello_pendiente > 0
          ? "operativo"
          : "sin_riesgo";
  const recomendacion =
    estado_general === "critico"
      ? "Revisar primero OTs atrasadas o en riesgo y resolver el cuello principal."
      : estado_general === "estandar_pendiente"
        ? "Definir estándares pendientes para proyectar fin real y priorizar con confianza."
        : estado_general === "operativo"
          ? "Mantener foco en los cuellos pendientes y controlar avance por turno."
          : "No hay OTs activas con riesgo visible en el dashboard.";

  return {
    ...resumen,
    estado_general,
    recomendacion
  };
};

export const observarOrdenesActivas = (
  db,
  empresaId,
  plantaId,
  alCambiar,
  alFallar
) => {
  const consulta = query(
    collection(db, "ordenes_trabajo"),
    where("empresa_id", "==", empresaId),
    where("planta_id", "==", plantaId),
    where("modelo_version", "==", 2),
    where("estado", "in", [
      "liberada",
      "en_produccion",
      "pausada"
    ])
  );

  return onSnapshot(
    consulta,
    snapshot => {
      const ordenes = snapshot.docs.map(
        documento => ({
          id: documento.id,
          ...documento.data()
        })
      );

      alCambiar(ordenarOrdenesActivas(ordenes));
    },
    alFallar
  );
};
