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

  it("conserva materiales y suministros en la cotización", () => {
    const cotizacion = prepararCotizacionTecnica(
      {
        nombre_producto: "Gráfica UV",
        escalas: "10",
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
            costo_unitario: 6852
          },
          {
            tipo_linea: "suministro",
            codigo: "MP-TINTA-C",
            nombre: "Tinta UV C",
            unidad: "ml",
            consumo_unitario: 12,
            costo_unitario: 15
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
        dobleces_total: 0
      },
      {
        tipo_linea: "suministro",
        codigo: "MP-TINTA-C"
      }
    ]);
    expect(cotizacion.procesos[0]).toMatchObject({
      tipo_formula_tiempo: "doblez_cnc_3d",
      formula_tiempo: "(100+50+20)*4",
      segundos_por_producto: 33.4,
      unidades_por_hora: 107.78
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
