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
  listarOperacionesOT,
  listarOrdenesV2
} from "../ordenes/ordenesRepository";
import {
  ESTADOS_TRASPASO_ALMACEN,
  MOVIMIENTOS_ALMACEN,
  TIPOS_MOVIMIENTO_ALMACEN,
  actualizarPoliticaStock,
  calcularAlertasStock,
  calcularCuadraturaAlmacenOT,
  calcularDisponibilidadOT,
  calcularNecesidadesMaterialesOTs,
  calcularStockDisponible,
  esMovimientoAjusteAutorizado,
  listarConteosFisicos,
  listarTraspasosAlmacen,
  listarMovimientosAlmacen,
  listarStockMateriales,
  prepararMovimientoAlmacen,
  prepararConteoFisico,
  prepararTraspasoAlmacen,
  registrarConteoFisico,
  registrarMovimientoAlmacen,
  registrarTraspasoRecepcion,
  registrarTraspasoSalida,
  validarConteoFisico,
  validarTraspasoSalida,
  validarMovimientoAlmacen
} from "./almacenRepository";

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

const estadoInicial = {
  material_id: "",
  tipo: TIPOS_MOVIMIENTO_ALMACEN.RECEPCION,
  cantidad: "",
  ot_codigo: "",
  referencia: "",
  observacion: ""
};

const traspasoInicial = {
  material_id: "",
  planta_destino_id: "",
  cantidad: "",
  referencia: "",
  observacion: ""
};

const conteoInicial = {
  material_id: "",
  cantidad_contada: "",
  referencia: "",
  observacion: ""
};

const politicaInicial = {
  material_id: "",
  stock_minimo: "",
  punto_reposicion: "",
  stock_objetivo: "",
  lead_time_dias: ""
};

const formatearNumero = valor =>
  Number(valor || 0).toLocaleString(
    "es-CL",
    {
      maximumFractionDigits: 2
    }
  );

const formatearFecha = fecha => {
  const date = fecha?.toDate?.();
  return date
    ? date.toLocaleString("es-CL")
    : "Recién registrado";
};

const movimientoRequiereOT = tipo => [
  TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT,
  TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT
].includes(tipo);

const etiquetaOrigenMovimiento = origen => {
  if (origen === "produccion") {
    return "Producción";
  }
  if (origen === "traspaso") {
    return "Traspaso";
  }
  if (origen === "ajuste_autorizado") {
    return "Ajuste autorizado";
  }
  return "Manual";
};

const estiloOrigenMovimiento = origen => {
  if (origen === "produccion") {
    return {
      color: "#7C2D12",
      background: "#FFEDD5"
    };
  }
  if (origen === "traspaso") {
    return {
      color: "#1D4ED8",
      background: "#DBEAFE"
    };
  }
  if (origen === "ajuste_autorizado") {
    return {
      color: "#991B1B",
      background: "#FEE2E2"
    };
  }
  return {
    color: "#334155",
    background: "#E2E8F0"
  };
};

function AlmacenV2({
  db,
  perfil,
  onVolver
}) {
  const plantaInicial =
    perfil?.planta_ids?.[0] ||
    perfil?.planta_id ||
    "chile";
  const [plantaId, setPlantaId] =
    useState(plantaInicial);
  const [materiales, setMateriales] =
    useState([]);
  const [stocks, setStocks] = useState([]);
  const [movimientos, setMovimientos] =
    useState([]);
  const [traspasos, setTraspasos] =
    useState([]);
  const [conteos, setConteos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [operacionesOrden, setOperacionesOrden] =
    useState([]);
  const [
    operacionesOrdenesAbiertas,
    setOperacionesOrdenesAbiertas
  ] = useState([]);
  const [
    operacionesTrazabilidad,
    setOperacionesTrazabilidad
  ] = useState([]);
  const [otTrazabilidad, setOtTrazabilidad] =
    useState("");
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [formularioTraspaso, setFormularioTraspaso] =
    useState(traspasoInicial);
  const [formularioConteo, setFormularioConteo] =
    useState(conteoInicial);
  const [formularioPolitica, setFormularioPolitica] =
    useState(politicaInicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] =
    useState(false);
  const [guardandoTraspaso, setGuardandoTraspaso] =
    useState(false);
  const [guardandoConteo, setGuardandoConteo] =
    useState(false);
  const [guardandoPolitica, setGuardandoPolitica] =
    useState(false);
  const [
    recibiendoTraspasoId,
    setRecibiendoTraspasoId
  ] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const plantas = perfil?.planta_ids?.length
    ? perfil.planta_ids
    : [plantaInicial];

  const materialSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id === formulario.material_id
    ) || null,
    [formulario.material_id, materiales]
  );

  const materialTraspasoSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id ===
        formularioTraspaso.material_id
    ) || null,
    [
      formularioTraspaso.material_id,
      materiales
    ]
  );

  const materialConteoSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id ===
        formularioConteo.material_id
    ) || null,
    [
      formularioConteo.material_id,
      materiales
    ]
  );

  const materialPoliticaSeleccionado = useMemo(
    () => materiales.find(
      material =>
        material.id ===
        formularioPolitica.material_id
    ) || null,
    [
      formularioPolitica.material_id,
      materiales
    ]
  );

  const stocksPorMaterial = useMemo(
    () => new Map(
      stocks.map(stock => [
        stock.material_id,
        stock
      ])
    ),
    [stocks]
  );

  const stockSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formulario.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0
    },
    [
      formulario.material_id,
      stocksPorMaterial
    ]
  );

  const stockTraspasoSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formularioTraspaso.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0
    },
    [
      formularioTraspaso.material_id,
      stocksPorMaterial
    ]
  );

  const stockConteoSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formularioConteo.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0
    },
    [
      formularioConteo.material_id,
      stocksPorMaterial
    ]
  );

  const stockPoliticaSeleccionado = useMemo(
    () => stocksPorMaterial.get(
      formularioPolitica.material_id
    ) || {
      stock_actual: 0,
      stock_reservado: 0,
      stock_disponible: 0,
      stock_minimo: 0,
      punto_reposicion: 0,
      stock_objetivo: 0,
      lead_time_dias: 0
    },
    [
      formularioPolitica.material_id,
      stocksPorMaterial
    ]
  );

  const ordenSeleccionada = useMemo(
    () => ordenes.find(
      orden =>
        orden.codigo === formulario.ot_codigo
    ) || null,
    [formulario.ot_codigo, ordenes]
  );

  const disponibilidadOrden = useMemo(
    () => calcularDisponibilidadOT(
      operacionesOrden,
      stocks
    ),
    [operacionesOrden, stocks]
  );
  const movimientosRecientes = useMemo(
    () => movimientos.slice(0, 25),
    [movimientos]
  );
  const diferenciasRecientes = useMemo(
    () => movimientos.filter(
      movimiento =>
        movimiento.origen ===
        "ajuste_autorizado"
    ).slice(0, 10),
    [movimientos]
  );
  const conteosRecientes = useMemo(
    () => conteos.slice(0, 10),
    [conteos]
  );
  const alertasStock = useMemo(
    () => calcularAlertasStock({
      materiales,
      stocks
    }),
    [materiales, stocks]
  );
  const alertasCriticas = useMemo(
    () => alertasStock.filter(alerta =>
      [
        "sin_stock",
        "bajo_minimo",
        "reponer"
      ].includes(alerta.estado)
    ),
    [alertasStock]
  );
  const alertasSinPolitica = useMemo(
    () => alertasStock.filter(
      alerta => alerta.estado === "sin_politica"
    ).length,
    [alertasStock]
  );
  const alertasPorMaterial = useMemo(
    () => new Map(
      alertasStock.map(alerta => [
        alerta.material_id,
        alerta
      ])
    ),
    [alertasStock]
  );
  const necesidadesOTs = useMemo(
    () => calcularNecesidadesMaterialesOTs({
      ordenes,
      operacionesPorOrden:
        operacionesOrdenesAbiertas,
      stocks
    }),
    [operacionesOrdenesAbiertas, ordenes, stocks]
  );
  const necesidadesConBrecha = useMemo(
    () => necesidadesOTs.filter(
      item => item.brecha > 0
    ),
    [necesidadesOTs]
  );
  const esAjusteAutorizadoSeleccionado =
    esMovimientoAjusteAutorizado(
      formulario.tipo
    );
  const movimientosManuales = useMemo(
    () => MOVIMIENTOS_ALMACEN.filter(
      movimiento => ![
        TIPOS_MOVIMIENTO_ALMACEN.TRASPASO_SALIDA,
        TIPOS_MOVIMIENTO_ALMACEN
          .TRASPASO_RECEPCION
      ].includes(movimiento.tipo)
    ),
    []
  );
  const traspasosEnTransito = useMemo(
    () => traspasos.filter(
      traspaso =>
        traspaso.estado ===
        ESTADOS_TRASPASO_ALMACEN.EN_TRANSITO
    ),
    [traspasos]
  );
  const stockEnTransitoEntrada = useMemo(
    () => traspasosEnTransito
      .filter(
        traspaso =>
          traspaso.planta_destino_id ===
          plantaId
      )
      .reduce(
        (total, traspaso) =>
          total + Number(traspaso.cantidad || 0),
        0
      ),
    [plantaId, traspasosEnTransito]
  );
  const movimientosTrazabilidad = useMemo(
    () => movimientos.filter(
      movimiento =>
        movimiento.ot_codigo ===
        otTrazabilidad
    ),
    [movimientos, otTrazabilidad]
  );
  const cuadraturaOT = useMemo(
    () => calcularCuadraturaAlmacenOT({
      operaciones: operacionesTrazabilidad,
      stocks,
      movimientos: movimientosTrazabilidad
    }),
    [
      movimientosTrazabilidad,
      operacionesTrazabilidad,
      stocks
    ]
  );
  const resumenTrazabilidad =
    cuadraturaOT.resumen_movimientos;
  const cuadraturaTrazabilidad =
    cuadraturaOT.items;

  const movimientoVista = useMemo(
    () => prepararMovimientoAlmacen({
      empresaId: perfil.empresa_id,
      plantaId,
      material: materialSeleccionado,
      tipo: formulario.tipo,
      cantidad: formulario.cantidad,
      otCodigo: formulario.ot_codigo,
      referencia: formulario.referencia,
      observacion: formulario.observacion,
      usuario: perfil
    }),
    [
      formulario,
      materialSeleccionado,
      perfil,
      plantaId
    ]
  );

  const erroresFormulario = useMemo(
    () => validarMovimientoAlmacen(
      movimientoVista,
      stockSeleccionado
    ),
    [movimientoVista, stockSeleccionado]
  );

  const traspasoVista = useMemo(
    () => prepararTraspasoAlmacen({
      empresaId: perfil.empresa_id,
      plantaOrigenId: plantaId,
      plantaDestinoId:
        formularioTraspaso.planta_destino_id,
      material: materialTraspasoSeleccionado,
      cantidad: formularioTraspaso.cantidad,
      referencia: formularioTraspaso.referencia,
      observacion: formularioTraspaso.observacion,
      usuario: perfil
    }),
    [
      formularioTraspaso,
      materialTraspasoSeleccionado,
      perfil,
      plantaId
    ]
  );

  const conteoVista = useMemo(
    () => prepararConteoFisico({
      empresaId: perfil.empresa_id,
      plantaId,
      material: materialConteoSeleccionado,
      stockSistema:
        stockConteoSeleccionado.stock_actual,
      stockReservado:
        stockConteoSeleccionado.stock_reservado,
      cantidadContada:
        formularioConteo.cantidad_contada,
      referencia: formularioConteo.referencia,
      observacion: formularioConteo.observacion,
      usuario: perfil
    }),
    [
      formularioConteo,
      materialConteoSeleccionado,
      perfil,
      plantaId,
      stockConteoSeleccionado
    ]
  );

  const erroresConteo = useMemo(
    () => validarConteoFisico(conteoVista),
    [conteoVista]
  );

  const erroresTraspaso = useMemo(
    () => validarTraspasoSalida(
      traspasoVista,
      stockTraspasoSeleccionado
    ),
    [stockTraspasoSeleccionado, traspasoVista]
  );

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        materialesData,
        stocksData,
        movimientosData,
        ordenesData,
        traspasosData,
        conteosData
      ] = await Promise.all([
        listarMateriales(
          db,
          perfil.empresa_id
        ),
        listarStockMateriales(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarMovimientosAlmacen(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarOrdenesV2(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarTraspasosAlmacen(
          db,
          perfil.empresa_id,
          plantaId
        ),
        listarConteosFisicos(
          db,
          perfil.empresa_id,
          plantaId
        )
      ]);
      setMateriales(
        materialesData.filter(
          material => material.activo
        )
      );
      setStocks(stocksData);
      setMovimientos(movimientosData);
      setTraspasos(traspasosData);
      setConteos(conteosData);
      const ordenesAbiertas =
        ordenesData.filter(
          orden =>
            ![
              "cerrada",
              "completada"
            ].includes(orden.estado)
        );
      setOrdenes(ordenesAbiertas);
      const operacionesAbiertas =
        await Promise.all(
          ordenesAbiertas.slice(0, 30).map(
            async orden => ({
              orden_id: orden.id,
              orden,
              operaciones:
                await listarOperacionesOT(
                  db,
                  perfil.empresa_id,
                  plantaId,
                  orden.id
                )
            })
          )
        );
      setOperacionesOrdenesAbiertas(
        operacionesAbiertas
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo cargar almacén."
      );
    } finally {
      setCargando(false);
    }
  }, [db, perfil.empresa_id, plantaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const cargarOperacionesOrden = async () => {
      if (
        !ordenSeleccionada ||
        !movimientoRequiereOT(formulario.tipo)
      ) {
        setOperacionesOrden([]);
        return;
      }

      try {
        const operaciones =
          await listarOperacionesOT(
            db,
            perfil.empresa_id,
            plantaId,
            ordenSeleccionada.id
          );

        setOperacionesOrden(operaciones);
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar los materiales requeridos de la OT."
        );
        setOperacionesOrden([]);
      }
    };

    cargarOperacionesOrden();
  }, [
    db,
    formulario.ot_codigo,
    formulario.tipo,
    ordenSeleccionada,
    perfil.empresa_id,
    plantaId
  ]);

  useEffect(() => {
    const cargarOperacionesTrazabilidad =
      async () => {
        const orden = ordenes.find(
          item =>
            item.codigo === otTrazabilidad
        );

        if (!orden) {
          setOperacionesTrazabilidad([]);
          return;
        }

        try {
          const operaciones =
            await listarOperacionesOT(
              db,
              perfil.empresa_id,
              plantaId,
              orden.id
            );

          setOperacionesTrazabilidad(
            operaciones
          );
        } catch (fallo) {
          setError(
            fallo?.message ||
            "No se pudo cargar la trazabilidad de la OT."
          );
          setOperacionesTrazabilidad([]);
        }
      };

    cargarOperacionesTrazabilidad();
  }, [
    db,
    ordenes,
    otTrazabilidad,
    perfil.empresa_id,
    plantaId
  ]);

  const actualizar = (campoNombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarTraspaso = (
    campoNombre,
    valor
  ) => {
    setFormularioTraspaso(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarConteo = (
    campoNombre,
    valor
  ) => {
    setFormularioConteo(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const actualizarPolitica = (
    campoNombre,
    valor
  ) => {
    setFormularioPolitica(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
    setError("");
    setMensaje("");
  };

  const seleccionarMaterialPolitica =
    materialId => {
      const stock =
        stocksPorMaterial.get(materialId) || {};
      setFormularioPolitica({
        material_id: materialId,
        stock_minimo: stock.stock_minimo
          ? String(stock.stock_minimo)
          : "",
        punto_reposicion:
          stock.punto_reposicion
            ? String(stock.punto_reposicion)
            : "",
        stock_objetivo: stock.stock_objetivo
          ? String(stock.stock_objetivo)
          : "",
        lead_time_dias: stock.lead_time_dias
          ? String(stock.lead_time_dias)
          : ""
      });
      setError("");
      setMensaje("");
    };

  const usarRequerimiento = requerimiento => {
    setFormulario(actual => ({
      ...actual,
      material_id:
        requerimiento.material_id,
      cantidad: String(
        requerimiento.cantidad_requerida
      )
    }));
    setMensaje(
      `Material ${requerimiento.material_codigo} seleccionado desde la OT.`
    );
    setError("");
  };

  const guardar = async evento => {
    evento.preventDefault();

    if (erroresFormulario.length > 0) {
      setError(erroresFormulario.join(" "));
      return;
    }

    try {
      setGuardando(true);
      setError("");
      await registrarMovimientoAlmacen({
        db,
        perfil,
        plantaId,
        material: materialSeleccionado,
        tipo: formulario.tipo,
        cantidad: formulario.cantidad,
        otCodigo: formulario.ot_codigo,
        referencia: formulario.referencia,
        observacion: formulario.observacion
      });
      setFormulario(estadoInicial);
      setMensaje(
        "Movimiento registrado y stock actualizado."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar el movimiento."
      );
    } finally {
      setGuardando(false);
    }
  };

  const guardarTraspaso = async evento => {
    evento.preventDefault();

    if (erroresTraspaso.length > 0) {
      setError(erroresTraspaso.join(" "));
      return;
    }

    try {
      setGuardandoTraspaso(true);
      setError("");
      await registrarTraspasoSalida({
        db,
        perfil,
        plantaOrigenId: plantaId,
        plantaDestinoId:
          formularioTraspaso.planta_destino_id,
        material: materialTraspasoSeleccionado,
        cantidad: formularioTraspaso.cantidad,
        referencia: formularioTraspaso.referencia,
        observacion: formularioTraspaso.observacion
      });
      setFormularioTraspaso(traspasoInicial);
      setMensaje(
        "Salida de traspaso interno registrada. El stock quedó en tránsito hasta confirmar recepción."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar el traspaso interno."
      );
    } finally {
      setGuardandoTraspaso(false);
    }
  };

  const guardarConteo = async evento => {
    evento.preventDefault();

    if (erroresConteo.length > 0) {
      setError(erroresConteo.join(" "));
      return;
    }

    try {
      setGuardandoConteo(true);
      setError("");
      await registrarConteoFisico({
        db,
        perfil,
        plantaId,
        material: materialConteoSeleccionado,
        cantidadContada:
          formularioConteo.cantidad_contada,
        referencia: formularioConteo.referencia,
        observacion: formularioConteo.observacion
      });
      setFormularioConteo(conteoInicial);
      setMensaje(
        conteoVista.diferencia === 0
          ? "Conteo físico registrado sin diferencias."
          : "Conteo físico registrado y ajuste autorizado aplicado."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo registrar el conteo físico."
      );
    } finally {
      setGuardandoConteo(false);
    }
  };

  const guardarPolitica = async evento => {
    evento.preventDefault();

    try {
      setGuardandoPolitica(true);
      setError("");
      await actualizarPoliticaStock({
        db,
        perfil,
        plantaId,
        material: materialPoliticaSeleccionado,
        stockMinimo:
          formularioPolitica.stock_minimo,
        puntoReposicion:
          formularioPolitica.punto_reposicion,
        stockObjetivo:
          formularioPolitica.stock_objetivo,
        leadTimeDias:
          formularioPolitica.lead_time_dias
      });
      setMensaje(
        "Política de stock actualizada. Las alertas se recalcularon con los nuevos niveles."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo actualizar la política de stock."
      );
    } finally {
      setGuardandoPolitica(false);
    }
  };

  const recibirTraspaso = async traspaso => {
    try {
      setRecibiendoTraspasoId(traspaso.id);
      setError("");
      await registrarTraspasoRecepcion({
        db,
        perfil,
        traspaso
      });
      setMensaje(
        "Recepción de traspaso interno confirmada y stock actualizado en el almacén destino."
      );
      await cargar();
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo confirmar la recepción."
      );
    } finally {
      setRecibiendoTraspasoId("");
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
            fontWeight: "bold",
            marginBottom: 12
          }}
        >
          Volver a Ingeniería
        </button>

        <h1 style={{ marginBottom: 4 }}>
          Almacén V2
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Control inicial de stock MP/RF por
          planta, reservas para OT y movimientos
          trazables.
        </p>

        <div style={{
          marginBottom: 18,
          maxWidth: 260
        }}>
          <label>
            Planta
            <select
              value={plantaId}
              onChange={evento => {
                setPlantaId(evento.target.value);
                setFormulario(estadoInicial);
                setFormularioTraspaso(traspasoInicial);
                setFormularioConteo(conteoInicial);
                setFormularioPolitica(politicaInicial);
                setOtTrazabilidad("");
              }}
              style={{
                ...campo,
                marginTop: 6
              }}
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
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(320px, 0.95fr) minmax(360px, 1.3fr)",
          gap: 22,
          alignItems: "start"
        }}>
          <div style={{
            display: "grid",
            gap: 18
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
              Registrar movimiento
            </h2>

            <label>
              Material
              <select
                value={formulario.material_id}
                onChange={evento =>
                  actualizar(
                    "material_id",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Seleccionar material
                </option>
                {materiales.map(material => (
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

            <label>
              Tipo de movimiento
              <select
                value={formulario.tipo}
                onChange={evento => {
                  const nuevoTipo =
                    evento.target.value;
                  actualizar(
                    "tipo",
                    nuevoTipo
                  );

                  if (
                    !movimientoRequiereOT(
                      nuevoTipo
                    )
                  ) {
                    setFormulario(actual => ({
                      ...actual,
                      tipo: nuevoTipo,
                      ot_codigo: ""
                    }));
                  }
                }}
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                {movimientosManuales.map(
                  movimiento => (
                    <option
                      key={movimiento.tipo}
                      value={movimiento.tipo}
                    >
                      {movimiento.nombre}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Cantidad
              <input
                type="number"
                min="0"
                step="0.01"
                value={formulario.cantidad}
                onChange={evento =>
                  actualizar(
                    "cantidad",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {esAjusteAutorizadoSeleccionado && (
              <section style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#7F1D1D"
              }}>
                <strong>
                  Movimiento autorizado
                </strong>
                <div style={{
                  fontSize: 13,
                  marginTop: 4
                }}>
                  Este registro ajusta el stock físico.
                  Debe indicar el motivo real: merma,
                  daño, conteo físico, diferencia de
                  recepción u otra causa verificable.
                </div>
              </section>
            )}

            {movimientoRequiereOT(
              formulario.tipo
            ) ? (
              <label>
                OT asociada
                <select
                  value={formulario.ot_codigo}
                  onChange={evento =>
                    actualizar(
                      "ot_codigo",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                >
                  <option value="">
                    Seleccionar OT
                  </option>
                  {ordenes.map(orden => (
                    <option
                      key={orden.id}
                      value={orden.codigo}
                    >
                      {orden.codigo}
                      {" - "}
                      {orden.producto_nombre}
                      {" ("}
                      {orden.estado}
                      {")"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                OT asociada
                <input
                  value={formulario.ot_codigo}
                  disabled
                  placeholder="No aplica a este movimiento"
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14,
                    background: "#F8FAFC",
                    color: "#94A3B8"
                  }}
                />
              </label>
            )}

            {movimientoRequiereOT(
              formulario.tipo
            ) && formulario.ot_codigo && (
              <section style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14
              }}>
                <strong>
                  Materiales sugeridos por OT
                </strong>
                {disponibilidadOrden.length === 0 ? (
                  <p style={{
                    color: "#64748B",
                    marginBottom: 0
                  }}>
                    No hay materiales de entrada en
                    las operaciones pendientes de esta
                    OT.
                  </p>
                ) : (
                  <div style={{
                    display: "grid",
                    gap: 10,
                    marginTop: 10
                  }}>
                    {disponibilidadOrden.map(
                      item => (
                        <article
                          key={
                            item.material_id
                          }
                          style={{
                            border:
                              "1px solid #CBD5E1",
                            borderRadius: 9,
                            padding: 10,
                            background: "white"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                            alignItems: "center"
                          }}>
                            <div style={{
                              fontWeight: "bold"
                            }}>
                              {
                                item
                                  .material_codigo
                              }
                              {" - "}
                              {
                                item
                                  .material_nombre
                              }
                            </div>
                            <span style={{
                              padding:
                                "3px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: "bold",
                              color:
                                item.material_tipo ===
                                "RF"
                                  ? "#0369A1"
                                  : "#166534",
                              background:
                                item.material_tipo ===
                                "RF"
                                  ? "#E0F2FE"
                                  : "#DCFCE7"
                            }}>
                              {item.material_tipo}
                            </span>
                          </div>
                          <div style={{
                            color: "#334155",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Requerido:{" "}
                            {formatearNumero(
                              item
                                .cantidad_requerida
                            )}
                            {item.material_tipo ===
                            "RF" ? (
                              <>
                                {" · RF disponible ahora: "}
                                {formatearNumero(
                                  item.disponible_flujo
                                )}
                                {" · Producido OK: "}
                                {formatearNumero(
                                  item.producido_ok
                                )}
                                {" · Pendiente origen: "}
                                {formatearNumero(
                                  item.producido_pendiente
                                )}
                              </>
                            ) : (
                              <>
                                {" · Stock disponible: "}
                                {formatearNumero(
                                  item.stock_disponible
                                )}
                                {" · Brecha: "}
                                <span style={{
                                  color:
                                    item.brecha > 0
                                      ? "#B91C1C"
                                      : "#166534",
                                  fontWeight: "bold"
                                }}>
                                  {formatearNumero(
                                    item.brecha
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                          <div style={{
                            marginTop: 6,
                            color:
                              item.estado ===
                              "falta_mp"
                                ? "#B91C1C"
                                : item.estado ===
                                  "rf_sin_fuente"
                                  ? "#B45309"
                                  : "#166534",
                            fontSize: 13,
                            fontWeight: "bold"
                          }}>
                            {item.recomendacion}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              usarRequerimiento(
                                item
                              )
                            }
                            style={{
                              marginTop: 8,
                              padding: "8px 10px",
                              border: "none",
                              borderRadius: 8,
                              background: "#0F766E",
                              color: "white",
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                          >
                            Usar material y cantidad
                          </button>
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>
            )}

            <label>
              Referencia
              <input
                value={formulario.referencia}
                onChange={evento =>
                  actualizar(
                    "referencia",
                    evento.target.value
                  )
                }
                placeholder="OC, guía, ajuste, conteo..."
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Observación
              <textarea
                value={formulario.observacion}
                onChange={evento =>
                  actualizar(
                    "observacion",
                    evento.target.value
                  )
                }
                rows={3}
                placeholder={
                  esAjusteAutorizadoSeleccionado
                    ? "Motivo obligatorio del ajuste o merma"
                    : ""
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {materialSeleccionado && (
              <div style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#334155"
              }}>
                <strong>Saldo actual</strong>
                <div>
                  Stock:{" "}
                  {formatearNumero(
                    stockSeleccionado.stock_actual
                  )}
                  {" · Reservado: "}
                  {formatearNumero(
                    stockSeleccionado.stock_reservado
                  )}
                  {" · Disponible: "}
                  {formatearNumero(
                    calcularStockDisponible(
                      stockSeleccionado
                    )
                  )}
                </div>
              </div>
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
              disabled={guardando || cargando}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#0369A1",
                color: "white",
                fontWeight: "bold",
                cursor: guardando
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardando
                ? "Registrando..."
                : esAjusteAutorizadoSeleccionado
                  ? "Registrar ajuste autorizado"
                  : "Registrar movimiento"}
            </button>
          </form>

          <form
            onSubmit={guardarConteo}
            style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)",
              border: "1px solid #FED7AA"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Conteo físico
            </h2>
            <p style={{
              color: "#475569",
              marginTop: -4,
              fontSize: 14
            }}>
              Compara el stock del sistema contra lo
              contado físicamente. Si hay diferencia,
              se genera un ajuste autorizado.
            </p>

            <label>
              Material
              <select
                value={formularioConteo.material_id}
                onChange={evento =>
                  actualizarConteo(
                    "material_id",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Seleccionar material
                </option>
                {materiales.map(material => (
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

            <label>
              Cantidad contada
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  formularioConteo.cantidad_contada
                }
                onChange={evento =>
                  actualizarConteo(
                    "cantidad_contada",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {materialConteoSeleccionado && (
              <div style={{
                background:
                  conteoVista.diferencia === 0
                    ? "#F0FDF4"
                    : "#FFFBEB",
                border:
                  conteoVista.diferencia === 0
                    ? "1px solid #BBF7D0"
                    : "1px solid #FDE68A",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color:
                  conteoVista.diferencia === 0
                    ? "#166534"
                    : "#92400E"
              }}>
                <strong>Comparación</strong>
                <div>
                  Sistema:{" "}
                  {formatearNumero(
                    conteoVista.stock_sistema
                  )}
                  {" · Reservado: "}
                  {formatearNumero(
                    conteoVista.stock_reservado
                  )}
                  {" · Contado: "}
                  {formatearNumero(
                    conteoVista.stock_contado
                  )}
                  {" · Diferencia: "}
                  <strong>
                    {formatearNumero(
                      conteoVista.diferencia
                    )}
                  </strong>
                </div>
              </div>
            )}

            <label>
              Referencia
              <input
                value={formularioConteo.referencia}
                onChange={evento =>
                  actualizarConteo(
                    "referencia",
                    evento.target.value
                  )
                }
                placeholder="Inventario cíclico, auditoría, conteo..."
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Observación
              <textarea
                value={formularioConteo.observacion}
                onChange={evento =>
                  actualizarConteo(
                    "observacion",
                    evento.target.value
                  )
                }
                rows={3}
                placeholder={
                  conteoVista.diferencia !== 0
                    ? "Motivo obligatorio de la diferencia"
                    : "Opcional si el conteo cuadra"
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <button
              type="submit"
              disabled={guardandoConteo || cargando}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#C2410C",
                color: "white",
                fontWeight: "bold",
                cursor: guardandoConteo
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardandoConteo
                ? "Registrando conteo..."
                : conteoVista.diferencia === 0
                  ? "Registrar conteo"
                  : "Registrar conteo y ajustar stock"}
            </button>
          </form>

          <form
            onSubmit={guardarPolitica}
            style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)",
              border: "1px solid #BBF7D0"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Política de stock
            </h2>
            <p style={{
              color: "#475569",
              marginTop: -4,
              fontSize: 14
            }}>
              Define mínimos y punto de reposición por
              planta para activar alertas preventivas.
            </p>

            <label>
              Material
              <select
                value={formularioPolitica.material_id}
                onChange={evento =>
                  seleccionarMaterialPolitica(
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Seleccionar material
                </option>
                {materiales.map(material => (
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

            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: 10
            }}>
              <label>
                Stock mínimo
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formularioPolitica.stock_minimo
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "stock_minimo",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Punto reposición
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formularioPolitica
                      .punto_reposicion
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "punto_reposicion",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Stock objetivo
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formularioPolitica.stock_objetivo
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "stock_objetivo",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>

              <label>
                Días reposición
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    formularioPolitica.lead_time_dias
                  }
                  onChange={evento =>
                    actualizarPolitica(
                      "lead_time_dias",
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                />
              </label>
            </div>

            {materialPoliticaSeleccionado && (
              <div style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#166534"
              }}>
                <strong>Saldo actual</strong>
                <div>
                  Stock:{" "}
                  {formatearNumero(
                    stockPoliticaSeleccionado
                      .stock_actual
                  )}
                  {" · Disponible: "}
                  {formatearNumero(
                    calcularStockDisponible(
                      stockPoliticaSeleccionado
                    )
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                guardandoPolitica || cargando
              }
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#15803D",
                color: "white",
                fontWeight: "bold",
                cursor: guardandoPolitica
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardandoPolitica
                ? "Guardando política..."
                : "Guardar política de stock"}
            </button>
          </form>

          <form
            onSubmit={guardarTraspaso}
            style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)",
              border: "1px solid #BFDBFE"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Traspaso interno entre almacenes
            </h2>
            <p style={{
              color: "#475569",
              marginTop: -4,
              fontSize: 14
            }}>
              Solo aplica entre almacenes de la misma
              empresa. Entre empresas hermanas del
              grupo corresponde venta/compra, no
              traspaso.
            </p>

            <label>
              Almacén origen
              <input
                value={plantaId.toUpperCase()}
                disabled
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14,
                  background: "#F8FAFC"
                }}
              />
            </label>

            <label>
              Almacén destino
              <select
                value={
                  formularioTraspaso.planta_destino_id
                }
                onChange={evento =>
                  actualizarTraspaso(
                    "planta_destino_id",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Seleccionar almacén destino
                </option>
                {plantas
                  .filter(planta => planta !== plantaId)
                  .map(planta => (
                    <option
                      key={planta}
                      value={planta}
                    >
                      {planta.toUpperCase()}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Material
              <select
                value={
                  formularioTraspaso.material_id
                }
                onChange={evento =>
                  actualizarTraspaso(
                    "material_id",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              >
                <option value="">
                  Seleccionar material
                </option>
                {materiales.map(material => (
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

            <label>
              Cantidad a mover internamente
              <input
                type="number"
                min="0"
                step="0.01"
                value={formularioTraspaso.cantidad}
                onChange={evento =>
                  actualizarTraspaso(
                    "cantidad",
                    evento.target.value
                  )
                }
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            {materialTraspasoSeleccionado && (
              <div style={{
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                color: "#1E3A8A"
              }}>
                <strong>Saldo en origen</strong>
                <div>
                  Stock:{" "}
                  {formatearNumero(
                    stockTraspasoSeleccionado
                      .stock_actual
                  )}
                  {" · Reservado: "}
                  {formatearNumero(
                    stockTraspasoSeleccionado
                      .stock_reservado
                  )}
                  {" · Disponible: "}
                  {formatearNumero(
                    calcularStockDisponible(
                      stockTraspasoSeleccionado
                    )
                  )}
                </div>
              </div>
            )}

            <label>
              Referencia
              <input
                value={
                  formularioTraspaso.referencia
                }
                onChange={evento =>
                  actualizarTraspaso(
                    "referencia",
                    evento.target.value
                  )
                }
                placeholder="Guía interna, solicitud, traslado interno..."
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <label>
              Observación
              <textarea
                value={
                  formularioTraspaso.observacion
                }
                onChange={evento =>
                  actualizarTraspaso(
                    "observacion",
                    evento.target.value
                  )
                }
                rows={3}
                style={{
                  ...campo,
                  marginTop: 6,
                  marginBottom: 14
                }}
              />
            </label>

            <button
              type="submit"
              disabled={
                guardandoTraspaso || cargando
              }
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: "#1D4ED8",
                color: "white",
                fontWeight: "bold",
                cursor: guardandoTraspaso
                  ? "wait"
                  : "pointer"
              }}
            >
              {guardandoTraspaso
                ? "Registrando traspaso interno..."
                : "Registrar salida de traspaso interno"}
            </button>
          </form>
          </div>

          <div style={{
            display: "grid",
            gap: 18
          }}>
            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Alertas de stock y reposición
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>Alertas activas</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#B91C1C",
                    marginTop: 4
                  }}>
                    {alertasCriticas.length}
                  </div>
                </div>
                <div style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>Sin política</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#475569",
                    marginTop: 4
                  }}>
                    {alertasSinPolitica}
                  </div>
                </div>
              </div>

              {alertasCriticas.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay materiales bajo mínimo o en
                  punto de reposición para esta planta.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {alertasCriticas
                    .slice(0, 12)
                    .map(alerta => {
                      const critica = [
                        "sin_stock",
                        "bajo_minimo"
                      ].includes(alerta.estado);

                      return (
                        <article
                          key={alerta.material_id}
                          style={{
                            border: critica
                              ? "1px solid #FECACA"
                              : "1px solid #FDE68A",
                            borderRadius: 10,
                            padding: 12,
                            background: critica
                              ? "#FEF2F2"
                              : "#FFFBEB"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                            alignItems: "center"
                          }}>
                            <strong>
                              {alerta.material_codigo}
                              {" - "}
                              {alerta.material_nombre}
                            </strong>
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: "bold",
                              color: critica
                                ? "#991B1B"
                                : "#92400E",
                              background: critica
                                ? "#FEE2E2"
                                : "#FEF3C7"
                            }}>
                              {alerta.estado ===
                              "sin_stock"
                                ? "Sin stock"
                                : alerta.estado ===
                                  "bajo_minimo"
                                  ? "Bajo mínimo"
                                  : "Reponer"}
                            </span>
                          </div>
                          <div style={{
                            color: "#334155",
                            marginTop: 4
                          }}>
                            Disponible:{" "}
                            {formatearNumero(
                              alerta.stock_disponible
                            )}
                            {" · Mínimo: "}
                            {formatearNumero(
                              alerta.stock_minimo
                            )}
                            {" · Reposición: "}
                            {formatearNumero(
                              alerta.punto_reposicion
                            )}
                            {" · Sugerido: "}
                            <strong>
                              {formatearNumero(
                                alerta.cantidad_sugerida
                              )}
                            </strong>
                          </div>
                          <div style={{
                            color: "#64748B",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Lead time:{" "}
                            {formatearNumero(
                              alerta.lead_time_dias
                            )}
                            {" días · "}
                            {alerta.recomendacion}
                          </div>
                        </article>
                      );
                    })}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Cobertura de OTs abiertas
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>
                    Materiales con brecha
                  </strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#B91C1C",
                    marginTop: 4
                  }}>
                    {necesidadesConBrecha.length}
                  </div>
                </div>
                <div style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>OTs revisadas</strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#334155",
                    marginTop: 4
                  }}>
                    {
                      operacionesOrdenesAbiertas
                        .length
                    }
                  </div>
                </div>
              </div>

              {necesidadesOTs.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  No hay materiales requeridos en las
                  OTs abiertas revisadas.
                </p>
              ) : necesidadesConBrecha.length === 0 ? (
                <p style={{ color: "#166534" }}>
                  El stock disponible cubre los
                  materiales revisados de las OTs
                  abiertas.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {necesidadesConBrecha
                    .slice(0, 12)
                    .map(item => (
                      <article
                        key={item.material_id}
                        style={{
                          border:
                            "1px solid #FECACA",
                          borderRadius: 10,
                          padding: 12,
                          background: "#FEF2F2"
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 8,
                          alignItems: "center"
                        }}>
                          <strong>
                            {item.material_codigo}
                            {" - "}
                            {item.material_nombre}
                          </strong>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: "bold",
                            color: "#991B1B",
                            background: "#FEE2E2"
                          }}>
                            No alcanza
                          </span>
                        </div>
                        <div style={{
                          color: "#334155",
                          marginTop: 4
                        }}>
                          Requerido OTs:{" "}
                          {formatearNumero(
                            item.cantidad_requerida
                          )}
                          {" · Disponible: "}
                          {formatearNumero(
                            item.stock_disponible
                          )}
                          {" · Brecha: "}
                          <strong>
                            {formatearNumero(
                              item.brecha
                            )}
                          </strong>
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          OTs afectadas:{" "}
                          {item.ots
                            .slice(0, 4)
                            .map(ot =>
                              ot.ot_codigo ||
                              ot.operacion_codigo
                            )
                            .join(", ")}
                          {item.ots.length > 4
                            ? ` y ${item.ots.length - 4} más`
                            : ""}
                        </div>
                        <div style={{
                          color: "#7F1D1D",
                          fontSize: 13,
                          marginTop: 4,
                          fontWeight: "bold"
                        }}>
                          {item.recomendacion}
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Traspasos internos y stock en tránsito
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>
                    En tránsito hacia esta planta
                  </strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#1D4ED8",
                    marginTop: 4
                  }}>
                    {formatearNumero(
                      stockEnTransitoEntrada
                    )}
                  </div>
                </div>
                <div style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 12
                }}>
                  <strong>
                    Traspasos abiertos
                  </strong>
                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#334155",
                    marginTop: 4
                  }}>
                    {traspasosEnTransito.length}
                  </div>
                </div>
              </div>

              {traspasos.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Aún no hay traspasos relacionados con
                  este almacén.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {traspasos.slice(0, 12).map(
                    traspaso => {
                      const esDestino =
                        traspaso.planta_destino_id ===
                        plantaId;
                      const pendiente =
                        traspaso.estado ===
                        ESTADOS_TRASPASO_ALMACEN
                          .EN_TRANSITO;

                      return (
                        <article
                          key={traspaso.id}
                          style={{
                            border:
                              "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: 12,
                            background: pendiente
                              ? "#FFFBEB"
                              : "#F0FDF4"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                            alignItems: "center"
                          }}>
                            <strong>
                              {
                                traspaso
                                  .material_codigo
                              }
                              {" - "}
                              {
                                traspaso
                                  .material_nombre
                              }
                            </strong>
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: "bold",
                              color: pendiente
                                ? "#92400E"
                                : "#166534",
                              background: pendiente
                                ? "#FEF3C7"
                                : "#DCFCE7"
                            }}>
                              {pendiente
                                ? "En tránsito"
                                : "Recibido"}
                            </span>
                          </div>
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 5
                          }}>
                            {traspaso
                              .planta_origen_id
                              .toUpperCase()}
                            {" → "}
                            {traspaso
                              .planta_destino_id
                              .toUpperCase()}
                            {" · Cantidad "}
                            {formatearNumero(
                              traspaso.cantidad
                            )}
                            {" · Creado "}
                            {formatearFecha(
                              traspaso.creado_en
                            )}
                          </div>
                          <div style={{
                            color: "#64748B",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            {traspaso.referencia
                              ? `Referencia: ${traspaso.referencia}`
                              : "Sin referencia"}
                            {" · Usuario: "}
                            {traspaso.creado_por_nombre ||
                              "-"}
                          </div>
                          {pendiente && esDestino && (
                            <button
                              type="button"
                              onClick={() =>
                                recibirTraspaso(
                                  traspaso
                                )
                              }
                              disabled={
                                recibiendoTraspasoId ===
                                traspaso.id
                              }
                              style={{
                                marginTop: 10,
                                padding: "9px 12px",
                                border: "none",
                                borderRadius: 8,
                                background: "#166534",
                                color: "white",
                                fontWeight: "bold",
                                cursor:
                                  recibiendoTraspasoId ===
                                  traspaso.id
                                    ? "wait"
                                    : "pointer"
                              }}
                            >
                              {recibiendoTraspasoId ===
                              traspaso.id
                                ? "Recepcionando..."
                                : "Confirmar recepción"}
                            </button>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Conteos físicos recientes
              </h2>

              {conteosRecientes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Todavía no hay conteos físicos para
                  esta planta.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {conteosRecientes.map(conteo => {
                    const cuadrado =
                      Number(conteo.diferencia || 0) ===
                      0;

                    return (
                      <article
                        key={conteo.id}
                        style={{
                          border: cuadrado
                            ? "1px solid #BBF7D0"
                            : "1px solid #FDE68A",
                          borderRadius: 10,
                          padding: 12,
                          background: cuadrado
                            ? "#F0FDF4"
                            : "#FFFBEB"
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 8,
                          alignItems: "center"
                        }}>
                          <strong>
                            {conteo.material_codigo}
                            {" - "}
                            {conteo.material_nombre}
                          </strong>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: "bold",
                            color: cuadrado
                              ? "#166534"
                              : "#92400E",
                            background: cuadrado
                              ? "#DCFCE7"
                              : "#FEF3C7"
                          }}>
                            {cuadrado
                              ? "Cuadrado"
                              : "Ajustado"}
                          </span>
                        </div>
                        <div style={{
                          color: "#334155",
                          marginTop: 4
                        }}>
                          Sistema:{" "}
                          {formatearNumero(
                            conteo.stock_sistema
                          )}
                          {" · Contado: "}
                          {formatearNumero(
                            conteo.stock_contado
                          )}
                          {" · Diferencia: "}
                          <strong>
                            {formatearNumero(
                              conteo.diferencia
                            )}
                          </strong>
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          {formatearFecha(
                            conteo.contado_en
                          )}
                          {" · Contó: "}
                          {conteo.contado_por_nombre ||
                            "-"}
                          {conteo.movimiento_ajuste_id
                            ? " · Ajuste generado"
                            : ""}
                        </div>
                        {conteo.observacion && (
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            Motivo:{" "}
                            {conteo.observacion}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Mermas y ajustes recientes
              </h2>

              {diferenciasRecientes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Sin mermas ni ajustes autorizados
                  registrados para esta planta.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {diferenciasRecientes.map(
                    movimiento => (
                      <article
                        key={movimiento.id}
                        style={{
                          border:
                            "1px solid #FECACA",
                          borderRadius: 10,
                          padding: 12,
                          background: "#FEF2F2"
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 8,
                          alignItems: "center"
                        }}>
                          <strong>
                            {movimiento.tipo_nombre}
                            {" · "}
                            {movimiento.material_codigo}
                          </strong>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: "bold",
                            color: "#991B1B",
                            background: "#FEE2E2"
                          }}>
                            Autorizado
                          </span>
                        </div>
                        <div style={{
                          color: "#334155",
                          marginTop: 4
                        }}>
                          Cantidad:{" "}
                          {formatearNumero(
                            movimiento.cantidad
                          )}
                          {" · Stock: "}
                          {formatearNumero(
                            movimiento.stock_anterior
                          )}
                          {" → "}
                          {formatearNumero(
                            movimiento.stock_nuevo
                          )}
                        </div>
                        <div style={{
                          color: "#64748B",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          {formatearFecha(
                            movimiento.fecha
                          )}
                          {" · Autorizó: "}
                          {movimiento
                            .autorizado_por_nombre ||
                            movimiento.usuario_nombre ||
                            "-"}
                        </div>
                        <div style={{
                          color: "#7F1D1D",
                          fontSize: 13,
                          marginTop: 4,
                          fontWeight: "bold"
                        }}>
                          Motivo:{" "}
                          {movimiento.observacion ||
                            "-"}
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Stock por material
              </h2>

              {cargando ? (
                <p>Cargando stock...</p>
              ) : stocks.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Todavía no hay stock registrado
                  para esta planta.
                </p>
              ) : (
                <div style={{
                  overflowX: "auto"
                }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse"
                  }}>
                    <thead>
                      <tr style={{
                        textAlign: "left",
                        color: "#475569"
                      }}>
                        <th>Material</th>
                        <th>Tipo</th>
                        <th>Stock</th>
                        <th>Reservado</th>
                        <th>Disponible</th>
                        <th>Reposición</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map(stock => {
                        const alerta =
                          alertasPorMaterial.get(
                            stock.material_id
                          );
                        const critica =
                          alerta &&
                          [
                            "sin_stock",
                            "bajo_minimo"
                          ].includes(alerta.estado);

                        return (
                        <tr key={stock.id}>
                          <td style={{
                            padding: "10px 6px",
                            borderTop:
                              "1px solid #E2E8F0"
                          }}>
                            <strong>
                              {stock.material_codigo}
                            </strong>
                            <div style={{
                              color: "#64748B",
                              fontSize: 13
                            }}>
                              {stock.material_nombre}
                            </div>
                          </td>
                          <td>{stock.material_tipo}</td>
                          <td>
                            {formatearNumero(
                              stock.stock_actual
                            )}
                          </td>
                          <td>
                            {formatearNumero(
                              stock.stock_reservado
                            )}
                          </td>
                          <td>
                            {formatearNumero(
                              stock.stock_disponible
                            )}
                          </td>
                          <td>
                            {alerta ? (
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: "bold",
                                color:
                                  alerta.estado ===
                                  "ok"
                                    ? "#166534"
                                    : critica
                                      ? "#991B1B"
                                      : "#92400E",
                                background:
                                  alerta.estado ===
                                  "ok"
                                    ? "#DCFCE7"
                                    : critica
                                      ? "#FEE2E2"
                                      : "#FEF3C7"
                              }}>
                                {alerta.estado === "ok"
                                  ? "OK"
                                  : alerta.estado ===
                                    "sin_politica"
                                    ? "Sin política"
                                    : alerta.estado ===
                                      "sin_stock"
                                      ? "Sin stock"
                                      : alerta.estado ===
                                        "bajo_minimo"
                                        ? "Bajo mínimo"
                                        : "Reponer"}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Trazabilidad por OT
              </h2>

              <label>
                OT
                <select
                  value={otTrazabilidad}
                  onChange={evento =>
                    setOtTrazabilidad(
                      evento.target.value
                    )
                  }
                  style={{
                    ...campo,
                    marginTop: 6,
                    marginBottom: 14
                  }}
                >
                  <option value="">
                    Seleccionar OT
                  </option>
                  {ordenes.map(orden => (
                    <option
                      key={orden.id}
                      value={orden.codigo}
                    >
                      {orden.codigo}
                      {" - "}
                      {orden.producto_nombre}
                    </option>
                  ))}
                </select>
              </label>

              {!otTrazabilidad ? (
                <p style={{ color: "#64748B" }}>
                  Selecciona una OT para revisar
                  reservas, consumos y RF producidos.
                </p>
              ) : (
                <>
                  <div style={{
                    border: "1px solid #CBD5E1",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                    background:
                      cuadraturaOT.estado_general ===
                      "bloqueada_por_mp"
                        ? "#FEF2F2"
                        : cuadraturaOT.estado_general ===
                          "rf_en_flujo"
                          ? "#FFFBEB"
                          : cuadraturaOT.estado_general ===
                            "cuadrada"
                            ? "#F0FDF4"
                            : "#F8FAFC"
                  }}>
                    <strong>
                      {cuadraturaOT.estado_general ===
                      "bloqueada_por_mp"
                        ? "OT con riesgo por falta de MP"
                        : cuadraturaOT.estado_general ===
                          "rf_en_flujo"
                          ? "OT con RF en flujo"
                          : cuadraturaOT.estado_general ===
                            "cuadrada"
                            ? "OT cuadrada en almacén"
                            : "OT sin materiales configurados"}
                    </strong>
                    <div style={{
                      color: "#475569",
                      fontSize: 13,
                      marginTop: 5
                    }}>
                      MP pendientes:{" "}
                      {
                        cuadraturaOT.totales
                          .mp_pendientes
                      }
                      {"/"}
                      {cuadraturaOT.totales.mp_total}
                      {" · RF pendientes: "}
                      {
                        cuadraturaOT.totales
                          .rf_pendientes
                      }
                      {"/"}
                      {cuadraturaOT.totales.rf_total}
                      {" · Unidades pendientes: "}
                      {formatearNumero(
                        cuadraturaOT.totales
                          .unidades_pendientes
                      )}
                    </div>
                    <div style={{
                      color: "#334155",
                      fontSize: 13,
                      marginTop: 5
                    }}>
                      {cuadraturaOT.recomendacion}
                    </div>
                  </div>

                  <h3 style={{ marginTop: 0 }}>
                    Estado de cuadratura
                  </h3>

                  {cuadraturaTrazabilidad.length === 0 ? (
                    <p style={{ color: "#64748B" }}>
                      Esta OT no tiene materiales de
                      entrada asociados a sus operaciones.
                    </p>
                  ) : (
                    <div style={{
                      display: "grid",
                      gap: 9,
                      marginBottom: 16
                    }}>
                      {cuadraturaTrazabilidad.map(
                        item => (
                          <div
                            key={item.material_id}
                            style={{
                              border:
                                "1px solid #E2E8F0",
                              borderRadius: 10,
                              padding: 10,
                              background:
                                item.estado_cuadratura
                                  .includes("pendiente")
                                  ? "#FFFBEB"
                                  : "#F0FDF4"
                            }}
                          >
                            <div style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: 8,
                              alignItems: "center"
                            }}>
                              <strong>
                                {item.material_codigo}
                                {" - "}
                                {item.material_nombre}
                              </strong>
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: "bold",
                                color:
                                  item.material_tipo ===
                                  "RF"
                                    ? "#0369A1"
                                    : "#166534",
                                background:
                                  item.material_tipo ===
                                  "RF"
                                    ? "#E0F2FE"
                                    : "#DCFCE7"
                              }}>
                                {item.material_tipo}
                              </span>
                            </div>
                            <div style={{
                              color: "#475569",
                              fontSize: 13,
                              marginTop: 4
                            }}>
                              Requerido:{" "}
                              {formatearNumero(
                                item.cantidad_requerida
                              )}
                              {item.material_tipo ===
                              "MP" ? (
                                <>
                                  {" · Reservado neto: "}
                                  {formatearNumero(
                                    item.reservado_neto
                                  )}
                                  {" · Consumido: "}
                                  {formatearNumero(
                                    item.consumido
                                  )}
                                  {" · Pendiente: "}
                                  {formatearNumero(
                                    item.faltante
                                  )}
                                </>
                              ) : (
                                <>
                                  {" · Producido: "}
                                  {formatearNumero(
                                    item.producido
                                  )}
                                  {" · RF disponible ahora: "}
                                  {formatearNumero(
                                    item.disponible_flujo
                                  )}
                                  {" · Pendiente: "}
                                  {formatearNumero(
                                    item.faltante
                                  )}
                                </>
                              )}
                            </div>
                            <div style={{
                              marginTop: 4,
                              fontSize: 13,
                              fontWeight: "bold",
                              color:
                                item.faltante > 0
                                  ? "#B45309"
                                  : "#166534"
                            }}>
                              {item.faltante > 0
                                ? item.material_tipo ===
                                  "MP"
                                  ? "Pendiente de reservar o consumir MP."
                                  : "RF en flujo o pendiente de producción."
                                : "Cuadrado para esta OT."}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {movimientosTrazabilidad.length === 0 ? (
                    <p style={{ color: "#64748B" }}>
                      Esta OT aún no tiene movimientos de
                      almacén registrados.
                    </p>
                  ) : (
                    <>
                  <div style={{
                    display: "grid",
                    gap: 9,
                    marginBottom: 14
                  }}>
                    {Object.values(
                      resumenTrazabilidad
                    ).map(item => (
                      <div
                        key={item.material_codigo}
                        style={{
                          border:
                            "1px solid #E2E8F0",
                          borderRadius: 10,
                          padding: 10,
                          background: "#F8FAFC"
                        }}
                      >
                        <strong>
                          {item.material_codigo}
                          {" - "}
                          {item.material_nombre}
                        </strong>
                        <div style={{
                          color: "#475569",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          Reservado:{" "}
                          {formatearNumero(
                            item.reservado
                          )}
                          {" · Liberado: "}
                          {formatearNumero(
                            item.liberado
                          )}
                          {" · Consumido: "}
                          {formatearNumero(
                            item.consumido
                          )}
                          {" · Producido: "}
                          {formatearNumero(
                            item.producido
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                    </>
                  )}

                  <div style={{
                    display: "grid",
                    gap: 8
                  }}>
                    {movimientosTrazabilidad.map(
                      movimiento => (
                        <article
                          key={movimiento.id}
                          style={{
                            border:
                              "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: 10
                          }}
                        >
                          <strong>
                            {
                              movimiento.tipo_nombre
                            }
                            {" · "}
                            {
                              movimiento
                                .material_codigo
                            }
                          </strong>
                          <div style={{
                            color: "#475569",
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            {formatearFecha(
                              movimiento.fecha
                            )}
                            {" · Cantidad "}
                            {formatearNumero(
                              movimiento.cantidad
                            )}
                            {" · "}
                            {movimiento.origen ===
                            "produccion"
                              ? "Producción"
                              : etiquetaOrigenMovimiento(
                                movimiento.origen
                              )}
                          </div>
                          {movimiento.operacion_codigo && (
                            <div style={{
                              color: "#64748B",
                              fontSize: 13,
                              marginTop: 3
                            }}>
                              Operación:{" "}
                              {
                                movimiento
                                  .operacion_codigo
                              }
                              {movimiento
                                .operacion_nombre
                                ? ` · ${movimiento.operacion_nombre}`
                                : ""}
                            </div>
                          )}
                        </article>
                      )
                    )}
                  </div>
                </>
              )}
            </section>

            <section style={{
              background: "white",
              padding: 22,
              borderRadius: 14,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Últimos movimientos
              </h2>

              {movimientosRecientes.length === 0 ? (
                <p style={{ color: "#64748B" }}>
                  Sin movimientos registrados.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gap: 10
                }}>
                  {movimientosRecientes.map(movimiento => (
                    <article
                      key={movimiento.id}
                      style={{
                        border:
                          "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 12
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 8,
                        alignItems: "center"
                      }}>
                        <strong>
                          {movimiento.tipo_nombre}
                          {" · "}
                          {movimiento.material_codigo}
                        </strong>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: "bold",
                          ...estiloOrigenMovimiento(
                            movimiento.origen
                          )
                        }}>
                          {etiquetaOrigenMovimiento(
                            movimiento.origen
                          )}
                        </span>
                      </div>
                      <div style={{
                        color: "#334155",
                        marginTop: 4
                      }}>
                        Cantidad:{" "}
                        {formatearNumero(
                          movimiento.cantidad
                        )}
                        {" · Stock: "}
                        {formatearNumero(
                          movimiento.stock_anterior
                        )}
                        {" → "}
                        {formatearNumero(
                          movimiento.stock_nuevo
                        )}
                        {" · Disponible: "}
                        {formatearNumero(
                          movimiento
                            .stock_disponible_nuevo
                        )}
                      </div>
                      <div style={{
                        color: "#64748B",
                        fontSize: 13,
                        marginTop: 4
                      }}>
                        {formatearFecha(
                          movimiento.fecha
                        )}
                        {movimiento.ot_codigo
                          ? ` · ${movimiento.ot_codigo}`
                          : ""}
                        {movimiento.referencia
                          ? ` · ${movimiento.referencia}`
                          : ""}
                      </div>
                      {movimiento.origen ===
                        "produccion" && (
                        <div style={{
                          color: "#475569",
                          fontSize: 13,
                          marginTop: 4
                        }}>
                          Operación:{" "}
                          {movimiento.operacion_codigo ||
                            "-"}
                          {movimiento.operacion_nombre
                            ? ` · ${movimiento.operacion_nombre}`
                            : ""}
                          {movimiento.sesion_id
                            ? ` · Sesión ${movimiento.sesion_id}`
                            : ""}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlmacenV2;
