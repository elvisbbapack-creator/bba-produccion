import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  listarMateriales
} from "../materiales/materialesRepository";
import {
  listarOperacionesOT,
  listarOrdenesV2
} from "../ordenes/ordenesRepository";
import {
  ESTADOS_TRASPASO_ALMACEN,
  ESTADOS_SOLICITUD_REPOSICION,
  MOVIMIENTOS_ALMACEN,
  TIPOS_MOVIMIENTO_ALMACEN,
  TIPOS_SOLICITUD_REPOSICION,
  actualizarPoliticaStock,
  calcularAlertasStock,
  calcularCuadraturaAlmacenOT,
  calcularDisponibilidadOT,
  calcularNecesidadesMaterialesOTs,
  calcularStockDisponible,
  esMovimientoAjusteAutorizado,
  listarConteosFisicos,
  listarSolicitudesReposicion,
  listarTraspasosAlmacen,
  listarMovimientosAlmacen,
  listarStockMateriales,
  normalizarPlantaId,
  priorizarOrdenesPorMaterial,
  prepararMovimientoAlmacen,
  prepararConteoFisico,
  prepararTraspasoAlmacen,
  registrarConteoFisico,
  registrarMovimientoAlmacen,
  registrarSolicitudReposicion,
  registrarTraspasoRecepcion,
  registrarTraspasoSalida,
  resolverSolicitudReposicion,
  validarConteoFisico,
  validarTraspasoSalida,
  validarMovimientoAlmacen
} from "./almacenRepository";

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

const normalizarTexto = valor =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const etiquetaMaterial = material =>
  material
    ? `${material.codigo || "Sin codigo"} - ${material.nombre || "Sin nombre"}`
    : "";

const valoresDirectosMaterial = material =>
  Object.values(material || {}).filter(valor =>
    ["string", "number", "boolean"].includes(
      typeof valor
    )
  );

const textoBusquedaMaterial = material => normalizarTexto([
  ...valoresDirectosMaterial(material),
  material.codigo,
  material.nombre,
  material.tipo,
  material.unidad_medida,
  material.proveedor_preferente_nombre,
  material.proveedor_nombre,
  material.producto_codigo,
  material.producto_nombre,
  material.subproducto_codigo,
  material.subproducto_nombre,
  material.descripcion,
  material.categoria,
  ...(material.productos_asociados || []).flatMap(producto => [
    producto.producto_codigo,
    producto.producto_nombre,
    producto.codigo,
    producto.nombre
  ]),
  ...(material.subproductos_asociados || []).flatMap(subproducto => [
    subproducto.subproducto_codigo,
    subproducto.subproducto_nombre,
    subproducto.codigo,
    subproducto.nombre
  ])
].join(" "));

const referenciasFrecuentesMovimiento = [
  "OC proveedor",
  "Guía de despacho",
  "Factura proveedor",
  "Recepción compra",
  "Consumo por OT",
  "Reserva OT",
  "Liberación reserva OT",
  "Merma",
  "Daño",
  "Ajuste autorizado",
  "Diferencia de recepción"
];

const referenciasFrecuentesConteo = [
  "Inventario cíclico",
  "Auditoría interna",
  "Conteo físico",
  "Regularización de stock",
  "Diferencia de inventario"
];

const referenciasFrecuentesTraspaso = [
  "Guía interna",
  "Solicitud interna",
  "Traslado interno",
  "Reposición entre almacenes",
  "Movimiento entre bodegas"
];

const unirReferencias = (...listas) => Array.from(
  new Set(
    listas
      .flat()
      .map(referencia => String(referencia || "").trim())
      .filter(Boolean)
  )
).sort((a, b) => a.localeCompare(b));

function SelectorMaterial({
  materiales,
  materialId,
  onChange,
  placeholder = "Escribe código o nombre para filtrar"
}) {
  const materialSeleccionado = useMemo(
    () => materiales.find(
      material => material.id === materialId
    ) || null,
    [materialId, materiales]
  );
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [editandoBusqueda, setEditandoBusqueda] =
    useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (materialSeleccionado) {
      setBusqueda(
        etiquetaMaterial(materialSeleccionado)
      );
      setEditandoBusqueda(false);
      return;
    }

    if (!editandoBusqueda) {
      setBusqueda("");
    }
  }, [materialSeleccionado, editandoBusqueda]);

  const materialesFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    const lista = termino
      ? materiales
        .filter(material =>
          textoBusquedaMaterial(material).includes(termino)
        )
        .sort((a, b) => {
          const aClave = normalizarTexto(etiquetaMaterial(a));
          const bClave = normalizarTexto(etiquetaMaterial(b));
          const aEmpieza = aClave.startsWith(termino) ? 0 : 1;
          const bEmpieza = bClave.startsWith(termino) ? 0 : 1;
          if (aEmpieza !== bEmpieza) {
            return aEmpieza - bEmpieza;
          }
          return aClave.localeCompare(bClave);
        })
      : materiales;

    return lista.slice(0, 25);
  }, [busqueda, materiales]);

  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    const cerrarSiClickFuera = evento => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target)
      ) {
        setAbierto(false);
      }
    };

    document.addEventListener("mousedown", cerrarSiClickFuera);
    document.addEventListener("touchstart", cerrarSiClickFuera);

    return () => {
      document.removeEventListener("mousedown", cerrarSiClickFuera);
      document.removeEventListener("touchstart", cerrarSiClickFuera);
    };
  }, [abierto]);

  return (
    <div
      ref={contenedorRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        marginTop: 6,
        marginBottom: 14
      }}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: materialId
          ? "minmax(0, 1fr) auto"
          : "minmax(0, 1fr)",
        gap: 8,
        width: "100%",
        minWidth: 0
      }}>
        <input
          type="text"
          value={busqueda}
          onChange={evento => {
            setEditandoBusqueda(true);
            setBusqueda(evento.target.value);
            if (materialId) {
              onChange("");
            }
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder={placeholder}
          style={{
            ...campo,
            minWidth: 0
          }}
        />
        {materialId && (
          <button
            type="button"
            onClick={() => {
              setEditandoBusqueda(false);
              onChange("");
              setBusqueda("");
              setAbierto(true);
            }}
            style={{
              width: 44,
              minWidth: 44,
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              background: "#F8FAFC",
              color: "#334155",
              padding: "0 12px",
              fontWeight: 800,
              cursor: "pointer"
            }}
            aria-label="Limpiar material seleccionado"
          >
            ×
          </button>
        )}
      </div>

      {abierto && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            maxHeight: 260,
            overflowY: "auto",
            overflowX: "hidden",
            background: "white",
            border: "1px solid #CBD5E1",
            borderRadius: 10,
            boxShadow:
              "0 12px 30px rgba(15,23,42,0.18)"
          }}
        >
          {materialesFiltrados.length === 0 ? (
            <div style={{
              padding: 12,
              color: "#64748B",
              fontSize: 14
            }}>
              {materiales.length === 0 ? (
                "No hay materiales cargados para esta empresa o no tienes permiso para leerlos."
              ) : (
                <>
                  No encontramos materiales con "{busqueda}" entre {materiales.length} materiales cargados.
                  <button
                    type="button"
                    onMouseDown={evento => {
                      evento.preventDefault();
                      setBusqueda("");
                    }}
                    style={{
                      display: "block",
                      marginTop: 8,
                      border: "1px solid #BFDBFE",
                      borderRadius: 8,
                      background: "#EFF6FF",
                      color: "#1D4ED8",
                      padding: "8px 10px",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    Ver primeros materiales
                  </button>
                </>
              )}
            </div>
          ) : materialesFiltrados.map(material => (
            <button
              key={material.id}
              type="button"
              onMouseDown={evento => {
                evento.preventDefault();
                setEditandoBusqueda(false);
                onChange(material.id);
                setBusqueda(etiquetaMaterial(material));
                setAbierto(false);
              }}
              style={{
                width: "100%",
                display: "grid",
                minWidth: 0,
                gap: 3,
                textAlign: "left",
                padding: "10px 12px",
                border: 0,
                borderBottom: "1px solid #E2E8F0",
                background:
                  material.id === materialId
                    ? "#EFF6FF"
                    : "white",
                color: "#0F172A",
                cursor: "pointer"
              }}
            >
              <strong>
                {material.codigo}
                {" - "}
                {material.nombre}
              </strong>
              <span style={{
                color: "#64748B",
                fontSize: 13
              }}>
                {material.tipo || "Material"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectorReferencia({
  value,
  onChange,
  opciones,
  placeholder
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const termino = normalizarTexto(value);
  const opcionesFiltradas = useMemo(() => {
    const lista = termino
      ? opciones.filter(opcion =>
        normalizarTexto(opcion).includes(termino)
      )
      : opciones;

    return lista.slice(0, 18);
  }, [opciones, termino]);

  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    const cerrarSiClickFuera = evento => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target)
      ) {
        setAbierto(false);
      }
    };

    document.addEventListener("mousedown", cerrarSiClickFuera);
    document.addEventListener("touchstart", cerrarSiClickFuera);

    return () => {
      document.removeEventListener("mousedown", cerrarSiClickFuera);
      document.removeEventListener("touchstart", cerrarSiClickFuera);
    };
  }, [abierto]);

  return (
    <div
      ref={contenedorRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        marginTop: 6,
        marginBottom: 14
      }}
    >
      <input
        value={value}
        onChange={evento => {
          onChange(evento.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        style={{
          ...campo,
          minWidth: 0
        }}
      />

      {abierto && (
        <div
          style={{
            position: "absolute",
            zIndex: 18,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            maxHeight: 220,
            overflowY: "auto",
            overflowX: "hidden",
            background: "white",
            border: "1px solid #CBD5E1",
            borderRadius: 10,
            boxShadow:
              "0 12px 30px rgba(15,23,42,0.16)"
          }}
        >
          {opcionesFiltradas.length === 0 ? (
            <div style={{
              padding: 12,
              color: "#64748B",
              fontSize: 14
            }}>
              No hay referencias relacionadas con esa búsqueda.
            </div>
          ) : opcionesFiltradas.map(opcion => (
            <button
              key={opcion}
              type="button"
              onMouseDown={evento => {
                evento.preventDefault();
                onChange(opcion);
                setAbierto(false);
              }}
              style={{
                width: "100%",
                display: "block",
                textAlign: "left",
                overflowWrap: "anywhere",
                padding: "10px 12px",
                border: 0,
                borderBottom: "1px solid #E2E8F0",
                background:
                  opcion === value
                    ? "#EFF6FF"
                    : "white",
                color: "#0F172A",
                cursor: "pointer",
                fontWeight:
                  opcion === value
                    ? 800
                    : 500
              }}
            >
              {opcion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const estadoInicial = {
  material_id: "",
  tipo: TIPOS_MOVIMIENTO_ALMACEN.RECEPCION,
  cantidad: "",
  ot_codigo: "",
  referencia: "",
  observacion: ""
};

const traspasoInicial = {
  material_id: "",
  planta_destino_id: "",
  cantidad: "",
  referencia: "",
  observacion: ""
};

const conteoInicial = {
  material_id: "",
  cantidad_contada: "",
  referencia: "",
  observacion: ""
};

const politicaInicial = {
  material_id: "",
  stock_minimo: "",
  punto_reposicion: "",
  stock_objetivo: "",
  lead_time_dias: ""
};

const formatearNumero = valor =>
  Number(valor || 0).toLocaleString(
    "es-CL",
    {
      maximumFractionDigits: 2
    }
  );

const formatearFecha = fecha => {
  const date = fecha?.toDate?.();
  return date
    ? date.toLocaleString("es-CL")
    : "Recién registrado";
};

const movimientoRequiereOT = tipo => [
  TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT,
  TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT
].includes(tipo);

const etiquetaOrigenMovimiento = origen => {
  if (origen === "produccion") {
    return "Producción";
  }
  if (origen === "traspaso") {
    return "Traspaso";
  }
  if (origen === "ajuste_autorizado") {
    return "Ajuste autorizado";
  }
  return "Manual";
};

const estiloOrigenMovimiento = origen => {
  if (origen === "produccion") {
    return {
      color: "#7C2D12",
      background: "#FFEDD5"
    };
  }
  if (origen === "traspaso") {
    return {
      color: "#1D4ED8",
      background: "#DBEAFE"
    };
  }
  if (origen === "ajuste_autorizado") {
    return {
      color: "#991B1B",
      background: "#FEE2E2"
    };
  }
  return {
    color: "#334155",
    background: "#E2E8F0"
  };
};

function AlmacenV2({
  db,
  perfil,
  onVolver
}) {
  const plantaInicial =
    normalizarPlantaId(
      perfil?.planta_ids?.[0] ||
        perfil?.planta_id ||
        "chile"
    );
  const [plantaId, setPlantaId] =
    useState(plantaInicial);
  const [materiales, setMateriales] =
    useState([]);
  const [stocks, setStocks] = useState([]);
  const [movimientos, setMovimientos] =
    useState([]);
  const [traspasos, setTraspasos] =
    useState([]);
  const [conteos, setConteos] = useState([]);
  const [
    solicitudesReposicion,
    setSolicitudesReposicion
  ] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [operacionesOrden, setOperacionesOrden] =
    useState([]);
  const [
    operacionesOrdenesAbiertas,
    setOperacionesOrdenesAbiertas
  ] = useState([]);
  const [
    operacionesTrazabilidad,
    setOperacionesTrazabilidad
  ] = useState([]);
  const [otTrazabilidad, setOtTrazabilidad] =
    useState("");
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [formularioTraspaso, setFormularioTraspaso] =
    useState(traspasoInicial);
  const [formularioConteo, setFormularioConteo] =
    useState(conteoInicial);
  const [formularioPolitica, setFormularioPolitica] =
    useState(politicaInicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] =
    useState(false);
  const [guardandoTraspaso, setGuardandoTraspaso] =
    useState(false);
  const [guardandoConteo, setGuardandoConteo] =
    useState(false);
  const [guardandoPolitica, setGuardandoPolitica] =
    useState(false);
  const [
    guardandoSolicitudId,
    setGuardandoSolicitudId
  ] = useState("");
  const [
    resolviendoSolicitudId,
    setResolviendoSolicitudId
  ] = useState("");
  const [
    recibiendoTraspasoId,
    setRecibiendoTraspasoId
  ] = useState("");
  const [
    esPantallaPequena,
    setEsPantallaPequena
  ] = useState(
    typeof window !== "undefined"
      ? window.innerWidth <= 760
      : false
  );
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busquedaStock, setBusquedaStock] =
    useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const actualizarTamano = () =>
      setEsPantallaPequena(
        window.innerWidth <= 760
      );

    actualizarTamano();
    window.addEventListener(
      "resize",
      actualizarTamano
    );

    return () =>
      window.removeEventListener(
        "resize",
        actualizarTamano
      );
  }, []);

  const plantas = Array.from(
    new Set(
      (perfil?.planta_ids?.length
        ? perfil.planta_ids
        : [plantaInicial]
      )
        .map(normalizarPlantaId)
        .filter(Boolean)
    )
  );

  const materialSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id === formulario.material_id
    ) || null,
    [formulario.material_id, materiales]
  );

  const materialTraspasoSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id ===
        formularioTraspaso.material_id
    ) || null,
    [
      formularioTraspaso.material_id,
      materiales
    ]
  );

  const materialConteoSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id ===
        formularioConteo.material_id
    ) || null,
    [
      formularioConteo.material_id,
      materiales
    ]
  );

  const materialPoliticaSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id ===
        formularioPolitica.material_id
    ) || null,
    [
      formularioPolitica.material_id,
      materiales
    ]
  );

  const stocksPorMaterial = useMemo(
    () => new Map(
      stocks.map(stock => [
        stock.material_id,
        stock
      ])
    ),
    [stocks]
  );

  const stocksFiltrados = useMemo(() => {
    const termino = normalizarTexto(busquedaStock);

    if (!termino) {
      return stocks;
    }

    return stocks.filter(stock =>
      normalizarTexto([
        stock.material_codigo,
        stock.material_nombre,
        stock.material_tipo,
        stock.material_id,
        stock.almacen_id
      ].filter(Boolean).join(" ")).includes(termino)
    );
  }, [busquedaStock, stocks]);

  const stockSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formulario.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0
    },
    [
      formulario.material_id,
      stocksPorMaterial
    ]
  );

  const stockTraspasoSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formularioTraspaso.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0
    },
    [
      formularioTraspaso.material_id,
      stocksPorMaterial
    ]
  );

  const stockConteoSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formularioConteo.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0
    },
    [
      formularioConteo.material_id,
      stocksPorMaterial
    ]
  );

  const stockPoliticaSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formularioPolitica.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0,
      stock_minimo: 0,
      punto_reposicion: 0,
      stock_objetivo: 0,
      lead_time_dias: 0
    },
    [
      formularioPolitica.material_id,
      stocksPorMaterial
    ]
  );

  const ordenSeleccionada = useMemo(
    () => ordenes.find(
      orden =>
        orden.codigo === formulario.ot_codigo
    ) || null,
    [formulario.ot_codigo, ordenes]
  );

  const disponibilidadOrden = useMemo(
    () => calcularDisponibilidadOT(
      operacionesOrden,
      stocks
    ),
    [operacionesOrden, stocks]
  );
  const movimientosRecientes = useMemo(
    () => movimientos.slice(0, 25),
    [movimientos]
  );
  const diferenciasRecientes = useMemo(
    () => movimientos.filter(
      movimiento =>
        movimiento.origen ===
        "ajuste_autorizado"
    ).slice(0, 10),
    [movimientos]
  );
  const conteosRecientes = useMemo(
    () => conteos.slice(0, 10),
    [conteos]
  );
  const referenciasMovimiento = useMemo(
    () => unirReferencias(
      referenciasFrecuentesMovimiento,
      movimientos.map(
        movimiento => movimiento.referencia
      ),
      conteos.map(conteo => conteo.referencia)
    ),
    [conteos, movimientos]
  );
  const referenciasConteo = useMemo(
    () => unirReferencias(
      referenciasFrecuentesConteo,
      conteos.map(conteo => conteo.referencia),
      movimientos
        .filter(
          movimiento =>
            movimiento.origen ===
            "ajuste_autorizado"
        )
        .map(movimiento => movimiento.referencia)
    ),
    [conteos, movimientos]
  );
  const referenciasTraspaso = useMemo(
    () => unirReferencias(
      referenciasFrecuentesTraspaso,
      traspasos.map(traspaso => traspaso.referencia),
      movimientos
        .filter(
          movimiento => movimiento.origen === "traspaso"
        )
        .map(movimiento => movimiento.referencia)
    ),
    [movimientos, traspasos]
  );
  const alertasStock = useMemo(
    () => calcularAlertasStock({
      materiales,
      stocks
    }),
    [materiales, stocks]
  );
  const alertasCriticas = useMemo(
    () => alertasStock.filter(alerta =>
      [
        "sin_stock",
        "bajo_minimo",
        "reponer"
      ].includes(alerta.estado)
    ),
    [alertasStock]
  );
  const alertasSinPolitica = useMemo(
    () => alertasStock.filter(
      alerta => alerta.estado === "sin_politica"
    ).length,
    [alertasStock]
  );
  const alertasPorMaterial = useMemo(
    () => new Map(
      alertasStock.map(alerta => [
        alerta.material_id,
        alerta
      ])
    ),
    [alertasStock]
  );
  const necesidadesOTs = useMemo(
    () => calcularNecesidadesMaterialesOTs({
      ordenes,
      operacionesPorOrden:
        operacionesOrdenesAbiertas,
      stocks
    }),
    [operacionesOrdenesAbiertas, ordenes, stocks]
  );
  const necesidadesConBrecha = useMemo(
    () => necesidadesOTs.filter(
      item => item.brecha > 0
    ),
    [necesidadesOTs]
  );
  const priorizacionOTs = useMemo(
    () => priorizarOrdenesPorMaterial({
      ordenes,
      operacionesPorOrden:
        operacionesOrdenesAbiertas,
      stocks
    }),
    [operacionesOrdenesAbiertas, ordenes, stocks]
  );
  const otsQueAvanzan = useMemo(
    () => priorizacionOTs.filter(
      item => item.estado === "puede_avanzar"
    ),
    [priorizacionOTs]
  );
  const otsBloqueadas = useMemo(
    () => priorizacionOTs.filter(
      item => item.estado === "bloqueada"
    ),
    [priorizacionOTs]
  );
  const solicitudesAbiertasPorMaterial = useMemo(
    () => new Set(
      solicitudesReposicion
        .filter(solicitud => [
          ESTADOS_SOLICITUD_REPOSICION.PENDIENTE,
          ESTADOS_SOLICITUD_REPOSICION.EN_REVISION,
          ESTADOS_SOLICITUD_REPOSICION.APROBADA
        ].includes(solicitud.estado))
        .map(solicitud => solicitud.material_id)
    ),
    [solicitudesReposicion]
  );
  const solicitudesRecientes = useMemo(
    () => solicitudesReposicion.slice(0, 10),
    [solicitudesReposicion]
  );
  const esAjusteAutorizadoSeleccionado =
    esMovimientoAjusteAutorizado(
      formulario.tipo
    );
  const movimientosManuales = useMemo(
    () => MOVIMIENTOS_ALMACEN.filter(
      movimiento => ![
        TIPOS_MOVIMIENTO_ALMACEN.TRASPASO_SALIDA,
        TIPOS_MOVIMIENTO_ALMACEN
          .TRASPASO_RECEPCION
      ].includes(movimiento.tipo)
    ),
    []
  );
  const traspasosEnTransito = useMemo(
    () => traspasos.filter(
      traspaso =>
        traspaso.estado ===
        ESTADOS_TRASPASO_ALMACEN.EN_TRANSITO
    ),
    [traspasos]
  );
  const stockEnTransitoEntrada = useMemo(
    () => traspasosEnTransito
      .filter(
        traspaso =>
          traspaso.planta_destino_id ===
          plantaId
      )
      .reduce(
        (total, traspaso) =>
          total + Number(traspaso.cantidad || 0),
        0
      ),
    [plantaId, traspasosEnTransito]
  );
  const movimientosTrazabilidad = useMemo(
    () => movimientos.filter(
      movimiento =>
        movimiento.ot_codigo ===
        otTrazabilidad
    ),
    [movimientos, otTrazabilidad]
  );
  const cuadraturaOT = useMemo(
    () => calcularCuadraturaAlmacenOT({
      operaciones: operacionesTrazabilidad,
      stocks,
      movimientos: movimientosTrazabilidad
    }),
    [
      movimientosTrazabilidad,
      operacionesTrazabilidad,
      stocks
    ]
  );
  const resumenTrazabilidad =
    cuadraturaOT.resumen_movimientos;
  const cuadraturaTrazabilidad =
    cuadraturaOT.items;

  const movimientoVista = useMemo(
    () => prepararMovimientoAlmacen({
      empresaId: perfil.empresa_id,
      plantaId,
      material: materialSeleccionado,
      tipo: formulario.tipo,
      cantidad: formulario.cantidad,
      otCodigo: formulario.ot_codigo,
      referencia: formulario.referencia,
      observacion: formulario.observacion,
      usuario: perfil
    }),
    [
      formulario,
      materialSeleccionado,
      perfil,
      plantaId
    ]
  );

  const erroresFormulario = useMemo(
    () => validarMovimientoAlmacen(
      movimientoVista,
      stockSeleccionado
    ),
    [movimientoVista, stockSeleccionado]
  );

  const traspasoVista = useMemo(
    () => prepararTraspasoAlmacen({
      empresaId: perfil.empresa_id,
      plantaOrigenId: plantaId,
      plantaDestinoId:
        formularioTraspaso.planta_destino_id,
      material: materialTraspasoSeleccionado,
      cantidad: formularioTraspaso.cantidad,
      referencia: formularioTraspaso.referencia,
      observacion: formularioTraspaso.observacion,
      usuario: perfil
    }),
    [
      formularioTraspaso,
      materialTraspasoSeleccionado,
      perfil,
      plantaId
    ]
  );

  const conteoVista = useMemo(
    () => prepararConteoFisico({
      empresaId: perfil.empresa_id,
      plantaId,
      material: materialConteoSeleccionado,
      stockSistema:
        stockConteoSeleccionado.stock_actual,
      stockReservado:
        stockConteoSeleccionado.stock_reservado,
      cantidadContada:
        formularioConteo.cantidad_contada,
      referencia: formularioConteo.referencia,
      observacion: formularioConteo.observacion,
      usuario: perfil
    }),
    [
      formularioConteo,
      materialConteoSeleccionado,
      perfil,
      plantaId,
      stockConteoSeleccionado
    ]
  );

  const erroresConteo = useMemo(
    () => validarConteoFisico(conteoVista),
    [conteoVista]
  );

  const erroresTraspaso = useMemo(
    () => validarTraspasoSalida(
      traspasoVista,
      stockTraspasoSeleccionado
    ),
    [stockTraspasoSeleccionado, traspasoVista]
  );

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        materialesData,
        stocksData,
        movimientosData,
        ordenesData,
        traspasosData,
        conteosData,
        solicitudesData
      ] = await Promise.all([
        listarMateriales(
          db,
          perfil.empresa_id
        ),
        listarStockMateriales(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarMovimientosAlmacen(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarOrdenesV2(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarTraspasosAlmacen(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarConteosFisicos(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarSolicitudesReposicion(
          db,
          perfil.empresa_id,
          plantaId
        )
      ]);
      setMateriales(
        materialesData.filter(
          material => material.activo !== false
        )
      );
      setStocks(stocksData);
      setMovimientos(movimientosData);
      setTraspasos(traspasosData);
      setConteos(conteosData);
      setSolicitudesReposicion(solicitudesData);
      const ordenesAbiertas =
        ordenesData.filter(
          orden =>
            ![
              "cerrada",
              "completada"
            ].includes(orden.estado)
        );
      setOrdenes(ordenesAbiertas);
      const operacionesAbiertas =
        await Promise.all(
          ordenesAbiertas.slice(0, 30).map(
            async orden => ({
              orden_id: orden.id,
              orden,
              operaciones:
                await listarOperacionesOT(
                  db,
                  perfil.empresa_id,
                  plantaId,
                  orden.id
                )
            })
          )
        );
      setOperacionesOrdenesAbiertas(
        operacionesAbiertas
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar almacén."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id, plantaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const cargarOperacionesOrden = async () => {
      if (
        !ordenSeleccionada ||
        !movimientoRequiereOT(formulario.tipo)
      ) {
        setOperacionesOrden([]);
        return;
      }

      try {
        const operaciones =
          await listarOperacionesOT(
            db,
            perfil.empresa_id,
            plantaId,
            ordenSeleccionada.id
          );

        setOperacionesOrden(operaciones);
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar los materiales requeridos de la OT."
        );
        setOperacionesOrden([]);
      }
    };

    cargarOperacionesOrden();
  }, [
    db,
    formulario.ot_codigo,
    formulario.tipo,
    ordenSeleccionada,
    perfil.empresa_id,
    plantaId
  ]);

  useEffect(() => {
    const cargarOperacionesTrazabilidad =
      async () => {
        const orden = ordenes.find(
          item =>
            item.codigo === otTrazabilidad
        );

        if (!orden) {
          setOperacionesTrazabilidad([]);
          return;
        }

        try {
          const operaciones =
            await listarOperacionesOT(
              db,
              perfil.empresa_id,
              plantaId,
              orden.id
            );

          setOperacionesTrazabilidad(
            operaciones
          );
        } catch (fallo) {
          setError(
            fallo?.message ||
            "No se pudo cargar la trazabilidad de la OT."
          );
          setOperacionesTrazabilidad([]);
        }
      };

    cargarOperacionesTrazabilidad();
  }, [
    db,
    ordenes,
    otTrazabilidad,
    perfil.empresa_id,
    plantaId
  ]);

  const actualizar = (campoNombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarTraspaso = (
    campoNombre,
    valor
  ) => {
    setFormularioTraspaso(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarConteo = (
    campoNombre,
    valor
  ) => {
    setFormularioConteo(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarPolitica = (
    campoNombre,
    valor
  ) => {
    setFormularioPolitica(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarMaterialPolitica =
    materialId => {
      const stock =
        stocksPorMaterial.get(materialId) || {};
      setFormularioPolitica({
        material_id: materialId,
        stock_minimo: stock.stock_minimo
          ? String(stock.stock_minimo)
          : "",
        punto_reposicion:
          stock.punto_reposicion
            ? String(stock.punto_reposicion)
            : "",
        stock_objetivo: stock.stock_objetivo
          ? String(stock.stock_objetivo)
          : "",
        lead_time_dias: stock.lead_time_dias
          ? String(stock.lead_time_dias)
          : ""
      });
      setError("");
      setMensaje("");
    };

  const usarRequerimiento = requerimiento => {
    setFormulario(actual => ({
      ...actual,
      material_id:
        requerimiento.material_id,
      cantidad: String(
        requerimiento.cantidad_requerida
      )
    }));
    setMensaje(
      `Material ${requerimiento.material_codigo} seleccionado desde la OT.`
    );
    setError("");
  };

  const guardar = async evento => {
    evento.preventDefault();

    if (erroresFormulario.length > 0) {
      setError(erroresFormulario.join(" "));
      return;
    }

    try {
      setGuardando(true);
      setError("");
      await registrarMovimientoAlmacen({
        db,
        perfil,
        plantaId,
        material: materialSeleccionado,
        tipo: formulario.tipo,
        cantidad: formulario.cantidad,
        otCodigo: formulario.ot_codigo,
        referencia: formulario.referencia,
        observacion: formulario.observacion
      });
      setFormulario(estadoInicial);
      setMensaje(
        "Movimiento registrado y stock actualizado."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar el movimiento."
      );
    } finally {
      setGuardando(false);
    }
  };

  const guardarTraspaso = async evento => {
    evento.preventDefault();

    if (erroresTraspaso.length > 0) {
      setError(erroresTraspaso.join(" "));
      return;
    }

    try {
      setGuardandoTraspaso(true);
      setError("");
      await registrarTraspasoSalida({
        db,
        perfil,
        plantaOrigenId: plantaId,
        plantaDestinoId:
          formularioTraspaso.planta_destino_id,
        material: materialTraspasoSeleccionado,
        cantidad: formularioTraspaso.cantidad,
        referencia: formularioTraspaso.referencia,
        observacion: formularioTraspaso.observacion
      });
      setFormularioTraspaso(traspasoInicial);
      setMensaje(
        "Salida de traspaso interno registrada. El stock quedó en tránsito hasta confirmar recepción."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar el traspaso interno."
      );
    } finally {
      setGuardandoTraspaso(false);
    }
  };

  const guardarConteo = async evento => {
    evento.preventDefault();

    if (erroresConteo.length > 0) {
      setError(erroresConteo.join(" "));
      return;
    }

    try {
      setGuardandoConteo(true);
      setError("");
      await registrarConteoFisico({
        db,
        perfil,
        plantaId,
        material: materialConteoSeleccionado,
        cantidadContada:
          formularioConteo.cantidad_contada,
        referencia: formularioConteo.referencia,
        observacion: formularioConteo.observacion
      });
      setFormularioConteo(conteoInicial);
      setMensaje(
        conteoVista.diferencia === 0
          ? "Conteo físico registrado sin diferencias."
          : "Conteo físico registrado y ajuste autorizado aplicado."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar el conteo físico."
      );
    } finally {
      setGuardandoConteo(false);
    }
  };

  const guardarPolitica = async evento => {
    evento.preventDefault();

    try {
      setGuardandoPolitica(true);
      setError("");
      await actualizarPoliticaStock({
        db,
        perfil,
        plantaId,
        material: materialPoliticaSeleccionado,
        stockMinimo:
          formularioPolitica.stock_minimo,
        puntoReposicion:
          formularioPolitica.punto_reposicion,
        stockObjetivo:
          formularioPolitica.stock_objetivo,
        leadTimeDias:
          formularioPolitica.lead_time_dias
      });
      setMensaje(
        "Política de stock actualizada. Las alertas se recalcularon con los nuevos niveles."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo actualizar la política de stock."
      );
    } finally {
      setGuardandoPolitica(false);
    }
  };

  const generarSolicitudReposicion =
    async item => {
      try {
        setGuardandoSolicitudId(item.material_id);
        setError("");
        await registrarSolicitudReposicion({
          db,
          perfil,
          plantaId,
          material: {
            id: item.material_id,
            codigo: item.material_codigo,
            nombre: item.material_nombre,
            tipo: item.material_tipo,
            unidad_medida: item.unidad_medida
          },
          cantidadSugerida: item.brecha,
          prioridad: "alta",
          tipoSugerido:
            TIPOS_SOLICITUD_REPOSICION.COMPRA,
          origen: "brecha_ot",
          otsAfectadas: item.ots,
          stockDisponible:
            item.stock_disponible,
          cantidadRequerida:
            item.cantidad_requerida,
          brecha: item.brecha,
          observacion:
            "Solicitud generada desde cobertura de OTs abiertas."
        });
        setMensaje(
          "Solicitud de compra o reposición creada desde la brecha de material."
        );
        await cargar();
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudo generar la solicitud de reposición."
        );
      } finally {
        setGuardandoSolicitudId("");
      }
    };

  const resolverSolicitud = async (
    solicitud,
    nuevoEstado
  ) => {
    const observacion = window.prompt(
      "Observación para resolver la solicitud"
    );

    if (observacion === null) {
      return;
    }

    try {
      setResolviendoSolicitudId(solicitud.id);
      setError("");
      await resolverSolicitudReposicion({
        db,
        perfil,
        solicitud,
        nuevoEstado,
        observacion
      });
      setMensaje(
        "Solicitud de reposición actualizada."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo resolver la solicitud."
      );
    } finally {
      setResolviendoSolicitudId("");
    }
  };

  const recibirTraspaso = async traspaso => {
    try {
      setRecibiendoTraspasoId(traspaso.id);
      setError("");
      await registrarTraspasoRecepcion({
        db,
        perfil,
        traspaso
      });
      setMensaje(
        "Recepción de traspaso interno confirmada y stock actualizado en el almacén destino."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo confirmar la recepción."
      );
    } finally {
      setRecibiendoTraspasoId("");
    }
  };

  return (
    <div
      className="almacen-v2"
      style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: esPantallaPequena ? 12 : 24,
      fontFamily: "Arial",
      overflowX: "hidden"
    }}>
      <style>
        {`
          .almacen-v2,
          .almacen-v2 * {
            box-sizing: border-box;
          }

          .almacen-v2 select,
          .almacen-v2 input,
          .almacen-v2 textarea {
            max-width: 100%;
          }

          @media (max-width: 760px) {
            .almacen-v2 h1 {
              font-size: 30px;
              line-height: 1.1;
            }

            .almacen-v2 h2 {
              font-size: 21px;
              line-height: 1.18;
            }

            .almacen-v2 article > div:first-child {
              flex-wrap: wrap;
              align-items: flex-start !important;
            }

            .almacen-v2 article strong,
            .almacen-v2 td,
            .almacen-v2 th {
              overflow-wrap: anywhere;
            }

            .almacen-v2 button {
              min-height: 44px;
            }

            .almacen-v2 article button {
              width: 100%;
            }
          }
        `}
      </style>
      <div style={{
        maxWidth: 1200,
        width: "100%",
        minWidth: 0,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver a Ingeniería
        </BotonVolver>

        <h1 style={{ marginBottom: 4 }}>
          Almacén
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Control inicial de stock MP/RF por
          planta, reservas para OT y movimientos
          trazables.
        </p>

        <div style={{
          marginBottom: 18,
          maxWidth: esPantallaPequena
            ? "100%"
            : 260
        }}>
          <label>
            Planta
            <select
              value={plantaId}
              onChange={evento => {
                setPlantaId(evento.target.value);
                setFormulario(estadoInicial);
                setFormularioTraspaso(traspasoInicial);
                setFormularioConteo(conteoInicial);
                setFormularioPolitica(politicaInicial);
                setOtTrazabilidad("");
              }}
              style={{
                ...campo,
                marginTop: 6
              }}
            >
              {plantas.map(planta => (
                <option
                  key={planta}
                  value={planta}
                >
                  {planta.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section style={{
          background: "white",
          padding: esPantallaPequena ? 16 : 22,
          borderRadius: 14,
          boxShadow:
            "0 2px 10px rgba(15,23,42,0.08)",
          marginBottom: esPantallaPequena ? 14 : 22
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: esPantallaPequena
              ? "stretch"
              : "center",
            flexDirection: esPantallaPequena
              ? "column"
              : "row"
          }}>
            <div>
              <h2 style={{ margin: 0 }}>
                Existencias actuales
              </h2>
              <p style={{
                color: "#64748B",
                margin: "6px 0 0"
              }}>
                Stock visible por material para la planta{" "}
                {plantaId.toUpperCase()}. Usa el buscador
                para encontrar rápido MP, SUM, RF o EPP.
              </p>
            </div>
            <div style={{
              minWidth: esPantallaPequena
                ? "100%"
                : 280
            }}>
              <input
                type="search"
                value={busquedaStock}
                onChange={evento =>
                  setBusquedaStock(evento.target.value)
                }
                placeholder="Buscar alambre, tubo, MP..."
                style={{
                  ...campo,
                  background: "#F8FAFC"
                }}
              />
            </div>
          </div>

          {cargando ? (
            <p>Cargando existencias...</p>
          ) : stocks.length === 0 ? (
            <p style={{
              color: "#64748B",
              marginBottom: 0
            }}>
              Todavía no hay stock registrado para esta
              planta. Si ya hiciste conteo físico, revisa
              que estés viendo la planta correcta.
            </p>
          ) : stocksFiltrados.length === 0 ? (
            <p style={{
              color: "#64748B",
              marginBottom: 0
            }}>
              No hay existencias relacionadas con esa
              búsqueda.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: esPantallaPequena
                ? "minmax(0, 1fr)"
                : "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 10,
              marginTop: 16,
              maxHeight: esPantallaPequena ? 420 : 360,
              overflowY: "auto",
              paddingRight: 4
            }}>
              {stocksFiltrados.map(stock => {
                const alerta =
                  alertasPorMaterial.get(
                    stock.material_id
                  );
                const alertaCritica =
                  alerta &&
                  [
                    "sin_stock",
                    "bajo_minimo"
                  ].includes(alerta.estado);

                return (
                  <article
                    key={stock.id || stock.material_id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: 12,
                      background: alertaCritica
                        ? "#FEF2F2"
                        : "#F8FAFC"
                    }}
                  >
                    <strong>
                      {stock.material_codigo || "Sin código"}
                    </strong>
                    <div style={{
                      color: "#475569",
                      fontSize: 13,
                      marginTop: 3
                    }}>
                      {stock.material_nombre ||
                        "Sin nombre"}
                    </div>
                    <div style={{
                      color: "#64748B",
                      fontSize: 12,
                      marginTop: 4
                    }}>
                      Tipo: {stock.material_tipo || "-"}
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: 8,
                      marginTop: 10,
                      textAlign: "center"
                    }}>
                      <div>
                        <strong>
                          {formatearNumero(
                            stock.stock_actual
                          )}
                        </strong>
                        <div style={{
                          color: "#64748B",
                          fontSize: 12
                        }}>
                          Stock
                        </div>
                      </div>
                      <div>
                        <strong>
                          {formatearNumero(
                            stock.stock_reservado
                          )}
                        </strong>
                        <div style={{
                          color: "#64748B",
                          fontSize: 12
                        }}>
                          Reservado
                        </div>
                      </div>
                      <div>
                        <strong>
                          {formatearNumero(
                            stock.stock_disponible
                          )}
                        </strong>
                        <div style={{
                          color: "#64748B",
                          fontSize: 12
                        }}>
                          Disponible
                        </div>
                      </div>
                    </div>

                    {alerta && (
                      <div style={{
                        marginTop: 10,
                        color: alerta.estado === "ok"
                          ? "#166534"
                          : alertaCritica
                            ? "#991B1B"
                            : "#92400E",
                        fontWeight: "bold",
                        fontSize: 13
                      }}>
                        {alerta.estado === "ok"
                          ? "OK"
                          : alerta.estado ===
                            "sin_politica"
                            ? "Sin política de stock"
                            : alerta.estado === "sin_stock"
                              ? "Sin stock"
                              : alerta.estado ===
                                "bajo_minimo"
                                ? "Bajo mínimo"
                                : "Reponer"}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            esPantallaPequena
              ? "minmax(0, 1fr)"
              : "minmax(320px, 0.95fr) minmax(360px, 1.3fr)",
          gap: esPantallaPequena ? 14 : 22,
          alignItems: "start"
        }}>
          <div style={{
            display: "grid",
            gap: esPantallaPequena ? 14 : 18,
            minWidth: 0
          }}>
          <form
            onSubmit={guardar}
            style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Registrar movimiento
            </h2>

            <label>
              Material
              <SelectorMaterial
                materiales={materiales}
                materialId={formulario.material_id}
                onChange={valor =>
                  actualizar("material_id", valor)
                }
              />
            </label>

            <label>
              Tipo de movimiento
              <select
                value={formulario.tipo}
                onChange={evento => {
                  const nuevoTipo =
                    evento.target.value;
                  actualizar(
                    "tipo",
                    nuevoTipo
                  );

                  if (
                    !movimientoRequiereOT(
                      nuevoTipo
                    )
                  ) {
                    setFormulario(actual => ({
                      ...actual,
                      tipo: nuevoTipo,
                      ot_codigo: ""
                    }));
                  }
                }}
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                {movimientosManuales.map(
                  movimiento => (
                    <option
                      key={movimiento.tipo}
                      value={movimiento.tipo}
                    >
                      {movimiento.nombre}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Cantidad
              <input
                type="number"
                min="0"
                step="0.01"
                value={formulario.cantidad}
                onChange={evento =>
                  actualizar(
                    "cantidad",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {esAjusteAutorizadoSeleccionado && (
              <section style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#7F1D1D"
              }}>
                <strong>
                  Movimiento autorizado
                </strong>
                <div style={{
                  fontSize: 13,
                  marginTop: 4
                }}>
                  Este registro ajusta el stock físico.
                  Debe indicar el motivo real: merma,
                  daño, conteo físico, diferencia de
                  recepción u otra causa verificable.
                </div>
              </section>
            )}

            {movimientoRequiereOT(
              formulario.tipo
            ) ? (
              <label>
                OT asociada
                <select
                  value={formulario.ot_codigo}
                  onChange={evento =>
                    actualizar(
                      "ot_codigo",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                >
                  <option value="">
                    Seleccionar OT
                  </option>
                  {ordenes.map(orden => (
                    <option
                      key={orden.id}
                      value={orden.codigo}
                    >
                      {orden.codigo}
                      {" - "}
                      {orden.producto_nombre}
                      {" ("}
                      {orden.estado}
                      {")"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                OT asociada
                <input
                  value={formulario.ot_codigo}
                  disabled
                  placeholder="No aplica a este movimiento"
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14,
                    background: "#F8FAFC",
                    color: "#94A3B8"
                  }}
                />
              </label>
            )}

            {movimientoRequiereOT(
              formulario.tipo
            ) && formulario.ot_codigo && (
              <section style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14
              }}>
                <strong>
                  Materiales sugeridos por OT
                </strong>
                {disponibilidadOrden.length === 0 ? (
                  <p style={{
                    color: "#64748B",
                    marginBottom: 0
                  }}>
                    No hay materiales de entrada en
                    las operaciones pendientes de esta
                    OT.
                  </p>
                ) : (
                  <div style={{
                    display: "grid",
                    gap: 10,
                    marginTop: 10
                  }}>
                    {disponibilidadOrden.map(
                      item => (
                        <article
                          key={
                            item.material_id
                          }
                          style={{
                            border:
                              "1px solid #CBD5E1",
                            borderRadius: 9,
                            padding: 10,
                            background: "white"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                            alignItems: "center"
                          }}>
                            <div style={{
                              fontWeight: "bold"
                            }}>
                              {
                                item
                                  .material_codigo
                              }
                              {" - "}
                              {
                                item
                                  .material_nombre
                              }
                            </div>
                            <span style={{
                              padding:
                                "3px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: "bold",
                              color:
                                item.material_tipo ===
                                "RF"
                                  ? "#0369A1"
                                  : "#166534",
                              background:
                                item.material_tipo ===
                                "RF"
                                  ? "#E0F2FE"
                                  : "#DCFCE7"
                            }}>
                              {item.material_tipo}
                            </span>
                          </div>
                          <div style={{
                            color: "#334155",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Requerido:{" "}
                            {formatearNumero(
                              item
                                .cantidad_requerida
                            )}
                            {item.material_tipo ===
                            "RF" ? (
                              <>
                                {" · RF disponible ahora: "}
                                {formatearNumero(
                                  item.disponible_flujo
                                )}
                                {" · Producido OK: "}
                                {formatearNumero(
                                  item.producido_ok
                                )}
                                {" · Pendiente origen: "}
                                {formatearNumero(
                                  item.producido_pendiente
                                )}
                              </>
                            ) : (
                              <>
                                {" · Stock disponible: "}
                                {formatearNumero(
                                  item.stock_disponible
                                )}
                                {" · Brecha: "}
                                <span style={{
                                  color:
                                    item.brecha > 0
                                      ? "#B91C1C"
                                      : "#166534",
                                  fontWeight: "bold"
                                }}>
                                  {formatearNumero(
                                    item.brecha
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                          <div style={{
                            marginTop: 6,
                            color:
                              item.estado ===
                              "falta_mp"
                                ? "#B91C1C"
                                : item.estado ===
                                  "rf_sin_fuente"
                                  ? "#B45309"
                                  : "#166534",
                            fontSize: 13,
                            fontWeight: "bold"
                          }}>
                            {item.recomendacion}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              usarRequerimiento(
                                item
                              )
                            }
                            style={{
                              marginTop: 8,
                              padding: "8px 10px",
                              border: "none",
                              borderRadius: 8,
                              background: "#0F766E",
                              color: "white",
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                          >
                            Usar material y cantidad
                          </button>
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>
            )}

            <label>
              Referencia
              <SelectorReferencia
                value={formulario.referencia}
                onChange={valor =>
                  actualizar(
                    "referencia",
                    valor
                  )
                }
                opciones={referenciasMovimiento}
                placeholder="OC, guía, ajuste, conteo..."
              />
            </label>

            <label>
              Observación
              <textarea
                value={formulario.observacion}
                onChange={evento =>
                  actualizar(
                    "observacion",
                    evento.target.value
                  )
                }
                rows={3}
                placeholder={
                  esAjusteAutorizadoSeleccionado
                    ? "Motivo obligatorio del ajuste o merma"
                    : ""
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {materialSeleccionado && (
              <div style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#334155"
              }}>
                <strong>Saldo actual</strong>
                <div>
                  Stock:{" "}
                  {formatearNumero(
                    stockSeleccionado.stock_actual
                  )}
                  {" · Reservado: "}
                  {formatearNumero(
                    stockSeleccionado.stock_reservado
                  )}
                  {" · Disponible: "}
                  {formatearNumero(
                    calcularStockDisponible(
                      stockSeleccionado
                    )
                  )}
                </div>
              </div>
            )}

            {error && (
              <div role="alert" style={{
                color: "#B91C1C",
                background: "#FEF2F2",
                padding: 10,
                borderRadius: 8,
                marginBottom: 12
              }}>
                {error}
              </div>
            )}

            {mensaje && (
              <div style={{
                color: "#166534",
                background: "#F0FDF4",
                padding: 10,
                borderRadius: 8,
                marginBottom: 12
              }}>
                {mensaje}
              </div>
            )}

            <button
              type="submit"
              disabled={guardando || cargando}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#0369A1",
                color: "white",
                fontWeight: "bold",
                cursor: guardando
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardando
                ? "Registrando..."
                : esAjusteAutorizadoSeleccionado
                  ? "Registrar ajuste autorizado"
                  : "Registrar movimiento"}
            </button>
          </form>

          <form
            onSubmit={guardarConteo}
            style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)",
              border: "1px solid #FED7AA"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Conteo físico
            </h2>
            <p style={{
              color: "#475569",
              marginTop: -4,
              fontSize: 14
            }}>
              Compara el stock del sistema contra lo
              contado físicamente. Si hay diferencia,
              se genera un ajuste autorizado.
            </p>

            <label>
              Material
              <SelectorMaterial
                materiales={materiales}
                materialId={
                  formularioConteo.material_id
                }
                onChange={valor =>
                  actualizarConteo(
                    "material_id",
                    valor
                  )
                }
              />
            </label>

            <label>
              Cantidad contada
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  formularioConteo.cantidad_contada
                }
                onChange={evento =>
                  actualizarConteo(
                    "cantidad_contada",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {materialConteoSeleccionado && (
              <div style={{
                background:
                  conteoVista.diferencia === 0
                    ? "#F0FDF4"
                    : "#FFFBEB",
                border:
                  conteoVista.diferencia === 0
                    ? "1px solid #BBF7D0"
                    : "1px solid #FDE68A",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color:
                  conteoVista.diferencia === 0
                    ? "#166534"
                    : "#92400E"
              }}>
                <strong>Comparación</strong>
                <div>
                  Sistema:{" "}
                  {formatearNumero(
                    conteoVista.stock_sistema
                  )}
                  {" · Reservado: "}
                  {formatearNumero(
                    conteoVista.stock_reservado
                  )}
                  {" · Contado: "}
                  {formatearNumero(
                    conteoVista.stock_contado
                  )}
                  {" · Diferencia: "}
                  <strong>
                    {formatearNumero(
                      conteoVista.diferencia
                    )}
                  </strong>
                </div>
              </div>
            )}

            <label>
              Referencia
              <SelectorReferencia
                value={formularioConteo.referencia}
                onChange={valor =>
                  actualizarConteo(
                    "referencia",
                    valor
                  )
                }
                opciones={referenciasConteo}
                placeholder="Inventario cíclico, auditoría, conteo..."
              />
            </label>

            <label>
              Observación
              <textarea
                value={formularioConteo.observacion}
                onChange={evento =>
                  actualizarConteo(
                    "observacion",
                    evento.target.value
                  )
                }
                rows={3}
                placeholder={
                  conteoVista.diferencia !== 0
                    ? "Motivo obligatorio de la diferencia"
                    : "Opcional si el conteo cuadra"
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <button
              type="submit"
              disabled={guardandoConteo || cargando}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#C2410C",
                color: "white",
                fontWeight: "bold",
                cursor: guardandoConteo
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardandoConteo
                ? "Registrando conteo..."
                : conteoVista.diferencia === 0
                  ? "Registrar conteo"
                  : "Registrar conteo y ajustar stock"}
            </button>
          </form>

          <form
            onSubmit={guardarPolitica}
            style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)",
              border: "1px solid #BBF7D0"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Política de stock
            </h2>
            <p style={{
              color: "#475569",
              marginTop: -4,
              fontSize: 14
            }}>
              Define mínimos y punto de reposición por
              planta para activar alertas preventivas.
            </p>

            <label>
              Material
              <SelectorMaterial
                materiales={materiales}
                materialId={
                  formularioPolitica.material_id
                }
                onChange={
                  seleccionarMaterialPolitica
                }
              />
            </label>

            <div style={{
              display: "grid",
              gridTemplateColumns:
                esPantallaPequena
                  ? "minmax(0, 1fr)"
                  : "repeat(2, minmax(0, 1fr))",
              gap: 10
            }}>
              <label>
                Stock mínimo
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formularioPolitica.stock_minimo
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "stock_minimo",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Punto reposición
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formularioPolitica
                      .punto_reposicion
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "punto_reposicion",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Stock objetivo
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formularioPolitica.stock_objetivo
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "stock_objetivo",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Días reposición
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    formularioPolitica.lead_time_dias
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "lead_time_dias",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>
            </div>

            {materialPoliticaSeleccionado && (
              <div style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#166534"
              }}>
                <strong>Saldo actual</strong>
                <div>
                  Stock:{" "}
                  {formatearNumero(
                    stockPoliticaSeleccionado
                      .stock_actual
                  )}
                  {" · Disponible: "}
                  {formatearNumero(
                    calcularStockDisponible(
                      stockPoliticaSeleccionado
                    )
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                guardandoPolitica || cargando
              }
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#15803D",
                color: "white",
                fontWeight: "bold",
                cursor: guardandoPolitica
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardandoPolitica
                ? "Guardando política..."
                : "Guardar política de stock"}
            </button>
          </form>

          <form
            onSubmit={guardarTraspaso}
            style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)",
              border: "1px solid #BFDBFE"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Traspaso interno entre almacenes
            </h2>
            <p style={{
              color: "#475569",
              marginTop: -4,
              fontSize: 14
            }}>
              Solo aplica entre almacenes de la misma
              empresa. Entre empresas hermanas del
              grupo corresponde venta/compra, no
              traspaso.
            </p>

            <label>
              Almacén origen
              <input
                value={plantaId.toUpperCase()}
                disabled
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14,
                  background: "#F8FAFC"
                }}
              />
            </label>

            <label>
              Almacén destino
              <select
                value={
                  formularioTraspaso.planta_destino_id
                }
                onChange={evento =>
                  actualizarTraspaso(
                    "planta_destino_id",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Seleccionar almacén destino
                </option>
                {plantas
                  .filter(planta => planta !== plantaId)
                  .map(planta => (
                    <option
                      key={planta}
                      value={planta}
                    >
                      {planta.toUpperCase()}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Material
              <SelectorMaterial
                materiales={materiales}
                materialId={
                  formularioTraspaso.material_id
                }
                onChange={valor =>
                  actualizarTraspaso(
                    "material_id",
                    valor
                  )
                }
              />
            </label>

            <label>
              Cantidad a mover internamente
              <input
                type="number"
                min="0"
                step="0.01"
                value={formularioTraspaso.cantidad}
                onChange={evento =>
                  actualizarTraspaso(
                    "cantidad",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {materialTraspasoSeleccionado && (
              <div style={{
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#1E3A8A"
              }}>
                <strong>Saldo en origen</strong>
                <div>
                  Stock:{" "}
                  {formatearNumero(
                    stockTraspasoSeleccionado
                      .stock_actual
                  )}
                  {" · Reservado: "}
                  {formatearNumero(
                    stockTraspasoSeleccionado
                      .stock_reservado
                  )}
                  {" · Disponible: "}
                  {formatearNumero(
                    calcularStockDisponible(
                      stockTraspasoSeleccionado
                    )
                  )}
                </div>
              </div>
            )}

            <label>
              Referencia
              <SelectorReferencia
                value={
                  formularioTraspaso.referencia
                }
                onChange={valor =>
                  actualizarTraspaso(
                    "referencia",
                    valor
                  )
                }
                opciones={referenciasTraspaso}
                placeholder="Guía interna, solicitud, traslado interno..."
              />
            </label>

            <label>
              Observación
              <textarea
                value={
                  formularioTraspaso.observacion
                }
                onChange={evento =>
                  actualizarTraspaso(
                    "observacion",
                    evento.target.value
                  )
                }
                rows={3}
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <button
              type="submit"
              disabled={
                guardandoTraspaso || cargando
              }
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#1D4ED8",
                color: "white",
                fontWeight: "bold",
                cursor: guardandoTraspaso
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardandoTraspaso
                ? "Registrando traspaso interno..."
                : "Registrar salida de traspaso interno"}
            </button>
          </form>
          </div>

          <div style={{
            display: "grid",
            gap: esPantallaPequena ? 14 : 18,
            minWidth: 0
          }}>
            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Alertas de stock y reposición
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>Alertas activas</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#B91C1C",
                    marginTop: 4
                  }}>
                    {alertasCriticas.length}
                  </div>
                </div>
                <div style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>Sin política</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#475569",
                    marginTop: 4
                  }}>
                    {alertasSinPolitica}
                  </div>
                </div>
              </div>

              {alertasCriticas.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay materiales bajo mínimo o en
                  punto de reposición para esta planta.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {alertasCriticas
                    .slice(0, 12)
                    .map(alerta => {
                      const critica = [
                        "sin_stock",
                        "bajo_minimo"
                      ].includes(alerta.estado);

                      return (
                        <article
                          key={alerta.material_id}
                          style={{
                            border: critica
                              ? "1px solid #FECACA"
                              : "1px solid #FDE68A",
                            borderRadius: 10,
                            padding: 12,
                            background: critica
                              ? "#FEF2F2"
                              : "#FFFBEB"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                            alignItems: "center"
                          }}>
                            <strong>
                              {alerta.material_codigo}
                              {" - "}
                              {alerta.material_nombre}
                            </strong>
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: "bold",
                              color: critica
                                ? "#991B1B"
                                : "#92400E",
                              background: critica
                                ? "#FEE2E2"
                                : "#FEF3C7"
                            }}>
                              {alerta.estado ===
                              "sin_stock"
                                ? "Sin stock"
                                : alerta.estado ===
                                  "bajo_minimo"
                                  ? "Bajo mínimo"
                                  : "Reponer"}
                            </span>
                          </div>
                          <div style={{
                            color: "#334155",
                            marginTop: 4
                          }}>
                            Disponible:{" "}
                            {formatearNumero(
                              alerta.stock_disponible
                            )}
                            {" · Mínimo: "}
                            {formatearNumero(
                              alerta.stock_minimo
                            )}
                            {" · Reposición: "}
                            {formatearNumero(
                              alerta.punto_reposicion
                            )}
                            {" · Sugerido: "}
                            <strong>
                              {formatearNumero(
                                alerta.cantidad_sugerida
                              )}
                            </strong>
                          </div>
                          <div style={{
                            color: "#64748B",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Lead time:{" "}
                            {formatearNumero(
                              alerta.lead_time_dias
                            )}
                            {" días · "}
                            {alerta.recomendacion}
                          </div>
                        </article>
                      );
                    })}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Priorización de OTs por material
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>Pueden avanzar</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#166534",
                    marginTop: 4
                  }}>
                    {otsQueAvanzan.length}
                  </div>
                </div>
                <div style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>Bloqueadas</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#B91C1C",
                    marginTop: 4
                  }}>
                    {otsBloqueadas.length}
                  </div>
                </div>
              </div>

              {priorizacionOTs.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay OTs abiertas con materiales
                  para priorizar.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {priorizacionOTs
                    .slice(0, 12)
                    .map(item => {
                      const puede =
                        item.estado ===
                        "puede_avanzar";
                      const parcial =
                        item.estado ===
                        "avance_parcial";

                      return (
                        <article
                          key={item.ot_id}
                          style={{
                            border: puede
                              ? "1px solid #BBF7D0"
                              : parcial
                                ? "1px solid #FDE68A"
                                : "1px solid #FECACA",
                            borderRadius: 10,
                            padding: 12,
                            background: puede
                              ? "#F0FDF4"
                              : parcial
                                ? "#FFFBEB"
                                : "#FEF2F2"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                            alignItems: "center"
                          }}>
                            <strong>
                              #{item.prioridad_sugerida}
                              {" · "}
                              {item.ot_codigo || "-"}
                              {item.producto_nombre
                                ? ` - ${item.producto_nombre}`
                                : ""}
                            </strong>
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: "bold",
                              color: puede
                                ? "#166534"
                                : parcial
                                  ? "#92400E"
                                  : "#991B1B",
                              background: puede
                                ? "#DCFCE7"
                                : parcial
                                  ? "#FEF3C7"
                                  : "#FEE2E2"
                            }}>
                              {puede
                                ? "Puede avanzar"
                                : parcial
                                  ? "Parcial"
                                  : "Bloqueada"}
                            </span>
                          </div>
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Materiales requeridos:{" "}
                            {
                              item.materiales_requeridos
                                .length
                            }
                            {" · Faltantes: "}
                            {
                              item.materiales_faltantes
                                .length
                            }
                          </div>
                          {item.materiales_faltantes
                            .length > 0 && (
                            <div style={{
                              color: "#7F1D1D",
                              fontSize: 13,
                              marginTop: 4
                            }}>
                              Falta:{" "}
                              {item.materiales_faltantes
                                .slice(0, 3)
                                .map(material =>
                                  `${material.material_codigo} (${formatearNumero(material.faltante)})`
                                )
                                .join(", ")}
                              {item.materiales_faltantes
                                .length > 3
                                ? ` y ${item.materiales_faltantes.length - 3} más`
                                : ""}
                            </div>
                          )}
                          <div style={{
                            color: "#334155",
                            fontSize: 13,
                            marginTop: 4,
                            fontWeight: "bold"
                          }}>
                            {item.recomendacion}
                          </div>
                        </article>
                      );
                    })}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Cobertura de OTs abiertas
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>
                    Materiales con brecha
                  </strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#B91C1C",
                    marginTop: 4
                  }}>
                    {necesidadesConBrecha.length}
                  </div>
                </div>
                <div style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>OTs revisadas</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#334155",
                    marginTop: 4
                  }}>
                    {
                      operacionesOrdenesAbiertas
                        .length
                    }
                  </div>
                </div>
              </div>

              {necesidadesOTs.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay materiales requeridos en las
                  OTs abiertas revisadas.
                </p>
              ) : necesidadesConBrecha.length === 0 ? (
                <p style={{ color: "#166534" }}>
                  El stock disponible cubre los
                  materiales revisados de las OTs
                  abiertas.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {necesidadesConBrecha
                    .slice(0, 12)
                    .map(item => (
                      <article
                        key={item.material_id}
                        style={{
                          border:
                            "1px solid #FECACA",
                          borderRadius: 10,
                          padding: 12,
                          background: "#FEF2F2"
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 8,
                          alignItems: "center"
                        }}>
                          <strong>
                            {item.material_codigo}
                            {" - "}
                            {item.material_nombre}
                          </strong>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: "bold",
                            color: "#991B1B",
                            background: "#FEE2E2"
                          }}>
                            No alcanza
                          </span>
                        </div>
                        <div style={{
                          color: "#334155",
                          marginTop: 4
                        }}>
                          Requerido OTs:{" "}
                          {formatearNumero(
                            item.cantidad_requerida
                          )}
                          {" · Disponible: "}
                          {formatearNumero(
                            item.stock_disponible
                          )}
                          {" · Brecha: "}
                          <strong>
                            {formatearNumero(
                              item.brecha
                            )}
                          </strong>
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          OTs afectadas:{" "}
                          {item.ots
                            .slice(0, 4)
                            .map(ot =>
                              ot.ot_codigo ||
                              ot.operacion_codigo
                            )
                            .join(", ")}
                          {item.ots.length > 4
                            ? ` y ${item.ots.length - 4} más`
                            : ""}
                        </div>
                        <div style={{
                          color: "#7F1D1D",
                          fontSize: 13,
                          marginTop: 4,
                          fontWeight: "bold"
                        }}>
                          {item.recomendacion}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            generarSolicitudReposicion(
                              item
                            )
                          }
                          disabled={
                            guardandoSolicitudId ===
                              item.material_id ||
                            solicitudesAbiertasPorMaterial
                              .has(item.material_id)
                          }
                          style={{
                            marginTop: 10,
                            padding: "9px 12px",
                            border: "none",
                            borderRadius: 8,
                            background:
                              solicitudesAbiertasPorMaterial
                                .has(item.material_id)
                                ? "#94A3B8"
                                : "#B91C1C",
                            color: "white",
                            fontWeight: "bold",
                            cursor:
                              guardandoSolicitudId ===
                              item.material_id
                                ? "wait"
                                : "pointer"
                          }}
                        >
                          {guardandoSolicitudId ===
                          item.material_id
                            ? "Generando solicitud..."
                            : solicitudesAbiertasPorMaterial
                              .has(item.material_id)
                              ? "Solicitud abierta"
                              : "Generar solicitud"}
                        </button>
                      </article>
                    ))}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Solicitudes de reposición
              </h2>

              {solicitudesRecientes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Aún no hay solicitudes generadas
                  desde brechas de material.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {solicitudesRecientes.map(
                    solicitud => (
                      <article
                        key={solicitud.id}
                        style={{
                          border:
                            "1px solid #E2E8F0",
                          borderRadius: 10,
                          padding: 12,
                          background: "#F8FAFC"
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 8,
                          alignItems: "center"
                        }}>
                          <strong>
                            {
                              solicitud.material_codigo
                            }
                            {" - "}
                            {
                              solicitud.material_nombre
                            }
                          </strong>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: "bold",
                            color: "#1D4ED8",
                            background: "#DBEAFE"
                          }}>
                            {solicitud.estado}
                          </span>
                        </div>
                        <div style={{
                          color: "#334155",
                          marginTop: 4
                        }}>
                          Tipo sugerido:{" "}
                          {solicitud.tipo_sugerido ===
                          TIPOS_SOLICITUD_REPOSICION
                            .REPOSICION_INTERNA
                            ? "Reposición interna"
                            : "Compra"}
                          {" · Cantidad: "}
                          {formatearNumero(
                            solicitud.cantidad_sugerida
                          )}
                          {" · Brecha: "}
                          {formatearNumero(
                            solicitud.brecha
                          )}
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          {formatearFecha(
                            solicitud.solicitado_en
                          )}
                          {" · Solicitó: "}
                          {solicitud
                            .solicitado_por_nombre ||
                            "-"}
                          {" · OTs: "}
                          {
                            (
                              solicitud.ots_afectadas ||
                              []
                            ).length
                          }
                        </div>
                        {solicitud.observacion_resolucion && (
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Resolución:{" "}
                            {
                              solicitud
                                .observacion_resolucion
                            }
                            {solicitud.resuelto_por_nombre
                              ? ` · ${solicitud.resuelto_por_nombre}`
                              : ""}
                          </div>
                        )}
                        {![
                          ESTADOS_SOLICITUD_REPOSICION
                            .CERRADA,
                          ESTADOS_SOLICITUD_REPOSICION
                            .ANULADA
                        ].includes(solicitud.estado) && (
                          <div style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 10
                          }}>
                            {solicitud.estado ===
                              ESTADOS_SOLICITUD_REPOSICION
                                .PENDIENTE && (
                              <button
                                type="button"
                                onClick={() =>
                                  resolverSolicitud(
                                    solicitud,
                                    ESTADOS_SOLICITUD_REPOSICION
                                      .EN_REVISION
                                  )
                                }
                                disabled={
                                  resolviendoSolicitudId ===
                                  solicitud.id
                                }
                                style={{
                                  padding: "8px 10px",
                                  border: "none",
                                  borderRadius: 8,
                                  background: "#0369A1",
                                  color: "white",
                                  fontWeight: "bold",
                                  cursor: "pointer"
                                }}
                              >
                                Revisar
                              </button>
                            )}
                            {[
                              ESTADOS_SOLICITUD_REPOSICION
                                .PENDIENTE,
                              ESTADOS_SOLICITUD_REPOSICION
                                .EN_REVISION
                            ].includes(
                              solicitud.estado
                            ) && (
                              <button
                                type="button"
                                onClick={() =>
                                  resolverSolicitud(
                                    solicitud,
                                    ESTADOS_SOLICITUD_REPOSICION
                                      .APROBADA
                                  )
                                }
                                disabled={
                                  resolviendoSolicitudId ===
                                  solicitud.id
                                }
                                style={{
                                  padding: "8px 10px",
                                  border: "none",
                                  borderRadius: 8,
                                  background: "#15803D",
                                  color: "white",
                                  fontWeight: "bold",
                                  cursor: "pointer"
                                }}
                              >
                                Aprobar
                              </button>
                            )}
                            {solicitud.estado ===
                              ESTADOS_SOLICITUD_REPOSICION
                                .APROBADA && (
                              <button
                                type="button"
                                onClick={() =>
                                  resolverSolicitud(
                                    solicitud,
                                    ESTADOS_SOLICITUD_REPOSICION
                                      .CERRADA
                                  )
                                }
                                disabled={
                                  resolviendoSolicitudId ===
                                  solicitud.id
                                }
                                style={{
                                  padding: "8px 10px",
                                  border: "none",
                                  borderRadius: 8,
                                  background: "#0F766E",
                                  color: "white",
                                  fontWeight: "bold",
                                  cursor: "pointer"
                                }}
                              >
                                Marcar atendida
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                resolverSolicitud(
                                  solicitud,
                                  ESTADOS_SOLICITUD_REPOSICION
                                    .ANULADA
                                )
                              }
                              disabled={
                                resolviendoSolicitudId ===
                                solicitud.id
                              }
                              style={{
                                padding: "8px 10px",
                                border: "none",
                                borderRadius: 8,
                                background: "#B91C1C",
                                color: "white",
                                fontWeight: "bold",
                                cursor: "pointer"
                              }}
                            >
                              Anular
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  )}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Traspasos internos y stock en tránsito
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>
                    En tránsito hacia esta planta
                  </strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#1D4ED8",
                    marginTop: 4
                  }}>
                    {formatearNumero(
                      stockEnTransitoEntrada
                    )}
                  </div>
                </div>
                <div style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>
                    Traspasos abiertos
                  </strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#334155",
                    marginTop: 4
                  }}>
                    {traspasosEnTransito.length}
                  </div>
                </div>
              </div>

              {traspasos.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Aún no hay traspasos relacionados con
                  este almacén.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {traspasos.slice(0, 12).map(
                    traspaso => {
                      const esDestino =
                        traspaso.planta_destino_id ===
                        plantaId;
                      const pendiente =
                        traspaso.estado ===
                        ESTADOS_TRASPASO_ALMACEN
                          .EN_TRANSITO;

                      return (
                        <article
                          key={traspaso.id}
                          style={{
                            border:
                              "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: 12,
                            background: pendiente
                              ? "#FFFBEB"
                              : "#F0FDF4"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                            alignItems: "center"
                          }}>
                            <strong>
                              {
                                traspaso
                                  .material_codigo
                              }
                              {" - "}
                              {
                                traspaso
                                  .material_nombre
                              }
                            </strong>
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: "bold",
                              color: pendiente
                                ? "#92400E"
                                : "#166534",
                              background: pendiente
                                ? "#FEF3C7"
                                : "#DCFCE7"
                            }}>
                              {pendiente
                                ? "En tránsito"
                                : "Recibido"}
                            </span>
                          </div>
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 5
                          }}>
                            {traspaso
                              .planta_origen_id
                              .toUpperCase()}
                            {" → "}
                            {traspaso
                              .planta_destino_id
                              .toUpperCase()}
                            {" · Cantidad "}
                            {formatearNumero(
                              traspaso.cantidad
                            )}
                            {" · Creado "}
                            {formatearFecha(
                              traspaso.creado_en
                            )}
                          </div>
                          <div style={{
                            color: "#64748B",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            {traspaso.referencia
                              ? `Referencia: ${traspaso.referencia}`
                              : "Sin referencia"}
                            {" · Usuario: "}
                            {traspaso.creado_por_nombre ||
                              "-"}
                          </div>
                          {pendiente && esDestino && (
                            <button
                              type="button"
                              onClick={() =>
                                recibirTraspaso(
                                  traspaso
                                )
                              }
                              disabled={
                                recibiendoTraspasoId ===
                                traspaso.id
                              }
                              style={{
                                marginTop: 10,
                                padding: "9px 12px",
                                border: "none",
                                borderRadius: 8,
                                background: "#166534",
                                color: "white",
                                fontWeight: "bold",
                                cursor:
                                  recibiendoTraspasoId ===
                                  traspaso.id
                                    ? "wait"
                                    : "pointer"
                              }}
                            >
                              {recibiendoTraspasoId ===
                              traspaso.id
                                ? "Recepcionando..."
                                : "Confirmar recepción"}
                            </button>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Conteos físicos recientes
              </h2>

              {conteosRecientes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Todavía no hay conteos físicos para
                  esta planta.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {conteosRecientes.map(conteo => {
                    const cuadrado =
                      Number(conteo.diferencia || 0) ===
                      0;

                    return (
                      <article
                        key={conteo.id}
                        style={{
                          border: cuadrado
                            ? "1px solid #BBF7D0"
                            : "1px solid #FDE68A",
                          borderRadius: 10,
                          padding: 12,
                          background: cuadrado
                            ? "#F0FDF4"
                            : "#FFFBEB"
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 8,
                          alignItems: "center"
                        }}>
                          <strong>
                            {conteo.material_codigo}
                            {" - "}
                            {conteo.material_nombre}
                          </strong>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: "bold",
                            color: cuadrado
                              ? "#166534"
                              : "#92400E",
                            background: cuadrado
                              ? "#DCFCE7"
                              : "#FEF3C7"
                          }}>
                            {cuadrado
                              ? "Cuadrado"
                              : "Ajustado"}
                          </span>
                        </div>
                        <div style={{
                          color: "#334155",
                          marginTop: 4
                        }}>
                          Sistema:{" "}
                          {formatearNumero(
                            conteo.stock_sistema
                          )}
                          {" · Contado: "}
                          {formatearNumero(
                            conteo.stock_contado
                          )}
                          {" · Diferencia: "}
                          <strong>
                            {formatearNumero(
                              conteo.diferencia
                            )}
                          </strong>
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          {formatearFecha(
                            conteo.contado_en
                          )}
                          {" · Contó: "}
                          {conteo.contado_por_nombre ||
                            "-"}
                          {conteo.movimiento_ajuste_id
                            ? " · Ajuste generado"
                            : ""}
                        </div>
                        {conteo.observacion && (
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Motivo:{" "}
                            {conteo.observacion}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Mermas y ajustes recientes
              </h2>

              {diferenciasRecientes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Sin mermas ni ajustes autorizados
                  registrados para esta planta.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {diferenciasRecientes.map(
                    movimiento => (
                      <article
                        key={movimiento.id}
                        style={{
                          border:
                            "1px solid #FECACA",
                          borderRadius: 10,
                          padding: 12,
                          background: "#FEF2F2"
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 8,
                          alignItems: "center"
                        }}>
                          <strong>
                            {movimiento.tipo_nombre}
                            {" · "}
                            {movimiento.material_codigo}
                          </strong>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: "bold",
                            color: "#991B1B",
                            background: "#FEE2E2"
                          }}>
                            Autorizado
                          </span>
                        </div>
                        <div style={{
                          color: "#334155",
                          marginTop: 4
                        }}>
                          Cantidad:{" "}
                          {formatearNumero(
                            movimiento.cantidad
                          )}
                          {" · Stock: "}
                          {formatearNumero(
                            movimiento.stock_anterior
                          )}
                          {" → "}
                          {formatearNumero(
                            movimiento.stock_nuevo
                          )}
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          {formatearFecha(
                            movimiento.fecha
                          )}
                          {" · Autorizó: "}
                          {movimiento
                            .autorizado_por_nombre ||
                            movimiento.usuario_nombre ||
                            "-"}
                        </div>
                        <div style={{
                          color: "#7F1D1D",
                          fontSize: 13,
                          marginTop: 4,
                          fontWeight: "bold"
                        }}>
                          Motivo:{" "}
                          {movimiento.observacion ||
                            "-"}
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Stock por material
              </h2>

              {cargando ? (
                <p>Cargando stock...</p>
              ) : stocks.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Todavía no hay stock registrado
                  para esta planta.
                </p>
              ) : (
                <div style={{
                  overflowX: "auto"
                }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse"
                  }}>
                    <thead>
                      <tr style={{
                        textAlign: "left",
                        color: "#475569"
                      }}>
                        <th>Material</th>
                        <th>Tipo</th>
                        <th>Stock</th>
                        <th>Reservado</th>
                        <th>Disponible</th>
                        <th>Reposición</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map(stock => {
                        const alerta =
                          alertasPorMaterial.get(
                            stock.material_id
                          );
                        const critica =
                          alerta &&
                          [
                            "sin_stock",
                            "bajo_minimo"
                          ].includes(alerta.estado);

                        return (
                        <tr key={stock.id}>
                          <td style={{
                            padding: "10px 6px",
                            borderTop:
                              "1px solid #E2E8F0"
                          }}>
                            <strong>
                              {stock.material_codigo}
                            </strong>
                            <div style={{
                              color: "#64748B",
                              fontSize: 13
                            }}>
                              {stock.material_nombre}
                            </div>
                          </td>
                          <td>{stock.material_tipo}</td>
                          <td>
                            {formatearNumero(
                              stock.stock_actual
                            )}
                          </td>
                          <td>
                            {formatearNumero(
                              stock.stock_reservado
                            )}
                          </td>
                          <td>
                            {formatearNumero(
                              stock.stock_disponible
                            )}
                          </td>
                          <td>
                            {alerta ? (
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: "bold",
                                color:
                                  alerta.estado ===
                                  "ok"
                                    ? "#166534"
                                    : critica
                                      ? "#991B1B"
                                      : "#92400E",
                                background:
                                  alerta.estado ===
                                  "ok"
                                    ? "#DCFCE7"
                                    : critica
                                      ? "#FEE2E2"
                                      : "#FEF3C7"
                              }}>
                                {alerta.estado === "ok"
                                  ? "OK"
                                  : alerta.estado ===
                                    "sin_politica"
                                    ? "Sin política"
                                    : alerta.estado ===
                                      "sin_stock"
                                      ? "Sin stock"
                                      : alerta.estado ===
                                        "bajo_minimo"
                                        ? "Bajo mínimo"
                                        : "Reponer"}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Trazabilidad por OT
              </h2>

              <label>
                OT
                <select
                  value={otTrazabilidad}
                  onChange={evento =>
                    setOtTrazabilidad(
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                >
                  <option value="">
                    Seleccionar OT
                  </option>
                  {ordenes.map(orden => (
                    <option
                      key={orden.id}
                      value={orden.codigo}
                    >
                      {orden.codigo}
                      {" - "}
                      {orden.producto_nombre}
                    </option>
                  ))}
                </select>
              </label>

              {!otTrazabilidad ? (
                <p style={{ color: "#64748B" }}>
                  Selecciona una OT para revisar
                  reservas, consumos y RF producidos.
                </p>
              ) : (
                <>
                  <div style={{
                    border: "1px solid #CBD5E1",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                    background:
                      cuadraturaOT.estado_general ===
                      "bloqueada_por_mp"
                        ? "#FEF2F2"
                        : cuadraturaOT.estado_general ===
                          "rf_en_flujo"
                          ? "#FFFBEB"
                          : cuadraturaOT.estado_general ===
                            "cuadrada"
                            ? "#F0FDF4"
                            : "#F8FAFC"
                  }}>
                    <strong>
                      {cuadraturaOT.estado_general ===
                      "bloqueada_por_mp"
                        ? "OT con riesgo por falta de MP"
                        : cuadraturaOT.estado_general ===
                          "rf_en_flujo"
                          ? "OT con RF en flujo"
                          : cuadraturaOT.estado_general ===
                            "cuadrada"
                            ? "OT cuadrada en almacén"
                            : "OT sin materiales configurados"}
                    </strong>
                    <div style={{
                      color: "#475569",
                      fontSize: 13,
                      marginTop: 5
                    }}>
                      MP pendientes:{" "}
                      {
                        cuadraturaOT.totales
                          .mp_pendientes
                      }
                      {"/"}
                      {cuadraturaOT.totales.mp_total}
                      {" · RF pendientes: "}
                      {
                        cuadraturaOT.totales
                          .rf_pendientes
                      }
                      {"/"}
                      {cuadraturaOT.totales.rf_total}
                      {" · Unidades pendientes: "}
                      {formatearNumero(
                        cuadraturaOT.totales
                          .unidades_pendientes
                      )}
                    </div>
                    <div style={{
                      color: "#334155",
                      fontSize: 13,
                      marginTop: 5
                    }}>
                      {cuadraturaOT.recomendacion}
                    </div>
                  </div>

                  <h3 style={{ marginTop: 0 }}>
                    Estado de cuadratura
                  </h3>

                  {cuadraturaTrazabilidad.length === 0 ? (
                    <p style={{ color: "#64748B" }}>
                      Esta OT no tiene materiales de
                      entrada asociados a sus operaciones.
                    </p>
                  ) : (
                    <div style={{
                      display: "grid",
                      gap: 9,
                      marginBottom: 16
                    }}>
                      {cuadraturaTrazabilidad.map(
                        item => (
                          <div
                            key={item.material_id}
                            style={{
                              border:
                                "1px solid #E2E8F0",
                              borderRadius: 10,
                              padding: 10,
                              background:
                                item.estado_cuadratura
                                  .includes("pendiente")
                                  ? "#FFFBEB"
                                  : "#F0FDF4"
                            }}
                          >
                            <div style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: 8,
                              alignItems: "center"
                            }}>
                              <strong>
                                {item.material_codigo}
                                {" - "}
                                {item.material_nombre}
                              </strong>
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: "bold",
                                color:
                                  item.material_tipo ===
                                  "RF"
                                    ? "#0369A1"
                                    : "#166534",
                                background:
                                  item.material_tipo ===
                                  "RF"
                                    ? "#E0F2FE"
                                    : "#DCFCE7"
                              }}>
                                {item.material_tipo}
                              </span>
                            </div>
                            <div style={{
                              color: "#475569",
                              fontSize: 13,
                              marginTop: 4
                            }}>
                              Requerido:{" "}
                              {formatearNumero(
                                item.cantidad_requerida
                              )}
                              {item.material_tipo ===
                              "MP" ? (
                                <>
                                  {" · Reservado neto: "}
                                  {formatearNumero(
                                    item.reservado_neto
                                  )}
                                  {" · Consumido: "}
                                  {formatearNumero(
                                    item.consumido
                                  )}
                                  {" · Pendiente: "}
                                  {formatearNumero(
                                    item.faltante
                                  )}
                                </>
                              ) : (
                                <>
                                  {" · Producido: "}
                                  {formatearNumero(
                                    item.producido
                                  )}
                                  {" · RF disponible ahora: "}
                                  {formatearNumero(
                                    item.disponible_flujo
                                  )}
                                  {" · Pendiente: "}
                                  {formatearNumero(
                                    item.faltante
                                  )}
                                </>
                              )}
                            </div>
                            <div style={{
                              marginTop: 4,
                              fontSize: 13,
                              fontWeight: "bold",
                              color:
                                item.faltante > 0
                                  ? "#B45309"
                                  : "#166534"
                            }}>
                              {item.faltante > 0
                                ? item.material_tipo ===
                                  "MP"
                                  ? "Pendiente de reservar o consumir MP."
                                  : "RF en flujo o pendiente de producción."
                                : "Cuadrado para esta OT."}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {movimientosTrazabilidad.length === 0 ? (
                    <p style={{ color: "#64748B" }}>
                      Esta OT aún no tiene movimientos de
                      almacén registrados.
                    </p>
                  ) : (
                    <>
                  <div style={{
                    display: "grid",
                    gap: 9,
                    marginBottom: 14
                  }}>
                    {Object.values(
                      resumenTrazabilidad
                    ).map(item => (
                      <div
                        key={item.material_codigo}
                        style={{
                          border:
                            "1px solid #E2E8F0",
                          borderRadius: 10,
                          padding: 10,
                          background: "#F8FAFC"
                        }}
                      >
                        <strong>
                          {item.material_codigo}
                          {" - "}
                          {item.material_nombre}
                        </strong>
                        <div style={{
                          color: "#475569",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          Reservado:{" "}
                          {formatearNumero(
                            item.reservado
                          )}
                          {" · Liberado: "}
                          {formatearNumero(
                            item.liberado
                          )}
                          {" · Consumido: "}
                          {formatearNumero(
                            item.consumido
                          )}
                          {" · Producido: "}
                          {formatearNumero(
                            item.producido
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                    </>
                  )}

                  <div style={{
                    display: "grid",
                    gap: 8
                  }}>
                    {movimientosTrazabilidad.map(
                      movimiento => (
                        <article
                          key={movimiento.id}
                          style={{
                            border:
                              "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: 10
                          }}
                        >
                          <strong>
                            {
                              movimiento.tipo_nombre
                            }
                            {" · "}
                            {
                              movimiento
                                .material_codigo
                            }
                          </strong>
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            {formatearFecha(
                              movimiento.fecha
                            )}
                            {" · Cantidad "}
                            {formatearNumero(
                              movimiento.cantidad
                            )}
                            {" · "}
                            {movimiento.origen ===
                            "produccion"
                              ? "Producción"
                              : etiquetaOrigenMovimiento(
                                movimiento.origen
                              )}
                          </div>
                          {movimiento.operacion_codigo && (
                            <div style={{
                              color: "#64748B",
                              fontSize: 13,
                              marginTop: 3
                            }}>
                              Operación:{" "}
                              {
                                movimiento
                                  .operacion_codigo
                              }
                              {movimiento
                                .operacion_nombre
                                ? ` · ${movimiento.operacion_nombre}`
                                : ""}
                            </div>
                          )}
                        </article>
                      )
                    )}
                  </div>
                </>
              )}
            </section>

            <section style={{
              background: "white",
              padding: esPantallaPequena ? 16 : 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Últimos movimientos
              </h2>

              {movimientosRecientes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Sin movimientos registrados.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {movimientosRecientes.map(movimiento => (
                    <article
                      key={movimiento.id}
                      style={{
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 12
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 8,
                        alignItems: "center"
                      }}>
                        <strong>
                          {movimiento.tipo_nombre}
                          {" · "}
                          {movimiento.material_codigo}
                        </strong>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: "bold",
                          ...estiloOrigenMovimiento(
                            movimiento.origen
                          )
                        }}>
                          {etiquetaOrigenMovimiento(
                            movimiento.origen
                          )}
                        </span>
                      </div>
                      <div style={{
                        color: "#334155",
                        marginTop: 4
                      }}>
                        Cantidad:{" "}
                        {formatearNumero(
                          movimiento.cantidad
                        )}
                        {" · Stock: "}
                        {formatearNumero(
                          movimiento.stock_anterior
                        )}
                        {" → "}
                        {formatearNumero(
                          movimiento.stock_nuevo
                        )}
                        {" · Disponible: "}
                        {formatearNumero(
                          movimiento
                            .stock_disponible_nuevo
                        )}
                      </div>
                      <div style={{
                        color: "#64748B",
                        fontSize: 13,
                        marginTop: 4
                      }}>
                        {formatearFecha(
                          movimiento.fecha
                        )}
                        {movimiento.ot_codigo
                          ? ` · ${movimiento.ot_codigo}`
                          : ""}
                        {movimiento.referencia
                          ? ` · ${movimiento.referencia}`
                          : ""}
                      </div>
                      {movimiento.origen ===
                        "produccion" && (
                        <div style={{
                          color: "#475569",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          Operación:{" "}
                          {movimiento.operacion_codigo ||
                            "-"}
                          {movimiento.operacion_nombre
                            ? ` · ${movimiento.operacion_nombre}`
                            : ""}
                          {movimiento.sesion_id
                            ? ` · Sesión ${movimiento.sesion_id}`
                            : ""}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlmacenV2;
