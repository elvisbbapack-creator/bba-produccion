import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  validarRuta
} from "../../domain/produccionV2";
import {
  listarMateriales
} from "../materiales/materialesRepository";
import {
  crearProductoConRuta,
  guardarOperacionRuta,
  listarProductos,
  obtenerRuta,
  prepararOperacionRuta,
  prepararProducto,
  publicarRuta,
  recalibrarEstandarRuta,
  validarOperacionBasica,
  validarProducto
} from "./productosRepository";

const productoInicial = {
  codigo: "",
  nombre: "",
  familia: ""
};

const operacionInicial = {
  codigo: "",
  nombre: "",
  proceso_codigo: "",
  proceso_nombre: "",
  subproceso_codigo: "",
  subproceso_nombre: "",
  material_entrada_id: "",
  material_salida_id: "",
  medida: "",
  unidades_por_producto: "",
  unidades_por_hora: "",
  dependencia_id: "",
  porcentaje_minimo_avance: "0"
};

const campo = {
  width: "100%",
  padding: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14
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

function ConstructorRutasV2({
  db,
  perfil,
  onVolver
}) {
  const [productos, setProductos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [productoId, setProductoId] =
    useState("");
  const [ruta, setRuta] = useState(null);
  const [productoForm, setProductoForm] =
    useState(productoInicial);
  const [operacionForm, setOperacionForm] =
    useState(operacionInicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [recalibrandoId, setRecalibrandoId] =
    useState("");
  const [recalibracion, setRecalibracion] =
    useState({
      unidades_por_hora: "",
      motivo: ""
    });

  const productoSeleccionado = productos.find(
    producto => producto.id === productoId
  );
  const rutaPublicada =
    ruta?.estado === "publicada";
  const materialesActivos = materiales.filter(
    material => material.activo
  );
  const salidasRf = materialesActivos.filter(
    material => material.tipo === "RF"
  );

  const cargarCatalogos = useCallback(
    async () => {
      try {
        setCargando(true);
        setError("");
        const [productosData, materialesData] =
          await Promise.all([
            listarProductos(
              db,
              perfil.empresa_id
            ),
            listarMateriales(
              db,
              perfil.empresa_id
            )
          ]);
        setProductos(productosData);
        setMateriales(materialesData);
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar los catálogos."
        );
      } finally {
        setCargando(false);
      }
    },
    [db, perfil.empresa_id]
  );

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  const cargarRuta = useCallback(
    async (id, version = 1) => {
      if (!id) {
        setRuta(null);
        return;
      }

      try {
        setError("");
        setRuta(
          await obtenerRuta(
            db,
            id,
            perfil.empresa_id,
            version
          )
        );
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudo cargar la ruta."
        );
      }
    },
    [db, perfil.empresa_id]
  );

  const actualizarProducto = (nombre, valor) => {
    setProductoForm(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarOperacion = (
    nombre,
    valor
  ) => {
    setOperacionForm(actual => ({
      ...actual,
      [nombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const vistaProducto = useMemo(
    () => prepararProducto(
      productoForm,
      perfil.empresa_id,
      "vista-producto"
    ),
    [perfil.empresa_id, productoForm]
  );

  const crearProducto = async (evento) => {
    evento.preventDefault();
    const errores = validarProducto(
      vistaProducto,
      productos
    );

    if (errores.length > 0) {
      setError(errores.join(" "));
      return;
    }

    try {
      setGuardando(true);
      const creado = await crearProductoConRuta(
        db,
        perfil.empresa_id,
        {
          ...productoForm,
          creada_por: perfil.uid
        }
      );
      await cargarCatalogos();
      setProductoForm(productoInicial);
      setProductoId(creado.id);
      await cargarRuta(creado.id);
      setMensaje(
        "Producto creado con ruta V1 en borrador."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo crear el producto."
      );
    } finally {
      setGuardando(false);
    }
  };

  const vistaOperacion = useMemo(
    () => prepararOperacionRuta(
      {
        ...operacionForm,
        empresa_id: perfil.empresa_id,
        secuencia:
          (ruta?.operaciones.length || 0) * 10 +
          10
      },
      productoId,
      operacionForm.codigo
    ),
    [
      operacionForm,
      perfil.empresa_id,
      productoId,
      ruta
    ]
  );

  const agregarOperacion = async (evento) => {
    evento.preventDefault();
    const errores = validarOperacionBasica(
      vistaOperacion,
      ruta?.operaciones || []
    );

    if (
      !vistaOperacion.material_entrada_id
    ) {
      errores.push(
        "Selecciona el material de entrada."
      );
    }

    if (
      !vistaOperacion.material_salida_id
    ) {
      errores.push(
        "Selecciona el RF de salida."
      );
    }

    if (errores.length > 0) {
      setError(errores.join(" "));
      return;
    }

    try {
      setGuardando(true);
      await guardarOperacionRuta(
        db,
        perfil.empresa_id,
        productoId,
        ruta?.version || 1,
        {
          ...operacionForm,
          secuencia:
            (ruta?.operaciones.length || 0) *
              10 +
            10
        },
        ruta?.operaciones || []
      );
      setOperacionForm(operacionInicial);
      await cargarRuta(productoId);
      setMensaje(
        "Operación agregada a la ruta."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo agregar la operación."
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirRecalibracion = operacion => {
    setRecalibrandoId(operacion.id);
    setRecalibracion({
      unidades_por_hora:
        operacion.unidades_por_hora,
      motivo: ""
    });
    setError("");
    setMensaje("");
  };

  const cancelarRecalibracion = () => {
    setRecalibrandoId("");
    setRecalibracion({
      unidades_por_hora: "",
      motivo: ""
    });
  };

  const guardarRecalibracion = async (
    operacion
  ) => {
    try {
      setGuardando(true);
      const resultado =
        await recalibrarEstandarRuta({
          db,
          empresaId: perfil.empresa_id,
          productoId,
          versionActual: ruta.version,
          operaciones: ruta.operaciones,
          operacionId: operacion.id,
          unidadesPorHora:
            recalibracion.unidades_por_hora,
          motivo: recalibracion.motivo,
          perfil
        });

      await cargarCatalogos();
      await cargarRuta(
        productoId,
        resultado.version
      );
      cancelarRecalibracion();
      setMensaje(
        `Estándar actualizado en ruta V${resultado.version}. Las OT existentes conservan el valor anterior.`
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

  const erroresRuta = ruta
    ? validarRuta(
        {
          producto_id: productoId,
          version: 1,
          operaciones: ruta.operaciones
        },
        materiales
      )
    : [];

  const publicar = async () => {
    if (erroresRuta.length > 0) {
      setError(erroresRuta.join(" "));
      return;
    }

    try {
      setGuardando(true);
      await publicarRuta({
        db,
        empresaId: perfil.empresa_id,
        productoId,
        version: ruta.version,
        operaciones: ruta.operaciones,
        materiales
      });
      await cargarCatalogos();
      await cargarRuta(
        productoId,
        ruta.version
      );
      setMensaje(
        `Ruta V${ruta.version} publicada y activa.`
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo publicar la ruta."
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
        maxWidth: 1250,
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
          Volver a Ingeniería
        </button>

        <h1 style={{ marginBottom: 4 }}>
          Productos y rutas V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Construye la secuencia productiva enlazada
          a materiales MP y RF.
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
            "repeat(auto-fit, minmax(310px, 1fr))",
          gap: 20,
          alignItems: "start"
        }}>
          <div style={{
            display: "grid",
            gap: 20
          }}>
            <form
              onSubmit={crearProducto}
              style={tarjeta}
            >
              <h2 style={{ marginTop: 0 }}>
                Nuevo producto
              </h2>
              <div style={{
                display: "grid",
                gap: 12
              }}>
                <label style={etiqueta}>
                  Código
                  <input
                    value={productoForm.codigo}
                    onChange={evento =>
                      actualizarProducto(
                        "codigo",
                        evento.target.value
                      )
                    }
                    placeholder="PCL0001"
                    style={campo}
                  />
                </label>
                <label style={etiqueta}>
                  Nombre
                  <input
                    value={productoForm.nombre}
                    onChange={evento =>
                      actualizarProducto(
                        "nombre",
                        evento.target.value
                      )
                    }
                    placeholder="Mod 2N60 CL"
                    style={campo}
                  />
                </label>
                <label style={etiqueta}>
                  Familia
                  <input
                    value={productoForm.familia}
                    onChange={evento =>
                      actualizarProducto(
                        "familia",
                        evento.target.value
                      )
                    }
                    placeholder="Exhibidores metálicos"
                    style={campo}
                  />
                </label>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    ...campo,
                    border: "none",
                    background: "#1D4ED8",
                    color: "white",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  Crear producto y ruta V1
                </button>
              </div>
            </form>

            <section style={tarjeta}>
              <h2 style={{ marginTop: 0 }}>
                Productos ({productos.length})
              </h2>
              {cargando ? (
                <p>Cargando...</p>
              ) : productos.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay productos V2.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 9
                }}>
                  {productos.map(producto => (
                    <button
                      type="button"
                      key={producto.id}
                      onClick={() => {
                        setProductoId(producto.id);
                        setError("");
                        setMensaje("");
                        cargarRuta(
                          producto.id,
                          producto
                            .version_ruta_activa || 1
                        );
                      }}
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 9,
                        border:
                          producto.id === productoId
                            ? "2px solid #1D4ED8"
                            : "1px solid #E2E8F0",
                        background: "white",
                        cursor: "pointer"
                      }}
                    >
                      <strong>
                        {producto.codigo}
                        {" - "}
                        {producto.nombre}
                      </strong>
                      <div style={{
                        color: "#64748B",
                        marginTop: 4
                      }}>
                        {producto.familia || "Sin familia"}
                        {" · "}
                        {producto.version_ruta_activa
                          ? `Ruta V${producto.version_ruta_activa} activa`
                          : "Ruta en borrador"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div style={{
            display: "grid",
            gap: 20
          }}>
            {!productoSeleccionado ? (
              <section style={tarjeta}>
                <h2 style={{ marginTop: 0 }}>
                  Constructor de ruta
                </h2>
                <p style={{ color: "#64748B" }}>
                  Selecciona o crea un producto para
                  comenzar.
                </p>
              </section>
            ) : (
              <>
                <section style={tarjeta}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "start"
                  }}>
                    <div>
                      <h2 style={{ margin: 0 }}>
                        {productoSeleccionado.codigo}
                        {" - "}
                        {productoSeleccionado.nombre}
                      </h2>
                      <p style={{
                        color: "#64748B",
                        marginBottom: 0
                      }}>
                        Ruta V{ruta?.version || 1} ·{" "}
                        {ruta?.estado || "borrador"}
                      </p>
                    </div>
                    {!rutaPublicada && (
                      <button
                        type="button"
                        onClick={publicar}
                        disabled={
                          guardando ||
                          erroresRuta.length > 0
                        }
                        style={{
                          padding: "10px 14px",
                          border: "none",
                          borderRadius: 8,
                          background:
                            erroresRuta.length > 0
                              ? "#94A3B8"
                              : "#15803D",
                          color: "white",
                          fontWeight: "bold",
                          cursor:
                            erroresRuta.length > 0
                              ? "not-allowed"
                              : "pointer"
                        }}
                      >
                        Publicar ruta
                      </button>
                    )}
                  </div>

                  {!rutaPublicada &&
                    erroresRuta.length > 0 && (
                      <div style={{
                        marginTop: 12,
                        color: "#92400E",
                        background: "#FFFBEB",
                        padding: 10,
                        borderRadius: 8,
                        fontSize: 14
                      }}>
                        Pendiente para publicar:{" "}
                        {erroresRuta.join(" ")}
                      </div>
                    )}
                </section>

                {!rutaPublicada && (
                  <form
                    onSubmit={agregarOperacion}
                    style={tarjeta}
                  >
                    <h2 style={{ marginTop: 0 }}>
                      Agregar operación
                    </h2>

                    {materialesActivos.length < 2 && (
                      <p style={{
                        color: "#92400E",
                        background: "#FFFBEB",
                        padding: 9,
                        borderRadius: 8
                      }}>
                        Crea materiales MP/RF antes de
                        construir la ruta.
                      </p>
                    )}

                    <div style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 11
                    }}>
                      <label style={etiqueta}>
                        Código detalle
                        <input
                          value={operacionForm.codigo}
                          onChange={evento =>
                            actualizarOperacion(
                              "codigo",
                              evento.target.value
                            )
                          }
                          placeholder="DT0001"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Nombre operación
                        <input
                          value={operacionForm.nombre}
                          onChange={evento =>
                            actualizarOperacion(
                              "nombre",
                              evento.target.value
                            )
                          }
                          placeholder="Lateral 290"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Código proceso
                        <input
                          value={
                            operacionForm.proceso_codigo
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "proceso_codigo",
                              evento.target.value
                            )
                          }
                          placeholder="PR0001"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Proceso
                        <input
                          value={
                            operacionForm.proceso_nombre
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "proceso_nombre",
                              evento.target.value
                            )
                          }
                          placeholder="Corte"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Código subproceso
                        <input
                          value={
                            operacionForm
                              .subproceso_codigo
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "subproceso_codigo",
                              evento.target.value
                            )
                          }
                          placeholder="SP0001"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Subproceso
                        <input
                          value={
                            operacionForm
                              .subproceso_nombre
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "subproceso_nombre",
                              evento.target.value
                            )
                          }
                          placeholder="Tubo en prensa"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Material entrada
                        <select
                          value={
                            operacionForm
                              .material_entrada_id
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "material_entrada_id",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar
                          </option>
                          {materialesActivos.map(
                            material => (
                              <option
                                key={material.id}
                                value={material.id}
                              >
                                {material.codigo}
                                {" - "}
                                {material.nombre}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <label style={etiqueta}>
                        RF de salida
                        <select
                          value={
                            operacionForm
                              .material_salida_id
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "material_salida_id",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Seleccionar
                          </option>
                          {salidasRf.map(material => (
                            <option
                              key={material.id}
                              value={material.id}
                            >
                              {material.codigo}
                              {" - "}
                              {material.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={etiqueta}>
                        Medida
                        <input
                          value={operacionForm.medida}
                          onChange={evento =>
                            actualizarOperacion(
                              "medida",
                              evento.target.value
                            )
                          }
                          placeholder="290 mm"
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Unidades por producto
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            operacionForm
                              .unidades_por_producto
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "unidades_por_producto",
                              evento.target.value
                            )
                          }
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Unidades por hora
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            operacionForm
                              .unidades_por_hora
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "unidades_por_hora",
                              evento.target.value
                            )
                          }
                          style={campo}
                        />
                      </label>
                      <label style={etiqueta}>
                        Depende de
                        <select
                          value={
                            operacionForm
                              .dependencia_id
                          }
                          onChange={evento =>
                            actualizarOperacion(
                              "dependencia_id",
                              evento.target.value
                            )
                          }
                          style={campo}
                        >
                          <option value="">
                            Sin dependencia
                          </option>
                          {(ruta?.operaciones || []).map(
                            operacion => (
                              <option
                                key={operacion.id}
                                value={operacion.id}
                              >
                                {
                                  operacion
                                    .operacion_codigo
                                }
                                {" - "}
                                {
                                  operacion
                                    .operacion_nombre
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      {operacionForm.dependencia_id && (
                        <label style={etiqueta}>
                          Avance mínimo %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={
                              operacionForm
                                .porcentaje_minimo_avance
                            }
                            onChange={evento =>
                              actualizarOperacion(
                                "porcentaje_minimo_avance",
                                evento.target.value
                              )
                            }
                            style={campo}
                          />
                        </label>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        guardando ||
                        materialesActivos.length < 2
                      }
                      style={{
                        ...campo,
                        marginTop: 14,
                        border: "none",
                        background: "#0F766E",
                        color: "white",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }}
                    >
                      Agregar a la ruta
                    </button>
                  </form>
                )}

                <section style={tarjeta}>
                  <h2 style={{ marginTop: 0 }}>
                    Operaciones (
                    {ruta?.operaciones.length || 0})
                  </h2>
                  {(ruta?.operaciones || []).length ===
                  0 ? (
                    <p style={{ color: "#64748B" }}>
                      La ruta aún no tiene operaciones.
                    </p>
                  ) : (
                    <div style={{
                      display: "grid",
                      gap: 10
                    }}>
                      {ruta.operaciones.map(
                        operacion => {
                          const entrada =
                            materiales.find(
                              material =>
                                material.id ===
                                operacion
                                  .material_entrada_id
                            );
                          const salida =
                            materiales.find(
                              material =>
                                material.id ===
                                operacion
                                  .material_salida_id
                            );

                          return (
                            <article
                              key={operacion.id}
                              style={{
                                border:
                                  "1px solid #E2E8F0",
                                borderRadius: 9,
                                padding: 12
                              }}
                            >
                              <strong>
                                {operacion.secuencia}
                                {". "}
                                {
                                  operacion
                                    .operacion_codigo
                                }
                                {" - "}
                                {
                                  operacion
                                    .operacion_nombre
                                }
                              </strong>
                              <div style={{
                                color: "#475569",
                                marginTop: 5
                              }}>
                                {
                                  operacion
                                    .proceso_nombre
                                }
                                {" / "}
                                {
                                  operacion
                                    .subproceso_nombre
                                }
                              </div>
                              <div style={{
                                color: "#475569",
                                marginTop: 4
                              }}>
                                {entrada?.codigo || "?"}
                                {" → "}
                                {salida?.codigo || "?"}
                                {" · "}
                                {
                                  operacion
                                    .unidades_por_producto
                                }
                                {" por producto · "}
                                {
                                  operacion
                                    .unidades_por_hora
                                }
                                {" por hora"}
                              </div>
                              {operacion.estandar_motivo && (
                                <div style={{
                                  marginTop: 7,
                                  color: "#475569",
                                  fontSize: 13,
                                  background: "#F8FAFC",
                                  padding: 8,
                                  borderRadius: 7
                                }}>
                                  Estándar anterior:{" "}
                                  {
                                    operacion
                                      .estandar_anterior
                                  }
                                  {" por hora. Motivo: "}
                                  {
                                    operacion
                                      .estandar_motivo
                                  }
                                </div>
                              )}
                              {rutaPublicada &&
                                recalibrandoId !==
                                  operacion.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirRecalibracion(
                                      operacion
                                    )
                                  }
                                  style={{
                                    marginTop: 10,
                                    border:
                                      "1px solid #0369A1",
                                    borderRadius: 7,
                                    padding: "7px 10px",
                                    background: "white",
                                    color: "#0369A1",
                                    fontWeight: "bold",
                                    cursor: "pointer"
                                  }}
                                >
                                  Actualizar estándar
                                </button>
                              )}
                              {rutaPublicada &&
                                recalibrandoId ===
                                  operacion.id && (
                                <div style={{
                                  marginTop: 12,
                                  padding: 12,
                                  borderRadius: 8,
                                  background: "#F0F9FF",
                                  display: "grid",
                                  gap: 9
                                }}>
                                  <strong>
                                    Nueva versión de ruta
                                  </strong>
                                  <label style={etiqueta}>
                                    Nuevo estándar
                                    (unidades/hora)
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={
                                        recalibracion
                                          .unidades_por_hora
                                      }
                                      onChange={evento =>
                                        setRecalibracion(
                                          actual => ({
                                            ...actual,
                                            unidades_por_hora:
                                              evento.target
                                                .value
                                          })
                                        )
                                      }
                                      style={campo}
                                    />
                                  </label>
                                  <label style={etiqueta}>
                                    Motivo del cambio
                                    <textarea
                                      value={
                                        recalibracion.motivo
                                      }
                                      onChange={evento =>
                                        setRecalibracion(
                                          actual => ({
                                            ...actual,
                                            motivo:
                                              evento.target
                                                .value
                                          })
                                        )
                                      }
                                      placeholder="Ej.: mejora comprobada del método o corrección de estándar inicial."
                                      rows={3}
                                      style={campo}
                                    />
                                  </label>
                                  <div style={{
                                    color: "#475569",
                                    fontSize: 13
                                  }}>
                                    Las OT existentes no
                                    cambian. Las nuevas OT
                                    usarán la nueva versión.
                                  </div>
                                  <div style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap"
                                  }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        guardarRecalibracion(
                                          operacion
                                        )
                                      }
                                      disabled={guardando}
                                      style={{
                                        border: "none",
                                        borderRadius: 7,
                                        padding:
                                          "8px 11px",
                                        background:
                                          "#0369A1",
                                        color: "white",
                                        fontWeight: "bold",
                                        cursor: "pointer"
                                      }}
                                    >
                                      Crear nueva versión
                                    </button>
                                    <button
                                      type="button"
                                      onClick={
                                        cancelarRecalibracion
                                      }
                                      disabled={guardando}
                                      style={{
                                        border:
                                          "1px solid #94A3B8",
                                        borderRadius: 7,
                                        padding:
                                          "8px 11px",
                                        background: "white",
                                        color: "#475569",
                                        cursor: "pointer"
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        }
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConstructorRutasV2;
