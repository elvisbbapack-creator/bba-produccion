import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  observarOrdenesActivas
} from "../resumenes/resumenesRepository";
import {
  listarOperacionesOT
} from "../ordenes/ordenesRepository";
import {
  listarCapacidadesProceso
} from "../capacidad/capacidadRepository";
import {
  listarProgramacionSemanal,
  lunesDeSemana
} from "../turnos/turnosRepository";
import {
  calcularCuadraturaAlmacenOT,
  listarMovimientosAlmacenOT,
  listarStockMateriales
} from "../almacen/almacenRepository";
import {
  filtrarPlanPrioridades,
  construirPlanPrioridades,
  construirDetalleOperacionesPlanificador,
  construirResumenPlanificador,
  registrarDecisionPlanificador,
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

const decisionesJefe = [
  {
    id: "mantener_2_turnos",
    texto: "Mantener 2 turnos"
  },
  {
    id: "activar_3_turno",
    texto: "Activar 3er turno"
  },
  {
    id: "programar_dotacion",
    texto: "Programar dotación"
  },
  {
    id: "revisar_capacidad",
    texto: "Revisar capacidad"
  }
];

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

const colorCapacidad = {
  validada: "#166534",
  provisional: "#92400E",
  faltante: "#B91C1C"
};

const fondoCapacidad = {
  validada: "#F0FDF4",
  provisional: "#FFFBEB",
  faltante: "#FEF2F2"
};

const tarjetaResumen = {
  background: "white",
  borderRadius: 12,
  padding: 14,
  boxShadow: "0 2px 8px rgba(15,23,42,0.07)",
  border: "1px solid transparent",
  textAlign: "left"
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

const fechaDesdeDias = dias => {
  if (!Number.isFinite(Number(dias))) {
    return "Sin estimación";
  }

  const fecha = new Date();
  fecha.setDate(fecha.getDate() + Number(dias));

  return fecha.toLocaleDateString("es-CL");
};

const etiquetaDotacion = decision => {
  if (!decision?.dotacion) {
    return "";
  }

  const { dotacion, turnos } = decision;

  return [
    `${turnos.manana}: ${dotacion.manana}/${dotacion.requerida_por_turno}`,
    `${turnos.tarde}: ${dotacion.tarde}/${dotacion.requerida_por_turno}`,
    `${turnos.noche}: ${dotacion.noche}/${dotacion.requerida_por_turno}`
  ].join(" · ");
};

const estiloTarjetaFiltro = (activo, color) => ({
  ...tarjetaResumen,
  cursor: "pointer",
  border: activo
    ? `2px solid ${color}`
    : tarjetaResumen.border,
  transform: activo ? "translateY(-1px)" : "none"
});

const estiloEscenarioTurno = destacado => ({
  flex: "1 1 230px",
  borderRadius: 10,
  padding: 12,
  background: destacado ? "#EFF6FF" : "white",
  border: destacado
    ? "2px solid #1D4ED8"
    : "1px solid rgba(100,116,139,0.28)",
  color: "#334155"
});

function PlanificadorPrioridadesV2({
  db,
  perfil,
  contextoRetorno = null,
  onContextoRetornoConsumido,
  onVolver,
  onConfigurarCapacidad,
  onProgramarTurnos
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] =
    useState(plantas[0] || "");
  const [ordenes, setOrdenes] = useState([]);
  const [capacidades, setCapacidades] =
    useState([]);
  const [programacion, setProgramacion] =
    useState([]);
  const [stocksMateriales, setStocksMateriales] =
    useState([]);
  const [semanaInicio, setSemanaInicio] =
    useState(lunesDeSemana());
  const [cargando, setCargando] = useState(true);
  const [cargandoDecision, setCargandoDecision] =
    useState(false);
  const [recalculando, setRecalculando] =
    useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [filtroActivo, setFiltroActivo] =
    useState("todo");
  const [
    comentariosDecision,
    setComentariosDecision
  ] = useState({});
  const [
    guardandoDecision,
    setGuardandoDecision
  ] = useState("");
  const [
    avisoRetorno,
    setAvisoRetorno
  ] = useState(null);
  const [
    detallesOperaciones,
    setDetallesOperaciones
  ] = useState({});
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
  const resumenPlan = useMemo(
    () => construirResumenPlanificador(plan),
    [plan]
  );
  const planFiltrado = useMemo(
    () => filtrarPlanPrioridades(
      plan,
      filtroActivo
    ),
    [filtroActivo, plan]
  );
  const ordenesSinCuello = ordenes.filter(
    orden => !orden.cuello_carga
  ).length;

  useEffect(() => {
    if (!contextoRetorno) {
      return;
    }

    if (contextoRetorno.origen === "turnos") {
      setAvisoRetorno({
        tipo: "turnos",
        titulo:
          "Dotación actualizada desde Programación de Turnos",
        detalle:
          `Recalcula el plan para confirmar si la brecha de ${contextoRetorno.subproceso_id || "este subproceso"} desapareció en la semana ${contextoRetorno.semana_inicio || semanaInicio}.`
      });
    }

    onContextoRetornoConsumido?.();
  }, [
    contextoRetorno,
    onContextoRetornoConsumido,
    semanaInicio
  ]);

  const cargarDetalleOrden = async (
    orden,
    grupo = null
  ) => {
    if (!orden?.id) {
      return;
    }

    const detalleActual =
      detallesOperaciones[orden.id];

    if (detalleActual?.abierto) {
      setDetallesOperaciones(actual => ({
        ...actual,
        [orden.id]: {
          ...detalleActual,
          abierto: false
        }
      }));
      return;
    }

    if (detalleActual?.resumen) {
      setDetallesOperaciones(actual => ({
        ...actual,
        [orden.id]: {
          ...detalleActual,
          abierto: true
        }
      }));
      return;
    }

    setDetallesOperaciones(actual => ({
      ...actual,
      [orden.id]: {
        abierto: true,
        cargando: true,
        error: "",
        resumen: null
      }
    }));

    try {
      const [
        operaciones,
        movimientosAlmacen
      ] = await Promise.all([
        listarOperacionesOT(
          db,
          perfil.empresa_id,
          orden.planta_id || plantaId,
          orden.id
        ),
        listarMovimientosAlmacenOT(
          db,
          perfil.empresa_id,
          orden.planta_id || plantaId,
          orden.codigo
        )
      ]);
      const resumen =
        construirDetalleOperacionesPlanificador(
          operaciones,
          orden.cuello_carga,
          {
            decisionTurno:
              grupo?.decision_turno || null
          }
        );
      const cuadraturaAlmacen =
        calcularCuadraturaAlmacenOT({
          operaciones,
          stocks: stocksMateriales,
          movimientos: movimientosAlmacen
        });

      setDetallesOperaciones(actual => ({
        ...actual,
        [orden.id]: {
          abierto: true,
          cargando: false,
          error: "",
          resumen,
          cuadraturaAlmacen
        }
      }));
    } catch (fallo) {
      setDetallesOperaciones(actual => ({
        ...actual,
        [orden.id]: {
          abierto: true,
          cargando: false,
          error:
            fallo?.message ||
            "No se pudo cargar el detalle de DTs.",
          resumen: null
        }
      }));
    }
  };

  const registrarDecision = async (
    grupo,
    decisionTomada
  ) => {
    const clave = `${grupo.subproceso_id}:${decisionTomada}`;

    try {
      setGuardandoDecision(clave);
      setError("");
      await registrarDecisionPlanificador({
        db,
        perfil,
        plantaId,
        grupo,
        semanaInicio,
        decisionTomada,
        comentario:
          comentariosDecision[
            grupo.subproceso_id
          ] || ""
      });
      setMensaje(
        `Decisión registrada para ${grupo.subproceso_id}.`
      );
      setComentariosDecision(actual => ({
        ...actual,
        [grupo.subproceso_id]: ""
      }));
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar la decisión."
      );
    } finally {
      setGuardandoDecision("");
    }
  };

  const recalcularOrdenesActivas = async () => {
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
      setAvisoRetorno(null);
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
  };

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
        const semanaActual = lunesDeSemana(
          new Date()
        );
        setSemanaInicio(semanaActual);
        const [
          capacidadesProceso,
          programacionSemanal,
          stockPlanta
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
            semanaActual
          ),
          listarStockMateriales(
            db,
            perfil.empresa_id,
            plantaId
          )
        ]);

        if (!cancelado) {
          setCapacidades(capacidadesProceso);
          setProgramacion(programacionSemanal);
          setStocksMateriales(stockPlanta);
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
              onChange={evento => {
                setPlantaId(evento.target.value);
                setDetallesOperaciones({});
                setStocksMateriales([]);
              }}
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
            onClick={recalcularOrdenesActivas}
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
        {avisoRetorno && (
          <div style={{
            background: "#EEF2FF",
            color: "#3730A3",
            padding: 12,
            borderRadius: 9,
            marginBottom: 15,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <div>
              <strong>{avisoRetorno.titulo}</strong>
              <div style={{ marginTop: 4 }}>
                {avisoRetorno.detalle}
              </div>
            </div>
            <button
              type="button"
              disabled={
                recalculando ||
                ordenes.length === 0
              }
              onClick={recalcularOrdenesActivas}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "9px 12px",
                background: "#4338CA",
                color: "white",
                fontWeight: "bold",
                cursor: recalculando
                  ? "wait"
                  : "pointer"
              }}
            >
              {recalculando
                ? "Recalculando..."
                : "Recalcular ahora"}
            </button>
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
            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12
            }}>
              <button
                type="button"
                onClick={() => setFiltroActivo("todo")}
                style={estiloTarjetaFiltro(
                  filtroActivo === "todo",
                  "#334155"
                )}
              >
                <small style={{ color: "#64748B" }}>
                  Subprocesos con carga
                </small>
                <strong style={{
                  display: "block",
                  fontSize: 24,
                  marginTop: 4
                }}>
                  {resumenPlan.subprocesos_total}
                </strong>
                <div style={{
                  color: "#475569",
                  fontSize: 13,
                  marginTop: 3
                }}>
                  {resumenPlan.ots_compitiendo_total}
                  {" OTs · "}
                  {resumenPlan.horas_carga_total}
                  {" h"}
                </div>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFiltroActivo(
                    "capacidad_faltante"
                  )
                }
                style={estiloTarjetaFiltro(
                  filtroActivo ===
                    "capacidad_faltante",
                  "#B91C1C"
                )}
              >
                <small style={{ color: "#64748B" }}>
                  Capacidad faltante
                </small>
                <strong style={{
                  display: "block",
                  color: "#B91C1C",
                  fontSize: 24,
                  marginTop: 4
                }}>
                  {resumenPlan.capacidad_faltante}
                </strong>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFiltroActivo(
                    "capacidad_provisional"
                  )
                }
                style={estiloTarjetaFiltro(
                  filtroActivo ===
                    "capacidad_provisional",
                  "#92400E"
                )}
              >
                <small style={{ color: "#64748B" }}>
                  Capacidad provisional
                </small>
                <strong style={{
                  display: "block",
                  color: "#92400E",
                  fontSize: 24,
                  marginTop: 4
                }}>
                  {resumenPlan.capacidad_provisional}
                </strong>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFiltroActivo("capacidad_validada")
                }
                style={estiloTarjetaFiltro(
                  filtroActivo ===
                    "capacidad_validada",
                  "#166534"
                )}
              >
                <small style={{ color: "#64748B" }}>
                  Capacidad validada
                </small>
                <strong style={{
                  display: "block",
                  color: "#166534",
                  fontSize: 24,
                  marginTop: 4
                }}>
                  {resumenPlan.capacidad_validada}
                </strong>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFiltroActivo("accionables")
                }
                style={estiloTarjetaFiltro(
                  filtroActivo === "accionables",
                  "#1D4ED8"
                )}
              >
                <small style={{ color: "#64748B" }}>
                  Recomendaciones accionables
                </small>
                <strong style={{
                  display: "block",
                  color: "#1D4ED8",
                  fontSize: 24,
                  marginTop: 4
                }}>
                  {
                    resumenPlan
                      .recomendaciones_accionables
                  }
                </strong>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFiltroActivo(
                    "bloqueados_dotacion"
                  )
                }
                style={estiloTarjetaFiltro(
                  filtroActivo ===
                    "bloqueados_dotacion",
                  "#B91C1C"
                )}
              >
                <small style={{ color: "#64748B" }}>
                  Bloqueados por dotación
                </small>
                <strong style={{
                  display: "block",
                  color: "#B91C1C",
                  fontSize: 24,
                  marginTop: 4
                }}>
                  {resumenPlan.bloqueados_dotacion}
                </strong>
              </button>
            </div>

            {filtroActivo !== "todo" && (
              <div style={{
                background: "#F8FAFC",
                color: "#334155",
                padding: 12,
                borderRadius: 9,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap"
              }}>
                <strong>
                  Mostrando {planFiltrado.length} de{" "}
                  {plan.length} subprocesos.
                </strong>
                <button
                  type="button"
                  onClick={() => setFiltroActivo("todo")}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 11px",
                    background: "#334155",
                    color: "white",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  Ver todo
                </button>
              </div>
            )}

            {resumenPlan.bloqueados_capacidad > 0 && (
              <div style={{
                background: "#FFFBEB",
                color: "#92400E",
                padding: 12,
                borderRadius: 9
              }}>
                <strong>
                  {
                    resumenPlan
                      .bloqueados_capacidad
                  }
                  {" subprocesos no pueden recomendar turnos por capacidad faltante o provisional."}
                </strong>
                {" Prioriza validar esos datos antes de activar horas extra o 3er turno."}
              </div>
            )}

            {planFiltrado.length === 0 ? (
              <div style={{
                background: "white",
                padding: 18,
                borderRadius: 14,
                color: "#475569"
              }}>
                No hay subprocesos para este filtro.
              </div>
            ) : planFiltrado.map(grupo => (
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
                  {grupo.secuencia.map(orden => {
                    const detalleOrden =
                      detallesOperaciones[
                        orden.id
                      ] || {};

                    return (
                      <div
                        key={orden.id}
                        style={{
                          border:
                            orden.prioridad_plan === 1
                              ? "2px solid #2563EB"
                              : "1px solid #E2E8F0",
                          borderRadius: 10,
                          padding: 11
                        }}
                      >
                        <div style={{
                          display: "grid",
                          gridTemplateColumns:
                            "55px minmax(170px, 1fr) minmax(220px, 1.4fr) 130px 150px 145px",
                          gap: 10,
                          alignItems: "center"
                        }}>
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
                          <button
                            type="button"
                            onClick={() =>
                              cargarDetalleOrden(
                                orden,
                                grupo
                              )
                            }
                            style={{
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 10px",
                              background:
                                detalleOrden.abierto
                                  ? "#334155"
                                  : "#EFF6FF",
                              color:
                                detalleOrden.abierto
                                  ? "white"
                                  : "#1D4ED8",
                              cursor: "pointer",
                              fontWeight: "bold"
                            }}
                          >
                            {detalleOrden.abierto
                              ? "Ocultar DTs"
                              : "Ver DTs pendientes"}
                          </button>
                        </div>

                        {detalleOrden.abierto && (
                          <div style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 10,
                            background: "#F8FAFC",
                            border:
                              "1px solid #E2E8F0"
                          }}>
                            {detalleOrden.cargando ? (
                              <div style={{
                                color: "#475569"
                              }}>
                                Cargando DTs pendientes...
                              </div>
                            ) : detalleOrden.error ? (
                              <div style={{
                                color: "#B91C1C"
                              }}>
                                {detalleOrden.error}
                              </div>
                            ) : detalleOrden.resumen
                              ?.detalle?.length > 0 ? (
                              <>
                                <div style={{
                                  display: "flex",
                                  gap: 12,
                                  flexWrap: "wrap",
                                  marginBottom: 10,
                                  color: "#334155"
                                }}>
                                  <strong>
                                    {
                                      detalleOrden
                                        .resumen
                                        .total_dt_pendientes
                                    }
                                    {" DTs pendientes"}
                                  </strong>
                                  <span>
                                    {
                                      detalleOrden
                                        .resumen
                                        .unidades_pendientes_total
                                    }
                                    {" unidades"}
                                  </span>
                                  <span>
                                    {
                                      detalleOrden
                                        .resumen
                                        .horas_carga_total
                                    }
                                    {" h conocidas"}
                                  </span>
                                  {detalleOrden.resumen
                                    .pendientes_estandar >
                                    0 && (
                                    <span style={{
                                      color: "#92400E",
                                      fontWeight: "bold"
                                    }}>
                                      {
                                        detalleOrden
                                          .resumen
                                          .pendientes_estandar
                                      }
                                      {" sin estándar"}
                                    </span>
                                  )}
                                </div>
                                {detalleOrden
                                  .cuadraturaAlmacen && (
                                  <div style={{
                                    padding: 10,
                                    borderRadius: 8,
                                    marginBottom: 10,
                                    border:
                                      detalleOrden
                                        .cuadraturaAlmacen
                                        .estado_general ===
                                      "bloqueada_por_mp"
                                        ? "1px solid #FCA5A5"
                                        : detalleOrden
                                          .cuadraturaAlmacen
                                          .estado_general ===
                                          "rf_en_flujo"
                                          ? "1px solid #FCD34D"
                                          : detalleOrden
                                            .cuadraturaAlmacen
                                            .estado_general ===
                                            "cuadrada"
                                            ? "1px solid #BBF7D0"
                                            : "1px solid #CBD5E1",
                                    background:
                                      detalleOrden
                                        .cuadraturaAlmacen
                                        .estado_general ===
                                      "bloqueada_por_mp"
                                        ? "#FEF2F2"
                                        : detalleOrden
                                          .cuadraturaAlmacen
                                          .estado_general ===
                                          "rf_en_flujo"
                                          ? "#FFFBEB"
                                          : detalleOrden
                                            .cuadraturaAlmacen
                                            .estado_general ===
                                            "cuadrada"
                                            ? "#F0FDF4"
                                            : "white"
                                  }}>
                                    <strong>
                                      {detalleOrden
                                        .cuadraturaAlmacen
                                        .estado_general ===
                                      "bloqueada_por_mp"
                                        ? "Almacén: falta MP"
                                        : detalleOrden
                                          .cuadraturaAlmacen
                                          .estado_general ===
                                          "rf_en_flujo"
                                          ? "Almacén: RF en flujo"
                                          : detalleOrden
                                            .cuadraturaAlmacen
                                            .estado_general ===
                                            "cuadrada"
                                            ? "Almacén: OT cuadrada"
                                            : "Almacén: sin materiales para validar"}
                                    </strong>
                                    <div style={{
                                      color: "#475569",
                                      marginTop: 4
                                    }}>
                                      MP pendientes:{" "}
                                      {
                                        detalleOrden
                                          .cuadraturaAlmacen
                                          .totales
                                          .mp_pendientes
                                      }
                                      {"/"}
                                      {
                                        detalleOrden
                                          .cuadraturaAlmacen
                                          .totales
                                          .mp_total
                                      }
                                      {" · RF pendientes: "}
                                      {
                                        detalleOrden
                                          .cuadraturaAlmacen
                                          .totales
                                          .rf_pendientes
                                      }
                                      {"/"}
                                      {
                                        detalleOrden
                                          .cuadraturaAlmacen
                                          .totales
                                          .rf_total
                                      }
                                    </div>
                                    <div style={{
                                      color: "#334155",
                                      marginTop: 4
                                    }}>
                                      {
                                        detalleOrden
                                          .cuadraturaAlmacen
                                          .recomendacion
                                      }
                                    </div>
                                  </div>
                                )}
                                <div style={{
                                  display: "grid",
                                  gap: 7
                                }}>
                                  {detalleOrden.resumen
                                    .detalle.map(
                                      operacion => (
                                        <div
                                          key={
                                            operacion.id ||
                                            operacion
                                              .operacion_codigo
                                          }
                                          style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                              "110px minmax(170px, 1fr) 115px 105px 105px minmax(180px, 1fr)",
                                            gap: 8,
                                            alignItems:
                                              "center",
                                            padding:
                                              "8px 9px",
                                            borderRadius: 8,
                                            background:
                                              operacion
                                                .es_cuello
                                                ? "#EFF6FF"
                                                : "white",
                                            border:
                                              operacion
                                                .es_cuello
                                                ? "1px solid #BFDBFE"
                                                : "1px solid #E2E8F0",
                                            color: "#334155",
                                            fontSize: 13
                                          }}
                                        >
                                          <strong>
                                            {
                                              operacion
                                                .operacion_codigo
                                            }
                                          </strong>
                                          <div>
                                            {
                                              operacion
                                                .operacion_nombre
                                            }
                                            <div style={{
                                              color: "#64748B",
                                              marginTop: 2
                                            }}>
                                              {
                                                operacion
                                                  .subproceso_id
                                              }
                                              {
                                                operacion
                                                  .subproceso_nombre
                                                  ? ` · ${operacion.subproceso_nombre}`
                                                  : ""
                                              }
                                            </div>
                                          </div>
                                          <span>
                                            Pendiente:{" "}
                                            <strong>
                                              {
                                                operacion
                                                  .cantidad_pendiente
                                              }
                                            </strong>
                                          </span>
                                          <span>
                                            OK:{" "}
                                            {
                                              operacion
                                                .cantidad_ok
                                            }
                                            /
                                            {
                                              operacion
                                                .cantidad_requerida
                                            }
                                          </span>
                                          <span>
                                            {operacion
                                              .pendiente_estandar
                                              ? "Sin estándar"
                                              : `${operacion.horas_restantes} h`}
                                          </span>
                                          <div>
                                            <strong style={{
                                              color:
                                                operacion
                                                  .recomendacion
                                                  ?.severidad ===
                                                  "riesgo"
                                                  ? "#B91C1C"
                                                  : operacion
                                                    .recomendacion
                                                    ?.severidad ===
                                                    "advertencia"
                                                    ? "#92400E"
                                                    : operacion
                                                      .recomendacion
                                                      ?.severidad ===
                                                      "accion"
                                                      ? "#1D4ED8"
                                                      : "#166534"
                                            }}>
                                              {
                                                operacion
                                                  .recomendacion
                                                  ?.titulo
                                              }
                                            </strong>
                                            <div style={{
                                              color: "#64748B",
                                              marginTop: 2
                                            }}>
                                              {operacion.es_cuello
                                                ? "Cuello · "
                                                : ""}
                                              {
                                                operacion
                                                  .recomendacion
                                                  ?.detalle
                                              }
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    )}
                                </div>
                              </>
                            ) : (
                              <div style={{
                                color: "#166534"
                              }}>
                                Esta OT no tiene DTs
                                pendientes.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {grupo.capacidad_estado && (
                  <div style={{
                    marginTop: 12,
                    padding: 10,
                    borderRadius: 8,
                    background:
                      fondoCapacidad[
                        grupo.capacidad_estado.estado
                      ] || "#F8FAFC",
                    color:
                      colorCapacidad[
                        grupo.capacidad_estado.estado
                      ] || "#334155"
                  }}>
                    <strong>
                      {grupo.capacidad_estado.titulo}
                    </strong>
                    <div style={{ marginTop: 4 }}>
                      {grupo.capacidad_estado.detalle}
                    </div>
                    {grupo.capacidad_estado.estado !==
                      "faltante" && (
                      <div style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 6,
                        fontSize: 13
                      }}>
                        <span>
                          Recursos:{" "}
                          {
                            grupo.capacidad_estado
                              .recursos_paralelos
                          }
                        </span>
                        <span>
                          Dotación estación:{" "}
                          {
                            grupo.capacidad_estado
                              .dotacion_estacion
                          }
                        </span>
                        <span>
                          Factor:{" "}
                          {
                            grupo.capacidad_estado
                              .factor_capacidad
                          }
                        </span>
                        <span>
                          Operarios/turno:{" "}
                          {
                            grupo.capacidad_estado
                              .operarios_requeridos_turno
                          }
                        </span>
                        <span>
                          Disponibilidad:{" "}
                          {
                            grupo.capacidad_estado
                              .disponibilidad_pct
                          }
                          %
                        </span>
                      </div>
                    )}
                  </div>
                )}

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
                    {grupo.decision_turno
                      .accion_operativa && (
                      <div style={{
                        marginTop: 8,
                        padding: 9,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.7)"
                      }}>
                        <strong>Acción recomendada:</strong>
                        {" "}
                        {
                          grupo.decision_turno
                            .accion_operativa
                        }
                      </div>
                    )}
                    {grupo.decision_turno
                      .reasignaciones_sugeridas
                      ?.length > 0 && (
                      <div style={{
                        marginTop: 8,
                        padding: 9,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.78)",
                        color: "#334155"
                      }}>
                        <strong>
                          Candidatos para cubrir brecha:
                        </strong>
                        <div style={{
                          display: "grid",
                          gap: 6,
                          marginTop: 7
                        }}>
                          {grupo.decision_turno
                            .reasignaciones_sugeridas
                            .map(sugerencia => (
                              <div
                                key={[
                                  sugerencia.operario_codigo,
                                  sugerencia.turno_origen,
                                  sugerencia.turno_destino
                                ].join(":")}
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  fontSize: 13
                                }}
                              >
                                <strong>
                                  {
                                    sugerencia
                                      .operario_codigo
                                  }
                                  {sugerencia
                                    .operario_nombre
                                    ? ` - ${sugerencia.operario_nombre}`
                                    : ""}
                                </strong>
                                <span>
                                  mover de{" "}
                                  {
                                    sugerencia
                                      .turno_origen_nombre
                                  }
                                  {" a "}
                                  {
                                    sugerencia
                                      .turno_destino_nombre
                                  }
                                </span>
                              </div>
                            ))}
                        </div>
                        <div style={{
                          marginTop: 7,
                          color: "#64748B",
                          fontSize: 12
                        }}>
                          Sugerencia informativa: valida
                          disponibilidad real antes de
                          cambiar la rotación.
                        </div>
                      </div>
                    )}
                    {
                      grupo.decision_turno
                        .horas_base_semana !== undefined &&
                      (
                        <div style={{ marginTop: 10 }}>
                          <div style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap"
                          }}>
                            <div style={estiloEscenarioTurno(false)}>
                              <strong>
                                Escenario actual:{" "}
                                {
                                  grupo.decision_turno
                                    .escenarios?.base
                                    ?.titulo || "2 turnos"
                                }
                              </strong>
                              <div style={{
                                marginTop: 6,
                                fontSize: 13
                              }}>
                                Capacidad:{" "}
                                {
                                  grupo.decision_turno
                                    .horas_base_semana
                                }
                                {" h/sem"}
                              </div>
                              <div style={{ fontSize: 13 }}>
                                Termina en:{" "}
                                {
                                  grupo.decision_turno
                                    .dias_estimados_2_turnos ??
                                  "s/d"
                                }
                                {" dias · "}
                                {fechaDesdeDias(
                                  grupo.decision_turno
                                    .dias_estimados_2_turnos
                                )}
                              </div>
                              <div style={{ fontSize: 13 }}>
                                Falta semanal:{" "}
                                {
                                  grupo.decision_turno
                                    .horas_faltantes_2_turnos
                                }
                                {" h"}
                              </div>
                            </div>

                            <div style={estiloEscenarioTurno(true)}>
                              <strong>
                                Escenario ampliado:{" "}
                                {
                                  grupo.decision_turno
                                    .escenarios?.ampliado
                                    ?.titulo || "3 turnos"
                                }
                              </strong>
                              <div style={{
                                marginTop: 6,
                                fontSize: 13
                              }}>
                                Capacidad:{" "}
                                {
                                  grupo.decision_turno
                                    .horas_3_turnos_semana
                                }
                                {" h/sem"}
                              </div>
                              <div style={{ fontSize: 13 }}>
                                Termina en:{" "}
                                {
                                  grupo.decision_turno
                                    .dias_estimados_3_turnos ??
                                  "s/d"
                                }
                                {" dias · "}
                                {fechaDesdeDias(
                                  grupo.decision_turno
                                    .dias_estimados_3_turnos
                                )}
                              </div>
                              <div style={{ fontSize: 13 }}>
                                Falta semanal:{" "}
                                {
                                  grupo.decision_turno
                                    .horas_faltantes_3_turnos
                                }
                                {" h"}
                              </div>
                            </div>
                          </div>

                          <div style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.72)",
                            color: "#334155",
                            fontSize: 13
                          }}>
                            <strong>
                              Impacto de activar noche:
                            </strong>
                            {" aporta "}
                            {
                              grupo.decision_turno
                                .horas_noche_semana
                            }
                            {" h/sem, recupera "}
                            {
                              grupo.decision_turno
                                .ahorro_horas_con_noche
                            }
                            {" h de brecha y ahorra aprox. "}
                            {
                              grupo.decision_turno
                                .ahorro_dias_con_noche
                            }
                            {" dias ("}
                            {
                              grupo.decision_turno
                                .ahorro_semanas_con_noche
                            }
                            {" semanas)."}
                          </div>
                        </div>
                      )
                    }
                    {grupo.decision_turno.dotacion && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 13
                      }}>
                        <strong>Dotación cubierta:</strong>
                        {" "}
                        {etiquetaDotacion(
                          grupo.decision_turno
                        )}
                        {grupo.decision_turno.dotacion
                          .dotacion_estacion && (
                          <>
                            {" · Estación: "}
                            {
                              grupo.decision_turno
                                .dotacion
                                .dotacion_estacion
                            }
                          </>
                        )}
                        {grupo.decision_turno.dotacion
                          .faltantes_base > 0 && (
                          <>
                            {" · Faltan base: "}
                            {
                              grupo.decision_turno
                                .dotacion
                                .faltantes_base
                            }
                          </>
                        )}
                        {grupo.decision_turno.dotacion
                          .faltantes_noche > 0 && (
                          <>
                            {" · Faltan noche: "}
                            {
                              grupo.decision_turno
                                .dotacion
                                .faltantes_noche
                            }
                          </>
                        )}
                      </div>
                    )}
                    <div style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 9,
                      background: "rgba(255,255,255,0.72)",
                      color: "#334155"
                    }}>
                      <strong>
                        Registrar decisión tomada:
                      </strong>
                      <textarea
                        value={
                          comentariosDecision[
                            grupo.subproceso_id
                          ] || ""
                        }
                        onChange={evento =>
                          setComentariosDecision(
                            actual => ({
                              ...actual,
                              [grupo.subproceso_id]:
                                evento.target.value
                            })
                          )
                        }
                        placeholder="Comentario opcional: motivo, acuerdo de reunión o condición para revisar luego."
                        rows={2}
                        style={{
                          width: "100%",
                          marginTop: 8,
                          borderRadius: 8,
                          border: "1px solid #CBD5E1",
                          padding: 9,
                          resize: "vertical",
                          fontFamily: "Arial"
                        }}
                      />
                      <div style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 8
                      }}>
                        {decisionesJefe.map(opcion => {
                          const clave =
                            `${grupo.subproceso_id}:${opcion.id}`;

                          return (
                            <button
                              key={opcion.id}
                              type="button"
                              disabled={
                                Boolean(
                                  guardandoDecision
                                )
                              }
                              onClick={() =>
                                registrarDecision(
                                  grupo,
                                  opcion.id
                                )
                              }
                              style={{
                                border: "none",
                                borderRadius: 8,
                                padding: "8px 10px",
                                background:
                                  guardandoDecision ===
                                  clave
                                    ? "#94A3B8"
                                    : "#334155",
                                color: "white",
                                fontWeight: "bold",
                                cursor:
                                  guardandoDecision
                                    ? "not-allowed"
                                    : "pointer"
                              }}
                            >
                              {guardandoDecision === clave
                                ? "Guardando..."
                                : opcion.texto}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {[
                      "configurar_capacidad",
                      "reforzar_capacidad"
                    ].includes(
                      grupo.decision_turno.tipo
                    ) &&
                      onConfigurarCapacidad && (
                      <button
                        type="button"
                        onClick={() =>
                          onConfigurarCapacidad({
                            planta_id: plantaId,
                            ot_id:
                              grupo.siguiente_ot?.id ||
                              "",
                            ot_codigo:
                              grupo.siguiente_ot
                                ?.codigo || "",
                            proceso_id:
                              grupo.siguiente_ot
                                ?.cuello_carga
                                ?.proceso_id || "",
                            proceso_nombre:
                              grupo.siguiente_ot
                                ?.cuello_carga
                                ?.proceso_nombre || "",
                            subproceso_id:
                              grupo.subproceso_id,
                            subproceso_nombre:
                              grupo.subproceso_nombre,
                            semana_inicio:
                              semanaInicio
                          })
                        }
                        style={{
                          marginTop: 10,
                          border: "none",
                          borderRadius: 8,
                          padding: "9px 12px",
                          background: "#0E7490",
                          color: "white",
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        {grupo.capacidad_estado
                          ?.estado === "provisional"
                          ? "Validar capacidad de "
                          : "Configurar capacidad de "}
                        {grupo.subproceso_id}
                      </button>
                    )}
                    {[
                      "cubrir_dotacion_base",
                      "preparar_3_turno"
                    ].includes(
                      grupo.decision_turno.tipo
                    ) &&
                      onProgramarTurnos && (
                      <button
                        type="button"
                        onClick={() =>
                          onProgramarTurnos({
                            planta_id: plantaId,
                            turno_id:
                              grupo.decision_turno
                                .turno_sugerido ||
                              "manana",
                            subproceso_id:
                              grupo.subproceso_id,
                            subproceso_nombre:
                              grupo.subproceso_nombre,
                            semana_inicio:
                              semanaInicio
                          })
                        }
                        style={{
                          marginTop: 10,
                          marginLeft: 8,
                          border: "none",
                          borderRadius: 8,
                          padding: "9px 12px",
                          background: "#4338CA",
                          color: "white",
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        Programar dotación de{" "}
                        {grupo.subproceso_id}
                      </button>
                    )}
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
