import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ITEMS_OPERATIVOS_BASE,
  calcularCostosOperativos,
  guardarCostosOperativos,
  itemOperativoVacio,
  listarCostosOperativos
} from "./costosOperativosRepository";

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

const etiquetaCampo = {
  display: "block",
  fontWeight: "bold",
  color: "#334155",
  marginBottom: 5
};

const ayudaCampo = {
  color: "#64748B",
  fontSize: 12,
  lineHeight: 1.35,
  marginTop: 4
};

const CampoConAyuda = ({
  etiqueta,
  ayuda,
  children
}) => (
  <label>
    <span style={etiquetaCampo}>{etiqueta}</span>
    {children}
    <div style={ayudaCampo}>{ayuda}</div>
  </label>
);

const estadoInicial = {
  planta_id: "chile",
  nombre: "Costos Operativos Fijos Chile",
  moneda: "CLP",
  periodo: "mensual",
  horas_productivas_mes: 520,
  activo: true,
  items: ITEMS_OPERATIVOS_BASE.map(item => ({
    ...item,
    costo_mensual_unitario: 0,
    observacion: ""
  }))
};

const formatoNumero = valor =>
  Number(valor || 0).toLocaleString("es-CL", {
    maximumFractionDigits: 0
  });

const formatoMoneda = (valor, moneda = "CLP") =>
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

export default function CostosOperativosFijosV2({
  db,
  perfil,
  onVolver
}) {
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [costos, setCostos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const cargados = await listarCostosOperativos(
        db,
        perfil.empresa_id
      );
      setCostos(cargados);
      const actual = cargados.find(
        costo =>
          costo.planta_id === estadoInicial.planta_id &&
          costo.activo !== false
      );

      if (actual) {
        setFormulario({
          ...estadoInicial,
          ...actual
        });
      }
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar costos operativos."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const calculos = useMemo(
    () => calcularCostosOperativos(formulario),
    [formulario]
  );

  const actualizar = cambios => {
    setFormulario(actual => ({
      ...actual,
      ...cambios
    }));
    setMensaje("");
    setError("");
  };

  const editar = costo => {
    setFormulario({
      ...estadoInicial,
      ...costo
    });
    setMensaje("");
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const limpiar = () => {
    setFormulario(estadoInicial);
    setMensaje("");
    setError("");
  };

  const guardar = async () => {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await guardarCostosOperativos(
        db,
        perfil,
        formulario
      );
      await cargar();
      setMensaje(
        "Costos operativos fijos guardados."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron guardar los costos operativos."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      padding: 20,
      maxWidth: 1200,
      margin: "0 auto"
    }}>
      <h2>Costos Operativos Fijos de Planta</h2>
      <p style={{
        color: "#475569",
        lineHeight: 1.5
      }}>
        Registra los costos mensuales necesarios para
        mantener operando la planta. El sistema los
        convierte a costo por hora productiva para
        absorberlos en las cotizaciones técnicas.
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
        <h3>Parámetros de absorción</h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          <CampoConAyuda
            etiqueta="Planta"
            ayuda="Se guarda un costo operativo fijo por planta."
          >
            <select
              style={campo}
              value={formulario.planta_id}
              onChange={e =>
                actualizar({
                  planta_id: e.target.value,
                  nombre:
                    e.target.value === "peru"
                      ? "Costos Operativos Fijos Perú"
                      : "Costos Operativos Fijos Chile"
                })
              }
            >
              <option value="chile">BBA Chile</option>
              <option value="peru">BBA Perú</option>
            </select>
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Nombre"
            ayuda="Referencia interna para reconocer esta configuración."
          >
            <input
              style={campo}
              value={formulario.nombre}
              onChange={e =>
                actualizar({
                  nombre: e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Horas productivas mensuales"
            ayuda="Base de reparto. Ej: horas reales disponibles de planta al mes."
          >
            <input
              style={campo}
              type="number"
              value={
                formulario.horas_productivas_mes || ""
              }
              onChange={e =>
                actualizar({
                  horas_productivas_mes:
                    e.target.value
                })
              }
            />
          </CampoConAyuda>
          <CampoConAyuda
            etiqueta="Moneda"
            ayuda="Moneda usada para esta planta."
          >
            <select
              style={campo}
              value={formulario.moneda}
              onChange={e =>
                actualizar({
                  moneda: e.target.value
                })
              }
            >
              <option value="CLP">CLP</option>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </CampoConAyuda>
        </div>
      </section>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>Costos mensuales</h3>
        {formulario.items.map((item, indice) => (
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
            <CampoConAyuda
              etiqueta="Categoría"
              ayuda="Personal, infraestructura, servicios, insumos u otros."
            >
              <select
                style={campo}
                value={item.categoria}
                onChange={e =>
                  actualizar({
                    items: actualizarItem(
                      formulario.items,
                      indice,
                      {
                        categoria: e.target.value
                      }
                    )
                  })
                }
              >
                <option value="personal">
                  Personal
                </option>
                <option value="infraestructura">
                  Infraestructura
                </option>
                <option value="servicio">
                  Servicio
                </option>
                <option value="insumo">Insumo</option>
                <option value="otro">Otro</option>
              </select>
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Concepto"
              ayuda="Ej: Contador, arriendo, agua, limpieza."
            >
              <input
                style={campo}
                value={item.nombre}
                onChange={e =>
                  actualizar({
                    items: actualizarItem(
                      formulario.items,
                      indice,
                      {
                        nombre: e.target.value
                      }
                    )
                  })
                }
              />
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Cantidad"
              ayuda="Número de personas, contratos o conceptos iguales."
            >
              <input
                style={campo}
                type="number"
                value={item.cantidad || ""}
                onChange={e =>
                  actualizar({
                    items: actualizarItem(
                      formulario.items,
                      indice,
                      {
                        cantidad: e.target.value
                      }
                    )
                  })
                }
              />
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Costo mensual unit."
              ayuda="Costo mensual de una unidad de este concepto."
            >
              <input
                style={campo}
                type="number"
                value={
                  item.costo_mensual_unitario || ""
                }
                onChange={e =>
                  actualizar({
                    items: actualizarItem(
                      formulario.items,
                      indice,
                      {
                        costo_mensual_unitario:
                          e.target.value
                      }
                    )
                  })
                }
              />
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Observación"
              ayuda="Dato útil para auditoría o revisión futura."
            >
              <input
                style={campo}
                value={item.observacion || ""}
                onChange={e =>
                  actualizar({
                    items: actualizarItem(
                      formulario.items,
                      indice,
                      {
                        observacion: e.target.value
                      }
                    )
                  })
                }
              />
            </CampoConAyuda>
          </div>
        ))}
        <button
          type="button"
          style={botonSecundario}
          onClick={() =>
            actualizar({
              items: [
                ...formulario.items,
                itemOperativoVacio()
              ]
            })
          }
        >
          + Agregar costo
        </button>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 12,
        marginBottom: 18
      }}>
        {[
          [
            "Costo mensual total",
            formatoMoneda(
              calculos.costo_mensual_total,
              formulario.moneda
            )
          ],
          [
            "Horas productivas mes",
            formatoNumero(
              calculos.horas_productivas_mes
            )
          ],
          [
            "Costo operativo fijo por hora",
            formatoMoneda(
              calculos.costo_operativo_hora,
              formulario.moneda
            )
          ]
        ].map(([titulo, valor]) => (
          <div
            key={titulo}
            style={{
              background: "#EFF6FF",
              padding: 16,
              borderRadius: 14
            }}
          >
            <div style={{
              color: "#475569",
              fontSize: 13
            }}>
              {titulo}
            </div>
            <strong style={{ fontSize: 22 }}>
              {valor}
            </strong>
          </div>
        ))}
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
            : "Guardar costos operativos"}
        </button>
        <button
          style={botonSecundario}
          onClick={limpiar}
        >
          Limpiar formulario
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
        <h3>Configuraciones guardadas</h3>
        {cargando ? (
          <p>Cargando...</p>
        ) : costos.length === 0 ? (
          <p>No hay costos operativos guardados.</p>
        ) : (
          costos.map(costo => (
            <div
              key={costo.id}
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
                display: "grid",
                gridTemplateColumns:
                  "1fr auto",
                gap: 12
              }}
            >
              <div>
                <strong>{costo.nombre}</strong>
                <div style={{
                  color: "#475569",
                  marginTop: 4
                }}>
                  Planta: {costo.planta_id} · Mensual:{" "}
                  {formatoMoneda(
                    costo.costo_mensual_total,
                    costo.moneda
                  )}{" "}
                  · Hora:{" "}
                  {formatoMoneda(
                    costo.costo_operativo_hora,
                    costo.moneda
                  )}
                </div>
              </div>
              <button
                type="button"
                style={botonSecundario}
                onClick={() => editar(costo)}
              >
                Editar
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
