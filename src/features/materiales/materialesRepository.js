import {
  collection,
  doc,
  getDoc,
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

export const APLICACIONES_CORTE_LASER = {
  NO_APLICA: "no_aplica",
  FIBRA: "fibra",
  CO2: "co2",
  AMBOS: "ambos"
};

export const normalizarAplicacionCorteLaser = (
  datos = {}
) => {
  const valor = limpiarTexto(
    datos.aplicacion_corte_laser
  );

  if (
    Object.values(APLICACIONES_CORTE_LASER).includes(
      valor
    )
  ) {
    return valor;
  }

  const velocidadFibra = numero(
    datos.velocidad_laser_fibra_m_min
  );
  const velocidadCo2 = numero(
    datos.velocidad_laser_co2_m_min
  );

  if (velocidadFibra > 0 && velocidadCo2 > 0) {
    return APLICACIONES_CORTE_LASER.AMBOS;
  }

  if (velocidadFibra > 0) {
    return APLICACIONES_CORTE_LASER.FIBRA;
  }

  if (velocidadCo2 > 0) {
    return APLICACIONES_CORTE_LASER.CO2;
  }

  return APLICACIONES_CORTE_LASER.NO_APLICA;
};

export const normalizarCodigoMaterial = (valor) =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const siguienteCodigoMaterial = (
  tipo,
  materiales = []
) => {
  const prefijo = normalizarCodigoMaterial(tipo);
  const usados = new Set(
    materiales
      .map(material =>
        normalizarCodigoMaterial(material.codigo)
      )
      .filter(codigo =>
        new RegExp(`^${prefijo}\\d{4,}$`).test(
          codigo
        )
      )
  );
  let correlativo = 1;

  while (
    usados.has(
      `${prefijo}${String(correlativo).padStart(4, "0")}`
    )
  ) {
    correlativo += 1;
  }

  return `${prefijo}${String(correlativo).padStart(4, "0")}`;
};

export const prepararProductosAsociadosMaterial = (
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
      producto_codigo: normalizarCodigoMaterial(
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

export const prepararSubproductosAsociadosMaterial = (
  subproductos = [],
  principal = {}
) => {
  const mapa = new Map();

  const agregar = subproducto => {
    const subproductoId = limpiarTexto(
      subproducto.subproducto_id ||
        subproducto.id
    );

    if (!subproductoId) {
      return;
    }

    mapa.set(subproductoId, {
      subproducto_id: subproductoId,
      subproducto_codigo:
        normalizarCodigoMaterial(
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
      producto_codigo:
        normalizarCodigoMaterial(
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

export const prepararMaterial = (
  datos,
  empresaId,
  id
) => {
  const tipo = datos.tipo;
  const esMateriaPrima =
    tipo === TIPOS_MATERIAL.MATERIA_PRIMA;
  const aplicacionCorteLaser = esMateriaPrima
    ? normalizarAplicacionCorteLaser(datos)
    : APLICACIONES_CORTE_LASER.NO_APLICA;
  const usaLaserFibra = [
    APLICACIONES_CORTE_LASER.FIBRA,
    APLICACIONES_CORTE_LASER.AMBOS
  ].includes(aplicacionCorteLaser);
  const usaLaserCo2 = [
    APLICACIONES_CORTE_LASER.CO2,
    APLICACIONES_CORTE_LASER.AMBOS
  ].includes(aplicacionCorteLaser);

  return {
    id,
    empresa_id: empresaId,
    codigo: normalizarCodigoMaterial(
      datos.codigo
    ),
    tipo,
    producto_id:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? limpiarTexto(datos.producto_id)
        : "",
    producto_codigo:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? normalizarCodigoMaterial(
            datos.producto_codigo
          )
        : "",
    producto_nombre:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? limpiarTexto(datos.producto_nombre)
        : "",
    productos_asociados:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? prepararProductosAsociadosMaterial(
            datos.productos_asociados,
            {
              producto_id: datos.producto_id,
              producto_codigo:
                datos.producto_codigo,
              producto_nombre:
                datos.producto_nombre
            }
          )
        : [],
    subproducto_id:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? limpiarTexto(datos.subproducto_id)
        : "",
    subproducto_codigo:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? normalizarCodigoMaterial(
            datos.subproducto_codigo
          )
        : "",
    subproducto_nombre:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? limpiarTexto(datos.subproducto_nombre)
        : "",
    subproductos_asociados:
      tipo === TIPOS_MATERIAL.RECURSO_FABRICACION
        ? prepararSubproductosAsociadosMaterial(
            datos.subproductos_asociados,
            {
              subproducto_id:
                datos.subproducto_id,
              subproducto_codigo:
                datos.subproducto_codigo,
              subproducto_nombre:
                datos.subproducto_nombre,
              producto_id: datos.producto_id,
              producto_codigo:
                datos.producto_codigo,
              producto_nombre:
                datos.producto_nombre
            }
          )
        : [],
    nombre: limpiarTexto(datos.nombre),
    unidad_medida: limpiarTexto(
      datos.unidad_medida
    ),
    costo_unitario_referencial: numero(
      datos.costo_unitario_referencial
    ),
    peso_kg_por_unidad: [
      TIPOS_MATERIAL.MATERIA_PRIMA,
      TIPOS_MATERIAL.SUMINISTRO
    ].includes(tipo)
      ? numero(datos.peso_kg_por_unidad)
      : 0,
    aplicacion_corte_laser: aplicacionCorteLaser,
    velocidad_laser_fibra_m_min: usaLaserFibra
      ? numero(datos.velocidad_laser_fibra_m_min)
      : 0,
    velocidad_laser_co2_m_min: usaLaserCo2
      ? numero(datos.velocidad_laser_co2_m_min)
      : 0,
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
      [
        TIPOS_MATERIAL.MATERIA_PRIMA,
        TIPOS_MATERIAL.SUMINISTRO
      ].includes(tipo)
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
  const existente = await getDoc(referencia);

  if (existente.exists()) {
    throw new Error(
      `El codigo ${codigo} ya existe. Actualiza la página para tomar el siguiente correlativo disponible.`
    );
  }

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
      producto_id: material.producto_id,
      producto_codigo: material.producto_codigo,
      producto_nombre: material.producto_nombre,
      productos_asociados:
        material.productos_asociados,
      subproducto_id: material.subproducto_id,
      subproducto_codigo:
        material.subproducto_codigo,
      subproducto_nombre:
        material.subproducto_nombre,
      subproductos_asociados:
        material.subproductos_asociados,
      unidad_medida: material.unidad_medida,
      costo_unitario_referencial:
        material.costo_unitario_referencial,
      peso_kg_por_unidad:
        material.peso_kg_por_unidad,
      aplicacion_corte_laser:
        material.aplicacion_corte_laser,
      velocidad_laser_fibra_m_min:
        material.velocidad_laser_fibra_m_min,
      velocidad_laser_co2_m_min:
        material.velocidad_laser_co2_m_min,
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
