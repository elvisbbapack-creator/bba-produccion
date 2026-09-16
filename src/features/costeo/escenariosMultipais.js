import { calcularCotizacionTecnica } from "./costeoCalculos";

export const PAISES_ESCENARIOS = [
  "Chile",
  "Argentina",
  "Uruguay",
  "Paraguay"
];

export const crearEscenariosPaisIniciales = () => [
  {
    pais: "Chile",
    activo: true,
    cantidades: "500, 1000, 2000",
    moneda: "CLP",
    incoterm: "EXW",
    destino: "Santiago",
    flete_internacional: 0,
    costo_ltl_m3: 0,
    costo_ltl_minimo: 0,
    gastos_exportacion: 0,
    dias_preparacion_exportacion: 0,
    dias_transito: 0
  },
  {
    pais: "Argentina",
    activo: true,
    cantidades: "300, 750, 1500",
    moneda: "USD",
    incoterm: "CIP",
    destino: "Buenos Aires",
    flete_internacional: 4300,
    costo_ltl_m3: 85,
    costo_ltl_minimo: 300,
    gastos_exportacion: 450,
    dias_preparacion_exportacion: 2,
    dias_transito: 5
  },
  {
    pais: "Uruguay",
    activo: true,
    cantidades: "200, 500, 1000",
    moneda: "USD",
    incoterm: "CIP",
    destino: "Montevideo",
    flete_internacional: 5500,
    costo_ltl_m3: 100,
    costo_ltl_minimo: 350,
    gastos_exportacion: 450,
    dias_preparacion_exportacion: 2,
    dias_transito: 6
  },
  {
    pais: "Paraguay",
    activo: true,
    cantidades: "250, 600, 1200",
    moneda: "USD",
    incoterm: "CIP",
    destino: "Asunción",
    flete_internacional: 5200,
    costo_ltl_m3: 95,
    costo_ltl_minimo: 350,
    gastos_exportacion: 450,
    dias_preparacion_exportacion: 2,
    dias_transito: 6
  }
];

const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
};

export const normalizarEscenariosPais = escenarios => {
  const recibidos = Array.isArray(escenarios) ? escenarios : [];
  const iniciales = crearEscenariosPaisIniciales();
  return iniciales.map(inicial => {
    const guardado = recibidos.find(
      escenario => escenario?.pais === inicial.pais
    );
    return {
      ...inicial,
      ...(guardado || {}),
      pais: inicial.pais,
      moneda: inicial.pais === "Chile" ? "CLP" : "USD"
    };
  });
};

export const calcularEscenariosMultipais = ({
  escenarios,
  materiales,
  procesos,
  supuestos,
  exportacionBase
}) => normalizarEscenariosPais(escenarios)
  .filter(escenario => escenario.activo !== false)
  .flatMap(escenario => {
    const moneda = escenario.pais === "Chile" ? "CLP" : "USD";
    const incoterm = escenario.pais === "Chile"
      ? escenario.incoterm || "EXW"
      : escenario.incoterm || "CIP";
    const resultados = calcularCotizacionTecnica({
      ...supuestos,
      escalas: escenario.cantidades,
      materiales,
      procesos,
      moneda,
      exportacion: {
        ...(exportacionBase || {}),
        incoterm,
        destino: escenario.destino || "",
        pais_destino:
          escenario.pais === "Chile" ? "" : escenario.pais,
        flete_internacional: numero(
          escenario.flete_internacional
        ),
        costo_ltl_m3: numero(escenario.costo_ltl_m3),
        costo_ltl_minimo: numero(
          escenario.costo_ltl_minimo
        ),
        gastos_exportacion: numero(
          escenario.gastos_exportacion
        ),
        dias_preparacion_exportacion: numero(
          escenario.dias_preparacion_exportacion
        ),
        dias_transito: numero(escenario.dias_transito)
      }
    });
    return resultados.map(resultado => ({
      ...resultado,
      clave: `${escenario.pais}-${resultado.cantidad}`,
      pais: escenario.pais,
      moneda,
      incoterm,
      destino: escenario.destino || ""
    }));
  });

