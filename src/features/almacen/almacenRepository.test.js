import {
  TIPOS_MOVIMIENTO_ALMACEN,
  calcularStockDisponible,
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
