import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
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
  calcularCotizacionTecnica,
  TIPOS_LECTURA_CONSUMO
} from "./costeoCalculos";
import {
  ESTADOS_COTIZACION,
  NIVELES_CONFIANZA,
  aFormularioCotizacionTecnica,
  actualizarCotizacionTecnica,
  guardarCotizacionTecnica,
  listarCotizacionesTecnicas
} from "./costeoRepository";

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

const tituloCard = {
  marginTop: 8,
  marginBottom: 8
};

const lineaCotizador = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  padding: 14,
  background: "#F8FAFC",
  borderRadius: 14,
  border: "1px solid #CBD5E1",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
  marginBottom: 12
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
  descripcion: "",
  riesgos: "",
  escalas: "50, 100, 500",
  indirectos_porcentaje: 18,
  costo_operativo_hora: 0,
  costo_operativo_origen: "",
  costo_operativo_config_id: "",
  margen_porcentaje: 35,
  tipo_margen: "margen_bruto",
  factor_riesgo_porcentaje: 8,
  dias_compra: 5,
  dias_ingenieria: 2,
  horas_disponibles_dia: 14,
  desfase_flujo_horas: 2,
  materiales: [],
  procesos: []
};

const materialVacio = {
  tipo_linea: "material",
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
  consumo_unitario: 1,
  merma_porcentaje: 5,
  costo_unitario: 0,
  minimo_compra: 0,
  politica_minimo_compra: "cobrar_minimo",
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

const obtenerTipoLecturaConsumoMaterial = material => {
  const texto = normalizarComparacion(
    [
      material?.codigo,
      material?.nombre
    ].join(" ")
  );

  if (/\bpai\b/.test(texto)) {
    return TIPOS_LECTURA_CONSUMO.FRACCION_MP;
  }

  if (/\balambre\b/.test(texto)) {
    return TIPOS_LECTURA_CONSUMO.ALAMBRE_DOBLADO;
  }

  return TIPOS_LECTURA_CONSUMO.CORTES_LINEALES;
};

const aplicarExpresionConsumo = material => {
  const analisis = analizarExpresionConsumoMaterial({
    expresion: material.expresion_consumo,
    unidadExpresion:
      material.unidad_expresion_consumo || "mm",
    unidadMaterial: material.unidad || "m",
    tipoLectura:
      obtenerTipoLecturaConsumoMaterial(material)
  });

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
            analisis.longitud_por_pieza
        }
      : {}),
    expresion_consumo_error: analisis.error
  };
};

const recalcularMaterialesConFormula = materiales =>
  (materiales || []).map(material =>
    material?.expresion_consumo
      ? aplicarExpresionConsumo(material)
      : material
  );

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

const valoresPorTipoFormula = (
  tipoFormula,
  proceso
) => {
  if (tipoFormula === "doblez_cnc_3d") {
    return valoresFormulaDoblezCnc(proceso);
  }

  if (tipoFormula === "corte_cnc_recto") {
    return valoresFormulaCorteCncRecto(proceso);
  }

  if (tipoFormula === "corte_prensa") {
    return valoresFormulaCortePrensa(proceso);
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
      proceso.segundos_por_corte || 1.5
  });

  if (
    !proceso.tipo_formula_tiempo ||
    !proceso.formula_tiempo
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
            "corte_prensa"
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

  return material.tipo !== "SUM";
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
    ayuda: "Costo por unidad de compra."
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
  const [editandoId, setEditandoId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

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

  const actualizar = cambios => {
    setFormulario(actual => ({
      ...actual,
      ...cambios
    }));
    setMensaje("");
    setError("");
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
          formulario.desfase_flujo_horas
      }),
    [formulario]
  );

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

    return {
      tipo_linea:
        materialActual?.tipo_linea || "material",
      material_id: materialId,
      codigo: material?.codigo || "",
      nombre: material?.nombre || "",
      unidad:
        material?.unidad_medida ||
        materialActual?.unidad ||
        "un",
      expresion_consumo:
        materialActual?.expresion_consumo || "",
      unidad_expresion_consumo:
        materialActual?.unidad_expresion_consumo ||
        "mm",
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
      minimo_compra:
        minimoCompra ||
        (mismoMaterialActual
          ? materialActual?.minimo_compra
          : 0) ||
        0,
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
        : esCorteCncRecto(estacion)
          ? valoresFormulaCorteCncRecto(procesoActual)
          : esCortePrensa(estacion)
            ? valoresFormulaCortePrensa(procesoActual)
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
      <section style={cardCotizador}>
        <div style={franjaCard} />
        <h3 style={tituloCard}>{titulo}</h3>
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

          return (
          <div
            key={indice}
            style={lineaCotizador}
          >
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
            {tipoLinea === "material" && (
              <>
                <CampoConAyuda
                  etiqueta="Fórmula consumo"
                  ayuda={
                    lecturaFraccionaria
                      ? "Opcional. Ej: (1/96)*3. La división es la fracción de MP por pieza; el multiplicador es la cantidad de piezas del producto."
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
                </CampoConAyuda>
                <CampoConAyuda
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
                </CampoConAyuda>
                <CampoConAyuda
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
                        : lecturaAlambre
                          ? `Doblez por pieza: ${lecturaMaterial.dobleces_por_pieza || 0} | Cortes por pieza: ${lecturaMaterial.cortes_por_pieza || 0} | Doblez por producto: ${lecturaMaterial.dobleces_por_producto || 0} | Cortes por producto: ${lecturaMaterial.cortes_por_producto || 0} | Consumo pieza: ${lecturaMaterial.consumo_pieza_formula || lecturaMaterial.longitud_por_pieza || 0} ${lecturaMaterial.unidad_expresion_consumo || "mm"} | Consumo total: ${lecturaMaterial.consumo_total_formula || 0} ${lecturaMaterial.unidad_expresion_consumo || "mm"}`
                        : `Cortes: ${lecturaMaterial.cortes_calculados || 0} | Cortes por subproducto: ${lecturaMaterial.cortes_por_subproducto || lecturaMaterial.cortes_calculados || 0} | Subproductos: ${lecturaMaterial.subproductos || 1} | Largo base: ${lecturaMaterial.longitud_por_pieza || 0} ${lecturaMaterial.unidad_expresion_consumo || "mm"}`
                      : "Sin fórmula"}
                  </div>
                </CampoConAyuda>
              </>
            )}
            {CAMPOS_MATERIAL_ESTIMADO.filter(
              campoConfig =>
                !(
                  campoConfig.clave === "proveedor" &&
                  material.proveedor_id
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

                    const materialActualizado =
                      campoConfig.clave === "unidad"
                        ? aplicarExpresionConsumo({
                            ...material,
                            ...cambiosMaterial
                          })
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
      </section>
    );
  };

  return (
    <div style={{
      padding: 20,
      maxWidth: 1250,
      margin: "0 auto"
    }}>
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

      <section style={cardCotizador}>
        <div style={franjaCard} />
        <h3 style={tituloCard}>
          Producto prototipo{" "}
          {editandoId ? "(editando)" : ""}
        </h3>
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
      </section>

      <section style={cardCotizador}>
        <div style={franjaCard} />
        <h3 style={tituloCard}>
          Supuestos comerciales y lead time
        </h3>
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
      </section>

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

      <section style={cardCotizador}>
        <div style={franjaCard} />
        <h3 style={tituloCard}>
          Procesos estimados
        </h3>
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
          const esFormulaCortePrensa =
            proceso.tipo_formula_tiempo ===
            "corte_prensa";
          const materialesFormulaProceso =
            esFormulaDoblezCnc
              ? materialesConFormulaAlambre
              : esFormulaCortePrensa
                ? materialesConFormulaCortes
                : [];

          return (
            <div
              key={indice}
              style={{
                ...lineaCotizador,
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10
              }}
            >
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
                  <option value="corte_cnc_recto">
                    Corte CNC Recto
                  </option>
                  <option value="corte_prensa">
                    Corte / Prensa
                  </option>
                </select>
              </CampoConAyuda>
              {[
                "doblez_cnc_3d",
                "corte_cnc_recto",
                "corte_prensa"
              ].includes(proceso.tipo_formula_tiempo) && (
                <>
                  {(esFormulaDoblezCnc ||
                    esFormulaCortePrensa) && (
                    <CampoConAyuda
                      etiqueta="Usar fórmula desde material"
                      ayuda={
                        esFormulaDoblezCnc
                          ? "Reutiliza la fórmula del MP Alambre ya ingresada en Materiales estimados para calcular avance, dobleces y cortes."
                          : "Reutiliza la fórmula del MP Tubo ya ingresada en Materiales estimados para calcular golpes de prensa."
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
                          const actualizado =
                            aplicarFormulaTiempoProceso({
                              ...proceso,
                              formula_material_indice:
                                materialIndice,
                              formula_material_id:
                                material?.material_id ||
                                "",
                              formula_material_codigo:
                                material?.codigo || "",
                              formula_material_nombre:
                                material?.nombre || "",
                              formula_tiempo:
                                material
                                  ?.expresion_consumo ||
                                proceso.formula_tiempo ||
                                "",
                              unidad_formula_tiempo:
                                material
                                  ?.unidad_expresion_consumo ||
                                proceso
                                  .unidad_formula_tiempo ||
                                "mm"
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
                          {esFormulaDoblezCnc
                            ? "Seleccionar MP Alambre con fórmula"
                            : "Seleccionar MP Tubo con fórmula"}
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
                  <CampoConAyuda
                    etiqueta={
                      proceso.tipo_formula_tiempo ===
                      "corte_prensa"
                        ? "Fórmula golpes"
                        : "Fórmula piezas"
                    }
                    ayuda={
                      proceso.tipo_formula_tiempo ===
                      "corte_prensa"
                        ? "Ej: (131+360+71)*1. Cada medida del tubo equivale a un golpe/corte de prensa."
                        : proceso.tipo_formula_tiempo ===
                      "corte_cnc_recto"
                        ? "Ej: (30)*4. Se lee como 4 cortes de 30 mm."
                        : "Ej: (100+50+20)*4. Calcula avance, dobleces, cortes y unid/hora."
                    }
                  >
                    <input
                      style={campo}
                      type="text"
                      placeholder="Ej: (100+50+20)*4"
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
                  {[
                    ...(proceso.tipo_formula_tiempo ===
                    "corte_prensa"
                      ? []
                      : [{
                          clave: "segundos_por_metro",
                          etiqueta: "Seg/m avance"
                        }]),
                    ...(proceso.tipo_formula_tiempo ===
                    "doblez_cnc_3d"
                      ? [{
                          clave: "segundos_por_doblez",
                          etiqueta: "Seg/doblez"
                        }]
                      : []),
                    {
                      clave: "segundos_por_corte",
                      etiqueta:
                        proceso.tipo_formula_tiempo ===
                        "corte_prensa"
                          ? "Seg/golpe"
                          : "Seg/corte"
                    }
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
                          "corte_prensa"
                          ? `${proceso.segundos_por_producto || 0} seg/producto | ${proceso.unidades_por_hora || 0} un/h | Golpes por producto: ${proceso.golpes_calculados || proceso.cortes_calculados || 0}${proceso.formula_material_codigo ? ` | Desde material: ${proceso.formula_material_codigo}` : ""}`
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
      </section>

      <section style={{
        ...cardCotizador,
        background: "#EFF6FF",
        borderColor: "#93C5FD"
      }}>
        <div style={franjaCard} />
        <h3 style={tituloCard}>
          Resultado por escala
        </h3>
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
                  "Precio sugerido",
                  "Costo operativo",
                  "Costo total",
                  "Precio total",
                  "Horas totales",
                  "Horas flujo",
                  "LT flujo",
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
        {resultados[0]?.detalle_procesos?.length > 0 && (
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
              Detalle costo operativo por proceso ·{" "}
              {resultados[0].cantidad} unidades
            </h4>
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
                      "% fijo",
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
                          {
                            detalle.porcentaje_costo_operativo
                          }
                          %
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
        )}
      </section>

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

      <section style={cardCotizador}>
        <div style={franjaCard} />
        <h3 style={tituloCard}>
          Últimas cotizaciones
        </h3>
        {cargando && <div>Cargando...</div>}
        {historial.slice(0, 8).map(item => {
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
      </section>
    </div>
  );
}
