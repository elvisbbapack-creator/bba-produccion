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
