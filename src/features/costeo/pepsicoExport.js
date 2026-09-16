import * as XLSX from "xlsx";

const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
};

const redondear = (valor, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round(numero(valor) * factor) / factor;
};

const normalizar = valor =>
  (valor || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const PAISES_PEPSICO = [
  "Chile",
  "Argentina",
  "Uruguay",
  "Paraguay"
];

export const CATEGORIAS_PEPSICO = [
  { clave: "alambre", etiqueta: "Alambre" },
  { clave: "tubo", etiqueta: "Tubo" },
  { clave: "lamina", etiqueta: "Lámina" },
  { clave: "pintura", etiqueta: "Pintura" },
  { clave: "madera", etiqueta: "Madera" },
  { clave: "termoformado", etiqueta: "Termoformado" },
  { clave: "pellet_virgen", etiqueta: "Pellet Virgen" },
  { clave: "pellet_reciclado", etiqueta: "Pellet Reciclado" },
  { clave: "postes_mep", etiqueta: "Postes de MEP" },
  { clave: "herramentales", etiqueta: "Herramentales" },
  { clave: "accesorios", etiqueta: "Conjunto de accesorios" },
  { clave: "cabezote", etiqueta: "Cabezote (Header)" },
  { clave: "laterales", etiqueta: "Laterales" },
  { clave: "cenefas", etiqueta: "Cenefas" },
  { clave: "empaque", etiqueta: "Empaque" }
];

export const ENCABEZADOS_PEPSICO = [
  "País",
  "TIPO DE EXHIBIDOR",
  "LINK DE PLANOS",
  "CON GRÁFICOS LATERALES",
  "Volúmen",
  "Alambre",
  "Tubo",
  "Lámina",
  "Pintura",
  "Madera",
  "Termoformado",
  "Pellet Virgen",
  "Pellet Reciclado",
  "Postes de MEP",
  "Total MP",
  "Herramentales",
  "Conjunto de accesorios (Pushpins, tornillería, regatones, etc.)",
  "Cabezote (Header)",
  "Laterales",
  "Cenefas",
  "Empaque",
  "Total Accesorios",
  "Mano de Obra",
  "Gastos fijos y operacionales",
  "Total Gastos de Produccion",
  "UTILIDAD",
  "Costo Total EXW",
  "Flete y Gastos Asociados",
  "Costo Total CIF",
  "Flete y Gastos Asociados",
  "Costo Total DDP",
  "Si requieres agregar algun concepto adicional hazlo en esta columna ",
  "Describir concepto(s) adicionales",
  "Producción mínima semanal en volumen de racks",
  "Tiempo de entrega a partir de OC ",
  "Moneda de cotización",
  "Comentarios",
  "Total MP\n(Materia Prima)",
  "Pintura",
  "Accesorios",
  "GASTOS DE PRODUCCIÓN",
  "UTILIDAD",
  "TOTAL"
];

export const inferirCategoriaPepsico = material => {
  if (material?.categoria_pepsico) {
    return material.categoria_pepsico;
  }

  const texto = normalizar([
    material?.codigo,
    material?.nombre
  ].filter(Boolean).join(" "));

  if (texto.includes("alambre")) return "alambre";
  if (texto.includes("tubo")) return "tubo";
  if (texto.includes("pintura") || texto.includes("tinta")) return "pintura";
  if (texto.includes("madera") || texto.includes("mdf")) return "madera";
  if (texto.includes("termoform")) return "termoformado";
  if (texto.includes("pellet") && texto.includes("recicl")) return "pellet_reciclado";
  if (texto.includes("pellet")) return "pellet_virgen";
  if (texto.includes("poste") && texto.includes("mep")) return "postes_mep";
  if (texto.includes("herramental") || texto.includes("matriz")) return "herramentales";
  if (texto.includes("cabezote") || texto.includes("header")) return "cabezote";
  if (texto.includes("lateral") || texto.includes("pai")) return "laterales";
  if (texto.includes("cenefa")) return "cenefas";
  if (
    texto.includes("empaque") ||
    texto.includes("caja") ||
    texto.includes("embalaje") ||
    texto.includes("pallet") ||
    texto.includes("sum0016") ||
    texto.includes("sum0038")
  ) return "empaque";
  if (texto.includes("lamina") || texto.includes("plancha") || texto.includes("laf")) return "lamina";
  if ((material?.tipo_linea || "material") === "suministro") return "accesorios";
  return "";
};

export const obtenerPaisCotizacion = cotizacion => {
  const paisGuardado = cotizacion?.datos_pepsico?.pais ||
    cotizacion?.pais_cotizacion ||
    cotizacion?.supuestos?.exportacion?.pais_destino;
  return PAISES_PEPSICO.includes(paisGuardado)
    ? paisGuardado
    : "Chile";
};

export const obtenerMonedaPais = pais =>
  pais === "Chile" ? "CLP" : "USD";

export const claveFilaPepsico = (cotizacionId, cantidad) =>
  `${cotizacionId || "actual"}::${cantidad}`;

const obtenerDatosPepsico = cotizacion => ({
  link_planos:
    cotizacion?.datos_pepsico?.link_planos ||
    cotizacion?.link_planos || "",
  graficos_laterales:
    cotizacion?.datos_pepsico?.graficos_laterales ||
    cotizacion?.graficos_laterales || "NO",
  produccion_minima_semanal:
    cotizacion?.datos_pepsico?.produccion_minima_semanal ??
    cotizacion?.produccion_minima_semanal ?? "",
  plazo_entrega_comercial:
    cotizacion?.datos_pepsico?.plazo_entrega_comercial ||
    cotizacion?.plazo_entrega_comercial || "",
  concepto_adicional:
    numero(
      cotizacion?.datos_pepsico?.concepto_adicional ??
      cotizacion?.concepto_adicional
    ),
  concepto_adicional_descripcion:
    cotizacion?.datos_pepsico?.concepto_adicional_descripcion ||
    cotizacion?.concepto_adicional_descripcion || "",
  concepto_adicional_aplicacion:
    cotizacion?.datos_pepsico?.concepto_adicional_aplicacion ||
    cotizacion?.concepto_adicional_aplicacion || "exw",
  flete_cif_unitario:
    numero(
      cotizacion?.datos_pepsico?.flete_cif_unitario ??
      cotizacion?.flete_cif_unitario
    ),
  flete_ddp_unitario:
    numero(
      cotizacion?.datos_pepsico?.flete_ddp_unitario ??
      cotizacion?.flete_ddp_unitario
    ),
  comentarios:
    cotizacion?.datos_pepsico?.comentarios ||
    cotizacion?.comentarios_pepsico || ""
});

export const crearFilaPepsico = ({ cotizacion, resultado }) => {
  const cantidad = Math.max(numero(resultado?.cantidad), 1);
  const pais = obtenerPaisCotizacion(cotizacion);
  const moneda = obtenerMonedaPais(pais);
  const datos = obtenerDatosPepsico(cotizacion);
  const materiales = Array.isArray(cotizacion?.materiales)
    ? cotizacion.materiales
    : [];
  const detalles = Array.isArray(resultado?.detalle_materiales)
    ? resultado.detalle_materiales
    : [];
  const categorias = Object.fromEntries(
    CATEGORIAS_PEPSICO.map(item => [item.clave, 0])
  );
  const pendientes = [];

  if (!cotizacion?.nombre_producto) {
    pendientes.push("Falta el nombre del producto");
  }
  if (
    cotizacion?.moneda &&
    cotizacion.moneda.toUpperCase() !== moneda
  ) {
    pendientes.push(
      `La cotización está guardada en ${cotizacion.moneda}; ${pais} debe exportarse en ${moneda}`
    );
  }

  detalles.forEach((detalle, indice) => {
    const material = materiales[indice] || detalle;
    const categoria = inferirCategoriaPepsico(material);
    const costoUnitario = numero(detalle?.costo_material) / cantidad;
    if (!categoria && costoUnitario > 0) {
      pendientes.push(
        `${material?.codigo || "Sin código"} - ${material?.nombre || "Material sin nombre"}`
      );
      return;
    }
    if (categoria in categorias) {
      categorias[categoria] += costoUnitario;
    }
  });

  Object.keys(categorias).forEach(clave => {
    categorias[clave] = redondear(categorias[clave]);
  });

  const totalMp = redondear(
    ["alambre", "tubo", "lamina", "pintura", "madera", "termoformado", "pellet_virgen", "pellet_reciclado", "postes_mep"]
      .reduce((total, clave) => total + categorias[clave], 0)
  );
  const totalAccesorios = redondear(
    ["herramentales", "accesorios", "cabezote", "laterales", "cenefas", "empaque"]
      .reduce((total, clave) => total + categorias[clave], 0)
  );
  const manoObra = redondear(numero(resultado?.costo_procesos) / cantidad);
  const gastosProduccionBase = redondear(
    (
      numero(resultado?.costo_operativo) +
      numero(resultado?.costo_indirecto) +
      numero(resultado?.costo_riesgo)
    ) / cantidad
  );
  const adicionalExw = datos.concepto_adicional_aplicacion === "exw"
    ? datos.concepto_adicional
    : 0;
  const gastosProduccion = redondear(gastosProduccionBase + adicionalExw);
  const totalProduccion = redondear(manoObra + gastosProduccion);
  const utilidad = redondear(numero(resultado?.utilidad) / cantidad);
  const exw = redondear(totalMp + totalAccesorios + totalProduccion + utilidad);
  if (exw <= 0) {
    pendientes.push("El costo EXW aún no está calculado");
  }
  const fleteCalculado = pais === "Chile"
    ? 0
    : numero(resultado?.costo_exportacion_unitario);
  const fleteCif = redondear(
    (datos.flete_cif_unitario || fleteCalculado) +
    (datos.concepto_adicional_aplicacion === "cif" ? datos.concepto_adicional : 0)
  );
  const cif = redondear(exw + fleteCif);
  const fleteDdp = redondear(
    datos.flete_ddp_unitario +
    (datos.concepto_adicional_aplicacion === "ddp" ? datos.concepto_adicional : 0)
  );
  const ddp = redondear(cif + fleteDdp);
  const porcentaje = valor => exw > 0
    ? redondear(valor / exw, 6)
    : null;
  const plazo = datos.plazo_entrega_comercial ||
    (resultado?.lead_time_cip_dias ||
      resultado?.lead_time_flujo_dias ||
      resultado?.lead_time_dias
      ? `${resultado?.lead_time_cip_dias || resultado?.lead_time_flujo_dias || resultado?.lead_time_dias} días`
      : "");

  return {
    clave: claveFilaPepsico(cotizacion?.id, resultado?.cantidad),
    cotizacion_id: cotizacion?.id || "",
    pais,
    producto: cotizacion?.nombre_producto || "",
    link_planos: datos.link_planos,
    graficos_laterales: datos.graficos_laterales === "SI" ? "SI" : "NO",
    cantidad: numero(resultado?.cantidad),
    categorias,
    total_mp: totalMp,
    total_accesorios: totalAccesorios,
    mano_obra: manoObra,
    gastos_produccion: gastosProduccion,
    total_produccion: totalProduccion,
    utilidad,
    exw,
    flete_cif: fleteCif,
    cif,
    flete_ddp: fleteDdp,
    ddp,
    concepto_adicional: datos.concepto_adicional,
    concepto_adicional_descripcion: datos.concepto_adicional_descripcion,
    produccion_minima_semanal: datos.produccion_minima_semanal,
    plazo_entrega: plazo,
    moneda,
    comentarios: datos.comentarios,
    porcentajes: {
      materia_prima_sin_pintura: porcentaje(totalMp - categorias.pintura),
      pintura: porcentaje(categorias.pintura),
      accesorios: porcentaje(totalAccesorios),
      produccion: porcentaje(totalProduccion),
      utilidad: porcentaje(utilidad),
      total: exw > 0 ? 1 : null
    },
    pendientes,
    cuadra_exw: Math.abs(
      exw - redondear(totalMp + totalAccesorios + totalProduccion + utilidad)
    ) < 0.02
  };
};

const ordenPais = pais => {
  const indice = PAISES_PEPSICO.indexOf(pais);
  return indice === -1 ? PAISES_PEPSICO.length : indice;
};

export const crearFilasPepsico = (
  cotizaciones = [],
  clavesSeleccionadas = null
) => {
  const seleccion = clavesSeleccionadas
    ? new Set(clavesSeleccionadas)
    : null;

  return cotizaciones
    .flatMap(cotizacion =>
      (cotizacion?.resultados || []).map(resultado =>
        crearFilaPepsico({ cotizacion, resultado })
      )
    )
    .filter(fila => !seleccion || seleccion.has(fila.clave))
    .sort((a, b) =>
      ordenPais(a.pais) - ordenPais(b.pais) ||
      a.producto.localeCompare(b.producto, "es") ||
      a.cantidad - b.cantidad
    );
};

export const filaAValoresPepsico = fila => [
  fila.pais,
  fila.producto,
  fila.link_planos,
  fila.graficos_laterales,
  fila.cantidad,
  fila.categorias.alambre,
  fila.categorias.tubo,
  fila.categorias.lamina,
  fila.categorias.pintura,
  fila.categorias.madera,
  fila.categorias.termoformado,
  fila.categorias.pellet_virgen,
  fila.categorias.pellet_reciclado,
  fila.categorias.postes_mep,
  fila.total_mp,
  fila.categorias.herramentales,
  fila.categorias.accesorios,
  fila.categorias.cabezote,
  fila.categorias.laterales,
  fila.categorias.cenefas,
  fila.categorias.empaque,
  fila.total_accesorios,
  fila.mano_obra,
  fila.gastos_produccion,
  fila.total_produccion,
  fila.utilidad,
  fila.exw,
  fila.flete_cif,
  fila.cif,
  fila.flete_ddp,
  fila.ddp,
  fila.concepto_adicional || "",
  fila.concepto_adicional_descripcion,
  fila.produccion_minima_semanal,
  fila.plazo_entrega,
  fila.moneda,
  fila.comentarios,
  fila.porcentajes.materia_prima_sin_pintura,
  fila.porcentajes.pintura,
  fila.porcentajes.accesorios,
  fila.porcentajes.produccion,
  fila.porcentajes.utilidad,
  fila.porcentajes.total
];

const aplicarFormula = (hoja, filaExcel, columna, formula, valor) => {
  const direccion = XLSX.utils.encode_cell({ r: filaExcel - 1, c: columna });
  hoja[direccion] = { t: "n", f: formula, v: numero(valor) };
};

export const crearLibroPepsico = filas => {
  const datos = [
    ENCABEZADOS_PEPSICO,
    ...filas.map(filaAValoresPepsico)
  ];
  const hoja = XLSX.utils.aoa_to_sheet(datos);

  filas.forEach((fila, indice) => {
    const r = indice + 2;
    aplicarFormula(hoja, r, 14, `SUM(F${r}:N${r})`, fila.total_mp);
    aplicarFormula(hoja, r, 21, `SUM(P${r}:U${r})`, fila.total_accesorios);
    aplicarFormula(hoja, r, 24, `W${r}+X${r}`, fila.total_produccion);
    aplicarFormula(hoja, r, 26, `O${r}+V${r}+Y${r}+Z${r}`, fila.exw);
    aplicarFormula(hoja, r, 28, `AA${r}+AB${r}`, fila.cif);
    aplicarFormula(hoja, r, 30, `AC${r}+AD${r}`, fila.ddp);
    aplicarFormula(hoja, r, 37, `IF(AA${r}=0,"",(O${r}-I${r})/AA${r})`, fila.porcentajes.materia_prima_sin_pintura);
    aplicarFormula(hoja, r, 38, `IF(AA${r}=0,"",I${r}/AA${r})`, fila.porcentajes.pintura);
    aplicarFormula(hoja, r, 39, `IF(AA${r}=0,"",V${r}/AA${r})`, fila.porcentajes.accesorios);
    aplicarFormula(hoja, r, 40, `IF(AA${r}=0,"",Y${r}/AA${r})`, fila.porcentajes.produccion);
    aplicarFormula(hoja, r, 41, `IF(AA${r}=0,"",Z${r}/AA${r})`, fila.porcentajes.utilidad);
    aplicarFormula(hoja, r, 42, `IF(AA${r}=0,"",SUM(AL${r}:AP${r}))`, fila.porcentajes.total);

    const formatoMoneda = fila.moneda === "CLP"
      ? "#,##0"
      : '"US$"#,##0.00';
    for (let columna = 5; columna <= 31; columna += 1) {
      const direccion = XLSX.utils.encode_cell({ r: r - 1, c: columna });
      if (hoja[direccion]) hoja[direccion].z = formatoMoneda;
    }
    for (let columna = 37; columna <= 42; columna += 1) {
      const direccion = XLSX.utils.encode_cell({ r: r - 1, c: columna });
      if (hoja[direccion]) hoja[direccion].z = "0%";
    }
  });

  hoja["!cols"] = ENCABEZADOS_PEPSICO.map((encabezado, indice) => ({
    wch: indice === 2 ? 34 : Math.min(Math.max(encabezado.length / 2, 12), 28)
  }));
  hoja["!autofilter"] = { ref: `A1:AQ${Math.max(filas.length + 1, 2)}` };

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Costos PepsiCo");
  return libro;
};

export const descargarExcelPepsico = (
  filas,
  nombre = "Costos_PepsiCo_SoCo.xlsx"
) => {
  const pendientes = filas.flatMap(fila =>
    fila.pendientes.map(material => `${fila.producto}: ${material}`)
  );
  if (pendientes.length > 0) {
    throw new Error(
      `Corrige estos pendientes antes de exportar: ${pendientes.slice(0, 5).join("; ")}${pendientes.length > 5 ? "…" : ""}`
    );
  }
  if (filas.length === 0) {
    throw new Error("Selecciona al menos una cotización o cantidad.");
  }
  XLSX.writeFile(crearLibroPepsico(filas), nombre, {
    compression: true
  });
};
