import {
  calcularCotizacionTecnica,
  prepararEscalas
} from "./costeoCalculos";

test("normaliza escalas de cotizacion", () => {
  expect(
    prepararEscalas("100, 50, 50, abc, 10")
  ).toEqual([10, 50, 100]);
});

test("calcula costo, precio y lead time por escala", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [100],
    materiales: [
      {
        consumo_unitario: 2,
        costo_unitario: 100,
        merma_porcentaje: 10,
        minimo_compra: 0
      }
    ],
    procesos: [
      {
        unidades_por_hora: 20,
        eficiencia_esperada: 80,
        costo_hora: 5000,
        horas_setup: 1
      }
    ],
    indirectos_porcentaje: 10,
    margen_porcentaje: 30,
    factor_riesgo_porcentaje: 5,
    dias_compra: 3,
    dias_ingenieria: 2,
    horas_disponibles_dia: 8
  });

  expect(resultado).toHaveLength(1);
  expect(resultado[0]).toMatchObject({
    cantidad: 100,
    costo_materiales: 22000,
    costo_procesos: 36250,
    costo_indirecto: 5825,
    costo_riesgo: 3203.75,
    costo_total: 67278.75,
    lead_time_dias: 6
  });
  expect(
    resultado[0].precio_unitario_sugerido
  ).toBeGreaterThan(resultado[0].costo_unitario);
});

test("respeta minimo de compra de material", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [10],
    materiales: [
      {
        consumo_unitario: 1,
        costo_unitario: 1000,
        minimo_compra: 50
      }
    ]
  });

  expect(resultado[0].costo_materiales).toBe(50000);
});

test("absorbe costos operativos fijos por hora productiva", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [100],
    materiales: [
      {
        consumo_unitario: 2,
        costo_unitario: 100,
        merma_porcentaje: 10
      }
    ],
    procesos: [
      {
        unidades_por_hora: 20,
        eficiencia_esperada: 80,
        costo_hora: 5000,
        horas_setup: 1
      }
    ],
    costo_operativo_hora: 1000,
    indirectos_porcentaje: 10,
    factor_riesgo_porcentaje: 5,
    margen_porcentaje: 30
  });

  expect(resultado[0]).toMatchObject({
    costo_materiales: 22000,
    costo_procesos: 36250,
    costo_operativo: 7250,
    costo_indirecto: 6550,
    costo_riesgo: 3602.5,
    costo_total: 75652.5
  });
});
