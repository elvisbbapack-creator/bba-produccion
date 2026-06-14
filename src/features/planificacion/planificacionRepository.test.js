import {
  construirPlanPrioridades
} from "./planificacionRepository";

test("agrupa OTs por subproceso y prioriza riesgo y entrega", () => {
  const plan = construirPlanPrioridades(
    [
      {
        id: "ot-1",
        codigo: "OT-CHI-000001",
        correlativo: 1,
        fecha_planificada_entrega:
          "2026-06-20T18:00:00Z",
        fecha_estimada_fin:
          "2026-06-19T18:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0003",
          operacion_codigo: "DT0005",
          cantidad_pendiente: 300,
          horas_restantes: 3,
          estado: "disponible"
        }
      },
      {
        id: "ot-2",
        codigo: "OT-CHI-000002",
        correlativo: 2,
        fecha_planificada_entrega:
          "2026-06-16T18:00:00Z",
        fecha_estimada_fin:
          "2026-06-18T18:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0003",
          operacion_codigo: "DT0010",
          cantidad_pendiente: 500,
          horas_restantes: 5,
          estado: "en_proceso"
        }
      }
    ],
    new Date("2026-06-15T12:00:00Z")
  );

  expect(plan).toHaveLength(1);
  expect(plan[0]).toMatchObject({
    subproceso_id: "SP0003",
    ots_compitiendo: 2,
    cantidad_total_pendiente: 800,
    horas_carga_compartida: 8,
    conflicto_capacidad: true
  });
  expect(
    plan[0].secuencia.map(orden => orden.id)
  ).toEqual(["ot-2", "ot-1"]);
});

test("prioriza un DT disponible antes que uno bloqueado", () => {
  const plan = construirPlanPrioridades(
    [
      {
        id: "bloqueada",
        correlativo: 2,
        fecha_planificada_entrega:
          "2026-06-15T08:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0001",
          cantidad_pendiente: 100,
          estado: "bloqueada"
        }
      },
      {
        id: "disponible",
        correlativo: 1,
        fecha_planificada_entrega:
          "2026-06-20T08:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0001",
          cantidad_pendiente: 100,
          estado: "disponible"
        }
      }
    ],
    new Date("2026-06-16T08:00:00Z")
  );

  expect(plan[0].siguiente_ot.id)
    .toBe("disponible");
  expect(
    plan[0].secuencia[1].accion_recomendada
  ).toBe("desbloquear_dt");
});

test("excluye OTs sin resumen de cuello pendiente", () => {
  expect(
    construirPlanPrioridades([
      {
        id: "sin-cuello",
        cantidad_total_pendiente: 100
      }
    ])
  ).toEqual([]);
});
