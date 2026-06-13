import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
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
    capacidad
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

  await setDoc(
    referencia,
    {
      ...capacidad,
      actualizado_en: serverTimestamp()
    },
    { merge: true }
  );

  return {
    id: referencia.id,
    ...capacidad
  };
};
