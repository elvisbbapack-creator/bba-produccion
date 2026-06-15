import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "firebase/firestore";

const COLECCION = "capacidad_procesos";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

const normalizarCodigo = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const numeroEnteroPositivo = valor =>
  Number.isInteger(Number(valor)) &&
  Number(valor) > 0;

export const calcularCapacidadRecursos = ({
  maquinasDisponibles = 1,
  operariosDisponibles = 1,
  operariosPorRecurso = 1,
  disponibilidadPct = 100
} = {}) => {
  const maquinas = numeroEnteroPositivo(
    maquinasDisponibles
  )
    ? Number(maquinasDisponibles)
    : 1;
  const operarios = numeroEnteroPositivo(
    operariosDisponibles
  )
    ? Number(operariosDisponibles)
    : 1;
  const dotacion = numeroEnteroPositivo(
    operariosPorRecurso
  )
    ? Number(operariosPorRecurso)
    : 1;
  const disponibilidad = Math.min(
    100,
    Math.max(1, Number(disponibilidadPct) || 100)
  );
  const recursosPorDotacion = Math.floor(
    operarios / dotacion
  );
  const recursosParalelos = Math.min(
    maquinas,
    recursosPorDotacion
  );

  return {
    maquinas_disponibles: maquinas,
    operarios_disponibles_turno: operarios,
    operarios_por_recurso: dotacion,
    disponibilidad_pct: disponibilidad,
    recursos_paralelos: recursosParalelos,
    factor_capacidad:
      recursosParalelos * disponibilidad / 100,
    operarios_requeridos_turno:
      recursosParalelos * dotacion
  };
};

export const describirDotacionPorRecurso = (
  operariosPorRecurso = 1
) => {
  const dotacion = numeroEnteroPositivo(
    operariosPorRecurso
  )
    ? Number(operariosPorRecurso)
    : 1;
  const ayudantes = Math.max(0, dotacion - 1);

  return {
    operarios_por_recurso: dotacion,
    operario_principal: 1,
    ayudantes_por_recurso: ayudantes,
    requiere_ayudante: ayudantes > 0,
    texto: ayudantes > 0
      ? `1 operario principal + ${ayudantes} ayudante${ayudantes === 1 ? "" : "s"} por estación.`
      : "1 operario por estación, sin ayudante requerido."
  };
};

export const extraerSubprocesosOperaciones = (
  operaciones = []
) => {
  const unicos = new Map();

  operaciones.forEach(operacion => {
    const subprocesoId = normalizarCodigo(
      operacion.subproceso_id
    );

    if (!subprocesoId || unicos.has(subprocesoId)) {
      return;
    }

    unicos.set(subprocesoId, {
      proceso_id: normalizarCodigo(
        operacion.proceso_id
      ),
      proceso_nombre: limpiarTexto(
        operacion.proceso_nombre
      ),
      subproceso_id: subprocesoId,
      subproceso_nombre: limpiarTexto(
        operacion.subproceso_nombre
      )
    });
  });

  return [...unicos.values()].sort((a, b) =>
    a.subproceso_id.localeCompare(
      b.subproceso_id
    )
  );
};

export const evaluarCompletitudCapacidad = (
  subprocesos = [],
  capacidades = []
) => {
  const detalle = subprocesos.map(subproceso => {
    const capacidad = capacidades.find(
      item =>
        item.subproceso_id ===
        subproceso.subproceso_id
    );
    const validada =
      capacidad?.estado_datos === "validada";

    return {
      ...subproceso,
      capacidad_id: capacidad?.id || "",
      configurada: Boolean(capacidad),
      validada,
      estado: !capacidad
        ? "faltante"
        : validada
          ? "validada"
          : "provisional"
    };
  });

  return {
    total: detalle.length,
    validadas: detalle.filter(
      item => item.estado === "validada"
    ).length,
    provisionales: detalle.filter(
      item => item.estado === "provisional"
    ).length,
    faltantes: detalle.filter(
      item => item.estado === "faltante"
    ).length,
    completa:
      detalle.length > 0 &&
      detalle.every(
        item => item.estado === "validada"
      ),
    detalle
  };
};

export const reemplazarCapacidad = (
  capacidades = [],
  capacidadGuardada
) => {
  if (!capacidadGuardada) {
    return capacidades;
  }

  return [
    ...capacidades.filter(
      capacidad =>
        capacidad.id !== capacidadGuardada.id &&
        capacidad.subproceso_id !==
          capacidadGuardada.subproceso_id
    ),
    capacidadGuardada
  ].sort((a, b) =>
    (a.subproceso_id || "").localeCompare(
      b.subproceso_id || ""
    )
  );
};

export const construirMensajeGuardadoCapacidad = ({
  capacidad,
  completitud
}) => {
  const estadoValidado =
    capacidad?.estado_datos === "validada";
  const base = estadoValidado
    ? "Capacidad validada."
    : "Capacidad guardada como provisional.";

  if (!completitud?.total) {
    return estadoValidado
      ? `${base} El planificador ya puede usar este subproceso.`
      : `${base} Valida los datos para habilitar recomendaciones.`;
  }

  if (completitud.completa) {
    return `${base} La OT de referencia ya tiene todas sus capacidades validadas; vuelve al Planificador para recalcular.`;
  }

  return [
    base,
    `Preparación de la OT: ${completitud.validadas}/${completitud.total} validadas.`,
    `${completitud.provisionales} provisionales y ${completitud.faltantes} faltantes antes de completar la referencia.`
  ].join(" ");
};

export const construirGuiaValidacionCapacidad = ({
  datos = {},
  calculo = calcularCapacidadRecursos({
    maquinasDisponibles:
      datos.maquinas_disponibles,
    operariosDisponibles:
      datos.operarios_disponibles_turno,
    operariosPorRecurso:
      datos.operarios_por_recurso,
    disponibilidadPct:
      datos.disponibilidad_pct
  }),
  completitud = null,
  desdePlanificador = false
} = {}) => {
  const validada = Boolean(datos.datos_validados);
  const subprocesoId = normalizarCodigo(
    datos.subproceso_id
  );
  const nombreSubproceso = limpiarTexto(
    datos.subproceso_nombre
  );
  const etiquetaSubproceso = [
    subprocesoId,
    nombreSubproceso
  ].filter(Boolean).join(" - ");
  const impactoPlanificador = validada
    ? "El Planificador usara esta capacidad para comparar 2 turnos contra 3 turnos."
    : "El Planificador seguira pidiendo validar capacidad antes de recomendar turnos.";
  const estadoReferencia = !completitud?.total
    ? "Sin OT de referencia seleccionada."
    : completitud.completa
      ? "La OT de referencia quedara lista para recalcular decisiones."
      : `La OT de referencia aun tendra ${completitud.provisionales} provisionales y ${completitud.faltantes} faltantes.`;
  const dotacionEstacion =
    describirDotacionPorRecurso(
      datos.operarios_por_recurso
    );

  return {
    titulo: validada
      ? "Validacion lista para recomendaciones"
      : "Validacion pendiente",
    estado: validada ? "validada" : "provisional",
    subproceso: etiquetaSubproceso || "Subproceso sin codigo",
    estandar_actual:
      "Usa el estandar por hora del subproceso en la OT/ruta.",
    capacidad_turno:
      `${calculo.recursos_paralelos} recursos × ${calculo.disponibilidad_pct}% = ${calculo.factor_capacidad.toFixed(2)} veces el estandar.`,
    dotacion_turno:
      `${calculo.operarios_requeridos_turno} operarios por turno.`,
    dotacion_estacion: dotacionEstacion.texto,
    impacto_planificador: impactoPlanificador,
    estado_referencia: estadoReferencia,
    advertencias: [
      "Confirma maquinas, dotacion y disponibilidad reales en planta.",
      "Si el dato viene de una primera hora de arranque, guardalo como provisional y ajustalo despues.",
      desdePlanificador
        ? "Al validar, vuelve al Planificador para recalcular la decision."
        : "Valida solo cuando el jefe pueda respaldar el dato."
    ]
  };
};

export const prepararCapacidadProceso = ({
  empresaId,
  plantaId,
  datos,
  perfil
}) => {
  const subprocesoId = normalizarCodigo(
    datos.subproceso_id
  );
  const recursos = calcularCapacidadRecursos({
    maquinasDisponibles:
      datos.maquinas_disponibles,
    operariosDisponibles:
      datos.operarios_disponibles_turno,
    operariosPorRecurso:
      datos.operarios_por_recurso,
    disponibilidadPct:
      datos.disponibilidad_pct
  });

  return {
    empresa_id: empresaId,
    planta_id: plantaId,
    proceso_id: normalizarCodigo(
      datos.proceso_id
    ),
    proceso_nombre: limpiarTexto(
      datos.proceso_nombre
    ),
    subproceso_id: subprocesoId,
    subproceso_nombre: limpiarTexto(
      datos.subproceso_nombre
    ),
    estado_datos: datos.datos_validados
      ? "validada"
      : "provisional",
    ...recursos,
    actualizado_por_id: perfil.uid,
    actualizado_por_nombre:
      perfil.nombre || perfil.email || "",
    activo: true
  };
};

export const validarCapacidadProceso = datos => {
  const errores = [];

  if (!limpiarTexto(datos.planta_id)) {
    errores.push("Selecciona una planta.");
  }
  if (!normalizarCodigo(datos.proceso_id)) {
    errores.push("Ingresa el código del proceso.");
  }
  if (!normalizarCodigo(datos.subproceso_id)) {
    errores.push("Ingresa el código del subproceso.");
  }
  if (!limpiarTexto(datos.subproceso_nombre)) {
    errores.push("Ingresa el nombre del subproceso.");
  }
  [
    ["máquinas o líneas", datos.maquinas_disponibles],
    [
      "operarios disponibles por turno",
      datos.operarios_disponibles_turno
    ],
    [
      "operarios por recurso",
      datos.operarios_por_recurso
    ]
  ].forEach(([nombre, valor]) => {
    if (!numeroEnteroPositivo(valor)) {
      errores.push(
        `El valor de ${nombre} debe ser un entero positivo.`
      );
    }
  });
  const disponibilidad = Number(
    datos.disponibilidad_pct
  );

  if (
    numeroEnteroPositivo(
      datos.operarios_disponibles_turno
    ) &&
    numeroEnteroPositivo(
      datos.operarios_por_recurso
    ) &&
    Number(datos.operarios_disponibles_turno) <
      Number(datos.operarios_por_recurso)
  ) {
    errores.push(
      "La dotación disponible no alcanza para operar un recurso."
    );
  }

  if (
    !Number.isFinite(disponibilidad) ||
    disponibilidad <= 0 ||
    disponibilidad > 100
  ) {
    errores.push(
      "La disponibilidad debe estar entre 1% y 100%."
    );
  }

  if (limpiarTexto(datos.motivo).length < 10) {
    errores.push(
      "Indica un motivo de al menos 10 caracteres."
    );
  }

  return errores;
};

const idCapacidad = (
  empresaId,
  plantaId,
  subprocesoId
) => [
  empresaId,
  plantaId,
  normalizarCodigo(subprocesoId)
].join("__");

export const listarCapacidadesProceso = async (
  db,
  empresaId,
  plantaId
) => {
  if (!plantaId) {
    return [];
  }

  const consulta = query(
    collection(db, COLECCION),
    where("empresa_id", "==", empresaId),
    where("planta_id", "==", plantaId)
  );
  const snapshot = await getDocs(consulta);

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) =>
      (a.subproceso_id || "").localeCompare(
        b.subproceso_id || ""
      )
    );
};

export const guardarCapacidadProceso = async ({
  db,
  perfil,
  plantaId,
  datos
}) => {
  const capacidad = prepararCapacidadProceso({
    empresaId: perfil.empresa_id,
    plantaId,
    datos,
    perfil
  });
  const errores = validarCapacidadProceso(
    {
      ...capacidad,
      motivo: datos.motivo,
      datos_validados:
        datos.datos_validados
    }
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const referencia = doc(
    db,
    COLECCION,
    idCapacidad(
      perfil.empresa_id,
      plantaId,
      capacidad.subproceso_id
    )
  );
  const historialRef = doc(
    collection(referencia, "historial")
  );

  await runTransaction(db, async transaccion => {
    const anteriorSnapshot =
      await transaccion.get(referencia);
    const anterior = anteriorSnapshot.exists()
      ? anteriorSnapshot.data()
      : null;
    const motivo = limpiarTexto(datos.motivo);
    const fecha = serverTimestamp();

    transaccion.set(
      referencia,
      {
        ...capacidad,
        motivo_ultimo_cambio: motivo,
        actualizado_en: fecha
      },
      { merge: true }
    );
    transaccion.set(historialRef, {
      empresa_id: perfil.empresa_id,
      planta_id: plantaId,
      capacidad_id: referencia.id,
      proceso_id: capacidad.proceso_id,
      proceso_nombre:
        capacidad.proceso_nombre,
      subproceso_id:
        capacidad.subproceso_id,
      subproceso_nombre:
        capacidad.subproceso_nombre,
      tipo_cambio: anterior
        ? "actualizacion"
        : "creacion",
      motivo,
      valores_anteriores: anterior
        ? {
          maquinas_disponibles:
            anterior.maquinas_disponibles,
          operarios_disponibles_turno:
            anterior
              .operarios_disponibles_turno,
          operarios_por_recurso:
            anterior.operarios_por_recurso,
          disponibilidad_pct:
            anterior.disponibilidad_pct,
          recursos_paralelos:
            anterior.recursos_paralelos,
          factor_capacidad:
            anterior.factor_capacidad,
          estado_datos:
            anterior.estado_datos ||
            "provisional"
        }
        : null,
      valores_nuevos: {
        maquinas_disponibles:
          capacidad.maquinas_disponibles,
        operarios_disponibles_turno:
          capacidad.operarios_disponibles_turno,
        operarios_por_recurso:
          capacidad.operarios_por_recurso,
        disponibilidad_pct:
          capacidad.disponibilidad_pct,
        recursos_paralelos:
          capacidad.recursos_paralelos,
        factor_capacidad:
          capacidad.factor_capacidad,
        estado_datos:
          capacidad.estado_datos
      },
      actualizado_por_id: perfil.uid,
      actualizado_por_nombre:
        perfil.nombre || perfil.email || "",
      actualizado_en: fecha,
      modelo_version: 2
    });
  });

  return {
    id: referencia.id,
    ...capacidad
  };
};

export const listarHistorialCapacidad = async (
  db,
  capacidadId
) => {
  if (!capacidadId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(
        db,
        COLECCION,
        capacidadId,
        "historial"
      ),
      orderBy("actualizado_en", "desc"),
      limit(20)
    )
  );

  return snapshot.docs.map(documento => ({
    id: documento.id,
    ...documento.data()
  }));
};
