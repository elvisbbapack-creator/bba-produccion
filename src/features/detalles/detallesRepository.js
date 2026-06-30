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

const COLECCION = "catalogo_detalles";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

export const normalizarCodigoDetalle = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const codigoValido = codigo =>
  /^DT\d{4,}$/.test(codigo);

const idDetalle = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const prepararDetalle = (
  datos,
  empresaId,
  id
) => ({
  id,
  empresa_id: empresaId,
  codigo: normalizarCodigoDetalle(
    datos.codigo
  ),
  nombre: limpiarTexto(datos.nombre),
  medida: limpiarTexto(datos.medida),
  material_entrada_id: limpiarTexto(
    datos.material_entrada_id
  ),
  material_salida_id: limpiarTexto(
    datos.material_salida_id
  ),
  activo: datos.activo !== false
});

export const validarDetalle = (
  detalle,
  existentes = []
) => {
  const errores = [];

  if (!codigoValido(detalle.codigo)) {
    errores.push(
      "El código DT debe usar el formato DT0001."
    );
  }

  if (!detalle.nombre) {
    errores.push("El DT requiere nombre.");
  }

  if (!detalle.medida) {
    errores.push("El DT requiere medida.");
  }

  if (!detalle.material_entrada_id) {
    errores.push(
      "Selecciona el material de entrada."
    );
  }

  if (
    existentes.some(
      existente =>
        existente.codigo === detalle.codigo &&
        existente.id !== detalle.id
    )
  ) {
    errores.push(
      `El código ${detalle.codigo} ya existe.`
    );
  }

  return errores;
};

export const listarDetalles = async (
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

export const guardarDetalle = async (
  db,
  empresaId,
  datos,
  existentes = []
) => {
  const codigo = normalizarCodigoDetalle(
    datos.codigo
  );
  const referencia = doc(
    db,
    COLECCION,
    idDetalle(empresaId, codigo)
  );
  const detalle = prepararDetalle(
    datos,
    empresaId,
    referencia.id
  );
  const errores = validarDetalle(
    detalle,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(referencia, {
    ...detalle,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  });

  return detalle;
};

export const actualizarDetalle = async (
  db,
  empresaId,
  detalleId,
  datos,
  existentes = []
) => {
  const detalleActualizado =
    prepararDetalle(
      {
        ...datos,
        codigo: datos.codigo
      },
      empresaId,
      detalleId
    );
  const errores = validarDetalle(
    detalleActualizado,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await updateDoc(
    doc(db, COLECCION, detalleId),
    {
      nombre: detalleActualizado.nombre,
      medida: detalleActualizado.medida,
      material_entrada_id:
        detalleActualizado.material_entrada_id,
      material_salida_id:
        detalleActualizado.material_salida_id,
      activo: detalleActualizado.activo,
      actualizado_en: serverTimestamp()
    }
  );

  return detalleActualizado;
};
