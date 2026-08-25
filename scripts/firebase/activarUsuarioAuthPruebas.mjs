#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const DEFAULT_PROJECT_ID = "bba-erp-pruebas";
const DEFAULT_API_KEY =
  "AIzaSyCQhqhJ4u0c2dbIKsSSb9ZK_uEEcoBX_Jo";

const usage = `
Uso:
  npm run firebase:activar-usuario -- --email correo@bba.cl
  npm run firebase:activar-usuario -- --doc usuariosDocId

Opciones:
  --project <id>       Proyecto Firebase. Por defecto: bba-erp-pruebas.
  --api-key <key>      API key web de Firebase. Tambien acepta REACT_APP_FIREBASE_API_KEY.
  --email <email>      Busca ficha pendiente por email.
  --doc <docId>        Usa un documento especifico de la coleccion usuarios.
  --send-reset         Envia correo de restablecimiento aunque la cuenta ya exista.
  --no-reset           No envia correo de restablecimiento.
  --set-temp-password  Genera una contraseña temporal y la asigna al usuario.
  --dry-run            Muestra lo que haria sin escribir en Firebase.
`;

const args = process.argv.slice(2);

const takeValue = flag => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return "";
  }

  return args[index + 1] || "";
};

const hasFlag = flag => args.includes(flag);

const projectId =
  takeValue("--project") ||
  process.env.FIREBASE_PROJECT_ID ||
  DEFAULT_PROJECT_ID;
const apiKey =
  takeValue("--api-key") ||
  process.env.REACT_APP_FIREBASE_API_KEY ||
  DEFAULT_API_KEY;
const emailArg = takeValue("--email").trim().toLowerCase();
const docArg = takeValue("--doc").trim();
const dryRun = hasFlag("--dry-run");
const forceReset = hasFlag("--send-reset");
const noReset = hasFlag("--no-reset");
const setTempPassword = hasFlag("--set-temp-password");
const generatedTempPassword =
  setTempPassword && !dryRun
    ? `BBA-${randomBytes(12).toString("base64url")}!7`
    : "";

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(usage.trim());
  process.exit(0);
}

if (!emailArg && !docArg) {
  console.error("Debes indicar --email o --doc.");
  console.error(usage.trim());
  process.exit(1);
}

const jsonRequest = async (
  url,
  options = {}
) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data.error) {
    const message =
      data.error?.message ||
      data.error?.status ||
      response.statusText;
    throw new Error(message);
  }

  return data;
};

const getCliAccessToken = () => {
  if (process.env.FIREBASE_ACCESS_TOKEN) {
    return process.env.FIREBASE_ACCESS_TOKEN;
  }

  const raw = execFileSync(
    "npx",
    [
      "firebase-tools",
      "login:list",
      "--json"
    ],
    {
      encoding: "utf8",
      stdio: [
        "ignore",
        "pipe",
        "pipe"
      ]
    }
  );
  const parsed = JSON.parse(raw);
  const token =
    parsed.result?.[0]?.tokens?.access_token;

  if (!token) {
    throw new Error(
      "No se encontro una sesion Firebase CLI activa."
    );
  }

  return token;
};

const decodeValue = value => {
  if (!value) {
    return undefined;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }
  if ("booleanValue" in value) {
    return value.booleanValue;
  }
  if ("integerValue" in value) {
    return Number(value.integerValue);
  }
  if ("doubleValue" in value) {
    return Number(value.doubleValue);
  }
  if ("timestampValue" in value) {
    return value.timestampValue;
  }
  if ("arrayValue" in value) {
    return (value.arrayValue.values || [])
      .map(decodeValue)
      .filter(item => item !== undefined);
  }
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {})
        .map(([key, item]) => [
          key,
          decodeValue(item)
        ])
    );
  }

  return undefined;
};

const encodeValue = value => {
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: value }
      : { doubleValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(encodeValue)
      }
    };
  }
  if (
    value &&
    typeof value === "object"
  ) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) =>
              item !== undefined
            )
            .map(([key, item]) => [
              key,
              encodeValue(item)
            ])
        )
      }
    };
  }

  return {
    stringValue:
      value === undefined || value === null
        ? ""
        : String(value)
  };
};

const decodeDocument = document => {
  const fields = document.fields || {};
  return {
    id: document.name.split("/").pop(),
    path: document.name,
    data: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        decodeValue(value)
      ])
    )
  };
};

const firestoreBase =
  `https://firestore.googleapis.com/v1/projects/${projectId}` +
  "/databases/(default)/documents";

const getUsuarios = async token => {
  const response = await jsonRequest(
    `${firestoreBase}/usuarios`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return (response.documents || [])
    .map(decodeDocument);
};

const getUsuarioByDoc = async (
  token,
  docId
) => {
  const response = await jsonRequest(
    `${firestoreBase}/usuarios/${encodeURIComponent(docId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return decodeDocument(response);
};

const findUsuario = async token => {
  if (docArg) {
    return getUsuarioByDoc(token, docArg);
  }

  const usuarios = await getUsuarios(token);
  const matches = usuarios.filter(usuario =>
    String(usuario.data.email || "")
      .trim()
      .toLowerCase() === emailArg
  );

  if (matches.length === 0) {
    throw new Error(
      `No existe ficha en usuarios para ${emailArg}.`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Hay ${matches.length} fichas con ese email. Usa --doc.`
    );
  }

  return matches[0];
};

const lookupAuthUser = async (
  token,
  email
) => {
  const response = await jsonRequest(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        email: [email]
      })
    }
  );

  return response.users?.[0] || null;
};

const createAuthUser = async (
  usuario,
  password = ""
) => {
  const tempPassword =
    password ||
    `BBA-${randomBytes(18).toString("base64url")}!7`;

  const response = await jsonRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      body: JSON.stringify({
        email: usuario.email,
        password: tempPassword,
        displayName: usuario.nombre,
        returnSecureToken: true
      })
    }
  );

  return {
    uid: response.localId,
    created: true
  };
};

const updateClaims = async (
  token,
  uid,
  claims,
  tempPassword = ""
) => {
  await jsonRequest(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify(claims),
        disableUser: false,
        ...(tempPassword
          ? { password: tempPassword }
          : {})
      })
    }
  );
};

const patchFirestoreDocument = async (
  token,
  docId,
  payload,
  fieldMask = []
) => {
  const params =
    fieldMask.length > 0
      ? `?${fieldMask
          .map(field =>
            `updateMask.fieldPaths=${encodeURIComponent(field)}`
          )
          .join("&")}`
      : "";

  return jsonRequest(
    `${firestoreBase}/usuarios/${encodeURIComponent(docId)}${params}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(payload)
            .filter(([, value]) =>
              value !== undefined
            )
            .map(([key, value]) => [
              key,
              encodeValue(value)
            ])
        )
      })
    }
  );
};

const sendPasswordReset = async email => {
  await jsonRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: "POST",
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email
      })
    }
  );
};

const normalizeUsuario = usuario => ({
  uid: String(usuario.uid || "").trim(),
  nombre: String(usuario.nombre || "").trim(),
  email: String(usuario.email || "")
    .trim()
    .toLowerCase(),
  rol: usuario.rol || "supervisor",
  empresa_id: usuario.empresa_id || "bba",
  planta_ids: Array.isArray(usuario.planta_ids)
    ? usuario.planta_ids
    : [],
  activo: usuario.activo !== false,
  permisos: Object.fromEntries(
    Object.entries(usuario.permisos || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => [
        key,
        true
      ])
  ),
  observacion: usuario.observacion || ""
});

const run = async () => {
  const token = getCliAccessToken();
  const ficha = await findUsuario(token);
  const usuario = normalizeUsuario(ficha.data);

  if (!usuario.nombre) {
    throw new Error("La ficha no tiene nombre.");
  }
  if (!usuario.email) {
    throw new Error("La ficha no tiene email.");
  }
  if (!usuario.empresa_id) {
    throw new Error("La ficha no tiene empresa_id.");
  }

  const existing = await lookupAuthUser(
    token,
    usuario.email
  );
  const account =
    existing
      ? {
          uid: existing.localId,
          created: false
        }
      : await createAuthUser(
          usuario,
          generatedTempPassword
        );

  const uid = account.uid;
  const now = new Date();
  const claims = {
    rol: usuario.rol,
    empresa_id: usuario.empresa_id,
    planta_ids: usuario.planta_ids,
    permisos: usuario.permisos
  };

  const linkedProfile = {
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
      `Cuenta Firebase Auth ${account.created ? "creada" : "vinculada"} ` +
      `y claims asignados el ${now.toISOString()}.`,
    actualizado_por_id: "firebase-cli",
    actualizado_por_nombre: "Firebase CLI",
    actualizado_en: now,
    creado_por_id: ficha.data.creado_por_id || "firebase-cli",
    creado_por_nombre: ficha.data.creado_por_nombre || "Firebase CLI",
    creado_en: ficha.data.creado_en || now
  };

  const shouldReset =
    !noReset &&
    !setTempPassword &&
    (account.created || forceReset);

  const plan = {
    projectId,
    sourceDoc: ficha.id,
    targetDoc: uid,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    empresa_id: usuario.empresa_id,
    planta_ids: usuario.planta_ids,
    permisos_count: Object.keys(usuario.permisos).length,
    auth_will_create: account.created,
    will_send_password_reset: shouldReset,
    will_set_temp_password: setTempPassword,
    will_replace_source_doc:
      ficha.id !== uid
  };

  if (dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  await updateClaims(
    token,
    uid,
    claims,
    generatedTempPassword
  );

  await patchFirestoreDocument(
    token,
    uid,
    linkedProfile
  );

  if (ficha.id !== uid) {
    await patchFirestoreDocument(
      token,
      ficha.id,
      {
        uid,
        activo: false,
        estado_auth: "reemplazado_por_uid",
        observacion:
          `Ficha pendiente reemplazada por usuarios/${uid} el ` +
          now.toISOString(),
        actualizado_por_id: "firebase-cli",
        actualizado_por_nombre: "Firebase CLI",
        actualizado_en: now
      },
      [
        "uid",
        "activo",
        "estado_auth",
        "observacion",
        "actualizado_por_id",
        "actualizado_por_nombre",
        "actualizado_en"
      ]
    );
  }

  if (shouldReset) {
    await sendPasswordReset(usuario.email);
  }

  console.log(JSON.stringify({
    ...plan,
    ...(generatedTempPassword
      ? {
          temporary_password:
            generatedTempPassword
        }
      : {}),
    status: "ok"
  }, null, 2));
};

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
