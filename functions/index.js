const admin = require("firebase-admin");
const {
  HttpsError,
  onCall
} = require("firebase-functions/v2/https");
const {
  onDocumentUpdated
} = require("firebase-functions/v2/firestore");

admin.initializeApp();

const REGION = "southamerica-west1";
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "";
const WEB_API_KEYS = {
  "bba-produccion": "AIzaSyCyiF21dtbrFjdu8H-w5df0Ul87upa2vaY",
  "bba-erp-pruebas": "AIzaSyCQhqhJ4u0c2dbIKsSSb9ZK_uEEcoBX_Jo"
};
const WEB_API_KEY =
  process.env.BBA_FIREBASE_WEB_API_KEY ||
  WEB_API_KEYS[PROJECT_ID] ||
  WEB_API_KEYS["bba-erp-pruebas"];

const db = admin.firestore();
const CORREO_REMITENTE_OC =
  "administracion@bbachile.cl";
const COPIAS_CORREO_OC = [
  "esaavedra@bbachile.cl",
  "produccion@bbachile.cl",
  "contabilidad@bbachile.cl"
];
const URL_PUBLICA_APP =
  process.env.BBA_PUBLIC_APP_URL ||
  "https://bba-produccion.vercel.app";

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

const escaparHtml = valor =>
  String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatoMonto = valor =>
  Math.round(Number(valor || 0))
    .toLocaleString("es-CL");

const obtenerPerfilCompras = async auth => {
  if (!auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Debes iniciar sesión para emitir una OC."
    );
  }

  const perfilSnap = await db
    .collection("usuarios")
    .doc(auth.uid)
    .get();
  const datos = perfilSnap.exists
    ? perfilSnap.data()
    : {};
  const perfil = {
    uid: auth.uid,
    nombre:
      datos.nombre ||
      auth.token.name ||
      auth.token.email ||
      auth.uid,
    rol: datos.rol || auth.token.rol,
    empresa_id:
      datos.empresa_id || auth.token.empresa_id,
    planta_ids: Array.isArray(datos.planta_ids)
      ? datos.planta_ids
      : normalizarLista(auth.token.planta_ids),
    permisos: {
      ...(auth.token.permisos || {}),
      ...(datos.permisos || {})
    },
    activo: datos.activo !== false
  };

  if (
    !perfil.activo ||
    !perfil.empresa_id ||
    !(
      ["jefe", "gerencia"].includes(perfil.rol) ||
      permisosEfectivos(perfil)["compras.gestionar"]
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para emitir órdenes de compra."
    );
  }

  return perfil;
};

const construirCorreoOrdenCompra = (orden, urlPublica) => {
  const filas = (orden.items || []).map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">${escaparHtml(item.material_codigo)} - ${escaparHtml(item.material_nombre)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${escaparHtml(item.cantidad)} ${escaparHtml(item.unidad_medida)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">CLP ${formatoMonto(item.total_linea)}</td>
    </tr>
  `).join("");

  const texto = [
    "Estimados, junto con saludar, esperamos que se encuentren muy bien.",
    "",
    `Por medio del presente compartimos nuestra orden de compra ${orden.codigo}.`,
    "Agradecemos confirmar la recepción de este correo, la disponibilidad de los productos y la fecha estimada de entrega.",
    "",
    `Proveedor: ${orden.proveedor_nombre}`,
    `Subtotal productos: CLP ${formatoMonto(orden.subtotal || orden.total)}`,
    `Flete: CLP ${formatoMonto(orden.flete)}`,
    `Total neto: CLP ${formatoMonto(orden.total)}`,
    "",
    `Puede visualizar y descargar la orden de compra de forma segura aquí: ${urlPublica}`,
    "",
    "Muchas gracias por su atención y colaboración.",
    "Saludos cordiales,",
    "BBA Chile"
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.55;max-width:720px">
      <p>Estimados, junto con saludar, esperamos que se encuentren muy bien.</p>
      <p>Por medio del presente compartimos nuestra orden de compra <strong>${escaparHtml(orden.codigo)}</strong>.</p>
      <p>Agradecemos confirmar la recepción de este correo, la disponibilidad de los productos y la fecha estimada de entrega.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0">
        <thead><tr><th style="padding:8px;text-align:left">Producto</th><th style="padding:8px;text-align:right">Cantidad</th><th style="padding:8px;text-align:right">Monto</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p><strong>Subtotal productos:</strong> CLP ${formatoMonto(orden.subtotal || orden.total)}<br />
      <strong>Flete:</strong> CLP ${formatoMonto(orden.flete)}<br />
      <strong>Total neto:</strong> CLP ${formatoMonto(orden.total)}</p>
      <p><a href="${escaparHtml(urlPublica)}" style="display:inline-block;background:#163b7a;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Ver y descargar orden de compra</a></p>
      <p>Muchas gracias por su atención y colaboración.</p>
      <p>Saludos cordiales,<br /><strong>BBA Chile</strong></p>
    </div>
  `;

  return { texto, html };
};

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

exports.emitirOrdenCompraPorCorreo = onCall(
  {
    region: REGION,
    cors: true
  },
  async request => {
    const perfil = await obtenerPerfilCompras(
      request.auth
    );
    const ordenId = String(
      request.data?.ordenId || ""
    ).trim();

    if (!ordenId) {
      throw new HttpsError(
        "invalid-argument",
        "Falta la orden de compra."
      );
    }

    const ordenRef = db
      .collection("ordenes_compra")
      .doc(ordenId);
    const ordenSnap = await ordenRef.get();

    if (!ordenSnap.exists) {
      throw new HttpsError(
        "not-found",
        "La orden de compra no existe."
      );
    }

    const orden = ordenSnap.data();

    if (
      orden.empresa_id !== perfil.empresa_id ||
      (
        perfil.rol !== "gerencia" &&
        !perfil.planta_ids.includes(orden.planta_id)
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "La OC no pertenece a una planta autorizada."
      );
    }

    if (orden.estado !== "borrador") {
      throw new HttpsError(
        "failed-precondition",
        "Solo se pueden emitir OC en borrador."
      );
    }

    if (!orden.proveedor_id) {
      throw new HttpsError(
        "failed-precondition",
        "La OC no tiene proveedor asignado."
      );
    }

    const proveedorEmail = String(
      orden.proveedor_email || ""
    ).trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proveedorEmail)) {
      throw new HttpsError(
        "failed-precondition",
        "El proveedor no tiene un correo de contacto válido."
      );
    }

    if (orden.correo_estado === "pendiente") {
      throw new HttpsError(
        "already-exists",
        "La OC ya tiene un correo en proceso."
      );
    }

    const token = String(
      orden.token_compartir || ""
    ).trim();

    if (!token) {
      throw new HttpsError(
        "failed-precondition",
        "La OC no tiene un enlace seguro disponible."
      );
    }

    const urlPublica = `${URL_PUBLICA_APP.replace(/\/$/, "")}/oc-publica/${encodeURIComponent(token)}`;
    const correo = construirCorreoOrdenCompra(
      orden,
      urlPublica
    );
    const mailRef = db.collection("mail").doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.set(
      db.collection("ordenes_compra_publicas").doc(token),
      {
        empresa_id: orden.empresa_id,
        planta_id: orden.planta_id,
        codigo: orden.codigo,
        proveedor_nombre: orden.proveedor_nombre,
        proveedor_email: proveedorEmail,
        proveedor_telefono:
          orden.proveedor_telefono || "",
        condicion_pago: orden.condicion_pago || "",
        moneda: orden.moneda || "CLP",
        items: Array.isArray(orden.items)
          ? orden.items
          : [],
        subtotal: Number(
          orden.subtotal || orden.total || 0
        ),
        flete: Number(orden.flete || 0),
        total: Number(orden.total || 0),
        observacion: orden.observacion || "",
        estado: orden.estado,
        token_compartir: token,
        compartir_activo: true,
        modelo_version: 2,
        publicado_en: now
      },
      { merge: true }
    );
    batch.set(mailRef, {
      from: CORREO_REMITENTE_OC,
      replyTo: CORREO_REMITENTE_OC,
      to: [proveedorEmail],
      cc: COPIAS_CORREO_OC,
      message: {
        subject: `Orden de compra ${orden.codigo} - BBA Chile`,
        text: correo.texto,
        html: correo.html
      },
      metadata: {
        tipo: "orden_compra",
        orden_id: ordenId,
        orden_codigo: orden.codigo,
        empresa_id: orden.empresa_id,
        planta_id: orden.planta_id,
        solicitado_por_id: perfil.uid,
        solicitado_por_nombre: perfil.nombre
      },
      creado_en: now
    });
    batch.update(ordenRef, {
      correo_estado: "pendiente",
      correo_id: mailRef.id,
      correo_para: proveedorEmail,
      correo_cc: COPIAS_CORREO_OC,
      correo_error: "",
      correo_solicitado_en: now,
      correo_solicitado_por_id: perfil.uid,
      correo_solicitado_por_nombre: perfil.nombre,
      actualizado_en: now
    });
    await batch.commit();

    return {
      ok: true,
      estado: "pendiente",
      correoId: mailRef.id,
      urlPublica
    };
  }
);

exports.confirmarEntregaCorreoOrdenCompra =
  onDocumentUpdated(
    {
      document: "mail/{mailId}",
      region: REGION
    },
    async event => {
      const antes = event.data?.before.data() || {};
      const despues = event.data?.after.data() || {};
      const metadata = despues.metadata || {};
      const estadoAntes = antes.delivery?.state || "";
      const estado = despues.delivery?.state || "";

      if (
        metadata.tipo !== "orden_compra" ||
        !metadata.orden_id ||
        estado === estadoAntes ||
        !["SUCCESS", "ERROR"].includes(estado)
      ) {
        return;
      }

      const ordenRef = db
        .collection("ordenes_compra")
        .doc(metadata.orden_id);
      const now =
        admin.firestore.FieldValue.serverTimestamp();

      if (estado === "SUCCESS") {
        const batch = db.batch();
        const cambiosOrden = {
          estado: "enviada",
          correo_estado: "enviado",
          correo_error: "",
          correo_enviado_en: now,
          enviada_en: now,
          enviada_por_id:
            metadata.solicitado_por_id || "",
          enviada_por_nombre:
            metadata.solicitado_por_nombre || "",
          actualizado_en: now
        };

        batch.update(ordenRef, cambiosOrden);

        if (despues.metadata?.orden_codigo) {
          const ordenSnap = await ordenRef.get();
          const token = ordenSnap.data()?.token_compartir;

          if (token) {
            batch.update(
              db.collection("ordenes_compra_publicas").doc(token),
              {
                estado: "enviada",
                actualizado_en: now
              }
            );
          }
        }

        await batch.commit();
        return;
      }

      await ordenRef.update({
        correo_estado: "error",
        correo_error: String(
          despues.delivery?.error ||
          "El servicio de correo rechazó el envío."
        ),
        actualizado_en: now
      });
    }
  );
