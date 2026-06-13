import {
  useCallback,
  useEffect,
  useState
} from "react";
import {
  crearCausa,
  crearDefecto,
  listarCausas,
  listarDefectos,
  listarReprocesosPendientes,
  resolverReproceso
} from "./calidadRepository";

const campo = {
  width: "100%",
  padding: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  boxSizing: "border-box"
};

const tarjeta = {
  background: "white",
  padding: 20,
  borderRadius: 14,
  boxShadow:
    "0 2px 10px rgba(15,23,42,0.08)"
};

function CalidadV2({ db, perfil, onVolver }) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] =
    useState(plantas[0] || "");
  const [defectos, setDefectos] = useState([]);
  const [causas, setCausas] = useState([]);
  const [reprocesos, setReprocesos] =
    useState([]);
  const [defecto, setDefecto] = useState({
    codigo: "",
    nombre: "",
    severidad: "leve"
  });
  const [causa, setCausa] = useState({
    codigo: "",
    nombre: ""
  });
  const [resoluciones, setResoluciones] =
    useState({});
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError("");
      const [
        defectosData,
        causasData,
        reprocesosData
      ] = await Promise.all([
        listarDefectos(db, perfil.empresa_id),
        listarCausas(db, perfil.empresa_id),
        plantaId
          ? listarReprocesosPendientes(
            db,
            perfil.empresa_id,
            plantaId
          )
          : []
      ]);
      setDefectos(defectosData);
      setCausas(causasData);
      setReprocesos(reprocesosData);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar Calidad V2."
      );
    }
  }, [db, perfil.empresa_id, plantaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarDefecto = async (evento) => {
    evento.preventDefault();
    try {
      setGuardando(true);
      await crearDefecto(
        db,
        perfil.empresa_id,
        defecto
      );
      setDefecto({
        codigo: "",
        nombre: "",
        severidad: "leve"
      });
      setMensaje("Defecto creado.");
      await cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardarCausa = async (evento) => {
    evento.preventDefault();
    try {
      setGuardando(true);
      await crearCausa(
        db,
        perfil.empresa_id,
        causa
      );
      setCausa({ codigo: "", nombre: "" });
      setMensaje("Causa creada.");
      await cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  const resolver = async (registro) => {
    const valores =
      resoluciones[registro.id] || {};

    try {
      setGuardando(true);
      setError("");
      await resolverReproceso({
        db,
        perfil,
        registro,
        cantidadOk: valores.ok,
        cantidadMerma: valores.merma,
        observacion: valores.observacion
      });
      setMensaje("Reproceso resuelto.");
      await cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  const actualizarResolucion = (
    id,
    nombre,
    valor
  ) => {
    setResoluciones(actual => ({
      ...actual,
      [id]: {
        ...(actual[id] || {}),
        [nombre]: valor
      }
    }));
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
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Volver
        </button>
        <h1>Calidad V2</h1>
        <p style={{ color: "#475569" }}>
          Catálogos de calidad, merma y reprocesos
          pendientes por planta.
        </p>

        {error && (
          <div role="alert" style={{
            padding: 12,
            background: "#FEF2F2",
            color: "#B91C1C",
            borderRadius: 8,
            marginBottom: 14
          }}>
            {error}
          </div>
        )}
        {mensaje && (
          <div style={{
            padding: 12,
            background: "#F0FDF4",
            color: "#166534",
            borderRadius: 8,
            marginBottom: 14
          }}>
            {mensaje}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
          alignItems: "start"
        }}>
          <form
            onSubmit={guardarDefecto}
            style={tarjeta}
          >
            <h2 style={{ marginTop: 0 }}>
              Nuevo defecto
            </h2>
            <input
              value={defecto.codigo}
              onChange={evento =>
                setDefecto(actual => ({
                  ...actual,
                  codigo: evento.target.value
                }))
              }
              placeholder="DEF0001"
              style={{ ...campo, marginBottom: 10 }}
            />
            <input
              value={defecto.nombre}
              onChange={evento =>
                setDefecto(actual => ({
                  ...actual,
                  nombre: evento.target.value
                }))
              }
              placeholder="Nombre del defecto"
              style={{ ...campo, marginBottom: 10 }}
            />
            <select
              value={defecto.severidad}
              onChange={evento =>
                setDefecto(actual => ({
                  ...actual,
                  severidad: evento.target.value
                }))
              }
              style={{ ...campo, marginBottom: 10 }}
            >
              <option value="leve">Leve</option>
              <option value="mayor">Mayor</option>
              <option value="critica">Crítica</option>
            </select>
            <button disabled={guardando}>
              Crear defecto
            </button>
            <p style={{ color: "#64748B" }}>
              {defectos.length} registrados
            </p>
          </form>

          <form
            onSubmit={guardarCausa}
            style={tarjeta}
          >
            <h2 style={{ marginTop: 0 }}>
              Nueva causa
            </h2>
            <input
              value={causa.codigo}
              onChange={evento =>
                setCausa(actual => ({
                  ...actual,
                  codigo: evento.target.value
                }))
              }
              placeholder="CAU0001"
              style={{ ...campo, marginBottom: 10 }}
            />
            <input
              value={causa.nombre}
              onChange={evento =>
                setCausa(actual => ({
                  ...actual,
                  nombre: evento.target.value
                }))
              }
              placeholder="Nombre de la causa"
              style={{ ...campo, marginBottom: 10 }}
            />
            <button disabled={guardando}>
              Crear causa
            </button>
            <p style={{ color: "#64748B" }}>
              {causas.length} registradas
            </p>
          </form>
        </div>

        <section style={{
          ...tarjeta,
          marginTop: 20
        }}>
          <div style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap"
          }}>
            <h2>Reprocesos pendientes</h2>
            <select
              value={plantaId}
              onChange={evento =>
                setPlantaId(evento.target.value)
              }
              style={{ ...campo, width: 220 }}
            >
              {plantas.map(planta => (
                <option key={planta} value={planta}>
                  {planta.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {reprocesos.length === 0 ? (
            <p style={{ color: "#64748B" }}>
              No hay reprocesos pendientes.
            </p>
          ) : reprocesos.map(registro => {
            const valores =
              resoluciones[registro.id] || {};

            return (
              <div key={registro.id} style={{
                borderTop: "1px solid #E2E8F0",
                padding: "16px 0",
                display: "grid",
                gap: 9
              }}>
                <strong>
                  {registro.ot_codigo}
                  {" · "}
                  {registro.operacion_codigo}
                  {" · "}
                  {registro.defecto_codigo}
                </strong>
                <span>
                  Pendiente:{" "}
                  {
                    registro
                      .cantidad_reproceso_pendiente
                  }
                  {" · Causa: "}
                  {registro.causa_nombre}
                </span>
                <div style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 8
                }}>
                  <input
                    type="number"
                    min="0"
                    value={valores.ok || ""}
                    onChange={evento =>
                      actualizarResolucion(
                        registro.id,
                        "ok",
                        evento.target.value
                      )
                    }
                    placeholder="Recuperadas OK"
                    style={campo}
                  />
                  <input
                    type="number"
                    min="0"
                    value={valores.merma || ""}
                    onChange={evento =>
                      actualizarResolucion(
                        registro.id,
                        "merma",
                        evento.target.value
                      )
                    }
                    placeholder="Merma final"
                    style={campo}
                  />
                  <input
                    value={valores.observacion || ""}
                    onChange={evento =>
                      actualizarResolucion(
                        registro.id,
                        "observacion",
                        evento.target.value
                      )
                    }
                    placeholder="Observación"
                    style={campo}
                  />
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => resolver(registro)}
                  >
                    Resolver
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

export default CalidadV2;
