import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where
} from "firebase/firestore";
import {
  aCatalogoProcesosRuta,
  listarProcesosEstaciones
} from "../procesos/procesosRepository";

const COLECCION_PERSONAS = "operarios";

export const EQUIPOS_TRABAJO_RRHH = [
  "Alexis",
  "Pablo"
];

export const ROLES_LABORALES_RRHH = [
  "operario",
  "supervisor",
  "jefe",
  "gerente",
  "auxiliar"
];

export const PLANTAS_RRHH = [
  {
    id: "chile",
    nombre: "BBA Chile"
  },
  {
    id: "peru",
    nombre: "BBA Perú"
  }
];

const limpiarTexto = valor =>
  (valor || "").toString().trim();

export const normalizarCodigoPersona = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const normalizarRolLaboral = valor => {
  const rol = limpiarTexto(valor)
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (rol === "gerencia") {
    return "gerente";
  }

  return rol || "operario";
};

export const normalizarLista = valor =>
  Array.isArray(valor)
    ? [
        ...new Set(
          valor
            .map(item => limpiarTexto(item))
            .filter(Boolean)
        )
      ]
    : [
        ...new Set(
          limpiarTexto(valor)
            .split(/[,;\n]/)
            .map(item => limpiarTexto(item))
            .filter(Boolean)
        )
      ];

export const claveEstacion = estacion =>
  `${estacion.proceso_codigo || ""}__${estacion.estacion_codigo || ""}`;

export const listarHabilidadesEstacion = async (
  db,
  empresaId
) => {
  const procesos = await listarProcesosEstaciones(
    db,
    empresaId
  );

  return aCatalogoProcesosRuta(procesos)
    .map(estacion => ({
      ...estacion,
      clave: claveEstacion(estacion),
      etiqueta:
        `${estacion.estacion_codigo} - ${estacion.estacion_nombre}` +
        ` (${estacion.proceso_nombre})`
    }))
    .filter(estacion =>
      estacion.estacion_codigo &&
      estacion.estacion_nombre
    )
    .sort((a, b) =>
      a.etiqueta.localeCompare(b.etiqueta)
    );
};

export const normalizarPersona = (
  id,
  data = {}
) => {
  const habilidadesIds =
    normalizarLista(
      data.habilidades_estacion_ids ||
      data.habilidades_ids ||
      []
    );

  return {
    id,
    codigo:
      normalizarCodigoPersona(
        data.codigo ||
        data.codigo_persona ||
        data.operario_codigo
      ),
    nombre: data.nombre || "",
    rol_laboral:
      normalizarRolLaboral(
        data.rol_laboral ||
        data.rol ||
        "operario"
      ),
    activo: data.activo !== false,
    empresa_id: data.empresa_id || "bba",
    planta_id: data.planta_id || "chile",
    equipo: data.equipo || "",
    habilidades_estacion_ids: habilidadesIds,
    habilidades_estaciones:
      Array.isArray(data.habilidades_estaciones)
        ? data.habilidades_estaciones
        : [],
    habilidades: normalizarLista(
      data.habilidades || []
    ),
    fecha_ingreso: data.fecha_ingreso || "",
    fecha_salida: data.fecha_salida || "",
    motivo_salida: data.motivo_salida || "",
    observacion: data.observacion || "",
    actualizado_en: data.actualizado_en || null
  };
};

export const listarPersonasRRHH = async (
  db,
  empresaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, COLECCION_PERSONAS),
      where("empresa_id", "==", empresaId)
    )
  );

  return snapshot.docs
    .map(documento =>
      normalizarPersona(
        documento.id,
        documento.data()
      )
    )
    .sort((a, b) =>
      (a.nombre || "").localeCompare(
        b.nombre || ""
      )
    );
};

export const siguienteCodigoPersona = (
  personas = []
) => {
  const ultimo = personas.reduce(
    (mayor, persona) => {
      const codigo = normalizarCodigoPersona(
        persona.codigo
      );
      const coincidencia =
        codigo.match(/^PER(\d+)$/);

      if (!coincidencia) {
        return mayor;
      }

      return Math.max(
        mayor,
        Number(coincidencia[1])
      );
    },
    0
  );

  return `PER${String(ultimo + 1).padStart(4, "0")}`;
};

export const obtenerSiguienteCodigoPersona = async (
  db,
  empresaId
) => siguienteCodigoPersona(
  await listarPersonasRRHH(db, empresaId)
);

const prepararPersona = (
  datos,
  perfil,
  habilidadesDisponibles
) => {
  const nombre = limpiarTexto(datos.nombre);
  const codigo = normalizarCodigoPersona(
    datos.codigo ||
    datos.codigo_persona ||
    datos.operario_codigo
  );
  const rolLaboral =
    normalizarRolLaboral(
      datos.rol_laboral || "operario"
    );
  const activo = datos.activo !== false;
  const habilidadesIds = normalizarLista(
    datos.habilidades_estacion_ids
  );
  const habilidadesEstaciones =
    habilidadesDisponibles.filter(estacion =>
      habilidadesIds.includes(estacion.clave)
    );

  if (!nombre) {
    throw new Error("Ingresa el nombre de la persona.");
  }

  if (!ROLES_LABORALES_RRHH.includes(rolLaboral)) {
    throw new Error(
      `Rol laboral inválido: ${rolLaboral}. Usa: ${ROLES_LABORALES_RRHH.join(", ")}.`
    );
  }

  return {
    codigo,
    codigo_persona: codigo,
    operario_codigo: codigo,
    nombre,
    rol_laboral: rolLaboral,
    rol: rolLaboral,
    activo,
    empresa_id: perfil.empresa_id,
    planta_id: datos.planta_id || "chile",
    equipo: activo ? (datos.equipo || "") : "",
    habilidades_estacion_ids: habilidadesIds,
    habilidades_estaciones: habilidadesEstaciones,
    habilidades: habilidadesEstaciones.map(
      estacion => estacion.estacion_nombre
    ),
    fecha_ingreso: limpiarTexto(datos.fecha_ingreso),
    fecha_salida: activo
      ? ""
      : limpiarTexto(datos.fecha_salida),
    motivo_salida: activo
      ? ""
      : limpiarTexto(datos.motivo_salida),
    observacion: limpiarTexto(datos.observacion)
  };
};

export const guardarPersonaRRHH = async (
  db,
  perfil,
  datos,
  habilidadesDisponibles
) => {
  const datosConCodigo = { ...datos };
  if (!datosConCodigo.id && !datosConCodigo.codigo) {
    datosConCodigo.codigo =
      await obtenerSiguienteCodigoPersona(
        db,
        perfil.empresa_id
      );
  }

  const persona = prepararPersona(
    datosConCodigo,
    perfil,
    habilidadesDisponibles
  );

  if (datos.id) {
    await updateDoc(
      doc(db, COLECCION_PERSONAS, datos.id),
      {
        ...persona,
        actualizado_por_id: perfil.uid || "",
        actualizado_por_nombre:
          perfil.nombre || "",
        actualizado_en: serverTimestamp()
      }
    );
    return datos.id;
  }

  const creado = await addDoc(
    collection(db, COLECCION_PERSONAS),
    {
      ...persona,
      creado_por_id: perfil.uid || "",
      creado_por_nombre: perfil.nombre || "",
      creado_en: serverTimestamp(),
      actualizado_por_id: perfil.uid || "",
      actualizado_por_nombre:
        perfil.nombre || "",
      actualizado_en: serverTimestamp()
    }
  );

  return creado.id;
};

const siguienteCodigoDesdeSet = codigos => {
  let mayor = 0;

  codigos.forEach(codigoActual => {
    const coincidencia =
      normalizarCodigoPersona(codigoActual)
        .match(/^PER(\d+)$/);

    if (coincidencia) {
      mayor = Math.max(
        mayor,
        Number(coincidencia[1])
      );
    }
  });

  return `PER${String(mayor + 1).padStart(4, "0")}`;
};

export const guardarPersonasRRHHMasivo = async (
  db,
  perfil,
  personasImportadas,
  habilidadesDisponibles,
  personasActuales = []
) => {
  const existentesPorCodigo = new Map(
    personasActuales
      .filter(persona => persona.codigo)
      .map(persona => [
        normalizarCodigoPersona(persona.codigo),
        persona
      ])
  );
  const codigosUsados = new Set(
    personasActuales
      .map(persona =>
        normalizarCodigoPersona(persona.codigo)
      )
      .filter(Boolean)
  );
  let batch = writeBatch(db);
  let operaciones = 0;
  let guardadas = 0;

  const confirmarBatch = async () => {
    if (operaciones === 0) {
      return;
    }

    await batch.commit();
    batch = writeBatch(db);
    operaciones = 0;
  };

  for (const personaImportada of personasImportadas) {
    let codigo = normalizarCodigoPersona(
      personaImportada.codigo ||
      personaImportada.codigo_persona ||
      personaImportada.operario_codigo
    );

    if (!codigo) {
      codigo = siguienteCodigoDesdeSet(
        codigosUsados
      );
    }

    codigosUsados.add(codigo);

    const existente =
      existentesPorCodigo.get(codigo);
    const referencia = existente?.id
      ? doc(db, COLECCION_PERSONAS, existente.id)
      : doc(
        db,
        COLECCION_PERSONAS,
        `${perfil.empresa_id}__${codigo}`
      );
    const persona = prepararPersona(
      {
        ...personaImportada,
        codigo
      },
      perfil,
      habilidadesDisponibles
    );

    batch.set(referencia, {
      ...persona,
      creado_por_id:
        existente?.creado_por_id ||
        perfil.uid ||
        "",
      creado_por_nombre:
        existente?.creado_por_nombre ||
        perfil.nombre ||
        "",
      creado_en:
        existente?.creado_en || serverTimestamp(),
      actualizado_por_id: perfil.uid || "",
      actualizado_por_nombre:
        perfil.nombre || "",
      actualizado_en: serverTimestamp()
    });

    guardadas += 1;
    operaciones += 1;

    if (operaciones === 450) {
      await confirmarBatch();
    }
  }

  await confirmarBatch();

  return guardadas;
};

export const eliminarPersonasRRHH = async (
  db,
  empresaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, COLECCION_PERSONAS),
      where("empresa_id", "==", empresaId)
    )
  );

  let eliminadas = 0;
  let batch = writeBatch(db);
  let operaciones = 0;

  for (const documento of snapshot.docs) {
    batch.delete(documento.ref);
    eliminadas += 1;
    operaciones += 1;

    if (operaciones === 450) {
      await batch.commit();
      batch = writeBatch(db);
      operaciones = 0;
    }
  }

  if (operaciones > 0) {
    await batch.commit();
  }

  return eliminadas;
};
