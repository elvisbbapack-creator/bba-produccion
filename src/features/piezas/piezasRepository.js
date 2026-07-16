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

export const prepararMaterialesBase = (
  materiales = [],
  materialBaseId = ""
) => {
  const materialesNormalizados = materiales
    .map(material => {
      const cantidad = Number(material.cantidad);

      return {
        material_id: limpiarTexto(
          material.material_id
        ),
        material_codigo:
          normalizarCodigoPieza(
            material.material_codigo
          ),
        material_nombre: limpiarTexto(
          material.material_nombre
        ),
        cantidad: Number.isFinite(cantidad)
          ? cantidad
          : 1
      };
    })
    .filter(material => material.material_id);

  const materialSimple =
    limpiarTexto(materialBaseId);

  if (
    materialesNormalizados.length === 0 &&
    materialSimple
  ) {
    return [{
      material_id: materialSimple,
      material_codigo: "",
      material_nombre: "",
      cantidad: 1
    }];
  }

  return materialesNormalizados;
};

export const prepararPieza = (
  datos,
  empresaId,
  id
) => {
  const materialesBase =
    prepararMaterialesBase(
      datos.materiales_base,
      datos.material_base_id
    );

  return {
    id,
    empresa_id: empresaId,
    codigo: normalizarCodigoPieza(
      datos.codigo
    ),
    producto_id: limpiarTexto(datos.producto_id),
    producto_codigo: normalizarCodigoPieza(
      datos.producto_codigo
    ),
    producto_nombre: limpiarTexto(
      datos.producto_nombre
    ),
    nombre: limpiarTexto(datos.nombre),
    medida: limpiarTexto(datos.medida),
    material_base_id:
      materialesBase[0]?.material_id ||
      limpiarTexto(datos.material_base_id),
    materiales_base: materialesBase,
    activo: datos.activo !== false
  };
};

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

  const materialesUsados = new Set();
  (pieza.materiales_base || []).forEach(
    (material, indice) => {
      const posicion = indice + 1;

      if (!material.material_id) {
        errores.push(
          `El material base ${posicion} requiere material.`
        );
      }

      if (
        !Number.isFinite(material.cantidad) ||
        material.cantidad <= 0
      ) {
        errores.push(
          `El material base ${posicion} requiere cantidad mayor que cero.`
        );
      }

      if (materialesUsados.has(material.material_id)) {
        errores.push(
          `El material base ${material.material_codigo || material.material_id} está repetido.`
        );
      }

      materialesUsados.add(material.material_id);
    }
  );

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
      producto_id: pieza.producto_id,
      producto_codigo: pieza.producto_codigo,
      producto_nombre: pieza.producto_nombre,
      medida: pieza.medida,
      material_base_id:
        pieza.material_base_id,
      materiales_base:
        pieza.materiales_base,
      activo: pieza.activo,
      actualizado_en: serverTimestamp()
    }
  );

  return pieza;
};
