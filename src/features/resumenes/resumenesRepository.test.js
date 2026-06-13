import {
  actualizarResumenEstandar,
  actualizarRankingPlanta,
  calcularMedicionEstandar,
  calcularResumenAcumulado,
  idsResumenReporte
} from "./resumenesRepository";

test("sugiere estándar con mediciones válidas de calidad", () => {
  const primera = calcularMedicionEstandar({
    cantidadOk: 100,
    cantidadDefectuosa: 4,
    tiempoProductivoSeg: 3600,
    estandarAplicado: 0,
    sesionId: "s1"
  });
  const segunda = calcularMedicionEstandar({
    cantidadOk: 120,
    cantidadDefectuosa: 2,
    tiempoProductivoSeg: 3600,
    estandarAplicado: 100,
    sesionId: "s2"
  });
  const resumen = actualizarResumenEstandar(
    actualizarResumenEstandar({}, primera),
    segunda
  );

  expect(primera.valida_para_sugerencia)
    .toBe(true);
  expect(resumen).toMatchObject({
    sesiones_medidas: 2,
    mediciones_validas: 2,
    estandar_sugerido: 110,
    confianza: "media"
  });
});

test("excluye mediciones cortas o con baja calidad", () => {
  const medicion = calcularMedicionEstandar({
    cantidadOk: 60,
    cantidadDefectuosa: 40,
    tiempoProductivoSeg: 1800
  });
  const resumen =
    actualizarResumenEstandar({}, medicion);

  expect(medicion.valida_para_sugerencia)
    .toBe(false);
  expect(resumen.estandar_sugerido).toBe(0);
  expect(resumen.confianza)
    .toBe("insuficiente");
});

test("acumula totales y recalcula indicadores ponderados", () => {
  expect(
    calcularResumenAcumulado(
      {
        sesiones: 1,
        cantidad_ok: 80,
        cantidad_defectuosa: 20,
        cantidad_reproceso: 0,
        produccion_esperada: 100,
        tiempo_productivo_seg: 3600
      },
      {
        cantidad_ok: 50,
        cantidad_defectuosa: 0,
        cantidad_reproceso: 0,
        produccion_esperada: 50,
        tiempo_productivo_seg: 1800
      }
    )
  ).toEqual({
    sesiones: 2,
    tiempo_productivo_seg: 5400,
    cantidad_ok: 130,
    cantidad_defectuosa: 20,
    cantidad_reproceso: 0,
    produccion_total: 150,
    produccion_esperada: 150,
    rendimiento_pct: 100,
    calidad_pct: 86.67,
    eficiencia_calidad_pct: 86.67
  });
});

test("actualiza solo el operario reportado en el ranking", () => {
  expect(
    actualizarRankingPlanta(
      [{
        operario_id: "OP0001",
        operario_nombre: "Ana",
        eficiencia_calidad_pct: 80
      }],
      {
        operario_id: "OP0002",
        operario_codigo: "OP0002",
        operario_nombre: "Luis",
        sesiones: 1,
        cantidad_ok: 100,
        calidad_pct: 100,
        rendimiento_pct: 95,
        eficiencia_calidad_pct: 95
      }
    ).map(item => item.operario_id)
  ).toEqual(["OP0002", "OP0001"]);
});

test("genera ids estables para los cuatro resumenes", () => {
  expect(
    idsResumenReporte({
      plantaId: "chile",
      fecha: "2026-06-13",
      operarioId: "OP0001",
      otId: "ot-1",
      otOperacionId: "DT0001"
    })
  ).toEqual({
    operario:
      "chile__2026-06-13__OP0001",
    planta: "chile__2026-06-13__dia",
    ot: "ot-1",
    operacion: "ot-1__DT0001"
  });
});
