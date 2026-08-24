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

export const CONSUMO_TINTA_UV_CMYK_ML_M2 = 12;

const INCOTERMS_CON_FLETE = new Set(["CIP", "DAP"]);
const INCOTERMS_CON_SEGURO = new Set(["CIP"]);
const INCOTERMS_CON_EXPORTACION = new Set([
  "FCA",
  "CIP",
  "DAP"
]);

export const calcularLogisticaExportacion = ({
  exportacion = {},
  cantidad = 0,
  costoBaseMercaderia = 0,
  pesoUnitarioKg = 0
} = {}) => {
  const incoterm = (exportacion.incoterm || "")
    .toString()
    .toUpperCase();
  const cantidadPedido = Math.max(numero(cantidad), 0);
  const unidadesPorCaja = Math.max(
    numero(exportacion.unidades_por_caja) || 1,
    1
  );
  const largoM = numero(exportacion.largo_caja_cm) / 100;
  const anchoM = numero(exportacion.ancho_caja_cm) / 100;
  const altoM = numero(exportacion.alto_caja_cm) / 100;
  const factorEstiba = Math.max(
    numero(exportacion.factor_estiba) || 1,
    1
  );
  const volumenCajaM3 =
    largoM > 0 && anchoM > 0 && altoM > 0
      ? largoM * anchoM * altoM * factorEstiba
      : 0;
  const cajas = unidadesPorCaja > 0
    ? Math.ceil(cantidadPedido / unidadesPorCaja)
    : 0;
  const volumenTotalM3 = volumenCajaM3 * cajas;
  const pesoTotalKg =
    numero(pesoUnitarioKg) * cantidadPedido;
  const capacidadCamionM3 = Math.max(
    numero(exportacion.capacidad_camion_m3) || 90,
    1
  );
  const capacidadCamionKg = Math.max(
    numero(exportacion.capacidad_camion_kg) || 25000,
    1
  );
  const camionesPorVolumen = Math.ceil(
    volumenTotalM3 / capacidadCamionM3
  );
  const camionesPorPeso = Math.ceil(
    pesoTotalKg / capacidadCamionKg
  );
  const camionesNecesarios = Math.max(
    camionesPorVolumen,
    camionesPorPeso,
    INCOTERMS_CON_FLETE.has(incoterm) ? 1 : 0
  );
  const ocupacionVolumenPct =
    camionesNecesarios > 0
      ? (volumenTotalM3 /
          (camionesNecesarios * capacidadCamionM3)) *
        100
      : 0;
  const ocupacionPesoPct =
    camionesNecesarios > 0
      ? (pesoTotalKg /
          (camionesNecesarios * capacidadCamionKg)) *
        100
      : 0;
  const modalidadCarga = (exportacion.modalidad_carga ||
    "auto")
    .toString()
    .toLowerCase();
  const usarFtl =
    modalidadCarga === "ftl" ||
    (modalidadCarga === "auto" &&
      (ocupacionVolumenPct >= 80 ||
        ocupacionPesoPct >= 80 ||
        camionesNecesarios > 1));
  const fleteFtl =
    INCOTERMS_CON_FLETE.has(incoterm) && usarFtl
      ? camionesNecesarios *
        numero(exportacion.flete_internacional)
      : 0;
  const fleteLtl =
    INCOTERMS_CON_FLETE.has(incoterm) && !usarFtl
      ? Math.max(
          numero(exportacion.costo_ltl_minimo),
          volumenTotalM3 *
            numero(exportacion.costo_ltl_m3)
        )
      : 0;
  const fleteInternacional = fleteFtl + fleteLtl;
  const gastosExportacion = INCOTERMS_CON_EXPORTACION.has(
    incoterm
  )
    ? numero(exportacion.gastos_exportacion)
    : 0;
  const otrosCostos = INCOTERMS_CON_EXPORTACION.has(incoterm)
    ? numero(exportacion.otros_costos_exportacion)
    : 0;
  const baseSeguro =
    numero(costoBaseMercaderia) +
    fleteInternacional +
    gastosExportacion +
    otrosCostos;
  const factorValorAsegurado =
    numero(exportacion.seguro_sobre_porcentaje) > 0
      ? numero(exportacion.seguro_sobre_porcentaje) / 100
      : 1;
  const seguroInternacional = INCOTERMS_CON_SEGURO.has(
    incoterm
  )
    ? baseSeguro *
      (numero(exportacion.seguro_porcentaje) / 100) *
      factorValorAsegurado
    : 0;
  const costoExportacion =
    fleteInternacional +
    seguroInternacional +
    gastosExportacion +
    otrosCostos;
  const estadoCarga =
    !INCOTERMS_CON_FLETE.has(incoterm)
      ? incoterm || "EXW"
      : usarFtl
        ? camionesNecesarios <= 1
          ? "FTL"
          : `FTL + ${camionesNecesarios} camiones`
        : "LTL";

  return {
    incoterm,
    cajas,
    volumen_caja_m3: redondear(volumenCajaM3, 4),
    volumen_total_m3: redondear(volumenTotalM3, 4),
    peso_total_kg: redondear(pesoTotalKg, 4),
    capacidad_camion_m3: redondear(capacidadCamionM3, 4),
    capacidad_camion_kg: redondear(capacidadCamionKg, 4),
    ocupacion_volumen_pct: redondear(ocupacionVolumenPct, 2),
    ocupacion_peso_pct: redondear(ocupacionPesoPct, 2),
    camiones_necesarios: camionesNecesarios,
    modalidad_calculada: usarFtl ? "FTL" : "LTL",
    estado_carga: estadoCarga,
    flete_internacional: redondear(fleteInternacional),
    seguro_internacional: redondear(seguroInternacional),
    gastos_exportacion: redondear(gastosExportacion),
    otros_costos_exportacion: redondear(otrosCostos),
    costo_exportacion: redondear(costoExportacion),
    costo_exportacion_unitario:
      cantidadPedido > 0
        ? redondear(costoExportacion / cantidadPedido)
        : 0
  };
};

export const calcularConsumoTintaUvCmykDesdePlancha = ({
  anchoPiezaMm = 0,
  altoPiezaMm = 0,
  piezasPorProducto = 1,
  unidadDestino = "ml",
  consumoMlM2 = CONSUMO_TINTA_UV_CMYK_ML_M2
} = {}) => {
  const ancho = numero(anchoPiezaMm);
  const alto = numero(altoPiezaMm);
  const piezas = Math.max(numero(piezasPorProducto), 1);
  const consumoMlPorM2 = numero(consumoMlM2);
  const areaM2 = (ancho * alto * piezas) / 1000000;
  const consumoMl = areaM2 * consumoMlPorM2;
  const unidad = (unidadDestino || "ml")
    .toString()
    .toLowerCase()
    .trim();
  const consumoUnitario =
    ["l", "lt", "litro", "litros"].includes(unidad) ||
    ["kg", "kilo", "kilos"].includes(unidad)
      ? consumoMl / 1000
      : consumoMl;

  return {
    area_m2_por_producto: redondear(areaM2, 6),
    consumo_tinta_ml_por_m2: redondear(
      consumoMlPorM2,
      6
    ),
    consumo_tinta_ml_total: redondear(
      consumoMl,
      6
    ),
    consumo_unitario: redondear(consumoUnitario, 6)
  };
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

const extraerFormulaAlambreConCortesYSubproductos =
  expresion => {
    const texto = (expresion || "")
      .toString()
      .replace(/\s+/g, "")
      .replace(/,/g, ".");
    const coincidencia = texto.match(
      /^\(\((.+)\)\*([0-9]+(?:\.[0-9]+)?)\)\*([0-9]+(?:\.[0-9]+)?)$/
    );

    if (!coincidencia) {
      return null;
    }

    const cortesPorSubproducto = Number(
      coincidencia[2]
    );
    const subproductos = Number(coincidencia[3]);

    if (
      !Number.isFinite(cortesPorSubproducto) ||
      cortesPorSubproducto <= 0 ||
      !Number.isFinite(subproductos) ||
      subproductos <= 0
    ) {
      return null;
    }

    return {
      base: coincidencia[1],
      largoPieza: evaluarExpresionNumerica(
        coincidencia[1]
      ),
      cortesPorSubproducto: Math.round(
        cortesPorSubproducto
      ),
      subproductos: Math.round(subproductos)
    };
  };

const extraerDimensionesPlancha = expresion => {
  const texto = (expresion || "")
    .toString()
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const coincidencia = texto.match(
    /^\(\((.+)\)\((.+)\)\)(?:\*([0-9]+(?:\.[0-9]+)?))?$/
  );

  if (!coincidencia) {
    return null;
  }

  return {
    ladoA: evaluarExpresionNumerica(coincidencia[1]),
    ladoB: evaluarExpresionNumerica(coincidencia[2]),
    multiplicador: coincidencia[3]
      ? Number(coincidencia[3])
      : 1
  };
};

const extraerFormulaLaserPerforado = expresion => {
  const texto = (expresion || "")
    .toString()
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const coincidencia = texto.match(
    /^\(\(\((.+)\)\*([0-9]+(?:\.[0-9]+)?)P\)\*([0-9]+(?:\.[0-9]+)?)L\)\*([0-9]+(?:\.[0-9]+)?)P$/i
  );

  if (!coincidencia) {
    return null;
  }

  const corteLinealPerforado =
    evaluarExpresionNumerica(coincidencia[1]);
  const perforadosPorLado = Number(
    coincidencia[2]
  );
  const lados = Number(coincidencia[3]);
  const piezas = Number(coincidencia[4]);

  if (
    corteLinealPerforado <= 0 ||
    !Number.isFinite(perforadosPorLado) ||
    perforadosPorLado <= 0 ||
    !Number.isFinite(lados) ||
    lados <= 0 ||
    !Number.isFinite(piezas) ||
    piezas <= 0
  ) {
    return null;
  }

  return {
    corteLinealPerforado,
    perforadosPorLado: Math.round(
      perforadosPorLado
    ),
    lados: Math.round(lados),
    piezas: Math.round(piezas)
  };
};

const formatoPlanchaPorTipo = tipoLectura => {
  if (
    tipoLectura ===
    TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440
  ) {
    return {
      anchoPlancha: 1220,
      altoPlancha: 2440
    };
  }

  if (
    tipoLectura ===
    TIPOS_LECTURA_CONSUMO.PLANCHA_1520X2440
  ) {
    return {
      anchoPlancha: 1520,
      altoPlancha: 2440
    };
  }

  if (
    tipoLectura ===
    TIPOS_LECTURA_CONSUMO.PLANCHA_1220X1220
  ) {
    return {
      anchoPlancha: 1220,
      altoPlancha: 1220
    };
  }

  return {
    anchoPlancha: 1000,
    altoPlancha: 3000
  };
};

const esLecturaPlancha = tipoLectura =>
  [
    TIPOS_LECTURA_CONSUMO.PLANCHA_LAF,
    TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440,
    TIPOS_LECTURA_CONSUMO.PLANCHA_1520X2440,
    TIPOS_LECTURA_CONSUMO.PLANCHA_1220X1220
  ].includes(tipoLectura);

const contarOperador = (texto, operadorBuscado) =>
  [...(texto || "")].filter(
    caracter => caracter === operadorBuscado
  ).length;

const contarTerminosCorte = expresion => {
  const texto = quitarParentesisExternos(
    expresion || ""
  );

  if (!texto.trim()) {
    return 0;
  }

  return contarOperador(texto, "+") + 1;
};

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

export const TIPOS_LECTURA_CONSUMO = {
  CORTES_LINEALES: "cortes_lineales",
  FRACCION_MP: "fraccion_mp",
  ALAMBRE_DOBLADO: "alambre_doblado",
  PLANCHA_LAF: "plancha_laf",
  PLANCHA_1220X2440: "plancha_1220x2440",
  PLANCHA_1520X2440: "plancha_1520x2440",
  PLANCHA_1220X1220: "plancha_1220x1220"
};

export const analizarExpresionConsumoMaterial = ({
  expresion = "",
  unidadExpresion = "mm",
  unidadMaterial = "m",
  tipoLectura = TIPOS_LECTURA_CONSUMO.CORTES_LINEALES
} = {}) => {
  const texto = (expresion || "").toString().trim();

  if (!texto) {
    return {
      valido: false,
      consumo_unitario: 0,
      piezas: 0,
      cortes: 0,
      golpes: 0,
      cortes_por_subproducto: 0,
      subproductos: 0,
      fraccion_por_pieza: 0,
      consumo_pieza_formula: 0,
      consumo_total_formula: 0,
      cortes_por_pieza: 0,
      cortes_por_producto: 0,
      dobleces_por_producto: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      ancho_pieza: 0,
      alto_pieza: 0,
      ancho_plancha: 1000,
      alto_plancha: 3000,
      piezas_por_plancha: 0,
      piezas_por_plancha_rotado: 0,
      fraccion_plancha: "",
      piezas_por_producto: 0,
      error: ""
    };
  }

  try {
    if (esLecturaPlancha(tipoLectura)) {
      const dimensiones =
        extraerDimensionesPlancha(texto);

      if (!dimensiones) {
        throw new Error("Formula plancha invalida");
      }

      const {
        anchoPlancha,
        altoPlancha
      } = formatoPlanchaPorTipo(tipoLectura);
      const ladoA = numero(dimensiones.ladoA);
      const ladoB = numero(dimensiones.ladoB);
      const piezasPorProducto = Math.max(
        Math.round(numero(dimensiones.multiplicador)),
        1
      );

      if (ladoA <= 0 || ladoB <= 0) {
        throw new Error("Formula plancha invalida");
      }

      const piezasNormal =
        Math.floor(anchoPlancha / ladoA) *
        Math.floor(altoPlancha / ladoB);
      const piezasRotado =
        Math.floor(anchoPlancha / ladoB) *
        Math.floor(altoPlancha / ladoA);
      const piezasPorPlancha = Math.max(
        piezasNormal,
        piezasRotado
      );

      if (piezasPorPlancha <= 0) {
        throw new Error("La pieza no cabe en la plancha");
      }

      const fraccionPorPieza =
        1 / piezasPorPlancha;
      const consumoUnitario =
        fraccionPorPieza * piezasPorProducto;

      return {
        valido: true,
        consumo_unitario: redondear(
          consumoUnitario,
          6
        ),
        piezas: piezasPorProducto,
        cortes: piezasPorProducto,
        cortes_por_subproducto: 1,
        subproductos: piezasPorProducto,
        fraccion_por_pieza: redondear(
          fraccionPorPieza,
          6
        ),
        consumo_pieza_formula: redondear(
          fraccionPorPieza,
          6
        ),
        consumo_total_formula: redondear(
          consumoUnitario,
          6
        ),
        cortes_por_pieza: 1,
        cortes_por_producto: piezasPorProducto,
        dobleces_por_producto: 0,
        dobleces_por_pieza: 0,
        dobleces_total: 0,
        longitud_por_pieza: 0,
        ancho_pieza: redondear(ladoA, 2),
        alto_pieza: redondear(ladoB, 2),
        ancho_plancha: anchoPlancha,
        alto_plancha: altoPlancha,
        piezas_por_plancha: piezasPorPlancha,
        piezas_por_plancha_rotado:
          piezasRotado > piezasNormal
            ? piezasRotado
            : 0,
        fraccion_plancha: `1/${piezasPorPlancha}`,
        piezas_por_producto: piezasPorProducto,
        error: ""
      };
    }

    const { base, multiplicador } =
      separarMultiplicadorFinal(texto);
    const totalExpresion =
      evaluarExpresionNumerica(texto);
    const baseExpresion =
      evaluarExpresionNumerica(base);
    const multiplicadorPiezas = Math.max(
      Math.round(multiplicador),
      1
    );
    const cortesPorSubproducto =
      contarTerminosCorte(base);
    const cortes =
      cortesPorSubproducto * multiplicadorPiezas;

    if (
      tipoLectura ===
      TIPOS_LECTURA_CONSUMO.FRACCION_MP
    ) {
      return {
        valido: true,
        consumo_unitario: redondear(
          totalExpresion,
          4
        ),
        piezas: multiplicadorPiezas,
        cortes: 0,
        cortes_por_subproducto: 0,
        subproductos: multiplicadorPiezas,
        fraccion_por_pieza: redondear(
          baseExpresion,
          6
        ),
        consumo_pieza_formula: redondear(
          baseExpresion,
          6
        ),
        consumo_total_formula: redondear(
          totalExpresion,
          6
        ),
        cortes_por_pieza: 0,
        cortes_por_producto: 0,
        dobleces_por_producto: 0,
        dobleces_por_pieza: 0,
        dobleces_total: 0,
        longitud_por_pieza: redondear(
          baseExpresion,
          6
        ),
        error: ""
      };
    }

    if (
      tipoLectura ===
      TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO
    ) {
      const formulaCortesSubproductos =
        extraerFormulaAlambreConCortesYSubproductos(
          texto
        );
      const baseAlambre =
        formulaCortesSubproductos?.base || base;
      const largoPieza =
        formulaCortesSubproductos?.largoPieza ||
        baseExpresion;
      const cortesPorSubproducto =
        formulaCortesSubproductos
          ?.cortesPorSubproducto || 1;
      const subproductos =
        formulaCortesSubproductos?.subproductos ||
        multiplicadorPiezas;
      const doblecesPorPieza =
        contarOperador(baseAlambre, "+");
      const cortesPorPieza =
        baseAlambre.trim() ? 1 : 0;
      const cortesPorProducto =
        cortesPorSubproducto * subproductos;
      const doblecesPorProducto =
        doblecesPorPieza *
        cortesPorSubproducto *
        subproductos;
      const totalExpresionAlambre =
        largoPieza *
        cortesPorSubproducto *
        subproductos;

      return {
        valido: true,
        consumo_unitario: redondear(
          convertirConsumoAUnidadMaterial(
            totalExpresionAlambre,
            unidadExpresion,
            unidadMaterial
          ),
          4
        ),
        piezas: cortesPorProducto,
        cortes: cortesPorProducto,
        cortes_por_subproducto:
          cortesPorSubproducto,
        subproductos,
        fraccion_por_pieza: 0,
        consumo_pieza_formula: redondear(
          largoPieza,
          4
        ),
        consumo_total_formula: redondear(
          totalExpresionAlambre,
          4
        ),
        cortes_por_pieza: cortesPorPieza,
        cortes_por_producto: cortesPorProducto,
        dobleces_por_pieza: doblecesPorPieza,
        dobleces_por_producto:
          doblecesPorProducto,
        dobleces_total: doblecesPorProducto,
        longitud_por_pieza: redondear(
          largoPieza,
          4
        ),
        error: ""
      };
    }

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
      piezas: cortes,
      cortes,
      cortes_por_subproducto:
        cortesPorSubproducto,
      subproductos: multiplicadorPiezas,
      fraccion_por_pieza: 0,
      consumo_pieza_formula: redondear(
        baseExpresion,
        4
      ),
      consumo_total_formula: redondear(
        totalExpresion,
        4
      ),
      cortes_por_pieza: 0,
      cortes_por_producto: 0,
      dobleces_por_producto: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
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
      cortes_por_subproducto: 0,
      subproductos: 0,
      fraccion_por_pieza: 0,
      consumo_pieza_formula: 0,
      consumo_total_formula: 0,
      cortes_por_pieza: 0,
      cortes_por_producto: 0,
      dobleces_por_producto: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      ancho_pieza: 0,
      alto_pieza: 0,
      ancho_plancha: 1000,
      alto_plancha: 3000,
      piezas_por_plancha: 0,
      piezas_por_plancha_rotado: 0,
      fraccion_plancha: "",
      piezas_por_producto: 0,
      error:
        esLecturaPlancha(tipoLectura)
          ? "Usa formato ((lado ancho)(lado alto))*piezas. Ej: ((61+607+61)(61+445+61))*1."
          : "Usa solo números, +, -, *, / y paréntesis."
    };
  }
};

export const PARAMETROS_DOBLEZ_CNC_3D = {
  segundos_por_metro: 5,
  segundos_por_doblez: 3,
  segundos_por_corte: 1.5,
  unidad_expresion: "mm"
};

export const PARAMETROS_CORTE_CNC_RECTO = {
  segundos_por_metro: 5,
  segundos_por_doblez: 0,
  segundos_por_corte: 1.5,
  unidad_expresion: "mm"
};

export const PARAMETROS_CORTE_PRENSA = {
  segundos_por_metro: 0,
  segundos_por_doblez: 0,
  segundos_por_corte: 2,
  unidad_expresion: "mm"
};

export const PARAMETROS_LASER_METROS_MINUTO = {
  metros_por_minuto: 8,
  segundos_por_metro: 7.5,
  segundos_por_doblez: 0,
  segundos_por_corte: 0.5,
  unidad_expresion: "mm"
};

export const PARAMETROS_SOLDADURA_MIG = {
  segundos_por_punto_mig: 3,
  segundos_por_cordon_simple: 12,
  segundos_por_cordon_perimetral: 45
};

export const analizarFormulaProceso = ({
  tipoFormula = "",
  expresion = "",
  unidadExpresion = "mm",
  segundosPorMetro = 5,
  segundosPorDoblez = 3,
  segundosPorCorte = 1.5,
  metrosPorMinuto = 0,
  puntosMig = 0,
  cordonesSimples = 0,
  cordonesPerimetrales = 0,
  segundosPorPuntoMig = 3,
  segundosPorCordonSimple = 12,
  segundosPorCordonPerimetral = 45
} = {}) => {
  const texto = (expresion || "").toString().trim();
  const formulaSoportada = [
    "doblez_cnc_3d",
    "corte_cnc_recto",
    "corte_prensa",
    "laser_metros_minuto",
    "soldadura_mig"
  ].includes(tipoFormula);

  if (!formulaSoportada) {
    return {
      valido: false,
      segundos_por_producto: 0,
      unidades_por_hora: 0,
      metros_totales: 0,
      piezas: 0,
      cortes: 0,
      cortes_por_subproducto: 0,
      subproductos: 0,
      fraccion_por_pieza: 0,
      consumo_pieza_formula: 0,
      consumo_total_formula: 0,
      cortes_por_pieza: 0,
      cortes_por_producto: 0,
      dobleces_por_producto: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      error: ""
    };
  }

  if (tipoFormula === "soldadura_mig") {
    const puntos = numero(puntosMig);
    const simples = numero(cordonesSimples);
    const perimetrales = numero(cordonesPerimetrales);
    const segundosPuntos =
      puntos * numero(segundosPorPuntoMig);
    const segundosSimples =
      simples * numero(segundosPorCordonSimple);
    const segundosPerimetrales =
      perimetrales *
      numero(segundosPorCordonPerimetral);
    const segundosPorProducto =
      segundosPuntos +
      segundosSimples +
      segundosPerimetrales;
    const unidadesHora =
      segundosPorProducto > 0
        ? 3600 / segundosPorProducto
        : 0;

    return {
      valido: true,
      segundos_por_producto: redondear(
        segundosPorProducto,
        2
      ),
      unidades_por_hora: redondear(unidadesHora, 2),
      metros_totales: 0,
      piezas: redondear(
        puntos + simples + perimetrales
      ),
      cortes: 0,
      golpes: 0,
      cortes_por_subproducto: 0,
      subproductos: 0,
      fraccion_por_pieza: 0,
      consumo_pieza_formula: 0,
      consumo_total_formula: 0,
      cortes_por_pieza: 0,
      cortes_por_producto: 0,
      dobleces_por_producto: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      detalle_tiempo: {
        puntos_mig: redondear(segundosPuntos, 2),
        cordones_simples: redondear(
          segundosSimples,
          2
        ),
        cordones_perimetrales: redondear(
          segundosPerimetrales,
          2
        )
      },
      error: ""
    };
  }

  if (!texto) {
    return {
      valido: false,
      segundos_por_producto: 0,
      unidades_por_hora: 0,
      metros_totales: 0,
      piezas: 0,
      cortes: 0,
      cortes_por_subproducto: 0,
      subproductos: 0,
      fraccion_por_pieza: 0,
      consumo_pieza_formula: 0,
      consumo_total_formula: 0,
      cortes_por_pieza: 0,
      cortes_por_producto: 0,
      dobleces_por_producto: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      error: ""
    };
  }

  const dimensionesLaser =
    tipoFormula === "laser_metros_minuto"
      ? extraerDimensionesPlancha(texto)
      : null;
  const perforadoLaser =
    tipoFormula === "laser_metros_minuto"
      ? extraerFormulaLaserPerforado(texto)
      : null;
  const analisisLaserPerforado =
    perforadoLaser
      ? (() => {
          const perforadosTotal =
            perforadoLaser.perforadosPorLado *
            perforadoLaser.lados *
            perforadoLaser.piezas;
          const totalLineal =
            perforadoLaser.corteLinealPerforado *
            perforadosTotal;

          return {
            valido: true,
            consumo_unitario: redondear(
              convertirConsumoAUnidadMaterial(
                totalLineal,
                unidadExpresion,
                "m"
              ),
              4
            ),
            piezas: perforadoLaser.piezas,
            cortes: perforadosTotal,
            golpes: 0,
            cortes_por_subproducto:
              perforadoLaser.perforadosPorLado,
            subproductos: perforadoLaser.lados,
            fraccion_por_pieza: 0,
            consumo_pieza_formula: redondear(
              perforadoLaser.corteLinealPerforado,
              4
            ),
            consumo_total_formula: redondear(
              totalLineal,
              4
            ),
            cortes_por_pieza:
              perforadoLaser.perforadosPorLado *
              perforadoLaser.lados,
            cortes_por_producto: perforadosTotal,
            dobleces_por_producto: 0,
            dobleces_por_pieza: 0,
            dobleces_total: 0,
            longitud_por_pieza: redondear(
              totalLineal / perforadoLaser.piezas,
              4
            ),
            perforado_diametro_formula: 0,
            perforados_por_lado:
              perforadoLaser.perforadosPorLado,
            lados: perforadoLaser.lados,
            perforados_total: perforadosTotal,
            error: ""
          };
        })()
      : null;
  const analisisLaserPerimetro =
    !analisisLaserPerforado && dimensionesLaser
      ? (() => {
          const ladoA = numero(
            dimensionesLaser.ladoA
          );
          const ladoB = numero(
            dimensionesLaser.ladoB
          );
          const piezas = Math.max(
            Math.round(
              numero(
                dimensionesLaser.multiplicador
              )
            ),
            1
          );
          const perimetroPieza =
            (ladoA + ladoB) * 2;
          const totalPerimetro =
            perimetroPieza * piezas;

          if (ladoA <= 0 || ladoB <= 0) {
            return null;
          }

          return {
            valido: true,
            consumo_unitario: redondear(
              convertirConsumoAUnidadMaterial(
                totalPerimetro,
                unidadExpresion,
                "m"
              ),
              4
            ),
            piezas,
            cortes: 4 * piezas,
            golpes: 0,
            cortes_por_subproducto: 4,
            subproductos: piezas,
            fraccion_por_pieza: 0,
            consumo_pieza_formula: redondear(
              perimetroPieza,
              4
            ),
            consumo_total_formula: redondear(
              totalPerimetro,
              4
            ),
            cortes_por_pieza: 4,
            cortes_por_producto: 4 * piezas,
            dobleces_por_producto: 0,
            dobleces_por_pieza: 0,
            dobleces_total: 0,
            longitud_por_pieza: redondear(
              perimetroPieza,
              4
            ),
            ancho_pieza: redondear(ladoA, 2),
            alto_pieza: redondear(ladoB, 2),
            error: ""
          };
        })()
      : null;
  const analisis = analizarExpresionConsumoMaterial({
    expresion: texto,
    unidadExpresion,
    unidadMaterial: "m",
    tipoLectura:
      tipoFormula === "doblez_cnc_3d"
        ? TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO
        : TIPOS_LECTURA_CONSUMO.CORTES_LINEALES
  });
  const analisisUsado =
    analisisLaserPerforado ||
    analisisLaserPerimetro ||
    analisis;
  const { base, multiplicador } =
    separarMultiplicadorFinal(texto);
  const piezasPorFormula =
    analisisLaserPerforado?.piezas ||
    analisisLaserPerimetro?.piezas ||
    analisisUsado.piezas ||
    Math.max(Math.round(multiplicador), 1);
  const subproductosFormula =
    analisisLaserPerforado?.subproductos ||
    analisisLaserPerimetro?.subproductos ||
    analisisUsado.subproductos ||
    piezasPorFormula;
  const cortesPorSubproducto =
    analisisLaserPerforado
      ? analisisLaserPerforado.cortes_por_subproducto
      : analisisLaserPerimetro
      ? analisisLaserPerimetro.cortes_por_subproducto
      : analisisUsado.cortes_por_subproducto ||
        contarTerminosCorte(base);
  const cortes = analisisLaserPerforado
    ? analisisLaserPerforado.cortes
    : analisisLaserPerimetro
    ? analisisLaserPerimetro.cortes
    : tipoFormula === "doblez_cnc_3d"
      ? analisisUsado.cortes || piezasPorFormula
      : analisisUsado.cortes ||
        cortesPorSubproducto * piezasPorFormula;
  const doblecesPorPieza =
    analisisLaserPerforado || analisisLaserPerimetro
      ? 0
      : tipoFormula === "doblez_cnc_3d"
        ? analisisUsado.dobleces_por_pieza ||
          contarOperador(base, "+")
        : 0;
  const doblecesTotal =
    tipoFormula === "doblez_cnc_3d"
      ? analisisUsado.dobleces_total ||
        doblecesPorPieza * piezasPorFormula
      : doblecesPorPieza * piezasPorFormula;

  if (!analisisUsado.valido) {
    return {
      ...analisisUsado,
      segundos_por_producto: 0,
      unidades_por_hora: 0,
      metros_totales: 0
    };
  }

  const metrosTotales = numero(
    analisisUsado.consumo_unitario
  );
  const metrosMinuto = numero(metrosPorMinuto);
  const segundosPorMetroLaser =
    metrosMinuto > 0
      ? 60 / metrosMinuto
      : numero(segundosPorMetro);
  const segundosAvance =
    tipoFormula === "corte_prensa"
      ? 0
      : metrosTotales *
        (tipoFormula === "laser_metros_minuto"
          ? segundosPorMetroLaser
          : numero(segundosPorMetro));
  const segundosDobleces =
    tipoFormula === "doblez_cnc_3d"
      ? numero(doblecesTotal) *
        numero(segundosPorDoblez)
      : 0;
  const segundosCortes =
    numero(cortes) *
    numero(segundosPorCorte);
  const segundosPorProducto =
    segundosAvance +
    segundosDobleces +
    segundosCortes;
  const unidadesHora =
    segundosPorProducto > 0
      ? 3600 / segundosPorProducto
      : 0;

  return {
    valido: true,
    segundos_por_producto: redondear(
      segundosPorProducto,
      2
    ),
    unidades_por_hora: redondear(unidadesHora, 2),
    metros_totales: redondear(metrosTotales, 4),
    piezas: piezasPorFormula,
    cortes,
    golpes:
      tipoFormula === "corte_prensa" ? cortes : 0,
    cortes_por_subproducto: cortesPorSubproducto,
    subproductos: subproductosFormula,
    fraccion_por_pieza: 0,
    consumo_pieza_formula:
      analisisUsado.consumo_pieza_formula || 0,
    consumo_total_formula:
      analisisUsado.consumo_total_formula || 0,
    cortes_por_pieza:
      analisisUsado.cortes_por_pieza || 0,
    cortes_por_producto:
      analisisUsado.cortes_por_producto || 0,
    dobleces_por_producto: doblecesTotal,
    dobleces_por_pieza: doblecesPorPieza,
    dobleces_total: doblecesTotal,
    longitud_por_pieza:
      analisisUsado.longitud_por_pieza,
    detalle_tiempo: {
      avance: redondear(segundosAvance, 2),
      dobleces: redondear(segundosDobleces, 2),
      cortes: redondear(segundosCortes, 2)
    },
    error: ""
  };
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

export const calcularDetalleMaterialesCotizacion = (
  materiales = [],
  cantidad = 1
) =>
  materiales.map(material => {
    const consumo = numero(material.consumo_unitario);
    const merma = numero(material.merma_porcentaje) / 100;
    const precio = numero(material.costo_unitario);
    const pesoKgPorUnidad = numero(
      material.peso_kg_por_unidad
    );
    const minimoCompra = numero(material.minimo_compra);
    const requerido = consumo * cantidad * (1 + merma);
    const compra =
      material.politica_minimo_compra === "consumo_real"
        ? requerido
        : Math.max(requerido, minimoCompra);
    const costo = compra * precio;
    const pesoNeto = consumo * cantidad * pesoKgPorUnidad;
    const pesoConMerma =
      requerido * pesoKgPorUnidad;

    return {
      tipo_linea:
        material.tipo_linea || "material",
      codigo: material.codigo || "",
      nombre: material.nombre || "",
      unidad: material.unidad || "",
      expresion_consumo:
        material.expresion_consumo || "",
      consumo_unitario: redondear(consumo, 6),
      consumo_requerido: redondear(requerido, 6),
      cantidad_comprada: redondear(compra, 6),
      merma_porcentaje: redondear(
        numero(material.merma_porcentaje),
        2
      ),
      costo_unitario: redondear(precio, 2),
      costo_material: redondear(costo, 2),
      peso_kg_por_unidad: redondear(
        pesoKgPorUnidad,
        6
      ),
      peso_material_kg: redondear(pesoNeto, 6),
      peso_requerido_kg: redondear(
        pesoConMerma,
        6
      ),
      tipo_formula_consumo:
        material.tipo_formula_consumo || "",
      formula_material_codigo:
        material.formula_material_codigo || "",
      formula_material_nombre:
        material.formula_material_nombre || "",
      area_m2_por_producto: redondear(
        material.area_m2_por_producto,
        6
      ),
      consumo_tinta_ml_por_m2: redondear(
        material.consumo_tinta_ml_por_m2,
        6
      ),
      consumo_tinta_ml_total: redondear(
        material.consumo_tinta_ml_total,
        6
      ),
      politica_minimo_compra:
        material.politica_minimo_compra ||
        "cobrar_minimo"
    };
  });

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

export const calcularHorasCuelloBotella = (
  procesos = [],
  cantidad = 1
) =>
  procesos.reduce(
    (mayor, proceso) =>
      Math.max(
        mayor,
        calcularHorasProceso(proceso, cantidad)
      ),
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
      tipo_formula_tiempo:
        proceso.tipo_formula_tiempo || "",
      formula_tiempo: proceso.formula_tiempo || "",
      formula_material_id:
        proceso.formula_material_id || "",
      formula_material_codigo:
        proceso.formula_material_codigo || "",
      formula_material_nombre:
        proceso.formula_material_nombre || "",
      metros_por_minuto: redondear(
        proceso.metros_por_minuto,
        2
      ),
      puntos_mig: redondear(proceso.puntos_mig),
      cordones_simples: redondear(
        proceso.cordones_simples
      ),
      cordones_perimetrales: redondear(
        proceso.cordones_perimetrales
      ),
      segundos_por_producto: redondear(
        proceso.segundos_por_producto,
        2
      ),
      unidades_por_hora: redondear(
        proceso.unidades_por_hora,
        2
      ),
      metros_totales_calculados: redondear(
        proceso.metros_totales_calculados,
        4
      ),
      cortes_calculados: redondear(
        proceso.cortes_calculados
      ),
      golpes_calculados: redondear(
        proceso.golpes_calculados
      ),
      dobleces_total: redondear(
        proceso.dobleces_total
      ),
      formula_tiempo_detalle:
        proceso.formula_tiempo_detalle || null,
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
  moneda = "CLP",
  tipo_cambio_clp_usd = 0,
  indirectos_porcentaje = 18,
  costo_operativo_hora = 0,
  margen_porcentaje = 35,
  tipo_margen = "margen_bruto",
  dias_compra = 0,
  dias_ingenieria = 0,
  horas_disponibles_dia = 14,
  desfase_flujo_horas = 2,
  factor_riesgo_porcentaje = 0,
  exportacion = {}
} = {}) => {
  const escalasPreparadas = prepararEscalas(escalas);
  const indirectos = numero(indirectos_porcentaje) / 100;
  const margen = numero(margen_porcentaje) / 100;
  const riesgo = numero(factor_riesgo_porcentaje) / 100;
  const monedaCotizacion = (moneda || "CLP")
    .toString()
    .toUpperCase();
  const tipoCambioClpUsd = numero(tipo_cambio_clp_usd);
  const convertirCostoBase = valor =>
    monedaCotizacion === "USD" && tipoCambioClpUsd > 0
      ? numero(valor) / tipoCambioClpUsd
      : numero(valor);
  const convertirDetalle = detalle => ({
    ...detalle,
    costo_material: convertirCostoBase(
      detalle.costo_material
    ),
    costo_requerido: convertirCostoBase(
      detalle.costo_requerido
    ),
    costo_unitario: convertirCostoBase(
      detalle.costo_unitario
    )
  });
  const convertirDetalleProceso = detalle => ({
    ...detalle,
    costo_proceso: convertirCostoBase(
      detalle.costo_proceso
    ),
    costo_operativo: convertirCostoBase(
      detalle.costo_operativo
    ),
    costo_hora: convertirCostoBase(detalle.costo_hora)
  });
  const incoterm = (exportacion.incoterm || "")
    .toString()
    .toUpperCase();
  const cotizarExportacion =
    INCOTERMS_CON_EXPORTACION.has(incoterm);
  const diasExportacion = cotizarExportacion
    ? numero(exportacion.dias_preparacion_exportacion) +
      numero(exportacion.dias_transito)
    : 0;
  const horasDia =
    Math.max(numero(horas_disponibles_dia), 1);

  return escalasPreparadas.map(cantidad => {
    const costoMaterialesBase = calcularCostoMateriales(
      materiales,
      cantidad
    );
    const costoMaterialesUnidadBase =
      calcularCostoMateriales(materiales, 1);
    const detalleMaterialesBase =
      calcularDetalleMaterialesCotizacion(
        materiales,
        cantidad
      );
    const detalleMaterialesUnidadBase =
      calcularDetalleMaterialesCotizacion(
        materiales,
        1
      );
    const costoMateriales = convertirCostoBase(
      costoMaterialesBase
    );
    const costoMaterialesUnidad = convertirCostoBase(
      costoMaterialesUnidadBase
    );
    const detalleMateriales =
      detalleMaterialesBase.map(convertirDetalle);
    const detalleMaterialesUnidad =
      detalleMaterialesUnidadBase.map(convertirDetalle);
    const pesoUnitarioKg =
      detalleMaterialesUnidad.reduce(
        (total, detalle) =>
          total + numero(detalle.peso_material_kg),
        0
      );
    const pesoUnitarioRequeridoKg =
      detalleMaterialesUnidad.reduce(
        (total, detalle) =>
          total + numero(detalle.peso_requerido_kg),
        0
      );
    const costoProcesosBase = calcularCostoProcesos(
      procesos,
      cantidad
    );
    const detalleProcesosBase =
      calcularDetalleProcesosCotizacion(
        procesos,
        cantidad,
        costo_operativo_hora
      );
    const costoProcesos = convertirCostoBase(
      costoProcesosBase
    );
    const detalleProcesos =
      detalleProcesosBase.map(convertirDetalleProceso);
    const horasProduccion = calcularHorasProcesos(
      procesos,
      cantidad
    );
    const horasCuelloBotella =
      calcularHorasCuelloBotella(
        procesos,
        cantidad
      );
    const procesosConTiempo =
      detalleProcesos.filter(
        proceso => numero(proceso.horas) > 0
      ).length;
    const horasDesfaseFlujo =
      Math.max(procesosConTiempo - 1, 0) *
      Math.max(numero(desfase_flujo_horas), 0);
    const horasFlujo =
      horasCuelloBotella + horasDesfaseFlujo;
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
    const precioTotal = precioUnitario * cantidad;
    const logisticaExportacion =
      calcularLogisticaExportacion({
        exportacion: {
          ...exportacion,
          incoterm
        },
        cantidad,
        costoBaseMercaderia: precioTotal,
        pesoUnitarioKg
      });
    const costoExportacionBase =
      logisticaExportacion.costo_exportacion;
    const costoTotalCip =
      costoTotal + costoExportacionBase;
    const costoUnitarioCip =
      costoTotalCip / cantidad;
    const precioUnitarioCip =
      tipo_margen === "markup"
        ? costoUnitarioCip * (1 + margen)
        : margen >= 1
          ? costoUnitarioCip
          : costoUnitarioCip / (1 - margen);
    const precioTotalCip =
      precioUnitarioCip * cantidad;
    const utilidad =
      precioTotal - costoTotal;
    const utilidadCip =
      precioTotalCip - costoTotalCip;
    const basePorcentaje =
      precioTotal > 0 ? precioTotal : costoTotal;
    const porcentajeSobreBase = valor =>
      basePorcentaje > 0
        ? redondear((numero(valor) / basePorcentaje) * 100, 2)
        : 0;
    const detalleMaterialesConPorcentaje =
      detalleMateriales.map(detalle => ({
        ...detalle,
        porcentaje_costo:
          costoMateriales > 0
            ? redondear(
                (numero(detalle.costo_material) /
                  costoMateriales) *
                  100,
                2
              )
            : 0,
        porcentaje_precio:
          porcentajeSobreBase(detalle.costo_material)
      }));
    const detalleMaterialesUnitarioConPorcentaje =
      detalleMaterialesUnidad.map(detalle => ({
        ...detalle,
        porcentaje_costo:
          costoMaterialesUnidad > 0
            ? redondear(
                (numero(detalle.costo_material) /
                  costoMaterialesUnidad) *
                  100,
                2
              )
            : 0,
        porcentaje_precio:
          precioUnitario > 0
            ? redondear(
                (numero(detalle.costo_material) /
                  precioUnitario) *
                  100,
                2
              )
            : 0
      }));
    const detalleProcesosConPorcentaje =
      detalleProcesos.map(detalle => ({
        ...detalle,
        porcentaje_costo:
          costoProcesos > 0
            ? redondear(
                (numero(detalle.costo_proceso) /
                  costoProcesos) *
                  100,
                2
              )
            : 0,
        porcentaje_precio:
          porcentajeSobreBase(detalle.costo_proceso)
      }));
    const leadTimeConservadorDias =
      numero(dias_compra) +
      numero(dias_ingenieria) +
      Math.ceil(horasProduccion / horasDia);
    const leadTimeFlujoDias =
      numero(dias_compra) +
      numero(dias_ingenieria) +
      Math.ceil(horasFlujo / horasDia);
    const leadTimeCipDias =
      leadTimeFlujoDias + diasExportacion;

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
        precioTotal
      ),
      costo_exportacion: redondear(costoExportacionBase),
      costo_exportacion_unitario: redondear(
        costoExportacionBase / cantidad
      ),
      logistica_exportacion: logisticaExportacion,
      costo_total_cip: redondear(costoTotalCip),
      costo_unitario_cip: redondear(costoUnitarioCip),
      precio_unitario_cip_sugerido: redondear(
        precioUnitarioCip
      ),
      precio_total_cip_sugerido: redondear(
        precioTotalCip
      ),
      utilidad_cip: redondear(utilidadCip),
      utilidad_cip_porcentaje:
        precioTotalCip > 0
          ? redondear(
              (utilidadCip / precioTotalCip) * 100,
              2
            )
          : 0,
      peso_unitario_kg: redondear(
        pesoUnitarioKg,
        4
      ),
      peso_unitario_requerido_kg: redondear(
        pesoUnitarioRequeridoKg,
        4
      ),
      peso_total_kg: redondear(
        pesoUnitarioKg * cantidad,
        4
      ),
      utilidad: redondear(utilidad),
      utilidad_porcentaje:
        precioTotal > 0
          ? redondear((utilidad / precioTotal) * 100, 2)
          : 0,
      composicion_costos: {
        materiales: porcentajeSobreBase(costoMateriales),
        mano_obra_procesos:
          porcentajeSobreBase(costoProcesos),
        costos_fijos:
          porcentajeSobreBase(costoOperativo),
        indirectos:
          porcentajeSobreBase(costoIndirecto),
        riesgo: porcentajeSobreBase(costoRiesgo),
        utilidad: porcentajeSobreBase(utilidad)
      },
      horas_produccion: redondear(horasProduccion, 1),
      horas_cuello_botella: redondear(
        horasCuelloBotella,
        1
      ),
      horas_desfase_flujo: redondear(
        horasDesfaseFlujo,
        1
      ),
      horas_flujo: redondear(horasFlujo, 1),
      detalle_materiales:
        detalleMaterialesConPorcentaje,
      detalle_materiales_unitario:
        detalleMaterialesUnitarioConPorcentaje,
      detalle_procesos:
        detalleProcesosConPorcentaje,
      lead_time_dias: leadTimeFlujoDias,
      lead_time_flujo_dias: leadTimeFlujoDias,
      lead_time_conservador_dias:
        leadTimeConservadorDias,
      lead_time_cip_dias: leadTimeCipDias
    };
  });
};
