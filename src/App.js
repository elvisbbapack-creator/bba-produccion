import {
  useState,
  useEffect,
  useCallback
} from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import {
  convertirFecha,
  fechaParaInput,
  formatearFecha,
  normalizarDocumento,
  normalizarEstandar,
  normalizarOrdenTrabajo
} from "./data/compatibilidad";
import {
  autenticacionFirebaseActiva
} from "./auth/config";
import {
  interfazV2Activa,
  puedeAdministrarV2,
  puedeGestionarCosteoV2,
  puedeGestionarRRHHV2,
  puedeGestionarUsuariosV2,
  puedeOperarV2,
  puedeVerDashboardV2
} from "./features/v2/config";
import CatalogoMaterialesV2 from
  "./features/materiales/CatalogoMaterialesV2";
import ProgramacionTurnosV2 from
  "./features/turnos/ProgramacionTurnosV2";
import CapacidadProcesosV2 from
  "./features/capacidad/CapacidadProcesosV2";
import ConstructorRutasV2 from
  "./features/productos/ConstructorRutasV2";
import OrdenesTrabajoV2 from
  "./features/ordenes/OrdenesTrabajoV2";
import EjecucionProduccionV2 from
  "./features/ejecucion/EjecucionProduccionV2";
import GestionEstandaresV2 from
  "./features/estandares/GestionEstandaresV2";
import DashboardV2 from
  "./features/resumenes/DashboardV2";
import CalidadV2 from
  "./features/calidad/CalidadV2";
import ParosV2 from
  "./features/paros/ParosV2";
import PlanificadorPrioridadesV2 from
  "./features/planificacion/PlanificadorPrioridadesV2";
import HistorialDecisionesPlanificadorV2 from
  "./features/planificacion/HistorialDecisionesPlanificadorV2";
import AlmacenV2 from
  "./features/almacen/AlmacenV2";
import CatalogoDetallesV2 from
  "./features/detalles/CatalogoDetallesV2";
import CatalogoPiezasV2 from
  "./features/piezas/CatalogoPiezasV2";
import CatalogoProcesosEstacionesV2 from
  "./features/procesos/CatalogoProcesosEstacionesV2";
import CatalogoSubproductosV2 from
  "./features/subproductos/CatalogoSubproductosV2";
import ImportadorIngenieriaV2 from
  "./features/importacion/ImportadorIngenieriaV2";
import GestionUsuariosV2 from
  "./features/usuarios/GestionUsuariosV2";
import GestionPersonasRRHHV2 from
  "./features/rrhh/GestionPersonasRRHHV2";
import CotizadorTecnicoV2 from
  "./features/costeo/CotizadorTecnicoV2";
import TercerosV2 from
  "./features/terceros/TercerosV2";
import CostosBaseProduccionV2 from
  "./features/costosBase/CostosBaseProduccionV2";
import CostosOperativosFijosV2 from
  "./features/costosOperativos/CostosOperativosFijosV2";

function App() {
  const esMobile =
    window.innerWidth < 768;
  /* eslint-disable no-unused-vars */
  const normalizar = (txt) =>
  (txt || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const fechaDesdeValor = valor => {
    if (!valor) return null;
    if (valor.toDate) return valor.toDate();
    if (valor.seconds) {
      return new Date(valor.seconds * 1000);
    }
    if (valor instanceof Date) return valor;
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime())
      ? null
      : fecha;
  };
  const fechaParaDatetimeLocal = valor => {
    const fecha = fechaDesdeValor(valor);

    if (!fecha) return "";

    const offsetMs =
      fecha.getTimezoneOffset() * 60000;

    return new Date(fecha.getTime() - offsetMs)
      .toISOString()
      .slice(0, 16);
  };
  const fechaDesdeDatetimeLocal = valor => {
    if (!valor) return null;
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime())
      ? null
      : fecha;
  };
  const fechaParaInputLocal = fecha => {
    const fechaValida =
      fecha instanceof Date
        ? fecha
        : new Date(fecha);

    if (Number.isNaN(fechaValida.getTime())) {
      return "";
    }

    const offsetMs =
      fechaValida.getTimezoneOffset() * 60000;

    return new Date(
      fechaValida.getTime() - offsetMs
    ).toISOString().slice(0, 10);
  };
  const calcularEstadoEficiencia = eficiencia => {
    if (eficiencia < 70) return "🔴";
    if (eficiencia < 90) return "🟡";
    return "🟢";
  };
  const obtenerUnidadesHora = estandar =>
    Number(
      estandar?.unidades_por_hora ??
      estandar?.unidades_hora ??
      0
    );
  const normalizarListaHabilidades = valor => {
    const base = Array.isArray(valor)
      ? valor
      : (valor || "")
          .toString()
          .split(/[,;\n]/);

    return [
      ...new Set(
        base
          .map(item =>
            item.toString().trim()
          )
          .filter(Boolean)
      )
    ];
  };
  const textoHabilidades = valor =>
    normalizarListaHabilidades(valor)
      .join(", ");
  const registroFueAjustado = (
    registroId
  ) => {
    return ajustesProduccion.some(
      a =>
        a.produccion_id
        ===
        registroId
    );
  };

  const esTV =
    window.innerWidth >= 1200 &&
    window.innerHeight >= 700;

  const escalaTV = esTV ? 0.75 : 1;

  const [registros, setRegistros] = useState([]);
  const [pantalla, setPantalla] = useState("login");
  const [cantidad, setCantidad] = useState("");
  const [modoTV, setModoTV] = useState(false);

  const [ots, setOts] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [operarioSeleccionado, setOperarioSeleccionado] = useState("");
  const [nuevoOperarioNombre, setNuevoOperarioNombre] =
    useState("");
  const [nuevoOperarioEquipo, setNuevoOperarioEquipo] =
    useState("");
  const [nuevoOperarioActivo, setNuevoOperarioActivo] =
    useState(true);
  const [
    nuevoOperarioHabilidades,
    setNuevoOperarioHabilidades
  ] = useState("");
  const [
    filtroEquipoOperarios,
    setFiltroEquipoOperarios
  ] = useState("");
  const [
    filtroHabilidadOperarios,
    setFiltroHabilidadOperarios
  ] = useState("");
  const [
    filtroActivoOperarios,
    setFiltroActivoOperarios
  ] = useState("activos");
  const [
    edicionesOperarios,
    setEdicionesOperarios
  ] = useState({});

  const [otSeleccionada, setOtSeleccionada] = useState("");
  const [procesoSeleccionado, setProcesoSeleccionado] = useState("");
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [autenticacionLista, setAutenticacionLista] =
    useState(!autenticacionFirebaseActiva);
  const [emailAcceso, setEmailAcceso] = useState("");
  const [passwordAcceso, setPasswordAcceso] = useState("");
  const [errorAcceso, setErrorAcceso] = useState("");
  const [mensajeAcceso, setMensajeAcceso] = useState("");
  const [ingresando, setIngresando] = useState(false);
  const [mostrarPasswordAcceso, setMostrarPasswordAcceso] = useState(false);
  const [enviandoReset, setEnviandoReset] =
    useState(false);
  const [contextoCapacidadV2,
    setContextoCapacidadV2] = useState(null);
  const [contextoTurnosV2,
    setContextoTurnosV2] = useState(null);
  const [retornoPlanificadorV2,
    setRetornoPlanificadorV2] = useState(null);
  const [contextoEjecucionV2,
    setContextoEjecucionV2] = useState(null);
  const sesionCargaId =
    autenticacionFirebaseActiva
      ? usuarioSeleccionado?.id || ""
      : "legacy";

  const [subprocesos, setSubprocesos] = useState([]);
  const [subprocesoSeleccionado, setSubprocesoSeleccionado] = useState("");
  const [detalleSeleccionado, setDetalleSeleccionado] = useState("");

  const [produccionActiva, setProduccionActiva] = useState([]);
  const [procesoAbierto, setProcesoAbierto] = useState(null);

  const [estandares, setEstandares] = useState([]);
  const [dashboard, setDashboard] = useState([]);
  const [
    registrosEvolucionOperario,
    setRegistrosEvolucionOperario
  ] = useState([]);
  const [
    operarioEvolucionSeleccionado,
    setOperarioEvolucionSeleccionado
  ] = useState("");
  const [
    cargandoEvolucionOperario,
    setCargandoEvolucionOperario
  ] = useState(false);

  const [clienteOT, setClienteOT] = useState("");
  const [productoOT, setProductoOT] = useState("");
  const [fechaInicioOT, setFechaInicioOT] = useState("");
  const [fechaEntregaOT, setFechaEntregaOT] = useState("");
  const [estadoOT, setEstadoOT] = useState("activa");

  const [modoEditarOT, setModoEditarOT] = useState(false);
  const [editarCantidadOT, setEditarCantidadOT] = useState("");
  const [editarFechaEntregaOT, setEditarFechaEntregaOT] = useState("");
  const [editarEstadoOT, setEditarEstadoOT] = useState("activa");

  const [nuevoProceso, setNuevoProceso] = useState("");
  const [procesosConfig, setProcesosConfig] = useState([]);

  const [procesoSeleccionadoConfig, setProcesoSeleccionadoConfig] = useState("");
  const [nuevoSubproceso, setNuevoSubproceso] = useState("");

  const [subprocesoSeleccionadoConfig, setSubprocesoSeleccionadoConfig] = useState("");
  const [nuevoDetalle, setNuevoDetalle] = useState("");
  const [materialDetalle, setMaterialDetalle] = useState("");
  const [medidaDetalle, setMedidaDetalle] = useState("");
  const [objetivoDetalle, setObjetivoDetalle] = useState("");

  const [productosConfig, setProductosConfig] = useState([]);

  const [operacionesMaestras,
  setOperacionesMaestras] =
  useState([]);

  const [codigoOperacion,
  setCodigoOperacion] =
  useState("");

  const [nombreOperacion,
    setNombreOperacion] =
    useState("");

  const [procesoOperacion,
    setProcesoOperacion] =
    useState("");

  const [subprocesoOperacion,
    setSubprocesoOperacion] =
    useState("");

  const [nuevoProducto, setNuevoProducto] =useState("");

  const [productoSeleccionadoOperacion,
  setProductoSeleccionadoOperacion] =
  useState("");

const [operacionSeleccionadaProducto,
  setOperacionSeleccionadaProducto] =
  useState("");

const [materialOperacionProducto,
  setMaterialOperacionProducto] =
  useState("");

const [medidaOperacionProducto,
  setMedidaOperacionProducto] =
  useState("");

const [cantidadOperacionProducto,
  setCantidadOperacionProducto] =
  useState("");

const [unidadesHoraOperacionProducto,
  setUnidadesHoraOperacionProducto] =
  useState("");

  const [paroActivo, setParoActivo] = useState(false);
  const [paroActivoProduccion, setParoActivoProduccion] = useState(null);
  const [motivoParo, setMotivoParo] = useState("");

  const [responsableAjuste, setResponsableAjuste] = useState("");

  const [registroAjuste, setRegistroAjuste] = useState(null);
  const [fechaAjusteGerencial, setFechaAjusteGerencial] =
    useState(() => fechaParaInputLocal(new Date()));
  const [
    cargandoRegistrosAjuste,
    setCargandoRegistrosAjuste
  ] = useState(false);
  const [nuevaHoraInicio, setNuevaHoraInicio] = useState("");
  const [nuevaHoraFin, setNuevaHoraFin] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");

  const [parosActivos, setParosActivos] = useState([]);
  const [todosLosParos, setTodosLosParos] = useState([]);

  const [ajustesProduccion, setAjustesProduccion] = useState([]);

  const [produccionSeleccionada, setProduccionSeleccionada] = useState(null);

  const [otDetalle, setOtDetalle] = useState(null);

  const [ahora, setAhora] = useState(new Date());

  const cargarProduccionActiva = async () => {

  const snap = await getDocs(
    collection(db, "produccion_activa")
  );

  const data = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  setProduccionActiva(data);

  };
  
  const estiloInput = {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    border: "1px solid #ccc",
    boxSizing: "border-box"
  };

  const botonAzul = {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 5
  };

  const botonVerde = {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#4CAF50",
    color: "white",
    fontWeight: "bold",
    marginBottom: 8
  };

  const botonRojo = {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#F44336",
    color: "white",
    fontWeight: "bold",
    marginBottom: 12
  };

  const cardHome = {
    border: "none",
    borderRadius: 18,
    padding: "22px 18px",
    color: "white",
    fontWeight: "bold",
    fontSize: 22,
    cursor: "pointer",
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.15)",
    width: "100%",
    minHeight: 140,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    transition: "0.25s"
  };

const cargarOrdenesTrabajo = useCallback(async () => {
  if (
    !autenticacionFirebaseActiva ||
    !usuarioSeleccionado
  ) {
    const otSnap = await getDocs(
      collection(db, "ordenes_trabajo")
    );

    return otSnap.docs.map(doc =>
      normalizarOrdenTrabajo(doc.id, doc.data())
    );
  }

  const filtrosBase = [
    where(
      "empresa_id",
      "==",
      usuarioSeleccionado.empresa_id
    ),
    where("modelo_version", "==", 2)
  ];
  const plantasPermitidas =
    usuarioSeleccionado.rol === "gerencia"
      ? []
      : (usuarioSeleccionado.planta_ids || []);
  if (
    usuarioSeleccionado.rol !== "gerencia" &&
    plantasPermitidas.length === 0
  ) {
    return [];
  }

  const consultas = plantasPermitidas.length > 0
    ? plantasPermitidas.map(plantaId =>
      query(
        collection(db, "ordenes_trabajo"),
        ...filtrosBase,
        where("planta_id", "==", plantaId)
      )
    )
    : [
      query(
        collection(db, "ordenes_trabajo"),
        ...filtrosBase
      )
    ];
  const snaps = await Promise.all(
    consultas.map(consulta => getDocs(consulta))
  );
  const ordenesPorId = new Map();

  snaps.forEach(snap => {
    snap.docs.forEach(documento => {
      ordenesPorId.set(
        documento.id,
        normalizarOrdenTrabajo(
          documento.id,
          documento.data()
        )
      );
    });
  });

  return [...ordenesPorId.values()];
}, [usuarioSeleccionado]);

const cargarDatos = useCallback(async () => {

  try {

    await cargarProduccionActiva();

    setOts(await cargarOrdenesTrabajo());

    const procSnap = await getDocs(collection(db, "procesos"));
    setProcesos(procSnap.docs.map(doc => doc.data()));

    const userSnap = await getDocs(collection(db, "usuarios"));
    setUsuarios(userSnap.docs.map(doc => doc.data()));

    const operSnap = await getDocs(collection(db, "operarios"));

    setOperarios(
      operSnap.docs.map(doc => ({
        id: doc.id,
        activo: true,
        equipo: "",
        habilidades: [],
        ...doc.data()
      }))
    );

    const subSnap = await getDocs(collection(db, "subprocesos"));
    setSubprocesos(subSnap.docs.map(doc => doc.data()));

    const estSnap = await getDocs(collection(db, "estandares"));
    setEstandares(
      estSnap.docs.map(doc =>
        normalizarEstandar(doc.id, doc.data())
      )
    );

    const configProcSnap = await getDocs(collection(db, "config_procesos"));
    setProcesosConfig(configProcSnap.docs.map(doc => ({id: doc.id, ...doc.data()})));

    const productosSnap =
      await getDocs(
        collection(db, "config_productos")
      );

    setProductosConfig(
      productosSnap.docs.map(doc =>
        normalizarDocumento(doc.id, doc.data())
      )
    );

    const operacionesSnap =
      await getDocs(
        collection(
          db,
          "operaciones_maestras"
        )
      );

    setOperacionesMaestras(

      operacionesSnap.docs.map(doc => ({

        id: doc.id,

        ...doc.data()

      }))

    );

    const ajustesQuery = query(
  collection(db, "ajustes_produccion"),
  orderBy("fecha_ajuste", "desc"),
  limit(200)
);

const ajustesSnap = await getDocs(
  ajustesQuery
);

setAjustesProduccion(

  ajustesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

);

const registrosQuery = query(
  collection(db, "registros_produccion"),
  orderBy("fecha", "desc"),
  limit(100)
);

const registrosSnap =
  await getDocs(registrosQuery);

const registrosData =
  registrosSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

setRegistros(registrosData);

setDashboard(
  registrosData
    .filter(r => !r.anulado)
    .slice(0, 50)
);

  } catch (error) {
    console.error("ERROR:", error);
  }

}, [cargarOrdenesTrabajo]);

const cargarRegistrosAjustePorFecha = useCallback(async (
  fechaSeleccionada = fechaAjusteGerencial
) => {

  if (!fechaSeleccionada) {
    setRegistros([]);
    return;
  }

  const inicioDia =
    new Date(`${fechaSeleccionada}T00:00:00`);

  const finDia =
    new Date(inicioDia);

  finDia.setDate(
    finDia.getDate() + 1
  );

  if (
    Number.isNaN(inicioDia.getTime()) ||
    Number.isNaN(finDia.getTime())
  ) {
    setRegistros([]);
    return;
  }

  setCargandoRegistrosAjuste(true);

  try {
    const registrosQuery = query(
      collection(db, "registros_produccion"),
      where("fecha", ">=", inicioDia),
      where("fecha", "<", finDia),
      orderBy("fecha", "desc")
    );

    const registrosSnap =
      await getDocs(registrosQuery);

    setRegistros(
      registrosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  } catch (error) {
    console.error(error);
    alert(
      "Error cargando registros de la fecha seleccionada"
    );
  } finally {
    setCargandoRegistrosAjuste(false);
  }

}, [fechaAjusteGerencial]);

const cargarEvolucionOperarios = useCallback(async () => {

  const inicio =
    new Date();

  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(
    inicio.getDate() - 29
  );

  setCargandoEvolucionOperario(true);

  try {
    const registrosQuery = query(
      collection(db, "registros_produccion"),
      where("fecha", ">=", inicio),
      orderBy("fecha", "desc"),
      limit(2500)
    );

    const registrosSnap =
      await getDocs(registrosQuery);

    setRegistrosEvolucionOperario(
      registrosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  } catch (error) {
    console.error(error);
    alert(
      "Error cargando evolución de eficiencia"
    );
  } finally {
    setCargandoEvolucionOperario(false);
  }

}, []);

useEffect(() => {

  if (!autenticacionFirebaseActiva) {
    return undefined;
  }

  let cancelarObservador;
  let cancelado = false;
  let timeoutValidacionSesion = setTimeout(() => {
    if (cancelado) {
      return;
    }

    setUsuarioSeleccionado(null);
    setPantalla("login");
    setErrorAcceso(
      "No se pudo validar la sesión automáticamente. Ingresa tus credenciales nuevamente."
    );
    setAutenticacionLista(true);
  }, 6000);

  const limpiarTimeoutValidacionSesion = () => {
    if (timeoutValidacionSesion) {
      clearTimeout(timeoutValidacionSesion);
      timeoutValidacionSesion = null;
    }
  };

  import("./auth/servicio").then(({
    mensajeErrorAutenticacion,
    observarSesion,
    obtenerPerfilFirebase
  }) => {
    if (cancelado) {
      return;
    }

    cancelarObservador = observarSesion(
      async usuario => {
        limpiarTimeoutValidacionSesion();

        try {
          if (!usuario) {
            setUsuarioSeleccionado(null);
            setPantalla("login");
            setAutenticacionLista(true);
            return;
          }

          const perfil =
            await obtenerPerfilFirebase(usuario);

          setUsuarioSeleccionado(perfil);
          setPasswordAcceso("");
          setErrorAcceso("");
          setPantalla(
            interfazV2Activa &&
            perfil.rol === "tv"
              ? "dashboardV2"
              : "home"
          );
          setAutenticacionLista(true);
        } catch (error) {
          setUsuarioSeleccionado(null);
          setPantalla("login");
          setErrorAcceso(
            mensajeErrorAutenticacion(error)
          );
          setAutenticacionLista(true);
        }
      },
      error => {
        limpiarTimeoutValidacionSesion();
        setErrorAcceso(
          mensajeErrorAutenticacion(error)
        );
        setAutenticacionLista(true);
      }
    );
  }).catch(error => {
    if (!cancelado) {
      limpiarTimeoutValidacionSesion();
      setErrorAcceso(
        "No se pudo cargar el servicio de autenticación."
      );
      setAutenticacionLista(true);
      console.error(error);
    }
  });

  return () => {
    cancelado = true;
    limpiarTimeoutValidacionSesion();
    cancelarObservador?.();
  };

}, []);

useEffect(() => {

  if (!autenticacionLista) {
    return;
  }

  if (
    autenticacionFirebaseActiva &&
    !sesionCargaId
  ) {
    return;
  }

  cargarDatos();

}, [
  autenticacionLista,
  cargarDatos,
  sesionCargaId
]);

useEffect(() => {

  if (pantalla !== "ajusteGerencial") {
    return;
  }

  cargarRegistrosAjustePorFecha();

}, [
  pantalla,
  cargarRegistrosAjustePorFecha
]);

useEffect(() => {

  if (pantalla !== "evolucionOperario") {
    return;
  }

  cargarEvolucionOperarios();

}, [
  pantalla,
  cargarEvolucionOperarios
]);

useEffect(() => {

  if (pantalla !== "evolucionOperario") {
    return;
  }

  if (
    !operarioEvolucionSeleccionado &&
    operarios.length > 0
  ) {
    setOperarioEvolucionSeleccionado(
      operarios[0].nombre || ""
    );
  }

}, [
  pantalla,
  operarioEvolucionSeleccionado,
  operarios
]);
  
useEffect(() => {

  const intervalo = setInterval(() => {

    setAhora(new Date());

  }, 1000);

  return () => clearInterval(intervalo);

}, []);

useEffect(() => {

  if (!autenticacionLista) {
    return undefined;
  }

  if (
    autenticacionFirebaseActiva &&
    !sesionCargaId
  ) {
    return undefined;
  }

  cargarParosActivos();

  const intervalo = setInterval(() => {

    cargarDashboard();

  }, 60000);

  return () => clearInterval(intervalo);

}, [
  autenticacionLista,
  sesionCargaId
]);

  async function guardar() {
  // 1. Validación estricta inicial
  if (
  !usuarioSeleccionado ||
  !operarioSeleccionado ||
  !procesoSeleccionado ||
  !cantidad ||
  !subprocesoSeleccionado
  ) {
    alert("Faltan datos críticos para el cálculo de eficiencia.");
    return;
  }

  // 2. Cálculo de tiempo (Asegurar que existan marcas de tiempo)
const produccionActual =

  produccionActiva.find(p =>

    normalizar(p.operario)
    ===
    normalizar(
      operarioSeleccionado
    )

    &&

    normalizar(p.ot)
    ===
    normalizar(
      otSeleccionada
    )

    &&

    normalizar(p.proceso)
    ===
    normalizar(
      procesoSeleccionado
    )

    &&

    normalizar(p.subproceso)
    ===
    normalizar(
      subprocesoSeleccionado
    )

  );

  if (!produccionActual?.inicio) {

  alert(
    "No existe inicio de producción."
  );

  return;

}

const inicioProduccion =

  produccionActual.inicio.toDate
    ? produccionActual.inicio.toDate()
    : new Date(
        produccionActual.inicio
      );

const ahoraTiempo =
  new Date();

const tiempoTotalMs =
  ahoraTiempo - inicioProduccion;

let tiempoPausasMs = 0;

const parosProduccion =

  todosLosParos.filter(paro => {

    const inicioParo =
      paro.inicio_paro?.toDate
        ? paro.inicio_paro.toDate()
        : new Date(paro.inicio_paro);

    return (

      normalizar(paro.operario)
      === normalizar(operarioSeleccionado)

      &&

      normalizar(paro.ot)
      === normalizar(otSeleccionada)

      &&

      normalizar(paro.proceso)
      === normalizar(procesoSeleccionado)

      &&

      normalizar(paro.subproceso)
      === normalizar(subprocesoSeleccionado)

      &&

      inicioParo >= inicioProduccion

    );

  });

parosProduccion.forEach(paro => {

  if (paro.inicio_paro) {

    const inicioParo =
      paro.inicio_paro.toDate
        ? paro.inicio_paro.toDate()
        : new Date(
            paro.inicio_paro
          );

    const finParo =
      paro.fin_paro

        ? (
            paro.fin_paro.toDate
              ? paro.fin_paro.toDate()
              : new Date(
                  paro.fin_paro
                )
          )

        : ahoraTiempo;

    tiempoPausasMs +=
      finParo - inicioParo;

  }

});

const tiempoNetoMs =
  Math.max(
    0,
    tiempoTotalMs - tiempoPausasMs
  );

const horasTrabajadas =
  tiempoNetoMs / 3600000;

  // 4. Búsqueda del estándar con LOGS de depuración
  const estandar = estandares.find(e => {
  const matchProc = normalizar(e.proceso) === normalizar(procesoSeleccionado);
  const matchSub = normalizar(e.subproceso) === normalizar(subprocesoSeleccionado);

  const matchDet =
    !e.detalle || // si el estándar no tiene detalle
    normalizar(e.detalle) === normalizar(detalleSeleccionado);

  return matchProc && matchSub && matchDet;
});

  if (!estandar) {
    console.error("No se encontró un estándar para:", {
      procesoSeleccionado,
      subprocesoSeleccionado,
      detalleSeleccionado
    });
    alert("Error: No existe un valor de referencia (unidades/hora) para esta combinación de proceso/subproceso.");
    return;
  }

  // 5. Cálculo de eficiencia
  let eficiencia = 0;
  // TEMPORAL
  // mientras migramos a producción_activa

  const esperado =

  horasTrabajadas
  *
  estandar.unidades_hora;

eficiencia =

  esperado > 0

    ? (
        Number(cantidad)
        /
        esperado
      ) * 100

    : 0;

  eficiencia = Math.min(eficiencia, 150);

  let colorEficiencia = "";
  if (eficiencia < 70) {
    colorEficiencia = "🔴";
    } else if (eficiencia < 90) {
      colorEficiencia = "🟡";
    } else {
      colorEficiencia = "🟢";
    }

  try {

    console.log("GUARDANDO PARO");
    
    const horaInicioReal =
      inicioProduccion;

    const horaFinReal =
      ahoraTiempo;

    await addDoc(collection(db, "registros_produccion"), {
      iniciado_por:
        usuarioSeleccionado?.nombre || "SIN USUARIO",

      operario: operarioSeleccionado,
      rol: usuarioSeleccionado.rol,
      ot: otSeleccionada,
      proceso: procesoSeleccionado,
      subproceso: subprocesoSeleccionado,
      detalle: detalleSeleccionado,
      hora_inicio: horaInicioReal,
      hora_fin: horaFinReal,
      horas_trabajadas: horasTrabajadas,
      responsable_ajuste: responsableAjuste,
      tipo_ajuste: "Corrección Gerencial",
      cantidad_ok: Number(cantidad),
      eficiencia: Math.round(eficiencia),
      estado_eficiencia: colorEficiencia,
      fecha: new Date()
    });

    alert("Guardado correctamente ✅");

    setCantidad("");
    setSubprocesoSeleccionado("");
    setDetalleSeleccionado("");
    
  } 
    catch (error) {

      console.error("ERROR FINALIZAR:", error);

      alert(
        "ERROR: " + error.message
      );
    }
}
const cargarDashboard = async () => {
  try {
    const q = query(
      collection(db, "registros_produccion"),
      orderBy("fecha", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);
    const data = snap.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(r => !r.anulado);
    setDashboard(data);
  } catch (error) {
    console.error("ERROR dashboard:", error);
  }
};

const cargarParosActivos = async () => {

  try {

    const snap = await getDocs(
      collection(db, "paros_produccion")
    );

    const data =
      snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    setTodosLosParos(data);

    setParosActivos(
      data.filter(
        p => p.estado === "activo"
      )
    );

  } catch (error) {

    console.error(error);

  }

};

const cargarTodosLosParos = async () => {

  try {

    const snap = await getDocs(
      collection(db, "paros_produccion")
    );

    const data =
      snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    setTodosLosParos(data);

  } catch (error) {

    console.error(error);

  }

};

  if (pantalla === "login") {

  if (!autenticacionLista) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial"
      }}>
        Validando sesión...
      </div>
    );
  }

  return (
    <div style={{
      height: "100vh",
      background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "Arial"
    }}>

      <div style={{
        background: "white",
        padding: 30,
        borderRadius: 12,
        width: 300,
        boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
        textAlign: "center"
      }}>

        {/* LOGO */}
        <img 
          src="/logo-bba.png" 
          alt="BBA"
          style={{ width: 100, marginBottom: 10 }}
        />

        <h2 style={{
  marginBottom: 20,
  fontWeight: "bold",
  color: "#1e3a8a"
}}>
  🔐 Acceso BBA
</h2>

        {autenticacionFirebaseActiva ? (
          <>
            <input
              type="email"
              placeholder="Correo"
              autoComplete="username"
              value={emailAcceso}
              onChange={(e) => {
                setEmailAcceso(e.target.value);
                setMensajeAcceso("");
              }}
              style={estiloInput}
            />

            <div style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 10
            }}>
              <input
                type={mostrarPasswordAcceso
                  ? "text"
                  : "password"}
                placeholder="Contraseña"
                autoComplete="current-password"
                value={passwordAcceso}
                onChange={(e) => {
                  setPasswordAcceso(e.target.value);
                  setMensajeAcceso("");
                }}
                style={{
                  ...estiloInput,
                  marginBottom: 0
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setMostrarPasswordAcceso(
                    previo => !previo
                  )
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #1976D2",
                  background: "white",
                  color: "#1976D2",
                  fontWeight: "bold",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {mostrarPasswordAcceso
                  ? "Ocultar"
                  : "Ver"}
              </button>
            </div>

            {mensajeAcceso && (
              <div style={{
                color: "#2E7D32",
                marginBottom: 12,
                fontSize: 14
              }}>
                {mensajeAcceso}
              </div>
            )}

            {errorAcceso && (
              <div style={{
                color: "#C62828",
                marginBottom: 12,
                fontSize: 14
              }}>
                {errorAcceso}
              </div>
            )}

            <button
              disabled={ingresando}
              onClick={async () => {
                if (
                  !emailAcceso ||
                  !passwordAcceso
                ) {
                  setErrorAcceso(
                    "Ingresa correo y contraseña."
                  );
                  setMensajeAcceso("");
                  return;
                }

                try {
                  setIngresando(true);
                  setErrorAcceso("");
                  setMensajeAcceso("");
                  const {
                    iniciarSesion
                  } = await import(
                    "./auth/servicio"
                  );
                  await iniciarSesion(
                    emailAcceso,
                    passwordAcceso
                  );
                } catch (error) {
                  const {
                    mensajeErrorAutenticacion
                  } = await import(
                    "./auth/servicio"
                  );
                  setErrorAcceso(
                    mensajeErrorAutenticacion(error)
                  );
                } finally {
                  setIngresando(false);
                }
              }}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "none",
                background: "#1976D2",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: 16
              }}
            >
              {ingresando
                ? "Ingresando..."
                : "Ingresar"}
            </button>

            <button
              disabled={enviandoReset}
              onClick={async () => {
                const email =
                  emailAcceso.trim();

                if (!email) {
                  setErrorAcceso(
                    "Ingresa tu correo para restablecer la contraseña."
                  );
                  setMensajeAcceso("");
                  return;
                }

                try {
                  setEnviandoReset(true);
                  setErrorAcceso("");
                  setMensajeAcceso("");
                  const {
                    enviarCorreoRestablecerPassword
                  } = await import(
                    "./auth/servicio"
                  );
                  await enviarCorreoRestablecerPassword(
                    email
                  );
                  setMensajeAcceso(
                    "Correo de restablecimiento enviado. Revisa tu email."
                  );
                } catch (error) {
                  const {
                    mensajeErrorAutenticacion
                  } = await import(
                    "./auth/servicio"
                  );
                  setErrorAcceso(
                    mensajeErrorAutenticacion(error)
                  );
                } finally {
                  setEnviandoReset(false);
                }
              }}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #1976D2",
                background: "white",
                color: "#1976D2",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: 14,
                marginTop: 10
              }}
            >
              {enviandoReset
                ? "Enviando correo..."
                : "Olvidé mi contraseña"}
            </button>
          </>
        ) : (
          <>
            <select
              onChange={(e) => {
                const index = e.target.value;
                setUsuarioSeleccionado(
                  usuarios[index]
                );
              }}
              style={{
                width: "100%",
                padding: 10,
                marginBottom: 15,
                borderRadius: 6,
                border: "1px solid #ccc"
              }}
            >
              <option value="">
                Seleccionar Usuario
              </option>
              {usuarios.map((u, i) => (
                <option key={i} value={i}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (!usuarioSeleccionado) {
                  alert("Selecciona un usuario");
                  return;
                }
                setPantalla("home");
              }}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "none",
                background: "#1976D2",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: 16
              }}
            >
              Ingresar
            </button>
          </>
        )}

      </div>
    </div>
  );
}

  if (pantalla === "home") {
  const accesoV2 =
    interfazV2Activa &&
    autenticacionFirebaseActiva;
  const puedeAdministrar =
    accesoV2 &&
    puedeAdministrarV2(usuarioSeleccionado);
  const puedeOperar =
    accesoV2 &&
    puedeOperarV2(usuarioSeleccionado);
  const puedeVerDashboard =
    accesoV2 &&
    puedeVerDashboardV2(usuarioSeleccionado);
  const abrirDashboardLegacy = () => {
    setPantalla("dashboard");
    cargarDashboard();
  };
  const limpiarContextoTurnos = () => {
    setContextoTurnosV2(null);
    setPantalla("turnosV2");
  };
  const limpiarContextoCapacidad = () => {
    setContextoCapacidadV2(null);
    setPantalla("capacidadV2");
  };
  const tarjetaMenu = {
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    background: "white",
    color: "#0F172A",
    padding: "14px 16px",
    textAlign: "left",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow:
      "0 2px 8px rgba(15,23,42,0.06)"
  };
  const tarjetaRapida = {
    ...tarjetaMenu,
    background: "#0F172A",
    color: "white",
    border: "none"
  };
  const accionesRapidas = [
    {
      titulo: "Dashboard",
      accion: puedeVerDashboard
        ? () => setPantalla("dashboardV2")
        : abrirDashboardLegacy
    },
    {
      titulo: "Crear OT",
      accion: puedeAdministrar
        ? () => setPantalla("ordenesV2")
        : () => setPantalla("crearOT")
    },
    {
      titulo: "Ejecutar producción",
      accion: puedeOperar
        ? () => setPantalla("ejecucionV2")
        : () => setPantalla("registro")
    },
    {
      titulo: "Ingeniería de producto",
      accion: puedeAdministrar
        ? () => setPantalla("rutasV2")
        : () => setPantalla("configProductos")
    }
  ];
  const seccionesHome = [
    {
      titulo: "Producción",
      descripcion:
        "Operación diaria, OTs y ejecución en planta.",
      items: [
        {
          titulo: "Dashboard y Ranking (V2)",
          visible: puedeVerDashboard,
          accion: () => setPantalla("dashboardV2")
        },
        {
          titulo: "Dashboard clásico",
          visible: true,
          accion: abrirDashboardLegacy
        },
        {
          titulo: "Órdenes de Trabajo (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("ordenesV2")
        },
        {
          titulo: "Crear OT clásico",
          visible: true,
          accion: () => setPantalla("crearOT")
        },
        {
          titulo: "Ejecutar Producción (V2)",
          visible: puedeOperar,
          accion: () => setPantalla("ejecucionV2")
        },
        {
          titulo: "Registrar Producción clásico",
          visible: true,
          accion: () => setPantalla("registro")
        },
        {
          titulo: "Ver OTs clásico",
          visible: true,
          accion: () => setPantalla("ot")
        }
      ]
    },
    {
      titulo: "Ingeniería",
      descripcion:
        "Producto, rutas, piezas, procesos y carga masiva.",
      items: [
        {
          titulo: "Ingeniería de Producto (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("rutasV2")
        },
        {
          titulo: "Catálogo de Procesos y Estaciones (V2)",
          visible: puedeAdministrar,
          accion: () =>
            setPantalla("procesosEstacionesV2")
        },
        {
          titulo: "Catálogo de Piezas (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("piezasV2")
        },
        {
          titulo: "Catálogo de Subproductos (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("subproductosV2")
        },
        {
          titulo: "Catálogo de Operaciones (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("detallesV2")
        },
        {
          titulo: "Importar Ingeniería Excel (V2)",
          visible: puedeAdministrar,
          accion: () =>
            setPantalla("importadorIngenieriaV2")
        },
        {
          titulo: "Configuración Producción clásica",
          visible: true,
          accion: () => setPantalla("configProduccion")
        },
        {
          titulo: "Configuración Productos clásica",
          visible: true,
          accion: () => setPantalla("configProductos")
        },
        {
          titulo: "Operaciones Maestras clásicas",
          visible: true,
          accion: () =>
            setPantalla("operacionesMaestras")
        }
      ]
    },
    {
      titulo: "Planificación",
      descripcion:
        "Cuellos de botella, capacidad, turnos y decisiones.",
      items: [
        {
          titulo: "Planificador de Prioridades (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("planificadorV2")
        },
        {
          titulo: "Gestión de Estándares (V2)",
          visible: puedeAdministrar,
          accion: () =>
            setPantalla("gestionEstandaresV2")
        },
        {
          titulo: "Capacidad por Estación (V2)",
          visible: puedeAdministrar,
          accion: limpiarContextoCapacidad
        },
        {
          titulo: "Turnos y Dotación (V2)",
          visible: puedeAdministrar,
          accion: limpiarContextoTurnos
        },
        {
          titulo: "Historial de decisiones (V2)",
          visible: puedeAdministrar,
          accion: () =>
            setPantalla(
              "historialDecisionesPlanificadorV2"
            )
        },
      ]
    },
    {
      titulo: "RRHH",
      descripcion:
        "Personas de planta, equipos y habilidades.",
      items: [
        {
          titulo: "Personas y Operarios (V2)",
          visible:
            puedeGestionarRRHHV2(
              usuarioSeleccionado
            ),
          accion: () => setPantalla("rrhhPersonasV2")
        }
      ]
    },
    {
      titulo: "Materiales",
      descripcion:
        "MP, RF, inventario y almacén.",
      items: [
        {
          titulo: "Catálogo MP / RF (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("materialesV2")
        },
        {
          titulo: "Almacén (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("almacenV2")
        }
      ]
    },
    {
      titulo: "Comercial Técnico",
      descripcion:
        "Costeo, cotización y lead time de productos nuevos.",
      items: [
        {
          titulo: "Costeo y Cotización Técnica (V2)",
          visible:
            puedeGestionarCosteoV2(
              usuarioSeleccionado
            ),
          accion: () =>
            setPantalla("cotizadorTecnicoV2")
        },
        {
          titulo: "Clientes y Proveedores (V2)",
          visible:
            puedeGestionarCosteoV2(
              usuarioSeleccionado
            ),
          accion: () =>
            setPantalla("tercerosV2")
        },
        {
          titulo: "Costos Base Producción (V2)",
          visible:
            puedeGestionarCosteoV2(
              usuarioSeleccionado
            ),
          accion: () =>
            setPantalla("costosBaseProduccionV2")
        },
        {
          titulo: "Costos Operativos Fijos (V2)",
          visible:
            puedeGestionarCosteoV2(
              usuarioSeleccionado
            ),
          accion: () =>
            setPantalla("costosOperativosFijosV2")
        }
      ]
    },
    {
      titulo: "Control",
      descripcion:
        "Calidad, paros y ajustes.",
      items: [
        {
          titulo: "Calidad y Reprocesos (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("calidadV2")
        },
        {
          titulo: "Motivos de Paro (V2)",
          visible: puedeAdministrar,
          accion: () => setPantalla("parosV2")
        },
        {
          titulo: "Usuarios / Control de Acceso (V2)",
          visible:
            puedeGestionarUsuariosV2(
              usuarioSeleccionado
            ),
          accion: () =>
            setPantalla("usuariosV2")
        },
        {
          titulo: "Historial de Paros",
          visible: true,
          accion: () => setPantalla("historialParos")
        },
        {
          titulo: "Evolución Eficiencia Operario",
          visible: true,
          accion: () => setPantalla("evolucionOperario")
        },
        {
          titulo: "Ajuste Gerencial",
          visible: true,
          accion: () => {
            setFechaAjusteGerencial(
              fechaParaInputLocal(new Date())
            );
            setPantalla("ajusteGerencial");
          }
        }
      ]
    }
  ];

  return (
    <div style={{
      padding: 30,
      background: "#f4f6f8",
      minHeight: "100vh",
      fontFamily: "Arial",

      maxWidth: 1400,

      margin: "0 auto"
    }}>

      {/* LOGO */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <img 
          src="/logo-bba.png" 
          alt="BBA" 
          style={{ width: 120 }}
        />
        <h1 style={{ marginTop: 10 }}>BBA Producción</h1>

        {autenticacionFirebaseActiva && (
          <button
            onClick={async () => {
              const {
                cerrarSesion
              } = await import(
                "./auth/servicio"
              );
              await cerrarSesion();
              setEmailAcceso("");
              setPasswordAcceso("");
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "#1976D2",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Cerrar sesión
          </button>
        )}
      </div>

      {/* BOTONES */}

 {/* KPI SUPERIOR */}

<div style={{

  display: "grid",

  gridTemplateColumns:
    esMobile
      ? "1fr 1fr"
      : "repeat(4, 1fr)",

  gap: 20,

  marginBottom: 40

}}>

  {/* OTS ACTIVAS */}

  <div style={{
    background: "#E3F2FD",
    color: "#1565C0",
    padding: 18,
    borderRadius: 20,
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.12)"
  }}>

    <div style={{
      fontSize: 14,
      opacity: 0.9
    }}>

      📋 OTs Activas

    </div>

    <div style={{
      fontSize: 32,
      fontWeight: "bold",
      marginTop: 10
    }}>

      {

        ots.filter(
          o =>
            o.estado ===
            "activa"
        ).length

      }

    </div>

  </div>

  {/* PRODUCCIÓN */}

  <div style={{
    background: "#E8F5E9",
    color: "#2E7D32",
    padding: 18,
    borderRadius: 20,
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.12)"
  }}>

    <div style={{
      fontSize: 14,
      opacity: 0.9
    }}>

      🏭 Producción Activa

    </div>

    <div style={{
      fontSize: 32,
      fontWeight: "bold",
      marginTop: 10
    }}>

      {produccionActiva.length}

    </div>

  </div>

  {/* PAROS */}

  <div style={{
    background: "#FFF3E0",
    color: "#EF6C00",
    padding: 18,
    borderRadius: 20,
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.12)"
  }}>

    <div style={{
      fontSize: 14,
      opacity: 0.9
    }}>

      ⏸️ Paros Activos

    </div>

    <div style={{
      fontSize: 32,
      fontWeight: "bold",
      marginTop: 10
    }}>

      {parosActivos.length}

    </div>

  </div>

  {/* OPERACIONES */}

  <div style={{
    background: "#ECEFF1",
    color: "#455A64",
    padding: 18,
    borderRadius: 20,
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.12)"
  }}>

    <div style={{
      fontSize: 14,
      opacity: 0.9
    }}>

      ⚙️ Operaciones

    </div>

    <div style={{
      fontSize: 32,
      fontWeight: "bold",
      marginTop: 10
    }}>

      {operacionesMaestras.length}

    </div>

  </div>

</div>     

      <section style={{
        background: "white",
        borderRadius: 22,
        padding: 22,
        boxShadow:
          "0 4px 14px rgba(15,23,42,0.08)",
        marginBottom: 26
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap"
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: "#0F172A"
            }}>
              Accesos diarios
            </h2>
            <p style={{
              margin: "6px 0 0",
              color: "#64748B"
            }}>
              Lo que se usa con más frecuencia en planta.
            </p>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: esMobile
            ? "1fr"
            : "repeat(4, 1fr)",
          gap: 14,
          marginTop: 18
        }}>
          {accionesRapidas.map(accion => (
            <button
              key={accion.titulo}
              type="button"
              onClick={accion.accion}
              style={tarjetaRapida}
            >
              {accion.titulo}
            </button>
          ))}
        </div>
      </section>

      <div style={{
        display: "grid",
        gridTemplateColumns: esMobile
          ? "1fr"
          : "repeat(2, minmax(0, 1fr))",
        gap: 18,
        alignItems: "start"
      }}>
        {seccionesHome.map(seccion => {
          const items = seccion.items.filter(
            item => item.visible
          );

          if (items.length === 0) {
            return null;
          }

          return (
            <section
              key={seccion.titulo}
              style={{
                background: "white",
                borderRadius: 18,
                padding: 18,
                boxShadow:
                  "0 2px 10px rgba(15,23,42,0.07)",
                border: "1px solid #E2E8F0"
              }}
            >
              <h3 style={{
                margin: 0,
                color: "#0F172A"
              }}>
                {seccion.titulo}
              </h3>
              <p style={{
                margin: "6px 0 14px",
                color: "#64748B",
                fontSize: 14
              }}>
                {seccion.descripcion}
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: esMobile
                  ? "1fr"
                  : "repeat(2, minmax(0, 1fr))",
                gap: 10
              }}>
                {items.map(item => (
                  <button
                    key={item.titulo}
                    type="button"
                    onClick={item.accion}
                    style={tarjetaMenu}
                  >
                    {item.titulo}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

if (
  pantalla === "almacenV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <AlmacenV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "rrhhPersonasV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeGestionarRRHHV2(usuarioSeleccionado)
) {
  return (
    <GestionPersonasRRHHV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "cotizadorTecnicoV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeGestionarCosteoV2(usuarioSeleccionado)
) {
  return (
    <CotizadorTecnicoV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "tercerosV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeGestionarCosteoV2(usuarioSeleccionado)
) {
  return (
    <TercerosV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

  if (
    pantalla === "costosBaseProduccionV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeGestionarCosteoV2(usuarioSeleccionado)
) {
  return (
    <CostosBaseProduccionV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "procesosEstacionesV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <CatalogoProcesosEstacionesV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "piezasV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <CatalogoPiezasV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "importadorIngenieriaV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <ImportadorIngenieriaV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "subproductosV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <CatalogoSubproductosV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "detallesV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <CatalogoDetallesV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "materialesV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <CatalogoMaterialesV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "turnosV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <ProgramacionTurnosV2
      db={db}
      perfil={usuarioSeleccionado}
      contextoInicial={contextoTurnosV2}
      textoVolver={
        contextoTurnosV2
          ? "Volver al Planificador"
          : "Volver a Ingeniería"
      }
      onVolver={() => {
        if (contextoTurnosV2) {
          setRetornoPlanificadorV2({
            origen: "turnos",
            ...contextoTurnosV2
          });
        }
        setPantalla(
          contextoTurnosV2
            ? "planificadorV2"
            : "home"
        );
      }}
    />
  );
}

if (
  pantalla === "capacidadV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <CapacidadProcesosV2
      db={db}
      perfil={usuarioSeleccionado}
      contextoInicial={contextoCapacidadV2}
      textoVolver={
        contextoCapacidadV2
          ? "Volver al Planificador"
          : "Volver a Ingeniería"
      }
      onVolver={() =>
        setPantalla(
          contextoCapacidadV2
            ? "planificadorV2"
            : "home"
        )
      }
    />
  );
}

if (
  pantalla === "rutasV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <ConstructorRutasV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "ordenesV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <OrdenesTrabajoV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "planificadorV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <PlanificadorPrioridadesV2
      db={db}
      perfil={usuarioSeleccionado}
      contextoRetorno={retornoPlanificadorV2}
      onContextoRetornoConsumido={() =>
        setRetornoPlanificadorV2(null)
      }
      onVolver={() => setPantalla("home")}
      onConfigurarCapacidad={contexto => {
        setContextoCapacidadV2(contexto);
        setPantalla("capacidadV2");
      }}
      onProgramarTurnos={contexto => {
        setContextoTurnosV2(contexto);
        setPantalla("turnosV2");
      }}
    />
  );
}

if (
  pantalla ===
    "gestionEstandaresV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <GestionEstandaresV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla ===
    "historialDecisionesPlanificadorV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <HistorialDecisionesPlanificadorV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
      onRevisarEstandar={contexto => {
        setContextoEjecucionV2(contexto);
        setPantalla("ejecucionV2");
      }}
    />
  );
}

if (
  pantalla === "ejecucionV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeOperarV2(usuarioSeleccionado)
) {
  return (
    <EjecucionProduccionV2
      db={db}
      perfil={usuarioSeleccionado}
      contextoInicial={contextoEjecucionV2}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "dashboardV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeVerDashboardV2(usuarioSeleccionado)
) {
  return (
    <DashboardV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
      onCerrarSesion={async () => {
        const {
          cerrarSesion
        } = await import("./auth/servicio");
        await cerrarSesion();
        setEmailAcceso("");
        setPasswordAcceso("");
      }}
    />
  );
}

if (
  pantalla === "calidadV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <CalidadV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "parosV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeAdministrarV2(usuarioSeleccionado)
) {
  return (
    <ParosV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (
  pantalla === "usuariosV2" &&
  interfazV2Activa &&
  autenticacionFirebaseActiva &&
  puedeGestionarUsuariosV2(usuarioSeleccionado)
) {
  return (
    <GestionUsuariosV2
      db={db}
      perfil={usuarioSeleccionado}
      onVolver={() => setPantalla("home")}
    />
  );
}

if (pantalla === "registro") {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f6f8",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 20,
      fontFamily: "Arial"
    }}>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img src="/logo-bba.png" alt="BBA" style={{ width: 80 }} />
        <h2 style={{ marginTop: 10 }}>🏭 Registrar Producción</h2>
      </div>

      {/* CARD PRINCIPAL */}
      <div style={{
        background: "white",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: 420
      }}>

        {/* OT */}
        <select
          value={otSeleccionada}
          onChange={(e) => setOtSeleccionada(e.target.value)}
          style={estiloInput}
        >
          <option value="">Seleccionar OT</option>
          {ots.map((ot, i) => (
            <option key={i} value={ot.nombre}>
              {ot.nombre}
            </option>
          ))}
        </select>

        {/* USUARIO LOGUEADO */}
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "#E3F2FD",
            borderRadius: 8,
            fontWeight: "bold",
            color: "#1976D2"
          }}
        >
          👤 Usuario:
          {" "}
          {usuarioSeleccionado?.nombre}
     
          <div style={{
            fontSize: 13,
            marginTop: 4,
            color: "#555"
          }}>
            Rol: {usuarioSeleccionado?.rol}
          </div>
        </div>

        {/* OPERARIO */}
        <select
          value={operarioSeleccionado}
          onChange={(e) =>
            setOperarioSeleccionado(e.target.value)
          }
          style={estiloInput}
        >
          <option value="">
            Seleccionar Operario
          </option>

          {operarios
            .filter(o => o.activo)
            .map((o, i) => (
              <option key={i} value={o.nombre}>
            {o.nombre}
              </option>
          ))}
        </select>

        {/* PROCESO */}
        <select
  value={procesoSeleccionado}
  onChange={(e) => {

    setProcesoSeleccionado(
      e.target.value
    );

    setSubprocesoSeleccionado("");
    setDetalleSeleccionado("");

  }}
  style={estiloInput}
>
          <option value="">Seleccionar Proceso</option>
          {procesos.map((p, i) => (
            <option key={i} value={p.nombre}>
              {p.nombre}
            </option>
          ))}
        </select>

        {/* SUBPROCESO */}
       <select
  value={subprocesoSeleccionado}
  onChange={(e) => {

    setSubprocesoSeleccionado(
      e.target.value
    );

    setDetalleSeleccionado("");

  }}
  style={estiloInput}
>
          <option value="">Seleccionar Subproceso</option>
          {subprocesos
            .filter(sp => sp.proceso?.toLowerCase() === procesoSeleccionado?.toLowerCase())
            .map((sp, i) => (
              <option key={i} value={sp.nombre}>
                {sp.nombre}
              </option>
            ))}
        </select>

        {/* OPERACIÓN */}
        <select
  value={detalleSeleccionado}
  onChange={(e) =>
    setDetalleSeleccionado(
      e.target.value
    )
  }
  style={estiloInput}
>
          <option value="">Seleccionar Operación</option>
          {subprocesos
            .find(sp => sp.nombre === subprocesoSeleccionado)
            ?.detalles?.map((d, i) => (
              <option key={i} value={d}>
                {d}
              </option>
            ))}
        </select>

{/* INICIAR PRODUCCIÓN */}
<button
  onClick={async () => {

    const produccionAIniciar = {
      operario: operarioSeleccionado,
      proceso: procesoSeleccionado,
      subproceso: subprocesoSeleccionado,
      detalle: detalleSeleccionado,
      ot: otSeleccionada,
      iniciado_por: usuarioSeleccionado?.nombre || ""
    };

    if (
      !produccionAIniciar.ot ||
      !produccionAIniciar.operario ||
      !produccionAIniciar.proceso ||
      !produccionAIniciar.subproceso ||
      !produccionAIniciar.detalle
    ) {
      alert(
        "Debes seleccionar OT, operario, proceso, subproceso y operación"
      );
      return;
    }

    try {

      const yaExiste =
            produccionActiva.find(p =>

              p.operario ===
                produccionAIniciar.operario &&

              p.proceso ===
                produccionAIniciar.proceso &&

              p.subproceso ===
                produccionAIniciar.subproceso
            );

          if (yaExiste) {

            alert(
              "Este operario ya tiene este proceso iniciado"
            );

            return;
          }

      const inicioProduccion = new Date();

      const produccionDoc = await addDoc(
        collection(db, "produccion_activa"),
        {
          ...produccionAIniciar,

          inicio: inicioProduccion,

          estado: "activo"
        }
      );

      if (!produccionDoc.id) {
        throw new Error(
          "Firebase no confirmó el registro de la producción"
        );
      }

      setProduccionActiva(prev => [
        ...prev,
        {
          id: produccionDoc.id,
          ...produccionAIniciar,
          inicio: inicioProduccion,
          estado: "activo"
        }
      ]);

      alert("Producción iniciada ✅");

      setOperarioSeleccionado("");
      setProcesoSeleccionado("");
      setSubprocesoSeleccionado("");
      setDetalleSeleccionado("");
      setOtSeleccionada("");

    } catch (error) {
      console.error(error);
      alert(
        "No se pudo iniciar la producción: " +
        error.message
      );
    }

  }}
  style={{
    ...botonVerde,
    fontSize: 18
  }}
>
  ▶️ Iniciar Producción
</button>

<h3 style={{ marginTop: 20 }}>
  🟢 Producciones Activas
</h3>

{produccionActiva.map((p, i) => {

const parosDeEstaProduccion =
  todosLosParos.filter(paro => {

    const inicioParo =
      paro.inicio_paro?.toDate
        ? paro.inicio_paro.toDate()
        : new Date(paro.inicio_paro);

    const inicioProduccion =
      p.inicio?.toDate
        ? p.inicio.toDate()
        : new Date(p.inicio);

    return (

      paro.operario === p.operario &&
      paro.ot === p.ot &&
      paro.proceso === p.proceso &&
      paro.subproceso === p.subproceso &&

      inicioParo >= inicioProduccion

    );

  });

let tiempoPausasMs = 0;

parosDeEstaProduccion.forEach(paro => {

  if (paro.inicio_paro) {

    const inicioParo =
      paro.inicio_paro.toDate
        ? paro.inicio_paro.toDate()
        : new Date(paro.inicio_paro);

    const finParo =
      paro.fin_paro
        ? (
            paro.fin_paro.toDate
              ? paro.fin_paro.toDate()
              : new Date(paro.fin_paro)
          )
        : ahora;

    tiempoPausasMs +=
      finParo - inicioParo;

  }

});  

const paroActivoProduccion =
  parosActivos.find(paro =>
    paro.operario === p.operario &&
    paro.ot === p.ot &&
    paro.proceso === p.proceso &&
    paro.subproceso === p.subproceso &&
    paro.estado === "activo"
  );

  const inicio =
  p.inicio?.toDate();

let tiempoDetenidoTotal = 0;

parosDeEstaProduccion.forEach(paro => {

  if (
    paro.inicio_paro?.toDate &&
    paro.fin_paro?.toDate
  ) {

    const inicio =
      paro.inicio_paro.toDate();

    const fin =
      paro.fin_paro.toDate();

    tiempoDetenidoTotal +=
      fin - inicio;

  }

});

const horasDet =
  Math.floor(
    tiempoDetenidoTotal / 3600000
  );

const minutosDet =
  Math.floor(
    (tiempoDetenidoTotal % 3600000)
    / 60000
  );

const segundosDet =
  Math.floor(
    (tiempoDetenidoTotal % 60000)
    / 1000
  );

const tiempoDetenidoFormateado = `
  ${String(horasDet).padStart(2, "0")}
  :
  ${String(minutosDet).padStart(2, "0")}
  :
  ${String(segundosDet).padStart(2, "0")}
`;

const tiempoHoras =
  inicio
    ? (
        (
          (ahora - inicio)
          - tiempoPausasMs
        ) / 3600000
      )
    : 0;

  const tiempoDetenidoMs =
    parosDeEstaProduccion.reduce(
      (total, paro) => {

        if (!paro.inicio_paro)
          return total;

        const inicioParo =
          paro.inicio_paro.toDate
            ? paro.inicio_paro.toDate()
            : new Date(paro.inicio_paro);

        let finParo = new Date();

        if (paro.fin_paro) {

          finParo =
            paro.fin_paro.toDate
              ? paro.fin_paro.toDate()
              : new Date(paro.fin_paro);

        }

        return (
          total +
          (finParo - inicioParo)
        );

      },
      0
    );

const tiempoProductivoHoras =
  tiempoHoras;

const estandar =
  estandares.find(e => {

    const matchProc =
      normalizar(e.proceso) ===
      normalizar(p.proceso);

    const matchSub =
      normalizar(e.subproceso) ===
      normalizar(p.subproceso);

    const matchDet =
      !e.detalle ||
      normalizar(e.detalle) ===
      normalizar(p.detalle);

    return (
      matchProc &&
      matchSub &&
      matchDet
    );
  });  

  const esperado =
  estandar
    ? Math.round(
        estandar.unidades_por_hora *
        tiempoProductivoHoras
    )
    : 0;

const real =
  p.cantidad_actual || 0;

let eficiencia = 0;

let tiempoDetenido = "";

if (
  paroActivoProduccion
  &&
  p.inicio_paro?.toDate
) {

  const inicioParo =
    p.inicio_paro.toDate();

  const diferencia =
    ahora - inicioParo;

  const horas =
    Math.floor(
      diferencia / 3600000
    );

  const minutos =
    Math.floor(
      (diferencia % 3600000)
      / 60000
    );

  const segundos =
    Math.floor(
      (diferencia % 60000)
      / 1000
    );

  tiempoDetenido = `
    ${String(horas).padStart(2, "0")}
    :
    ${String(minutos).padStart(2, "0")}
    :
    ${String(segundos).padStart(2, "0")}
  `;

}

if (esperado > 0) {
  eficiencia =
    Math.round(
      (real / esperado) * 100
    );
}

let color = "#E8F5E9";

if (eficiencia < 70) {
  color = "#FFCDD2";
}
else if (eficiencia < 90) {
  color = "#FFF9C4";
}

return (

  <div
    key={i}
    style={{
      background: color,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10
    }}
  >
    <div>
      👤 <b>{p.operario}</b>
    </div>

    {paroActivoProduccion && (

      <div style={{
        marginTop: 6,
        background: "#D32F2F",
        color: "white",
        padding: "4px 8px",
        borderRadius: 6,
        fontWeight: "bold",
        display: "inline-block"
      }}>

        ⛔ DETENIDO

      </div>

    )}

    <div style={{
      marginTop: 6,
      fontSize: 12,
      fontWeight: "normal"
    }}>

      ⏱ {tiempoDetenido}

    </div>

    <div style={{
      marginTop: 6,
      fontSize: 12
    }}>

      ⏸ Acumulado:
      {" "}
      {tiempoDetenidoFormateado}

    </div>

    <div style={{
      fontSize: 12,
      marginTop: 4
    }}>

      ⚙ Productivo:
      {" "}

      {tiempoProductivoHoras.toFixed(2)}
      h

    </div>

    <div>
      {p.proceso}
      {" → "}
      {p.subproceso}

      {p.detalle && (
        <>
          {" → "}
          {p.detalle}
        </>
      )}
    </div>

    <div style={{
      fontSize: 13,
      fontWeight: "bold",
      color: "#333",
      marginTop: 4
    }}>
      📋 OT:
      {" "}
      {p.ot || "-"}
    </div>

    <div style={{
      marginTop: 8
    }}>
      📦 Actual:
      {" "}
      <b>
        {p.cantidad_actual || 0}
      </b>
    </div>

    <div style={{
      display: "flex",
      gap: 5,
      marginTop: 8
    }}>

      <button
        onClick={async () => {

          try {

            await updateDoc(
              doc(
                db,
                "produccion_activa",
                p.id
              ),
              {
                cantidad_actual:
                  (p.cantidad_actual || 0) + 100
              }
            );

            setProduccionActiva(prev =>
  prev.map(item =>
    item.id === p.id
      ? {
          ...item,
          cantidad_actual:
            (item.cantidad_actual || 0) + 100
        }
      : item
  )
);

          } catch (error) {
            console.error(error);
          }

        }}
        style={{
          flex: 1,
          padding: 8,
          border: "none",
          borderRadius: 6,
          background: "#1976D2",
          color: "white",
          fontWeight: "bold"
        }}
      >
        +100
      </button>

      <button
        onClick={async () => {

          try {

            await updateDoc(
              doc(
                db,
                "produccion_activa",
                p.id
              ),
              {
                cantidad_actual:
                  (p.cantidad_actual || 0) + 500
              }
            );

            setProduccionActiva(prev =>
  prev.map(item =>
    item.id === p.id
      ? {
          ...item,
          cantidad_actual:
            (item.cantidad_actual || 0) + 500
        }
      : item
  )
);

          } catch (error) {
            console.error(error);
          }

        }}
        style={{
          flex: 1,
          padding: 8,
          border: "none",
          borderRadius: 6,
          background: "#4CAF50",
          color: "white",
          fontWeight: "bold"
        }}
      >
        +500
      </button>

    </div>

    <div style={{
      display: "flex",
      gap: 5,
      marginTop: 10
    }}>

      <input
        type="number"
        placeholder="Cantidad"
        onChange={(e) => {
          p.nuevaCantidad =
            Number(e.target.value);
        }}
        style={{
          flex: 1,
          padding: 10,
          borderRadius: 6,
          border: "1px solid #ccc",
          boxSizing: "border-box"
        }}
      />

      <button
        onClick={async () => {

          try {

            const nuevaCantidad =
              p.nuevaCantidad !== undefined &&
              p.nuevaCantidad !== ""
                ? Number(p.nuevaCantidad)
                : p.cantidad_actual;

            await updateDoc(
              doc(
                db,
                "produccion_activa",
                p.id
              ),
              {
                cantidad_actual: nuevaCantidad
              }
            );

            setProduccionActiva(prev =>
              prev.map(item =>
                item.id === p.id
                  ? {
                      ...item,
                      cantidad_actual:
                        nuevaCantidad
                    }
                  : item
              )
            );

          } catch (error) {
            console.error(error);
          }

        }}
        style={{
          padding: "10px 15px",
          border: "none",
          borderRadius: 6,
          background: "#212121",
          color: "white",
          fontWeight: "bold"
        }}
      >
        Actualizar
      </button>

    </div>

    <div style={{
      fontSize: 12,
      color: "#555"
    }}>
      Inicio:
      {" "}
      {p.inicio?.toDate
        ? p.inicio.toDate().toLocaleString()
        : "-"}
    </div>

    <div style={{
      marginTop: 6,
      fontWeight: "bold",
      color: "#D32F2F"
    }}>
      ⏱ {

        (() => {

          if (!p.inicio?.toDate)
            return "00:00:00";

          const inicio =
            p.inicio.toDate();

          const diferencia =
            ahora - inicio;

          const horas =
            Math.floor(
              diferencia / 3600000
            );

          const minutos =
            Math.floor(
              (diferencia % 3600000)
              / 60000
            );

          const segundos =
            Math.floor(
              (diferencia % 60000)
              / 1000
            );

          return (
            String(horas).padStart(2, "0") +
            ":" +
            String(minutos).padStart(2, "0") +
            ":" +
            String(segundos).padStart(2, "0")
          );

        })()

      }
    </div>

    <div style={{
      marginTop: 8
    }}>
      🎯 Esperado:
      {" "}
      <b>{esperado}</b>
    </div>

    <div>
      📦 Real:
      {" "}
      <b>{real}</b>
    </div>

    <div style={{
      marginTop: 8,
      fontSize: 20,
      fontWeight: "bold"
    }}>
      {
        eficiencia >= 90
          ? "🟢"
          : eficiencia >= 70
          ? "🟡"
          : "🔴"
      }

      {" "}
      {eficiencia}%
    </div>

    <input
      type="number"
      placeholder="Cantidad OK"
      onChange={(e) => {
        p.cantidadFinal = e.target.value;
      }}
      style={{
        width: "100%",
        padding: 10,
        marginTop: 10,
        borderRadius: 6,
        border: "1px solid #ccc",
        boxSizing: "border-box"
      }}
    />

    <button
      onClick={async () => {

        try {

          const fin = new Date();

          const inicio =
            p.inicio?.toDate();

          const tiempoHoras =
            (fin - inicio) /
            (1000 * 60 * 60);

          const cantidadOK =
            p.cantidadFinal !==
            undefined
              &&
            p.cantidadFinal !==
            ""
              ? Number(p.cantidadFinal)
              : Number(
                  p.cantidad_actual || 0
                );

          const estandar =
            estandares.find(e => {

              const matchProc =
                normalizar(e.proceso) ===
                normalizar(p.proceso);

              const matchSub =
                normalizar(e.subproceso) ===
                normalizar(p.subproceso);

              const matchDet =
                !e.detalle ||
                normalizar(e.detalle) ===
                normalizar(p.detalle);

              return (
                matchProc &&
                matchSub &&
                matchDet
              );
            });

          let eficiencia = 0;

          if (
            estandar &&
            estandar.unidades_por_hora > 0 &&
            tiempoHoras > 0
          ) {

            const produccionEsperada =
              estandar.unidades_por_hora *
              tiempoHoras;

            eficiencia =
              (cantidadOK /
                produccionEsperada) * 100;
          }

          eficiencia =
            Math.min(
              Math.round(eficiencia),
              150
            );

          let colorEficiencia = "";

          if (eficiencia < 70) {
            colorEficiencia = "🔴";
          }
          else if (eficiencia < 90) {
            colorEficiencia = "🟡";
          }
          else {
            colorEficiencia = "🟢";
          }

          await addDoc(
            collection(db, "registros_produccion"),
            {
              operario: p.operario,
              proceso: p.proceso,
              subproceso: p.subproceso,
              detalle: p.detalle,

              ot: p.ot,

              cantidad_ok: Number(cantidadOK),

              inicio: p.inicio,
              fin: new Date(),

              tiempo_horas:
                Number(tiempoHoras.toFixed(2)),

              eficiencia,

              estado_eficiencia:
                colorEficiencia,

              fecha: new Date(),

              iniciado_por: p.iniciado_por,

              finalizado_por:
                usuarioSeleccionado?.nombre ||
                p.iniciado_por ||
                "SIN USUARIO"
            }
          );

          await deleteDoc(
            doc(db, "produccion_activa", p.id)
          );

          setProduccionActiva(
            prev =>
              prev.filter(
                item => item.id !== p.id
              )
          );

          alert("Producción finalizada ✅");

        } catch (error) {
          console.error(error);
        }

      }}
      style={{
        marginTop: 10,
        width: "100%",
        padding: 10,
        border: "none",
        borderRadius: 8,
        background: "#F44336",
        color: "white",
        fontWeight: "bold"
      }}
    >
      ⛔ Finalizar Producción
    </button>

    {!paroActivoProduccion && (
      <button
        onClick={async () => {

          setParoActivo(true);

          setProduccionSeleccionada(p);

        }}
        style={{
          marginTop: 10,
          padding: "8px 12px",
          border: "none",
          borderRadius: 8,
          background: "#D32F2F",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer",
          width: "100%"
        }}
      >
        ⛔ Detener
      </button>
    )}

    {paroActivoProduccion && (

      <button

        onClick={async () => {

          if (paroActivoProduccion) {

  await updateDoc(

    doc(
      db,
      "paros_produccion",
      paroActivoProduccion.id
    ),

    {
      estado: "finalizado",
      fin_paro: new Date()
    }

  );

}

await updateDoc(
  doc(
    db,
    "produccion_activa",
    p.id
  ),
  {
    estado: "activo",
    motivo_paro: "",
    inicio_paro: null
  }
);

await cargarParosActivos();

await cargarProduccionActiva();

          await updateDoc(
            doc(
              db,
              "produccion_activa",
              p.id
            ),
            {
              estado: "activo",
              motivo_paro: "",
              inicio_paro: null
            }
          );

          setProduccionActiva(prev =>
            prev.map(prod =>
              prod.id === produccionSeleccionada.id
                ? {
                    ...prod,
                    estado: "detenido",
                    motivo_paro: motivoParo,
                    inicio_paro: {
                    toDate: () => new Date()
                    }
                  }
                : prod
            )
          );

        }}

        style={{

          marginTop: 8,
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "none",
          background: "#2E7D32",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer"

        }}

      >

        ▶️ Reanudar

      </button>

    )}

    {paroActivo && produccionSeleccionada?.operario === p.operario && (

      <div style={{
        marginTop: 15,
        background: "white",
        padding: 15,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
      }}>

        <div style={{
          fontWeight: "bold",
          marginBottom: 10
        }}>
          ⛔ Registrar Paro
        </div>

        <select
          value={motivoParo}
          onChange={(e) =>
            setMotivoParo(e.target.value)
          }
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc"
          }}
        >

          <option value="">
            Seleccionar motivo
          </option>

          <option>
            Falla de máquina
          </option>

          <option>
            Falta de energía
          </option>

          <option>
            Cambio de material
          </option>

          <option>
            Espera suministro
          </option>
 
          <option>
            Ajuste / calibración
          </option>

          <option>
            Limpieza
          </option>

          <option>
            Mantención
          </option>

          <option>
            Otros
          </option>

        </select>

        <div style={{
          display: "flex",
          gap: 10,
          marginTop: 12
        }}>

          <button
            onClick={() => {

              setParoActivo(false);

              setMotivoParo("");

            }}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "none",
              background: "#BDBDBD",
              color: "white",
              fontWeight: "bold"
            }}
          >
            Cancelar
          </button>

          <button
            onClick={async () => {

              if (!motivoParo) {

                alert("Selecciona motivo");

                return;

              }

              await addDoc(

                collection(db, "paros_produccion"),

                {

                  operario:
                    produccionSeleccionada.operario,

                  ot:
                    produccionSeleccionada.ot,

                  proceso:
                    produccionSeleccionada.proceso,

                  subproceso:
                    produccionSeleccionada.subproceso,

                  detalle:
                    produccionSeleccionada.detalle || "",

                  motivo:
                    motivoParo,

                  inicio_paro:
                    new Date(),

                  estado:
                    "activo"

                }

              );

              await updateDoc(
                doc(
                  db,
                  "produccion_activa",
                  produccionSeleccionada.id
                ),
                {
                  estado: "detenido",

                  motivo_paro: motivoParo,

                  inicio_paro: new Date()
                }
              );

              await cargarProduccionActiva();

              await cargarParosActivos();

              setParoActivo(false);

              setMotivoParo("");

            }}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "none",
              background: "#D32F2F",
              color: "white",
              fontWeight: "bold"
            }}
          >
            Guardar
          </button>

        </div>

      </div>

    )}

  </div>

  );
})}

      </div>

      {/* VOLVER */}
      <button
  onClick={() => setPantalla("home")}
  style={{
    padding: "15px 40px",
    fontSize: 18,
    borderRadius: 12,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 30
  }}
>
  ⬅ Volver
</button>

    </div>
  );
}

if (pantalla === "ot") {
  return (
    <div style={{ padding: 20 }}>

      <h2>📋 Órdenes de Trabajo</h2>

      {ots.map((ot, i) => (
        <div
          key={i}
          onClick={() => {
            setOtDetalle(ot);
            setPantalla("otDetalle");
          }}
          style={{
            padding: 15,
            marginBottom: 10,
            background: "white",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer"
          }}
        >
          <b>{ot.nombre}</b>
          <div>Cantidad: {ot.cantidad}</div>
          <div>
            Entrega: {formatearFecha(ot.fecha_entrega)}
          </div>
        </div>
      ))}

      <button
  onClick={() => setPantalla("home")}
  style={{
    padding: "15px 40px",
    fontSize: 18,
    borderRadius: 12,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 30
  }}
>
  ⬅ Volver
</button>

    </div>
  );
}

if (pantalla === "otDetalle") {

  const esMobile = window.innerWidth < 768;

  if (dashboard.length === 0) {

    return (

      <div style={{
        padding: 40,
        fontSize: 24,
        fontWeight: "bold"
      }}>

        ⏳ Cargando datos...

      </div>

    );

  }

  return (

    <div style={{
      display: "grid",
      gridTemplateColumns: esMobile
      ? "1fr"
      : "260px 1fr",
      minHeight: "100vh",
      background: "#f4f6f8",
      fontFamily: "Arial"
    }}>

    {/* SIDEBAR */}

    <div style={{
      background: "#111827",
      color: "white",
      padding: esMobile ? 12 : 20
    }}>

      <h2 style={{
        marginBottom: 30
      }}>
        📋 BBA MES
      </h2>

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}>

        <button
          onClick={() => setPantalla("home")}
          style={{
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          🏠 Inicio
        </button>

        <button
          onClick={() => setPantalla("ot")}
          style={{
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#374151",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📋 OT
        </button>

      </div>

    </div>

    {/* CONTENIDO */}

    <div style={{
      padding: 20
    }}>

      <h2 style={{
        fontSize: esMobile ? 22 : 34,
        marginBottom: 10
      }}>
        📦 Detalle Orden de Trabajo
      </h2>

      <button
        onClick={() => {

          setModoEditarOT(
            !modoEditarOT
          );

          setEditarCantidadOT(
            otDetalle.cantidad || ""
          );

          setEditarFechaEntregaOT(
            fechaParaInput(
              otDetalle.fecha_entrega
            )
          );

          setEditarEstadoOT(
            otDetalle.estado || "activa"
          );

        }}

        style={{
          background: "#FF9800",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: 10,
          marginBottom: 20,
          fontWeight: "bold"
        }}
      >

        ✏️ Editar OT

      </button>

      {otDetalle && (
        <>
          <h3 style={{
            fontSize: esMobile ? 18 : 28,
            marginBottom: 10,
            marginTop: 10,
            color: "#212121"
          }}>
            {otDetalle.nombre}
          </h3>

          {(() => {

          const objetivoOT =
            otDetalle.cantidad || 1;

          const registrosOT =
            dashboard.filter(
              r =>
                normalizar(r.ot) ===
                normalizar(otDetalle.nombre)
            );  
          
            const avancesProcesos =
            otDetalle.procesos?.map((p) => {

              const subprocesos =
                p.subproceso || [];

              const avancesSubprocesos =
                subprocesos.map((s) => {

                  const detalles =
                    s.detalles || [];

                  const avancesDetalles =
                    detalles.map((d) => {

                      const registros =
                        dashboard.filter(r =>

                          normalizar(r.ot) ===
                          normalizar(otDetalle.nombre)

                          &&

                          normalizar(r.proceso) ===
                          normalizar(p.nombre)

                          &&

                          normalizar(r.subproceso) ===
                          normalizar(s.nombre)

                          &&

                          normalizar(r.detalle) ===
                          normalizar(d.nombre)

                        );

                      const producido =
                        registros.reduce(
                          (acc, r) =>
                           acc + (r.cantidad_ok || 0),
                          0
                        );

                      const objetivo =
                        d.cantidad_objetivo || 1;

                      const avance =
                        (producido / objetivo) * 100;

                      return Math.min(avance, 100);

                    });

                  if (avancesDetalles.length === 0) {
                    return 0;
                  }

                  return (
                    avancesDetalles.reduce(
                      (a, b) => a + b,
                     0
                    ) / avancesDetalles.length
                  );

                });

              if (avancesSubprocesos.length === 0) {
                return 0;
              }

              return (
                avancesSubprocesos.reduce(
                  (a, b) => a + b,
                  0
                ) / avancesSubprocesos.length
              );

            }) || [];

          const avanceOT =
            avancesProcesos.length > 0
              ? Math.round(

                  avancesProcesos.reduce(
                    (a, b) => a + b,
                    0
                  ) / avancesProcesos.length

                )
              : 0;

          const producidoOT =
            Math.round(
              (avanceOT / 100) * objetivoOT
            );

          const pendienteOT =
            objetivoOT - producidoOT;

          // PRIMER REGISTRO DE LA OT

          const registrosOrdenados =
            registrosOT
              .filter(r => r.fecha?.toDate)
              .sort(
                (a, b) =>
                  a.fecha.toDate() -
                  b.fecha.toDate()
              );

          const primerRegistro =
            registrosOrdenados[0];

          // HORAS TRABAJADAS

          let horasTrabajadas = 0;

          if (primerRegistro?.fecha?.toDate) {

  horasTrabajadas =
    (
      new Date() -
      primerRegistro.fecha.toDate()
    ) / 3600000;

          }

          // VELOCIDAD REAL

          const velocidadHora =
            horasTrabajadas > 0
              ? producidoOT / horasTrabajadas
              : 0;

          // HORAS RESTANTES

          const horasRestantes =
            velocidadHora > 0
              ? pendienteOT / velocidadHora
              : 0;

          // FECHA ESTIMADA

          let etaTexto = "Sin datos";

          if (
            velocidadHora > 0 &&
            isFinite(horasRestantes)
          ) {

          const fechaEstimada =
            new Date(
              Date.now() +
              horasRestantes * 3600000
            );

            etaTexto =
              fechaEstimada.toLocaleString();

          }

          const procesoCritico =
            otDetalle.procesos?.map((p) => {

              const subprocesos =
                p.subproceso || [];

              const avancesSubprocesos =
                subprocesos.map((s) => {

                  const detalles =
                    s.detalles || [];

                  const avancesDetalles =
                    detalles.map((d) => {

                      console.log("REGISTRO REAL DASHBOARD");
                      console.log(dashboard[0]);
                      
                      const registros =
                        dashboard.filter(r =>

                          normalizar(r.ot) ===
                          normalizar(otDetalle.nombre)

                          &&

                          normalizar(r.proceso) ===
                          normalizar(p.nombre)

                          &&

                          normalizar(r.subproceso) ===
                          normalizar(s.nombre)

                          &&

                          normalizar(r.detalle) ===
                          normalizar(d.nombre)

                        );

                      const producido =
                        registros.reduce(
                          (acc, r) =>
                            acc + (r.cantidad_ok || 0),
                          0
                        );

                      const objetivo =
                        d.cantidad_objetivo || 1;

                      return Math.min(
                        (producido / objetivo) * 100,
                        100
                      );

                    });

                  if (avancesDetalles.length === 0) {
                    return 0;
                  }

                  return (
                    avancesDetalles.reduce(
                      (a, b) => a + b,
                      0
                    ) / avancesDetalles.length
                  );

                });

              const avanceProceso =
                avancesSubprocesos.length > 0
                  ? avancesSubprocesos.reduce(
                      (a, b) => a + b,
                      0
                    ) / avancesSubprocesos.length
                  : 0;

              return {
                proceso: p.nombre,
                avance: Math.round(avanceProceso)
              };

            })

            .sort((a, b) =>
              a.avance - b.avance
            )[0];
          
            let colorOT = "#E8F5E9";

          if (avanceOT < 70) {
            colorOT = "#FFCDD2";
          }
          else if (avanceOT < 90) {
            colorOT = "#FFF9C4";
          }

          let estadoOT = "🟢 En Tiempo";

          if (
            otDetalle.estado === "cerrada"
          ) {

            estadoOT = "⚫ Cerrada";

          }

          else {

            const fechaEntrega =
              otDetalle.fecha_entrega

                ? convertirFecha(
                    otDetalle.fecha_entrega
                  )

                : null;

            const hoy = new Date();

            const diasRestantes =
              fechaEntrega

                ? (
                    fechaEntrega - hoy
                  ) / 86400000

                : null;

            if (avanceOT < 50) {

              estadoOT = "🔴 Atrasada";

            }

            else if (

              avanceOT < 80 ||

              (
                diasRestantes !== null
                &&
                diasRestantes < 3
              )

            ) {

              estadoOT = "🟡 En Riesgo";

            }

          }

          const alertasOT = [];

          if (

            pendienteOT > 0

            &&

            horasRestantes > 48

          ) {

            alertasOT.push({
              tipo: "warning",
              mensaje:
                "⚠️ Producción pendiente alta"
            });

          }

          if (

            otDetalle.estado === "pausada"

          ) {

            alertasOT.push({
              tipo: "warning",
              mensaje:
                "⏸️ OT pausada"
            });

          }

          return (

            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 20,
              marginBottom: 25
            }}>

              {/* AVANCE */}
              <div style={{
                background: colorOT,
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>

                  <div style={{
                    fontSize: 14,
                    color: "#666"
                  }}>
                    Avance General
                  </div>

                  <div style={{
                    fontSize: 13,
                    fontWeight: "bold",
                    padding: "4px 10px",
                    borderRadius: 20,
                    background:
                      avanceOT >= 80
                        ? "#C8E6C9"
                        : avanceOT >= 50
                        ? "#FFF9C4"
                        : "#FFCDD2",
                    color:
                      avanceOT >= 80
                        ? "#2E7D32"
                        : avanceOT >= 50
                        ? "#F57F17"
                        : "#C62828"
                  }}>
                    {estadoOT}
                  </div>

                </div>

                <div style={{
                  marginTop: esMobile ? 8 : 16,
                }}>

                  {/* TEXTO */}
                  <div style={{
                    fontSize: 34,
                    fontWeight: "bold",
                    marginBottom: 10
                  }}>
                    {
                      avanceOT >= 90
                        ? "🟢"
                        : avanceOT >= 70
                        ? "🟡"
                        : "🔴"
                    }

                    {" "}
                    {avanceOT}%
                  </div>

                  {/* BARRA */}
                  <div style={{
                    width: "100%",
                    height: 18,
                    background: "#E0E0E0",
                    borderRadius: 20,
                    overflow: "hidden"
                  }}>

                    <div style={{
                      width: `${avanceOT}%`,
                      height: "100%",
                      borderRadius: 20,
                      transition: "0.4s",

                      background:
                        avanceOT >= 90
                          ? "#4CAF50"
                          : avanceOT >= 70
                          ? "#FFC107"
                          : "#F44336"
                    }} />

                  </div>

                </div>

              </div>

              {/* CUELLO DE BOTELLA */}
              <div style={{
                background: "#FFEBEE",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  🚨 Proceso Crítico
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#C62828"
                }}>
                  {procesoCritico?.proceso || "-"}
                </div>

                <div style={{
                  marginTop: 8,
                  fontSize: 30,
                  fontWeight: "bold"
                }}>
                  🔴 {procesoCritico?.avance || 0}%
                </div>

              </div>
              
              {/* OBJETIVO */}
              <div style={{
                background: "#FFFFFF",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  Objetivo
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 34,
                  fontWeight: "bold"
                }}>
                  {objetivoOT}
                </div>

              </div>

              {/* PRODUCIDO */}
              <div style={{
                background: "#E8F5E9",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  Producido
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 34,
                  fontWeight: "bold",
                  color: "#2E7D32"
                }}>
                  {producidoOT}
                </div>

              </div>

              {/* FALTANTE */}
              <div style={{
                background: "#FFEBEE",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  Pendiente
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 34,
                  fontWeight: "bold",
                  color: "#C62828"
                }}>
                  {pendienteOT}
                </div>

              </div>

              {/* ETA */}
              <div style={{
                background: "#E3F2FD",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  ETA Producción
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 18,
                  fontWeight: "bold",
                  color: "#1565C0"
                }}>
                  ⏳ {etaTexto}
                </div>

              </div>

{alertasOT.length > 0 && (

  <div style={{
    marginBottom: 20
  }}>

    {alertasOT.map((a, i) => (

      <div
        key={i}
        style={{
          background:

            a.tipo === "critico"

              ? "#B71C1C"

              : "#F9A825",

          color: "white",

          padding: 14,

          borderRadius: 12,

          marginBottom: 10,

          fontWeight: "bold",

          fontSize: 16
        }}
      >

        {a.mensaje}

      </div>

    ))}

  </div>

)}            

            </div>

          );

        })()}

          <p><b>Cantidad:</b> {otDetalle.cantidad}</p>

<div style={{
  marginTop: 25
}}>

  <h3>
    🧩 Estructura Producto
  </h3>

  {

    Array.isArray(
      otDetalle.estructura_producto
    )

    &&

    otDetalle.estructura_producto.length > 0

      ? (

        otDetalle.estructura_producto.map(
          (e, i) => (

            <div
              key={i}
              style={{
                background: "#FFFFFF",
                padding: 14,
                borderRadius: 14,
                marginBottom: 12,
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.06)"
              }}
            >

              <div style={{
                fontWeight: "bold",
                fontSize: 18
              }}>
                ⚙️ {e.operacion}
              </div>

              <div style={{
                marginTop: 8,
                color: "#555"
              }}>

                🧱 Material:
                {" "}
                {e.material || "-"}

              </div>

              <div style={{
                marginTop: 6,
                color: "#555"
              }}>

                📏 Medida:
                {" "}
                {e.medida || "-"}

              </div>

              <div style={{
                marginTop: 6,
                color: "#555"
              }}>

                🔢 Cantidad:
                {" "}
                {e.cantidad || 0}

              </div>

              <div style={{
                marginTop: 6,
                color: "#555"
              }}>

                ⚡ Unidades/Hora:
                {" "}
                {e.unidades_hora || 0}

              </div>

            </div>

          )

        )

      )

      : (

        <div style={{
          color: "#999",
          marginTop: 10
        }}>

          Sin estructura definida

        </div>

      )

  }

</div>

          <p>
            <b>Fecha Entrega:</b>{" "}
            {formatearFecha(otDetalle.fecha_entrega)}
          </p>
          {modoEditarOT && (

  <div style={{
    background: "#FFF8E1",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20
  }}>

    <h3>
      ✏️ Editar OT
    </h3>

    <input
      type="number"
      placeholder="Cantidad"
      style={estiloInput}
      value={editarCantidadOT}
      onChange={(e) =>
        setEditarCantidadOT(
          e.target.value
        )
      }
    />

    <div style={{
      marginBottom: 15
    }}>

      <label style={{
        fontWeight: "bold",
        display: "block",
        marginBottom: 5
      }}>

        🚚 Fecha Entrega

      </label>

      <input
        type="date"
        style={estiloInput}
        value={editarFechaEntregaOT}
        onChange={(e) =>
          setEditarFechaEntregaOT(
            e.target.value
          )
        }
      />

    </div>

    <select
      style={estiloInput}
      value={editarEstadoOT}
      onChange={(e) =>
        setEditarEstadoOT(
          e.target.value
        )
      }
    >

      <option value="activa">
        Activa
      </option>

      <option value="pausada">
        Pausada
      </option>

      <option value="cerrada">
        Cerrada
      </option>

    </select>

    <button
      style={botonVerde}

      onClick={async () => {

        try {

          await updateDoc(

            doc(
              db,
              "ordenes_trabajo",
              otDetalle.id
            ),

            {

              cantidad:
                Number(
                  editarCantidadOT
                ),

              fecha_entrega:
                editarFechaEntregaOT,

              estado:
                editarEstadoOT

            }

          );

          alert(
            "✅ OT actualizada"
          );

          setModoEditarOT(false);

          cargarDatos();

        }

        catch (error) {

          console.error(error);

          alert(
            "Error actualizando OT"
          );

        }

      }}
    >

      💾 Guardar Cambios

    </button>

  </div>

)}
          <h3>Procesos</h3>

          {otDetalle.procesos?.map((p, i) => {

            const subprocesosProceso =
              p.subproceso || [];

            const objetivoProceso =
              subprocesosProceso.reduce((acc, s) => {

                const detalles =
                  s.detalles || [];

                const total =
                  detalles.reduce(
                    (a, d) =>
                      a + (d.cantidad_objetivo || 0),
                    0
                  );

                return acc + total;

              }, 0);

            const producidoProceso =
              subprocesosProceso.reduce((acc, s) => {

                const detalles =
                  s.detalles || [];

                const total =
                  detalles.reduce((a, d) => {

                    const registros =
                      dashboard.filter(r =>

                        normalizar(r.ot) ===
                        normalizar(otDetalle.nombre)

                        &&

                        normalizar(r.proceso) ===
                        normalizar(p.nombre)

                        &&

                        normalizar(r.subproceso) ===
                        normalizar(s.nombre)

                        &&

                        normalizar(r.detalle) ===
                        normalizar(d.nombre)

                      );

                    const producido =
                      registros.reduce(
                        (x, r) =>
                          x + (r.cantidad_ok || 0),
                        0
                      );

                    return a + producido;

                  }, 0);

                return acc + total;

              }, 0);

            const avanceProceso =
              objetivoProceso > 0
                ? Math.round(
                    (producidoProceso / objetivoProceso) * 100
                  )
                : 0;

            return (

              <div
                key={i}
                style={{
                  marginBottom: esMobile ? 8 : 15,
                  padding: 12,
                  background: "#f4f6f8",
                  borderRadius: 8
                }}
              >

        {/* PROCESO */}
        <div
              onClick={() => {

                if (procesoAbierto === i) {
                  setProcesoAbierto(null);
                } else {
                  setProcesoAbierto(i);
                }

              }}
              style={{
                background: "#FFFFFF",
                padding: 12,
                borderRadius: 12,
                marginBottom: esMobile ? 8 : 20,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #E0E0E0"
              }}
            >

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14
            }}>

              <div>

                <div style={{
                  fontWeight: "bold",
                  fontSize: 24,
                  color: "#212121"
                }}>
                  🔧 {p.nombre}
                </div>

                <div style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "#666"
                }}>
                  Objetivo: {objetivoProceso}
                  {" • "}
                  Producido: {producidoProceso}
                </div>

              </div>

              <div style={{
                fontWeight: "bold",
                fontSize: 24
              }}>
                {
                  avanceProceso >= 90
                    ? "🟢"
                    : avanceProceso >= 70
                    ? "🟡"
                    : "🔴"
                }

                {" "}
                {avanceProceso}%
              </div>

            </div>

      {procesoAbierto === i && (

        <div style={{
          marginTop: 15
        }}>

          <div style={{
            display: "grid",
            gridTemplateColumns: esMobile
              ? "1fr"
              : "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 16,
            marginTop: 10
          }}>

            {p.subproceso?.map((s, j) => {

              const detalles =
                s.detalles || [];

              const totalObjetivo =
                detalles.reduce(
                  (acc, d) =>
                    acc + (d.cantidad_objetivo || 0),
                  0
                );
              if (!s.detalles || s.detalles.length === 0) {
                return null;
              }

              const totalProducido =
                detalles.reduce((acc, d) => {

                  const registros =
                    dashboard.filter(r =>

                      normalizar(r.ot) ===
                      normalizar(otDetalle.nombre)

                      &&

                      normalizar(r.proceso) ===
                      normalizar(p.nombre)

                      &&

                      normalizar(r.subproceso) ===
                      normalizar(s.nombre)

                      &&

                      normalizar(r.detalle) ===
                      normalizar(d.nombre)

                    );

                  const producido =
                    registros.reduce(
                      (a, r) =>
                        a + (r.cantidad_ok || 0),
                      0
                    );

                  return acc + producido;

                }, 0);

              const avanceSubproceso =
                totalObjetivo > 0
                  ? Math.round(
                      (totalProducido / totalObjetivo) * 100
                    )
                  : 0;

              let colorSubproceso = "#E8F5E9";

              if (avanceSubproceso < 70) {
                colorSubproceso = "#FFCDD2";
              }
              else if (avanceSubproceso < 90) {
                colorSubproceso = "#FFF9C4";
              }

            return (

            <div
              key={j}
              style={{
                background: "#FFFFFF",
                padding: esMobile ? 8 : 12,
                borderRadius: 18,
                width: esMobile ? "95%" : "100%",
                maxWidth: esMobile ? 380 : "100%",
                margin: esMobile ? "0 auto" : "0",
                marginBottom: esMobile ? 2 : 6,

                borderLeft: `8px solid ${
                  avanceSubproceso >= 90
                    ? "#4CAF50"
                    : avanceSubproceso >= 70
                    ? "#FFC107"
                    : "#F44336"
                }`,

                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",

                transition: "all 0.25s ease"
              }}
            >

              <div style={{
                display: "flex",
                flexDirection: esMobile ? "column" : "row",
                justifyContent: "space-between",
                alignItems: esMobile ? "flex-start" : "center",
                marginBottom: 6,
                gap: esMobile ? 6 : 0
              }}>

                <div style={{
                   fontWeight: "bold",
                   fontSize: esMobile ? 16 : 18,
                   alignSelf: esMobile ? "flex-end" : "auto"
                }}>
                  ⚙ {s.nombre}
                </div>

                <div style={{
                   fontWeight: "bold",
                   fontSize: 18
                }}>
                  {
                    avanceSubproceso >= 90
                      ? "🟢"
                      : avanceSubproceso >= 70
                      ? "🟡"
                      : "🔴"
                  }
  
                  {" "}
                  {avanceSubproceso}%
                </div>

              </div>

              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12
              }}>
  
              {s.detalles?.map((d, k) => {  

                const registrosDetalle =
                  dashboard.filter(r =>

                    normalizar(r.ot) ===
                    normalizar(otDetalle.nombre)

                    &&

                    normalizar(r.proceso) ===
                    normalizar(p.nombre)

                    &&

                    normalizar(r.subproceso) ===
                    normalizar(s.nombre)

                    &&

                    normalizar(r.detalle) ===
                    normalizar(d.nombre)    

                  );

                const producido =
                  registrosDetalle.reduce(
                    (acc, r) =>
                      acc + (r.cantidad_ok || 0),
                    0
                  );

                const objetivo =
                  d.cantidad_objetivo || 1;

                const avance =
                  Math.round(
                    (producido / objetivo) * 100
                  );

                let colorAvance = "#E8F5E9";

                if (avance < 70) {
                  colorAvance = "#FFCDD2";
                }
                else if (avance < 90) {
                  colorAvance = "#FFF9C4";
                }

                return (

                <div
                   key={k}
                   style={{
                     background: colorAvance,
                     padding: esMobile ? 2 : 8,
                     borderRadius: 14,
                     marginBottom: 6,
                     width: esMobile ? "92%" : 220,
                     maxWidth: esMobile ? 320 : 220,
                     margin: esMobile ? "0 auto" : "0",
                     border: "1px solid rgba(0,0,0,0.08)",
                     boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
                  }}
                >

                  <div>
                    <div style={{
                      fontSize: esMobile ? 11 : 20,
                      fontWeight: "bold",
                      marginBottom: 8
                    }}>
                      📦 {d.nombre}
                    </div>
                  </div>

                  <div style={{
                    marginTop: 6,
                    fontSize: esMobile ? 13 : 16,
                    color: "#333"
                  }}>
                    🧱 {d.material || "-"}
                    {" • "}
                    📏 {d.medida || "-"}
                  </div>

                  <div style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    gap: esMobile ? 10 : 20,
                    marginTop: 10
                  }}>

                  <div>
                    <div style={{
                      fontSize: 12,
                      color: "#666"
                    }}>
                      Objetivo
                    </div>

                    <div style={{
                      fontWeight: "bold",
                      fontSize: 18
                    }}>
                      {objetivo}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: 12,
                      color: "#666"
                    }}>
                      Producido
                    </div>

                    <div style={{
                      fontWeight: "bold",
                      fontSize: 18
                    }}>
                     {producido}
                    </div>
                  </div>

                  </div>

                  <div style={{
                    marginTop: esMobile ? 8 : 16,
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: esMobile ? 4 : 10,
                    fontSize: esMobile ? 14 : 24,
                    fontWeight: "bold"
                  }}>

                  <span>
                    {
                      avance >= 90
                        ? "🟢"
                        : avance >= 70
                        ? "🟡"
                        : "🔴"
                    }
                  </span>

                    <span>
                    Avance {avance}%
                    </span>

                  </div>
                </div>

                );
              })}

              </div>

            </div>
            );
            })}
          </div>
        </div>
      )}
        </div>
              </div>
            );
})}    

      </>

      )}
</div>
      <button
  onClick={() => setPantalla("ot")}
  style={{
    padding: esMobile ? "10px 18px" : "15px 40px",
    fontSize: esMobile ? 14 : 18,
    width: esMobile ? "auto" : "auto",
    minWidth: esMobile ? 140 : 220,
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    borderRadius: 12,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 30
  }}
>
  ⬅ Volver
</button>

    </div>
  );
}

  if (pantalla === "avanceOT") {

    return (

      <div style={{
        padding: 20,
        background: "#f4f6f8",
        minHeight: "100vh",
        fontFamily: "Arial"
      }}>

        <h2>📋 Avance OT</h2>

        <select
          onChange={(e) => {

            const ot = ots.find(
              o => o.nombre === e.target.value
            );

            setOtDetalle(ot);

          }}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 20
          }}
        >
          <option value="">
            Seleccionar OT
          </option>

          {ots.map((ot, i) => (
            <option
              key={i}
              value={ot.nombre}
            >
              {ot.nombre}
            </option>
          ))}

        </select>

        {otDetalle && (

          <div>

            <h3>
              📦 {otDetalle.nombre}
            </h3>

            {(() => {

              const avances = otDetalle.procesos?.map((p) => {

                const registrosProceso =
                  dashboard.filter(r =>
                    normalizar(r.ot) ===
                    normalizar(otDetalle.nombre) &&

                    normalizar(r.proceso) ===
                    normalizar(p.nombre)
                  );

                const producido =
                  registrosProceso.reduce(
                    (acc, r) =>
                      acc + (r.cantidad_ok || 0),
                    0
                  );

                const objetivo =
                  otDetalle.cantidad || 1;

                const avance =
                  Math.round(
                    (producido / objetivo) * 100
                  );

                return {
                  proceso: p.nombre,
                  avance
                };

              });

              const cuello =
                avances.reduce((min, actual) =>
                  actual.avance < min.avance
                    ? actual
                    : min
                );

              return (

                <div style={{
                  background: "#FFCDD2",
                  padding: 15,
                  borderRadius: 10,
                  marginBottom: 20
                }}>

                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#C62828"
                  }}>
                    🚨 Cuello de Botella
                  </div>

                  <div style={{
                    marginTop: 10,
                    fontSize: 18
                  }}>
                    🔧 {cuello.proceso}
                  </div>

                  <div style={{
                    fontSize: 30,
                    fontWeight: "bold",
                    marginTop: 10
                  }}>
                    🔴 {cuello.avance}%
                  </div>

                </div>

              );

            })()}

            {otDetalle.procesos?.map((p, i) => {

              const subprocesosProceso =
              p.subproceso || [];

            const objetivoProceso =
              subprocesosProceso.reduce((acc, s) => {

                const detalles =
                  s.detalles || [];

    const total =
      detalles.reduce(
        (a, d) =>
          a + (d.cantidad_objetivo || 0),
        0
      );

    return acc + total;

  }, 0);

const producidoProceso =
  subprocesosProceso.reduce((acc, s) => {

    const detalles =
      s.detalles || [];

    const total =
      detalles.reduce((a, d) => {

        const registros =
          dashboard.filter(r =>

            normalizar(r.ot) ===
            normalizar(otDetalle.nombre)

            &&

            normalizar(r.proceso) ===
            normalizar(p.nombre)

            &&

            normalizar(r.subproceso) ===
            normalizar(s.nombre)

            &&

            normalizar(r.detalle) ===
            normalizar(d.nombre)

          );

        const producido =
          registros.reduce(
            (x, r) =>
              x + (r.cantidad_ok || 0),
            0
          );

        return a + producido;

      }, 0);

    return acc + total;

  }, 0);

const avanceProceso =
  objetivoProceso > 0
    ? Math.round(
        (producidoProceso / objetivoProceso) * 100
      )
    : 0;

              const registrosProceso =
                dashboard.filter(r =>
                  normalizar(r.ot) ===
                  normalizar(otDetalle.nombre) &&

                  normalizar(r.proceso) ===
                  normalizar(p.nombre)
                );

              const producido =
                registrosProceso.reduce(
                  (acc, r) =>
                    acc + (r.cantidad_ok || 0),
                  0
                );

              const objetivo =
                otDetalle.cantidad || 1;

              const avance =
                Math.round(
                  (producido / objetivo) * 100
                );

              let color = "#E8F5E9";

              if (avance < 70) {
                color = "#FFCDD2";
              }
              else if (avance < 90) {
                color = "#FFF9C4";
              }

              return (

                <div
                  key={i}
                  style={{
                    background: color,
                    padding: 15,
                    borderRadius: 10,
                    marginBottom: 12
                  }}
                >

                  <div style={{
                    fontWeight: "bold",
                    fontSize: 18
                  }}>
                    🔧 {p.nombre}
                  </div>

                  <div style={{
                    marginTop: 8
                  }}>
                    🎯 Objetivo:
                    {" "}
                    <b>{objetivo}</b>
                  </div>

                  <div>
                    📦 Producido:
                    {" "}
                    <b>{producido}</b>
                  </div>

                  <div style={{
                    marginTop: 10,
                    fontSize: 24,
                    fontWeight: "bold"
                  }}>
                    {
                      avance >= 90
                        ? "🟢"
                        : avance >= 70
                        ? "🟡"
                        : "🔴"
                    }

                    {" "}
                    {avance}%
                  </div>

                </div>
              );
            })}

          </div>

        )}

        <button
          onClick={() => setPantalla("home")}
          style={{
            marginTop: 20,
            padding: "15px 30px",
            borderRadius: 10,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontWeight: "bold"
          }}
        >
          ⬅ Volver
        </button>

      </div>

    );
  }

  if (
    pantalla === "costosOperativosFijosV2" &&
    interfazV2Activa &&
    autenticacionFirebaseActiva &&
    puedeGestionarCosteoV2(usuarioSeleccionado)
  ) {
    return (
      <CostosOperativosFijosV2
        db={db}
        perfil={usuarioSeleccionado}
        onVolver={() => setPantalla("home")}
      />
    );
  }

  if (pantalla === "historialAjustes") {

    const ajustes =
      dashboard.filter(r =>

        r.tipo ===
        "ajuste_gerencial"

      );

    const ajustesPorDia = Object.values(

      ajustes.reduce((acc, a) => {

        const fecha =
          a.fecha?.toDate
            ? a.fecha
                .toDate()
                .toLocaleDateString()
            : "-";

        if (!acc[fecha]) {

          acc[fecha] = {

            fecha,

            cantidad: 0

          };

        }

        acc[fecha].cantidad +=
          a.cantidad_ok || 0;

        return acc;

      }, {})

    );

    const alertasGerenciales = [];

    const totalProduccion =
      dashboard.reduce(
        (acc, r) =>

          acc + (r.cantidad_ok || 0),

        0
      );

    const totalAjustes =
      ajustes.reduce(
        (acc, a) =>

          acc + (a.cantidad_ok || 0),

        0
      );

    const porcentajeAjustes =
      totalProduccion > 0

        ? (
            totalAjustes /
            totalProduccion
          ) * 100

        : 0;

    if (porcentajeAjustes > 5) {

      alertasGerenciales.push({

        tipo: "critico",

        mensaje:
          `🚨 Ajustes superan ${porcentajeAjustes.toFixed(1)}% de la producción`

      });

    }

    const operarioCritico =
      Object.entries(

        ajustes.reduce((acc, a) => {

          const op =
            a.operario || "-";

          acc[op] =
            (acc[op] || 0)
            +
            (a.cantidad_ok || 0);

          return acc;

        }, {})

      )

      .sort((a, b) =>
        b[1] - a[1]
      )[0];

    if (

      operarioCritico

      &&

      operarioCritico[1] > 50

    ) {

      alertasGerenciales.push({

        tipo: "warning",

        mensaje:
          `⚠️ ${operarioCritico[0]} supera 50 unidades ajustadas`

      });

    }

    return (

      <div style={{
        padding: 20
      }}>

        <h2>
          🛠 Historial Ajustes
        </h2>

        {alertasGerenciales.length > 0 && (

          <div style={{
            marginTop: 20,
            marginBottom: 20
          }}>

            {alertasGerenciales.map((a, i) => (

              <div
                key={i}
                style={{
                  background:

                    a.tipo === "critico"

                      ? "#B71C1C"

                      : "#F9A825",

                  color: "white",

                  padding: 15,

                  borderRadius: 12,

                  marginBottom: 10,

                 fontWeight: "bold",

                 fontSize: 16
                }}
              >

                {a.mensaje}

              </div>

            ))}

          </div>

        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 15,
          marginTop: 20,
          marginBottom: 25
        }}>  

          {/* TOTAL AJUSTADO */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
          }}>

              🛠 Total Ajustado

            </div>

            <h1 style={{
              margin: "10px 0 0 0",
              color: "#6A1B9A"
            }}>

              {

                ajustes.reduce(
                  (acc, a) =>

                    acc + (a.cantidad_ok || 0),

                  0
                )

              }

            </h1>

          </div>

          {/* % AJUSTE */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
            }}>

              📦 % Ajuste

            </div>

            <h1 style={{
              margin: "10px 0 0 0",
              color: "#D32F2F"
            }}>

              {

                (() => {

                  const totalProduccion =
                    dashboard.reduce(
                      (acc, r) =>

                        acc +
                        (r.cantidad_ok || 0),

                      0
                    );

                  const totalAjustes =
                    ajustes.reduce(
                      (acc, a) =>

                        acc +
                        (a.cantidad_ok || 0),

                      0
                    );

                  const porcentaje =
                    totalProduccion > 0

                      ? (
                          totalAjustes /
                          totalProduccion
                        ) * 100

                      : 0;

                  return `
                    ${porcentaje.toFixed(1)}%
                  `;

                })()

              }

            </h1>

          </div>

          {/* OPERARIO MÁS AJUSTADO */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
            }}>

              👤 Operario Más Ajustado

            </div>

            <h2 style={{
              margin: "10px 0 0 0",
              color: "#1976D2"
            }}>

              {

                Object.entries(

                  ajustes.reduce((acc, a) => {

                    const op =
                      a.operario || "-";

                    acc[op] =
                      (acc[op] || 0)
                      +
                      (a.cantidad_ok || 0);

                    return acc;

                  }, {})

                )

                .sort((a, b) =>
                  b[1] - a[1]
                )[0]?.[0]

                || "-"

              }

            </h2>

          </div>

          {/* PROCESO MÁS CORREGIDO */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
            }}>

              ⚙️ Proceso Más Corregido

            </div>

            <h2 style={{
              margin: "10px 0 0 0",
              color: "#F57C00"
            }}>

              {

                Object.entries(

                  ajustes.reduce((acc, a) => {

                    const proc =
                      a.proceso || "-";

                    acc[proc] =
                      (acc[proc] || 0)
                      +
                      (a.cantidad_ok || 0);

                    return acc;

                  }, {})

                )

                .sort((a, b) =>
                  b[1] - a[1]
                )[0]?.[0]

                || "-"

              }

            </h2>

          </div>

        </div>

        <div style={{
  background: "white",
  padding: 20,
  borderRadius: 14,
  marginBottom: 25
}}>

  <h3>
    📈 Tendencia Ajustes
  </h3>

  <div style={{
    width: "100%",
    height: 300
  }}>

    <ResponsiveContainer>

      <BarChart
        data={ajustesPorDia}
      >

        <XAxis
          dataKey="fecha"
        />

        <YAxis />

        <Tooltip />

        <Bar
          dataKey="cantidad"
          fill="#6A1B9A"
        />

      </BarChart>

    </ResponsiveContainer>

  </div>

</div>

        <div style={{
          overflowX: "auto"
        }}>

          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white"
          }}>

            <thead>

              <tr style={{
                background: "#6A1B9A",
                color: "white"
              }}>

                <th style={{ padding: 10 }}>
                  Fecha
                </th>

                <th style={{ padding: 10 }}>
                  Responsable
                </th>

                <th style={{ padding: 10 }}>
                  OT
                </th>

                <th style={{ padding: 10 }}>
                  Operario
                </th>

                <th style={{ padding: 10 }}>
                  Proceso
                </th>

                <th style={{ padding: 10 }}>
                  Subproceso
                </th>

                <th style={{ padding: 10 }}>
                  Detalle
                </th>

                <th style={{ padding: 10 }}>
                  Cantidad
                </th>

                <th style={{ padding: 10 }}>
                  Motivo
                </th>

              </tr>

            </thead>

            <tbody>

              {ajustes.map((a, i) => (

                <tr
                  key={i}
                  style={{
                    borderBottom:
                      "1px solid #ddd"
                  }}
                >

                  <td style={{ padding: 10 }}>

                    {
                      a.fecha?.toDate
                        ? a.fecha
                            .toDate()
                            .toLocaleString()
                        : "-"
                    }

                  </td>

                  <td style={{ padding: 10 }}>

                    {
                      a.responsable_ajuste
                      || "-"
                    }

                  </td>

                  <td style={{ padding: 10 }}>
                    {a.ot}
                  </td>

                  <td style={{ padding: 10 }}>
                    {a.operario}
                  </td>

                  <td style={{ padding: 10 }}>
                    {a.proceso}
                  </td>

                  <td style={{ padding: 10 }}>
                    {a.subproceso}
                  </td>
  
                  <td style={{ padding: 10 }}>
                    {a.detalle}
                  </td>

                  <td style={{
                    padding: 10,
                    fontWeight: "bold",
                    color: "#2E7D32"
                  }}>

                    +{a.cantidad_ok}

                  </td>

                  <td style={{ padding: 10 }}>

                    {
                      a.motivo_ajuste
                      || "-"
                    }

                  </td>

                </tr>
 
              ))}

            </tbody>

          </table>

        </div>

        <button
          onClick={() =>
            setPantalla("dashboard")
          }
          style={{
            ...botonAzul,
            marginTop: 20
          }}
        >

          ← Volver

        </button>

      </div>

    );

  }
  
  if (pantalla === "gestionOperarios") {

    const equiposBase = [
      "Alexis",
      "Pablo"
    ];

    const habilidadesDisponibles = [
      ...new Set(
        operarios.flatMap(o =>
          normalizarListaHabilidades(
            o.habilidades
          )
        )
      )
    ].sort((a, b) =>
      a.localeCompare(b)
    );

    const operariosGestion =
      operarios
        .slice()
        .sort((a, b) =>
          (a.nombre || "")
            .localeCompare(b.nombre || "")
        );

    const operariosFiltrados =
      operariosGestion.filter(o => {
        const activo =
          o.activo !== false;

        const pasaActivo =
          filtroActivoOperarios === "todos" ||
          (
            filtroActivoOperarios === "activos" &&
            activo
          ) ||
          (
            filtroActivoOperarios === "inactivos" &&
            !activo
          );

        const pasaEquipo =
          !filtroEquipoOperarios ||
          normalizar(o.equipo) ===
            normalizar(
              filtroEquipoOperarios
            );

        const habilidades =
          normalizarListaHabilidades(
            o.habilidades
          );

        const pasaHabilidad =
          !filtroHabilidadOperarios ||
          habilidades.some(h =>
            normalizar(h) ===
            normalizar(
              filtroHabilidadOperarios
            )
          );

        return (
          pasaActivo &&
          pasaEquipo &&
          pasaHabilidad
        );
      });

    const resumenEquipo = equipo => {
      const miembros =
        operariosGestion.filter(o =>
          normalizar(o.equipo) ===
          normalizar(equipo)
        );

      const activos =
        miembros.filter(o =>
          o.activo !== false
        );

      const habilidades =
        new Set(
          activos.flatMap(o =>
            normalizarListaHabilidades(
              o.habilidades
            )
          )
        );

      return {
        equipo,
        total: miembros.length,
        activos: activos.length,
        inactivos:
          miembros.length - activos.length,
        habilidades:
          habilidades.size
      };
    };

    const resumenEquipos =
      equiposBase.map(resumenEquipo);

    const sinEquipo =
      operariosGestion.filter(o =>
        !o.equipo
      );

    const brechasHabilidades =
      habilidadesDisponibles
        .map(habilidad => {
          const alexis =
            operariosGestion.filter(o =>
              o.activo !== false &&
              normalizar(o.equipo) ===
                "alexis" &&
              normalizarListaHabilidades(
                o.habilidades
              ).some(h =>
                normalizar(h) ===
                normalizar(habilidad)
              )
            ).length;

          const pablo =
            operariosGestion.filter(o =>
              o.activo !== false &&
              normalizar(o.equipo) ===
                "pablo" &&
              normalizarListaHabilidades(
                o.habilidades
              ).some(h =>
                normalizar(h) ===
                normalizar(habilidad)
              )
            ).length;

          return {
            habilidad,
            Alexis: alexis,
            Pablo: pablo,
            diferencia:
              Math.abs(alexis - pablo)
          };
        })
        .filter(item =>
          item.diferencia > 0 ||
          item.Alexis === 0 ||
          item.Pablo === 0
        )
        .sort((a, b) =>
          b.diferencia - a.diferencia
        );

    const guardarOperario = async operario => {
      const borrador =
        edicionesOperarios[operario.id] || {};

      const nombre =
        (
          borrador.nombre ??
          operario.nombre ??
          ""
        ).toString().trim();

      if (!nombre) {
        alert("Ingresa nombre del operario.");
        return;
      }

      try {
        await updateDoc(
          doc(db, "operarios", operario.id),
          {
            nombre,
            activo:
              borrador.activo ??
              (operario.activo !== false),
            equipo:
              borrador.equipo ??
              operario.equipo ??
              "",
            habilidades:
              normalizarListaHabilidades(
                borrador.habilidades ??
                operario.habilidades
              ),
            actualizado_por:
              usuarioSeleccionado?.nombre ||
              "SISTEMA",
            actualizado_en:
              new Date()
          }
        );

        setEdicionesOperarios(prev => {
          const siguiente = { ...prev };
          delete siguiente[operario.id];
          return siguiente;
        });

        await cargarDatos();

        alert("Operario actualizado ✅");
      } catch (error) {
        console.error(error);
        alert("Error actualizando operario");
      }
    };

    const agregarOperario = async () => {
      const nombre =
        nuevoOperarioNombre.trim();

      if (!nombre) {
        alert("Ingresa nombre del operario.");
        return;
      }

      try {
        await addDoc(
          collection(db, "operarios"),
          {
            nombre,
            activo: nuevoOperarioActivo,
            equipo: nuevoOperarioEquipo,
            habilidades:
              normalizarListaHabilidades(
                nuevoOperarioHabilidades
              ),
            creado_por:
              usuarioSeleccionado?.nombre ||
              "SISTEMA",
            creado_en:
              new Date()
          }
        );

        setNuevoOperarioNombre("");
        setNuevoOperarioEquipo("");
        setNuevoOperarioActivo(true);
        setNuevoOperarioHabilidades("");

        await cargarDatos();

        alert("Operario agregado ✅");
      } catch (error) {
        console.error(error);
        alert("Error agregando operario");
      }
    };

    return (

      <div style={{
        padding: 20,
        maxWidth: 1150,
        margin: "0 auto"
      }}>

        <h2>
          👥 Gestión de Operarios
        </h2>

        <p style={{
          color: "#555",
          lineHeight: 1.5
        }}>
          Administra estado activo, equipo y
          habilidades para balancear los grupos
          de Alexis y Pablo. Esta base queda lista
          para futuras sugerencias de IA sobre
          dotación y habilidades faltantes.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            esMobile ? "1fr" : "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 18
        }}>

          {resumenEquipos.map(resumen => (
            <div
              key={resumen.equipo}
              style={{
                background: "white",
                padding: 16,
                borderRadius: 14,
                boxShadow:
                  "0 2px 8px rgba(0,0,0,0.08)"
              }}
            >
              <b>Equipo {resumen.equipo}</b>
              <h2 style={{
                color: "#1976D2",
                marginBottom: 4
              }}>
                {resumen.activos}
                {" "}
                activos
              </h2>
              <div>
                Total: {resumen.total}
              </div>
              <div>
                Inactivos: {resumen.inactivos}
              </div>
              <div>
                Habilidades cubiertas:
                {" "}
                {resumen.habilidades}
              </div>
            </div>
          ))}

          <div style={{
            background: "#FFF8E1",
            color: "#5D4037",
            padding: 16,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <b>Sin equipo asignado</b>
            <h2 style={{
              marginBottom: 4
            }}>
              {sinEquipo.length}
            </h2>
            <div>
              Conviene asignarlos para que el
              balance sea real.
            </div>
          </div>

        </div>

        <div style={{
          background: "white",
          padding: 18,
          borderRadius: 14,
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 18
        }}>

          <h3>
            ➕ Agregar Operario
          </h3>

          <input
            style={estiloInput}
            placeholder="Nombre del operario"
            value={nuevoOperarioNombre}
            onChange={(e) =>
              setNuevoOperarioNombre(
                e.target.value
              )
            }
          />

          <select
            style={estiloInput}
            value={nuevoOperarioEquipo}
            onChange={(e) =>
              setNuevoOperarioEquipo(
                e.target.value
              )
            }
          >
            <option value="">
              Sin equipo
            </option>
            {equiposBase.map(equipo => (
              <option
                key={equipo}
                value={equipo}
              >
                Equipo {equipo}
              </option>
            ))}
          </select>

          <select
            style={estiloInput}
            value={
              nuevoOperarioActivo
                ? "true"
                : "false"
            }
            onChange={(e) =>
              setNuevoOperarioActivo(
                e.target.value === "true"
              )
            }
          >
            <option value="true">
              Activo
            </option>
            <option value="false">
              Inactivo
            </option>
          </select>

          <textarea
            style={{
              ...estiloInput,
              minHeight: 80
            }}
            placeholder="Habilidades separadas por coma. Ej: Soldadura Mig, Doblez, Corte"
            value={nuevoOperarioHabilidades}
            onChange={(e) =>
              setNuevoOperarioHabilidades(
                e.target.value
              )
            }
          />

          <button
            style={botonVerde}
            onClick={agregarOperario}
          >
            ✅ Agregar Operario
          </button>

        </div>

        <div style={{
          background: "white",
          padding: 18,
          borderRadius: 14,
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 18
        }}>

          <h3>
            🔎 Filtros
          </h3>

          <div style={{
            display: "grid",
            gridTemplateColumns:
              esMobile
                ? "1fr"
                : "repeat(3, 1fr)",
            gap: 12
          }}>

            <select
              style={estiloInput}
              value={filtroEquipoOperarios}
              onChange={(e) =>
                setFiltroEquipoOperarios(
                  e.target.value
                )
              }
            >
              <option value="">
                Todos los equipos
              </option>
              {equiposBase.map(equipo => (
                <option
                  key={equipo}
                  value={equipo}
                >
                  Equipo {equipo}
                </option>
              ))}
            </select>

            <select
              style={estiloInput}
              value={filtroHabilidadOperarios}
              onChange={(e) =>
                setFiltroHabilidadOperarios(
                  e.target.value
                )
              }
            >
              <option value="">
                Todas las habilidades
              </option>
              {habilidadesDisponibles.map(h => (
                <option
                  key={h}
                  value={h}
                >
                  {h}
                </option>
              ))}
            </select>

            <select
              style={estiloInput}
              value={filtroActivoOperarios}
              onChange={(e) =>
                setFiltroActivoOperarios(
                  e.target.value
                )
              }
            >
              <option value="activos">
                Solo activos
              </option>
              <option value="inactivos">
                Solo inactivos
              </option>
              <option value="todos">
                Todos
              </option>
            </select>

          </div>

          <div style={{
            color: "#555",
            fontWeight: "bold"
          }}>
            Operarios encontrados:
            {" "}
            {operariosFiltrados.length}
          </div>

        </div>

        <div style={{
          background: "#E3F2FD",
          color: "#0D47A1",
          padding: 16,
          borderRadius: 14,
          marginBottom: 18
        }}>
          <b>Lectura para IA y balance:</b>
          {" "}
          {brechasHabilidades.length === 0
            ? "Los equipos se ven balanceados por habilidades registradas."
            : "Hay habilidades con cobertura desigual entre Alexis y Pablo."}
          {brechasHabilidades
            .slice(0, 6)
            .map(item => (
              <div key={item.habilidad}>
                {item.habilidad}
                {": Alexis "}
                {item.Alexis}
                {" / Pablo "}
                {item.Pablo}
              </div>
            ))}
        </div>

        {operariosFiltrados.map(operario => {
          const borrador =
            edicionesOperarios[operario.id] || {};

          const nombre =
            borrador.nombre ??
            operario.nombre ??
            "";

          const activo =
            borrador.activo ??
            (operario.activo !== false);

          const equipo =
            borrador.equipo ??
            operario.equipo ??
            "";

          const habilidades =
            borrador.habilidades ??
            textoHabilidades(
              operario.habilidades
            );

          return (
            <div
              key={operario.id || operario.nombre}
              style={{
                background: "white",
                padding: 16,
                borderRadius: 14,
                boxShadow:
                  "0 2px 8px rgba(0,0,0,0.08)",
                marginBottom: 14,
                borderLeft:
                  activo
                    ? "6px solid #2E7D32"
                    : "6px solid #C62828"
              }}
            >

              <input
                style={estiloInput}
                value={nombre}
                onChange={(e) =>
                  setEdicionesOperarios(prev => ({
                    ...prev,
                    [operario.id]: {
                      ...prev[operario.id],
                      nombre: e.target.value
                    }
                  }))
                }
              />

              <div style={{
                display: "grid",
                gridTemplateColumns:
                  esMobile
                    ? "1fr"
                    : "1fr 1fr",
                gap: 12
              }}>

                <select
                  style={estiloInput}
                  value={activo ? "true" : "false"}
                  onChange={(e) =>
                    setEdicionesOperarios(prev => ({
                      ...prev,
                      [operario.id]: {
                        ...prev[operario.id],
                        activo:
                          e.target.value === "true"
                      }
                    }))
                  }
                >
                  <option value="true">
                    Activo
                  </option>
                  <option value="false">
                    Inactivo
                  </option>
                </select>

                <select
                  style={estiloInput}
                  value={equipo}
                  onChange={(e) =>
                    setEdicionesOperarios(prev => ({
                      ...prev,
                      [operario.id]: {
                        ...prev[operario.id],
                        equipo: e.target.value
                      }
                    }))
                  }
                >
                  <option value="">
                    Sin equipo
                  </option>
                  {equiposBase.map(item => (
                    <option
                      key={item}
                      value={item}
                    >
                      Equipo {item}
                    </option>
                  ))}
                </select>

              </div>

              <textarea
                style={{
                  ...estiloInput,
                  minHeight: 80
                }}
                value={habilidades}
                onChange={(e) =>
                  setEdicionesOperarios(prev => ({
                    ...prev,
                    [operario.id]: {
                      ...prev[operario.id],
                      habilidades: e.target.value
                    }
                  }))
                }
                placeholder="Habilidades separadas por coma"
              />

              <div style={{
                marginBottom: 10
              }}>
                {normalizarListaHabilidades(
                  habilidades
                ).map(h => (
                  <span
                    key={h}
                    style={{
                      display: "inline-block",
                      background: "#F1F8E9",
                      color: "#33691E",
                      padding: "4px 8px",
                      borderRadius: 20,
                      marginRight: 6,
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: "bold"
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              <button
                style={botonAzul}
                onClick={() =>
                  guardarOperario(operario)
                }
              >
                💾 Guardar Cambios
              </button>

            </div>
          );
        })}

        <button
          style={{
            ...botonVerde,
            marginTop: 8
          }}
          onClick={cargarDatos}
        >
          🔄 Recargar Operarios
        </button>

        <button
          onClick={() =>
            setPantalla("home")
          }
          style={botonAzul}
        >
          ← Volver
        </button>

      </div>

    );

  }

  if (pantalla === "evolucionOperario") {

    const colorEficiencia = eficiencia => {
      if (eficiencia === null) return "#E0E0E0";
      if (eficiencia >= 90) return "#2E7D32";
      if (eficiencia >= 70) return "#F9A825";
      return "#C62828";
    };

    const diasEvolucion = Array.from(
      { length: 30 },
      (_, index) => {
        const fecha = new Date();
        fecha.setHours(0, 0, 0, 0);
        fecha.setDate(
          fecha.getDate() - 29 + index
        );

        return {
          fecha,
          key: fechaParaInputLocal(fecha),
          label: fecha.toLocaleDateString(
            "es-CL",
            {
              day: "2-digit",
              month: "2-digit"
            }
          )
        };
      }
    );

    const registrosOperario =
      registrosEvolucionOperario
        .filter(r => !r.anulado)
        .filter(r =>
          normalizar(r.operario) ===
          normalizar(
            operarioEvolucionSeleccionado
          )
        )
        .filter(r =>
          r.tipo !== "ajuste_gerencial"
        )
        .filter(r =>
          Number.isFinite(
            Number(r.eficiencia)
          )
        );

    const registrosPorDia =
      registrosOperario.reduce((acc, r) => {
        const fecha =
          fechaDesdeValor(r.fecha);

        if (!fecha) return acc;

        const key =
          fechaParaInputLocal(fecha);

        if (!acc[key]) {
          acc[key] = {
            suma: 0,
            cantidad: 0
          };
        }

        acc[key].suma +=
          Number(r.eficiencia || 0);
        acc[key].cantidad += 1;

        return acc;
      }, {});

    const datosEvolucion =
      diasEvolucion.map(dia => {
        const dataDia =
          registrosPorDia[dia.key];

        const promedio =
          dataDia?.cantidad
            ? Number(
                (
                  dataDia.suma /
                  dataDia.cantidad
                ).toFixed(1)
              )
            : null;

        return {
          fecha: dia.label,
          fechaCompleta: dia.key,
          eficiencia:
            promedio === null ? 0 : promedio,
          promedio,
          registros:
            dataDia?.cantidad || 0,
          color:
            colorEficiencia(promedio)
        };
      });

    const diasConDatos =
      datosEvolucion.filter(d =>
        d.promedio !== null
      );

    const promedioLista = lista => {
      const validos =
        lista.filter(d =>
          d.promedio !== null
        );

      if (validos.length === 0) {
        return null;
      }

      return Number(
        (
          validos.reduce(
            (acc, d) =>
              acc + d.promedio,
            0
          ) / validos.length
        ).toFixed(1)
      );
    };

    const promedio30 =
      promedioLista(datosEvolucion);
    const promedioUltimos7 =
      promedioLista(
        datosEvolucion.slice(-7)
      );
    const promedioPrevios7 =
      promedioLista(
        datosEvolucion.slice(-14, -7)
      );

    const tendencia =
      promedioUltimos7 !== null &&
      promedioPrevios7 !== null
        ? Number(
            (
              promedioUltimos7 -
              promedioPrevios7
            ).toFixed(1)
          )
        : null;

    const mejorDia =
      diasConDatos
        .slice()
        .sort(
          (a, b) =>
            b.promedio - a.promedio
        )[0];

    const peorDia =
      diasConDatos
        .slice()
        .sort(
          (a, b) =>
            a.promedio - b.promedio
        )[0];

    const mensajeTendencia =
      tendencia === null
        ? "Aun no hay suficientes datos comparables."
        : tendencia >= 5
        ? `Mejora clara: +${tendencia}% vs los 7 dias anteriores.`
        : tendencia <= -5
        ? `Atencion: baja ${Math.abs(tendencia)}% vs los 7 dias anteriores.`
        : "Estable: variacion pequena vs los 7 dias anteriores.";

    return (

      <div style={{
        padding: 20,
        maxWidth: 1100,
        margin: "0 auto"
      }}>

        <h2>
          📈 Evolución Eficiencia Operario
        </h2>

        <p style={{
          color: "#555",
          lineHeight: 1.5
        }}>
          Vista para reuniones personales:
          muestra los últimos 30 días, con barras
          por fecha y color semáforo según la
          eficiencia promedio diaria.
        </p>

        <select
          style={estiloInput}
          value={operarioEvolucionSeleccionado}
          onChange={(e) =>
            setOperarioEvolucionSeleccionado(
              e.target.value
            )
          }
        >

          <option value="">
            Seleccionar operario
          </option>

          {operarios.map((o, i) => (
            <option
              key={i}
              value={o.nombre}
            >
              {o.nombre}
            </option>
          ))}

        </select>

        {cargandoEvolucionOperario && (
          <div style={{
            background: "#E3F2FD",
            color: "#0D47A1",
            padding: 14,
            borderRadius: 12,
            marginBottom: 16,
            fontWeight: "bold"
          }}>
            Cargando evolución...
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            esMobile
              ? "1fr"
              : "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20
        }}>

          <div style={{
            background: "white",
            padding: 16,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <b>Promedio 30 días</b>
            <h2 style={{
              color:
                colorEficiencia(promedio30),
              marginBottom: 0
            }}>
              {promedio30 ?? "-"}%
            </h2>
          </div>

          <div style={{
            background: "white",
            padding: 16,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <b>Últimos 7 días</b>
            <h2 style={{
              color:
                colorEficiencia(
                  promedioUltimos7
                ),
              marginBottom: 0
            }}>
              {promedioUltimos7 ?? "-"}%
            </h2>
          </div>

          <div style={{
            background: "white",
            padding: 16,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <b>Tendencia</b>
            <h2 style={{
              color:
                tendencia === null
                  ? "#555"
                  : tendencia >= 0
                  ? "#2E7D32"
                  : "#C62828",
              marginBottom: 0
            }}>
              {tendencia === null
                ? "-"
                : `${tendencia > 0 ? "+" : ""}${tendencia}%`}
            </h2>
          </div>

          <div style={{
            background: "white",
            padding: 16,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <b>Registros evaluados</b>
            <h2 style={{
              color: "#1976D2",
              marginBottom: 0
            }}>
              {registrosOperario.length}
            </h2>
          </div>

        </div>

        <div style={{
          background: "white",
          padding: 18,
          borderRadius: 14,
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 18
        }}>

          <h3>
            Línea de tiempo últimos 30 días
          </h3>

          <div style={{
            width: "100%",
            height: esMobile ? 280 : 360
          }}>

            <ResponsiveContainer>

              <BarChart
                data={datosEvolucion}
              >

                <XAxis
                  dataKey="fecha"
                />

                <YAxis
                  domain={[0, 150]}
                />

                <Tooltip
                  formatter={(value, name, item) => {
                    const payload =
                      item?.payload || {};

                    if (
                      payload.promedio === null
                    ) {
                      return [
                        "Sin registros",
                        "Eficiencia"
                      ];
                    }

                    return [
                      `${payload.promedio}% (${payload.registros} reg.)`,
                      "Eficiencia"
                    ];
                  }}
                />

                <Bar dataKey="eficiencia">
                  {datosEvolucion.map(
                    (entry, index) => (
                      <Cell
                        key={`eficiencia-${index}`}
                        fill={entry.color}
                      />
                    )
                  )}
                </Bar>

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            esMobile
              ? "1fr"
              : "1fr 1fr",
          gap: 12
        }}>

          <div style={{
            background: "#E8F5E9",
            color: "#1B5E20",
            padding: 16,
            borderRadius: 14
          }}>
            <b>Mejor día</b>
            <div>
              {mejorDia
                ? `${mejorDia.fecha}: ${mejorDia.promedio}%`
                : "-"}
            </div>
          </div>

          <div style={{
            background: "#FFEBEE",
            color: "#B71C1C",
            padding: 16,
            borderRadius: 14
          }}>
            <b>Día más bajo</b>
            <div>
              {peorDia
                ? `${peorDia.fecha}: ${peorDia.promedio}%`
                : "-"}
            </div>
          </div>

        </div>

        <div style={{
          background: "#FFF8E1",
          color: "#5D4037",
          padding: 16,
          borderRadius: 14,
          marginTop: 14,
          fontWeight: "bold"
        }}>
          {mensajeTendencia}
        </div>

        <button
          onClick={() =>
            cargarEvolucionOperarios()
          }
          style={{
            ...botonVerde,
            marginTop: 18
          }}
        >
          🔄 Actualizar datos
        </button>

        <button
          onClick={() =>
            setPantalla("home")
          }
          style={botonAzul}
        >
          ← Volver
        </button>

      </div>

    );

  }
  
  if (pantalla === "historialParos") { 
  
    const promedio =
      dashboard.length > 0
        ? dashboard.reduce(
            (a, b) =>
              a + (b.eficiencia || 0),
            0
          ) / dashboard.length
        : 0;

  const datosParos =
    Object.entries(
      todosLosParos.reduce((acc, paro) => {

        const motivo =
          paro.motivo || "Sin motivo";

        acc[motivo] =
          (acc[motivo] || 0) + 1;

        return acc;

      }, {})
    )

    .map(([motivo, cantidad]) => ({
      motivo,
      cantidad
    }))

    .sort((a, b) =>
      b.cantidad - a.cantidad
    );

  return (

    <div style={{ padding: 20 }}>

      <h2>
        📋 Historial de Paros
      </h2>

      <div style={{
        background: "#FFF3E0",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

      <h3>
        🔴 Pareto de Paros
      </h3>

      <div style={{
        width: "100%",
        height: 300
      }}>

        <ResponsiveContainer>

          <BarChart data={datosParos}>

            <XAxis dataKey="motivo" />

            <YAxis />

            <Tooltip />

            <Bar dataKey="cantidad">

              {datosParos.map((entry, index) => (

                  <Cell
                  key={`paro-${index}`}
                  fill="#F44336"
                />

              ))}

            </Bar>

          </BarChart>

        </ResponsiveContainer>

      </div>  

        <h3>
          ⏱ Tiempo Total Perdido
        </h3>

        <h1 style={{
          color: "#E65100",
          margin: 0
        }}>

          {

            (() => {

              let totalMs = 0;

              todosLosParos.forEach(paro => {

                const inicio =
                  paro.inicio_paro?.toDate
                    ? paro.inicio_paro.toDate()
                    : new Date(paro.inicio_paro);

                const fin =
                  paro.fin_paro
                    ? (
                        paro.fin_paro.toDate
                          ? paro.fin_paro.toDate()
                          : new Date(paro.fin_paro)
                      )
                    : ahora;

                totalMs +=
                  fin - inicio;

              });

              const horas =
                Math.floor(
                  totalMs / 3600000
                );

              const minutos =
                Math.floor(
                  (totalMs % 3600000)
                  / 60000
                );

              return `
                ${horas}h ${minutos}m
              `;

            })()

          }

        </h1>

      </div>

      <div style={{
        background: "#E3F2FD",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          📊 Top Motivos de Paro
        </h3>

        {

          Object.entries(

            todosLosParos.reduce((acc, paro) => {

              const motivo =
                paro.motivo || "SIN MOTIVO";

              acc[motivo] =
                (acc[motivo] || 0) + 1;

              return acc;

            }, {})

          )

          .sort((a, b) => b[1] - a[1])

          .slice(0, 5)

          .map(([motivo, cantidad], i) => (

            <div
              key={i}
              style={{
                marginBottom: 10,
                background: "white",
                padding: 10,
                borderRadius: 8
              }}
            >

              <b>
                {i + 1}. {motivo}
              </b>

              <div style={{
                marginTop: 4,
                color: "#555"
              }}>
                {cantidad} detenciones
              </div>

            </div>

          ))

        }

      </div>

      {/* TOP OPERARIOS */}

      <div style={{
        background: "#F3E5F5",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          👷 Operarios con Más Detenciones
        </h3>

        {

          Object.entries(

            todosLosParos.reduce((acc, paro) => {

              const operario =
                paro.operario || "SIN OPERARIO";

              acc[operario] =
                (acc[operario] || 0) + 1;

              return acc;

            }, {})

          )

          .sort((a, b) => b[1] - a[1])

          .slice(0, 5)

          .map(([operario, cantidad], i) => (

            <div
              key={i}
              style={{
                marginBottom: 10,
                background: "white",
                padding: 10,
                borderRadius: 8
              }}
            >

              <b>
                {i + 1}. {operario}
              </b>

              <div style={{
                marginTop: 4,
                color: "#555"
              }}>
                {cantidad} detenciones
              </div>

            </div>

          ))

        }

      </div>

      {/* TOP OTs */}

      <div style={{
        background: "#E8F5E9",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          📋 OTs con Más Tiempo Perdido
        </h3>

        {

          Object.entries(

            todosLosParos.reduce((acc, paro) => {

              const ot =
                paro.ot || "SIN OT";

              const inicio =
                paro.inicio_paro?.toDate
                  ? paro.inicio_paro.toDate()
                  : new Date(paro.inicio_paro);

              const fin =
                paro.fin_paro
                  ? (
                      paro.fin_paro.toDate
                        ? paro.fin_paro.toDate()
                        : new Date(paro.fin_paro)
                    )
                  : ahora;

              const tiempo =
                fin - inicio;

              acc[ot] =
                (acc[ot] || 0) + tiempo;

              return acc;

            }, {})

          )

          .sort((a, b) => b[1] - a[1])

          .slice(0, 5)

          .map(([ot, tiempo], i) => {

            const horas =
              Math.floor(
                tiempo / 3600000
              );

            const minutos =
              Math.floor(
                (tiempo % 3600000)
                / 60000
              );

            return (

              <div
                key={i}
                style={{
                  marginBottom: 10,
                  background: "white",
                  padding: 10,
                  borderRadius: 8
                }}
              >

                <b>
                  {i + 1}. {ot}
                </b>

                <div style={{
                  marginTop: 4,
                  color: "#555"
                }}>

                  {horas}h {minutos}m perdidos

                </div>

              </div>

            );

          })

        }

      </div>

      {/* DISPONIBILIDAD */}

      <div style={{
        background: "#FFF8E1",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          ⚙️ Disponibilidad General
        </h3>

        {

          (() => {

            let tiempoTotalMs = 0;

            let tiempoPausasMs = 0;

            produccionActiva.forEach(p => {

              if (!p.inicio?.toDate)
                return;

              const inicio =
                p.inicio.toDate();

              tiempoTotalMs +=
                ahora - inicio;

            });

            todosLosParos.forEach(paro => {

              const inicio =
                paro.inicio_paro?.toDate
                  ? paro.inicio_paro.toDate()
                  : new Date(paro.inicio_paro);

              const fin =
                paro.fin_paro
                  ? (
                      paro.fin_paro.toDate
                        ? paro.fin_paro.toDate()
                        : new Date(paro.fin_paro)
                    )
                  : ahora;

              tiempoPausasMs +=
                fin - inicio;

            });

            const disponibilidad =
              tiempoTotalMs > 0
                ? (
                    (
                      tiempoTotalMs -
                      tiempoPausasMs
                    )
                    / tiempoTotalMs
                  ) * 100
                : 0;

            return (

              <div>

                <h1 style={{
                  margin: 0,
                  color:
                    disponibilidad >= 90
                      ? "#2E7D32"
                      : disponibilidad >= 75
                      ? "#F9A825"
                      : "#C62828"
                }}>

                  {disponibilidad.toFixed(1)}%

                </h1>

                <div style={{
                  marginTop: 8,
                  color: "#555"
                }}>
      
                  {

                    disponibilidad >= 90
                      ? "🟢 Excelente"
                      : disponibilidad >= 75
                      ? "🟡 Riesgo"
                      : "🔴 Crítico"

                  }

                </div>

              </div>

            );

          })()

        }

      </div>

      {/* OEE */}

      <div style={{
        background: "#ECEFF1",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          🏭 OEE General
        </h3>

        {

          (() => {

            let tiempoTotalMs = 0;

            let tiempoPausasMs = 0;

            produccionActiva.forEach(p => {

              if (!p.inicio?.toDate)
                return;

              const inicio =
                p.inicio.toDate();

              tiempoTotalMs +=
                ahora - inicio;

            });

            todosLosParos.forEach(paro => {

              const inicio =
                paro.inicio_paro?.toDate
                  ? paro.inicio_paro.toDate()
                  : new Date(paro.inicio_paro);

              const fin =
                paro.fin_paro
                  ? (
                      paro.fin_paro.toDate
                        ? paro.fin_paro.toDate()
                        : new Date(paro.fin_paro)
                    )
                  : ahora;

              tiempoPausasMs +=
                fin - inicio;

            });

            const disponibilidad =
              tiempoTotalMs > 0
                ? (
                    (
                      tiempoTotalMs -
                      tiempoPausasMs
                    )
                    / tiempoTotalMs
                  ) * 100
                : 0;

            const rendimiento =
              promedio || 0;

            const calidad = 100;

            const oee =
              (
                disponibilidad / 100
              ) *
              (
                rendimiento / 100
              ) *
              (
                calidad / 100
              ) * 100;

            return (

              <div>

                <h1 style={{
                  margin: 0,
                  color:
                    oee >= 85
                      ? "#2E7D32"
                      : oee >= 60
                      ? "#F9A825"
                      : "#C62828"
                }}>

                  {oee.toFixed(1)}%

                </h1>

                <div style={{
                  marginTop: 10,
                  color: "#555"
                }}>

                  Disponibilidad:
                  {" "}
                  {disponibilidad.toFixed(1)}%

                  <br />

                  Rendimiento:
                  {" "}
                  {rendimiento.toFixed(1)}%

                  <br />

                  Calidad:
                  {" "}
                  {calidad}%

                </div>

              </div>

            );

          })()

        }

      </div>

      <table style={{
        width: "100%",
        borderCollapse: "collapse"
      }}>

        <thead>

          <tr style={{
            background: "#222",
            color: "white"
          }}>

            <th>Operario</th>
            <th>OT</th>
            <th>Proceso</th>
            <th>Subproceso</th>
            <th>Detalle</th>
            <th>Motivo</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Duración</th>

          </tr>

        </thead>

        <tbody>

          {
            todosLosParos
              .sort((a, b) =>
                (
                  b.inicio_paro?.seconds || 0
                )
                -
                (
                  a.inicio_paro?.seconds || 0
                )
              )
              .map(paro => {

            const inicio =
              paro.inicio_paro?.toDate
                ? paro.inicio_paro.toDate()
                : new Date(paro.inicio_paro);

            const fin =
              paro.fin_paro
                ? (
                    paro.fin_paro.toDate
                      ? paro.fin_paro.toDate()
                      : new Date(paro.fin_paro)
                  )
                : ahora;

            const duracionMs =
              fin - inicio;

            const horas =
              Math.floor(
                duracionMs / 3600000
              );

            const minutos =
              Math.floor(
                (duracionMs % 3600000)
                / 60000
              );

            return (

              <tr
                key={paro.id}
                style={{
                  borderBottom:
                    "1px solid #ccc"
                }}
              >

                <td>{paro.operario}</td>

                <td>{paro.ot}</td>

                <td>{paro.proceso}</td>

                <td>{paro.subproceso || "-"}</td>

                <td>{paro.detalle || "-"}</td>

                <td>{paro.motivo}</td>

                <td>
                  {inicio.toLocaleString()}
                </td>

                <td>
                  {
                    paro.fin_paro
                      ? fin.toLocaleString()
                      : "ACTIVO"
                  }
                </td>

                <td>
                  {horas}h {minutos}m
                </td>

              </tr>

            );

          })}

        </tbody>

      </table>

      <button
        onClick={() =>
          setPantalla("dashboard")
        }
        style={{
          ...botonAzul,
          marginTop: 20
        }}
      >
        ← Volver
      </button>

    </div>

  );

}

  if (pantalla === "ajusteGerencial") {

    const responsablesAjuste =
      usuarios.filter(u => {

        const rol =
          normalizar(u.rol);

        return (

          rol === "jefe"

          ||

          rol === "gerencia"

        );

      });
    
    return (

      <div style={{
        padding: 20,
        maxWidth: 500,
        margin: "0 auto"
      }}>

        <h2>
          🛠 Ajuste Gerencial
        </h2>

        <select
          style={estiloInput}
          value={otSeleccionada}
          onChange={(e) =>
            setOtSeleccionada(
              e.target.value
            )
          }
        >

          <option value="">
            Seleccionar OT
          </option>

          {ots.map((o, i) => (

            <option
              key={i}
              value={o.nombre}
            >

              {o.nombre}

            </option>

          ))}

        </select>

        <select
          style={estiloInput}
          value={operarioSeleccionado}
          onChange={(e) =>
            setOperarioSeleccionado(
              e.target.value
            )
          }
        >

          <option value="">
            Operario
          </option>

          {operarios.map((o, i) => (

            <option
              key={i}
              value={o.nombre}
            >

              {o.nombre}

            </option>

          ))}

        </select>

        <select
  style={estiloInput}
  value={responsableAjuste}
  onChange={(e) =>
    setResponsableAjuste(
      e.target.value
    )
  }
>

  <option value="">
    Responsable Ajuste
  </option>

  {responsablesAjuste.map((u, i) => (

    <option
      key={i}
      value={u.nombre}
    >

      {u.nombre}
      {" — "}
      {u.rol}

    </option>

  ))}

</select>

<select
  style={estiloInput}
  value={procesoSeleccionado}
  onChange={(e) =>
    setProcesoSeleccionado(
      e.target.value
    )
  }
>

  <option value="">
    Proceso
  </option>

  {procesos.map((p, i) => (

    <option
      key={i}
      value={p.nombre}
    >

      {p.nombre}

    </option>

  ))}

</select>

<select
  style={estiloInput}
  value={subprocesoSeleccionado}
  onChange={(e) =>
    setSubprocesoSeleccionado(
      e.target.value
    )
  }
>

  <option value="">
    Subproceso
  </option>

  {

    subprocesos

    .filter(s =>

      normalizar(s.proceso)
      ===
      normalizar(
        procesoSeleccionado
      )

    )

    .map((s, i) => (

      <option
        key={i}
        value={s.nombre}
      >

        {s.nombre}

      </option>

    ))

  }

</select>

<select
  style={estiloInput}
  value={detalleSeleccionado}
  onChange={(e) =>
    setDetalleSeleccionado(
      e.target.value
    )
  }
>

  <option value="">
    Operación
  </option>

  {

    subprocesos

    .find(s =>

      normalizar(s.nombre)
      ===
      normalizar(
        subprocesoSeleccionado
      )

    )

    ?.detalles

    ?.map((d, i) => {

      const nombreDetalle =
        typeof d === "string"
          ? d
          : d.nombre;

      return (

        <option
          key={i}
          value={nombreDetalle}
        >

          {nombreDetalle}

        </option>

      );

    })

  }

</select>

        <input
          type="number"
          placeholder="Cantidad ajuste"
          style={estiloInput}
          value={cantidad}
          onChange={(e) =>
            setCantidad(e.target.value)
          }
        />

        <input
          type="text"
          placeholder="Motivo ajuste"
          style={estiloInput}
          value={motivoParo}
          onChange={(e) =>
            setMotivoParo(e.target.value)
          }
        />

        <button
          style={botonVerde}
          onClick={async () => {

            if (

              !otSeleccionada ||

              !operarioSeleccionado ||

              !responsableAjuste ||

              !procesoSeleccionado ||

              !subprocesoSeleccionado ||

              !cantidad ||

              !motivoParo

            ) {

              alert(
                "Completa los datos"
              );

              return;

            }

            try {

              await addDoc(
                collection(
                  db,
                  "registros_produccion"
                ),
                {

                  tipo:
                    "ajuste_gerencial",

                  ot:
                    otSeleccionada,

                  operario:
                    operarioSeleccionado,

                  cantidad_ok:
                    Number(cantidad),

                  motivo_ajuste:
                    motivoParo,

                  ajustado_por:
                    usuarioSeleccionado?.nombre
                    || "GERENCIA",

                  fecha:
                    new Date(),

                  eficiencia: 100,

                  estado_eficiencia:
                    "🟢"

                }
              );

              const prodActiva =
                produccionActiva.find(p =>

                  normalizar(p.ot)
                  ===
                  normalizar(
                    otSeleccionada
                  )

                  &&

                  normalizar(
                    p.operario
                  )
                  ===
                  normalizar(
                    operarioSeleccionado
                  )

                );

              if (prodActiva) {

                await updateDoc(

                  doc(
                    db,
                    "produccion_activa",
                    prodActiva.id
                  ),

                  {

                    cantidad_actual:

                      (
                        prodActiva.cantidad_actual
                        || 0
                      )

                      +

                      Number(cantidad)

                  }

                );

              }

              alert(
                "✅ Ajuste aplicado"
              );

              setCantidad("");

              setMotivoParo("");

              await cargarDashboard();

              await cargarProduccionActiva();

            }

            catch (error) {

              console.error(error);

              alert(
                "Error ajuste"
              );

            }

          }}
        >

          ✅ Aplicar Ajuste

        </button>

<hr style={{
  marginTop: 40,
  marginBottom: 30
}} />

<h3>
  ✏️ Corrección Registros
</h3>

<label style={{
  display: "block",
  fontWeight: "bold",
  marginBottom: 6
}}>
  Fecha de registros a corregir
</label>

<input
  type="date"
  style={estiloInput}
  value={fechaAjusteGerencial}
  onChange={(e) => {
    setRegistroAjuste(null);
    setFechaAjusteGerencial(
      e.target.value
    );
  }}
/>

{cargandoRegistrosAjuste && (
  <div style={{
    background: "#E3F2FD",
    color: "#0D47A1",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    fontWeight: "bold"
  }}>
    Cargando registros...
  </div>
)}

{!cargandoRegistrosAjuste && (
  <div style={{
    background: "#F5F5F5",
    color: "#333",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12
  }}>
    Registros encontrados:
    {" "}
    {
      registros
        .filter(r => !r.anulado)
        .filter(r =>

          (!otSeleccionada ||

            normalizar(r.ot)
            ===
            normalizar(
              otSeleccionada
            )
          )

          &&

          (!operarioSeleccionado ||

            normalizar(r.operario)
            ===
            normalizar(
              operarioSeleccionado
            )
          )

        ).length
    }
  </div>
)}

<div style={{
  marginTop: 20
}}>

  {

    registros
.filter(r => !r.anulado)
.filter(r =>

  (!otSeleccionada ||

    normalizar(r.ot)
    ===
    normalizar(
      otSeleccionada
    )
  )

  &&

  (!operarioSeleccionado ||

    normalizar(r.operario)
    ===
    normalizar(
      operarioSeleccionado
    )
  )

)

.sort((a, b) =>

  b.fecha?.seconds
  -
  a.fecha?.seconds

)

.map((r, i) => (

      <div
        key={i}
        style={{
          background: "white",
          padding: 14,
          borderRadius: 14,
          marginBottom: 14,
          boxShadow:
            "0 2px 6px rgba(0,0,0,0.06)"
        }}
      >

        <div>
          👷 {r.operario}
        </div>

        {
          registroFueAjustado(r.id)
          &&
          (
            <div style={{
              marginTop: 6,
              background: "#FFF3E0",
              color: "#E65100",
              padding: "4px 10px",
              borderRadius: 20,
              display: "inline-block",
              fontSize: 12,
               fontWeight: "bold"
            }}>
              ✏️ Ajustado Gerencia
            </div>
          )
        }

        <div>
          📋 {r.ot}
        </div>

        <div>
  ⚙️ Proceso:
  {" "}
  {r.proceso || "-"}
</div>

<div>
  🧩 Subproceso:
  {" "}
  {r.subproceso || "-"}
</div>

<div>
  ⚙️ Detalle:
  {" "}
  {r.detalle || "-"}
</div>

<div>
  🕒 Registro:
  {" "}

  {

    r.fecha?.toDate

      ?

    r.fecha
      .toDate()
      .toLocaleString()

      :

    "-"

  }

</div>

<div>
  🕒 Inicio:
  {" "}
  {
    r.inicio?.seconds
      ? new Date(
          r.inicio.seconds * 1000
        ).toLocaleString()
      : "-"
  }
</div>

<div>
  🕒 Fin:
  {" "}
  {
    r.fin?.seconds
      ? new Date(
          r.fin.seconds * 1000
        ).toLocaleString()
      : "-"
  }
</div>

        <div>
          🔢 Cantidad:
          {" "}
          {r.cantidad_ok || 0}
        </div>

        <div style={{
          marginTop: 4,
          fontWeight: "bold",
          color:
            Number(r.eficiencia || 0) >= 90
              ? "#2E7D32"
              : Number(r.eficiencia || 0) >= 70
              ? "#F9A825"
              : "#C62828"
        }}>
          📈 Eficiencia:
          {" "}
          {r.estado_eficiencia || calcularEstadoEficiencia(
            Number(r.eficiencia || 0)
          )}
          {" "}
          {Number(r.eficiencia || 0)}%
        </div>

        <button

          style={{
            ...botonAzul,
            marginTop: 10
          }}

          onClick={() => {

            setRegistroAjuste(r);

            setNuevaHoraInicio(
              fechaParaDatetimeLocal(
                r.inicio || r.hora_inicio
              )
            );

setNuevaHoraFin(
  fechaParaDatetimeLocal(
    r.fin || r.hora_fin
  )
);

            setNuevaCantidad(
              r.cantidad_ok || ""
            );

          }}

        >

          ✏️ Corregir Registro

        </button>

        <button
  style={{
    marginTop: 8,
    width: "100%",
    padding: 10,
    border: "none",
    borderRadius: 8,
    background: "#F44336",
    color: "white",
    fontWeight: "bold"
  }}
  onClick={async () => {

    const confirmar =
      window.confirm(
        `¿Anular registro de ${r.operario}?`
      );

    if (!confirmar) return;

    try {

      await updateDoc(

        doc(
          db,
          "registros_produccion",
          r.id
        ),

        {

          anulado: true,

          anulado_por:
            usuarioSeleccionado?.nombre
            || "GERENCIA",

          fecha_anulacion:
            new Date()

        }

      );

      alert(
        "Registro anulado ✅"
      );

      await cargarRegistrosAjustePorFecha();

      await cargarDashboard();

    }

    catch (error) {

      console.error(error);

      alert(
        "Error anulando registro"
      );

    }

  }}
>
  🗑️ Anular Registro
</button>

      </div>

    ))

  }

</div>

{

  registroAjuste && (

    <div style={{
      background: "#FFF8E1",
      padding: 20,
      borderRadius: 16,
      marginTop: 30,
      border:
        "2px solid #FFE082"
    }}>

      <h3>
        ✏️ Corregir Registro
      </h3>

      <div style={{
        marginBottom: 12
      }}>

        👷 {registroAjuste.operario}

      </div>

      <input
        type="datetime-local"
        placeholder="Nueva Hora Inicio"
        style={estiloInput}
        value={nuevaHoraInicio}
        onChange={(e) =>
          setNuevaHoraInicio(
            e.target.value
          )
        }
      />

      <input
        type="datetime-local"
        placeholder="Nueva Hora Fin"
        style={estiloInput}
        value={nuevaHoraFin}
        onChange={(e) =>
          setNuevaHoraFin(
            e.target.value
          )
        }
      />

      <input
        type="number"
        placeholder="Nueva Cantidad"
        style={estiloInput}
        value={nuevaCantidad}
        onChange={(e) =>
          setNuevaCantidad(
            e.target.value
          )
        }
      />

      <input
        type="text"
        placeholder="Motivo corrección"
        style={estiloInput}
        value={motivoAjuste}
        onChange={(e) =>
          setMotivoAjuste(
            e.target.value
          )
        }
      />

      <button

        style={botonVerde}

        onClick={async () => {

          try {
const nuevaCantidadNum =
  Number(nuevaCantidad);

const nuevoInicio =
  nuevaHoraInicio
    ? fechaDesdeDatetimeLocal(
        nuevaHoraInicio
      )
    : fechaDesdeValor(
        registroAjuste.inicio ||
        registroAjuste.hora_inicio
      );

const nuevoFin =
  nuevaHoraFin
    ? fechaDesdeDatetimeLocal(nuevaHoraFin)
    : fechaDesdeValor(
        registroAjuste.fin ||
        registroAjuste.hora_fin
      );

if (!nuevoInicio || !nuevoFin) {
  alert(
    "Ingresa fechas válidas para inicio y fin."
  );
  return;
}

if (nuevoFin <= nuevoInicio) {
  alert(
    "La hora de fin debe ser posterior a la hora de inicio."
  );
  return;
}

if (
  !Number.isFinite(nuevaCantidadNum) ||
  nuevaCantidadNum < 0
) {
  alert("Ingresa una cantidad válida.");
  return;
}

const nuevasHoras =
  (nuevoFin - nuevoInicio)
  /
  (1000 * 60 * 60);

const estandar =
  estandares.find(e => {

    const matchProc =
      normalizar(e.proceso)
      ===
      normalizar(
        registroAjuste.proceso
      );

    const matchSub =
      normalizar(e.subproceso)
      ===
      normalizar(
        registroAjuste.subproceso
      );

    const matchDet =
      !e.detalle ||
      normalizar(e.detalle)
      ===
      normalizar(
        registroAjuste.detalle
      );

    return (
      matchProc &&
      matchSub &&
      matchDet
    );

  });

let nuevaEficiencia = 0;
const unidadesHora =
  obtenerUnidadesHora(estandar);

if (
  estandar &&
  unidadesHora > 0 &&
  nuevasHoras > 0
) {

  const produccionEsperada =
    unidadesHora *
    nuevasHoras;

  nuevaEficiencia =
    (
      nuevaCantidadNum /
      produccionEsperada
    ) * 100;

}

nuevaEficiencia =
  Math.min(
    Math.round(nuevaEficiencia),
    150
  );

let nuevoSemaforo =
  calcularEstadoEficiencia(
    nuevaEficiencia
  );

            await addDoc(
              collection(
                db,
                "ajustes_produccion"
              ),
              {
                produccion_id:
                  registroAjuste.id,
                hora_inicio_original:
                  fechaDesdeValor(
                    registroAjuste.inicio ||
                    registroAjuste.hora_inicio
                  ),
                hora_inicio_nueva:
                  nuevoInicio,
                hora_fin_original:
                  fechaDesdeValor(
                    registroAjuste.fin ||
                    registroAjuste.hora_fin
                  ),
                hora_fin_nueva:
                  nuevoFin,
                cantidad_original:
                  registroAjuste.cantidad_ok || 0,
                cantidad_nueva:
                  nuevaCantidadNum,
                eficiencia_original:
                  registroAjuste.eficiencia || 0,
                eficiencia_nueva:
                  nuevaEficiencia,
                motivo:
                  motivoAjuste,
                responsable:
                  usuarioSeleccionado?.nombre ||
                  "GERENCIA",
                fecha_ajuste:
                  new Date()
              }
            );

            await updateDoc(
  doc(
    db,
    "registros_produccion",
    registroAjuste.id
  ),
  {
    inicio: nuevoInicio,

    fin: nuevoFin,

    hora_inicio: nuevoInicio,

    hora_fin: nuevoFin,

    tiempo_horas:
      Number(
        nuevasHoras.toFixed(2)
      ),

    cantidad_ok:
      nuevaCantidadNum,

    eficiencia:
      nuevaEficiencia,

    estado_eficiencia:
      nuevoSemaforo
  }
);

await cargarRegistrosAjustePorFecha();

await cargarDashboard();

setRegistroAjuste(null);

setNuevaCantidad("");

setNuevaHoraInicio("");

setNuevaHoraFin("");

setMotivoAjuste("");


            alert(
              "✅ Corrección guardada"
            );

            setRegistroAjuste(null);

            setMotivoAjuste("");

          }

          catch (error) {

            console.error(error);

            alert(
              "Error guardando corrección"
            );

          }

        }}

      >

        💾 Guardar Corrección

      </button>

    </div>

  )

}

        <button
          style={botonAzul}
          onClick={() =>
            setPantalla("home")
          }
        >

          ⬅ Volver

        </button>

      </div>

    );

  }

  if (pantalla === "crearOT") {

    return (

      <div style={{
        padding: 20,
        maxWidth: 500,
        margin: "0 auto"
      }}>

        <h2>
          📋 Crear Orden de Trabajo
        </h2>

        <input
          type="text"
          placeholder="Nombre OT"
          style={estiloInput}
          value={otSeleccionada}
          onChange={(e) =>
            setOtSeleccionada(
              e.target.value
            )
          }
        />

        <input
          type="text"
          placeholder="Cliente"
          style={estiloInput}
          value={clienteOT}
          onChange={(e) =>
            setClienteOT(
              e.target.value
            )
          }
        />

        <input
          type="text"
          placeholder="Producto"
          style={estiloInput}
          value={productoOT}
          onChange={(e) =>
            setProductoOT(
              e.target.value
            )
          }
        />

        <input
          type="number"
          placeholder="Cantidad"
          style={estiloInput}
          value={cantidad}
          onChange={(e) =>
            setCantidad(
              e.target.value
            )
          }
        />
  
        <div style={{ marginBottom: 15 }}>

          <label style={{
            fontWeight: "bold",
            display: "block",
            marginBottom: 5
          }}>

            📅 Fecha Inicio

          </label>

          <input
            type="date"
            style={estiloInput}
            value={fechaInicioOT}
            onChange={(e) =>
              setFechaInicioOT(
                e.target.value
              )
            }
          />

        </div>

        <div style={{ marginBottom: 15 }}>

          <label style={{
            fontWeight: "bold",
            display: "block",
            marginBottom: 5
          }}>

            🚚 Fecha Entrega

          </label>

          <input
            type="date"
            style={estiloInput}
            value={fechaEntregaOT}
            onChange={(e) =>
              setFechaEntregaOT(
                e.target.value
              )
            }
          />

        </div>

        <select
          style={estiloInput}
          value={estadoOT}
          onChange={(e) =>
            setEstadoOT(
              e.target.value
            )
          }
        >

          <option value="activa">
            Activa
          </option>

          <option value="pausada">
            Pausada
          </option>

          <option value="cerrada">
            Cerrada
          </option>

        </select>

        <button
          style={botonVerde}
          onClick={async () => {

            if (

              !otSeleccionada ||

              !clienteOT ||

              !productoOT ||

              !cantidad

            ) {

              alert(
                "Completa los datos"
              );

              return;

            }

            try {

              const productoSeleccionado =

                productosConfig.find(
                  p =>
                    p.nombre ===
                    productoOT
                );

              const estructuraProducto =

                productoSeleccionado?.estructura || [];

              await addDoc(
                collection(db, "ordenes_trabajo"),
                {
                  nombre: otSeleccionada,
                  cliente: clienteOT,
                  producto: productoOT,
                  estructura_producto: estructuraProducto,
                  cantidad: Number(cantidad),
                  fecha_inicio: fechaInicioOT,
                  fecha_entrega: fechaEntregaOT,
                  estado: estadoOT,
                  fecha_creacion: new Date(),
                  procesos:
                    procesosConfig.map((p) => ({
                      nombre: p.nombre,
                      activo: p.activo,
                      subproceso:
                        (p.subprocesos || []).map((s) => ({
                          nombre: s.nombre,
                          activo: s.activo,
                          detalles:
                            (s.detalles || []).map((d) => ({
                              nombre: d.nombre,
                              material: d.material || "",
                              medida: d.medida || "",
                              cantidad_objetivo: d.cantidad_objetivo || 0,
                              activo: d.activo !== false
                            }))
                        }))
                    }))
                }

              );

              alert(
                "✅ OT creada"
              );

              setOtSeleccionada("");
              setClienteOT("");
              setProductoOT("");
              setCantidad("");
              setFechaInicioOT("");
              setFechaEntregaOT("");
              setEstadoOT("activa");
              cargarDatos();

            }

            catch (error) {

              console.error(error);

              alert(
                "Error creando OT"
              );

            }

          }}
        >

          ✅ Crear OT

        </button>

        <button
          style={botonAzul}
          onClick={() =>
            setPantalla("home")
          }
        >

          ⬅ Volver

        </button>

      </div>

    );

  }
  
  if (
  pantalla ===
  "configProduccion"
) {

  return (

    <div style={{
      padding: 20,
      maxWidth: 700,
      margin: "0 auto"
    }}>

      <h2>
        ⚙️ Configuración Producción
      </h2>

      <div style={{
        background: "white",
        padding: 20,
        borderRadius: 14,
        marginTop: 20,
        boxShadow:
          "0 2px 8px rgba(0,0,0,0.08)"
      }}>

        <h3>
          ➕ Crear Proceso
        </h3>

        <input
          type="text"
          placeholder="Nombre proceso"
          style={estiloInput}
          value={nuevoProceso}
          onChange={(e) =>
            setNuevoProceso(
              e.target.value
            )
          }
        />

        <button
          style={botonVerde}

          onClick={async () => {

            if (!nuevoProceso) {

              alert(
                "Ingresa nombre"
              );

              return;

            }

            try {

              await addDoc(

                collection(
                  db,
                  "config_procesos"
                ),

                {

                  nombre:
                    nuevoProceso,

                  activo: true,

                  fecha_creacion:
                    new Date()

                }

              );

              alert(
                "✅ Proceso creado"
              );

              setNuevoProceso("");

              cargarDatos();

            }

            catch (error) {

              console.error(error);

              alert(
                "Error creando proceso"
              );

            }

          }}
        >

          ✅ Guardar Proceso

        </button>

      </div>
<div style={{
  background: "white",
  padding: 20,
  borderRadius: 14,
  marginTop: 20,
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.08)"
}}>

  <h3>
    ➕ Crear Subproceso
  </h3>

  <select
    style={estiloInput}
    value={procesoSeleccionadoConfig}
    onChange={(e) =>
      setProcesoSeleccionadoConfig(
        e.target.value
      )
    }
  >

    <option value="">
      Seleccionar proceso
    </option>

    {procesosConfig.map((p) => (

      <option
        key={p.id}
        value={p.id}
      >

        {p.nombre}

      </option>

    ))}

  </select>

  <input
    type="text"
    placeholder="Nombre subproceso"
    style={estiloInput}
    value={nuevoSubproceso}
    onChange={(e) =>
      setNuevoSubproceso(
        e.target.value
      )
    }
  />

  <button
    style={botonVerde}

    onClick={async () => {

      if (

        !procesoSeleccionadoConfig ||

        !nuevoSubproceso

      ) {

        alert(
          "Completa datos"
        );

        return;

      }

      try {

        const procesoDoc =
          procesosConfig.find(
            p =>
              p.id ===
              procesoSeleccionadoConfig
          );

        const subprocesosActuales =
          procesoDoc.subprocesos || [];

        await updateDoc(

          doc(
            db,
            "config_procesos",
            procesoSeleccionadoConfig
          ),

          {

            subprocesos: [

              ...subprocesosActuales,

              {
                nombre:
                  nuevoSubproceso,

                activo: true,

                detalles: []

              }

            ]

          }

        );

        alert(
          "✅ Subproceso creado"
        );

        setNuevoSubproceso("");

        setProcesoSeleccionadoConfig("");

        cargarDatos();

      }

      catch (error) {

        console.error(error);

        alert(
          "Error creando subproceso"
        );

      }

    }}
  >

    ✅ Guardar Subproceso

  </button>

</div>

<div style={{
  background: "white",
  padding: 20,
  borderRadius: 14,
  marginTop: 20,
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.08)"
}}>

  <h3>
    ⚙️ Crear Operación Base
  </h3>

  {/* PROCESO */}

  <select
    style={estiloInput}
    value={procesoSeleccionadoConfig}
    onChange={(e) =>
      setProcesoSeleccionadoConfig(
        e.target.value
      )
    }
  >

    <option value="">
      Seleccionar proceso
    </option>

    {procesosConfig.map((p) => (

      <option
        key={p.id}
        value={p.id}
      >

        {p.nombre}

      </option>

    ))}

  </select>

  {/* SUBPROCESO */}

  <select
    style={estiloInput}
    value={subprocesoSeleccionadoConfig}
    onChange={(e) =>
      setSubprocesoSeleccionadoConfig(
        e.target.value
      )
    }
  >

    <option value="">
      Seleccionar subproceso
    </option>

    {procesosConfig
      .find(
        p =>
          p.id ===
          procesoSeleccionadoConfig
      )

      ?.subprocesos

      ?.map((s, i) => (

        <option
          key={i}
          value={s.nombre}
        >

          {s.nombre}

        </option>

      ))}

  </select>

  {/* DETALLE */}

  <input
    type="text"
    placeholder="Código operación"
    style={estiloInput}
    value={nuevoDetalle}
    onChange={(e) =>
      setNuevoDetalle(
        e.target.value
      )
    }
  />

  {/* MATERIAL */}

  <input
    type="text"
    placeholder="Material ejemplo"
    style={estiloInput}
    value={materialDetalle}
    onChange={(e) =>
      setMaterialDetalle(
        e.target.value
      )
    }
  />

  {/* MEDIDA */}

  <input
    type="text"
    placeholder="Medida ejemplo mm"
    style={estiloInput}
    value={medidaDetalle}
    onChange={(e) =>
      setMedidaDetalle(
        e.target.value
      )
    }
  />

  {/* OBJETIVO */}

  <input
    type="number"
    placeholder="Cantidad objetivo"
    style={estiloInput}
    value={objetivoDetalle}
    onChange={(e) =>
      setObjetivoDetalle(
        e.target.value
      )
    }
  />

  <button
    style={botonVerde}

    onClick={async () => {

      if (

        !procesoSeleccionadoConfig ||

        !subprocesoSeleccionadoConfig ||

        !nuevoDetalle

      ) {

        alert(
          "Completa datos"
        );

        return;

      }

      try {

        const procesoDoc =
          procesosConfig.find(
            p =>
              p.id ===
              procesoSeleccionadoConfig
          );

        const subprocesosActuales =
          procesoDoc.subprocesos || [];

        const nuevosSubprocesos =
          subprocesosActuales.map((s) => {

            if (
              s.nombre ===
              subprocesoSeleccionadoConfig
            ) {

              return {

                ...s,

                detalles: [

                  ...(s.detalles || []),

                  {

                    nombre:
                      nuevoDetalle,

                    material:
                      materialDetalle,

                    medida:
                      medidaDetalle,

                    activo: true

                  }

                ]

              };

            }

            return s;

          });

        await updateDoc(

          doc(
            db,
            "config_procesos",
            procesoSeleccionadoConfig
          ),

          {

            subprocesos:
              nuevosSubprocesos

          }

        );

        alert(
          "✅ Operación creada"
        );

        setNuevoDetalle("");

        setMaterialDetalle("");

        setMedidaDetalle("");

        // setObjetivoDetalle("");

        setSubprocesoSeleccionadoConfig("");

        cargarDatos();

      }

      catch (error) {

        console.error(error);

        alert(
          "Error creando operación"
        );

      }

    }}
  >

    ✅ Guardar Operación

  </button>

</div>

      <div style={{
        marginTop: 30
      }}>

        <h3>
          📂 Procesos
        </h3>

        {procesosConfig.map((p) => (

          <div
            key={p.id}
            style={{
              background: "white",
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              boxShadow:
                "0 2px 6px rgba(0,0,0,0.06)"
            }}
          >

            <div style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center"
            }}>

              <div style={{
                fontWeight: "bold",
                fontSize: 18
              }}>
                ⚙️ {p.nombre}
              </div>

              <div>

                {
                  p.activo
                    ? "🟢 Activo"
                    : "⚫ Inactivo"
                }

              </div>

            </div>

          </div>

        ))}

      </div>

      <button
        style={botonAzul}
        onClick={() =>
          setPantalla("home")
        }
      >

        ⬅ Volver

      </button>

    </div>

  );

}

if (pantalla === "configProductos") {

  return (

    <div style={{
      padding: 20,
      maxWidth: 900,
      margin: "0 auto"
    }}>

      <h2>
        📦 Configuración Productos
      </h2>

      {/* CREAR PRODUCTO */}

      <div style={{
        background: "white",
        padding: 20,
        borderRadius: 14,
        marginTop: 20,
        boxShadow:
          "0 2px 8px rgba(0,0,0,0.08)"
      }}>

        <h3>
          ➕ Crear Producto
        </h3>

        <input
          type="text"
          placeholder="Nombre producto"
          style={estiloInput}
          value={nuevoProducto}
          onChange={(e) =>
            setNuevoProducto(
              e.target.value
            )
          }
        />

        <button
          style={botonVerde}

          onClick={async () => {

            if (!nuevoProducto) {

              alert(
                "Ingresa nombre producto"
              );

              return;

            }

            try {

              await addDoc(

                collection(
                  db,
                  "config_productos"
                ),

                {

                  nombre:
                    nuevoProducto,

                  activo: true,

                  estructura: [],

                  fecha_creacion:
                    new Date()

                }

              );

              alert(
                "✅ Producto creado"
              );

              setNuevoProducto("");

              cargarDatos();

            }

            catch (error) {

              console.error(error);

              alert(
                "Error creando producto"
              );

            }

          }}
        >

          ✅ Guardar Producto

        </button>

      </div>

      <div style={{
  background: "white",
  padding: 20,
  borderRadius: 14,
  marginTop: 20,
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.08)"
}}>

  <h3>
    🧩 Agregar Operación al Producto
  </h3>

  {/* PRODUCTO */}

  <select
    style={estiloInput}
    value={productoSeleccionadoOperacion}
    onChange={(e) =>
      setProductoSeleccionadoOperacion(
        e.target.value
      )
    }
  >

    <option value="">
      Seleccionar producto
    </option>

    {productosConfig.map((p) => (

      <option
        key={p.id}
        value={p.id}
      >

        {p.nombre}

      </option>

    ))}

  </select>

  {/* OPERACIÓN */}

  <select
    style={estiloInput}
    value={operacionSeleccionadaProducto}
    onChange={(e) =>
      setOperacionSeleccionadaProducto(
        e.target.value
      )
    }
  >

    <option value="">
      Seleccionar operación
    </option>

    {Array.isArray(operacionesMaestras) &&

      operacionesMaestras.map((o) => (

        <option
          key={o.id}
          value={o.codigo}
        >

          {o.codigo}
          {" • "}
          {o.nombre}

        </option>

      ))

    }

  </select>

  {/* MATERIAL */}

  <input
    type="text"
    placeholder="Material"
    style={estiloInput}
    value={materialOperacionProducto}
    onChange={(e) =>
      setMaterialOperacionProducto(
        e.target.value
      )
    }
  />

  {/* MEDIDA */}

  <input
    type="text"
    placeholder="Medida mm"
    style={estiloInput}
    value={medidaOperacionProducto}
    onChange={(e) =>
      setMedidaOperacionProducto(
        e.target.value
      )
    }
  />

  {/* CANTIDAD */}

  <input
    type="number"
    placeholder="Cantidad requerida"
    style={estiloInput}
    value={cantidadOperacionProducto}
    onChange={(e) =>
      setCantidadOperacionProducto(
        e.target.value
      )
    }
  />

  {/* UNIDADES HORA */}

  <input
    type="number"
    placeholder="Unidades por hora"
    style={estiloInput}
    value={unidadesHoraOperacionProducto}
    onChange={(e) =>
      setUnidadesHoraOperacionProducto(
        e.target.value
      )
    }
  />

  <button
    style={botonVerde}

    onClick={async () => {

      if (

        !productoSeleccionadoOperacion ||

        !operacionSeleccionadaProducto

      ) {

        alert(
          "Completa datos"
        );

        return;

      }

      try {

        const productoDoc =
          productosConfig.find(
            p =>
              p.id ===
              productoSeleccionadoOperacion
          );

        const estructuraActual =
          productoDoc.estructura || [];

        await updateDoc(

          doc(
            db,
            "config_productos",
            productoSeleccionadoOperacion
          ),

          {

            estructura: [

              ...estructuraActual,

              {

                operacion:
                  operacionSeleccionadaProducto,

                material:
                  materialOperacionProducto,

                medida:
                  medidaOperacionProducto,

                cantidad:
                  Number(
                    cantidadOperacionProducto
                  ),

                unidades_hora:
                  Number(
                    unidadesHoraOperacionProducto
                  )

              }

            ]

          }

        );

        alert(
          "✅ Operación agregada"
        );

        setOperacionSeleccionadaProducto("");

        setMaterialOperacionProducto("");

        setMedidaOperacionProducto("");

        setCantidadOperacionProducto("");

        setUnidadesHoraOperacionProducto("");

        cargarDatos();

      }

      catch (error) {

        console.error(error);

        alert(
          "Error agregando operación"
        );

      }

    }}
  >

    ✅ Guardar Operación

  </button>

</div>

      {/* LISTADO */}

      <div style={{
        marginTop: 30
      }}>

        <h3>
          📚 Productos
        </h3>

        {Array.isArray(productosConfig) &&

          productosConfig.map((p) => (

            <div
              key={p.id}
              style={{
                background: "white",
                padding: 18,
                borderRadius: 14,
                marginBottom: 14,
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.06)"
              }}
            >

              <div style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center"
              }}>

                <div style={{
                  fontWeight: "bold",
                  fontSize: 20
                }}>
                  📦 {p.nombre}
                </div>

                <div>

                  {
                    p.activo
                      ? "🟢 Activo"
                      : "⚫ Inactivo"
                  }

                </div>

              </div>

              <div style={{
                marginTop: 10,
                color: "#666"
              }}>

                🧩 Componentes:
                {" "}

                {
                  Array.isArray(p.estructura)
                    ? p.estructura.length
                    : 0
                }

              </div>

            </div>

          ))

        }

      </div>

      <button
        style={botonAzul}
        onClick={() =>
          setPantalla("home")
        }
      >

        ⬅ Volver

      </button>

    </div>

  );

}

if (pantalla === "operacionesMaestras") {

  return (

    <div style={{
      padding: 20,
      maxWidth: 900,
      margin: "0 auto"
    }}>

      <h2>
        ⚙️ Operaciones Maestras
      </h2>

      {/* CREAR */}

      <div style={{
        background: "white",
        padding: 20,
        borderRadius: 14,
        marginTop: 20,
        boxShadow:
          "0 2px 8px rgba(0,0,0,0.08)"
      }}>

        <h3>
          ➕ Crear Operación
        </h3>

        {/* CÓDIGO */}

        <input
          type="text"
          placeholder="Código operación"
          style={estiloInput}
          value={codigoOperacion}
          onChange={(e) =>
            setCodigoOperacion(
              e.target.value
            )
          }
        />

        {/* NOMBRE */}

        <input
          type="text"
          placeholder="Nombre operación"
          style={estiloInput}
          value={nombreOperacion}
          onChange={(e) =>
            setNombreOperacion(
              e.target.value
            )
          }
        />

        {/* PROCESO */}

        <select
          style={estiloInput}
          value={procesoOperacion}
          onChange={(e) =>
            setProcesoOperacion(
              e.target.value
            )
          }
        >

          <option value="">
            Seleccionar proceso
          </option>

          {procesosConfig.map((p) => (

            <option
              key={p.id}
              value={p.nombre}
            >

              {p.nombre}

            </option>

          ))}

        </select>

        {/* SUBPROCESO */}

        <select
          style={estiloInput}
          value={subprocesoOperacion}
          onChange={(e) =>
            setSubprocesoOperacion(
              e.target.value
            )
          }
        >

          <option value="">
            Seleccionar subproceso
          </option>

          {

            procesosConfig

              .find(
                p =>
                  p.nombre ===
                  procesoOperacion
              )

              ?.subprocesos

              ?.map((s, i) => (

                <option
                  key={i}
                  value={s.nombre}
                >

                  {s.nombre}

                </option>

              ))

          }

        </select>

        <button
          style={botonVerde}

          onClick={async () => {

            if (

              !codigoOperacion ||

              !nombreOperacion ||

              !procesoOperacion ||

              !subprocesoOperacion

            ) {

              alert(
                "Completa datos"
              );

              return;

            }

            try {

              await addDoc(

                collection(
                  db,
                  "operaciones_maestras"
                ),

                {

                  codigo:
                    codigoOperacion,

                  nombre:
                    nombreOperacion,

                  proceso:
                    procesoOperacion,

                  subproceso:
                    subprocesoOperacion,

                  activo: true,

                  fecha_creacion:
                    new Date()

                }

              );

              alert(
                "✅ Operación creada"
              );

              setCodigoOperacion("");

              setNombreOperacion("");

              setProcesoOperacion("");

              setSubprocesoOperacion("");

              cargarDatos();

            }

            catch (error) {

              console.error(error);

              alert(
                "Error creando operación"
              );

            }

          }}
        >

          ✅ Guardar Operación

        </button>

      </div>

      {/* LISTADO */}

      <div style={{
        marginTop: 30
      }}>

        <h3>
          📚 Operaciones
        </h3>

        {Array.isArray(operacionesMaestras) &&

          operacionesMaestras.map((o) => (

            <div
              key={o.id}
              style={{
                background: "white",
                padding: 18,
                borderRadius: 14,
                marginBottom: 14,
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.06)"
              }}
            >

              <div style={{
                fontWeight: "bold",
                fontSize: 20
              }}>
                ⚙️ {o.codigo}
              </div>

              <div style={{
                marginTop: 8
              }}>

                {o.nombre}

              </div>

              <div style={{
                marginTop: 8,
                color: "#666"
              }}>

                🏭 {o.proceso}
                {" • "}
                ⚙️ {o.subproceso}

              </div>

            </div>

          ))

        }

      </div>

      <button
        style={botonAzul}
        onClick={() =>
          setPantalla("home")
        }
      >

        ⬅ Volver

      </button>

    </div>

  );

}

  if (pantalla === "dashboard") {

  const esMobile = window.innerWidth < 768;

  const esTV = modoTV;
  const escalaTV = esTV ? 0.72 : 1;

  const promedio =
    dashboard.length > 0
      ? dashboard.reduce((a, b) => a + (b.eficiencia || 0), 0) / dashboard.length
      : 0;

  const hace7Dias = new Date();

  hace7Dias.setDate(
  hace7Dias.getDate() - 7
  );

  const registrosSemana =
    dashboard.filter(r => {

      if (!r.fecha?.toDate)
        return false;

      return (
        r.fecha.toDate() >= hace7Dias
      );

    });

  const ranking = Object.values(

    registrosSemana.reduce((acc, r) => {

      if (!r.operario)
        return acc;

      if (!acc[r.operario]) {

        acc[r.operario] = {
          operario: r.operario,
          total: 0,
          count: 0
        };

      }

      acc[r.operario].total +=
        r.eficiencia || 0;

      acc[r.operario].count += 1;

      return acc;

    }, {})

  )

  .map(r => ({      
    operario: r.operario,
    promedio:
      r.count > 0
        ? r.total / r.count
        : 0
  }))

.filter(r =>
  r.promedio > 0
)

  .sort((a, b) =>
    b.promedio - a.promedio
  );

  const top1 = ranking[0];

  const alertas = [];
  const limiteRegistrosPorSupervisor = 12;

  const fechaRegistroMs = registro => {
    if (registro?.fecha?.toDate) {
      return registro.fecha.toDate().getTime();
    }

    const fecha = new Date(registro?.fecha);
    return Number.isNaN(fecha.getTime())
      ? 0
      : fecha.getTime();
  };

  const supervisorRegistro = registro =>
    (
      registro?.finalizado_por ||
      registro?.registrado_por ||
      registro?.iniciado_por ||
      registro?.supervisor ||
      "Sin supervisor"
    ).toString().trim() || "Sin supervisor";

  const gruposDashboardSupervisor = Object.values(
    dashboard.reduce((acc, registro) => {
      const supervisor =
        supervisorRegistro(registro);

      if (!acc[supervisor]) {
        acc[supervisor] = {
          supervisor,
          ultimoRegistroMs: 0,
          registros: []
        };
      }

      const fechaMs =
        fechaRegistroMs(registro);
      acc[supervisor].ultimoRegistroMs =
        Math.max(
          acc[supervisor].ultimoRegistroMs,
          fechaMs
        );
      acc[supervisor].registros.push(registro);

      return acc;
    }, {})
  )
    .map(grupo => ({
      ...grupo,
      registros: grupo.registros
        .slice()
        .sort(
          (a, b) =>
            fechaRegistroMs(b) -
            fechaRegistroMs(a)
        )
        .slice(0, limiteRegistrosPorSupervisor)
        .sort((a, b) => {
          const eficiencia =
            Number(b.eficiencia || 0) -
            Number(a.eficiencia || 0);

          if (eficiencia !== 0) {
            return eficiencia;
          }

          return fechaRegistroMs(b) -
            fechaRegistroMs(a);
        })
    }))
    .sort(
      (a, b) =>
        b.ultimoRegistroMs -
        a.ultimoRegistroMs
    );

if (parosActivos.length > 0) {

  alertas.push({
    tipo: "error",
    mensaje:
      `⛔ Hay ${parosActivos.length} paro(s) activo(s)`
  });

}

if (promedio < 60) {

  alertas.push({
    tipo: "critico",
    mensaje:
      "📉 Eficiencia general crítica"
  });

}

produccionActiva.forEach(p => {

  if (!p.inicio?.toDate)
    return;

  const horas =
    (ahora - p.inicio.toDate())
    / 3600000;

  if (horas >= 4) {

    alertas.push({
      tipo: "warning",
      mensaje:
        `🕒 ${p.operario} lleva más de 4h en producción`
    });

  }

});

  const datosGrafico =
  ranking.map(r => ({

    nombre: r.operario,

    eficiencia:
      Number(
        r.promedio.toFixed(1)
      )

  }));

  const datosParos = Object.entries(

    todosLosParos.reduce((acc, paro) => {

      const motivo =
        paro.motivo || "SIN MOTIVO";

      acc[motivo] =
        (acc[motivo] || 0) + 1;

      return acc;

    }, {})

  )

  .map(([motivo, cantidad]) => ({

    motivo,

    cantidad

  }))

  .sort((a, b) =>
    b.cantidad - a.cantidad
  )

  .slice(0, 5);

  return (
  <>

    <style>
    {`
      @keyframes blink {
        0% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
        100% {
          opacity: 1;
        }
      }
    `}
    </style>

    <div style={{
  width: "100%",
  maxWidth: "100%",
  overflowX: "hidden",
  boxSizing: "border-box",
  padding: esTV ? 12 : 20,
  background: "#f4f6f8",
  minHeight: "calc(100vh - 40px)",
  fontFamily: "Arial"
}}>

      {/* 🧠 LAYOUT PRINCIPAL */}
      <div style={{
        display: esMobile ? "block" : "grid",
        gridTemplateColumns:
          esTV
            ? "260px 1fr"
            : "300px 1fr",

        gap: 20 * escalaTV
      }}>

        {/* IZQUIERDA */}
        <div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              fontWeight: "bold"
            }}
          >
            <div
              style={{
                width: esTV ? 12 : 14,
                height: esTV ? 12 : 14,
                borderRadius: "50%",
                background: "#F44336",
                boxShadow: "0 0 8px #F44336",
                animation: "blink 1s infinite"
              }}
            />

             <span>EN VIVO</span>
          </div>

          {top1 && (
            <div style={{
              background: "#4CAF50",
              color: "white",
              padding: esTV ? 12 : 20,
              borderRadius: 12,
              textAlign: "center",
              marginBottom: esTV ? 10 : 20
            }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: esTV ? 12 : 18
                }}>
                🥇 MEJOR OPERARIO
              </h3>

              <h1
                style={{
                  margin: esTV ? "4px 0" : "8px 0",
                  fontSize: esTV ? 24 : 32
                }}>
                {top1.operario}
              </h1>

              <h2
                style={{
                  margin: 0,
                  fontSize: esTV ? 18 : 24
              }}>
                {top1.promedio.toFixed(1)}%
              </h2>
            </div>
          )}

          <h3
            style={{
              marginTop: esTV ? 5 : 16,
              marginBottom: esTV ? 6 : 16,
              color: "#F9A825"
            }}
          >
            🏆 Ranking
          </h3>

          {ranking.slice(0, 25).map((r, i) => {

  let color = "#F44336";

  if (r.promedio >= 90) {
    color = "#4CAF50";
  }
  else if (r.promedio >= 70) {
    color = "#FFC107";
  }

  return (

<div
  key={i}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: esTV ? 2 : 4,
    background: "white",
    padding: esTV ? "2px 6px" : "4px 8px",
    borderRadius: 8
  }}
>

  <div
    style={{
      width: esTV ? 110 : 120,
      fontSize: esTV ? 13 : 12,
      fontWeight: "bold",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }}
  >
    {i + 1}. {r.operario}
  </div>

  <div
    style={{
      flex: 1,
      height: esTV ? 7 : 10,
      background: "#E0E0E0",
      borderRadius: 20,
      overflow: "hidden"
    }}
  >

    <div
      style={{
        width: `${Math.min(r.promedio, 150) / 1.5}%`,
        height: "100%",
        background: color
      }}
    />

  </div>

  <div
    style={{
      width: 55,
      textAlign: "right",
      fontWeight: "bold",
      fontSize: esTV ? 13 : 12
    }}
  >
    {r.promedio.toFixed(1)}%
  </div>

</div>

  );

})}

        </div>

        {/* DERECHA */}
        <div>

          <div style={{
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  marginBottom: 15
}}>

            <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: esTV ? 12 : 15,
    flexWrap: "wrap"
  }}
>
  <h2
    style={{
      margin: 0,
      fontSize: `${32 * escalaTV}px`
    }}
  >
    📊 Dashboard
  </h2>

  <div
    style={{
      fontSize: esTV ? 12 : 14,
      color: "#555",
      fontWeight: "bold"
    }}
  >
    🕒 {ahora.toLocaleString()}
  </div>
</div>

            <button
              onClick={() => setModoTV(!modoTV)}
              style={{
                justifySelf: "center",
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              📺 Modo TV
            </button>

            <div></div>

          </div>

          <div style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns:
              esTV
                ? "repeat(4, 1fr)"
                : "repeat(4, minmax(260px, 1fr))",
            gap: 15,
            marginTop: 20,
            marginBottom: 25
          }}>

            {/* PRODUCCIÓN TOTAL */}
            <div
  style={{
    background: "white",
    padding: `${12 * escalaTV}px ${18 * escalaTV}px`,
    borderRadius: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: "auto"
  }}
>

  <div
    style={{
      fontSize: 12,
      color: "#666",
      fontWeight: "600"
    }}
  >
    📦 Producción Total
  </div>

  <div
  style={{
    fontSize: esMobile ? 22 : 26,
    fontWeight: "bold",
    color: "#1976D2",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }}
>
  {
    dashboard
      .reduce(
        (acc, r) => acc + (r.cantidad_ok || 0),
        0
      )
      .toLocaleString("es-CL")
  }
</div>

</div>

            {/* OPERARIOS ACTIVOS */}
            <div
  style={{
    background: "white",
    padding: "12px 18px",
    borderRadius: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}
>

  <div
    style={{
      fontSize: 12,
      color: "#666",
      fontWeight: "600"
    }}
  >
    👷 Operarios Activos
  </div>

  <div
    style={{
      fontSize: esMobile ? 22 : 26,
      fontWeight: "bold",
      color: "#2E7D32"
    }}
  >
    {produccionActiva.length}
  </div>

</div>

            {/* PAROS ACTIVOS */}
            <div
  style={{
    background: "white",
    padding: "12px 18px",
    borderRadius: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}
>

  <div
    style={{
      fontSize: 12,
      color: "#666",
      fontWeight: "600"
    }}
  >
    ⛔ Paros Activos
  </div>

  <div
    style={{
      fontSize: esMobile ? 22 : 26,
      fontWeight: "bold",
      color: "#D32F2F"
    }}
  >
    {parosActivos.length}
  </div>

</div>

            {/* EFICIENCIA */}
            <div
  style={{
    background: "white",
    padding: "12px 18px",
    borderRadius: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}
>

  <div
    style={{
      fontSize: 12,
      color: "#666",
      fontWeight: "600"
    }}
  >
    ⚙️ Eficiencia General
  </div>

  <div
    style={{
      fontSize: esMobile ? 22 : 26,
      fontWeight: "bold",
      color:
        promedio < 70
          ? "#D32F2F"
          : promedio < 90
          ? "#F9A825"
          : "#2E7D32"
    }}
  >
    {promedio.toFixed(1)}%
  </div>

</div>

          </div>

          <h3
            style={{
              marginTop: esTV ? 5 : 16,
              marginBottom: esTV ? 6 : 16
            }}
          >
            Últimos registros
          </h3>

          {/* DESKTOP */}
          {!esMobile && (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns:
  esTV
    ? "120px 65px 80px 150px 110px 170px 130px 85px 55px"
    : "175px 70px 180px 135px 160px 240px 195px 125px 70px",
                fontWeight: "bold",
                marginBottom: esTV ? 4 : 10
              }}>
                <div>Fecha</div>
                <div>Estado</div>
                <div>Operario</div>
                <div>OT</div>
                <div>Proceso</div>
                <div>Subproceso</div>
                <div>Detalle</div>
                <div>Cantidad</div>
                <div>%</div>
              </div>

              {gruposDashboardSupervisor.map(grupo => (
                <div
                  key={grupo.supervisor}
                  style={{
                    marginBottom: esTV ? 8 : 14
                  }}
                >
                  <div style={{
                    background: "#111827",
                    color: "white",
                    borderRadius: 8,
                    padding: esTV
                      ? "3px 8px"
                      : "6px 10px",
                    fontSize: esTV ? 11 : 13,
                    fontWeight: "bold",
                    marginBottom: esTV ? 3 : 6
                  }}>
                    Supervisor: {grupo.supervisor}
                  </div>

                  {grupo.registros
                    .slice(0, limiteRegistrosPorSupervisor)
                    .map((r, i) => (
                      <div key={`${grupo.supervisor}-${r.id || i}`} style={{
                        display: "grid",
                        gridTemplateColumns:
        esTV
          ? "120px 65px 80px 150px 110px 170px 130px 85px 55px"
          : "190px 55px 100px 210px 160px 240px 200px 120px 70px",
                        padding: 
                          esTV
                            ? "2px 4px"
                            : "3px 6px",
                        fontSize: esTV ? 11 : 12,
                        background: "white",
                        borderRadius: 8,
                        marginBottom: esTV ? 2 : 6
                      }}>
                        <div>
                          {r.fecha?.toDate
                            ? r.fecha.toDate().toLocaleString()
                            : "-"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center"
                          }}
                        >
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background:
                                r.eficiencia >= 90
                                  ? "#4CAF50"
                                  : r.eficiencia >= 70
                                  ? "#FFC107"
                                  : "#F44336"
                            }}
                          />
                        </div>
                        <div><b>{r.operario}</b></div>
                        <div>{r.ot || "-"}</div>
                        <div>{r.proceso}</div>
                        <div>{r.subproceso}</div>
                        <div>{r.detalle || "-"}</div>
                        <div>{r.cantidad_ok} un</div>
                        <div>{r.eficiencia}%</div>
                      </div>
                    ))}
                </div>
              ))}
            </>
          )}

          {/* MOBILE */}
          {esMobile && gruposDashboardSupervisor.map(grupo => (
            <div key={grupo.supervisor}>
              <div style={{
                background: "#111827",
                color: "white",
                borderRadius: 10,
                padding: "8px 10px",
                fontWeight: "bold",
                marginBottom: 10
              }}>
                Supervisor: {grupo.supervisor}
              </div>

              {grupo.registros.slice(0, limiteRegistrosPorSupervisor).map((r, i) => (
                <div key={`${grupo.supervisor}-${r.id || i}`} style={{
                  background: "white",
                  padding: 15,
                  borderRadius: 12,
                  marginBottom: 12
                }}>
                  <div style={{
                    fontSize: 12,
                    color: "#777",
                    marginBottom: 5
                  }}>
                    {r.fecha?.toDate
                      ? r.fecha.toDate().toLocaleString()
                      : "-"}
                  </div>
                  <b>{r.estado_eficiencia} {r.operario}</b>
                  <div>
                    {r.proceso}
                    {" → "}
                    {r.subproceso}
                  </div>

                  <div style={{
                    fontSize: 13,
                    marginTop: 3
                  }}>
                    📋 OT:
                    {" "}
                    {r.ot || "-"}
                  </div>
                  <div style={{ fontSize: 13 }}>{r.detalle}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{r.cantidad_ok} un</span>
                    <b>{r.eficiencia}%</b>
                  </div>
                </div>
              ))}
            </div>
          ))}

        </div>
      </div> 

      <div style={{
        marginTop: 20,
        marginBottom: 20
      }}>

        <button
          onClick={() =>
            setPantalla("historialParos")
          }
          style={{
            padding: "12px 25px",
            borderRadius: 10,
            border: "none",
            background: "#455A64",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📋 Historial de Paros
        </button>

        <button
          onClick={() =>
            setPantalla(
              "historialAjustes"
            )
          }
          style={{
            padding: "12px 25px",
            borderRadius: 10,
            border: "none",
            background: "#6A1B9A",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            marginLeft: 10
          }}
        >

          🛠 Historial Ajustes

        </button>

      </div>

      {/* BOTÓN */}
      <div style={{ textAlign: "center", marginTop: 5 }}>
        <button
          onClick={() => setPantalla("home")}
          style={{
            padding: "15px 40px",
            fontSize: 18,
            borderRadius: 12,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontWeight: "bold"
          }}
        >
          ⬅ Volver al Inicio
        </button>
      </div>

    </div>

    </>
    );
}
}

export default App;
