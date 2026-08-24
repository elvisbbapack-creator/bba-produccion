#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_SOURCE = "bba-erp-pruebas";
const DEFAULT_TARGET = "bba-produccion";

const DEFAULT_COLLECTIONS = [
  "materiales",
  "catalogo_piezas",
  "catalogo_procesos_estaciones",
  "catalogo_subproductos",
  "catalogo_operaciones",
  "productos",
  "clientes",
  "proveedores",
  "costos_base_estacion",
  "costos_operativos_planta",
  "configuracion_capacidad",
  "capacidad_procesos",
  "catalogo_defectos",
  "catalogo_causas",
  "catalogo_motivos_paro",
];

const RECURSIVE_ROOTS = new Set([
  "productos",
  "catalogo_subproductos",
  "capacidad_procesos",
]);

const SKIP_COLLECTIONS = new Set([
  "usuarios",
  "registros_produccion",
  "produccion_activa",
  "paros_produccion",
  "ajustes_produccion",
  "inventario_materiales",
  "movimientos_almacen",
  "conteos_fisicos",
  "traspasos_almacen",
  "solicitudes_compra",
  "ordenes_compra",
  "ordenes_compra_publicas",
  "cotizaciones_tecnicas",
  "sesiones_produccion",
  "eventos_produccion",
  "resumenes_diarios",
  "resumenes_ot",
  "correlativos",
]);

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    target: DEFAULT_TARGET,
    apply: false,
    overwrite: false,
    collections: DEFAULT_COLLECTIONS,
    outDir: path.resolve("backups"),
  };

  for (const arg of argv.slice(2)) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--overwrite") args.overwrite = true;
    else if (arg.startsWith("--source=")) args.source = arg.slice("--source=".length);
    else if (arg.startsWith("--target=")) args.target = arg.slice("--target=".length);
    else if (arg.startsWith("--out-dir=")) args.outDir = path.resolve(arg.slice("--out-dir=".length));
    else if (arg.startsWith("--collections=")) {
      args.collections = arg
        .slice("--collections=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  for (const collection of args.collections) {
    if (SKIP_COLLECTIONS.has(collection)) {
      throw new Error(
        `La coleccion ${collection} esta bloqueada para esta migracion segura.`
      );
    }
  }

  return args;
}

function readFirebaseCliTokens() {
  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);
  const accessToken = config?.tokens?.access_token;
  const expiresAt = Number(config?.tokens?.expires_at || 0);
  const refreshToken = config?.tokens?.refresh_token;
  if (!accessToken && !refreshToken) {
    throw new Error("No encontre tokens en la sesion local de Firebase CLI.");
  }
  return { accessToken, expiresAt, refreshToken };
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: "563584335869.apps.googleusercontent.com",
    client_secret: "j4D2mYhkIR5jYyVfU5s0duED",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`No pude refrescar token Firebase CLI: ${payload.error || response.status}`);
  }
  return payload.access_token;
}

function documentsBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 404) return null;

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText || response.status;
    throw new Error(`${options.method || "GET"} ${url} -> ${message}`);
  }
  return payload;
}

function docPathFromName(name) {
  const marker = "/documents/";
  const index = name.indexOf(marker);
  if (index === -1) throw new Error(`Nombre Firestore invalido: ${name}`);
  return decodeURIComponent(name.slice(index + marker.length));
}

function collectionOfPath(docPath) {
  return docPath.split("/")[0];
}

async function listDocuments(projectId, collectionPath, token) {
  const docs = [];
  let pageToken = "";
  do {
    const url = new URL(`${documentsBase(projectId)}/${collectionPath}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const payload = await requestJson(url.toString(), token);
    docs.push(...(payload?.documents || []));
    pageToken = payload?.nextPageToken || "";
  } while (pageToken);
  return docs;
}

async function listCollectionIds(projectId, docPath, token) {
  const url = `${documentsBase(projectId)}/${docPath}:listCollectionIds`;
  const payload = await requestJson(url, token, {
    method: "POST",
    body: JSON.stringify({ pageSize: 300 }),
  });
  return payload?.collectionIds || [];
}

async function collectTree(projectId, collectionPath, token, recursiveRoot) {
  const docs = await listDocuments(projectId, collectionPath, token);
  const collected = [];
  for (const doc of docs) {
    const docPath = docPathFromName(doc.name);
    collected.push({
      path: docPath,
      fields: doc.fields || {},
      createTime: doc.createTime,
      updateTime: doc.updateTime,
    });

    if (recursiveRoot) {
      const childCollections = await listCollectionIds(projectId, docPath, token);
      for (const childCollection of childCollections) {
        collected.push(
          ...(await collectTree(projectId, `${docPath}/${childCollection}`, token, true))
        );
      }
    }
  }
  return collected;
}

async function getDocument(projectId, docPath, token) {
  return requestJson(`${documentsBase(projectId)}/${docPath}`, token);
}

async function writeDocument(projectId, doc, token) {
  const url = `${documentsBase(projectId)}/${doc.path}`;
  return requestJson(url, token, {
    method: "PATCH",
    body: JSON.stringify({ fields: doc.fields || {} }),
  });
}

function timestampForFile() {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
}

async function main() {
  const args = parseArgs(process.argv);
  const cliTokens = readFirebaseCliTokens();
  const token =
    cliTokens.accessToken && Date.now() < cliTokens.expiresAt - 60_000
      ? cliTokens.accessToken
      : await refreshAccessToken(cliTokens.refreshToken);

  fs.mkdirSync(args.outDir, { recursive: true });

  const sourceDocs = [];
  for (const collection of args.collections) {
    const recursive = RECURSIVE_ROOTS.has(collection);
    sourceDocs.push(...(await collectTree(args.source, collection, token, recursive)));
  }

  const targetExisting = [];
  for (const doc of sourceDocs) {
    const existing = await getDocument(args.target, doc.path, token);
    if (existing) {
      targetExisting.push({
        path: doc.path,
        fields: existing.fields || {},
        createTime: existing.createTime,
        updateTime: existing.updateTime,
      });
    }
  }

  const backupFile = path.join(
    args.outDir,
    `firestore-target-${args.target}-datos-maestros-${timestampForFile()}.json`
  );
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source: args.source,
        target: args.target,
        collections: args.collections,
        existingTargetDocuments: targetExisting,
      },
      null,
      2
    )
  );

  const existingPaths = new Set(targetExisting.map((doc) => doc.path));
  const toCreate = sourceDocs.filter((doc) => !existingPaths.has(doc.path));
  const toOverwrite = args.overwrite ? sourceDocs.filter((doc) => existingPaths.has(doc.path)) : [];
  const skipped = sourceDocs.filter((doc) => existingPaths.has(doc.path) && !args.overwrite);

  const byCollection = new Map();
  for (const doc of sourceDocs) {
    const collection = collectionOfPath(doc.path);
    const row = byCollection.get(collection) || { total: 0, create: 0, overwrite: 0, skip: 0 };
    row.total += 1;
    if (!existingPaths.has(doc.path)) row.create += 1;
    else if (args.overwrite) row.overwrite += 1;
    else row.skip += 1;
    byCollection.set(collection, row);
  }

  console.log(`Origen: ${args.source}`);
  console.log(`Destino: ${args.target}`);
  console.log(`Modo: ${args.apply ? "APLICAR" : "DRY-RUN"}`);
  console.log(`Sobrescribir existentes: ${args.overwrite ? "si" : "no"}`);
  console.log(`Respaldo destino: ${backupFile}`);
  console.table(
    [...byCollection.entries()].map(([collection, row]) => ({
      coleccion: collection,
      origen: row.total,
      crear: row.create,
      sobrescribir: row.overwrite,
      omitir_existente: row.skip,
    }))
  );
  console.log(`Documentos origen: ${sourceDocs.length}`);
  console.log(`A crear: ${toCreate.length}`);
  console.log(`A sobrescribir: ${toOverwrite.length}`);
  console.log(`Omitidos existentes: ${skipped.length}`);

  if (!args.apply) {
    console.log("Dry-run finalizado. No se escribio nada en produccion.");
    return;
  }

  for (const doc of [...toCreate, ...toOverwrite]) {
    await writeDocument(args.target, doc, token);
  }
  console.log(`Migracion aplicada. Documentos escritos: ${toCreate.length + toOverwrite.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
