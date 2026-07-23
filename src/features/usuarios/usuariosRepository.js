import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

export const ROLES_USUARIO_BBA = [
  "supervisor",
  "jefe",
  "gerencia",
  "tv"
];

export const EMPRESAS_BBA = [
  {
    id: "bba",
    nombre: "BBA"
  }
];

export const PLANTAS_BBA = [
  {
    id: "chile",
    nombre: "Chile"
  },
  {
    id: "peru",
    nombre: "Perú"
  }
];

export const normalizarLista = valor => {
  const base = Array.isArray(valor)
    ? valor
    : (valor || "")
        .toString()
        .split(/[,;\n]/);

  return [
    ...new Set(
      base
        .map(item =>
          item.toString().trim()
        )
        .filter(Boolean)
    )
  ];
};

export const normalizarPermisos = (
  permisos = {}
) =>
  Object.fromEntries(
    Object.entries(permisos)
      .filter(([, valor]) =>
        Boolean(valor)
      )
      .map(([clave]) => [
        clave,
        true
      ])
  );

export const normalizarUsuario = (
  id,
  data = {}
) => ({
  id,
  uid: data.uid || "",
  nombre: data.nombre || "",
  email: data.email || "",
  rol: data.rol || "supervisor",
  empresa_id: data.empresa_id || "bba",
  planta_ids: Array.isArray(data.planta_ids)
    ? data.planta_ids
    : [],
  activo: data.activo !== false,
  permisos: data.permisos || {},
  estado_auth:
    data.estado_auth ||
    (data.uid ? "vinculado" : "pendiente_auth"),
  observacion: data.observacion || "",
  creado_en: data.creado_en || null,
  actualizado_en: data.actualizado_en || null
});

export const listarUsuariosPermisos = async (
  db,
  empresaId = ""
) => {
  const snap = await getDocs(
    query(
      collection(db, "usuarios"),
      ...(empresaId
        ? [where("empresa_id", "==", empresaId)]
        : [])
    )
  );

  return snap.docs
    .map(documento =>
      normalizarUsuario(
        documento.id,
        documento.data()
      )
    )
    .sort((a, b) =>
      (a.nombre || "").localeCompare(
        b.nombre || "",
        "es",
        { sensitivity: "base" }
      )
    );
};

export const guardarUsuarioPermisos = async (
  db,
  usuario,
  perfil
) => {
  const nombre =
    (usuario.nombre || "").trim();
  const email =
    (usuario.email || "").trim().toLowerCase();
  const uid =
    (usuario.uid || "").trim();

  if (!nombre) {
    throw new Error("El nombre es obligatorio.");
  }

  if (!email) {
    throw new Error("El email es obligatorio.");
  }

  if (!usuario.rol) {
    throw new Error("El rol es obligatorio.");
  }

  if (!usuario.empresa_id) {
    throw new Error("La empresa es obligatoria.");
  }

  if (
    usuario.rol !== "gerencia" &&
    normalizarLista(usuario.planta_ids).length === 0
  ) {
    throw new Error(
      "Selecciona al menos una planta para este rol."
    );
  }

  const payload = {
    uid,
    nombre,
    email,
    rol: usuario.rol,
    empresa_id: usuario.empresa_id,
    planta_ids: normalizarLista(
      usuario.planta_ids
    ),
    activo: usuario.activo !== false,
    permisos: normalizarPermisos(
      usuario.permisos
    ),
    estado_auth:
      usuario.estado_auth ||
      (uid ? "vinculado" : "pendiente_auth"),
    observacion:
      (usuario.observacion || "").trim(),
    actualizado_por_id: perfil?.uid || "",
    actualizado_por_nombre:
      perfil?.nombre || "",
    actualizado_en: new Date()
  };

  if (usuario.id) {
    await updateDoc(
      doc(db, "usuarios", usuario.id),
      payload
    );
    return usuario.id;
  }

  if (uid) {
    await setDoc(
      doc(db, "usuarios", uid),
      {
        ...payload,
        creado_por_id: perfil?.uid || "",
        creado_por_nombre:
          perfil?.nombre || "",
        creado_en: new Date()
      }
    );
    return uid;
  }

  const creado = await addDoc(
    collection(db, "usuarios"),
    {
      ...payload,
      creado_por_id: perfil?.uid || "",
      creado_por_nombre:
        perfil?.nombre || "",
      creado_en: new Date()
    }
  );

  return creado.id;
};

export const consolidarUsuarioPendienteDuplicado = async (
  db,
  usuarioPendiente,
  usuarioVinculado,
  perfil
) => {
  if (!usuarioPendiente?.id) {
    throw new Error("Falta la ficha pendiente.");
  }

  if (!usuarioVinculado?.uid) {
    throw new Error(
      "Falta el UID de la ficha vinculada."
    );
  }

  const emailPendiente =
    (usuarioPendiente.email || "")
      .trim()
      .toLowerCase();
  const emailVinculado =
    (usuarioVinculado.email || "")
      .trim()
      .toLowerCase();

  if (
    !emailPendiente ||
    emailPendiente !== emailVinculado
  ) {
    throw new Error(
      "Solo se pueden consolidar fichas con el mismo correo."
    );
  }

  if (
    usuarioPendiente.estado_auth !== "pendiente_auth"
  ) {
    throw new Error(
      "Solo se pueden consolidar fichas pendientes de Auth."
    );
  }

  await updateDoc(
    doc(db, "usuarios", usuarioPendiente.id),
    {
      uid: usuarioVinculado.uid,
      activo: false,
      estado_auth: "reemplazado_por_uid",
      observacion:
        `Ficha pendiente reemplazada por usuarios/${usuarioVinculado.uid}.`,
      actualizado_por_id: perfil?.uid || "",
      actualizado_por_nombre:
        perfil?.nombre || "",
      actualizado_en: new Date()
    }
  );
};

export const activarUsuarioAuthPendiente = async (
  functions,
  usuarioDocId,
  opciones = {}
) => {
  if (!usuarioDocId) {
    throw new Error("Falta el documento del usuario.");
  }

  const activar = httpsCallable(
    functions,
    "activarUsuarioPendiente"
  );
  const respuesta = await activar({
    usuarioDocId,
    enviarCorreo:
      opciones.enviarCorreo !== false
  });

  return respuesta.data;
};
