import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  calcularCapacidadRecursos,
  construirGuiaValidacionCapacidad,
  construirMensajeGuardadoCapacidad,
  evaluarCompletitudCapacidad,
  extraerSubprocesosOperaciones,
  guardarCapacidadProceso,
  listarHistorialCapacidad,
  listarCapacidadesProceso,
  reemplazarCapacidad,
  validarCapacidadProceso
} from "./capacidadRepository";
import {
  listarOperacionesOT,
  listarOrdenesV2
} from "../ordenes/ordenesRepository";

const estadoInicial = {
  proceso_id: "",
  proceso_nombre: "",
  subproceso_id: "",
  subproceso_nombre: "",
  maquinas_disponibles: 1,
  operarios_disponibles_turno: 1,
  operarios_por_recurso: 1,
  disponibilidad_pct: 100,
  motivo: "",
  datos_validados: false
};

const campo = {
  width: "100%",
  padding: 11,
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 15
};

function CapacidadProcesosV2({
  db,
  perfil,
  onVolver,
  textoVolver = "Volver a Ingeniería",
  contextoInicial = null
}) {
  const plantas = useMemo(
    () => perfil.planta_ids || [],
    [perfil.planta_ids]
  );
  const [plantaId, setPlantaId] = useState(
    plantas[0] || ""
  );
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [capacidades, setCapacidades] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [ordenReferenciaId,
    setOrdenReferenciaId] = useState("");
  const [subprocesosReferencia,
    setSubprocesosReferencia] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial,
    setCargandoHistorial] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        capacidadesData,
        ordenesData
      ] = await Promise.all([
        listarCapacidadesProceso(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarOrdenesV2(
          db,
          perfil.empresa_id,
          plantaId
        )
      ]);
      setCapacidades(capacidadesData);
      setOrdenes(ordenesData);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar la capacidad."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id, plantaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!contextoInicial) {
      return;
    }

    let cancelado = false;
    const plantaContexto =
      contextoInicial.planta_id || plantas[0] || "";

    if (plantaContexto) {
      setPlantaId(plantaContexto);
    }
    if (contextoInicial.ot_id) {
      setOrdenReferenciaId(contextoInicial.ot_id);
    }

    setFormulario(actual => ({
      ...actual,
      proceso_id:
        contextoInicial.proceso_id ||
        actual.proceso_id,
      proceso_nombre:
        contextoInicial.proceso_nombre ||
        actual.proceso_nombre,
      subproceso_id:
        contextoInicial.subproceso_id ||
        actual.subproceso_id,
      subproceso_nombre:
        contextoInicial.subproceso_nombre ||
        actual.subproceso_nombre,
      motivo: actual.motivo ||
        "Configuracion desde planificador"
    }));
    setMensaje(
      contextoInicial.subproceso_id
        ? `${contextoInicial.subproceso_id} cargado desde el planificador.`
        : "Contexto cargado desde el planificador."
    );

    const completarDesdeOT = async () => {
      if (
        !contextoInicial.ot_id ||
        !contextoInicial.subproceso_id ||
        !plantaContexto
      ) {
        return;
      }

      try {
        const operaciones =
          await listarOperacionesOT(
            db,
            perfil.empresa_id,
            plantaContexto,
            contextoInicial.ot_id
          );
        const subprocesos =
          extraerSubprocesosOperaciones(operaciones);
        const subproceso = subprocesos.find(
          item =>
            item.subproceso_id ===
            contextoInicial.subproceso_id
        );

        if (cancelado) {
          return;
        }

        setSubprocesosReferencia(subprocesos);
        if (subproceso) {
          setFormulario(actual => ({
            ...actual,
            ...subproceso,
            motivo: actual.motivo ||
              "Configuracion desde planificador"
          }));
          setMensaje(
            `${subproceso.subproceso_id} cargado desde ${contextoInicial.ot_codigo || "la OT de referencia"}.`
          );
        }
      } catch (fallo) {
        if (!cancelado) {
          setError(
            fallo?.message ||
            "No se pudo completar el subproceso desde la OT."
          );
        }
      }
    };

    completarDesdeOT();

    return () => {
      cancelado = true;
    };
  }, [
    contextoInicial,
    db,
    perfil.empresa_id,
    plantas
  ]);

  const calculo = useMemo(
    () => calcularCapacidadRecursos({
      maquinasDisponibles:
        formulario.maquinas_disponibles,
      operariosDisponibles:
        formulario.operarios_disponibles_turno,
      operariosPorRecurso:
        formulario.operarios_por_recurso,
      disponibilidadPct:
        formulario.disponibilidad_pct
    }),
    [formulario]
  );
  const completitud = useMemo(
    () => evaluarCompletitudCapacidad(
      subprocesosReferencia,
      capacidades
    ),
    [capacidades, subprocesosReferencia]
  );
  const guiaValidacion = useMemo(
    () => construirGuiaValidacionCapacidad({
      datos: formulario,
      calculo,
      completitud,
      desdePlanificador: Boolean(contextoInicial)
    }),
    [
      calculo,
      completitud,
      contextoInicial,
      formulario
    ]
  );

  const actualizar = (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarOrdenReferencia = async (
    otId
  ) => {
    setOrdenReferenciaId(otId);
    setSubprocesosReferencia([]);
    setError("");
    setMensaje("");

    if (!otId) {
      return;
    }

    try {
      const operaciones =
        await listarOperacionesOT(
          db,
          perfil.empresa_id,
          plantaId,
          otId
        );

      setSubprocesosReferencia(
        extraerSubprocesosOperaciones(operaciones)
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron leer los subprocesos de la OT."
      );
    }
  };

  const seleccionarSubproceso = codigo => {
    const subproceso =
      subprocesosReferencia.find(
        item => item.subproceso_id === codigo
      );

    if (!subproceso) {
      return;
    }

    setFormulario(actual => ({
      ...actual,
      ...subproceso
    }));
    setError("");
    setMensaje(
      `${codigo} cargado desde la OT de referencia.`
    );
  };

  const editar = async capacidad => {
    setFormulario({
      proceso_id: capacidad.proceso_id || "",
      proceso_nombre:
        capacidad.proceso_nombre || "",
      subproceso_id:
        capacidad.subproceso_id || "",
      subproceso_nombre:
        capacidad.subproceso_nombre || "",
      maquinas_disponibles:
        capacidad.maquinas_disponibles || 1,
      operarios_disponibles_turno:
        capacidad
          .operarios_disponibles_turno || 1,
      operarios_por_recurso:
        capacidad.operarios_por_recurso || 1,
      disponibilidad_pct:
        capacidad.disponibilidad_pct || 100,
      motivo: "",
      datos_validados:
        capacidad.estado_datos === "validada"
    });
    setMensaje(
      `Editando ${capacidad.subproceso_id}.`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      setCargandoHistorial(true);
      setHistorial(
        await listarHistorialCapacidad(
          db,
          capacidad.id
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar el historial."
      );
    } finally {
      setCargandoHistorial(false);
    }
  };

  const guardar = async evento => {
    evento.preventDefault();
    const datos = {
      ...formulario,
      planta_id: plantaId
    };
    const errores = validarCapacidadProceso(datos);

    if (errores.length > 0) {
      setError(errores.join(" "));
      return;
    }

    try {
      setGuardando(true);
      setError("");
      const capacidadGuardada =
        await guardarCapacidadProceso({
          db,
          perfil,
          plantaId,
          datos
        });
      const capacidadesActualizadas =
        reemplazarCapacidad(
          capacidades,
          capacidadGuardada
        );
      const completitudActualizada =
        evaluarCompletitudCapacidad(
          subprocesosReferencia,
          capacidadesActualizadas
        );

      setFormulario(estadoInicial);
      setHistorial([]);
      setMensaje(
        construirMensajeGuardadoCapacidad({
          capacidad: capacidadGuardada,
          completitud: completitudActualizada
        })
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la capacidad."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: 24,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1100,
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
          {textoVolver}
        </button>

        <h1 style={{ marginBottom: 4 }}>
          Capacidad por proceso V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Define recursos paralelos y dotación por
          turno. El estándar representa la producción
          por hora de una máquina, línea o puesto.
        </p>

        <label style={{
          display: "block",
          maxWidth: 300,
          marginBottom: 18,
          fontWeight: "bold"
        }}>
          Planta
          <select
            value={plantaId}
            onChange={evento => {
              setPlantaId(evento.target.value);
              setFormulario(estadoInicial);
              setOrdenReferenciaId("");
              setSubprocesosReferencia([]);
            }}
            style={{ ...campo, marginTop: 6 }}
          >
            {plantas.map(planta => (
              <option key={planta} value={planta}>
                {planta.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <div style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            padding: 12,
            borderRadius: 8,
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
            borderRadius: 8,
            marginBottom: 14
          }}>
            {mensaje}
          </div>
        )}
        {contextoInicial && (
          <div style={{
            background: "#EFF6FF",
            color: "#1D4ED8",
            padding: 12,
            borderRadius: 8,
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <span>
              Estás configurando la capacidad solicitada
              por el planificador. Al terminar, vuelve
              para recalcular la decisión.
            </span>
            <button
              type="button"
              onClick={onVolver}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 11px",
                background: "#1D4ED8",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Revisar decisión en el Planificador
            </button>
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 22,
          alignItems: "start"
        }}>
          <form
            onSubmit={guardar}
            style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)",
              display: "grid",
              gap: 13
            }}
          >
            <h2 style={{ margin: 0 }}>
              Configurar subproceso
            </h2>
            <label>
              OT de referencia
              <select
                value={ordenReferenciaId}
                onChange={evento =>
                  seleccionarOrdenReferencia(
                    evento.target.value
                  )
                }
                style={{ ...campo, marginTop: 5 }}
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
                    {orden.producto_nombre}
                  </option>
                ))}
              </select>
            </label>
            {ordenReferenciaId && (
              <>
              <label>
                Subproceso encontrado
                <select
                  value=""
                  onChange={evento =>
                    seleccionarSubproceso(
                      evento.target.value
                    )
                  }
                  style={{ ...campo, marginTop: 5 }}
                >
                  <option value="">
                    Seleccionar subproceso
                  </option>
                  {subprocesosReferencia.map(
                    subproceso => (
                      <option
                        key={
                          subproceso.subproceso_id
                        }
                        value={
                          subproceso.subproceso_id
                        }
                      >
                        {subproceso.subproceso_id}
                        {" - "}
                        {
                          subproceso
                            .subproceso_nombre
                        }
                      </option>
                    )
                  )}
                </select>
                {subprocesosReferencia.length ===
                  0 && (
                  <small style={{
                    display: "block",
                    color: "#B45309",
                    marginTop: 5
                  }}>
                    La OT no contiene subprocesos V2.
                  </small>
                )}
              </label>
              {subprocesosReferencia.length > 0 && (
                <div style={{
                  padding: 11,
                  borderRadius: 8,
                  background: completitud.completa
                    ? "#F0FDF4"
                    : "#FFFBEB",
                  color: completitud.completa
                    ? "#166534"
                    : "#92400E"
                }}>
                  <strong>
                    Preparación de la OT:{" "}
                    {completitud.validadas}/
                    {completitud.total}
                    {" capacidades validadas"}
                  </strong>
                  <div style={{ marginTop: 4 }}>
                    {completitud.provisionales}
                    {" provisionales · "}
                    {completitud.faltantes}
                    {" faltantes"}
                  </div>
                </div>
              )}
              </>
            )}
            {[
              ["proceso_id", "Código proceso", "PR0001"],
              [
                "proceso_nombre",
                "Nombre proceso",
                "Corte"
              ],
              [
                "subproceso_id",
                "Código subproceso",
                "SP0003"
              ],
              [
                "subproceso_nombre",
                "Nombre subproceso",
                "Corte láser fibra tubo"
              ]
            ].map(([nombre, etiqueta, ejemplo]) => (
              <label key={nombre}>
                {etiqueta}
                <input
                  value={formulario[nombre]}
                  onChange={evento =>
                    actualizar(
                      nombre,
                      evento.target.value
                    )
                  }
                  placeholder={ejemplo}
                  style={{ ...campo, marginTop: 5 }}
                />
              </label>
            ))}
            {[
              [
                "maquinas_disponibles",
                "Máquinas, líneas o puestos disponibles"
              ],
              [
                "operarios_disponibles_turno",
                "Operarios disponibles por turno"
              ],
              [
                "operarios_por_recurso",
                "Operarios necesarios por recurso"
              ],
              [
                "disponibilidad_pct",
                "Disponibilidad esperada (%)"
              ]
            ].map(([nombre, etiqueta]) => (
              <label key={nombre}>
                {etiqueta}
                <input
                  type="number"
                  min="1"
                  max={
                    nombre === "disponibilidad_pct"
                      ? "100"
                      : undefined
                  }
                  step="1"
                  value={formulario[nombre]}
                  onChange={evento =>
                    actualizar(
                      nombre,
                      evento.target.value
                    )
                  }
                  style={{ ...campo, marginTop: 5 }}
                />
              </label>
            ))}
            <label>
              Motivo del cambio
              <textarea
                rows={3}
                value={formulario.motivo}
                onChange={evento =>
                  actualizar(
                    "motivo",
                    evento.target.value
                  )
                }
                placeholder="Capacidad inicial, incorporación de máquina o ajuste de dotación."
                style={{ ...campo, marginTop: 5 }}
              />
              <small style={{
                display: "block",
                color: "#64748B",
                marginTop: 4
              }}>
                Obligatorio. Mínimo 10 caracteres.
              </small>
            </label>
            <label style={{
              display: "flex",
              gap: 9,
              alignItems: "flex-start",
              padding: 11,
              borderRadius: 8,
              background: "#F8FAFC"
            }}>
              <input
                type="checkbox"
                checked={formulario.datos_validados}
                onChange={evento =>
                  actualizar(
                    "datos_validados",
                    evento.target.checked
                  )
                }
              />
              <span>
                <strong>
                  Datos verificados en planta
                </strong>
                <small style={{
                  display: "block",
                  color: "#64748B",
                  marginTop: 3
                }}>
                  Márcalo solo si máquinas, dotación y
                  disponibilidad fueron verificadas. Sin
                  confirmar se guardará como provisional.
                </small>
              </span>
            </label>

            <div style={{
              padding: 12,
              borderRadius: 9,
              background: "#EFF6FF",
              color: "#1E3A8A"
            }}>
              Capacidad efectiva:{" "}
              <strong>
                {calculo.recursos_paralelos}
                {" recursos en paralelo × "}
                {calculo.disponibilidad_pct}%
                {" = "}
                {calculo.factor_capacidad.toFixed(2)}
                {" veces el estándar"}
              </strong>
              <div style={{ marginTop: 5 }}>
                Dotación usada por turno:{" "}
                {calculo.operarios_requeridos_turno}
                {" operarios."}
              </div>
            </div>

            <div style={{
              padding: 12,
              borderRadius: 9,
              background:
                guiaValidacion.estado === "validada"
                  ? "#ECFDF5"
                  : "#FFF7ED",
              color:
                guiaValidacion.estado === "validada"
                  ? "#065F46"
                  : "#9A3412"
            }}>
              <strong>{guiaValidacion.titulo}</strong>
              <div style={{ marginTop: 6 }}>
                <strong>Subproceso:</strong>
                {" "}
                {guiaValidacion.subproceso}
              </div>
              <div style={{ marginTop: 5 }}>
                <strong>Estándar actual:</strong>
                {" "}
                {guiaValidacion.estandar_actual}
              </div>
              <div style={{ marginTop: 5 }}>
                <strong>Capacidad por turno:</strong>
                {" "}
                {guiaValidacion.capacidad_turno}
              </div>
              <div style={{ marginTop: 5 }}>
                <strong>Dotación:</strong>
                {" "}
                {guiaValidacion.dotacion_turno}
              </div>
              <div style={{ marginTop: 5 }}>
                <strong>Impacto:</strong>
                {" "}
                {
                  guiaValidacion
                    .impacto_planificador
                }
              </div>
              <div style={{ marginTop: 5 }}>
                <strong>OT de referencia:</strong>
                {" "}
                {guiaValidacion.estado_referencia}
              </div>
              <ul style={{
                margin: "8px 0 0 18px",
                padding: 0
              }}>
                {guiaValidacion.advertencias.map(
                  advertencia => (
                    <li key={advertencia}>
                      {advertencia}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div style={{
              padding: 12,
              borderRadius: 9,
              background:
                formulario.datos_validados
                  ? "#F0FDF4"
                  : "#FFFBEB",
              color:
                formulario.datos_validados
                  ? "#166534"
                  : "#92400E"
            }}>
              <strong>
                {formulario.datos_validados
                  ? "Esta capacidad habilitará recomendaciones."
                  : "Capacidad provisional."}
              </strong>
              <div style={{ marginTop: 5 }}>
                {formulario.datos_validados
                  ? "El planificador podrá usar estos datos para comparar 2 turnos contra 3 turnos."
                  : "Se puede guardar para avanzar, pero el planificador pedirá validarla antes de sugerir turnos."}
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              style={{
                border: "none",
                borderRadius: 8,
                padding: 12,
                background: "#0F766E",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {guardando
                ? "Guardando..."
                : "Guardar capacidad"}
            </button>
          </form>

          <section style={{
            background: "white",
            padding: 22,
            borderRadius: 14,
            boxShadow:
              "0 2px 10px rgba(15,23,42,0.08)"
          }}>
            <h2 style={{ marginTop: 0 }}>
              Capacidades configuradas
            </h2>
            {cargando ? (
              <p>Cargando...</p>
            ) : capacidades.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Aún no hay subprocesos configurados.
                El simulador usará un recurso al 100%.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10
              }}>
                {capacidades.map(capacidad => (
                  <button
                    key={capacidad.id}
                    type="button"
                    onClick={() => editar(capacidad)}
                    style={{
                      textAlign: "left",
                      border: "1px solid #E2E8F0",
                      borderRadius: 9,
                      padding: 12,
                      background: "white",
                      cursor: "pointer"
                    }}
                  >
                    <strong>
                      {capacidad.subproceso_id}
                      {" - "}
                      {capacidad.subproceso_nombre}
                    </strong>
                    <div style={{
                      color: "#475569",
                      marginTop: 5
                    }}>
                      {capacidad.recursos_paralelos}
                      {" recursos paralelos · "}
                      {
                        capacidad
                          .operarios_requeridos_turno
                      }
                      {" operarios/turno · "}
                      {capacidad.disponibilidad_pct}%
                      {" disponibilidad"}
                    </div>
                    <div style={{
                      marginTop: 5,
                      color:
                        capacidad.estado_datos ===
                          "validada"
                          ? "#166534"
                          : "#B45309",
                      fontWeight: "bold",
                      fontSize: 13
                    }}>
                      {capacidad.estado_datos ===
                        "validada"
                        ? "Datos validados en planta"
                        : "Datos provisionales"}
                    </div>
                    {capacidad.estado_datos !==
                      "validada" && (
                      <small style={{
                        display: "block",
                        color: "#92400E",
                        marginTop: 4
                      }}>
                        No se usará para recomendar 3er
                        turno hasta validarla.
                      </small>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {(cargandoHistorial ||
          historial.length > 0) && (
          <section style={{
            background: "white",
            padding: 22,
            borderRadius: 14,
            boxShadow:
              "0 2px 10px rgba(15,23,42,0.08)",
            marginTop: 22
          }}>
            <h2 style={{ marginTop: 0 }}>
              Historial de capacidad
            </h2>
            {cargandoHistorial ? (
              <p>Cargando historial...</p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10
              }}>
                {historial.map(item => {
                  const fecha =
                    item.actualizado_en?.toDate
                      ? item.actualizado_en.toDate()
                      : new Date(
                        item.actualizado_en || 0
                      );
                  const nuevos =
                    item.valores_nuevos || {};

                  return (
                    <article
                      key={item.id}
                      style={{
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 9,
                        padding: 12
                      }}
                    >
                      <strong>
                        {item.tipo_cambio ===
                          "creacion"
                          ? "Creación"
                          : "Actualización"}
                        {" · "}
                        {Number.isNaN(fecha.getTime())
                          ? "-"
                          : fecha.toLocaleString(
                            "es-CL"
                          )}
                      </strong>
                      <div style={{
                        color: "#475569",
                        marginTop: 5
                      }}>
                        {item.motivo}
                      </div>
                      <div style={{
                        color: "#0369A1",
                        marginTop: 5,
                        fontSize: 14
                      }}>
                        {nuevos.maquinas_disponibles}
                        {" recursos · "}
                        {
                          nuevos
                            .operarios_disponibles_turno
                        }
                        {" operarios/turno · "}
                        {nuevos.disponibilidad_pct}%
                        {" disponibilidad · "}
                        {item.actualizado_por_nombre}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default CapacidadProcesosV2;
