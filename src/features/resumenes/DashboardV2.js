import {
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  observarOrdenesActivas,
  observarResumenPlanta,
  resumirRiesgosDashboard
} from "./resumenesRepository";

const zonaPorPlanta = {
  chile: "America/Santiago",
  peru: "America/Lima"
};

export const fechaOperativaPlanta = (
  plantaId,
  fecha = new Date()
) => {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        zonaPorPlanta[plantaId] ||
        "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(fecha);
};

const porcentaje = (valor) =>
  `${Number(valor || 0).toFixed(1)}%`;

const colorIndicador = (valor) => {
  if (Number(valor) >= 90) {
    return "#16A34A";
  }

  if (Number(valor) >= 70) {
    return "#D97706";
  }

  return "#DC2626";
};

const fechaHoraVisible = valor => {
  if (!valor) {
    return "Pendiente";
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? "Pendiente"
    : fecha.toLocaleString("es-CL", {
      dateStyle: "short",
      timeStyle: "short"
    });
};

const presentacionRiesgo = {
  atrasada: {
    texto: "Atrasada",
    color: "#F87171"
  },
  en_riesgo: {
    texto: "En riesgo",
    color: "#FB923C"
  },
  sin_estandar: {
    texto: "Sin estándar",
    color: "#FACC15"
  },
  sin_fecha: {
    texto: "Sin fecha",
    color: "#94A3B8"
  },
  en_fecha: {
    texto: "En fecha",
    color: "#4ADE80"
  }
};

function DashboardV2({
  db,
  perfil,
  onVolver,
  onCerrarSesion
}) {
  const plantas = perfil.planta_ids || [];
  const [plantaId, setPlantaId] =
    useState(plantas[0] || "");
  const [resumen, setResumen] = useState(null);
  const [ordenesActivas, setOrdenesActivas] =
    useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modoTv, setModoTv] = useState(
    perfil.rol === "tv"
  );
  const fecha = useMemo(
    () => fechaOperativaPlanta(plantaId),
    [plantaId]
  );

  useEffect(() => {
    if (!plantaId) {
      return undefined;
    }

    setCargando(true);
    setError("");

    return observarResumenPlanta(
      db,
      plantaId,
      fecha,
      datos => {
        setResumen(datos);
        setCargando(false);
      },
      fallo => {
        setError(
          fallo?.message ||
          "No se pudo cargar el dashboard."
        );
        setCargando(false);
      }
    );
  }, [db, fecha, plantaId]);

  useEffect(() => {
    if (!plantaId) {
      return undefined;
    }

    return observarOrdenesActivas(
      db,
      perfil.empresa_id,
      plantaId,
      setOrdenesActivas,
      fallo => {
        setError(
          fallo?.message ||
          "No se pudieron cargar las OTs activas."
        );
      }
    );
  }, [db, perfil.empresa_id, plantaId]);

  const ranking =
    resumen?.ranking_operarios || [];
  const resumenRiesgos = useMemo(
    () => resumirRiesgosDashboard(
      ordenesActivas
    ),
    [ordenesActivas]
  );
  const tarjetas = [
    {
      titulo: "Producción OK",
      valor: Number(
        resumen?.cantidad_ok || 0
      ).toLocaleString("es-CL"),
      color: "#2563EB"
    },
    {
      titulo: "Sesiones terminadas",
      valor: resumen?.sesiones || 0,
      color: "#7C3AED"
    },
    {
      titulo: "Rendimiento",
      valor: porcentaje(
        resumen?.rendimiento_pct
      ),
      color: colorIndicador(
        resumen?.rendimiento_pct
      )
    },
    {
      titulo: "Calidad",
      valor: porcentaje(
        resumen?.calidad_pct
      ),
      color: colorIndicador(
        resumen?.calidad_pct
      )
    },
    {
      titulo: "Eficiencia con calidad",
      valor: porcentaje(
        resumen?.eficiencia_calidad_pct
      ),
      color: colorIndicador(
        resumen?.eficiencia_calidad_pct
      )
    }
  ];
  const tarjetasRiesgo = [
    {
      titulo: "OTs críticas",
      valor: resumenRiesgos.ots_criticas,
      detalle: "Atrasadas o en riesgo",
      color:
        resumenRiesgos.ots_criticas > 0
          ? "#F87171"
          : "#4ADE80"
    },
    {
      titulo: "Sin estándar",
      valor: resumenRiesgos.sin_estandar,
      detalle: "No proyectan con confianza",
      color:
        resumenRiesgos.sin_estandar > 0
          ? "#FACC15"
          : "#4ADE80"
    },
    {
      titulo: "Cuellos activos",
      valor:
        resumenRiesgos.con_cuello_pendiente,
      detalle: "OTs con carga pendiente",
      color:
        resumenRiesgos
          .con_cuello_pendiente > 0
          ? "#38BDF8"
          : "#4ADE80"
    },
    {
      titulo: "Unidades cuello",
      valor: Number(
        resumenRiesgos
          .unidades_pendientes || 0
      ).toLocaleString("es-CL"),
      detalle: "Pendientes en cuellos",
      color: "#A78BFA"
    }
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F172A",
      color: "white",
      padding: modoTv ? 18 : 24,
      fontFamily: "Arial",
      boxSizing: "border-box"
    }}>
      <div style={{
        maxWidth: modoTv ? "100%" : 1400,
        margin: "0 auto"
      }}>
        {perfil.rol !== "tv" && (
          <BotonVolver
            onClick={onVolver}
            style={{ marginBottom: 12 }}
          >
            Volver
          </BotonVolver>
        )}

        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15,
          flexWrap: "wrap",
          marginBottom: 20
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: modoTv ? 34 : 30
            }}>
              Dashboard Productivo V2
            </h1>
            <div style={{
              color: "#94A3B8",
              marginTop: 5
            }}>
              {plantaId.toUpperCase()}
              {" · "}
              {fecha}
              {" · "}
              actualización en vivo
            </div>
          </div>

          <div style={{
            display: "flex",
            gap: 10
          }}>
            {plantas.length > 1 && (
              <select
                value={plantaId}
                onChange={evento =>
                  setPlantaId(
                    evento.target.value
                  )
                }
                style={{
                  padding: 10,
                  borderRadius: 8
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

            {perfil.rol !== "tv" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setModoTv(actual => !actual)
                  }
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #475569",
                    borderRadius: 8,
                    background: "#1E293B",
                    color: "white",
                    cursor: "pointer"
                  }}
                >
                  {modoTv
                    ? "Vista normal"
                    : "Modo TV"}
                </button>
              </>
            )}
            {perfil.rol === "tv" && (
              <button
                type="button"
                onClick={onCerrarSesion}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #475569",
                  borderRadius: 8,
                  background: "#1E293B",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                Cerrar sesión
              </button>
            )}
          </div>
        </header>

        {error && (
          <div role="alert" style={{
            background: "#7F1D1D",
            padding: 12,
            borderRadius: 9,
            marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 20
        }}>
          {tarjetas.map(item => (
            <div
              key={item.titulo}
              style={{
                background: "#1E293B",
                borderRadius: 14,
                padding: modoTv ? 18 : 16,
                borderTop:
                  `5px solid ${item.color}`
              }}
            >
              <div style={{
                color: "#CBD5E1",
                fontSize: modoTv ? 17 : 14
              }}>
                {item.titulo}
              </div>
              <div style={{
                color: item.color,
                fontWeight: "bold",
                fontSize: modoTv ? 34 : 28,
                marginTop: 8
              }}>
                {item.valor}
              </div>
            </div>
          ))}
        </div>

        <section style={{
          background: "#1E293B",
          borderRadius: 14,
          padding: modoTv ? 22 : 18,
          marginBottom: 20,
          border:
            resumenRiesgos.estado_general ===
            "critico"
              ? "1px solid #F87171"
              : resumenRiesgos.estado_general ===
                "estandar_pendiente"
                ? "1px solid #FACC15"
                : "1px solid transparent"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12
          }}>
            <h2 style={{ margin: 0 }}>
              Riesgos gerenciales de OTs
            </h2>
            <strong style={{
              color:
                resumenRiesgos.estado_general ===
                "critico"
                  ? "#F87171"
                  : resumenRiesgos
                    .estado_general ===
                    "estandar_pendiente"
                    ? "#FACC15"
                    : "#4ADE80"
            }}>
              {resumenRiesgos.total_ots}
              {" OTs activas"}
            </strong>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10
          }}>
            {tarjetasRiesgo.map(item => (
              <div
                key={item.titulo}
                style={{
                  background: "#0F172A",
                  borderRadius: 10,
                  padding: modoTv ? 14 : 12,
                  borderTop:
                    `4px solid ${item.color}`
                }}
              >
                <div style={{
                  color: "#CBD5E1",
                  fontSize: 13
                }}>
                  {item.titulo}
                </div>
                <strong style={{
                  display: "block",
                  color: item.color,
                  fontSize: modoTv ? 27 : 22,
                  marginTop: 5
                }}>
                  {item.valor}
                </strong>
                <div style={{
                  color: "#94A3B8",
                  fontSize: 12,
                  marginTop: 3
                }}>
                  {item.detalle}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            color: "#CBD5E1",
            marginTop: 12
          }}>
            {resumenRiesgos.recomendacion}
          </div>
        </section>

        <section style={{
          background: "#1E293B",
          borderRadius: 14,
          padding: modoTv ? 22 : 18,
          marginBottom: 20
        }}>
          <h2 style={{ marginTop: 0 }}>
            OTs activas y cuellos pendientes
          </h2>
          {ordenesActivas.length === 0 ? (
            <p style={{ color: "#94A3B8" }}>
              No hay OTs activas en esta planta.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gap: 10
            }}>
              {ordenesActivas.slice(
                0,
                modoTv ? 6 : 10
              ).map(orden => {
                const riesgo =
                  presentacionRiesgo[
                    orden.riesgo_entrega
                  ] ||
                  presentacionRiesgo.sin_fecha;
                const cuello = orden.cuello_carga;

                return (
                  <div
                    key={orden.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        modoTv
                          ? "minmax(210px, 1.2fr) minmax(260px, 1.6fr) 150px 140px"
                          : "minmax(180px, 1.2fr) minmax(230px, 1.6fr) 140px 125px",
                      gap: 12,
                      alignItems: "center",
                      background: "#0F172A",
                      borderLeft:
                        `5px solid ${riesgo.color}`,
                      borderRadius: 10,
                      padding: "12px 14px"
                    }}
                  >
                    <div>
                      <strong>
                        {orden.codigo}
                      </strong>
                      <div style={{
                        color: "#94A3B8",
                        marginTop: 4
                      }}>
                        {orden.producto_codigo}
                        {" · "}
                        {Number(
                          orden.avance_pct || 0
                        ).toFixed(1)}
                        {"%"}
                      </div>
                    </div>
                    <div>
                      <strong>
                        {cuello?.operacion_codigo
                          ? `${cuello.operacion_codigo} - ${cuello.operacion_nombre}`
                          : "Cuello pendiente de recalcular"}
                      </strong>
                      <div style={{
                        color: "#CBD5E1",
                        marginTop: 4
                      }}>
                        {cuello
                          ? `${cuello.cantidad_pendiente} unidades pendientes`
                          : `${Number(
                            orden
                              .cantidad_total_pendiente ||
                            0
                          )} unidades pendientes en la OT`}
                      </div>
                    </div>
                    <div>
                      <small style={{
                        color: "#94A3B8"
                      }}>
                        Fin estimado
                      </small>
                      <div>
                        {fechaHoraVisible(
                          orden.fecha_estimada_fin
                        )}
                      </div>
                    </div>
                    <strong style={{
                      color: riesgo.color,
                      textAlign: "right"
                    }}>
                      {riesgo.texto}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={{
          background: "#1E293B",
          borderRadius: 14,
          padding: modoTv ? 22 : 18
        }}>
          <h2 style={{ marginTop: 0 }}>
            Ranking de eficiencia con calidad
          </h2>

          {cargando ? (
            <p>Cargando resumen...</p>
          ) : !resumen ? (
            <p style={{ color: "#94A3B8" }}>
              Aún no existen reportes para esta
              planta y fecha.
            </p>
          ) : ranking.length === 0 ? (
            <p style={{ color: "#94A3B8" }}>
              El resumen aún no tiene operarios.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gap: modoTv ? 10 : 8
            }}>
              {ranking.map((operario, indice) => {
                const eficiencia = Number(
                  operario
                    .eficiencia_calidad_pct || 0
                );

                return (
                  <div
                    key={operario.operario_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        modoTv
                          ? "55px minmax(180px, 1.2fr) 2fr 110px 110px"
                          : "45px minmax(150px, 1.2fr) 2fr 90px 90px",
                      alignItems: "center",
                      gap: 10,
                      background: "#0F172A",
                      padding: modoTv
                        ? "12px 15px"
                        : "9px 12px",
                      borderRadius: 10
                    }}
                  >
                    <strong style={{
                      fontSize: modoTv ? 22 : 17,
                      color:
                        indice === 0
                          ? "#FACC15"
                          : "white"
                    }}>
                      {indice + 1}
                    </strong>
                    <div>
                      <strong style={{
                        fontSize:
                          modoTv ? 19 : 15
                      }}>
                        {operario.operario_nombre}
                      </strong>
                      <div style={{
                        color: "#94A3B8",
                        fontSize: 13
                      }}>
                        {operario.operario_codigo}
                        {" · "}
                        {operario.cantidad_ok}
                        {" OK"}
                      </div>
                    </div>
                    <div style={{
                      height: modoTv ? 18 : 13,
                      background: "#334155",
                      borderRadius: 20,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width:
                          `${Math.min(
                            eficiencia,
                            150
                          ) / 1.5}%`,
                        height: "100%",
                        background:
                          colorIndicador(eficiencia)
                      }}
                      />
                    </div>
                    <div>
                      <small style={{
                        color: "#94A3B8"
                      }}>
                        Calidad
                      </small>
                      <div>
                        {porcentaje(
                          operario.calidad_pct
                        )}
                      </div>
                    </div>
                    <strong style={{
                      textAlign: "right",
                      color:
                        colorIndicador(eficiencia),
                      fontSize: modoTv ? 22 : 17
                    }}>
                      {porcentaje(eficiencia)}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div style={{
          color: "#64748B",
          textAlign: "center",
          marginTop: 14,
          fontSize: 13
        }}>
          Este panel escucha un resumen diario y los
          documentos principales de las OTs activas;
          no consulta operaciones ni historiales.
        </div>
      </div>
    </div>
  );
}

export default DashboardV2;
