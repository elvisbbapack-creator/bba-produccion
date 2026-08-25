import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  TIPOS_MATERIAL
} from "../../domain/produccionV2";
import {
  TIPOS_TERCERO,
  listarTerceros
} from "../terceros/tercerosRepository";
import {
  listarProductos
} from "../productos/productosRepository";
import {
  listarSubproductos
} from "../subproductos/subproductosRepository";
import {
  APLICACIONES_CORTE_LASER,
  actualizarMaterial,
  cambiarEstadoMaterial,
  crearMaterial,
  listarMateriales,
  normalizarAplicacionCorteLaser,
  prepararMaterial,
  siguienteCodigoMaterial,
  validarNuevoMaterial
} from "./materialesRepository";

const estadoInicial = {
  tipo: TIPOS_MATERIAL.MATERIA_PRIMA,
  codigo: "",
  producto_id: "",
  producto_codigo: "",
  producto_nombre: "",
  productos_asociados: [],
  subproducto_id: "",
  subproducto_codigo: "",
  subproducto_nombre: "",
  subproductos_asociados: [],
  nombre: "",
  unidad_medida: "unidad",
  costo_unitario_referencial: 0,
  peso_kg_por_unidad: 0,
  aplicacion_corte_laser:
    APLICACIONES_CORTE_LASER.NO_APLICA,
  velocidad_laser_fibra_m_min: 0,
  velocidad_laser_co2_m_min: 0,
  moneda: "CLP",
  minimo_compra: 0,
  proveedor_preferente_id: "",
  proveedor_preferente_codigo: "",
  proveedor_preferente_nombre: "",
  costo_origen: "catalogo_material",
  es_comprado: true,
  activo: true
};

const productoAsociadoInicial = {
  producto_id: "",
  producto_codigo: "",
  producto_nombre: ""
};

const subproductoAsociadoInicial = {
  subproducto_id: "",
  subproducto_codigo: "",
  subproducto_nombre: "",
  producto_id: "",
  producto_codigo: "",
  producto_nombre: ""
};

const estiloCampo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

const FILTRO_SIN_VINCULAR = "__sin_vincular__";

const normalizarBusqueda = valor =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const usaLaserFibra = aplicacion =>
  [
    APLICACIONES_CORTE_LASER.FIBRA,
    APLICACIONES_CORTE_LASER.AMBOS
  ].includes(aplicacion);

const usaLaserCo2 = aplicacion =>
  [
    APLICACIONES_CORTE_LASER.CO2,
    APLICACIONES_CORTE_LASER.AMBOS
  ].includes(aplicacion);

const etiquetaAplicacionLaser = aplicacion => {
  if (aplicacion === APLICACIONES_CORTE_LASER.FIBRA) {
    return "Laser Fibra";
  }

  if (aplicacion === APLICACIONES_CORTE_LASER.CO2) {
    return "Laser CO2";
  }

  if (aplicacion === APLICACIONES_CORTE_LASER.AMBOS) {
    return "Laser Fibra y CO2";
  }

  return "";
};

function CatalogoMaterialesV2({
  db,
  perfil,
  onVolver
}) {
  const [materiales, setMateriales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [subproductos, setSubproductos] =
    useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [filtroProductoId, setFiltroProductoId] =
    useState("");
  const [filtroSubproductoId, setFiltroSubproductoId] =
    useState("");
  const [busquedaMaterial, setBusquedaMaterial] =
    useState("");
  const [editandoId, setEditandoId] =
    useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        materialesCargados,
        proveedoresCargados,
        productosCargados,
        subproductosCargados
      ] = await Promise.all([
        listarMateriales(
          db,
          perfil.empresa_id
        ),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.PROVEEDOR
        ),
        listarProductos(
          db,
          perfil.empresa_id
        ),
        listarSubproductos(
          db,
          perfil.empresa_id
        )
      ]);
      setMateriales(materialesCargados);
      setProveedores(
        proveedoresCargados.filter(
          proveedor => proveedor.activo !== false
        )
      );
      setProductos(productosCargados);
      setSubproductos(subproductosCargados);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar los materiales."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const vistaPrevia = useMemo(
    () => prepararMaterial(
      formulario,
      perfil.empresa_id,
      editandoId || "vista-previa"
    ),
    [editandoId, formulario, perfil.empresa_id]
  );

  const erroresFormulario = useMemo(
    () => validarNuevoMaterial(
      vistaPrevia,
      materiales
    ),
    [materiales, vistaPrevia]
  );

  const productosFiltro = useMemo(
    () =>
      productos
        .filter(producto => producto.activo !== false)
        .sort((a, b) =>
          (a.codigo || "")
            .localeCompare(b.codigo || "")
        ),
    [productos]
  );

  const subproductosFiltro = useMemo(
    () =>
      subproductos
        .filter(subproducto =>
          subproducto.activo !== false &&
          (
            !filtroProductoId ||
            filtroProductoId ===
              FILTRO_SIN_VINCULAR ||
            subproducto.producto_id ===
              filtroProductoId
          )
        )
        .sort((a, b) =>
          (a.codigo || "")
            .localeCompare(b.codigo || "")
        ),
    [filtroProductoId, subproductos]
  );

  const materialesFiltrados = useMemo(
    () => {
      const busquedaNormalizada =
        normalizarBusqueda(busquedaMaterial);

      return materiales.filter(material => {
        const sinVincular =
          !material.producto_id &&
          !material.subproducto_id &&
          (material.productos_asociados || [])
            .length === 0 &&
          (material.subproductos_asociados || [])
            .length === 0;
        const coincideProducto =
          filtroProductoId ===
            FILTRO_SIN_VINCULAR
            ? sinVincular
            : !filtroProductoId ||
              material.producto_id ===
                filtroProductoId ||
              (material.productos_asociados || [])
                .some(producto =>
                  producto.producto_id ===
                  filtroProductoId
                ) ||
              (material.subproductos_asociados || [])
                .some(subproducto =>
                  subproducto.producto_id ===
                  filtroProductoId
                );
        const coincideSubproducto =
          !filtroSubproductoId ||
          material.subproducto_id ===
            filtroSubproductoId ||
          (material.subproductos_asociados || [])
            .some(subproducto =>
              subproducto.subproducto_id ===
                filtroSubproductoId
            );
        const productosTexto =
          (material.productos_asociados || [])
            .map(producto => [
              producto.producto_codigo,
              producto.producto_nombre
            ].filter(Boolean).join(" "))
            .join(" ");
        const subproductosTexto =
          (material.subproductos_asociados || [])
            .map(subproducto => [
              subproducto.subproducto_codigo,
              subproducto.subproducto_nombre,
              subproducto.producto_codigo,
              subproducto.producto_nombre
            ].filter(Boolean).join(" "))
            .join(" ");
        const textoBusqueda = normalizarBusqueda([
          material.codigo,
          material.nombre,
          material.tipo,
          material.unidad_medida,
          material.proveedor_preferente_codigo,
          material.proveedor_preferente_nombre,
          material.producto_codigo,
          material.producto_nombre,
          material.subproducto_codigo,
          material.subproducto_nombre,
          productosTexto,
          subproductosTexto,
          material.aplicacion_corte_laser
        ].filter(Boolean).join(" "));
        const coincideBusqueda =
          !busquedaNormalizada ||
          textoBusqueda.includes(busquedaNormalizada);

        return coincideProducto &&
          coincideSubproducto &&
          coincideBusqueda;
      });
    },
    [
      busquedaMaterial,
      filtroProductoId,
      filtroSubproductoId,
      materiales
    ]
  );

  const crearEstadoInicial = useCallback(
    (tipo = TIPOS_MATERIAL.MATERIA_PRIMA) => ({
      ...estadoInicial,
      tipo,
      codigo: siguienteCodigoMaterial(
        tipo,
        materiales
      ),
      es_comprado: [
        TIPOS_MATERIAL.MATERIA_PRIMA,
        TIPOS_MATERIAL.SUMINISTRO,
        TIPOS_MATERIAL.EPP
      ].includes(tipo)
    }),
    [materiales]
  );

  useEffect(() => {
    if (editandoId) {
      return;
    }

    const siguienteCodigo =
      siguienteCodigoMaterial(
        formulario.tipo,
        materiales
      );

    if (formulario.codigo === siguienteCodigo) {
      return;
    }

    setFormulario(actual => ({
      ...actual,
      codigo: siguienteCodigo
    }));
  }, [
    editandoId,
    formulario.codigo,
    formulario.tipo,
    materiales
  ]);

  const actualizarCampo = (campo, valor) => {
    setFormulario(actual => ({
      ...actual,
      [campo]: valor
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarProductoPrincipal =
  productoId => {
    const producto = productos.find(
      item => item.id === productoId
    );

    setFormulario(actual => ({
      ...actual,
      producto_id: producto?.id || "",
      producto_codigo: producto?.codigo || "",
      producto_nombre: producto?.nombre || "",
      subproducto_id: "",
      subproducto_codigo: "",
      subproducto_nombre: "",
      subproductos_asociados: (
        actual.subproductos_asociados || []
      ).filter(
        item =>
          !producto?.id ||
          item.producto_id === producto.id
      ),
      productos_asociados: producto
        ? [
            {
              producto_id: producto.id,
              producto_codigo: producto.codigo,
              producto_nombre: producto.nombre
            },
            ...(actual.productos_asociados || [])
              .filter(
                item =>
                  item.producto_id &&
                  item.producto_id !== producto.id
              )
          ]
        : (actual.productos_asociados || [])
    }));
    setError("");
    setMensaje("");
  };

  const productosAsociadosFormulario =
    formulario.productos_asociados.length > 0
      ? formulario.productos_asociados
      : formulario.producto_id
        ? [{
            producto_id: formulario.producto_id,
            producto_codigo:
              formulario.producto_codigo,
            producto_nombre:
              formulario.producto_nombre
          }]
        : [productoAsociadoInicial];

  const actualizarProductoAsociado = (
    indice,
    productoId
  ) => {
    const producto = productos.find(
      item => item.id === productoId
    );

    setFormulario(actual => {
      const lista =
        actual.productos_asociados.length > 0
          ? [...actual.productos_asociados]
          : actual.producto_id
            ? [{
                producto_id: actual.producto_id,
                producto_codigo:
                  actual.producto_codigo,
                producto_nombre:
                  actual.producto_nombre
              }]
            : [productoAsociadoInicial];

      lista[indice] = producto
        ? {
            producto_id: producto.id,
            producto_codigo: producto.codigo,
            producto_nombre: producto.nombre
          }
        : productoAsociadoInicial;

      return {
        ...actual,
        productos_asociados: lista.filter(
          (item, posicion, arreglo) =>
            item.producto_id &&
            arreglo.findIndex(
              repetido =>
                repetido.producto_id === item.producto_id
            ) === posicion
        )
      };
    });
    setError("");
    setMensaje("");
  };

  const agregarProductoAsociado = () => {
    setFormulario(actual => ({
      ...actual,
      productos_asociados: [
        ...(actual.productos_asociados.length > 0
          ? actual.productos_asociados
          : actual.producto_id
            ? [{
                producto_id: actual.producto_id,
                producto_codigo:
                  actual.producto_codigo,
                producto_nombre:
                  actual.producto_nombre
              }]
            : []),
        productoAsociadoInicial
      ]
    }));
    setError("");
    setMensaje("");
  };

  const quitarProductoAsociado = indice => {
    setFormulario(actual => ({
      ...actual,
      productos_asociados: (
        actual.productos_asociados.length > 0
          ? actual.productos_asociados
          : []
      ).filter((_, posicion) => posicion !== indice)
    }));
    setError("");
    setMensaje("");
  };

  const productosAsociadosIds = useMemo(
    () =>
      new Set(
        [
          formulario.producto_id,
          ...(formulario.productos_asociados || [])
            .map(producto => producto.producto_id)
        ].filter(Boolean)
      ),
    [
      formulario.producto_id,
      formulario.productos_asociados
    ]
  );

  const subproductosDisponibles = useMemo(
    () =>
      subproductos.filter(
        subproducto =>
          subproducto.activo !== false &&
          (
            productosAsociadosIds.size === 0 ||
            productosAsociadosIds.has(
              subproducto.producto_id
            )
          )
      ),
    [productosAsociadosIds, subproductos]
  );

  const seleccionarSubproductoPrincipal =
  subproductoId => {
    const subproducto = subproductos.find(
      item => item.id === subproductoId
    );
    const productoDelSubproducto = productos.find(
      producto =>
        producto.id === subproducto?.producto_id
    );

    setFormulario(actual => ({
      ...actual,
      subproducto_id: subproducto?.id || "",
      subproducto_codigo:
        subproducto?.codigo || "",
      subproducto_nombre:
        subproducto?.nombre || "",
      producto_id:
        actual.producto_id ||
        subproducto?.producto_id ||
        "",
      producto_codigo:
        actual.producto_codigo ||
        productoDelSubproducto?.codigo ||
        subproducto?.producto_codigo ||
        "",
      producto_nombre:
        actual.producto_nombre ||
        productoDelSubproducto?.nombre ||
        subproducto?.producto_nombre ||
        "",
      productos_asociados:
        productoDelSubproducto &&
        !(actual.productos_asociados || [])
          .some(
            producto =>
              producto.producto_id ===
              productoDelSubproducto.id
          )
          ? [
              {
                producto_id:
                  productoDelSubproducto.id,
                producto_codigo:
                  productoDelSubproducto.codigo,
                producto_nombre:
                  productoDelSubproducto.nombre
              },
              ...(actual.productos_asociados || [])
            ]
          : actual.productos_asociados,
      subproductos_asociados: subproducto
        ? [
            {
              subproducto_id: subproducto.id,
              subproducto_codigo:
                subproducto.codigo,
              subproducto_nombre:
                subproducto.nombre,
              producto_id:
                subproducto.producto_id || "",
              producto_codigo:
                subproducto.producto_codigo || "",
              producto_nombre:
                subproducto.producto_nombre || ""
            },
            ...(actual.subproductos_asociados || [])
              .filter(
                item =>
                  item.subproducto_id &&
                  item.subproducto_id !==
                    subproducto.id
              )
          ]
        : (actual.subproductos_asociados || [])
    }));
    setError("");
    setMensaje("");
  };

  const subproductosAsociadosFormulario =
    formulario.subproductos_asociados.length > 0
      ? formulario.subproductos_asociados
      : formulario.subproducto_id
        ? [{
            subproducto_id:
              formulario.subproducto_id,
            subproducto_codigo:
              formulario.subproducto_codigo,
            subproducto_nombre:
              formulario.subproducto_nombre,
            producto_id: formulario.producto_id,
            producto_codigo:
              formulario.producto_codigo,
            producto_nombre:
              formulario.producto_nombre
          }]
        : [subproductoAsociadoInicial];

  const actualizarSubproductoAsociado = (
    indice,
    subproductoId
  ) => {
    const subproducto = subproductos.find(
      item => item.id === subproductoId
    );

    setFormulario(actual => {
      const lista =
        actual.subproductos_asociados.length > 0
          ? [...actual.subproductos_asociados]
          : actual.subproducto_id
            ? [{
                subproducto_id:
                  actual.subproducto_id,
                subproducto_codigo:
                  actual.subproducto_codigo,
                subproducto_nombre:
                  actual.subproducto_nombre,
                producto_id: actual.producto_id,
                producto_codigo:
                  actual.producto_codigo,
                producto_nombre:
                  actual.producto_nombre
              }]
            : [subproductoAsociadoInicial];

      lista[indice] = subproducto
        ? {
            subproducto_id: subproducto.id,
            subproducto_codigo:
              subproducto.codigo,
            subproducto_nombre:
              subproducto.nombre,
            producto_id:
              subproducto.producto_id || "",
            producto_codigo:
              subproducto.producto_codigo || "",
            producto_nombre:
              subproducto.producto_nombre || ""
          }
        : subproductoAsociadoInicial;

      return {
        ...actual,
        subproductos_asociados: lista.filter(
          (item, posicion, arreglo) =>
            item.subproducto_id &&
            arreglo.findIndex(
              repetido =>
                repetido.subproducto_id ===
                item.subproducto_id
            ) === posicion
        )
      };
    });
    setError("");
    setMensaje("");
  };

  const agregarSubproductoAsociado = () => {
    setFormulario(actual => ({
      ...actual,
      subproductos_asociados: [
        ...(actual.subproductos_asociados.length > 0
          ? actual.subproductos_asociados
          : actual.subproducto_id
            ? [{
                subproducto_id:
                  actual.subproducto_id,
                subproducto_codigo:
                  actual.subproducto_codigo,
                subproducto_nombre:
                  actual.subproducto_nombre,
                producto_id: actual.producto_id,
                producto_codigo:
                  actual.producto_codigo,
                producto_nombre:
                  actual.producto_nombre
              }]
            : []),
        subproductoAsociadoInicial
      ]
    }));
    setError("");
    setMensaje("");
  };

  const quitarSubproductoAsociado = indice => {
    setFormulario(actual => ({
      ...actual,
      subproductos_asociados: (
        actual.subproductos_asociados.length > 0
          ? actual.subproductos_asociados
          : []
      ).filter((_, posicion) => posicion !== indice)
    }));
    setError("");
    setMensaje("");
  };

  const limpiarFormulario = () => {
    setFormulario(crearEstadoInicial());
    setEditandoId("");
    setError("");
  };

  const editar = material => {
    const aplicacionCorteLaser =
      normalizarAplicacionCorteLaser(material);

    setEditandoId(material.id);
    setFormulario({
      tipo: material.tipo,
      codigo: material.codigo,
      producto_id: material.producto_id || "",
      producto_codigo:
        material.producto_codigo || "",
      producto_nombre:
        material.producto_nombre || "",
      productos_asociados:
        material.productos_asociados ||
        (material.producto_id
          ? [{
              producto_id: material.producto_id,
              producto_codigo:
                material.producto_codigo || "",
              producto_nombre:
                material.producto_nombre || ""
            }]
          : []),
      subproducto_id:
        material.subproducto_id || "",
      subproducto_codigo:
        material.subproducto_codigo || "",
      subproducto_nombre:
        material.subproducto_nombre || "",
      subproductos_asociados:
        material.subproductos_asociados ||
        (material.subproducto_id
          ? [{
              subproducto_id:
                material.subproducto_id,
              subproducto_codigo:
                material.subproducto_codigo || "",
              subproducto_nombre:
                material.subproducto_nombre || "",
              producto_id:
                material.producto_id || "",
              producto_codigo:
                material.producto_codigo || "",
              producto_nombre:
                material.producto_nombre || ""
            }]
          : []),
      nombre: material.nombre,
      unidad_medida: material.unidad_medida,
      costo_unitario_referencial:
        material.costo_unitario_referencial || 0,
      peso_kg_por_unidad:
        material.peso_kg_por_unidad || 0,
      aplicacion_corte_laser:
        material.tipo === TIPOS_MATERIAL.MATERIA_PRIMA
          ? aplicacionCorteLaser
          : APLICACIONES_CORTE_LASER.NO_APLICA,
      velocidad_laser_fibra_m_min:
        usaLaserFibra(aplicacionCorteLaser)
          ? material.velocidad_laser_fibra_m_min || 0
          : 0,
      velocidad_laser_co2_m_min:
        usaLaserCo2(aplicacionCorteLaser)
          ? material.velocidad_laser_co2_m_min || 0
          : 0,
      moneda: material.moneda || "CLP",
      minimo_compra: material.minimo_compra || 0,
      proveedor_preferente_id:
        material.proveedor_preferente_id || "",
      proveedor_preferente_codigo:
        material.proveedor_preferente_codigo || "",
      proveedor_preferente_nombre:
        material.proveedor_preferente_nombre || "",
      costo_origen:
        material.costo_origen || "catalogo_material",
      es_comprado: Boolean(material.es_comprado),
      activo: material.activo !== false
    });
    setError("");
    setMensaje("");
  };

  const guardar = async (evento) => {
    evento.preventDefault();

    if (erroresFormulario.length > 0) {
      setError(erroresFormulario.join(" "));
      return;
    }

    try {
      setGuardando(true);
      setError("");
      if (editandoId) {
        await actualizarMaterial(
          db,
          perfil.empresa_id,
          editandoId,
          formulario,
          materiales
        );
        setMensaje(
          "Material actualizado correctamente."
        );
      } else {
        await crearMaterial(
          db,
          perfil.empresa_id,
          formulario
        );
        setMensaje(
          "Material creado correctamente."
        );
      }
      limpiarFormulario();
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar el material."
      );
    } finally {
      setGuardando(false);
    }
  };

  const seleccionarProveedor = proveedorId => {
    const proveedor = proveedores.find(
      item => item.id === proveedorId
    );

    setFormulario(actual => ({
      ...actual,
      proveedor_preferente_id: proveedorId,
      proveedor_preferente_codigo:
        proveedor?.codigo || "",
      proveedor_preferente_nombre:
        proveedor?.nombre || ""
    }));
    setError("");
    setMensaje("");
  };

  const cambiarEstado = async (material) => {
    try {
      setError("");
      setMensaje("");
      await cambiarEstadoMaterial(
        db,
        material.id,
        !material.activo
      );
      setMateriales(actuales =>
        actuales.map(item =>
          item.id === material.id
            ? {
              ...item,
              activo: !item.activo
            }
            : item
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cambiar el estado."
      );
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: 24,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver a Ingeniería
        </BotonVolver>

        <h1 style={{ marginBottom: 4 }}>
          Catálogo de materiales
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Materias primas (MP) y recursos de
          fabricación semielaborados (RF), más
          suministros productivos (SUM) y elementos
          de protección personal (EPP).
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 22,
          alignItems: "start"
        }}>
          <form
            onSubmit={guardar}
            style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              {editandoId
                ? "Editar material"
                : "Nuevo material"}
            </h2>

            <label>
              Tipo
              <select
                value={formulario.tipo}
                onChange={evento => {
                  const tipo = evento.target.value;
                  setFormulario(actual => ({
                    ...actual,
                    tipo,
                    codigo: siguienteCodigoMaterial(
                      tipo,
                      materiales
                    ),
                    producto_id:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.producto_id
                        : "",
                    producto_codigo:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.producto_codigo
                        : "",
                    producto_nombre:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.producto_nombre
                        : "",
                    productos_asociados:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.productos_asociados
                        : [],
                    subproducto_id:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.subproducto_id
                        : "",
                    subproducto_codigo:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.subproducto_codigo
                        : "",
                    subproducto_nombre:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.subproducto_nombre
                        : "",
                    subproductos_asociados:
                      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
                        ? actual.subproductos_asociados
                        : [],
                    aplicacion_corte_laser:
                      tipo === TIPOS_MATERIAL.MATERIA_PRIMA
                        ? actual.aplicacion_corte_laser
                        : APLICACIONES_CORTE_LASER.NO_APLICA,
                    velocidad_laser_fibra_m_min:
                      tipo === TIPOS_MATERIAL.MATERIA_PRIMA
                        ? actual.velocidad_laser_fibra_m_min
                        : 0,
                    velocidad_laser_co2_m_min:
                      tipo === TIPOS_MATERIAL.MATERIA_PRIMA
                        ? actual.velocidad_laser_co2_m_min
                        : 0,
                    es_comprado:
                      [
                        TIPOS_MATERIAL.MATERIA_PRIMA,
                        TIPOS_MATERIAL.SUMINISTRO,
                        TIPOS_MATERIAL.EPP
                      ].includes(tipo)
                  }));
                  setError("");
                  setMensaje("");
                }}
                disabled={Boolean(editandoId)}
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14,
                  background: editandoId
                    ? "#F8FAFC"
                    : "white"
                }}
              >
                <option value="MP">
                  MP - Materia prima
                </option>
                <option value="RF">
                  RF - Recurso de fabricación
                </option>
                <option value="SUM">
                  SUM - Suministro productivo
                </option>
                <option value="EPP">
                  EPP - Elemento de protección personal
                </option>
              </select>
            </label>

            <label>
              Código
              <input
                value={formulario.codigo}
                onChange={evento =>
                  actualizarCampo(
                    "codigo",
                    evento.target.value
                  )
                }
                placeholder={`${formulario.tipo}0001`}
                disabled
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 6,
                  background: "#F8FAFC"
                }}
              />
              <span style={{
                display: "block",
                color: "#64748B",
                fontSize: 13,
                marginBottom: 14
              }}>
                Código asignado automáticamente
                según el siguiente correlativo
                disponible.
              </span>
            </label>

            <label>
              Estado
              <select
                value={formulario.activo ? "activo" : "inactivo"}
                onChange={evento =>
                  actualizarCampo(
                    "activo",
                    evento.target.value === "activo"
                  )
                }
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="activo">
                  Activo
                </option>
                <option value="inactivo">
                  Inactivo
                </option>
              </select>
            </label>

            {formulario.tipo ===
              TIPOS_MATERIAL.RECURSO_FABRICACION && (
              <div style={{
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14
              }}>
                <strong>Productos asociados al RF</strong>
                <p style={{
                  color: "#64748B",
                  fontSize: 13,
                  marginTop: 6
                }}>
                  Usa un producto principal para ordenar
                  dónde nació el RF y agrega otros si este
                  recurso sirve para más ingenierías.
                </p>

                <label>
                  Producto principal
                  <select
                    value={formulario.producto_id}
                    onChange={evento =>
                      seleccionarProductoPrincipal(
                        evento.target.value
                      )
                    }
                    style={{
                      ...estiloCampo,
                      marginTop: 6,
                      marginBottom: 10
                    }}
                  >
                    <option value="">
                      Sin producto principal
                    </option>
                    {productos
                      .filter(
                        producto =>
                          producto.activo !== false
                      )
                      .map(producto => (
                        <option
                          key={producto.id}
                          value={producto.id}
                        >
                          {producto.codigo}
                          {" - "}
                          {producto.nombre}
                        </option>
                      ))}
                  </select>
                </label>

                {productosAsociadosFormulario.map(
                  (productoAsociado, indice) => (
                    <div
                      key={`${indice}-${productoAsociado.producto_id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 42px",
                        gap: 8,
                        marginBottom: 8
                      }}
                    >
                      <select
                        value={
                          productoAsociado.producto_id ||
                          ""
                        }
                        onChange={evento =>
                          actualizarProductoAsociado(
                            indice,
                            evento.target.value
                          )
                        }
                        style={estiloCampo}
                      >
                        <option value="">
                          Seleccionar producto asociado
                        </option>
                        {productos
                          .filter(
                            producto =>
                              producto.activo !== false
                          )
                          .map(producto => (
                            <option
                              key={producto.id}
                              value={producto.id}
                            >
                              {producto.codigo}
                              {" - "}
                              {producto.nombre}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          quitarProductoAsociado(indice)
                        }
                        disabled={
                          productoAsociado.producto_id ===
                            formulario.producto_id ||
                          productosAsociadosFormulario
                            .length === 1
                        }
                        style={{
                          border:
                            "1px solid #FCA5A5",
                          borderRadius: 8,
                          background: "#FEF2F2",
                          color: "#B91C1C",
                          cursor:
                            productoAsociado.producto_id ===
                              formulario.producto_id ||
                            productosAsociadosFormulario
                              .length === 1
                              ? "not-allowed"
                              : "pointer"
                        }}
                        title="Quitar producto asociado"
                      >
                        -
                      </button>
                    </div>
                  )
                )}

                <button
                  type="button"
                  onClick={agregarProductoAsociado}
                  style={{
                    ...estiloCampo,
                    background: "#EFF6FF",
                    borderColor: "#BFDBFE",
                    color: "#1D4ED8",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  + Agregar producto asociado
                </button>

                <div style={{
                  borderTop: "1px solid #E2E8F0",
                  marginTop: 14,
                  paddingTop: 14
                }}>
                  <strong>
                    Subproductos asociados al RF
                  </strong>
                  <p style={{
                    color: "#64748B",
                    fontSize: 13,
                    marginTop: 6
                  }}>
                    Opcional, pero recomendado cuando el
                    RF pertenece a una parte específica
                    del producto. El listado se filtra
                    por los productos asociados.
                  </p>

                  <label>
                    Subproducto principal
                    <select
                      value={formulario.subproducto_id}
                      onChange={evento =>
                        seleccionarSubproductoPrincipal(
                          evento.target.value
                        )
                      }
                      style={{
                        ...estiloCampo,
                        marginTop: 6,
                        marginBottom: 10
                      }}
                    >
                      <option value="">
                        Sin subproducto principal
                      </option>
                      {subproductosDisponibles.map(
                        subproducto => (
                          <option
                            key={subproducto.id}
                            value={subproducto.id}
                          >
                            {subproducto.codigo}
                            {" - "}
                            {subproducto.nombre}
                            {subproducto.producto_codigo
                              ? ` · ${subproducto.producto_codigo}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {subproductosAsociadosFormulario.map(
                    (
                      subproductoAsociado,
                      indice
                    ) => (
                      <div
                        key={`${indice}-${subproductoAsociado.subproducto_id}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1fr 42px",
                          gap: 8,
                          marginBottom: 8
                        }}
                      >
                        <select
                          value={
                            subproductoAsociado
                              .subproducto_id || ""
                          }
                          onChange={evento =>
                            actualizarSubproductoAsociado(
                              indice,
                              evento.target.value
                            )
                          }
                          style={estiloCampo}
                        >
                          <option value="">
                            Seleccionar subproducto
                            asociado
                          </option>
                          {subproductosDisponibles.map(
                            subproducto => (
                              <option
                                key={subproducto.id}
                                value={subproducto.id}
                              >
                                {subproducto.codigo}
                                {" - "}
                                {subproducto.nombre}
                                {subproducto
                                  .producto_codigo
                                  ? ` · ${subproducto.producto_codigo}`
                                  : ""}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            quitarSubproductoAsociado(
                              indice
                            )
                          }
                          disabled={
                            subproductoAsociado
                              .subproducto_id ===
                              formulario.subproducto_id ||
                            subproductosAsociadosFormulario
                              .length === 1
                          }
                          style={{
                            border:
                              "1px solid #FCA5A5",
                            borderRadius: 8,
                            background: "#FEF2F2",
                            color: "#B91C1C",
                            cursor:
                              subproductoAsociado
                                .subproducto_id ===
                                formulario
                                  .subproducto_id ||
                              subproductosAsociadosFormulario
                                .length === 1
                                ? "not-allowed"
                                : "pointer"
                          }}
                          title="Quitar subproducto asociado"
                        >
                          -
                        </button>
                      </div>
                    )
                  )}

                  <button
                    type="button"
                    onClick={agregarSubproductoAsociado}
                    style={{
                      ...estiloCampo,
                      background: "#EFF6FF",
                      borderColor: "#BFDBFE",
                      color: "#1D4ED8",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    + Agregar subproducto asociado
                  </button>
                </div>
              </div>
            )}

            <label>
              Nombre
              <input
                value={formulario.nombre}
                onChange={evento =>
                  actualizarCampo(
                    "nombre",
                    evento.target.value
                  )
                }
                placeholder="Ej. Tubo 15x15x1 mm"
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Unidad de medida
              <input
                value={formulario.unidad_medida}
                onChange={evento =>
                  actualizarCampo(
                    "unidad_medida",
                    evento.target.value
                  )
                }
                placeholder="unidad, metro, kg..."
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {formulario.tipo ===
              TIPOS_MATERIAL.MATERIA_PRIMA && (
              <div style={{
                border: "1px solid #DBEAFE",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                background: "#EFF6FF"
              }}>
                <strong>
                  Parámetros técnicos de corte láser
                </strong>
                <p style={{
                  color: "#475569",
                  fontSize: 13,
                  marginTop: 6
                }}>
                  Indica si esta materia prima pasa por
                  láser. Alambre, tubos u otros materiales
                  sin corte láser deben quedar como No
                  aplica. Planchas metálicas normalmente
                  usan Laser Fibra; planchas no metálicas
                  como PAI, acrílico o MDF usan Laser CO2.
                </p>
                <label>
                  Aplicación corte láser
                  <select
                    value={
                      formulario.aplicacion_corte_laser ||
                      APLICACIONES_CORTE_LASER.NO_APLICA
                    }
                    onChange={evento => {
                      const aplicacion =
                        evento.target.value;
                      setFormulario(actual => ({
                        ...actual,
                        aplicacion_corte_laser:
                          aplicacion,
                        velocidad_laser_fibra_m_min:
                          usaLaserFibra(aplicacion)
                            ? actual
                                .velocidad_laser_fibra_m_min
                            : 0,
                        velocidad_laser_co2_m_min:
                          usaLaserCo2(aplicacion)
                            ? actual
                                .velocidad_laser_co2_m_min
                            : 0
                      }));
                      setError("");
                      setMensaje("");
                    }}
                    style={{
                      ...estiloCampo,
                      marginTop: 6,
                      marginBottom: 10,
                      background: "white"
                    }}
                  >
                    <option
                      value={
                        APLICACIONES_CORTE_LASER.NO_APLICA
                      }
                    >
                      No aplica
                    </option>
                    <option
                      value={
                        APLICACIONES_CORTE_LASER.FIBRA
                      }
                    >
                      Solo Laser Fibra
                    </option>
                    <option
                      value={
                        APLICACIONES_CORTE_LASER.CO2
                      }
                    >
                      Solo Laser CO2
                    </option>
                    <option
                      value={
                        APLICACIONES_CORTE_LASER.AMBOS
                      }
                    >
                      Laser Fibra y CO2
                    </option>
                  </select>
                </label>
                <div style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10
                }}>
                  {usaLaserFibra(
                    formulario.aplicacion_corte_laser
                  ) && (
                    <label>
                      m/min Laser Fibra
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={
                          formulario
                            .velocidad_laser_fibra_m_min ||
                          ""
                        }
                        onChange={evento =>
                          actualizarCampo(
                            "velocidad_laser_fibra_m_min",
                            evento.target.value
                          )
                        }
                        placeholder="Ej. plancha metálica: 8"
                        style={{
                          ...estiloCampo,
                          marginTop: 6
                        }}
                      />
                    </label>
                  )}
                  {usaLaserCo2(
                    formulario.aplicacion_corte_laser
                  ) && (
                    <label>
                      m/min Laser CO2
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={
                          formulario
                            .velocidad_laser_co2_m_min ||
                          ""
                        }
                        onChange={evento =>
                          actualizarCampo(
                            "velocidad_laser_co2_m_min",
                            evento.target.value
                          )
                        }
                        placeholder="Ej. PAI/acrílico/MDF: 6"
                        style={{
                          ...estiloCampo,
                          marginTop: 6
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10
            }}>
              <label>
                Costo unitario referencial
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={
                    formulario.costo_unitario_referencial ||
                    ""
                  }
                  onChange={evento =>
                    actualizarCampo(
                      "costo_unitario_referencial",
                      evento.target.value
                    )
                  }
                  placeholder="Ej. 1250"
                  style={{
                    ...estiloCampo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Moneda
                <select
                  value={formulario.moneda}
                  onChange={evento =>
                    actualizarCampo(
                      "moneda",
                      evento.target.value
                    )
                  }
                  style={{
                    ...estiloCampo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                >
                  <option value="CLP">CLP</option>
                  <option value="PEN">PEN</option>
                  <option value="USD">USD</option>
                </select>
              </label>

              {["MP", "SUM", "EPP"].includes(
                formulario.tipo
              ) && (
                <label>
                  Peso kg por unidad
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    inputMode="decimal"
                    value={
                      formulario.peso_kg_por_unidad || ""
                    }
                    onChange={evento =>
                      actualizarCampo(
                        "peso_kg_por_unidad",
                        evento.target.value
                      )
                    }
                    placeholder="Ej. kg por plancha, metro, litro o unidad"
                    style={{
                      ...estiloCampo,
                      marginTop: 6,
                      marginBottom: 14
                    }}
                  />
                </label>
              )}
            </div>

            <label>
              Mínimo de compra
              <input
                type="number"
                step="0.0001"
                min="0"
                inputMode="decimal"
                value={formulario.minimo_compra || ""}
                onChange={evento =>
                  actualizarCampo(
                    "minimo_compra",
                    evento.target.value
                  )
                }
                placeholder="Ej. 1 plancha, 6 metros, 25 kg"
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Proveedor preferente
              <select
                value={
                  formulario.proveedor_preferente_id ||
                  ""
                }
                onChange={evento =>
                  seleccionarProveedor(
                    evento.target.value
                  )
                }
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Sin proveedor preferente
                </option>
                {proveedores.map(proveedor => (
                  <option
                    key={proveedor.id}
                    value={proveedor.id}
                  >
                    {proveedor.codigo} -{" "}
                    {proveedor.nombre}
                  </option>
                ))}
              </select>
            </label>

            {["MP", "SUM", "EPP"].includes(
              formulario.tipo
            ) && (
              <label style={{
                display: "flex",
                gap: 9,
                alignItems: "center",
                marginBottom: 16
              }}>
                <input
                  type="checkbox"
                  checked={formulario.es_comprado}
                  onChange={evento =>
                    actualizarCampo(
                      "es_comprado",
                      evento.target.checked
                    )
                  }
                />
                Comprado a proveedor
              </label>
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
              disabled={guardando}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#0F766E",
                color: "white",
                fontWeight: "bold",
                cursor: guardando
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardando
                ? "Guardando..."
                : editandoId
                  ? "Guardar cambios"
                  : "Crear material"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                style={{
                  ...estiloCampo,
                  marginTop: 10,
                  background: "white",
                  cursor: "pointer"
                }}
              >
                Cancelar edición
              </button>
            )}
          </form>

          <section style={{
            background: "white",
            padding: 22,
            borderRadius: 14,
            boxShadow:
              "0 2px 10px rgba(15,23,42,0.08)"
          }}>
            <h2 style={{ marginTop: 0 }}>
              Materiales ({materialesFiltrados.length}
              /{materiales.length})
            </h2>

            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              marginBottom: 14
            }}>
              <label>
                Buscar en catálogo
                <input
                  type="search"
                  value={busquedaMaterial}
                  onChange={evento =>
                    setBusquedaMaterial(evento.target.value)
                  }
                  placeholder="Ej: tubo, PAI, SUM, perno, proveedor..."
                  style={{
                    ...estiloCampo,
                    marginTop: 6
                  }}
                />
                <small style={{
                  color: "#64748B",
                  display: "block",
                  marginTop: 5
                }}>
                  Busca por código, nombre, tipo,
                  proveedor, producto o subproducto.
                </small>
              </label>

              <label>
                Filtrar por producto
                <select
                  value={filtroProductoId}
                  onChange={evento => {
                    setFiltroProductoId(
                      evento.target.value
                    );
                    setFiltroSubproductoId("");
                  }}
                  style={{
                    ...estiloCampo,
                    marginTop: 6
                  }}
                >
                  <option value="">
                    Todos los productos
                  </option>
                  <option value={FILTRO_SIN_VINCULAR}>
                    Sin vincular
                  </option>
                  {productosFiltro.map(producto => (
                    <option
                      key={producto.id}
                      value={producto.id}
                    >
                      {producto.codigo}
                      {" - "}
                      {producto.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Filtrar por subproducto
                <select
                  value={filtroSubproductoId}
                  onChange={evento =>
                    setFiltroSubproductoId(
                      evento.target.value
                    )
                  }
                  disabled={
                    filtroProductoId ===
                    FILTRO_SIN_VINCULAR
                  }
                  style={{
                    ...estiloCampo,
                    marginTop: 6,
                    background:
                      filtroProductoId ===
                      FILTRO_SIN_VINCULAR
                        ? "#F8FAFC"
                        : "white"
                  }}
                >
                  <option value="">
                    Todos los subproductos
                  </option>
                  {subproductosFiltro.map(subproducto => (
                    <option
                      key={subproducto.id}
                      value={subproducto.id}
                    >
                      {subproducto.codigo}
                      {" - "}
                      {subproducto.nombre}
                      {subproducto.producto_codigo
                        ? ` · ${subproducto.producto_codigo}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {cargando ? (
              <p>Cargando catálogo...</p>
            ) : materiales.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Todavía no hay materiales registrados.
              </p>
            ) : materialesFiltrados.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                No hay materiales relacionados con la
                búsqueda o filtros seleccionados.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10,
                maxHeight: "70vh",
                overflowY: "auto",
                paddingRight: 6
              }}>
                {materialesFiltrados.map(material => {
                  const productosTexto =
                    (material.productos_asociados || [])
                      .map(producto =>
                        producto.producto_codigo
                          ? `${producto.producto_codigo} - ${producto.producto_nombre}`
                          : ""
                      )
                      .filter(Boolean)
                      .join(", ");
                  const subproductosTexto =
                    (material.subproductos_asociados || [])
                      .map(subproducto =>
                        subproducto.subproducto_codigo
                          ? `${subproducto.subproducto_codigo} - ${subproducto.subproducto_nombre}`
                          : ""
                      )
                      .filter(Boolean)
                      .join(", ");

                  return (
                    <article
                      key={material.id}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 13,
                        opacity: material.activo
                          ? 1
                          : 0.58
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12
                      }}>
                        <div>
                          <strong>
                            {material.codigo}
                            {" - "}
                            {material.nombre}
                          </strong>
                          <span style={{
                            display: "inline-block",
                            marginLeft: 8,
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            color: material.activo
                              ? "#166534"
                              : "#991B1B",
                            background: material.activo
                              ? "#DCFCE7"
                              : "#FEE2E2"
                          }}>
                            {material.activo
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                          <div style={{
                            color: "#475569",
                            fontSize: 14,
                            marginTop: 5
                          }}>
                            {material.tipo}
                            {" · "}
                            {material.unidad_medida}
                            {material.tipo === "RF" &&
                              productosTexto
                              ? ` · Productos: ${productosTexto}`
                              : ""}
                            {material.tipo === "RF" &&
                              subproductosTexto
                              ? ` · Subproductos: ${subproductosTexto}`
                              : ""}
                            {material.es_comprado
                              ? " · comprado"
                              : ""}
                            {material.costo_unitario_referencial
                              ? ` · costo ref. ${Number(
                                  material.costo_unitario_referencial
                                ).toLocaleString("es-CL", {
                                  style: "currency",
                                  currency:
                                    material.moneda || "CLP",
                                  maximumFractionDigits: 0
                                })}`
                              : ""}
                            {material.peso_kg_por_unidad
                              ? ` · peso ${Number(
                                  material.peso_kg_por_unidad
                                ).toLocaleString("es-CL", {
                                  maximumFractionDigits: 4
                                })} kg/${material.unidad_medida || "un"}`
                              : ""}
                            {material.tipo === "MP" &&
                            etiquetaAplicacionLaser(
                              normalizarAplicacionCorteLaser(
                                material
                              )
                            )
                              ? ` · corte ${etiquetaAplicacionLaser(
                                  normalizarAplicacionCorteLaser(
                                    material
                                  )
                                )}`
                              : ""}
                            {material.velocidad_laser_fibra_m_min
                              ? ` · Fibra ${material.velocidad_laser_fibra_m_min} m/min`
                              : ""}
                            {material.velocidad_laser_co2_m_min
                              ? ` · CO2 ${material.velocidad_laser_co2_m_min} m/min`
                              : ""}
                            {material.proveedor_preferente_nombre
                              ? ` · prov. ${material.proveedor_preferente_nombre}`
                              : ""}
                          </div>
                        </div>
                        <div style={{
                          display: "flex",
                          gap: 8,
                          alignSelf: "start"
                        }}>
                          <button
                            type="button"
                            onClick={() =>
                              editar(material)
                            }
                            style={{
                              border:
                                "1px solid #CBD5E1",
                              borderRadius: 7,
                              background: "white",
                              padding: "7px 10px",
                              cursor: "pointer"
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              cambiarEstado(material)
                            }
                            style={{
                              border:
                                "1px solid #CBD5E1",
                              borderRadius: 7,
                              background: "white",
                              padding: "7px 10px",
                              cursor: "pointer"
                            }}
                          >
                            {material.activo
                              ? "Desactivar"
                              : "Activar"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default CatalogoMaterialesV2;
