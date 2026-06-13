import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  listarProductos
} from "../productos/productosRepository";
import {
  crearOrdenV2,
  listarOperacionesOT,
  listarOrdenesV2,
  validarDatosOrden
} from "./ordenesRepository";

const formularioInicial = {
  planta_id: "",
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
  const [ordenes, setOrdenes] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] =
    useState(null);
  const [operaciones, setOperaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const productosPublicados = useMemo(
    () => productos.filter(
      producto =>
        producto.activo &&
        producto.version_ruta_activa
    ),
    [productos]
  );

  const productoSeleccionado =
    productosPublicados.find(
      producto =>
        producto.id === formulario.producto_id
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
    },
    [db, perfil.empresa_id]
  );

  const cargarInicial = useCallback(
    async () => {
      try {
        setCargando(true);
        setError("");
        const productosData =
          await listarProductos(
            db,
            perfil.empresa_id
          );
        setProductos(productosData);
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
        clienteNombre:
          formulario.cliente_nombre,
        producto: productoSeleccionado,
        cantidadProducto:
          formulario.cantidad_producto,
        fechaInicio: formulario.fecha_inicio,
        fechaEntrega: formulario.fecha_entrega
      });

      setOrdenSeleccionada(resultado.orden);
      setOperaciones(resultado.operaciones);
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
                  <input
                    value={
                      formulario.cliente_nombre
                    }
                    onChange={evento =>
                      actualizar(
                        "cliente_nombre",
                        evento.target.value
                      )
                    }
                    placeholder="Nombre del cliente"
                    style={campo}
                  />
                </label>

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
                      {ordenSeleccionada.avance_pct}%
                    </div>
                  </div>
                </div>

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
