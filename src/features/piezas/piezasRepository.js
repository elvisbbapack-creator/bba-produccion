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

const COLECCION = "catalogo_piezas";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

export const normalizarCodigoPieza = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const codigoValido = codigo =>
  /^PZ\d{4,}$/.test(codigo);

const idPieza = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const prepararPieza = (
  datos,
  empresaId,
  id
) => ({
  id,
  empresa_id: empresaId,
  codigo: normalizarCodigoPieza(
    datos.codigo
  ),
  nombre: limpiarTexto(datos.nombre),
  medida: limpiarTexto(datos.medida),
  material_base_id: limpiarTexto(
    datos.material_base_id
  ),
  activo: datos.activo !== false
});

export const validarPieza = (
  pieza,
  existentes = []
) => {
  const errores = [];

  if (!codigoValido(pieza.codigo)) {
    errores.push(
      "El código de pieza debe usar el formato PZ0001."
    );
  }

  if (!pieza.nombre) {
    errores.push("La pieza requiere nombre.");
  }

  if (!pieza.medida) {
    errores.push("La pieza requiere medida.");
  }

  if (
    existentes.some(
      existente =>
        existente.codigo === pieza.codigo &&
        existente.id !== pieza.id
    )
  ) {
    errores.push(
      `El código ${pieza.codigo} ya existe.`
    );
  }

  return errores;
};

export const listarPiezas = async (
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

export const guardarPieza = async (
  db,
  empresaId,
  datos,
  existentes = []
) => {
  const codigo = normalizarCodigoPieza(
    datos.codigo
  );
  const referencia = doc(
    db,
    COLECCION,
    idPieza(empresaId, codigo)
  );
  const pieza = prepararPieza(
    datos,
    empresaId,
    referencia.id
  );
  const errores = validarPieza(
    pieza,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(referencia, {
    ...pieza,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  });

  return pieza;
};

export const actualizarPieza = async (
  db,
  empresaId,
  piezaId,
  datos,
  existentes = []
) => {
  const pieza = prepararPieza(
    datos,
    empresaId,
    piezaId
  );
  const errores = validarPieza(
    pieza,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await updateDoc(
    doc(db, COLECCION, piezaId),
    {
      nombre: pieza.nombre,
      medida: pieza.medida,
      material_base_id:
        pieza.material_base_id,
      activo: pieza.activo,
      actualizado_en: serverTimestamp()
    }
  );

  return pieza;
};
