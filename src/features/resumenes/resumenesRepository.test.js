import {
  actualizarRankingPlanta,
  calcularResumenAcumulado,
  idsResumenReporte
} from "./resumenesRepository";

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
