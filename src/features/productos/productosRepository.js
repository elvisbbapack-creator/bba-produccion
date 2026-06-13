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
  activo: datos.activo !== false,
  version_ruta_activa:
    datos.version_ruta_activa || null
});

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

export const prepararOperacionRuta = (
  datos,
  productoId,
  id
) => {
  const dependenciaId =
    limpiarTexto(datos.dependencia_id);

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
      limpiarTexto(datos.material_entrada_id),
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
      "DT"
    )
  ) {
    errores.push(
      "El codigo de operacion debe usar el formato DT0001."
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
