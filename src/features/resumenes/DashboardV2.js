import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  observarResumenPlanta
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

  const ranking =
    resumen?.ranking_operarios || [];
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
                <button
                  type="button"
                  onClick={onVolver}
                  style={{
                    padding: "10px 14px",
                    border: "none",
                    borderRadius: 8,
                    background: "#2563EB",
                    color: "white",
                    cursor: "pointer"
                  }}
                >
                  Volver
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
          Este panel escucha un solo documento de
          resumen por planta.
        </div>
      </div>
    </div>
  );
}

export default DashboardV2;
