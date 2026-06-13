import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  TURNOS_PLANTA,
  guardarProgramacionTurno,
  listarProgramacionSemanal,
  lunesDeSemana
} from "./turnosRepository";

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

const formularioInicial = {
  operario_codigo: "",
  operario_nombre: "",
  turno_id: "manana"
};

function ProgramacionTurnosV2({
  db,
  perfil,
  onVolver
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] =
    useState(plantas[0] || "");
  const [semanaInicio, setSemanaInicio] =
    useState(lunesDeSemana());
  const [programacion, setProgramacion] =
    useState([]);
  const [formulario, setFormulario] =
    useState(formularioInicial);
  const [guardando, setGuardando] =
    useState(false);
  const [cargando, setCargando] =
    useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    if (!plantaId || !semanaInicio) {
      setProgramacion([]);
      return;
    }

    try {
      setCargando(true);
      setError("");
      setProgramacion(
        await listarProgramacionSemanal(
          db,
          perfil.empresa_id,
          plantaId,
          semanaInicio
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar la programación."
      );
    } finally {
      setCargando(false);
    }
  }, [
    db,
    perfil.empresa_id,
    plantaId,
    semanaInicio
  ]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cobertura = useMemo(
    () => Object.keys(
      TURNOS_PLANTA[plantaId]?.turnos || {}
    ).map(turnoId => ({
      turno_id: turnoId,
      nombre:
        TURNOS_PLANTA[plantaId]
          .turnos[turnoId].nombre,
      operarios: programacion.filter(
        item => item.turno_id === turnoId
      ).length
    })),
    [plantaId, programacion]
  );
  const horasExtra = programacion.reduce(
    (total, item) =>
      total + Number(item.horas_extra || 0),
    0
  );

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const guardar = async evento => {
    evento.preventDefault();

    try {
      setGuardando(true);
      await guardarProgramacionTurno({
        db,
        perfil,
        plantaId,
        semanaInicio,
        operarioCodigo:
          formulario.operario_codigo,
        operarioNombre:
          formulario.operario_nombre,
        turnoId: formulario.turno_id
      });
      setFormulario(formularioInicial);
      await cargar();
      setMensaje(
        "Turno semanal guardado. Si el operario ya estaba programado, su asignación fue actualizada."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar el turno."
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
        maxWidth: 1200,
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
            fontWeight: "bold"
          }}
        >
          Volver a Ingeniería
        </button>

        <h1 style={{ marginBottom: 4 }}>
          Programación de turnos V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Asigna la rotación semanal y controla
          jornada ordinaria y horas extra.
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
          <form onSubmit={guardar} style={tarjeta}>
            <h2 style={{ marginTop: 0 }}>
              Asignar turno semanal
            </h2>
            <div style={{
              display: "grid",
              gap: 11
            }}>
              <label>
                Planta
                <select
                  value={plantaId}
                  onChange={evento =>
                    setPlantaId(
                      evento.target.value
                    )
                  }
                  style={campo}
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
              <label>
                Semana desde el lunes
                <input
                  type="date"
                  value={semanaInicio}
                  onChange={evento =>
                    setSemanaInicio(
                      lunesDeSemana(
                        `${evento.target.value}T12:00:00`
                      )
                    )
                  }
                  style={campo}
                />
              </label>
              <label>
                Código operario
                <input
                  value={
                    formulario.operario_codigo
                  }
                  onChange={evento =>
                    actualizar(
                      "operario_codigo",
                      evento.target.value
                    )
                  }
                  placeholder="OP0001"
                  style={campo}
                />
              </label>
              <label>
                Nombre operario
                <input
                  value={
                    formulario.operario_nombre
                  }
                  onChange={evento =>
                    actualizar(
                      "operario_nombre",
                      evento.target.value
                    )
                  }
                  style={campo}
                />
              </label>
              <label>
                Turno
                <select
                  value={formulario.turno_id}
                  onChange={evento =>
                    actualizar(
                      "turno_id",
                      evento.target.value
                    )
                  }
                  style={campo}
                >
                  {Object.entries(
                    TURNOS_PLANTA[plantaId]
                      ?.turnos || {}
                  ).map(([id, turno]) => (
                    <option key={id} value={id}>
                      {turno.nombre}
                      {" · "}
                      {turno.horas_efectivas}
                      {" h efectivas"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={guardando}
                style={{
                  ...campo,
                  border: "none",
                  background: "#4338CA",
                  color: "white",
                  fontWeight: "bold"
                }}
              >
                Guardar asignación
              </button>
            </div>
          </form>

          <section style={tarjeta}>
            <h2 style={{ marginTop: 0 }}>
              Cobertura semanal
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(80px, 1fr))",
              gap: 8
            }}>
              {cobertura.map(item => (
                <div
                  key={item.turno_id}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: "#EEF2FF",
                    textAlign: "center"
                  }}
                >
                  <strong>{item.nombre}</strong>
                  <div style={{
                    fontSize: 24,
                    marginTop: 5
                  }}>
                    {item.operarios}
                  </div>
                </div>
              ))}
            </div>
            <p style={{
              color:
                horasExtra > 0
                  ? "#B45309"
                  : "#475569"
            }}>
              Horas extra planificadas:{" "}
              <strong>
                {horasExtra.toFixed(2)}
              </strong>
            </p>

            <h3>Operarios ({programacion.length})</h3>
            {cargando ? (
              <p>Cargando...</p>
            ) : programacion.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                No hay operarios programados para
                esta semana.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 8
              }}>
                {programacion.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      setFormulario({
                        operario_codigo:
                          item.operario_codigo,
                        operario_nombre:
                          item.operario_nombre,
                        turno_id: item.turno_id
                      })
                    }
                    style={{
                      textAlign: "left",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: 10,
                      background: "white",
                      cursor: "pointer"
                    }}
                  >
                    <strong>
                      {item.operario_codigo}
                      {" - "}
                      {item.operario_nombre}
                    </strong>
                    <div style={{
                      color: "#475569",
                      marginTop: 4
                    }}>
                      {item.turno_nombre}
                      {" · "}
                      {item.horas_ordinarias}
                      {" h ordinarias"}
                      {Number(item.horas_extra) > 0
                        ? ` · ${item.horas_extra} h extra`
                        : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProgramacionTurnosV2;
