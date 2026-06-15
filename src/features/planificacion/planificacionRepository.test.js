import {
  calcularImpactoDecisionPlanificador,
  construirDecisionTurno,
  construirPlanPrioridades,
  construirAprendizajeDecisionesPlanificador,
  construirResumenPlanificador,
  construirRegistroDecisionPlanificador,
  filtrarPlanPrioridades
} from "./planificacionRepository";

test("agrupa OTs por subproceso y prioriza riesgo y entrega", () => {
  const plan = construirPlanPrioridades(
    [
      {
        id: "ot-1",
        codigo: "OT-CHI-000001",
        correlativo: 1,
        fecha_planificada_entrega:
          "2026-06-20T18:00:00Z",
        fecha_estimada_fin:
          "2026-06-19T18:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0003",
          operacion_codigo: "DT0005",
          cantidad_pendiente: 300,
          horas_restantes: 3,
          estado: "disponible"
        }
      },
      {
        id: "ot-2",
        codigo: "OT-CHI-000002",
        correlativo: 2,
        fecha_planificada_entrega:
          "2026-06-16T18:00:00Z",
        fecha_estimada_fin:
          "2026-06-18T18:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0003",
          operacion_codigo: "DT0010",
          cantidad_pendiente: 500,
          horas_restantes: 5,
          estado: "en_proceso"
        }
      }
    ],
    new Date("2026-06-15T12:00:00Z")
  );

  expect(plan).toHaveLength(1);
  expect(plan[0]).toMatchObject({
    subproceso_id: "SP0003",
    ots_compitiendo: 2,
    cantidad_total_pendiente: 800,
    horas_carga_compartida: 8,
    conflicto_capacidad: true
  });
  expect(
    plan[0].secuencia.map(orden => orden.id)
  ).toEqual(["ot-2", "ot-1"]);
});

test("sugiere mantener 2 turnos cuando la carga cabe en capacidad base", () => {
  const plan = construirPlanPrioridades(
    [
      {
        id: "ot-1",
        codigo: "OT-CHI-000001",
        correlativo: 1,
        cuello_carga: {
          subproceso_id: "SP0003",
          cantidad_pendiente: 320,
          horas_restantes: 4,
          estado: "disponible"
        }
      }
    ],
    new Date("2026-06-15T12:00:00Z"),
    {
      plantaId: "chile",
      capacidades: [
        {
          subproceso_id: "SP0003",
          estado_datos: "validada",
          factor_capacidad: 1,
          operarios_requeridos_turno: 1
        }
      ],
      programacion: [
        {
          turno_id: "manana",
          operario_codigo: "OP001",
          subprocesos_habilitados: ["SP0003"]
        },
        {
          turno_id: "tarde",
          operario_codigo: "OP002",
          subprocesos_habilitados: ["SP0003"]
        }
      ]
    }
  );

  expect(plan[0].decision_turno).toMatchObject({
    tipo: "mantener_2_turnos",
    horas_base_semana: 83.25,
    horas_3_turnos_semana: 135
  });
  expect(plan[0].capacidad_estado).toMatchObject({
    estado: "validada",
    titulo: "Capacidad validada",
    bloquea_recomendacion: false,
    factor_capacidad: 1,
    operarios_requeridos_turno: 1
  });
});

test("no usa capacidad provisional para decidir turnos", () => {
  const plan = construirPlanPrioridades(
    [
      {
        id: "ot-1",
        codigo: "OT-CHI-000001",
        correlativo: 1,
        cuello_carga: {
          subproceso_id: "SP0003",
          cantidad_pendiente: 320,
          horas_restantes: 4,
          estado: "disponible"
        }
      }
    ],
    new Date("2026-06-15T12:00:00Z"),
    {
      plantaId: "chile",
      capacidades: [
        {
          subproceso_id: "SP0003",
          estado_datos: "provisional",
          factor_capacidad: 1,
          operarios_requeridos_turno: 1
        }
      ],
      programacion: [
        {
          turno_id: "manana",
          operario_codigo: "OP001",
          subprocesos_habilitados: ["SP0003"]
        },
        {
          turno_id: "tarde",
          operario_codigo: "OP002",
          subprocesos_habilitados: ["SP0003"]
        }
      ]
    }
  );

  expect(plan[0].decision_turno.tipo)
    .toBe("configurar_capacidad");
  expect(plan[0].capacidad_estado).toMatchObject({
    estado: "provisional",
    titulo: "Capacidad provisional",
    bloquea_recomendacion: true,
    factor_capacidad: 1,
    operarios_requeridos_turno: 1
  });
  expect(plan[0].capacidad_estado.detalle)
    .toContain("falta verificacion");
});

test("sugiere activar 3er turno cuando la carga excede 2 turnos y noche esta cubierta", () => {
  const decision = construirDecisionTurno({
    plantaId: "peru",
    grupo: {
      subproceso_id: "SP0005",
      horas_carga_compartida: 120
    },
    capacidad: {
      factor_capacidad: 1,
      operarios_requeridos_turno: 1
    },
    programacion: [
      {
        turno_id: "manana",
        operario_codigo: "OP001",
        subprocesos_habilitados: ["SP0005"]
      },
      {
        turno_id: "tarde",
        operario_codigo: "OP002",
        subprocesos_habilitados: ["SP0005"]
      },
      {
        turno_id: "noche",
        operario_codigo: "OP003",
        subprocesos_habilitados: ["SP0005"]
      }
    ]
  });

  expect(decision).toMatchObject({
    tipo: "activar_3_turno",
    horas_base_semana: 96,
    horas_noche_semana: 48,
    horas_3_turnos_semana: 144,
    horas_faltantes_2_turnos: 24,
    horas_faltantes_3_turnos: 0,
    semanas_2_turnos: 1.25,
    semanas_3_turnos: 0.83,
    ahorro_semanas_con_noche: 0.42,
    dias_estimados_2_turnos: 9,
    dias_estimados_3_turnos: 6,
    ahorro_dias_con_noche: 3,
    escenarios: {
      base: {
        titulo: "2 turnos",
        horas_semana: 96,
        dias_estimados: 9,
        horas_faltantes: 24
      },
      ampliado: {
        titulo: "3 turnos",
        horas_semana: 144,
        dias_estimados: 6,
        horas_faltantes: 0
      }
    },
    impacto_3_turno: {
      horas_adicionales_semana: 48,
      horas_recuperables: 24,
      ahorro_dias: 3,
      dotacion_noche_cubierta: true
    },
    dotacion: {
      requerida_por_turno: 1,
      manana: 1,
      tarde: 1,
      noche: 1,
      faltantes_base: 0,
      faltantes_noche: 0
    }
  });
  expect(decision.accion_operativa)
    .toContain("Activar noche");
});

test("pide preparar dotacion si el 3er turno ayuda pero no tiene operarios", () => {
  const decision = construirDecisionTurno({
    plantaId: "peru",
    grupo: {
      subproceso_id: "SP0005",
      horas_carga_compartida: 120
    },
    capacidad: {
      factor_capacidad: 1,
      operarios_requeridos_turno: 1
    },
    programacion: [
      {
        turno_id: "manana",
        operario_codigo: "OP001",
        subprocesos_habilitados: ["SP0005"]
      },
      {
        turno_id: "tarde",
        operario_codigo: "OP002",
        subprocesos_habilitados: ["SP0005"]
      }
    ]
  });

  expect(decision.tipo).toBe("preparar_3_turno");
  expect(decision.turno_sugerido).toBe("noche");
});

test("advierte cuando falta capacidad configurada", () => {
  expect(
    construirDecisionTurno({
      plantaId: "chile",
      grupo: {
        subproceso_id: "SP0001",
        horas_carga_compartida: 10
      }
    })
  ).toMatchObject({
    tipo: "configurar_capacidad"
  });
});

test("marca capacidad faltante en el plan cuando no existe configuracion", () => {
  const plan = construirPlanPrioridades(
    [
      {
        id: "ot-1",
        codigo: "OT-CHI-000001",
        correlativo: 1,
        cuello_carga: {
          subproceso_id: "SP0009",
          cantidad_pendiente: 100,
          horas_restantes: 2,
          estado: "disponible"
        }
      }
    ],
    new Date("2026-06-15T12:00:00Z"),
    {
      plantaId: "chile",
      capacidades: []
    }
  );

  expect(plan[0].capacidad_estado).toMatchObject({
    estado: "faltante",
    titulo: "Capacidad faltante",
    bloquea_recomendacion: true
  });
  expect(plan[0].decision_turno.tipo)
    .toBe("configurar_capacidad");
});

test("sugiere el turno base con mayor brecha de dotacion", () => {
  const decision = construirDecisionTurno({
    plantaId: "chile",
    grupo: {
      subproceso_id: "SP0007",
      horas_carga_compartida: 20
    },
    capacidad: {
      factor_capacidad: 1,
      operarios_requeridos_turno: 2
    },
    programacion: [
      {
        turno_id: "manana",
        operario_codigo: "OP001",
        subprocesos_habilitados: ["SP0007"]
      },
      {
        turno_id: "tarde",
        operario_codigo: "OP002",
        subprocesos_habilitados: ["SP0007"]
      },
      {
        turno_id: "tarde",
        operario_codigo: "OP003",
        subprocesos_habilitados: ["SP0007"]
      }
    ]
  });

  expect(decision).toMatchObject({
    tipo: "cubrir_dotacion_base",
    turno_sugerido: "manana"
  });
});

test("prioriza un DT disponible antes que uno bloqueado", () => {
  const plan = construirPlanPrioridades(
    [
      {
        id: "bloqueada",
        correlativo: 2,
        fecha_planificada_entrega:
          "2026-06-15T08:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0001",
          cantidad_pendiente: 100,
          estado: "bloqueada"
        }
      },
      {
        id: "disponible",
        correlativo: 1,
        fecha_planificada_entrega:
          "2026-06-20T08:00:00Z",
        cuello_carga: {
          subproceso_id: "SP0001",
          cantidad_pendiente: 100,
          estado: "disponible"
        }
      }
    ],
    new Date("2026-06-16T08:00:00Z")
  );

  expect(plan[0].siguiente_ot.id)
    .toBe("disponible");
  expect(
    plan[0].secuencia[1].accion_recomendada
  ).toBe("desbloquear_dt");
});

test("excluye OTs sin resumen de cuello pendiente", () => {
  expect(
    construirPlanPrioridades([
      {
        id: "sin-cuello",
        cantidad_total_pendiente: 100
      }
    ])
  ).toEqual([]);
});

test("resume estados ejecutivos del planificador", () => {
  const resumen = construirResumenPlanificador([
    {
      ots_compitiendo: 2,
      cantidad_total_pendiente: 300,
      horas_carga_compartida: 4.5,
      capacidad_estado: {
        estado: "faltante"
      },
      decision_turno: {
        tipo: "configurar_capacidad"
      }
    },
    {
      ots_compitiendo: 1,
      cantidad_total_pendiente: 100,
      horas_carga_compartida: 2,
      capacidad_estado: {
        estado: "provisional"
      },
      decision_turno: {
        tipo: "configurar_capacidad"
      }
    },
    {
      ots_compitiendo: 1,
      cantidad_total_pendiente: 80,
      horas_carga_compartida: 1.25,
      capacidad_estado: {
        estado: "validada"
      },
      decision_turno: {
        tipo: "cubrir_dotacion_base"
      }
    },
    {
      ots_compitiendo: 1,
      cantidad_total_pendiente: 50,
      horas_carga_compartida: 1,
      capacidad_estado: {
        estado: "validada"
      },
      decision_turno: {
        tipo: "activar_3_turno"
      }
    }
  ]);

  expect(resumen).toEqual({
    subprocesos_total: 4,
    ots_compitiendo_total: 5,
    unidades_pendientes_total: 530,
    horas_carga_total: 8.75,
    capacidad_faltante: 1,
    capacidad_provisional: 1,
    capacidad_validada: 2,
    recomendaciones_accionables: 2,
    bloqueados_dotacion: 1,
    bloqueados_capacidad: 2
  });
});

test("filtra plan por capacidad y acciones operativas", () => {
  const plan = [
    {
      subproceso_id: "SP0001",
      capacidad_estado: {
        estado: "faltante"
      },
      decision_turno: {
        tipo: "configurar_capacidad"
      }
    },
    {
      subproceso_id: "SP0002",
      capacidad_estado: {
        estado: "provisional"
      },
      decision_turno: {
        tipo: "configurar_capacidad"
      }
    },
    {
      subproceso_id: "SP0003",
      capacidad_estado: {
        estado: "validada"
      },
      decision_turno: {
        tipo: "activar_3_turno"
      }
    },
    {
      subproceso_id: "SP0004",
      capacidad_estado: {
        estado: "validada"
      },
      decision_turno: {
        tipo: "cubrir_dotacion_base"
      }
    }
  ];

  expect(
    filtrarPlanPrioridades(
      plan,
      "capacidad_faltante"
    ).map(grupo => grupo.subproceso_id)
  ).toEqual(["SP0001"]);
  expect(
    filtrarPlanPrioridades(
      plan,
      "capacidad_provisional"
    ).map(grupo => grupo.subproceso_id)
  ).toEqual(["SP0002"]);
  expect(
    filtrarPlanPrioridades(
      plan,
      "capacidad_validada"
    ).map(grupo => grupo.subproceso_id)
  ).toEqual(["SP0003", "SP0004"]);
  expect(
    filtrarPlanPrioridades(
      plan,
      "accionables"
    ).map(grupo => grupo.subproceso_id)
  ).toEqual(["SP0003", "SP0004"]);
  expect(
    filtrarPlanPrioridades(
      plan,
      "bloqueados_dotacion"
    ).map(grupo => grupo.subproceso_id)
  ).toEqual(["SP0004"]);
  expect(filtrarPlanPrioridades(plan, "todo"))
    .toBe(plan);
});

test("construye registro de decision tomada por el jefe", () => {
  const registro =
    construirRegistroDecisionPlanificador({
      perfil: {
        uid: "user-1",
        nombre: "Jefe Planta",
        rol: "jefe",
        empresa_id: "bba"
      },
      plantaId: "chile",
      decisionTomada: "activar_3_turno",
      comentario: "  Se activa solo en laser. ",
      grupo: {
        subproceso_id: "SP0003",
        subproceso_nombre: "Laser fibra tubo",
        siguiente_ot: {
          id: "ot-1",
          codigo: "OT-CHI-000001",
          producto_id: "prod-1",
          producto_codigo: "PCL0001",
          producto_nombre: "Mod 2N60 CL"
        },
        capacidad_estado: {
          estado: "validada",
          capacidad_id: "cap-1"
        },
        decision_turno: {
          tipo: "activar_3_turno",
          titulo:
            "Activar 3er turno en este subproceso",
          carga_horas: 120,
          horas_base_semana: 96,
          horas_3_turnos_semana: 144,
          dias_estimados_2_turnos: 9,
          dias_estimados_3_turnos: 6,
          ahorro_dias_con_noche: 3,
          ahorro_semanas_con_noche: 0.42,
          dotacion: {
            requerida_por_turno: 1,
            manana: 1,
            tarde: 1,
            noche: 1,
            faltantes_base: 0,
            faltantes_noche: 0
          }
        }
      }
    });

  expect(registro).toMatchObject({
    empresa_id: "bba",
    planta_id: "chile",
    usuario_id: "user-1",
    usuario_nombre: "Jefe Planta",
    usuario_rol: "jefe",
    subproceso_id: "SP0003",
    ot_priorizada_codigo: "OT-CHI-000001",
    recomendacion_tipo: "activar_3_turno",
    decision_tomada: "activar_3_turno",
    comentario: "Se activa solo en laser.",
    carga_horas: 120,
    horas_base_semana: 96,
    horas_3_turnos_semana: 144,
    dias_estimados_2_turnos: 9,
    dias_estimados_3_turnos: 6,
    ahorro_dias_con_noche: 3,
    capacidad_estado: "validada",
    capacidad_id: "cap-1"
  });
  expect(registro.creado_en).toBeDefined();
});

test("resume aprendizaje operativo de decisiones", () => {
  const aprendizaje =
    construirAprendizajeDecisionesPlanificador([
      {
        subproceso_id: "SP0003",
        subproceso_nombre: "Laser",
        recomendacion_tipo: "activar_3_turno",
        decision_tomada: "activar_3_turno",
        ahorro_dias_con_noche: 3
      },
      {
        subproceso_id: "SP0003",
        subproceso_nombre: "Laser",
        recomendacion_tipo: "activar_3_turno",
        decision_tomada: "revisar_capacidad",
        ahorro_dias_con_noche: 2
      },
      {
        subproceso_id: "SP0007",
        subproceso_nombre: "Soldadura",
        recomendacion_tipo: "cubrir_dotacion_base",
        decision_tomada: "programar_dotacion",
        ahorro_dias_con_noche: 0
      }
    ]);

  expect(aprendizaje).toMatchObject({
    total: 3,
    alineadas: 1,
    distintas: 2,
    coincidencia_pct: 33.33,
    ahorro_dias_estimado: 5,
    por_decision: {
      activar_3_turno: 1,
      revisar_capacidad: 1,
      programar_dotacion: 1
    },
    por_subproceso: [
      {
        subproceso_id: "SP0003",
        total: 2,
        alineadas: 1,
        distintas: 1,
        coincidencia_pct: 50
      },
      {
        subproceso_id: "SP0007",
        total: 1,
        alineadas: 0,
        distintas: 1,
        coincidencia_pct: 0
      }
    ]
  });
});

test("calcula impacto positivo de una decision", () => {
  const impacto =
    calcularImpactoDecisionPlanificador({
      orden: {
        estado: "completada",
        avance_pct: 100,
        fecha_estimada_fin:
          "2026-06-16T12:00:00Z",
        fecha_planificada_entrega:
          "2026-06-18T12:00:00Z",
        reprocesos_pendientes: 0
      },
      resumenOt: {
        eficiencia_calidad_pct: 92,
        calidad_pct: 98
      },
      fechaReferencia:
        new Date("2026-06-15T12:00:00Z")
    });

  expect(impacto).toMatchObject({
    estado: "positivo",
    avance_pct: 100,
    eficiencia_calidad_pct: 92,
    calidad_pct: 98,
    riesgo_entrega: "en_fecha"
  });
});

test("marca riesgo cuando fecha, calidad o eficiencia no acompañan", () => {
  const impacto =
    calcularImpactoDecisionPlanificador({
      orden: {
        estado: "en_produccion",
        avance_pct: 40,
        fecha_estimada_fin:
          "2026-06-20T12:00:00Z",
        fecha_planificada_entrega:
          "2026-06-18T12:00:00Z",
        reprocesos_pendientes: 2
      },
      resumenOt: {
        eficiencia_calidad_pct: 70,
        calidad_pct: 90
      },
      fechaReferencia:
        new Date("2026-06-15T12:00:00Z")
    });

  expect(impacto).toMatchObject({
    estado: "riesgo",
    avance_pct: 40,
    eficiencia_calidad_pct: 70,
    calidad_pct: 90,
    riesgo_entrega: "en_riesgo"
  });
});

test("advierte cuando la eficiencia sugiere revisar estandar", () => {
  const impacto =
    calcularImpactoDecisionPlanificador({
      orden: {
        estado: "en_produccion",
        avance_pct: 35,
        fecha_estimada_fin:
          "2026-06-16T12:00:00Z",
        fecha_planificada_entrega:
          "2026-06-18T12:00:00Z",
        reprocesos_pendientes: 0
      },
      resumenOt: {
        eficiencia_calidad_pct: 250,
        calidad_pct: 98
      },
      fechaReferencia:
        new Date("2026-06-15T12:00:00Z")
    });

  expect(impacto).toMatchObject({
    estado: "riesgo",
    titulo: "Revisar impacto",
    eficiencia_calidad_pct: 250,
    eficiencia_fuera_rango: true,
    riesgo_entrega: "en_fecha"
  });
  expect(impacto.detalle)
    .toContain("revisar estándar");
  expect(impacto.alertas)
    .toContain(
      "la eficiencia supera 160% y sugiere revisar estándar"
    );
});

test("no marca positivo una OT completada sin fecha de entrega", () => {
  const impacto =
    calcularImpactoDecisionPlanificador({
      orden: {
        estado: "completada",
        avance_pct: 100,
        reprocesos_pendientes: 0
      },
      resumenOt: {
        eficiencia_calidad_pct: 95,
        calidad_pct: 99
      },
      fechaReferencia:
        new Date("2026-06-15T12:00:00Z")
    });

  expect(impacto).toMatchObject({
    estado: "en_observacion",
    fecha_faltante: true,
    riesgo_entrega: "sin_fecha"
  });
});

test("detecta decision sin movimiento posterior", () => {
  const impacto =
    calcularImpactoDecisionPlanificador({
      orden: {
        estado: "liberada",
        avance_pct: 0
      },
      fechaReferencia:
        new Date("2026-06-15T12:00:00Z")
    });

  expect(impacto).toMatchObject({
    estado: "sin_movimiento",
    avance_pct: 0,
    eficiencia_calidad_pct: null,
    calidad_pct: null
  });
});
