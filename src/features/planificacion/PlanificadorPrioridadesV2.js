import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  observarOrdenesActivas
} from "../resumenes/resumenesRepository";
import {
  listarCapacidadesProceso
} from "../capacidad/capacidadRepository";
import {
  listarProgramacionSemanal,
  lunesDeSemana
} from "../turnos/turnosRepository";
import {
  construirPlanPrioridades,
  recalcularResumenesPlanificacion
} from "./planificacionRepository";

const riesgoTexto = {
  atrasada: "Atrasada",
  en_riesgo: "En riesgo",
  sin_estandar: "Sin estándar",
  sin_fecha: "Sin fecha",
  en_fecha: "En fecha"
};

const accionTexto = {
  producir_ahora: "Producir ahora",
  desbloquear_dt: "Resolver dependencia o RF",
  definir_estandar: "Definir estándar antes de proyectar"
};

const colorDecision = {
  normal: "#166534",
  accion: "#1D4ED8",
  advertencia: "#92400E",
  riesgo: "#B91C1C"
};

const fondoDecision = {
  normal: "#F0FDF4",
  accion: "#EFF6FF",
  advertencia: "#FFFBEB",
  riesgo: "#FEF2F2"
};

const fechaVisible = valor => {
  if (!valor) {
    return "Sin fecha";
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? "Sin fecha"
    : fecha.toLocaleDateString("es-CL");
};

function PlanificadorPrioridadesV2({
  db,
  perfil,
  onVolver
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] =
    useState(plantas[0] || "");
  const [ordenes, setOrdenes] = useState([]);
  const [capacidades, setCapacidades] =
    useState([]);
  const [programacion, setProgramacion] =
    useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDecision, setCargandoDecision] =
    useState(false);
  const [recalculando, setRecalculando] =
    useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const plan = useMemo(
    () => construirPlanPrioridades(
      ordenes,
      new Date(),
      {
        capacidades,
        programacion,
        plantaId
      }
    ),
    [capacidades, ordenes, plantaId, programacion]
  );
  const ordenesSinCuello = ordenes.filter(
    orden => !orden.cuello_carga
  ).length;

  useEffect(() => {
    if (!plantaId) {
      return undefined;
    }

    setCargando(true);
    setError("");

    return observarOrdenesActivas(
      db,
      perfil.empresa_id,
      plantaId,
      datos => {
        setOrdenes(datos);
        setCargando(false);
      },
      fallo => {
        setError(
          fallo?.message ||
          "No se pudo construir el plan."
        );
        setCargando(false);
      }
    );
  }, [db, perfil.empresa_id, plantaId]);

  useEffect(() => {
    if (!plantaId) {
      return;
    }

    let cancelado = false;
    const cargarDecision = async () => {
      try {
        setCargandoDecision(true);
        const semanaInicio = lunesDeSemana(
          new Date()
        );
        const [
          capacidadesProceso,
          programacionSemanal
        ] = await Promise.all([
          listarCapacidadesProceso(
            db,
            perfil.empresa_id,
            plantaId
          ),
          listarProgramacionSemanal(
            db,
            perfil.empresa_id,
            plantaId,
            semanaInicio
          )
        ]);

        if (!cancelado) {
          setCapacidades(capacidadesProceso);
          setProgramacion(programacionSemanal);
        }
      } catch (fallo) {
        if (!cancelado) {
          setError(
            fallo?.message ||
            "No se pudo cargar capacidad y turnos."
          );
        }
      } finally {
        if (!cancelado) {
          setCargandoDecision(false);
        }
      }
    };

    cargarDecision();

    return () => {
      cancelado = true;
    };
  }, [db, perfil.empresa_id, plantaId]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: 22,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1300,
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
          Volver a Operación
        </button>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 15,
          alignItems: "center",
          flexWrap: "wrap"
        }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>
              Planificador de prioridades V2
            </h1>
            <p style={{
              color: "#475569",
              marginTop: 0
            }}>
              Ordena OTs que compiten por el mismo
              subproceso y sugiere si conviene activar
              3er turno sin modificar la programación.
            </p>
          </div>
          {plantas.length > 1 && (
            <select
              value={plantaId}
              onChange={evento =>
                setPlantaId(evento.target.value)
              }
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #CBD5E1"
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
          )}
          <button
            type="button"
            disabled={
              recalculando ||
              ordenes.length === 0
            }
            onClick={async () => {
              try {
                setRecalculando(true);
                setError("");
                const actualizadas =
                  await recalcularResumenesPlanificacion({
                    db,
                    perfil,
                    plantaId,
                    ordenes
                  });
                setOrdenes(actualizadas);
                setMensaje(
                  `${actualizadas.length} OTs recalculadas para planificación.`
                );
              } catch (fallo) {
                setError(
                  fallo?.message ||
                  "No se pudieron recalcular las OTs."
                );
              } finally {
                setRecalculando(false);
              }
            }}
            style={{
              padding: "10px 14px",
              border: "none",
              borderRadius: 8,
              background: "#0F766E",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            {recalculando
              ? "Recalculando..."
              : "Recalcular OTs activas"}
          </button>
        </div>

        {error && (
          <div role="alert" style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            padding: 12,
            borderRadius: 9,
            marginBottom: 15
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
            marginBottom: 15
          }}>
            {mensaje}
          </div>
        )}
        {ordenesSinCuello > 0 && (
          <div style={{
            background: "#FFFBEB",
            color: "#92400E",
            padding: 12,
            borderRadius: 9,
            marginBottom: 15
          }}>
            {ordenesSinCuello}
            {" OTs antiguas requieren recálculo para "}
            identificar su DT prioritario.
          </div>
        )}
        {cargandoDecision && (
          <div style={{
            background: "#EFF6FF",
            color: "#1D4ED8",
            padding: 12,
            borderRadius: 9,
            marginBottom: 15
          }}>
            Cargando capacidad y turnos para sugerir
            decisiones...
          </div>
        )}

        {cargando ? (
          <p>Cargando prioridades...</p>
        ) : plan.length === 0 ? (
          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14
          }}>
            Las OTs activas aún no tienen su cuello
            recalculado. Se actualizará al crear una OT
            nueva o registrar el siguiente reporte.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gap: 18
          }}>
            {plan.map(grupo => (
              <section
                key={grupo.subproceso_id}
                style={{
                  background: "white",
                  padding: 18,
                  borderRadius: 14,
                  boxShadow:
                    "0 2px 10px rgba(15,23,42,0.08)"
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap"
                }}>
                  <div>
                    <h2 style={{ margin: 0 }}>
                      {grupo.subproceso_id}
                      {grupo.subproceso_nombre
                        ? ` - ${grupo.subproceso_nombre}`
                        : ""}
                    </h2>
                    <div style={{
                      color: "#475569",
                      marginTop: 5
                    }}>
                      {grupo.ots_compitiendo}
                      {" OTs · "}
                      {
                        grupo
                          .cantidad_total_pendiente
                      }
                      {" unidades · "}
                      {grupo.horas_carga_compartida}
                      {" h de carga conocida"}
                    </div>
                  </div>
                  <strong style={{
                    color:
                      grupo.conflicto_capacidad
                        ? "#B91C1C"
                        : "#166534"
                  }}>
                    {grupo.conflicto_capacidad
                      ? "Capacidad compartida"
                      : "Sin conflicto entre OTs"}
                  </strong>
                </div>

                <div style={{
                  display: "grid",
                  gap: 9,
                  marginTop: 14
                }}>
                  {grupo.secuencia.map(orden => (
                    <div
                      key={orden.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "55px minmax(170px, 1fr) minmax(220px, 1.4fr) 130px 150px",
                        gap: 10,
                        alignItems: "center",
                        border: orden.prioridad_plan === 1
                          ? "2px solid #2563EB"
                          : "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 11
                      }}
                    >
                      <strong style={{
                        color: "#2563EB",
                        fontSize: 20
                      }}>
                        {orden.prioridad_plan}
                      </strong>
                      <div>
                        <strong>{orden.codigo}</strong>
                        <div style={{
                          color: "#64748B",
                          marginTop: 3
                        }}>
                          {orden.producto_codigo}
                        </div>
                      </div>
                      <div>
                        <strong>
                          {
                            orden.cuello_carga
                              .operacion_codigo
                          }
                          {" - "}
                          {
                            orden.cuello_carga
                              .operacion_nombre
                          }
                        </strong>
                        <div style={{
                          color: "#64748B",
                          marginTop: 3
                        }}>
                          {
                            orden.cuello_carga
                              .cantidad_pendiente
                          }
                          {" pendientes · "}
                          {accionTexto[
                            orden.accion_recomendada
                          ]}
                        </div>
                      </div>
                      <div>
                        <small>Entrega</small>
                        <div>
                          {fechaVisible(
                            orden
                              .fecha_planificada_entrega
                          )}
                        </div>
                      </div>
                      <strong style={{
                        color:
                          orden.riesgo_entrega ===
                            "atrasada"
                            ? "#B91C1C"
                            : orden.riesgo_entrega ===
                              "en_riesgo"
                              ? "#C2410C"
                              : "#475569"
                      }}>
                        {
                          riesgoTexto[
                            orden.riesgo_entrega
                          ]
                        }
                      </strong>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: "#EFF6FF",
                  color: "#1D4ED8"
                }}>
                  <strong>Siguiente acción:</strong>
                  {" "}
                  {grupo.siguiente_ot.codigo}
                  {" · "}
                  {
                    accionTexto[
                      grupo.siguiente_ot
                        .accion_recomendada
                    ]
                  }
                  .
                </div>

                {grupo.decision_turno && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 10,
                    background:
                      fondoDecision[
                        grupo.decision_turno.severidad
                      ] || "#F8FAFC",
                    color:
                      colorDecision[
                        grupo.decision_turno.severidad
                      ] || "#334155"
                  }}>
                    <strong>
                      Decisión sugerida:{" "}
                      {grupo.decision_turno.titulo}
                    </strong>
                    <div style={{ marginTop: 5 }}>
                      {grupo.decision_turno.detalle}
                    </div>
                    {
                      grupo.decision_turno
                        .horas_base_semana !== undefined &&
                      (
                        <div style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          marginTop: 8,
                          fontSize: 13
                        }}>
                          <span>
                            2 turnos:{" "}
                            {
                              grupo.decision_turno
                                .horas_base_semana
                            }
                            {" h/sem"}
                          </span>
                          <span>
                            3 turnos:{" "}
                            {
                              grupo.decision_turno
                                .horas_3_turnos_semana
                            }
                            {" h/sem"}
                          </span>
                          <span>
                            Estimado 2 turnos:{" "}
                            {
                              grupo.decision_turno
                                .semanas_2_turnos ??
                              "s/d"
                            }
                            {" semanas"}
                          </span>
                          <span>
                            Estimado 3 turnos:{" "}
                            {
                              grupo.decision_turno
                                .semanas_3_turnos ??
                              "s/d"
                            }
                            {" semanas"}
                          </span>
                        </div>
                      )
                    }
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        <p style={{
          textAlign: "center",
          color: "#64748B",
          fontSize: 13
        }}>
          Usa solo los documentos principales de OTs
          activas. Confirma RF, máquina y dotación antes
          de ejecutar el orden sugerido.
        </p>
      </div>
    </div>
  );
}

export default PlanificadorPrioridadesV2;
