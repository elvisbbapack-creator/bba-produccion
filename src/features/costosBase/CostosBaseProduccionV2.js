import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  aCatalogoProcesosRuta,
  listarProcesosEstaciones
} from "../procesos/procesosRepository";
import {
  calcularCostoBaseEstacion,
  claveCostoEstacion,
  guardarCostoBaseEstacion,
  listarCostosBaseEstacion
} from "./costosBaseRepository";

const campo = {
  width: "100%",
  padding: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 10,
  boxSizing: "border-box"
};

const boton = {
  padding: "11px 14px",
  border: "none",
  borderRadius: 10,
  background: "#1976D2",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

const botonSecundario = {
  ...boton,
  background: "#455A64"
};

const ayudaCampo = {
  color: "#64748B",
  fontSize: 12,
  lineHeight: 1.35,
  marginTop: 4
};

const etiquetaCampo = {
  display: "block",
  fontWeight: "bold",
  color: "#334155",
  marginBottom: 5
};

const CampoConAyuda = ({
  etiqueta,
  ayuda,
  children
}) => (
  <label>
    <span style={etiquetaCampo}>{etiqueta}</span>
    {children}
    <div style={ayudaCampo}>{ayuda}</div>
  </label>
);

const estadoInicial = {
  planta_id: "chile",
  proceso_codigo: "",
  proceso_nombre: "",
  estacion_codigo: "",
  estacion_nombre: "",
  rol_maquinista: "",
  cantidad_maquinistas: 1,
  costo_hora_maquinista: 0,
  cantidad_ayudantes: 0,
  costo_hora_ayudante: 0,
  equipo_nombre: "",
  valor_equipo: 0,
  valor_residual: 0,
  vida_util_horas: 0,
  kw_hora: 0,
  costo_kwh: 0,
  factor_uso_porcentaje: 100,
  mantencion_hora: 0,
  observacion: "",
  activo: true
};

const formatoNumero = valor =>
  Number(valor || 0).toLocaleString("es-CL", {
    maximumFractionDigits: 0
  });

export default function CostosBaseProduccionV2({
  db,
  perfil,
  onVolver
}) {
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [estaciones, setEstaciones] = useState([]);
  const [costos, setCostos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        procesos,
        costosCargados
      ] = await Promise.all([
        listarProcesosEstaciones(
          db,
          perfil.empresa_id
        ),
        listarCostosBaseEstacion(
          db,
          perfil.empresa_id
        )
      ]);
      setEstaciones(aCatalogoProcesosRuta(procesos));
      setCostos(costosCargados);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar costos base."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const calculos = useMemo(
    () => calcularCostoBaseEstacion(formulario),
    [formulario]
  );

  const actualizar = cambios => {
    setFormulario(actual => ({
      ...actual,
      ...cambios
    }));
    setMensaje("");
    setError("");
  };

  const seleccionarEstacion = clave => {
    const estacion = estaciones.find(
      item =>
        `${item.proceso_codigo}__${item.estacion_codigo}` ===
        clave
    );

    actualizar({
      proceso_codigo: estacion?.proceso_codigo || "",
      proceso_nombre: estacion?.proceso_nombre || "",
      estacion_codigo: estacion?.estacion_codigo || "",
      estacion_nombre: estacion?.estacion_nombre || ""
    });
  };

  const editar = costo => {
    setFormulario({
      ...estadoInicial,
      ...costo
    });
    setMensaje("");
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const limpiar = () => {
    setFormulario(estadoInicial);
    setMensaje("");
    setError("");
  };

  const guardar = async () => {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await guardarCostoBaseEstacion(
        db,
        perfil,
        formulario
      );
      await cargar();
      setMensaje("Costo base guardado.");
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar costo base."
      );
    } finally {
      setGuardando(false);
    }
  };

  const claveActual = claveCostoEstacion(formulario);

  return (
    <div style={{
      padding: 20,
      maxWidth: 1180,
      margin: "0 auto"
    }}>
      <BotonVolver
        onClick={onVolver}
        style={{ marginBottom: 12 }}
      >
        Volver
      </BotonVolver>

      <h2>Costos Base de Producción</h2>
      <p style={{
        color: "#475569",
        lineHeight: 1.5
      }}>
        Configura el costo hora realista por estación:
        maquinista, ayudantes, depreciación del equipo,
        energía y mantención. El cotizador usará este
        valor al seleccionar la estación.
      </p>

      {error && (
        <div role="alert" style={{
          background: "#FFEBEE",
          color: "#B71C1C",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
          fontWeight: "bold"
        }}>
          {error}
        </div>
      )}
      {mensaje && (
        <div role="status" style={{
          background: "#E8F5E9",
          color: "#1B5E20",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
          fontWeight: "bold"
        }}>
          {mensaje}
        </div>
      )}

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>Estación y mano de obra</h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          <CampoConAyuda
            etiqueta="Proceso / estación"
            ayuda="Selecciona estación del catálogo de procesos."
          >
            <select
              style={campo}
              value={claveActual}
              onChange={e =>
                seleccionarEstacion(e.target.value)
              }
            >
              <option value="">Seleccionar estación</option>
              {estaciones.map(estacion => (
                <option
                  key={`${estacion.proceso_codigo}__${estacion.estacion_codigo}`}
                  value={`${estacion.proceso_codigo}__${estacion.estacion_codigo}`}
                >
                  {estacion.proceso_nombre} /{" "}
                  {estacion.estacion_nombre}
                </option>
              ))}
            </select>
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Rol maquinista"
            ayuda="Cargo principal. Ej: Maquinista laser."
          >
            <input
              style={campo}
              value={formulario.rol_maquinista}
              onChange={e =>
                actualizar({
                  rol_maquinista: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Cantidad maquinistas"
            ayuda="Normalmente 1 por estación."
          >
            <input
              style={campo}
              type="number"
              value={formulario.cantidad_maquinistas}
              onChange={e =>
                actualizar({
                  cantidad_maquinistas: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Costo hora maquinista"
            ayuda="Costo empresa por hora del rol principal."
          >
            <input
              style={campo}
              type="number"
              value={formulario.costo_hora_maquinista}
              onChange={e =>
                actualizar({
                  costo_hora_maquinista: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Cantidad ayudantes"
            ayuda="Cuántos ayudantes requiere la estación."
          >
            <input
              style={campo}
              type="number"
              value={formulario.cantidad_ayudantes}
              onChange={e =>
                actualizar({
                  cantidad_ayudantes: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Costo hora ayudante"
            ayuda="Costo empresa por hora de cada ayudante."
          >
            <input
              style={campo}
              type="number"
              value={formulario.costo_hora_ayudante}
              onChange={e =>
                actualizar({
                  costo_hora_ayudante: e.target.value
                })
              }
            />
          </CampoConAyuda>
        </div>
      </section>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>Equipo, depreciación y energía</h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          {[
            ["Equipo", "equipo_nombre", "Máquina usada en la estación."],
            ["Valor equipo", "valor_equipo", "Valor de compra o reposición."],
            ["Valor residual", "valor_residual", "Valor estimado al final de vida útil."],
            ["Vida útil horas", "vida_util_horas", "Horas productivas de vida útil."],
            ["KW/h", "kw_hora", "Consumo eléctrico promedio por hora."],
            ["Costo kWh", "costo_kwh", "Tarifa eléctrica usada para costeo."],
            ["Factor uso %", "factor_uso_porcentaje", "Porcentaje de uso real de la potencia. Ej: 70."],
            ["Mantención hora", "mantencion_hora", "Costo estimado de mantención por hora."]
          ].map(([etiqueta, clave, ayuda]) => (
            <CampoConAyuda
              key={clave}
              etiqueta={etiqueta}
              ayuda={ayuda}
            >
              <input
                style={campo}
                type={
                  clave === "equipo_nombre"
                    ? "text"
                    : "number"
                }
                value={formulario[clave]}
                onChange={e =>
                  actualizar({
                    [clave]: e.target.value
                  })
                }
              />
            </CampoConAyuda>
          ))}
        </div>
        <textarea
          style={{
            ...campo,
            minHeight: 70,
            marginTop: 12
          }}
          placeholder="Observación"
          value={formulario.observacion}
          onChange={e =>
            actualizar({
              observacion: e.target.value
            })
          }
        />
      </section>

      <section style={{
        background: "#EFF6FF",
        padding: 18,
        borderRadius: 14,
        marginBottom: 18
      }}>
        <h3>Costo hora calculado</h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12
        }}>
          {[
            ["Maquinista", calculos.costo_laboral_principal],
            ["Ayudantes", calculos.costo_ayudantes],
            ["Depreciación", calculos.depreciacion_hora],
            ["Energía", calculos.energia_hora],
            ["Mantención", calculos.mantencion_hora],
            ["Total hora", calculos.costo_hora_total]
          ].map(([titulo, valor]) => (
            <div
              key={titulo}
              style={{
                background: "white",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #BFDBFE"
              }}
            >
              <b>{titulo}</b>
              <div style={{
                fontSize: 22,
                color: "#1976D2",
                marginTop: 6
              }}>
                {formatoNumero(valor)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 20
      }}>
        <button
          style={boton}
          disabled={guardando}
          onClick={guardar}
        >
          {guardando ? "Guardando..." : "Guardar costo base"}
        </button>
        <button
          style={botonSecundario}
          onClick={limpiar}
        >
          Nuevo
        </button>
      </div>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)"
      }}>
        <h3>Costos configurados</h3>
        {cargando && <div>Cargando...</div>}
        {costos.map(costo => (
          <div
            key={costo.id}
            style={{
              borderBottom: "1px solid #E2E8F0",
              padding: "12px 0"
            }}
          >
            <b>
              {costo.proceso_nombre} /{" "}
              {costo.estacion_nombre}
            </b>
            <div>
              Costo hora total:{" "}
              <b>{formatoNumero(costo.costo_hora_total)}</b>
            </div>
            <div style={{ color: "#475569" }}>
              Maquinista {formatoNumero(costo.costo_laboral_principal)} / ayudantes{" "}
              {formatoNumero(costo.costo_ayudantes)} / depreciación{" "}
              {formatoNumero(costo.depreciacion_hora)} / energía{" "}
              {formatoNumero(costo.energia_hora)}
            </div>
            <button
              style={{
                ...boton,
                padding: "8px 10px",
                marginTop: 8
              }}
              onClick={() => editar(costo)}
            >
              Editar
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
