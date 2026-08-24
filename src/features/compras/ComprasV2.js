import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import BotonVolver from "../../components/BotonVolver";
import {
  TIPOS_MATERIAL
} from "../../domain/produccionV2";
import {
  listarMateriales
} from "../materiales/materialesRepository";
import {
  listarTerceros,
  TIPOS_TERCERO
} from "../terceros/tercerosRepository";
import {
  AREAS_SOLICITUD_COMPRA,
  ESTADOS_ORDEN_COMPRA,
  MOTIVOS_SOLICITUD_COMPRA,
  PRIORIDADES_COMPRA,
  actualizarEstadoOrdenCompra,
  agruparSolicitudesPorProveedor,
  crearEnlaceCorreoAvisoContabilidad,
  crearEnlaceCorreoAvisoSolicitantes,
  crearEnlaceCorreoOrdenCompra,
  crearEnlaceWhatsappOrdenCompra,
  crearSolicitudCompra,
  generarOrdenCompraDesdeSolicitudes,
  listarOrdenesCompra,
  listarSolicitudesCompra,
  publicarOrdenCompraCompartida,
  proveedorDesdeMaterial,
  recibirOrdenCompraCompleta,
  siguienteCodigoOrdenCompra,
  construirUrlPublicaOrdenCompra
} from "./comprasRepository";
import {
  abrirOrdenCompraImprimible
} from "./ordenCompraDocumento";

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

const botonPrimario = {
  width: "100%",
  padding: "13px 16px",
  border: 0,
  borderRadius: 10,
  background: "#2563EB",
  color: "white",
  fontWeight: 800,
  cursor: "pointer"
};

const botonSecundario = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #CBD5E1",
  background: "white",
  color: "#1E3A8A",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};

const card = {
  background: "white",
  border: "1px solid #E2E8F0",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)"
};

const grilla = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const formatoNumero = valor =>
  Number(valor || 0).toLocaleString("es-CL");

const formatoMoneda = (valor, moneda = "CLP") =>
  `${moneda} ${Math.round(Number(valor || 0)).toLocaleString("es-CL")}`;

const codigoSolicitudInterna = fecha => {
  const fechaTexto = fecha
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const sufijo = String(fecha.getTime()).slice(-5);

  return `REQ${fechaTexto}-${sufijo}`;
};

const nombreCatalogo = (catalogo, id) =>
  catalogo.find(item => item.id === id)?.nombre || id;

const etiquetaMaterial = material =>
  material
    ? `${material.codigo || "Sin codigo"} - ${material.nombre || "Sin nombre"}`
    : "";

const normalizar = valor =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const tiposComprables = [
  TIPOS_MATERIAL.MATERIA_PRIMA,
  TIPOS_MATERIAL.SUMINISTRO
];

const textoBusquedaMaterial = material => normalizar([
  material.codigo,
  material.nombre,
  material.tipo,
  material.unidad_medida,
  material.proveedor_preferente_nombre,
  material.proveedor_nombre,
  material.descripcion,
  material.categoria
].join(" "));

export const filtrarMaterialesComprables = (
  materiales = [],
  busqueda = ""
) => {
  const texto = normalizar(busqueda);

  return materiales
    .filter(material =>
      material.activo !== false &&
      tiposComprables.includes(material.tipo)
    )
    .filter(material =>
      !texto ||
      textoBusquedaMaterial(material).includes(texto)
    )
    .sort((a, b) => {
      const aEtiqueta = normalizar(etiquetaMaterial(a));
      const bEtiqueta = normalizar(etiquetaMaterial(b));
      const aEmpieza = texto && aEtiqueta.startsWith(texto) ? 0 : 1;
      const bEmpieza = texto && bEtiqueta.startsWith(texto) ? 0 : 1;

      if (aEmpieza !== bEmpieza) {
        return aEmpieza - bEmpieza;
      }

      return aEtiqueta.localeCompare(bEtiqueta);
    });
};

function SelectorMaterialCompra({
  materiales,
  materialId,
  busqueda,
  onBusquedaChange,
  onChange
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const materialSeleccionado = useMemo(
    () =>
      materiales.find(
        material => material.id === materialId
      ) || null,
    [materiales, materialId]
  );
  const opciones = useMemo(
    () =>
      filtrarMaterialesComprables(
        materiales,
        busqueda
      ).slice(0, 25),
    [materiales, busqueda]
  );

  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    const cerrarSiClickFuera = evento => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target)
      ) {
        setAbierto(false);
      }
    };

    document.addEventListener("mousedown", cerrarSiClickFuera);
    document.addEventListener("touchstart", cerrarSiClickFuera);

    return () => {
      document.removeEventListener("mousedown", cerrarSiClickFuera);
      document.removeEventListener("touchstart", cerrarSiClickFuera);
    };
  }, [abierto]);

  const seleccionar = material => {
    onChange(material.id);
    onBusquedaChange(etiquetaMaterial(material));
    setAbierto(false);
  };

  return (
    <div
      ref={contenedorRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        marginTop: 6
      }}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: materialId
          ? "minmax(0, 1fr) auto"
          : "minmax(0, 1fr)",
        gap: 8,
        width: "100%",
        minWidth: 0
      }}>
        <input
          type="text"
          value={busqueda}
          onChange={evento => {
            onBusquedaChange(evento.target.value);
            if (materialId) {
              onChange("");
            }
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Busca por código, nombre o proveedor..."
          style={{
            ...campo,
            minWidth: 0
          }}
        />
        {materialId && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onBusquedaChange("");
              setAbierto(true);
            }}
            style={{
              width: 44,
              minWidth: 44,
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              background: "#F8FAFC",
              color: "#334155",
              padding: "0 12px",
              fontWeight: 800,
              cursor: "pointer"
            }}
            aria-label="Limpiar material seleccionado"
          >
            ×
          </button>
        )}
      </div>

      {abierto && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            maxHeight: 280,
            overflowY: "auto",
            overflowX: "hidden",
            background: "white",
            border: "1px solid #CBD5E1",
            borderRadius: 10,
            boxShadow:
              "0 12px 30px rgba(15,23,42,0.18)"
          }}
        >
          {opciones.length === 0 ? (
            <div style={{
              padding: 12,
              color: "#64748B",
              fontSize: 14
            }}>
              {materiales.length === 0
                ? "No hay MP/SUM activos cargados o no tienes permiso para leer el catálogo."
                : `No encontramos materiales con "${busqueda}".`}
            </div>
          ) : opciones.map(material => (
            <button
              key={material.id}
              type="button"
              onMouseDown={evento => {
                evento.preventDefault();
                seleccionar(material);
              }}
              style={{
                width: "100%",
                display: "grid",
                minWidth: 0,
                gap: 3,
                textAlign: "left",
                padding: "10px 12px",
                border: 0,
                borderBottom: "1px solid #E2E8F0",
                background:
                  material.id === materialSeleccionado?.id
                    ? "#EFF6FF"
                    : "white",
                color: "#0F172A",
                cursor: "pointer"
              }}
            >
              <strong>
                {material.codigo}
                {" - "}
                {material.nombre}
              </strong>
              <span style={{
                color: "#64748B",
                fontSize: 13
              }}>
                {material.tipo}
                {material.unidad_medida
                  ? ` | ${material.unidad_medida}`
                  : ""}
                {material.proveedor_preferente_nombre
                  ? ` | ${material.proveedor_preferente_nombre}`
                  : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ComprasV2({
  db,
  perfil,
  onVolver
}) {
  const plantas = perfil?.planta_ids?.length
    ? perfil.planta_ids
    : ["chile"];
  const [plantaId, setPlantaId] = useState(
    plantas[0] || "chile"
  );
  const [materiales, setMateriales] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [materialId, setMaterialId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [prioridad, setPrioridad] = useState("normal");
  const [areaSolicitante, setAreaSolicitante] =
    useState("produccion");
  const [motivoSolicitud, setMotivoSolicitud] =
    useState("reposicion_stock");
  const [fechaRequerida, setFechaRequerida] =
    useState("");
  const [otCodigo, setOtCodigo] = useState("");
  const [observacion, setObservacion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [correoContabilidad, setCorreoContabilidad] =
    useState("");
  const [lineasSolicitud, setLineasSolicitud] =
    useState([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] =
    useState(false);

  const cargar = useCallback(async () => {
    if (!perfil?.empresa_id || !plantaId) {
      return;
    }

    setCargando(true);
    setError("");

    try {
      const [
        materialesDatos,
        proveedoresDatos,
        solicitudesDatos,
        ordenesDatos
      ] = await Promise.all([
        listarMateriales(db, perfil.empresa_id),
        listarTerceros(
          db,
          perfil.empresa_id,
          TIPOS_TERCERO.PROVEEDOR
        ),
        listarSolicitudesCompra(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarOrdenesCompra(
          db,
          perfil.empresa_id,
          plantaId
        )
      ]);

      setMateriales(materialesDatos);
      setProveedores(
        proveedoresDatos.filter(
          proveedor => proveedor.activo !== false
        )
      );
      setSolicitudes(solicitudesDatos);
      setOrdenes(ordenesDatos);
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo cargar compras."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil, plantaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const materialesComprables = useMemo(
    () => filtrarMaterialesComprables(materiales),
    [materiales]
  );

  const materialSeleccionado = useMemo(
    () =>
      materiales.find(
        material => material.id === materialId
      ),
    [materiales, materialId]
  );

  const proveedorSugerido = useMemo(
    () =>
      proveedorDesdeMaterial(
        materialSeleccionado,
        proveedores
      ),
    [materialSeleccionado, proveedores]
  );

  const grupos = useMemo(
    () => agruparSolicitudesPorProveedor(solicitudes),
    [solicitudes]
  );

  const codigoSiguiente = useMemo(
    () => siguienteCodigoOrdenCompra(ordenes),
    [ordenes]
  );

  const limpiarLineaSolicitud = () => {
    setMaterialId("");
    setCantidad("");
    setPrioridad("normal");
    setFechaRequerida("");
    setOtCodigo("");
    setObservacion("");
    setBusqueda("");
  };

  const agregarLineaSolicitud = evento => {
    evento.preventDefault();
    setError("");
    setMensaje("");

    if (!materialSeleccionado) {
      setError(
        "Selecciona un material o suministro del catálogo."
      );
      return;
    }

    if (Number(cantidad) <= 0) {
      setError(
        "Ingresa una cantidad mayor que cero."
      );
      return;
    }

    setLineasSolicitud(lineas => [
      ...lineas,
      {
        id: `${Date.now()}_${materialSeleccionado.id}_${lineas.length}`,
        material: materialSeleccionado,
        proveedor: proveedorSugerido,
        cantidad: Number(cantidad),
        prioridad,
        areaSolicitante,
        motivoSolicitud,
        fechaRequerida,
        otCodigo,
        observacion
      }
    ]);
    limpiarLineaSolicitud();
    setMensaje(
      "Línea agregada a la lista interna. Confirma la lista para registrarla."
    );
  };

  const quitarLineaSolicitud = id => {
    setLineasSolicitud(lineas =>
      lineas.filter(linea => linea.id !== id)
    );
  };

  const confirmarSolicitudInterna = async () => {
    if (lineasSolicitud.length === 0) {
      setError(
        "Agrega al menos una línea a la lista interna."
      );
      return;
    }

    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      const fechaSolicitud = new Date();
      const solicitudInternaCodigo =
        codigoSolicitudInterna(fechaSolicitud);
      const solicitudInternaId = [
        perfil.empresa_id,
        plantaId,
        solicitudInternaCodigo
      ].join("__");

      for (const [indice, linea] of lineasSolicitud.entries()) {
        await crearSolicitudCompra({
          db,
          perfil,
          plantaId,
          material: linea.material,
          proveedor: linea.proveedor,
          cantidad: linea.cantidad,
          prioridad: linea.prioridad,
          areaSolicitante: linea.areaSolicitante,
          motivoSolicitud: linea.motivoSolicitud,
          fechaRequerida: linea.fechaRequerida,
          otCodigo: linea.otCodigo,
          solicitudInternaId,
          solicitudInternaCodigo,
          lineaSolicitudNumero: indice + 1,
          origen: "solicitud_interna",
          observacion: linea.observacion
        });
      }

      const totalLineas = lineasSolicitud.length;
      setLineasSolicitud([]);
      setAreaSolicitante("produccion");
      setMotivoSolicitud("reposicion_stock");
      setMensaje(
        `Solicitud interna ${solicitudInternaCodigo} registrada con ${totalLineas} requerimiento(s).`
      );
      await cargar();
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo crear la solicitud."
      );
    } finally {
      setProcesando(false);
    }
  };

  const generarOC = async grupo => {
    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      await generarOrdenCompraDesdeSolicitudes({
        db,
        perfil,
        plantaId,
        codigo: codigoSiguiente,
        proveedor: grupo,
        solicitudes: grupo.solicitudes,
        observacion:
          "OC generada desde solicitudes agrupadas por proveedor."
      });
      setMensaje(
        `Orden ${codigoSiguiente} generada para ${grupo.proveedor_nombre}.`
      );
      await cargar();
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo generar la OC."
      );
    } finally {
      setProcesando(false);
    }
  };

  const marcarEnviada = async orden => {
    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      await actualizarEstadoOrdenCompra({
        db,
        perfil,
        orden,
        estado: ESTADOS_ORDEN_COMPRA.ENVIADA
      });
      setMensaje(
        `${orden.codigo} marcada como enviada.`
      );
      await cargar();
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo actualizar la OC."
      );
    } finally {
      setProcesando(false);
    }
  };

  const recibirCompleta = async orden => {
      const confirmar = window.confirm(
      `¿Recibir completa la ${orden.codigo}? Esto generará entrada de stock en Almacén.`
    );

    if (!confirmar) {
      return;
    }

    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      await recibirOrdenCompraCompleta({
        db,
        perfil,
        plantaId,
        orden
      });
      setMensaje(
        `${orden.codigo} recibida y stock actualizado.`
      );
      await cargar();
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo recibir la OC."
      );
    } finally {
      setProcesando(false);
    }
  };

  const generarPdfOrden = orden => {
    setError("");
    setMensaje("");

    try {
      abrirOrdenCompraImprimible(orden, {
        comprador: "Gaby Huanca"
      });
      setMensaje(
        `Documento imprimible de ${orden.codigo} generado. Usa "Guardar como PDF" en la ventana de impresión.`
      );
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo generar el documento PDF."
      );
    }
  };

  const compartirWhatsappOrden = async orden => {
    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      const ordenCompartida =
        await publicarOrdenCompraCompartida({
          db,
          orden
        });
      const urlPublica =
        construirUrlPublicaOrdenCompra(ordenCompartida);
      const enlaceWhatsapp =
        crearEnlaceWhatsappOrdenCompra(
          ordenCompartida,
          { urlPublica }
        );

      window.open(
        enlaceWhatsapp,
        "_blank",
        "noopener,noreferrer"
      );
      setMensaje(
        `${orden.codigo} lista para compartir por WhatsApp con enlace de visualización.`
      );
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo preparar la OC para WhatsApp."
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div style={{
      padding: 24,
      maxWidth: 1320,
      margin: "0 auto",
      color: "#0F172A"
    }}>
      <BotonVolver onClick={onVolver}>
        Volver
      </BotonVolver>

      <h1 style={{
        fontSize: 42,
        marginBottom: 8
      }}>
        Compras
      </h1>
      <p style={{
        color: "#475569",
        fontSize: 18,
        marginTop: 0
      }}>
        Crea solicitudes, agrúpalas por proveedor,
        genera OC y recibe compras conectadas a stock.
      </p>

      {error && (
        <div style={{
          ...card,
          borderColor: "#FCA5A5",
          background: "#FEF2F2",
          color: "#B91C1C",
          marginBottom: 16
        }}>
          {error}
        </div>
      )}
      {mensaje && (
        <div style={{
          ...card,
          borderColor: "#86EFAC",
          background: "#F0FDF4",
          color: "#166534",
          marginBottom: 16
        }}>
          {mensaje}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
        gap: 18,
        alignItems: "start"
      }}>
        <section style={card}>
          <h2>Crear solicitud interna de compra</h2>
          <p style={{
            color: "#64748B",
            marginTop: -4
          }}>
            Arma aquí la lista que antes se pedía por
            WhatsApp. Cada línea queda trazada por área,
            motivo, usuario, fecha y OT si corresponde.
            El proveedor lo propone el sistema desde el
            catálogo para que Compras organice las OC.
          </p>
          <form onSubmit={agregarLineaSolicitud}>
            <div style={grilla}>
              <label>
                Planta
                <select
                  value={plantaId}
                  onChange={evento =>
                    setPlantaId(evento.target.value)
                  }
                  style={campo}
                >
                  {plantas.map(planta => (
                    <option key={planta} value={planta}>
                      {planta}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Área solicitante
                <select
                  value={areaSolicitante}
                  onChange={evento =>
                    setAreaSolicitante(evento.target.value)
                  }
                  style={campo}
                >
                  {AREAS_SOLICITUD_COMPRA.map(area => (
                    <option key={area.id} value={area.id}>
                      {area.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Motivo
                <select
                  value={motivoSolicitud}
                  onChange={evento =>
                    setMotivoSolicitud(evento.target.value)
                  }
                  style={campo}
                >
                  {MOTIVOS_SOLICITUD_COMPRA.map(motivo => (
                    <option
                      key={motivo.id}
                      value={motivo.id}
                    >
                      {motivo.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{
              display: "block",
              marginTop: 14
            }}>
              Material o suministro
              <SelectorMaterialCompra
                materiales={materialesComprables}
                materialId={materialId}
                busqueda={busqueda}
                onBusquedaChange={setBusqueda}
                onChange={nuevoMaterialId => {
                  setMaterialId(nuevoMaterialId);
                }}
              />
              <span style={{
                display: "block",
                marginTop: 6,
                color: "#64748B",
                fontSize: 13
              }}>
                Escribe parte del código, nombre o proveedor.
                Solo se muestran MP y SUM activos. Accesorios
                y herramientas comprables se registran como SUM.
              </span>
              {materialSeleccionado && (
                <div style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 10,
                  background: "#EFF6FF",
                  color: "#1E3A8A",
                  fontSize: 14
                }}>
                  Proveedor sugerido por catálogo:{" "}
                  <b>
                    {proveedorSugerido.proveedor_nombre}
                  </b>
                </div>
              )}
            </div>

            <div style={grilla}>
              <label>
                Cantidad
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={cantidad}
                  onChange={evento =>
                    setCantidad(evento.target.value)
                  }
                  style={campo}
                />
              </label>
              <label>
                Prioridad
                <select
                  value={prioridad}
                  onChange={evento =>
                    setPrioridad(evento.target.value)
                  }
                  style={campo}
                >
                  {PRIORIDADES_COMPRA.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha requerida
                <input
                  type="date"
                  value={fechaRequerida}
                  onChange={evento =>
                    setFechaRequerida(evento.target.value)
                  }
                  style={campo}
                />
              </label>
              <label>
                OT afectada
                <input
                  value={otCodigo}
                  onChange={evento =>
                    setOtCodigo(evento.target.value)
                  }
                  placeholder="Opcional"
                  style={campo}
                />
              </label>
            </div>

            <label style={{
              display: "block",
              marginTop: 14
            }}>
              Observación
              <textarea
                value={observacion}
                onChange={evento =>
                  setObservacion(evento.target.value)
                }
                placeholder="Motivo, urgencia o condición especial."
                style={{
                  ...campo,
                  minHeight: 82
                }}
              />
            </label>

            <button
              type="submit"
              disabled={procesando}
              style={{
                ...botonPrimario,
                marginTop: 16,
                opacity: procesando ? 0.7 : 1
              }}
            >
              Agregar a lista interna
            </button>
          </form>

          <div style={{
            marginTop: 18,
            border: "1px solid #DBEAFE",
            borderRadius: 16,
            padding: 14,
            background: "#F8FAFC"
          }}>
            <h3 style={{
              margin: "0 0 6px"
            }}>
              Lista interna por confirmar
            </h3>
            {lineasSolicitud.length === 0 ? (
              <p style={{
                color: "#64748B",
                marginBottom: 0
              }}>
                Todavía no hay requerimientos en la
                lista.
              </p>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {lineasSolicitud.map((linea, indice) => (
                    <div
                      key={linea.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "center",
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 12,
                        padding: 12,
                        background: "white"
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <strong>
                          {indice + 1}.{" "}
                          {linea.material.codigo} -{" "}
                          {linea.material.nombre}
                        </strong>
                        <div style={{
                          color: "#475569",
                          fontSize: 14,
                          marginTop: 4
                        }}>
                          {formatoNumero(linea.cantidad)}{" "}
                          {linea.material.unidad_medida}
                          {" | "}
                          {nombreCatalogo(
                            AREAS_SOLICITUD_COMPRA,
                            linea.areaSolicitante
                          )}
                          {" | "}
                          {nombreCatalogo(
                            MOTIVOS_SOLICITUD_COMPRA,
                            linea.motivoSolicitud
                          )}
                          {" | "}
                          Prioridad {linea.prioridad}
                          {linea.otCodigo
                            ? ` | OT ${linea.otCodigo}`
                            : ""}
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 3
                        }}>
                          Proveedor:{" "}
                          {linea.proveedor
                            ?.proveedor_nombre ||
                            linea.proveedor?.nombre ||
                            "Sin proveedor asignado"}
                          {linea.fechaRequerida
                            ? ` | Requerida: ${linea.fechaRequerida}`
                            : ""}
                        </div>
                        {linea.observacion && (
                          <div style={{
                            color: "#64748B",
                            fontSize: 13,
                            marginTop: 3
                          }}>
                            Nota: {linea.observacion}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          quitarLineaSolicitud(linea.id)
                        }
                        style={{
                          ...botonSecundario,
                          color: "#B91C1C"
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={confirmarSolicitudInterna}
                  style={{
                    ...botonPrimario,
                    marginTop: 14,
                    background: "#15803D",
                    opacity: procesando ? 0.7 : 1
                  }}
                >
                  Confirmar solicitud interna
                </button>
              </>
            )}
          </div>
        </section>

        <section style={card}>
          <h2>Solicitudes agrupadas por proveedor</h2>
          <p style={{
            color: "#64748B"
          }}>
            Siguiente OC sugerida: <b>{codigoSiguiente}</b>
          </p>
          {cargando && <p>Cargando compras...</p>}
          {!cargando && grupos.length === 0 && (
            <p style={{ color: "#64748B" }}>
              No hay solicitudes pendientes.
            </p>
          )}
          <div style={{
            display: "grid",
            gap: 12
          }}>
            {grupos.map(grupo => (
              <div
                key={grupo.proveedor_id || grupo.proveedor_nombre}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 14,
                  padding: 14
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  {grupo.proveedor_codigo
                    ? `${grupo.proveedor_codigo} - `
                    : ""}
                  {grupo.proveedor_nombre}
                </h3>
                <ul style={{
                  paddingLeft: 18,
                  color: "#334155"
                }}>
                  {grupo.solicitudes.map(solicitud => (
                    <li key={solicitud.id}>
                      {solicitud.material_codigo}{" "}
                      {solicitud.material_nombre}:{" "}
                      <b>
                        {formatoNumero(solicitud.cantidad)}{" "}
                        {solicitud.unidad_medida}
                      </b>
                      {solicitud.ot_codigo
                        ? ` | OT ${solicitud.ot_codigo}`
                        : ""}
                      {solicitud.area_solicitante_nombre
                        ? ` | ${solicitud.area_solicitante_nombre}`
                        : ""}
                      {solicitud.motivo_solicitud_nombre
                        ? ` | ${solicitud.motivo_solicitud_nombre}`
                        : ""}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => generarOC(grupo)}
                  style={botonPrimario}
                >
                  Generar OC para este proveedor
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{
        ...card,
        marginTop: 18
      }}>
        <h2>Órdenes de compra</h2>
        <div style={{
          ...grilla,
          marginBottom: 14
        }}>
          <label>
            Correo de contabilidad para avisos
            <input
              type="email"
              value={correoContabilidad}
              onChange={evento =>
                setCorreoContabilidad(evento.target.value)
              }
              placeholder="contabilidad@..."
              style={campo}
            />
            <span style={{
              display: "block",
              color: "#64748B",
              fontSize: 13,
              marginTop: 5
            }}>
              Se usará como destinatario o copia en los
              avisos de OC emitida y compra recibida.
            </span>
          </label>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14
        }}>
          {ordenes.slice(0, 30).map(orden => (
            <article
              key={orden.id}
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: 16,
                padding: 16,
                background: "#F8FAFC"
              }}
            >
              <h3 style={{
                margin: "0 0 6px"
              }}>
                {orden.codigo} | {orden.estado}
              </h3>
              <p style={{
                margin: "0 0 8px",
                color: "#475569"
              }}>
                {orden.proveedor_nombre}
              </p>
              <p style={{
                margin: "0 0 8px",
                fontWeight: 800
              }}>
                Total referencial:{" "}
                {formatoMoneda(
                  orden.total,
                  orden.moneda
                )}
              </p>
              <ul style={{
                paddingLeft: 18,
                minHeight: 70
              }}>
                {orden.items?.map(item => (
                  <li
                    key={`${orden.id}-${item.material_id}`}
                  >
                    {item.material_codigo}:{" "}
                    {formatoNumero(item.cantidad)}{" "}
                    {item.unidad_medida}
                  </li>
                ))}
              </ul>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8
              }}>
                <a
                  href={crearEnlaceCorreoOrdenCompra(orden)}
                  style={botonSecundario}
                >
                  Correo
                </a>
                <button
                  type="button"
                  onClick={() =>
                    compartirWhatsappOrden(orden)
                  }
                  disabled={procesando}
                  style={botonSecundario}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => generarPdfOrden(orden)}
                  style={{
                    ...botonSecundario,
                    background: "#EFF6FF"
                  }}
                >
                  Generar PDF
                </button>
                <a
                  href={crearEnlaceCorreoAvisoSolicitantes(
                    orden,
                    {
                      correoContabilidad,
                      evento: orden.estado ===
                        ESTADOS_ORDEN_COMPRA.RECIBIDA
                        ? "recibida"
                        : "emitida"
                    }
                  )}
                  style={botonSecundario}
                >
                  Avisar solicitantes
                </a>
                <a
                  href={crearEnlaceCorreoAvisoContabilidad(
                    orden,
                    {
                      correoContabilidad,
                      evento: orden.estado ===
                        ESTADOS_ORDEN_COMPRA.RECIBIDA
                        ? "recibida"
                        : "emitida"
                    }
                  )}
                  style={{
                    ...botonSecundario,
                    color: "#7C2D12"
                  }}
                >
                  Avisar contabilidad
                </a>
                {orden.estado !==
                  ESTADOS_ORDEN_COMPRA.ENVIADA &&
                  orden.estado !==
                    ESTADOS_ORDEN_COMPRA.RECIBIDA && (
                    <button
                      type="button"
                      disabled={procesando}
                      onClick={() =>
                        marcarEnviada(orden)
                      }
                      style={botonSecundario}
                    >
                      Marcar enviada
                    </button>
                  )}
                {orden.estado !==
                  ESTADOS_ORDEN_COMPRA.RECIBIDA &&
                  orden.estado !==
                    ESTADOS_ORDEN_COMPRA.ANULADA && (
                    <button
                      type="button"
                      disabled={procesando}
                      onClick={() =>
                        recibirCompleta(orden)
                      }
                      style={{
                        ...botonSecundario,
                        color: "#166534"
                      }}
                    >
                      Recibir completa
                    </button>
                  )}
              </div>
            </article>
          ))}
          {ordenes.length === 0 && !cargando && (
            <p style={{ color: "#64748B" }}>
              Aún no hay órdenes de compra.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default ComprasV2;
