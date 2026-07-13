import {
  calcularCostoBaseEstacion,
  prepararCostoBaseEstacion,
  validarCostoBaseEstacion
} from "./costosBaseRepository";

test("calcula costo hora total de una estacion", () => {
  expect(
    calcularCostoBaseEstacion({
      cantidad_maquinistas: 1,
      costo_hora_maquinista: 6000,
      cantidad_ayudantes: 1,
      costo_hora_ayudante: 4000,
      valor_equipo: 10000000,
      valor_residual: 1000000,
      vida_util_horas: 9000,
      kw_hora: 12,
      costo_kwh: 150,
      factor_uso_porcentaje: 70,
      mantencion_hora: 500
    })
  ).toMatchObject({
    costo_laboral_principal: 6000,
    costo_ayudantes: 4000,
    depreciacion_hora: 1000,
    energia_hora: 1260,
    mantencion_hora: 500,
    costo_hora_total: 12760
  });
});

test("prepara costo base con empresa y planta", () => {
  const costo = prepararCostoBaseEstacion(
    {
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte",
      estacion_codigo: "ET0001",
      estacion_nombre: "Laser",
      costo_hora_maquinista: 5000
    },
    {
      empresa_id: "bba",
      planta_ids: ["chile"]
    },
    "id-1"
  );

  expect(costo).toMatchObject({
    id: "id-1",
    empresa_id: "bba",
    planta_id: "chile",
    proceso_codigo: "PR0001",
    estacion_codigo: "ET0001",
    cantidad_maquinistas: 1,
    costo_hora_total: 5000
  });
});

test("valida estacion y costo mayor a cero", () => {
  expect(
    validarCostoBaseEstacion({
      proceso_codigo: "",
      estacion_codigo: "",
      costo_hora_total: 0
    })
  ).toEqual([
    "Selecciona un proceso.",
    "Selecciona una estación.",
    "El costo hora total debe ser mayor a cero."
  ]);
});

