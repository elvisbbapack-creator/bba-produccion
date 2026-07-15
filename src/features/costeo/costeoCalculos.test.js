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
        porcentaje_costo_operativo: 100,
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

test("permite prorratear sobrante reutilizable sin cargar compra minima", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [10],
    materiales: [
      {
        consumo_unitario: 1,
        costo_unitario: 1000,
        minimo_compra: 50,
        politica_minimo_compra: "consumo_real"
      }
    ]
  });

  expect(resultado[0].costo_materiales).toBe(10000);
});

test("calcula precio con markup cuando no se quiere margen bruto", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [1],
    materiales: [
      {
        consumo_unitario: 1,
        costo_unitario: 100
      }
    ],
    indirectos_porcentaje: 0,
    margen_porcentaje: 35,
    tipo_margen: "markup",
    factor_riesgo_porcentaje: 0
  });

  expect(resultado[0].costo_unitario).toBe(100);
  expect(resultado[0].precio_unitario_sugerido).toBe(135);
});

test("calcula materiales con consumo unitario decimal", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [8],
    materiales: [
      {
        consumo_unitario: 0.125,
        costo_unitario: 24000,
        merma_porcentaje: 5,
        minimo_compra: 0
      }
    ],
    indirectos_porcentaje: 0,
    margen_porcentaje: 0,
    factor_riesgo_porcentaje: 0
  });

  expect(resultado[0].costo_materiales).toBe(25200);
  expect(resultado[0].costo_unitario).toBe(3150);
});

test("absorbe costos operativos fijos según porcentaje de estación", () => {
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
        proceso_nombre: "Corte",
        estacion_nombre: "Estación pequeña",
        unidades_por_hora: 20,
        eficiencia_esperada: 80,
        costo_hora: 5000,
        porcentaje_costo_operativo: 5,
        horas_setup: 1
      },
      {
        proceso_nombre: "Pintura",
        estacion_nombre: "Cabina grande",
        unidades_por_hora: 20,
        eficiencia_esperada: 80,
        costo_hora: 5000,
        porcentaje_costo_operativo: 20,
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
    costo_procesos: 72500,
    costo_operativo: 1812.5,
    costo_indirecto: 9631.25,
    costo_riesgo: 5297.19,
    costo_total: 111240.94
  });
  expect(resultado[0].detalle_procesos).toMatchObject([
    {
      estacion_nombre: "Estación pequeña",
      porcentaje_costo_operativo: 5,
      costo_operativo: 362.5
    },
    {
      estacion_nombre: "Cabina grande",
      porcentaje_costo_operativo: 20,
      costo_operativo: 1450
    }
  ]);
});
