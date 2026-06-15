import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  calcularProyeccionOT,
  listarOperacionesOT
} from "../ordenes/ordenesRepository";
import {
  clasificarRiesgoOT
} from "../resumenes/resumenesRepository";
import {
  calcularBrechasDotacion,
  calcularCoberturaSubproceso,
  TURNOS_PLANTA
} from "../turnos/turnosRepository";

const fechaAValor = valor => {
  if (!valor) {
    return null;
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

const prioridadEstadoDT = cuello => {
  if (cuello?.pendiente_estandar) {
    return 0;
  }

  if (
    ["disponible", "en_proceso"].includes(
      cuello?.estado
    )
  ) {
    return 2;
  }

  return 1;
};

const accionRecomendada = cuello => {
  if (cuello?.pendiente_estandar) {
    return "definir_estandar";
  }

  if (
    ["pendiente", "bloqueada"].includes(
      cuello?.estado
    )
  ) {
    return "desbloquear_dt";
  }

  return "producir_ahora";
};

const numeroPositivo = valor =>
  Number.isFinite(Number(valor)) &&
  Number(valor) > 0;

const redondear = valor =>
  Number((Number(valor) || 0).toFixed(2));

const nombreTurno = (plantaId, turnoId) =>
  TURNOS_PLANTA[plantaId]?.turnos?.[turnoId]
    ?.nombre || turnoId;

const horasTurnos = (plantaId, turnos = []) => {
  const turnosPlanta =
    TURNOS_PLANTA[plantaId]?.turnos || {};

  return turnos.reduce(
    (total, turnoId) =>
      total +
      Number(
        turnosPlanta[turnoId]?.horas_efectivas || 0
      ),
    0
  );
};

const construirEstadoCapacidadPlan = capacidad => {
  if (!capacidad) {
    return {
      estado: "faltante",
      titulo: "Capacidad faltante",
      detalle:
        "No hay capacidad registrada para este subproceso.",
      bloquea_recomendacion: true
    };
  }

  const validada =
    capacidad.estado_datos === "validada";
  const resumen = {
    capacidad_id: capacidad.id || "",
    estado: validada ? "validada" : "provisional",
    titulo: validada
      ? "Capacidad validada"
      : "Capacidad provisional",
    detalle: validada
      ? "El Planificador puede usar estos datos para comparar turnos."
      : "Existe capacidad, pero falta verificacion en planta antes de recomendar turnos.",
    bloquea_recomendacion: !validada,
    recursos_paralelos:
      capacidad.recursos_paralelos || 0,
    factor_capacidad:
      capacidad.factor_capacidad || 0,
    operarios_requeridos_turno:
      capacidad.operarios_requeridos_turno || 0,
    disponibilidad_pct:
      capacidad.disponibilidad_pct || 0
  };

  return resumen;
};

const construirResumenDecision = ({
  plantaId,
  cobertura,
  brechas,
  carga,
  horasBaseSemana,
  horasNocheSemana,
  horasTresTurnos,
  semanasBase,
  semanasTresTurnos
}) => {
  const faltantesBase =
    Number(brechas.faltantes_manana || 0) +
    Number(brechas.faltantes_tarde || 0);
  const faltantesNoche =
    Number(brechas.faltantes_noche || 0);
  const horasFaltantesBase = Math.max(
    0,
    carga - horasBaseSemana
  );
  const horasFaltantesTresTurnos = Math.max(
    0,
    carga - horasTresTurnos
  );
  const ahorroSemanas =
    semanasBase !== null &&
    semanasTresTurnos !== null
      ? Math.max(
        0,
        semanasBase - semanasTresTurnos
      )
      : 0;
  const diasBase =
    semanasBase === null
      ? null
      : Math.ceil(semanasBase * 7);
  const diasTresTurnos =
    semanasTresTurnos === null
      ? null
      : Math.ceil(semanasTresTurnos * 7);
  const ahorroDias =
    diasBase !== null && diasTresTurnos !== null
      ? Math.max(0, diasBase - diasTresTurnos)
      : 0;
  const horasRecuperables = redondear(
    Math.min(
      horasFaltantesBase,
      horasNocheSemana
    )
  );

  return {
    carga_horas: redondear(carga),
    horas_base_semana: redondear(horasBaseSemana),
    horas_noche_semana: redondear(horasNocheSemana),
    horas_3_turnos_semana:
      redondear(horasTresTurnos),
    horas_faltantes_2_turnos:
      redondear(horasFaltantesBase),
    horas_faltantes_3_turnos:
      redondear(horasFaltantesTresTurnos),
    ahorro_horas_con_noche: horasRecuperables,
    semanas_2_turnos:
      semanasBase === null
        ? null
        : redondear(semanasBase),
    semanas_3_turnos:
      semanasTresTurnos === null
        ? null
        : redondear(semanasTresTurnos),
    ahorro_semanas_con_noche:
      redondear(ahorroSemanas),
    dias_estimados_2_turnos: diasBase,
    dias_estimados_3_turnos: diasTresTurnos,
    ahorro_dias_con_noche: ahorroDias,
    escenarios: {
      base: {
        titulo: "2 turnos",
        descripcion: "Mañana y tarde",
        horas_semana: redondear(horasBaseSemana),
        semanas_estimadas:
          semanasBase === null
            ? null
            : redondear(semanasBase),
        dias_estimados: diasBase,
        horas_faltantes:
          redondear(horasFaltantesBase)
      },
      ampliado: {
        titulo: "3 turnos",
        descripcion: "Mañana, tarde y noche",
        horas_semana: redondear(horasTresTurnos),
        semanas_estimadas:
          semanasTresTurnos === null
            ? null
            : redondear(semanasTresTurnos),
        dias_estimados: diasTresTurnos,
        horas_faltantes:
          redondear(horasFaltantesTresTurnos)
      }
    },
    impacto_3_turno: {
      horas_adicionales_semana:
        redondear(horasNocheSemana),
      horas_recuperables: horasRecuperables,
      ahorro_semanas: redondear(ahorroSemanas),
      ahorro_dias: ahorroDias,
      dotacion_noche_cubierta:
        brechas.cobertura_noche_suficiente
    },
    cobertura,
    brechas,
    dotacion: {
      requerida_por_turno:
        brechas.operarios_requeridos_turno,
      manana: cobertura.manana || 0,
      tarde: cobertura.tarde || 0,
      noche: cobertura.noche || 0,
      faltantes_base: faltantesBase,
      faltantes_noche: faltantesNoche
    },
    turnos: {
      manana: nombreTurno(plantaId, "manana"),
      tarde: nombreTurno(plantaId, "tarde"),
      noche: nombreTurno(plantaId, "noche")
    }
  };
};

export const construirDecisionTurno = ({
  grupo,
  capacidad,
  programacion = [],
  plantaId
}) => {
  if (!capacidad) {
    return {
      tipo: "configurar_capacidad",
      titulo: "Configurar capacidad del subproceso",
      detalle:
        "Falta capacidad validada para comparar 2 turnos contra 3 turnos.",
      severidad: "advertencia"
    };
  }

  const cobertura = calcularCoberturaSubproceso(
    programacion,
    grupo.subproceso_id
  );
  const brechas = calcularBrechasDotacion(
    cobertura,
    capacidad.operarios_requeridos_turno
  );
  const factor = numeroPositivo(
    capacidad.factor_capacidad
  )
    ? Number(capacidad.factor_capacidad)
    : 1;
  const carga = Number(
    grupo.horas_carga_compartida || 0
  );
  const horasBaseSemana =
    horasTurnos(plantaId, ["manana", "tarde"]) *
    factor;
  const horasNocheSemana =
    horasTurnos(plantaId, ["noche"]) * factor;
  const horasTresTurnos =
    horasBaseSemana + horasNocheSemana;
  const semanasBase =
    horasBaseSemana > 0
      ? carga / horasBaseSemana
      : null;
  const semanasTresTurnos =
    horasTresTurnos > 0
      ? carga / horasTresTurnos
      : null;
  const baseSuficiente =
    brechas.cobertura_base_suficiente &&
    horasBaseSemana > 0 &&
    carga <= horasBaseSemana * 0.85;
  const nocheSuficiente =
    brechas.cobertura_noche_suficiente &&
    horasNocheSemana > 0;
  const capacidadTresTurnosSuficiente =
    horasTresTurnos > 0 &&
    carga <= horasTresTurnos;
  const resumen = construirResumenDecision({
    plantaId,
    cobertura,
    brechas,
    carga,
    horasBaseSemana,
    horasNocheSemana,
    horasTresTurnos,
    semanasBase,
    semanasTresTurnos
  });

  if (!brechas.cobertura_base_suficiente) {
    const turnoSugerido =
      brechas.faltantes_manana >
      brechas.faltantes_tarde
        ? "manana"
        : "tarde";

    return {
      tipo: "cubrir_dotacion_base",
      titulo: "Cubrir dotación de mañana y tarde",
      detalle:
        "Antes de ampliar turnos, faltan operarios habilitados en los turnos base.",
      severidad: "riesgo",
      turno_sugerido: turnoSugerido,
      accion_operativa:
        `Asignar ${resumen.dotacion.faltantes_base} operarios faltantes en turnos base antes de evaluar noche.`,
      ...resumen
    };
  }

  if (baseSuficiente) {
    return {
      tipo: "mantener_2_turnos",
      titulo: "Mantener 2 turnos",
      detalle:
        "La carga conocida cabe en la capacidad semanal de mañana y tarde.",
      severidad: "normal",
      accion_operativa:
        "Mantener mañana y tarde; no se justifica activar noche para esta carga.",
      ...resumen
    };
  }

  if (
    capacidadTresTurnosSuficiente &&
    nocheSuficiente
  ) {
    return {
      tipo: "activar_3_turno",
      titulo: "Activar 3er turno en este subproceso",
      detalle:
        "El turno noche reduce la presión del cuello de botella con dotación suficiente.",
      severidad: "accion",
      accion_operativa:
        `Activar noche: aporta ${resumen.horas_noche_semana} h/sem y reduce ${resumen.ahorro_semanas_con_noche} semanas estimadas.`,
      ...resumen
    };
  }

  if (capacidadTresTurnosSuficiente) {
    return {
      tipo: "preparar_3_turno",
      titulo: "Preparar dotación para 3er turno",
      detalle:
        "La carga mejora con noche, pero faltan operarios habilitados para cubrir ese turno.",
      severidad: "advertencia",
      turno_sugerido: "noche",
      accion_operativa:
        `Preparar ${resumen.dotacion.faltantes_noche} operarios para noche antes de activar el 3er turno.`,
      ...resumen
    };
  }

  return {
    tipo: "reforzar_capacidad",
    titulo: "Reforzar capacidad adicional",
    detalle:
      "Incluso con 3 turnos, la carga supera la capacidad semanal estimada.",
    severidad: "riesgo",
    accion_operativa:
      `Aun con noche faltarían ${resumen.horas_faltantes_3_turnos} h; revisar máquina, estándar o más recursos paralelos.`,
    ...resumen
  };
};

export const compararPrioridadPlan = (
  izquierda,
  derecha
) => {
  const estado =
    prioridadEstadoDT(derecha.cuello_carga) -
    prioridadEstadoDT(izquierda.cuello_carga);

  if (estado !== 0) {
    return estado;
  }

  const riesgo =
    Number(derecha.prioridad_riesgo || 0) -
    Number(izquierda.prioridad_riesgo || 0);

  if (riesgo !== 0) {
    return riesgo;
  }

  const entregaIzquierda = fechaAValor(
    izquierda.fecha_planificada_entrega
  );
  const entregaDerecha = fechaAValor(
    derecha.fecha_planificada_entrega
  );
  const entrega = (
    entregaIzquierda?.getTime() ??
      Number.MAX_SAFE_INTEGER
  ) - (
    entregaDerecha?.getTime() ??
      Number.MAX_SAFE_INTEGER
  );

  if (entrega !== 0) {
    return entrega;
  }

  return (
    Number(derecha.correlativo || 0) -
    Number(izquierda.correlativo || 0)
  );
};

export const construirPlanPrioridades = (
  ordenes = [],
  fechaReferencia = new Date(),
  opciones = {}
) => {
  const grupos = new Map();

  ordenes
    .map(orden =>
      clasificarRiesgoOT(
        orden,
        fechaReferencia
      )
    )
    .filter(orden =>
      orden.cuello_carga?.subproceso_id &&
      Number(
        orden.cuello_carga.cantidad_pendiente ||
        0
      ) > 0
    )
    .forEach(orden => {
      const subprocesoId =
        orden.cuello_carga.subproceso_id;
      const actuales =
        grupos.get(subprocesoId) || [];

      actuales.push({
        ...orden,
        accion_recomendada:
          accionRecomendada(orden.cuello_carga)
      });
      grupos.set(subprocesoId, actuales);
    });

  return [...grupos.entries()]
    .map(([subprocesoId, ordenesGrupo]) => {
      const secuencia = [...ordenesGrupo]
        .sort(compararPrioridadPlan)
        .map((orden, indice) => ({
          ...orden,
          prioridad_plan: indice + 1
        }));
      const grupo = {
        subproceso_id: subprocesoId,
        subproceso_nombre:
          secuencia[0]?.cuello_carga
            ?.subproceso_nombre || "",
        ots_compitiendo: secuencia.length,
        cantidad_total_pendiente:
          secuencia.reduce(
            (total, orden) =>
              total +
              Number(
                orden.cuello_carga
                  .cantidad_pendiente || 0
              ),
            0
          ),
        horas_carga_compartida:
          Number(
            secuencia.reduce(
              (total, orden) =>
                total +
                Number(
                  orden.cuello_carga
                    .horas_restantes || 0
                ),
              0
            ).toFixed(2)
          ),
        conflicto_capacidad:
          secuencia.length > 1,
        siguiente_ot: secuencia[0] || null,
        secuencia
      };
      const capacidad = (
        opciones.capacidades || []
      ).find(item =>
        item.subproceso_id === subprocesoId
      );
      const capacidadValidada =
        capacidad?.estado_datos === "validada"
          ? capacidad
          : null;
      const estadoCapacidad =
        construirEstadoCapacidadPlan(
          capacidad
      );

      return {
        ...grupo,
        capacidad_estado: estadoCapacidad,
        decision_turno: construirDecisionTurno({
          grupo,
          capacidad: capacidadValidada,
          programacion: opciones.programacion,
          plantaId: opciones.plantaId
        })
      };
    })
    .sort((a, b) => {
      if (
        a.conflicto_capacidad !==
        b.conflicto_capacidad
      ) {
        return a.conflicto_capacidad ? -1 : 1;
      }

      return compararPrioridadPlan(
        a.siguiente_ot,
        b.siguiente_ot
      );
    });
};

export const construirResumenPlanificador = (
  plan = []
) => {
  const resumen = {
    subprocesos_total: plan.length,
    ots_compitiendo_total: 0,
    unidades_pendientes_total: 0,
    horas_carga_total: 0,
    capacidad_faltante: 0,
    capacidad_provisional: 0,
    capacidad_validada: 0,
    recomendaciones_accionables: 0,
    bloqueados_dotacion: 0,
    bloqueados_capacidad: 0
  };
  const tiposAccionables = new Set([
    "activar_3_turno",
    "cubrir_dotacion_base",
    "preparar_3_turno",
    "reforzar_capacidad"
  ]);
  const tiposBloqueadosDotacion = new Set([
    "cubrir_dotacion_base",
    "preparar_3_turno"
  ]);

  plan.forEach(grupo => {
    resumen.ots_compitiendo_total += Number(
      grupo.ots_compitiendo || 0
    );
    resumen.unidades_pendientes_total += Number(
      grupo.cantidad_total_pendiente || 0
    );
    resumen.horas_carga_total += Number(
      grupo.horas_carga_compartida || 0
    );

    const estadoCapacidad =
      grupo.capacidad_estado?.estado || "faltante";

    if (estadoCapacidad === "validada") {
      resumen.capacidad_validada += 1;
    } else if (estadoCapacidad === "provisional") {
      resumen.capacidad_provisional += 1;
      resumen.bloqueados_capacidad += 1;
    } else {
      resumen.capacidad_faltante += 1;
      resumen.bloqueados_capacidad += 1;
    }

    const tipoDecision =
      grupo.decision_turno?.tipo || "";

    if (tiposAccionables.has(tipoDecision)) {
      resumen.recomendaciones_accionables += 1;
    }
    if (tiposBloqueadosDotacion.has(tipoDecision)) {
      resumen.bloqueados_dotacion += 1;
    }
  });

  return {
    ...resumen,
    horas_carga_total:
      redondear(resumen.horas_carga_total)
  };
};

export const filtrarPlanPrioridades = (
  plan = [],
  filtro = "todo"
) => {
  if (!filtro || filtro === "todo") {
    return plan;
  }

  const tiposAccionables = new Set([
    "activar_3_turno",
    "cubrir_dotacion_base",
    "preparar_3_turno",
    "reforzar_capacidad"
  ]);
  const tiposBloqueadosDotacion = new Set([
    "cubrir_dotacion_base",
    "preparar_3_turno"
  ]);

  return plan.filter(grupo => {
    const estadoCapacidad =
      grupo.capacidad_estado?.estado || "faltante";
    const tipoDecision =
      grupo.decision_turno?.tipo || "";

    if (filtro === "capacidad_faltante") {
      return estadoCapacidad === "faltante";
    }
    if (filtro === "capacidad_provisional") {
      return estadoCapacidad === "provisional";
    }
    if (filtro === "capacidad_validada") {
      return estadoCapacidad === "validada";
    }
    if (filtro === "accionables") {
      return tiposAccionables.has(tipoDecision);
    }
    if (filtro === "bloqueados_dotacion") {
      return tiposBloqueadosDotacion.has(
        tipoDecision
      );
    }

    return true;
  });
};

export const construirRegistroDecisionPlanificador =
  ({
    perfil,
    plantaId,
    grupo,
    decisionTomada,
    comentario = ""
  }) => {
    const decision =
      grupo?.decision_turno || {};
    const capacidad =
      grupo?.capacidad_estado || {};
    const siguienteOT =
      grupo?.siguiente_ot || {};

    return {
      empresa_id: perfil?.empresa_id || "",
      planta_id: plantaId || "",
      usuario_id:
        perfil?.uid || perfil?.id || "",
      usuario_nombre: perfil?.nombre || "",
      usuario_rol: perfil?.rol || "",
      subproceso_id:
        grupo?.subproceso_id || "",
      subproceso_nombre:
        grupo?.subproceso_nombre || "",
      ot_priorizada_id: siguienteOT.id || "",
      ot_priorizada_codigo:
        siguienteOT.codigo || "",
      producto_id:
        siguienteOT.producto_id || "",
      producto_codigo:
        siguienteOT.producto_codigo || "",
      producto_nombre:
        siguienteOT.producto_nombre || "",
      recomendacion_tipo: decision.tipo || "",
      recomendacion_titulo:
        decision.titulo || "",
      decision_tomada: decisionTomada || "",
      comentario: comentario.trim(),
      carga_horas:
        Number(decision.carga_horas || 0),
      horas_base_semana:
        Number(decision.horas_base_semana || 0),
      horas_3_turnos_semana:
        Number(
          decision.horas_3_turnos_semana || 0
        ),
      dias_estimados_2_turnos:
        decision.dias_estimados_2_turnos ?? null,
      dias_estimados_3_turnos:
        decision.dias_estimados_3_turnos ?? null,
      ahorro_dias_con_noche:
        Number(
          decision.ahorro_dias_con_noche || 0
        ),
      ahorro_semanas_con_noche:
        Number(
          decision.ahorro_semanas_con_noche || 0
        ),
      dotacion_requerida_turno:
        Number(
          decision.dotacion
            ?.requerida_por_turno || 0
        ),
      dotacion_manana:
        Number(decision.dotacion?.manana || 0),
      dotacion_tarde:
        Number(decision.dotacion?.tarde || 0),
      dotacion_noche:
        Number(decision.dotacion?.noche || 0),
      faltantes_base:
        Number(
          decision.dotacion?.faltantes_base || 0
        ),
      faltantes_noche:
        Number(
          decision.dotacion?.faltantes_noche || 0
        ),
      capacidad_estado:
        capacidad.estado || "faltante",
      capacidad_id:
        capacidad.capacidad_id || "",
      creado_en: serverTimestamp()
    };
  };

export const registrarDecisionPlanificador =
  async ({
    db,
    perfil,
    plantaId,
    grupo,
    decisionTomada,
    comentario = ""
  }) => {
    if (!decisionTomada) {
      throw new Error(
        "Selecciona la decisión tomada."
      );
    }

    const registro =
      construirRegistroDecisionPlanificador({
        perfil,
        plantaId,
        grupo,
        decisionTomada,
        comentario
      });

    const referencia = await addDoc(
      collection(db, "decisiones_planificador"),
      registro
    );

    return {
      id: referencia.id,
      ...registro
    };
  };

export const recalcularResumenesPlanificacion =
  async ({
    db,
    perfil,
    plantaId,
    ordenes = []
  }) => {
    const resultados = await Promise.all(
      ordenes.map(async orden => {
        const operaciones =
          await listarOperacionesOT(
            db,
            perfil.empresa_id,
            plantaId,
            orden.id
          );
        const proyeccion = calcularProyeccionOT(
          operaciones,
          new Date()
        );

        await updateDoc(
          doc(db, "ordenes_trabajo", orden.id),
          {
            ...proyeccion,
            fecha_actualizacion:
              serverTimestamp()
          }
        );

        return {
          ...orden,
          ...proyeccion
        };
      })
    );

    return resultados;
  };
