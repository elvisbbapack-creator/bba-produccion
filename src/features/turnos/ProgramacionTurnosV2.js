import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  TURNOS_PLANTA,
  construirMatrizCobertura,
  guardarProgramacionTurno,
  listarProgramacionSemanal,
  lunesDeSemana,
  normalizarSubprocesosHabilitados
} from "./turnosRepository";
import {
  listarCapacidadesProceso
} from "../capacidad/capacidadRepository";

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
  turno_id: "manana",
  subprocesos_habilitados: ""
};

function ProgramacionTurnosV2({
  db,
  perfil,
  onVolver,
  textoVolver = "Volver a Ingeniería",
  contextoInicial = null
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] =
    useState(plantas[0] || "");
  const [semanaInicio, setSemanaInicio] =
    useState(lunesDeSemana());
  const [programacion, setProgramacion] =
    useState([]);
  const [subprocesos, setSubprocesos] =
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
      const [
        programacionData,
        subprocesosData
      ] = await Promise.all([
        listarProgramacionSemanal(
          db,
          perfil.empresa_id,
          plantaId,
          semanaInicio
        ),
        listarCapacidadesProceso(
          db,
          perfil.empresa_id,
          plantaId
        )
      ]);
      setProgramacion(programacionData);
      setSubprocesos(subprocesosData);
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

  useEffect(() => {
    if (!contextoInicial) {
      return;
    }

    const plantaContexto =
      contextoInicial.planta_id || plantas[0] || "";
    const turnoContexto =
      contextoInicial.turno_id || "manana";
    const subprocesoContexto =
      normalizarSubprocesosHabilitados([
        contextoInicial.subproceso_id
      ])[0] || "";

    if (plantaContexto) {
      setPlantaId(plantaContexto);
    }

    setSemanaInicio(lunesDeSemana());
    setFormulario(actual => ({
      ...actual,
      turno_id: turnoContexto,
      subprocesos_habilitados:
        subprocesoContexto ||
        actual.subprocesos_habilitados
    }));
    setMensaje(
      subprocesoContexto
        ? `${subprocesoContexto} preparado para programar dotación.`
        : "Contexto cargado desde el planificador."
    );
  }, [contextoInicial]);

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
  const subprocesosSeleccionados = useMemo(
    () => normalizarSubprocesosHabilitados(
      formulario.subprocesos_habilitados
    ),
    [formulario.subprocesos_habilitados]
  );
  const matrizCobertura = useMemo(
    () => construirMatrizCobertura(
      subprocesos,
      programacion
    ),
    [programacion, subprocesos]
  );

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const alternarSubproceso = codigo => {
    const normalizados = new Set(
      subprocesosSeleccionados
    );

    if (normalizados.has(codigo)) {
      normalizados.delete(codigo);
    } else {
      normalizados.add(codigo);
    }

    actualizar(
      "subprocesos_habilitados",
      [...normalizados].sort().join(", ")
    );
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
        turnoId: formulario.turno_id,
        subprocesosHabilitados:
          formulario.subprocesos_habilitados
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
          {textoVolver}
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
        {contextoInicial && (
          <div style={{
            background: "#EEF2FF",
            color: "#3730A3",
            padding: 12,
            borderRadius: 9,
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <span>
              Estás programando dotación solicitada por
              el planificador. Al terminar, vuelve para
              revisar si el cuello sigue activo.
            </span>
            <button
              type="button"
              onClick={onVolver}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 11px",
                background: "#4338CA",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Revisar decisión en el Planificador
            </button>
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
              <fieldset style={{
                border: "1px solid #CBD5E1",
                borderRadius: 8,
                padding: 10
              }}>
                <legend>
                  Subprocesos habilitados
                </legend>
                {subprocesos.length > 0 ? (
                  <div style={{
                    display: "grid",
                    gap: 8
                  }}>
                    {subprocesos.map(subproceso => (
                      <label
                        key={subproceso.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            subprocesosSeleccionados
                              .includes(
                                subproceso
                                  .subproceso_id
                              )
                          }
                          onChange={() =>
                            alternarSubproceso(
                              subproceso
                                .subproceso_id
                            )
                          }
                        />
                        <span>
                          <strong>
                            {
                              subproceso
                                .subproceso_id
                            }
                          </strong>
                          {" - "}
                          {
                            subproceso
                              .subproceso_nombre
                          }
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <input
                      value={
                        formulario
                          .subprocesos_habilitados
                      }
                      onChange={evento =>
                        actualizar(
                          "subprocesos_habilitados",
                          evento.target.value
                        )
                      }
                      placeholder="SP0001, SP0003"
                      style={campo}
                    />
                    <small style={{
                      display: "block",
                      color: "#B45309",
                      marginTop: 5
                    }}>
                      Configura primero Capacidad por
                      Proceso para habilitar el selector.
                    </small>
                  </>
                )}
              </fieldset>
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
                        turno_id: item.turno_id,
                        subprocesos_habilitados:
                          (
                            item
                              .subprocesos_habilitados ||
                            []
                          ).join(", ")
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
                    <div style={{
                      color: "#0369A1",
                      marginTop: 4,
                      fontSize: 13
                    }}>
                      Habilitado:{" "}
                      {(
                        item.subprocesos_habilitados ||
                        []
                      ).join(", ") ||
                        "sin competencias registradas"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <section style={{
          ...tarjeta,
          marginTop: 20,
          overflowX: "auto"
        }}>
          <h2 style={{ marginTop: 0 }}>
            Matriz de cobertura calificada
          </h2>
          <p style={{ color: "#64748B" }}>
            Permite detectar subprocesos sin cobertura
            antes de liberar o ampliar turnos.
          </p>
          {matrizCobertura.length === 0 ? (
            <p style={{ color: "#B45309" }}>
              No hay capacidades por proceso configuradas
              para esta planta.
            </p>
          ) : (
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 620
            }}>
              <thead>
                <tr>
                  {[
                    "Subproceso",
                    "Mañana",
                    "Tarde",
                    "Noche",
                    "Estado"
                  ].map(titulo => (
                    <th
                      key={titulo}
                      style={{
                        padding: 9,
                        textAlign: "left",
                        borderBottom:
                          "2px solid #CBD5E1"
                      }}
                    >
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrizCobertura.map(item => {
                  const completa =
                    item.cobertura_base_suficiente;
                  const brechasBase = [
                    item.faltantes_manana > 0
                      ? `${item.faltantes_manana} mañana`
                      : "",
                    item.faltantes_tarde > 0
                      ? `${item.faltantes_tarde} tarde`
                      : ""
                  ].filter(Boolean).join(" · ");

                  return (
                    <tr key={item.subproceso_id}>
                      <td style={{
                        padding: 9,
                        borderBottom:
                          "1px solid #E2E8F0"
                      }}>
                        <strong>
                          {item.subproceso_id}
                        </strong>
                        {" - "}
                        {item.subproceso_nombre}
                      </td>
                      {[
                        item.manana,
                        item.tarde,
                        item.noche
                      ].map((cantidad, indice) => (
                        <td
                          key={indice}
                          style={{
                            padding: 9,
                            borderBottom:
                              "1px solid #E2E8F0",
                            color: cantidad >=
                              item
                                .operarios_requeridos_turno
                              ? "#166534"
                              : "#B91C1C",
                            fontWeight: "bold"
                          }}
                        >
                          {cantidad}
                          {" / "}
                          {
                            item
                              .operarios_requeridos_turno
                          }
                        </td>
                      ))}
                      <td style={{
                        padding: 9,
                        borderBottom:
                          "1px solid #E2E8F0",
                        color: completa
                          ? "#166534"
                          : "#B91C1C",
                        fontWeight: "bold"
                      }}>
                        {item.estado_datos !== "validada"
                          ? "Capacidad provisional"
                          : completa
                            ? "Base cubierta"
                            : `Faltan ${brechasBase}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default ProgramacionTurnosV2;
