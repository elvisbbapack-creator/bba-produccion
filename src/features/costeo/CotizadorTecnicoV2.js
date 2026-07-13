import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  listarMateriales
} from "../materiales/materialesRepository";
import {
  aCatalogoProcesosRuta,
  listarProcesosEstaciones
} from "../procesos/procesosRepository";
import {
  calcularCotizacionTecnica
} from "./costeoCalculos";
import {
  ESTADOS_COTIZACION,
  NIVELES_CONFIANZA,
  aFormularioCotizacionTecnica,
  actualizarCotizacionTecnica,
  guardarCotizacionTecnica,
  listarCotizacionesTecnicas
} from "./costeoRepository";

const campo = {
  width: "100%",
  padding: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 10,
  boxSizing: "border-box"
};

const boton = {
  padding: "11px 14px",
  border: "none",
  borderRadius: 10,
  background: "#1976D2",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

const botonSecundario = {
  ...boton,
  background: "#455A64"
};

const estadoInicial = {
  cliente: "",
  nombre_producto: "",
  version: "V1",
  planta_id: "chile",
  estado: "borrador",
  nivel_confianza: "media",
  moneda: "CLP",
  descripcion: "",
  riesgos: "",
  escalas: "50, 100, 500",
  indirectos_porcentaje: 18,
  margen_porcentaje: 35,
  factor_riesgo_porcentaje: 8,
  dias_compra: 5,
  dias_ingenieria: 2,
  horas_disponibles_dia: 14,
  materiales: [],
  procesos: []
};

const materialVacio = {
  material_id: "",
  codigo: "",
  nombre: "",
  unidad: "un",
  consumo_unitario: 1,
  merma_porcentaje: 5,
  costo_unitario: 0,
  minimo_compra: 0,
  proveedor: "",
  moneda: "CLP"
};

const procesoVacio = {
  proceso_codigo: "",
  proceso_nombre: "",
  estacion_codigo: "",
  estacion_nombre: "",
  unidades_por_hora: 10,
  eficiencia_esperada: 75,
  costo_hora: 0,
  horas_setup: 0,
  observacion: ""
};

const formatoNumero = (valor, moneda = "CLP") =>
  Number(valor || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0
  });

const actualizarItem = (
  lista,
  indice,
  cambios
) =>
  lista.map((item, posicion) =>
    posicion === indice
      ? {
          ...item,
          ...cambios
        }
      : item
  );

export default function CotizadorTecnicoV2({
  db,
  perfil,
  onVolver
}) {
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [materialesCatalogo, setMaterialesCatalogo] =
    useState([]);
  const [estacionesCatalogo, setEstacionesCatalogo] =
    useState([]);
  const [historial, setHistorial] = useState([]);
  const [editandoId, setEditandoId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [
        materiales,
        procesos,
        cotizaciones
      ] = await Promise.all([
        listarMateriales(db, perfil.empresa_id),
        listarProcesosEstaciones(
          db,
          perfil.empresa_id
        ),
        listarCotizacionesTecnicas(
          db,
          perfil.empresa_id
        )
      ]);

      setMaterialesCatalogo(
        materiales.filter(m => m.activo !== false)
      );
      setEstacionesCatalogo(
        aCatalogoProcesosRuta(procesos)
      );
      setHistorial(cotizaciones);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar costeo."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const actualizar = cambios => {
    setFormulario(actual => ({
      ...actual,
      ...cambios
    }));
    setMensaje("");
    setError("");
  };

  const resultados = useMemo(
    () =>
      calcularCotizacionTecnica({
        escalas: formulario.escalas,
        materiales: formulario.materiales,
        procesos: formulario.procesos,
        indirectos_porcentaje:
          formulario.indirectos_porcentaje,
        margen_porcentaje:
          formulario.margen_porcentaje,
        factor_riesgo_porcentaje:
          formulario.factor_riesgo_porcentaje,
        dias_compra: formulario.dias_compra,
        dias_ingenieria:
          formulario.dias_ingenieria,
        horas_disponibles_dia:
          formulario.horas_disponibles_dia
      }),
    [formulario]
  );

  const seleccionarMaterial = (
    indice,
    materialId
  ) => {
    const material = materialesCatalogo.find(
      item => item.id === materialId
    );

    actualizar({
      materiales: actualizarItem(
        formulario.materiales,
        indice,
        {
          material_id: materialId,
          codigo: material?.codigo || "",
          nombre: material?.nombre || "",
          unidad:
            material?.unidad_medida ||
            formulario.materiales[indice]?.unidad ||
            "un"
        }
      )
    });
  };

  const seleccionarEstacion = (
    indice,
    clave
  ) => {
    const estacion = estacionesCatalogo.find(
      item =>
        `${item.proceso_codigo}__${item.estacion_codigo}` ===
        clave
    );

    actualizar({
      procesos: actualizarItem(
        formulario.procesos,
        indice,
        {
          proceso_codigo:
            estacion?.proceso_codigo || "",
          proceso_nombre:
            estacion?.proceso_nombre || "",
          estacion_codigo:
            estacion?.estacion_codigo || "",
          estacion_nombre:
            estacion?.estacion_nombre || ""
        }
      )
    });
  };

  const limpiarFormulario = () => {
    setFormulario(estadoInicial);
    setEditandoId("");
    setMensaje("");
    setError("");
  };

  const cargarParaEditar = cotizacion => {
    setFormulario(
      aFormularioCotizacionTecnica(cotizacion)
    );
    setEditandoId(cotizacion.id);
    setMensaje(
      "Cotización cargada para editar. Al guardar se actualizará el mismo registro."
    );
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const cargarComoNuevaVersion = cotizacion => {
    const base =
      aFormularioCotizacionTecnica(cotizacion);
    setFormulario({
      ...base,
      version: `${base.version || "V1"} copia`,
      estado: "borrador"
    });
    setEditandoId("");
    setMensaje(
      "Cotización cargada como nueva versión. Al guardar se creará un registro nuevo."
    );
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const guardar = async () => {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      if (editandoId) {
        await actualizarCotizacionTecnica(
          db,
          perfil,
          editandoId,
          formulario
        );
        setMensaje(
          "Cotización técnica actualizada."
        );
      } else {
        await guardarCotizacionTecnica(
          db,
          perfil,
          formulario
        );
        setMensaje("Cotización técnica guardada.");
      }
      setFormulario(estadoInicial);
      setEditandoId("");
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la cotización."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      padding: 20,
      maxWidth: 1250,
      margin: "0 auto"
    }}>
      <h2>Costeo y Cotización Técnica</h2>
      <p style={{
        color: "#475569",
        lineHeight: 1.5
      }}>
        Crea un producto prototipo, estima materiales,
        procesos, riesgos y lead time por escala antes
        de fabricar. El objetivo es cotizar con
        supuestos visibles y comparables contra el costo
        real futuro.
      </p>

      {error && (
        <div role="alert" style={{
          background: "#FFEBEE",
          color: "#B71C1C",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
          fontWeight: "bold"
        }}>
          {error}
        </div>
      )}
      {mensaje && (
        <div role="status" style={{
          background: "#E8F5E9",
          color: "#1B5E20",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
          fontWeight: "bold"
        }}>
          {mensaje}
        </div>
      )}

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>
          Producto prototipo{" "}
          {editandoId ? "(editando)" : ""}
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          <input
            style={campo}
            placeholder="Cliente"
            value={formulario.cliente}
            onChange={e =>
              actualizar({ cliente: e.target.value })
            }
          />
          <input
            style={campo}
            placeholder="Nombre producto"
            value={formulario.nombre_producto}
            onChange={e =>
              actualizar({
                nombre_producto: e.target.value
              })
            }
          />
          <input
            style={campo}
            placeholder="Versión"
            value={formulario.version}
            onChange={e =>
              actualizar({ version: e.target.value })
            }
          />
          <select
            style={campo}
            value={formulario.estado}
            onChange={e =>
              actualizar({ estado: e.target.value })
            }
          >
            {ESTADOS_COTIZACION.map(estado => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <select
            style={campo}
            value={formulario.nivel_confianza}
            onChange={e =>
              actualizar({
                nivel_confianza: e.target.value
              })
            }
          >
            {NIVELES_CONFIANZA.map(nivel => (
              <option key={nivel} value={nivel}>
                Confianza {nivel}
              </option>
            ))}
          </select>
          <select
            style={campo}
            value={formulario.planta_id}
            onChange={e =>
              actualizar({ planta_id: e.target.value })
            }
          >
            <option value="chile">BBA Chile</option>
            <option value="peru">BBA Perú</option>
          </select>
        </div>
        <textarea
          style={{
            ...campo,
            minHeight: 70,
            marginTop: 12
          }}
          placeholder="Descripción técnica preliminar"
          value={formulario.descripcion}
          onChange={e =>
            actualizar({ descripcion: e.target.value })
          }
        />
      </section>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>Supuestos comerciales y lead time</h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12
        }}>
          <input
            style={campo}
            placeholder="Escalas: 50,100,500"
            value={formulario.escalas}
            onChange={e =>
              actualizar({ escalas: e.target.value })
            }
          />
          {[
            [
              "Indirectos %",
              "indirectos_porcentaje"
            ],
            ["Margen %", "margen_porcentaje"],
            [
              "Riesgo producto nuevo %",
              "factor_riesgo_porcentaje"
            ],
            ["Días compra MP", "dias_compra"],
            ["Días ingeniería", "dias_ingenieria"],
            [
              "Horas disponibles día",
              "horas_disponibles_dia"
            ]
          ].map(([placeholder, clave]) => (
            <input
              key={clave}
              style={campo}
              type="number"
              placeholder={placeholder}
              value={formulario[clave]}
              onChange={e =>
                actualizar({
                  [clave]: e.target.value
                })
              }
            />
          ))}
        </div>
        <textarea
          style={{
            ...campo,
            minHeight: 65,
            marginTop: 12
          }}
          placeholder="Riesgos y observaciones de la cotización"
          value={formulario.riesgos}
          onChange={e =>
            actualizar({ riesgos: e.target.value })
          }
        />
      </section>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>Materiales estimados</h3>
        {formulario.materiales.map((material, indice) => (
          <div
            key={indice}
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
              padding: 12,
              background: "#F8FAFC",
              borderRadius: 12,
              marginBottom: 10
            }}
          >
            <select
              style={campo}
              value={material.material_id}
              onChange={e =>
                seleccionarMaterial(
                  indice,
                  e.target.value
                )
              }
            >
              <option value="">Material libre</option>
              {materialesCatalogo.map(item => (
                <option key={item.id} value={item.id}>
                  {item.codigo} - {item.nombre}
                </option>
              ))}
            </select>
            {[
              ["Código", "codigo"],
              ["Nombre", "nombre"],
              ["Unidad", "unidad"],
              ["Consumo unit.", "consumo_unitario"],
              ["Merma %", "merma_porcentaje"],
              ["Costo unit.", "costo_unitario"],
              ["Mínimo compra", "minimo_compra"],
              ["Proveedor", "proveedor"]
            ].map(([placeholder, clave]) => (
              <input
                key={clave}
                style={campo}
                type={
                  [
                    "consumo_unitario",
                    "merma_porcentaje",
                    "costo_unitario",
                    "minimo_compra"
                  ].includes(clave)
                    ? "number"
                    : "text"
                }
                placeholder={placeholder}
                value={material[clave] || ""}
                onChange={e =>
                  actualizar({
                    materiales: actualizarItem(
                      formulario.materiales,
                      indice,
                      {
                        [clave]: e.target.value
                      }
                    )
                  })
                }
              />
            ))}
          </div>
        ))}
        <button
          type="button"
          style={botonSecundario}
          onClick={() =>
            actualizar({
              materiales: [
                ...formulario.materiales,
                materialVacio
              ]
            })
          }
        >
          + Agregar material
        </button>
      </section>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>Procesos estimados</h3>
        {formulario.procesos.map((proceso, indice) => {
          const claveEstacion =
            `${proceso.proceso_codigo}__${proceso.estacion_codigo}`;

          return (
            <div
              key={indice}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
                padding: 12,
                background: "#F8FAFC",
                borderRadius: 12,
                marginBottom: 10
              }}
            >
              <select
                style={campo}
                value={claveEstacion}
                onChange={e =>
                  seleccionarEstacion(
                    indice,
                    e.target.value
                  )
                }
              >
                <option value="">Proceso libre</option>
                {estacionesCatalogo.map(estacion => (
                  <option
                    key={`${estacion.proceso_codigo}__${estacion.estacion_codigo}`}
                    value={`${estacion.proceso_codigo}__${estacion.estacion_codigo}`}
                  >
                    {estacion.proceso_nombre} /{" "}
                    {estacion.estacion_nombre}
                  </option>
                ))}
              </select>
              {[
                ["Proceso", "proceso_nombre"],
                ["Estación", "estacion_nombre"],
                ["Unid/hora", "unidades_por_hora"],
                [
                  "Eficiencia esperada %",
                  "eficiencia_esperada"
                ],
                ["Costo hora", "costo_hora"],
                ["Horas setup", "horas_setup"],
                ["Observación", "observacion"]
              ].map(([placeholder, clave]) => (
                <input
                  key={clave}
                  style={campo}
                  type={
                    [
                      "unidades_por_hora",
                      "eficiencia_esperada",
                      "costo_hora",
                      "horas_setup"
                    ].includes(clave)
                      ? "number"
                      : "text"
                  }
                  placeholder={placeholder}
                  value={proceso[clave] || ""}
                  onChange={e =>
                    actualizar({
                      procesos: actualizarItem(
                        formulario.procesos,
                        indice,
                        {
                          [clave]: e.target.value
                        }
                      )
                    })
                  }
                />
              ))}
            </div>
          );
        })}
        <button
          type="button"
          style={botonSecundario}
          onClick={() =>
            actualizar({
              procesos: [
                ...formulario.procesos,
                procesoVacio
              ]
            })
          }
        >
          + Agregar proceso
        </button>
      </section>

      <section style={{
        background: "#EFF6FF",
        padding: 18,
        borderRadius: 14,
        marginBottom: 18
      }}>
        <h3>Resultado por escala</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse"
          }}>
            <thead>
              <tr>
                {[
                  "Cant.",
                  "Costo unit.",
                  "Precio sugerido",
                  "Costo total",
                  "Precio total",
                  "Horas",
                  "Lead time"
                ].map(titulo => (
                  <th
                    key={titulo}
                    style={{
                      textAlign: "left",
                      padding: 8
                    }}
                  >
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultados.map(resultado => (
                <tr key={resultado.cantidad}>
                  <td style={{ padding: 8 }}>
                    {resultado.cantidad}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoNumero(
                      resultado.costo_unitario,
                      formulario.moneda
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <b>
                      {formatoNumero(
                        resultado.precio_unitario_sugerido,
                        formulario.moneda
                      )}
                    </b>
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoNumero(
                      resultado.costo_total,
                      formulario.moneda
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatoNumero(
                      resultado.precio_total_sugerido,
                      formulario.moneda
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {resultado.horas_produccion}
                  </td>
                  <td style={{ padding: 8 }}>
                    {resultado.lead_time_dias} días
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
        marginBottom: 22
      }}>
        <button
          style={boton}
          disabled={guardando}
          onClick={guardar}
        >
          {guardando
            ? "Guardando..."
            : editandoId
              ? "Actualizar cotización"
              : "Guardar cotización"}
        </button>
        <button
          style={botonSecundario}
          onClick={limpiarFormulario}
        >
          Nueva cotización
        </button>
        <button
          style={botonSecundario}
          onClick={onVolver}
        >
          Volver
        </button>
      </div>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)"
      }}>
        <h3>Últimas cotizaciones</h3>
        {cargando && <div>Cargando...</div>}
        {historial.slice(0, 8).map(item => {
          const primeraEscala = item.resultados?.[0];
          return (
            <div
              key={item.id}
              style={{
                borderBottom: "1px solid #E2E8F0",
                padding: "10px 0"
              }}
            >
              <b>{item.nombre_producto}</b>{" "}
              <span style={{ color: "#64748B" }}>
                {item.cliente ? `- ${item.cliente}` : ""}
              </span>
              <div>
                Estado: {item.estado} / confianza{" "}
                {item.nivel_confianza}
              </div>
              {primeraEscala && (
                <div>
                  Desde {primeraEscala.cantidad} un:{" "}
                  {formatoNumero(
                    primeraEscala.precio_unitario_sugerido,
                    item.moneda || "CLP"
                  )}{" "}
                  unitario / lead time{" "}
                  {primeraEscala.lead_time_dias} días
                </div>
              )}
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8
              }}>
                <button
                  type="button"
                  style={{
                    ...boton,
                    padding: "8px 10px"
                  }}
                  onClick={() =>
                    cargarParaEditar(item)
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  style={{
                    ...botonSecundario,
                    padding: "8px 10px"
                  }}
                  onClick={() =>
                    cargarComoNuevaVersion(item)
                  }
                >
                  Nueva versión
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
