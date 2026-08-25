import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  TIPOS_TERCERO,
  guardarTercero,
  listarTerceros,
  siguienteCodigoTercero
} from "./tercerosRepository";

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
  id: "",
  codigo: "",
  nombre: "",
  rut: "",
  pais: "Chile",
  ciudad: "",
  contacto: "",
  email: "",
  telefono: "",
  condicion_pago: "",
  requiere_cotizacion_previa: false,
  observacion: "",
  activo: true
};

const CONDICIONES_PAGO = [
  "Factura 30",
  "Factura 45",
  "Factura 60",
  "Factura 90",
  "Contado",
  "Letra 30",
  "Cheque 30"
];

const normalizar = valor =>
  (valor || "")
    .toString()
    .trim()
    .toLowerCase();

export default function TercerosV2({
  db,
  perfil,
  onVolver
}) {
  const [tipo, setTipo] = useState(
    TIPOS_TERCERO.CLIENTE
  );
  const [clientes, setClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] =
    useState("activos");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        clientesCargados,
        proveedoresCargados
      ] = await Promise.all([
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.CLIENTE
        ),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.PROVEEDOR
        )
      ]);
      setClientes(clientesCargados);
      setProveedores(proveedoresCargados);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar clientes y proveedores."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const terceros =
    tipo === TIPOS_TERCERO.CLIENTE
      ? clientes
      : proveedores;

  useEffect(() => {
    if (formulario.id) {
      return;
    }

    const siguienteCodigo =
      siguienteCodigoTercero(terceros, tipo);

    setFormulario(actual =>
      actual.codigo === siguienteCodigo
        ? actual
        : {
            ...actual,
            codigo: siguienteCodigo
          }
    );
  }, [
    formulario.id,
    terceros,
    tipo
  ]);

  const tercerosFiltrados = useMemo(
    () =>
      terceros.filter(tercero => {
        const texto = normalizar(
          [
            tercero.codigo,
            tercero.nombre,
            tercero.rut,
            tercero.pais,
            tercero.contacto
          ].join(" ")
        );
        const activo = tercero.activo !== false;
        const pasaActivo =
          filtroActivo === "todos" ||
          (
            filtroActivo === "activos" &&
            activo
          ) ||
          (
            filtroActivo === "inactivos" &&
            !activo
          );

        return (
          pasaActivo &&
          texto.includes(normalizar(busqueda))
        );
      }),
    [terceros, busqueda, filtroActivo]
  );

  const actualizar = cambios => {
    setFormulario(actual => ({
      ...actual,
      ...cambios
    }));
    setMensaje("");
    setError("");
  };

  const limpiar = () => {
    setFormulario(estadoInicial);
    setMensaje("");
    setError("");
  };

  const editar = tercero => {
    setFormulario({
      ...estadoInicial,
      ...tercero
    });
    setMensaje("");
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
      await guardarTercero(
        db,
        perfil,
        tipo,
        {
          ...formulario,
          codigo: formulario.id
            ? formulario.codigo
            : siguienteCodigoTercero(
                terceros,
                tipo
              )
        },
        terceros
      );
      await cargar();
      limpiar();
      setMensaje("Registro guardado correctamente.");
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar el registro."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      padding: 20,
      maxWidth: 1180,
      margin: "0 auto"
    }}>
      <BotonVolver
        onClick={onVolver}
        style={{ marginBottom: 12 }}
      >
        Volver
      </BotonVolver>

      <h2>Clientes y Proveedores</h2>
      <p style={{
        color: "#475569",
        lineHeight: 1.5
      }}>
        Mantiene la base maestra de terceros para
        evitar errores de digitación en cotizaciones,
        compras y futuras integraciones comerciales.
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
          {formulario.id ? "Editar" : "Crear"}{" "}
          {tipo === TIPOS_TERCERO.CLIENTE
            ? "cliente"
            : "proveedor"}
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12
        }}>
          <select
            style={campo}
            value={tipo}
            onChange={e => {
              setTipo(e.target.value);
              limpiar();
            }}
          >
            <option value={TIPOS_TERCERO.CLIENTE}>
              Cliente
            </option>
            <option value={TIPOS_TERCERO.PROVEEDOR}>
              Proveedor
            </option>
          </select>
          <input
            style={campo}
            placeholder="Código automático"
            value={formulario.codigo}
            disabled
          />
          <input
            style={campo}
            placeholder="Nombre"
            value={formulario.nombre}
            onChange={e =>
              actualizar({ nombre: e.target.value })
            }
          />
          <input
            style={campo}
            placeholder="RUT / ID tributario"
            value={formulario.rut}
            onChange={e =>
              actualizar({ rut: e.target.value })
            }
          />
          <input
            style={campo}
            placeholder="País"
            value={formulario.pais}
            onChange={e =>
              actualizar({ pais: e.target.value })
            }
          />
          <input
            style={campo}
            placeholder="Ciudad"
            value={formulario.ciudad}
            onChange={e =>
              actualizar({ ciudad: e.target.value })
            }
          />
          <input
            style={campo}
            placeholder="Contacto"
            value={formulario.contacto}
            onChange={e =>
              actualizar({ contacto: e.target.value })
            }
          />
          <input
            style={campo}
            placeholder="Email"
            value={formulario.email}
            onChange={e =>
              actualizar({ email: e.target.value })
            }
          />
          <input
            style={campo}
            placeholder="Teléfono"
            value={formulario.telefono}
            onChange={e =>
              actualizar({ telefono: e.target.value })
            }
          />
          <select
            style={campo}
            value={formulario.condicion_pago}
            onChange={e =>
              actualizar({
                condicion_pago: e.target.value
              })
            }
          >
            <option value="">
              Condición de pago
            </option>
            {formulario.condicion_pago &&
              !CONDICIONES_PAGO.includes(
                formulario.condicion_pago
              ) && (
                <option
                  value={formulario.condicion_pago}
                >
                  {formulario.condicion_pago}
                </option>
              )}
            {CONDICIONES_PAGO.map(condicion => (
              <option
                key={condicion}
                value={condicion}
              >
                {condicion}
              </option>
            ))}
          </select>
          <select
            style={campo}
            value={formulario.activo ? "true" : "false"}
            onChange={e =>
              actualizar({
                activo: e.target.value === "true"
              })
            }
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
          {tipo === TIPOS_TERCERO.PROVEEDOR && (
            <label style={{
              border: "1px solid #CBD5E1",
              borderRadius: 10,
              padding: 10,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              color: "#334155"
            }}>
              <input
                type="checkbox"
                checked={
                  formulario.requiere_cotizacion_previa === true
                }
                onChange={e =>
                  actualizar({
                    requiere_cotizacion_previa:
                      e.target.checked
                  })
                }
                style={{
                  marginTop: 3
                }}
              />
              <span>
                Requiere cotización/proforma antes de OC
                <small style={{
                  display: "block",
                  color: "#64748B",
                  marginTop: 3
                }}>
                  Compras verá una sugerencia para pedir
                  cotización antes de emitir la OC.
                </small>
              </span>
            </label>
          )}
        </div>
        <textarea
          style={{
            ...campo,
            minHeight: 70,
            marginTop: 12
          }}
          placeholder="Observación"
          value={formulario.observacion}
          onChange={e =>
            actualizar({ observacion: e.target.value })
          }
        />
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 12
        }}>
          <button
            style={boton}
            disabled={guardando}
            onClick={guardar}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          <button
            style={botonSecundario}
            onClick={limpiar}
          >
            Nuevo
          </button>
        </div>
      </section>

      <section style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)"
      }}>
        <h3>Listado</h3>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
          marginBottom: 14
        }}>
          <select
            style={campo}
            value={tipo}
            onChange={e => {
              setTipo(e.target.value);
              limpiar();
            }}
          >
            <option value={TIPOS_TERCERO.CLIENTE}>
              Clientes
            </option>
            <option value={TIPOS_TERCERO.PROVEEDOR}>
              Proveedores
            </option>
          </select>
          <input
            style={campo}
            placeholder="Buscar"
            value={busqueda}
            onChange={e =>
              setBusqueda(e.target.value)
            }
          />
          <select
            style={campo}
            value={filtroActivo}
            onChange={e =>
              setFiltroActivo(e.target.value)
            }
          >
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        {cargando && <div>Cargando...</div>}
        {tercerosFiltrados.map(tercero => (
          <div
            key={tercero.id}
            style={{
              borderBottom: "1px solid #E2E8F0",
              padding: "12px 0"
            }}
          >
            <b>{tercero.codigo}</b>{" "}
            {tercero.nombre}
            <div style={{ color: "#475569" }}>
              {tercero.pais}
              {tercero.contacto
                ? ` / ${tercero.contacto}`
                : ""}
              {tercero.condicion_pago
                ? ` / ${tercero.condicion_pago}`
                : ""}
              {tipo === TIPOS_TERCERO.PROVEEDOR &&
              tercero.requiere_cotizacion_previa
                ? " / Cotiza antes de OC"
                : ""}
            </div>
            <div style={{
              display: "flex",
              gap: 8,
              marginTop: 8
            }}>
              <button
                style={{
                  ...boton,
                  padding: "8px 10px"
                }}
                onClick={() => editar(tercero)}
              >
                Editar
              </button>
              <span style={{
                alignSelf: "center",
                color:
                  tercero.activo !== false
                    ? "#2E7D32"
                    : "#B71C1C",
                fontWeight: "bold"
              }}>
                {tercero.activo !== false
                  ? "Activo"
                  : "Inactivo"}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
