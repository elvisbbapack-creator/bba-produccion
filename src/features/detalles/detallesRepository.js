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

const COLECCION = "catalogo_operaciones";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

export const normalizarCodigoOperacionCatalogo = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const codigoValido = codigo =>
  /^OP\d{4,}$/.test(codigo);

const idOperacionCatalogo = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const prepararOperacionCatalogo = (
  datos,
  empresaId,
  id
) => ({
  id,
  empresa_id: empresaId,
  codigo: normalizarCodigoOperacionCatalogo(
    datos.codigo
  ),
  nombre: limpiarTexto(datos.nombre),
  pieza_id: limpiarTexto(datos.pieza_id),
  pieza_codigo: limpiarTexto(
    datos.pieza_codigo
  ),
  pieza_nombre: limpiarTexto(
    datos.pieza_nombre
  ),
  medida: limpiarTexto(datos.medida),
  material_entrada_id: limpiarTexto(
    datos.material_entrada_id
  ),
  material_salida_id: limpiarTexto(
    datos.material_salida_id
  ),
  activo: datos.activo !== false
});

export const validarOperacionCatalogo = (
  operacion,
  existentes = []
) => {
  const errores = [];

  if (!codigoValido(operacion.codigo)) {
    errores.push(
      "El código de operación debe usar el formato OP0001."
    );
  }

  if (!operacion.nombre) {
    errores.push(
      "La operación requiere nombre."
    );
  }

  if (!operacion.pieza_id) {
    errores.push("Selecciona una pieza.");
  }

  if (!operacion.medida) {
    errores.push(
      "La operación requiere medida."
    );
  }

  if (!operacion.material_entrada_id) {
    errores.push(
      "Selecciona el material de entrada."
    );
  }

  if (
    existentes.some(
      existente =>
        existente.codigo === operacion.codigo &&
        existente.id !== operacion.id
    )
  ) {
    errores.push(
      `El código ${operacion.codigo} ya existe.`
    );
  }

  return errores;
};

export const listarOperacionesCatalogo = async (
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

export const guardarOperacionCatalogo = async (
  db,
  empresaId,
  datos,
  existentes = []
) => {
  const codigo = normalizarCodigoOperacionCatalogo(
    datos.codigo
  );
  const referencia = doc(
    db,
    COLECCION,
    idOperacionCatalogo(empresaId, codigo)
  );
  const operacion = prepararOperacionCatalogo(
    datos,
    empresaId,
    referencia.id
  );
  const errores = validarOperacionCatalogo(
    operacion,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(referencia, {
    ...operacion,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  });

  return operacion;
};

export const actualizarOperacionCatalogo = async (
  db,
  empresaId,
  operacionId,
  datos,
  existentes = []
) => {
  const operacionActualizada =
    prepararOperacionCatalogo(
      {
        ...datos,
        codigo: datos.codigo
      },
      empresaId,
      operacionId
    );
  const errores = validarOperacionCatalogo(
    operacionActualizada,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await updateDoc(
    doc(db, COLECCION, operacionId),
    {
      nombre: operacionActualizada.nombre,
      pieza_id: operacionActualizada.pieza_id,
      pieza_codigo:
        operacionActualizada.pieza_codigo,
      pieza_nombre:
        operacionActualizada.pieza_nombre,
      medida: operacionActualizada.medida,
      material_entrada_id:
        operacionActualizada.material_entrada_id,
      material_salida_id:
        operacionActualizada.material_salida_id,
      activo: operacionActualizada.activo,
      actualizado_en: serverTimestamp()
    }
  );

  return operacionActualizada;
};
