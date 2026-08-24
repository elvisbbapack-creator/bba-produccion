const admin = require("firebase-admin");
const {
  HttpsError,
  onCall
} = require("firebase-functions/v2/https");

admin.initializeApp();

const REGION = "southamerica-west1";
const WEB_API_KEY =
  process.env.BBA_FIREBASE_WEB_API_KEY ||
  "AIzaSyCQhqhJ4u0c2dbIKsSSb9ZK_uEEcoBX_Jo";

const db = admin.firestore();

const normalizarPermisos = permisos =>
  Object.fromEntries(
    Object.entries(permisos || {})
      .filter(([, valor]) => Boolean(valor))
      .map(([clave]) => [
        clave,
        true
      ])
  );

const normalizarLista = valor =>
  Array.isArray(valor)
    ? [
        ...new Set(
          valor
            .map(item =>
              String(item || "").trim()
            )
            .filter(Boolean)
        )
      ]
    : [];

const permisosPorRol = rol => {
  if (rol === "gerencia") {
    return {
      "usuarios.gestionar": true,
      "dashboard.ver": true,
      "produccion.operar": true,
      "produccion.configurar": true,
      "ots.gestionar": true,
      "ingenieria.gestionar": true,
      "planificacion.gestionar": true,
      "turnos.gestionar": true,
      "estandares.gestionar": true,
      "calidad.gestionar": true,
      "paros.gestionar": true,
      "almacen.gestionar": true,
      "ajustes.gerenciales": true,
      "importacion.gestionar": true
    };
  }

  if (rol === "jefe") {
    return {
      "dashboard.ver": true,
      "produccion.operar": true,
      "produccion.configurar": true,
      "ots.gestionar": true,
      "ingenieria.gestionar": true,
      "planificacion.gestionar": true,
      "turnos.gestionar": true,
      "estandares.gestionar": true,
      "calidad.gestionar": true,
      "paros.gestionar": true,
      "almacen.gestionar": true,
      "ajustes.gerenciales": true,
      "importacion.gestionar": true
    };
  }

  if (rol === "supervisor") {
    return {
      "dashboard.ver": true,
      "produccion.operar": true
    };
  }

  if (rol === "tv") {
    return {
      "dashboard.ver": true
    };
  }

  return {};
};

const permisosEfectivos = perfil => ({
  ...permisosPorRol(perfil?.rol),
  ...(perfil?.permisos || {})
});

const puedeGestionarUsuarios = perfil =>
  Boolean(
    perfil?.empresa_id &&
    (
      perfil?.rol === "gerencia" ||
      permisosEfectivos(perfil)["usuarios.gestionar"]
    )
  );

const obtenerPerfilSolicitante = async auth => {
  if (!auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Debes iniciar sesión para activar usuarios."
    );
  }

  const perfilSnap = await db
    .collection("usuarios")
    .doc(auth.uid)
    .get();
  const perfilFirestore =
    perfilSnap.exists
      ? perfilSnap.data()
      : {};

  const perfil = {
    uid: auth.uid,
    email: auth.token.email || "",
    nombre:
      perfilFirestore.nombre ||
      auth.token.name ||
      auth.token.email ||
      auth.uid,
    rol:
      perfilFirestore.rol ||
      auth.token.rol,
    empresa_id:
      perfilFirestore.empresa_id ||
      auth.token.empresa_id,
    planta_ids:
      Array.isArray(perfilFirestore.planta_ids)
        ? perfilFirestore.planta_ids
        : normalizarLista(auth.token.planta_ids),
    permisos: {
      ...(auth.token.permisos || {}),
      ...(perfilFirestore.permisos || {})
    },
    activo: perfilFirestore.activo !== false
  };

  if (!perfil.activo) {
    throw new HttpsError(
      "permission-denied",
      "Tu usuario está inactivo."
    );
  }

  if (!puedeGestionarUsuarios(perfil)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para activar usuarios."
    );
  }

  return perfil;
};

const normalizarUsuario = data => ({
  uid: String(data.uid || "").trim(),
  nombre: String(data.nombre || "").trim(),
  email: String(data.email || "")
    .trim()
    .toLowerCase(),
  rol: data.rol || "supervisor",
  empresa_id: data.empresa_id || "bba",
  planta_ids: normalizarLista(data.planta_ids),
  activo: data.activo !== false,
  permisos: normalizarPermisos(data.permisos),
  observacion: data.observacion || "",
  creado_por_id: data.creado_por_id || "",
  creado_por_nombre: data.creado_por_nombre || "",
  creado_en: data.creado_en || null
});

const validarFicha = usuario => {
  if (!usuario.nombre) {
    throw new HttpsError(
      "failed-precondition",
      "La ficha no tiene nombre."
    );
  }

  if (!usuario.email) {
    throw new HttpsError(
      "failed-precondition",
      "La ficha no tiene email."
    );
  }

  if (!usuario.empresa_id) {
    throw new HttpsError(
      "failed-precondition",
      "La ficha no tiene empresa."
    );
  }

  if (
    usuario.rol !== "gerencia" &&
    usuario.planta_ids.length === 0
  ) {
    throw new HttpsError(
      "failed-precondition",
      "La ficha debe tener al menos una planta."
    );
  }
};

const crearCuentaAuth = async usuario => {
  try {
    const existente = await admin
      .auth()
      .getUserByEmail(usuario.email);

    return {
      uid: existente.uid,
      created: false
    };
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const creado = await admin
    .auth()
    .createUser({
      email: usuario.email,
      displayName: usuario.nombre,
      disabled: false
    });

  return {
    uid: creado.uid,
    created: true
  };
};

const enviarResetPassword = async email => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email
      })
    }
  );
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new HttpsError(
      "internal",
      data.error?.message ||
        "No se pudo enviar el correo de contraseña."
    );
  }
};

exports.activarUsuarioPendiente = onCall(
  {
    region: REGION,
    cors: true
  },
  async request => {
    const solicitante =
      await obtenerPerfilSolicitante(request.auth);
    const usuarioDocId =
      String(request.data?.usuarioDocId || "").trim();
    const enviarCorreo =
      request.data?.enviarCorreo !== false;

    if (!usuarioDocId) {
      throw new HttpsError(
        "invalid-argument",
        "Falta usuarioDocId."
      );
    }

    const fichaRef = db
      .collection("usuarios")
      .doc(usuarioDocId);
    const fichaSnap = await fichaRef.get();

    if (!fichaSnap.exists) {
      throw new HttpsError(
        "not-found",
        "La ficha de usuario no existe."
      );
    }

    const fichaData = fichaSnap.data();

    if (
      fichaData.estado_auth === "reemplazado_por_uid"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Esta ficha ya fue reemplazada por un UID Auth."
      );
    }

    const usuario =
      normalizarUsuario(fichaData);
    validarFicha(usuario);

    if (
      solicitante.empresa_id !== usuario.empresa_id &&
      solicitante.rol !== "gerencia"
    ) {
      throw new HttpsError(
        "permission-denied",
        "No puedes activar usuarios de otra empresa."
      );
    }

    const cuenta =
      await crearCuentaAuth(usuario);
    const uid = cuenta.uid;
    const now =
      admin.firestore.FieldValue.serverTimestamp();
    const claims = {
      rol: usuario.rol,
      empresa_id: usuario.empresa_id,
      planta_ids: usuario.planta_ids,
      permisos: usuario.permisos
    };

    await admin
      .auth()
      .setCustomUserClaims(uid, claims);

    const perfilFinal = {
      uid,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      empresa_id: usuario.empresa_id,
      planta_ids: usuario.planta_ids,
      activo: usuario.activo,
      permisos: usuario.permisos,
      estado_auth: "vinculado",
      observacion:
        `Cuenta Firebase Auth ${cuenta.created ? "creada" : "vinculada"} ` +
        "y claims asignados desde Cloud Function.",
      creado_por_id:
        usuario.creado_por_id ||
        solicitante.uid,
      creado_por_nombre:
        usuario.creado_por_nombre ||
        solicitante.nombre,
      creado_en:
        usuario.creado_en ||
        now,
      actualizado_por_id: solicitante.uid,
      actualizado_por_nombre: solicitante.nombre,
      actualizado_en: now
    };

    await db
      .collection("usuarios")
      .doc(uid)
      .set(perfilFinal, {
        merge: true
      });

    if (usuarioDocId !== uid) {
      await fichaRef.update({
        uid,
        activo: false,
        estado_auth: "reemplazado_por_uid",
        observacion:
          `Ficha pendiente reemplazada por usuarios/${uid}.`,
        actualizado_por_id: solicitante.uid,
        actualizado_por_nombre: solicitante.nombre,
        actualizado_en: now
      });
    }

    let correoResetEnviado = false;
    let correoResetError = "";

    if (enviarCorreo) {
      try {
        await enviarResetPassword(usuario.email);
        correoResetEnviado = true;
      } catch (error) {
        correoResetError =
          error.message ||
          "No se pudo enviar el correo de contraseña.";
        console.error(
          "No se pudo enviar correo de contraseña",
          {
            email: usuario.email,
            error: correoResetError
          }
        );
      }
    }

    await db
      .collection("auditoria_usuarios")
      .add({
        tipo: "activar_usuario_auth",
        usuario_doc_origen: usuarioDocId,
        usuario_uid: uid,
        email: usuario.email,
        rol: usuario.rol,
        empresa_id: usuario.empresa_id,
        planta_ids: usuario.planta_ids,
        auth_creado: cuenta.created,
        correo_reset_solicitado: enviarCorreo,
        correo_reset_enviado: correoResetEnviado,
        correo_reset_error: correoResetError,
        ejecutado_por_id: solicitante.uid,
        ejecutado_por_nombre: solicitante.nombre,
        creado_en: now
      });

    return {
      ok: true,
      uid,
      email: usuario.email,
      auth_creado: cuenta.created,
      correo_reset_solicitado: enviarCorreo,
      correo_reset_enviado: correoResetEnviado,
      correo_reset_error: correoResetError,
      reemplazo_ficha: usuarioDocId !== uid
    };
  }
);
