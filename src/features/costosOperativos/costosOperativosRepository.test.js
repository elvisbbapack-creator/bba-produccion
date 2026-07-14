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
      costo_operativo_hora: 10384.62
    });
  });

  it("prepara costos operativos con empresa y planta", () => {
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
});
