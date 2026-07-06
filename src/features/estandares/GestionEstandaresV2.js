import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  listarOperacionesOT,
  listarOrdenesV2
} from "../ordenes/ordenesRepository";
import {
  actualizarEstandarOperacionOT
} from "../ejecucion/ejecucionRepository";
import {
  obtenerResumenEstandar
} from "../resumenes/resumenesRepository";

const campo = {
  width: "100%",
  padding: 11,
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 15
};

const tarjeta = {
  background: "white",
  padding: 20,
  borderRadius: 14,
  boxShadow:
    "0 2px 10px rgba(15,23,42,0.08)"
};

const numero = valor =>
  Number(valor || 0).toLocaleString(
    "es-CL",
    {
      maximumFractionDigits: 2
    }
  );

const diferenciaPct = (sugerido, vigente) => {
  const base = Number(vigente || 0);
  const nuevo = Number(sugerido || 0);

  if (base <= 0 || nuevo <= 0) {
    return null;
  }

  return ((nuevo - base) / base) * 100;
};

function GestionEstandaresV2({
  db,
  perfil,
  onVolver
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] =
    useState(plantas[0] || "");
  const [ordenes, setOrdenes] = useState([]);
  const [ordenId, setOrdenId] = useState("");
  const [operaciones, setOperaciones] = useState([]);
  const [resumenes, setResumenes] = useState({});
  const [edicionId, setEdicionId] = useState("");
  const [formulario, setFormulario] = useState({
    unidades_por_hora: "",
    motivo: ""
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const ordenSeleccionada = useMemo(
    () => ordenes.find(orden => orden.id === ordenId) ||
      null,
    [ordenId, ordenes]
  );

  const cargarOrdenes = useCallback(
    async planta => {
      if (!planta) {
        setOrdenes([]);
        return;
      }

      const datos = await listarOrdenesV2(
        db,
        perfil.empresa_id,
        planta
      );

      setOrdenes(
        datos.filter(orden =>
          !["cerrada", "anulada"].includes(
            orden.estado
          )
        )
      );
    },
    [db, perfil.empresa_id]
  );

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        setError("");
        await cargarOrdenes(plantaId);
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar las OTs."
        );
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, [cargarOrdenes, plantaId]);

  const cargarOperaciones = async otId => {
    setOrdenId(otId);
    setOperaciones([]);
    setResumenes({});
    setEdicionId("");
    setFormulario({
      unidades_por_hora: "",
      motivo: ""
    });
    setError("");
    setMensaje("");

    const orden = ordenes.find(
      item => item.id === otId
    );

    if (!orden) {
      return;
    }

    try {
      setCargando(true);
      const operacionesData =
        await listarOperacionesOT(
          db,
          perfil.empresa_id,
          orden.planta_id,
          orden.id
        );
      const resumenesData =
        await Promise.all(
          operacionesData.map(async operacion => {
            const resumen =
              await obtenerResumenEstandar(
                db,
                orden.id,
                operacion.id
              );

            return [operacion.id, resumen];
          })
        );

      setOperaciones(operacionesData);
      setResumenes(
        Object.fromEntries(resumenesData)
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar los estándares."
      );
    } finally {
      setCargando(false);
    }
  };

  const iniciarEdicion = operacion => {
    setEdicionId(operacion.id);
    setFormulario({
      unidades_por_hora:
        operacion.unidades_por_hora || "",
      motivo: ""
    });
    setError("");
    setMensaje("");
  };

  const guardarEstandar = async operacion => {
    try {
      setGuardando(true);
      setError("");
      const cambio =
        await actualizarEstandarOperacionOT({
          db,
          perfil,
          orden: ordenSeleccionada,
          operacion,
          unidadesPorHora:
            formulario.unidades_por_hora,
          motivo: formulario.motivo
        });

      setOperaciones(actual =>
        actual.map(item =>
          item.id === operacion.id
            ? {
              ...item,
              unidades_por_hora:
                cambio.estandar_nuevo,
              estandar_estado: "vigente"
            }
            : item
        )
      );
      setEdicionId("");
      setFormulario({
        unidades_por_hora: "",
        motivo: ""
      });
      setMensaje(
        `Estándar actualizado de ${cambio.estandar_anterior} a ${cambio.estandar_nuevo} unidades/hora.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo actualizar el estándar."
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
            fontWeight: "bold",
            marginBottom: 12
          }}
        >
          Volver a Operación
        </button>

        <h1 style={{ marginBottom: 4 }}>
          Gestión de Estándares V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Revisa y ajusta unidades por hora por operación
          de OT. Los cambios aplican solo a sesiones nuevas.
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

        <section style={{
          ...tarjeta,
          marginBottom: 18
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 12
          }}>
            <label>
              Planta
              <select
                value={plantaId}
                onChange={evento => {
                  setPlantaId(evento.target.value);
                  setOrdenId("");
                  setOperaciones([]);
                  setResumenes({});
                }}
                style={{
                  ...campo,
                  marginTop: 6
                }}
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
              OT
              <select
                value={ordenId}
                onChange={evento =>
                  cargarOperaciones(
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6
                }}
              >
                <option value="">
                  Seleccionar OT
                </option>
                {ordenes.map(orden => (
                  <option
                    key={orden.id}
                    value={orden.id}
                  >
                    {orden.codigo}
                    {" - "}
                    {orden.producto_codigo}
                    {" · "}
                    {orden.estado}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section style={tarjeta}>
          <h2 style={{ marginTop: 0 }}>
            Estándares por operación
          </h2>

          {cargando ? (
            <p>Cargando...</p>
          ) : !ordenSeleccionada ? (
            <p style={{ color: "#64748B" }}>
              Selecciona una OT para revisar sus
              estándares.
            </p>
          ) : operaciones.length === 0 ? (
            <p style={{ color: "#64748B" }}>
              La OT seleccionada no tiene operaciones.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gap: 12
            }}>
              {operaciones.map(operacion => {
                const resumen =
                  resumenes[operacion.id] || {};
                const vigente = Number(
                  operacion.unidades_por_hora || 0
                );
                const sugerido = Number(
                  resumen.estandar_sugerido || 0
                );
                const diferencia = diferenciaPct(
                  sugerido,
                  vigente
                );
                const editando =
                  edicionId === operacion.id;

                return (
                  <article
                    key={operacion.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: 14,
                      background:
                        vigente > 0
                          ? "white"
                          : "#FFFBEB"
                    }}
                  >
                    <div style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px, 1.4fr) repeat(3, minmax(120px, 0.7fr))",
                      gap: 10,
                      alignItems: "start"
                    }}>
                      <div>
                        <strong>
                          {operacion.operacion_codigo}
                          {" - "}
                          {operacion.operacion_nombre}
                        </strong>
                        <div style={{
                          color: "#64748B",
                          marginTop: 4
                        }}>
                          {operacion.subproceso_id}
                          {operacion.subproceso_nombre
                            ? ` · ${operacion.subproceso_nombre}`
                            : ""}
                        </div>
                      </div>
                      <div>
                        <small>Vigente</small>
                        <div style={{
                          fontWeight: "bold",
                          color:
                            vigente > 0
                              ? "#166534"
                              : "#92400E"
                        }}>
                          {vigente > 0
                            ? `${numero(vigente)} un/h`
                            : "Sin estándar"}
                        </div>
                      </div>
                      <div>
                        <small>Sugerido</small>
                        <div style={{
                          fontWeight: "bold",
                          color:
                            sugerido > 0
                              ? "#0369A1"
                              : "#64748B"
                        }}>
                          {sugerido > 0
                            ? `${numero(sugerido)} un/h`
                            : "Sin sugerencia"}
                        </div>
                      </div>
                      <div>
                        <small>Desviación</small>
                        <div style={{
                          fontWeight: "bold",
                          color:
                            diferencia === null
                              ? "#64748B"
                              : Math.abs(diferencia) >=
                                15
                                ? "#B91C1C"
                                : "#166534"
                        }}>
                          {diferencia === null
                            ? "-"
                            : `${diferencia >= 0 ? "+" : ""}${numero(diferencia)}%`}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      color: "#475569",
                      fontSize: 13,
                      marginTop: 8
                    }}>
                      Mediciones válidas:{" "}
                      {resumen.mediciones_validas || 0}
                      {" · Confianza: "}
                      {resumen.confianza || "sin datos"}
                      {" · Pendiente OT: "}
                      {numero(
                        operacion.cantidad_pendiente
                      )}
                    </div>

                    {(resumen.mediciones_recientes || [])
                      .length > 0 && (
                      <div style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 8
                      }}>
                        {(resumen
                          .mediciones_recientes || [])
                          .slice(-6)
                          .map((medicion, indice) => (
                            <span
                              key={
                                medicion.sesion_id ||
                                indice
                              }
                              style={{
                                padding: "3px 7px",
                                borderRadius: 999,
                                fontSize: 12,
                                background:
                                  medicion
                                    .valida_para_sugerencia
                                    ? "#DCFCE7"
                                    : "#E2E8F0",
                                color:
                                  medicion
                                    .valida_para_sugerencia
                                    ? "#166534"
                                    : "#475569"
                              }}
                            >
                              {numero(
                                medicion
                                  .unidades_ok_hora
                              )}
                              {" OK/h"}
                            </span>
                          ))}
                      </div>
                    )}

                    {editando ? (
                      <div style={{
                        display: "grid",
                        gap: 9,
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 10,
                        background: "#F8FAFC"
                      }}>
                        <label>
                          Nuevo estándar unidades/hora
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={
                              formulario
                                .unidades_por_hora
                            }
                            onChange={evento =>
                              setFormulario(actual => ({
                                ...actual,
                                unidades_por_hora:
                                  evento.target.value
                              }))
                            }
                            style={{
                              ...campo,
                              marginTop: 6
                            }}
                          />
                        </label>
                        <label>
                          Motivo
                          <textarea
                            rows={3}
                            value={formulario.motivo}
                            onChange={evento =>
                              setFormulario(actual => ({
                                ...actual,
                                motivo:
                                  evento.target.value
                              }))
                            }
                            placeholder="Ej: estándar muy bajo frente a mediciones reales, cambio de método o corrección de digitación."
                            style={{
                              ...campo,
                              marginTop: 6
                            }}
                          />
                        </label>
                        <div style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap"
                        }}>
                          {sugerido > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormulario({
                                  unidades_por_hora:
                                    String(sugerido),
                                  motivo:
                                    `Ajuste según sugerencia con ${resumen.mediciones_validas || 0} mediciones válidas y confianza ${resumen.confianza || "sin datos"}.`
                                })
                              }
                              style={{
                                border:
                                  "1px solid #0284C7",
                                borderRadius: 8,
                                padding: "9px 12px",
                                background: "white",
                                color: "#0369A1",
                                fontWeight: "bold"
                              }}
                            >
                              Usar sugerido
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() =>
                              guardarEstandar(
                                operacion
                              )
                            }
                            style={{
                              border: "none",
                              borderRadius: 8,
                              padding: "9px 12px",
                              background: "#166534",
                              color: "white",
                              fontWeight: "bold"
                            }}
                          >
                            {guardando
                              ? "Guardando..."
                              : "Guardar estándar"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEdicionId("")
                            }
                            style={{
                              border:
                                "1px solid #CBD5E1",
                              borderRadius: 8,
                              padding: "9px 12px",
                              background: "white",
                              color: "#334155",
                              fontWeight: "bold"
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          iniciarEdicion(operacion)
                        }
                        style={{
                          marginTop: 10,
                          border: "none",
                          borderRadius: 8,
                          padding: "9px 12px",
                          background: "#1D4ED8",
                          color: "white",
                          fontWeight: "bold"
                        }}
                      >
                        Editar estándar
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default GestionEstandaresV2;
