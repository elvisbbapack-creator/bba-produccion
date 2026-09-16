import {
  calcularEscenariosMultipais,
  crearEscenariosPaisIniciales,
  normalizarEscenariosPais
} from "./escenariosMultipais";

const base = {
  materiales: [{
    codigo: "MP1",
    nombre: "Material",
    unidad: "un",
    consumo_unitario: 1,
    costo_unitario: 1000,
    merma_porcentaje: 0,
    minimo_compra: 0
  }],
  procesos: [],
  supuestos: {
    indirectos_porcentaje: 5,
    costo_operativo_hora: 0,
    margen_porcentaje: 35,
    tipo_margen: "markup",
    factor_riesgo_porcentaje: 3,
    dias_compra: 5,
    dias_ingenieria: 2,
    horas_disponibles_dia: 21,
    desfase_flujo_horas: 2,
    tipo_cambio_clp_usd: 940
  },
  exportacionBase: {}
};

test("crea escenarios iniciales para los cuatro países", () => {
  const escenarios = crearEscenariosPaisIniciales();
  expect(escenarios.map(item => item.pais)).toEqual([
    "Chile", "Argentina", "Uruguay", "Paraguay"
  ]);
  expect(escenarios[0].moneda).toBe("CLP");
  expect(escenarios[1].moneda).toBe("USD");
});

test("calcula cantidades independientes por país", () => {
  const escenarios = normalizarEscenariosPais([
    { pais: "Chile", activo: true, cantidades: "10, 20" },
    { pais: "Argentina", activo: true, cantidades: "30, 40, 50" },
    { pais: "Uruguay", activo: false },
    { pais: "Paraguay", activo: false }
  ]);
  const resultados = calcularEscenariosMultipais({
    ...base,
    escenarios
  });

  expect(resultados.map(item => item.clave)).toEqual([
    "Chile-10",
    "Chile-20",
    "Argentina-30",
    "Argentina-40",
    "Argentina-50"
  ]);
  expect(resultados[0].moneda).toBe("CLP");
  expect(resultados[2].moneda).toBe("USD");
});
