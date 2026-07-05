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
  MOVIMIENTOS_ALMACEN,
  TIPOS_MOVIMIENTO_ALMACEN,
  calcularDisponibilidadOT,
  calcularStockDisponible,
  listarMovimientosAlmacen,
  listarStockMateriales,
  prepararMovimientoAlmacen,
  registrarMovimientoAlmacen,
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
  const [ordenes, setOrdenes] = useState([]);
  const [operacionesOrden, setOperacionesOrden] =
    useState([]);
  const [otTrazabilidad, setOtTrazabilidad] =
    useState("");
  const [formulario, setFormulario] =
    useState(estadoInicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] =
    useState(false);
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
  const movimientosTrazabilidad = useMemo(
    () => movimientos.filter(
      movimiento =>
        movimiento.ot_codigo ===
        otTrazabilidad
    ),
    [movimientos, otTrazabilidad]
  );
  const resumenTrazabilidad = useMemo(
    () => movimientosTrazabilidad.reduce(
      (resumen, movimiento) => {
        const codigo =
          movimiento.material_codigo ||
          "SIN_CODIGO";
        const actual =
          resumen[codigo] || {
            material_codigo: codigo,
            material_nombre:
              movimiento.material_nombre || "",
            material_tipo:
              movimiento.material_tipo || "",
            consumido: 0,
            producido: 0,
            reservado: 0,
            liberado: 0
          };

        if (
          movimiento.tipo ===
          TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT
        ) {
          actual.consumido += Number(
            movimiento.cantidad || 0
          );
        } else if (
          movimiento.tipo ===
          TIPOS_MOVIMIENTO_ALMACEN.RECEPCION
        ) {
          actual.producido += Number(
            movimiento.cantidad || 0
          );
        } else if (
          movimiento.tipo ===
          TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT
        ) {
          actual.reservado += Number(
            movimiento.cantidad || 0
          );
        } else if (
          movimiento.tipo ===
          TIPOS_MOVIMIENTO_ALMACEN
            .LIBERACION_RESERVA
        ) {
          actual.liberado += Number(
            movimiento.cantidad || 0
          );
        }

        return {
          ...resumen,
          [codigo]: actual
        };
      },
      {}
    ),
    [movimientosTrazabilidad]
  );

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

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const [
        materialesData,
        stocksData,
        movimientosData,
        ordenesData
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
        )
      ]);
      setMateriales(
        materialesData.filter(
          material => material.activo
        )
      );
      setStocks(stocksData);
      setMovimientos(movimientosData);
      setOrdenes(
        ordenesData.filter(
          orden =>
            ![
              "cerrada",
              "completada"
            ].includes(orden.estado)
        )
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

  const actualizar = (campoNombre, valor) => {
    setFormulario(actual => ({
      ...actual,
      [campoNombre]: valor
    }));
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
                {MOVIMIENTOS_ALMACEN.map(
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
                : "Registrar movimiento"}
            </button>
          </form>

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
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map(stock => (
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
                        </tr>
                      ))}
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
              ) : movimientosTrazabilidad.length === 0 ? (
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
                              : "Manual"}
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
                          color:
                            movimiento.origen ===
                            "produccion"
                              ? "#7C2D12"
                              : "#334155",
                          background:
                            movimiento.origen ===
                            "produccion"
                              ? "#FFEDD5"
                              : "#E2E8F0"
                        }}>
                          {movimiento.origen ===
                          "produccion"
                            ? "Producción"
                            : "Manual"}
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
