import {
  useCallback,
  useEffect,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  crearMotivoParo,
  listarMotivosParo
} from "./parosRepository";

const inicial = {
  codigo: "",
  nombre: "",
  categoria: "operacional",
  afecta_eficiencia: true
};

const campo = {
  width: "100%",
  padding: 11,
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  boxSizing: "border-box",
  marginBottom: 12
};

function ParosV2({ db, perfil, onVolver }) {
  const [motivos, setMotivos] = useState([]);
  const [formulario, setFormulario] =
    useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setMotivos(
        await listarMotivosParo(
          db,
          perfil.empresa_id
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar los motivos."
      );
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

  const guardar = async (evento) => {
    evento.preventDefault();

    try {
      setGuardando(true);
      await crearMotivoParo(
        db,
        perfil.empresa_id,
        formulario
      );
      setFormulario(inicial);
      setMensaje("Motivo de paro creado.");
      await cargar();
    } catch (fallo) {
      setError(fallo.message);
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
        maxWidth: 1000,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver
        </BotonVolver>
        <h1>Motivos de paro</h1>
        <p style={{ color: "#475569" }}>
          Catálogo común para Chile y Perú. Cada
          pausa conservará motivo, duración y sesión.
        </p>

        {error && (
          <div role="alert" style={{
            padding: 12,
            borderRadius: 8,
            background: "#FEF2F2",
            color: "#B91C1C",
            marginBottom: 14
          }}>
            {error}
          </div>
        )}
        {mensaje && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: "#F0FDF4",
            color: "#166534",
            marginBottom: 14
          }}>
            {mensaje}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          alignItems: "start"
        }}>
          <form
            onSubmit={guardar}
            style={{
              background: "white",
              padding: 20,
              borderRadius: 14
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Nuevo motivo
            </h2>
            <input
              value={formulario.codigo}
              onChange={evento =>
                actualizar(
                  "codigo",
                  evento.target.value
                )
              }
              placeholder="PAR0001"
              style={campo}
            />
            <input
              value={formulario.nombre}
              onChange={evento =>
                actualizar(
                  "nombre",
                  evento.target.value
                )
              }
              placeholder="Ej. Falta de material"
              style={campo}
            />
            <select
              value={formulario.categoria}
              onChange={evento =>
                actualizar(
                  "categoria",
                  evento.target.value
                )
              }
              style={campo}
            >
              <option value="operacional">
                Operacional
              </option>
              <option value="maquina">Máquina</option>
              <option value="material">Material</option>
              <option value="calidad">Calidad</option>
              <option value="planificacion">
                Planificación
              </option>
              <option value="seguridad">
                Seguridad
              </option>
            </select>
            <label style={{
              display: "flex",
              gap: 8,
              marginBottom: 14
            }}>
              <input
                type="checkbox"
                checked={
                  formulario.afecta_eficiencia
                }
                onChange={evento =>
                  actualizar(
                    "afecta_eficiencia",
                    evento.target.checked
                  )
                }
              />
              Descontar este paro del tiempo productivo
            </label>
            <button disabled={guardando}>
              Crear motivo
            </button>
          </form>

          <section style={{
            background: "white",
            padding: 20,
            borderRadius: 14
          }}>
            <h2 style={{ marginTop: 0 }}>
              Motivos ({motivos.length})
            </h2>
            {motivos.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Aún no hay motivos registrados.
              </p>
            ) : motivos.map(motivo => (
              <div key={motivo.id} style={{
                padding: "12px 0",
                borderBottom:
                  "1px solid #E2E8F0"
              }}>
                <strong>
                  {motivo.codigo}
                  {" - "}
                  {motivo.nombre}
                </strong>
                <div style={{
                  color: "#64748B",
                  marginTop: 4
                }}>
                  {motivo.categoria}
                  {" · "}
                  {motivo.afecta_eficiencia
                    ? "descuenta tiempo"
                    : "paro planificado"}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

export default ParosV2;
