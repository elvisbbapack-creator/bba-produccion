import {
  analizarExpresionConsumoMaterial,
  analizarFormulaProceso,
  calcularConsumoTintaUvCmykDesdePlancha,
  calcularCotizacionTecnica,
  prepararEscalas,
  TIPOS_LECTURA_CONSUMO
} from "./costeoCalculos";
import {
  esEstacionSoldaduraMig
} from "./costeoEstaciones";

test("normaliza escalas de cotizacion", () => {
  expect(
    prepararEscalas("100, 50, 50, abc, 10")
  ).toEqual([10, 50, 100]);
});

test("calcula consumo de tinta UV CMYK desde area de plancha PAI", () => {
  const consumo =
    calcularConsumoTintaUvCmykDesdePlancha({
      anchoPiezaMm: 729,
      altoPiezaMm: 567,
      piezasPorProducto: 2,
      unidadDestino: "ml"
    });

  expect(consumo).toMatchObject({
    area_m2_por_producto: 0.826686,
    consumo_tinta_ml_por_m2: 12,
    consumo_tinta_ml_total: 9.920232,
    consumo_unitario: 9.920232
  });
});

test("reconoce las tres estaciones de soldadura MIG para formula automatica", () => {
  [
    "Soldadora Mig 1",
    "Soldadora Mig 2",
    "Soldadora Mig 3",
    "Soladora Mig 2"
  ].forEach(estacion => {
    expect(
      esEstacionSoldaduraMig({
        proceso_nombre: "SMig",
        estacion_nombre: estacion
      })
    ).toBe(true);
  });

  expect(
    esEstacionSoldaduraMig({
      proceso_nombre: "Soldadura",
      estacion_nombre: "Soldadura Punto"
    })
  ).toBe(false);
});

test("calcula costo, precio y lead time por escala", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [100],
    materiales: [
      {
        consumo_unitario: 2,
        costo_unitario: 100,
        peso_kg_por_unidad: 0.5,
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
    peso_unitario_kg: 1,
    peso_unitario_requerido_kg: 1.1,
    peso_total_kg: 100,
    lead_time_dias: 6
  });
  expect(resultado[0]).toMatchObject({
    horas_produccion: 7.3,
    horas_cuello_botella: 7.3,
    horas_flujo: 7.3,
    lead_time_flujo_dias: 6,
    lead_time_conservador_dias: 6
  });
  expect(resultado[0].composicion_costos).toMatchObject({
    materiales: 22.89,
    mano_obra_procesos: 37.72,
    costos_fijos: 0,
    indirectos: 6.06,
    riesgo: 3.33,
    utilidad: 30
  });
  expect(resultado[0].detalle_materiales[0]).toMatchObject({
    consumo_requerido: 220,
    cantidad_comprada: 220,
    costo_material: 22000,
    peso_material_kg: 100,
    peso_requerido_kg: 110,
    porcentaje_costo: 100,
    porcentaje_precio: 22.89
  });
  expect(
    resultado[0].detalle_materiales_unitario[0]
  ).toMatchObject({
    consumo_requerido: 2.2,
    cantidad_comprada: 2.2,
    costo_material: 220,
    peso_material_kg: 1,
    peso_requerido_kg: 1.1,
    porcentaje_costo: 100,
    porcentaje_precio: 22.89
  });
  expect(
    resultado[0].precio_unitario_sugerido
  ).toBeGreaterThan(resultado[0].costo_unitario);
});

test("calcula precio Incoterm con logística FTL, seguro porcentual y gastos", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [100],
    materiales: [
      {
        consumo_unitario: 1,
        costo_unitario: 1000,
        merma_porcentaje: 0,
        minimo_compra: 0
      }
    ],
    procesos: [],
    indirectos_porcentaje: 0,
    margen_porcentaje: 20,
    factor_riesgo_porcentaje: 0,
    dias_compra: 1,
    dias_ingenieria: 1,
    horas_disponibles_dia: 14,
    exportacion: {
      incoterm: "CIP",
      destino: "Buenos Aires",
      pais_destino: "Argentina",
      modalidad_carga: "ftl",
      unidades_por_caja: 4,
      largo_caja_cm: 100,
      ancho_caja_cm: 50,
      alto_caja_cm: 50,
      factor_estiba: 1,
      capacidad_camion_m3: 90,
      capacidad_camion_kg: 25000,
      flete_internacional: 50000,
      seguro_porcentaje: 0,
      seguro_sobre_porcentaje: 110,
      gastos_exportacion: 15000,
      otros_costos_exportacion: 5000,
      dias_preparacion_exportacion: 2,
      dias_transito: 5
    }
  });

  expect(resultado[0]).toMatchObject({
    cantidad: 100,
    costo_total: 100000,
    costo_unitario: 1000,
    precio_unitario_sugerido: 1250,
    costo_exportacion: 70000,
    costo_exportacion_unitario: 700,
    costo_total_cip: 170000,
    costo_unitario_cip: 1700,
    precio_unitario_cip_sugerido: 2125,
    precio_total_cip_sugerido: 212500,
    lead_time_flujo_dias: 2,
    lead_time_cip_dias: 9
  });
  expect(resultado[0].logistica_exportacion).toMatchObject({
    cajas: 25,
    volumen_total_m3: 6.25,
    camiones_necesarios: 1,
    estado_carga: "FTL",
    flete_internacional: 50000,
    seguro_internacional: 0,
    gastos_exportacion: 15000,
    otros_costos_exportacion: 5000
  });
});

test("diluye la logística FTL por unidad al aumentar la escala", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [500, 1000],
    moneda: "USD",
    tipo_cambio_clp_usd: 1000,
    materiales: [
      {
        consumo_unitario: 1,
        costo_unitario: 10000,
        merma_porcentaje: 0,
        minimo_compra: 0
      }
    ],
    procesos: [],
    indirectos_porcentaje: 0,
    margen_porcentaje: 0,
    factor_riesgo_porcentaje: 0,
    exportacion: {
      incoterm: "CIP",
      modalidad_carga: "ftl",
      unidades_por_caja: 1,
      largo_caja_cm: 35,
      ancho_caja_cm: 65,
      alto_caja_cm: 35,
      capacidad_camion_m3: 90,
      capacidad_camion_kg: 25000,
      flete_internacional: 4300,
      seguro_porcentaje: 0.3,
      seguro_sobre_porcentaje: 110,
      gastos_exportacion: 14.43,
      otros_costos_exportacion: 0
    }
  });

  const escala500 = resultado.find(
    item => item.cantidad === 500
  );
  const escala1000 = resultado.find(
    item => item.cantidad === 1000
  );

  expect(
    escala500.costo_exportacion_unitario
  ).toBeGreaterThan(
    escala1000.costo_exportacion_unitario
  );
  expect(escala500.logistica_exportacion).toMatchObject({
    camiones_necesarios: 1,
    modalidad_calculada: "FTL"
  });
  expect(escala1000.logistica_exportacion).toMatchObject({
    camiones_necesarios: 1,
    modalidad_calculada: "FTL"
  });
});

test("convierte costos internos CLP a USD antes de sumar logística internacional", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [10],
    moneda: "USD",
    tipo_cambio_clp_usd: 1000,
    materiales: [
      {
        consumo_unitario: 1,
        costo_unitario: 1000,
        merma_porcentaje: 0,
        minimo_compra: 0
      }
    ],
    procesos: [
      {
        unidades_por_hora: 10,
        eficiencia_esperada: 100,
        costo_hora: 1000
      }
    ],
    indirectos_porcentaje: 0,
    margen_porcentaje: 0,
    factor_riesgo_porcentaje: 0,
    exportacion: {
      incoterm: "CIP",
      modalidad_carga: "ftl",
      unidades_por_caja: 10,
      largo_caja_cm: 10,
      ancho_caja_cm: 10,
      alto_caja_cm: 10,
      flete_internacional: 100,
      seguro_porcentaje: 0,
      gastos_exportacion: 10
    }
  });

  expect(resultado[0]).toMatchObject({
    costo_materiales: 10,
    costo_procesos: 1,
    costo_total: 11,
    precio_total_sugerido: 11,
    costo_exportacion: 110,
    costo_total_cip: 121,
    precio_total_cip_sugerido: 121
  });
  expect(resultado[0].detalle_materiales[0]).toMatchObject({
    costo_material: 10,
    costo_unitario: 1
  });
  expect(resultado[0].detalle_procesos[0]).toMatchObject({
    costo_proceso: 1
  });
});

test("mantiene EXW sin costo logístico de exportación", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [10],
    materiales: [
      {
        consumo_unitario: 1,
        costo_unitario: 1000
      }
    ],
    margen_porcentaje: 0,
    indirectos_porcentaje: 0,
    factor_riesgo_porcentaje: 0,
    exportacion: {
      incoterm: "EXW",
      modalidad_carga: "ftl",
      flete_internacional: 50000,
      gastos_exportacion: 15000,
      seguro_porcentaje: 0.3
    }
  });

  expect(resultado[0]).toMatchObject({
    costo_exportacion: 0,
    costo_exportacion_unitario: 0,
    precio_unitario_cip_sugerido: 1000
  });
  expect(resultado[0].logistica_exportacion).toMatchObject({
    estado_carga: "EXW",
    flete_internacional: 0,
    seguro_internacional: 0
  });
});

test("estima lead time de flujo por cuello de botella y conserva suma total", () => {
  const resultado = calcularCotizacionTecnica({
    escalas: [100],
    procesos: [
      {
        unidades_por_hora: 20,
        eficiencia_esperada: 100
      },
      {
        unidades_por_hora: 10,
        eficiencia_esperada: 100
      },
      {
        unidades_por_hora: 25,
        eficiencia_esperada: 100
      }
    ],
    dias_compra: 0,
    dias_ingenieria: 0,
    horas_disponibles_dia: 8,
    desfase_flujo_horas: 2
  });

  expect(resultado[0]).toMatchObject({
    horas_produccion: 19,
    horas_cuello_botella: 10,
    horas_desfase_flujo: 4,
    horas_flujo: 14,
    lead_time_flujo_dias: 2,
    lead_time_conservador_dias: 3,
    lead_time_dias: 2
  });
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

test("interpreta MP Alambre con cortes y bandejas por exhibidor", () => {
  const resultado = analizarExpresionConsumoMaterial({
    expresion: "((55+355+55)*7)*4",
    unidadExpresion: "mm",
    unidadMaterial: "m",
    tipoLectura:
      TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO
  });

  expect(resultado).toMatchObject({
    valido: true,
    consumo_unitario: 13.02,
    piezas: 28,
    cortes: 28,
    cortes_por_subproducto: 7,
    subproductos: 4,
    consumo_pieza_formula: 465,
    consumo_total_formula: 13020,
    cortes_por_pieza: 1,
    cortes_por_producto: 28,
    dobleces_por_pieza: 2,
    dobleces_por_producto: 56,
    dobleces_total: 56,
    longitud_por_pieza: 465
  });
});

test("calcula tiempo de Doblez CNC 3D desde formula de alambre con cortes y bandejas", () => {
  const resultado = analizarFormulaProceso({
    tipoFormula: "doblez_cnc_3d",
    expresion: "((55+355+55)*7)*4",
    unidadExpresion: "mm",
    segundosPorMetro: 5,
    segundosPorDoblez: 3,
    segundosPorCorte: 1.5
  });

  expect(resultado).toMatchObject({
    valido: true,
    metros_totales: 13.02,
    piezas: 28,
    cortes: 28,
    cortes_por_subproducto: 7,
    subproductos: 4,
    dobleces_por_pieza: 2,
    dobleces_total: 56
  });
  expect(resultado.segundos_por_producto).toBe(275.1);
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
      costo_operativo: 362.5,
      porcentaje_costo: 50,
      porcentaje_precio: 22.81
    },
    {
      estacion_nombre: "Cabina grande",
      porcentaje_costo_operativo: 20,
      costo_operativo: 1450,
      porcentaje_costo: 50,
      porcentaje_precio: 22.81
    }
  ]);
});
