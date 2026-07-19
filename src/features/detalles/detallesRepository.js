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

const numeroDecimal = valor =>
  Number(limpiarTexto(valor).replace(",", "."));

export const normalizarCodigoOperacionCatalogo = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const codigoValido = codigo =>
  /^OP\d{4,}$/.test(codigo);

export const siguienteCodigoOperacionCatalogo = (
  operaciones = []
) => {
  const usados = new Set(
    operaciones
      .map(operacion =>
        normalizarCodigoOperacionCatalogo(
          operacion.codigo
        )
      )
      .filter(codigo =>
        /^OP\d{4,}$/.test(codigo)
      )
  );
  let correlativo = 1;

  while (
    usados.has(
      `OP${String(correlativo).padStart(4, "0")}`
    )
  ) {
    correlativo += 1;
  }

  return `OP${String(correlativo).padStart(4, "0")}`;
};

const idOperacionCatalogo = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const prepararMaterialesEntrada = (
  materiales = [],
  materialEntradaId = ""
) => {
  const materialesNormalizados = materiales
    .map(material => {
      const cantidad = numeroDecimal(
        material.cantidad
      );

      return {
        material_id: limpiarTexto(
          material.material_id
        ),
        material_codigo:
          normalizarCodigoOperacionCatalogo(
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
    limpiarTexto(materialEntradaId);

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

const prepararProductosAsociados = (
  productos = [],
  principal = {}
) => {
  const mapa = new Map();

  const agregar = producto => {
    const productoId = limpiarTexto(
      producto.producto_id || producto.id
    );

    if (!productoId) {
      return;
    }

    mapa.set(productoId, {
      producto_id: productoId,
      producto_codigo:
        normalizarCodigoOperacionCatalogo(
          producto.producto_codigo ||
            producto.codigo
        ),
      producto_nombre: limpiarTexto(
        producto.producto_nombre ||
          producto.nombre
      )
    });
  };

  agregar(principal);
  productos.forEach(agregar);

  return [...mapa.values()];
};

export const prepararOperacionCatalogo = (
  datos,
  empresaId,
  id
) => {
  const materialesEntrada =
    prepararMaterialesEntrada(
      datos.materiales_entrada,
      datos.material_entrada_id
    );

  return {
    id,
    empresa_id: empresaId,
    codigo: normalizarCodigoOperacionCatalogo(
      datos.codigo
    ),
    nombre: limpiarTexto(datos.nombre),
    producto_id: limpiarTexto(datos.producto_id),
    producto_codigo:
      normalizarCodigoOperacionCatalogo(
        datos.producto_codigo
      ),
    producto_nombre: limpiarTexto(
      datos.producto_nombre
    ),
    subproducto_id: limpiarTexto(
      datos.subproducto_id
    ),
    subproducto_codigo: limpiarTexto(
      datos.subproducto_codigo
    ),
    subproducto_nombre: limpiarTexto(
      datos.subproducto_nombre
    ),
    productos_asociados: prepararProductosAsociados(
      datos.productos_asociados,
      {
        producto_id: datos.producto_id,
        producto_codigo: datos.producto_codigo,
        producto_nombre: datos.producto_nombre
      }
    ),
    pieza_id: limpiarTexto(datos.pieza_id),
    pieza_codigo: limpiarTexto(
      datos.pieza_codigo
    ),
    pieza_nombre: limpiarTexto(
      datos.pieza_nombre
    ),
    medida: limpiarTexto(datos.medida),
    material_entrada_id:
      materialesEntrada[0]?.material_id ||
      limpiarTexto(datos.material_entrada_id),
    materiales_entrada: materialesEntrada,
    material_salida_id: limpiarTexto(
      datos.material_salida_id
    ),
    activo: datos.activo !== false
  };
};

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

  if (
    !operacion.material_entrada_id ||
    (operacion.materiales_entrada || [])
      .length === 0
  ) {
    errores.push(
      "Selecciona el material de entrada."
    );
  }

  const materialesUsados = new Set();
  (operacion.materiales_entrada || [])
    .forEach((material, indice) => {
      const posicion = indice + 1;

      if (!material.material_id) {
        errores.push(
          `El material de entrada ${posicion} requiere material.`
        );
      }

      if (
        !Number.isFinite(material.cantidad) ||
        material.cantidad <= 0
      ) {
        errores.push(
          `El material de entrada ${posicion} requiere cantidad mayor que cero.`
        );
      }

      if (
        material.material_id &&
        material.material_id ===
          operacion.material_salida_id
      ) {
        errores.push(
          "Un material de entrada no puede ser igual al RF de salida."
        );
      }

      if (
        material.material_id &&
        materialesUsados.has(material.material_id)
      ) {
        errores.push(
          `El material de entrada ${material.material_codigo || material.material_id} está repetido.`
        );
      }

      if (material.material_id) {
        materialesUsados.add(material.material_id);
      }
    });

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
      producto_id:
        operacionActualizada.producto_id,
      producto_codigo:
        operacionActualizada.producto_codigo,
      producto_nombre:
        operacionActualizada.producto_nombre,
      subproducto_id:
        operacionActualizada.subproducto_id,
      subproducto_codigo:
        operacionActualizada.subproducto_codigo,
      subproducto_nombre:
        operacionActualizada.subproducto_nombre,
      productos_asociados:
        operacionActualizada.productos_asociados,
      pieza_id: operacionActualizada.pieza_id,
      pieza_codigo:
        operacionActualizada.pieza_codigo,
      pieza_nombre:
        operacionActualizada.pieza_nombre,
      medida: operacionActualizada.medida,
      material_entrada_id:
        operacionActualizada.material_entrada_id,
      materiales_entrada:
        operacionActualizada.materiales_entrada,
      material_salida_id:
        operacionActualizada.material_salida_id,
      activo: operacionActualizada.activo,
      actualizado_en: serverTimestamp()
    }
  );

  return operacionActualizada;
};
