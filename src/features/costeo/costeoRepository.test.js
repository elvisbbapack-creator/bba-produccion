import {
  prepararCotizacionTecnica
} from "./costeoRepository";
import {
  analizarExpresionConsumoMaterial,
  analizarFormulaProceso,
  TIPOS_LECTURA_CONSUMO
} from "./costeoCalculos";

describe("costeoRepository", () => {
  it("interpreta formula de consumo de tubo como cortes por subproducto", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion:
          "(131+360+131+389+131+360+131+389+330+330+359+359+71+71)*1",
        unidadExpresion: "mm",
        unidadMaterial: "m"
      });

    expect(resultado).toMatchObject({
      valido: true,
      consumo_unitario: 3.542,
      piezas: 14,
      cortes: 14,
      cortes_por_subproducto: 14,
      subproductos: 1,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 3542
    });
  });

  it("interpreta formula de PAI como fracción de materia prima por pieza", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "(1/96)*3",
        unidadExpresion: "un",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.FRACCION_MP
      });

    expect(resultado).toMatchObject({
      valido: true,
      consumo_unitario: 0.0313,
      piezas: 3,
      cortes: 0,
      cortes_por_subproducto: 0,
      subproductos: 3,
      fraccion_por_pieza: 0.010417,
      dobleces_por_pieza: 0,
      dobleces_total: 0
    });
  });

  it("panotea plancha LAF estándar Chile desde dimensiones de pieza", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion:
          "((61+607+61)(61+445+61))*1",
        unidadExpresion: "mm",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.PLANCHA_LAF
      });

    expect(resultado).toMatchObject({
      valido: true,
      ancho_pieza: 729,
      alto_pieza: 567,
      ancho_plancha: 1000,
      alto_plancha: 3000,
      piezas_por_plancha: 5,
      piezas_por_plancha_rotado: 0,
      fraccion_plancha: "1/5",
      fraccion_por_pieza: 0.2,
      consumo_unitario: 0.2,
      piezas_por_producto: 1
    });
  });

  it("panotea plancha LAF aceptando un lado como número directo", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "((61+607+61)(567))*1",
        unidadExpresion: "mm",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.PLANCHA_LAF
      });

    expect(resultado).toMatchObject({
      valido: true,
      ancho_pieza: 729,
      alto_pieza: 567,
      ancho_plancha: 1000,
      alto_plancha: 3000,
      piezas_por_plancha: 5,
      fraccion_plancha: "1/5",
      consumo_unitario: 0.2
    });
  });

  it("duplica consumo y costo de plancha LAF al duplicar piezas del producto", () => {
    const base = analizarExpresionConsumoMaterial({
      expresion: "((61+607+61)(61+445+61))*1",
      unidadExpresion: "mm",
      unidadMaterial: "unidad",
      tipoLectura:
        TIPOS_LECTURA_CONSUMO.PLANCHA_LAF
    });
    const doble = analizarExpresionConsumoMaterial({
      expresion: "((61+607+61)(61+445+61))*2",
      unidadExpresion: "mm",
      unidadMaterial: "unidad",
      tipoLectura:
        TIPOS_LECTURA_CONSUMO.PLANCHA_LAF
    });
    const costoPlancha = 10000;
    const cotizacion = prepararCotizacionTecnica(
      {
        nombre_producto: "Exhibidor con plancha LAF",
        escalas: "1",
        materiales: [
          {
            codigo: "MP-LAF-1",
            nombre: "Plancha LAF 1.5 mm",
            unidad: "unidad",
            expresion_consumo:
              "((61+607+61)(61+445+61))*2",
            piezas_por_plancha:
              doble.piezas_por_plancha,
            fraccion_por_pieza:
              doble.fraccion_por_pieza,
            piezas_por_producto:
              doble.piezas_por_producto,
            consumo_unitario:
              doble.consumo_unitario,
            costo_unitario: costoPlancha,
            minimo_compra: 1,
            politica_minimo_compra:
              "cobrar_minimo"
          }
        ],
        margen_porcentaje: 0,
        indirectos_porcentaje: 0,
        factor_riesgo_porcentaje: 0
      },
      {
        empresa_id: "bba",
        planta_ids: ["chile"]
      }
    );

    expect(base.consumo_unitario).toBe(0.2);
    expect(doble.consumo_unitario).toBe(0.4);
    expect(cotizacion.materiales[0]).toMatchObject({
      politica_minimo_compra: "consumo_real",
      consumo_unitario: 0.4
    });
    expect(
      cotizacion.resultados[0].costo_materiales
    ).toBe(4000);
  });

  it("panotea plancha 1220x2440 desde dimensiones de pieza", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "((61+607+61)(567))*1",
        unidadExpresion: "mm",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440
      });

    expect(resultado).toMatchObject({
      valido: true,
      ancho_pieza: 729,
      alto_pieza: 567,
      ancho_plancha: 1220,
      alto_plancha: 2440,
      piezas_por_plancha: 6,
      fraccion_plancha: "1/6",
      fraccion_por_pieza: 0.166667,
      consumo_unitario: 0.166667,
      piezas_por_producto: 1
    });
  });

  it("usa el mismo panoteo 1220x2440 para acrílico", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "((500)(600))*2",
        unidadExpresion: "mm",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440
      });

    expect(resultado).toMatchObject({
      valido: true,
      ancho_pieza: 500,
      alto_pieza: 600,
      ancho_plancha: 1220,
      alto_plancha: 2440,
      piezas_por_plancha: 8,
      fraccion_plancha: "1/8",
      fraccion_por_pieza: 0.125,
      consumo_unitario: 0.25,
      piezas_por_producto: 2
    });
  });

  it("usa el mismo panoteo 1220x2440 para coroplast", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "((61+607+61)(61+445+61))*1",
        unidadExpresion: "mm",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440
      });

    expect(resultado).toMatchObject({
      valido: true,
      ancho_pieza: 729,
      alto_pieza: 567,
      ancho_plancha: 1220,
      alto_plancha: 2440,
      piezas_por_plancha: 6,
      fraccion_plancha: "1/6",
      fraccion_por_pieza: 0.166667,
      consumo_unitario: 0.166667,
      piezas_por_producto: 1
    });
  });

  it("panotea MDF 1520x2440 desde dimensiones de pieza", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "((500)(600))*2",
        unidadExpresion: "mm",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.PLANCHA_1520X2440
      });

    expect(resultado).toMatchObject({
      valido: true,
      ancho_pieza: 500,
      alto_pieza: 600,
      ancho_plancha: 1520,
      alto_plancha: 2440,
      piezas_por_plancha: 12,
      fraccion_plancha: "1/12",
      fraccion_por_pieza: 0.083333,
      consumo_unitario: 0.166667,
      piezas_por_producto: 2
    });
  });

  it("panotea MDF ranurado MP0046 como plancha 1220x1220", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "((500)(600))*2",
        unidadExpresion: "mm",
        unidadMaterial: "unidad",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.PLANCHA_1220X1220
      });

    expect(resultado).toMatchObject({
      valido: true,
      ancho_pieza: 500,
      alto_pieza: 600,
      ancho_plancha: 1220,
      alto_plancha: 1220,
      piezas_por_plancha: 4,
      fraccion_plancha: "1/4",
      fraccion_por_pieza: 0.25,
      consumo_unitario: 0.5,
      piezas_por_producto: 2
    });
  });

  it("interpreta formula de alambre como pieza doblada", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "(12+117+360+117+12)*2",
        unidadExpresion: "mm",
        unidadMaterial: "m",
        tipoLectura:
          TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO
      });

    expect(resultado).toMatchObject({
      valido: true,
      consumo_unitario: 1.236,
      piezas: 2,
      dobleces_por_pieza: 4,
      cortes_por_pieza: 1,
      dobleces_por_producto: 8,
      cortes_por_producto: 2,
      dobleces_total: 8,
      cortes: 2,
      consumo_pieza_formula: 618,
      consumo_total_formula: 1236,
      longitud_por_pieza: 618
    });
  });

  it("calcula tiempo de Doblez CNC 3D desde formula de piezas", () => {
    const resultado = analizarFormulaProceso({
      tipoFormula: "doblez_cnc_3d",
      expresion: "(100+50+20)*4",
      unidadExpresion: "mm",
      segundosPorMetro: 5,
      segundosPorDoblez: 3,
      segundosPorCorte: 1.5
    });

    expect(resultado).toMatchObject({
      valido: true,
      segundos_por_producto: 33.4,
      unidades_por_hora: 107.78,
      metros_totales: 0.68,
      cortes: 4,
      dobleces_total: 8
    });
  });

  it("calcula tiempo de Corte CNC Recto desde formula de cortes", () => {
    const resultado = analizarFormulaProceso({
      tipoFormula: "corte_cnc_recto",
      expresion: "(30)*4",
      unidadExpresion: "mm",
      segundosPorMetro: 5,
      segundosPorCorte: 1.5
    });

    expect(resultado).toMatchObject({
      valido: true,
      segundos_por_producto: 6.6,
      unidades_por_hora: 545.45,
      metros_totales: 0.12,
      cortes: 4,
      dobleces_total: 0,
      longitud_por_pieza: 30
    });
  });

  it("calcula tiempo de Corte / Prensa reutilizando formula de MP tubo", () => {
    const resultado = analizarFormulaProceso({
      tipoFormula: "corte_prensa",
      expresion:
        "(131+360+131+389+131+360+131+389+330+330+359+359+71+71)*1",
      unidadExpresion: "mm",
      segundosPorMetro: 5,
      segundosPorCorte: 2
    });

    expect(resultado).toMatchObject({
      valido: true,
      segundos_por_producto: 28,
      unidades_por_hora: 128.57,
      metros_totales: 3.542,
      cortes: 14,
      golpes: 14,
      dobleces_total: 0,
      detalle_tiempo: {
        avance: 0,
        cortes: 28
      }
    });
  });

  it("calcula tiempo de Laser Fibra o CO2 por metros por minuto", () => {
    const resultado = analizarFormulaProceso({
      tipoFormula: "laser_metros_minuto",
      expresion: "(100+250+100)*4",
      unidadExpresion: "mm",
      metrosPorMinuto: 6,
      segundosPorCorte: 0.5
    });

    expect(resultado).toMatchObject({
      valido: true,
      segundos_por_producto: 24,
      unidades_por_hora: 150,
      metros_totales: 1.8,
      cortes: 12,
      dobleces_total: 0,
      detalle_tiempo: {
        avance: 18,
        cortes: 6
      }
    });
  });

  it("calcula Laser Fibra desde dimensiones de plancha LAF como perimetro", () => {
    const resultado = analizarFormulaProceso({
      tipoFormula: "laser_metros_minuto",
      expresion: "((450)(150))*2",
      unidadExpresion: "mm",
      metrosPorMinuto: 6,
      segundosPorCorte: 0.5
    });

    expect(resultado).toMatchObject({
      valido: true,
      segundos_por_producto: 28,
      unidades_por_hora: 128.57,
      metros_totales: 2.4,
      piezas: 2,
      cortes: 8,
      cortes_por_subproducto: 4,
      cortes_por_pieza: 4,
      cortes_por_producto: 8,
      consumo_pieza_formula: 1200,
      consumo_total_formula: 2400,
      longitud_por_pieza: 1200,
      detalle_tiempo: {
        avance: 24,
        cortes: 4
      }
    });
  });

  it("calcula Perforado Laser Fibra con perforados, lados y piezas", () => {
    const resultado = analizarFormulaProceso({
      tipoFormula: "laser_metros_minuto",
      expresion: "(((6.3*3.1416)*8P)*2L)*4P",
      unidadExpresion: "mm",
      metrosPorMinuto: 6,
      segundosPorCorte: 0.5
    });

    expect(resultado).toMatchObject({
      valido: true,
      segundos_por_producto: 44.67,
      unidades_por_hora: 80.6,
      metros_totales: 1.2667,
      piezas: 4,
      cortes: 64,
      cortes_por_subproducto: 8,
      subproductos: 2,
      cortes_por_pieza: 16,
      cortes_por_producto: 64,
      consumo_pieza_formula: 19.7921,
      consumo_total_formula: 1266.6931,
      longitud_por_pieza: 316.6733,
      detalle_tiempo: {
        avance: 12.67,
        cortes: 32
      }
    });
  });

  it("calcula tiempo de Soldadura MIG por puntos y cordones", () => {
    const resultado = analizarFormulaProceso({
      tipoFormula: "soldadura_mig",
      puntosMig: 10,
      cordonesSimples: 2,
      cordonesPerimetrales: 1,
      segundosPorPuntoMig: 3,
      segundosPorCordonSimple: 12,
      segundosPorCordonPerimetral: 45
    });

    expect(resultado).toMatchObject({
      valido: true,
      segundos_por_producto: 99,
      unidades_por_hora: 36.36,
      piezas: 13,
      cortes: 0,
      detalle_tiempo: {
        puntos_mig: 30,
        cordones_simples: 24,
        cordones_perimetrales: 45
      }
    });
  });

  it("conserva materiales y suministros en la cotización", () => {
    const cotizacion = prepararCotizacionTecnica(
      {
        nombre_producto: "Gráfica UV",
        escalas: "10",
        moneda: "USD",
        tipo_cambio_clp_usd: 915,
        incoterm: "CIP",
        pais_destino: "Argentina",
        destino_internacional: "Buenos Aires",
        modalidad_carga: "ftl",
        unidades_por_caja: 4,
        largo_caja_cm: 100,
        ancho_caja_cm: 50,
        alto_caja_cm: 50,
        factor_estiba: 1,
        capacidad_camion_m3: 90,
        capacidad_camion_kg: 25000,
        flete_internacional: 45000,
        costo_ltl_m3: 0,
        costo_ltl_minimo: 0,
        seguro_porcentaje: 0,
        seguro_sobre_porcentaje: 110,
        gastos_exportacion: 12000,
        otros_costos_exportacion: 5000,
        dias_preparacion_exportacion: 2,
        dias_transito: 5,
        materiales: [
          {
            tipo_linea: "material",
            codigo: "MP0012",
            nombre: "PAI Blanco",
            unidad: "unidad",
            expresion_consumo: "(100+50+20)*4",
            unidad_expresion_consumo: "mm",
            piezas_calculadas: 12,
            cortes_calculados: 12,
            cortes_por_subproducto: 3,
            subproductos: 4,
            fraccion_por_pieza: 0,
            dobleces_por_pieza: 0,
            dobleces_total: 0,
            longitud_por_pieza: 170,
            consumo_unitario: 0.25,
            costo_unitario: 6852,
            peso_kg_por_unidad: 2.4
          },
          {
            tipo_linea: "suministro",
            codigo: "SUM0030",
            nombre: "Tinta UV CMYK",
            unidad: "ml",
            tipo_formula_consumo:
              "tinta_uv_cmyk_pai",
            formula_material_indice: "0",
            formula_material_codigo: "MP0012",
            formula_material_nombre: "PAI Blanco",
            expresion_consumo: "((729)(567))*2",
            unidad_expresion_consumo: "m2",
            area_m2_por_producto: 0.826686,
            consumo_tinta_ml_por_m2: 12,
            consumo_tinta_ml_total: 9.920232,
            consumo_unitario: 9.920232,
            costo_unitario: 15,
            peso_kg_por_unidad: 0.001
          }
        ],
        procesos: [
          {
            proceso_nombre: "Doblez",
            estacion_nombre: "CNC 3D",
            tipo_formula_tiempo: "doblez_cnc_3d",
            formula_tiempo: "(100+50+20)*4",
            unidad_formula_tiempo: "mm",
            segundos_por_metro: 5,
            segundos_por_doblez: 3,
            segundos_por_corte: 1.5,
            segundos_por_producto: 33.4,
            metros_totales_calculados: 0.68,
            cortes_calculados: 4,
            dobleces_total: 8,
            unidades_por_hora: 107.78,
            eficiencia_esperada: 100,
            costo_hora: 12000
          }
        ]
      },
      {
        empresa_id: "bba",
        planta_ids: ["chile"]
      }
    );

    expect(cotizacion.materiales).toMatchObject([
      {
        tipo_linea: "material",
        codigo: "MP0012",
        expresion_consumo: "(100+50+20)*4",
        cortes_calculados: 12,
        cortes_por_subproducto: 3,
        subproductos: 4,
        fraccion_por_pieza: 0,
        dobleces_total: 0,
        peso_kg_por_unidad: 2.4
      },
      {
        tipo_linea: "suministro",
        codigo: "SUM0030",
        tipo_formula_consumo:
          "tinta_uv_cmyk_pai",
        formula_material_codigo: "MP0012",
        area_m2_por_producto: 0.826686,
        consumo_tinta_ml_por_m2: 12,
        consumo_tinta_ml_total: 9.920232,
        consumo_unitario: 9.920232,
        peso_kg_por_unidad: 0.001
      }
    ]);
    expect(cotizacion.procesos[0]).toMatchObject({
      tipo_formula_tiempo: "doblez_cnc_3d",
      formula_tiempo: "(100+50+20)*4",
      segundos_por_producto: 33.4,
      unidades_por_hora: 107.78
    });
    expect(cotizacion.supuestos).toMatchObject({
      moneda: "USD",
      tipo_cambio_clp_usd: 915
    });
    expect(cotizacion.supuestos.exportacion).toMatchObject({
      incoterm: "CIP",
      pais_destino: "Argentina",
      destino: "Buenos Aires",
      modalidad_carga: "ftl",
      unidades_por_caja: 4,
      largo_caja_cm: 100,
      ancho_caja_cm: 50,
      alto_caja_cm: 50,
      factor_estiba: 1,
      capacidad_camion_m3: 90,
      capacidad_camion_kg: 25000,
      flete_internacional: 45000,
      costo_ltl_m3: 0,
      costo_ltl_minimo: 0,
      seguro_porcentaje: 0,
      seguro_sobre_porcentaje: 110,
      gastos_exportacion: 12000,
      otros_costos_exportacion: 5000,
      dias_preparacion_exportacion: 2,
      dias_transito: 5
    });
    expect(cotizacion.resultados[0]).toMatchObject({
      costo_exportacion: 62000,
      logistica_exportacion: {
        estado_carga: "FTL",
        camiones_necesarios: 1,
        flete_internacional: 45000,
        seguro_internacional: 0,
        gastos_exportacion: 12000,
        otros_costos_exportacion: 5000
      },
      lead_time_cip_dias: expect.any(Number)
    });
    expect(
      cotizacion.resultados[0].detalle_procesos[0]
    ).toMatchObject({
      formula_tiempo: "(100+50+20)*4",
      segundos_por_producto: 33.4
    });
    expect(cotizacion.resultados[0].costo_materiales)
      .toBeGreaterThan(0);
    expect(cotizacion.resultados[0].costo_procesos)
      .toBeGreaterThan(0);
  });
});
