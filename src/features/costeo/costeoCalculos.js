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

const evaluarExpresionNumerica = expresion => {
  const texto = (expresion || "")
    .toString()
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  let posicion = 0;

  const leerNumero = () => {
    let inicio = posicion;

    while (
      posicion < texto.length &&
      /[0-9.]/.test(texto[posicion])
    ) {
      posicion += 1;
    }

    if (inicio === posicion) {
      throw new Error("Número inválido");
    }

    const valor = Number(
      texto.slice(inicio, posicion)
    );

    if (!Number.isFinite(valor)) {
      throw new Error("Número inválido");
    }

    return valor;
  };

  const leerFactor = () => {
    if (texto[posicion] === "-") {
      posicion += 1;
      return -leerFactor();
    }

    if (texto[posicion] === "(") {
      posicion += 1;
      const valor = leerSuma();

      if (texto[posicion] !== ")") {
        throw new Error("Paréntesis inválido");
      }

      posicion += 1;
      return valor;
    }

    return leerNumero();
  };

  const leerProducto = () => {
    let valor = leerFactor();

    while (
      texto[posicion] === "*" ||
      texto[posicion] === "/"
    ) {
      const operador = texto[posicion];
      posicion += 1;
      const siguiente = leerFactor();

      valor =
        operador === "*"
          ? valor * siguiente
          : valor / siguiente;
    }

    return valor;
  };

  const leerSuma = () => {
    let valor = leerProducto();

    while (
      texto[posicion] === "+" ||
      texto[posicion] === "-"
    ) {
      const operador = texto[posicion];
      posicion += 1;
      const siguiente = leerProducto();

      valor =
        operador === "+"
          ? valor + siguiente
          : valor - siguiente;
    }

    return valor;
  };

  if (!texto) {
    return 0;
  }

  if (
    [...texto].some(
      caracter =>
        !/[0-9.()+\-*/]/.test(caracter)
    )
  ) {
    throw new Error("Caracter inválido");
  }

  const resultado = leerSuma();

  if (posicion !== texto.length) {
    throw new Error("Expresión inválida");
  }

  return resultado;
};

const quitarParentesisExternos = expresion => {
  const texto = (expresion || "").trim();

  if (
    texto.startsWith("(") &&
    texto.endsWith(")")
  ) {
    return texto.slice(1, -1);
  }

  return texto;
};

const separarMultiplicadorFinal = expresion => {
  const texto = (expresion || "").toString().trim();
  const coincidencia = texto.match(
    /^(.*?)(?:\)\s*|\s)(?:\*\s*)([0-9]+(?:[.,][0-9]+)?)$/
  );

  if (!coincidencia) {
    return {
      base: texto,
      multiplicador: 1
    };
  }

  const baseTexto = texto.includes(")")
    ? `${coincidencia[1]})`
    : coincidencia[1];
  const multiplicador = Number(
    coincidencia[2].replace(",", ".")
  );

  return {
    base: quitarParentesisExternos(baseTexto),
    multiplicador:
      Number.isFinite(multiplicador) &&
      multiplicador > 0
        ? multiplicador
        : 1
  };
};

const contarOperador = (texto, operadorBuscado) =>
  [...(texto || "")].filter(
    caracter => caracter === operadorBuscado
  ).length;

const convertirConsumoAUnidadMaterial = (
  valor,
  unidadExpresion,
  unidadMaterial
) => {
  const origen = (unidadExpresion || "")
    .toString()
    .toLowerCase();
  const destino = (unidadMaterial || "")
    .toString()
    .toLowerCase();

  if (
    origen === "mm" &&
    ["m", "mt", "mts", "metro", "metros"].includes(
      destino
    )
  ) {
    return valor / 1000;
  }

  if (
    origen === "cm" &&
    ["m", "mt", "mts", "metro", "metros"].includes(
      destino
    )
  ) {
    return valor / 100;
  }

  return valor;
};

export const analizarExpresionConsumoMaterial = ({
  expresion = "",
  unidadExpresion = "mm",
  unidadMaterial = "m"
} = {}) => {
  const texto = (expresion || "").toString().trim();

  if (!texto) {
    return {
      valido: false,
      consumo_unitario: 0,
      piezas: 0,
      cortes: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      error: ""
    };
  }

  try {
    const { base, multiplicador } =
      separarMultiplicadorFinal(texto);
    const totalExpresion =
      evaluarExpresionNumerica(texto);
    const baseExpresion =
      evaluarExpresionNumerica(base);
    const piezas = Math.max(
      Math.round(multiplicador),
      1
    );
    const doblecesPorPieza =
      contarOperador(base, "+");

    return {
      valido: true,
      consumo_unitario: redondear(
        convertirConsumoAUnidadMaterial(
          totalExpresion,
          unidadExpresion,
          unidadMaterial
        ),
        4
      ),
      piezas,
      cortes: piezas,
      dobleces_por_pieza: doblecesPorPieza,
      dobleces_total:
        doblecesPorPieza * piezas,
      longitud_por_pieza: redondear(
        baseExpresion,
        4
      ),
      error: ""
    };
  } catch (error) {
    return {
      valido: false,
      consumo_unitario: 0,
      piezas: 0,
      cortes: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      error:
        "Usa solo números, +, -, *, / y paréntesis."
    };
  }
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
    const compra =
      material.politica_minimo_compra === "consumo_real"
        ? requerido
        : Math.max(requerido, minimoCompra);

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

const calcularHorasProceso = (proceso, cantidad) => {
  const unidadesHora =
    numero(proceso.unidades_por_hora) || 1;
  const eficiencia =
    Math.max(numero(proceso.eficiencia_esperada), 1) /
    100;
  const horasSetup = numero(proceso.horas_setup);

  return (
    cantidad / Math.max(unidadesHora * eficiencia, 0.01) +
    horasSetup
  );
};

export const calcularHorasProcesos = (
  procesos = [],
  cantidad = 1
) =>
  procesos.reduce(
    (total, proceso) =>
      total + calcularHorasProceso(proceso, cantidad),
    0
  );

export const calcularDetalleProcesosCotizacion = (
  procesos = [],
  cantidad = 1,
  costoOperativoHora = 0
) =>
  procesos.map(proceso => {
    const horas = calcularHorasProceso(proceso, cantidad);
    const costoProceso =
      horas * numero(proceso.costo_hora);
    const porcentajeAbsorcion =
      numero(proceso.porcentaje_costo_operativo) / 100;
    const costoOperativo =
      horas *
      numero(costoOperativoHora) *
      porcentajeAbsorcion;

    return {
      proceso_codigo: proceso.proceso_codigo || "",
      proceso_nombre: proceso.proceso_nombre || "",
      estacion_codigo: proceso.estacion_codigo || "",
      estacion_nombre: proceso.estacion_nombre || "",
      horas: redondear(horas, 2),
      costo_proceso: redondear(costoProceso),
      porcentaje_costo_operativo: redondear(
        numero(proceso.porcentaje_costo_operativo)
      ),
      costo_operativo: redondear(costoOperativo)
    };
  });

export const calcularCotizacionTecnica = ({
  escalas = [],
  materiales = [],
  procesos = [],
  indirectos_porcentaje = 18,
  costo_operativo_hora = 0,
  margen_porcentaje = 35,
  tipo_margen = "margen_bruto",
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
    const detalleProcesos =
      calcularDetalleProcesosCotizacion(
        procesos,
        cantidad,
        costo_operativo_hora
      );
    const horasProduccion = calcularHorasProcesos(
      procesos,
      cantidad
    );
    const costoOperativo = detalleProcesos.reduce(
      (total, proceso) =>
        total + numero(proceso.costo_operativo),
      0
    );
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
    const precioUnitario =
      tipo_margen === "markup"
        ? costoUnitario * (1 + margen)
        : margen >= 1
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
      detalle_procesos: detalleProcesos,
      lead_time_dias: leadTimeDias
    };
  });
};
