import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  listarMateriales
} from "../materiales/materialesRepository";
import {
  listarProductos
} from "../productos/productosRepository";
import {
  actualizarPieza,
  guardarPieza,
  listarPiezas,
  prepararPieza,
  validarPieza
} from "./piezasRepository";

const estadoInicial = {
  codigo: "",
  producto_id: "",
  producto_codigo: "",
  producto_nombre: "",
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

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

function CatalogoPiezasV2({
  db,
  perfil,
  onVolver
}) {
  const [piezas, setPiezas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiales, setMateriales] =
    useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
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

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [piezasData, materialesData, productosData] =
        await Promise.all([
          listarPiezas(db, perfil.empresa_id),
          listarMateriales(
            db,
            perfil.empresa_id
          ),
          listarProductos(
            db,
            perfil.empresa_id
          )
        ]);
      setPiezas(piezasData);
      setMateriales(materialesData);
      setProductos(productosData);
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
      producto_codigo: producto?.codigo || "",
      producto_nombre: producto?.nombre || ""
    }));
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
    setFormulario(estadoInicial);
    setEditandoId("");
    setError("");
  };

  const editar = pieza => {
    setEditandoId(pieza.id);
    setFormulario({
      codigo: pieza.codigo,
      producto_id: pieza.producto_id || "",
      producto_codigo:
        pieza.producto_codigo || "",
      producto_nombre:
        pieza.producto_nombre || "",
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

    if (!formulario.producto_id) {
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
        <button
          type="button"
          onClick={onVolver}
          style={{
            border: "none",
            background: "transparent",
            color: "#1D4ED8",
            cursor: "pointer",
            fontWeight: "bold",
            marginBottom: 12
          }}
        >
          Volver a Ingeniería
        </button>

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
                  .filter(producto => producto.activo !== false)
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

            <label>
              Código pieza
              <input
                value={formulario.codigo}
                onChange={evento =>
                  actualizar(
                    "codigo",
                    evento.target.value
                  )
                }
                placeholder="PZ0001"
                disabled={Boolean(editandoId)}
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14,
                  background: editandoId
                    ? "#F8FAFC"
                    : "white"
                }}
              />
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
                esta pieza.
              </p>

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
              Piezas registradas ({piezas.length})
            </h2>

            {cargando ? (
              <p>Cargando catálogo...</p>
            ) : piezas.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Todavía no hay piezas registradas.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10
              }}>
                {piezas.map(pieza => {
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
                            {pieza.producto_codigo
                              ? `Producto: ${pieza.producto_codigo} - ${pieza.producto_nombre} · `
                              : "Producto: sin asociar · "}
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
