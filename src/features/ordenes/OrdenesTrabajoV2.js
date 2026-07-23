import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  listarProductos
} from "../productos/productosRepository";
import {
  TIPOS_TERCERO,
  listarTerceros
} from "../terceros/tercerosRepository";
import {
  listarSubproductos
} from "../subproductos/subproductosRepository";
import {
  listarCapacidadesProceso
} from "../capacidad/capacidadRepository";
import {
  listarOcupacionesOperarios,
  listarProgramacionSemanal,
  lunesDeSemana
} from "../turnos/turnosRepository";
import {
  CALENDARIOS_PLANTA,
  actualizarFechaEntregaOrdenV2,
  calcularProyeccionOT,
  cerrarOrdenTrabajoV2,
  crearOrdenV2,
  guardarConfiguracionCapacidad,
  listarOperacionesOT,
  listarOrdenesV2,
  listarSesionesActivasOT,
  obtenerConfiguracionCapacidad,
  horasSemanalesCalendario,
  horasSemanalesTercerTurno,
  simularTurnosOT,
  validarCierreFormalOT,
  validarDatosOrden
} from "./ordenesRepository";

const formularioInicial = {
  planta_id: "",
  cliente_id: "",
  cliente_codigo: "",
  cliente_nombre: "",
  producto_id: "",
  cantidad_producto: "",
  fecha_inicio: "",
  fecha_entrega: ""
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

const fechaVisible = (valor) => {
  if (!valor) {
    return "-";
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? "-"
    : fecha.toLocaleDateString("es-CL");
};

const fechaHoraVisible = (valor) => {
  if (!valor) {
    return "-";
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? "-"
    : fecha.toLocaleString("es-CL", {
      dateStyle: "short",
      timeStyle: "short"
    });
};

const fechaParaInput = (valor) => {
  if (!valor) {
    return "";
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? ""
    : fecha.toISOString().slice(0, 10);
};

const horasVisible = (valor) => {
  const horas = Number(valor || 0);

  if (horas < 1) {
    return `${Math.round(horas * 60)} min`;
  }

  return `${horas.toFixed(1)} h`;
};

function OrdenesTrabajoV2({
  db,
  perfil,
  onVolver
}) {
  const plantas = perfil.planta_ids || [];
  const [formulario, setFormulario] = useState({
    ...formularioInicial,
    planta_id: plantas[0] || ""
  });
  const [productos, setProductos] = useState([]);
  const [subproductos, setSubproductos] =
    useState([]);
  const [clientes, setClientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] =
    useState(null);
  const [operaciones, setOperaciones] = useState([]);
  const [sesionesActivasOT, setSesionesActivasOT] =
    useState([]);
  const [capacidadesProceso,
    setCapacidadesProceso] = useState([]);
  const [programacionTurnos,
    setProgramacionTurnos] = useState([]);
  const [operariosOcupados,
    setOperariosOcupados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [fechaEntregaEdicion,
    setFechaEntregaEdicion] = useState("");
  const [cierreObservacion,
    setCierreObservacion] = useState("");
  const [cerrandoOT, setCerrandoOT] =
    useState(false);
  const [guardandoFechaEntrega,
    setGuardandoFechaEntrega] = useState(false);
  const [configuracionCapacidad,
    setConfiguracionCapacidad] = useState({
      turnos_base: 2,
      turnos_ampliados: 3,
      horas_tercer_turno: 8
    });

  const productosPublicados = useMemo(
    () => {
      const subproductosPorId = new Map(
        subproductos.map(subproducto => [
          subproducto.id,
          subproducto
        ])
      );

      return productos.filter(producto => {
        if (!producto.activo) {
          return false;
        }

        if (producto.version_ruta_activa) {
          return true;
        }

        const subproductosComposicion =
          (producto.composicion || [])
            .filter(item =>
              item.tipo === "SUBPRODUCTO"
            );

        if (subproductosComposicion.length === 0) {
          return false;
        }

        return subproductosComposicion
          .every(item => {
            if (item.tipo !== "SUBPRODUCTO") {
              return false;
            }

            const subproducto =
              subproductosPorId.get(item.item_id);
            return Boolean(
              subproducto?.activo !== false &&
              subproducto?.version_ruta_activa
            );
          });
      });
    },
    [productos, subproductos]
  );

  const productoSeleccionado =
    productosPublicados.find(
      producto =>
        producto.id === formulario.producto_id
    );
  const proyeccionSeleccionada = useMemo(
    () => {
      const inicio =
        ordenSeleccionada
          ?.fecha_planificada_inicio;
      const inicioFecha = inicio
        ? (
          typeof inicio.toDate === "function"
            ? inicio.toDate()
            : new Date(inicio)
        )
        : new Date();

      return calcularProyeccionOT(
        operaciones,
        inicioFecha > new Date()
          ? inicioFecha
          : new Date()
      );
    },
    [operaciones, ordenSeleccionada]
  );
  const entregaPlanificada =
    ordenSeleccionada
      ?.fecha_planificada_entrega;
  const entregaFecha = entregaPlanificada
    ? (
      typeof entregaPlanificada.toDate ===
      "function"
        ? entregaPlanificada.toDate()
        : new Date(entregaPlanificada)
    )
    : null;
  const fechaEstimada =
    ordenSeleccionada?.fecha_estimada_fin
      ? (
        typeof ordenSeleccionada
          .fecha_estimada_fin.toDate ===
        "function"
          ? ordenSeleccionada
            .fecha_estimada_fin.toDate()
          : new Date(
            ordenSeleccionada.fecha_estimada_fin
          )
      )
      : proyeccionSeleccionada
        .fecha_estimada_fin;
  const riesgoAtraso = Boolean(
    entregaFecha &&
    fechaEstimada &&
    fechaEstimada > entregaFecha
  );
  const pendienteDeEstandar = operaciones.some(
    operacion =>
      Number(
        operacion.cantidad_pendiente || 0
      ) > 0 &&
      Number(
        operacion.unidades_por_hora || 0
      ) <= 0
  );
  const validacionCierre = useMemo(
    () => validarCierreFormalOT({
      orden: ordenSeleccionada || {},
      operaciones,
      sesionesActivas: sesionesActivasOT
    }),
    [
      operaciones,
      ordenSeleccionada,
      sesionesActivasOT
    ]
  );
  const simulacionTurnos = useMemo(
    () => simularTurnosOT(
      operaciones,
      {
        plantaId: formulario.planta_id,
        horasTercerTurno:
          configuracionCapacidad
            .horas_tercer_turno,
        fechaReferencia: new Date(),
        capacidades: capacidadesProceso,
        programacionTurnos,
        operariosOcupados
      }
    ),
    [
      configuracionCapacidad,
      capacidadesProceso,
      programacionTurnos,
      operariosOcupados,
      formulario.planta_id,
      operaciones
    ]
  );

  const cargarOrdenes = useCallback(
    async (plantaId) => {
      if (!plantaId) {
        setOrdenes([]);
        return;
      }

      setOrdenes(
        await listarOrdenesV2(
          db,
          perfil.empresa_id,
          plantaId
        )
      );
      setConfiguracionCapacidad(
        await obtenerConfiguracionCapacidad(
          db,
          perfil.empresa_id,
          plantaId
        )
      );
      setCapacidadesProceso(
        await listarCapacidadesProceso(
          db,
          perfil.empresa_id,
          plantaId
        )
      );
      setProgramacionTurnos(
        await listarProgramacionSemanal(
          db,
          perfil.empresa_id,
          plantaId,
          lunesDeSemana()
        )
      );
      setOperariosOcupados(
        await listarOcupacionesOperarios(
          db,
          perfil.empresa_id,
          plantaId
        )
      );
    },
    [db, perfil.empresa_id]
  );

  const cargarInicial = useCallback(
    async () => {
      try {
        setCargando(true);
        setError("");
        const [
          productosData,
          clientesData,
          subproductosData
        ] =
          await Promise.all([
            listarProductos(
              db,
              perfil.empresa_id
            ),
            listarTerceros(
              db,
              perfil.empresa_id,
              TIPOS_TERCERO.CLIENTE
            ),
            listarSubproductos(
              db,
              perfil.empresa_id
            )
          ]);
        setProductos(productosData);
        setSubproductos(subproductosData);
        setClientes(
          clientesData.filter(
            cliente => cliente.activo !== false
          )
        );
        await cargarOrdenes(
          formulario.planta_id
        );
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar las OT V2."
        );
      } finally {
        setCargando(false);
      }
    },
    [
      cargarOrdenes,
      db,
      formulario.planta_id,
      perfil.empresa_id
    ]
  );

  useEffect(() => {
    cargarInicial();
  }, [cargarInicial]);

  const actualizar = async (nombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");

    if (nombre === "planta_id") {
      setOrdenSeleccionada(null);
      setOperaciones([]);
      setSesionesActivasOT([]);
      setFechaEntregaEdicion("");
      setCierreObservacion("");

      try {
        await cargarOrdenes(valor);
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar las OT."
        );
      }
    }
  };

  const seleccionarCliente = clienteId => {
    const cliente = clientes.find(
      item => item.id === clienteId
    );

    setFormulario(actual => ({
      ...actual,
      cliente_id: clienteId,
      cliente_codigo: cliente?.codigo || "",
      cliente_nombre: cliente?.nombre || ""
    }));
    setError("");
    setMensaje("");
  };

  const crear = async (evento) => {
    evento.preventDefault();
    const errores = validarDatosOrden({
      plantaId: formulario.planta_id,
      clienteNombre:
        formulario.cliente_nombre,
      producto: productoSeleccionado,
      cantidadProducto:
        formulario.cantidad_producto,
      fechaInicio: formulario.fecha_inicio,
      fechaEntrega: formulario.fecha_entrega
    });

    if (errores.length > 0) {
      setError(errores.join(" "));
      return;
    }

    try {
      setGuardando(true);
      setError("");
      const resultado = await crearOrdenV2({
        db,
        perfil,
        plantaId: formulario.planta_id,
        clienteId: formulario.cliente_id,
        clienteCodigo:
          formulario.cliente_codigo,
        clienteNombre:
          formulario.cliente_nombre,
        producto: productoSeleccionado,
        cantidadProducto:
          formulario.cantidad_producto,
        fechaInicio: formulario.fecha_inicio,
        fechaEntrega: formulario.fecha_entrega
      });

      setOrdenSeleccionada(resultado.orden);
      setFechaEntregaEdicion(
        fechaParaInput(
          resultado.orden
            .fecha_planificada_entrega
        )
      );
      setOperaciones(resultado.operaciones);
      setSesionesActivasOT([]);
      setCierreObservacion("");
      setMensaje(
        `${resultado.orden.codigo} creada con ${resultado.operaciones.length} operaciones.`
      );
      setFormulario(actual => ({
        ...formularioInicial,
        planta_id: actual.planta_id
      }));
      await cargarOrdenes(
        resultado.orden.planta_id
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo crear la OT."
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirOrden = async (orden) => {
    try {
      setError("");
      setOrdenSeleccionada(orden);
      setFechaEntregaEdicion(
        fechaParaInput(
          orden.fecha_planificada_entrega
        )
      );
      setCierreObservacion(
        orden.cierre_observacion || ""
      );
      const [
        operacionesOrden,
        sesionesActivas
      ] = await Promise.all([
        listarOperacionesOT(
          db,
          perfil.empresa_id,
          orden.planta_id,
          orden.id
        ),
        listarSesionesActivasOT(
          db,
          perfil.empresa_id,
          orden.planta_id,
          orden.id
        )
      ]);
      setOperaciones(operacionesOrden);
      setSesionesActivasOT(
        sesionesActivas
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar las operaciones."
      );
    }
  };

  const guardarFechaEntrega = async () => {
    try {
      setGuardandoFechaEntrega(true);
      setError("");
      const actualizada =
        await actualizarFechaEntregaOrdenV2({
          db,
          orden: ordenSeleccionada,
          fechaEntrega: fechaEntregaEdicion
        });

      setOrdenSeleccionada(actualizada);
      setOrdenes(actual =>
        actual.map(orden =>
          orden.id === actualizada.id
            ? actualizada
            : orden
        )
      );
      setMensaje(
        "Fecha de entrega planificada actualizada."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo actualizar la fecha de entrega."
      );
    } finally {
      setGuardandoFechaEntrega(false);
    }
  };

  const cerrarFormalmenteOT = async () => {
    if (!ordenSeleccionada) {
      return;
    }

    try {
      setCerrandoOT(true);
      setError("");
      const actualizada =
        await cerrarOrdenTrabajoV2({
          db,
          perfil,
          orden: ordenSeleccionada,
          operaciones,
          observacion: cierreObservacion
        });

      setOrdenSeleccionada(actualizada);
      setOrdenes(actual =>
        actual.map(orden =>
          orden.id === actualizada.id
            ? actualizada
            : orden
        )
      );
      setSesionesActivasOT([]);
      setMensaje(
        `${actualizada.codigo} cerrada formalmente.`
      );
      await cargarOrdenes(actualizada.planta_id);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cerrar formalmente la OT."
      );
    } finally {
      setCerrandoOT(false);
    }
  };

  const guardarCapacidad = async () => {
    try {
      setGuardando(true);
      const guardada =
        await guardarConfiguracionCapacidad({
          db,
          perfil,
          plantaId: formulario.planta_id,
          horasTercerTurno:
            configuracionCapacidad
              .horas_tercer_turno
        });
      setConfiguracionCapacidad(guardada);
      setMensaje(
        "Capacidad por turnos guardada para la planta."
      );
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
      padding: 22,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver a Operación
        </BotonVolver>

        <h1 style={{ marginBottom: 4 }}>
          Órdenes de trabajo V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Crea una OT desde una ruta publicada y
          congela sus cantidades productivas.
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
            "repeat(auto-fit, minmax(330px, 1fr))",
          gap: 20,
          alignItems: "start"
        }}>
          <div style={{
            display: "grid",
            gap: 20
          }}>
            <form
              onSubmit={crear}
              style={tarjeta}
            >
              <h2 style={{ marginTop: 0 }}>
                Nueva OT V2
              </h2>

              <div style={{
                display: "grid",
                gap: 12
              }}>
                <label style={etiqueta}>
                  Planta
                  <select
                    value={formulario.planta_id}
                    onChange={evento =>
                      actualizar(
                        "planta_id",
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
                  Cliente
                  <select
                    value={
                      formulario.cliente_id
                    }
                    onChange={evento =>
                      seleccionarCliente(
                        evento.target.value
                      )
                    }
                    style={campo}
                  >
                    <option value="">
                      Seleccionar cliente
                    </option>
                    {clientes.map(cliente => (
                      <option
                        key={cliente.id}
                        value={cliente.id}
                      >
                        {cliente.codigo}
                        {" - "}
                        {cliente.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                {clientes.length === 0 &&
                  !cargando && (
                    <div style={{
                      color: "#92400E",
                      background: "#FFFBEB",
                      padding: 9,
                      borderRadius: 8
                    }}>
                      No existen clientes activos
                      creados en el catálogo.
                    </div>
                  )}

                <label style={etiqueta}>
                  Producto con ruta publicada
                  <select
                    value={formulario.producto_id}
                    onChange={evento =>
                      actualizar(
                        "producto_id",
                        evento.target.value
                      )
                    }
                    style={campo}
                  >
                    <option value="">
                      Seleccionar producto
                    </option>
                    {productosPublicados.map(
                      producto => (
                        <option
                          key={producto.id}
                          value={producto.id}
                        >
                          {producto.codigo}
                          {" - "}
                          {producto.nombre}
                          {" · V"}
                          {
                            producto
                              .version_ruta_activa
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                {productosPublicados.length === 0 &&
                  !cargando && (
                    <div style={{
                      color: "#92400E",
                      background: "#FFFBEB",
                      padding: 9,
                      borderRadius: 8
                    }}>
                      No existen productos con ruta
                      publicada.
                    </div>
                  )}

                <label style={etiqueta}>
                  Cantidad de productos
                  <input
                    type="number"
                    min="1"
                    value={
                      formulario.cantidad_producto
                    }
                    onChange={evento =>
                      actualizar(
                        "cantidad_producto",
                        evento.target.value
                      )
                    }
                    style={campo}
                  />
                </label>

                <label style={etiqueta}>
                  Inicio planificado
                  <input
                    type="date"
                    value={formulario.fecha_inicio}
                    onChange={evento =>
                      actualizar(
                        "fecha_inicio",
                        evento.target.value
                      )
                    }
                    style={campo}
                  />
                </label>

                <label style={etiqueta}>
                  Entrega planificada
                  <input
                    type="date"
                    required
                    value={formulario.fecha_entrega}
                    onChange={evento =>
                      actualizar(
                        "fecha_entrega",
                        evento.target.value
                      )
                    }
                    style={campo}
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    guardando ||
                    productosPublicados.length === 0
                  }
                  style={{
                    ...campo,
                    border: "none",
                    background: "#7C3AED",
                    color: "white",
                    fontWeight: "bold",
                    cursor: guardando
                      ? "wait"
                      : "pointer"
                  }}
                >
                  {guardando
                    ? "Creando OT..."
                    : "Crear y liberar OT"}
                </button>
              </div>
            </form>

            <section style={tarjeta}>
              <h2 style={{ marginTop: 0 }}>
                OT de {formulario.planta_id ||
                  "planta"} ({ordenes.length})
              </h2>

              {cargando ? (
                <p>Cargando...</p>
              ) : ordenes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay OT V2 en esta planta.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 9
                }}>
                  {ordenes.map(orden => (
                    <button
                      type="button"
                      key={orden.id}
                      onClick={() =>
                        abrirOrden(orden)
                      }
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 9,
                        border:
                          orden.id ===
                          ordenSeleccionada?.id
                            ? "2px solid #7C3AED"
                            : "1px solid #E2E8F0",
                        background: "white",
                        cursor: "pointer"
                      }}
                    >
                      <strong>{orden.codigo}</strong>
                      <div style={{
                        color: "#475569",
                        marginTop: 4
                      }}>
                        {orden.producto_codigo}
                        {" - "}
                        {orden.producto_nombre}
                        {" · "}
                        {orden.cantidad_producto}
                        {" productos"}
                      </div>
                      <div style={{
                        color: "#64748B",
                        marginTop: 3
                      }}>
                        {orden.cliente_nombre}
                        {" · "}
                        {orden.estado}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section style={tarjeta}>
            <h2 style={{ marginTop: 0 }}>
              Detalle congelado
            </h2>

            {!ordenSeleccionada ? (
              <p style={{ color: "#64748B" }}>
                Selecciona o crea una OT.
              </p>
            ) : (
              <>
                <h3 style={{ marginBottom: 4 }}>
                  {ordenSeleccionada.codigo}
                </h3>
                <div style={{ color: "#475569" }}>
                  {ordenSeleccionada.producto_codigo}
                  {" - "}
                  {ordenSeleccionada.producto_nombre}
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                  marginTop: 14,
                  marginBottom: 16
                }}>
                  <div>
                    <strong>Cantidad</strong>
                    <div>
                      {
                        ordenSeleccionada
                          .cantidad_producto
                      }
                    </div>
                  </div>
                  <div>
                    <strong>Inicio</strong>
                    <div>
                      {fechaVisible(
                        ordenSeleccionada
                          .fecha_planificada_inicio
                      )}
                    </div>
                  </div>
                  <div>
                    <strong>Entrega</strong>
                    <div>
                      {fechaVisible(
                        ordenSeleccionada
                          .fecha_planificada_entrega
                      )}
                    </div>
                  </div>
                  <div>
                    <strong>Avance</strong>
                    <div>
                      {
                        ordenSeleccionada
                          .avance_pct ??
                        proyeccionSeleccionada
                          .avance_pct
                      }%
                    </div>
                  </div>
                  <div>
                    <strong>Unidades OK</strong>
                    <div>
                      {
                        ordenSeleccionada
                          .cantidad_total_ok ??
                        proyeccionSeleccionada
                          .cantidad_total_ok
                      }
                    </div>
                  </div>
                  <div>
                    <strong>Pendiente</strong>
                    <div>
                      {
                        ordenSeleccionada
                          .cantidad_total_pendiente ??
                        proyeccionSeleccionada
                          .cantidad_total_pendiente
                      }
                    </div>
                  </div>
                  <div>
                    <strong>Tiempo estimado</strong>
                    <div>
                      {pendienteDeEstandar
                        ? "Pendiente de estándar"
                        : horasVisible(
                          ordenSeleccionada
                            .estimado_horas_restantes ??
                          proyeccionSeleccionada
                            .estimado_horas_restantes
                        )}
                    </div>
                  </div>
                  <div>
                    <strong>Fin estimado</strong>
                    <div>
                      {pendienteDeEstandar
                        ? "Pendiente de estándar"
                        : fechaHoraVisible(
                          fechaEstimada
                        )}
                    </div>
                  </div>
                </div>

                <section style={{
                  border:
                    validacionCierre.puede_cerrar
                      ? "1px solid #BBF7D0"
                      : "1px solid #FCA5A5",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                  background:
                    validacionCierre.puede_cerrar
                      ? "#F0FDF4"
                      : "#FEF2F2"
                }}>
                  <h3 style={{
                    marginTop: 0,
                    marginBottom: 6
                  }}>
                    Cierre formal de OT
                  </h3>
                  <div style={{
                    color:
                      validacionCierre.puede_cerrar
                        ? "#166534"
                        : "#B91C1C",
                    fontWeight: "bold",
                    marginBottom: 8
                  }}>
                    {ordenSeleccionada.estado ===
                    "cerrada"
                      ? "Esta OT ya fue cerrada formalmente."
                      : validacionCierre.puede_cerrar
                        ? "La OT cumple condiciones para cierre formal."
                        : "La OT aún no puede cerrarse formalmente."}
                  </div>
                  <div style={{
                    color: "#334155",
                    marginBottom: 10
                  }}>
                    Al cerrar se registrará una recepción
                    de Producto Terminado en Almacén por{" "}
                    <strong>
                      {
                        ordenSeleccionada
                          .cantidad_producto
                      }
                    </strong>
                    {" unidades de "}
                    <strong>
                      {
                        ordenSeleccionada
                          .producto_codigo
                      }
                    </strong>
                    .
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 8,
                    color: "#334155",
                    marginBottom: 10
                  }}>
                    <span>
                      Operaciones:{" "}
                      <strong>
                        {
                          validacionCierre
                            .resumen
                            .operaciones_total
                        }
                      </strong>
                    </span>
                    <span>
                      Pendientes:{" "}
                      <strong>
                        {
                          validacionCierre
                            .resumen
                            .operaciones_pendientes
                        }
                      </strong>
                    </span>
                    <span>
                      Reprocesos:{" "}
                      <strong>
                        {
                          validacionCierre
                            .resumen
                            .reprocesos_pendientes
                        }
                      </strong>
                    </span>
                    <span>
                      Sesiones activas:{" "}
                      <strong>
                        {
                          validacionCierre
                            .resumen
                            .sesiones_activas
                        }
                      </strong>
                    </span>
                  </div>

                  {validacionCierre.bloqueos
                    .length > 0 && (
                    <ul style={{
                      marginTop: 0,
                      color: "#7F1D1D"
                    }}>
                      {validacionCierre.bloqueos
                        .map(bloqueo => (
                          <li key={bloqueo}>
                            {bloqueo}
                          </li>
                        ))}
                    </ul>
                  )}

                  <label style={{
                    ...etiqueta,
                    marginBottom: 10
                  }}>
                    Observación de cierre
                    <textarea
                      rows={3}
                      value={cierreObservacion}
                      onChange={evento =>
                        setCierreObservacion(
                          evento.target.value
                        )
                      }
                      disabled={
                        ordenSeleccionada.estado ===
                        "cerrada"
                      }
                      placeholder="Ej: OT entregada a almacén / producción validada por jefe."
                      style={campo}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={cerrarFormalmenteOT}
                    disabled={
                      cerrandoOT ||
                      !validacionCierre.puede_cerrar ||
                      ordenSeleccionada.estado ===
                        "cerrada"
                    }
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "11px 14px",
                      background:
                        validacionCierre.puede_cerrar &&
                        ordenSeleccionada.estado !==
                          "cerrada"
                          ? "#166534"
                          : "#94A3B8",
                      color: "white",
                      fontWeight: "bold",
                      cursor:
                        validacionCierre.puede_cerrar
                          ? "pointer"
                          : "not-allowed"
                    }}
                  >
                    {cerrandoOT
                      ? "Cerrando..."
                      : "Cerrar OT formalmente"}
                  </button>
                </section>

                <div style={{
                  padding: 12,
                  borderRadius: 9,
                  marginBottom: 16,
                  background: riesgoAtraso
                    ? "#FEF2F2"
                    : entregaFecha
                      ? "#F0FDF4"
                      : "#EFF6FF",
                  color: riesgoAtraso
                    ? "#B91C1C"
                    : entregaFecha
                      ? "#166534"
                      : "#1D4ED8",
                  fontWeight: "bold"
                }}>
                  {riesgoAtraso
                    ? "Riesgo de atraso: el fin estimado supera la entrega planificada."
                    : entregaFecha
                      ? "Proyección dentro de la fecha planificada."
                      : "La OT no tiene fecha de entrega planificada para comparar."}
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(180px, 260px) auto",
                  gap: 10,
                  alignItems: "end",
                  marginBottom: 16
                }}>
                  <label style={{
                    fontWeight: "bold"
                  }}>
                    Ajustar entrega planificada
                    <input
                      type="date"
                      required
                      value={fechaEntregaEdicion}
                      onChange={evento =>
                        setFechaEntregaEdicion(
                          evento.target.value
                        )
                      }
                      style={{
                        ...campo,
                        marginTop: 6
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={guardarFechaEntrega}
                    disabled={
                      guardandoFechaEntrega ||
                      !ordenSeleccionada
                    }
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "11px 14px",
                      background: "#2563EB",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    {guardandoFechaEntrega
                      ? "Guardando..."
                      : "Guardar fecha"}
                  </button>
                </div>

                <section style={{
                  border: "1px solid #F59E0B",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                  background: "#FFFBEB"
                }}>
                  <h3 style={{
                    marginTop: 0,
                    marginBottom: 6
                  }}>
                    Simulación de cuello de botella
                  </h3>
                  <p style={{
                    color: "#92400E",
                    marginTop: 0
                  }}>
                    Se amplía únicamente el DT que
                    limita la fecha final.
                  </p>

                  <div style={{
                    background: "white",
                    borderRadius: 9,
                    padding: 12,
                    marginBottom: 12,
                    color: "#475569"
                  }}>
                    <strong>
                      Calendario{" "}
                      {
                        CALENDARIOS_PLANTA[
                          formulario.planta_id
                        ]?.nombre
                      }
                    </strong>
                    <div style={{ marginTop: 5 }}>
                      2 turnos · lunes a sábado ·{" "}
                      {horasSemanalesCalendario(
                        formulario.planta_id
                      ).toFixed(2)}
                      {" horas efectivas combinadas por semana"}
                    </div>
                    <div style={{
                      marginTop: 5,
                      color: "#0369A1"
                    }}>
                      Turnos rotativos. Este calendario
                      representa cobertura de la planta, no
                      una asignación fija por operario.
                    </div>
                    {formulario.planta_id ===
                      "chile" && (
                      <div style={{
                        marginTop: 5,
                        color: "#92400E"
                      }}>
                        Mañana: 42 h/semana. Tarde:
                        41,25 h/semana según el horario
                        informado.
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 9,
                    marginBottom: 12
                  }}>
                    <div style={{
                      color: "#475569",
                      fontSize: 14
                    }}>
                      <strong>Tercer turno:</strong>
                      {formulario.planta_id === "peru"
                        ? " 22:00 a 06:00 (8 horas)."
                        : " lun-mié 22:30 a 07:00; jue-sáb 21:15 a 07:00."}
                      <div style={{
                        marginTop: 5,
                        color:
                          formulario.planta_id === "chile"
                            ? "#92400E"
                            : "#475569"
                      }}>
                        {formulario.planta_id === "chile"
                          ? `${horasSemanalesTercerTurno("chile").toFixed(2).replace(".", ",")} h de cobertura efectiva semanal. Incluye 30 min diarios de colación no imputable. Las horas extra se determinan por operario según su rotación y jornada acumulada.`
                          : "48 horas semanales."}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={guardarCapacidad}
                    disabled={guardando}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 14px",
                      background: "#B45309",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    Guardar capacidad de planta
                  </button>

                  {simulacionTurnos
                    .cuello_botella && (
                    <div style={{
                      marginTop: 14,
                      padding: 12,
                      background: "white",
                      borderRadius: 9
                    }}>
                      <strong>
                        Cuello detectado:{" "}
                        {
                          simulacionTurnos
                            .cuello_botella.codigo
                        }
                        {" - "}
                        {
                          simulacionTurnos
                            .cuello_botella.nombre
                        }
                      </strong>
                      <div style={{
                        marginTop: 5,
                        color: "#475569"
                      }}>
                        {
                          simulacionTurnos
                            .cuello_botella
                            .cantidad_pendiente
                        }
                        {" unidades pendientes · "}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .horas_trabajo
                        }
                        {" horas de trabajo"}
                        <br />
                        {
                          simulacionTurnos
                            .cuello_botella
                            .recursos_paralelos
                        }
                        {" recursos paralelos · "}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .unidades_por_hora_efectivas
                        }
                        {" unidades/h efectivas · "}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .operarios_requeridos_turno
                        }
                        {" operarios requeridos por turno"}
                      </div>
                      {!simulacionTurnos
                        .cuello_botella
                        .capacidad_configurada && (
                        <div style={{
                          marginTop: 7,
                          color: "#B45309"
                        }}>
                          Capacidad no configurada para{" "}
                          {
                            simulacionTurnos
                              .cuello_botella
                              .subproceso_id
                          }
                          . Se está usando un recurso al
                          100%.
                        </div>
                      )}
                      {simulacionTurnos
                        .cuello_botella
                        .capacidad_configurada &&
                        !simulacionTurnos
                          .cuello_botella
                          .capacidad_validada && (
                        <div style={{
                          marginTop: 7,
                          color: "#B45309",
                          fontWeight: "bold"
                        }}>
                          Capacidad provisional: aún no
                          fue confirmada con datos
                          verificados en planta.
                        </div>
                      )}
                      <div style={{
                        marginTop: 7,
                        color: "#475569"
                      }}>
                        Cobertura calificada semanal:{" "}
                        mañana{" "}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .cobertura_programada
                            .manana
                        }
                        {"/"}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .operarios_requeridos_turno
                        }
                        {" · tarde "}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .cobertura_programada
                            .tarde
                        }
                        {"/"}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .operarios_requeridos_turno
                        }
                        {" · noche "}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .cobertura_programada
                            .noche
                        }
                        {"/"}
                        {
                          simulacionTurnos
                            .cuello_botella
                            .operarios_requeridos_turno
                        }
                        .
                      </div>
                      {programacionTurnos.length > 0 && (
                        <div style={{
                          marginTop: 7,
                          color: "#B45309"
                        }}>
                          Brecha de dotación: mañana{" "}
                          {
                            simulacionTurnos
                              .cuello_botella
                              .brechas_dotacion
                              .faltantes_manana
                          }
                          {" · tarde "}
                          {
                            simulacionTurnos
                              .cuello_botella
                              .brechas_dotacion
                              .faltantes_tarde
                          }
                          {" · noche "}
                          {
                            simulacionTurnos
                              .cuello_botella
                              .brechas_dotacion
                              .faltantes_noche
                          }
                          {" operarios."}
                        </div>
                      )}
                      <div style={{
                        marginTop: 8,
                        fontWeight: "bold",
                        color:
                          simulacionTurnos
                            .recomienda_ampliar
                            ? "#166534"
                            : "#475569"
                      }}>
                        {simulacionTurnos
                          .recomienda_ampliar
                          ? `Recomendación: ampliar solo ${simulacionTurnos.cuello_botella.codigo} de 2 a 3 turnos. Ahorro estimado: ${simulacionTurnos.ahorro_horas_calendario} horas calendario.`
                          : !simulacionTurnos
                            .cuello_botella
                            .capacidad_validada
                            ? `Proyección provisional: valida la capacidad de ${simulacionTurnos.cuello_botella.subproceso_id} antes de tomar una decisión de turnos.`
                          : !simulacionTurnos
                            .cuello_botella
                            .brechas_dotacion
                            .cobertura_base_suficiente &&
                            programacionTurnos.length > 0
                            ? `No se recomienda ampliar: faltan ${simulacionTurnos.cuello_botella.brechas_dotacion.faltantes_manana} operarios en mañana y ${simulacionTurnos.cuello_botella.brechas_dotacion.faltantes_tarde} en tarde para ${simulacionTurnos.cuello_botella.subproceso_id}.`
                            : !simulacionTurnos
                              .cuello_botella
                            .tercer_turno_con_dotacion
                            ? `No se recomienda el tercer turno: faltan ${simulacionTurnos.cuello_botella.brechas_dotacion.faltantes_noche} operarios habilitados en noche para ${simulacionTurnos.cuello_botella.subproceso_id}.`
                            : "El tercer turno no produce una mejora significativa en la fecha final actual."}
                      </div>
                      {simulacionTurnos
                        .accion_prioritaria ===
                        "completar_turnos_base" && (
                        <div style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 8,
                          background: "#EFF6FF",
                          color: "#1D4ED8"
                        }}>
                          <strong>
                            Acción prioritaria:
                          </strong>
                          {" reasignar o incorporar "}
                          {
                            simulacionTurnos
                              .cuello_botella
                              .brechas_dotacion
                              .faltantes_manana
                          }
                          {" operarios en mañana y "}
                          {
                            simulacionTurnos
                              .cuello_botella
                              .brechas_dotacion
                              .faltantes_tarde
                          }
                          {" en tarde. Ahorro potencial: "}
                          {
                            simulacionTurnos
                              .ahorro_dotacion_horas_calendario
                          }
                          {" horas calendario; nuevo fin estimado "}
                          {fechaHoraVisible(
                            simulacionTurnos
                              .fecha_fin_dotacion_objetivo
                          )}
                          .
                          {simulacionTurnos
                            .cuello_botella
                            .reasignaciones_sugeridas
                            .filter(item =>
                              ["manana", "tarde"]
                                .includes(
                                  item.turno_destino
                                )
                            ).length > 0 ? (
                            <div style={{
                              marginTop: 7
                            }}>
                              Reasignaciones posibles
                              sin descubrir el turno de
                              origen:{" "}
                              {simulacionTurnos
                                .cuello_botella
                                .reasignaciones_sugeridas
                                .filter(item =>
                                  ["manana", "tarde"]
                                    .includes(
                                      item.turno_destino
                                    )
                                )
                                .map(item =>
                                  `${item.operario_codigo} ${item.operario_nombre} (${item.turno_origen} → ${item.turno_destino})`
                                )
                                .join("; ")}
                              .
                            </div>
                          ) : (
                            <div style={{
                              marginTop: 7
                            }}>
                              No hay excedentes
                              calificados que puedan
                              reasignarse sin crear otra
                              brecha.
                            </div>
                          )}
                        </div>
                      )}
                      {simulacionTurnos
                        .accion_prioritaria ===
                        "completar_turno_noche" && (
                        <div style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 8,
                          background: "#EFF6FF",
                          color: "#1D4ED8"
                        }}>
                          <strong>
                            Acción prioritaria:
                          </strong>
                          {" habilitar "}
                          {
                            simulacionTurnos
                              .cuello_botella
                              .brechas_dotacion
                              .faltantes_noche
                          }
                          {" operarios para noche. El tercer turno podría ahorrar "}
                          {
                            simulacionTurnos
                              .ahorro_noche_adicional_horas
                          }
                          {" horas adicionales."}
                          {simulacionTurnos
                            .cuello_botella
                            .reasignaciones_sugeridas
                            .filter(item =>
                              item.turno_destino ===
                              "noche"
                            ).length > 0 ? (
                            <div style={{
                              marginTop: 7
                            }}>
                              Candidatos con competencia
                              y excedente en su turno:{" "}
                              {simulacionTurnos
                                .cuello_botella
                                .reasignaciones_sugeridas
                                .filter(item =>
                                  item.turno_destino ===
                                  "noche"
                                )
                                .map(item =>
                                  `${item.operario_codigo} ${item.operario_nombre} (${item.turno_origen} → noche)`
                                )
                                .join("; ")}
                              .
                            </div>
                          ) : (
                            <div style={{
                              marginTop: 7
                            }}>
                              No hay excedentes
                              calificados disponibles;
                              se requiere habilitar o
                              incorporar personal.
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{
                        marginTop: 7
                      }}>
                        Fin con{" "}
                        2 turnos:{" "}
                        <strong>
                          {fechaHoraVisible(
                            simulacionTurnos
                              .fecha_fin_base
                          )}
                        </strong>
                        <br />
                        Fin ampliando el cuello:{" "}
                        <strong>
                          {fechaHoraVisible(
                            simulacionTurnos
                              .fecha_fin_escenario
                          )}
                        </strong>
                      </div>
                    </div>
                  )}
                </section>

                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {operaciones.map(operacion => (
                    <article
                      key={
                        operacion.id ||
                        operacion.ruta_operacion_id
                      }
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: 9,
                        padding: 12
                      }}
                    >
                      <strong>
                        {operacion.secuencia}
                        {". "}
                        {operacion.operacion_codigo}
                        {" - "}
                        {operacion.operacion_nombre}
                      </strong>
                      <div style={{
                        color: "#475569",
                        marginTop: 5
                      }}>
                        {
                          operacion
                            .material_entrada_codigo
                        }
                        {" → "}
                        {
                          operacion
                            .material_salida_codigo
                        }
                      </div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        marginTop: 6
                      }}>
                        <span>
                          Requerido:{" "}
                          {operacion.cantidad_requerida}
                        </span>
                        <strong>
                          Pendiente:{" "}
                          {operacion.cantidad_pendiente}
                        </strong>
                      </div>
                      <div style={{
                        color: "#64748B",
                        marginTop: 4,
                        fontSize: 14
                      }}>
                        Estado: {operacion.estado}
                      </div>
                      {simulacionTurnos.operaciones
                        .find(
                          item =>
                            item.id === operacion.id
                        )
                        ?.es_cuello_botella && (
                        <div style={{
                          marginTop: 6,
                          color: "#B91C1C",
                          fontWeight: "bold"
                        }}>
                          Cuello de botella actual
                        </div>
                      )}
                      {(() => {
                        const carga =
                          simulacionTurnos.operaciones
                            .find(
                              item =>
                                item.id === operacion.id
                            );

                        return carga ? (
                          <div style={{
                            marginTop: 6,
                            color: carga
                              .capacidad_configurada
                              ? "#0369A1"
                              : "#B45309",
                            fontSize: 14
                          }}>
                            {carga.recursos_paralelos}
                            {" recursos · "}
                            {
                              carga
                                .unidades_por_hora_efectivas
                            }
                            {" un/h efectivas · "}
                            {
                              carga
                                .operarios_requeridos_turno
                            }
                            {" operarios/turno"}
                            {!carga.capacidad_configurada &&
                              " · capacidad por configurar"}
                          </div>
                        ) : null;
                      })()}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default OrdenesTrabajoV2;
