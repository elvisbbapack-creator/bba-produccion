const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
};

const redondear = (valor, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round(numero(valor) * factor) / factor;
};

export const prepararEscalas = valor => {
  const base = Array.isArray(valor)
    ? valor
    : (valor || "")
        .toString()
        .split(/[,;\n]/);

  return [
    ...new Set(
      base
        .map(item => Math.round(numero(item)))
        .filter(item => item > 0)
    )
  ].sort((a, b) => a - b);
};

export const calcularCostoMateriales = (
  materiales = [],
  cantidad = 1
) =>
  materiales.reduce((total, material) => {
    const consumo = numero(material.consumo_unitario);
    const merma = numero(material.merma_porcentaje) / 100;
    const precio = numero(material.costo_unitario);
    const minimoCompra = numero(material.minimo_compra);
    const requerido = consumo * cantidad * (1 + merma);
    const compra = Math.max(requerido, minimoCompra);

    return total + compra * precio;
  }, 0);

export const calcularCostoProcesos = (
  procesos = [],
  cantidad = 1
) =>
  procesos.reduce((total, proceso) => {
    const unidadesHora =
      numero(proceso.unidades_por_hora) || 1;
    const eficiencia =
      Math.max(numero(proceso.eficiencia_esperada), 1) /
      100;
    const costoHora = numero(proceso.costo_hora);
    const horasSetup = numero(proceso.horas_setup);
    const horas =
      cantidad / Math.max(unidadesHora * eficiencia, 0.01);

    return total + (horas + horasSetup) * costoHora;
  }, 0);

export const calcularHorasProcesos = (
  procesos = [],
  cantidad = 1
) =>
  procesos.reduce((total, proceso) => {
    const unidadesHora =
      numero(proceso.unidades_por_hora) || 1;
    const eficiencia =
      Math.max(numero(proceso.eficiencia_esperada), 1) /
      100;
    const horasSetup = numero(proceso.horas_setup);

    return (
      total +
      cantidad / Math.max(unidadesHora * eficiencia, 0.01) +
      horasSetup
    );
  }, 0);

export const calcularCotizacionTecnica = ({
  escalas = [],
  materiales = [],
  procesos = [],
  indirectos_porcentaje = 18,
  costo_operativo_hora = 0,
  margen_porcentaje = 35,
  dias_compra = 0,
  dias_ingenieria = 0,
  horas_disponibles_dia = 14,
  factor_riesgo_porcentaje = 0
} = {}) => {
  const escalasPreparadas = prepararEscalas(escalas);
  const indirectos = numero(indirectos_porcentaje) / 100;
  const margen = numero(margen_porcentaje) / 100;
  const riesgo = numero(factor_riesgo_porcentaje) / 100;
  const horasDia =
    Math.max(numero(horas_disponibles_dia), 1);

  return escalasPreparadas.map(cantidad => {
    const costoMateriales = calcularCostoMateriales(
      materiales,
      cantidad
    );
    const costoProcesos = calcularCostoProcesos(
      procesos,
      cantidad
    );
    const horasProduccion = calcularHorasProcesos(
      procesos,
      cantidad
    );
    const costoOperativo =
      horasProduccion * numero(costo_operativo_hora);
    const costoDirecto =
      costoMateriales + costoProcesos;
    const baseIndirectos =
      costoDirecto + costoOperativo;
    const costoIndirecto = baseIndirectos * indirectos;
    const costoRiesgo =
      (baseIndirectos + costoIndirecto) * riesgo;
    const costoTotal =
      costoDirecto +
      costoOperativo +
      costoIndirecto +
      costoRiesgo;
    const costoUnitario = costoTotal / cantidad;
    const precioUnitario = margen >= 1
      ? costoUnitario
      : costoUnitario / (1 - margen);
    const leadTimeDias =
      numero(dias_compra) +
      numero(dias_ingenieria) +
      Math.ceil(horasProduccion / horasDia);

    return {
      cantidad,
      costo_materiales: redondear(costoMateriales),
      costo_procesos: redondear(costoProcesos),
      costo_operativo: redondear(costoOperativo),
      costo_indirecto: redondear(costoIndirecto),
      costo_riesgo: redondear(costoRiesgo),
      costo_total: redondear(costoTotal),
      costo_unitario: redondear(costoUnitario),
      precio_unitario_sugerido: redondear(precioUnitario),
      precio_total_sugerido: redondear(
        precioUnitario * cantidad
      ),
      horas_produccion: redondear(horasProduccion, 1),
      lead_time_dias: leadTimeDias
    };
  });
};
