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

export const TIPOS_TERCERO = {
  CLIENTE: "cliente",
  PROVEEDOR: "proveedor"
};

export const PREFIJOS_TERCERO = {
  [TIPOS_TERCERO.CLIENTE]: "CLI",
  [TIPOS_TERCERO.PROVEEDOR]: "PRV"
};

const COLECCIONES = {
  [TIPOS_TERCERO.CLIENTE]: "clientes",
  [TIPOS_TERCERO.PROVEEDOR]: "proveedores"
};

const limpiarTexto = valor =>
  (valor || "").toString().trim();

export const normalizarCodigoTercero = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const siguienteCodigoTercero = (
  terceros = [],
  tipo = TIPOS_TERCERO.CLIENTE
) => {
  const prefijo =
    PREFIJOS_TERCERO[tipo] ||
    PREFIJOS_TERCERO[TIPOS_TERCERO.CLIENTE];
  const patron = new RegExp(
    `^${prefijo}(\\d{3,})$`
  );
  const usados = new Set(
    terceros
      .map(tercero =>
        normalizarCodigoTercero(
          tercero.codigo
        )
      )
      .filter(codigo => patron.test(codigo))
  );
  let correlativo = 1;

  while (
    usados.has(
      `${prefijo}${String(correlativo).padStart(3, "0")}`
    )
  ) {
    correlativo += 1;
  }

  return `${prefijo}${String(correlativo).padStart(3, "0")}`;
};

const idTercero = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const prepararTercero = (
  datos,
  empresaId,
  tipo,
  id
) => ({
  id,
  empresa_id: empresaId,
  tipo,
  codigo: normalizarCodigoTercero(datos.codigo),
  nombre: limpiarTexto(datos.nombre),
  rut: limpiarTexto(datos.rut),
  pais: limpiarTexto(datos.pais) || "Chile",
  ciudad: limpiarTexto(datos.ciudad),
  contacto: limpiarTexto(datos.contacto),
  email: limpiarTexto(datos.email),
  telefono: limpiarTexto(datos.telefono),
  condicion_pago: limpiarTexto(
    datos.condicion_pago
  ),
  observacion: limpiarTexto(datos.observacion),
  activo: datos.activo !== false
});

export const validarTercero = (
  tercero,
  existentes = []
) => {
  const errores = [];

  if (!tercero.codigo) {
    errores.push("Ingresa un código.");
  }

  if (!tercero.nombre) {
    errores.push("Ingresa el nombre.");
  }

  const repetido = existentes.some(
    existente =>
      existente.codigo === tercero.codigo &&
      existente.id !== tercero.id
  );

  if (repetido) {
    errores.push(
      `El código ${tercero.codigo} ya existe.`
    );
  }

  return errores;
};

export const listarTerceros = async (
  db,
  empresaId,
  tipo
) => {
  const coleccion = COLECCIONES[tipo];

  if (!coleccion) {
    throw new Error("Tipo de tercero no válido.");
  }

  const snapshot = await getDocs(
    query(
      collection(db, coleccion),
      where("empresa_id", "==", empresaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) =>
      (a.nombre || "").localeCompare(
        b.nombre || ""
      )
    );
};

export const guardarTercero = async (
  db,
  perfil,
  tipo,
  datos,
  existentes = []
) => {
  const coleccion = COLECCIONES[tipo];

  if (!coleccion) {
    throw new Error("Tipo de tercero no válido.");
  }

  const codigo = normalizarCodigoTercero(
    datos.codigo
  );
  const referencia = datos.id
    ? doc(db, coleccion, datos.id)
    : doc(
        db,
        coleccion,
        idTercero(perfil.empresa_id, codigo)
      );
  const tercero = prepararTercero(
    datos,
    perfil.empresa_id,
    tipo,
    referencia.id
  );
  const errores = validarTercero(
    tercero,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  if (datos.id) {
    await updateDoc(referencia, {
      nombre: tercero.nombre,
      rut: tercero.rut,
      pais: tercero.pais,
      ciudad: tercero.ciudad,
      contacto: tercero.contacto,
      email: tercero.email,
      telefono: tercero.telefono,
      condicion_pago: tercero.condicion_pago,
      observacion: tercero.observacion,
      activo: tercero.activo,
      actualizado_por_id: perfil.uid || "",
      actualizado_por_nombre:
        perfil.nombre || "",
      actualizado_en: serverTimestamp()
    });
    return tercero;
  }

  await setDoc(referencia, {
    ...tercero,
    creado_por_id: perfil.uid || "",
    creado_por_nombre: perfil.nombre || "",
    creado_en: serverTimestamp(),
    actualizado_por_id: perfil.uid || "",
    actualizado_por_nombre:
      perfil.nombre || "",
    actualizado_en: serverTimestamp()
  });

  return tercero;
};
