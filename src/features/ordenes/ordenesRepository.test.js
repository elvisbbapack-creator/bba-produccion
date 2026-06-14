import {
  CALENDARIOS_PLANTA,
  horasSemanalesCalendario,
  horasSemanalesTercerTurno,
  calcularProyeccionOT,
  formatearCodigoOT,
  prepararOrden,
  simularTurnosOT,
  sumarHorasEnCalendario,
  validarDatosOrden
} from "./ordenesRepository";

test("amplía solo el cuello de botella a tres turnos", () => {
  const simulacion = simularTurnosOT(
    [
      {
        id: "DT0001",
        operacion_codigo: "DT0001",
        operacion_nombre: "Corte",
        subproceso_id: "SP0001",
        cantidad_pendiente: 1600,
        unidades_por_hora: 100
      },
      {
        id: "DT0005",
        operacion_codigo: "DT0005",
        operacion_nombre: "Láser",
        subproceso_id: "SP0003",
        cantidad_pendiente: 2400,
        unidades_por_hora: 100
      }
    ],
    {
      plantaId: "peru",
      horasTercerTurno: 8,
      fechaReferencia:
        new Date("2026-06-15T06:00:00"),
      capacidades: [
        {
          subproceso_id: "SP0001",
          estado_datos: "validada"
        },
        {
          subproceso_id: "SP0003",
          estado_datos: "validada"
        }
      ]
    }
  );

  expect(
    simulacion.cuello_botella.codigo
  ).toBe("DT0005");
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
  ).toBe(8);
  expect(simulacion.recomienda_ampliar).toBe(true);
});

test("calcula la carga con recursos paralelos por subproceso", () => {
  const simulacion = simularTurnosOT(
    [
      {
        id: "DT0005",
        operacion_codigo: "DT0005",
        operacion_nombre: "Láser",
        subproceso_id: "SP0003",
        cantidad_pendiente: 360,
        unidades_por_hora: 100
      }
    ],
    {
      plantaId: "peru",
      fechaReferencia:
        new Date("2026-06-15T06:00:00"),
      capacidades: [
        {
          subproceso_id: "SP0003",
          maquinas_disponibles: 3,
          operarios_disponibles_turno: 4,
          operarios_por_recurso: 2,
          disponibilidad_pct: 90,
          estado_datos: "validada",
          activo: true
        }
      ]
    }
  );
  const carga = simulacion.operaciones[0];

  expect(carga.recursos_paralelos).toBe(2);
  expect(carga.unidades_por_hora_efectivas)
    .toBe(180);
  expect(carga.horas_trabajo).toBe(2);
  expect(carga.operarios_requeridos_turno)
    .toBe(4);
  expect(carga.capacidad_configurada).toBe(true);
});

test("usa dotación calificada y bloquea tercer turno sin cobertura", () => {
  const simulacion = simularTurnosOT(
    [
      {
        id: "DT0005",
        operacion_codigo: "DT0005",
        operacion_nombre: "Láser",
        subproceso_id: "SP0003",
        cantidad_pendiente: 360,
        unidades_por_hora: 100
      }
    ],
    {
      plantaId: "peru",
      fechaReferencia:
        new Date("2026-06-15T06:00:00"),
      capacidades: [
        {
          subproceso_id: "SP0003",
          maquinas_disponibles: 3,
          operarios_disponibles_turno: 4,
          operarios_por_recurso: 1,
          disponibilidad_pct: 100
        }
      ],
      programacionTurnos: [
        {
          turno_id: "manana",
          subprocesos_habilitados: ["SP0003"]
        },
        {
          turno_id: "tarde",
          subprocesos_habilitados: ["SP0003"]
        }
      ]
    }
  );
  const carga = simulacion.operaciones[0];

  expect(carga.dotacion_programada_aplicada)
    .toBe(true);
  expect(carga.recursos_paralelos).toBe(1);
  expect(carga.operarios_requeridos_turno)
    .toBe(3);
  expect(carga.brechas_dotacion).toMatchObject({
    faltantes_manana: 2,
    faltantes_tarde: 2,
    faltantes_noche: 3,
    cobertura_base_suficiente: false
  });
  expect(carga.cobertura_programada.noche).toBe(0);
  expect(carga.tercer_turno_con_dotacion)
    .toBe(false);
  expect(carga.turnos_escenario).toBe(2);
  expect(simulacion.recomienda_ampliar).toBe(false);
});

test("no recomienda noche si falta un turno base calificado", () => {
  const simulacion = simularTurnosOT(
    [
      {
        id: "DT0005",
        operacion_codigo: "DT0005",
        subproceso_id: "SP0003",
        cantidad_pendiente: 800,
        unidades_por_hora: 100
      }
    ],
    {
      plantaId: "peru",
      fechaReferencia:
        new Date("2026-06-15T06:00:00"),
      programacionTurnos: [
        {
          turno_id: "manana",
          subprocesos_habilitados: ["SP0003"]
        },
        {
          turno_id: "noche",
          subprocesos_habilitados: ["SP0003"]
        }
      ]
    }
  );

  expect(
    simulacion.cuello_botella
      .cobertura_programada
      .turnos_base_completos
  ).toBe(false);
  expect(
    simulacion.cuello_botella
      .tercer_turno_con_dotacion
  ).toBe(false);
  expect(simulacion.recomienda_ampliar).toBe(false);
});

test("no recomienda turnos con capacidad provisional", () => {
  const simulacion = simularTurnosOT(
    [
      {
        id: "DT0005",
        operacion_codigo: "DT0005",
        subproceso_id: "SP0003",
        cantidad_pendiente: 800,
        unidades_por_hora: 100
      }
    ],
    {
      plantaId: "peru",
      fechaReferencia:
        new Date("2026-06-15T06:00:00"),
      capacidades: [
        {
          subproceso_id: "SP0003",
          estado_datos: "provisional"
        }
      ]
    }
  );

  expect(
    simulacion.cuello_botella
      .capacidad_configurada
  ).toBe(true);
  expect(
    simulacion.cuello_botella
      .capacidad_validada
  ).toBe(false);
  expect(simulacion.recomienda_ampliar).toBe(false);
});

test("usa los calendarios semanales de Chile y Perú", () => {
  expect(CALENDARIOS_PLANTA.chile.turnos_rotativos)
    .toBe(true);
  expect(CALENDARIOS_PLANTA.peru.turnos_rotativos)
    .toBe(true);
  expect(horasSemanalesCalendario("chile"))
    .toBe(83.25);
  expect(horasSemanalesCalendario("peru"))
    .toBe(96);
  expect(horasSemanalesTercerTurno("chile"))
    .toBe(51.75);
  expect(horasSemanalesTercerTurno("peru"))
    .toBe(48);

  expect(
    sumarHorasEnCalendario({
      fechaReferencia:
        new Date("2026-06-13T20:00:00"),
      horasTrabajo: 4,
      plantaId: "chile"
    }).toISOString()
  ).toBe(
    new Date("2026-06-15T10:15:00")
      .toISOString()
  );

  expect(
    sumarHorasEnCalendario({
      fechaReferencia:
        new Date("2026-06-15T21:00:00"),
      horasTrabajo: 3,
      plantaId: "peru",
      horasTercerTurno: 8
    }).toISOString()
  ).toBe(
    new Date("2026-06-16T00:00:00")
      .toISOString()
  );

  expect(
    sumarHorasEnCalendario({
      fechaReferencia:
        new Date("2026-06-15T21:30:00"),
      horasTrabajo: 8.5,
      plantaId: "peru",
      horasTercerTurno: 4
    }).toISOString()
  ).toBe(
    new Date("2026-06-16T06:00:00")
      .toISOString()
  );

  expect(
    sumarHorasEnCalendario({
      fechaReferencia:
        new Date("2026-06-18T21:00:00"),
      horasTrabajo: 9.25,
      plantaId: "chile",
      horasTercerTurno: 8
    }).toISOString()
  ).toBe(
    new Date("2026-06-19T06:30:00")
      .toISOString()
  );
});

test("proyecta la OT usando la operación más larga", () => {
  const referencia = new Date(
    "2026-06-13T10:00:00Z"
  );
  const proyeccion = calcularProyeccionOT(
    [
      {
        id: "DT0001",
        operacion_codigo: "DT0001",
        operacion_nombre: "Corte",
        subproceso_id: "SP0001",
        cantidad_requerida: 400,
        cantidad_ok: 120,
        cantidad_pendiente: 280,
        unidades_por_hora: 140
      },
      {
        id: "DT0005",
        operacion_codigo: "DT0005",
        operacion_nombre: "Láser",
        subproceso_id: "SP0003",
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
    estimado_horas_restantes: 4,
    cuello_carga: {
      operacion_id: "DT0005",
      operacion_codigo: "DT0005",
      subproceso_id: "SP0003",
      cantidad_pendiente: 320,
      horas_restantes: 4,
      pendiente_estandar: false
    }
  });
  expect(
    proyeccion.fecha_estimada_fin.toISOString()
  ).toBe("2026-06-13T14:00:00.000Z");
});

test("no inventa una proyección cuando falta estándar", () => {
  const proyeccion = calcularProyeccionOT([
    {
      cantidad_requerida: 100,
      cantidad_ok: 0,
      cantidad_pendiente: 100,
      unidades_por_hora: 0
    }
  ]);

  expect(
    proyeccion.estimado_horas_restantes
  ).toBeNull();
  expect(
    proyeccion.fecha_estimada_fin
  ).toBeNull();
  expect(
    proyeccion.cuello_carga
      .pendiente_estandar
  ).toBe(true);
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
