import {
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
    ahorro_horas_con_noche:
      redondear(
        Math.min(
          horasFaltantesBase,
          horasNocheSemana
        )
      ),
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
        item.subproceso_id === subprocesoId &&
        item.estado_datos === "validada"
      );

      return {
        ...grupo,
        decision_turno: construirDecisionTurno({
          grupo,
          capacidad,
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
