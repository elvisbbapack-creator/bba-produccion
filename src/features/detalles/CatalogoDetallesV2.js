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
  actualizarDetalle,
  guardarDetalle,
  listarDetalles,
  prepararDetalle,
  validarDetalle
} from "./detallesRepository";

const estadoInicial = {
  codigo: "",
  nombre: "",
  medida: "",
  material_entrada_id: "",
  material_salida_id: "",
  activo: true
};

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

function CatalogoDetallesV2({
  db,
  perfil,
  onVolver
}) {
  const [detalles, setDetalles] = useState([]);
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
  const salidasRf = materialesActivos.filter(
    material => material.tipo === "RF"
  );

  const vistaDetalle = useMemo(
    () => prepararDetalle(
      formulario,
      perfil.empresa_id,
      editandoId || "vista-detalle"
    ),
    [
      editandoId,
      formulario,
      perfil.empresa_id
    ]
  );

  const erroresFormulario = useMemo(
    () => validarDetalle(
      vistaDetalle,
      detalles
    ),
    [detalles, vistaDetalle]
  );

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [detallesData, materialesData] =
        await Promise.all([
          listarDetalles(
            db,
            perfil.empresa_id
          ),
          listarMateriales(
            db,
            perfil.empresa_id
          )
        ]);
      setDetalles(detallesData);
      setMateriales(materialesData);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar el catálogo DT."
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

  const limpiarFormulario = () => {
    setFormulario(estadoInicial);
    setEditandoId("");
    setError("");
    setMensaje("");
  };

  const editar = detalle => {
    setEditandoId(detalle.id);
    setFormulario({
      codigo: detalle.codigo,
      nombre: detalle.nombre,
      medida: detalle.medida,
      material_entrada_id:
        detalle.material_entrada_id || "",
      material_salida_id:
        detalle.material_salida_id || "",
      activo: detalle.activo !== false
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
      let mensajeExito = "DT creado.";
      if (editandoId) {
        await actualizarDetalle(
          db,
          perfil.empresa_id,
          editandoId,
          formulario,
          detalles
        );
        mensajeExito = "DT actualizado.";
      } else {
        await guardarDetalle(
          db,
          perfil.empresa_id,
          formulario,
          detalles
        );
      }
      limpiarFormulario();
      setMensaje(mensajeExito);
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar el DT."
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
          Catálogo DT
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Crea y corrige detalles reutilizables
          para construir rutas sin reescribir
          nombre, medida ni material.
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
                ? "Editar DT"
                : "Nuevo DT"}
            </h2>

            <label>
              Código detalle
              <input
                value={formulario.codigo}
                onChange={evento =>
                  actualizar(
                    "codigo",
                    evento.target.value
                  )
                }
                placeholder="DT0001"
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

            <label>
              Material entrada
              <select
                value={
                  formulario.material_entrada_id
                }
                onChange={evento =>
                  actualizar(
                    "material_entrada_id",
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
                  Seleccionar material
                </option>
                {materialesActivos.map(material => (
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
              DT activo
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
                  : "Crear DT"}
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
              DT registrados ({detalles.length})
            </h2>

            {cargando ? (
              <p>Cargando catálogo...</p>
            ) : detalles.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Todavía no hay DT registrados.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10
              }}>
                {detalles.map(detalle => {
                  const entrada = materialPorId(
                    detalle.material_entrada_id
                  );
                  const salida = materialPorId(
                    detalle.material_salida_id
                  );

                  return (
                    <article
                      key={detalle.id}
                      style={{
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 13,
                        opacity: detalle.activo
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
                            {detalle.codigo}
                            {" - "}
                            {detalle.nombre}
                          </strong>
                          <div style={{
                            color: "#475569",
                            fontSize: 14,
                            marginTop: 5
                          }}>
                            Medida:{" "}
                            {detalle.medida}
                            {" · Entrada: "}
                            {entrada?.codigo || "?"}
                            {salida
                              ? ` · Salida: ${salida.codigo}`
                              : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            editar(detalle)
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
