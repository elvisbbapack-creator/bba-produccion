import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  construirAprendizajeDecisionesPlanificador,
  listarImpactosDecisionesPlanificador,
  listarDecisionesPlanificador
} from "./planificacionRepository";

const decisionTexto = {
  mantener_2_turnos: "Mantener 2 turnos",
  activar_3_turno: "Activar 3er turno",
  programar_dotacion: "Programar dotación",
  revisar_capacidad: "Revisar capacidad"
};

const recomendacionTexto = {
  mantener_2_turnos: "Mantener 2 turnos",
  activar_3_turno: "Activar 3er turno",
  preparar_3_turno: "Preparar 3er turno",
  cubrir_dotacion_base: "Cubrir dotación base",
  configurar_capacidad: "Configurar capacidad",
  reforzar_capacidad: "Reforzar capacidad"
};

const impactoColor = {
  positivo: "#166534",
  en_observacion: "#1D4ED8",
  riesgo: "#B91C1C",
  sin_movimiento: "#92400E",
  sin_datos: "#475569"
};

const impactoFondo = {
  positivo: "#F0FDF4",
  en_observacion: "#EFF6FF",
  riesgo: "#FEF2F2",
  sin_movimiento: "#FFFBEB",
  sin_datos: "#F8FAFC"
};

const fechaVisible = valor => {
  if (!valor) {
    return "-";
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? "-"
    : fecha.toLocaleString("es-CL");
};

const coincide = (valor, busqueda) =>
  !busqueda ||
  (valor || "")
    .toString()
    .toLowerCase()
    .includes(busqueda.toLowerCase());

function HistorialDecisionesPlanificadorV2({
  db,
  perfil,
  onVolver
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] = useState(
    perfil.rol === "gerencia"
      ? ""
      : plantas[0] || ""
  );
  const [decisiones, setDecisiones] = useState([]);
  const [impactos, setImpactos] = useState({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [filtroSubproceso, setFiltroSubproceso] =
    useState("");
  const [filtroOT, setFiltroOT] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const cargar = async () => {
    try {
      setCargando(true);
      setError("");
      const decisionesData =
        await listarDecisionesPlanificador({
          db,
          perfil,
          plantaId,
          limite: 120
        });
      const impactosData =
        await listarImpactosDecisionesPlanificador({
          db,
          decisiones: decisionesData
        });

      setDecisiones(decisionesData);
      setImpactos(impactosData);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar el historial de decisiones."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaId]);

  const decisionesFiltradas = useMemo(
    () => decisiones.filter(item =>
      coincide(
        `${item.subproceso_id} ${item.subproceso_nombre}`,
        filtroSubproceso
      ) &&
      coincide(
        `${item.ot_priorizada_codigo} ${item.producto_nombre}`,
        filtroOT
      ) &&
      (!filtroTipo ||
        item.decision_tomada === filtroTipo)
    ),
    [
      decisiones,
      filtroOT,
      filtroSubproceso,
      filtroTipo
    ]
  );

  const resumen = useMemo(() => {
    const base = {
      total: decisionesFiltradas.length,
      activar_3_turno: 0,
      mantener_2_turnos: 0,
      programar_dotacion: 0,
      revisar_capacidad: 0
    };

    decisionesFiltradas.forEach(item => {
      if (base[item.decision_tomada] !== undefined) {
        base[item.decision_tomada] += 1;
      }
    });

    return base;
  }, [decisionesFiltradas]);
  const aprendizaje = useMemo(
    () =>
      construirAprendizajeDecisionesPlanificador(
        decisionesFiltradas
      ),
    [decisionesFiltradas]
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: 22,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1280,
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
              Historial de decisiones del Planificador
            </h1>
            <p style={{
              color: "#475569",
              marginTop: 0
            }}>
              Audita qué recomendó el sistema, qué decidió
              el jefe y con qué impacto estimado.
            </p>
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            style={{
              border: "none",
              borderRadius: 9,
              padding: "10px 14px",
              background: "#0F766E",
              color: "white",
              fontWeight: "bold",
              cursor: cargando ? "not-allowed" : "pointer"
            }}
          >
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {error && (
          <div role="alert" style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            padding: 12,
            borderRadius: 9,
            marginTop: 12
          }}>
            {error}
          </div>
        )}

        <section style={{
          background: "white",
          borderRadius: 14,
          padding: 18,
          boxShadow:
            "0 2px 10px rgba(15,23,42,0.08)",
          marginTop: 18
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12
          }}>
            <div>
              <label>
                Planta
                <select
                  value={plantaId}
                  onChange={evento =>
                    setPlantaId(evento.target.value)
                  }
                  style={inputStyle}
                >
                  {perfil.rol === "gerencia" && (
                    <option value="">
                      Todas las plantas
                    </option>
                  )}
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
            </div>
            <div>
              <label>
                Subproceso
                <input
                  value={filtroSubproceso}
                  onChange={evento =>
                    setFiltroSubproceso(
                      evento.target.value
                    )
                  }
                  placeholder="SP0003 o nombre"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label>
                OT / producto
                <input
                  value={filtroOT}
                  onChange={evento =>
                    setFiltroOT(evento.target.value)
                  }
                  placeholder="OT-CHI o producto"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label>
                Decisión
                <select
                  value={filtroTipo}
                  onChange={evento =>
                    setFiltroTipo(evento.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="">Todas</option>
                  {Object.entries(decisionTexto)
                    .map(([id, texto]) => (
                      <option key={id} value={id}>
                        {texto}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <section style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 14
        }}>
          {[
            ["Total", resumen.total],
            [
              "Activar 3er turno",
              resumen.activar_3_turno
            ],
            [
              "Mantener 2 turnos",
              resumen.mantener_2_turnos
            ],
            [
              "Programar dotación",
              resumen.programar_dotacion
            ],
            [
              "Revisar capacidad",
              resumen.revisar_capacidad
            ]
          ].map(([titulo, valor]) => (
            <div
              key={titulo}
              style={{
                background: "white",
                borderRadius: 12,
                padding: 14,
                boxShadow:
                  "0 2px 8px rgba(15,23,42,0.07)"
              }}
            >
              <small style={{ color: "#64748B" }}>
                {titulo}
              </small>
              <strong style={{
                display: "block",
                fontSize: 26,
                color: "#0F172A"
              }}>
                {valor}
              </strong>
            </div>
          ))}
        </section>

        <section style={{
          background: "white",
          borderRadius: 14,
          padding: 18,
          boxShadow:
            "0 2px 10px rgba(15,23,42,0.08)",
          marginTop: 16
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap"
          }}>
            <div>
              <h2 style={{ margin: "0 0 4px" }}>
                Aprendizaje operativo
              </h2>
              <p style={{
                margin: 0,
                color: "#475569"
              }}>
                Mide cuánto coincide la decisión real
                con la recomendación del sistema.
              </p>
            </div>
            <div style={{
              textAlign: "right",
              color: "#0F172A"
            }}>
              <strong style={{ fontSize: 30 }}>
                {aprendizaje.coincidencia_pct}
                {"%"}
              </strong>
              <div style={{ color: "#64748B" }}>
                coincidencia
              </div>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
            marginTop: 14
          }}>
            <InfoBox
              titulo="Siguió recomendación"
              valor={aprendizaje.alineadas}
            />
            <InfoBox
              titulo="Decidió distinto"
              valor={aprendizaje.distintas}
            />
            <InfoBox
              titulo="Ahorro estimado"
              valor={`${aprendizaje.ahorro_dias_estimado} días`}
            />
          </div>

          {aprendizaje.por_subproceso.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <strong>
                Subprocesos con más aprendizaje
              </strong>
              <div style={{
                display: "grid",
                gap: 8,
                marginTop: 8
              }}>
                {aprendizaje.por_subproceso.map(item => (
                  <div
                    key={item.subproceso_id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 9,
                      padding: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      color: "#334155"
                    }}
                  >
                    <span>
                      <strong>
                        {item.subproceso_id}
                      </strong>
                      {" · "}
                      {item.subproceso_nombre}
                    </span>
                    <span>
                      {item.total}
                      {" decisiones · "}
                      {item.coincidencia_pct}
                      {"% coincide · "}
                      {item.distintas}
                      {" distintas"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section style={{
          display: "grid",
          gap: 12,
          marginTop: 16
        }}>
          {cargando ? (
            <div style={emptyStyle}>
              Cargando decisiones...
            </div>
          ) : decisionesFiltradas.length === 0 ? (
            <div style={emptyStyle}>
              No hay decisiones registradas para estos filtros.
            </div>
          ) : decisionesFiltradas.map(item => (
            <article
              key={item.id}
              style={{
                background: "white",
                borderRadius: 14,
                padding: 16,
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
                  <strong style={{
                    color: "#0F172A",
                    fontSize: 18
                  }}>
                    {item.subproceso_id}
                    {" - "}
                    {item.subproceso_nombre}
                  </strong>
                  <div style={{ color: "#475569" }}>
                    {item.ot_priorizada_codigo || "Sin OT"}
                    {" · "}
                    {item.producto_nombre || "Sin producto"}
                  </div>
                </div>
                <div style={{
                  color: "#475569",
                  textAlign: "right"
                }}>
                  <strong>
                    {fechaVisible(item.creado_en)}
                  </strong>
                  <div>
                    {item.usuario_nombre || "Usuario"}
                    {" · "}
                    {(item.planta_id || "").toUpperCase()}
                  </div>
                </div>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                marginTop: 12
              }}>
                <InfoBox
                  titulo="Recomendó sistema"
                  valor={
                    recomendacionTexto[
                      item.recomendacion_tipo
                    ] || item.recomendacion_titulo || "-"
                  }
                />
                <InfoBox
                  titulo="Decidió jefe"
                  valor={
                    decisionTexto[
                      item.decision_tomada
                    ] || item.decision_tomada || "-"
                  }
                />
                <InfoBox
                  titulo="Ahorro estimado"
                  valor={`${item.ahorro_dias_con_noche || 0} días · ${item.ahorro_semanas_con_noche || 0} sem`}
                />
                <InfoBox
                  titulo="Dotación"
                  valor={`M ${item.dotacion_manana || 0} · T ${item.dotacion_tarde || 0} · N ${item.dotacion_noche || 0}`}
                />
              </div>

              {item.comentario && (
                <div style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: "#F8FAFC",
                  color: "#334155"
                }}>
                  <strong>Comentario:</strong>
                  {" "}
                  {item.comentario}
                </div>
              )}

              {impactos[item.id] && (
                <div style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 9,
                  background:
                    impactoFondo[
                      impactos[item.id].estado
                    ] || "#F8FAFC",
                  color:
                    impactoColor[
                      impactos[item.id].estado
                    ] || "#334155"
                }}>
                  <strong>
                    Resultado posterior:{" "}
                    {impactos[item.id].titulo}
                  </strong>
                  <div style={{ marginTop: 4 }}>
                    {impactos[item.id].detalle}
                  </div>
                  <div style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 8,
                    fontSize: 13
                  }}>
                    <span>
                      Avance:{" "}
                      {impactos[item.id].avance_pct}
                      {"%"}
                    </span>
                    <span>
                      Eficiencia calidad:{" "}
                      {impactos[item.id]
                        .eficiencia_calidad_pct ??
                        "s/d"}
                      {"%"}
                    </span>
                    <span>
                      Calidad:{" "}
                      {impactos[item.id]
                        .calidad_pct ?? "s/d"}
                      {"%"}
                    </span>
                    <span>
                      Riesgo entrega:{" "}
                      {
                        impactos[item.id]
                          .riesgo_entrega
                      }
                    </span>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 6,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  padding: 10,
  boxSizing: "border-box"
};

const emptyStyle = {
  background: "white",
  borderRadius: 14,
  padding: 18,
  color: "#475569"
};

function InfoBox({ titulo, valor }) {
  return (
    <div style={{
      border: "1px solid #E2E8F0",
      borderRadius: 9,
      padding: 10,
      color: "#334155"
    }}>
      <small style={{ color: "#64748B" }}>
        {titulo}
      </small>
      <strong style={{
        display: "block",
        marginTop: 4
      }}>
        {valor}
      </strong>
    </div>
  );
}

export default HistorialDecisionesPlanificadorV2;
