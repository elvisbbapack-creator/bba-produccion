import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  autocompletarDependenciasRf,
  validarRuta
} from "../../domain/produccionV2";
import {
  listarMateriales
} from "../materiales/materialesRepository";
import {
  listarCapacidadesProceso
} from "../capacidad/capacidadRepository";
import {
  aCatalogoProcesosRuta,
  listarProcesosEstaciones
} from "../procesos/procesosRepository";
import {
  listarPiezas
} from "../piezas/piezasRepository";
import {
  listarOperacionesCatalogo
} from "../detalles/detallesRepository";
import {
  listarSubproductos
} from "../subproductos/subproductosRepository";
import {
  actualizarOperacionRuta,
  actualizarDependenciasOperacionesRuta,
  actualizarComposicionProducto,
  anularRutaPublicada,
  crearVersionBorradorRuta,
  crearProductoConRuta,
  eliminarOperacionRuta,
  eliminarRutaBorrador,
  extraerCatalogoProcesosRuta,
  guardarOperacionRuta,
  listarProductos,
  operacionesQueDependenDe,
  obtenerRuta,
  prepararOperacionRuta,
  prepararProducto,
  publicarRuta,
  recalibrarEstandarRuta,
  siguienteCodigoProducto,
  validarOperacionBasica,
  validarProducto
} from "./productosRepository";

const productoInicial = {
  codigo: "",
  nombre: "",
  familia: ""
};

const operacionInicial = {
  codigo: "",
  nombre: "",
  pieza_id: "",
  pieza_codigo: "",
  pieza_nombre: "",
  subproducto_id: "",
  subproducto_codigo: "",
  subproducto_nombre: "",
  proceso_codigo: "",
  proceso_nombre: "",
  estacion_codigo: "",
  estacion_nombre: "",
  subproceso_codigo: "",
  subproceso_nombre: "",
  material_entrada_id: "",
  materiales_entrada: [],
  material_salida_id: "",
  medida: "",
  unidades_por_producto: "",
  unidades_por_hora: "",
  dependencias: [],
  dependencia_id: "",
  porcentaje_minimo_avance: "0"
};

const crearDependenciaInicial = () => ({
  ruta_operacion_id: "",
  porcentaje_minimo_avance: "0",
  requiere_material_disponible: true
});

const crearMaterialEntradaInicial = () => ({
  material_id: "",
  cantidad: 1
});

const itemComposicionInicial = {
  tipo: "SUBPRODUCTO",
  categoria: "subproducto",
  item_id: "",
  cantidad: 1
};

const TIPOS_RUTA = {
  PRODUCTO: "PRODUCTO",
  SUBPRODUCTO: "SUBPRODUCTO"
};

const campo = {
  width: "100%",
  padding: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14
};

const tarjeta = {
  background: "white",
  padding: 20,
  borderRadius: 14,
  boxShadow:
    "0 2px 10px rgba(15,23,42,0.08)"
};

const etiqueta = {
  display: "grid",
  gap: 5,
  color: "#334155",
  fontWeight: "bold",
  fontSize: 14
};

function ConstructorRutasV2({
  db,
  perfil,
  onVolver
}) {
  const [productos, setProductos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [piezas, setPiezas] = useState([]);
  const [procesosEstaciones,
    setProcesosEstaciones] = useState([]);
  const [capacidadesProceso,
    setCapacidadesProceso] = useState([]);
  const [operacionesCatalogo,
    setOperacionesCatalogo] = useState([]);
  const [subproductos, setSubproductos] =
    useState([]);
  const [productoId, setProductoId] =
    useState("");
  const [filtroProductos, setFiltroProductos] =
    useState("");
  const [tipoRuta, setTipoRuta] = useState(
    TIPOS_RUTA.PRODUCTO
  );
  const [subproductoRutaId,
    setSubproductoRutaId] = useState("");
  const [ruta, setRuta] = useState(null);
  const [productoForm, setProductoForm] =
    useState(productoInicial);
  const [operacionForm, setOperacionForm] =
    useState(operacionInicial);
  const [operacionEditandoId,
    setOperacionEditandoId] = useState("");
  const [
    formularioOperacionAbierto,
    setFormularioOperacionAbierto
  ] = useState(false);
  const [itemComposicion, setItemComposicion] =
    useState(itemComposicionInicial);
  const [composicionProducto,
    setComposicionProducto] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [recalibrandoId, setRecalibrandoId] =
    useState("");
  const [recalibracion, setRecalibracion] =
    useState({
      unidades_por_hora: "",
      motivo: ""
    });
  const [motivoAnulacion, setMotivoAnulacion] =
    useState("");
  const productoIdAnteriorRef = useRef("");

  const productoSeleccionado = productos.find(
    producto => producto.id === productoId
  );
  const esRutaSubproducto =
    tipoRuta === TIPOS_RUTA.SUBPRODUCTO;
  const subproductosProducto =
    subproductos.filter(
      subproducto =>
        subproducto.activo !== false &&
        subproducto.producto_id === productoId
    );
  const subproductoRutaSeleccionado =
    subproductosProducto.find(
      subproducto =>
        subproducto.id === subproductoRutaId
    );
  const entidadRutaId = esRutaSubproducto
    ? subproductoRutaId
    : productoId;
  const entidadRutaSeleccionada =
    esRutaSubproducto
      ? subproductoRutaSeleccionado
      : productoSeleccionado;
  const rutaPublicada =
    ruta?.estado === "publicada";
  const rutaBorrador =
    ruta?.estado === "borrador";
  const productoCompuestoPorSubproductos =
    !esRutaSubproducto &&
    subproductosProducto.length > 0 &&
    (ruta?.operaciones || []).length === 0;
  const materialesActivos = materiales.filter(
    material => material.activo
  );
  const materialDisponibleParaProducto = material =>
    material.tipo !== "RF" ||
    !productoId ||
    !material.producto_id ||
    material.producto_id === productoId ||
    (material.productos_asociados || []).some(
      producto =>
        producto.producto_id === productoId
    );
  const materialesDisponiblesProducto =
    materialesActivos.filter(
      material =>
        materialDisponibleParaProducto(material)
    );
  const salidasRf = materialesDisponiblesProducto.filter(
    material => material.tipo === "RF"
  );
  const piezaDisponibleParaProducto = pieza =>
    !productoId ||
    !pieza?.producto_id ||
    pieza.producto_id === productoId ||
    (pieza.productos_asociados || []).some(
      producto =>
        producto.producto_id === productoId
    );
  const piezasProducto = piezas.filter(
    pieza =>
      pieza.activo !== false &&
      piezaDisponibleParaProducto(pieza)
  );
  const operacionesCatalogoActivas =
    operacionesCatalogo.filter(
      operacion => {
        if (!operacion.activo) {
          return false;
        }

        const piezaOperacion = piezas.find(
          pieza => pieza.id === operacion.pieza_id
        );
        const productoOperacionId =
          operacion.producto_id ||
          piezaOperacion?.producto_id ||
          "";
        const productosOperacion =
          operacion.productos_asociados?.length > 0
            ? operacion.productos_asociados
            : piezaOperacion?.productos_asociados || [];

        return (
          !productoId ||
          !productoOperacionId ||
          productoOperacionId === productoId ||
          productosOperacion.some(
            producto =>
              producto.producto_id === productoId
          )
        );
      }
    );
  const subproductosOperacion =
    esRutaSubproducto
      ? subproductoRutaSeleccionado
        ? [subproductoRutaSeleccionado]
        : []
      : subproductosProducto;
  const opcionesComposicion =
    itemComposicion.tipo === "SUBPRODUCTO"
      ? subproductosProducto
      : itemComposicion.tipo === "PIEZA"
        ? piezasProducto
        : materialesDisponiblesProducto;
  const itemBaseOperacion =
    operacionForm.subproducto_id
      ? composicionProducto.find(
          item =>
            item.tipo === "SUBPRODUCTO" &&
            item.item_id ===
              operacionForm.subproducto_id
        )
      : operacionForm.pieza_id
        ? composicionProducto.find(
            item =>
              item.tipo === "PIEZA" &&
              item.item_id ===
                operacionForm.pieza_id
          )
        : null;
  const factorItemBaseOperacion = Number(
    itemBaseOperacion?.cantidad || 1
  );
  const etiquetaUnidadesOperacion =
    operacionForm.subproducto_id
      ? "Unidades por subproducto"
      : operacionForm.pieza_id
        ? "Unidades por pieza"
        : "Unidades por producto";
  const operacionCatalogoSeleccionadaId =
    operacionesCatalogoActivas.find(
      operacion =>
        operacion.codigo ===
        operacionForm.codigo
    )?.id || "";
  const completarSubproductoRuta = useCallback(
    (datos = {}) => {
      if (
        !esRutaSubproducto ||
        !subproductoRutaSeleccionado
      ) {
        return datos;
      }

      return {
        ...datos,
        subproducto_id:
          datos.subproducto_id ||
          subproductoRutaSeleccionado.id,
        subproducto_codigo:
          datos.subproducto_codigo ||
          subproductoRutaSeleccionado.codigo,
        subproducto_nombre:
          datos.subproducto_nombre ||
          subproductoRutaSeleccionado.nombre
      };
    },
    [esRutaSubproducto, subproductoRutaSeleccionado]
  );
  const catalogoProcesosRuta = useMemo(
    () => extraerCatalogoProcesosRuta(
      ruta?.operaciones || [],
      [
        ...aCatalogoProcesosRuta(
          procesosEstaciones
        ),
        ...capacidadesProceso
      ]
    ),
    [
      capacidadesProceso,
      procesosEstaciones,
      ruta
    ]
  );
  const opcionesProceso =
    catalogoProcesosRuta.procesos;
  const opcionesSubproceso =
    catalogoProcesosRuta.subprocesos.filter(
      subproceso =>
        !operacionForm.proceso_codigo ||
        subproceso.proceso_codigo ===
          operacionForm.proceso_codigo
    );
  const productosFiltrados = useMemo(() => {
    const busqueda = filtroProductos
      .trim()
      .toLowerCase();

    if (!busqueda) {
      return productos;
    }

    return productos.filter(producto =>
      [
        producto.codigo,
        producto.nombre,
        producto.familia
      ]
        .filter(Boolean)
        .some(valor =>
          String(valor)
            .toLowerCase()
            .includes(busqueda)
        )
    );
  }, [filtroProductos, productos]);

  const cargarCatalogos = useCallback(
    async () => {
      try {
        setCargando(true);
        setError("");
        const [
          productosData,
          materialesData,
          piezasData,
          procesosEstacionesData,
          capacidadesProcesoData,
          operacionesCatalogoData,
          subproductosData
        ] =
          await Promise.all([
            listarProductos(
              db,
              perfil.empresa_id
            ),
            listarMateriales(
              db,
              perfil.empresa_id
            ),
            listarPiezas(
              db,
              perfil.empresa_id
            ),
            listarProcesosEstaciones(
              db,
              perfil.empresa_id
            ),
            listarCapacidadesProceso(
              db,
              perfil.empresa_id
            ),
            listarOperacionesCatalogo(
              db,
              perfil.empresa_id
            ),
            listarSubproductos(
              db,
              perfil.empresa_id
            )
          ]);
        setProductos(productosData);
        setMateriales(materialesData);
        setPiezas(piezasData);
        setProcesosEstaciones(
          procesosEstacionesData
        );
        setCapacidadesProceso(
          capacidadesProcesoData
        );
        setOperacionesCatalogo(
          operacionesCatalogoData
        );
        setSubproductos(subproductosData);
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar los catálogos."
        );
      } finally {
        setCargando(false);
      }
    },
    [db, perfil.empresa_id]
  );

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    const siguienteCodigo =
      siguienteCodigoProducto(productos);

    setProductoForm(actual =>
      actual.codigo === siguienteCodigo
        ? actual
        : {
            ...actual,
            codigo: siguienteCodigo
          }
    );
  }, [productos]);

  const cargarRuta = useCallback(
    async (
      id,
      version = 1,
      opcionesRuta = {}
    ) => {
      if (!id) {
        setRuta(null);
        setOperacionEditandoId("");
        setOperacionForm(operacionInicial);
        return;
      }

      try {
        setError("");
        setRuta(
          await obtenerRuta(
            db,
            opcionesRuta.productoId || id,
            perfil.empresa_id,
            version,
            {
              tipoRuta:
                opcionesRuta.tipoRuta ||
                TIPOS_RUTA.PRODUCTO,
              subproductoId:
                opcionesRuta.subproductoId,
              entidadId: id
            }
          )
        );
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudo cargar la ruta."
        );
      }
    },
    [db, perfil.empresa_id]
  );

  useEffect(() => {
    if (
      productoIdAnteriorRef.current === productoId
    ) {
      return;
    }

    productoIdAnteriorRef.current = productoId;
    setComposicionProducto(
      productoSeleccionado?.composicion || []
    );
    setItemComposicion(itemComposicionInicial);
    setOperacionEditandoId("");
    setOperacionForm(operacionInicial);
    setSubproductoRutaId("");
    setTipoRuta(TIPOS_RUTA.PRODUCTO);
  }, [productoId, productoSeleccionado?.composicion]);

  useEffect(() => {
    setOperacionEditandoId("");
    setOperacionForm(operacionInicial);
  }, [tipoRuta, subproductoRutaId]);

  useEffect(() => {
    if (!esRutaSubproducto) {
      return;
    }

    setOperacionForm(actual => ({
      ...actual,
      subproducto_id:
        subproductoRutaSeleccionado?.id || "",
      subproducto_codigo:
        subproductoRutaSeleccionado?.codigo || "",
      subproducto_nombre:
        subproductoRutaSeleccionado?.nombre || "",
      pieza_id:
        actual.pieza_id ||
        subproductoRutaSeleccionado
          ?.pieza_salida_id ||
        "",
      pieza_codigo:
        actual.pieza_codigo ||
        subproductoRutaSeleccionado
          ?.pieza_salida_codigo ||
        "",
      pieza_nombre:
        actual.pieza_nombre ||
        subproductoRutaSeleccionado
          ?.pieza_salida_nombre ||
        "",
      medida:
        actual.medida ||
        (subproductoRutaSeleccionado
          ? "Armado"
          : "")
    }));
  }, [esRutaSubproducto, subproductoRutaSeleccionado]);

  const actualizarProducto = (nombre, valor) => {
    setProductoForm(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarOperacion = (
    nombre,
    valor
  ) => {
    setOperacionForm(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarProcesoRuta = (
    campoProceso,
    valor
  ) => {
    if (!valor) {
      setOperacionForm(actual => ({
        ...actual,
        proceso_codigo: "",
        proceso_nombre: "",
        estacion_codigo: "",
        estacion_nombre: "",
        subproceso_codigo: "",
        subproceso_nombre: ""
      }));
      setError("");
      setMensaje("");
      return;
    }

    const proceso =
      opcionesProceso.find(opcion =>
        campoProceso === "codigo"
          ? opcion.codigo === valor
          : opcion.nombre === valor
      );

    setOperacionForm(actual => ({
      ...actual,
      [campoProceso === "codigo"
        ? "proceso_codigo"
        : "proceso_nombre"]: valor,
      ...(proceso
        ? {
            proceso_codigo: proceso.codigo,
            proceso_nombre: proceso.nombre
          }
        : {})
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarSubprocesoRuta = (
    campoSubproceso,
    valor
  ) => {
    if (!valor) {
      setOperacionForm(actual => ({
        ...actual,
        estacion_codigo: "",
        estacion_nombre: "",
        subproceso_codigo: "",
        subproceso_nombre: ""
      }));
      setError("");
      setMensaje("");
      return;
    }

    const subproceso =
      catalogoProcesosRuta.subprocesos.find(
        opcion =>
          campoSubproceso === "codigo"
            ? opcion.codigo === valor
            : opcion.nombre === valor
      );

    setOperacionForm(actual => ({
      ...actual,
      [campoSubproceso === "codigo"
        ? "estacion_codigo"
        : "estacion_nombre"]: valor,
      ...(subproceso
        ? {
            estacion_codigo:
              subproceso.codigo,
            estacion_nombre:
              subproceso.nombre,
            subproceso_codigo:
              subproceso.codigo,
            subproceso_nombre:
              subproceso.nombre,
            proceso_codigo:
              subproceso.proceso_codigo ||
              actual.proceso_codigo,
            proceso_nombre:
              subproceso.proceso_nombre ||
              actual.proceso_nombre
          }
        : {})
    }));
    setError("");
    setMensaje("");
  };

  const actualizarItemComposicion = (
    nombre,
    valor
  ) => {
    setItemComposicion(actual => ({
      ...actual,
      [nombre]: valor,
      ...(nombre === "tipo"
        ? {
            item_id: "",
            categoria:
              valor === "SUBPRODUCTO"
                ? "subproducto"
                : valor === "PIEZA"
                  ? "pieza_grafica"
                  : "accesorio"
          }
        : {})
    }));
    setError("");
    setMensaje("");
  };

  const agregarItemComposicion = () => {
    const seleccionado =
      opcionesComposicion.find(
        item => item.id ===
          itemComposicion.item_id
      );
    const cantidad = Number(
      itemComposicion.cantidad
    );

    if (!seleccionado) {
      setError(
        "Selecciona un item para la composición."
      );
      return;
    }

    if (
      !Number.isFinite(cantidad) ||
      cantidad <= 0
    ) {
      setError(
        "La cantidad debe ser mayor que cero."
      );
      return;
    }

    setComposicionProducto(actual => [
      ...actual,
      {
        tipo: itemComposicion.tipo,
        categoria:
          itemComposicion.categoria,
        item_id: seleccionado.id,
        item_codigo: seleccionado.codigo,
        item_nombre: seleccionado.nombre,
        cantidad
      }
    ]);
    setItemComposicion(itemComposicionInicial);
    setError("");
    setMensaje("");
  };

  const quitarItemComposicion = indice => {
    setComposicionProducto(actual =>
      actual.filter((_, posicion) =>
        posicion !== indice
      )
    );
    setError("");
    setMensaje("");
  };

  const guardarComposicion = async () => {
    if (!productoId) {
      return;
    }

    try {
      setGuardando(true);
      const composicionGuardada =
        await actualizarComposicionProducto(
          db,
          productoId,
          composicionProducto
        );
      setProductos(actuales =>
        actuales.map(producto =>
          producto.id === productoId
            ? {
                ...producto,
                composicion:
                  composicionGuardada
              }
            : producto
        )
      );
      setMensaje(
        "Composición del producto guardada."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la composición."
      );
    } finally {
      setGuardando(false);
    }
  };

  const materialesEntradaFormulario =
    operacionForm.materiales_entrada.length > 0
      ? operacionForm.materiales_entrada
      : [crearMaterialEntradaInicial()];
  const dependenciasFormulario =
    operacionForm.dependencias?.length > 0
      ? operacionForm.dependencias
      : [crearDependenciaInicial()];

  const actualizarMaterialEntrada = (
    indice,
    campoMaterial,
    valor
  ) => {
    setOperacionForm(actual => {
      const lista =
        actual.materiales_entrada.length > 0
          ? [...actual.materiales_entrada]
          : [crearMaterialEntradaInicial()];
      const materialSeleccionado =
        campoMaterial === "material_id"
          ? materiales.find(
              material => material.id === valor
            )
          : null;

      lista[indice] = {
        ...lista[indice],
        [campoMaterial]: valor,
        ...(materialSeleccionado
          ? {
              material_codigo:
                materialSeleccionado.codigo,
              material_nombre:
                materialSeleccionado.nombre
            }
          : {})
      };

      return {
        ...actual,
        material_entrada_id:
          lista[0]?.material_id || "",
        materiales_entrada: lista
      };
    });
    setError("");
    setMensaje("");
  };

  const agregarMaterialEntrada = () => {
    setOperacionForm(actual => ({
      ...actual,
      materiales_entrada: [
        ...(actual.materiales_entrada.length > 0
          ? actual.materiales_entrada
          : [crearMaterialEntradaInicial()]),
        crearMaterialEntradaInicial()
      ]
    }));
    setError("");
    setMensaje("");
  };

  const quitarMaterialEntrada = indice => {
    setOperacionForm(actual => {
      const lista = (
        actual.materiales_entrada.length > 0
          ? actual.materiales_entrada
          : [crearMaterialEntradaInicial()]
      ).filter((_, posicion) => posicion !== indice);

      return {
        ...actual,
        material_entrada_id:
          lista[0]?.material_id || "",
        materiales_entrada: lista
      };
    });
    setError("");
    setMensaje("");
  };

  const actualizarDependenciaOperacion = (
    indice,
    campoDependencia,
    valor
  ) => {
    setOperacionForm(actual => {
      const lista =
        actual.dependencias?.length > 0
          ? [...actual.dependencias]
          : [crearDependenciaInicial()];

      lista[indice] = {
        ...lista[indice],
        [campoDependencia]: valor
      };

      return {
        ...actual,
        dependencia_id:
          lista[0]?.ruta_operacion_id || "",
        porcentaje_minimo_avance:
          lista[0]?.porcentaje_minimo_avance ??
          "0",
        dependencias: lista
      };
    });
    setError("");
    setMensaje("");
  };

  const agregarDependenciaOperacion = () => {
    setOperacionForm(actual => ({
      ...actual,
      dependencias: [
        ...(actual.dependencias?.length > 0
          ? actual.dependencias
          : [crearDependenciaInicial()]),
        crearDependenciaInicial()
      ]
    }));
    setError("");
    setMensaje("");
  };

  const quitarDependenciaOperacion = indice => {
    setOperacionForm(actual => {
      const lista = (
        actual.dependencias?.length > 0
          ? actual.dependencias
          : [crearDependenciaInicial()]
      ).filter((_, posicion) => posicion !== indice);

      return {
        ...actual,
        dependencia_id:
          lista[0]?.ruta_operacion_id || "",
        porcentaje_minimo_avance:
          lista[0]?.porcentaje_minimo_avance ??
          "0",
        dependencias: lista
      };
    });
    setError("");
    setMensaje("");
  };

  const seleccionarOperacionCatalogo =
  operacionId => {
    const operacion =
      operacionesCatalogo.find(
        item => item.id === operacionId
      );

    if (!operacion) {
      actualizarOperacion("codigo", "");
      return;
    }

    setOperacionForm(actual =>
      completarSubproductoRuta({
        ...actual,
        codigo: operacion.codigo,
        nombre: operacion.nombre,
        pieza_id: operacion.pieza_id || "",
        pieza_codigo:
          operacion.pieza_codigo || "",
        pieza_nombre:
          operacion.pieza_nombre || "",
        subproducto_id:
          operacion.subproducto_id ||
          actual.subproducto_id ||
          "",
        subproducto_codigo:
          operacion.subproducto_codigo ||
          actual.subproducto_codigo ||
          "",
        subproducto_nombre:
          operacion.subproducto_nombre ||
          actual.subproducto_nombre ||
          "",
        medida: operacion.medida,
        material_entrada_id:
          operacion.material_entrada_id || "",
        materiales_entrada:
          operacion.materiales_entrada ||
          (operacion.material_entrada_id
            ? [{
                material_id:
                  operacion.material_entrada_id,
                cantidad: 1
              }]
            : []),
        material_salida_id:
          operacion.material_salida_id || ""
      })
    );
    setError("");
    setMensaje("");
  };

  const seleccionarSubproducto = subproductoId => {
    const subproducto = subproductosOperacion.find(
      item => item.id === subproductoId
    );

    setOperacionForm(actual => ({
      ...actual,
      subproducto_id: subproducto?.id || "",
      subproducto_codigo:
        subproducto?.codigo || "",
      subproducto_nombre:
        subproducto?.nombre || "",
      pieza_id:
        actual.pieza_id ||
        subproducto?.pieza_salida_id ||
        "",
      pieza_codigo:
        actual.pieza_codigo ||
        subproducto?.pieza_salida_codigo ||
        "",
      pieza_nombre:
        actual.pieza_nombre ||
        subproducto?.pieza_salida_nombre ||
        "",
      medida:
        actual.medida ||
        (subproducto ? "Armado" : "")
    }));
    setError("");
    setMensaje("");
  };

  const vistaProducto = useMemo(
    () => prepararProducto(
      productoForm,
      perfil.empresa_id,
      "vista-producto"
    ),
    [perfil.empresa_id, productoForm]
  );

  const crearProducto = async (evento) => {
    evento.preventDefault();
    const errores = validarProducto(
      vistaProducto,
      productos
    );

    if (errores.length > 0) {
      setError(errores.join(" "));
      return;
    }

    try {
      setGuardando(true);
      const creado = await crearProductoConRuta(
        db,
        perfil.empresa_id,
        {
          ...productoForm,
          creada_por: perfil.uid
        }
      );
      await cargarCatalogos();
      setProductoForm({
        ...productoInicial,
        codigo: siguienteCodigoProducto(productos)
      });
      setProductoId(creado.id);
      await cargarRuta(creado.id, 1, {
        productoId: creado.id,
        tipoRuta: TIPOS_RUTA.PRODUCTO
      });
      setMensaje(
        "Producto creado con ruta V1 en borrador."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo crear el producto."
      );
    } finally {
      setGuardando(false);
    }
  };

  const vistaOperacion = useMemo(
    () => prepararOperacionRuta(
      completarSubproductoRuta({
          ...operacionForm,
          empresa_id: perfil.empresa_id,
          tipo_ruta: tipoRuta,
          entidad_ruta_id: entidadRutaId,
          subproducto_ruta_id: subproductoRutaId,
          secuencia:
            operacionEditandoId
              ? operacionForm.secuencia
              : (ruta?.operaciones.length || 0) *
                  10 +
                10
        }),
      productoId,
      operacionForm.codigo
    ),
    [
      completarSubproductoRuta,
      operacionForm,
      perfil.empresa_id,
      productoId,
      operacionEditandoId,
      tipoRuta,
      entidadRutaId,
      subproductoRutaId,
      ruta
    ]
  );

  const agregarOperacion = async (evento) => {
    evento.preventDefault();
    const versionRutaActual = ruta?.version || 1;
    const estaEditando =
      Boolean(operacionEditandoId);
    const errores = validarOperacionBasica(
      vistaOperacion,
      estaEditando
        ? (ruta?.operaciones || []).filter(
            operacion =>
              operacion.id !==
              operacionEditandoId
          )
        : ruta?.operaciones || []
    );

    if (
      !vistaOperacion.material_salida_id
    ) {
      errores.push(
        "Selecciona el RF de salida."
      );
    }

    if (errores.length > 0) {
      setError(errores.join(" "));
      return;
    }

    try {
      setGuardando(true);
      if (estaEditando) {
        await actualizarOperacionRuta({
          db,
          empresaId: perfil.empresa_id,
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId,
          entidadId: entidadRutaId,
          version: versionRutaActual,
          operacionId: operacionEditandoId,
          datos: completarSubproductoRuta({
            ...operacionForm,
            secuencia: operacionForm.secuencia
          }),
          existentes: ruta?.operaciones || [],
          ruta
        });
      } else {
        await guardarOperacionRuta(
          db,
          perfil.empresa_id,
          productoId,
          versionRutaActual,
          completarSubproductoRuta({
            ...operacionForm,
            secuencia:
              (ruta?.operaciones.length || 0) *
                10 +
              10
          }),
          ruta?.operaciones || [],
          {
            tipoRuta,
            subproductoId: subproductoRutaId,
            entidadId: entidadRutaId
          }
        );
      }
      setOperacionForm(
        esRutaSubproducto &&
        subproductoRutaSeleccionado
          ? {
              ...operacionInicial,
              subproducto_id:
                subproductoRutaSeleccionado.id,
              subproducto_codigo:
                subproductoRutaSeleccionado.codigo,
              subproducto_nombre:
                subproductoRutaSeleccionado.nombre,
              pieza_id:
                subproductoRutaSeleccionado
                  .pieza_salida_id || "",
              pieza_codigo:
                subproductoRutaSeleccionado
                  .pieza_salida_codigo || "",
              pieza_nombre:
                subproductoRutaSeleccionado
                  .pieza_salida_nombre || "",
              medida: "Armado"
            }
          : operacionInicial
      );
      setOperacionEditandoId("");
      setFormularioOperacionAbierto(false);
      await cargarRuta(
        entidadRutaId,
        versionRutaActual,
        {
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId
        }
      );
      setMensaje(
        estaEditando
          ? "Operación actualizada."
          : "Operación agregada a la ruta."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        (estaEditando
          ? "No se pudo actualizar la operación."
          : "No se pudo agregar la operación.")
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirRecalibracion = operacion => {
    setRecalibrandoId(operacion.id);
    setRecalibracion({
      unidades_por_hora:
        operacion.unidades_por_hora,
      motivo: ""
    });
    setError("");
    setMensaje("");
  };

  const cancelarRecalibracion = () => {
    setRecalibrandoId("");
    setRecalibracion({
      unidades_por_hora: "",
      motivo: ""
    });
  };

  const guardarRecalibracion = async (
    operacion
  ) => {
    try {
      setGuardando(true);
      const resultado =
        await recalibrarEstandarRuta({
          db,
          empresaId: perfil.empresa_id,
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId,
          versionActual: ruta.version,
          operaciones: ruta.operaciones,
          operacionId: operacion.id,
          unidadesPorHora:
            recalibracion.unidades_por_hora,
          motivo: recalibracion.motivo,
          perfil
        });

      await cargarCatalogos();
      await cargarRuta(
        entidadRutaId,
        resultado.version,
        {
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId
        }
      );
      cancelarRecalibracion();
      setMensaje(
        `Estándar actualizado en ruta V${resultado.version}. Las OT existentes conservan el valor anterior.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo actualizar el estándar."
      );
    } finally {
      setGuardando(false);
    }
  };

  const erroresRutaBase = ruta
    ? validarRuta(
        {
          producto_id: productoId,
          version: ruta.version,
          operaciones: ruta.operaciones
        },
        materiales
      )
    : [];
  const erroresRuta =
    productoCompuestoPorSubproductos
      ? erroresRutaBase.filter(
          error =>
            error !==
            "La ruta requiere al menos una operacion."
        )
      : erroresRutaBase;
  const rutaTieneDependenciasRfFaltantes =
    erroresRuta.some(error =>
      error.includes(
        "debe depender de quien produce"
      )
    );

  const verRutaSubproducto = subproducto => {
    setTipoRuta(TIPOS_RUTA.SUBPRODUCTO);
    setSubproductoRutaId(subproducto.id);
    setError("");
    setMensaje("");
    cargarRuta(
      subproducto.id,
      subproducto.version_ruta_borrador ||
        subproducto.version_ruta_activa ||
        1,
      {
        productoId,
        tipoRuta: TIPOS_RUTA.SUBPRODUCTO,
        subproductoId: subproducto.id
      }
    );
  };

  const completarDependenciasRf = async () => {
    if (!rutaBorrador || !ruta?.operaciones?.length) {
      setError(
        "Solo puedes completar dependencias en una ruta borrador."
      );
      return;
    }

    const resultado =
      autocompletarDependenciasRf(
        {
          producto_id: productoId,
          version: ruta.version,
          operaciones: ruta.operaciones
        },
        materiales
      );

    if (resultado.cambios.length === 0) {
      setMensaje(
        "No se encontraron dependencias RF faltantes para completar."
      );
      return;
    }

    const resumen = resultado.cambios
      .map(cambio =>
        `${cambio.operacion_codigo} dependerá de ${cambio.productora_codigo} por ${cambio.rf_codigo}.`
      )
      .join("\n");
    const confirmado = window.confirm(
      `Se completarán estas dependencias RF:\n\n${resumen}\n\n¿Guardar estos cambios en la ruta?`
    );

    if (!confirmado) {
      return;
    }

    try {
      setGuardando(true);
      const operacionesConCambios =
        resultado.operaciones.filter(operacion =>
          resultado.cambios.some(
            cambio =>
              cambio.operacion_id === operacion.id
          )
        );

      await actualizarDependenciasOperacionesRuta({
        db,
        productoId,
        tipoRuta,
        subproductoId: subproductoRutaId,
        entidadId: entidadRutaId,
        version: ruta.version,
        ruta,
        operaciones: operacionesConCambios
      });
      await cargarRuta(
        entidadRutaId,
        ruta.version,
        {
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId
        }
      );
      setMensaje(
        `${resultado.cambios.length} dependencia(s) RF completada(s).`
      );
      setError("");
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron completar las dependencias RF."
      );
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async () => {
    if (erroresRuta.length > 0) {
      setError(erroresRuta.join(" "));
      return;
    }

    try {
      setGuardando(true);
      await publicarRuta({
        db,
        empresaId: perfil.empresa_id,
        productoId,
        tipoRuta,
        subproductoId: subproductoRutaId,
        entidadId: entidadRutaId,
        version: ruta.version,
        operaciones: ruta.operaciones,
        materiales
      });
      await cargarCatalogos();
      await cargarRuta(
        entidadRutaId,
        ruta.version,
        {
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId
        }
      );
      setMensaje(
        `Ruta V${ruta.version} publicada y activa.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo publicar la ruta."
      );
    } finally {
      setGuardando(false);
    }
  };

  const crearBorradorEditable = async () => {
    if (!productoId || !entidadRutaId || !ruta) {
      return;
    }

    try {
      setGuardando(true);
      setError("");
      const resultado =
        await crearVersionBorradorRuta({
          db,
          empresaId: perfil.empresa_id,
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId,
          versionActual: ruta.version,
          operaciones: ruta.operaciones || [],
          perfil
        });

      await cargarCatalogos();
      await cargarRuta(
        entidadRutaId,
        resultado.version,
        {
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId
        }
      );
      setMensaje(
        `Ruta V${resultado.version} creada en borrador para editar. La ruta publicada sigue vigente hasta publicar esta versión.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo crear una versión editable."
      );
    } finally {
      setGuardando(false);
    }
  };

  const eliminarOperacion = async operacion => {
    if (!rutaBorrador) {
      setError(
        "Solo puedes eliminar operaciones de una ruta en borrador."
      );
      return;
    }

    const operacionesDependientes =
      operacionesQueDependenDe(
        ruta.operaciones || [],
        operacion.id
      );
    const limpiarDependencias =
      operacionesDependientes.length > 0;

    if (limpiarDependencias) {
      const resumenDependientes =
        operacionesDependientes
          .map(dependiente =>
            `${dependiente.operacion_codigo} - ${dependiente.operacion_nombre}`
          )
          .join("\n");
      const confirmado = window.confirm(
        `La operación ${operacion.operacion_codigo} es dependencia de:\n\n${resumenDependientes}\n\n¿Eliminar ${operacion.operacion_codigo} y quitar esa dependencia de las operaciones indicadas?`
      );

      if (!confirmado) {
        return;
      }
    }

    try {
      setGuardando(true);
      await eliminarOperacionRuta({
        db,
        productoId,
        tipoRuta,
        subproductoId: subproductoRutaId,
        entidadId: entidadRutaId,
        version: ruta.version,
        operacionId: operacion.id,
        ruta,
        limpiarDependencias
      });
      await cargarRuta(
        entidadRutaId,
        ruta.version,
        {
          productoId,
          tipoRuta,
          subproductoId: subproductoRutaId
        }
      );
      setMensaje(
        limpiarDependencias
          ? `Operación ${operacion.operacion_codigo} eliminada y dependencias relacionadas limpiadas.`
          : `Operación ${operacion.operacion_codigo} eliminada de la ruta.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo eliminar la operación."
      );
    } finally {
      setGuardando(false);
    }
  };

  const editarOperacion = operacion => {
    if (!rutaBorrador) {
      setError(
        "Solo puedes editar operaciones de una ruta en borrador."
      );
      return;
    }

    const dependencia =
      (operacion.dependencias || [])[0] || {};

    setOperacionEditandoId(operacion.id);
    setFormularioOperacionAbierto(true);
    setOperacionForm(completarSubproductoRuta({
      codigo: operacion.operacion_codigo || "",
      nombre: operacion.operacion_nombre || "",
      pieza_id: operacion.pieza_id || "",
      pieza_codigo: operacion.pieza_codigo || "",
      pieza_nombre: operacion.pieza_nombre || "",
      subproducto_id:
        operacion.subproducto_id || "",
      subproducto_codigo:
        operacion.subproducto_codigo || "",
      subproducto_nombre:
        operacion.subproducto_nombre || "",
      proceso_codigo:
        operacion.proceso_id || "",
      proceso_nombre:
        operacion.proceso_nombre || "",
      estacion_codigo:
        operacion.estacion_id ||
        operacion.subproceso_id ||
        "",
      estacion_nombre:
        operacion.estacion_nombre ||
        operacion.subproceso_nombre ||
        "",
      subproceso_codigo:
        operacion.subproceso_id ||
        operacion.estacion_id ||
        "",
      subproceso_nombre:
        operacion.subproceso_nombre ||
        operacion.estacion_nombre ||
        "",
      material_entrada_id:
        operacion.material_entrada_id || "",
      materiales_entrada:
        operacion.materiales_entrada?.length > 0
          ? operacion.materiales_entrada
          : operacion.material_entrada_id
            ? [{
                material_id:
                  operacion.material_entrada_id,
                material_codigo:
                  operacion
                    .material_entrada_codigo ||
                  "",
                material_nombre: "",
                cantidad: 1
              }]
            : [],
      material_salida_id:
        operacion.material_salida_id || "",
      medida: operacion.medida || "",
      unidades_por_producto:
        operacion.unidades_por_producto || "",
      unidades_por_hora:
        operacion.unidades_por_hora || "",
      dependencias:
        operacion.dependencias?.length > 0
          ? operacion.dependencias.map(
              dependencia => ({
                ruta_operacion_id:
                  dependencia
                    .ruta_operacion_id || "",
                porcentaje_minimo_avance:
                  dependencia
                    .porcentaje_minimo_avance ??
                  "0",
                requiere_material_disponible:
                  dependencia
                    .requiere_material_disponible !==
                  false
              })
            )
          : [],
      dependencia_id:
        dependencia.ruta_operacion_id || "",
      porcentaje_minimo_avance:
        dependencia.porcentaje_minimo_avance ?? "0",
      secuencia: operacion.secuencia || ""
    }));
    setError("");
    setMensaje(
      `Editando operación ${operacion.operacion_codigo}.`
    );
  };

  const cancelarEdicionOperacion = () => {
    setOperacionEditandoId("");
    setOperacionForm(operacionInicial);
    setFormularioOperacionAbierto(false);
    setError("");
    setMensaje("");
  };

  const eliminarBorrador = async () => {
    if (
      !productoSeleccionado ||
      !entidadRutaSeleccionada ||
      !ruta
    ) {
      return;
    }

    try {
      setGuardando(true);
      await eliminarRutaBorrador({
        db,
        empresaId: perfil.empresa_id,
        producto: productoSeleccionado,
        subproducto: subproductoRutaSeleccionado,
        tipoRuta,
        ruta,
        perfil
      });
      await cargarCatalogos();

      if (
        entidadRutaSeleccionada.version_ruta_activa
      ) {
        await cargarRuta(
          entidadRutaId,
          entidadRutaSeleccionada
            .version_ruta_activa,
          {
            productoId,
            tipoRuta,
            subproductoId: subproductoRutaId
          }
        );
      } else {
        setRuta(null);
      }

      setMensaje(
        `Ruta V${ruta.version} eliminada.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo eliminar la ruta borrador."
      );
    } finally {
      setGuardando(false);
    }
  };

  const anularPublicada = async () => {
    if (
      !productoSeleccionado ||
      !entidadRutaSeleccionada ||
      !ruta
    ) {
      return;
    }

    try {
      setGuardando(true);
      const resultado =
        await anularRutaPublicada({
          db,
          empresaId: perfil.empresa_id,
          producto: productoSeleccionado,
          subproducto: subproductoRutaSeleccionado,
          tipoRuta,
          ruta,
          motivo: motivoAnulacion,
          perfil
        });
      await cargarCatalogos();
      setRuta(actual => ({
        ...actual,
        estado: "anulada",
        motivo_anulacion: resultado.motivo
      }));
      setMotivoAnulacion("");
      setMensaje(
        `Ruta V${resultado.version} anulada. No se usará para nuevas OT.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo anular la ruta."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: 22,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1250,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver a Ingeniería
        </BotonVolver>

        <h1 style={{ marginBottom: 4 }}>
          Productos y rutas
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Construye la secuencia productiva enlazada
          a materiales MP y RF.
        </p>

        {error && (
          <div role="alert" style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            padding: 12,
            borderRadius: 9,
            marginBottom: 14
          }}>
            {error}
          </div>
        )}

        {mensaje && (
          <div style={{
            background: "#F0FDF4",
            color: "#166534",
            padding: 12,
            borderRadius: 9,
            marginBottom: 14
          }}>
            {mensaje}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(310px, 1fr))",
          gap: 20,
          alignItems: "start"
        }}>
          <div style={{
            display: "grid",
            gap: 20
          }}>
            <form
              onSubmit={crearProducto}
              style={tarjeta}
            >
              <h2 style={{ marginTop: 0 }}>
                Nuevo producto
              </h2>
              <div style={{
                display: "grid",
                gap: 12
              }}>
                <label style={etiqueta}>
                  Código
                  <input
                    value={productoForm.codigo}
                    placeholder="PCL0001"
                    disabled
                    style={{
                      ...campo,
                      background: "#F8FAFC"
                    }}
                  />
                  <small style={{
                    color: "#64748B",
                    fontWeight: "normal"
                  }}>
                    Código asignado automáticamente según
                    el siguiente correlativo disponible.
                  </small>
                </label>
                <label style={etiqueta}>
                  Nombre
                  <input
                    value={productoForm.nombre}
                    onChange={evento =>
                      actualizarProducto(
                        "nombre",
                        evento.target.value
                      )
                    }
                    placeholder="Mod 2N60 CL"
                    style={campo}
                  />
                </label>
                <label style={etiqueta}>
                  Familia
                  <input
                    value={productoForm.familia}
                    onChange={evento =>
                      actualizarProducto(
                        "familia",
                        evento.target.value
                      )
                    }
                    placeholder="Exhibidores metálicos"
                    style={campo}
                  />
                </label>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    ...campo,
                    border: "none",
                    background: "#1D4ED8",
                    color: "white",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  Crear producto y ruta V1
                </button>
              </div>
            </form>

            <section style={tarjeta}>
              <h2 style={{ marginTop: 0 }}>
                Productos ({productosFiltrados.length}
                /{productos.length})
              </h2>
              <label style={{
                ...etiqueta,
                marginBottom: 12
              }}>
                Buscar producto
                <input
                  value={filtroProductos}
                  onChange={evento =>
                    setFiltroProductos(
                      evento.target.value
                    )
                  }
                  placeholder="Código, nombre o familia..."
                  style={campo}
                />
                <small style={{
                  color: "#64748B",
                  fontWeight: "normal"
                }}>
                  Digita algunas letras para revisar si
                  el producto ya está registrado antes de
                  crearlo.
                </small>
              </label>
              {cargando ? (
                <p>Cargando...</p>
              ) : productos.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay productos.
                </p>
              ) : productosFiltrados.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay productos relacionados con esa
                  búsqueda.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 9
                }}>
                  {productosFiltrados.map(producto => (
                    <button
                      type="button"
                      key={producto.id}
                      onClick={() => {
                        setProductoId(producto.id);
                        setError("");
                        setMensaje("");
                        cargarRuta(
                          producto.id,
                          producto
                            .version_ruta_borrador ||
                            producto
                              .version_ruta_activa ||
                            1
                        );
                      }}
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 9,
                        border:
                          producto.id === productoId
                            ? "2px solid #1D4ED8"
                            : "1px solid #E2E8F0",
                        background: "white",
                        cursor: "pointer"
                      }}
                    >
                      <strong>
                        {producto.codigo}
                        {" - "}
                        {producto.nombre}
                      </strong>
                      <div style={{
                        color: "#64748B",
                        marginTop: 4
                      }}>
                        {producto.familia || "Sin familia"}
                        {" · "}
                        {producto.version_ruta_activa
                          ? `Ruta V${producto.version_ruta_activa} activa`
                          : "Ruta en borrador"}
                        {producto.version_ruta_borrador
                          ? ` · Borrador V${producto.version_ruta_borrador}`
                          : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div style={{
            display: "grid",
            gap: 20
          }}>
            {!productoSeleccionado ? (
              <section style={tarjeta}>
                <h2 style={{ marginTop: 0 }}>
                  Constructor de ruta
                </h2>
                <p style={{ color: "#64748B" }}>
                  Selecciona o crea un producto para
                  comenzar.
                </p>
              </section>
            ) : (
              <>
                <section style={tarjeta}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                    marginBottom: 16,
                    padding: 12,
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    background: "#F8FAFC"
                  }}>
                    <label style={etiqueta}>
                      Tipo de ruta
                      <select
                        value={tipoRuta}
                        onChange={evento => {
                          const nuevoTipo =
                            evento.target.value;
                          setTipoRuta(nuevoTipo);
                          setSubproductoRutaId("");
                          setError("");
                          setMensaje("");

                          if (
                            nuevoTipo ===
                            TIPOS_RUTA.PRODUCTO
                          ) {
                            cargarRuta(
                              productoId,
                              productoSeleccionado
                                .version_ruta_borrador ||
                                productoSeleccionado
                                  .version_ruta_activa ||
                                1,
                              {
                                productoId,
                                tipoRuta:
                                  TIPOS_RUTA.PRODUCTO
                              }
                            );
                          } else {
                            setRuta(null);
                          }
                        }}
                        style={campo}
                      >
                        <option value={TIPOS_RUTA.PRODUCTO}>
                          Producto final
                        </option>
                        <option
                          value={TIPOS_RUTA.SUBPRODUCTO}
                        >
                          Subproducto
                        </option>
                      </select>
                    </label>

                    {esRutaSubproducto && (
                      <label style={etiqueta}>
                        Subproducto
                        <select
                          value={subproductoRutaId}
                          onChange={evento => {
                            const id =
                              evento.target.value;
                            const subproducto =
                              subproductosProducto.find(
                                item => item.id === id
                              );
                            setSubproductoRutaId(id);
                            setError("");
                            setMensaje("");

                            if (subproducto) {
                              cargarRuta(
                                subproducto.id,
                                subproducto
                                  .version_ruta_borrador ||
                                  subproducto
                                    .version_ruta_activa ||
                                  1,
                                {
                                  productoId,
                                  tipoRuta:
                                    TIPOS_RUTA.SUBPRODUCTO,
                                  subproductoId:
                                    subproducto.id
                                }
                              );
                            } else {
                              setRuta(null);
                            }
                          }}
                          style={campo}
                        >
                          <option value="">
                            Seleccionar subproducto
                          </option>
                          {subproductosProducto.map(
                            subproducto => (
                              <option
                                key={subproducto.id}
                                value={subproducto.id}
                              >
                                {subproducto.codigo}
                                {" - "}
                                {subproducto.nombre}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    )}
                  </div>

                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "start"
                  }}>
                    <div>
                      <h2 style={{ margin: 0 }}>
                        {entidadRutaSeleccionada
                          ? `${entidadRutaSeleccionada.codigo} - ${entidadRutaSeleccionada.nombre}`
                          : "Selecciona subproducto"}
                      </h2>
                      <p style={{
                        color: "#64748B",
                        marginBottom: 0
                      }}>
                        {esRutaSubproducto
                          ? "Ruta de subproducto"
                          : "Ruta de producto final"}
                        {" · V"}
                        {ruta?.version || 1} ·{" "}
                        {ruta?.estado || "borrador"}
                      </p>
                    </div>
                    <div style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      justifyContent: "flex-end"
                    }}>
                      {rutaPublicada ? (
                        <button
                          type="button"
                          onClick={crearBorradorEditable}
                          disabled={guardando}
                          style={{
                            padding: "10px 14px",
                            border: "none",
                            borderRadius: 8,
                            background: "#2563EB",
                            color: "white",
                            fontWeight: "bold",
                            cursor: guardando
                              ? "wait"
                              : "pointer"
                          }}
                        >
                          Crear versión editable
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={publicar}
                            disabled={
                              guardando ||
                              !entidadRutaSeleccionada ||
                              erroresRuta.length > 0 ||
                              !ruta?.existe
                            }
                            style={{
                              padding: "10px 14px",
                              border: "none",
                              borderRadius: 8,
                              background:
                                erroresRuta.length > 0 ||
                                !entidadRutaSeleccionada ||
                                !ruta?.existe
                                  ? "#94A3B8"
                                  : "#15803D",
                              color: "white",
                              fontWeight: "bold",
                              cursor:
                                erroresRuta.length > 0 ||
                                !entidadRutaSeleccionada ||
                                !ruta?.existe
                                  ? "not-allowed"
                                  : "pointer"
                            }}
                          >
                            Publicar ruta
                          </button>
                          {rutaBorrador &&
                            rutaTieneDependenciasRfFaltantes && (
                              <button
                                type="button"
                                onClick={
                                  completarDependenciasRf
                                }
                                disabled={guardando}
                                style={{
                                  padding: "10px 14px",
                                  border: "none",
                                  borderRadius: 8,
                                  background: "#D97706",
                                  color: "white",
                                  fontWeight: "bold",
                                  cursor: guardando
                                    ? "wait"
                                    : "pointer"
                                }}
                              >
                                Completar dependencias
                                RF
                              </button>
                            )}
                          {rutaBorrador &&
                            ruta?.existe && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Eliminar la ruta V${ruta.version} en borrador? Esta acción no se puede deshacer.`
                                  )
                                ) {
                                  eliminarBorrador();
                                }
                              }}
                              disabled={guardando}
                              style={{
                                padding: "10px 14px",
                                border:
                                  "1px solid #B91C1C",
                                borderRadius: 8,
                                background: "white",
                                color: "#B91C1C",
                                fontWeight: "bold",
                                cursor: guardando
                                  ? "wait"
                                  : "pointer"
                              }}
                            >
                              Eliminar borrador
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {rutaPublicada && (
                    <div style={{
                      marginTop: 12,
                      color: "#1E40AF",
                      background: "#EFF6FF",
                      padding: 10,
                      borderRadius: 8,
                      fontSize: 14
                    }}>
                      Esta ruta está publicada y protegida.
                      Para agregar subproductos u operaciones,
                      crea una nueva versión editable.
                    </div>
                  )}

                  {ruta?.estado === "anulada" && (
                    <div style={{
                      marginTop: 12,
                      color: "#991B1B",
                      background: "#FEF2F2",
                      padding: 10,
                      borderRadius: 8,
                      fontSize: 14
                    }}>
                      Esta ruta fue anulada. Motivo:{" "}
                      {ruta.motivo_anulacion ||
                        "sin motivo visible"}
                    </div>
                  )}

                  {rutaPublicada && (
                    <div style={{
                      marginTop: 12,
                      display: "grid",
                      gap: 8,
                      border: "1px solid #FECACA",
                      borderRadius: 10,
                      padding: 12,
                      background: "#FFFBFB"
                    }}>
                      <strong style={{ color: "#991B1B" }}>
                        Anular ruta publicada
                      </strong>
                      <p style={{
                        color: "#64748B",
                        margin: 0,
                        fontSize: 14
                      }}>
                        Úsalo solo si esta versión no debe
                        seguir disponible para nuevas OT. Las
                        OT históricas mantienen su copia.
                      </p>
                      <textarea
                        value={motivoAnulacion}
                        onChange={evento =>
                          setMotivoAnulacion(
                            evento.target.value
                          )
                        }
                        rows={2}
                        placeholder="Motivo de anulación"
                        style={campo}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Anular la ruta V${ruta.version}?`
                            )
                          ) {
                            anularPublicada();
                          }
                        }}
                        disabled={guardando}
                        style={{
                          padding: "9px 12px",
                          border: "none",
                          borderRadius: 8,
                          background: "#B91C1C",
                          color: "white",
                          fontWeight: "bold",
                          cursor: guardando
                            ? "wait"
                            : "pointer"
                        }}
                      >
                        Anular ruta publicada
                      </button>
                    </div>
                  )}

                  {!rutaPublicada &&
                    erroresRuta.length > 0 && (
                      <div style={{
                        marginTop: 12,
                        color: "#92400E",
                        background: "#FFFBEB",
                        padding: 10,
                        borderRadius: 8,
                        fontSize: 14
                      }}>
                        Pendiente para publicar:{" "}
                        {erroresRuta.join(" ")}
                      </div>
                    )}

                  {!entidadRutaSeleccionada && (
                    <div style={{
                      marginTop: 12,
                      color: "#92400E",
                      background: "#FFFBEB",
                      padding: 10,
                      borderRadius: 8,
                      fontSize: 14
                    }}>
                      Selecciona un subproducto para
                      crear o revisar su ruta.
                    </div>
                  )}

                  {!esRutaSubproducto &&
                    subproductosProducto.length > 0 && (
                    <div style={{
                      marginTop: 12,
                      display: "grid",
                      gap: 6
                    }}>
                      <strong>
                        Subproductos del producto
                      </strong>
                      {subproductosProducto.map(
                        subproducto => {
                          const versionRuta =
                            subproducto
                              .version_ruta_borrador ||
                            subproducto
                              .version_ruta_activa ||
                            1;
                          const estadoRuta =
                            subproducto
                              .version_ruta_borrador
                              ? `Borrador V${subproducto.version_ruta_borrador}`
                              : subproducto
                                  .version_ruta_activa
                                ? `Publicada V${subproducto.version_ruta_activa}`
                                : "Ruta V1 pendiente";

                          return (
                          <div
                            key={subproducto.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "1fr auto",
                              gap: 10,
                              alignItems: "center",
                              border:
                                "1px solid #E2E8F0",
                              borderRadius: 10,
                              padding: 10,
                              background:
                                subproducto.id ===
                                subproductoRutaId
                                  ? "#EFF6FF"
                                  : "#F8FAFC",
                              color: "#475569",
                              fontSize: 14
                            }}
                          >
                            <div>
                              <strong style={{
                                color: "#0F172A"
                              }}>
                                {subproducto.codigo}
                                {" - "}
                                {subproducto.nombre}
                              </strong>
                              <div>
                                Pieza salida:{" "}
                                {
                                  subproducto
                                    .pieza_salida_codigo
                                }
                                {" - "}
                                {
                                  subproducto
                                    .pieza_salida_nombre
                                }
                              </div>
                              <div style={{
                                color: "#2563EB",
                                fontWeight: "bold"
                              }}>
                                {estadoRuta}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                verRutaSubproducto(
                                  subproducto
                                )
                              }
                              style={{
                                background: "#2563EB",
                                color: "white",
                                border: 0,
                                borderRadius: 8,
                                padding: "9px 12px",
                                fontWeight: "bold",
                                cursor: "pointer",
                                whiteSpace: "nowrap"
                              }}
                            >
                              Ver ruta V{versionRuta}
                            </button>
                          </div>
                          );
                        }
                      )}
                      {productoCompuestoPorSubproductos && (
                        <div style={{
                          color: "#475569",
                          background: "#F8FAFC",
                          borderRadius: 10,
                          padding: 10,
                          fontSize: 14
                        }}>
                          Este producto no tiene
                          operaciones directas en su ruta
                          principal. Sus operaciones se
                          revisan entrando a la ruta de
                          cada subproducto.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {!esRutaSubproducto && (
                <section style={tarjeta}>
                  <h2 style={{ marginTop: 0 }}>
                    Composición del producto
                  </h2>
                  <p style={{
                    color: "#64748B",
                    marginTop: 0
                  }}>
                    Define cuántos subproductos, piezas
                    gráficas, accesorios o empaque lleva
                    una unidad del producto terminado.
                  </p>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 10,
                    alignItems: "end"
                  }}>
                    <label style={etiqueta}>
                      Tipo
                      <select
                        value={itemComposicion.tipo}
                        onChange={evento =>
                          actualizarItemComposicion(
                            "tipo",
                            evento.target.value
                          )
                        }
                        style={campo}
                      >
                        <option value="SUBPRODUCTO">
                          Subproducto
                        </option>
                        <option value="PIEZA">
                          Pieza gráfica
                        </option>
                        <option value="MATERIAL">
                          Accesorio / empaque
                        </option>
                      </select>
                    </label>
                    <label style={etiqueta}>
                      Categoría
                      <select
                        value={
                          itemComposicion.categoria
                        }
                        onChange={evento =>
                          actualizarItemComposicion(
                            "categoria",
                            evento.target.value
                          )
                        }
                        style={campo}
                      >
                        <option value="subproducto">
                          Subproducto
                        </option>
                        <option value="pieza_grafica">
                          Pieza gráfica
                        </option>
                        <option value="accesorio">
                          Accesorio
                        </option>
                        <option value="empaque">
                          Empaque
                        </option>
                        <option value="otro">
                          Otro
                        </option>
                      </select>
                    </label>
                    <label style={etiqueta}>
                      Item
                      <select
                        value={itemComposicion.item_id}
                        onChange={evento =>
                          actualizarItemComposicion(
                            "item_id",
                            evento.target.value
                          )
                        }
                        style={campo}
                      >
                        <option value="">
                          Seleccionar
                        </option>
                        {opcionesComposicion.map(item => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.codigo}
                            {" - "}
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={etiqueta}>
                      Cantidad
                      <input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={
                          itemComposicion.cantidad
                        }
                        onChange={evento =>
                          actualizarItemComposicion(
                            "cantidad",
                            evento.target.value
                          )
                        }
                        style={campo}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={agregarItemComposicion}
                      style={{
                        ...campo,
                        background: "#EFF6FF",
                        borderColor: "#BFDBFE",
                        color: "#1D4ED8",
                        cursor: "pointer",
                        fontWeight: "bold"
                      }}
                    >
                      + Agregar
                    </button>
                  </div>

                  {composicionProducto.length === 0 ? (
                    <p style={{ color: "#64748B" }}>
                      Aún no hay composición definida.
                    </p>
                  ) : (
                    <div style={{
                      display: "grid",
                      gap: 8,
                      marginTop: 14
                    }}>
                      {composicionProducto.map(
                        (item, indice) => (
                          <div
                            key={`${item.tipo}-${item.item_id}-${indice}`}
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: 10,
                              border:
                                "1px solid #E2E8F0",
                              borderRadius: 8,
                              padding: 10
                            }}
                          >
                            <span>
                              {item.cantidad}
                              {" x "}
                              {item.item_codigo}
                              {" - "}
                              {item.item_nombre}
                              {" · "}
                              {item.categoria}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                quitarItemComposicion(
                                  indice
                                )
                              }
                              style={{
                                border: "none",
                                background:
                                  "transparent",
                                color: "#B91C1C",
                                cursor: "pointer"
                              }}
                            >
                              Quitar
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={guardarComposicion}
                    disabled={guardando}
                    style={{
                      ...campo,
                      marginTop: 14,
                      border: "none",
                      background: "#2563EB",
                      color: "white",
                      fontWeight: "bold",
                      cursor: guardando
                        ? "wait"
                        : "pointer"
                    }}
                  >
                    Guardar composición
                  </button>
                </section>
                )}

                {!rutaPublicada &&
                  entidadRutaSeleccionada && (
                  <form
                    onSubmit={agregarOperacion}
                    style={tarjeta}
                  >
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      gap: 12,
                      marginBottom:
                        formularioOperacionAbierto
                          ? 14
                          : 0
                    }}>
                      <div>
                        <h2 style={{
                          marginTop: 0,
                          marginBottom: 4
                        }}>
                          {operacionEditandoId
                            ? "Editar operación"
                            : "Agregar operación"}
                        </h2>
                        <p style={{
                          color: "#64748B",
                          margin: 0,
                          fontSize: 14
                        }}>
                          Abre este panel solo cuando
                          necesites cargar o corregir una
                          operación.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormularioOperacionAbierto(
                            abierto => !abierto
                          )
                        }
                        style={{
                          border: "none",
                          borderRadius: 8,
                          background:
                            formularioOperacionAbierto
                              ? "#E2E8F0"
                              : "#0F766E",
                          color:
                            formularioOperacionAbierto
                              ? "#334155"
                              : "white",
                          padding: "9px 12px",
                          fontWeight: "bold",
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {formularioOperacionAbierto
                          ? "Ocultar"
                          : "+ Nueva operación"}
                      </button>
                    </div>

                    {formularioOperacionAbierto ? (
                    <>
                    {operacionEditandoId && (
                      <p style={{
                        color: "#475569",
                        background: "#F8FAFC",
                        padding: 9,
                        borderRadius: 8
                      }}>
                        Estás corrigiendo una operación
                        existente. Al guardar, se actualizará
                        esta ruta en borrador.
                      </p>
                    )}

                    {materialesActivos.length < 2 && (
                      <p style={{
                        color: "#92400E",
                        background: "#FFFBEB",
                        padding: 9,
                        borderRadius: 8
                      }}>
                        Crea materiales MP/RF antes de
                        construir la ruta.
                      </p>
                    )}

                    <div style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 11
                    }}>
                      <label style={etiqueta}>
                        Operación catálogo
                        <select
                          value={
                            operacionCatalogoSeleccionadaId
                          }
                          onChange={evento =>
                            seleccionarOperacionCatalogo(
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar OP
                          </option>
                          {operacionesCatalogoActivas.map(
                            operacion => (
                              <option
                                key={operacion.id}
                                value={operacion.id}
                              >
                                {operacion.codigo}
                                {" - "}
                                {operacion.nombre}
                              </option>
                            )
                          )}
                        </select>
                        {operacionesCatalogoActivas.length === 0 && (
                          <span style={{
                            color: "#92400E",
                            fontWeight: "normal",
                            fontSize: 12
                          }}>
                            Crea operaciones en Catálogo
                            de Operaciones antes de armar
                            la ruta.
                          </span>
                        )}
                      </label>
                      <label style={etiqueta}>
                        Subproducto asociado
                        <select
                          value={
                            operacionForm
                              .subproducto_id
                          }
                          onChange={evento =>
                            seleccionarSubproducto(
                              evento.target.value
                            )
                          }
                          disabled={esRutaSubproducto}
                          style={campo}
                        >
                          <option value="">
                            Sin subproducto
                          </option>
                          {subproductosOperacion.map(
                            subproducto => (
                              <option
                                key={subproducto.id}
                                value={subproducto.id}
                              >
                                {subproducto.codigo}
                                {" - "}
                                {subproducto.nombre}
                              </option>
                            )
                          )}
                        </select>
                        {subproductosOperacion.length ===
                          0 && (
                          <span style={{
                            color: "#92400E",
                            fontWeight: "normal",
                            fontSize: 12
                          }}>
                            Este producto aún no tiene
                            subproductos registrados.
                          </span>
                        )}
                      </label>
                      <label style={etiqueta}>
                        Nombre operación
                        <input
                          value={operacionForm.nombre}
                          onChange={evento =>
                            actualizarOperacion(
                              "nombre",
                              evento.target.value
                            )
                          }
                          placeholder="Lateral 290"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Proceso registrado
                        <select
                          value={
                            opcionesProceso.some(
                              proceso =>
                                proceso.codigo ===
                                operacionForm
                                  .proceso_codigo
                            )
                              ? operacionForm
                                  .proceso_codigo
                              : ""
                          }
                          onChange={evento =>
                            seleccionarProcesoRuta(
                              "codigo",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar proceso
                          </option>
                          {opcionesProceso.map(proceso => (
                            <option
                              key={proceso.codigo}
                              value={proceso.codigo}
                            >
                              {proceso.nombre}
                              {" · "}
                              {proceso.codigo}
                            </option>
                          ))}
                        </select>
                        {opcionesProceso.length === 0 && (
                          <span style={{
                            color: "#92400E",
                            fontWeight: "normal",
                            fontSize: 12
                          }}>
                            Aún no hay procesos guardados
                            para sugerir.
                          </span>
                        )}
                      </label>
                      <label style={etiqueta}>
                        Estación registrada
                        <select
                          value={
                            opcionesSubproceso.some(
                              subproceso =>
                                subproceso.codigo ===
                                operacionForm
                                  .estacion_codigo
                            )
                              ? operacionForm
                                  .estacion_codigo
                              : ""
                          }
                          onChange={evento =>
                            seleccionarSubprocesoRuta(
                              "codigo",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar estación
                          </option>
                          {opcionesSubproceso.map(
                            subproceso => (
                              <option
                                key={subproceso.codigo}
                                value={subproceso.codigo}
                              >
                                {subproceso.nombre}
                                {" · "}
                                {subproceso.codigo}
                              </option>
                            )
                          )}
                        </select>
                        {opcionesSubproceso.length ===
                          0 && (
                          <span style={{
                            color: "#92400E",
                            fontWeight: "normal",
                            fontSize: 12
                          }}>
                            Aún no hay estaciones
                            guardados para sugerir.
                          </span>
                        )}
                      </label>
                      <label style={etiqueta}>
                        Código proceso
                        <input
                          list="catalogo-codigos-proceso"
                          value={
                            operacionForm.proceso_codigo
                          }
                          onChange={evento =>
                            seleccionarProcesoRuta(
                              "codigo",
                              evento.target.value
                            )
                          }
                          placeholder="PR0001"
                          style={campo}
                        />
                        <datalist id="catalogo-codigos-proceso">
                          {opcionesProceso.map(proceso => (
                            <option
                              key={proceso.codigo}
                              value={proceso.codigo}
                            >
                              {proceso.nombre}
                            </option>
                          ))}
                        </datalist>
                      </label>
                      <label style={etiqueta}>
                        Proceso
                        <input
                          list="catalogo-nombres-proceso"
                          value={
                            operacionForm.proceso_nombre
                          }
                          onChange={evento =>
                            seleccionarProcesoRuta(
                              "nombre",
                              evento.target.value
                            )
                          }
                          placeholder="Corte"
                          style={campo}
                        />
                        <datalist id="catalogo-nombres-proceso">
                          {opcionesProceso.map(proceso => (
                            <option
                              key={proceso.codigo}
                              value={proceso.nombre}
                            >
                              {proceso.codigo}
                            </option>
                          ))}
                        </datalist>
                      </label>
                      <label style={etiqueta}>
                        Código estación
                        <input
                          list="catalogo-codigos-subproceso"
                          value={
                            operacionForm
                              .estacion_codigo
                          }
                          onChange={evento =>
                            seleccionarSubprocesoRuta(
                              "codigo",
                              evento.target.value
                            )
                          }
                          placeholder="ET0001"
                          style={campo}
                        />
                        <datalist id="catalogo-codigos-subproceso">
                          {opcionesSubproceso.map(
                            subproceso => (
                              <option
                                key={subproceso.codigo}
                                value={subproceso.codigo}
                              >
                                {subproceso.nombre}
                              </option>
                            )
                          )}
                        </datalist>
                      </label>
                      <label style={etiqueta}>
                        Estación de trabajo
                        <input
                          list="catalogo-nombres-subproceso"
                          value={
                            operacionForm
                              .estacion_nombre
                          }
                          onChange={evento =>
                            seleccionarSubprocesoRuta(
                              "nombre",
                              evento.target.value
                            )
                          }
                          placeholder="Láser fibra tubo"
                          style={campo}
                        />
                        <datalist id="catalogo-nombres-subproceso">
                          {opcionesSubproceso.map(
                            subproceso => (
                              <option
                                key={subproceso.codigo}
                                value={subproceso.nombre}
                              >
                                {subproceso.codigo}
                              </option>
                            )
                          )}
                        </datalist>
                      </label>
                      <div style={{
                        gridColumn: "1 / -1",
                        border: "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 12
                      }}>
                        <strong>Materiales entrada</strong>
                        <div style={{
                          display: "grid",
                          gap: 8,
                          marginTop: 10
                        }}>
                          {materialesEntradaFormulario.map(
                            (
                              materialEntrada,
                              indice
                            ) => {
                              const materialSeleccionado =
                                materialesDisponiblesProducto.find(
                                  material =>
                                    material.id ===
                                    materialEntrada.material_id
                                );
                              const unidadMaterial =
                                materialSeleccionado
                                  ?.unidad_medida ||
                                "unidad";

                              return (
                                <div
                                  key={`${indice}-${materialEntrada.material_id}`}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "1fr 170px 42px",
                                    gap: 8,
                                    alignItems:
                                      "start"
                                  }}
                                >
                                  <select
                                    value={
                                      materialEntrada
                                        .material_id ||
                                      ""
                                    }
                                    onChange={evento =>
                                      actualizarMaterialEntrada(
                                        indice,
                                        "material_id",
                                        evento.target
                                          .value
                                      )
                                    }
                                    style={campo}
                                  >
                                    <option value="">
                                      Seleccionar
                                    </option>
                                    {materialesDisponiblesProducto.map(
                                      material => (
                                        <option
                                          key={
                                            material.id
                                          }
                                          value={
                                            material.id
                                          }
                                        >
                                          {
                                            material.codigo
                                          }
                                          {" - "}
                                          {
                                            material.nombre
                                          }
                                        </option>
                                      )
                                    )}
                                  </select>
                                  <label style={{
                                    display: "grid",
                                    gap: 4,
                                    color: "#475569",
                                    fontSize: 12,
                                    fontWeight:
                                      "bold"
                                  }}>
                                    Cant. por unidad
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="Ej: 0.29"
                                      value={
                                        materialEntrada
                                          .cantidad || 1
                                      }
                                      onChange={evento =>
                                        actualizarMaterialEntrada(
                                          indice,
                                          "cantidad",
                                          evento.target
                                            .value.replace(
                                              ",",
                                              "."
                                            )
                                        )
                                      }
                                      style={campo}
                                    />
                                    <span style={{
                                      color: "#64748B",
                                      fontWeight:
                                        "normal"
                                    }}>
                                      Unidad stock:{" "}
                                      {unidadMaterial}
                                    </span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      quitarMaterialEntrada(
                                        indice
                                      )
                                    }
                                    disabled={
                                      materialesEntradaFormulario
                                        .length === 1 &&
                                      !materialEntrada
                                        .material_id
                                    }
                                    style={{
                                      border:
                                        "1px solid #FCA5A5",
                                      borderRadius: 8,
                                      background:
                                        "#FEF2F2",
                                      color: "#B91C1C",
                                      cursor:
                                        "pointer",
                                      minHeight: 42
                                    }}
                                  >
                                    -
                                  </button>
                                </div>
                              );
                            }
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={agregarMaterialEntrada}
                          style={{
                            ...campo,
                            marginTop: 8,
                            background: "#EFF6FF",
                            borderColor: "#BFDBFE",
                            color: "#1D4ED8",
                            cursor: "pointer",
                            fontWeight: "bold"
                          }}
                        >
                          + Agregar material de entrada
                        </button>
                      </div>
                      <label style={etiqueta}>
                        RF de salida
                        <select
                          value={
                            operacionForm
                              .material_salida_id
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "material_salida_id",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar
                          </option>
                          {salidasRf.map(material => (
                            <option
                              key={material.id}
                              value={material.id}
                            >
                              {material.codigo}
                              {" - "}
                              {material.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={etiqueta}>
                        Medida
                        <input
                          value={operacionForm.medida}
                          onChange={evento =>
                            actualizarOperacion(
                              "medida",
                              evento.target.value
                            )
                          }
                          placeholder="290 mm"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        {etiquetaUnidadesOperacion}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            operacionForm
                              .unidades_por_producto
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "unidades_por_producto",
                              evento.target.value
                            )
                          }
                          style={campo}
                        />
                        <span style={{
                          color: "#64748B",
                          fontWeight: "normal",
                          fontSize: 12
                        }}>
                          {itemBaseOperacion
                            ? `El producto contiene ${factorItemBaseOperacion} x ${itemBaseOperacion.item_codigo}. Al crear la OT se multiplicará automáticamente.`
                            : "Si la operación no está ligada a subproducto o pieza, se considera cantidad directa por producto."}
                        </span>
                      </label>
                      <label style={etiqueta}>
                        Estándar (unidades por hora)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            operacionForm
                              .unidades_por_hora
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "unidades_por_hora",
                              evento.target.value
                            )
                          }
                          style={campo}
                        />
                        <span style={{
                          color: "#64748B",
                          fontWeight: "normal",
                          fontSize: 12
                        }}>
                          Usa 0 si es una producción nueva
                          y todavía se está midiendo.
                        </span>
                      </label>
                      <div style={{
                        gridColumn: "1 / -1",
                        border: "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 12
                      }}>
                        <strong>Dependencias</strong>
                        <p style={{
                          color: "#64748B",
                          fontSize: 12,
                          marginTop: 5
                        }}>
                          Agrega todas las OP previas que
                          deben avanzar antes de iniciar esta
                          operación.
                        </p>
                        <div style={{
                          display: "grid",
                          gap: 8
                        }}>
                          {dependenciasFormulario.map(
                            (
                              dependencia,
                              indice
                            ) => (
                              <div
                                key={`${indice}-${dependencia.ruta_operacion_id}`}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "1fr 150px 42px",
                                  gap: 8,
                                  alignItems: "end"
                                }}
                              >
                                <label style={etiqueta}>
                                  Depende de
                                  <select
                                    value={
                                      dependencia
                                        .ruta_operacion_id ||
                                      ""
                                    }
                                    onChange={evento =>
                                      actualizarDependenciaOperacion(
                                        indice,
                                        "ruta_operacion_id",
                                        evento.target
                                          .value
                                      )
                                    }
                                    style={campo}
                                  >
                                    <option value="">
                                      Sin dependencia
                                    </option>
                                    {(ruta?.operaciones ||
                                      [])
                                      .filter(
                                        operacion =>
                                          operacion.id !==
                                          operacionEditandoId
                                      )
                                      .map(
                                        operacion => (
                                          <option
                                            key={
                                              operacion.id
                                            }
                                            value={
                                              operacion.id
                                            }
                                          >
                                            {
                                              operacion
                                                .operacion_codigo
                                            }
                                            {" - "}
                                            {
                                              operacion
                                                .operacion_nombre
                                            }
                                          </option>
                                        )
                                      )}
                                  </select>
                                </label>
                                <label style={etiqueta}>
                                  Avance mínimo %
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={
                                      dependencia
                                        .porcentaje_minimo_avance
                                    }
                                    onChange={evento =>
                                      actualizarDependenciaOperacion(
                                        indice,
                                        "porcentaje_minimo_avance",
                                        evento.target
                                          .value
                                      )
                                    }
                                    style={campo}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    quitarDependenciaOperacion(
                                      indice
                                    )
                                  }
                                  disabled={
                                    dependenciasFormulario
                                      .length === 1 &&
                                    !dependencia
                                      .ruta_operacion_id
                                  }
                                  style={{
                                    border:
                                      "1px solid #FCA5A5",
                                    borderRadius: 8,
                                    background:
                                      "#FEF2F2",
                                    color: "#B91C1C",
                                    minHeight: 42,
                                    cursor: "pointer"
                                  }}
                                >
                                  -
                                </button>
                              </div>
                            )
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={agregarDependenciaOperacion}
                          style={{
                            ...campo,
                            marginTop: 8,
                            background: "#EFF6FF",
                            borderColor: "#BFDBFE",
                            color: "#1D4ED8",
                            cursor: "pointer",
                            fontWeight: "bold"
                          }}
                        >
                          + Agregar dependencia
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        guardando ||
                        materialesActivos.length < 2
                      }
                      style={{
                        ...campo,
                        marginTop: 14,
                        border: "none",
                        background: "#0F766E",
                        color: "white",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }}
                    >
                      {operacionEditandoId
                        ? "Guardar cambios de operación"
                        : "Agregar a la ruta"}
                    </button>
                    {operacionEditandoId && (
                      <button
                        type="button"
                        onClick={cancelarEdicionOperacion}
                        disabled={guardando}
                        style={{
                          ...campo,
                          marginTop: 8,
                          background: "white",
                          color: "#334155",
                          border:
                            "1px solid #CBD5E1",
                          fontWeight: "bold",
                          cursor: guardando
                            ? "wait"
                            : "pointer"
                        }}
                      >
                        Cancelar edición
                      </button>
                    )}
                    </>
                    ) : (
                      <p style={{
                        color: "#64748B",
                        background: "#F8FAFC",
                        padding: 10,
                        borderRadius: 8,
                        marginTop: 12,
                        marginBottom: 0
                      }}>
                        Panel cerrado para mantener la ruta
                        ordenada. La lista de operaciones
                        queda visible abajo.
                      </p>
                    )}
                  </form>
                )}

                <section style={tarjeta}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    gap: 12,
                    marginBottom: 10
                  }}>
                    <div>
                      <h2 style={{
                        marginTop: 0,
                        marginBottom: 4
                      }}>
                        Operaciones (
                        {ruta?.operaciones.length || 0})
                      </h2>
                      <p style={{
                        color: "#64748B",
                        margin: 0,
                        fontSize: 14
                      }}>
                        La lista queda contenida para
                        mantener la pantalla ordenada en
                        rutas largas.
                      </p>
                    </div>
                    {(ruta?.operaciones || []).length > 0 && (
                      <span style={{
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontWeight: "bold",
                        fontSize: 13,
                        whiteSpace: "nowrap"
                      }}>
                        Scroll interno
                      </span>
                    )}
                  </div>
                  {(ruta?.operaciones || []).length ===
                  0 ? (
                    <p style={{ color: "#64748B" }}>
                      La ruta aún no tiene operaciones.
                    </p>
                  ) : (
                    <div style={{
                      display: "grid",
                      gap: 10,
                      maxHeight: 620,
                      overflowY: "auto",
                      paddingRight: 6
                    }}>
                      {ruta.operaciones.map(
                        operacion => {
                          const materialesEntrada =
                            operacion.materiales_entrada
                              ?.length > 0
                              ? operacion
                                  .materiales_entrada
                              : operacion
                                  .material_entrada_id
                                ? [{
                                    material_id:
                                      operacion
                                        .material_entrada_id,
                                    cantidad: 1
                                  }]
                                : [];
                          const entradasTexto =
                            materialesEntrada
                              .map(materialEntrada => {
                                const material =
                                  materiales.find(
                                    item =>
                                      item.id ===
                                      materialEntrada
                                        .material_id
                                  );
                                return material
                                  ? `${material.codigo} x ${materialEntrada.cantidad || 1}`
                                  : "";
                              })
                              .filter(Boolean)
                              .join(", ");
                          const salida =
                            materiales.find(
                              material =>
                                material.id ===
                                operacion
                                  .material_salida_id
                            );
                          const subproductoMostrado =
                            operacion.subproducto_codigo
                              ? {
                                  codigo:
                                    operacion
                                      .subproducto_codigo,
                                  nombre:
                                    operacion
                                      .subproducto_nombre
                                }
                              : esRutaSubproducto &&
                                  subproductoRutaSeleccionado
                                ? {
                                    codigo:
                                      subproductoRutaSeleccionado
                                        .codigo,
                                    nombre:
                                      subproductoRutaSeleccionado
                                        .nombre
                                  }
                                : null;
                          const textoUnidades =
                            subproductoMostrado
                              ? "por subproducto"
                              : operacion.pieza_id
                                ? "por pieza"
                                : "por producto";

                          return (
                            <article
                              key={operacion.id}
                              style={{
                                border:
                                  "1px solid #E2E8F0",
                                borderRadius: 9,
                                padding: 12
                              }}
                            >
                              <strong>
                                {operacion.secuencia}
                                {". "}
                                {
                                  operacion
                                    .operacion_codigo
                                }
                                {" - "}
                                {
                                  operacion
                                    .operacion_nombre
                                }
                              </strong>
                              <div style={{
                                color: "#475569",
                                marginTop: 5
                              }}>
                                {operacion.pieza_codigo && (
                                  <>
                                    Pieza{" "}
                                    {
                                      operacion
                                        .pieza_codigo
                                    }
                                    {" - "}
                                    {
                                      operacion
                                        .pieza_nombre
                                    }
                                    {" · "}
                                  </>
                                )}
                                {subproductoMostrado && (
                                  <>
                                    Subproducto{" "}
                                    {
                                      subproductoMostrado
                                        .codigo
                                    }
                                    {" - "}
                                    {
                                      subproductoMostrado
                                        .nombre
                                    }
                                    {" · "}
                                  </>
                                )}
                                {
                                  operacion
                                    .proceso_nombre
                                }
                                {" / "}
                                {
                                  operacion
                                    .estacion_nombre ||
                                  operacion
                                    .subproceso_nombre
                                }
                              </div>
                              <div style={{
                                color: "#475569",
                                marginTop: 4
                              }}>
                                {entradasTexto || "?"}
                                {" → "}
                                {salida?.codigo || "?"}
                                {" · "}
                                {
                                  operacion
                                    .unidades_por_producto
                                }
                                {` ${textoUnidades} · `}
                                {
                                  operacion
                                    .unidades_por_hora
                                }
                                {" por hora"}
                              </div>
                              {operacion.estandar_motivo && (
                                <div style={{
                                  marginTop: 7,
                                  color: "#475569",
                                  fontSize: 13,
                                  background: "#F8FAFC",
                                  padding: 8,
                                  borderRadius: 7
                                }}>
                                  Estándar anterior:{" "}
                                  {
                                    operacion
                                      .estandar_anterior
                                  }
                                  {" por hora. Motivo: "}
                                  {
                                    operacion
                                      .estandar_motivo
                                  }
                                </div>
                              )}
                              {rutaPublicada &&
                                recalibrandoId !==
                                  operacion.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirRecalibracion(
                                      operacion
                                    )
                                  }
                                  style={{
                                    marginTop: 10,
                                    border:
                                      "1px solid #0369A1",
                                    borderRadius: 7,
                                    padding: "7px 10px",
                                    background: "white",
                                    color: "#0369A1",
                                    fontWeight: "bold",
                                    cursor: "pointer"
                                  }}
                                >
                                  Actualizar estándar
                                </button>
                              )}
                              {rutaBorrador && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      editarOperacion(
                                        operacion
                                      )
                                    }
                                    disabled={guardando}
                                    style={{
                                      marginTop: 10,
                                      border:
                                        "1px solid #0369A1",
                                      borderRadius: 7,
                                      padding:
                                        "7px 10px",
                                      background:
                                        "white",
                                      color: "#0369A1",
                                      fontWeight:
                                        "bold",
                                      cursor: guardando
                                        ? "wait"
                                        : "pointer"
                                    }}
                                  >
                                    Editar operación
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `¿Eliminar la operación ${operacion.operacion_codigo} de esta ruta?`
                                        )
                                      ) {
                                        eliminarOperacion(
                                          operacion
                                        );
                                      }
                                    }}
                                    disabled={guardando}
                                    style={{
                                      marginTop: 10,
                                      marginLeft: 8,
                                      border:
                                        "1px solid #B91C1C",
                                      borderRadius: 7,
                                      padding:
                                        "7px 10px",
                                      background:
                                        "white",
                                      color: "#B91C1C",
                                      fontWeight:
                                        "bold",
                                      cursor: guardando
                                        ? "wait"
                                        : "pointer"
                                    }}
                                  >
                                    Eliminar operación
                                  </button>
                                </>
                              )}
                              {rutaPublicada &&
                                recalibrandoId ===
                                  operacion.id && (
                                <div style={{
                                  marginTop: 12,
                                  padding: 12,
                                  borderRadius: 8,
                                  background: "#F0F9FF",
                                  display: "grid",
                                  gap: 9
                                }}>
                                  <strong>
                                    Nueva versión de ruta
                                  </strong>
                                  <label style={etiqueta}>
                                    Nuevo estándar
                                    (unidades/hora)
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={
                                        recalibracion
                                          .unidades_por_hora
                                      }
                                      onChange={evento =>
                                        setRecalibracion(
                                          actual => ({
                                            ...actual,
                                            unidades_por_hora:
                                              evento.target
                                                .value
                                          })
                                        )
                                      }
                                      style={campo}
                                    />
                                  </label>
                                  <label style={etiqueta}>
                                    Motivo del cambio
                                    <textarea
                                      value={
                                        recalibracion.motivo
                                      }
                                      onChange={evento =>
                                        setRecalibracion(
                                          actual => ({
                                            ...actual,
                                            motivo:
                                              evento.target
                                                .value
                                          })
                                        )
                                      }
                                      placeholder="Ej.: mejora comprobada del método o corrección de estándar inicial."
                                      rows={3}
                                      style={campo}
                                    />
                                  </label>
                                  <div style={{
                                    color: "#475569",
                                    fontSize: 13
                                  }}>
                                    Las OT existentes no
                                    cambian. Las nuevas OT
                                    usarán la nueva versión.
                                  </div>
                                  <div style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap"
                                  }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        guardarRecalibracion(
                                          operacion
                                        )
                                      }
                                      disabled={guardando}
                                      style={{
                                        border: "none",
                                        borderRadius: 7,
                                        padding:
                                          "8px 11px",
                                        background:
                                          "#0369A1",
                                        color: "white",
                                        fontWeight: "bold",
                                        cursor: "pointer"
                                      }}
                                    >
                                      Crear nueva versión
                                    </button>
                                    <button
                                      type="button"
                                      onClick={
                                        cancelarRecalibracion
                                      }
                                      disabled={guardando}
                                      style={{
                                        border:
                                          "1px solid #94A3B8",
                                        borderRadius: 7,
                                        padding:
                                          "8px 11px",
                                        background: "white",
                                        color: "#475569",
                                        cursor: "pointer"
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        }
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConstructorRutasV2;
