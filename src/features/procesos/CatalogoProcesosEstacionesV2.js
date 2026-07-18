import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  actualizarProceso,
  guardarProceso,
  listarProcesosEstaciones,
  prepararProceso,
  siguienteCodigoEstacion,
  siguienteCodigoProceso,
  validarProceso
} from "./procesosRepository";

const estadoInicial = {
  codigo: "",
  nombre: "",
  estaciones: [],
  activo: true
};

const estacionInicial = {
  codigo: "",
  nombre: "",
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

function CatalogoProcesosEstacionesV2({
  db,
  perfil,
  onVolver
}) {
  const [procesos, setProcesos] =
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

  const vistaProceso = useMemo(
    () => prepararProceso(
      formulario,
      perfil.empresa_id,
      editandoId || "vista-proceso"
    ),
    [
      editandoId,
      formulario,
      perfil.empresa_id
    ]
  );

  const erroresFormulario = useMemo(
    () => validarProceso(
      vistaProceso,
      procesos
    ),
    [procesos, vistaProceso]
  );

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      setProcesos(
        await listarProcesosEstaciones(
          db,
          perfil.empresa_id
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar el catálogo de procesos."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crearEstacionInicial = useCallback(
    (estacionesExtra = []) => ({
      ...estacionInicial,
      codigo: siguienteCodigoEstacion(
        procesos,
        estacionesExtra
      )
    }),
    [procesos]
  );

  useEffect(() => {
    if (editandoId) {
      return;
    }

    const siguienteCodigo =
      siguienteCodigoProceso(procesos);

    setFormulario(actual => {
      const estaciones =
        actual.estaciones.length > 0
          ? actual.estaciones
          : [crearEstacionInicial()];

      return {
        ...actual,
        codigo: siguienteCodigo,
        estaciones: estaciones.map(
          (estacion, indice) =>
            estacion.codigo
              ? estacion
              : {
                  ...estacion,
                  codigo: siguienteCodigoEstacion(
                    procesos,
                    estaciones.slice(0, indice)
                  )
                }
        )
      };
    });
  }, [
    crearEstacionInicial,
    editandoId,
    procesos
  ]);

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const estacionesFormulario =
    formulario.estaciones.length > 0
      ? formulario.estaciones
      : [crearEstacionInicial()];

  const actualizarEstacion = (
    indice,
    nombre,
    valor
  ) => {
    setFormulario(actual => {
      const lista =
        actual.estaciones.length > 0
          ? [...actual.estaciones]
          : [crearEstacionInicial()];

      lista[indice] = {
        ...lista[indice],
        [nombre]: nombre === "activo"
          ? valor === "true"
          : valor
      };

      return {
        ...actual,
        estaciones: lista
      };
    });
    setError("");
    setMensaje("");
  };

  const agregarEstacion = () => {
    setFormulario(actual => ({
      ...actual,
      estaciones: [
        ...(actual.estaciones.length > 0
          ? actual.estaciones
          : [crearEstacionInicial()]),
        crearEstacionInicial(
          actual.estaciones.length > 0
            ? actual.estaciones
            : [crearEstacionInicial()]
        )
      ]
    }));
    setError("");
    setMensaje("");
  };

  const quitarEstacion = indice => {
    setFormulario(actual => ({
      ...actual,
      estaciones: (
        actual.estaciones.length > 0
          ? actual.estaciones
          : [crearEstacionInicial()]
      ).filter((_, posicion) =>
        posicion !== indice
      )
    }));
    setError("");
    setMensaje("");
  };

  const limpiarFormulario = () => {
    setFormulario({
      ...estadoInicial,
      codigo: siguienteCodigoProceso(procesos),
      estaciones: [crearEstacionInicial()]
    });
    setEditandoId("");
    setError("");
    setMensaje("");
  };

  const editar = proceso => {
    setEditandoId(proceso.id);
    setFormulario({
      codigo: proceso.codigo,
      nombre: proceso.nombre,
      estaciones: proceso.estaciones || [],
      activo: proceso.activo !== false
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
      if (editandoId) {
        await actualizarProceso(
          db,
          perfil.empresa_id,
          editandoId,
          formulario,
          procesos
        );
        setMensaje("Proceso actualizado.");
      } else {
        await guardarProceso(
          db,
          perfil.empresa_id,
          formulario,
          procesos
        );
        setMensaje("Proceso creado.");
      }
      limpiarFormulario();
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar el proceso."
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
        maxWidth: 1180,
        margin: "0 auto",
        display: "grid",
        gap: 18
      }}>
        <button
          onClick={onVolver}
          style={{
            width: "fit-content",
            padding: "9px 13px",
            borderRadius: 8,
            border: "1px solid #CBD5E1",
            background: "white",
            cursor: "pointer"
          }}
        >
          Volver
        </button>

        <section style={{
          background: "white",
          padding: 20,
          borderRadius: 14,
          boxShadow:
            "0 2px 10px rgba(15,23,42,0.08)"
        }}>
          <h1 style={{ marginTop: 0 }}>
            Catálogo de Procesos y Estaciones
          </h1>
          <p style={{ color: "#64748B" }}>
            Crea procesos productivos y sus estaciones
            de trabajo. Las estaciones usan código ET,
            por ejemplo ET0001.
          </p>

          <form onSubmit={guardar}>
            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12
            }}>
              <label>
                Código proceso
                <input
                  value={formulario.codigo}
                  disabled
                  placeholder="PR0001"
                  style={{
                    ...campo,
                    background: "#F8FAFC"
                  }}
                />
                <small style={{
                  display: "block",
                  color: "#64748B",
                  marginTop: 5
                }}>
                  Código automático según el siguiente
                  correlativo disponible.
                </small>
              </label>
              <label>
                Nombre proceso
                <input
                  value={formulario.nombre}
                  onChange={evento =>
                    actualizar(
                      "nombre",
                      evento.target.value
                    )
                  }
                  placeholder="Corte"
                  style={campo}
                />
              </label>
              <label>
                Estado
                <select
                  value={
                    formulario.activo
                      ? "true"
                      : "false"
                  }
                  onChange={evento =>
                    actualizar(
                      "activo",
                      evento.target.value === "true"
                    )
                  }
                  style={campo}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
            </div>

            <div style={{
              marginTop: 16,
              display: "grid",
              gap: 10
            }}>
              <strong>Estaciones de trabajo</strong>
              {estacionesFormulario.map(
                (estacion, indice) => (
                  <div
                    key={indice}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "130px 1fr 120px 42px",
                      gap: 8,
                      alignItems: "end"
                    }}
                  >
                    <label>
                      Código
                      <input
                        value={estacion.codigo}
                        placeholder="ET0001"
                        disabled
                        style={{
                          ...campo,
                          background: "#F8FAFC"
                        }}
                      />
                      <small style={{
                        display: "block",
                        color: "#64748B",
                        marginTop: 5
                      }}>
                        Automático
                      </small>
                    </label>
                    <label>
                      Nombre estación
                      <input
                        value={estacion.nombre}
                        onChange={evento =>
                          actualizarEstacion(
                            indice,
                            "nombre",
                            evento.target.value
                          )
                        }
                        placeholder="Laser fibra tubo"
                        style={campo}
                      />
                    </label>
                    <label>
                      Estado
                      <select
                        value={
                          estacion.activo !== false
                            ? "true"
                            : "false"
                        }
                        onChange={evento =>
                          actualizarEstacion(
                            indice,
                            "activo",
                            evento.target.value
                          )
                        }
                        style={campo}
                      >
                        <option value="true">
                          Activa
                        </option>
                        <option value="false">
                          Inactiva
                        </option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        quitarEstacion(indice)
                      }
                      style={{
                        ...campo,
                        color: "#B91C1C",
                        background: "white",
                        cursor: "pointer"
                      }}
                    >
                      -
                    </button>
                  </div>
                )
              )}
              <button
                type="button"
                onClick={agregarEstacion}
                style={{
                  ...campo,
                  width: "fit-content",
                  background: "#EFF6FF",
                  color: "#1D4ED8",
                  cursor: "pointer"
                }}
              >
                + Agregar estación
              </button>
            </div>

            {error && (
              <div role="alert" style={{
                marginTop: 12,
                color: "#B91C1C"
              }}>
                {error}
              </div>
            )}
            {mensaje && (
              <div style={{
                marginTop: 12,
                color: "#15803D"
              }}>
                {mensaje}
              </div>
            )}
            <div style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
              flexWrap: "wrap"
            }}>
              <button
                type="submit"
                disabled={guardando}
                style={{
                  ...campo,
                  width: "fit-content",
                  border: "none",
                  background: "#2563EB",
                  color: "white",
                  fontWeight: "bold",
                  cursor: guardando
                    ? "wait"
                    : "pointer"
                }}
              >
                {editandoId
                  ? "Actualizar proceso"
                  : "Crear proceso"}
              </button>
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  style={{
                    ...campo,
                    width: "fit-content",
                    cursor: "pointer"
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </section>

        <section style={{
          background: "white",
          padding: 20,
          borderRadius: 14
        }}>
          <h2 style={{ marginTop: 0 }}>
            Procesos ({procesos.length})
          </h2>
          {cargando ? (
            <p>Cargando...</p>
          ) : procesos.length === 0 ? (
            <p style={{ color: "#64748B" }}>
              Todavía no hay procesos creados.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gap: 10
            }}>
              {procesos.map(proceso => (
                <article
                  key={proceso.id}
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: 12
                  }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12
                  }}>
                    <strong>
                      {proceso.codigo}
                      {" - "}
                      {proceso.nombre}
                    </strong>
                    <button
                      type="button"
                      onClick={() => editar(proceso)}
                      style={{
                        border: "1px solid #CBD5E1",
                        borderRadius: 8,
                        background: "white",
                        padding: "6px 10px",
                        cursor: "pointer"
                      }}
                    >
                      Editar
                    </button>
                  </div>
                  <div style={{
                    marginTop: 8,
                    display: "grid",
                    gap: 4,
                    color: "#475569"
                  }}>
                    {(proceso.estaciones || [])
                      .length === 0 ? (
                      <span>Sin estaciones.</span>
                    ) : (
                      (proceso.estaciones || []).map(
                        estacion => (
                          <span key={estacion.codigo}>
                            {estacion.codigo}
                            {" - "}
                            {estacion.nombre}
                            {estacion.activo === false
                              ? " (inactiva)"
                              : ""}
                          </span>
                        )
                      )
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default CatalogoProcesosEstacionesV2;
