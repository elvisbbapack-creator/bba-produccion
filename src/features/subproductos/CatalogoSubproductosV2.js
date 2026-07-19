import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  listarPiezas
} from "../piezas/piezasRepository";
import {
  listarProductos
} from "../productos/productosRepository";
import {
  actualizarSubproducto,
  guardarSubproducto,
  listarSubproductos,
  prepararSubproducto,
  siguienteCodigoSubproducto,
  validarSubproducto
} from "./subproductosRepository";

const estadoInicial = {
  codigo: "",
  nombre: "",
  producto_id: "",
  producto_codigo: "",
  producto_nombre: "",
  pieza_salida_id: "",
  pieza_salida_codigo: "",
  pieza_salida_nombre: "",
  componentes: [],
  activo: true
};

const componenteInicial = {
  pieza_id: "",
  cantidad: "1"
};

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

function CatalogoSubproductosV2({
  db,
  perfil,
  onVolver
}) {
  const [subproductos, setSubproductos] =
    useState([]);
  const [productos, setProductos] =
    useState([]);
  const [piezas, setPiezas] = useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [componente, setComponente] =
    useState(componenteInicial);
  const [editandoId, setEditandoId] =
    useState("");
  const [cargando, setCargando] =
    useState(true);
  const [guardando, setGuardando] =
    useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const productosActivos = productos.filter(
    producto => producto.activo !== false
  );
  const piezasActivas = piezas.filter(
    pieza => pieza.activo !== false
  );

  const vistaSubproducto = useMemo(
    () => prepararSubproducto(
      formulario,
      perfil.empresa_id,
      editandoId || "vista-subproducto"
    ),
    [
      editandoId,
      formulario,
      perfil.empresa_id
    ]
  );

  const erroresFormulario = useMemo(
    () => validarSubproducto(
      vistaSubproducto,
      subproductos
    ),
    [subproductos, vistaSubproducto]
  );

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        subproductosData,
        productosData,
        piezasData
      ] = await Promise.all([
        listarSubproductos(
          db,
          perfil.empresa_id
        ),
        listarProductos(db, perfil.empresa_id),
        listarPiezas(db, perfil.empresa_id)
      ]);
      setSubproductos(subproductosData);
      setProductos(productosData);
      setPiezas(piezasData);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar el catálogo de subproductos."
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
      siguienteCodigoSubproducto(subproductos);

    setFormulario(actual =>
      actual.codigo === siguienteCodigo
        ? actual
        : {
            ...actual,
            codigo: siguienteCodigo
          }
    );
  }, [editandoId, subproductos]);

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarProducto = productoId => {
    const producto = productos.find(
      item => item.id === productoId
    );
    setFormulario(actual => ({
      ...actual,
      producto_id: producto?.id || "",
      producto_codigo:
        producto?.codigo || "",
      producto_nombre:
        producto?.nombre || ""
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarPiezaSalida = piezaId => {
    const pieza = piezas.find(
      item => item.id === piezaId
    );
    setFormulario(actual => ({
      ...actual,
      pieza_salida_id: pieza?.id || "",
      pieza_salida_codigo:
        pieza?.codigo || "",
      pieza_salida_nombre:
        pieza?.nombre || ""
    }));
    setError("");
    setMensaje("");
  };

  const agregarComponente = () => {
    const pieza = piezas.find(
      item => item.id === componente.pieza_id
    );
    const cantidad = Number(
      componente.cantidad
    );

    if (!pieza) {
      setError(
        "Selecciona una pieza componente."
      );
      return;
    }

    if (
      !Number.isFinite(cantidad) ||
      cantidad <= 0
    ) {
      setError(
        "La cantidad del componente debe ser mayor que cero."
      );
      return;
    }

    if (
      formulario.componentes.some(
        item => item.pieza_id === pieza.id
      )
    ) {
      setError(
        "Esa pieza ya está agregada como componente."
      );
      return;
    }

    setFormulario(actual => ({
      ...actual,
      componentes: [
        ...actual.componentes,
        {
          pieza_id: pieza.id,
          pieza_codigo: pieza.codigo,
          pieza_nombre: pieza.nombre,
          cantidad
        }
      ]
    }));
    setComponente(componenteInicial);
    setError("");
    setMensaje("");
  };

  const quitarComponente = piezaId => {
    setFormulario(actual => ({
      ...actual,
      componentes:
        actual.componentes.filter(
          item => item.pieza_id !== piezaId
        )
    }));
    setError("");
    setMensaje("");
  };

  const limpiarFormulario = () => {
    setFormulario({
      ...estadoInicial,
      codigo:
        siguienteCodigoSubproducto(
          subproductos
        )
    });
    setComponente(componenteInicial);
    setEditandoId("");
    setError("");
  };

  const editar = subproducto => {
    setEditandoId(subproducto.id);
    setFormulario({
      codigo: subproducto.codigo,
      nombre: subproducto.nombre,
      producto_id:
        subproducto.producto_id || "",
      producto_codigo:
        subproducto.producto_codigo || "",
      producto_nombre:
        subproducto.producto_nombre || "",
      pieza_salida_id:
        subproducto.pieza_salida_id || "",
      pieza_salida_codigo:
        subproducto.pieza_salida_codigo || "",
      pieza_salida_nombre:
        subproducto.pieza_salida_nombre || "",
      componentes:
        subproducto.componentes || [],
      activo: subproducto.activo !== false
    });
    setComponente(componenteInicial);
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
      let mensajeExito =
        "Subproducto creado.";
      if (editandoId) {
        await actualizarSubproducto(
          db,
          perfil.empresa_id,
          editandoId,
          formulario,
          subproductos
        );
        mensajeExito =
          "Subproducto actualizado.";
      } else {
        await guardarSubproducto(
          db,
          perfil.empresa_id,
          formulario,
          subproductos
        );
      }
      limpiarFormulario();
      setMensaje(mensajeExito);
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar el subproducto."
      );
    } finally {
      setGuardando(false);
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
        maxWidth: 1220,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver a Ingeniería
        </BotonVolver>

        <h1 style={{ marginBottom: 4 }}>
          Catálogo de Subproductos
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Crea conjuntos reutilizables como bandejas,
          laterales o cabeceros. Puedes crear el
          subproducto primero y completar sus piezas
          después.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(340px, 430px) 1fr",
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
                ? "Editar subproducto"
                : "Nuevo subproducto"}
            </h2>

            <label>
              Código subproducto
              <input
                value={formulario.codigo}
                placeholder="SUB0001"
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
              Producto
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
                {productosActivos.map(producto => (
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
              Nombre subproducto
              <input
                value={formulario.nombre}
                onChange={evento =>
                  actualizar(
                    "nombre",
                    evento.target.value
                  )
                }
                placeholder="Lateral"
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Pieza de salida final
              {" "}
              <span style={{ color: "#64748B" }}>
                (opcional)
              </span>
              <select
                value={
                  formulario.pieza_salida_id
                }
                onChange={evento =>
                  seleccionarPiezaSalida(
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 6
                }}
              >
                <option value="">
                  Pendiente de crear/asociar
                </option>
                {piezasActivas.map(pieza => (
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
            <p style={{
              color: "#64748B",
              fontSize: 13,
              marginTop: 0,
              marginBottom: 14
            }}>
              Puedes dejarlo pendiente. Cuando ya
              exista la pieza que representa el resultado
              final del subproducto, vuelve a editar y
              selecciónala. Ejemplos: "Lateral Armado",
              "Bandeja Terminada" o una gráfica final.
            </p>

            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: 12,
              marginBottom: 14
            }}>
              <strong>Piezas componentes</strong>
              <p style={{
                color: "#64748B",
                fontSize: 13,
                marginTop: 6,
                marginBottom: 0
              }}>
                También puedes dejarlas pendientes y
                agregarlas después de crear las piezas.
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 90px",
                gap: 8,
                marginTop: 10
              }}>
                <select
                  value={componente.pieza_id}
                  onChange={evento =>
                    setComponente(actual => ({
                      ...actual,
                      pieza_id:
                        evento.target.value
                    }))
                  }
                  style={campo}
                >
                  <option value="">
                    Seleccionar pieza
                  </option>
                  {piezasActivas.map(pieza => (
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
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={componente.cantidad}
                  onChange={evento =>
                    setComponente(actual => ({
                      ...actual,
                      cantidad:
                        evento.target.value
                    }))
                  }
                  style={campo}
                />
              </div>
              <button
                type="button"
                onClick={agregarComponente}
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
                Agregar componente
              </button>

              {formulario.componentes.length > 0 && (
                <div style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 12
                }}>
                  {formulario.componentes.map(
                    item => (
                      <div
                        key={item.pieza_id}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 10,
                          border:
                            "1px solid #E2E8F0",
                          borderRadius: 8,
                          padding: 9
                        }}
                      >
                        <span>
                          {item.pieza_codigo}
                          {" - "}
                          {item.pieza_nombre}
                          {" · Cantidad: "}
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            quitarComponente(
                              item.pieza_id
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
              Subproducto activo
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
                  : "Crear subproducto"}
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
              Subproductos registrados (
              {subproductos.length})
            </h2>

            {cargando ? (
              <p>Cargando catálogo...</p>
            ) : subproductos.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Todavía no hay subproductos
                registrados.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10
              }}>
                {subproductos.map(
                  subproducto => {
                    const tieneSalida = Boolean(
                      subproducto.pieza_salida_id
                    );
                    const tieneComponentes =
                      (subproducto.componentes || [])
                        .length > 0;
                    const pendiente =
                      !tieneSalida ||
                      !tieneComponentes;

                    return (
                    <article
                      key={subproducto.id}
                      style={{
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 13,
                        opacity:
                          subproducto.activo
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
                            {subproducto.codigo}
                            {" - "}
                            {subproducto.nombre}
                          </strong>
                          {pendiente && (
                            <span style={{
                              display: "inline-block",
                              marginLeft: 8,
                              padding:
                                "3px 8px",
                              borderRadius: 999,
                              background:
                                "#FEF3C7",
                              color: "#92400E",
                              fontSize: 12,
                              fontWeight: "bold"
                            }}>
                              Pendiente de completar
                            </span>
                          )}
                          <div style={{
                            color: "#475569",
                            fontSize: 14,
                            marginTop: 5
                          }}>
                            Producto:{" "}
                            {
                              subproducto.producto_codigo
                            }
                            {" - "}
                            {
                              subproducto.producto_nombre
                            }
                          </div>
                          <div style={{
                            color: "#475569",
                            fontSize: 14,
                            marginTop: 5
                          }}>
                            Salida:{" "}
                            {tieneSalida
                              ? `${subproducto.pieza_salida_codigo} - ${subproducto.pieza_salida_nombre}`
                              : "pendiente"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            editar(subproducto)
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

                      <div style={{
                        marginTop: 10,
                        display: "grid",
                        gap: 5,
                        color: "#334155",
                        fontSize: 14
                      }}>
                        {tieneComponentes ? (
                          (subproducto.componentes || [])
                            .map(item => (
                              <span key={
                                item.pieza_id
                              }>
                                {item.pieza_codigo}
                                {" - "}
                                {item.pieza_nombre}
                                {" · Cantidad: "}
                                {item.cantidad}
                              </span>
                            ))
                        ) : (
                          <span style={{
                            color: "#64748B"
                          }}>
                            Componentes pendientes.
                          </span>
                        )}
                      </div>
                    </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default CatalogoSubproductosV2;
