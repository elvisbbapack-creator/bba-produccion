import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
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

const valorFecha = valor => {
  if (!valor) {
    return 0;
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? 0
    : fecha.getTime();
};

const fechaTexto = valor => {
  const fecha = fechaAValor(valor);

  return fecha ? fecha.toISOString() : "";
};

const UMBRAL_EFICIENCIA_ALTA_PCT = 160;

const construirDetalleImpacto = ({
  enRiesgo,
  fechaFaltante,
  calidadBaja,
  eficienciaBaja,
  eficienciaAlta,
  reprocesos
}) => {
  const alertas = [];

  if (enRiesgo) {
    alertas.push("la fecha estimada no acompaña");
  }
  if (fechaFaltante) {
    alertas.push("falta fecha de entrega");
  }
  if (calidadBaja) {
    alertas.push("la calidad está bajo 95%");
  }
  if (eficienciaBaja) {
    alertas.push("la eficiencia está bajo 80%");
  }
  if (eficienciaAlta) {
    alertas.push(
      "la eficiencia supera 160% y sugiere revisar estándar"
    );
  }
  if (reprocesos > 0) {
    alertas.push("hay reprocesos pendientes");
  }

  return {
    alertas,
    detalle: alertas.length > 0
      ? `Revisar: ${alertas.join(", ")}.`
      : "Ya existe avance o eficiencia registrada, pero todavía falta cerrar el resultado."
  };
};

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

export const construirRecomendacionDT = (
  operacion,
  decisionTurno = null
) => {
  if (operacion?.pendiente_estandar) {
    return {
      tipo: "revisar_estandar",
      titulo: "Definir estándar",
      detalle:
        "No proyectar este DT hasta medir o corregir unidades/hora.",
      severidad: "advertencia"
    };
  }

  if (
    ["pendiente", "bloqueada"].includes(
      operacion?.estado
    )
  ) {
    return {
      tipo: "resolver_dependencia",
      titulo: "Desbloquear antes de producir",
      detalle:
        "Revisar RF, dependencia anterior o liberación del proceso.",
      severidad: "advertencia"
    };
  }

  if (!operacion?.es_cuello) {
    return {
      tipo: "mantener_foco",
      titulo: "No mover recursos aquí",
      detalle:
        "Este DT tiene pendiente, pero no es el cuello principal de la OT.",
      severidad: "normal"
    };
  }

  const tipoDecision = decisionTurno?.tipo || "";

  if (tipoDecision === "cubrir_dotacion_base") {
    return {
      tipo: "cubrir_dotacion_base",
      titulo: "Cubrir dotación base",
      detalle:
        "Asignar operarios habilitados en mañana/tarde antes de ampliar turnos.",
      severidad: "riesgo"
    };
  }

  if (tipoDecision === "preparar_3_turno") {
    return {
      tipo: "preparar_3_turno",
      titulo: "Preparar noche",
      detalle:
        "Habilitar dotación nocturna para evaluar el 3er turno sin improvisar.",
      severidad: "advertencia"
    };
  }

  if (tipoDecision === "activar_3_turno") {
    return {
      tipo: "activar_3_turno",
      titulo: "Activar 3er turno aquí",
      detalle:
        "Ampliar horas solo en este subproceso porque es el cuello validado.",
      severidad: "accion"
    };
  }

  if (
    ["configurar_capacidad", "reforzar_capacidad"]
      .includes(tipoDecision)
  ) {
    return {
      tipo: "revisar_capacidad",
      titulo: "Revisar capacidad",
      detalle:
        "Validar máquina, recursos paralelos, dotación o estándar antes de decidir turnos.",
      severidad: "riesgo"
    };
  }

  return {
    tipo: "producir_cuello",
    titulo: "Producir ahora",
    detalle:
      "Mantener foco operativo en este DT hasta bajar el cuello de botella.",
    severidad: "accion"
  };
};

export const construirDetalleOperacionesPlanificador =
  (
    operaciones = [],
    cuelloCarga = null,
    opciones = {}
  ) => {
    const cuelloId =
      cuelloCarga?.operacion_id ||
      cuelloCarga?.ot_operacion_id ||
      "";
    const cuelloCodigo =
      cuelloCarga?.operacion_codigo || "";
    const detalle = operaciones
      .map(operacion => {
        const cantidadPendiente = Number(
          operacion.cantidad_pendiente || 0
        );
        const unidadesPorHora = Number(
          operacion.unidades_por_hora || 0
        );
        const horasRestantes =
          cantidadPendiente > 0 && unidadesPorHora > 0
            ? cantidadPendiente / unidadesPorHora
            : null;
        const operacionId =
          operacion.id ||
          operacion.ruta_operacion_id ||
          operacion.ot_operacion_id ||
          "";
        const operacionCodigo =
          operacion.operacion_codigo || "";

        const detalleOperacion = {
          id: operacionId,
          operacion_codigo: operacionCodigo,
          operacion_nombre:
            operacion.operacion_nombre ||
            operacion.nombre ||
            "",
          proceso_id: operacion.proceso_id || "",
          proceso_nombre:
            operacion.proceso_nombre || "",
          subproceso_id:
            operacion.subproceso_id || "",
          subproceso_nombre:
            operacion.subproceso_nombre || "",
          estado: operacion.estado || "",
          cantidad_requerida: Number(
            operacion.cantidad_requerida || 0
          ),
          cantidad_ok: Number(
            operacion.cantidad_ok || 0
          ),
          cantidad_pendiente: cantidadPendiente,
          unidades_por_hora: unidadesPorHora,
          horas_restantes:
            horasRestantes === null
              ? null
              : redondear(horasRestantes),
          pendiente_estandar:
            cantidadPendiente > 0 &&
            unidadesPorHora <= 0,
          es_cuello:
            Boolean(cuelloId && operacionId === cuelloId) ||
            Boolean(
              !cuelloId &&
              cuelloCodigo &&
              operacionCodigo === cuelloCodigo
            )
        };

        return {
          ...detalleOperacion,
          recomendacion:
            construirRecomendacionDT(
              detalleOperacion,
              opciones.decisionTurno
            )
        };
      })
      .filter(operacion =>
        operacion.cantidad_pendiente > 0
      )
      .sort((a, b) => {
        if (a.es_cuello !== b.es_cuello) {
          return a.es_cuello ? -1 : 1;
        }

        if (
          a.pendiente_estandar !==
          b.pendiente_estandar
        ) {
          return a.pendiente_estandar ? -1 : 1;
        }

        return (
          Number(b.horas_restantes || 0) -
          Number(a.horas_restantes || 0)
        );
      });

    return {
      total_dt_pendientes: detalle.length,
      unidades_pendientes_total: detalle.reduce(
        (total, operacion) =>
          total +
          Number(operacion.cantidad_pendiente || 0),
        0
      ),
      horas_carga_total: redondear(
        detalle.reduce(
          (total, operacion) =>
            total +
            Number(operacion.horas_restantes || 0),
          0
        )
      ),
      pendientes_estandar: detalle.filter(
        operacion => operacion.pendiente_estandar
      ).length,
      detalle
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
    semanaInicio = "",
    decisionTomada,
    comentario = ""
  }) => {
    const decision =
      grupo?.decision_turno || {};
    const capacidad =
      grupo?.capacidad_estado || {};
    const siguienteOT =
      grupo?.siguiente_ot || {};
    const cuello =
      siguienteOT?.cuello_carga || {};

    return {
      empresa_id: perfil?.empresa_id || "",
      planta_id: plantaId || "",
      semana_inicio: semanaInicio || "",
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
      ot_operacion_priorizada_id:
        cuello.operacion_id || "",
      ot_operacion_priorizada_codigo:
        cuello.operacion_codigo || "",
      ot_operacion_priorizada_nombre:
        cuello.operacion_nombre || "",
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
    semanaInicio = "",
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
        semanaInicio,
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

export const listarDecisionesPlanificador =
  async ({
    db,
    perfil,
    plantaId = "",
    limite = 100
  }) => {
    const plantasPermitidas =
      perfil?.rol === "gerencia"
        ? []
        : (perfil?.planta_ids || []);
    const plantasConsulta = plantaId
      ? [plantaId]
      : plantasPermitidas;
    const base = [
      where(
        "empresa_id",
        "==",
        perfil?.empresa_id || ""
      )
    ];

    const consultas = plantasConsulta.length > 0
      ? plantasConsulta.map(planta =>
        query(
          collection(
            db,
            "decisiones_planificador"
          ),
          ...base,
          where("planta_id", "==", planta),
          orderBy("creado_en", "desc"),
          limit(limite)
        )
      )
      : [
        query(
          collection(
            db,
            "decisiones_planificador"
          ),
          ...base,
          orderBy("creado_en", "desc"),
          limit(limite)
        )
      ];

    const snapshots = await Promise.all(
      consultas.map(consulta => getDocs(consulta))
    );
    const porId = new Map();

    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(documento => {
        porId.set(documento.id, {
          id: documento.id,
          ...documento.data()
        });
      });
    });

    return [...porId.values()]
      .sort(
        (a, b) =>
          valorFecha(b.creado_en) -
          valorFecha(a.creado_en)
      )
      .slice(0, limite);
  };

export const construirAprendizajeDecisionesPlanificador =
  (decisiones = []) => {
    const resumen = {
      total: decisiones.length,
      alineadas: 0,
      distintas: 0,
      sin_recomendacion: 0,
      coincidencia_pct: 0,
      ahorro_dias_estimado: 0,
      por_subproceso: [],
      por_decision: {}
    };
    const porSubproceso = new Map();

    decisiones.forEach(item => {
      const recomendacion =
        item.recomendacion_tipo || "";
      const decision =
        item.decision_tomada || "";

      if (!recomendacion) {
        resumen.sin_recomendacion += 1;
      } else if (recomendacion === decision) {
        resumen.alineadas += 1;
      } else {
        resumen.distintas += 1;
      }

      resumen.ahorro_dias_estimado += Number(
        item.ahorro_dias_con_noche || 0
      );
      resumen.por_decision[decision] =
        (resumen.por_decision[decision] || 0) + 1;

      const subprocesoId =
        item.subproceso_id || "sin_subproceso";
      const actual =
        porSubproceso.get(subprocesoId) || {
          subproceso_id: subprocesoId,
          subproceso_nombre:
            item.subproceso_nombre || "",
          total: 0,
          alineadas: 0,
          distintas: 0,
          ahorro_dias_estimado: 0
        };

      actual.total += 1;
      actual.ahorro_dias_estimado += Number(
        item.ahorro_dias_con_noche || 0
      );
      if (recomendacion === decision) {
        actual.alineadas += 1;
      } else {
        actual.distintas += 1;
      }

      porSubproceso.set(subprocesoId, actual);
    });

    resumen.coincidencia_pct =
      resumen.total > 0
        ? redondear(
          (resumen.alineadas / resumen.total) * 100
        )
        : 0;
    resumen.ahorro_dias_estimado =
      redondear(resumen.ahorro_dias_estimado);
    resumen.por_subproceso =
      [...porSubproceso.values()]
        .map(item => ({
          ...item,
          ahorro_dias_estimado:
            redondear(item.ahorro_dias_estimado),
          coincidencia_pct:
            item.total > 0
              ? redondear(
                (item.alineadas / item.total) * 100
              )
              : 0
        }))
        .sort((a, b) =>
          b.total - a.total ||
          b.distintas - a.distintas
        )
        .slice(0, 5);

    return resumen;
  };

export const calcularImpactoDecisionPlanificador =
  ({
    decision = {},
    orden = null,
    resumenOt = null,
    fechaReferencia = new Date()
  }) => {
    if (!orden) {
      return {
        estado: "sin_datos",
        titulo: "Sin OT disponible",
        detalle:
          "No se encontró la OT para medir el resultado.",
        avance_pct: 0,
        eficiencia_calidad_pct: null,
        calidad_pct: null,
        fecha_estimada_fin: "",
        riesgo_entrega: "sin_fecha"
      };
    }

    const ordenConRiesgo = clasificarRiesgoOT(
      orden,
      fechaReferencia
    );
    const avance = redondear(orden.avance_pct || 0);
    const eficiencia =
      resumenOt?.eficiencia_calidad_pct ?? null;
    const calidad = resumenOt?.calidad_pct ?? null;
    const reprocesos = Number(
      orden.reprocesos_pendientes || 0
    );
    const enRiesgo = [
      "atrasada",
      "en_riesgo"
    ].includes(ordenConRiesgo.riesgo_entrega);
    const fechaFaltante =
      ordenConRiesgo.riesgo_entrega ===
      "sin_fecha";
    const calidadBaja =
      calidad !== null && Number(calidad) < 95;
    const eficienciaBaja =
      eficiencia !== null && Number(eficiencia) < 80;
    const eficienciaAlta =
      eficiencia !== null &&
      Number(eficiencia) >
        UMBRAL_EFICIENCIA_ALTA_PCT;
    const impactoDetalle = construirDetalleImpacto({
      enRiesgo,
      fechaFaltante,
      calidadBaja,
      eficienciaBaja,
      eficienciaAlta,
      reprocesos
    });

    if (
      orden.estado === "completada" &&
      !calidadBaja &&
      !fechaFaltante &&
      !eficienciaAlta &&
      reprocesos === 0
    ) {
      return {
        estado: "positivo",
        titulo: "Resultado positivo",
        detalle:
          "La OT está completada sin reprocesos pendientes y con calidad controlada.",
        avance_pct: 100,
        eficiencia_calidad_pct: eficiencia,
        calidad_pct: calidad,
        fecha_estimada_fin:
          fechaTexto(orden.fecha_estimada_fin),
        riesgo_entrega:
          ordenConRiesgo.riesgo_entrega,
        eficiencia_fuera_rango:
          eficienciaAlta,
        fecha_faltante: fechaFaltante,
        alertas: impactoDetalle.alertas
      };
    }

    if (
      enRiesgo ||
      calidadBaja ||
      eficienciaBaja ||
      eficienciaAlta ||
      reprocesos > 0
    ) {
      return {
        estado: "riesgo",
        titulo: "Revisar impacto",
        detalle: impactoDetalle.detalle,
        avance_pct: avance,
        eficiencia_calidad_pct: eficiencia,
        calidad_pct: calidad,
        fecha_estimada_fin:
          fechaTexto(orden.fecha_estimada_fin),
        riesgo_entrega:
          ordenConRiesgo.riesgo_entrega,
        eficiencia_fuera_rango:
          eficienciaAlta,
        fecha_faltante: fechaFaltante,
        alertas: impactoDetalle.alertas
      };
    }

    if (avance > 0 || resumenOt) {
      return {
        estado: "en_observacion",
        titulo: "En observación",
        detalle:
          "Ya existe avance o eficiencia registrada, pero todavía falta cerrar el resultado.",
        avance_pct: avance,
        eficiencia_calidad_pct: eficiencia,
        calidad_pct: calidad,
        fecha_estimada_fin:
          fechaTexto(orden.fecha_estimada_fin),
        riesgo_entrega:
          ordenConRiesgo.riesgo_entrega,
        eficiencia_fuera_rango:
          eficienciaAlta,
        fecha_faltante: fechaFaltante,
        alertas: impactoDetalle.alertas
      };
    }

    return {
      estado: "sin_movimiento",
      titulo: "Sin movimiento posterior",
      detalle:
        "Aún no hay avance productivo registrado después de la decisión.",
      avance_pct: avance,
      eficiencia_calidad_pct: eficiencia,
      calidad_pct: calidad,
      fecha_estimada_fin:
        fechaTexto(orden.fecha_estimada_fin),
      riesgo_entrega: ordenConRiesgo.riesgo_entrega,
      eficiencia_fuera_rango:
        eficienciaAlta,
      fecha_faltante: fechaFaltante,
      alertas: impactoDetalle.alertas
    };
  };

export const listarImpactosDecisionesPlanificador =
  async ({
    db,
    decisiones = [],
    fechaReferencia = new Date()
  }) => {
    const otIds = [
      ...new Set(
        decisiones
          .map(item => item.ot_priorizada_id)
          .filter(Boolean)
      )
    ].slice(0, 80);

    const pares = await Promise.all(
      otIds.map(async otId => {
        const [ordenSnap, resumenSnap] =
          await Promise.all([
            getDoc(doc(db, "ordenes_trabajo", otId)),
            getDoc(doc(db, "resumenes_ot", otId))
          ]);

        return [
          otId,
          {
            orden: ordenSnap.exists()
              ? {
                id: ordenSnap.id,
                ...ordenSnap.data()
              }
              : null,
            resumenOt: resumenSnap.exists()
              ? {
                id: resumenSnap.id,
                ...resumenSnap.data()
              }
              : null
          }
        ];
      })
    );
    const porOt = new Map(pares);

    return Object.fromEntries(
      decisiones.map(decision => {
        const datos =
          porOt.get(decision.ot_priorizada_id) || {};

        return [
          decision.id,
          calcularImpactoDecisionPlanificador({
            decision,
            orden: datos.orden,
            resumenOt: datos.resumenOt,
            fechaReferencia
          })
        ];
      })
    );
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
