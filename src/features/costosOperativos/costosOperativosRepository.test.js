import {
  calcularCostosOperativos,
  prepararCostosOperativos,
  validarCostosOperativos
} from "./costosOperativosRepository";

describe("costosOperativosRepository", () => {
  it("calcula costo mensual total y costo operativo por hora", () => {
    const resultado = calcularCostosOperativos({
      horas_productivas_mes: 520,
      items: [
        {
          nombre: "Supervisor",
          cantidad: 2,
          costo_mensual_unitario: 1200000
        },
        {
          nombre: "Arriendo",
          cantidad: 1,
          costo_mensual_unitario: 3000000
        }
      ]
    });

    expect(resultado).toEqual({
      costo_mensual_total: 5400000,
      horas_productivas_mes: 520,
      costo_operativo_hora: 10384.62,
      porcentaje_absorcion_total: 0
    });
  });

  it("prepara costos operativos con absorción por estación", () => {
    const resultado = prepararCostosOperativos(
      {
        planta_id: "chile",
        nombre: "Costos Chile",
        horas_productivas_mes: 100,
        items: [
          {
            categoria: "personal",
            nombre: "Administrador",
            cantidad: 1,
            costo_mensual_unitario: 1000000
          }
        ],
        estaciones_absorcion: [
          {
            proceso_codigo: "PR001",
            proceso_nombre: "Corte",
            estacion_codigo: "EST001",
            estacion_nombre: "Sierra",
            porcentaje_absorcion: 12.5
          }
        ]
      },
      {
        empresa_id: "bba-chile",
        planta_ids: ["chile"]
      },
      "bba-chile__chile"
    );

    expect(resultado.empresa_id).toBe("bba-chile");
    expect(resultado.planta_id).toBe("chile");
    expect(resultado.costo_operativo_hora).toBe(10000);
    expect(resultado.items).toHaveLength(1);
    expect(resultado.estaciones_absorcion).toHaveLength(1);
    expect(resultado.porcentaje_absorcion_total).toBe(12.5);
  });

  it("valida datos mínimos", () => {
    expect(
      validarCostosOperativos({
        planta_id: "",
        costo_mensual_total: 0,
        horas_productivas_mes: 0
      })
    ).toEqual([
      "Selecciona una planta.",
      "Ingresa al menos un costo operativo mensual.",
      "Ingresa las horas productivas mensuales."
    ]);
  });

  it("rechaza absorción sobre 100%", () => {
    expect(
      validarCostosOperativos({
        planta_id: "chile",
        costo_mensual_total: 1000,
        horas_productivas_mes: 10,
        porcentaje_absorcion_total: 120
      })
    ).toEqual([
      "La suma de porcentajes por estación no puede superar 100%."
    ]);
  });
});
