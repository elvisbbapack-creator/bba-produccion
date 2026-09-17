import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  APLICACIONES_CORTE_LASER,
  listarMateriales
} from "../materiales/materialesRepository";
import {
  aCatalogoProcesosRuta,
  listarProcesosEstaciones
} from "../procesos/procesosRepository";
import {
  TIPOS_TERCERO,
  listarTerceros
} from "../terceros/tercerosRepository";
import {
  listarCostosBaseEstacion
} from "../costosBase/costosBaseRepository";
import {
  listarCostosOperativos
} from "../costosOperativos/costosOperativosRepository";
import {
  analizarExpresionConsumoMaterial,
  analizarFormulaProceso,
  calcularLogisticaExportacion,
  calcularCajaCorrugada,
  calcularConsumoTintaUvCmykDesdePlancha,
  calcularCotizacionTecnica,
  CONSUMO_TINTA_UV_CMYK_ML_M2,
  TIPOS_LECTURA_CONSUMO,
  TIPO_FORMULA_CAJA_CORRUGADA,
  TIPO_FORMULA_PALLET
} from "./costeoCalculos";
import {
  ESTADOS_COTIZACION,
  NIVELES_CONFIANZA,
  aFormularioCotizacionTecnica,
  actualizarCotizacionTecnica,
  guardarCotizacionTecnica,
  listarCotizacionesTecnicas
} from "./costeoRepository";
import {
  esEstacionSoldaduraMig
} from "./costeoEstaciones";
import {
  obtenerTipoCambioClpUsdActual,
  TIPO_CAMBIO_CLP_USD_FALLBACK
} from "./tipoCambio";
import {
  CATEGORIAS_PEPSICO,
  ENCABEZADOS_PEPSICO,
  PAISES_PEPSICO,
  claveFilaPepsico,
  crearFilasPepsico,
  descargarExcelPepsico,
  filaAValoresPepsico,
  inferirCategoriaPepsico
} from "./pepsicoExport";
import {
  calcularEscenariosMultipais,
  crearEscenariosPaisIniciales,
  normalizarEscenariosPais
} from "./escenariosMultipais";

const campo = {
  width: "100%",
  padding: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 10,
  boxSizing: "border-box"
};

const boton = {
  padding: "11px 14px",
  border: "none",
  borderRadius: 10,
  background: "#1976D2",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

const botonSecundario = {
  ...boton,
  background: "#455A64"
};

const ayudaCampo = {
  color: "#64748B",
  fontSize: 12,
  lineHeight: 1.35,
  marginTop: 4
};

const etiquetaCampo = {
  display: "block",
  fontWeight: "bold",
  color: "#334155",
  marginBottom: 5
};

const cardCotizador = {
  background: "white",
  padding: 20,
  borderRadius: 16,
  border: "2px solid #CBD5E1",
  boxShadow:
    "0 10px 24px rgba(15,23,42,0.10)",
  marginBottom: 22,
  position: "relative",
  overflow: "hidden"
};

const franjaCard = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 6,
  background:
    "linear-gradient(90deg, #1976D2, #60A5FA)"
};

const resumenDesplegable = {
  cursor: "pointer",
  listStyle: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "4px 0",
  color: "#0F172A"
};

const SeccionDesplegable = ({
  titulo,
  resumen,
  abierta = false,
  clave,
  estilo,
  children
}) => {
  const [estaAbierta, setEstaAbierta] = useState(abierta);

  useEffect(() => {
    setEstaAbierta(abierta);
  }, [abierta, clave]);

  return (
    <details
      open={estaAbierta}
      onToggle={evento =>
        setEstaAbierta(evento.currentTarget.open)
      }
      style={{ ...cardCotizador, ...estilo }}
    >
      <summary style={resumenDesplegable}>
        <span style={{ fontSize: 19, fontWeight: "bold" }}>
          {titulo}
        </span>
        <span style={{
          color: "#64748B",
          fontSize: 13,
          fontWeight: "bold",
          textAlign: "right"
        }}>
          {resumen}
        </span>
      </summary>
      <div style={franjaCard} />
      <div style={{ paddingTop: 14 }}>{children}</div>
    </details>
  );
};

const lineaCotizador = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
  padding: 14,
  background: "#F8FAFC",
  borderRadius: 14,
  border: "1px solid #CBD5E1",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
  marginBottom: 12
};

const paginaCotizador = {
  padding: "20px clamp(14px, 2vw, 32px)",
  maxWidth: 1680,
  margin: "0 auto"
};

const CampoConAyuda = ({
  etiqueta,
  ayuda,
  children
}) => (
  <label>
    <span style={etiquetaCampo}>{etiqueta}</span>
    {children}
    <div style={ayudaCampo}>{ayuda}</div>
  </label>
);

const estadoInicial = {
  cliente_id: "",
  cliente_codigo: "",
  cliente: "",
  nombre_producto: "",
  version: "V1",
  planta_id: "chile",
  estado: "borrador",
  nivel_confianza: "media",
  moneda: "CLP",
  tipo_cambio_clp_usd: 915,
  descripcion: "",
  riesgos: "",
  pais_cotizacion: "Chile",
  link_planos: "",
  graficos_laterales: "NO",
  produccion_minima_semanal: 0,
  plazo_entrega_comercial: "",
  concepto_adicional: 0,
  concepto_adicional_descripcion: "",
  concepto_adicional_aplicacion: "exw",
  flete_cif_unitario: 0,
  flete_ddp_unitario: 0,
  comentarios_pepsico: "",
  cotizacion_multipais: false,
  escenarios_pais: crearEscenariosPaisIniciales(),
  escalas: "50, 100, 500",
  indirectos_porcentaje: 5,
  costo_operativo_hora: 0,
  costo_operativo_origen: "",
  costo_operativo_config_id: "",
  margen_porcentaje: 35,
  tipo_margen: "markup",
  factor_riesgo_porcentaje: 3,
  dias_compra: 5,
  dias_ingenieria: 2,
  horas_disponibles_dia: 21,
  desfase_flujo_horas: 2,
  incoterm: "EXW",
  destino_internacional: "",
  pais_destino: "",
  modalidad_carga: "auto",
  unidades_por_caja: 1,
  largo_caja_cm: 0,
  ancho_caja_cm: 0,
  alto_caja_cm: 0,
  factor_estiba: 1,
  capacidad_camion_m3: 90,
  capacidad_camion_kg: 25000,
  posiciones_pallet_camion: 26,
  flete_internacional: 0,
  costo_ltl_m3: 0,
  costo_ltl_minimo: 0,
  seguro_porcentaje: 0.3,
  seguro_sobre_porcentaje: 110,
  gastos_exportacion: 0,
  otros_costos_exportacion: 0,
  dias_preparacion_exportacion: 0,
  dias_transito: 0,
  destinos_exportacion_comparacion: [
    "Argentina",
    "Paraguay",
    "Uruguay"
  ],
  materiales: [],
  procesos: []
};

const PRESETS_LOGISTICA_DESTINO = {
  Argentina: {
    moneda: "USD",
    destino_internacional: "Buenos Aires",
    flete_internacional: 4300,
    costo_ltl_m3: 85,
    costo_ltl_minimo: 300,
    dias_preparacion_exportacion: 2,
    dias_transito: 5,
    gastos_exportacion: 450,
    tipo_cambio_clp_usd: TIPO_CAMBIO_CLP_USD_FALLBACK
  },
  Paraguay: {
    moneda: "USD",
    destino_internacional: "Asunción",
    flete_internacional: 5200,
    costo_ltl_m3: 95,
    costo_ltl_minimo: 350,
    dias_preparacion_exportacion: 2,
    dias_transito: 6,
    gastos_exportacion: 450,
    tipo_cambio_clp_usd: TIPO_CAMBIO_CLP_USD_FALLBACK
  },
  Uruguay: {
    moneda: "USD",
    destino_internacional: "Montevideo",
    flete_internacional: 5500,
    costo_ltl_m3: 100,
    costo_ltl_minimo: 350,
    dias_preparacion_exportacion: 2,
    dias_transito: 6,
    gastos_exportacion: 450,
    tipo_cambio_clp_usd: TIPO_CAMBIO_CLP_USD_FALLBACK
  }
};

const DESTINOS_EXPORTACION_FRECUENTES = [
  {
    pais: "Argentina",
    etiqueta: "BA",
    nombre: "Buenos Aires"
  },
  {
    pais: "Paraguay",
    etiqueta: "ASU",
    nombre: "Asunción"
  },
  {
    pais: "Uruguay",
    etiqueta: "MVD",
    nombre: "Montevideo"
  }
];

const materialVacio = {
  tipo_linea: "material",
  categoria_pepsico: "",
  material_id: "",
  codigo: "",
  nombre: "",
  unidad: "un",
  expresion_consumo: "",
  unidad_expresion_consumo: "mm",
  piezas_calculadas: 0,
  cortes_calculados: 0,
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
  consumo_unitario: 1,
  merma_porcentaje: 5,
  costo_unitario: 0,
  minimo_compra: 0,
  politica_minimo_compra: "cobrar_minimo",
  peso_kg_por_unidad: 0,
  tipo_formula_consumo: "",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  area_m2_por_producto: 0,
  consumo_tinta_ml_por_m2: 0,
  consumo_tinta_ml_total: 0,
  caja_largo_mm: 0,
  caja_ancho_mm: 0,
  caja_alto_mm: 0,
  caja_pestana_mm: 40,
  caja_unidades: 1,
  pallet_cajas: 1,
  pallet_largo_mm: 1200,
  pallet_ancho_mm: 1000,
  pallet_peso_kg: 20,
  pallets_adicionales: 0,
  proveedor_id: "",
  proveedor_codigo: "",
  proveedor: "",
  costo_origen: "",
  moneda: "CLP"
};

const crearLineaMaterial = tipoLinea => ({
  ...materialVacio,
  tipo_linea: tipoLinea
});

const esMaterialCajaCorrugada = material => {
  const texto = normalizarComparacion(
    `${material?.codigo || ""} ${material?.nombre || ""}`
  );
  return (
    texto.includes("mp0048") ||
    texto.includes("carton corrugado 20c")
  );
};

const esSuministroPallet = material => {
  const texto = normalizarComparacion(
    `${material?.codigo || ""} ${material?.nombre || ""}`
  );
  return texto.includes("sum0016") || texto.includes("sum0038");
};

const obtenerTipoLecturaConsumoMaterial = material => {
  const texto = normalizarComparacion(
    [
      material?.codigo,
      material?.nombre
    ].join(" ")
  );

  if (
    texto.includes("plancha laf") ||
    /\blaf\b/.test(texto)
  ) {
    return TIPOS_LECTURA_CONSUMO.PLANCHA_LAF;
  }

  if (
    texto.includes("mp0046") ||
    texto.includes("mdf ranurado")
  ) {
    return TIPOS_LECTURA_CONSUMO.PLANCHA_1220X1220;
  }

  if (
    texto.startsWith("pai blanco 1220x2440") ||
    texto.includes("pai blanco 1220x2440") ||
    texto.startsWith("acrilico") ||
    texto.includes(" acrilico") ||
    texto.startsWith("coroplast") ||
    texto.includes(" coroplast")
  ) {
    return TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440;
  }

  if (
    texto.startsWith("mdf") ||
    texto.includes(" mdf")
  ) {
    return TIPOS_LECTURA_CONSUMO.PLANCHA_1520X2440;
  }

  if (/\bpai\b/.test(texto)) {
    return TIPOS_LECTURA_CONSUMO.FRACCION_MP;
  }

  if (/\balambre\b/.test(texto)) {
    return TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO;
  }

  return TIPOS_LECTURA_CONSUMO.CORTES_LINEALES;
};

const esLecturaPlancha = tipoLectura =>
  [
    TIPOS_LECTURA_CONSUMO.PLANCHA_LAF,
    TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440,
    TIPOS_LECTURA_CONSUMO.PLANCHA_1520X2440,
    TIPOS_LECTURA_CONSUMO.PLANCHA_1220X1220
  ].includes(tipoLectura);

const aplicarExpresionConsumo = material => {
  const tipoLectura =
    obtenerTipoLecturaConsumoMaterial(material);
  const analisis = analizarExpresionConsumoMaterial({
    expresion: material.expresion_consumo,
    unidadExpresion:
      material.unidad_expresion_consumo || "mm",
    unidadMaterial: material.unidad || "m",
    tipoLectura
  });
  const consumoRealPorFormula =
    esLecturaPlancha(tipoLectura) ||
    tipoLectura ===
      TIPOS_LECTURA_CONSUMO.FRACCION_MP;

  if (!material.expresion_consumo) {
    return {
      ...material,
      piezas_calculadas: 0,
      cortes_calculados: 0,
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
      expresion_consumo_error: ""
    };
  }

  return {
    ...material,
    ...(analisis.valido
      ? {
          consumo_unitario:
            analisis.consumo_unitario,
          piezas_calculadas: analisis.piezas,
          cortes_calculados: analisis.cortes,
          cortes_por_subproducto:
            analisis.cortes_por_subproducto,
          subproductos: analisis.subproductos,
          fraccion_por_pieza:
            analisis.fraccion_por_pieza || 0,
          consumo_pieza_formula:
            analisis.consumo_pieza_formula || 0,
          consumo_total_formula:
            analisis.consumo_total_formula || 0,
          cortes_por_pieza:
            analisis.cortes_por_pieza || 0,
          cortes_por_producto:
            analisis.cortes_por_producto || 0,
          dobleces_por_producto:
            analisis.dobleces_por_producto || 0,
          dobleces_por_pieza:
            analisis.dobleces_por_pieza,
          dobleces_total: analisis.dobleces_total,
          longitud_por_pieza:
            analisis.longitud_por_pieza,
          ancho_pieza: analisis.ancho_pieza || 0,
          alto_pieza: analisis.alto_pieza || 0,
          ancho_plancha:
            analisis.ancho_plancha || 1000,
          alto_plancha:
            analisis.alto_plancha || 3000,
          piezas_por_plancha:
            analisis.piezas_por_plancha || 0,
          piezas_por_plancha_rotado:
            analisis.piezas_por_plancha_rotado ||
            0,
          fraccion_plancha:
            analisis.fraccion_plancha || "",
          piezas_por_producto:
            analisis.piezas_por_producto || 0,
          ...(consumoRealPorFormula
            ? {
                politica_minimo_compra:
                  "consumo_real"
              }
            : {})
        }
      : {}),
    expresion_consumo_error: analisis.error
  };
};

const recalcularMaterialesConFormula = materiales => {
  const recalculados = (materiales || []).map(material =>
    material?.expresion_consumo &&
    (material.tipo_linea || "material") === "material"
      ? aplicarExpresionConsumo(material)
      : material
  );

  return recalculados.map(material => {
    if (
      material.tipo_formula_consumo !==
      "tinta_uv_cmyk_pai"
    ) {
      return material;
    }

    const indiceOrigen = Number(
      material.formula_material_indice
    );
    const materialPai =
      Number.isInteger(indiceOrigen) &&
      indiceOrigen >= 0
        ? recalculados[indiceOrigen]
        : null;

    return materialPai &&
      esPlanchaPaiConFormula(materialPai)
      ? calcularLineaTintaUvCmyk({
          suministro: material,
          materialPai,
          indiceMaterial: indiceOrigen
        })
      : material;
  });
};

const camposFormulaDesdeMaterial = (
  material,
  indiceMaterial
) =>
  material
    ? {
        formula_material_indice:
          indiceMaterial?.toString() || "",
        formula_material_id:
          material.material_id || "",
        formula_material_codigo:
          material.codigo || "",
        formula_material_nombre:
          material.nombre || "",
        formula_tiempo:
          material.expresion_consumo || "",
        unidad_formula_tiempo:
          material.unidad_expresion_consumo || "mm"
      }
    : {};

const aplicacionCorteLaserMaterial = material => {
  const aplicacion =
    material?.aplicacion_corte_laser;
  const textoMaterial = normalizarComparacion(
    [material?.codigo, material?.nombre]
      .filter(Boolean)
      .join(" ")
  );
  const esPlanchaCo2 =
    /(^|\s)pai(\s|$)/.test(textoMaterial) ||
    textoMaterial.includes("acrilico") ||
    /(^|\s)mdf(\s|$)/.test(textoMaterial);

  if (
    Object.values(APLICACIONES_CORTE_LASER).includes(
      aplicacion
    ) && aplicacion !== APLICACIONES_CORTE_LASER.NO_APLICA
  ) {
    return aplicacion;
  }

  if (esPlanchaCo2) {
    return APLICACIONES_CORTE_LASER.CO2;
  }

  if (aplicacion === APLICACIONES_CORTE_LASER.NO_APLICA) {
    return aplicacion;
  }

  const velocidadFibra = Number(
    material?.velocidad_laser_fibra_m_min
  );
  const velocidadCo2 = Number(
    material?.velocidad_laser_co2_m_min
  );

  if (velocidadFibra > 0 && velocidadCo2 > 0) {
    return APLICACIONES_CORTE_LASER.AMBOS;
  }

  if (velocidadFibra > 0) {
    return APLICACIONES_CORTE_LASER.FIBRA;
  }

  if (velocidadCo2 > 0) {
    return APLICACIONES_CORTE_LASER.CO2;
  }

  return APLICACIONES_CORTE_LASER.NO_APLICA;
};

const tipoLaserEstacion = estacion => {
  const textoEstacion = normalizarComparacion(
    [
      estacion?.proceso_nombre,
      estacion?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (textoEstacion.includes("co2")) {
    return APLICACIONES_CORTE_LASER.CO2;
  }

  if (
    textoEstacion.includes("fibra") ||
    textoEstacion.includes("laser")
  ) {
    return APLICACIONES_CORTE_LASER.FIBRA;
  }

  return "";
};

const materialCompatibleConLaser = (
  material,
  estacion
) => {
  const aplicacion =
    aplicacionCorteLaserMaterial(material);
  const tipoLaser = tipoLaserEstacion(estacion);

  if (
    aplicacion === APLICACIONES_CORTE_LASER.NO_APLICA
  ) {
    return false;
  }

  if (!tipoLaser) {
    return true;
  }

  if (aplicacion === APLICACIONES_CORTE_LASER.AMBOS) {
    return true;
  }

  return aplicacion === tipoLaser;
};

const velocidadLaserDesdeMaterial = (
  material,
  estacion
) => {
  const textoEstacion = normalizarComparacion(
    [
      estacion?.proceso_nombre,
      estacion?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );
  const velocidadFibra = Number(
    material?.velocidad_laser_fibra_m_min
  );
  const velocidadCo2 = Number(
    material?.velocidad_laser_co2_m_min
  );
  const aplicacion =
    aplicacionCorteLaserMaterial(material);
  const permiteFibra = [
    APLICACIONES_CORTE_LASER.FIBRA,
    APLICACIONES_CORTE_LASER.AMBOS
  ].includes(aplicacion);
  const permiteCo2 = [
    APLICACIONES_CORTE_LASER.CO2,
    APLICACIONES_CORTE_LASER.AMBOS
  ].includes(aplicacion);

  if (
    textoEstacion.includes("co2") &&
    permiteCo2 &&
    Number.isFinite(velocidadCo2) &&
    velocidadCo2 > 0
  ) {
    return velocidadCo2;
  }

  if (
    (textoEstacion.includes("fibra") ||
      textoEstacion.includes("laser")) &&
    permiteFibra &&
    Number.isFinite(velocidadFibra) &&
    velocidadFibra > 0
  ) {
    return velocidadFibra;
  }

  if (
    permiteFibra &&
    Number.isFinite(velocidadFibra) &&
    velocidadFibra > 0
  ) {
    return velocidadFibra;
  }

  return permiteCo2 &&
    Number.isFinite(velocidadCo2) &&
    velocidadCo2 > 0
    ? velocidadCo2
    : 0;
};

const camposLaserDesdeMaterial = (
  material,
  indiceMaterial,
  estacion,
  procesoActual = {}
) => {
  const velocidad = velocidadLaserDesdeMaterial(
    material,
    estacion
  );
  const ancho = Number(material?.ancho_pieza);
  const alto = Number(material?.alto_pieza);
  const piezas = Math.max(
    Math.round(
      Number(
        material?.piezas_por_producto ||
        material?.subproductos ||
        1
      )
    ),
    1
  );
  const formulaPerimetro =
    ancho > 0 && alto > 0
      ? `((${ancho}*2)+(${alto}*2))*${piezas}`
      : "";

  return {
    ...camposFormulaDesdeMaterial(
      material,
      indiceMaterial
    ),
    ...(formulaPerimetro
      ? { formula_tiempo: formulaPerimetro }
      : {}),
    ...(velocidad > 0
      ? {
          metros_por_minuto: velocidad,
          segundos_por_metro: 60 / velocidad,
          velocidad_laser_origen: "material"
        }
      : {
          metros_por_minuto:
            procesoActual.metros_por_minuto || 8,
          segundos_por_metro:
            procesoActual.segundos_por_metro ||
            60 /
              (procesoActual.metros_por_minuto || 8),
          velocidad_laser_origen:
            procesoActual.velocidad_laser_origen ||
            "manual"
        })
  };
};

const esDoblezCnc3d = proceso => {
  const texto = normalizarComparacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    texto.includes("doblez") &&
    (texto.includes("cnc 3d") ||
      texto.includes("3d"))
  );
};

const esPlegadoraNeumatica = proceso => {
  const texto = normalizarComparacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    texto.includes("plegadora") &&
    (texto.includes("neumatica") ||
      texto.includes("hidraulica") ||
      texto.includes("hidarulica"))
  );
};

const esCorteCncRecto = proceso => {
  const texto = normalizarComparacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    texto.includes("corte") &&
    texto.includes("cnc") &&
    texto.includes("recto")
  );
};

const esCortePrensa = proceso => {
  const texto = normalizarComparacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    texto.includes("corte") &&
    texto.includes("prensa")
  );
};

const esLaserCorte = proceso => {
  const texto = normalizarComparacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    texto.includes("laser") ||
    texto.includes("fibra") ||
    texto.includes("co2")
  );
};

const esSoldaduraMig = proceso => {
  return esEstacionSoldaduraMig(proceso);
};

const esSoldadoraMultipunto = proceso => {
  const texto = normalizarComparacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre,
      proceso?.proceso_codigo,
      proceso?.estacion_codigo
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    texto.includes("multipunto") ||
    texto.includes("spunto")
  );
};

const esImpresoraCpUv = proceso => {
  const texto = normalizarComparacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre,
      proceso?.proceso_codigo,
      proceso?.estacion_codigo
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    texto.includes("impresion") &&
    (texto.includes("cp uv") || texto.includes("uv"))
  );
};

const valoresFormulaDoblezCnc = proceso => ({
  tipo_formula_tiempo: "doblez_cnc_3d",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  unidad_formula_tiempo:
    proceso?.unidad_formula_tiempo || "mm",
  segundos_por_metro:
    proceso?.segundos_por_metro || 5,
  segundos_por_doblez:
    proceso?.segundos_por_doblez || 3,
  segundos_por_corte:
    proceso?.segundos_por_corte || 1.5
});

const valoresFormulaPlegadoraNeumatica = proceso => ({
  tipo_formula_tiempo: "doblez_plegadora_neumatica",
  formula_tiempo:
    proceso?.tipo_formula_tiempo ===
    "doblez_plegadora_neumatica"
      ? proceso?.formula_tiempo || ""
      : "",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  unidad_formula_tiempo: "un",
  segundos_por_metro: 0,
  segundos_por_doblez:
    proceso?.tipo_formula_tiempo ===
      "doblez_plegadora_neumatica" &&
    Number(proceso?.segundos_por_doblez) > 0
      ? proceso.segundos_por_doblez
      : 36,
  segundos_por_corte: 0,
  unidades_por_hora: 0
});

const valoresFormulaCorteCncRecto = proceso => ({
  tipo_formula_tiempo: "corte_cnc_recto",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  unidad_formula_tiempo:
    proceso?.unidad_formula_tiempo || "mm",
  segundos_por_metro:
    proceso?.segundos_por_metro || 5,
  segundos_por_doblez: 0,
  segundos_por_corte:
    proceso?.segundos_por_corte || 1.5
});

const valoresFormulaCortePrensa = proceso => ({
  tipo_formula_tiempo: "corte_prensa",
  unidad_formula_tiempo:
    proceso?.unidad_formula_tiempo || "mm",
  segundos_por_metro: 0,
  segundos_por_doblez: 0,
  segundos_por_corte:
    proceso?.segundos_por_corte || 2
});

const valoresFormulaLaser = proceso => {
  const metrosPorMinuto =
    proceso?.metros_por_minuto || 8;

  return {
    tipo_formula_tiempo: "laser_metros_minuto",
    formula_material_indice: "",
    formula_material_id: "",
    formula_material_codigo: "",
    formula_material_nombre: "",
    unidad_formula_tiempo:
      proceso?.unidad_formula_tiempo || "mm",
    metros_por_minuto: metrosPorMinuto,
    segundos_por_metro:
      proceso?.segundos_por_metro ||
      60 / metrosPorMinuto,
    segundos_por_doblez: 0,
    segundos_por_corte:
      proceso?.segundos_por_corte || 0.5
  };
};

const valoresFormulaSoldaduraMig = proceso => ({
  tipo_formula_tiempo: "soldadura_mig",
  formula_tiempo: "soldadura_mig",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  unidad_formula_tiempo: "un",
  puntos_mig: proceso?.puntos_mig || 0,
  cordones_simples:
    proceso?.cordones_simples || 0,
  cordones_perimetrales:
    proceso?.cordones_perimetrales || 0,
  segundos_por_punto_mig:
    proceso?.segundos_por_punto_mig || 3,
  segundos_por_cordon_simple:
    proceso?.segundos_por_cordon_simple || 12,
  segundos_por_cordon_perimetral:
    proceso?.segundos_por_cordon_perimetral || 45,
  segundos_por_metro: 0,
  segundos_por_doblez: 0,
  segundos_por_corte: 0
});

const valoresFormulaSoldaduraMultipunto = proceso => ({
  tipo_formula_tiempo: "soldadura_multipunto",
  formula_tiempo:
    proceso?.tipo_formula_tiempo ===
    "soldadura_multipunto"
      ? proceso?.formula_tiempo || ""
      : "",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  unidad_formula_tiempo: "un",
  puntos_por_ciclo_multipunto:
    proceso?.tipo_formula_tiempo ===
      "soldadura_multipunto" &&
    Number(proceso?.puntos_por_ciclo_multipunto) > 0
      ? proceso.puntos_por_ciclo_multipunto
      : 3,
  segundos_por_ciclo_multipunto:
    proceso?.tipo_formula_tiempo ===
      "soldadura_multipunto" &&
    Number(proceso?.segundos_por_ciclo_multipunto) > 0 &&
    Number(proceso?.segundos_por_ciclo_multipunto) !== 150
      ? proceso.segundos_por_ciclo_multipunto
      : 1.5,
  segundos_carga_retiro_multipunto:
    proceso?.tipo_formula_tiempo ===
      "soldadura_multipunto" &&
    Number(proceso?.segundos_carga_retiro_multipunto) >= 0
      ? proceso.segundos_carga_retiro_multipunto
      : 8,
  segundos_por_metro: 0,
  segundos_por_doblez: 0,
  segundos_por_corte: 0,
  unidades_por_hora: 0,
  eficiencia_esperada:
    proceso?.tipo_formula_tiempo ===
      "soldadura_multipunto" &&
    Number(proceso?.eficiencia_esperada) > 0 &&
    Number(proceso?.eficiencia_esperada) !== 75
      ? proceso.eficiencia_esperada
      : 72
});

const valoresFormulaImpresionCpUv = proceso => ({
  tipo_formula_tiempo: "impresion_uv_cama",
  formula_tiempo: "impresion_uv_cama",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  unidad_formula_tiempo: "mm",
  largo_cama_impresion_mm:
    proceso?.largo_cama_impresion_mm || 2450,
  ancho_cama_impresion_mm:
    proceso?.ancho_cama_impresion_mm || 1250,
  separacion_impresion_mm:
    proceso?.separacion_impresion_mm ?? 15,
  camas_impresion_por_hora:
    proceso?.camas_impresion_por_hora || 4,
  largo_pieza_impresion_mm: 0,
  ancho_pieza_impresion_mm: 0,
  piezas_impresion_por_producto: 0,
  segundos_por_metro: 0,
  segundos_por_doblez: 0,
  segundos_por_corte: 0,
  unidades_por_hora: 0,
  // Las 4 camas/hora informadas ya son rendimiento real medido;
  // no corresponde volver a descontar eficiencia.
  eficiencia_esperada: 100
});

const camposImpresionDesdeMaterial = (
  material,
  indiceMaterial
) =>
  material
    ? {
        formula_material_indice:
          indiceMaterial.toString(),
        formula_material_id: material.id || "",
        formula_material_codigo:
          material.codigo || "",
        formula_material_nombre:
          material.nombre || "",
        largo_pieza_impresion_mm:
          Number(material.ancho_pieza) || 0,
        ancho_pieza_impresion_mm:
          Number(material.alto_pieza) || 0,
        piezas_impresion_por_producto:
          Number(material.piezas_por_producto) ||
          Number(material.subproductos) ||
          1
      }
    : {
        formula_material_indice: "",
        formula_material_id: "",
        formula_material_codigo: "",
        formula_material_nombre: "",
        largo_pieza_impresion_mm: 0,
        ancho_pieza_impresion_mm: 0,
        piezas_impresion_por_producto: 0
      };

const valoresPorTipoFormula = (
  tipoFormula,
  proceso
) => {
  if (tipoFormula === "doblez_cnc_3d") {
    return valoresFormulaDoblezCnc(proceso);
  }

  if (tipoFormula === "doblez_plegadora_neumatica") {
    return valoresFormulaPlegadoraNeumatica(proceso);
  }

  if (tipoFormula === "corte_cnc_recto") {
    return valoresFormulaCorteCncRecto(proceso);
  }

  if (tipoFormula === "corte_prensa") {
    return valoresFormulaCortePrensa(proceso);
  }

  if (tipoFormula === "laser_metros_minuto") {
    return valoresFormulaLaser(proceso);
  }

  if (tipoFormula === "soldadura_mig") {
    return valoresFormulaSoldaduraMig(proceso);
  }

  if (tipoFormula === "soldadura_multipunto") {
    return valoresFormulaSoldaduraMultipunto(proceso);
  }

  if (tipoFormula === "impresion_uv_cama") {
    return valoresFormulaImpresionCpUv(proceso);
  }

  return {
    tipo_formula_tiempo: "",
    formula_tiempo: "",
    formula_material_indice: "",
    formula_material_id: "",
    formula_material_codigo: "",
    formula_material_nombre: ""
  };
};

const aplicarFormulaTiempoProceso = proceso => {
  const esMultipunto =
    proceso.tipo_formula_tiempo ===
    "soldadura_multipunto";
  const segundosCicloMultipunto =
    esMultipunto &&
    Number(proceso.segundos_por_ciclo_multipunto) === 150
      ? 1.5
      : proceso.segundos_por_ciclo_multipunto || 1.5;
  const eficienciaMultipunto =
    esMultipunto &&
    (!Number(proceso.eficiencia_esperada) ||
      Number(proceso.eficiencia_esperada) === 75)
      ? 72
      : proceso.eficiencia_esperada;
  const analisis = analizarFormulaProceso({
    tipoFormula: proceso.tipo_formula_tiempo,
    expresion: proceso.formula_tiempo,
    unidadExpresion:
      proceso.unidad_formula_tiempo || "mm",
    segundosPorMetro:
      proceso.segundos_por_metro || 5,
    segundosPorDoblez:
      proceso.segundos_por_doblez || 3,
    segundosPorCorte:
      proceso.segundos_por_corte || 1.5,
    metrosPorMinuto:
      proceso.metros_por_minuto || 0,
    puntosMig: proceso.puntos_mig || 0,
    cordonesSimples:
      proceso.cordones_simples || 0,
    cordonesPerimetrales:
      proceso.cordones_perimetrales || 0,
    segundosPorPuntoMig:
      proceso.segundos_por_punto_mig || 3,
    segundosPorCordonSimple:
      proceso.segundos_por_cordon_simple || 12,
    segundosPorCordonPerimetral:
      proceso.segundos_por_cordon_perimetral || 45,
    puntosPorCicloMultipunto:
      proceso.puntos_por_ciclo_multipunto || 3,
    segundosPorCicloMultipunto:
      segundosCicloMultipunto,
    segundosCargaRetiroMultipunto:
      proceso.segundos_carga_retiro_multipunto ?? 8,
    largoCamaImpresionMm:
      proceso.largo_cama_impresion_mm || 2450,
    anchoCamaImpresionMm:
      proceso.ancho_cama_impresion_mm || 1250,
    separacionImpresionMm:
      proceso.separacion_impresion_mm ?? 15,
    camasImpresionPorHora:
      proceso.camas_impresion_por_hora || 4,
    largoPiezaImpresionMm:
      proceso.largo_pieza_impresion_mm || 0,
    anchoPiezaImpresionMm:
      proceso.ancho_pieza_impresion_mm || 0,
    piezasImpresionPorProducto:
      proceso.piezas_impresion_por_producto || 0
  });

  if (
    !proceso.tipo_formula_tiempo ||
    (!proceso.formula_tiempo &&
      proceso.tipo_formula_tiempo !==
        "soldadura_mig")
  ) {
    return {
      ...proceso,
      segundos_por_producto: 0,
      metros_totales_calculados: 0,
      piezas_calculadas: 0,
      cortes_calculados: 0,
      golpes_calculados: 0,
      dobleces_por_pieza: 0,
      dobleces_total: 0,
      longitud_por_pieza: 0,
      formula_tiempo_error: ""
    };
  }

  return {
    ...proceso,
    ...(esMultipunto
      ? {
          segundos_por_ciclo_multipunto:
            segundosCicloMultipunto,
          eficiencia_esperada:
            eficienciaMultipunto
        }
      : {}),
    ...(analisis.valido
      ? {
          unidades_por_hora:
            analisis.unidades_por_hora,
          segundos_por_producto:
            analisis.segundos_por_producto,
          metros_totales_calculados:
            analisis.metros_totales,
          piezas_calculadas: analisis.piezas,
          cortes_calculados: analisis.cortes,
          golpes_calculados:
            proceso.tipo_formula_tiempo ===
              "corte_prensa" ||
            proceso.tipo_formula_tiempo ===
              "soldadura_multipunto"
              ? analisis.golpes || analisis.cortes
              : 0,
          dobleces_por_pieza:
            analisis.dobleces_por_pieza,
          dobleces_total: analisis.dobleces_total,
          longitud_por_pieza:
            analisis.longitud_por_pieza,
          formula_tiempo_detalle:
            analisis.detalle_tiempo || null
        }
      : {}),
    formula_tiempo_error: analisis.error
  };
};

const procesoRequiereCostoHora = proceso =>
  Boolean(
    proceso?.proceso_nombre ||
      proceso?.estacion_nombre ||
      proceso?.proceso_codigo ||
      proceso?.estacion_codigo
  ) && Number(proceso?.costo_hora || 0) <= 0;

const procesoVacio = {
  proceso_codigo: "",
  proceso_nombre: "",
  estacion_codigo: "",
  estacion_nombre: "",
  tipo_formula_tiempo: "",
  formula_tiempo: "",
  formula_material_indice: "",
  formula_material_id: "",
  formula_material_codigo: "",
  formula_material_nombre: "",
  unidad_formula_tiempo: "mm",
  segundos_por_metro: 5,
  segundos_por_doblez: 3,
  segundos_por_corte: 1.5,
  segundos_por_producto: 0,
  metros_totales_calculados: 0,
  piezas_calculadas: 0,
  cortes_calculados: 0,
  golpes_calculados: 0,
  metros_por_minuto: 0,
  puntos_por_ciclo_multipunto: 3,
  segundos_por_ciclo_multipunto: 1.5,
  segundos_carga_retiro_multipunto: 8,
  largo_cama_impresion_mm: 2450,
  ancho_cama_impresion_mm: 1250,
  separacion_impresion_mm: 15,
  camas_impresion_por_hora: 4,
  largo_pieza_impresion_mm: 0,
  ancho_pieza_impresion_mm: 0,
  piezas_impresion_por_producto: 0,
  puntos_mig: 0,
  cordones_simples: 0,
  cordones_perimetrales: 0,
  segundos_por_punto_mig: 3,
  segundos_por_cordon_simple: 12,
  segundos_por_cordon_perimetral: 45,
  dobleces_por_pieza: 0,
  dobleces_total: 0,
  longitud_por_pieza: 0,
  formula_tiempo_error: "",
  unidades_por_hora: 10,
  eficiencia_esperada: 75,
  costo_hora: 0,
  porcentaje_costo_operativo: 0,
  costo_operativo_origen: "",
  horas_setup: 0,
  observacion: ""
};

const formatoNumero = (valor, moneda = "CLP") =>
  Number(valor || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0
  });

const formatoPorcentaje = valor =>
  `${Number(valor || 0).toLocaleString("es-CL", {
    maximumFractionDigits: 2
  })}%`;

const formatoKg = valor =>
  `${Number(valor || 0).toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  })} kg`;

const formatoM3 = valor =>
  `${Number(valor || 0).toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  })} m³`;

const formatoValorResumen = (item, moneda) => {
  if (item.unidad === "kg") {
    return formatoKg(item.valor);
  }

  if (item.unidad === "m3") {
    return formatoM3(item.valor);
  }

  if (item.unidad === "texto") {
    return item.valor;
  }

  if (item.unidad === "moneda") {
    return formatoNumero(item.valor, moneda);
  }

  return formatoPorcentaje(item.porcentaje);
};

const actualizarItem = (
  lista,
  indice,
  cambios
) =>
  lista.map((item, posicion) =>
    posicion === indice
      ? {
          ...item,
          ...cambios
        }
      : item
  );

const mismoTexto = (a, b) =>
  Boolean(a && b) &&
  normalizarComparacion(a) ===
    normalizarComparacion(b);

const normalizarClaveFlexible = valor =>
  normalizarComparacion(valor).replace(/[_-]+/g, " ");

const textosCompatibles = (a, b) => {
  const textoA = normalizarClaveFlexible(a);
  const textoB = normalizarClaveFlexible(b);

  return (
    Boolean(textoA && textoB) &&
    (textoA === textoB ||
      textoA.includes(textoB) ||
      textoB.includes(textoA))
  );
};

const plantaCompatible = (
  plantaCosto,
  plantaFormulario
) => {
  const costo = normalizarClaveFlexible(plantaCosto);
  const formulario = normalizarClaveFlexible(
    plantaFormulario
  );

  return (
    !costo ||
    !formulario ||
    costo === formulario ||
    costo.includes(formulario) ||
    formulario.includes(costo)
  );
};

const camposDesdeCostoBase = costoBase =>
  costoBase
    ? {
        costo_hora: costoBase.costo_hora_total,
        costo_base_estacion_id: costoBase.id,
        costo_hora_origen: "costos_base_estacion",
        costo_hora_detalle: {
          maquinista:
            costoBase.costo_laboral_principal,
          ayudantes: costoBase.costo_ayudantes,
          depreciacion:
            costoBase.depreciacion_hora,
          energia: costoBase.energia_hora,
          mantencion: costoBase.mantencion_hora
        }
      }
    : null;

const primerNumeroPositivo = (
  origen,
  campos = []
) => {
  const encontrado = campos
    .map(campo => Number(origen?.[campo]))
    .find(valor => Number.isFinite(valor) && valor > 0);

  return encontrado || 0;
};

const primerTexto = (origen, campos = []) =>
  campos
    .map(campo => origen?.[campo])
    .find(valor => (valor || "").toString().trim()) ||
  "";

const normalizarComparacion = valor =>
  (valor || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const materialCorrespondeATipoLinea = (
  material,
  tipoLinea
) => {
  if (tipoLinea === "suministro") {
    return material.tipo === "SUM";
  }

  return !["SUM", "EPP"].includes(material.tipo);
};

const esSuministroTintaUvCmyk = material => {
  const texto = normalizarComparacion(
    [
      material?.codigo,
      material?.nombre
    ].join(" ")
  );

  return (
    texto.includes("sum0030") ||
    (texto.includes("tinta") &&
      texto.includes("uv") &&
      texto.includes("cmyk"))
  );
};

const esPlanchaPaiConFormula = material => {
  const texto = normalizarComparacion(
    [
      material?.codigo,
      material?.nombre
    ].join(" ")
  );

  return (
    (material.tipo_linea || "material") === "material" &&
    texto.includes("pai") &&
    esLecturaPlancha(
      obtenerTipoLecturaConsumoMaterial(material)
    ) &&
    material.expresion_consumo
  );
};

const calcularLineaTintaUvCmyk = ({
  suministro,
  materialPai,
  indiceMaterial
}) => {
  const lecturaPai = aplicarExpresionConsumo(materialPai);
  const piezasPorProducto =
    lecturaPai.piezas_por_producto ||
    lecturaPai.subproductos ||
    1;
  const calculo =
    calcularConsumoTintaUvCmykDesdePlancha({
      anchoPiezaMm: lecturaPai.ancho_pieza,
      altoPiezaMm: lecturaPai.alto_pieza,
      piezasPorProducto,
      unidadDestino: suministro.unidad || "ml"
    });

  return {
    ...suministro,
    tipo_formula_consumo: "tinta_uv_cmyk_pai",
    formula_material_indice:
      indiceMaterial?.toString() || "",
    formula_material_id: materialPai.material_id || "",
    formula_material_codigo: materialPai.codigo || "",
    formula_material_nombre: materialPai.nombre || "",
    expresion_consumo:
      materialPai.expresion_consumo || "",
    unidad_expresion_consumo: "m2",
    consumo_unitario: calculo.consumo_unitario,
    area_m2_por_producto:
      calculo.area_m2_por_producto,
    consumo_tinta_ml_por_m2:
      calculo.consumo_tinta_ml_por_m2,
    consumo_tinta_ml_total:
      calculo.consumo_tinta_ml_total,
    politica_minimo_compra: "consumo_real",
    expresion_consumo_error:
      lecturaPai.expresion_consumo_error || ""
  };
};

const SUPUESTOS_COTIZACION = [
  {
    clave: "indirectos_porcentaje",
    etiqueta: "Indirectos adicionales %",
    ayuda:
      "Reserva adicional para costos no modelados todavía. Los costos operativos fijos van separados. Ej: 5 a 12."
  },
  {
    clave: "costo_operativo_hora",
    etiqueta: "Costo operativo fijo hora",
    ayuda:
      "Se carga desde Costos Operativos Fijos de Planta. Puedes editarlo manualmente si la cotización requiere otro supuesto."
  },
  {
    clave: "margen_porcentaje",
    etiqueta: "Margen %",
    ayuda:
      "Porcentaje comercial. La forma de cálculo se define en Tipo de margen."
  },
  {
    clave: "factor_riesgo_porcentaje",
    etiqueta: "Riesgo producto nuevo %",
    ayuda:
      "Reserva por incertidumbre, curva de aprendizaje o reprocesos. Ej: 8 a 15."
  },
  {
    clave: "dias_compra",
    etiqueta: "Días compra MP",
    ayuda:
      "Tiempo estimado para conseguir materias primas o accesorios. Ej: 5."
  },
  {
    clave: "dias_ingenieria",
    etiqueta: "Días ingeniería",
    ayuda:
      "Tiempo para planos, muestra, ajustes y validación técnica. Ej: 2 a 7."
  },
  {
    clave: "horas_disponibles_dia",
    etiqueta: "Horas disponibles día",
    ayuda:
      "Horas productivas diarias usadas para estimar plazo. En 2 turnos Chile usar aprox. 14."
  },
  {
    clave: "desfase_flujo_horas",
    etiqueta: "Desfase flujo horas",
    ayuda:
      "Horas estimadas entre arranque de procesos encadenados. Ej: 1 a 2."
  }
];

const CAMPOS_MATERIAL_ESTIMADO = [
  {
    clave: "codigo",
    etiqueta: "Código",
    ayuda: "Código MP/RF/SUM o código temporal."
  },
  {
    clave: "nombre",
    etiqueta: "Nombre",
    ayuda: "Nombre del material o insumo."
  },
  {
    clave: "unidad",
    etiqueta: "Unidad",
    ayuda: "Unidad de compra o consumo. Ej: un, kg, m."
  },
  {
    clave: "consumo_unitario",
    etiqueta: "Consumo unit.",
    ayuda: "Cantidad de material que consume 1 producto."
  },
  {
    clave: "merma_porcentaje",
    etiqueta: "Merma %",
    ayuda: "Pérdida estimada de material. Ej: 5."
  },
  {
    clave: "costo_unitario",
    etiqueta: "Costo unit.",
    ayuda:
      "Costo por unidad de compra completa. En planchas, el costo consumido se calcula con la fracción y piezas del producto."
  },
  {
    clave: "peso_kg_por_unidad",
    etiqueta: "Peso kg/unit.",
    ayuda:
      "Peso en kg de la unidad de medida del material. Se trae del catálogo MP/SUM y permite estimar el peso unitario del producto."
  },
  {
    clave: "minimo_compra",
    etiqueta: "Mínimo compra",
    ayuda: "Cantidad mínima que exige comprar el proveedor."
  },
  {
    clave: "proveedor",
    etiqueta: "Proveedor temporal",
    ayuda: "Usar solo si aún no está creado en catálogo."
  }
];

const PASOS_MATERIAL_ESTIMADO = {
  consumo_unitario: "0.0001",
  merma_porcentaje: "0.01",
  costo_unitario: "0.01",
  peso_kg_por_unidad: "0.0001",
  minimo_compra: "0.0001"
};

const CAMPOS_PROCESO_ESTIMADO = [
  {
    clave: "proceso_nombre",
    etiqueta: "Proceso",
    ayuda: "Proceso productivo estimado. Ej: Corte."
  },
  {
    clave: "estacion_nombre",
    etiqueta: "Estación",
    ayuda: "Estación o máquina donde se produciría."
  },
  {
    clave: "unidades_por_hora",
    etiqueta: "Unid/hora",
    ayuda: "Cantidad estimada que se fabrica por hora."
  },
  {
    clave: "eficiencia_esperada",
    etiqueta: "Eficiencia esperada %",
    ayuda: "Rendimiento esperado por ser producto nuevo. Ej: 75."
  },
  {
    clave: "costo_hora",
    etiqueta: "Costo hora",
    ayuda:
      "Necesario para costear. Debe venir de Costos Base Estación o completarse manualmente."
  },
  {
    clave: "porcentaje_costo_operativo",
    etiqueta: "% costo fijo",
    ayuda:
      "Porcentaje de costos operativos fijos que absorbe esta estación según área ocupada."
  },
  {
    clave: "horas_setup",
    etiqueta: "Horas setup",
    ayuda: "Horas de preparación, regulación o prueba inicial."
  },
  {
    clave: "observacion",
    etiqueta: "Observación",
    ayuda: "Nota técnica o supuesto usado para este proceso."
  }
];

export default function CotizadorTecnicoV2({
  db,
  perfil,
  onVolver
}) {
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [materialesCatalogo, setMaterialesCatalogo] =
    useState([]);
  const [estacionesCatalogo, setEstacionesCatalogo] =
    useState([]);
  const [clientesCatalogo, setClientesCatalogo] =
    useState([]);
  const [proveedoresCatalogo, setProveedoresCatalogo] =
    useState([]);
  const [costosBaseEstacion, setCostosBaseEstacion] =
    useState([]);
  const [costosOperativos, setCostosOperativos] =
    useState([]);
  const [historial, setHistorial] = useState([]);
  const [busquedaHistorial, setBusquedaHistorial] =
    useState("");
  const [estadoHistorial, setEstadoHistorial] =
    useState("");
  const [limiteHistorialVisible, setLimiteHistorialVisible] =
    useState(20);
  const [filasPepsicoSeleccionadas, setFilasPepsicoSeleccionadas] =
    useState([]);
  const [editandoId, setEditandoId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoCambioInfo, setTipoCambioInfo] =
    useState({
      estado: "pendiente",
      fuente: "",
      fecha: "",
      error: ""
    });

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [
        materiales,
        procesos,
        cotizaciones,
        clientes,
        proveedores,
        costosBase,
        costosOperativosCargados
      ] = await Promise.all([
        listarMateriales(db, perfil.empresa_id),
        listarProcesosEstaciones(
          db,
          perfil.empresa_id
        ),
        listarCotizacionesTecnicas(
          db,
          perfil.empresa_id
        ),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.CLIENTE
        ),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.PROVEEDOR
        ),
        listarCostosBaseEstacion(
          db,
          perfil.empresa_id
        ),
        listarCostosOperativos(
          db,
          perfil.empresa_id
        )
      ]);

      setMaterialesCatalogo(
        materiales.filter(m => m.activo !== false)
      );
      setEstacionesCatalogo(
        aCatalogoProcesosRuta(procesos)
      );
      setHistorial(cotizaciones);
      setClientesCatalogo(
        clientes.filter(c => c.activo !== false)
      );
      setProveedoresCatalogo(
        proveedores.filter(p => p.activo !== false)
      );
      setCostosBaseEstacion(
        costosBase.filter(c => c.activo !== false)
      );
      setCostosOperativos(
        costosOperativosCargados.filter(
          c => c.activo !== false
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar costeo."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const controlador = new AbortController();

    const cargarTipoCambio = async () => {
      try {
        setTipoCambioInfo({
          estado: "cargando",
          fuente: "",
          fecha: "",
          error: ""
        });
        const tipoCambio =
          await obtenerTipoCambioClpUsdActual({
            signal: controlador.signal
          });

        setFormulario(actual => ({
          ...actual,
          tipo_cambio_clp_usd: tipoCambio.valor
        }));
        setTipoCambioInfo({
          estado: "actualizado",
          fuente: tipoCambio.fuente,
          fecha: tipoCambio.fecha,
          error: ""
        });
      } catch (fallo) {
        if (controlador.signal.aborted) {
          return;
        }

        setTipoCambioInfo({
          estado: "error",
          fuente: "",
          fecha: "",
          error:
            fallo?.message ||
            "No se pudo actualizar el tipo de cambio."
        });
      }
    };

    cargarTipoCambio();

    return () => controlador.abort();
  }, []);

  const actualizar = cambios => {
    setFormulario(actual => ({
      ...actual,
      ...cambios
    }));
    setMensaje("");
    setError("");
  };

  const actualizarEscenarioPais = (pais, cambios) => {
    actualizar({
      escenarios_pais: normalizarEscenariosPais(
        formulario.escenarios_pais
      ).map(escenario =>
        escenario.pais === pais
          ? { ...escenario, ...cambios }
          : escenario
      )
    });
  };

  const resultados = useMemo(
    () =>
      calcularCotizacionTecnica({
        escalas: formulario.escalas,
        materiales: formulario.materiales,
        procesos: formulario.procesos,
        indirectos_porcentaje:
          formulario.indirectos_porcentaje,
        costo_operativo_hora:
          formulario.costo_operativo_hora,
        margen_porcentaje:
          formulario.margen_porcentaje,
        tipo_margen: formulario.tipo_margen,
        factor_riesgo_porcentaje:
          formulario.factor_riesgo_porcentaje,
        dias_compra: formulario.dias_compra,
        dias_ingenieria:
          formulario.dias_ingenieria,
        horas_disponibles_dia:
          formulario.horas_disponibles_dia,
        desfase_flujo_horas:
          formulario.desfase_flujo_horas,
        moneda: formulario.moneda,
        tipo_cambio_clp_usd:
          formulario.tipo_cambio_clp_usd,
        exportacion: {
          incoterm: formulario.incoterm,
          destino: formulario.destino_internacional,
          pais_destino: formulario.pais_destino,
          modalidad_carga: formulario.modalidad_carga,
          unidades_por_caja:
            formulario.unidades_por_caja,
          largo_caja_cm: formulario.largo_caja_cm,
          ancho_caja_cm: formulario.ancho_caja_cm,
          alto_caja_cm: formulario.alto_caja_cm,
          factor_estiba: formulario.factor_estiba,
          capacidad_camion_m3:
            formulario.capacidad_camion_m3,
          capacidad_camion_kg:
            formulario.capacidad_camion_kg,
          posiciones_pallet_camion:
            formulario.posiciones_pallet_camion,
          flete_internacional:
            formulario.flete_internacional,
          costo_ltl_m3: formulario.costo_ltl_m3,
          costo_ltl_minimo:
            formulario.costo_ltl_minimo,
          seguro_porcentaje:
            formulario.seguro_porcentaje,
          seguro_sobre_porcentaje:
            formulario.seguro_sobre_porcentaje,
          gastos_exportacion:
            formulario.gastos_exportacion,
          otros_costos_exportacion:
            formulario.otros_costos_exportacion,
          dias_preparacion_exportacion:
            formulario.dias_preparacion_exportacion,
          dias_transito: formulario.dias_transito,
          destinos_comparacion:
            formulario.destinos_exportacion_comparacion
        }
      }),
    [formulario]
  );
  const resultadosMultipais = useMemo(
    () => formulario.cotizacion_multipais
      ? calcularEscenariosMultipais({
          escenarios: formulario.escenarios_pais,
          materiales: formulario.materiales,
          procesos: formulario.procesos,
          supuestos: {
            indirectos_porcentaje:
              formulario.indirectos_porcentaje,
            costo_operativo_hora:
              formulario.costo_operativo_hora,
            margen_porcentaje:
              formulario.margen_porcentaje,
            tipo_margen: formulario.tipo_margen,
            factor_riesgo_porcentaje:
              formulario.factor_riesgo_porcentaje,
            dias_compra: formulario.dias_compra,
            dias_ingenieria: formulario.dias_ingenieria,
            horas_disponibles_dia:
              formulario.horas_disponibles_dia,
            desfase_flujo_horas:
              formulario.desfase_flujo_horas,
            tipo_cambio_clp_usd:
              formulario.tipo_cambio_clp_usd
          },
          exportacionBase: {
            modalidad_carga: formulario.modalidad_carga,
            unidades_por_caja: formulario.unidades_por_caja,
            largo_caja_cm: formulario.largo_caja_cm,
            ancho_caja_cm: formulario.ancho_caja_cm,
            alto_caja_cm: formulario.alto_caja_cm,
            factor_estiba: formulario.factor_estiba,
            capacidad_camion_m3:
              formulario.capacidad_camion_m3,
            capacidad_camion_kg:
              formulario.capacidad_camion_kg,
            posiciones_pallet_camion:
              formulario.posiciones_pallet_camion,
            seguro_porcentaje:
              formulario.seguro_porcentaje,
            seguro_sobre_porcentaje:
              formulario.seguro_sobre_porcentaje,
            otros_costos_exportacion:
              formulario.otros_costos_exportacion
          }
        })
      : [],
    [formulario]
  );
  const filasPepsicoMultipais = useMemo(
    () => crearFilasPepsico(
      ["Chile", "Argentina", "Uruguay", "Paraguay"].map(
        pais => ({
          id: `${editandoId || "actual"}-${pais}`,
          nombre_producto: formulario.nombre_producto,
          moneda: pais === "Chile" ? "CLP" : "USD",
          materiales: formulario.materiales,
          resultados: resultadosMultipais.filter(
            resultado => resultado.pais === pais
          ),
          datos_pepsico: {
            pais,
            link_planos: formulario.link_planos,
            graficos_laterales: formulario.graficos_laterales,
            produccion_minima_semanal:
              formulario.produccion_minima_semanal,
            plazo_entrega_comercial:
              formulario.plazo_entrega_comercial,
            concepto_adicional:
              formulario.concepto_adicional,
            concepto_adicional_descripcion:
              formulario.concepto_adicional_descripcion,
            concepto_adicional_aplicacion:
              formulario.concepto_adicional_aplicacion,
            flete_cif_unitario:
              formulario.flete_cif_unitario,
            flete_ddp_unitario:
              formulario.flete_ddp_unitario,
            comentarios: formulario.comentarios_pepsico
          }
        })
      )
    ),
    [editandoId, formulario, resultadosMultipais]
  );
  const incotermSeleccionado = (
    formulario.incoterm || "EXW"
  ).toUpperCase();
  const cotizaExportacion =
    incotermSeleccionado !== "EXW";
  const etiquetaIncotermUnitario = cotizaExportacion
    ? `${incotermSeleccionado} unit.`
    : "EXW unit.";
  const etiquetaIncotermTotal = cotizaExportacion
    ? `${incotermSeleccionado} total`
    : "EXW total";
  const resultadoBase = resultados[0];
  const filasPepsicoActuales = useMemo(
    () =>
      crearFilasPepsico([
        {
          id: editandoId || "actual",
          nombre_producto: formulario.nombre_producto,
          moneda: formulario.moneda,
          materiales: formulario.materiales,
          resultados,
          supuestos: {
            exportacion: {
              pais_destino: formulario.pais_destino
            }
          },
          datos_pepsico: {
            pais: formulario.pais_cotizacion,
            link_planos: formulario.link_planos,
            graficos_laterales:
              formulario.graficos_laterales,
            produccion_minima_semanal:
              formulario.produccion_minima_semanal,
            plazo_entrega_comercial:
              formulario.plazo_entrega_comercial,
            concepto_adicional:
              formulario.concepto_adicional,
            concepto_adicional_descripcion:
              formulario.concepto_adicional_descripcion,
            concepto_adicional_aplicacion:
              formulario.concepto_adicional_aplicacion,
            flete_cif_unitario:
              formulario.flete_cif_unitario,
            flete_ddp_unitario:
              formulario.flete_ddp_unitario,
            comentarios:
              formulario.comentarios_pepsico
          }
        }
      ]),
    [editandoId, formulario, resultados]
  );
  const filasPepsicoVista = formulario.cotizacion_multipais
    ? filasPepsicoMultipais
    : filasPepsicoActuales;
  const paisesPepsicoVista = [
    ...new Set(filasPepsicoVista.map(fila => fila.pais))
  ];
  const mostrarVistaPepsico = Boolean(
    (formulario.nombre_producto || "").trim()
  ) && filasPepsicoVista.length > 0;
  const logisticaBase =
    resultadoBase?.logistica_exportacion || {};
  const destinosExportacionSeleccionados = useMemo(
    () =>
      DESTINOS_EXPORTACION_FRECUENTES.filter(destino =>
        (
          formulario.destinos_exportacion_comparacion ||
          []
        ).includes(destino.pais)
      ),
    [formulario.destinos_exportacion_comparacion]
  );
  const resultadosComparativoExportacion = useMemo(
    () =>
      resultados.map(resultado => {
        const destinos =
          destinosExportacionSeleccionados.map(destino => {
            const preset =
              PRESETS_LOGISTICA_DESTINO[destino.pais] ||
              {};
            const usaFormularioActual =
              formulario.pais_destino === destino.pais &&
              (formulario.incoterm || "EXW").toUpperCase() !==
                "EXW";
            const cajaLogistica = formulario.materiales.find(
              esMaterialCajaCorrugada
            );
            const palletLogistico = formulario.materiales.find(
              esSuministroPallet
            );
            const exportacionDestino = {
              incoterm: "CIP",
              modalidad_carga:
                formulario.modalidad_carga || "auto",
              unidades_por_caja:
                formulario.unidades_por_caja,
              largo_caja_cm: formulario.largo_caja_cm,
              ancho_caja_cm: formulario.ancho_caja_cm,
              alto_caja_cm: formulario.alto_caja_cm,
              factor_estiba: formulario.factor_estiba,
              capacidad_camion_m3:
                formulario.capacidad_camion_m3,
              capacidad_camion_kg:
                formulario.capacidad_camion_kg,
              posiciones_pallet_camion:
                formulario.posiciones_pallet_camion,
              ...(cajaLogistica
                ? {
                    unidades_por_caja:
                      cajaLogistica.caja_unidades,
                    largo_caja_cm:
                      Number(cajaLogistica.caja_largo_mm) / 10,
                    ancho_caja_cm:
                      Number(cajaLogistica.caja_ancho_mm) / 10,
                    alto_caja_cm:
                      Number(cajaLogistica.caja_alto_mm) / 10
                  }
                : {}),
              ...(palletLogistico
                ? {
                    cajas_por_pallet:
                      palletLogistico.pallet_cajas,
                    pallets_adicionales:
                      palletLogistico.pallets_adicionales
                  }
                : {}),
              seguro_porcentaje:
                formulario.seguro_porcentaje,
              seguro_sobre_porcentaje:
                formulario.seguro_sobre_porcentaje,
              otros_costos_exportacion:
                formulario.otros_costos_exportacion,
              ...preset,
              pais_destino: destino.pais,
              destino: preset.destino_internacional || destino.nombre,
              ...(usaFormularioActual
                ? {
                    destino:
                      formulario.destino_internacional ||
                      preset.destino_internacional ||
                      destino.nombre,
                    modalidad_carga:
                      formulario.modalidad_carga || "auto",
                    flete_internacional:
                      formulario.flete_internacional,
                    costo_ltl_m3:
                      formulario.costo_ltl_m3,
                    costo_ltl_minimo:
                      formulario.costo_ltl_minimo,
                    gastos_exportacion:
                      formulario.gastos_exportacion,
                    otros_costos_exportacion:
                      formulario.otros_costos_exportacion,
                    dias_preparacion_exportacion:
                      formulario
                        .dias_preparacion_exportacion,
                    dias_transito:
                      formulario.dias_transito
                  }
                : {})
            };
            const tieneTarifa =
              Number(
                exportacionDestino.flete_internacional
              ) > 0 ||
              Number(exportacionDestino.costo_ltl_m3) > 0;
            const tieneMedidas =
              Number(exportacionDestino.unidades_por_caja) >
                0 &&
              Number(exportacionDestino.largo_caja_cm) > 0 &&
              Number(exportacionDestino.ancho_caja_cm) > 0 &&
              Number(exportacionDestino.alto_caja_cm) > 0;

            if (!tieneTarifa || !tieneMedidas) {
              return {
                ...destino,
                pendiente: true
              };
            }

            const monedaActual = (
              formulario.moneda || "CLP"
            ).toUpperCase();
            const tipoCambio =
              Number(formulario.tipo_cambio_clp_usd) ||
              TIPO_CAMBIO_CLP_USD_FALLBACK;
            const precioTotalExportacionUsd =
              monedaActual === "USD"
                ? resultado.precio_total_sugerido
                : resultado.precio_total_sugerido /
                  tipoCambio;
            const logistica =
              calcularLogisticaExportacion({
                exportacion: exportacionDestino,
                cantidad: resultado.cantidad,
                costoBaseMercaderia:
                  precioTotalExportacionUsd,
                pesoUnitarioKg:
                  resultado.peso_unitario_kg
              });
            const diasExportacion =
              Number(
                exportacionDestino
                  .dias_preparacion_exportacion
              ) +
              Number(exportacionDestino.dias_transito);

            return {
              ...destino,
              pendiente: false,
              logistica,
              costo_unitario:
                logistica.costo_exportacion_unitario,
              lead_time_exportacion:
                resultado.lead_time_flujo_dias +
                diasExportacion
            };
          });

        return {
          cantidad: resultado.cantidad,
          precio_exw_unitario:
            resultado.precio_unitario_sugerido,
          precio_exw_total:
            resultado.precio_total_sugerido,
          lead_time_local:
            resultado.lead_time_flujo_dias,
          destinos
        };
      }),
    [
      destinosExportacionSeleccionados,
      formulario,
      resultados
    ]
  );

  const historialFiltrado = useMemo(() => {
    const busqueda = normalizarComparacion(
      busquedaHistorial
    );

    return historial.filter(item => {
      const coincideEstado =
        !estadoHistorial ||
        item.estado === estadoHistorial;
      const texto = normalizarComparacion(
        [
          item.nombre_producto,
          item.cliente,
          item.version,
          item.estado,
          item.nivel_confianza
        ].join(" ")
      );

      return (
        coincideEstado &&
        (!busqueda || texto.includes(busqueda))
      );
    });
  }, [
    busquedaHistorial,
    estadoHistorial,
    historial
  ]);

  const historialVisible = useMemo(
    () =>
      historialFiltrado.slice(
        0,
        limiteHistorialVisible
      ),
    [historialFiltrado, limiteHistorialVisible]
  );
  const filasPepsicoHistorial = useMemo(
    () => crearFilasPepsico(historialFiltrado),
    [historialFiltrado]
  );
  const clavesFilasPepsicoHistorial = useMemo(
    () => filasPepsicoHistorial.map(fila => fila.clave),
    [filasPepsicoHistorial]
  );

  const alternarFilaPepsico = clave => {
    setFilasPepsicoSeleccionadas(actual =>
      actual.includes(clave)
        ? actual.filter(item => item !== clave)
        : [...actual, clave]
    );
  };

  const descargarFilasPepsico = filas => {
    try {
      setError("");
      descargarExcelPepsico(filas);
      setMensaje(
        `Excel PepsiCo generado con ${filas.length} fila(s).`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo generar el Excel PepsiCo."
      );
    }
  };

  const procesosSinCostoHora = useMemo(
    () =>
      formulario.procesos
        .map((proceso, indice) => ({
          proceso,
          indice
        }))
        .filter(item =>
          procesoRequiereCostoHora(item.proceso)
        ),
    [formulario.procesos]
  );

  const materialesConFormulaCortes = useMemo(
    () =>
      formulario.materiales.filter(
        material =>
          (material.tipo_linea || "material") ===
            "material" &&
          material.expresion_consumo &&
          obtenerTipoLecturaConsumoMaterial(material) ===
            TIPOS_LECTURA_CONSUMO.CORTES_LINEALES
      ),
    [formulario.materiales]
  );

  const materialesConFormulaAlambre = useMemo(
    () =>
      formulario.materiales.filter(
        material =>
          (material.tipo_linea || "material") ===
            "material" &&
          (material.codigo || "")
            .toString()
            .toUpperCase()
            .startsWith("MP") &&
          material.expresion_consumo &&
          obtenerTipoLecturaConsumoMaterial(material) ===
            TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO
      ),
    [formulario.materiales]
  );

  const materialesConFormulaPlanchaLaser = useMemo(
    () =>
      formulario.materiales.filter(
        material => {
          const tipoLectura =
            obtenerTipoLecturaConsumoMaterial(material);

          return (
            (material.tipo_linea || "material") ===
              "material" &&
            material.expresion_consumo &&
            [
              TIPOS_LECTURA_CONSUMO.PLANCHA_LAF,
              TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440,
              TIPOS_LECTURA_CONSUMO.PLANCHA_1520X2440,
              TIPOS_LECTURA_CONSUMO.PLANCHA_1220X1220
            ].includes(tipoLectura)
          );
        }
      ),
    [formulario.materiales]
  );

  const materialesPaiConFormula = useMemo(
    () =>
      formulario.materiales
        .map((material, indice) => ({
          material: aplicarExpresionConsumo(material),
          indice
        }))
        .filter(({ material }) => {
          if (!esPlanchaPaiConFormula(material)) {
            return false;
          }

          return (
            !material.expresion_consumo_error &&
            Number(material.ancho_pieza) > 0 &&
            Number(material.alto_pieza) > 0
          );
        }),
    [formulario.materiales]
  );

  const aplicarCostoOperativoPlanta = useCallback(
    plantaId => {
      const costo = costosOperativos.find(
        item => item.planta_id === plantaId
      );

      setFormulario(actual => ({
        ...actual,
        planta_id: plantaId,
        costo_operativo_hora:
          costo?.costo_operativo_hora || 0,
        costo_operativo_origen: costo
          ? "costos_operativos_planta"
          : "manual",
        costo_operativo_config_id: costo?.id || ""
      }));
    },
    [costosOperativos]
  );

  useEffect(() => {
    if (
      costosOperativos.length > 0 &&
      !formulario.costo_operativo_config_id &&
      formulario.costo_operativo_origen !== "manual"
    ) {
      aplicarCostoOperativoPlanta(
        formulario.planta_id
      );
    }
  }, [
    aplicarCostoOperativoPlanta,
    costosOperativos.length,
    formulario.costo_operativo_config_id,
    formulario.costo_operativo_origen,
    formulario.planta_id
  ]);

  const enriquecerMaterialDesdeCatalogo = (
    materialActual,
    materialId
  ) => {
    const material = materialesCatalogo.find(
      item => item.id === materialId
    );
    const camposCostoMaterial = [
      "costo_unitario_referencial",
      "costo_unitario",
      "precio_unitario",
      "precio_unitario_referencial",
      "precio_referencial",
      "ultimo_costo",
      "costo_promedio",
      "costo_promedio_ponderado",
      "costo"
    ];
    const costoMaterialSeleccionado =
      primerNumeroPositivo(
        material,
        camposCostoMaterial
      );
    const nombreMaterial =
      normalizarComparacion(material?.nombre);
    const unidadMaterial =
      normalizarComparacion(material?.unidad_medida);
    const materialEquivalente =
      costoMaterialSeleccionado > 0
        ? null
        : materialesCatalogo.find(item => {
            if (item.id === material?.id) {
              return false;
            }

            const mismoNombre =
              normalizarComparacion(item.nombre) ===
              nombreMaterial;
            const mismaUnidad =
              !unidadMaterial ||
              normalizarComparacion(
                item.unidad_medida
              ) === unidadMaterial;
            const tieneCosto =
              primerNumeroPositivo(
                item,
                camposCostoMaterial
              ) > 0;

            return (
              mismoNombre &&
              mismaUnidad &&
              tieneCosto
            );
          });
    const materialCosto =
      costoMaterialSeleccionado > 0
        ? material
        : materialEquivalente || material;
    const costoCatalogo = primerNumeroPositivo(
      materialCosto,
      camposCostoMaterial
    );
    const mismoMaterialActual =
      materialActual?.material_id === materialId;
    const minimoCompra = primerNumeroPositivo(
      materialCosto,
      [
        "minimo_compra",
        "compra_minima",
        "cantidad_minima_compra"
      ]
    );
    const proveedorCodigo = primerTexto(materialCosto, [
      "proveedor_preferente_codigo",
      "proveedor_codigo"
    ]);
    const proveedorNombre = primerTexto(materialCosto, [
      "proveedor_preferente_nombre",
      "proveedor_nombre",
      "proveedor"
    ]);
    const proveedorId = primerTexto(materialCosto, [
      "proveedor_preferente_id",
      "proveedor_id"
    ]);
    const proveedorCatalogo = proveedoresCatalogo.find(
      proveedor =>
        proveedor.id === proveedorId ||
        proveedor.codigo === proveedorCodigo ||
        proveedor.nombre === proveedorNombre
    );
    const esCajaCorrugada = esMaterialCajaCorrugada(
      material
    );
    const esPallet = esSuministroPallet(material);

    return {
      tipo_linea:
        materialActual?.tipo_linea || "material",
      categoria_pepsico:
        materialActual?.categoria_pepsico || "",
      material_id: materialId,
      codigo: material?.codigo || "",
      nombre: material?.nombre || "",
      unidad:
        (esCajaCorrugada ? "m2" : material?.unidad_medida) ||
        materialActual?.unidad ||
        "un",
      expresion_consumo:
        materialActual?.expresion_consumo || "",
      unidad_expresion_consumo:
        materialActual?.unidad_expresion_consumo ||
        "mm",
      consumo_unitario: esPallet
        ? 1
        : mismoMaterialActual
          ? materialActual?.consumo_unitario || 1
          : 1,
      merma_porcentaje: mismoMaterialActual
        ? materialActual?.merma_porcentaje ?? 5
        : 5,
      piezas_calculadas:
        materialActual?.piezas_calculadas || 0,
      cortes_calculados:
        materialActual?.cortes_calculados || 0,
      cortes_por_subproducto:
        materialActual?.cortes_por_subproducto || 0,
      subproductos:
        materialActual?.subproductos || 0,
      fraccion_por_pieza:
        materialActual?.fraccion_por_pieza || 0,
      consumo_pieza_formula:
        materialActual?.consumo_pieza_formula || 0,
      consumo_total_formula:
        materialActual?.consumo_total_formula || 0,
      cortes_por_pieza:
        materialActual?.cortes_por_pieza || 0,
      cortes_por_producto:
        materialActual?.cortes_por_producto || 0,
      dobleces_por_producto:
        materialActual?.dobleces_por_producto || 0,
      dobleces_por_pieza:
        materialActual?.dobleces_por_pieza || 0,
      dobleces_total:
        materialActual?.dobleces_total || 0,
      longitud_por_pieza:
        materialActual?.longitud_por_pieza || 0,
      expresion_consumo_error:
        materialActual?.expresion_consumo_error || "",
      costo_unitario:
        costoCatalogo ||
        (mismoMaterialActual
          ? materialActual?.costo_unitario
          : 0) ||
        0,
      peso_kg_por_unidad:
        (esPallet ? 20 : material?.peso_kg_por_unidad) ||
        materialCosto?.peso_kg_por_unidad ||
        (mismoMaterialActual
          ? materialActual?.peso_kg_por_unidad
          : 0) ||
        0,
      tipo_formula_consumo: esCajaCorrugada
        ? TIPO_FORMULA_CAJA_CORRUGADA
        : esPallet
          ? TIPO_FORMULA_PALLET
        : mismoMaterialActual
          ? materialActual?.tipo_formula_consumo || ""
          : "",
      formula_material_indice: mismoMaterialActual
        ? materialActual?.formula_material_indice || ""
        : "",
      formula_material_id: mismoMaterialActual
        ? materialActual?.formula_material_id || ""
        : "",
      formula_material_codigo: mismoMaterialActual
        ? materialActual?.formula_material_codigo || ""
        : "",
      formula_material_nombre: mismoMaterialActual
        ? materialActual?.formula_material_nombre || ""
        : "",
      area_m2_por_producto: mismoMaterialActual
        ? materialActual?.area_m2_por_producto || 0
        : 0,
      consumo_tinta_ml_por_m2: mismoMaterialActual
        ? materialActual?.consumo_tinta_ml_por_m2 || 0
        : 0,
      consumo_tinta_ml_total: mismoMaterialActual
        ? materialActual?.consumo_tinta_ml_total || 0
        : 0,
      caja_largo_mm: mismoMaterialActual
        ? materialActual?.caja_largo_mm || 0
        : 0,
      caja_ancho_mm: mismoMaterialActual
        ? materialActual?.caja_ancho_mm || 0
        : 0,
      caja_alto_mm: mismoMaterialActual
        ? materialActual?.caja_alto_mm || 0
        : 0,
      caja_pestana_mm: mismoMaterialActual
        ? materialActual?.caja_pestana_mm ?? 40
        : 40,
      caja_unidades: mismoMaterialActual
        ? materialActual?.caja_unidades || 1
        : 1,
      pallet_cajas: mismoMaterialActual
        ? materialActual?.pallet_cajas || 1
        : 1,
      pallet_largo_mm: mismoMaterialActual
        ? materialActual?.pallet_largo_mm || 1200
        : 1200,
      pallet_ancho_mm: mismoMaterialActual
        ? materialActual?.pallet_ancho_mm || 1000
        : 1000,
      pallet_peso_kg: mismoMaterialActual
        ? materialActual?.pallet_peso_kg || 20
        : 20,
      pallets_adicionales: mismoMaterialActual
        ? materialActual?.pallets_adicionales || 0
        : 0,
      minimo_compra:
        minimoCompra ||
        (mismoMaterialActual
          ? materialActual?.minimo_compra
          : 0) ||
        0,
      velocidad_laser_fibra_m_min:
        material?.velocidad_laser_fibra_m_min ||
        materialCosto?.velocidad_laser_fibra_m_min ||
        (mismoMaterialActual
          ? materialActual
              ?.velocidad_laser_fibra_m_min
          : 0) ||
        0,
      velocidad_laser_co2_m_min:
        material?.velocidad_laser_co2_m_min ||
        materialCosto?.velocidad_laser_co2_m_min ||
        (mismoMaterialActual
          ? materialActual?.velocidad_laser_co2_m_min
          : 0) ||
        0,
      aplicacion_corte_laser:
        material?.aplicacion_corte_laser ||
        materialCosto?.aplicacion_corte_laser ||
        (mismoMaterialActual
          ? materialActual?.aplicacion_corte_laser
          : "") ||
        APLICACIONES_CORTE_LASER.NO_APLICA,
      politica_minimo_compra:
        materialActual?.politica_minimo_compra ||
        "cobrar_minimo",
      proveedor_id:
        proveedorCatalogo?.id ||
        proveedorId ||
        (mismoMaterialActual
          ? materialActual?.proveedor_id
          : "") ||
        "",
      proveedor_codigo:
        proveedorCatalogo?.codigo ||
        proveedorCodigo ||
        (mismoMaterialActual
          ? materialActual?.proveedor_codigo
          : "") ||
        "",
      proveedor:
        proveedorCatalogo?.nombre ||
        proveedorNombre ||
        (mismoMaterialActual
          ? materialActual?.proveedor
          : "") ||
        "",
      moneda:
        materialCosto?.moneda ||
        material?.moneda ||
        (mismoMaterialActual
          ? materialActual?.moneda
          : "") ||
        "CLP",
      costo_origen:
        costoCatalogo > 0
          ? materialCosto?.id === material?.id
            ? "catalogo_material"
            : "catalogo_material_equivalente"
          : (mismoMaterialActual
              ? materialActual?.costo_origen
              : "") || "manual"
    };
  };

  const seleccionarMaterial = (
    indice,
    materialId
  ) => {
    actualizar({
      materiales: actualizarItem(
        formulario.materiales,
        indice,
        enriquecerMaterialDesdeCatalogo(
          formulario.materiales[indice],
          materialId
        )
      )
    });
  };

  const seleccionarCliente = clienteId => {
    const cliente = clientesCatalogo.find(
      item => item.id === clienteId
    );

    actualizar({
      cliente_id: clienteId,
      cliente_codigo: cliente?.codigo || "",
      cliente: cliente?.nombre || ""
    });
  };

  const seleccionarProveedor = (
    indice,
    proveedorId
  ) => {
    const proveedor = proveedoresCatalogo.find(
      item => item.id === proveedorId
    );

    actualizar({
      materiales: actualizarItem(
        formulario.materiales,
        indice,
        {
          proveedor_id: proveedorId,
          proveedor_codigo: proveedor?.codigo || "",
          proveedor: proveedor?.nombre || ""
        }
      )
    });
  };

  const obtenerAbsorcionOperativa = estacion => {
    const costoOperativo = costosOperativos.find(
      item =>
        item.planta_id === formulario.planta_id &&
        item.id === formulario.costo_operativo_config_id
    ) || costosOperativos.find(
      item => item.planta_id === formulario.planta_id
    );
    const absorcion =
      costoOperativo?.estaciones_absorcion?.find(
        item =>
          item.proceso_codigo ===
            estacion?.proceso_codigo &&
          item.estacion_codigo ===
            estacion?.estacion_codigo
      );

    return absorcion?.porcentaje_absorcion || 0;
  };

  const buscarCostoCompatible = useCallback((
    costos,
    estacion
  ) => {
    const porCodigo = costos.find(
      item =>
        item.proceso_codigo === estacion?.proceso_codigo &&
        item.estacion_codigo === estacion?.estacion_codigo
    );

    if (porCodigo) {
      return porCodigo;
    }

    const porNombre = costos.find(
      item =>
        mismoTexto(
          item.proceso_nombre,
          estacion?.proceso_nombre
        ) &&
        mismoTexto(
          item.estacion_nombre,
          estacion?.estacion_nombre
        )
    );

    if (porNombre) {
      return porNombre;
    }

    if (esCortePrensa(estacion)) {
      return costos.find(item =>
        esCortePrensa(item)
      );
    }

    return costos.find(
      item =>
        textosCompatibles(
          item.proceso_nombre,
          estacion?.proceso_nombre
        ) &&
        textosCompatibles(
          item.estacion_nombre,
          estacion?.estacion_nombre
        )
    );
  }, []);

  const buscarCostoBaseEstacion = useCallback(estacion => {
    const costosActivos = costosBaseEstacion.filter(
      item => item.activo !== false
    );
    const costosPlanta = costosActivos.filter(item =>
      plantaCompatible(
        item.planta_id,
        formulario.planta_id
      )
    );

    return (
      buscarCostoCompatible(
        costosPlanta,
        estacion
      ) ||
      buscarCostoCompatible(costosActivos, estacion)
    );
  }, [
    buscarCostoCompatible,
    costosBaseEstacion,
    formulario.planta_id
  ]);

  const completarCostosBasePendientes = useCallback(procesos => {
    let huboCambios = false;
    const procesosActualizados = procesos.map(proceso => {
      const costoHoraActual = Number(
        proceso.costo_hora
      );

      if (
        !procesoRequiereCostoHora(proceso) ||
        costoHoraActual > 0
      ) {
        return proceso;
      }

      const costoBase =
        buscarCostoBaseEstacion(proceso);
      const camposCosto =
        camposDesdeCostoBase(costoBase);

      if (!camposCosto) {
        return proceso;
      }

      huboCambios = true;
      return aplicarFormulaTiempoProceso({
        ...proceso,
        ...camposCosto
      });
    });

    return huboCambios ? procesosActualizados : procesos;
  }, [buscarCostoBaseEstacion]);

  useEffect(() => {
    if (costosBaseEstacion.length === 0) {
      return;
    }

    setFormulario(actual => {
      const procesosActualizados =
        completarCostosBasePendientes(
          actual.procesos
        );

      return procesosActualizados === actual.procesos
        ? actual
        : {
            ...actual,
            procesos: procesosActualizados
          };
    });
  }, [
    completarCostosBasePendientes,
    costosBaseEstacion.length
  ]);

  const seleccionarEstacion = (
    indice,
    clave
  ) => {
    const estacion = estacionesCatalogo.find(
      item =>
        `${item.proceso_codigo}__${item.estacion_codigo}` ===
        clave
    );
    const costoBase =
      buscarCostoBaseEstacion(estacion);
    const porcentajeCostoOperativo =
      obtenerAbsorcionOperativa(estacion);
    const procesoActual =
      formulario.procesos[indice] || {};
    const materialesLaserCompatibles =
      materialesConFormulaPlanchaLaser.filter(
        material =>
          materialCompatibleConLaser(
            material,
            estacion
          )
      );
    const materialPlanchaLaf =
      materialesLaserCompatibles[0];
    const indiceMaterialPlanchaLaf =
      materialPlanchaLaf ? 0 : "";
    const materialPaiImpresion =
      materialesPaiConFormula[0]?.material;
    const datosBase = {
      ...procesoActual,
      proceso_codigo:
        estacion?.proceso_codigo || "",
      proceso_nombre:
        estacion?.proceso_nombre || "",
      estacion_codigo:
        estacion?.estacion_codigo || "",
      estacion_nombre:
        estacion?.estacion_nombre || "",
      porcentaje_costo_operativo:
        porcentajeCostoOperativo,
      costo_operativo_origen:
        porcentajeCostoOperativo > 0
          ? "costos_operativos_planta"
          : "manual",
    ...(esDoblezCnc3d(estacion)
        ? valoresFormulaDoblezCnc(procesoActual)
        : esPlegadoraNeumatica(estacion)
          ? valoresFormulaPlegadoraNeumatica(
              procesoActual
            )
        : esCorteCncRecto(estacion)
          ? valoresFormulaCorteCncRecto(procesoActual)
          : esCortePrensa(estacion)
            ? valoresFormulaCortePrensa(procesoActual)
            : esImpresoraCpUv(estacion)
              ? {
                  ...valoresFormulaImpresionCpUv(
                    procesoActual
                  ),
                  ...camposImpresionDesdeMaterial(
                    materialPaiImpresion,
                    materialPaiImpresion ? 0 : ""
                  )
                }
            : esLaserCorte(estacion)
              ? {
                  ...valoresFormulaLaser(
                    procesoActual
                  ),
                  ...camposLaserDesdeMaterial(
                    materialPlanchaLaf,
                    indiceMaterialPlanchaLaf,
                    estacion,
                    procesoActual
                  )
                }
              : esSoldadoraMultipunto(estacion)
                ? valoresFormulaSoldaduraMultipunto(
                    procesoActual
                  )
              : esSoldaduraMig(estacion)
                ? valoresFormulaSoldaduraMig(
                    procesoActual
                  )
          : {})
    };

    actualizar({
      procesos: actualizarItem(
        formulario.procesos,
        indice,
        aplicarFormulaTiempoProceso({
          ...datosBase,
          ...(camposDesdeCostoBase(costoBase) || {
            costo_hora:
              procesoActual.costo_hora || 0,
            costo_base_estacion_id: "",
            costo_hora_origen:
              procesoActual.costo_hora
                ? "manual"
                : "",
            costo_hora_detalle: null
          })
        })
      )
    });
  };

  const limpiarFormulario = () => {
    setFormulario(estadoInicial);
    setEditandoId("");
    setMensaje("");
    setError("");
  };

  const cargarParaEditar = cotizacion => {
    const formularioCotizacion =
      aFormularioCotizacionTecnica(cotizacion);
    const materialesEnriquecidos =
      formularioCotizacion.materiales.map(material =>
        material.material_id
          ? {
              ...material,
              ...enriquecerMaterialDesdeCatalogo(
                material,
                material.material_id
              )
            }
          : material
      );

    setFormulario({
      ...formularioCotizacion,
      materiales: recalcularMaterialesConFormula(
        materialesEnriquecidos
      )
    });
    setEditandoId(cotizacion.id);
    setMensaje(
      "Cotización cargada para editar. Al guardar se actualizará el mismo registro."
    );
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const cargarComoNuevaVersion = cotizacion => {
    const base =
      aFormularioCotizacionTecnica(cotizacion);
    setFormulario({
      ...base,
      version: `${base.version || "V1"} copia`,
      estado: "borrador",
      materiales: recalcularMaterialesConFormula(
        base.materiales
      )
    });
    setEditandoId("");
    setMensaje(
      "Cotización cargada como nueva versión. Al guardar se creará un registro nuevo."
    );
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const guardar = async () => {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const formularioPreparado = {
        ...formulario,
        materiales: recalcularMaterialesConFormula(
          formulario.materiales
        )
      };
      if (editandoId) {
        await actualizarCotizacionTecnica(
          db,
          perfil,
          editandoId,
          formularioPreparado
        );
        setMensaje(
          "Cotización técnica actualizada."
        );
      } else {
        await guardarCotizacionTecnica(
          db,
          perfil,
          formularioPreparado
        );
        setMensaje("Cotización técnica guardada.");
      }
      setFormulario(estadoInicial);
      setEditandoId("");
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la cotización."
      );
    } finally {
      setGuardando(false);
    }
  };

  const renderLineasMateriales = ({
    tipoLinea,
    titulo,
    descripcion,
    etiquetaSelector,
    ayudaSelector,
    textoBoton
  }) => {
    const lineas = formulario.materiales
      .map((material, indice) => ({
        material,
        indice
      }))
      .filter(
        item =>
          (item.material.tipo_linea || "material") ===
          tipoLinea
      );

    return (
      <SeccionDesplegable
        clave={`${tipoLinea}-${editandoId || "nueva"}`}
        titulo={titulo}
        resumen={`${lineas.length} línea${lineas.length === 1 ? "" : "s"}`}
        abierta={!editandoId}
      >
        <p style={{
          color: "#64748B",
          marginTop: -4,
          lineHeight: 1.4
        }}>
          {descripcion}
        </p>
        {lineas.length === 0 && (
          <div style={{
            background: "#F8FAFC",
            borderRadius: 12,
            padding: 12,
            color: "#64748B",
            marginBottom: 10
          }}>
            Todavía no hay líneas en esta sección.
          </div>
        )}
        {lineas.map(({ material, indice }) => {
          const lecturaMaterial =
            material.expresion_consumo
              ? aplicarExpresionConsumo(material)
              : material;
          const lecturaFraccionaria =
            obtenerTipoLecturaConsumoMaterial(
              material
            ) === TIPOS_LECTURA_CONSUMO.FRACCION_MP;
          const lecturaAlambre =
            obtenerTipoLecturaConsumoMaterial(
              material
            ) === TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO;
          const lecturaPlancha =
            [
              TIPOS_LECTURA_CONSUMO.PLANCHA_LAF,
              TIPOS_LECTURA_CONSUMO.PLANCHA_1220X2440,
              TIPOS_LECTURA_CONSUMO.PLANCHA_1520X2440,
              TIPOS_LECTURA_CONSUMO.PLANCHA_1220X1220
            ].includes(
              obtenerTipoLecturaConsumoMaterial(
                material
              )
            );
          const esTintaUvCmyk =
            tipoLinea === "suministro" &&
            esSuministroTintaUvCmyk(material);
          const esCajaCorrugada =
            tipoLinea === "material" &&
            esMaterialCajaCorrugada(material);
          const esPallet =
            tipoLinea === "suministro" &&
            esSuministroPallet(material);
          const lecturaCaja = esCajaCorrugada
            ? calcularCajaCorrugada({
                largo_mm: material.caja_largo_mm,
                ancho_mm: material.caja_ancho_mm,
                alto_mm: material.caja_alto_mm,
                pestana_mm:
                  material.caja_pestana_mm ?? 40,
                unidades_por_caja:
                  material.caja_unidades || 1,
                cantidad: 1,
                costo_m2: material.costo_unitario
              })
            : null;
          const actualizarCaja = cambios => {
            const actualizado = { ...material, ...cambios };
            const calculo = calcularCajaCorrugada({
              largo_mm: actualizado.caja_largo_mm,
              ancho_mm: actualizado.caja_ancho_mm,
              alto_mm: actualizado.caja_alto_mm,
              pestana_mm:
                actualizado.caja_pestana_mm ?? 40,
              unidades_por_caja:
                actualizado.caja_unidades || 1,
              cantidad: 1,
              costo_m2: actualizado.costo_unitario
            });
            actualizar({
              materiales: actualizarItem(
                formulario.materiales,
                indice,
                {
                  ...cambios,
                  unidad: "m2",
                  tipo_formula_consumo:
                    TIPO_FORMULA_CAJA_CORRUGADA,
                  consumo_unitario:
                    calculo.consumo_unitario_referencial_m2,
                  area_m2_por_producto:
                    calculo.consumo_unitario_referencial_m2,
                  politica_minimo_compra: "consumo_real"
                }
              )
            });
          };
          const actualizarPallet = cambios => {
            const actualizado = { ...material, ...cambios };
            const cajasPorPallet = Math.max(
              Number(actualizado.pallet_cajas) || 1,
              1
            );
            const caja = formulario.materiales.find(
              esMaterialCajaCorrugada
            );
            const unidadesPorCaja = Math.max(
              Number(caja?.caja_unidades) || 1,
              1
            );
            actualizar({
              materiales: actualizarItem(
                formulario.materiales,
                indice,
                {
                  ...cambios,
                  unidad: "un",
                  tipo_formula_consumo:
                    TIPO_FORMULA_PALLET,
                  consumo_unitario:
                    1 / (unidadesPorCaja * cajasPorPallet),
                  peso_kg_por_unidad:
                    Number(actualizado.pallet_peso_kg) || 0,
                  politica_minimo_compra: "consumo_real"
                }
              )
            });
          };

          return (
          <details
            key={indice}
            style={{
              background: "#F8FAFC",
              borderRadius: 14,
              border: "1px solid #CBD5E1",
              marginBottom: 12,
              overflow: "hidden"
            }}
          >
            <summary style={{
              ...resumenDesplegable,
              padding: 14
            }}>
              <span style={{ fontWeight: "bold" }}>
                {material.codigo || `${tipoLinea} ${indice + 1}`} ·{" "}
                {material.nombre || "Sin nombre"}
              </span>
              <span style={{ color: "#475569", fontSize: 13 }}>
                {material.consumo_unitario || 0}{" "}
                {material.unidad || "un"} ·{" "}
                {formatoNumero(
                  material.costo_unitario || 0,
                  formulario.moneda
                )}
              </span>
            </summary>
          <div style={{ ...lineaCotizador, marginBottom: 0 }}>
            <CampoConAyuda
              etiqueta={etiquetaSelector}
              ayuda={ayudaSelector}
            >
              <select
                style={campo}
                value={material.material_id}
                onChange={e =>
                  seleccionarMaterial(
                    indice,
                    e.target.value
                  )
                }
              >
                <option value="">Línea libre</option>
                {materialesCatalogo
                  .filter(item =>
                    materialCorrespondeATipoLinea(
                      item,
                      tipoLinea
                    )
                  )
                  .map(item => (
                  <option key={item.id} value={item.id}>
                    {item.codigo} - {item.nombre}
                  </option>
                ))}
              </select>
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Proveedor"
              ayuda="Selecciona proveedor del catálogo."
            >
              <select
                style={campo}
                value={material.proveedor_id || ""}
                onChange={e =>
                  seleccionarProveedor(
                    indice,
                    e.target.value
                  )
                }
              >
                <option value="">
                  Seleccionar proveedor
                </option>
                {proveedoresCatalogo.map(proveedor => (
                  <option
                    key={proveedor.id}
                    value={proveedor.id}
                  >
                    {proveedor.codigo} -{" "}
                    {proveedor.nombre}
                  </option>
                ))}
              </select>
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Categoría plantilla PepsiCo"
              ayuda="Define la columna exacta donde se informará este costo en la vista y el Excel PepsiCo."
            >
              <select
                style={campo}
                value={
                  material.categoria_pepsico ||
                  inferirCategoriaPepsico(material) ||
                  ""
                }
                onChange={e =>
                  actualizar({
                    materiales: actualizarItem(
                      formulario.materiales,
                      indice,
                      {
                        categoria_pepsico:
                          e.target.value
                      }
                    )
                  })
                }
              >
                <option value="">
                  Seleccionar categoría
                </option>
                {CATEGORIAS_PEPSICO.map(categoria => (
                  <option
                    key={categoria.clave}
                    value={categoria.clave}
                  >
                    {categoria.etiqueta}
                  </option>
                ))}
              </select>
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Compra mínima"
              ayuda="Define si cargas toda la compra mínima o solo el consumo cuando el sobrante se reutiliza."
            >
              <select
                style={campo}
                value={
                  material.politica_minimo_compra ||
                  "cobrar_minimo"
                }
                onChange={e =>
                  actualizar({
                    materiales: actualizarItem(
                      formulario.materiales,
                      indice,
                      {
                        politica_minimo_compra:
                          e.target.value
                      }
                    )
                  })
                }
              >
                <option value="cobrar_minimo">
                  Cobrar compra mínima completa
                </option>
                <option value="consumo_real">
                  Sobrante reutilizable: cobrar consumo real
                </option>
              </select>
            </CampoConAyuda>
            {esTintaUvCmyk && (
              <>
                <CampoConAyuda
                  etiqueta="Usar fórmula desde PAI"
                  ayuda="Elige una MP PAI ya ingresada arriba. El cotizador calcula área m² y consumo de tinta UV CMYK con base 12 ml/m²."
                >
                  <select
                    style={campo}
                    value={
                      material.formula_material_indice ||
                      ""
                    }
                    onChange={e => {
                      const opcion =
                        materialesPaiConFormula.find(
                          item =>
                            item.indice.toString() ===
                            e.target.value
                        );

                      actualizar({
                        materiales: actualizarItem(
                          formulario.materiales,
                          indice,
                          opcion
                            ? calcularLineaTintaUvCmyk({
                                suministro: material,
                                materialPai:
                                  opcion.material,
                                indiceMaterial:
                                  opcion.indice
                              })
                            : {
                                ...material,
                                tipo_formula_consumo: "",
                                formula_material_indice:
                                  "",
                                formula_material_id: "",
                                formula_material_codigo:
                                  "",
                                formula_material_nombre:
                                  "",
                                expresion_consumo: "",
                                unidad_expresion_consumo:
                                  "mm",
                                area_m2_por_producto: 0,
                                consumo_tinta_ml_por_m2:
                                  0,
                                consumo_tinta_ml_total: 0
                              }
                        )
                      });
                    }}
                  >
                    <option value="">
                      Seleccionar fórmula PAI
                    </option>
                    {materialesPaiConFormula.map(
                      ({ material: materialPai, indice: indicePai }) => (
                        <option
                          key={indicePai}
                          value={indicePai}
                        >
                          {materialPai.codigo} -{" "}
                          {materialPai.nombre} |{" "}
                          {materialPai.ancho_pieza}x
                          {materialPai.alto_pieza} mm x{" "}
                          {materialPai.piezas_por_producto ||
                            materialPai.subproductos ||
                            1}
                        </option>
                      )
                    )}
                  </select>
                </CampoConAyuda>
                <CampoConAyuda
                  etiqueta="Lectura tinta UV"
                  ayuda="Consumo propuesto por producto. Puedes revisar el costo unitario del SUM en su catálogo."
                >
                  <div style={{
                    ...campo,
                    background: material.formula_material_codigo
                      ? "#ECFDF5"
                      : "#FFF7ED",
                    color: material.formula_material_codigo
                      ? "#047857"
                      : "#9A3412",
                    minHeight: 42,
                    fontWeight: "bold"
                  }}>
                    {material.formula_material_codigo
                      ? `Area PAI: ${material.area_m2_por_producto || 0} m2/producto | Consumo tinta: ${material.consumo_tinta_ml_total || 0} ml/producto | Base: ${CONSUMO_TINTA_UV_CMYK_ML_M2} ml/m2 | Desde: ${material.formula_material_codigo}`
                      : "Agrega primero una MP PAI con fórmula de plancha y luego selecciónala aquí."}
                  </div>
                </CampoConAyuda>
              </>
            )}
            {esPallet && (
              <div style={{
                gridColumn: "1 / -1",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                background: "#F0FDF4",
                border: "1px solid #86EFAC"
              }}>
                {[
                  ["pallet_cajas", "Cajas por pallet", 1],
                  ["pallet_largo_mm", "Largo pallet (mm)", 1],
                  ["pallet_ancho_mm", "Ancho pallet (mm)", 1],
                  ["pallet_peso_kg", "Peso pallet vacío (kg)", 0],
                  ["pallets_adicionales", "Pallets adicionales", 0]
                ].map(([clave, etiqueta, minimo]) => (
                  <CampoConAyuda
                    key={clave}
                    etiqueta={etiqueta}
                    ayuda={clave === "pallet_cajas"
                      ? "Cantidad máxima de cajas master que se cargan en un pallet."
                      : "Dato logístico editable para calcular costo, peso y transporte."}
                  >
                    <input
                      style={campo}
                      type="number"
                      min={minimo}
                      step="1"
                      value={material[clave] ?? ({
                        pallet_cajas: 1,
                        pallet_largo_mm: 1200,
                        pallet_ancho_mm: 1000,
                        pallet_peso_kg: 20,
                        pallets_adicionales: 0
                      }[clave])}
                      onChange={e => actualizarPallet({
                        [clave]: e.target.value
                      })}
                    />
                  </CampoConAyuda>
                ))}
                <div style={{
                  ...campo,
                  background: "white",
                  color: "#166534",
                  fontWeight: "bold",
                  lineHeight: 1.5
                }}>
                  Base: {material.pallet_largo_mm || 1200} ×{" "}
                  {material.pallet_ancho_mm || 1000} mm<br />
                  Peso vacío: {material.pallet_peso_kg ?? 20} kg<br />
                  El número de pallets se calcula por cada escala.
                </div>
              </div>
            )}
            {tipoLinea === "material" && (
              <>
                {esCajaCorrugada && (
                  <div style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 10,
                    padding: 12,
                    borderRadius: 12,
                    background: "#FFF7ED",
                    border: "1px solid #FDBA74"
                  }}>
                    {[
                      ["caja_largo_mm", "Largo caja (mm)", 1],
                      ["caja_ancho_mm", "Ancho caja (mm)", 1],
                      ["caja_alto_mm", "Alto caja (mm)", 1],
                      ["caja_pestana_mm", "Pestaña (mm)", 1],
                      ["caja_unidades", "Unidades por caja", 1]
                    ].map(([clave, etiqueta, minimo]) => (
                      <CampoConAyuda
                        key={clave}
                        etiqueta={etiqueta}
                        ayuda={clave === "caja_unidades"
                          ? "Productos que caben dentro de una caja master."
                          : "Medida tomada del plano en milímetros."}
                      >
                        <input
                          style={campo}
                          type="number"
                          min={minimo}
                          step="1"
                          value={material[clave] || ""}
                          onChange={e => actualizarCaja({
                            [clave]: e.target.value
                          })}
                        />
                      </CampoConAyuda>
                    ))}
                    <div style={{
                      ...campo,
                      background: "white",
                      color: "#9A3412",
                      fontWeight: "bold",
                      lineHeight: 1.5
                    }}>
                      Desarrollo: {lecturaCaja.desarrollo_horizontal_mm} ×{" "}
                      {lecturaCaja.desarrollo_vertical_mm} mm<br />
                      Área por caja: {lecturaCaja.area_caja_m2} m²<br />
                      Consumo referencial por producto:{" "}
                      {lecturaCaja.consumo_unitario_referencial_m2} m²<br />
                      Costo por caja: {formatoNumero(
                        lecturaCaja.costo_caja,
                        "CLP"
                      )}
                    </div>
                  </div>
                )}
                {!esCajaCorrugada && <CampoConAyuda
                  etiqueta="Fórmula consumo"
                  ayuda={
                    lecturaFraccionaria
                      ? "Opcional. Ej: (1/96)*3. La división es la fracción de MP por pieza; el multiplicador es la cantidad de piezas del producto."
                      : lecturaPlancha
                        ? "Opcional. Ej: ((61+607+61)(61+445+61))*1. Cada grupo interno es un lado de la pieza en mm; el multiplicador es cuántas piezas lleva el producto."
                      : lecturaAlambre
                        ? "Opcional. Ej: (12+117+360+117+12)*2. La suma es una pieza doblada; el multiplicador es la cantidad de piezas del producto."
                      : "Opcional. Ej: (131+360+71)*1. Cada valor es un corte en mm; el multiplicador es la cantidad de subproductos."
                  }
                >
                  <input
                    style={campo}
                    type="text"
                    placeholder={
                      lecturaFraccionaria
                        ? "Ej: (1/96)*3"
                        : lecturaPlancha
                          ? "Ej: ((61+607+61)(61+445+61))*1"
                        : lecturaAlambre
                          ? "Ej: (12+117+360+117+12)*2"
                        : "Ej: (131+360+71)*1"
                    }
                    value={
                      material.expresion_consumo || ""
                    }
                    onChange={e => {
                      const actualizado =
                        aplicarExpresionConsumo({
                          ...material,
                          expresion_consumo:
                            e.target.value
                        });

                      actualizar({
                        materiales: actualizarItem(
                          formulario.materiales,
                          indice,
                          actualizado
                        )
                      });
                    }}
                  />
                  {material.expresion_consumo_error && (
                    <div style={{
                      color: "#B71C1C",
                      fontSize: 12,
                      marginTop: 4
                    }}>
                      {material.expresion_consumo_error}
                    </div>
                  )}
                </CampoConAyuda>}
                {!esCajaCorrugada && <CampoConAyuda
                  etiqueta="Unidad fórmula"
                  ayuda="Unidad usada en la fórmula. Si el material está en metros, mm se convierte a m."
                >
                  <select
                    style={campo}
                    value={
                      material.unidad_expresion_consumo ||
                      "mm"
                    }
                    onChange={e => {
                      const actualizado =
                        aplicarExpresionConsumo({
                          ...material,
                          unidad_expresion_consumo:
                            e.target.value
                        });

                      actualizar({
                        materiales: actualizarItem(
                          formulario.materiales,
                          indice,
                          actualizado
                        )
                      });
                    }}
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="un">un</option>
                  </select>
                </CampoConAyuda>}
                {!esCajaCorrugada && <CampoConAyuda
                  etiqueta="Lectura técnica"
                  ayuda="Resumen calculado desde la fórmula para validar rápido el supuesto."
                >
                  <div style={{
                    ...campo,
                    background: "#EFF6FF",
                    color: "#1E3A8A",
                    minHeight: 42,
                    fontWeight: "bold"
                  }}>
                    {material.expresion_consumo
                      ? lecturaFraccionaria
                        ? `Fracción MP por pieza: ${lecturaMaterial.fraccion_por_pieza || 0} | Piezas producto: ${lecturaMaterial.subproductos || 1} | Consumo total: ${lecturaMaterial.consumo_unitario || 0} ${material.unidad || "unidad"}`
                        : lecturaPlancha
                          ? `Pieza: ${lecturaMaterial.ancho_pieza || 0} x ${lecturaMaterial.alto_pieza || 0} mm | Plancha: ${lecturaMaterial.ancho_plancha || 1000} x ${lecturaMaterial.alto_plancha || 3000} mm | Piezas/plancha: ${lecturaMaterial.piezas_por_plancha || 0} | Fracción por pieza: ${lecturaMaterial.fraccion_plancha || "0"} | Piezas producto: ${lecturaMaterial.piezas_por_producto || lecturaMaterial.subproductos || 1} | Consumo total: ${lecturaMaterial.consumo_unitario || 0} plancha`
                        : lecturaAlambre
                          ? `Doblez por pieza: ${lecturaMaterial.dobleces_por_pieza || 0} | Cortes por pieza: ${lecturaMaterial.cortes_por_pieza || 0} | Doblez por producto: ${lecturaMaterial.dobleces_por_producto || 0} | Cortes por producto: ${lecturaMaterial.cortes_por_producto || 0} | Consumo pieza: ${lecturaMaterial.consumo_pieza_formula || lecturaMaterial.longitud_por_pieza || 0} ${lecturaMaterial.unidad_expresion_consumo || "mm"} | Consumo total: ${lecturaMaterial.consumo_total_formula || 0} ${lecturaMaterial.unidad_expresion_consumo || "mm"}`
                        : `Cortes: ${lecturaMaterial.cortes_calculados || 0} | Cortes por subproducto: ${lecturaMaterial.cortes_por_subproducto || lecturaMaterial.cortes_calculados || 0} | Subproductos: ${lecturaMaterial.subproductos || 1} | Largo base: ${lecturaMaterial.longitud_por_pieza || 0} ${lecturaMaterial.unidad_expresion_consumo || "mm"}`
                      : "Sin fórmula"}
                  </div>
                </CampoConAyuda>}
              </>
            )}
            {CAMPOS_MATERIAL_ESTIMADO.filter(
              campoConfig =>
                !(
                  campoConfig.clave === "proveedor" &&
                  material.proveedor_id
                ) &&
                !(
                  esCajaCorrugada &&
                  ["unidad", "consumo_unitario", "minimo_compra"]
                    .includes(campoConfig.clave)
                ) &&
                !(
                  esPallet &&
                  [
                    "unidad",
                    "consumo_unitario",
                    "minimo_compra",
                    "peso_kg_por_unidad"
                  ].includes(campoConfig.clave)
                )
            ).map(campoConfig => (
              <CampoConAyuda
                key={campoConfig.clave}
                etiqueta={campoConfig.etiqueta}
                ayuda={campoConfig.ayuda}
              >
                <input
                  style={campo}
                  type={
                    [
                      "consumo_unitario",
                      "merma_porcentaje",
                      "costo_unitario",
                      "minimo_compra"
                    ].includes(campoConfig.clave)
                      ? "number"
                      : "text"
                  }
                  inputMode={
                    PASOS_MATERIAL_ESTIMADO[
                      campoConfig.clave
                    ]
                      ? "decimal"
                      : undefined
                  }
                  step={
                    PASOS_MATERIAL_ESTIMADO[
                      campoConfig.clave
                    ]
                  }
                  min={
                    PASOS_MATERIAL_ESTIMADO[
                      campoConfig.clave
                    ]
                      ? "0"
                      : undefined
                  }
                  placeholder={campoConfig.etiqueta}
                  value={material[campoConfig.clave] || ""}
                  onChange={e => {
                    const cambiosMaterial = {
                      [campoConfig.clave]:
                        e.target.value,
                      ...(campoConfig.clave === "proveedor"
                        ? {
                            proveedor_id: "",
                            proveedor_codigo: ""
                          }
                        : {}),
                      ...(campoConfig.clave ===
                      "costo_unitario"
                        ? {
                            costo_origen: "manual"
                          }
                        : {})
                    };

                    const baseActualizada = {
                      ...material,
                      ...cambiosMaterial
                    };
                    const indiceOrigenTinta = Number(
                      material.formula_material_indice
                    );
                    const materialPaiTinta =
                      esTintaUvCmyk &&
                      campoConfig.clave === "unidad" &&
                      Number.isInteger(
                        indiceOrigenTinta
                      )
                        ? formulario.materiales[
                            indiceOrigenTinta
                          ]
                        : null;
                    const materialActualizado =
                      materialPaiTinta &&
                      esPlanchaPaiConFormula(
                        materialPaiTinta
                      )
                        ? calcularLineaTintaUvCmyk({
                            suministro: baseActualizada,
                            materialPai:
                              materialPaiTinta,
                            indiceMaterial:
                              indiceOrigenTinta
                          })
                        : campoConfig.clave === "unidad"
                          ? aplicarExpresionConsumo(
                              baseActualizada
                            )
                          : cambiosMaterial;

                    actualizar({
                      materiales: actualizarItem(
                        formulario.materiales,
                        indice,
                        materialActualizado
                      )
                    });
                  }}
                />
              </CampoConAyuda>
            ))}
          </div>
          </details>
          );
        })}
        <button
          type="button"
          style={botonSecundario}
          onClick={() =>
            actualizar({
              materiales: [
                ...formulario.materiales,
                crearLineaMaterial(tipoLinea)
              ]
            })
          }
        >
          {textoBoton}
        </button>
      </SeccionDesplegable>
    );
  };

  return (
    <div style={paginaCotizador}>
      <BotonVolver
        onClick={onVolver}
        style={{ marginBottom: 12 }}
      >
        Volver
      </BotonVolver>

      <h2>Costeo y Cotización Técnica</h2>
      <p style={{
        color: "#475569",
        lineHeight: 1.5
      }}>
        Crea un producto prototipo, estima materiales,
        procesos, riesgos y lead time por escala antes
        de fabricar. El objetivo es cotizar con
        supuestos visibles y comparables contra el costo
        real futuro.
      </p>

      {error && (
        <div role="alert" style={{
          background: "#FFEBEE",
          color: "#B71C1C",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
          fontWeight: "bold"
        }}>
          {error}
        </div>
      )}
      {mensaje && (
        <div role="status" style={{
          background: "#E8F5E9",
          color: "#1B5E20",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
          fontWeight: "bold"
        }}>
          {mensaje}
        </div>
      )}

      {editandoId && (
        <section style={{
          ...cardCotizador,
          background: "linear-gradient(135deg, #EFF6FF, #F8FAFC)",
          borderColor: "#60A5FA"
        }}>
          <div style={franjaCard} />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap"
          }}>
            <div>
              <div style={{ color: "#1D4ED8", fontWeight: "bold" }}>
                RESUMEN DE LA COTIZACIÓN
              </div>
              <h3 style={{ margin: "4px 0" }}>
                {formulario.nombre_producto || "Producto sin nombre"}
              </h3>
              <div style={{ color: "#475569" }}>
                {formulario.cliente || "Cliente sin asignar"} ·{" "}
                {formulario.version || "Sin versión"} ·{" "}
                {formulario.estado}
              </div>
            </div>
            <span style={{
              padding: "7px 11px",
              borderRadius: 999,
              background: "#DBEAFE",
              color: "#1E40AF",
              fontWeight: "bold"
            }}>
              Confianza {formulario.nivel_confianza}
            </span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            gap: 10,
            marginTop: 16
          }}>
            {[
              ["Cantidad", resultadoBase?.cantidad || "-"],
              ["Costo unitario", formatoNumero(resultadoBase?.costo_unitario || 0, formulario.moneda)],
              ["Precio EXW/u", formatoNumero(resultadoBase?.precio_unitario_sugerido || 0, formulario.moneda)],
              [
                `${incotermSeleccionado}/u`,
                formatoNumero(
                  resultadoBase?.precio_unitario_cip_sugerido ||
                    resultadoBase?.precio_unitario_sugerido || 0,
                  formulario.moneda
                )
              ],
              ["Peso unitario", formatoKg(resultadoBase?.peso_unitario_kg || 0)],
              ["Lead time", `${resultadoBase?.lead_time_flujo_dias || 0} días`]
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} style={{
                background: "white",
                border: "1px solid #BFDBFE",
                borderRadius: 12,
                padding: 11
              }}>
                <div style={{ color: "#64748B", fontSize: 12 }}>
                  {etiqueta}
                </div>
                <strong style={{ fontSize: 17 }}>{valor}</strong>
              </div>
            ))}
          </div>
          {cotizaExportacion &&
            incotermSeleccionado !== "NACIONAL" &&
            !formulario.pais_destino && (
            <div role="alert" style={{
              marginTop: 12,
              padding: 11,
              borderRadius: 10,
              background: "#FFF7ED",
              border: "1px solid #FDBA74",
              color: "#9A3412",
              fontWeight: "bold"
            }}>
              ⚠ {incotermSeleccionado} requiere definir el país de destino.
              La logística aparece en cero hasta completar ese dato.
            </div>
          )}
        </section>
      )}

      <SeccionDesplegable
        clave={`producto-${editandoId || "nueva"}`}
        titulo={`Producto prototipo${editandoId ? " (editando)" : ""}`}
        resumen={formulario.nombre_producto || "Identificación y cliente"}
        abierta
      >
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          <select
            style={campo}
            value={formulario.cliente_id}
            onChange={e =>
              seleccionarCliente(e.target.value)
            }
          >
            <option value="">
              Seleccionar cliente
            </option>
            {clientesCatalogo.map(cliente => (
              <option
                key={cliente.id}
                value={cliente.id}
              >
                {cliente.codigo} - {cliente.nombre}
              </option>
            ))}
          </select>
          <input
            style={campo}
            placeholder="Cliente temporal"
            value={formulario.cliente}
            onChange={e =>
              actualizar({
                cliente: e.target.value,
                cliente_id: "",
                cliente_codigo: ""
              })
            }
          />
          <input
            style={campo}
            placeholder="Nombre producto"
            value={formulario.nombre_producto}
            onChange={e =>
              actualizar({
                nombre_producto: e.target.value
              })
            }
          />
          <input
            style={campo}
            placeholder="Versión"
            value={formulario.version}
            onChange={e =>
              actualizar({ version: e.target.value })
            }
          />
          <select
            style={campo}
            value={formulario.estado}
            onChange={e =>
              actualizar({ estado: e.target.value })
            }
          >
            {ESTADOS_COTIZACION.map(estado => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <select
            style={campo}
            value={formulario.nivel_confianza}
            onChange={e =>
              actualizar({
                nivel_confianza: e.target.value
              })
            }
          >
            {NIVELES_CONFIANZA.map(nivel => (
              <option key={nivel} value={nivel}>
                Confianza {nivel}
              </option>
            ))}
          </select>
          <select
            style={campo}
            value={formulario.planta_id}
            onChange={e =>
              aplicarCostoOperativoPlanta(
                e.target.value
              )
            }
          >
            <option value="chile">BBA Chile</option>
            <option value="peru">BBA Perú</option>
          </select>
        </div>
        <textarea
          style={{
            ...campo,
            minHeight: 70,
            marginTop: 12
          }}
          placeholder="Descripción técnica preliminar"
          value={formulario.descripcion}
          onChange={e =>
            actualizar({ descripcion: e.target.value })
          }
        />
      </SeccionDesplegable>

      <SeccionDesplegable
        clave={`pepsico-${editandoId || "nueva"}`}
        titulo="Datos para plantilla PepsiCo"
        resumen={`${formulario.pais_cotizacion || "Chile"} · ${formulario.moneda}`}
        abierta={!editandoId}
      >
        <p style={{
          color: "#64748B",
          marginTop: -4,
          lineHeight: 1.4
        }}>
          Estos datos se muestran en la vista PepsiCo y se
          conservan al guardar la cotización. Chile se cotiza en
          CLP; Argentina, Uruguay y Paraguay en USD.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          <CampoConAyuda
            etiqueta="País de cotización"
            ayuda="La moneda se asigna automáticamente según el país."
          >
            <select
              style={campo}
              value={formulario.pais_cotizacion || "Chile"}
              onChange={e => {
                const pais = e.target.value;
                const internacional = pais !== "Chile";
                const preset =
                  PRESETS_LOGISTICA_DESTINO[pais] || {};
                actualizar({
                  pais_cotizacion: pais,
                  moneda: internacional ? "USD" : "CLP",
                  pais_destino: internacional ? pais : "",
                  incoterm: internacional
                    ? formulario.incoterm === "EXW"
                      ? "CIP"
                      : formulario.incoterm
                    : "EXW",
                  ...(internacional ? preset : {})
                });
              }}
            >
              {PAISES_PEPSICO.map(pais => (
                <option key={pais} value={pais}>
                  {pais}
                </option>
              ))}
            </select>
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Moneda obligatoria"
            ayuda="Se deriva del país y no se edita manualmente."
          >
            <div style={{
              ...campo,
              background: "#F1F5F9",
              fontWeight: "bold"
            }}>
              {formulario.pais_cotizacion === "Chile"
                ? "CLP - Pesos chilenos"
                : "USD - Dólares americanos"}
            </div>
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Link de planos"
            ayuda="Enlace que recibirá PepsiCo para consultar los planos."
          >
            <input
              style={campo}
              type="url"
              placeholder="https://..."
              value={formulario.link_planos || ""}
              onChange={e =>
                actualizar({ link_planos: e.target.value })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Gráficos laterales"
            ayuda="Indica si el modelo contempla gráficas laterales."
          >
            <select
              style={campo}
              value={formulario.graficos_laterales || "NO"}
              onChange={e =>
                actualizar({
                  graficos_laterales: e.target.value
                })
              }
            >
              <option value="NO">NO</option>
              <option value="SI">SI</option>
            </select>
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Producción mínima semanal"
            ayuda="Volumen mínimo semanal de racks informado al cliente."
          >
            <input
              style={campo}
              type="number"
              min="0"
              step="1"
              value={formulario.produccion_minima_semanal || ""}
              onChange={e =>
                actualizar({
                  produccion_minima_semanal: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Plazo comercial de entrega"
            ayuda="Si queda vacío se usa el lead time calculado."
          >
            <input
              style={campo}
              placeholder="Ej: 3 a 4 semanas"
              value={formulario.plazo_entrega_comercial || ""}
              onChange={e =>
                actualizar({
                  plazo_entrega_comercial: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Concepto adicional unitario"
            ayuda="Importe por producto, en la moneda de la cotización."
          >
            <input
              style={campo}
              type="number"
              min="0"
              step="0.01"
              value={formulario.concepto_adicional || ""}
              onChange={e =>
                actualizar({
                  concepto_adicional: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Aplicar concepto adicional en"
            ayuda="Define en qué total se incorpora el concepto."
          >
            <select
              style={campo}
              value={
                formulario.concepto_adicional_aplicacion ||
                "exw"
              }
              onChange={e =>
                actualizar({
                  concepto_adicional_aplicacion:
                    e.target.value
                })
              }
            >
              <option value="exw">Producción / EXW</option>
              <option value="cif">Flete / CIF</option>
              <option value="ddp">Flete / DDP</option>
            </select>
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Descripción concepto adicional"
            ayuda="Explica el concepto para la planilla."
          >
            <input
              style={campo}
              value={
                formulario.concepto_adicional_descripcion ||
                ""
              }
              onChange={e =>
                actualizar({
                  concepto_adicional_descripcion:
                    e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Flete CIF unitario"
            ayuda="Opcional. Si está vacío se usa la logística calculada para exportación."
          >
            <input
              style={campo}
              type="number"
              min="0"
              step="0.01"
              value={formulario.flete_cif_unitario || ""}
              onChange={e =>
                actualizar({
                  flete_cif_unitario: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Flete DDP unitario"
            ayuda="Segundo tramo o gasto adicional desde CIF hasta DDP."
          >
            <input
              style={campo}
              type="number"
              min="0"
              step="0.01"
              value={formulario.flete_ddp_unitario || ""}
              onChange={e =>
                actualizar({
                  flete_ddp_unitario: e.target.value
                })
              }
            />
          </CampoConAyuda>
        </div>
        <textarea
          style={{
            ...campo,
            minHeight: 65,
            marginTop: 12
          }}
          placeholder="Comentarios para la planilla PepsiCo"
          value={formulario.comentarios_pepsico || ""}
          onChange={e =>
            actualizar({
              comentarios_pepsico: e.target.value
            })
          }
        />
      </SeccionDesplegable>

      <SeccionDesplegable
        clave={`supuestos-${editandoId || "nueva"}`}
        titulo="Supuestos comerciales y lead time"
        resumen={`Escalas ${formulario.escalas} · margen ${formulario.margen_porcentaje}%`}
        abierta={!editandoId}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12
        }}>
          <CampoConAyuda
            etiqueta="Escalas"
            ayuda="Cantidades a cotizar separadas por coma. Ej: 50, 100, 500."
          >
            <input
              style={campo}
              placeholder="50, 100, 500"
              value={formulario.escalas}
              onChange={e =>
                actualizar({ escalas: e.target.value })
              }
            />
          </CampoConAyuda>
          {SUPUESTOS_COTIZACION.map(campoConfig => (
            <CampoConAyuda
              key={campoConfig.clave}
              etiqueta={campoConfig.etiqueta}
              ayuda={campoConfig.ayuda}
            >
              <input
                style={campo}
                type="number"
                placeholder={campoConfig.etiqueta}
                value={formulario[campoConfig.clave]}
                onChange={e =>
                  actualizar({
                    [campoConfig.clave]:
                      e.target.value,
                    ...(campoConfig.clave ===
                    "costo_operativo_hora"
                      ? {
                          costo_operativo_origen:
                            "manual",
                          costo_operativo_config_id:
                            ""
                        }
                      : {})
                  })
                }
              />
            </CampoConAyuda>
          ))}
          <CampoConAyuda
            etiqueta="Tipo de margen"
            ayuda="Margen bruto divide el costo por (1 - margen). Markup suma el porcentaje sobre el costo."
          >
            <select
              style={campo}
              value={
                formulario.tipo_margen || "margen_bruto"
              }
              onChange={e =>
                actualizar({
                  tipo_margen: e.target.value
                })
              }
            >
              <option value="margen_bruto">
                Margen bruto sobre venta
              </option>
              <option value="markup">
                Markup sobre costo
              </option>
            </select>
          </CampoConAyuda>
        </div>
        <div style={{
          background: "#FFF7ED",
          color: "#9A3412",
          border: "1px solid #FDBA74",
          borderRadius: 12,
          padding: 10,
          marginTop: 12,
          fontSize: 13,
          lineHeight: 1.45
        }}>
          Con margen bruto 35%, un costo de $100 se vende a
          $154. Con markup 35%, se vende a $135. Para competir,
          revisa este selector antes de enviar precio.
        </div>
        <p style={{
          color: "#64748B",
          fontSize: 13,
          marginTop: 10
        }}>
          Costo operativo fijo aplicado:{" "}
          <strong>
            {formulario.costo_operativo_origen ===
            "costos_operativos_planta"
              ? "desde maestro de planta"
              : "manual o pendiente de configurar"}
          </strong>
        </p>
        <textarea
          style={{
            ...campo,
            minHeight: 65,
            marginTop: 12
          }}
          placeholder="Riesgos y observaciones de la cotización"
          value={formulario.riesgos}
          onChange={e =>
            actualizar({ riesgos: e.target.value })
          }
        />
      </SeccionDesplegable>

      <SeccionDesplegable
        clave={`logistica-${editandoId || "nueva"}`}
        titulo="Logística internacional"
        resumen={`${incotermSeleccionado} · ${formulario.pais_destino || "sin destino"}`}
        abierta={!editandoId}
      >
        <p style={{
          color: "#64748B",
          marginTop: -4,
          lineHeight: 1.4
        }}>
          Una sola sección para calcular precio según Incoterm.
          EXW mantiene el precio fábrica; FCA agrega gastos de
          salida; CIP agrega flete, seguro y gastos; DAP agrega
          flete y gastos hasta destino, sin impuestos de
          importación.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12
        }}>
          <CampoConAyuda
            etiqueta="Incoterm"
            ayuda="EXW mantiene precio fábrica. FCA agrega gastos de salida. CIP agrega flete y seguro. DAP agrega flete hasta destino, sin impuestos de importación."
          >
            <select
              style={campo}
              value={formulario.incoterm || "EXW"}
              onChange={e => {
                const incoterm = e.target.value;
                actualizar({
                  incoterm,
                  ...(incoterm !== "EXW" &&
                    incoterm !== "NACIONAL"
                    ? {
                        moneda: "USD",
                        tipo_cambio_clp_usd:
                          formulario.tipo_cambio_clp_usd ||
                          TIPO_CAMBIO_CLP_USD_FALLBACK
                      }
                    : incoterm === "NACIONAL"
                      ? {
                          moneda: "CLP",
                          pais_destino: "Chile"
                        }
                      : {})
                });
              }}
            >
              <option value="EXW">
                EXW / Precio fábrica
              </option>
              <option value="FCA">
                FCA / Entregado a transportista
              </option>
              <option value="CIP">
                CIP / Transporte y seguro pagado
              </option>
              <option value="DAP">
                DAP / Entregado en destino
              </option>
              <option value="NACIONAL">
                Flete nacional Chile
              </option>
            </select>
          </CampoConAyuda>
          {!cotizaExportacion && (
            <div style={{
              gridColumn: "1 / -1",
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              color: "#1E3A8A",
              borderRadius: 12,
              padding: 12,
              fontWeight: "bold"
            }}>
              EXW no suma logística internacional. El precio
              queda como precio fábrica, útil cuando el cliente
              retira o cuando aún no quieres costear transporte.
            </div>
          )}
          <div style={{
            gridColumn: "1 / -1",
            background: "#F8FAFC",
            border: "1px solid #CBD5E1",
            borderRadius: 12,
            padding: 12
          }}>
            <div style={{
              fontWeight: "bold",
              color: "#334155",
              marginBottom: 8
            }}>
              Destinos frecuentes para comparar
            </div>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12
            }}>
              {DESTINOS_EXPORTACION_FRECUENTES.map(
                destino => {
                  const seleccionados =
                    formulario
                      .destinos_exportacion_comparacion ||
                    [];
                  const activo = seleccionados.includes(
                    destino.pais
                  );

                  return (
                    <label
                      key={destino.pais}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: activo
                          ? "1px solid #2563EB"
                          : "1px solid #CBD5E1",
                        background: activo
                          ? "#EFF6FF"
                          : "white",
                        color: "#334155",
                        fontWeight: "bold"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={e => {
                          const siguiente = e.target
                            .checked
                            ? [
                                ...seleccionados,
                                destino.pais
                              ]
                            : seleccionados.filter(
                                pais =>
                                  pais !== destino.pais
                              );
                          actualizar({
                            destinos_exportacion_comparacion:
                              siguiente
                          });
                        }}
                      />
                      {destino.etiqueta} / {destino.nombre}
                    </label>
                  );
                }
              )}
            </div>
            <div style={ayudaCampo}>
              La tabla de resultados mostrará pares de columnas
              por destino seleccionado: logística exportación por
              unidad y lead time total estimado.
            </div>
          </div>
          {cotizaExportacion && (
            <>
              <CampoConAyuda
                etiqueta="País destino"
                ayuda="Destino comercial. Ej: Argentina, Uruguay o Paraguay."
              >
                <select
                  style={campo}
                  value={formulario.pais_destino || ""}
                  onChange={e => {
                    const pais = e.target.value;
                    const preset =
                      PRESETS_LOGISTICA_DESTINO[pais] || {};
                    actualizar({
                      pais_destino: pais,
                      pais_cotizacion:
                        pais || "Chile",
                      ...preset,
                      ...(pais
                        ? {
                            moneda: "USD",
                            tipo_cambio_clp_usd:
                              formulario.tipo_cambio_clp_usd ||
                              preset.tipo_cambio_clp_usd ||
                              TIPO_CAMBIO_CLP_USD_FALLBACK
                          }
                        : {})
                    });
                  }}
                >
                  <option value="">Sin destino</option>
                  <option value="Chile">Chile</option>
                  <option value="Argentina">Argentina</option>
                  <option value="Uruguay">Uruguay</option>
                  <option value="Paraguay">Paraguay</option>
                </select>
              </CampoConAyuda>
              <div style={{
                gridColumn: "1 / -1",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                borderRadius: 12,
                padding: 12,
                fontWeight: "bold",
                lineHeight: 1.45
              }}>
                Cotización internacional en USD. Los costos
                internos cargados en CLP se convierten con el tipo
                de cambio CLP/USD antes de sumar flete, seguro y
                gastos de exportación.
              </div>
              <CampoConAyuda
                etiqueta="Moneda cotización"
                ayuda="Para exportación usa USD. El sistema convierte los costos internos CLP con el tipo de cambio."
              >
                <select
                  style={campo}
                  value={formulario.moneda || "USD"}
                  onChange={e =>
                    actualizar({
                      moneda: e.target.value
                    })
                  }
                >
                  <option value="USD">USD</option>
                  <option value="CLP">CLP</option>
                </select>
              </CampoConAyuda>
              <CampoConAyuda
                etiqueta="Tipo cambio CLP/USD"
                ayuda="Pesos chilenos por 1 dólar. Se actualiza automáticamente al abrir/refrescar, pero puedes editarlo para fijar un tipo comercial."
              >
                <input
                  style={campo}
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formulario.tipo_cambio_clp_usd || ""
                  }
                  onChange={e =>
                    actualizar({
                      tipo_cambio_clp_usd:
                        e.target.value
                    })
                  }
                />
                <div style={{
                  ...ayudaCampo,
                  color:
                    tipoCambioInfo.estado === "error"
                      ? "#B91C1C"
                      : "#047857",
                  fontWeight: "bold"
                }}>
                  {tipoCambioInfo.estado === "cargando" &&
                    "Actualizando dólar observado..."}
                  {tipoCambioInfo.estado ===
                    "actualizado" &&
                    `Actualizado desde ${
                      tipoCambioInfo.fuente
                    }${
                      tipoCambioInfo.fecha
                        ? ` (${new Date(
                            tipoCambioInfo.fecha
                          ).toLocaleDateString("es-CL")})`
                        : ""
                    }.`}
                  {tipoCambioInfo.estado === "error" &&
                    `No se pudo actualizar automáticamente. Se mantiene editable. ${tipoCambioInfo.error}`}
                </div>
              </CampoConAyuda>
              <CampoConAyuda
                etiqueta="Destino nombrado"
                ayuda="Ciudad o lugar pactado. Ej: Buenos Aires."
              >
                <input
                  style={campo}
                  placeholder="Buenos Aires"
                  value={
                    formulario.destino_internacional || ""
                  }
                  onChange={e =>
                    actualizar({
                      destino_internacional:
                        e.target.value
                    })
                  }
                />
              </CampoConAyuda>
              <CampoConAyuda
                etiqueta="Modalidad carga"
                ayuda="Auto decide LTL o FTL según ocupación. Usa FTL si siempre quieres camión exclusivo."
              >
                <select
                  style={campo}
                  value={formulario.modalidad_carga || "auto"}
                  onChange={e =>
                    actualizar({
                      modalidad_carga: e.target.value
                    })
                  }
                >
                  <option value="auto">
                    Automático
                  </option>
                  <option value="ftl">
                    FTL / Camión exclusivo
                  </option>
                  <option value="ltl">
                    LTL / Carga consolidada
                  </option>
                </select>
              </CampoConAyuda>
              {[
                {
                  clave: "unidades_por_caja",
                  etiqueta: "Unid. por caja",
                  ayuda:
                    "Cuántos productos entran en una caja o paquete logístico."
                },
                {
                  clave: "largo_caja_cm",
                  etiqueta: "Largo caja cm",
                  ayuda:
                    "Medida exterior de la caja embalada."
                },
                {
                  clave: "ancho_caja_cm",
                  etiqueta: "Ancho caja cm",
                  ayuda:
                    "Medida exterior de la caja embalada."
                },
                {
                  clave: "alto_caja_cm",
                  etiqueta: "Alto caja cm",
                  ayuda:
                    "Medida exterior de la caja embalada."
                },
                {
                  clave: "factor_estiba",
                  etiqueta: "Factor estiba",
                  ayuda:
                    "Usa 1 si apila bien. Sube a 1.1, 1.2 o más si requiere aire o pierde volumen útil."
                },
                {
                  clave: "capacidad_camion_m3",
                  etiqueta: "Capacidad camión m³",
                  ayuda:
                    "Referencia útil: sider 90 a 100 m³. Se usa para ocupación y cantidad de camiones."
                },
                {
                  clave: "capacidad_camion_kg",
                  etiqueta: "Capacidad camión kg",
                  ayuda:
                    "Referencia útil: 25.000 a 27.000 kg. Evita que el sistema mire solo volumen."
                },
                {
                  clave: "posiciones_pallet_camion",
                  etiqueta: "Posiciones pallet/camión",
                  ayuda:
                    "Cantidad de pallets que caben físicamente. Valor inicial: 26; ajústalo al vehículo cotizado."
                },
                {
                  clave: "flete_internacional",
                  etiqueta: "Flete FTL por camión",
                  ayuda:
                    "Costo de un camión completo en la moneda de la cotización. El sistema multiplica por camiones necesarios."
                },
                {
                  clave: "costo_ltl_m3",
                  etiqueta: "Costo LTL por m³",
                  ayuda:
                    "Solo para carga consolidada. Costo logístico por metro cúbico."
                },
                {
                  clave: "costo_ltl_minimo",
                  etiqueta: "Mínimo LTL",
                  ayuda:
                    "Cargo mínimo si la carga consolidada es pequeña."
                },
                {
                  clave: "seguro_porcentaje",
                  etiqueta: "Seguro %",
                  ayuda:
                    "Aplica solo a CIP sobre el valor asegurado. Ej: 0,30."
                },
                {
                  clave: "seguro_sobre_porcentaje",
                  etiqueta: "Valor asegurado %",
                  ayuda:
                    "Normalmente 110% del valor comercial para seguro internacional."
                },
                {
                  clave: "gastos_exportacion",
                  etiqueta: "Gastos exportación",
                  ayuda:
                    "Documentos, agencia de aduana, certificados u otros gastos de salida."
                },
                {
                  clave: "otros_costos_exportacion",
                  etiqueta: "Otros costos export.",
                  ayuda:
                    "Reserva para embalaje especial, manipulación o gastos logísticos no modelados."
                },
                {
                  clave: "dias_preparacion_exportacion",
                  etiqueta: "Días prep. export.",
                  ayuda:
                    "Tiempo para documentos, coordinación y retiro."
                },
                {
                  clave: "dias_transito",
                  etiqueta: "Días tránsito",
                  ayuda:
                    "Tránsito estimado Santiago a destino."
                }
              ].map(campoConfig => (
                <CampoConAyuda
                  key={campoConfig.clave}
                  etiqueta={campoConfig.etiqueta}
                  ayuda={campoConfig.ayuda}
                >
                  <input
                    style={campo}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={campoConfig.etiqueta}
                    value={
                      formulario[campoConfig.clave] || ""
                    }
                    onChange={e =>
                      actualizar({
                        [campoConfig.clave]:
                          e.target.value
                      })
                    }
                  />
                </CampoConAyuda>
              ))}
            </>
          )}
        </div>
      </SeccionDesplegable>

      <SeccionDesplegable
        clave={`multipais-${editandoId || "nueva"}`}
        titulo="Escenarios por país y cantidad"
        resumen={formulario.cotizacion_multipais
          ? `${resultadosMultipais.length} escenarios calculados`
          : "Opcional · una base técnica, varios países"}
        abierta={formulario.cotizacion_multipais}
        estilo={{
          background: formulario.cotizacion_multipais
            ? "#F0FDF4"
            : "white",
          borderColor: formulario.cotizacion_multipais
            ? "#86EFAC"
            : "#CBD5E1"
        }}
      >
        <label style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 12,
          borderRadius: 12,
          background: "white",
          border: "1px solid #CBD5E1",
          fontWeight: "bold",
          marginBottom: 12
        }}>
          <input
            type="checkbox"
            checked={formulario.cotizacion_multipais === true}
            onChange={e => actualizar({
              cotizacion_multipais: e.target.checked,
              escenarios_pais: normalizarEscenariosPais(
                formulario.escenarios_pais
              )
            })}
          />
          Cotizar el mismo producto para varios países y cantidades
        </label>
        <p style={{ color: "#475569", lineHeight: 1.45 }}>
          Los materiales y procesos se ingresan una sola vez. Cada país
          recalcula compras mínimas, setup, precio, logística y lead time
          para sus propias cantidades.
        </p>
        {formulario.cotizacion_multipais && (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              {normalizarEscenariosPais(
                formulario.escenarios_pais
              ).map(escenario => (
                <div key={escenario.pais} style={{
                  background: "white",
                  border: escenario.activo !== false
                    ? "2px solid #86EFAC"
                    : "1px solid #CBD5E1",
                  borderRadius: 14,
                  padding: 14
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10
                  }}>
                    <label style={{ fontWeight: "bold", fontSize: 17 }}>
                      <input
                        type="checkbox"
                        checked={escenario.activo !== false}
                        onChange={e => actualizarEscenarioPais(
                          escenario.pais,
                          { activo: e.target.checked }
                        )}
                        style={{ marginRight: 8 }}
                      />
                      {escenario.pais}
                    </label>
                    <span style={{
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: escenario.pais === "Chile"
                        ? "#DBEAFE"
                        : "#DCFCE7",
                      fontWeight: "bold"
                    }}>
                      {escenario.moneda}
                    </span>
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 10,
                    opacity: escenario.activo !== false ? 1 : 0.55
                  }}>
                    <CampoConAyuda
                      etiqueta="Cantidades"
                      ayuda="Separadas por coma. Pueden ser distintas en cada país."
                    >
                      <input
                        style={campo}
                        value={escenario.cantidades || ""}
                        disabled={escenario.activo === false}
                        onChange={e => actualizarEscenarioPais(
                          escenario.pais,
                          { cantidades: e.target.value }
                        )}
                      />
                    </CampoConAyuda>
                    <CampoConAyuda
                      etiqueta="Incoterm"
                      ayuda="Chile normalmente EXW; exportación normalmente CIP."
                    >
                      <select
                        style={campo}
                        value={escenario.incoterm || "EXW"}
                        disabled={escenario.activo === false}
                        onChange={e => actualizarEscenarioPais(
                          escenario.pais,
                          { incoterm: e.target.value }
                        )}
                      >
                        <option value="EXW">EXW</option>
                        <option value="FCA">FCA</option>
                        <option value="CIP">CIP</option>
                        <option value="DAP">DAP</option>
                      </select>
                    </CampoConAyuda>
                    <CampoConAyuda
                      etiqueta="Destino"
                      ayuda="Ciudad o lugar de entrega del escenario."
                    >
                      <input
                        style={campo}
                        value={escenario.destino || ""}
                        disabled={escenario.activo === false}
                        onChange={e => actualizarEscenarioPais(
                          escenario.pais,
                          { destino: e.target.value }
                        )}
                      />
                    </CampoConAyuda>
                    {escenario.pais !== "Chile" && [
                      ["flete_internacional", "Flete FTL", "Costo por camión"],
                      ["costo_ltl_m3", "LTL por m³", "Costo de carga consolidada"],
                      ["costo_ltl_minimo", "Mínimo LTL", "Cargo mínimo consolidado"],
                      ["gastos_exportacion", "Gastos exportación", "Documentación y salida"],
                      ["dias_preparacion_exportacion", "Días preparación", "Documentos y coordinación"],
                      ["dias_transito", "Días tránsito", "Traslado hasta destino"]
                    ].map(([clave, etiqueta, ayuda]) => (
                      <CampoConAyuda
                        key={clave}
                        etiqueta={etiqueta}
                        ayuda={ayuda}
                      >
                        <input
                          style={campo}
                          type="number"
                          min="0"
                          step="0.01"
                          value={escenario[clave] || ""}
                          disabled={escenario.activo === false}
                          onChange={e => actualizarEscenarioPais(
                            escenario.pais,
                            { [clave]: e.target.value }
                          )}
                        />
                      </CampoConAyuda>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 14
            }}>
              <button
                type="button"
                style={botonSecundario}
                onClick={() => actualizar({
                  escenarios_pais: crearEscenariosPaisIniciales()
                })}
              >
                Restablecer ejemplos
              </button>
              <button
                type="button"
                style={boton}
                disabled={filasPepsicoMultipais.length === 0}
                onClick={() => descargarFilasPepsico(
                  filasPepsicoMultipais
                )}
              >
                Descargar escenarios en Excel PepsiCo
              </button>
            </div>
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "white"
              }}>
                <thead>
                  <tr>
                    {["País", "Cantidad", "Moneda", "Incoterm", "Costo/u", "EXW/u", "Logística/u", "Precio final/u", "Lead time"].map(titulo => (
                      <th key={titulo} style={{ textAlign: "left", padding: 8 }}>
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultadosMultipais.map(resultado => (
                    <tr key={resultado.clave} style={{ borderTop: "1px solid #E2E8F0" }}>
                      <td style={{ padding: 8 }}><b>{resultado.pais}</b></td>
                      <td style={{ padding: 8 }}>{resultado.cantidad}</td>
                      <td style={{ padding: 8 }}>{resultado.moneda}</td>
                      <td style={{ padding: 8 }}>{resultado.incoterm}</td>
                      <td style={{ padding: 8 }}>{formatoNumero(resultado.costo_unitario, resultado.moneda)}</td>
                      <td style={{ padding: 8 }}>{formatoNumero(resultado.precio_unitario_sugerido, resultado.moneda)}</td>
                      <td style={{ padding: 8 }}>{formatoNumero(resultado.costo_exportacion_unitario, resultado.moneda)}</td>
                      <td style={{ padding: 8 }}><b>{formatoNumero(resultado.precio_unitario_cip_sugerido || resultado.precio_unitario_sugerido, resultado.moneda)}</b></td>
                      <td style={{ padding: 8 }}>{resultado.lead_time_cip_dias || resultado.lead_time_flujo_dias} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SeccionDesplegable>

      {renderLineasMateriales({
        tipoLinea: "material",
        titulo: "Materiales principales estimados",
        descripcion:
          "Base física del producto: PAI, metal, MDF, perfiles, alambre, accesorios o RF. El costo se toma desde el catálogo cuando exista.",
        etiquetaSelector: "Material",
        ayudaSelector:
          "Selecciona MP/RF del catálogo o deja libre.",
        textoBoton: "+ Agregar material"
      })}

      {renderLineasMateriales({
        tipoLinea: "suministro",
        titulo: "Suministros e insumos productivos",
        descripcion:
          "Consumibles directos usados para fabricar: tintas UV, barnices, adhesivos, solventes, pintura u otros insumos medibles. Deben estar creados como SUM en el catálogo.",
        etiquetaSelector: "Suministro",
        ayudaSelector:
          "Selecciona solo suministros SUM del catálogo. Ej: Tinta UV C/M/Y/K.",
        textoBoton: "+ Agregar suministro"
      })}

      <SeccionDesplegable
        clave={`procesos-${editandoId || "nueva"}`}
        titulo="Procesos estimados"
        resumen={`${formulario.procesos.length} ${formulario.procesos.length === 1 ? "operación" : "operaciones"}`}
        abierta={!editandoId}
      >
        {procesosSinCostoHora.length > 0 && (
          <div style={{
            background: "#FFF7ED",
            border: "1px solid #FDBA74",
            color: "#9A3412",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            fontWeight: "bold"
          }}>
            Falta costo hora en{" "}
            {procesosSinCostoHora.length} proceso
            {procesosSinCostoHora.length === 1
              ? ""
              : "s"}
            . La cotización calcula tiempo, pero el
            costo de proceso quedará subvalorado hasta
            completar Costos Base Estación o ingresar el
            costo hora manualmente.
          </div>
        )}
        {formulario.procesos.map((proceso, indice) => {
          const claveEstacion =
            `${proceso.proceso_codigo}__${proceso.estacion_codigo}`;
          const faltaCostoHora =
            procesoRequiereCostoHora(proceso);
          const esFormulaDoblezCnc =
            proceso.tipo_formula_tiempo ===
            "doblez_cnc_3d";
          const esFormulaCorteCncRecto =
            proceso.tipo_formula_tiempo ===
            "corte_cnc_recto";
          const esFormulaCortePrensa =
            proceso.tipo_formula_tiempo ===
            "corte_prensa";
          const esFormulaLaser =
            proceso.tipo_formula_tiempo ===
            "laser_metros_minuto";
          const esFormulaSoldaduraMig =
            proceso.tipo_formula_tiempo ===
            "soldadura_mig";
          const esFormulaSoldaduraMultipunto =
            proceso.tipo_formula_tiempo ===
            "soldadura_multipunto";
          const esFormulaImpresionCpUv =
            proceso.tipo_formula_tiempo ===
            "impresion_uv_cama";
          const materialesFormulaProceso =
            esFormulaImpresionCpUv
              ? materialesPaiConFormula.map(
                  ({ material }) => material
                )
              : esFormulaDoblezCnc ||
            esFormulaCorteCncRecto
              ? materialesConFormulaAlambre
                : esFormulaCortePrensa
                  ? materialesConFormulaCortes
                  : esFormulaLaser
                    ? materialesConFormulaPlanchaLaser.filter(
                        material =>
                          materialCompatibleConLaser(
                            material,
                            proceso
                          )
                      )
                : [];

          return (
            <details
              key={indice}
              style={{
                background: "#F8FAFC",
                borderRadius: 14,
                border: faltaCostoHora
                  ? "1px solid #FDBA74"
                  : "1px solid #CBD5E1",
                marginBottom: 12,
                overflow: "hidden"
              }}
            >
              <summary style={{
                ...resumenDesplegable,
                padding: 14
              }}>
                <span style={{ fontWeight: "bold" }}>
                  {proceso.proceso_nombre || proceso.proceso_codigo || "Proceso"} ·{" "}
                  {proceso.estacion_nombre || "Sin estación"}
                </span>
                <span style={{
                  color: faltaCostoHora ? "#C2410C" : "#475569",
                  fontSize: 13
                }}>
                  {faltaCostoHora
                    ? "Falta costo hora"
                    : `${proceso.unidades_por_hora || 0} un/h · ${formatoNumero(proceso.costo_hora || 0, formulario.moneda)}/h`}
                </span>
              </summary>
            <div style={{
              ...lineaCotizador,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
              marginBottom: 0
            }}>
              <CampoConAyuda
                etiqueta="Proceso / estación"
                ayuda="Selecciona una estación del catálogo o deja libre."
              >
                <select
                  style={campo}
                  value={claveEstacion}
                  onChange={e =>
                    seleccionarEstacion(
                      indice,
                      e.target.value
                    )
                  }
                >
                  <option value="">Proceso libre</option>
                  {estacionesCatalogo.map(estacion => (
                    <option
                      key={`${estacion.proceso_codigo}__${estacion.estacion_codigo}`}
                      value={`${estacion.proceso_codigo}__${estacion.estacion_codigo}`}
                    >
                      {estacion.proceso_nombre} /{" "}
                      {estacion.estacion_nombre}
                    </option>
                  ))}
                </select>
              </CampoConAyuda>
              <CampoConAyuda
                etiqueta="Fórmula tiempo"
                ayuda="Base para calcular capacidad de la estación según su lógica técnica."
              >
                <select
                  style={campo}
                  value={
                    proceso.tipo_formula_tiempo || ""
                  }
                  onChange={e => {
                    const tipoFormula = e.target.value;
                    const base = {
                      ...proceso,
                      ...valoresPorTipoFormula(
                        tipoFormula,
                        proceso
                      )
                    };
                    const costoBase =
                      buscarCostoBaseEstacion(base);

                    actualizar({
                      procesos: actualizarItem(
                        formulario.procesos,
                        indice,
                        aplicarFormulaTiempoProceso({
                          ...base,
                          tipo_formula_tiempo:
                            tipoFormula,
                          ...(camposDesdeCostoBase(
                            costoBase
                          ) || {})
                        })
                      )
                    });
                  }}
                >
                  <option value="">
                    Sin fórmula técnica
                  </option>
                  <option value="doblez_cnc_3d">
                    Doblez CNC 3D
                  </option>
                  <option value="doblez_plegadora_neumatica">
                    Doblez / Plegadora Neumática o Hidráulica
                  </option>
                  <option value="corte_cnc_recto">
                    Corte CNC Recto
                  </option>
                  <option value="corte_prensa">
                    Corte / Prensa
                  </option>
                  <option value="laser_metros_minuto">
                    Laser Fibra / CO2
                  </option>
                  <option value="soldadura_mig">
                    Soldadura MIG
                  </option>
                  <option value="soldadura_multipunto">
                    SPunto / Soldadora Multipunto
                  </option>
                  <option value="impresion_uv_cama">
                    Impresión / Impresora CP UV
                  </option>
                </select>
              </CampoConAyuda>
              {[
                "doblez_cnc_3d",
                "doblez_plegadora_neumatica",
                "corte_cnc_recto",
                "corte_prensa",
                "laser_metros_minuto",
                "soldadura_mig",
                "soldadura_multipunto",
                "impresion_uv_cama"
              ].includes(proceso.tipo_formula_tiempo) && (
                <>
                  {(esFormulaDoblezCnc ||
                    esFormulaCorteCncRecto ||
                    esFormulaCortePrensa ||
                    esFormulaLaser ||
                    esFormulaImpresionCpUv) && (
                    <CampoConAyuda
                      etiqueta="Usar fórmula desde material"
                      ayuda={
                        esFormulaImpresionCpUv
                          ? "Toma largo, ancho y cantidad de piezas desde una MP PAI para calcular el aprovechamiento de la cama de impresión."
                          : esFormulaDoblezCnc ||
                        esFormulaCorteCncRecto
                          ? "Reutiliza la fórmula del MP Alambre ya ingresada en Materiales estimados para calcular avance, dobleces y cortes."
                          : esFormulaCortePrensa
                            ? "Reutiliza la fórmula del MP Tubo ya ingresada en Materiales estimados para calcular golpes de prensa."
                            : "Reutiliza la fórmula de plancha compatible ya ingresada en Materiales estimados para calcular metros de corte laser."
                      }
                    >
                      <select
                        style={campo}
                        value={
                          proceso.formula_material_indice ??
                          ""
                        }
                        onChange={e => {
                          const materialIndice =
                            e.target.value;
                          const material =
                            materialIndice === ""
                              ? null
                              : materialesFormulaProceso[
                                  Number(
                                    materialIndice
                                  )
                                ];
                          const camposFormula =
                            esFormulaImpresionCpUv
                              ? camposImpresionDesdeMaterial(
                                  material,
                                  materialIndice
                                )
                            : esFormulaLaser
                              ? camposLaserDesdeMaterial(
                                  material,
                                  materialIndice,
                                  proceso,
                                  proceso
                                )
                              : camposFormulaDesdeMaterial(
                                  material,
                                  materialIndice
                                );
                          const actualizado =
                            aplicarFormulaTiempoProceso({
                              ...proceso,
                              ...camposFormula,
                              ...(!material
                                ? {
                                    formula_material_indice:
                                      "",
                                    formula_material_id:
                                      "",
                                    formula_material_codigo:
                                      "",
                                    formula_material_nombre:
                                      ""
                                  }
                                : {})
                            });

                          actualizar({
                            procesos: actualizarItem(
                              formulario.procesos,
                              indice,
                              actualizado
                            )
                          });
                        }}
                      >
                        <option value="">
                          {esFormulaImpresionCpUv
                            ? "Seleccionar MP PAI con fórmula"
                            : esFormulaDoblezCnc ||
                          esFormulaCorteCncRecto
                            ? "Seleccionar MP Alambre con fórmula"
                            : esFormulaCortePrensa
                              ? "Seleccionar MP Tubo con fórmula"
                              : tipoLaserEstacion(proceso) === APLICACIONES_CORTE_LASER.CO2
                                ? "Seleccionar MP PAI, Acrílico o MDF con fórmula"
                                : "Seleccionar plancha compatible con fórmula"}
                        </option>
                        {materialesFormulaProceso.map(
                          (material, materialIndice) => (
                            <option
                              key={`${materialIndice}-${material.codigo}`}
                              value={materialIndice}
                            >
                              {material.codigo ||
                                "Material"}{" "}
                              - {material.nombre ||
                                "sin nombre"}{" "}
                              |{" "}
                              {
                                material.expresion_consumo
                              }
                            </option>
                          )
                        )}
                      </select>
                    </CampoConAyuda>
                  )}
                  {!esFormulaSoldaduraMig &&
                  !esFormulaImpresionCpUv && (
                    <>
                      <CampoConAyuda
                        etiqueta={
                          proceso.tipo_formula_tiempo ===
                          "doblez_plegadora_neumatica"
                            ? "Cantidad de dobleces por exhibidor"
                            : esFormulaSoldaduraMultipunto
                              ? "Fórmula de mallas"
                            : proceso.tipo_formula_tiempo ===
                          "corte_prensa"
                            ? "Fórmula golpes"
                            : proceso.tipo_formula_tiempo ===
                              "laser_metros_minuto"
                              ? "Fórmula metros corte"
                            : "Fórmula piezas"
                        }
                        ayuda={
                          proceso.tipo_formula_tiempo ===
                          "doblez_plegadora_neumatica"
                            ? "Dato variable según el modelo del exhibidor. Debe completarse para calcular el tiempo."
                            : esFormulaSoldaduraMultipunto
                              ? "Formato: (alambres horizontales*alambres verticales)*cantidad de mallas. Ej: (26*7)*7 calcula 182 intersecciones por malla y 7 mallas."
                            : proceso.tipo_formula_tiempo ===
                          "corte_prensa"
                            ? "Ej: (131+360+71)*1. Cada medida del tubo equivale a un golpe/corte de prensa."
                            : proceso.tipo_formula_tiempo ===
                          "laser_metros_minuto"
                            ? "Ej: (100+250+100)*4. Calcula metros totales de corte y cantidad de inicios/cortes."
                            : proceso.tipo_formula_tiempo ===
                          "corte_cnc_recto"
                            ? "Ej: (30)*4. Se lee como 4 cortes de 30 mm."
                            : "Ej: (100+50+20)*4. Calcula avance, dobleces, cortes y unid/hora."
                        }
                      >
                        <input
                          style={campo}
                          type={
                            proceso.tipo_formula_tiempo ===
                            "doblez_plegadora_neumatica"
                              ? "number"
                              : "text"
                          }
                          min="0"
                          step="1"
                          placeholder={
                            proceso.tipo_formula_tiempo ===
                            "doblez_plegadora_neumatica"
                              ? "Pendiente por completar"
                              : esFormulaSoldaduraMultipunto
                                ? "Ej: (26*7)*7"
                              : "Ej: (100+50+20)*4"
                          }
                          value={
                            proceso.formula_tiempo || ""
                          }
                          onChange={e => {
                            const actualizado =
                              aplicarFormulaTiempoProceso({
                                ...proceso,
                                formula_tiempo:
                                  e.target.value,
                                formula_material_indice: "",
                                formula_material_id: "",
                                formula_material_codigo: "",
                                formula_material_nombre: ""
                              });

                            actualizar({
                              procesos: actualizarItem(
                                formulario.procesos,
                                indice,
                                actualizado
                              )
                            });
                          }}
                        />
                        {proceso.formula_tiempo_error && (
                          <div style={{
                            color: "#B71C1C",
                            fontSize: 12,
                            marginTop: 4
                          }}>
                            {proceso.formula_tiempo_error}
                          </div>
                        )}
                      </CampoConAyuda>
                      {proceso.tipo_formula_tiempo !==
                        "doblez_plegadora_neumatica" &&
                      !esFormulaSoldaduraMultipunto && (
                      <CampoConAyuda
                        etiqueta="Unidad fórmula"
                        ayuda="Unidad usada en la fórmula. Normalmente mm para alambre."
                      >
                        <select
                          style={campo}
                          value={
                            proceso.unidad_formula_tiempo ||
                            "mm"
                          }
                          onChange={e => {
                            const actualizado =
                              aplicarFormulaTiempoProceso({
                                ...proceso,
                                unidad_formula_tiempo:
                                  e.target.value
                              });

                            actualizar({
                              procesos: actualizarItem(
                                formulario.procesos,
                                indice,
                                actualizado
                              )
                            });
                          }}
                        >
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="m">m</option>
                        </select>
                      </CampoConAyuda>
                      )}
                    </>
                  )}
                  {esFormulaSoldaduraMig && [
                    {
                      clave: "puntos_mig",
                      etiqueta: "Puntos MIG"
                    },
                    {
                      clave: "cordones_simples",
                      etiqueta: "Cordones simples"
                    },
                    {
                      clave: "cordones_perimetrales",
                      etiqueta: "Cordones perimetrales"
                    },
                    {
                      clave: "segundos_por_punto_mig",
                      etiqueta: "Seg/punto"
                    },
                    {
                      clave: "segundos_por_cordon_simple",
                      etiqueta: "Seg/cordón simple"
                    },
                    {
                      clave:
                        "segundos_por_cordon_perimetral",
                      etiqueta: "Seg/cordón perimetral"
                    }
                  ].map(parametro => (
                    <CampoConAyuda
                      key={parametro.clave}
                      etiqueta={parametro.etiqueta}
                      ayuda="Dato tomado del plano o estándar editable si mejora la eficiencia."
                    >
                      <input
                        style={campo}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        disabled={
                          parametro.clave ===
                            "metros_por_minuto" &&
                          proceso.velocidad_laser_origen ===
                            "material"
                        }
                        value={
                          proceso[parametro.clave] || ""
                        }
                        onChange={e => {
                          const actualizado =
                            aplicarFormulaTiempoProceso({
                              ...proceso,
                              formula_tiempo:
                                "soldadura_mig",
                              [parametro.clave]:
                                e.target.value
                            });

                          actualizar({
                            procesos: actualizarItem(
                              formulario.procesos,
                              indice,
                              actualizado
                            )
                          });
                        }}
                      />
                      {parametro.clave ===
                        "metros_por_minuto" &&
                        proceso.velocidad_laser_origen ===
                          "material" && (
                          <div style={{
                            color: "#166534",
                            fontSize: 12,
                            marginTop: 4
                          }}>
                            Tomado del material{" "}
                            {proceso.formula_material_codigo ||
                              "seleccionado"}.
                            Edita este dato en Catálogo de
                            materiales.
                          </div>
                        )}
                    </CampoConAyuda>
                  ))}
                  {esFormulaSoldaduraMultipunto && [
                    {
                      clave: "puntos_por_ciclo_multipunto",
                      etiqueta: "Puntos por bajada"
                    },
                    {
                      clave: "segundos_por_ciclo_multipunto",
                      etiqueta: "Seg/ciclo pistón"
                    },
                    {
                      clave: "segundos_carga_retiro_multipunto",
                      etiqueta: "Seg carga y retiro/malla"
                    }
                  ].map(parametro => (
                    <CampoConAyuda
                      key={parametro.clave}
                      etiqueta={parametro.etiqueta}
                      ayuda="Estándar de la Soldadora Multipunto; se puede ajustar si cambia la medición real."
                    >
                      <input
                        style={campo}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={
                          proceso[parametro.clave] ?? ""
                        }
                        onChange={e => {
                          const actualizado =
                            aplicarFormulaTiempoProceso({
                              ...proceso,
                              [parametro.clave]:
                                e.target.value
                            });

                          actualizar({
                            procesos: actualizarItem(
                              formulario.procesos,
                              indice,
                              actualizado
                            )
                          });
                        }}
                      />
                    </CampoConAyuda>
                  ))}
                  {esFormulaImpresionCpUv && [
                    {
                      clave: "largo_cama_impresion_mm",
                      etiqueta: "Largo cama (mm)"
                    },
                    {
                      clave: "ancho_cama_impresion_mm",
                      etiqueta: "Ancho cama (mm)"
                    },
                    {
                      clave: "separacion_impresion_mm",
                      etiqueta: "Separación piezas (mm)"
                    },
                    {
                      clave: "camas_impresion_por_hora",
                      etiqueta: "Camas impresas/hora"
                    }
                  ].map(parametro => (
                    <CampoConAyuda
                      key={parametro.clave}
                      etiqueta={parametro.etiqueta}
                      ayuda="Parámetro técnico editable de la Impresora CP UV."
                    >
                      <input
                        style={campo}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={
                          proceso[parametro.clave] ?? ""
                        }
                        onChange={e => {
                          const actualizado =
                            aplicarFormulaTiempoProceso({
                              ...proceso,
                              [parametro.clave]:
                                e.target.value
                            });

                          actualizar({
                            procesos: actualizarItem(
                              formulario.procesos,
                              indice,
                              actualizado
                            )
                          });
                        }}
                      />
                    </CampoConAyuda>
                  ))}
                  {[
                    ...(proceso.tipo_formula_tiempo ===
                    "laser_metros_minuto"
                      ? [{
                          clave: "metros_por_minuto",
                          etiqueta: "m/min corte"
                        }]
                      : []),
                    ...(proceso.tipo_formula_tiempo ===
                    "doblez_plegadora_neumatica" ||
                    proceso.tipo_formula_tiempo ===
                    "corte_prensa" ||
                    proceso.tipo_formula_tiempo ===
                      "laser_metros_minuto" ||
                    proceso.tipo_formula_tiempo ===
                      "soldadura_mig" ||
                    proceso.tipo_formula_tiempo ===
                      "soldadura_multipunto"
                    || proceso.tipo_formula_tiempo ===
                      "impresion_uv_cama"
                      ? []
                      : [{
                          clave: "segundos_por_metro",
                          etiqueta: "Seg/m avance"
                        }]),
                    ...(proceso.tipo_formula_tiempo ===
                    "doblez_cnc_3d" ||
                    proceso.tipo_formula_tiempo ===
                    "doblez_plegadora_neumatica"
                      ? [{
                          clave: "segundos_por_doblez",
                          etiqueta: "Seg/doblez"
                        }]
                      : []),
                    ...(proceso.tipo_formula_tiempo ===
                    "soldadura_mig" ||
                    proceso.tipo_formula_tiempo ===
                    "soldadura_multipunto" ||
                    proceso.tipo_formula_tiempo ===
                    "impresion_uv_cama" ||
                    proceso.tipo_formula_tiempo ===
                    "doblez_plegadora_neumatica"
                      ? []
                      : [{
                          clave: "segundos_por_corte",
                          etiqueta:
                            proceso.tipo_formula_tiempo ===
                            "corte_prensa"
                              ? "Seg/golpe"
                              : proceso.tipo_formula_tiempo ===
                                "laser_metros_minuto"
                                ? "Seg/inicio"
                              : "Seg/corte"
                        }])
                  ].map(parametro => (
                    <CampoConAyuda
                      key={parametro.clave}
                      etiqueta={parametro.etiqueta}
                      ayuda="Editable si el estándar real de la estación cambia."
                    >
                      <input
                        style={campo}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={
                          proceso[parametro.clave] || ""
                        }
                        onChange={e => {
                          const valor = e.target.value;
                          const metrosPorMinuto =
                            parametro.clave ===
                            "metros_por_minuto"
                              ? Number(valor)
                              : 0;
                          const actualizado =
                            aplicarFormulaTiempoProceso({
                              ...proceso,
                              [parametro.clave]:
                                valor,
                              ...(parametro.clave ===
                                "metros_por_minuto" &&
                              metrosPorMinuto > 0
                                ? {
                                    segundos_por_metro:
                                      60 /
                                      metrosPorMinuto
                                  }
                                : {})
                            });

                          actualizar({
                            procesos: actualizarItem(
                              formulario.procesos,
                              indice,
                              actualizado
                            )
                          });
                        }}
                      />
                    </CampoConAyuda>
                  ))}
                  <CampoConAyuda
                    etiqueta="Lectura tiempo"
                    ayuda="Resultado técnico usado para calcular horas y costo del proceso."
                  >
                    <div style={{
                      ...campo,
                      background: "#ECFDF5",
                      color: "#065F46",
                      minHeight: 58,
                      fontWeight: "bold"
                    }}>
                      {proceso.formula_tiempo
                        ? proceso.tipo_formula_tiempo ===
                          "doblez_plegadora_neumatica"
                          ? `${proceso.segundos_por_producto || 0} seg/exhibidor | ${proceso.unidades_por_hora || 0} exhibidores/h | ${proceso.dobleces_total || 0} dobleces | ${proceso.segundos_por_doblez || 36} seg/doblez`
                          : proceso.tipo_formula_tiempo ===
                          "corte_prensa"
                          ? `${proceso.segundos_por_producto || 0} seg/producto | ${proceso.unidades_por_hora || 0} un/h | Golpes por producto: ${proceso.golpes_calculados || proceso.cortes_calculados || 0}${proceso.formula_material_codigo ? ` | Desde material: ${proceso.formula_material_codigo}` : ""}`
                          : proceso.tipo_formula_tiempo ===
                            "soldadura_mig"
                            ? `${proceso.segundos_por_producto || 0} seg/producto | ${proceso.unidades_por_hora || 0} un/h | Puntos: ${proceso.puntos_mig || 0} | Cordones simples: ${proceso.cordones_simples || 0} | Perimetrales: ${proceso.cordones_perimetrales || 0}${Number(proceso.cordones_simples || 0) > 0 && Number(proceso.cordones_perimetrales || 0) === 0 ? " | Revisar: si son cordones alrededor de una pieza, podrían ser perimetrales." : ""}`
                          : proceso.tipo_formula_tiempo ===
                            "soldadura_multipunto"
                            ? `${proceso.segundos_por_producto || 0} seg/exhibidor | ${proceso.unidades_por_hora || 0} exhibidores/h | ${proceso.formula_tiempo_detalle?.intersecciones_por_malla || 0} puntos/malla × ${proceso.formula_tiempo_detalle?.mallas || 0} mallas = ${proceso.formula_tiempo_detalle?.puntos_totales || 0} puntos | ${proceso.formula_tiempo_detalle?.ciclos_por_malla || 0} ciclos/malla · ${proceso.formula_tiempo_detalle?.ciclos_total || 0} ciclos | ${proceso.formula_tiempo_detalle?.cargas_retiros || 0} cargas/retiros × ${proceso.segundos_carga_retiro_multipunto ?? 8} seg`
                          : proceso.tipo_formula_tiempo ===
                            "impresion_uv_cama"
                            ? `${proceso.segundos_por_producto || 0} seg/producto | ${proceso.unidades_por_hora || 0} productos/h | Pieza ${proceso.formula_tiempo_detalle?.largo_pieza_mm || 0} × ${proceso.formula_tiempo_detalle?.ancho_pieza_mm || 0} mm | ${proceso.formula_tiempo_detalle?.piezas_por_cama || 0} piezas/cama (${proceso.formula_tiempo_detalle?.columnas || 0} × ${proceso.formula_tiempo_detalle?.filas || 0}, ${proceso.formula_tiempo_detalle?.orientacion || "-"}) | ${proceso.formula_tiempo_detalle?.piezas_por_producto || 0} piezas/producto | Desde ${proceso.formula_material_codigo || "MP PAI"}`
                          : proceso.tipo_formula_tiempo ===
                            "laser_metros_minuto"
                            ? `${proceso.segundos_por_producto || 0} seg/producto | ${proceso.unidades_por_hora || 0} un/h | ${proceso.metros_totales_calculados || 0} m | ${proceso.cortes_calculados || 0} inicios/cortes | ${proceso.metros_por_minuto || 0} m/min`
                          : `${proceso.segundos_por_producto || 0} seg/producto | ${proceso.unidades_por_hora || 0} un/h | ${proceso.metros_totales_calculados || 0} m | ${proceso.cortes_calculados || 0} cortes${proceso.tipo_formula_tiempo === "doblez_cnc_3d" ? ` | ${proceso.dobleces_total || 0} dobleces` : ""}`
                        : "Ingresa una fórmula para calcular tiempo."}
                    </div>
                  </CampoConAyuda>
                </>
              )}
              {CAMPOS_PROCESO_ESTIMADO.map(campoConfig => (
                <CampoConAyuda
                  key={campoConfig.clave}
                  etiqueta={campoConfig.etiqueta}
                  ayuda={campoConfig.ayuda}
                >
                  <input
                    style={{
                      ...campo,
                      ...(campoConfig.clave ===
                        "costo_hora" &&
                      faltaCostoHora
                        ? {
                            borderColor: "#F97316",
                            background: "#FFF7ED"
                          }
                        : {})
                    }}
                    type={
                      [
                        "unidades_por_hora",
                        "eficiencia_esperada",
                        "costo_hora",
                        "porcentaje_costo_operativo",
                        "horas_setup"
                      ].includes(campoConfig.clave)
                        ? "number"
                        : "text"
                    }
                    placeholder={campoConfig.etiqueta}
                    value={proceso[campoConfig.clave] || ""}
                    onChange={e =>
                      actualizar({
                        procesos: actualizarItem(
                          formulario.procesos,
                          indice,
                          {
                            [campoConfig.clave]:
                              e.target.value,
                            ...(campoConfig.clave === "costo_hora"
                              ? {
                                  costo_hora_origen:
                                    "manual",
                                  costo_base_estacion_id:
                                    "",
                                  costo_hora_detalle: null
                                }
                              : {}),
                            ...(campoConfig.clave ===
                            "porcentaje_costo_operativo"
                              ? {
                                  costo_operativo_origen:
                                    "manual"
                                }
                              : {})
                          }
                        )
                      })
                    }
                  />
                  {campoConfig.clave === "costo_hora" &&
                    faltaCostoHora && (
                    <div style={{
                      color: "#C2410C",
                      fontSize: 12,
                      fontWeight: "bold",
                      marginTop: 4
                    }}>
                      Falta costo hora de estación. Revisa
                      Costos Base Estación o ingrésalo
                      manualmente antes de enviar esta
                      cotización.
                    </div>
                  )}
                </CampoConAyuda>
              ))}
            </div>
            </details>
          );
        })}
        <button
          type="button"
          style={botonSecundario}
          onClick={() =>
            actualizar({
              procesos: [
                ...formulario.procesos,
                procesoVacio
              ]
            })
          }
        >
          + Agregar proceso
        </button>
      </SeccionDesplegable>

      <SeccionDesplegable
        clave={`resultado-${editandoId || "nueva"}`}
        titulo="Resultado por escala"
        resumen={resultadoBase
          ? `${resultadoBase.cantidad} un · ${formatoNumero(resultadoBase.precio_unitario_sugerido, formulario.moneda)}/u`
          : "Sin cálculo"}
        abierta
        estilo={{
          background: "#EFF6FF",
          borderColor: "#93C5FD"
        }}
      >
        <p style={{
          color: "#475569",
          lineHeight: 1.45,
          marginTop: -2
        }}>
          El precio EXW se mantiene separado de la
          logística de exportación. Si seleccionas un
          Incoterm, el sistema muestra la capa adicional
          y el precio {incotermSeleccionado} para que el
          cliente pueda revisar ambos valores por separado.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse"
          }}>
            <thead>
              <tr>
                {[
                  "Cant.",
                  "Costo unit.",
                  "EXW unit.",
                  "Peso unit.",
                  "Costo operativo",
                  "Costo total",
                  "EXW total",
                  "Volumen",
                  "Ocup. camión",
                  "Estado carga",
                  "Camiones",
                  "Logística export./u",
                  etiquetaIncotermUnitario,
                  etiquetaIncotermTotal,
                  "Horas totales",
                  "Horas flujo",
                  "LT flujo",
                  "LT export.",
                  "LT conservador"
                ].map(titulo => (
                  <th
                    key={titulo}
                    style={{
                      textAlign: "left",
                      padding: 8
                    }}
                  >
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultados.map(resultado => (
                <tr key={resultado.cantidad}>
                  <td style={{ padding: 8 }}>
                    {resultado.cantidad}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoNumero(
                      resultado.costo_unitario,
                      formulario.moneda
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <b>
                      {formatoNumero(
                        resultado.precio_unitario_sugerido,
                        formulario.moneda
                      )}
                    </b>
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoKg(
                      resultado.peso_unitario_kg
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoNumero(
                      resultado.costo_operativo,
                      formulario.moneda
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoNumero(
                      resultado.costo_total,
                      formulario.moneda
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoNumero(
                      resultado.precio_total_sugerido,
                      formulario.moneda
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoM3(
                      resultado.logistica_exportacion
                        ?.volumen_total_m3
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoPorcentaje(
                      resultado.logistica_exportacion
                        ?.ocupacion_volumen_pct
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {resultado.logistica_exportacion
                      ?.estado_carga || "-"}
                  </td>
                  <td style={{ padding: 8 }}>
                    {resultado.logistica_exportacion
                      ?.camiones_necesarios || 0}
                  </td>
                  <td style={{ padding: 8 }}>
                    {cotizaExportacion
                      ? formatoNumero(
                          resultado
                            .costo_exportacion_unitario,
                          formulario.moneda
                        )
                      : "-"}
                  </td>
                  <td style={{ padding: 8 }}>
                    <b>
                      {cotizaExportacion
                        ? formatoNumero(
                            resultado
                              .precio_unitario_cip_sugerido,
                            formulario.moneda
                          )
                        : "-"}
                    </b>
                  </td>
                  <td style={{ padding: 8 }}>
                    {cotizaExportacion
                      ? formatoNumero(
                          resultado
                            .precio_total_cip_sugerido,
                          formulario.moneda
                        )
                      : "-"}
                  </td>
                  <td style={{ padding: 8 }}>
                    {resultado.horas_produccion}
                  </td>
                  <td style={{ padding: 8 }}>
                    {resultado.horas_flujo}
                  </td>
                  <td style={{ padding: 8 }}>
                    <b>
                      {resultado.lead_time_flujo_dias} días
                    </b>
                  </td>
                  <td style={{ padding: 8 }}>
                    {cotizaExportacion
                      ? `${resultado.lead_time_cip_dias} días`
                      : "-"}
                  </td>
                  <td style={{ padding: 8 }}>
                    {
                      resultado.lead_time_conservador_dias
                    }{" "}
                    días
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resultadosComparativoExportacion.length > 0 && (
          <div style={{
            marginTop: 16,
            background: "white",
            borderRadius: 12,
            padding: 12,
            border: "1px solid #BFDBFE",
            boxShadow:
              "0 4px 12px rgba(37,99,235,0.08)"
          }}>
            <h4 style={{ marginTop: 0 }}>
              Comparativo licitación: local y destinos frecuentes
            </h4>
            <p style={{
              color: "#64748B",
              marginTop: -6,
              lineHeight: 1.4
            }}>
              Mantiene el EXW local separado y agrega, por cada
              destino seleccionado, la logística de exportación por
              unidad y el lead time total estimado.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse"
              }}>
                <thead>
                  <tr>
                    {[
                      "Cant.",
                      "EXW local/u",
                      "EXW local total",
                      "LT local",
                      ...destinosExportacionSeleccionados.flatMap(
                        destino => [
                          `${destino.etiqueta} logística/u`,
                          `${destino.etiqueta} LT export.`
                        ]
                      )
                    ].map(titulo => (
                      <th
                        key={titulo}
                        style={{
                          textAlign: "left",
                          padding: 8,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultadosComparativoExportacion.map(
                    fila => (
                      <tr key={fila.cantidad}>
                        <td style={{ padding: 8 }}>
                          {fila.cantidad}
                        </td>
                        <td style={{ padding: 8 }}>
                          <b>
                            {formatoNumero(
                              fila.precio_exw_unitario,
                              formulario.moneda
                            )}
                          </b>
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoNumero(
                            fila.precio_exw_total,
                            formulario.moneda
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {fila.lead_time_local} días
                        </td>
                        {fila.destinos.flatMap(destino => [
                          <td
                            key={`${fila.cantidad}_${destino.pais}_costo`}
                            style={{
                              padding: 8,
                              color: destino.pendiente
                                ? "#B45309"
                                : "#047857",
                              fontWeight: "bold",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {destino.pendiente
                              ? "Completar"
                              : formatoNumero(
                                  destino.costo_unitario,
                                  "USD"
                                )}
                          </td>,
                          <td
                            key={`${fila.cantidad}_${destino.pais}_lt`}
                            style={{
                              padding: 8,
                              whiteSpace: "nowrap"
                            }}
                          >
                            {destino.pendiente
                              ? "Completar"
                              : `${destino.lead_time_exportacion} días`}
                          </td>
                        ])}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            {destinosExportacionSeleccionados.some(
              destino =>
                !PRESETS_LOGISTICA_DESTINO[destino.pais]
                  ?.flete_internacional &&
                formulario.pais_destino !== destino.pais
            ) && (
              <div style={{
                marginTop: 10,
                color: "#92400E",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 10,
                padding: 10,
                fontWeight: "bold"
              }}>
                Los destinos sin tarifa base muestran “Completar”.
                Selecciona ese país en Logística internacional y
                carga flete, LTL y días para usarlo en la comparación.
              </div>
            )}
          </div>
        )}
        {resultadoBase && (
          <div style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10
          }}>
            {[
              {
                titulo: "Peso unitario",
                valor:
                  resultadoBase.peso_unitario_kg,
                porcentaje: 0,
                color: "#0F766E",
                unidad: "kg",
                textoBase:
                  "estimado por producto"
              },
              {
                titulo: "Precio EXW/u",
                valor:
                  resultadoBase
                    .precio_unitario_sugerido,
                porcentaje: 0,
                color: "#1D4ED8",
                unidad: "moneda",
                textoBase:
                  "sin logística internacional"
              },
              ...(cotizaExportacion
                ? [
                    {
                      titulo: `${incotermSeleccionado}/u`,
                      valor:
                        resultadoBase
                          .precio_unitario_cip_sugerido,
                      porcentaje: 0,
                      color: "#047857",
                      unidad: "moneda",
                      textoBase:
                        "EXW + logística seleccionada"
                    }
                  ]
                : []),
              {
                titulo: "MP / suministros",
                valor:
                  resultadoBase.costo_materiales,
                porcentaje:
                  resultadoBase.composicion_costos
                    ?.materiales,
                color: "#2563EB"
              },
              {
                titulo: "Mano de obra/proceso",
                valor:
                  resultadoBase.costo_procesos,
                porcentaje:
                  resultadoBase.composicion_costos
                    ?.mano_obra_procesos,
                color: "#7C3AED"
              },
              {
                titulo: "Gastos fijos",
                valor:
                  resultadoBase.costo_operativo,
                porcentaje:
                  resultadoBase.composicion_costos
                    ?.costos_fijos,
                color: "#EA580C"
              },
              {
                titulo: "Indirectos",
                valor:
                  resultadoBase.costo_indirecto,
                porcentaje:
                  resultadoBase.composicion_costos
                    ?.indirectos,
                color: "#0F766E"
              },
              {
                titulo: "Riesgo",
                valor:
                  resultadoBase.costo_riesgo,
                porcentaje:
                  resultadoBase.composicion_costos
                    ?.riesgo,
                color: "#B91C1C"
              },
              {
                titulo: "Utilidad",
                valor: resultadoBase.utilidad,
                porcentaje:
                  resultadoBase.composicion_costos
                    ?.utilidad,
                color: "#15803D"
              },
              ...(cotizaExportacion
                ? [
                    {
                      titulo: "Volumen export.",
                      valor:
                        logisticaBase.volumen_total_m3,
                      porcentaje: 0,
                      color: "#0369A1",
                      unidad: "m3",
                      textoBase:
                        "volumen total de la escala"
                    },
                    ...(logisticaBase.pallets_necesarios > 0
                      ? [{
                          titulo: "Pallets",
                          valor:
                            logisticaBase.pallets_necesarios,
                          porcentaje: 0,
                          color: "#166534",
                          unidad: "texto",
                          textoBase: `${logisticaBase.cajas || 0} cajas · ${logisticaBase.cajas_por_pallet || 0} cajas/pallet`
                        }]
                      : []),
                    {
                      titulo: "Ocupación camión",
                      valor:
                        logisticaBase
                          .ocupacion_volumen_pct,
                      porcentaje:
                        logisticaBase
                          .ocupacion_volumen_pct,
                      color: "#0F766E"
                    },
                    {
                      titulo: "Estado carga",
                      valor:
                        logisticaBase.estado_carga ||
                        "-",
                      porcentaje: 0,
                      color: "#7C2D12",
                      unidad: "texto",
                      textoBase: `${logisticaBase.camiones_necesarios || 0} camión(es)`
                    },
                    {
                      titulo: "Costo export./u",
                      valor:
                        resultadoBase
                          .costo_exportacion_unitario,
                      porcentaje: 0,
                      color: "#B45309",
                      unidad: "moneda",
                      textoBase:
                        "logística por producto"
                    }
                  ]
                : [])
            ].map(item => (
              <div
                key={item.titulo}
                style={{
                  background: "white",
                  border: "1px solid #BFDBFE",
                  borderRadius: 12,
                  padding: 12
                }}
              >
                <div style={{
                  color: "#475569",
                  fontWeight: "bold"
                }}>
                  {item.titulo}
                </div>
                <div style={{
                  color: item.color,
                  fontSize: 22,
                  fontWeight: "bold",
                  marginTop: 4
                }}>
                  {formatoValorResumen(
                    item,
                    formulario.moneda
                  )}
                </div>
                <div style={{
                  color: "#64748B",
                  fontSize: 12
                }}>
                  {item.unidad === "kg" ||
                  item.unidad === "m3" ||
                  item.unidad === "texto" ||
                  item.unidad === "moneda"
                    ? item.textoBase
                    : `${formatoNumero(
                        item.valor,
                        formulario.moneda
                      )} sobre precio total`}
                </div>
              </div>
            ))}
          </div>
        )}
        {mostrarVistaPepsico && (
          <div style={{
            marginTop: 16,
            background: "white",
            borderRadius: 12,
            padding: 12,
            border: "1px solid #93C5FD"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap"
            }}>
              <div>
                <h4 style={{ margin: 0 }}>
                  Vista plantilla PepsiCo
                </h4>
                <div style={ayudaCampo}>
                  {formulario.cotizacion_multipais
                    ? `${paisesPepsicoVista.length} países activos · ${filasPepsicoVista.length} escenarios · mismas filas y columnas de la descarga.`
                    : "Una fila por cantidad, en el mismo orden del Excel solicitado."}
                </div>
              </div>
              <button
                type="button"
                style={boton}
                onClick={() =>
                  descargarFilasPepsico(
                    filasPepsicoVista
                  )
                }
              >
                {formulario.cotizacion_multipais
                  ? "Descargar plantilla multipaís"
                  : "Descargar esta cotización"}
              </button>
            </div>
            {filasPepsicoVista.some(
              fila => fila.pendientes.length > 0
            ) && (
              <div style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                background: "#FFF7ED",
                border: "1px solid #FDBA74",
                color: "#9A3412",
                fontWeight: "bold"
              }}>
                Hay datos pendientes para la plantilla PepsiCo.
                La vista permite revisarlos, pero la descarga se
                bloqueará hasta corregirlos.
                <ul style={{ marginBottom: 0 }}>
                  {filasPepsicoVista
                    .flatMap(fila =>
                      fila.pendientes.map(pendiente =>
                        `${fila.pais} · ${fila.cantidad}: ${pendiente}`
                      )
                    )
                    .filter((mensaje, indice, lista) =>
                      lista.indexOf(mensaje) === indice
                    )
                    .map(mensaje => (
                      <li key={mensaje}>{mensaje}</li>
                    ))}
                </ul>
              </div>
            )}
            <div style={{
              overflowX: "auto",
              marginTop: 12
            }}>
              <table style={{
                borderCollapse: "collapse",
                minWidth: 6200,
                fontSize: 12
              }}>
                <thead>
                  <tr>
                    {ENCABEZADOS_PEPSICO.map((encabezado, indice) => (
                      <th
                        key={`${encabezado}_${indice}`}
                        style={{
                          background: "#334155",
                          color: "white",
                          padding: 7,
                          minWidth: 125,
                          border: "1px solid #CBD5E1"
                        }}
                      >
                        {encabezado}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasPepsicoVista.map(fila => (
                    <tr key={fila.clave}>
                      {filaAValoresPepsico(fila).map(
                        (valor, indice) => (
                          <td
                            key={`${fila.clave}_${indice}`}
                            style={{
                              padding: 7,
                              border: "1px solid #CBD5E1",
                              textAlign:
                                typeof valor === "number"
                                  ? "right"
                                  : "left",
                              background:
                                fila.pendientes.length > 0 &&
                                indice >= 5 &&
                                indice <= 20
                                  ? "#FFF7ED"
                                  : "white"
                            }}
                          >
                            {typeof valor === "number"
                              ? indice >= 37
                                ? formatoPorcentaje(
                                    valor * 100
                                  )
                                : valor.toLocaleString(
                                    "es-CL",
                                    {
                                      maximumFractionDigits: 2
                                    }
                                  )
                              : valor || ""}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {(resultados[0]?.detalle_materiales_unitario ||
          resultados[0]?.detalle_materiales)?.length >
          0 && (
          <details style={{
            marginTop: 16,
            background: "white",
            borderRadius: 12,
            padding: 12,
            border: "1px solid #BFDBFE",
            boxShadow:
              "0 4px 12px rgba(37,99,235,0.08)"
          }}>
            <summary style={resumenDesplegable}>
              <strong>Desglose de materiales por unidad</strong>
              <span style={{ color: "#64748B", fontSize: 13 }}>
                {(resultados[0]?.detalle_materiales_unitario || resultados[0]?.detalle_materiales || []).length} líneas · ver detalle
              </span>
            </summary>
            <div style={{ paddingTop: 12 }}>
            <p style={{
              color: "#64748B",
              marginTop: -6
            }}>
              Siempre muestra consumo y costo para 1 producto,
              independiente de la escala seleccionada. Úsalo
              para detectar materiales con participación anormal
              o datos de consumo/costo mal ingresados.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse"
              }}>
                <thead>
                  <tr>
                    {[
                      "Material",
                      "Consumo unit.",
                      "Compra/cobro unit.",
                      "Costo unit.",
                      "Peso unit.",
                      "Peso requerido",
                      "% materiales",
                      "% precio unit."
                    ].map(titulo => (
                      <th
                        key={titulo}
                        style={{
                          textAlign: "left",
                          padding: 8
                        }}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...(resultados[0]
                      .detalle_materiales_unitario ||
                      resultados[0].detalle_materiales)
                  ]
                    .sort(
                      (a, b) =>
                        Number(
                          b.costo_material || 0
                        ) -
                        Number(
                          a.costo_material || 0
                        )
                    )
                    .map((detalle, indice) => (
                      <tr
                        key={`${detalle.codigo}_${indice}`}
                      >
                        <td style={{ padding: 8 }}>
                          <b>
                            {detalle.codigo || "-"}
                          </b>
                          <div style={{
                            color: "#64748B",
                            fontSize: 12
                          }}>
                            {detalle.nombre || "-"}
                          </div>
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.consumo_requerido}{" "}
                          {detalle.unidad}
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.cantidad_comprada}{" "}
                          {detalle.unidad}
                          <div style={{
                            color:
                              detalle.politica_minimo_compra ===
                              "consumo_real"
                                ? "#15803D"
                                : "#C2410C",
                            fontSize: 12
                          }}>
                            {detalle.politica_minimo_compra ===
                            "consumo_real"
                              ? "Consumo real"
                              : "Compra mínima"}
                          </div>
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoNumero(
                            detalle.costo_material,
                            formulario.moneda
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoKg(
                            detalle.peso_material_kg
                          )}
                          <div style={{
                            color: "#64748B",
                            fontSize: 12
                          }}>
                            {detalle.peso_kg_por_unidad ||
                            0}{" "}
                            kg/{detalle.unidad || "un"}
                          </div>
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoKg(
                            detalle.peso_requerido_kg
                          )}
                          <div style={{
                            color: "#64748B",
                            fontSize: 12
                          }}>
                            incluye merma
                          </div>
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoPorcentaje(
                            detalle.porcentaje_costo
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoPorcentaje(
                            detalle.porcentaje_precio
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            </div>
          </details>
        )}
        {resultados[0]?.detalle_procesos?.length > 0 && (
          <details style={{
            marginTop: 16,
            background: "white",
            borderRadius: 12,
            padding: 12,
            border: "1px solid #BFDBFE",
            boxShadow:
              "0 4px 12px rgba(37,99,235,0.08)"
          }}>
            <summary style={resumenDesplegable}>
              <strong>
              Detalle costo operativo por proceso ·{" "}
              {resultados[0].cantidad} unidades
              </strong>
              <span style={{ color: "#64748B", fontSize: 13 }}>
                {resultados[0].detalle_procesos.length} operaciones · ver detalle
              </span>
            </summary>
            <div style={{ paddingTop: 12 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse"
              }}>
                <thead>
                  <tr>
                    {[
                      "Proceso",
                      "Estación",
                      "Fórmula",
                      "Seg/prod.",
                      "Horas",
                      "Costo proceso",
                      "% procesos",
                      "% precio",
                      "% fijo",
                      "Detalle MIG",
                      "Costo operativo"
                    ].map(titulo => (
                      <th
                        key={titulo}
                        style={{
                          textAlign: "left",
                          padding: 8
                        }}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados[0].detalle_procesos.map(
                    (detalle, indice) => (
                      <tr
                        key={`${detalle.proceso_codigo}_${detalle.estacion_codigo}_${indice}`}
                      >
                        <td style={{ padding: 8 }}>
                          {detalle.proceso_nombre || "-"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.estacion_nombre || "-"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.formula_tiempo || "-"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.segundos_por_producto ||
                            "-"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.horas}
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoNumero(
                            detalle.costo_proceso,
                            formulario.moneda
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoPorcentaje(
                            detalle.porcentaje_costo
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoPorcentaje(
                            detalle.porcentaje_precio
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {
                            detalle.porcentaje_costo_operativo
                          }
                          %
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.tipo_formula_tiempo ===
                          "soldadura_mig" ? (
                            <span>
                              Puntos:{" "}
                              {detalle.puntos_mig || 0} /{" "}
                              {detalle.formula_tiempo_detalle
                                ?.puntos_mig || 0}
                              s · Simples:{" "}
                              {detalle.cordones_simples || 0} /{" "}
                              {detalle.formula_tiempo_detalle
                                ?.cordones_simples || 0}
                              s · Perim.:{" "}
                              {detalle.cordones_perimetrales ||
                                0}{" "}
                              /{" "}
                              {detalle.formula_tiempo_detalle
                                ?.cordones_perimetrales || 0}
                              s
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoNumero(
                            detalle.costo_operativo,
                            formulario.moneda
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </details>
        )}
      </SeccionDesplegable>

      <div style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
        marginBottom: 22
      }}>
        <button
          style={boton}
          disabled={guardando}
          onClick={guardar}
        >
          {guardando
            ? "Guardando..."
            : editandoId
              ? "Actualizar cotización"
              : "Guardar cotización"}
        </button>
        <button
          style={botonSecundario}
          onClick={limpiarFormulario}
        >
          Nueva cotización
        </button>
      </div>

      <SeccionDesplegable
        clave={`historial-${editandoId || "nueva"}`}
        titulo="Historial de cotizaciones"
        resumen={`${historial.length} ${historial.length === 1 ? "cotización" : "cotizaciones"}`}
        abierta={!editandoId}
      >
        <p style={{
          color: "#64748B",
          marginTop: -4,
          lineHeight: 1.4
        }}>
          Se cargan hasta 200 cotizaciones recientes.
          Usa búsqueda o estado para encontrar versiones
          anteriores sin llenar la pantalla.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 12
        }}>
          <CampoConAyuda
            etiqueta="Buscar cotización"
            ayuda="Busca por producto, cliente, versión, estado o confianza."
          >
            <input
              style={campo}
              type="search"
              placeholder="Ej: Isla Ruma, Walmart"
              value={busquedaHistorial}
              onChange={e => {
                setBusquedaHistorial(e.target.value);
                setLimiteHistorialVisible(20);
              }}
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Estado"
            ayuda="Filtra cotizaciones por etapa comercial."
          >
            <select
              style={campo}
              value={estadoHistorial}
              onChange={e => {
                setEstadoHistorial(e.target.value);
                setLimiteHistorialVisible(20);
              }}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_COTIZACION.map(estado => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </CampoConAyuda>
        </div>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12
        }}>
          <button
            type="button"
            style={botonSecundario}
            disabled={clavesFilasPepsicoHistorial.length === 0}
            onClick={() =>
              setFilasPepsicoSeleccionadas(
                clavesFilasPepsicoHistorial
              )
            }
          >
            Seleccionar cantidades filtradas
          </button>
          <button
            type="button"
            style={botonSecundario}
            onClick={() =>
              setFilasPepsicoSeleccionadas([])
            }
          >
            Limpiar selección
          </button>
          <button
            type="button"
            style={boton}
            disabled={
              filasPepsicoSeleccionadas.length === 0
            }
            onClick={() =>
              descargarFilasPepsico(
                crearFilasPepsico(
                  historial,
                  filasPepsicoSeleccionadas
                )
              )
            }
          >
            Descargar Excel PepsiCo (
            {filasPepsicoSeleccionadas.length})
          </button>
        </div>
        <div style={{
          color: "#64748B",
          marginBottom: 12
        }}>
          Mostrando {historialVisible.length} de{" "}
          {historialFiltrado.length} filtradas (
          {historial.length} cargadas).
        </div>
        {cargando && <div>Cargando...</div>}
        {!cargando && historialVisible.length === 0 && (
          <div style={{
            background: "#F8FAFC",
            borderRadius: 12,
            padding: 12,
            color: "#64748B",
            marginBottom: 10
          }}>
            No hay cotizaciones que coincidan con el
            filtro actual.
          </div>
        )}
        {historialVisible.map(item => {
          const primeraEscala = item.resultados?.[0];
          return (
            <div
              key={item.id}
              style={{
                border: "1px solid #CBD5E1",
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
                background: "#F8FAFC"
              }}
            >
              <b>{item.nombre_producto}</b>{" "}
              <span style={{ color: "#64748B" }}>
                {item.cliente ? `- ${item.cliente}` : ""}
              </span>
              <div>
                Estado: {item.estado} / confianza{" "}
                {item.nivel_confianza}
              </div>
              {primeraEscala && (
                <div>
                  Desde {primeraEscala.cantidad} un:{" "}
                  {formatoNumero(
                    primeraEscala.precio_unitario_sugerido,
                    item.moneda || "CLP"
                  )}{" "}
                  unitario / lead time flujo{" "}
                  {primeraEscala.lead_time_flujo_dias ||
                    primeraEscala.lead_time_dias}{" "}
                  días
                </div>
              )}
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8
              }}>
                {(item.resultados || []).map(resultado => {
                  const clave = claveFilaPepsico(
                    item.id,
                    resultado.cantidad
                  );
                  const seleccionado =
                    filasPepsicoSeleccionadas.includes(
                      clave
                    );

                  return (
                    <label
                      key={clave}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 9px",
                        borderRadius: 9,
                        border: seleccionado
                          ? "1px solid #2563EB"
                          : "1px solid #CBD5E1",
                        background: seleccionado
                          ? "#EFF6FF"
                          : "white",
                        fontWeight: "bold"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() =>
                          alternarFilaPepsico(clave)
                        }
                      />
                      PepsiCo {resultado.cantidad} un /{" "}
                      {item.datos_pepsico?.pais ||
                        item.supuestos?.exportacion
                          ?.pais_destino ||
                        "Chile"}
                    </label>
                  );
                })}
              </div>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8
              }}>
                <button
                  type="button"
                  style={{
                    ...boton,
                    padding: "8px 10px"
                  }}
                  onClick={() =>
                    cargarParaEditar(item)
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  style={{
                    ...botonSecundario,
                    padding: "8px 10px"
                  }}
                  onClick={() =>
                    cargarComoNuevaVersion(item)
                  }
                >
                  Nueva versión
                </button>
              </div>
            </div>
          );
        })}
        {historialFiltrado.length >
          limiteHistorialVisible && (
          <button
            type="button"
            style={{
              ...botonSecundario,
              width: "100%",
              marginTop: 6
            }}
            onClick={() =>
              setLimiteHistorialVisible(
                actual => actual + 20
              )
            }
          >
            Mostrar 20 cotizaciones más
          </button>
        )}
      </SeccionDesplegable>
    </div>
  );
}
