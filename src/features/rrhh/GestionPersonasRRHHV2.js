import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import * as XLSX from "xlsx";
import {
  EQUIPOS_TRABAJO_RRHH,
  PLANTAS_RRHH,
  ROLES_LABORALES_RRHH,
  guardarPersonaRRHH,
  listarHabilidadesEstacion,
  listarPersonasRRHH,
  normalizarPersona
} from "./rrhhRepository";
import {
  hojasPlantillaPersonal,
  leerPersonalDesdeWorkbook,
  resumenPersonal
} from "./importacionPersonalUtils";

const estadoInicial = {
  codigo: "",
  nombre: "",
  rol_laboral: "operario",
  activo: true,
  planta_id: "chile",
  equipo: "",
  habilidades_estacion_ids: [],
  fecha_ingreso: "",
  fecha_salida: "",
  motivo_salida: "",
  observacion: ""
};

const campo = {
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

const normalizar = valor =>
  (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const descargarPlantillaPersonal = () => {
  const workbook = XLSX.utils.book_new();

  Object.entries(hojasPlantillaPersonal)
    .forEach(([nombre, filas]) => {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(filas),
        nombre
      );
    });

  XLSX.writeFile(
    workbook,
    "plantilla-personal-bba.xlsx"
  );
};

export default function GestionPersonasRRHHV2({
  db,
  perfil,
  onVolver
}) {
  const [personas, setPersonas] = useState([]);
  const [habilidades, setHabilidades] =
    useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [editandoId, setEditandoId] =
    useState("");
  const [cargando, setCargando] =
    useState(true);
  const [guardando, setGuardando] =
    useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [archivoPersonalNombre, setArchivoPersonalNombre] =
    useState("");
  const [previewPersonal, setPreviewPersonal] =
    useState(null);
  const [importandoPersonal, setImportandoPersonal] =
    useState(false);
  const [filtroEquipo, setFiltroEquipo] =
    useState("");
  const [filtroHabilidad, setFiltroHabilidad] =
    useState("");
  const [filtroActivo, setFiltroActivo] =
    useState("activos");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        personasCargadas,
        habilidadesCargadas
      ] = await Promise.all([
        listarPersonasRRHH(
          db,
          perfil.empresa_id
        ),
        listarHabilidadesEstacion(
          db,
          perfil.empresa_id
        )
      ]);
      setPersonas(personasCargadas);
      setHabilidades(habilidadesCargadas);
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar RRHH."
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
    setError("");
    setMensaje("");
  };

  const alternarHabilidad = clave => {
    setFormulario(actual => {
      const actuales =
        actual.habilidades_estacion_ids || [];
      const existe = actuales.includes(clave);
      return {
        ...actual,
        habilidades_estacion_ids: existe
          ? actuales.filter(item => item !== clave)
          : [...actuales, clave]
      };
    });
  };

  const limpiar = () => {
    setFormulario(estadoInicial);
    setEditandoId("");
    setError("");
    setMensaje("");
  };

  const editar = persona => {
    const normalizada =
      normalizarPersona(persona.id, persona);
    setEditandoId(persona.id);
    setFormulario({
      ...estadoInicial,
      ...normalizada
    });
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
      await guardarPersonaRRHH(
        db,
        perfil,
        {
          ...formulario,
          id: editandoId
        },
        habilidades
      );
      await cargar();
      limpiar();
      setMensaje("Persona guardada correctamente.");
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar la persona."
      );
    } finally {
      setGuardando(false);
    }
  };

  const personasFiltradas = useMemo(
    () =>
      personas.filter(persona => {
        const activo =
          persona.activo !== false;
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
        const pasaEquipo =
          !filtroEquipo ||
          normalizar(persona.equipo) ===
            normalizar(filtroEquipo);
        const pasaHabilidad =
          !filtroHabilidad ||
          (
            persona.habilidades_estacion_ids || []
          ).includes(filtroHabilidad);

        return (
          pasaActivo &&
          pasaEquipo &&
          pasaHabilidad
        );
      }),
    [
      personas,
      filtroActivo,
      filtroEquipo,
      filtroHabilidad
    ]
  );

  const resumenEquipo = equipo => {
    const miembros = personas.filter(
      persona =>
        persona.activo !== false &&
        normalizar(persona.equipo) ===
          normalizar(equipo)
    );
    const habilidadesEquipo = new Set(
      miembros.flatMap(
        persona =>
          persona.habilidades_estacion_ids || []
      )
    );

    return {
      equipo,
      activos: miembros.length,
      habilidades: habilidadesEquipo.size
    };
  };

  const resumen = {
    activos: personas.filter(p =>
      p.activo !== false
    ).length,
    inactivos: personas.filter(p =>
      p.activo === false
    ).length,
    sinEquipo: personas.filter(
      p => p.activo !== false && !p.equipo
    ).length,
    equipos: EQUIPOS_TRABAJO_RRHH.map(
      resumenEquipo
    )
  };
  const resumenImportacionPersonal = useMemo(
    () => resumenPersonal(previewPersonal),
    [previewPersonal]
  );

  const cargarArchivoPersonal = async evento => {
    const archivo = evento.target.files?.[0];
    if (!archivo) {
      return;
    }

    try {
      setError("");
      setMensaje("");
      setArchivoPersonalNombre(archivo.name);
      const buffer = await archivo.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array"
      });
      const data = leerPersonalDesdeWorkbook(
        workbook,
        XLSX
      );

      const habilidadesDisponibles = new Set(
        habilidades.map(habilidad =>
          normalizar(habilidad.clave)
        )
      );
      const advertenciasHabilidades = [];

      data.personas.forEach(persona => {
        (persona.habilidades_estacion_ids || [])
          .forEach(habilidadId => {
            if (
              habilidadId &&
              !habilidadesDisponibles.has(
                normalizar(habilidadId)
              )
            ) {
              advertenciasHabilidades.push(
                `Persona ${persona.nombre}: habilidad ${habilidadId} no existe en estaciones V2 y se importará sin etiqueta visible.`
              );
            }
          });
      });

      setPreviewPersonal({
        ...data,
        advertencias: [
          ...data.advertencias,
          ...advertenciasHabilidades
        ]
      });
    } catch (fallo) {
      setPreviewPersonal(null);
      setError(
        fallo?.message ||
        "No se pudo leer el Excel de personal."
      );
    } finally {
      evento.target.value = "";
    }
  };

  const importarPersonal = async () => {
    if (!previewPersonal) {
      return;
    }
    if (previewPersonal.errores.length > 0) {
      setError(
        "Corrige los errores del Excel antes de importar."
      );
      return;
    }

    try {
      setImportandoPersonal(true);
      setError("");
      setMensaje("");
      const existentesPorCodigo = new Map(
        personas
          .filter(persona => persona.codigo)
          .map(persona => [
            persona.codigo,
            persona
          ])
      );

      for (const persona of previewPersonal.personas) {
        const existente =
          persona.codigo &&
          existentesPorCodigo.get(persona.codigo);

        await guardarPersonaRRHH(
          db,
          perfil,
          {
            ...persona,
            id: existente?.id || ""
          },
          habilidades
        );
      }

      await cargar();
      setPreviewPersonal(null);
      setArchivoPersonalNombre("");
      setMensaje(
        "Personal importado correctamente."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo importar el personal."
      );
    } finally {
      setImportandoPersonal(false);
    }
  };

  const brechas = habilidades
    .map(habilidad => {
      const conteos = Object.fromEntries(
        EQUIPOS_TRABAJO_RRHH.map(equipo => [
          equipo,
          personas.filter(
            persona =>
              persona.activo !== false &&
              normalizar(persona.equipo) ===
                normalizar(equipo) &&
              (
                persona.habilidades_estacion_ids ||
                []
              ).includes(habilidad.clave)
          ).length
        ])
      );
      return {
        habilidad,
        conteos,
        diferencia: Math.abs(
          (conteos.Alexis || 0) -
            (conteos.Pablo || 0)
        )
      };
    })
    .filter(item =>
      item.diferencia > 0 ||
      Object.values(item.conteos)
        .some(valor => valor === 0)
    )
    .sort((a, b) =>
      b.diferencia - a.diferencia
    );

  return (
    <div style={{
      padding: 20,
      maxWidth: 1180,
      margin: "0 auto"
    }}>
      <h2>RRHH / Personas</h2>
      <p style={{
        color: "#475569",
        lineHeight: 1.5
      }}>
        Gestiona personas de planta, aunque no
        usen el sistema. Producción usa esta base
        para dotación, equipos y habilidades por
        estación.
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

      {mensaje && (
        <div role="status" style={{
          background: "#E8F5E9",
          color: "#1B5E20",
          padding: 12,
          borderRadius: 10,
          marginBottom: 14,
          fontWeight: "bold"
        }}>
          {mensaje}
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
          ["Activos", resumen.activos],
          ["Inactivos", resumen.inactivos],
          ["Sin equipo", resumen.sinEquipo],
          [
            "Estaciones con habilidad",
            habilidades.length
          ]
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
              color: "#1976D2",
              margin: "8px 0 0"
            }}>
              {valor}
            </h2>
          </div>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
        marginBottom: 18
      }}>
        {resumen.equipos.map(item => (
          <div key={item.equipo} style={{
            background: "#F8FAFC",
            padding: 14,
            borderRadius: 14,
            border: "1px solid #E2E8F0"
          }}>
            <b>Equipo {item.equipo}</b>
            <div>{item.activos} personas activas</div>
            <div>{item.habilidades} habilidades cubiertas</div>
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
        <h3>Importar personal codificado</h3>
        <p style={{
          color: "#64748B",
          lineHeight: 1.5
        }}>
          Usa esta plantilla para migrar operarios
          desde la app anterior o cargar personas
          nuevas en bloque. Si dejas el código vacío,
          el sistema asignará el siguiente PER
          disponible.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 12
        }}>
          <button
            type="button"
            style={botonSecundario}
            onClick={descargarPlantillaPersonal}
          >
            Descargar plantilla personal
          </button>
          <label style={{
            ...botonPrimario,
            textAlign: "center"
          }}>
            Subir Excel personal
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={cargarArchivoPersonal}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {previewPersonal && (
          <div style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 12,
            padding: 12,
            marginBottom: 16
          }}>
            <b>
              Vista previa: {archivoPersonalNombre}
            </b>
            <div style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8
            }}>
              <span>
                Personas: {resumenImportacionPersonal.personas}
              </span>
              <span>
                Errores: {resumenImportacionPersonal.errores}
              </span>
              <span>
                Advertencias: {resumenImportacionPersonal.advertencias}
              </span>
            </div>
            {previewPersonal.errores.length > 0 && (
              <ul style={{ color: "#B71C1C" }}>
                {previewPersonal.errores.map(errorItem => (
                  <li key={errorItem}>{errorItem}</li>
                ))}
              </ul>
            )}
            {previewPersonal.advertencias.length > 0 && (
              <ul style={{ color: "#B45309" }}>
                {previewPersonal.advertencias
                  .slice(0, 8)
                  .map(advertencia => (
                    <li key={advertencia}>
                      {advertencia}
                    </li>
                  ))}
              </ul>
            )}
            <div style={{
              maxHeight: 220,
              overflow: "auto",
              margin: "12px 0",
              border: "1px solid #E2E8F0",
              borderRadius: 10
            }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13
              }}>
                <thead>
                  <tr>
                    {[
                      "Código",
                      "Nombre",
                      "Planta",
                      "Equipo",
                      "Activo",
                      "Habilidades"
                    ].map(titulo => (
                      <th
                        key={titulo}
                        style={{
                          textAlign: "left",
                          padding: 8,
                          borderBottom:
                            "1px solid #E2E8F0"
                        }}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewPersonal.personas
                    .slice(0, 12)
                    .map((persona, indice) => (
                      <tr key={`${persona.codigo}-${indice}`}>
                        <td style={{ padding: 8 }}>
                          {persona.codigo ||
                            "Automático"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {persona.nombre}
                        </td>
                        <td style={{ padding: 8 }}>
                          {persona.planta_id}
                        </td>
                        <td style={{ padding: 8 }}>
                          {persona.equipo ||
                            "Sin equipo"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {persona.activo
                            ? "Sí"
                            : "No"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {persona
                            .habilidades_estacion_ids
                            .join(", ")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              style={botonPrimario}
              disabled={
                importandoPersonal ||
                previewPersonal.errores.length > 0
              }
              onClick={importarPersonal}
            >
              {importandoPersonal
                ? "Importando..."
                : "Confirmar importación"}
            </button>
          </div>
        )}

        <hr style={{
          border: "none",
          borderTop: "1px solid #E2E8F0",
          margin: "18px 0"
        }} />

        <h3>
          {editandoId
            ? "Editar persona"
            : "Crear persona"}
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12
        }}>
          <input
            style={campo}
            placeholder="Código automático PER0001"
            value={formulario.codigo}
            disabled
          />

          <input
            style={campo}
            placeholder="Nombre"
            value={formulario.nombre}
            onChange={e =>
              actualizar({
                nombre: e.target.value
              })
            }
          />

          <select
            style={campo}
            value={formulario.rol_laboral}
            onChange={e =>
              actualizar({
                rol_laboral: e.target.value
              })
            }
          >
            {ROLES_LABORALES_RRHH.map(rol => (
              <option key={rol} value={rol}>
                {rol}
              </option>
            ))}
          </select>

          <select
            style={campo}
            value={formulario.planta_id}
            onChange={e =>
              actualizar({
                planta_id: e.target.value
              })
            }
          >
            {PLANTAS_RRHH.map(planta => (
              <option key={planta.id} value={planta.id}>
                {planta.nombre}
              </option>
            ))}
          </select>

          <select
            style={campo}
            value={formulario.activo ? "true" : "false"}
            onChange={e =>
              actualizar({
                activo: e.target.value === "true",
                equipo:
                  e.target.value === "true"
                    ? formulario.equipo
                    : ""
              })
            }
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>

          <select
            style={campo}
            value={formulario.equipo}
            disabled={!formulario.activo}
            onChange={e =>
              actualizar({
                equipo: e.target.value
              })
            }
          >
            <option value="">Sin equipo</option>
            {EQUIPOS_TRABAJO_RRHH.map(equipo => (
              <option key={equipo} value={equipo}>
                Equipo {equipo}
              </option>
            ))}
          </select>

          <input
            style={campo}
            type="date"
            value={formulario.fecha_ingreso}
            onChange={e =>
              actualizar({
                fecha_ingreso: e.target.value
              })
            }
          />
        </div>

        {!formulario.activo && (
          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}>
            <input
              style={campo}
              type="date"
              value={formulario.fecha_salida}
              onChange={e =>
                actualizar({
                  fecha_salida: e.target.value
                })
              }
            />
            <input
              style={campo}
              placeholder="Motivo salida"
              value={formulario.motivo_salida}
              onChange={e =>
                actualizar({
                  motivo_salida: e.target.value
                })
              }
            />
          </div>
        )}

        <textarea
          style={{
            ...campo,
            minHeight: 70
          }}
          placeholder="Observación"
          value={formulario.observacion}
          onChange={e =>
            actualizar({
              observacion: e.target.value
            })
          }
        />

        <h4>Habilidades por estación</h4>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 8,
          maxHeight: 260,
          overflow: "auto",
          padding: 8,
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          marginBottom: 14
        }}>
          {habilidades.length === 0 && (
            <div style={{ color: "#64748B" }}>
              Crea estaciones en Procesos y Estaciones
              para seleccionarlas como habilidades.
            </div>
          )}
          {habilidades.map(habilidad => (
            <label
              key={habilidad.clave}
              style={{
                background:
                  formulario.habilidades_estacion_ids
                    .includes(habilidad.clave)
                    ? "#E8F5E9"
                    : "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 10,
                padding: 8
              }}
            >
              <input
                type="checkbox"
                checked={formulario.habilidades_estacion_ids
                  .includes(habilidad.clave)}
                onChange={() =>
                  alternarHabilidad(habilidad.clave)
                }
              />
              {" "}
              {habilidad.etiqueta}
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
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          <button
            style={botonSecundario}
            onClick={limpiar}
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
          <select
            style={campo}
            value={filtroEquipo}
            onChange={e =>
              setFiltroEquipo(e.target.value)
            }
          >
            <option value="">Todos los equipos</option>
            {EQUIPOS_TRABAJO_RRHH.map(equipo => (
              <option key={equipo} value={equipo}>
                Equipo {equipo}
              </option>
            ))}
          </select>
          <select
            style={campo}
            value={filtroHabilidad}
            onChange={e =>
              setFiltroHabilidad(e.target.value)
            }
          >
            <option value="">Todas las habilidades</option>
            {habilidades.map(habilidad => (
              <option
                key={habilidad.clave}
                value={habilidad.clave}
              >
                {habilidad.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <b>
          Personas encontradas: {personasFiltradas.length}
        </b>
      </div>

      {brechas.length > 0 && (
        <div style={{
          background: "#E3F2FD",
          color: "#0D47A1",
          padding: 16,
          borderRadius: 14,
          marginBottom: 18
        }}>
          <b>Lectura para balance e IA:</b>
          {brechas.slice(0, 6).map(item => (
            <div key={item.habilidad.clave}>
              {item.habilidad.estacion_nombre}: Alexis{" "}
              {item.conteos.Alexis || 0} / Pablo{" "}
              {item.conteos.Pablo || 0}
            </div>
          ))}
        </div>
      )}

      {cargando && (
        <div style={{
          padding: 14,
          background: "#E3F2FD",
          color: "#0D47A1",
          borderRadius: 10,
          marginBottom: 14
        }}>
          Cargando personas...
        </div>
      )}

      <div style={{
        display: "grid",
        gap: 12
      }}>
        {personasFiltradas.map(persona => (
          <div
            key={persona.id}
            style={{
              background: "white",
              padding: 16,
              borderRadius: 14,
              borderLeft:
                persona.activo !== false
                  ? "6px solid #2E7D32"
                  : "6px solid #B71C1C",
              boxShadow:
                "0 2px 8px rgba(15,23,42,0.08)"
            }}
          >
            <h3 style={{ margin: "0 0 6px" }}>
              {persona.codigo
                ? `${persona.codigo} - ${persona.nombre}`
                : persona.nombre}
            </h3>
            <div>
              <b>Rol:</b> {persona.rol_laboral}
            </div>
            <div>
              <b>Estado:</b>{" "}
              {persona.activo !== false
                ? "Activo"
                : "Inactivo"}
            </div>
            <div>
              <b>Equipo:</b>{" "}
              {persona.equipo || "Sin equipo"}
            </div>
            <div style={{ marginTop: 8 }}>
              {(persona.habilidades_estaciones || [])
                .map(habilidad => (
                  <span
                    key={
                      habilidad.clave ||
                      habilidad.estacion_codigo
                    }
                    style={{
                      display: "inline-block",
                      background: "#F1F8E9",
                      color: "#33691E",
                      padding: "4px 8px",
                      borderRadius: 20,
                      marginRight: 6,
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: "bold"
                    }}
                  >
                    {habilidad.estacion_nombre}
                  </span>
                ))}
            </div>
            <button
              style={{
                ...botonPrimario,
                marginTop: 12
              }}
              onClick={() => editar(persona)}
            >
              Editar persona
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
