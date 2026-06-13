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
  turnoId
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
  turnoId
}) => {
  const errores = validarProgramacionTurno({
    plantaId,
    semanaInicio,
    operarioCodigo,
    operarioNombre,
    turnoId
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
