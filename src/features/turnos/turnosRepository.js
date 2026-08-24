import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";

const limpiar = valor =>
  (valor || "").toString().trim();

export const normalizarSubprocesosHabilitados = (
  valor = []
) => {
  const elementos = Array.isArray(valor)
    ? valor
    : valor.toString().split(",");

  return [...new Set(
    elementos
      .map(item =>
        limpiar(item)
          .toUpperCase()
          .replace(/\s+/g, "")
      )
      .filter(Boolean)
  )].sort();
};

export const calcularCoberturaSubproceso = (
  programacion = [],
  subprocesoId
) => {
  const codigo = limpiar(subprocesoId)
    .toUpperCase()
    .replace(/\s+/g, "");
  const cobertura = {
    manana: 0,
    tarde: 0,
    noche: 0
  };

  programacion.forEach(item => {
    if (
      item.turno_id in cobertura &&
      normalizarSubprocesosHabilitados(
        item.subprocesos_habilitados
      ).includes(codigo)
    ) {
      cobertura[item.turno_id] += 1;
    }
  });

  return {
    ...cobertura,
    turnos_base_completos:
      cobertura.manana > 0 &&
      cobertura.tarde > 0,
    operarios_base_conservadores: Math.min(
      cobertura.manana,
      cobertura.tarde
    ),
    tercer_turno_disponible:
      cobertura.noche > 0
  };
};

export const calcularBrechasDotacion = (
  cobertura = {},
  operariosRequeridosTurno = 1
) => {
  const requeridos = Math.max(
    1,
    Math.ceil(Number(operariosRequeridosTurno) || 1)
  );
  const manana = Number(cobertura.manana || 0);
  const tarde = Number(cobertura.tarde || 0);
  const noche = Number(cobertura.noche || 0);

  return {
    operarios_requeridos_turno: requeridos,
    faltantes_manana: Math.max(
      0,
      requeridos - manana
    ),
    faltantes_tarde: Math.max(
      0,
      requeridos - tarde
    ),
    faltantes_noche: Math.max(
      0,
      requeridos - noche
    ),
    cobertura_base_suficiente:
      manana >= requeridos &&
      tarde >= requeridos,
    cobertura_noche_suficiente:
      noche >= requeridos
  };
};

export const sugerirReasignacionesDotacion = (
  programacion = [],
  subprocesoId,
  operariosRequeridosTurno = 1,
  operariosOcupados = []
) => {
  const codigo = limpiar(subprocesoId)
    .toUpperCase()
    .replace(/\s+/g, "");
  const requeridos = Math.max(
    1,
    Math.ceil(Number(operariosRequeridosTurno) || 1)
  );
  const porTurno = {
    manana: [],
    tarde: [],
    noche: []
  };
  const ocupados = new Set(
    operariosOcupados.map(valor =>
      limpiar(
        typeof valor === "string"
          ? valor
          : valor.operario_codigo ||
            valor.operario_id
      ).toUpperCase()
    )
  );

  programacion.forEach(item => {
    const codigoOperario = limpiar(
      item.operario_codigo ||
      item.operario_id
    ).toUpperCase();

    if (
      item.turno_id in porTurno &&
      !ocupados.has(codigoOperario) &&
      normalizarSubprocesosHabilitados(
        item.subprocesos_habilitados
      ).includes(codigo)
    ) {
      porTurno[item.turno_id].push(item);
    }
  });

  const disponibles = Object.fromEntries(
    Object.entries(porTurno).map(
      ([turnoId, operarios]) => [
        turnoId,
        [...operarios].sort((a, b) =>
          (a.operario_codigo || "").localeCompare(
            b.operario_codigo || ""
          )
        )
      ]
    )
  );
  const sugerencias = [];
  const turnosDestino = [
    "manana",
    "tarde",
    "noche"
  ];

  turnosDestino.forEach(turnoDestino => {
    let faltantes = Math.max(
      0,
      requeridos -
        disponibles[turnoDestino].length
    );

    turnosDestino
      .filter(turnoOrigen =>
        turnoOrigen !== turnoDestino
      )
      .sort((a, b) =>
        (
          disponibles[b].length -
          requeridos
        ) -
        (
          disponibles[a].length -
          requeridos
        )
      )
      .forEach(turnoOrigen => {
        while (
          faltantes > 0 &&
          disponibles[turnoOrigen].length >
            requeridos
        ) {
          const operario =
            disponibles[turnoOrigen].pop();

          disponibles[turnoDestino].push(
            operario
          );
          sugerencias.push({
            operario_id:
              operario.operario_id ||
              operario.id ||
              operario.operario_codigo,
            operario_codigo:
              operario.operario_codigo || "",
            operario_nombre:
              operario.operario_nombre || "",
            turno_origen: turnoOrigen,
            turno_destino: turnoDestino,
            subproceso_id: codigo
          });
          faltantes -= 1;
        }
      });
  });

  return sugerencias;
};

export const listarOcupacionesOperarios = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "ocupacion_operarios"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId),
      where("activa", "==", true)
    )
  );

  return snapshot.docs.map(documento => ({
    id: documento.id,
    ...documento.data()
  }));
};

export const construirMatrizCobertura = (
  subprocesos = [],
  programacion = []
) => subprocesos.map(subproceso => {
  const cobertura = calcularCoberturaSubproceso(
    programacion,
    subproceso.subproceso_id
  );

  return {
    subproceso_id: subproceso.subproceso_id,
    subproceso_nombre:
      subproceso.subproceso_nombre || "",
    estado_datos:
      subproceso.estado_datos || "provisional",
    recursos_paralelos:
      Number(subproceso.recursos_paralelos || 0),
    operarios_por_recurso:
      Math.max(
        1,
        Math.ceil(
          Number(subproceso.operarios_por_recurso || 1)
        )
      ),
    ...cobertura,
    ...calcularBrechasDotacion(
      cobertura,
      subproceso.operarios_requeridos_turno
    )
  };
});

export const TURNOS_PLANTA = {
  chile: {
    limite_semanal: 42,
    turnos: {
      manana: {
        nombre: "Mañana",
        horas_efectivas: 42
      },
      tarde: {
        nombre: "Tarde",
        horas_efectivas: 41.25
      },
      noche: {
        nombre: "Noche",
        horas_efectivas: 51.75
      }
    }
  },
  peru: {
    limite_semanal: 48,
    turnos: {
      manana: {
        nombre: "Mañana",
        horas_efectivas: 48
      },
      tarde: {
        nombre: "Tarde",
        horas_efectivas: 48
      },
      noche: {
        nombre: "Noche",
        horas_efectivas: 48
      }
    }
  }
};

export const lunesDeSemana = (
  valor = new Date()
) => {
  const fecha = new Date(valor);
  const dia = fecha.getDay();
  const diferencia = dia === 0 ? -6 : 1 - dia;

  fecha.setDate(fecha.getDate() + diferencia);
  fecha.setHours(0, 0, 0, 0);
  return fecha.toISOString().slice(0, 10);
};

export const calcularJornadaSemanal = (
  plantaId,
  turnoId
) => {
  const planta = TURNOS_PLANTA[plantaId];
  const turno = planta?.turnos[turnoId];

  if (!planta || !turno) {
    return {
      horas_efectivas: 0,
      horas_ordinarias: 0,
      horas_extra: 0
    };
  }

  const ordinarias = Math.min(
    planta.limite_semanal,
    turno.horas_efectivas
  );

  return {
    horas_efectivas: turno.horas_efectivas,
    horas_ordinarias: ordinarias,
    horas_extra: Number(
      Math.max(
        0,
        turno.horas_efectivas - ordinarias
      ).toFixed(2)
    )
  };
};

export const datosTurnoParaSesion = (
  programacion = null
) => ({
  turno_id: programacion?.turno_id || "",
  turno_nombre:
    programacion?.turno_nombre || "",
  semana_programada:
    programacion?.semana_inicio || "",
  programacion_turno_id:
    programacion?.id || "",
  sesion_programada: Boolean(programacion),
  horas_ordinarias_programadas: Number(
    programacion?.horas_ordinarias || 0
  ),
  horas_extra_programadas: Number(
    programacion?.horas_extra || 0
  )
});

export const validarProgramacionTurno = ({
  plantaId,
  semanaInicio,
  operarioCodigo,
  operarioNombre,
  turnoId,
  subprocesosHabilitados = []
}) => {
  const errores = [];

  if (!TURNOS_PLANTA[plantaId]) {
    errores.push("Selecciona una planta.");
  }

  if (!limpiar(semanaInicio)) {
    errores.push("Selecciona la semana.");
  }

  if (!limpiar(operarioCodigo)) {
    errores.push("Ingresa el código del operario.");
  }

  if (!limpiar(operarioNombre)) {
    errores.push("Ingresa el nombre del operario.");
  }

  if (!TURNOS_PLANTA[plantaId]?.turnos[turnoId]) {
    errores.push("Selecciona un turno.");
  }

  if (
    normalizarSubprocesosHabilitados(
      subprocesosHabilitados
    ).length === 0
  ) {
    errores.push(
      "Asigna al menos un subproceso habilitado."
    );
  }

  return errores;
};

const idProgramacion = ({
  empresaId,
  plantaId,
  semanaInicio,
  operarioCodigo
}) =>
  [
    empresaId,
    plantaId,
    semanaInicio,
    limpiar(operarioCodigo).toUpperCase()
  ].join("__");

export const listarProgramacionSemanal = async (
  db,
  empresaId,
  plantaId,
  semanaInicio
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "programacion_turnos"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId),
      where(
        "semana_inicio",
        "==",
        semanaInicio
      )
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) =>
      (a.operario_codigo || "").localeCompare(
        b.operario_codigo || ""
      )
    );
};

export const guardarProgramacionTurno = async ({
  db,
  perfil,
  plantaId,
  semanaInicio,
  operarioCodigo,
  operarioNombre,
  turnoId,
  subprocesosHabilitados
}) => {
  const errores = validarProgramacionTurno({
    plantaId,
    semanaInicio,
    operarioCodigo,
    operarioNombre,
    turnoId,
    subprocesosHabilitados
  });

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const codigo = limpiar(
    operarioCodigo
  ).toUpperCase();
  const jornada = calcularJornadaSemanal(
    plantaId,
    turnoId
  );
  const habilidades =
    normalizarSubprocesosHabilitados(
      subprocesosHabilitados
    );
  const referencia = doc(
    db,
    "programacion_turnos",
    idProgramacion({
      empresaId: perfil.empresa_id,
      plantaId,
      semanaInicio,
      operarioCodigo: codigo
    })
  );
  const datos = {
    empresa_id: perfil.empresa_id,
    planta_id: plantaId,
    semana_inicio: semanaInicio,
    operario_id: codigo,
    operario_codigo: codigo,
    operario_nombre: limpiar(operarioNombre),
    turno_id: turnoId,
    turno_nombre:
      TURNOS_PLANTA[plantaId]
        .turnos[turnoId].nombre,
    subprocesos_habilitados: habilidades,
    ...jornada,
    actualizado_por_id: perfil.uid,
    actualizado_en: serverTimestamp(),
    modelo_version: 2
  };

  await setDoc(referencia, datos, {
    merge: true
  });

  return {
    id: referencia.id,
    ...datos
  };
};
