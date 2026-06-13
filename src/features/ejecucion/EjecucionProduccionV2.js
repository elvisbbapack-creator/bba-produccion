import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  listarOperacionesOT
} from "../ordenes/ordenesRepository";
import {
  listarCausas,
  listarDefectos
} from "../calidad/calidadRepository";
import {
  iniciarSesionProduccion,
  listarOrdenesEjecutables,
  listarSesionesActivas,
  obtenerOperacionesDisponibles,
  registrarReporteProduccion
} from "./ejecucionRepository";

const reporteInicial = {
  cantidad_ok: "",
  cantidad_defectuosa: "",
  cantidad_reproceso: "",
  defecto_id: "",
  causa_id: "",
  observacion: ""
};

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

const etiqueta = {
  display: "grid",
  gap: 5,
  color: "#334155",
  fontWeight: "bold",
  fontSize: 14
};

function EjecucionProduccionV2({
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
  const [operacionId, setOperacionId] =
    useState("");
  const [operarioCodigo, setOperarioCodigo] =
    useState("");
  const [operarioNombre, setOperarioNombre] =
    useState("");
  const [sesiones, setSesiones] = useState([]);
  const [defectos, setDefectos] = useState([]);
  const [causas, setCausas] = useState([]);
  const [sesionId, setSesionId] = useState("");
  const [reporte, setReporte] =
    useState(reporteInicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const ordenSeleccionada = ordenes.find(
    orden => orden.id === ordenId
  );
  const disponibles = useMemo(
    () => obtenerOperacionesDisponibles(
      operaciones
    ),
    [operaciones]
  );
  const operacionSeleccionada = disponibles.find(
    operacion => operacion.id === operacionId
  );
  const sesionSeleccionada = sesiones.find(
    sesion => sesion.id === sesionId
  );

  const cargarPlanta = useCallback(
    async (planta) => {
      if (!planta) {
        return;
      }

      const [ordenesData, sesionesData] =
        await Promise.all([
          listarOrdenesEjecutables(
            db,
            perfil.empresa_id,
            planta
          ),
          listarSesionesActivas(
            db,
            perfil.empresa_id,
            planta
          )
        ]);
      setOrdenes(ordenesData);
      setSesiones(sesionesData);
    },
    [db, perfil.empresa_id]
  );

  const cargarInicial = useCallback(
    async () => {
      try {
        setCargando(true);
        setError("");
        const [
          ,
          defectosData,
          causasData
        ] = await Promise.all([
          cargarPlanta(plantaId),
          listarDefectos(
            db,
            perfil.empresa_id
          ),
          listarCausas(
            db,
            perfil.empresa_id
          )
        ]);
        setDefectos(
          defectosData.filter(
            item => item.activo !== false
          )
        );
        setCausas(
          causasData.filter(
            item => item.activo !== false
          )
        );
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudo cargar la producción V2."
        );
      } finally {
        setCargando(false);
      }
    },
    [
      cargarPlanta,
      db,
      perfil.empresa_id,
      plantaId
    ]
  );

  useEffect(() => {
    cargarInicial();
  }, [cargarInicial]);

  const cambiarPlanta = async (valor) => {
    setPlantaId(valor);
    setOrdenId("");
    setOperacionId("");
    setOperaciones([]);
    setSesionId("");
    setError("");
    setMensaje("");

    try {
      await cargarPlanta(valor);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cambiar de planta."
      );
    }
  };

  const cambiarOrden = async (
    valor,
    limpiarFeedback = true
  ) => {
    setOrdenId(valor);
    setOperacionId("");

    if (limpiarFeedback) {
      setError("");
      setMensaje("");
    }
    const orden = ordenes.find(
      item => item.id === valor
    );

    if (!orden) {
      setOperaciones([]);
      return;
    }

    try {
      setOperaciones(
        await listarOperacionesOT(
          db,
          perfil.empresa_id,
          orden.planta_id,
          orden.id
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar las operaciones."
      );
    }
  };

  const iniciar = async (evento) => {
    evento.preventDefault();

    try {
      setGuardando(true);
      setError("");
      const sesion =
        await iniciarSesionProduccion({
          db,
          perfil,
          orden: ordenSeleccionada,
          operacion: operacionSeleccionada,
          operarioCodigo,
          operarioNombre
        });
      setSesiones(actuales => [
        ...actuales,
        sesion
      ]);
      setSesionId(sesion.id);
      setOperacionId("");
      await cambiarOrden(
        ordenSeleccionada.id,
        false
      );
      setMensaje(
        `Sesión iniciada: ${sesion.ot_codigo} / ${sesion.operacion_codigo}.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo iniciar la producción."
      );
    } finally {
      setGuardando(false);
    }
  };

  const actualizarReporte = (nombre, valor) => {
    setReporte(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const reportar = async (evento) => {
    evento.preventDefault();

    try {
      setGuardando(true);
      setError("");
      const indicadores =
        await registrarReporteProduccion({
        db,
        perfil,
        sesion: sesionSeleccionada,
        cantidadOk: reporte.cantidad_ok,
        cantidadDefectuosa:
          reporte.cantidad_defectuosa,
        cantidadReproceso:
          reporte.cantidad_reproceso,
        defecto: defectos.find(
          item =>
            item.id === reporte.defecto_id
        ),
        causa: causas.find(
          item =>
            item.id === reporte.causa_id
        ),
        observacion: reporte.observacion
      });
      setReporte(reporteInicial);
      setSesionId("");
      await cargarPlanta(plantaId);

      if (ordenId) {
        await cambiarOrden(
          ordenId,
          false
        );
      }

      setMensaje(
        `Reporte registrado. Rendimiento: ${indicadores.rendimiento_pct}%. Calidad: ${indicadores.calidad_pct}%. Eficiencia con calidad: ${indicadores.eficiencia_calidad_pct}%.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar el reporte."
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
            fontWeight: "bold"
          }}
        >
          Volver a Operación
        </button>

        <h1 style={{ marginBottom: 4 }}>
          Ejecución productiva V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Inicia únicamente operaciones habilitadas y
          registra producción con calidad.
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

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          alignItems: "start"
        }}>
          <form
            onSubmit={iniciar}
            style={tarjeta}
          >
            <h2 style={{ marginTop: 0 }}>
              Iniciar producción
            </h2>

            <div style={{
              display: "grid",
              gap: 12
            }}>
              <label style={etiqueta}>
                Planta
                <select
                  value={plantaId}
                  onChange={evento =>
                    cambiarPlanta(
                      evento.target.value
                    )
                  }
                  style={campo}
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

              <label style={etiqueta}>
                OT liberada
                <select
                  value={ordenId}
                  onChange={evento =>
                    cambiarOrden(
                      evento.target.value
                    )
                  }
                  style={campo}
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
                      {orden.cantidad_producto}
                    </option>
                  ))}
                </select>
              </label>

              <label style={etiqueta}>
                Operación disponible
                <select
                  value={operacionId}
                  onChange={evento =>
                    setOperacionId(
                      evento.target.value
                    )
                  }
                  style={campo}
                >
                  <option value="">
                    Seleccionar operación
                  </option>
                  {disponibles.map(operacion => (
                    <option
                      key={operacion.id}
                      value={operacion.id}
                    >
                      {operacion.operacion_codigo}
                      {" - "}
                      {operacion.operacion_nombre}
                      {" · pendiente "}
                      {operacion.cantidad_pendiente}
                    </option>
                  ))}
                </select>
              </label>

              {ordenId &&
                disponibles.length === 0 && (
                  <div style={{
                    background: "#FFFBEB",
                    color: "#92400E",
                    padding: 9,
                    borderRadius: 8
                  }}>
                    Esta OT no tiene operaciones
                    habilitadas en este momento.
                  </div>
                )}

              <label style={etiqueta}>
                Código operario
                <input
                  value={operarioCodigo}
                  onChange={evento =>
                    setOperarioCodigo(
                      evento.target.value
                    )
                  }
                  placeholder="OP0001"
                  style={campo}
                />
              </label>

              <label style={etiqueta}>
                Nombre operario
                <input
                  value={operarioNombre}
                  onChange={evento =>
                    setOperarioNombre(
                      evento.target.value
                    )
                  }
                  placeholder="Nombre completo"
                  style={campo}
                />
              </label>

              <button
                type="submit"
                disabled={
                  guardando ||
                  !operacionSeleccionada
                }
                style={{
                  ...campo,
                  border: "none",
                  background: "#EA580C",
                  color: "white",
                  fontWeight: "bold",
                  cursor: guardando
                    ? "wait"
                    : "pointer"
                }}
              >
                Iniciar sesión productiva
              </button>
            </div>
          </form>

          <div style={{
            display: "grid",
            gap: 20
          }}>
            <section style={tarjeta}>
              <h2 style={{ marginTop: 0 }}>
                Sesiones activas ({sesiones.length})
              </h2>

              {cargando ? (
                <p>Cargando...</p>
              ) : sesiones.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay sesiones activas.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 9
                }}>
                  {sesiones.map(sesion => (
                    <button
                      type="button"
                      key={sesion.id}
                      onClick={() =>
                        setSesionId(sesion.id)
                      }
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 9,
                        border:
                          sesion.id === sesionId
                            ? "2px solid #EA580C"
                            : "1px solid #E2E8F0",
                        background: "white",
                        cursor: "pointer"
                      }}
                    >
                      <strong>
                        {sesion.ot_codigo}
                        {" · "}
                        {sesion.operacion_codigo}
                      </strong>
                      <div style={{
                        color: "#475569",
                        marginTop: 4
                      }}>
                        {sesion.operacion_nombre}
                      </div>
                      <div style={{
                        color: "#64748B",
                        marginTop: 3
                      }}>
                        {sesion.operario_codigo}
                        {" - "}
                        {sesion.operario_nombre}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {sesionSeleccionada && (
              <form
                onSubmit={reportar}
                style={tarjeta}
              >
                <h2 style={{ marginTop: 0 }}>
                  Finalizar turno
                </h2>
                <p style={{ color: "#475569" }}>
                  {sesionSeleccionada.ot_codigo}
                  {" · "}
                  {
                    sesionSeleccionada
                      .operacion_codigo
                  }
                  {" · "}
                  {
                    sesionSeleccionada
                      .operario_nombre
                  }
                </p>

                <div style={{
                  display: "grid",
                  gap: 12
                }}>
                  <label style={etiqueta}>
                    Cantidad OK
                    <input
                      type="number"
                      min="0"
                      value={reporte.cantidad_ok}
                      onChange={evento =>
                        actualizarReporte(
                          "cantidad_ok",
                          evento.target.value
                        )
                      }
                      style={campo}
                    />
                  </label>
                  <label style={etiqueta}>
                    Merma / cantidad defectuosa
                    <input
                      type="number"
                      min="0"
                      value={
                        reporte
                          .cantidad_defectuosa
                      }
                      onChange={evento =>
                        actualizarReporte(
                          "cantidad_defectuosa",
                          evento.target.value
                        )
                      }
                      style={campo}
                    />
                  </label>
                  {(
                    Number(
                      reporte.cantidad_defectuosa ||
                      0
                    ) > 0 ||
                    Number(
                      reporte.cantidad_reproceso ||
                      0
                    ) > 0
                  ) && (
                    <>
                      <label style={etiqueta}>
                        Defecto detectado
                        <select
                          value={reporte.defecto_id}
                          onChange={evento =>
                            actualizarReporte(
                              "defecto_id",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar defecto
                          </option>
                          {defectos.map(item => (
                            <option
                              key={item.id}
                              value={item.id}
                            >
                              {item.codigo}
                              {" - "}
                              {item.nombre}
                              {" · "}
                              {item.severidad}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={etiqueta}>
                        Causa probable
                        <select
                          value={reporte.causa_id}
                          onChange={evento =>
                            actualizarReporte(
                              "causa_id",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar causa
                          </option>
                          {causas.map(item => (
                            <option
                              key={item.id}
                              value={item.id}
                            >
                              {item.codigo}
                              {" - "}
                              {item.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  <label style={etiqueta}>
                    Cantidad a reproceso
                    <input
                      type="number"
                      min="0"
                      value={
                        reporte
                          .cantidad_reproceso
                      }
                      onChange={evento =>
                        actualizarReporte(
                          "cantidad_reproceso",
                          evento.target.value
                        )
                      }
                      style={campo}
                    />
                  </label>
                  <label style={etiqueta}>
                    Observación
                    <textarea
                      value={reporte.observacion}
                      onChange={evento =>
                        actualizarReporte(
                          "observacion",
                          evento.target.value
                        )
                      }
                      style={{
                        ...campo,
                        minHeight: 80
                      }}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={guardando}
                    style={{
                      ...campo,
                      border: "none",
                      background: "#15803D",
                      color: "white",
                      fontWeight: "bold",
                      cursor: guardando
                        ? "wait"
                        : "pointer"
                    }}
                  >
                    Registrar y finalizar sesión
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EjecucionProduccionV2;
