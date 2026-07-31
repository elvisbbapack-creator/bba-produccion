import {
  prepararCotizacionTecnica
} from "./costeoRepository";
import {
  analizarExpresionConsumoMaterial
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
    expect(cotizacion.resultados[0].costo_materiales)
      .toBeGreaterThan(0);
  });
});
