import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  PERMISOS_V2,
  permisosPorRol
} from "../v2/config";
import {
  EMPRESAS_BBA,
  PLANTAS_BBA,
  ROLES_USUARIO_BBA,
  guardarUsuarioPermisos,
  listarUsuariosPermisos,
  normalizarUsuario
} from "./usuariosRepository";

const estadoInicial = {
  uid: "",
  nombre: "",
  email: "",
  rol: "supervisor",
  empresa_id: "bba",
  planta_ids: ["chile"],
  activo: true,
  permisos: {},
  estado_auth: "pendiente_auth",
  observacion: ""
};

const estiloInput = {
  width: "100%",
  padding: 10,
  border: "1px solid #CBD5E1",
  borderRadius: 10,
  boxSizing: "border-box",
  marginBottom: 10
};

const botonPrimario = {
  width: "100%",
  padding: 12,
  border: "none",
  borderRadius: 10,
  background: "#1976D2",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

const botonSecundario = {
  ...botonPrimario,
  background: "#455A64"
};

const permisosRolAplicables = rol =>
  permisosPorRol(rol);

const permisosOrdenados = PERMISOS_V2.slice()
  .sort((a, b) =>
    `${a.modulo}-${a.nombre}`.localeCompare(
      `${b.modulo}-${b.nombre}`
    )
  );

const esFichaReemplazada = usuario =>
  usuario.estado_auth === "reemplazado_por_uid";

export default function GestionUsuariosV2({
  db,
  perfil,
  onVolver
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [editandoId, setEditandoId] =
    useState("");
  const [cargando, setCargando] =
    useState(false);
  const [guardando, setGuardando] =
    useState(false);
  const [error, setError] = useState("");
  const [filtroRol, setFiltroRol] =
    useState("");
  const [filtroPlanta, setFiltroPlanta] =
    useState("");
  const [filtroActivo, setFiltroActivo] =
    useState("activos");
  const [filtroPermiso, setFiltroPermiso] =
    useState("");
  const [filtroHistorial, setFiltroHistorial] =
    useState("operativos");

  const cargar = async () => {
    setCargando(true);
    setError("");

    try {
      setUsuarios(
        await listarUsuariosPermisos(db)
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
        "No se pudieron cargar los usuarios."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actualizar = cambios => {
    setFormulario(prev => ({
      ...prev,
      ...cambios
    }));
  };

  const alternarPlanta = plantaId => {
    setFormulario(prev => {
      const actual = Array.isArray(prev.planta_ids)
        ? prev.planta_ids
        : [];
      const existe = actual.includes(plantaId);

      return {
        ...prev,
        planta_ids: existe
          ? actual.filter(id => id !== plantaId)
          : [...actual, plantaId]
      };
    });
  };

  const alternarPermiso = clave => {
    setFormulario(prev => ({
      ...prev,
      permisos: {
        ...(prev.permisos || {}),
        [clave]: !prev.permisos?.[clave]
      }
    }));
  };

  const aplicarPermisosRol = () => {
    actualizar({
      permisos:
        permisosRolAplicables(formulario.rol)
    });
  };

  const limpiarFormulario = () => {
    setFormulario(estadoInicial);
    setEditandoId("");
    setError("");
  };

  const editar = usuario => {
    setEditandoId(usuario.id);
    setFormulario(
      normalizarUsuario(usuario.id, usuario)
    );
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");

    try {
      await guardarUsuarioPermisos(
        db,
        {
          ...formulario,
          id: editandoId
        },
        perfil
      );
      await cargar();
      limpiarFormulario();
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
        "No se pudo guardar el usuario."
      );
    } finally {
      setGuardando(false);
    }
  };

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(usuario => {
      const activo = usuario.activo !== false;
      const reemplazada =
        esFichaReemplazada(usuario);

      const pasaHistorial =
        (
          filtroHistorial === "operativos" &&
          !reemplazada
        ) ||
        (
          filtroHistorial === "reemplazados" &&
          reemplazada
        ) ||
        filtroHistorial === "todos";

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

      const pasaRol =
        !filtroRol ||
        usuario.rol === filtroRol;

      const pasaPlanta =
        !filtroPlanta ||
        usuario.planta_ids.includes(
          filtroPlanta
        );

      const pasaPermiso =
        !filtroPermiso ||
        Boolean(
          usuario.permisos?.[filtroPermiso]
        );

      return (
        pasaHistorial &&
        pasaActivo &&
        pasaRol &&
        pasaPlanta &&
        pasaPermiso
      );
    });
  }, [
    usuarios,
    filtroActivo,
    filtroHistorial,
    filtroRol,
    filtroPlanta,
    filtroPermiso
  ]);

  const usuariosOperativos = usuarios.filter(
    usuario => !esFichaReemplazada(usuario)
  );
  const usuariosHistoricos = usuarios.filter(
    esFichaReemplazada
  );

  const resumen = {
    total: usuariosOperativos.length,
    activos: usuariosOperativos.filter(u =>
      u.activo !== false
    ).length,
    pendientesAuth: usuariosOperativos.filter(u =>
      u.estado_auth === "pendiente_auth"
    ).length,
    historicos: usuariosHistoricos.length
  };

  return (
    <div style={{
      padding: 20,
      maxWidth: 1180,
      margin: "0 auto"
    }}>
      <h2>
        Usuarios, Acceso y Permisos
      </h2>

      <p style={{
        color: "#475569",
        lineHeight: 1.5
      }}>
        Administra perfiles de acceso y permisos
        finos. La ficha puede quedar pendiente de
        creación Auth; los custom claims deben
        aplicarse desde backend/Admin SDK, nunca
        desde el navegador.
      </p>

      {error && (
        <div role="alert" style={{
          background: "#FFEBEE",
          color: "#B71C1C",
          padding: 12,
          borderRadius: 10,
          marginBottom: 14,
          fontWeight: "bold"
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 18
      }}>
        {[
          ["Usuarios operativos", resumen.total],
          ["Activos", resumen.activos],
          ["Pendientes Auth", resumen.pendientesAuth],
          ["Históricos ocultos", resumen.historicos]
        ].map(([titulo, valor]) => (
          <div key={titulo} style={{
            background: "white",
            padding: 16,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(15,23,42,0.08)"
          }}>
            <b>{titulo}</b>
            <h2 style={{
              margin: "8px 0 0",
              color: "#1976D2"
            }}>
              {valor}
            </h2>
          </div>
        ))}
      </div>

      <div style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>
          {editandoId
            ? "Editar usuario"
            : "Crear ficha de usuario"}
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12
        }}>
          <input
            style={estiloInput}
            placeholder="Nombre"
            value={formulario.nombre}
            onChange={e =>
              actualizar({
                nombre: e.target.value
              })
            }
          />

          <input
            style={estiloInput}
            placeholder="Email"
            value={formulario.email}
            onChange={e =>
              actualizar({
                email: e.target.value
              })
            }
          />

          <input
            style={estiloInput}
            placeholder="UID Firebase Auth opcional"
            value={formulario.uid}
            onChange={e =>
              actualizar({
                uid: e.target.value
              })
            }
          />

          <select
            style={estiloInput}
            value={formulario.rol}
            onChange={e =>
              actualizar({
                rol: e.target.value
              })
            }
          >
            {ROLES_USUARIO_BBA.map(rol => (
              <option key={rol} value={rol}>
                {rol}
              </option>
            ))}
          </select>

          <select
            style={estiloInput}
            value={formulario.empresa_id}
            onChange={e =>
              actualizar({
                empresa_id: e.target.value
              })
            }
          >
            {EMPRESAS_BBA.map(empresa => (
              <option
                key={empresa.id}
                value={empresa.id}
              >
                {empresa.nombre}
              </option>
            ))}
          </select>

          <select
            style={estiloInput}
            value={formulario.activo ? "si" : "no"}
            onChange={e =>
              actualizar({
                activo: e.target.value === "si"
              })
            }
          >
            <option value="si">
              Activo
            </option>
            <option value="no">
              Inactivo
            </option>
          </select>
        </div>

        <div style={{
          marginBottom: 14
        }}>
          <b>Plantas habilitadas</b>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 8
          }}>
            {PLANTAS_BBA.map(planta => (
              <label
                key={planta.id}
                style={{
                  background:
                    formulario.planta_ids.includes(
                      planta.id
                    )
                      ? "#E3F2FD"
                      : "#F8FAFC",
                  border:
                    "1px solid #CBD5E1",
                  borderRadius: 20,
                  padding: "7px 12px"
                }}
              >
                <input
                  type="checkbox"
                  checked={formulario.planta_ids.includes(
                    planta.id
                  )}
                  onChange={() =>
                    alternarPlanta(planta.id)
                  }
                />
                {" "}
                {planta.nombre}
              </label>
            ))}
          </div>
        </div>

        <textarea
          style={{
            ...estiloInput,
            minHeight: 70
          }}
          placeholder="Observación o instrucción para creación Auth/claims"
          value={formulario.observacion}
          onChange={e =>
            actualizar({
              observacion: e.target.value
            })
          }
        />

        <div style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          margin: "8px 0 14px"
        }}>
          <button
            type="button"
            style={{
              ...botonSecundario,
              width: "auto"
            }}
            onClick={aplicarPermisosRol}
          >
            Aplicar permisos base del rol
          </button>
          <button
            type="button"
            style={{
              ...botonSecundario,
              width: "auto",
              background: "#78909C"
            }}
            onClick={() =>
              actualizar({ permisos: {} })
            }
          >
            Limpiar permisos manuales
          </button>
        </div>

        <h4>
          Permisos finos
        </h4>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 10,
          marginBottom: 14
        }}>
          {permisosOrdenados.map(permiso => (
            <label
              key={permiso.clave}
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: 10,
                background:
                  formulario.permisos?.[permiso.clave]
                    ? "#E8F5E9"
                    : "#F8FAFC"
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(
                  formulario.permisos?.[
                    permiso.clave
                  ]
                )}
                onChange={() =>
                  alternarPermiso(permiso.clave)
                }
              />
              {" "}
              <b>{permiso.modulo}</b>
              <div style={{
                fontSize: 13,
                color: "#475569"
              }}>
                {permiso.nombre}
              </div>
            </label>
          ))}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10
        }}>
          <button
            style={botonPrimario}
            disabled={guardando}
            onClick={guardar}
          >
            {guardando
              ? "Guardando..."
              : "Guardar usuario"}
          </button>

          <button
            style={botonSecundario}
            onClick={limpiarFormulario}
          >
            Nuevo formulario
          </button>
        </div>
      </div>

      <div style={{
        background: "white",
        padding: 18,
        borderRadius: 14,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.08)",
        marginBottom: 18
      }}>
        <h3>Filtros</h3>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12
        }}>
          <select
            style={estiloInput}
            value={filtroActivo}
            onChange={e =>
              setFiltroActivo(e.target.value)
            }
          >
            <option value="activos">
              Activos
            </option>
            <option value="inactivos">
              Inactivos
            </option>
            <option value="todos">
              Todos
            </option>
          </select>

          <select
            style={estiloInput}
            value={filtroHistorial}
            onChange={e =>
              setFiltroHistorial(e.target.value)
            }
          >
            <option value="operativos">
              Solo usuarios operativos
            </option>
            <option value="reemplazados">
              Solo fichas reemplazadas
            </option>
            <option value="todos">
              Incluir históricos
            </option>
          </select>

          <select
            style={estiloInput}
            value={filtroRol}
            onChange={e =>
              setFiltroRol(e.target.value)
            }
          >
            <option value="">Todos los roles</option>
            {ROLES_USUARIO_BBA.map(rol => (
              <option key={rol} value={rol}>
                {rol}
              </option>
            ))}
          </select>

          <select
            style={estiloInput}
            value={filtroPlanta}
            onChange={e =>
              setFiltroPlanta(e.target.value)
            }
          >
            <option value="">
              Todas las plantas
            </option>
            {PLANTAS_BBA.map(planta => (
              <option
                key={planta.id}
                value={planta.id}
              >
                {planta.nombre}
              </option>
            ))}
          </select>

          <select
            style={estiloInput}
            value={filtroPermiso}
            onChange={e =>
              setFiltroPermiso(e.target.value)
            }
          >
            <option value="">
              Todos los permisos
            </option>
            {permisosOrdenados.map(permiso => (
              <option
                key={permiso.clave}
                value={permiso.clave}
              >
                {permiso.modulo}: {permiso.nombre}
              </option>
            ))}
          </select>
        </div>

        <b>
          Usuarios encontrados:{" "}
          {usuariosFiltrados.length}
        </b>
        {filtroHistorial === "operativos" &&
          resumen.historicos > 0 && (
            <div style={{
              marginTop: 8,
              color: "#64748B",
              fontSize: 13
            }}>
              {resumen.historicos} ficha(s)
              reemplazada(s) se mantienen ocultas
              para trazabilidad.
            </div>
          )}
      </div>

      {cargando && (
        <div style={{
          padding: 14,
          borderRadius: 10,
          background: "#E3F2FD",
          color: "#0D47A1",
          marginBottom: 14
        }}>
          Cargando usuarios...
        </div>
      )}

      <div style={{
        display: "grid",
        gap: 12
      }}>
        {usuariosFiltrados.map(usuario => (
          <div
            key={usuario.id}
            style={{
              background: "white",
              padding: 16,
              borderRadius: 14,
              borderLeft:
                usuario.activo !== false
                  ? "6px solid #2E7D32"
                  : "6px solid #B71C1C",
              boxShadow:
                "0 2px 8px rgba(15,23,42,0.08)"
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap"
            }}>
              <div>
                <h3 style={{
                  margin: "0 0 4px"
                }}>
                  {usuario.nombre || "Sin nombre"}
                </h3>
                <div style={{
                  color: "#475569"
                }}>
                  {usuario.email}
                </div>
                <div style={{
                  color: "#64748B",
                  fontSize: 13
                }}>
                  UID: {usuario.uid || "pendiente"}
                </div>
              </div>

              <div>
                <span style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 20,
                  background:
                    usuario.activo !== false
                      ? "#E8F5E9"
                      : "#FFEBEE",
                  color:
                    usuario.activo !== false
                      ? "#1B5E20"
                      : "#B71C1C",
                  fontWeight: "bold"
                }}>
                  {usuario.activo !== false
                    ? "Activo"
                    : "Inactivo"}
                </span>
              </div>
            </div>

            <div style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 8
            }}>
              <div>
                <b>Rol:</b> {usuario.rol}
              </div>
              <div>
                <b>Empresa:</b> {usuario.empresa_id}
              </div>
              <div>
                <b>Plantas:</b>{" "}
                {usuario.planta_ids.join(", ") || "-"}
              </div>
              <div>
                <b>Auth:</b> {usuario.estado_auth}
              </div>
            </div>

            <div style={{
              marginTop: 10
            }}>
              {Object.entries(usuario.permisos || {})
                .filter(([, valor]) => Boolean(valor))
                .map(([clave]) => (
                  <span
                    key={clave}
                    style={{
                      display: "inline-block",
                      background: "#E3F2FD",
                      color: "#0D47A1",
                      padding: "4px 8px",
                      borderRadius: 20,
                      fontSize: 12,
                      marginRight: 6,
                      marginBottom: 6
                    }}
                  >
                    {clave}
                  </span>
                ))}
            </div>

            {usuario.estado_auth === "pendiente_auth" && (
              <div style={{
                marginTop: 10,
                background: "#FFF8E1",
                color: "#5D4037",
                padding: 10,
                borderRadius: 10
              }}>
                Pendiente: crear cuenta en Firebase Auth y
                asignar custom claims con backend/Admin SDK.
              </div>
            )}

            <button
              style={{
                ...botonPrimario,
                marginTop: 12
              }}
              onClick={() => editar(usuario)}
            >
              Editar permisos
            </button>
          </div>
        ))}
      </div>

      <button
        style={{
          ...botonSecundario,
          marginTop: 18
        }}
        onClick={onVolver}
      >
        Volver
      </button>
    </div>
  );
}
