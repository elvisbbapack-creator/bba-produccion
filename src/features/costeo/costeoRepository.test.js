import {
  prepararCotizacionTecnica
} from "./costeoRepository";
import {
  analizarExpresionConsumoMaterial,
  analizarFormulaProceso
} from "./costeoCalculos";

describe("costeoRepository", () => {
  it("interpreta formula de consumo agrupando piezas, cortes y dobleces", () => {
    const resultado =
      analizarExpresionConsumoMaterial({
        expresion: "(100+50+20)*4",
        unidadExpresion: "mm",
        unidadMaterial: "m"
      });

    expect(resultado).toMatchObject({
      valido: true,
      consumo_unitario: 0.68,
      piezas: 4,
      cortes: 4,
      dobleces_por_pieza: 2,
      dobleces_total: 8,
      longitud_por_pieza: 170
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
            piezas_calculadas: 4,
            cortes_calculados: 4,
            dobleces_por_pieza: 2,
            dobleces_total: 8,
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
        cortes_calculados: 4,
        dobleces_total: 8
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
