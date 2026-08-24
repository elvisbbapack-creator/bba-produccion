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
  listarPiezas
} from "../piezas/piezasRepository";
import {
  actualizarOperacionCatalogo,
  guardarOperacionCatalogo,
  listarOperacionesCatalogo,
  prepararOperacionCatalogo,
  siguienteCodigoOperacionCatalogo,
  validarOperacionCatalogo
} from "./detallesRepository";

const estadoInicial = {
  codigo: "",
  nombre: "",
  producto_id: "",
  producto_codigo: "",
  producto_nombre: "",
  productos_asociados: [],
  subproducto_id: "",
  subproducto_codigo: "",
  subproducto_nombre: "",
  pieza_id: "",
  pieza_codigo: "",
  pieza_nombre: "",
  medida: "",
  material_entrada_id: "",
  materiales_entrada: [],
  material_salida_id: "",
  activo: true
};

const crearMaterialEntradaInicial = () => ({
  material_id: "",
  cantidad: 1
});

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

const FILTRO_SIN_ASOCIAR = "__sin_asociar__";

function CatalogoDetallesV2({
  db,
  perfil,
  onVolver
}) {
  const [operaciones, setOperaciones] =
    useState([]);
  const [piezas, setPiezas] = useState([]);
  const [materiales, setMateriales] =
    useState([]);
  const [productos, setProductos] = useState([]);
  const [subproductos, setSubproductos] =
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

  const materialesActivos = materiales.filter(
    material => material.activo
  );
  const salidasRf = materialesActivos.filter(
    material => material.tipo === "RF"
  );
  const piezaSeleccionada = piezas.find(
    pieza => pieza.id === formulario.pieza_id
  );
  const asociacionesUsoPieza = useMemo(() => {
    const mapa = new Map();
    const agregarSubproducto = subproducto => {
      const subproductoId =
        subproducto.subproducto_id ||
        subproducto.id;

      if (!subproductoId) {
        return;
      }

      mapa.set(`subproducto:${subproductoId}`, {
        tipo: "subproducto",
        id: subproductoId,
        etiqueta: `${subproducto.subproducto_codigo || subproducto.codigo} - ${subproducto.subproducto_nombre || subproducto.nombre}`,
        producto_id: subproducto.producto_id || "",
        producto_codigo:
          subproducto.producto_codigo || "",
        producto_nombre:
          subproducto.producto_nombre || "",
        subproducto_id: subproductoId,
        subproducto_codigo:
          subproducto.subproducto_codigo ||
          subproducto.codigo ||
          "",
        subproducto_nombre:
          subproducto.subproducto_nombre ||
          subproducto.nombre ||
          ""
      });
    };
    const agregarProducto = producto => {
      const productoId =
        producto.producto_id ||
        producto.id;

      if (!productoId) {
        return;
      }

      mapa.set(`producto:${productoId}`, {
        tipo: "producto",
        id: productoId,
        etiqueta: `${producto.producto_codigo || producto.codigo} - ${producto.producto_nombre || producto.nombre}`,
        producto_id: productoId,
        producto_codigo:
          producto.producto_codigo ||
          producto.codigo ||
          "",
        producto_nombre:
          producto.producto_nombre ||
          producto.nombre ||
          "",
        subproducto_id: "",
        subproducto_codigo: "",
        subproducto_nombre: ""
      });
    };

    (piezaSeleccionada?.subproductos_asociados || [])
      .forEach(agregarSubproducto);
    if (piezaSeleccionada?.subproducto_id) {
      agregarSubproducto(piezaSeleccionada);
    }
    (piezaSeleccionada?.productos_asociados || [])
      .forEach(agregarProducto);
    if (piezaSeleccionada?.producto_id) {
      agregarProducto(piezaSeleccionada);
    }
    if (formulario.subproducto_id) {
      agregarSubproducto(formulario);
    } else if (formulario.producto_id) {
      agregarProducto(formulario);
    }

    return [...mapa.values()];
  }, [
    formulario,
    piezaSeleccionada
  ]);
  const opcionesFiltroProducto = useMemo(() => {
    return productos
      .filter(producto => producto.activo !== false)
      .map(producto => ({
        producto_id: producto.id,
        producto_codigo: producto.codigo || "",
        producto_nombre: producto.nombre || ""
      }))
      .sort((a, b) =>
        (a.producto_codigo || "")
          .localeCompare(b.producto_codigo || "")
      );
  }, [productos]);
  const opcionesFiltroSubproducto = useMemo(() => {
    return subproductos
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
      .map(subproducto => ({
        subproducto_id: subproducto.id,
        subproducto_codigo:
          subproducto.codigo || "",
        subproducto_nombre:
          subproducto.nombre || ""
      }))
      .sort((a, b) =>
        (a.subproducto_codigo || "")
          .localeCompare(
            b.subproducto_codigo || ""
          )
      );
  }, [filtroProductoId, subproductos]);
  const operacionesFiltradas = useMemo(
    () =>
      operaciones.filter(operacion => {
        const subproductoOperacion =
          subproductos.find(
            subproducto =>
              subproducto.id ===
              operacion.subproducto_id
          );
        const sinAsociar =
          !operacion.producto_id &&
          !operacion.subproducto_id &&
          (operacion.productos_asociados || [])
            .length === 0;
        const coincideProducto =
          filtroProductoId ===
            FILTRO_SIN_ASOCIAR
            ? sinAsociar
            : !filtroProductoId ||
              operacion.producto_id ===
                filtroProductoId ||
              subproductoOperacion
                ?.producto_id ===
                filtroProductoId ||
              (operacion.productos_asociados || [])
                .some(producto =>
                  producto.producto_id ===
                  filtroProductoId
                );
        const coincideSubproducto =
          !filtroSubproductoId ||
          operacion.subproducto_id ===
            filtroSubproductoId;

        return coincideProducto &&
          coincideSubproducto;
      }),
    [
      filtroProductoId,
      filtroSubproductoId,
      operaciones,
      subproductos
    ]
  );

  const vistaOperacion = useMemo(
    () => prepararOperacionCatalogo(
      formulario,
      perfil.empresa_id,
      editandoId || "vista-operacion"
    ),
    [
      editandoId,
      formulario,
      perfil.empresa_id
    ]
  );

  const erroresFormulario = useMemo(
    () => validarOperacionCatalogo(
      vistaOperacion,
      operaciones
    ),
    [operaciones, vistaOperacion]
  );

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        operacionesData,
        materialesData,
        piezasData,
        productosData,
        subproductosData
      ] =
        await Promise.all([
          listarOperacionesCatalogo(
            db,
            perfil.empresa_id
          ),
          listarMateriales(
            db,
            perfil.empresa_id
          ),
          listarPiezas(db, perfil.empresa_id),
          listarProductos(
            db,
            perfil.empresa_id
          ),
          listarSubproductos(
            db,
            perfil.empresa_id
          )
        ]);
      setOperaciones(operacionesData);
      setMateriales(materialesData);
      setPiezas(piezasData);
      setProductos(productosData);
      setSubproductos(subproductosData);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar el catálogo de operaciones."
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
      siguienteCodigoOperacionCatalogo(
        operaciones
      );

    setFormulario(actual =>
      actual.codigo === siguienteCodigo
        ? actual
        : {
            ...actual,
            codigo: siguienteCodigo
          }
    );
  }, [editandoId, operaciones]);

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const materialesEntradaFormulario =
    formulario.materiales_entrada.length > 0
      ? formulario.materiales_entrada
      : [crearMaterialEntradaInicial()];
  const asociacionUsoActual =
    formulario.subproducto_id
      ? `subproducto:${formulario.subproducto_id}`
      : formulario.producto_id
        ? `producto:${formulario.producto_id}`
        : "";

  const materialesEntradaDesdePieza = pieza => {
    if (pieza?.materiales_base?.length > 0) {
      return pieza.materiales_base.map(material => ({
        material_id: material.material_id,
        material_codigo: material.material_codigo,
        material_nombre: material.material_nombre,
        cantidad: material.cantidad || 1
      }));
    }

    return pieza?.material_base_id
      ? [{
          material_id: pieza.material_base_id,
          cantidad: 1
        }]
      : [];
  };

  const actualizarMaterialEntrada = (
    indice,
    campoMaterial,
    valor
  ) => {
    setFormulario(actual => {
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
    setFormulario(actual => ({
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
    setFormulario(actual => {
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

  const seleccionarPieza = piezaId => {
    const pieza = piezas.find(
      item => item.id === piezaId
    );
    const materialesEntrada =
      materialesEntradaDesdePieza(pieza);
    const subproductoPrincipal =
      pieza?.relacion_principal_tipo ===
        "subproducto" &&
      pieza?.subproducto_id
        ? {
            subproducto_id:
              pieza.subproducto_id,
            subproducto_codigo:
              pieza.subproducto_codigo,
            subproducto_nombre:
              pieza.subproducto_nombre,
            producto_id:
              pieza.producto_id || "",
            producto_codigo:
              pieza.producto_codigo || "",
            producto_nombre:
              pieza.producto_nombre || ""
          }
        : pieza?.subproductos_asociados?.[0];
    const productoPrincipal =
      pieza?.productos_asociados?.[0];
    setFormulario(actual => ({
      ...actual,
      pieza_id: pieza?.id || "",
      pieza_codigo: pieza?.codigo || "",
      pieza_nombre: pieza?.nombre || "",
      producto_id:
        subproductoPrincipal?.producto_id ||
        productoPrincipal?.producto_id ||
        pieza?.producto_id ||
        "",
      producto_codigo:
        subproductoPrincipal?.producto_codigo ||
        productoPrincipal?.producto_codigo ||
        pieza?.producto_codigo ||
        "",
      producto_nombre:
        subproductoPrincipal?.producto_nombre ||
        productoPrincipal?.producto_nombre ||
        pieza?.producto_nombre ||
        "",
      productos_asociados:
        pieza?.productos_asociados || [],
      subproducto_id:
        subproductoPrincipal?.subproducto_id || "",
      subproducto_codigo:
        subproductoPrincipal
          ?.subproducto_codigo || "",
      subproducto_nombre:
        subproductoPrincipal
          ?.subproducto_nombre || "",
      medida: pieza?.medida || actual.medida,
      material_entrada_id:
        materialesEntrada[0]?.material_id ||
        actual.material_entrada_id,
      materiales_entrada:
        materialesEntrada.length > 0
          ? materialesEntrada
          : actual.materiales_entrada
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarAsociacionUso = valor => {
    const asociacion = asociacionesUsoPieza.find(
      item => `${item.tipo}:${item.id}` === valor
    );

    setFormulario(actual => ({
      ...actual,
      producto_id:
        asociacion?.producto_id || "",
      producto_codigo:
        asociacion?.producto_codigo || "",
      producto_nombre:
        asociacion?.producto_nombre || "",
      subproducto_id:
        asociacion?.subproducto_id || "",
      subproducto_codigo:
        asociacion?.subproducto_codigo || "",
      subproducto_nombre:
        asociacion?.subproducto_nombre || ""
    }));
    setError("");
    setMensaje("");
  };

  const limpiarFormulario = () => {
    setFormulario({
      ...estadoInicial,
      codigo:
        siguienteCodigoOperacionCatalogo(
          operaciones
        )
    });
    setEditandoId("");
    setError("");
    setMensaje("");
  };

  const editar = operacion => {
    setEditandoId(operacion.id);
    setFormulario({
      codigo: operacion.codigo,
      nombre: operacion.nombre,
      producto_id: operacion.producto_id || "",
      producto_codigo:
        operacion.producto_codigo || "",
      producto_nombre:
        operacion.producto_nombre || "",
      productos_asociados:
        operacion.productos_asociados || [],
      subproducto_id:
        operacion.subproducto_id || "",
      subproducto_codigo:
        operacion.subproducto_codigo || "",
      subproducto_nombre:
        operacion.subproducto_nombre || "",
      pieza_id: operacion.pieza_id || "",
      pieza_codigo: operacion.pieza_codigo || "",
      pieza_nombre: operacion.pieza_nombre || "",
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
        operacion.material_salida_id || "",
      activo: operacion.activo !== false
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

    try {
      setGuardando(true);
      setError("");
      let mensajeExito =
        "Operación creada.";
      if (editandoId) {
        await actualizarOperacionCatalogo(
          db,
          perfil.empresa_id,
          editandoId,
          formulario,
          operaciones
        );
        mensajeExito =
          "Operación actualizada.";
      } else {
        await guardarOperacionCatalogo(
          db,
          perfil.empresa_id,
          formulario,
          operaciones
        );
      }
      limpiarFormulario();
      setMensaje(mensajeExito);
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la operación."
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
          Catálogo de Operaciones
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Define etapas productivas reutilizables
          sobre una pieza: corte, perforado,
          doblez, soldadura u otra transformación.
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
                ? "Editar operación"
                : "Nueva operación"}
            </h2>

            <label>
              Código operación
              <input
                value={formulario.codigo}
                placeholder="OP0001"
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
              Pieza
              <select
                value={formulario.pieza_id}
                onChange={evento =>
                  seleccionarPieza(
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
                  Seleccionar pieza
                </option>
                {piezas
                  .filter(pieza => pieza.activo)
                  .map(pieza => (
                    <option
                      key={pieza.id}
                      value={pieza.id}
                    >
                      {pieza.codigo}
                      {" - "}
                      {pieza.nombre}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Asociación de uso
              <select
                value={asociacionUsoActual}
                onChange={evento =>
                  seleccionarAsociacionUso(
                    evento.target.value
                  )
                }
                disabled={
                  asociacionesUsoPieza.length === 0
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 6,
                  background:
                    asociacionesUsoPieza.length === 0
                      ? "#F8FAFC"
                      : "white"
                }}
              >
                <option value="">
                  {formulario.pieza_id
                    ? "Sin asociación disponible"
                    : "Selecciona primero una pieza"}
                </option>
                {asociacionesUsoPieza.map(
                  asociacion => (
                    <option
                      key={`${asociacion.tipo}:${asociacion.id}`}
                      value={`${asociacion.tipo}:${asociacion.id}`}
                    >
                      {asociacion.tipo ===
                      "subproducto"
                        ? "Subproducto"
                        : "Producto"}
                      {": "}
                      {asociacion.etiqueta}
                    </option>
                  )
                )}
              </select>
              <small style={{
                display: "block",
                color: "#64748B",
                marginBottom: 14
              }}>
                Se usa para ordenar la operación en
                ingeniería. La ruta final se define en
                Productos y Rutas.
              </small>
            </label>

            <label>
              Nombre operación
              <input
                value={formulario.nombre}
                onChange={evento =>
                  actualizar(
                    "nombre",
                    evento.target.value
                  )
                }
                placeholder="Corte lateral 290"
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
              <strong>Materiales de entrada</strong>
              <p style={{
                color: "#64748B",
                fontSize: 13,
                marginTop: 6
              }}>
                Agrega uno o varios MP/RF que consume
                esta operación.
              </p>

              {materialesEntradaFormulario.map(
                (materialEntrada, indice) => (
                  <div
                    key={`${indice}-${materialEntrada.material_id}`}
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
                        materialEntrada.material_id ||
                        ""
                      }
                      onChange={evento =>
                        actualizarMaterialEntrada(
                          indice,
                          "material_id",
                          evento.target.value
                        )
                      }
                      style={campo}
                    >
                      <option value="">
                        Seleccionar material
                      </option>
                      {materialesActivos.map(
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
                        materialEntrada.cantidad || 1
                      }
                      onChange={evento =>
                        actualizarMaterialEntrada(
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
                        quitarMaterialEntrada(indice)
                      }
                      disabled={
                        materialesEntradaFormulario
                          .length === 1 &&
                        !materialEntrada.material_id
                      }
                      style={{
                        border:
                          "1px solid #FCA5A5",
                        borderRadius: 8,
                        background: "#FEF2F2",
                        color: "#B91C1C",
                        cursor: "pointer"
                      }}
                      title="Quitar material de entrada"
                    >
                      -
                    </button>
                  </div>
                )
              )}

              <button
                type="button"
                onClick={agregarMaterialEntrada}
                style={{
                  ...campo,
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

            <label>
              RF salida sugerido
              <select
                value={
                  formulario.material_salida_id
                }
                onChange={evento =>
                  actualizar(
                    "material_salida_id",
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
                  Sin RF sugerido
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
              Operación activa
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
                background: "#7C3AED",
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
                  : "Crear operación"}
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
              Operaciones registradas (
              {operacionesFiltradas.length}
              /{operaciones.length})
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
                  {opcionesFiltroProducto.map(
                    producto => (
                      <option
                        key={producto.producto_id}
                        value={
                          producto.producto_id
                        }
                      >
                        {producto.producto_codigo ||
                          "Sin código"}
                        {" - "}
                        {producto.producto_nombre ||
                          "Sin nombre"}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Filtrar por subproducto
                <select
                  value={filtroSubproductoId}
                  onChange={evento => {
                    setFiltroSubproductoId(
                      evento.target.value
                    );
                  }}
                  style={{
                    ...campo,
                    marginTop: 6
                  }}
                >
                  <option value="">
                    {filtroProductoId &&
                    filtroProductoId !==
                      FILTRO_SIN_ASOCIAR
                      ? "Todos los subproductos del producto"
                      : "Todos los subproductos"}
                  </option>
                  {opcionesFiltroSubproducto.map(
                    subproducto => (
                      <option
                        key={
                          subproducto
                            .subproducto_id
                        }
                        value={
                          subproducto
                            .subproducto_id
                        }
                      >
                        {subproducto
                          .subproducto_codigo ||
                          "Sin código"}
                        {" - "}
                        {subproducto
                          .subproducto_nombre ||
                          "Sin nombre"}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            {cargando ? (
              <p>Cargando catálogo...</p>
            ) : operaciones.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Todavía no hay operaciones registradas.
              </p>
            ) : operacionesFiltradas.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                No hay operaciones con ese filtro.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10,
                maxHeight: 680,
                overflowY: "auto",
                paddingRight: 6
              }}>
                {operacionesFiltradas.map(operacion => {
                  const materialesEntrada =
                    operacion.materiales_entrada
                      ?.length > 0
                      ? operacion.materiales_entrada
                      : operacion.material_entrada_id
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
                        const material = materialPorId(
                          materialEntrada
                            .material_id
                        );
                        return material
                          ? `${material.codigo} x ${materialEntrada.cantidad || 1}`
                          : "";
                      })
                      .filter(Boolean)
                      .join(", ");
                  const salida = materialPorId(
                    operacion.material_salida_id
                  );
                  const productosTexto =
                    (operacion.productos_asociados || [])
                      .map(producto =>
                        producto.producto_codigo
                          ? `${producto.producto_codigo} - ${producto.producto_nombre}`
                          : ""
                      )
                      .filter(Boolean)
                      .join(", ");
                  const contextoTexto =
                    operacion.subproducto_codigo
                      ? `Subproducto: ${operacion.subproducto_codigo} - ${operacion.subproducto_nombre}`
                      : operacion.producto_codigo
                        ? `Producto: ${operacion.producto_codigo} - ${operacion.producto_nombre}`
                        : productosTexto
                          ? `Productos: ${productosTexto}`
                          : "Asociación: sin definir";

                  return (
                    <article
                      key={operacion.id}
                      style={{
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 13,
                        opacity: operacion.activo
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
                            {operacion.codigo}
                            {" - "}
                            {operacion.nombre}
                          </strong>
                          <div style={{
                            color: "#475569",
                            fontSize: 14,
                            marginTop: 5
                          }}>
                            Medida:{" "}
                            {operacion.medida}
                            {" · "}
                            {contextoTexto}
                            {" · Pieza: "}
                            {operacion.pieza_codigo ||
                              "-"}
                            {" · Entrada: "}
                            {entradasTexto || "?"}
                            {salida
                              ? ` · Salida: ${salida.codigo}`
                              : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            editar(operacion)
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

export default CatalogoDetallesV2;
