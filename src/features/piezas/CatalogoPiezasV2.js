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
  listarProductos
} from "../productos/productosRepository";
import {
  listarSubproductos
} from "../subproductos/subproductosRepository";
import {
  actualizarPieza,
  guardarPieza,
  listarPiezas,
  prepararPieza,
  siguienteCodigoPieza,
  validarPieza
} from "./piezasRepository";

const estadoInicial = {
  codigo: "",
  relacion_principal_tipo: "producto",
  producto_id: "",
  producto_codigo: "",
  producto_nombre: "",
  productos_asociados: [],
  subproducto_id: "",
  subproducto_codigo: "",
  subproducto_nombre: "",
  subproductos_asociados: [],
  nombre: "",
  medida: "",
  material_base_id: "",
  materiales_base: [],
  activo: true
};

const materialBaseInicial = {
  material_id: "",
  cantidad: 1
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

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

const FILTRO_SIN_ASOCIAR = "__sin_asociar__";

function CatalogoPiezasV2({
  db,
  perfil,
  onVolver
}) {
  const [piezas, setPiezas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [subproductos, setSubproductos] =
    useState([]);
  const [materiales, setMateriales] =
    useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [filtroProductoId,
    setFiltroProductoId] = useState("");
  const [filtroSubproductoId,
    setFiltroSubproductoId] = useState("");
  const [editandoId, setEditandoId] =
    useState("");
  const [cargando, setCargando] =
    useState(true);
  const [guardando, setGuardando] =
    useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const materialesActivos = useMemo(
    () =>
      materiales.filter(
        material => material.activo
      ),
    [materiales]
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
  const subproductosActivos = useMemo(
    () =>
      subproductos
        .filter(subproducto =>
          subproducto.activo !== false
        )
        .sort((a, b) =>
          (a.codigo || "")
            .localeCompare(b.codigo || "")
        ),
    [subproductos]
  );
  const subproductosParaProductoFormulario =
    useCallback(
      subproductoActualId =>
        subproductosActivos.filter(
          subproducto =>
            !formulario.producto_id ||
            subproducto.producto_id ===
              formulario.producto_id ||
            subproducto.id === subproductoActualId
        ),
      [
        formulario.producto_id,
        subproductosActivos
      ]
    );
  const subproductosFiltro = useMemo(
    () =>
      subproductos
        .filter(subproducto =>
          subproducto.activo !== false &&
          (
            !filtroProductoId ||
            filtroProductoId ===
              FILTRO_SIN_ASOCIAR ||
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
  const piezasFiltradas = useMemo(
    () =>
      piezas.filter(pieza => {
        const sinAsociar =
          !pieza.producto_id &&
          !pieza.subproducto_id &&
          (pieza.productos_asociados || [])
            .length === 0 &&
          (pieza.subproductos_asociados || [])
            .length === 0;
        const coincideProducto =
          filtroProductoId ===
            FILTRO_SIN_ASOCIAR
            ? sinAsociar
            : !filtroProductoId ||
              pieza.producto_id ===
                filtroProductoId ||
              (pieza.productos_asociados || [])
                .some(producto =>
                  producto.producto_id ===
                  filtroProductoId
                ) ||
              (pieza.subproductos_asociados || [])
                .some(subproducto =>
                  subproducto.producto_id ===
                  filtroProductoId
                );
        const coincideSubproducto =
          !filtroSubproductoId ||
          pieza.subproducto_id ===
            filtroSubproductoId ||
          (pieza.subproductos_asociados || [])
            .some(subproducto =>
              subproducto.subproducto_id ===
              filtroSubproductoId
            );

        return coincideProducto &&
          coincideSubproducto;
      }),
    [
      filtroProductoId,
      filtroSubproductoId,
      piezas
    ]
  );

  const vistaPieza = useMemo(
    () => prepararPieza(
      formulario,
      perfil.empresa_id,
      editandoId || "vista-pieza"
    ),
    [
      editandoId,
      formulario,
      perfil.empresa_id
    ]
  );

  const erroresFormulario = useMemo(
    () => validarPieza(vistaPieza, piezas),
    [piezas, vistaPieza]
  );

  const contextoMaterialesFormulario = useMemo(
    () => {
      const productoIds = new Set(
        [
          formulario.producto_id,
          ...(formulario.productos_asociados || [])
            .map(producto => producto.producto_id),
          ...(formulario.subproductos_asociados || [])
            .map(subproducto => subproducto.producto_id)
        ].filter(Boolean)
      );
      const subproductoIds = new Set(
        [
          formulario.subproducto_id,
          ...(formulario.subproductos_asociados || [])
            .map(subproducto =>
              subproducto.subproducto_id
            )
        ].filter(Boolean)
      );

      return {
        productoIds,
        subproductoIds,
        tieneContexto:
          productoIds.size > 0 ||
          subproductoIds.size > 0
      };
    },
    [
      formulario.producto_id,
      formulario.productos_asociados,
      formulario.subproducto_id,
      formulario.subproductos_asociados
    ]
  );

  const materialCoincideConContexto = useCallback(
    material => {
      if (
        !contextoMaterialesFormulario.tieneContexto
      ) {
        return true;
      }

      const { productoIds, subproductoIds } =
        contextoMaterialesFormulario;
      const materialSinVincular =
        !material.producto_id &&
        !material.subproducto_id &&
        (material.productos_asociados || [])
          .length === 0 &&
        (material.subproductos_asociados || [])
          .length === 0;

      return (
        materialSinVincular ||
        productoIds.has(material.producto_id) ||
        subproductoIds.has(
          material.subproducto_id
        ) ||
        (material.productos_asociados || [])
          .some(producto =>
            productoIds.has(producto.producto_id)
          ) ||
        (material.subproductos_asociados || [])
          .some(subproducto =>
            subproductoIds.has(
              subproducto.subproducto_id
            ) ||
            productoIds.has(
              subproducto.producto_id
            )
          )
      );
    },
    [contextoMaterialesFormulario]
  );

  const materialesParaBase = useCallback(
    materialActualId =>
      materialesActivos.filter(
        material =>
          materialCoincideConContexto(material) ||
          material.id === materialActualId
      ),
    [
      materialCoincideConContexto,
      materialesActivos
    ]
  );

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        piezasData,
        materialesData,
        productosData,
        subproductosData
      ] =
        await Promise.all([
          listarPiezas(db, perfil.empresa_id),
          listarMateriales(
            db,
            perfil.empresa_id
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
      setPiezas(piezasData);
      setMateriales(materialesData);
      setProductos(productosData);
      setSubproductos(subproductosData);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar el catálogo de piezas."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (editandoId) {
      return;
    }

    const siguienteCodigo =
      siguienteCodigoPieza(piezas);

    setFormulario(actual =>
      actual.codigo === siguienteCodigo
        ? actual
        : {
            ...actual,
            codigo: siguienteCodigo
          }
    );
  }, [editandoId, piezas]);

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarTipoRelacion = tipo => {
    setFormulario(actual => ({
      ...actual,
      relacion_principal_tipo: tipo,
      ...(tipo === "producto"
        ? {
            subproducto_id: "",
            subproducto_codigo: "",
            subproducto_nombre: "",
            subproductos_asociados: []
          }
        : {})
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarProducto = productoId => {
    const producto = productos.find(
      item => item.id === productoId
    );

    setFormulario(actual => {
      const subproductosCompatibles = producto
        ? (actual.subproductos_asociados || [])
            .filter(
              subproducto =>
                subproducto.subproducto_id &&
                subproducto.producto_id ===
                  producto.id
            )
        : (actual.subproductos_asociados || []);
      const subproductoPrincipal =
        subproductosCompatibles.find(
          subproducto =>
            subproducto.subproducto_id ===
            actual.subproducto_id
        ) ||
        subproductosCompatibles[0] ||
        null;

      return {
        ...actual,
        relacion_principal_tipo: "producto",
        producto_id: producto?.id || "",
        producto_codigo: producto?.codigo || "",
        producto_nombre: producto?.nombre || "",
        subproducto_id:
          subproductoPrincipal
            ?.subproducto_id || "",
        subproducto_codigo:
          subproductoPrincipal
            ?.subproducto_codigo || "",
        subproducto_nombre:
          subproductoPrincipal
            ?.subproducto_nombre || "",
        subproductos_asociados:
          subproductosCompatibles,
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
      };
    });
    setError("");
    setMensaje("");
  };

  const asociarProductoDesdeSubproducto = (
    productosAsociados = [],
    subproducto
  ) => {
    if (!subproducto?.producto_id) {
      return productosAsociados;
    }

    const productoAsociado = {
      producto_id: subproducto.producto_id,
      producto_codigo:
        subproducto.producto_codigo || "",
      producto_nombre:
        subproducto.producto_nombre || ""
    };

    return [
      productoAsociado,
      ...(productosAsociados || []).filter(
        item =>
          item.producto_id &&
          item.producto_id !==
            productoAsociado.producto_id
      )
    ];
  };

  const seleccionarSubproducto = subproductoId => {
    const subproducto = subproductos.find(
      item => item.id === subproductoId
    );

    setFormulario(actual => ({
      ...actual,
      relacion_principal_tipo: "subproducto",
      subproducto_id: subproducto?.id || "",
      subproducto_codigo:
        subproducto?.codigo || "",
      subproducto_nombre:
        subproducto?.nombre || "",
      producto_id:
        subproducto?.producto_id ||
        actual.producto_id,
      producto_codigo:
        subproducto?.producto_codigo ||
        actual.producto_codigo,
      producto_nombre:
        subproducto?.producto_nombre ||
        actual.producto_nombre,
      productos_asociados: subproducto
        ? asociarProductoDesdeSubproducto(
            actual.productos_asociados,
            subproducto
          )
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

      const sinDuplicados = lista.filter(
        (item, posicion, arreglo) =>
          item.producto_id &&
          arreglo.findIndex(
            repetido =>
              repetido.producto_id === item.producto_id
          ) === posicion
      );

      return {
        ...actual,
        productos_asociados: sinDuplicados
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

      const sinDuplicados = lista.filter(
        (item, posicion, arreglo) =>
          item.subproducto_id &&
          arreglo.findIndex(
            repetido =>
              repetido.subproducto_id ===
              item.subproducto_id
          ) === posicion
      );
      const principal =
        sinDuplicados[0] || null;

      return {
        ...actual,
        relacion_principal_tipo: "subproducto",
        subproducto_id:
          principal?.subproducto_id || "",
        subproducto_codigo:
          principal?.subproducto_codigo || "",
        subproducto_nombre:
          principal?.subproducto_nombre || "",
        producto_id:
          principal?.producto_id ||
          actual.producto_id,
        producto_codigo:
          principal?.producto_codigo ||
          actual.producto_codigo,
        producto_nombre:
          principal?.producto_nombre ||
          actual.producto_nombre,
        productos_asociados: subproducto
          ? asociarProductoDesdeSubproducto(
              actual.productos_asociados,
              subproducto
            )
          : actual.productos_asociados,
        subproductos_asociados: sinDuplicados
      };
    });
    setError("");
    setMensaje("");
  };

  const agregarSubproductoAsociado = () => {
    setFormulario(actual => ({
      ...actual,
      relacion_principal_tipo: "subproducto",
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
    setFormulario(actual => {
      const lista = (
        actual.subproductos_asociados.length > 0
          ? actual.subproductos_asociados
          : []
      ).filter((_, posicion) => posicion !== indice);
      const principal = lista[0] || null;

      return {
        ...actual,
        subproducto_id:
          principal?.subproducto_id || "",
        subproducto_codigo:
          principal?.subproducto_codigo || "",
        subproducto_nombre:
          principal?.subproducto_nombre || "",
        subproductos_asociados: lista
      };
    });
    setError("");
    setMensaje("");
  };

  const materialesBaseFormulario =
    formulario.materiales_base.length > 0
      ? formulario.materiales_base
      : [materialBaseInicial];

  const actualizarMaterialBase = (
    indice,
    campoMaterial,
    valor
  ) => {
    setFormulario(actual => {
      const lista =
        actual.materiales_base.length > 0
          ? [...actual.materiales_base]
          : [materialBaseInicial];
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

      const materialesBase = lista.map(item => ({
        ...item,
        cantidad:
          campoMaterial === "cantidad" &&
          lista[indice] === item
            ? valor
            : item.cantidad
      }));

      return {
        ...actual,
        material_base_id:
          materialesBase[0]?.material_id || "",
        materiales_base: materialesBase
      };
    });
    setError("");
    setMensaje("");
  };

  const agregarMaterialBase = () => {
    setFormulario(actual => ({
      ...actual,
      materiales_base: [
        ...(actual.materiales_base.length > 0
          ? actual.materiales_base
          : [materialBaseInicial]),
        materialBaseInicial
      ]
    }));
    setError("");
    setMensaje("");
  };

  const quitarMaterialBase = indice => {
    setFormulario(actual => {
      const lista = (
        actual.materiales_base.length > 0
          ? actual.materiales_base
          : [materialBaseInicial]
      ).filter((_, posicion) => posicion !== indice);
      const materialesBase =
        lista.length > 0 ? lista : [];

      return {
        ...actual,
        material_base_id:
          materialesBase[0]?.material_id || "",
        materiales_base: materialesBase
      };
    });
    setError("");
    setMensaje("");
  };

  const limpiarFormulario = () => {
    setFormulario({
      ...estadoInicial,
      codigo: siguienteCodigoPieza(piezas)
    });
    setEditandoId("");
    setError("");
  };

  const editar = pieza => {
    setEditandoId(pieza.id);
    setFormulario({
      codigo: pieza.codigo,
      relacion_principal_tipo:
        pieza.relacion_principal_tipo ||
        (pieza.subproducto_id
          ? "subproducto"
          : "producto"),
      producto_id: pieza.producto_id || "",
      producto_codigo:
        pieza.producto_codigo || "",
      producto_nombre:
        pieza.producto_nombre || "",
      productos_asociados:
        pieza.productos_asociados ||
        (pieza.producto_id
          ? [{
              producto_id: pieza.producto_id,
              producto_codigo:
                pieza.producto_codigo || "",
              producto_nombre:
                pieza.producto_nombre || ""
            }]
          : []),
      subproducto_id:
        pieza.subproducto_id || "",
      subproducto_codigo:
        pieza.subproducto_codigo || "",
      subproducto_nombre:
        pieza.subproducto_nombre || "",
      subproductos_asociados:
        pieza.subproductos_asociados ||
        (pieza.subproducto_id
          ? [{
              subproducto_id:
                pieza.subproducto_id,
              subproducto_codigo:
                pieza.subproducto_codigo || "",
              subproducto_nombre:
                pieza.subproducto_nombre || "",
              producto_id:
                pieza.producto_id || "",
              producto_codigo:
                pieza.producto_codigo || "",
              producto_nombre:
                pieza.producto_nombre || ""
            }]
          : []),
      nombre: pieza.nombre,
      medida: pieza.medida,
      material_base_id:
        pieza.material_base_id || "",
      materiales_base:
        pieza.materiales_base ||
        (pieza.material_base_id
          ? [{
              material_id:
                pieza.material_base_id,
              cantidad: 1
            }]
          : []),
      activo: pieza.activo !== false
    });
    setError("");
    setMensaje("");
  };

  const guardar = async evento => {
    evento.preventDefault();

    if (erroresFormulario.length > 0) {
      setError(erroresFormulario.join(" "));
      return;
    }

    if (
      formulario.relacion_principal_tipo ===
        "producto" &&
      !formulario.producto_id
    ) {
      setError(
        "Selecciona el producto principal de esta pieza."
      );
      return;
    }

    try {
      setGuardando(true);
      let mensajeExito = "Pieza creada.";
      if (editandoId) {
        await actualizarPieza(
          db,
          perfil.empresa_id,
          editandoId,
          formulario,
          piezas
        );
        mensajeExito = "Pieza actualizada.";
      } else {
        await guardarPieza(
          db,
          perfil.empresa_id,
          formulario,
          piezas
        );
      }
      limpiarFormulario();
      setMensaje(mensajeExito);
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la pieza."
      );
    } finally {
      setGuardando(false);
    }
  };

  const materialPorId = id =>
    materiales.find(
      material => material.id === id
    );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: 24,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1150,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver a Ingeniería
        </BotonVolver>

        <h1 style={{ marginBottom: 4 }}>
          Catálogo de Piezas
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Define componentes físicos reutilizables.
          Una pieza puede pasar por varias operaciones
          como corte, perforado o doblez.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
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
                ? "Editar pieza"
                : "Nueva pieza"}
            </h2>

            <label>
              Relación principal
              <select
                value={
                  formulario.relacion_principal_tipo
                }
                onChange={evento =>
                  seleccionarTipoRelacion(
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 8
                }}
              >
                <option value="producto">
                  Producto final
                </option>
                <option value="subproducto">
                  Subproducto
                </option>
              </select>
            </label>

            {formulario.relacion_principal_tipo ===
            "subproducto" ? (
              <label>
                Subproducto principal
                {" "}
                <span style={{ color: "#64748B" }}>
                  (opcional)
                </span>
                <select
                  value={formulario.subproducto_id}
                  onChange={evento =>
                    seleccionarSubproducto(
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
                    Pendiente de crear/asociar
                  </option>
                  {subproductosParaProductoFormulario(
                    formulario.subproducto_id
                  )
                    .map(subproducto => (
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
                <small style={{
                  display: "block",
                  color: "#64748B",
                  marginTop: -8,
                  marginBottom: 14
                }}>
                  Puedes crear la pieza ahora aunque el
                  subproducto todavía no exista. Luego
                  vuelves a editar la pieza y la asocias.
                </small>
              </label>
            ) : (
              <label>
                Producto principal
                <select
                  value={formulario.producto_id}
                  onChange={evento =>
                    seleccionarProducto(
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
                    Seleccionar producto
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
            )}

            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: 12,
              marginBottom: 14
            }}>
              <strong>Productos donde se usa esta pieza</strong>
              <p style={{
                color: "#64748B",
                fontSize: 13,
                marginTop: 6
              }}>
                Si la relación principal es un subproducto,
                el producto asociado se completa desde ese
                subproducto. Agrega otros productos solo si
                la pieza se usa directamente en más de una
                ingeniería.
              </p>

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
                      style={campo}
                    >
                      <option value="">
                        Seleccionar producto
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
                  ...campo,
                  background: "#EFF6FF",
                  borderColor: "#BFDBFE",
                  color: "#1D4ED8",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                + Agregar producto asociado
              </button>
            </div>

            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: 12,
              marginBottom: 14
            }}>
              <strong>Subproductos donde se usa esta pieza</strong>
              <p style={{
                color: "#64748B",
                fontSize: 13,
                marginTop: 6
              }}>
                Úsalo cuando la pieza pertenezca a una
                bandeja, lateral, cabecero, cruceta u otro
                conjunto reutilizable.
              </p>

              {subproductosAsociadosFormulario.map(
                (subproductoAsociado, indice) => (
                  <div
                    key={`${indice}-${subproductoAsociado.subproducto_id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 42px",
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
                      style={campo}
                    >
                      <option value="">
                        Seleccionar subproducto
                      </option>
                      {subproductosParaProductoFormulario(
                        subproductoAsociado
                          .subproducto_id
                      )
                        .map(subproducto => (
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
                        ))}
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
                            formulario.subproducto_id ||
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
                  ...campo,
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


            <label>
              Código pieza
              <input
                value={formulario.codigo}
                placeholder="PZ0001"
                disabled
                style={{
                  ...campo,
                  marginTop: 6,
                  background: "#F8FAFC"
                }}
              />
              <small style={{
                display: "block",
                color: "#64748B",
                marginTop: 5,
                marginBottom: 14
              }}>
                Código asignado automáticamente según el
                siguiente correlativo disponible.
              </small>
            </label>

            <label>
              Nombre
              <input
                value={formulario.nombre}
                onChange={evento =>
                  actualizar(
                    "nombre",
                    evento.target.value
                  )
                }
                placeholder="Lateral 290"
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Medida
              <input
                value={formulario.medida}
                onChange={evento =>
                  actualizar(
                    "medida",
                    evento.target.value
                  )
                }
                placeholder="290 mm"
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: 12,
              marginBottom: 14
            }}>
              <strong>Materiales base</strong>
              <p style={{
                color: "#64748B",
                fontSize: 13,
                marginTop: 6
              }}>
                Agrega uno o varios MP/RF que componen
                esta pieza. Si ya seleccionaste producto
                o subproducto, el listado se filtra por
                materiales vinculados a esa ingeniería
                y materiales aún sin vincular.
              </p>
              {contextoMaterialesFormulario
                .tieneContexto &&
                materialesParaBase("").length === 0 && (
                  <p style={{
                    color: "#B45309",
                    background: "#FFFBEB",
                    padding: 10,
                    borderRadius: 8,
                    fontSize: 13
                  }}>
                    No hay materiales vinculados ni sin
                    vincular para el contexto
                    seleccionado. Revisa el Catálogo de
                    materiales V2.
                  </p>
                )}

              {materialesBaseFormulario.map(
                (materialBase, indice) => (
                  <div
                    key={`${indice}-${materialBase.material_id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 90px 42px",
                      gap: 8,
                      marginBottom: 8
                    }}
                  >
                    <select
                      value={
                        materialBase.material_id || ""
                      }
                      onChange={evento =>
                        actualizarMaterialBase(
                          indice,
                          "material_id",
                          evento.target.value
                        )
                      }
                      style={campo}
                    >
                      <option value="">
                        Sin material base
                      </option>
                      {materialesParaBase(
                        materialBase.material_id
                      ).map(
                        material => (
                          <option
                            key={material.id}
                            value={material.id}
                          >
                            {material.codigo}
                            {" - "}
                            {material.nombre}
                          </option>
                        )
                      )}
                    </select>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={
                        materialBase.cantidad || 1
                      }
                      onChange={evento =>
                        actualizarMaterialBase(
                          indice,
                          "cantidad",
                          evento.target.value
                        )
                      }
                      style={campo}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        quitarMaterialBase(indice)
                      }
                      disabled={
                        materialesBaseFormulario
                          .length === 1 &&
                        !materialBase.material_id
                      }
                      style={{
                        border:
                          "1px solid #FCA5A5",
                        borderRadius: 8,
                        background: "#FEF2F2",
                        color: "#B91C1C",
                        cursor: "pointer"
                      }}
                      title="Quitar material base"
                    >
                      -
                    </button>
                  </div>
                )
              )}

              <button
                type="button"
                onClick={agregarMaterialBase}
                style={{
                  ...campo,
                  background: "#EFF6FF",
                  borderColor: "#BFDBFE",
                  color: "#1D4ED8",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                + Agregar material base
              </button>
            </div>

            <label style={{
              display: "flex",
              gap: 9,
              alignItems: "center",
              marginBottom: 16
            }}>
              <input
                type="checkbox"
                checked={formulario.activo}
                onChange={evento =>
                  actualizar(
                    "activo",
                    evento.target.checked
                  )
                }
              />
              Pieza activa
            </label>

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
                background: "#2563EB",
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
                  : "Crear pieza"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                style={{
                  ...campo,
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
              Piezas registradas (
              {piezasFiltradas.length}
              /{piezas.length})
            </h2>

            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              marginBottom: 14
            }}>
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
                    ...campo,
                    marginTop: 6
                  }}
                >
                  <option value="">
                    Todos los productos
                  </option>
                  <option
                    value={FILTRO_SIN_ASOCIAR}
                  >
                    Sin asociar
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
                    FILTRO_SIN_ASOCIAR
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    background:
                      filtroProductoId ===
                      FILTRO_SIN_ASOCIAR
                        ? "#F8FAFC"
                        : "white"
                  }}
                >
                  <option value="">
                    {filtroProductoId &&
                    filtroProductoId !==
                      FILTRO_SIN_ASOCIAR
                      ? "Todos los subproductos del producto"
                      : "Todos los subproductos"}
                  </option>
                  {subproductosFiltro.map(
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
            </div>

            {cargando ? (
              <p>Cargando catálogo...</p>
            ) : piezas.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Todavía no hay piezas registradas.
              </p>
            ) : piezasFiltradas.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                No hay piezas con ese filtro.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10,
                maxHeight: 680,
                overflowY: "auto",
                paddingRight: 6
              }}>
                {piezasFiltradas.map(pieza => {
                  const materialesBase =
                    pieza.materiales_base?.length > 0
                      ? pieza.materiales_base
                      : pieza.material_base_id
                        ? [{
                            material_id:
                              pieza.material_base_id,
                            cantidad: 1
                          }]
                        : [];
                  const materialesTexto =
                    materialesBase
                      .map(materialBase => {
                        const material = materialPorId(
                          materialBase.material_id
                        );
                        return material
                          ? `${material.codigo} x ${materialBase.cantidad || 1}`
                          : "";
                      })
                      .filter(Boolean)
                      .join(", ");
                  const productosTexto =
                    (pieza.productos_asociados || [])
                      .map(producto =>
                        producto.producto_codigo
                          ? `${producto.producto_codigo} - ${producto.producto_nombre}`
                          : ""
                      )
                      .filter(Boolean)
                      .join(", ");
                  const subproductosTexto =
                    (pieza.subproductos_asociados || [])
                      .map(subproducto =>
                        subproducto.subproducto_codigo
                          ? `${subproducto.subproducto_codigo} - ${subproducto.subproducto_nombre}`
                          : ""
                      )
                      .filter(Boolean)
                      .join(", ");

                  return (
                    <article
                      key={pieza.id}
                      style={{
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 13,
                        opacity: pieza.activo
                          ? 1
                          : 0.58
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 12
                      }}>
                        <div>
                          <strong>
                            {pieza.codigo}
                            {" - "}
                            {pieza.nombre}
                          </strong>
                          <div style={{
                            color: "#475569",
                            fontSize: 14,
                            marginTop: 5
                          }}>
                            {productosTexto
                              ? `Productos: ${productosTexto} · `
                              : pieza.producto_codigo
                                ? `Producto: ${pieza.producto_codigo} - ${pieza.producto_nombre} · `
                                : "Producto: sin asociar · "}
                            {subproductosTexto
                              ? `Subproductos: ${subproductosTexto} · `
                              : ""}
                            Medida: {pieza.medida}
                            {materialesTexto
                              ? ` · Materiales base: ${materialesTexto}`
                              : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            editar(pieza)
                          }
                          style={{
                            alignSelf: "start",
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

export default CatalogoPiezasV2;
