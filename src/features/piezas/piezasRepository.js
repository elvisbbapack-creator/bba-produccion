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

const numeroDecimal = valor =>
  Number(limpiarTexto(valor).replace(",", "."));

export const normalizarCodigoPieza = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const siguienteCodigoPieza = (
  piezas = []
) => {
  const usados = new Set(
    piezas
      .map(pieza =>
        normalizarCodigoPieza(pieza.codigo)
      )
      .filter(codigo =>
        /^PZ\d{4,}$/.test(codigo)
      )
  );
  let correlativo = 1;

  while (
    usados.has(
      `PZ${String(correlativo).padStart(4, "0")}`
    )
  ) {
    correlativo += 1;
  }

  return `PZ${String(correlativo).padStart(4, "0")}`;
};

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
      const cantidad = numeroDecimal(
        material.cantidad
      );

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

export const prepararProductosAsociados = (
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
      producto_codigo: normalizarCodigoPieza(
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

export const prepararSubproductosAsociados = (
  subproductos = [],
  principal = {}
) => {
  const mapa = new Map();

  const agregar = subproducto => {
    const subproductoId = limpiarTexto(
      subproducto.subproducto_id || subproducto.id
    );

    if (!subproductoId) {
      return;
    }

    mapa.set(subproductoId, {
      subproducto_id: subproductoId,
      subproducto_codigo: normalizarCodigoPieza(
        subproducto.subproducto_codigo ||
          subproducto.codigo
      ),
      subproducto_nombre: limpiarTexto(
        subproducto.subproducto_nombre ||
          subproducto.nombre
      ),
      producto_id: limpiarTexto(
        subproducto.producto_id
      ),
      producto_codigo: normalizarCodigoPieza(
        subproducto.producto_codigo
      ),
      producto_nombre: limpiarTexto(
        subproducto.producto_nombre
      )
    });
  };

  agregar(principal);
  subproductos.forEach(agregar);

  return [...mapa.values()];
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
    relacion_principal_tipo:
      datos.relacion_principal_tipo ===
      "subproducto"
        ? "subproducto"
        : "producto",
    productos_asociados: prepararProductosAsociados(
      datos.productos_asociados,
      {
        producto_id: datos.producto_id,
        producto_codigo: datos.producto_codigo,
        producto_nombre: datos.producto_nombre
      }
    ),
    subproducto_id: limpiarTexto(
      datos.subproducto_id
    ),
    subproducto_codigo: normalizarCodigoPieza(
      datos.subproducto_codigo
    ),
    subproducto_nombre: limpiarTexto(
      datos.subproducto_nombre
    ),
    subproductos_asociados:
      prepararSubproductosAsociados(
        datos.subproductos_asociados,
        {
          subproducto_id: datos.subproducto_id,
          subproducto_codigo:
            datos.subproducto_codigo,
          subproducto_nombre:
            datos.subproducto_nombre,
          producto_id: datos.producto_id,
          producto_codigo: datos.producto_codigo,
          producto_nombre: datos.producto_nombre
        }
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
      relacion_principal_tipo:
        pieza.relacion_principal_tipo,
      productos_asociados:
        pieza.productos_asociados,
      subproducto_id: pieza.subproducto_id,
      subproducto_codigo:
        pieza.subproducto_codigo,
      subproducto_nombre:
        pieza.subproducto_nombre,
      subproductos_asociados:
        pieza.subproductos_asociados,
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
