import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import {
  validarRuta
} from "../../domain/produccionV2";

const limpiarTexto = (valor) =>
  (valor || "").toString().trim();

const normalizarCodigo = (valor) =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const normalizarCodigoProducto =
  normalizarCodigo;

export const normalizarCodigoOperacion =
  normalizarCodigo;

const codigoValido = (codigo, prefijo) =>
  new RegExp(`^${prefijo}\\d{4,}$`).test(
    codigo
  );

export const prepararProducto = (
  datos,
  empresaId,
  id
) => ({
  id,
  empresa_id: empresaId,
  codigo: normalizarCodigoProducto(
    datos.codigo
  ),
  nombre: limpiarTexto(datos.nombre),
  familia: limpiarTexto(datos.familia),
  composicion:
    prepararComposicionProducto(
      datos.composicion
    ),
  activo: datos.activo !== false,
  version_ruta_activa:
    datos.version_ruta_activa || null
});

export const prepararComposicionProducto = (
  composicion = []
) =>
  composicion
    .map(item => ({
      tipo: normalizarCodigo(item.tipo),
      categoria: limpiarTexto(item.categoria),
      item_id: limpiarTexto(item.item_id),
      item_codigo: normalizarCodigo(
        item.item_codigo
      ),
      item_nombre: limpiarTexto(
        item.item_nombre
      ),
      cantidad: Number(item.cantidad)
    }))
    .filter(item =>
      item.tipo ||
      item.item_id ||
      item.item_codigo ||
      item.item_nombre ||
      Number.isFinite(item.cantidad)
    );

export const validarComposicionProducto = (
  composicion = []
) => {
  const errores = [];
  const usados = new Set();

  composicion.forEach((item, indice) => {
    const posicion = indice + 1;

    if (
      !["SUBPRODUCTO", "PIEZA", "MATERIAL"]
        .includes(item.tipo)
    ) {
      errores.push(
        `El item ${posicion} requiere tipo válido.`
      );
    }

    if (!item.item_id) {
      errores.push(
        `El item ${posicion} requiere selección.`
      );
    }

    if (
      !Number.isFinite(item.cantidad) ||
      item.cantidad <= 0
    ) {
      errores.push(
        `El item ${posicion} requiere cantidad mayor que cero.`
      );
    }

    const clave = `${item.tipo}:${item.item_id}`;
    if (item.item_id && usados.has(clave)) {
      errores.push(
        `El item ${item.item_codigo || item.item_nombre} está repetido.`
      );
    }
    usados.add(clave);
  });

  return errores;
};

export const validarProducto = (
  producto,
  existentes = []
) => {
  const errores = [];

  if (
    !codigoValido(producto.codigo, "PCL")
  ) {
    errores.push(
      "El codigo debe usar el formato PCL0001."
    );
  }

  if (!producto.nombre) {
    errores.push("El producto requiere nombre.");
  }

  if (
    existentes.some(
      existente =>
        existente.codigo === producto.codigo &&
        existente.id !== producto.id
    )
  ) {
    errores.push(
      `El codigo ${producto.codigo} ya existe.`
    );
  }

  return errores;
};

const prepararMaterialesEntrada = (
  materiales = [],
  materialEntradaId = ""
) => {
  const materialesNormalizados = materiales
    .map(material => {
      const cantidad = Number(material.cantidad);

      return {
        material_id: limpiarTexto(
          material.material_id
        ),
        material_codigo: normalizarCodigo(
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

export const prepararOperacionRuta = (
  datos,
  productoId,
  id
) => {
  const dependenciaId =
    limpiarTexto(datos.dependencia_id);
  const materialesEntrada =
    prepararMaterialesEntrada(
      datos.materiales_entrada,
      datos.material_entrada_id
    );

  return {
    id,
    empresa_id: datos.empresa_id,
    producto_id: productoId,
    secuencia: Number(datos.secuencia),
    operacion_id: id,
    operacion_codigo:
      normalizarCodigoOperacion(datos.codigo),
    operacion_nombre:
      limpiarTexto(datos.nombre),
    pieza_id: limpiarTexto(datos.pieza_id),
    pieza_codigo:
      normalizarCodigo(datos.pieza_codigo),
    pieza_nombre:
      limpiarTexto(datos.pieza_nombre),
    subproducto_id:
      limpiarTexto(datos.subproducto_id),
    subproducto_codigo:
      normalizarCodigo(datos.subproducto_codigo),
    subproducto_nombre:
      limpiarTexto(datos.subproducto_nombre),
    proceso_id:
      normalizarCodigo(datos.proceso_codigo),
    proceso_nombre:
      limpiarTexto(datos.proceso_nombre),
    subproceso_id:
      normalizarCodigo(
        datos.subproceso_codigo
      ),
    subproceso_nombre:
      limpiarTexto(datos.subproceso_nombre),
    material_entrada_id:
      materialesEntrada[0]?.material_id ||
      limpiarTexto(datos.material_entrada_id),
    materiales_entrada: materialesEntrada,
    material_salida_id:
      limpiarTexto(datos.material_salida_id),
    medida: limpiarTexto(datos.medida),
    unidades_por_producto: Number(
      datos.unidades_por_producto
    ),
    unidades_por_hora: Number(
      datos.unidades_por_hora
    ),
    dependencias: dependenciaId
      ? [{
          ruta_operacion_id: dependenciaId,
          porcentaje_minimo_avance: Number(
            datos.porcentaje_minimo_avance
          ),
          requiere_material_disponible: true
        }]
      : [],
    activo: true
  };
};

export const validarOperacionBasica = (
  operacion,
  existentes = []
) => {
  const errores = [];

  if (
    !codigoValido(
      operacion.operacion_codigo,
      "OP"
    )
  ) {
    errores.push(
      "El codigo de operacion debe usar el formato OP0001."
    );
  }

  if (!operacion.operacion_nombre) {
    errores.push(
      "La operacion requiere nombre."
    );
  }

  if (!operacion.proceso_id) {
    errores.push(
      "La operacion requiere codigo de proceso."
    );
  }

  if (!operacion.proceso_nombre) {
    errores.push(
      "La operacion requiere nombre de proceso."
    );
  }

  if (!operacion.subproceso_id) {
    errores.push(
      "La operacion requiere codigo de subproceso."
    );
  }

  if (!operacion.subproceso_nombre) {
    errores.push(
      "La operacion requiere nombre de subproceso."
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
        existente.operacion_codigo ===
          operacion.operacion_codigo &&
        existente.id !== operacion.id
    )
  ) {
    errores.push(
      `La operacion ${operacion.operacion_codigo} ya existe en la ruta.`
    );
  }

  return errores;
};

export const validarRecalibracionEstandar = ({
  valorAnterior,
  valorNuevo,
  motivo
}) => {
  const errores = [];
  const anterior = Number(valorAnterior);
  const nuevo = Number(valorNuevo);

  if (!Number.isFinite(nuevo) || nuevo <= 0) {
    errores.push(
      "El nuevo estándar debe ser mayor que cero."
    );
  }

  if (
    Number.isFinite(anterior) &&
    nuevo === anterior
  ) {
    errores.push(
      "El nuevo estándar debe ser diferente al actual."
    );
  }

  if (limpiarTexto(motivo).length < 10) {
    errores.push(
      "Indica un motivo de al menos 10 caracteres."
    );
  }

  return errores;
};

const idProducto = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

const idRuta = (version) => `v${version}`;

const idOperacion = (codigo) =>
  normalizarCodigoOperacion(codigo);

export const listarProductos = async (
  db,
  empresaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "productos"),
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

export const crearProductoConRuta = async (
  db,
  empresaId,
  datos
) => {
  const codigo = normalizarCodigoProducto(
    datos.codigo
  );
  const productoRef = doc(
    db,
    "productos",
    idProducto(empresaId, codigo)
  );
  const rutaRef = doc(
    db,
    "productos",
    productoRef.id,
    "rutas",
    idRuta(1)
  );
  const producto = prepararProducto(
    datos,
    empresaId,
    productoRef.id
  );
  const errores = validarProducto(producto);

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const lote = writeBatch(db);
  lote.set(productoRef, {
    ...producto,
    fecha_creacion: serverTimestamp(),
    fecha_actualizacion: serverTimestamp()
  });
  lote.set(rutaRef, {
    id: rutaRef.id,
    empresa_id: empresaId,
    producto_id: productoRef.id,
    version: 1,
    estado: "borrador",
    creada_por: datos.creada_por || "",
    fecha_creacion: serverTimestamp(),
    fecha_actualizacion: serverTimestamp()
  });
  await lote.commit();

  return producto;
};

export const obtenerRuta = async (
  db,
  productoId,
  empresaId,
  version = 1
) => {
  const rutaId = idRuta(version);
  const rutaRef = doc(
    db,
    "productos",
    productoId,
    "rutas",
    rutaId
  );
  const rutaSnap = await getDoc(rutaRef);
  const operacionesSnap = await getDocs(
    query(
      collection(
        db,
        "productos",
        productoId,
        "rutas",
        rutaId,
        "operaciones"
      ),
      where("empresa_id", "==", empresaId)
    )
  );

  return {
    id: rutaId,
    producto_id: productoId,
    version,
    estado:
      rutaSnap.exists()
        ? rutaSnap.data().estado
        : "borrador",
    operaciones: operacionesSnap.docs
      .map(documento => ({
        id: documento.id,
        ...documento.data()
      }))
      .sort(
        (a, b) =>
          Number(a.secuencia) -
          Number(b.secuencia)
      )
  };
};

export const guardarOperacionRuta = async (
  db,
  empresaId,
  productoId,
  version,
  datos,
  existentes = []
) => {
  const codigo = normalizarCodigoOperacion(
    datos.codigo
  );
  const operacionRef = doc(
    db,
    "productos",
    productoId,
    "rutas",
    idRuta(version),
    "operaciones",
    idOperacion(codigo)
  );
  const operacion = prepararOperacionRuta(
    {
      ...datos,
      empresa_id: empresaId
    },
    productoId,
    operacionRef.id
  );
  const errores = validarOperacionBasica(
    operacion,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(operacionRef, {
    ...operacion,
    fecha_creacion: serverTimestamp(),
    fecha_actualizacion: serverTimestamp()
  });

  return operacion;
};

export const publicarRuta = async ({
  db,
  empresaId,
  productoId,
  version,
  operaciones,
  materiales
}) => {
  const ruta = {
    producto_id: productoId,
    version,
    operaciones
  };
  const errores = validarRuta(
    ruta,
    materiales
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const productoRef = doc(
    db,
    "productos",
    productoId
  );
  const rutaRef = doc(
    db,
    "productos",
    productoId,
    "rutas",
    idRuta(version)
  );
  const lote = writeBatch(db);

  lote.update(productoRef, {
    version_ruta_activa: version,
    version_ruta_borrador: null,
    fecha_actualizacion: serverTimestamp()
  });
  lote.update(rutaRef, {
    estado: "publicada",
    vigente_desde: serverTimestamp(),
    fecha_actualizacion: serverTimestamp(),
    empresa_id: empresaId
  });
  await lote.commit();
};

export const actualizarComposicionProducto = async (
  db,
  productoId,
  composicion
) => {
  const composicionNormalizada =
    prepararComposicionProducto(composicion);
  const errores =
    validarComposicionProducto(
      composicionNormalizada
    );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await updateDoc(
    doc(db, "productos", productoId),
    {
      composicion: composicionNormalizada,
      fecha_actualizacion: serverTimestamp()
    }
  );

  return composicionNormalizada;
};

export const crearVersionBorradorRuta = async ({
  db,
  empresaId,
  productoId,
  versionActual,
  operaciones,
  perfil
}) => {
  const versionNueva =
    Number(versionActual || 1) + 1;
  const productoRef = doc(
    db,
    "productos",
    productoId
  );
  const rutaNuevaRef = doc(
    db,
    "productos",
    productoId,
    "rutas",
    idRuta(versionNueva)
  );
  const lote = writeBatch(db);

  lote.set(rutaNuevaRef, {
    id: rutaNuevaRef.id,
    empresa_id: empresaId,
    producto_id: productoId,
    version: versionNueva,
    estado: "borrador",
    version_origen: Number(versionActual || 1),
    creada_por: perfil.uid,
    fecha_creacion: serverTimestamp(),
    fecha_actualizacion: serverTimestamp()
  });

  operaciones.forEach(operacion => {
    const operacionRef = doc(
      db,
      "productos",
      productoId,
      "rutas",
      idRuta(versionNueva),
      "operaciones",
      operacion.id
    );
    const copia = {
      ...operacion,
      ruta_version: versionNueva,
      fecha_creacion: serverTimestamp(),
      fecha_actualizacion: serverTimestamp()
    };

    delete copia.id;

    lote.set(operacionRef, copia);
  });

  lote.update(productoRef, {
    version_ruta_borrador: versionNueva,
    fecha_actualizacion: serverTimestamp()
  });

  await lote.commit();

  return { version: versionNueva };
};

export const recalibrarEstandarRuta = async ({
  db,
  empresaId,
  productoId,
  versionActual,
  operaciones,
  operacionId,
  unidadesPorHora,
  motivo,
  perfil
}) => {
  const operacionActual = operaciones.find(
    operacion => operacion.id === operacionId
  );

  if (!operacionActual) {
    throw new Error(
      "No se encontró la operación seleccionada."
    );
  }

  const errores = validarRecalibracionEstandar({
    valorAnterior:
      operacionActual.unidades_por_hora,
    valorNuevo: unidadesPorHora,
    motivo
  });

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const versionNueva =
    Number(versionActual) + 1;
  const productoRef = doc(
    db,
    "productos",
    productoId
  );
  const rutaActualRef = doc(
    db,
    "productos",
    productoId,
    "rutas",
    idRuta(versionActual)
  );
  const rutaNuevaRef = doc(
    db,
    "productos",
    productoId,
    "rutas",
    idRuta(versionNueva)
  );
  const lote = writeBatch(db);
  const motivoLimpio = limpiarTexto(motivo);
  const nuevoEstandar = Number(
    unidadesPorHora
  );

  lote.set(rutaNuevaRef, {
    id: rutaNuevaRef.id,
    empresa_id: empresaId,
    producto_id: productoId,
    version: versionNueva,
    estado: "publicada",
    version_origen: Number(versionActual),
    motivo_nueva_version: motivoLimpio,
    creada_por: perfil.uid,
    vigente_desde: serverTimestamp(),
    fecha_creacion: serverTimestamp(),
    fecha_actualizacion: serverTimestamp()
  });

  operaciones.forEach(operacion => {
    const esRecalibrada =
      operacion.id === operacionId;
    const operacionRef = doc(
      db,
      "productos",
      productoId,
      "rutas",
      idRuta(versionNueva),
      "operaciones",
      operacion.id
    );
    const copia = {
      ...operacion,
      unidades_por_hora: esRecalibrada
        ? nuevoEstandar
        : Number(operacion.unidades_por_hora),
      ruta_version: versionNueva,
      fecha_creacion: serverTimestamp(),
      fecha_actualizacion: serverTimestamp()
    };

    delete copia.id;

    if (esRecalibrada) {
      copia.estandar_anterior = Number(
        operacion.unidades_por_hora
      );
      copia.estandar_motivo = motivoLimpio;
      copia.estandar_actualizado_por =
        perfil.uid;
      copia.estandar_actualizado_en =
        serverTimestamp();
    }

    lote.set(operacionRef, copia);
  });

  lote.update(rutaActualRef, {
    estado: "retirada",
    fecha_actualizacion: serverTimestamp()
  });
  lote.update(productoRef, {
    version_ruta_activa: versionNueva,
    fecha_actualizacion: serverTimestamp()
  });
  await lote.commit();

  return {
    version: versionNueva,
    unidades_por_hora: nuevoEstandar
  };
};

export const retirarProducto = async (
  db,
  productoId,
  activo
) => {
  await updateDoc(
    doc(db, "productos", productoId),
    {
      activo,
      fecha_actualizacion: serverTimestamp()
    }
  );
};
