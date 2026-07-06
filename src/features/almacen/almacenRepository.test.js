import {
  ESTADOS_TRASPASO_ALMACEN,
  TIPOS_MOVIMIENTO_ALMACEN,
  calcularAlertasStock,
  calcularCuadraturaAlmacenOT,
  calcularDisponibilidadOT,
  calcularStockDisponible,
  calcularRequerimientosMaterialesOT,
  calcularStockTrasMovimiento,
  esMovimientoAjusteAutorizado,
  obtenerOrigenMovimientoAlmacen,
  prepararConteoFisico,
  prepararMovimientoAlmacen,
  prepararPoliticaStock,
  prepararTraspasoAlmacen,
  validarConteoFisico,
  validarPoliticaStock,
  validarTraspasoSalida,
  validarMovimientoAlmacen
} from "./almacenRepository";

const material = {
  id: "bba__MP0001",
  codigo: "MP0001",
  nombre: "Tubo 15x15",
  tipo: "MP",
  unidad_medida: "metro"
};

const usuario = {
  uid: "user-1",
  nombre: "Jefe Planta"
};

test("calcula stock disponible descontando reserva", () => {
  expect(
    calcularStockDisponible({
      stock_actual: 100,
      stock_reservado: 30
    })
  ).toBe(70);
});

test("recepcion aumenta stock actual y disponible", () => {
  const movimiento =
    prepararMovimientoAlmacen({
      empresaId: "bba",
      plantaId: "chile",
      material,
      tipo: TIPOS_MOVIMIENTO_ALMACEN.RECEPCION,
      cantidad: 50,
      referencia: "OC 100",
      usuario
    });

  expect(
    calcularStockTrasMovimiento(
      {
        stock_actual: 10,
        stock_reservado: 3
      },
      movimiento
    )
  ).toEqual({
    stock_actual: 60,
    stock_reservado: 3,
    stock_disponible: 57
  });
});

test("reserva OT aumenta reservado sin mover stock actual", () => {
  const movimiento =
    prepararMovimientoAlmacen({
      empresaId: "bba",
      plantaId: "chile",
      material,
      tipo: TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT,
      cantidad: 20,
      otCodigo: "ot-chi-000001",
      usuario
    });

  expect(movimiento.ot_codigo).toBe(
    "OT-CHI-000001"
  );
  expect(
    validarMovimientoAlmacen(
      movimiento,
      {
        stock_actual: 100,
        stock_reservado: 10
      }
    )
  ).toEqual([]);
  expect(
    calcularStockTrasMovimiento(
      {
        stock_actual: 100,
        stock_reservado: 10
      },
      movimiento
    )
  ).toEqual({
    stock_actual: 100,
    stock_reservado: 30,
    stock_disponible: 70
  });
});

test("bloquea reservas mayores al disponible", () => {
  const movimiento =
    prepararMovimientoAlmacen({
      empresaId: "bba",
      plantaId: "chile",
      material,
      tipo: TIPOS_MOVIMIENTO_ALMACEN.RESERVA_OT,
      cantidad: 90,
      otCodigo: "OT-CHI-000001",
      usuario
    });

  expect(
    validarMovimientoAlmacen(
      movimiento,
      {
        stock_actual: 100,
        stock_reservado: 20
      }
    )
  ).toContain(
    "No puedes reservar más que el stock disponible (80)."
  );
});

test("bloquea liberacion mayor a lo reservado", () => {
  const movimiento =
    prepararMovimientoAlmacen({
      empresaId: "bba",
      plantaId: "chile",
      material,
      tipo: TIPOS_MOVIMIENTO_ALMACEN.LIBERACION_RESERVA,
      cantidad: 15,
      usuario
    });

  expect(
    validarMovimientoAlmacen(
      movimiento,
      {
        stock_actual: 100,
        stock_reservado: 10
      }
    )
  ).toContain(
    "No puedes liberar más que el stock reservado (10)."
  );
});

test("consumo por OT exige OT y stock disponible", () => {
  const movimiento =
    prepararMovimientoAlmacen({
      empresaId: "bba",
      plantaId: "chile",
      material,
      tipo: TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT,
      cantidad: 12,
      usuario
    });

  expect(
    validarMovimientoAlmacen(
      movimiento,
      {
        stock_actual: 10,
        stock_reservado: 0
      }
    )
  ).toEqual([
    "Stock físico insuficiente. Stock: 10.",
    "Indica la OT asociada al movimiento."
  ]);
});

test("consumo OT descuenta stock físico y libera reserva existente", () => {
  const movimiento =
    prepararMovimientoAlmacen({
      empresaId: "bba",
      plantaId: "chile",
      material,
      tipo: TIPOS_MOVIMIENTO_ALMACEN.CONSUMO_OT,
      cantidad: 30,
      otCodigo: "OT-CHI-000001",
      usuario
    });

  expect(
    validarMovimientoAlmacen(
      movimiento,
      {
        stock_actual: 100,
        stock_reservado: 80
      }
    )
  ).toEqual([]);
  expect(
    calcularStockTrasMovimiento(
      {
        stock_actual: 100,
        stock_reservado: 80
      },
      movimiento
    )
  ).toEqual({
    stock_actual: 70,
    stock_reservado: 50,
    stock_disponible: 20
  });
});

test("mermas y ajustes autorizados exigen motivo y guardan autorizacion", () => {
  const sinMotivo = prepararMovimientoAlmacen({
    empresaId: "bba",
    plantaId: "chile",
    material,
    tipo: TIPOS_MOVIMIENTO_ALMACEN.MERMA,
    cantidad: 5,
    usuario
  });
  const conMotivo = prepararMovimientoAlmacen({
    empresaId: "bba",
    plantaId: "chile",
    material,
    tipo: TIPOS_MOVIMIENTO_ALMACEN.MERMA,
    cantidad: 5,
    observacion: "Daño detectado en conteo físico",
    usuario
  });

  expect(
    esMovimientoAjusteAutorizado(
      TIPOS_MOVIMIENTO_ALMACEN.MERMA
    )
  ).toBe(true);
  expect(
    obtenerOrigenMovimientoAlmacen(
      TIPOS_MOVIMIENTO_ALMACEN.MERMA
    )
  ).toBe("ajuste_autorizado");
  expect(sinMotivo).toMatchObject({
    autorizacion_tipo: "ajuste_autorizado",
    autorizado_por_id: "user-1"
  });
  expect(
    validarMovimientoAlmacen(
      sinMotivo,
      {
        stock_actual: 20,
        stock_reservado: 0
      }
    )
  ).toContain(
    "Indica el motivo del ajuste o merma."
  );
  expect(
    validarMovimientoAlmacen(
      conMotivo,
      {
        stock_actual: 20,
        stock_reservado: 0
      }
    )
  ).toEqual([]);
  expect(
    calcularStockTrasMovimiento(
      {
        stock_actual: 20,
        stock_reservado: 0
      },
      conMotivo
    )
  ).toEqual({
    stock_actual: 15,
    stock_reservado: 0,
    stock_disponible: 15
  });
});

test("conteo fisico calcula diferencia y exige motivo si ajusta", () => {
  const cuadrado = prepararConteoFisico({
    empresaId: "bba",
    plantaId: "chile",
    material,
    stockSistema: 100,
    stockReservado: 20,
    cantidadContada: 100,
    usuario
  });
  const conDiferencia = prepararConteoFisico({
    empresaId: "bba",
    plantaId: "chile",
    material,
    stockSistema: 100,
    stockReservado: 20,
    cantidadContada: 95,
    usuario
  });
  const conMotivo = prepararConteoFisico({
    empresaId: "bba",
    plantaId: "chile",
    material,
    stockSistema: 100,
    stockReservado: 20,
    cantidadContada: 95,
    observacion: "Diferencia por inventario cíclico",
    usuario
  });

  expect(cuadrado).toMatchObject({
    stock_sistema: 100,
    stock_contado: 100,
    diferencia: 0,
    estado: "cuadrado"
  });
  expect(validarConteoFisico(cuadrado))
    .toEqual([]);
  expect(conDiferencia).toMatchObject({
    diferencia: -5,
    estado: "ajustado"
  });
  expect(
    validarConteoFisico(conDiferencia)
  ).toContain(
    "Indica el motivo de la diferencia del conteo físico."
  );
  expect(validarConteoFisico(conMotivo))
    .toEqual([]);
});

test("conteo fisico bloquea ajustes bajo stock reservado", () => {
  const conteo = prepararConteoFisico({
    empresaId: "bba",
    plantaId: "chile",
    material,
    stockSistema: 100,
    stockReservado: 30,
    cantidadContada: 20,
    observacion: "Conteo menor al reservado",
    usuario
  });

  expect(
    validarConteoFisico(conteo)
  ).toContain(
    "El conteo no puede quedar bajo el stock reservado (30). Libera reservas antes de ajustar."
  );
});

test("valida politica de stock y calcula alertas de reposicion", () => {
  const politicaInvalida = prepararPoliticaStock({
    empresaId: "bba",
    plantaId: "chile",
    material,
    stockMinimo: 50,
    puntoReposicion: 40,
    stockObjetivo: 100,
    leadTimeDias: 7,
    usuario
  });

  expect(
    validarPoliticaStock(politicaInvalida)
  ).toContain(
    "El punto de reposición no puede ser menor que el stock mínimo."
  );

  const alertas = calcularAlertasStock({
    materiales: [
      material,
      {
        id: "bba__MP0002",
        codigo: "MP0002",
        nombre: "Alambre",
        tipo: "MP",
        unidad_medida: "kg",
        activo: true
      }
    ],
    stocks: [
      {
        material_id: material.id,
        stock_actual: 45,
        stock_reservado: 10,
        stock_minimo: 40,
        punto_reposicion: 60,
        stock_objetivo: 100,
        lead_time_dias: 7
      }
    ]
  });

  expect(alertas[0]).toMatchObject({
    material_codigo: "MP0001",
    stock_disponible: 35,
    estado: "bajo_minimo",
    cantidad_sugerida: 65
  });
  expect(alertas[1]).toMatchObject({
    material_codigo: "MP0002",
    estado: "sin_politica"
  });
});

test("prepara traspaso entre plantas en estado en transito", () => {
  const traspaso = prepararTraspasoAlmacen({
    empresaId: "bba",
    plantaOrigenId: "chile",
    plantaDestinoId: "peru",
    material,
    cantidad: 25,
    referencia: "Guia 123",
    usuario
  });

  expect(traspaso).toMatchObject({
    empresa_id: "bba",
    planta_id: "chile",
    planta_origen_id: "chile",
    planta_destino_id: "peru",
    material_id: material.id,
    cantidad: 25,
    cantidad_recibida: 0,
    estado:
      ESTADOS_TRASPASO_ALMACEN.EN_TRANSITO,
    creado_por_id: "user-1"
  });
});

test("valida salida de traspaso contra stock disponible", () => {
  const traspaso = prepararTraspasoAlmacen({
    empresaId: "bba",
    plantaOrigenId: "chile",
    plantaDestinoId: "peru",
    material,
    cantidad: 90,
    usuario
  });

  expect(
    validarTraspasoSalida(traspaso, {
      stock_actual: 100,
      stock_reservado: 20
    })
  ).toContain(
    "Stock disponible insuficiente para traspasar. Disponible: 80."
  );
});

test("bloquea traspasos hacia la misma planta", () => {
  const traspaso = prepararTraspasoAlmacen({
    empresaId: "bba",
    plantaOrigenId: "chile",
    plantaDestinoId: "chile",
    material,
    cantidad: 10,
    usuario
  });

  expect(
    validarTraspasoSalida(traspaso, {
      stock_actual: 100,
      stock_reservado: 0
    })
  ).toContain(
    "La planta destino debe ser distinta a la planta origen."
  );
});

test("movimientos de traspaso descuentan origen y suman destino", () => {
  const salida = prepararMovimientoAlmacen({
    empresaId: "bba",
    plantaId: "chile",
    material,
    tipo: TIPOS_MOVIMIENTO_ALMACEN
      .TRASPASO_SALIDA,
    cantidad: 30,
    usuario
  });
  const recepcion = prepararMovimientoAlmacen({
    empresaId: "bba",
    plantaId: "peru",
    material,
    tipo: TIPOS_MOVIMIENTO_ALMACEN
      .TRASPASO_RECEPCION,
    cantidad: 30,
    usuario
  });

  expect(
    calcularStockTrasMovimiento(
      {
        stock_actual: 100,
        stock_reservado: 20
      },
      salida
    )
  ).toEqual({
    stock_actual: 70,
    stock_reservado: 20,
    stock_disponible: 50
  });
  expect(
    calcularStockTrasMovimiento(
      {
        stock_actual: 5,
        stock_reservado: 0
      },
      recepcion
    )
  ).toEqual({
    stock_actual: 35,
    stock_reservado: 0,
    stock_disponible: 35
  });
});

test("agrupa requerimientos de materiales por OT y calcula brecha", () => {
  const requerimientos =
    calcularRequerimientosMaterialesOT(
      [
        {
          id: "op-1",
          operacion_codigo: "DT0001",
          cantidad_pendiente: 10,
          materiales_entrada: [
            {
              material_id: "mat-1",
              material_codigo: "MP0001",
              material_nombre: "Tubo",
              cantidad: 4
            }
          ]
        },
        {
          id: "op-2",
          operacion_codigo: "DT0002",
          cantidad_requerida: 5,
          materiales_entrada: [
            {
              material_id: "mat-1",
              material_codigo: "MP0001",
              material_nombre: "Tubo",
              cantidad: 2
            }
          ]
        }
      ],
      [
        {
          material_id: "mat-1",
          stock_actual: 45,
          stock_reservado: 10
        }
      ]
    );

  expect(requerimientos).toHaveLength(1);
  expect(
    requerimientos[0].cantidad_requerida
  ).toBe(50);
  expect(
    requerimientos[0].stock_disponible
  ).toBe(35);
  expect(requerimientos[0].brecha).toBe(15);
  expect(
    requerimientos[0].operaciones.map(
      operacion => operacion.operacion_codigo
    )
  ).toEqual(["DT0001", "DT0002"]);
});

test("separa MP por stock y RF por flujo productivo", () => {
  const disponibilidad =
    calcularDisponibilidadOT(
      [
        {
          id: "corte",
          operacion_codigo: "DT0001",
          material_entrada_id: "mp-1",
          materiales_entrada: [
            {
              material_id: "mp-1",
              material_codigo: "MP0001",
              material_nombre: "Tubo",
              cantidad: 1
            }
          ],
          material_salida_id: "rf-1",
          cantidad_pendiente: 1000,
          cantidad_ok: 100,
          avance_pct: 10
        },
        {
          id: "doblez",
          operacion_codigo: "DT0002",
          material_entrada_id: "rf-1",
          materiales_entrada: [
            {
              material_id: "rf-1",
              material_codigo: "RF0001",
              material_nombre: "Tubo cortado",
              cantidad: 1
            }
          ],
          material_salida_id: "rf-2",
          cantidad_pendiente: 5000,
          cantidad_consumida: 0
        }
      ],
      [
        {
          material_id: "mp-1",
          stock_actual: 500,
          stock_reservado: 100
        }
      ]
    );

  const mp = disponibilidad.find(
    item => item.material_codigo === "MP0001"
  );
  const rf = disponibilidad.find(
    item => item.material_codigo === "RF0001"
  );

  expect(mp.estado).toBe("falta_mp");
  expect(mp.brecha).toBe(600);
  expect(rf.estado).toBe("rf_disponible");
  expect(rf.disponible_flujo).toBe(100);
  expect(rf.brecha).toBe(5000);
});

test("RF queda en flujo aunque no haya disponibilidad inicial", () => {
  const disponibilidad =
    calcularDisponibilidadOT(
      [
        {
          id: "corte",
          operacion_codigo: "DT0001",
          material_salida_id: "rf-1",
          cantidad_ok: 0,
          cantidad_pendiente: 5000
        },
        {
          id: "doblez",
          operacion_codigo: "DT0002",
          material_entrada_id: "rf-1",
          materiales_entrada: [
            {
              material_id: "rf-1",
              material_codigo: "RF0001",
              material_nombre: "Tubo cortado",
              cantidad: 1
            }
          ],
          cantidad_pendiente: 5000
        }
      ],
      []
    );

  expect(disponibilidad[0].estado).toBe(
    "rf_en_flujo"
  );
  expect(
    disponibilidad[0].recomendacion
  ).toContain("balancear ritmo");
});

test("cuadratura OT prioriza bloqueo por MP pendiente", () => {
  const cuadratura =
    calcularCuadraturaAlmacenOT({
      operaciones: [
        {
          id: "corte",
          operacion_codigo: "DT0001",
          materiales_entrada: [
            {
              material_id: "mp-1",
              material_codigo: "MP0001",
              material_nombre: "Tubo",
              cantidad: 2
            }
          ],
          cantidad_pendiente: 100
        }
      ],
      stocks: [
        {
          material_id: "mp-1",
          stock_actual: 120,
          stock_reservado: 20
        }
      ],
      movimientos: [
        {
          material_codigo: "MP0001",
          material_nombre: "Tubo",
          material_tipo: "MP",
          tipo: TIPOS_MOVIMIENTO_ALMACEN
            .RESERVA_OT,
          cantidad: 50
        }
      ]
    });

  expect(cuadratura.estado_general).toBe(
    "bloqueada_por_mp"
  );
  expect(
    cuadratura.totales.mp_pendientes
  ).toBe(1);
  expect(cuadratura.items[0]).toMatchObject({
    material_codigo: "MP0001",
    reservado_neto: 50,
    faltante: 150,
    estado_cuadratura: "mp_pendiente"
  });
  expect(cuadratura.recomendacion).toContain(
    "recibir"
  );
});

test("cuadratura OT recomienda balancear RF en flujo", () => {
  const cuadratura =
    calcularCuadraturaAlmacenOT({
      operaciones: [
        {
          id: "corte",
          operacion_codigo: "DT0001",
          material_salida_id: "rf-1",
          cantidad_ok: 0,
          cantidad_pendiente: 500
        },
        {
          id: "doblez",
          operacion_codigo: "DT0002",
          materiales_entrada: [
            {
              material_id: "rf-1",
              material_codigo: "RF0001",
              material_nombre: "Tubo cortado",
              cantidad: 1
            }
          ],
          cantidad_pendiente: 500
        }
      ],
      stocks: [],
      movimientos: []
    });

  expect(cuadratura.estado_general).toBe(
    "rf_en_flujo"
  );
  expect(
    cuadratura.totales.rf_en_flujo
  ).toBe(1);
  expect(cuadratura.items[0]).toMatchObject({
    material_codigo: "RF0001",
    faltante: 500,
    estado_cuadratura: "rf_en_flujo"
  });
  expect(cuadratura.recomendacion).toContain(
    "balancear"
  );
});
