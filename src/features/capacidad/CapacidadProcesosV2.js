import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  calcularCapacidadRecursos,
  guardarCapacidadProceso,
  listarCapacidadesProceso,
  validarCapacidadProceso
} from "./capacidadRepository";

const estadoInicial = {
  proceso_id: "",
  proceso_nombre: "",
  subproceso_id: "",
  subproceso_nombre: "",
  maquinas_disponibles: 1,
  operarios_disponibles_turno: 1,
  operarios_por_recurso: 1,
  disponibilidad_pct: 100
};

const campo = {
  width: "100%",
  padding: 11,
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 15
};

function CapacidadProcesosV2({
  db,
  perfil,
  onVolver
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] = useState(
    plantas[0] || ""
  );
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [capacidades, setCapacidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      setCapacidades(
        await listarCapacidadesProceso(
          db,
          perfil.empresa_id,
          plantaId
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar la capacidad."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id, plantaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const calculo = useMemo(
    () => calcularCapacidadRecursos({
      maquinasDisponibles:
        formulario.maquinas_disponibles,
      operariosDisponibles:
        formulario.operarios_disponibles_turno,
      operariosPorRecurso:
        formulario.operarios_por_recurso,
      disponibilidadPct:
        formulario.disponibilidad_pct
    }),
    [formulario]
  );

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const editar = capacidad => {
    setFormulario({
      proceso_id: capacidad.proceso_id || "",
      proceso_nombre:
        capacidad.proceso_nombre || "",
      subproceso_id:
        capacidad.subproceso_id || "",
      subproceso_nombre:
        capacidad.subproceso_nombre || "",
      maquinas_disponibles:
        capacidad.maquinas_disponibles || 1,
      operarios_disponibles_turno:
        capacidad
          .operarios_disponibles_turno || 1,
      operarios_por_recurso:
        capacidad.operarios_por_recurso || 1,
      disponibilidad_pct:
        capacidad.disponibilidad_pct || 100
    });
    setMensaje(
      `Editando ${capacidad.subproceso_id}.`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async evento => {
    evento.preventDefault();
    const datos = {
      ...formulario,
      planta_id: plantaId
    };
    const errores = validarCapacidadProceso(datos);

    if (errores.length > 0) {
      setError(errores.join(" "));
      return;
    }

    try {
      setGuardando(true);
      setError("");
      await guardarCapacidadProceso({
        db,
        perfil,
        plantaId,
        datos
      });
      setFormulario(estadoInicial);
      setMensaje(
        "Capacidad del subproceso guardada."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la capacidad."
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
        maxWidth: 1100,
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
          Capacidad por proceso V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Define recursos paralelos y dotación por
          turno. El estándar representa la producción
          por hora de una máquina, línea o puesto.
        </p>

        <label style={{
          display: "block",
          maxWidth: 300,
          marginBottom: 18,
          fontWeight: "bold"
        }}>
          Planta
          <select
            value={plantaId}
            onChange={evento => {
              setPlantaId(evento.target.value);
              setFormulario(estadoInicial);
            }}
            style={{ ...campo, marginTop: 6 }}
          >
            {plantas.map(planta => (
              <option key={planta} value={planta}>
                {planta.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <div style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            padding: 12,
            borderRadius: 8,
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
            borderRadius: 8,
            marginBottom: 14
          }}>
            {mensaje}
          </div>
        )}

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
                "0 2px 10px rgba(15,23,42,0.08)",
              display: "grid",
              gap: 13
            }}
          >
            <h2 style={{ margin: 0 }}>
              Configurar subproceso
            </h2>
            {[
              ["proceso_id", "Código proceso", "PR0001"],
              [
                "proceso_nombre",
                "Nombre proceso",
                "Corte"
              ],
              [
                "subproceso_id",
                "Código subproceso",
                "SP0003"
              ],
              [
                "subproceso_nombre",
                "Nombre subproceso",
                "Corte láser fibra tubo"
              ]
            ].map(([nombre, etiqueta, ejemplo]) => (
              <label key={nombre}>
                {etiqueta}
                <input
                  value={formulario[nombre]}
                  onChange={evento =>
                    actualizar(
                      nombre,
                      evento.target.value
                    )
                  }
                  placeholder={ejemplo}
                  style={{ ...campo, marginTop: 5 }}
                />
              </label>
            ))}
            {[
              [
                "maquinas_disponibles",
                "Máquinas, líneas o puestos disponibles"
              ],
              [
                "operarios_disponibles_turno",
                "Operarios disponibles por turno"
              ],
              [
                "operarios_por_recurso",
                "Operarios necesarios por recurso"
              ],
              [
                "disponibilidad_pct",
                "Disponibilidad esperada (%)"
              ]
            ].map(([nombre, etiqueta]) => (
              <label key={nombre}>
                {etiqueta}
                <input
                  type="number"
                  min="1"
                  max={
                    nombre === "disponibilidad_pct"
                      ? "100"
                      : undefined
                  }
                  step="1"
                  value={formulario[nombre]}
                  onChange={evento =>
                    actualizar(
                      nombre,
                      evento.target.value
                    )
                  }
                  style={{ ...campo, marginTop: 5 }}
                />
              </label>
            ))}

            <div style={{
              padding: 12,
              borderRadius: 9,
              background: "#EFF6FF",
              color: "#1E3A8A"
            }}>
              Capacidad efectiva:{" "}
              <strong>
                {calculo.recursos_paralelos}
                {" recursos en paralelo × "}
                {calculo.disponibilidad_pct}%
                {" = "}
                {calculo.factor_capacidad.toFixed(2)}
                {" veces el estándar"}
              </strong>
              <div style={{ marginTop: 5 }}>
                Dotación usada por turno:{" "}
                {calculo.operarios_requeridos_turno}
                {" operarios."}
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              style={{
                border: "none",
                borderRadius: 8,
                padding: 12,
                background: "#0F766E",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {guardando
                ? "Guardando..."
                : "Guardar capacidad"}
            </button>
          </form>

          <section style={{
            background: "white",
            padding: 22,
            borderRadius: 14,
            boxShadow:
              "0 2px 10px rgba(15,23,42,0.08)"
          }}>
            <h2 style={{ marginTop: 0 }}>
              Capacidades configuradas
            </h2>
            {cargando ? (
              <p>Cargando...</p>
            ) : capacidades.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Aún no hay subprocesos configurados.
                El simulador usará un recurso al 100%.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10
              }}>
                {capacidades.map(capacidad => (
                  <button
                    key={capacidad.id}
                    type="button"
                    onClick={() => editar(capacidad)}
                    style={{
                      textAlign: "left",
                      border: "1px solid #E2E8F0",
                      borderRadius: 9,
                      padding: 12,
                      background: "white",
                      cursor: "pointer"
                    }}
                  >
                    <strong>
                      {capacidad.subproceso_id}
                      {" - "}
                      {capacidad.subproceso_nombre}
                    </strong>
                    <div style={{
                      color: "#475569",
                      marginTop: 5
                    }}>
                      {capacidad.recursos_paralelos}
                      {" recursos paralelos · "}
                      {
                        capacidad
                          .operarios_requeridos_turno
                      }
                      {" operarios/turno · "}
                      {capacidad.disponibilidad_pct}%
                      {" disponibilidad"}
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

export default CapacidadProcesosV2;
