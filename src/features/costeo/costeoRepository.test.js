import {
  prepararCotizacionTecnica
} from "./costeoRepository";

describe("costeoRepository", () => {
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
        codigo: "MP0012"
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
