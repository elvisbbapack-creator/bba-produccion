import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  TIPOS_MATERIAL
} from "../../domain/produccionV2";
import {
  TIPOS_TERCERO,
  listarTerceros
} from "../terceros/tercerosRepository";
import {
  actualizarMaterial,
  cambiarEstadoMaterial,
  crearMaterial,
  listarMateriales,
  prepararMaterial,
  validarNuevoMaterial
} from "./materialesRepository";

const estadoInicial = {
  tipo: TIPOS_MATERIAL.MATERIA_PRIMA,
  codigo: "",
  nombre: "",
  unidad_medida: "unidad",
  costo_unitario_referencial: 0,
  moneda: "CLP",
  minimo_compra: 0,
  proveedor_preferente_id: "",
  proveedor_preferente_codigo: "",
  proveedor_preferente_nombre: "",
  costo_origen: "catalogo_material",
  es_comprado: true
};

const estiloCampo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

function CatalogoMaterialesV2({
  db,
  perfil,
  onVolver
}) {
  const [materiales, setMateriales] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [editandoId, setEditandoId] =
    useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        materialesCargados,
        proveedoresCargados
      ] = await Promise.all([
        listarMateriales(
          db,
          perfil.empresa_id
        ),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.PROVEEDOR
        )
      ]);
      setMateriales(materialesCargados);
      setProveedores(
        proveedoresCargados.filter(
          proveedor => proveedor.activo !== false
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudieron cargar los materiales."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const vistaPrevia = useMemo(
    () => prepararMaterial(
      formulario,
      perfil.empresa_id,
      editandoId || "vista-previa"
    ),
    [editandoId, formulario, perfil.empresa_id]
  );

  const erroresFormulario = useMemo(
    () => validarNuevoMaterial(
      vistaPrevia,
      materiales
    ),
    [materiales, vistaPrevia]
  );

  const actualizarCampo = (campo, valor) => {
    setFormulario(actual => ({
      ...actual,
      [campo]: valor
    }));
    setError("");
    setMensaje("");
  };

  const limpiarFormulario = () => {
    setFormulario(estadoInicial);
    setEditandoId("");
    setError("");
  };

  const editar = material => {
    setEditandoId(material.id);
    setFormulario({
      tipo: material.tipo,
      codigo: material.codigo,
      nombre: material.nombre,
      unidad_medida: material.unidad_medida,
      costo_unitario_referencial:
        material.costo_unitario_referencial || 0,
      moneda: material.moneda || "CLP",
      minimo_compra: material.minimo_compra || 0,
      proveedor_preferente_id:
        material.proveedor_preferente_id || "",
      proveedor_preferente_codigo:
        material.proveedor_preferente_codigo || "",
      proveedor_preferente_nombre:
        material.proveedor_preferente_nombre || "",
      costo_origen:
        material.costo_origen || "catalogo_material",
      es_comprado: Boolean(material.es_comprado),
      activo: material.activo !== false
    });
    setError("");
    setMensaje("");
  };

  const guardar = async (evento) => {
    evento.preventDefault();

    if (erroresFormulario.length > 0) {
      setError(erroresFormulario.join(" "));
      return;
    }

    try {
      setGuardando(true);
      setError("");
      if (editandoId) {
        await actualizarMaterial(
          db,
          perfil.empresa_id,
          editandoId,
          formulario,
          materiales
        );
        setMensaje(
          "Material actualizado correctamente."
        );
      } else {
        await crearMaterial(
          db,
          perfil.empresa_id,
          formulario
        );
        setMensaje(
          "Material creado correctamente."
        );
      }
      limpiarFormulario();
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo guardar el material."
      );
    } finally {
      setGuardando(false);
    }
  };

  const seleccionarProveedor = proveedorId => {
    const proveedor = proveedores.find(
      item => item.id === proveedorId
    );

    setFormulario(actual => ({
      ...actual,
      proveedor_preferente_id: proveedorId,
      proveedor_preferente_codigo:
        proveedor?.codigo || "",
      proveedor_preferente_nombre:
        proveedor?.nombre || ""
    }));
    setError("");
    setMensaje("");
  };

  const cambiarEstado = async (material) => {
    try {
      setError("");
      setMensaje("");
      await cambiarEstadoMaterial(
        db,
        material.id,
        !material.activo
      );
      setMateriales(actuales =>
        actuales.map(item =>
          item.id === material.id
            ? {
              ...item,
              activo: !item.activo
            }
            : item
        )
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cambiar el estado."
      );
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
            fontWeight: "bold",
            marginBottom: 12
          }}
        >
          Volver a Ingeniería
        </button>

        <h1 style={{ marginBottom: 4 }}>
          Catálogo de materiales V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Materias primas (MP) y recursos de
          fabricación semielaborados (RF).
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(300px, 1fr))",
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
                "0 2px 10px rgba(15,23,42,0.08)"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              {editandoId
                ? "Editar material"
                : "Nuevo material"}
            </h2>

            <label>
              Tipo
              <select
                value={formulario.tipo}
                onChange={evento => {
                  const tipo = evento.target.value;
                  setFormulario(actual => ({
                    ...actual,
                    tipo,
                    codigo: tipo,
                    es_comprado:
                      tipo ===
                      TIPOS_MATERIAL.MATERIA_PRIMA
                  }));
                  setError("");
                  setMensaje("");
                }}
                disabled={Boolean(editandoId)}
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14,
                  background: editandoId
                    ? "#F8FAFC"
                    : "white"
                }}
              >
                <option value="MP">
                  MP - Materia prima
                </option>
                <option value="RF">
                  RF - Recurso de fabricación
                </option>
              </select>
            </label>

            <label>
              Código
              <input
                value={formulario.codigo}
                onChange={evento =>
                  actualizarCampo(
                    "codigo",
                    evento.target.value
                  )
                }
                placeholder={`${formulario.tipo}0001`}
                disabled={Boolean(editandoId)}
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14,
                  background: editandoId
                    ? "#F8FAFC"
                    : "white"
                }}
              />
            </label>

            <label>
              Nombre
              <input
                value={formulario.nombre}
                onChange={evento =>
                  actualizarCampo(
                    "nombre",
                    evento.target.value
                  )
                }
                placeholder="Ej. Tubo 15x15x1 mm"
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Unidad de medida
              <input
                value={formulario.unidad_medida}
                onChange={evento =>
                  actualizarCampo(
                    "unidad_medida",
                    evento.target.value
                  )
                }
                placeholder="unidad, metro, kg..."
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10
            }}>
              <label>
                Costo unitario referencial
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={
                    formulario.costo_unitario_referencial ||
                    ""
                  }
                  onChange={evento =>
                    actualizarCampo(
                      "costo_unitario_referencial",
                      evento.target.value
                    )
                  }
                  placeholder="Ej. 1250"
                  style={{
                    ...estiloCampo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Moneda
                <select
                  value={formulario.moneda}
                  onChange={evento =>
                    actualizarCampo(
                      "moneda",
                      evento.target.value
                    )
                  }
                  style={{
                    ...estiloCampo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                >
                  <option value="CLP">CLP</option>
                  <option value="PEN">PEN</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>

            <label>
              Mínimo de compra
              <input
                type="number"
                step="0.0001"
                min="0"
                inputMode="decimal"
                value={formulario.minimo_compra || ""}
                onChange={evento =>
                  actualizarCampo(
                    "minimo_compra",
                    evento.target.value
                  )
                }
                placeholder="Ej. 1 plancha, 6 metros, 25 kg"
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Proveedor preferente
              <select
                value={
                  formulario.proveedor_preferente_id ||
                  ""
                }
                onChange={evento =>
                  seleccionarProveedor(
                    evento.target.value
                  )
                }
                style={{
                  ...estiloCampo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Sin proveedor preferente
                </option>
                {proveedores.map(proveedor => (
                  <option
                    key={proveedor.id}
                    value={proveedor.id}
                  >
                    {proveedor.codigo} -{" "}
                    {proveedor.nombre}
                  </option>
                ))}
              </select>
            </label>

            {formulario.tipo === "MP" && (
              <label style={{
                display: "flex",
                gap: 9,
                alignItems: "center",
                marginBottom: 16
              }}>
                <input
                  type="checkbox"
                  checked={formulario.es_comprado}
                  onChange={evento =>
                    actualizarCampo(
                      "es_comprado",
                      evento.target.checked
                    )
                  }
                />
                Material comprado a proveedor
              </label>
            )}

            {error && (
              <div role="alert" style={{
                color: "#B91C1C",
                background: "#FEF2F2",
                padding: 10,
                borderRadius: 8,
                marginBottom: 12
              }}>
                {error}
              </div>
            )}

            {mensaje && (
              <div style={{
                color: "#166534",
                background: "#F0FDF4",
                padding: 10,
                borderRadius: 8,
                marginBottom: 12
              }}>
                {mensaje}
              </div>
            )}

            <button
              type="submit"
              disabled={guardando}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#0F766E",
                color: "white",
                fontWeight: "bold",
                cursor: guardando
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardando
                ? "Guardando..."
                : editandoId
                  ? "Guardar cambios"
                  : "Crear material"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                style={{
                  ...estiloCampo,
                  marginTop: 10,
                  background: "white",
                  cursor: "pointer"
                }}
              >
                Cancelar edición
              </button>
            )}
          </form>

          <section style={{
            background: "white",
            padding: 22,
            borderRadius: 14,
            boxShadow:
              "0 2px 10px rgba(15,23,42,0.08)"
          }}>
            <h2 style={{ marginTop: 0 }}>
              Materiales ({materiales.length})
            </h2>

            {cargando ? (
              <p>Cargando catálogo...</p>
            ) : materiales.length === 0 ? (
              <p style={{ color: "#64748B" }}>
                Todavía no hay materiales registrados.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: 10
              }}>
                {materiales.map(material => (
                  <article
                    key={material.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: 13,
                      opacity: material.activo
                        ? 1
                        : 0.58
                    }}
                  >
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12
                    }}>
                      <div>
                        <strong>
                          {material.codigo}
                          {" - "}
                          {material.nombre}
                        </strong>
                        <div style={{
                          color: "#475569",
                          fontSize: 14,
                          marginTop: 5
                        }}>
                          {material.tipo}
                          {" · "}
                          {material.unidad_medida}
                          {material.es_comprado
                            ? " · comprado"
                            : ""}
                          {material.costo_unitario_referencial
                            ? ` · costo ref. ${Number(
                                material.costo_unitario_referencial
                              ).toLocaleString("es-CL", {
                                style: "currency",
                                currency:
                                  material.moneda || "CLP",
                                maximumFractionDigits: 0
                              })}`
                            : ""}
                          {material.proveedor_preferente_nombre
                            ? ` · prov. ${material.proveedor_preferente_nombre}`
                            : ""}
                        </div>
                      </div>
                      <div style={{
                        display: "flex",
                        gap: 8,
                        alignSelf: "start"
                      }}>
                        <button
                          type="button"
                          onClick={() =>
                            editar(material)
                          }
                          style={{
                            border:
                              "1px solid #CBD5E1",
                            borderRadius: 7,
                            background: "white",
                            padding: "7px 10px",
                            cursor: "pointer"
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            cambiarEstado(material)
                          }
                          style={{
                            border:
                              "1px solid #CBD5E1",
                            borderRadius: 7,
                            background: "white",
                            padding: "7px 10px",
                            cursor: "pointer"
                          }}
                        >
                          {material.activo
                            ? "Desactivar"
                            : "Activar"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default CatalogoMaterialesV2;
