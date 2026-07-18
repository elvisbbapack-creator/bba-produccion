import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

const COLECCION = "catalogo_procesos_estaciones";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

export const normalizarCodigoProceso = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const codigoProcesoValido = codigo =>
  /^PR\d{4,}$/.test(codigo);

const codigoEstacionValido = codigo =>
  /^ET\d{4,}$/.test(codigo);

const siguienteCodigo = (
  prefijo,
  items = [],
  selectorCodigo = item => item.codigo
) => {
  const usados = new Set(
    items
      .map(item =>
        normalizarCodigoProceso(
          selectorCodigo(item)
        )
      )
      .filter(codigo =>
        new RegExp(`^${prefijo}\\d{4,}$`).test(
          codigo
        )
      )
  );
  let correlativo = 1;

  while (
    usados.has(
      `${prefijo}${String(correlativo).padStart(4, "0")}`
    )
  ) {
    correlativo += 1;
  }

  return `${prefijo}${String(correlativo).padStart(4, "0")}`;
};

export const siguienteCodigoProceso = (
  procesos = []
) => siguienteCodigo("PR", procesos);

export const siguienteCodigoEstacion = (
  procesos = [],
  estacionesExtra = []
) => {
  const estaciones = procesos.flatMap(
    proceso => proceso.estaciones || []
  );

  return siguienteCodigo("ET", [
    ...estaciones,
    ...estacionesExtra
  ]);
};

const idProceso = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const prepararEstaciones = (
  estaciones = []
) =>
  estaciones
    .map(estacion => ({
      codigo: normalizarCodigoProceso(
        estacion.codigo
      ),
      nombre: limpiarTexto(estacion.nombre),
      activo: estacion.activo !== false
    }))
    .filter(estacion =>
      estacion.codigo || estacion.nombre
    );

export const prepararProceso = (
  datos,
  empresaId,
  id
) => ({
  id,
  empresa_id: empresaId,
  codigo: normalizarCodigoProceso(
    datos.codigo
  ),
  nombre: limpiarTexto(datos.nombre),
  estaciones: prepararEstaciones(
    datos.estaciones
  ),
  activo: datos.activo !== false
});

export const validarProceso = (
  proceso,
  existentes = []
) => {
  const errores = [];
  const estacionesUsadas = new Set();

  if (!codigoProcesoValido(proceso.codigo)) {
    errores.push(
      "El código de proceso debe usar el formato PR0001."
    );
  }

  if (!proceso.nombre) {
    errores.push("El proceso requiere nombre.");
  }

  proceso.estaciones.forEach((estacion, indice) => {
    const posicion = indice + 1;

    if (!codigoEstacionValido(estacion.codigo)) {
      errores.push(
        `La estación ${posicion} debe usar el formato ET0001.`
      );
    }

    if (!estacion.nombre) {
      errores.push(
        `La estación ${posicion} requiere nombre.`
      );
    }

    if (estacionesUsadas.has(estacion.codigo)) {
      errores.push(
        `La estación ${estacion.codigo} está repetida.`
      );
    }

    estacionesUsadas.add(estacion.codigo);
  });

  if (
    existentes.some(
      existente =>
        existente.codigo === proceso.codigo &&
        existente.id !== proceso.id
    )
  ) {
    errores.push(
      `El código ${proceso.codigo} ya existe.`
    );
  }

  return errores;
};

export const listarProcesosEstaciones = async (
  db,
  empresaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, COLECCION),
      where("empresa_id", "==", empresaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) =>
      (a.codigo || "").localeCompare(
        b.codigo || ""
      )
    );
};

export const guardarProceso = async (
  db,
  empresaId,
  datos,
  existentes = []
) => {
  const codigo = normalizarCodigoProceso(
    datos.codigo
  );
  const referencia = doc(
    db,
    COLECCION,
    idProceso(empresaId, codigo)
  );
  const proceso = prepararProceso(
    datos,
    empresaId,
    referencia.id
  );
  const errores = validarProceso(
    proceso,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(referencia, {
    ...proceso,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  });

  return proceso;
};

export const actualizarProceso = async (
  db,
  empresaId,
  procesoId,
  datos,
  existentes = []
) => {
  const proceso = prepararProceso(
    datos,
    empresaId,
    procesoId
  );
  const errores = validarProceso(
    proceso,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await updateDoc(
    doc(db, COLECCION, procesoId),
    {
      nombre: proceso.nombre,
      estaciones: proceso.estaciones,
      activo: proceso.activo,
      actualizado_en: serverTimestamp()
    }
  );

  return proceso;
};

export const aCatalogoProcesosRuta = (
  procesos = []
) => {
  const referencias = [];

  procesos.forEach(proceso => {
    (proceso.estaciones || []).forEach(
      estacion => {
        if (proceso.activo === false ||
          estacion.activo === false) {
          return;
        }

        referencias.push({
          proceso_codigo: proceso.codigo,
          proceso_nombre: proceso.nombre,
          estacion_codigo: estacion.codigo,
          estacion_nombre: estacion.nombre
        });
      }
    );
  });

  return referencias;
};
