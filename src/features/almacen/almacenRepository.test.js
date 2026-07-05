import {
  TIPOS_MOVIMIENTO_ALMACEN,
  calcularDisponibilidadOT,
  calcularStockDisponible,
  calcularRequerimientosMaterialesOT,
  calcularStockTrasMovimiento,
  prepararMovimientoAlmacen,
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
    "Stock disponible insuficiente. Disponible: 10.",
    "Indica la OT asociada al movimiento."
  ]);
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
