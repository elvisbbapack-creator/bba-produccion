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
import {
  TIPOS_MATERIAL,
  validarMaterial
} from "../../domain/produccionV2";

const COLECCION = "materiales";

const limpiarTexto = (valor) =>
  (valor || "").toString().trim();

export const normalizarCodigoMaterial = (valor) =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const prepararMaterial = (
  datos,
  empresaId,
  id
) => {
  const tipo = datos.tipo;

  return {
    id,
    empresa_id: empresaId,
    codigo: normalizarCodigoMaterial(
      datos.codigo
    ),
    tipo,
    nombre: limpiarTexto(datos.nombre),
    unidad_medida: limpiarTexto(
      datos.unidad_medida
    ),
    es_comprado:
      tipo === TIPOS_MATERIAL.MATERIA_PRIMA
        ? Boolean(datos.es_comprado)
        : false,
    activo: datos.activo !== false
  };
};

export const validarNuevoMaterial = (
  material,
  existentes = []
) => {
  const errores = validarMaterial(material);
  const repetido = existentes.some(
    existente =>
      existente.codigo === material.codigo &&
      existente.id !== material.id
  );

  if (repetido) {
    errores.push(
      `El codigo ${material.codigo} ya existe.`
    );
  }

  return errores;
};

const idMaterial = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const listarMateriales = async (
  db,
  empresaId
) => {
  const consulta = query(
    collection(db, COLECCION),
    where("empresa_id", "==", empresaId)
  );
  const snapshot = await getDocs(consulta);

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

export const crearMaterial = async (
  db,
  empresaId,
  datos
) => {
  const codigo = normalizarCodigoMaterial(
    datos.codigo
  );
  const referencia = doc(
    db,
    COLECCION,
    idMaterial(empresaId, codigo)
  );
  const material = prepararMaterial(
    datos,
    empresaId,
    referencia.id
  );
  const errores = validarNuevoMaterial(material);

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(referencia, {
    ...material,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  });

  return material;
};

export const cambiarEstadoMaterial = async (
  db,
  materialId,
  activo
) => {
  await updateDoc(
    doc(db, COLECCION, materialId),
    {
      activo,
      actualizado_en: serverTimestamp()
    }
  );
};
