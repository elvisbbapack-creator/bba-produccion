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
  TIPOS_TERCERO,
  listarTerceros
} from "../terceros/tercerosRepository";
import {
  listarCostosBaseEstacion
} from "../costosBase/costosBaseRepository";
import {
  listarCostosOperativos
} from "../costosOperativos/costosOperativosRepository";
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

const ayudaCampo = {
  color: "#64748B",
  fontSize: 12,
  lineHeight: 1.35,
  marginTop: 4
};

const etiquetaCampo = {
  display: "block",
  fontWeight: "bold",
  color: "#334155",
  marginBottom: 5
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
  cliente_id: "",
  cliente_codigo: "",
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
  costo_operativo_hora: 0,
  costo_operativo_origen: "",
  costo_operativo_config_id: "",
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
  proveedor_id: "",
  proveedor_codigo: "",
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
  porcentaje_costo_operativo: 0,
  costo_operativo_origen: "",
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

const SUPUESTOS_COTIZACION = [
  {
    clave: "indirectos_porcentaje",
    etiqueta: "Indirectos adicionales %",
    ayuda:
      "Reserva adicional para costos no modelados todavía. Los costos operativos fijos van separados. Ej: 5 a 12."
  },
  {
    clave: "costo_operativo_hora",
    etiqueta: "Costo operativo fijo hora",
    ayuda:
      "Se carga desde Costos Operativos Fijos de Planta. Puedes editarlo manualmente si la cotización requiere otro supuesto."
  },
  {
    clave: "margen_porcentaje",
    etiqueta: "Margen %",
    ayuda:
      "Margen comercial esperado sobre precio de venta. Ej: 35."
  },
  {
    clave: "factor_riesgo_porcentaje",
    etiqueta: "Riesgo producto nuevo %",
    ayuda:
      "Reserva por incertidumbre, curva de aprendizaje o reprocesos. Ej: 8 a 15."
  },
  {
    clave: "dias_compra",
    etiqueta: "Días compra MP",
    ayuda:
      "Tiempo estimado para conseguir materias primas o accesorios. Ej: 5."
  },
  {
    clave: "dias_ingenieria",
    etiqueta: "Días ingeniería",
    ayuda:
      "Tiempo para planos, muestra, ajustes y validación técnica. Ej: 2 a 7."
  },
  {
    clave: "horas_disponibles_dia",
    etiqueta: "Horas disponibles día",
    ayuda:
      "Horas productivas diarias usadas para estimar plazo. En 2 turnos Chile usar aprox. 14."
  }
];

const CAMPOS_MATERIAL_ESTIMADO = [
  {
    clave: "codigo",
    etiqueta: "Código",
    ayuda: "Código MP/RF o código temporal."
  },
  {
    clave: "nombre",
    etiqueta: "Nombre",
    ayuda: "Nombre del material o insumo."
  },
  {
    clave: "unidad",
    etiqueta: "Unidad",
    ayuda: "Unidad de compra o consumo. Ej: un, kg, m."
  },
  {
    clave: "consumo_unitario",
    etiqueta: "Consumo unit.",
    ayuda: "Cantidad de material que consume 1 producto."
  },
  {
    clave: "merma_porcentaje",
    etiqueta: "Merma %",
    ayuda: "Pérdida estimada de material. Ej: 5."
  },
  {
    clave: "costo_unitario",
    etiqueta: "Costo unit.",
    ayuda: "Costo por unidad de compra."
  },
  {
    clave: "minimo_compra",
    etiqueta: "Mínimo compra",
    ayuda: "Cantidad mínima que exige comprar el proveedor."
  },
  {
    clave: "proveedor",
    etiqueta: "Proveedor temporal",
    ayuda: "Usar solo si aún no está creado en catálogo."
  }
];

const CAMPOS_PROCESO_ESTIMADO = [
  {
    clave: "proceso_nombre",
    etiqueta: "Proceso",
    ayuda: "Proceso productivo estimado. Ej: Corte."
  },
  {
    clave: "estacion_nombre",
    etiqueta: "Estación",
    ayuda: "Estación o máquina donde se produciría."
  },
  {
    clave: "unidades_por_hora",
    etiqueta: "Unid/hora",
    ayuda: "Cantidad estimada que se fabrica por hora."
  },
  {
    clave: "eficiencia_esperada",
    etiqueta: "Eficiencia esperada %",
    ayuda: "Rendimiento esperado por ser producto nuevo. Ej: 75."
  },
  {
    clave: "costo_hora",
    etiqueta: "Costo hora",
    ayuda: "Costo estimado por hora del proceso o estación."
  },
  {
    clave: "porcentaje_costo_operativo",
    etiqueta: "% costo fijo",
    ayuda:
      "Porcentaje de costos operativos fijos que absorbe esta estación según área ocupada."
  },
  {
    clave: "horas_setup",
    etiqueta: "Horas setup",
    ayuda: "Horas de preparación, regulación o prueba inicial."
  },
  {
    clave: "observacion",
    etiqueta: "Observación",
    ayuda: "Nota técnica o supuesto usado para este proceso."
  }
];

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
  const [clientesCatalogo, setClientesCatalogo] =
    useState([]);
  const [proveedoresCatalogo, setProveedoresCatalogo] =
    useState([]);
  const [costosBaseEstacion, setCostosBaseEstacion] =
    useState([]);
  const [costosOperativos, setCostosOperativos] =
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
        cotizaciones,
        clientes,
        proveedores,
        costosBase,
        costosOperativosCargados
      ] = await Promise.all([
        listarMateriales(db, perfil.empresa_id),
        listarProcesosEstaciones(
          db,
          perfil.empresa_id
        ),
        listarCotizacionesTecnicas(
          db,
          perfil.empresa_id
        ),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.CLIENTE
        ),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.PROVEEDOR
        ),
        listarCostosBaseEstacion(
          db,
          perfil.empresa_id
        ),
        listarCostosOperativos(
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
      setClientesCatalogo(
        clientes.filter(c => c.activo !== false)
      );
      setProveedoresCatalogo(
        proveedores.filter(p => p.activo !== false)
      );
      setCostosBaseEstacion(
        costosBase.filter(c => c.activo !== false)
      );
      setCostosOperativos(
        costosOperativosCargados.filter(
          c => c.activo !== false
        )
      );
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
        costo_operativo_hora:
          formulario.costo_operativo_hora,
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

  const aplicarCostoOperativoPlanta = useCallback(
    plantaId => {
      const costo = costosOperativos.find(
        item => item.planta_id === plantaId
      );

      setFormulario(actual => ({
        ...actual,
        planta_id: plantaId,
        costo_operativo_hora:
          costo?.costo_operativo_hora || 0,
        costo_operativo_origen: costo
          ? "costos_operativos_planta"
          : "manual",
        costo_operativo_config_id: costo?.id || ""
      }));
    },
    [costosOperativos]
  );

  useEffect(() => {
    if (
      costosOperativos.length > 0 &&
      !formulario.costo_operativo_config_id &&
      formulario.costo_operativo_origen !== "manual"
    ) {
      aplicarCostoOperativoPlanta(
        formulario.planta_id
      );
    }
  }, [
    aplicarCostoOperativoPlanta,
    costosOperativos.length,
    formulario.costo_operativo_config_id,
    formulario.costo_operativo_origen,
    formulario.planta_id
  ]);

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

  const seleccionarCliente = clienteId => {
    const cliente = clientesCatalogo.find(
      item => item.id === clienteId
    );

    actualizar({
      cliente_id: clienteId,
      cliente_codigo: cliente?.codigo || "",
      cliente: cliente?.nombre || ""
    });
  };

  const seleccionarProveedor = (
    indice,
    proveedorId
  ) => {
    const proveedor = proveedoresCatalogo.find(
      item => item.id === proveedorId
    );

    actualizar({
      materiales: actualizarItem(
        formulario.materiales,
        indice,
        {
          proveedor_id: proveedorId,
          proveedor_codigo: proveedor?.codigo || "",
          proveedor: proveedor?.nombre || ""
        }
      )
    });
  };

  const obtenerAbsorcionOperativa = estacion => {
    const costoOperativo = costosOperativos.find(
      item =>
        item.planta_id === formulario.planta_id &&
        item.id === formulario.costo_operativo_config_id
    ) || costosOperativos.find(
      item => item.planta_id === formulario.planta_id
    );
    const absorcion =
      costoOperativo?.estaciones_absorcion?.find(
        item =>
          item.proceso_codigo ===
            estacion?.proceso_codigo &&
          item.estacion_codigo ===
            estacion?.estacion_codigo
      );

    return absorcion?.porcentaje_absorcion || 0;
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
    const costoBase = costosBaseEstacion.find(
      item =>
        item.proceso_codigo === estacion?.proceso_codigo &&
        item.estacion_codigo === estacion?.estacion_codigo
    );
    const porcentajeCostoOperativo =
      obtenerAbsorcionOperativa(estacion);

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
            estacion?.estacion_nombre || "",
          porcentaje_costo_operativo:
            porcentajeCostoOperativo,
          costo_operativo_origen:
            porcentajeCostoOperativo > 0
              ? "costos_operativos_planta"
              : "manual",
          ...(costoBase
            ? {
                costo_hora: costoBase.costo_hora_total,
                costo_base_estacion_id: costoBase.id,
                costo_hora_origen: "costos_base_estacion",
                costo_hora_detalle: {
                  maquinista:
                    costoBase.costo_laboral_principal,
                  ayudantes:
                    costoBase.costo_ayudantes,
                  depreciacion:
                    costoBase.depreciacion_hora,
                  energia: costoBase.energia_hora,
                  mantencion:
                    costoBase.mantencion_hora
                }
              }
            : {
                costo_hora: 0,
                costo_base_estacion_id: "",
                costo_hora_origen: "manual",
                costo_hora_detalle: null
              })
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
          <select
            style={campo}
            value={formulario.cliente_id}
            onChange={e =>
              seleccionarCliente(e.target.value)
            }
          >
            <option value="">
              Seleccionar cliente
            </option>
            {clientesCatalogo.map(cliente => (
              <option
                key={cliente.id}
                value={cliente.id}
              >
                {cliente.codigo} - {cliente.nombre}
              </option>
            ))}
          </select>
          <input
            style={campo}
            placeholder="Cliente temporal"
            value={formulario.cliente}
            onChange={e =>
              actualizar({
                cliente: e.target.value,
                cliente_id: "",
                cliente_codigo: ""
              })
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
              aplicarCostoOperativoPlanta(
                e.target.value
              )
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
          <CampoConAyuda
            etiqueta="Escalas"
            ayuda="Cantidades a cotizar separadas por coma. Ej: 50, 100, 500."
          >
            <input
              style={campo}
              placeholder="50, 100, 500"
              value={formulario.escalas}
              onChange={e =>
                actualizar({ escalas: e.target.value })
              }
            />
          </CampoConAyuda>
          {SUPUESTOS_COTIZACION.map(campoConfig => (
            <CampoConAyuda
              key={campoConfig.clave}
              etiqueta={campoConfig.etiqueta}
              ayuda={campoConfig.ayuda}
            >
              <input
                style={campo}
                type="number"
                placeholder={campoConfig.etiqueta}
                value={formulario[campoConfig.clave]}
                onChange={e =>
                  actualizar({
                    [campoConfig.clave]:
                      e.target.value,
                    ...(campoConfig.clave ===
                    "costo_operativo_hora"
                      ? {
                          costo_operativo_origen:
                            "manual",
                          costo_operativo_config_id:
                            ""
                        }
                      : {})
                  })
                }
              />
            </CampoConAyuda>
          ))}
        </div>
        <p style={{
          color: "#64748B",
          fontSize: 13,
          marginTop: 10
        }}>
          Costo operativo fijo aplicado:{" "}
          <strong>
            {formulario.costo_operativo_origen ===
            "costos_operativos_planta"
              ? "desde maestro de planta"
              : "manual o pendiente de configurar"}
          </strong>
        </p>
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
            <CampoConAyuda
              etiqueta="Material"
              ayuda="Selecciona MP/RF del catálogo o deja libre."
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
            </CampoConAyuda>
            <CampoConAyuda
              etiqueta="Proveedor"
              ayuda="Selecciona proveedor del catálogo."
            >
              <select
                style={campo}
                value={material.proveedor_id || ""}
                onChange={e =>
                  seleccionarProveedor(
                    indice,
                    e.target.value
                  )
                }
              >
                <option value="">
                  Seleccionar proveedor
                </option>
                {proveedoresCatalogo.map(proveedor => (
                  <option
                    key={proveedor.id}
                    value={proveedor.id}
                  >
                    {proveedor.codigo} -{" "}
                    {proveedor.nombre}
                  </option>
                ))}
              </select>
            </CampoConAyuda>
            {CAMPOS_MATERIAL_ESTIMADO.map(campoConfig => (
              <CampoConAyuda
                key={campoConfig.clave}
                etiqueta={campoConfig.etiqueta}
                ayuda={campoConfig.ayuda}
              >
                <input
                  style={campo}
                  type={
                    [
                      "consumo_unitario",
                      "merma_porcentaje",
                      "costo_unitario",
                      "minimo_compra"
                    ].includes(campoConfig.clave)
                      ? "number"
                      : "text"
                  }
                  placeholder={campoConfig.etiqueta}
                  value={material[campoConfig.clave] || ""}
                  onChange={e =>
                    actualizar({
                      materiales: actualizarItem(
                        formulario.materiales,
                        indice,
                        {
                          [campoConfig.clave]:
                            e.target.value,
                          ...(campoConfig.clave === "proveedor"
                            ? {
                                proveedor_id: "",
                                proveedor_codigo: ""
                              }
                            : {})
                        }
                      )
                    })
                  }
                />
              </CampoConAyuda>
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
              <CampoConAyuda
                etiqueta="Proceso / estación"
                ayuda="Selecciona una estación del catálogo o deja libre."
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
              </CampoConAyuda>
              {CAMPOS_PROCESO_ESTIMADO.map(campoConfig => (
                <CampoConAyuda
                  key={campoConfig.clave}
                  etiqueta={campoConfig.etiqueta}
                  ayuda={campoConfig.ayuda}
                >
                  <input
                    style={campo}
                    type={
                      [
                        "unidades_por_hora",
                        "eficiencia_esperada",
                        "costo_hora",
                        "porcentaje_costo_operativo",
                        "horas_setup"
                      ].includes(campoConfig.clave)
                        ? "number"
                        : "text"
                    }
                    placeholder={campoConfig.etiqueta}
                    value={proceso[campoConfig.clave] || ""}
                    onChange={e =>
                      actualizar({
                        procesos: actualizarItem(
                          formulario.procesos,
                          indice,
                          {
                            [campoConfig.clave]:
                              e.target.value,
                            ...(campoConfig.clave === "costo_hora"
                              ? {
                                  costo_hora_origen:
                                    "manual",
                                  costo_base_estacion_id:
                                    "",
                                  costo_hora_detalle: null
                                }
                              : {}),
                            ...(campoConfig.clave ===
                            "porcentaje_costo_operativo"
                              ? {
                                  costo_operativo_origen:
                                    "manual"
                                }
                              : {})
                          }
                        )
                      })
                    }
                  />
                </CampoConAyuda>
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
                  "Costo operativo",
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
                      resultado.costo_operativo,
                      formulario.moneda
                    )}
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
        {resultados[0]?.detalle_procesos?.length > 0 && (
          <div style={{
            marginTop: 16,
            background: "white",
            borderRadius: 12,
            padding: 12
          }}>
            <h4 style={{ marginTop: 0 }}>
              Detalle costo operativo por proceso ·{" "}
              {resultados[0].cantidad} unidades
            </h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse"
              }}>
                <thead>
                  <tr>
                    {[
                      "Proceso",
                      "Estación",
                      "Horas",
                      "% fijo",
                      "Costo operativo"
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
                  {resultados[0].detalle_procesos.map(
                    (detalle, indice) => (
                      <tr
                        key={`${detalle.proceso_codigo}_${detalle.estacion_codigo}_${indice}`}
                      >
                        <td style={{ padding: 8 }}>
                          {detalle.proceso_nombre || "-"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.estacion_nombre || "-"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {detalle.horas}
                        </td>
                        <td style={{ padding: 8 }}>
                          {
                            detalle.porcentaje_costo_operativo
                          }
                          %
                        </td>
                        <td style={{ padding: 8 }}>
                          {formatoNumero(
                            detalle.costo_operativo,
                            formulario.moneda
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
