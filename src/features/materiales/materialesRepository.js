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

const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
};

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
    costo_unitario_referencial: numero(
      datos.costo_unitario_referencial
    ),
    moneda: limpiarTexto(datos.moneda) || "CLP",
    minimo_compra: numero(datos.minimo_compra),
    proveedor_preferente_id:
      datos.proveedor_preferente_id || "",
    proveedor_preferente_codigo: limpiarTexto(
      datos.proveedor_preferente_codigo
    ),
    proveedor_preferente_nombre: limpiarTexto(
      datos.proveedor_preferente_nombre
    ),
    costo_origen:
      limpiarTexto(datos.costo_origen) ||
      "catalogo_material",
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

export const actualizarMaterial = async (
  db,
  empresaId,
  materialId,
  datos,
  existentes = []
) => {
  const material = prepararMaterial(
    datos,
    empresaId,
    materialId
  );
  const errores = validarNuevoMaterial(
    material,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await updateDoc(
    doc(db, COLECCION, materialId),
    {
      nombre: material.nombre,
      unidad_medida: material.unidad_medida,
      costo_unitario_referencial:
        material.costo_unitario_referencial,
      moneda: material.moneda,
      minimo_compra: material.minimo_compra,
      proveedor_preferente_id:
        material.proveedor_preferente_id,
      proveedor_preferente_codigo:
        material.proveedor_preferente_codigo,
      proveedor_preferente_nombre:
        material.proveedor_preferente_nombre,
      costo_origen: material.costo_origen,
      es_comprado: material.es_comprado,
      activo: material.activo,
      actualizado_en: serverTimestamp()
    }
  );

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
