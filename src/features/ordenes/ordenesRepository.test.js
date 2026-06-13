import {
  calcularProyeccionOT,
  formatearCodigoOT,
  prepararOrden,
  simularTurnosOT,
  validarDatosOrden
} from "./ordenesRepository";

test("amplía solo el cuello de botella a tres turnos", () => {
  const simulacion = simularTurnosOT(
    [
      {
        id: "DT0001",
        operacion_codigo: "DT0001",
        operacion_nombre: "Corte",
        cantidad_pendiente: 1600,
        unidades_por_hora: 100
      },
      {
        id: "DT0005",
        operacion_codigo: "DT0005",
        operacion_nombre: "Láser",
        cantidad_pendiente: 2400,
        unidades_por_hora: 100
      }
    ],
    {
      turnosBase: 2,
      turnosCuello: 3,
      horasPorTurno: 8,
      fechaReferencia:
        new Date("2026-06-13T00:00:00Z")
    }
  );

  expect(
    simulacion.cuello_botella.codigo
  ).toBe("DT0005");
  expect(simulacion.dias_base).toBe(1.5);
  expect(simulacion.dias_escenario).toBe(1);
  expect(
    simulacion.operaciones.find(
      item => item.codigo === "DT0001"
    ).turnos_escenario
  ).toBe(2);
  expect(
    simulacion.operaciones.find(
      item => item.codigo === "DT0005"
    ).turnos_escenario
  ).toBe(3);
  expect(
    simulacion.ahorro_horas_calendario
  ).toBe(12);
  expect(simulacion.recomienda_ampliar).toBe(true);
});

test("proyecta la OT usando la operación más larga", () => {
  const referencia = new Date(
    "2026-06-13T10:00:00Z"
  );
  const proyeccion = calcularProyeccionOT(
    [
      {
        cantidad_requerida: 400,
        cantidad_ok: 120,
        cantidad_pendiente: 280,
        unidades_por_hora: 140
      },
      {
        cantidad_requerida: 400,
        cantidad_ok: 80,
        cantidad_pendiente: 320,
        unidades_por_hora: 80
      }
    ],
    referencia
  );

  expect(proyeccion).toMatchObject({
    cantidad_total_requerida: 800,
    cantidad_total_ok: 200,
    cantidad_total_pendiente: 600,
    avance_pct: 25,
    estimado_horas_restantes: 4
  });
  expect(
    proyeccion.fecha_estimada_fin.toISOString()
  ).toBe("2026-06-13T14:00:00.000Z");
});

test("genera un correlativo legible por planta", () => {
  expect(
    formatearCodigoOT("chile", 12)
  ).toBe("OT-CHI-000012");
  expect(
    formatearCodigoOT("peru", 3)
  ).toBe("OT-PER-000003");
});

test("prepara una OT V2 liberada", () => {
  const orden = prepararOrden({
    codigo: "OT-CHI-000001",
    correlativo: 1,
    empresaId: "bba",
    plantaId: "chile",
    clienteNombre: "Cliente Demo",
    producto: {
      id: "producto-1",
      codigo: "PCL0001",
      nombre: "Modular",
      version_ruta_activa: 1
    },
    cantidadProducto: "100",
    fechaInicio: "2026-06-15",
    fechaEntrega: "2026-06-20",
    perfil: {
      uid: "usuario-1",
      nombre: "Jefe Chile"
    }
  });

  expect(orden).toMatchObject({
    codigo: "OT-CHI-000001",
    planta_id: "chile",
    producto_codigo: "PCL0001",
    ruta_version: 1,
    cantidad_producto: 100,
    estado: "liberada",
    cantidad_total_pendiente: 0,
    modelo_version: 2
  });
});

test("valida producto publicado, cantidad y fechas", () => {
  expect(
    validarDatosOrden({
      plantaId: "",
      clienteNombre: "",
      producto: {
        version_ruta_activa: null
      },
      cantidadProducto: 0,
      fechaInicio: "2026-06-20",
      fechaEntrega: "2026-06-15"
    })
  ).toEqual([
    "Selecciona una planta.",
    "La OT requiere cliente.",
    "Selecciona un producto con ruta publicada.",
    "La cantidad debe ser mayor que cero.",
    "La fecha de entrega no puede ser anterior al inicio."
  ]);
});
