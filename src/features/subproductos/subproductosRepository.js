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

const COLECCION = "catalogo_subproductos";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

const normalizarCodigo = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const normalizarCodigoSubproducto =
  normalizarCodigo;

export const siguienteCodigoSubproducto = (
  subproductos = []
) => {
  const usados = new Set(
    subproductos
      .map(subproducto =>
        normalizarCodigoSubproducto(
          subproducto.codigo
        )
      )
      .filter(codigo =>
        /^SUB\d{4,}$/.test(codigo)
      )
  );
  let correlativo = 1;

  while (
    usados.has(
      `SUB${String(correlativo).padStart(4, "0")}`
    )
  ) {
    correlativo += 1;
  }

  return `SUB${String(correlativo).padStart(4, "0")}`;
};

const codigoValido = codigo =>
  /^SUB\d{4,}$/.test(codigo);

const idSubproducto = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const prepararComponentesSubproducto =
  (componentes = []) =>
    componentes
      .map(componente => ({
        pieza_id: limpiarTexto(
          componente.pieza_id
        ),
        pieza_codigo: normalizarCodigo(
          componente.pieza_codigo
        ),
        pieza_nombre: limpiarTexto(
          componente.pieza_nombre
        ),
        cantidad: Number(componente.cantidad)
      }))
      .filter(componente =>
        componente.pieza_id ||
        componente.pieza_codigo ||
        componente.pieza_nombre ||
        Number.isFinite(componente.cantidad)
      );

export const prepararSubproducto = (
  datos,
  empresaId,
  id
) => ({
  id,
  empresa_id: empresaId,
  codigo: normalizarCodigoSubproducto(
    datos.codigo
  ),
  nombre: limpiarTexto(datos.nombre),
  producto_id: limpiarTexto(
    datos.producto_id
  ),
  producto_codigo: normalizarCodigo(
    datos.producto_codigo
  ),
  producto_nombre: limpiarTexto(
    datos.producto_nombre
  ),
  pieza_salida_id: limpiarTexto(
    datos.pieza_salida_id
  ),
  pieza_salida_codigo: normalizarCodigo(
    datos.pieza_salida_codigo
  ),
  pieza_salida_nombre: limpiarTexto(
    datos.pieza_salida_nombre
  ),
  componentes:
    prepararComponentesSubproducto(
      datos.componentes
    ),
  activo: datos.activo !== false
});

export const validarSubproducto = (
  subproducto,
  existentes = []
) => {
  const errores = [];

  if (!codigoValido(subproducto.codigo)) {
    errores.push(
      "El codigo de subproducto debe usar el formato SUB0001."
    );
  }

  if (!subproducto.nombre) {
    errores.push(
      "El subproducto requiere nombre."
    );
  }

  if (!subproducto.producto_id) {
    errores.push(
      "Selecciona el producto al que pertenece."
    );
  }

  if (!subproducto.pieza_salida_id) {
    errores.push(
      "Selecciona la pieza de salida Armado."
    );
  }

  if (
    subproducto.pieza_salida_nombre &&
    !subproducto.pieza_salida_nombre
      .toLowerCase()
      .includes("armado")
  ) {
    errores.push(
      "La pieza de salida debe ser la pieza Armado del subproducto."
    );
  }

  if (subproducto.componentes.length === 0) {
    errores.push(
      "Agrega al menos una pieza componente."
    );
  }

  const piezasUsadas = new Set();
  subproducto.componentes.forEach(
    (componente, indice) => {
      const posicion = indice + 1;

      if (!componente.pieza_id) {
        errores.push(
          `El componente ${posicion} requiere pieza.`
        );
      }

      if (
        !Number.isFinite(componente.cantidad) ||
        componente.cantidad <= 0
      ) {
        errores.push(
          `El componente ${posicion} requiere cantidad mayor que cero.`
        );
      }

      if (
        componente.pieza_id &&
        componente.pieza_id ===
          subproducto.pieza_salida_id
      ) {
        errores.push(
          "La pieza de salida no puede ser tambien componente."
        );
      }

      if (
        componente.pieza_id &&
        piezasUsadas.has(componente.pieza_id)
      ) {
        errores.push(
          `La pieza ${componente.pieza_codigo || componente.pieza_nombre} esta repetida en los componentes.`
        );
      }

      if (componente.pieza_id) {
        piezasUsadas.add(componente.pieza_id);
      }
    }
  );

  if (
    existentes.some(
      existente =>
        existente.codigo ===
          subproducto.codigo &&
        existente.id !== subproducto.id
    )
  ) {
    errores.push(
      `El codigo ${subproducto.codigo} ya existe.`
    );
  }

  return errores;
};

export const listarSubproductos = async (
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

export const guardarSubproducto = async (
  db,
  empresaId,
  datos,
  existentes = []
) => {
  const codigo = normalizarCodigoSubproducto(
    datos.codigo
  );
  const referencia = doc(
    db,
    COLECCION,
    idSubproducto(empresaId, codigo)
  );
  const subproducto = prepararSubproducto(
    datos,
    empresaId,
    referencia.id
  );
  const errores = validarSubproducto(
    subproducto,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(referencia, {
    ...subproducto,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  });

  return subproducto;
};

export const actualizarSubproducto = async (
  db,
  empresaId,
  subproductoId,
  datos,
  existentes = []
) => {
  const subproducto = prepararSubproducto(
    datos,
    empresaId,
    subproductoId
  );
  const errores = validarSubproducto(
    subproducto,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await updateDoc(
    doc(db, COLECCION, subproductoId),
    {
      nombre: subproducto.nombre,
      producto_id: subproducto.producto_id,
      producto_codigo:
        subproducto.producto_codigo,
      producto_nombre:
        subproducto.producto_nombre,
      pieza_salida_id:
        subproducto.pieza_salida_id,
      pieza_salida_codigo:
        subproducto.pieza_salida_codigo,
      pieza_salida_nombre:
        subproducto.pieza_salida_nombre,
      componentes: subproducto.componentes,
      activo: subproducto.activo,
      actualizado_en: serverTimestamp()
    }
  );

  return subproducto;
};
