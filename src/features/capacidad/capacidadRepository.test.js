import {
  calcularCapacidadRecursos,
  construirMensajeGuardadoCapacidad,
  evaluarCompletitudCapacidad,
  extraerSubprocesosOperaciones,
  prepararCapacidadProceso,
  reemplazarCapacidad,
  validarCapacidadProceso
} from "./capacidadRepository";

test("limita los recursos paralelos por máquinas y dotación", () => {
  expect(
    calcularCapacidadRecursos({
      maquinasDisponibles: 4,
      operariosDisponibles: 5,
      operariosPorRecurso: 2,
      disponibilidadPct: 90
    })
  ).toEqual({
    maquinas_disponibles: 4,
    operarios_disponibles_turno: 5,
    operarios_por_recurso: 2,
    disponibilidad_pct: 90,
    recursos_paralelos: 2,
    factor_capacidad: 1.8,
    operarios_requeridos_turno: 4
  });
});

test("distingue capacidades faltantes, provisionales y validadas", () => {
  expect(
    evaluarCompletitudCapacidad(
      [
        { subproceso_id: "SP0001" },
        { subproceso_id: "SP0003" },
        { subproceso_id: "SP0005" }
      ],
      [
        {
          id: "cap-1",
          subproceso_id: "SP0001",
          estado_datos: "validada"
        },
        {
          id: "cap-3",
          subproceso_id: "SP0003",
          estado_datos: "provisional"
        }
      ]
    )
  ).toMatchObject({
    total: 3,
    validadas: 1,
    provisionales: 1,
    faltantes: 1,
    completa: false
  });
});

test("deduplica subprocesos de una OT de referencia", () => {
  expect(
    extraerSubprocesosOperaciones([
      {
        proceso_id: "pr0001",
        proceso_nombre: "Corte",
        subproceso_id: "sp0003",
        subproceso_nombre: "Láser"
      },
      {
        proceso_id: "PR0001",
        proceso_nombre: "Corte",
        subproceso_id: "SP0003",
        subproceso_nombre: "Láser"
      },
      {
        proceso_id: "PR0002",
        proceso_nombre: "Doblez",
        subproceso_id: "SP0005",
        subproceso_nombre: "Doblez lata"
      }
    ])
  ).toEqual([
    {
      proceso_id: "PR0001",
      proceso_nombre: "Corte",
      subproceso_id: "SP0003",
      subproceso_nombre: "Láser"
    },
    {
      proceso_id: "PR0002",
      proceso_nombre: "Doblez",
      subproceso_id: "SP0005",
      subproceso_nombre: "Doblez lata"
    }
  ]);
});

test("prepara una capacidad identificada por subproceso", () => {
  const capacidad = prepararCapacidadProceso({
    empresaId: "bba",
    plantaId: "chile",
    perfil: {
      uid: "jefe-1",
      nombre: "Jefe Chile"
    },
    datos: {
      proceso_id: " pr0001 ",
      proceso_nombre: "Corte",
      subproceso_id: " sp0003 ",
      subproceso_nombre: "Láser fibra tubo",
      maquinas_disponibles: 2,
      operarios_disponibles_turno: 2,
      operarios_por_recurso: 1,
      disponibilidad_pct: 85,
      datos_validados: true
    }
  });

  expect(capacidad.subproceso_id).toBe("SP0003");
  expect(capacidad.recursos_paralelos).toBe(2);
  expect(capacidad.factor_capacidad).toBe(1.7);
});

test("rechaza una disponibilidad o dotación inválida", () => {
  const errores = validarCapacidadProceso({
    planta_id: "peru",
    proceso_id: "PR0001",
    subproceso_id: "SP0001",
    subproceso_nombre: "Prensa",
    maquinas_disponibles: 0,
    operarios_disponibles_turno: 2,
    operarios_por_recurso: 1,
    disponibilidad_pct: 120,
    motivo: "Ajuste de capacidad inicial",
    datos_validados: true
  });

  expect(errores).toHaveLength(2);
});

test("exige motivo trazable para cambiar capacidad", () => {
  expect(
    validarCapacidadProceso({
      planta_id: "chile",
      proceso_id: "PR0001",
      subproceso_id: "SP0001",
      subproceso_nombre: "Prensa",
      maquinas_disponibles: 1,
      operarios_disponibles_turno: 1,
      operarios_por_recurso: 1,
      disponibilidad_pct: 100,
      motivo: "cambio",
      datos_validados: true
    })
  ).toContain(
    "Indica un motivo de al menos 10 caracteres."
  );
});

test("permite guardar una capacidad como provisional", () => {
  const capacidad = prepararCapacidadProceso({
    empresaId: "bba",
    plantaId: "chile",
    perfil: {
      uid: "jefe-1",
      nombre: "Jefe Chile"
    },
    datos: {
      proceso_id: "PR0001",
      proceso_nombre: "Corte",
      subproceso_id: "SP0001",
      subproceso_nombre: "Prensa",
      maquinas_disponibles: 1,
      operarios_disponibles_turno: 1,
      operarios_por_recurso: 1,
      disponibilidad_pct: 100,
      datos_validados: false
    }
  });

  expect(capacidad.estado_datos)
    .toBe("provisional");
});

test("reemplaza una capacidad guardada sin duplicar subproceso", () => {
  expect(
    reemplazarCapacidad(
      [
        {
          id: "cap-anterior",
          subproceso_id: "SP0001",
          estado_datos: "provisional"
        },
        {
          id: "cap-2",
          subproceso_id: "SP0002",
          estado_datos: "validada"
        }
      ],
      {
        id: "cap-nueva",
        subproceso_id: "SP0001",
        estado_datos: "validada"
      }
    )
  ).toEqual([
    {
      id: "cap-nueva",
      subproceso_id: "SP0001",
      estado_datos: "validada"
    },
    {
      id: "cap-2",
      subproceso_id: "SP0002",
      estado_datos: "validada"
    }
  ]);
});

test("indica volver al planificador cuando la OT queda completa", () => {
  const mensaje =
    construirMensajeGuardadoCapacidad({
      capacidad: {
        estado_datos: "validada"
      },
      completitud: {
        total: 2,
        validadas: 2,
        provisionales: 0,
        faltantes: 0,
        completa: true
      }
    });

  expect(mensaje).toContain(
    "todas sus capacidades validadas"
  );
  expect(mensaje).toContain("Planificador");
});

test("advierte pendientes cuando la capacidad queda provisional", () => {
  expect(
    construirMensajeGuardadoCapacidad({
      capacidad: {
        estado_datos: "provisional"
      },
      completitud: {
        total: 3,
        validadas: 1,
        provisionales: 1,
        faltantes: 1,
        completa: false
      }
    })
  ).toContain(
    "1 provisionales y 1 faltantes"
  );
});
