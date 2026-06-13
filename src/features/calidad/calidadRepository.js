import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import {
  calcularProyeccionOT,
  listarOperacionesOT
} from "../ordenes/ordenesRepository";

const limpiarTexto = (valor) =>
  (valor || "").toString().trim();

const normalizarCodigo = (valor) =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const prepararCatalogo = (
  datos,
  empresaId,
  tipo
) => ({
  empresa_id: empresaId,
  codigo: normalizarCodigo(datos.codigo),
  nombre: limpiarTexto(datos.nombre),
  activo: datos.activo !== false,
  ...(tipo === "defecto"
    ? {
      severidad: datos.severidad || "leve",
      proceso_id: limpiarTexto(
        datos.proceso_id
      )
    }
    : {})
});

export const validarCatalogoCalidad = (
  datos,
  existentes = [],
  prefijo
) => {
  const errores = [];

  if (
    !new RegExp(`^${prefijo}\\d{4,}$`).test(
      datos.codigo
    )
  ) {
    errores.push(
      `El código debe usar el formato ${prefijo}0001.`
    );
  }

  if (!datos.nombre) {
    errores.push("El nombre es obligatorio.");
  }

  if (
    existentes.some(
      item => item.codigo === datos.codigo
    )
  ) {
    errores.push(
      `El código ${datos.codigo} ya existe.`
    );
  }

  return errores;
};

const listarCatalogo = async (
  db,
  coleccion,
  empresaId
) => {
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
      (a.codigo || "").localeCompare(
        b.codigo || ""
      )
    );
};

export const listarDefectos = (
  db,
  empresaId
) => listarCatalogo(
  db,
  "catalogo_defectos",
  empresaId
);

export const listarCausas = (
  db,
  empresaId
) => listarCatalogo(
  db,
  "catalogo_causas",
  empresaId
);

const crearCatalogo = async ({
  db,
  empresaId,
  coleccion,
  tipo,
  datos
}) => {
  const preparado = prepararCatalogo(
    datos,
    empresaId,
    tipo
  );
  const prefijo =
    tipo === "defecto" ? "DEF" : "CAU";
  const existentes = await listarCatalogo(
    db,
    coleccion,
    empresaId
  );
  const errores = validarCatalogoCalidad(
    preparado,
    existentes,
    prefijo
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const referencia = doc(
    db,
    coleccion,
    `${empresaId}__${preparado.codigo}`
  );
  const registro = {
    ...preparado,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  };

  await setDoc(referencia, registro);

  return {
    id: referencia.id,
    ...preparado
  };
};

export const crearDefecto = (
  db,
  empresaId,
  datos
) => crearCatalogo({
  db,
  empresaId,
  coleccion: "catalogo_defectos",
  tipo: "defecto",
  datos
});

export const crearCausa = (
  db,
  empresaId,
  datos
) => crearCatalogo({
  db,
  empresaId,
  coleccion: "catalogo_causas",
  tipo: "causa",
  datos
});

export const listarReprocesosPendientes =
  async (db, empresaId, plantaId) => {
    const snapshot = await getDocs(
      query(
        collection(db, "registros_calidad"),
        where("empresa_id", "==", empresaId),
        where("planta_id", "==", plantaId)
      )
    );

    return snapshot.docs
      .map(documento => ({
        id: documento.id,
        ...documento.data()
      }))
      .filter(
        registro =>
          registro.estado_reproceso ===
            "pendiente" &&
          Number(
            registro
              .cantidad_reproceso_pendiente
          ) > 0
      );
  };

export const resolverReproceso = async ({
  db,
  perfil,
  registro,
  cantidadOk,
  cantidadMerma,
  observacion
}) => {
  const ok = Number(cantidadOk || 0);
  const merma = Number(cantidadMerma || 0);
  const pendiente = Number(
    registro?.cantidad_reproceso_pendiente || 0
  );

  if (
    !registro ||
    !Number.isFinite(ok) ||
    !Number.isFinite(merma) ||
    ok < 0 ||
    merma < 0 ||
    ok + merma !== pendiente
  ) {
    throw new Error(
      "La resolución debe distribuir todo el reproceso pendiente entre OK y merma."
    );
  }

  const operaciones = await listarOperacionesOT(
    db,
    perfil.empresa_id,
    registro.planta_id,
    registro.ot_id
  );
  const registroRef = doc(
    db,
    "registros_calidad",
    registro.id
  );
  const otRef = doc(
    db,
    "ordenes_trabajo",
    registro.ot_id
  );
  const operacionRef = doc(
    db,
    "ordenes_trabajo",
    registro.ot_id,
    "operaciones",
    registro.ot_operacion_id
  );
  const eventoRef = doc(
    collection(db, "eventos_produccion")
  );
  const operacionesRefs = operaciones.map(
    operacion => ({
      id: operacion.id,
      ref: doc(
        db,
        "ordenes_trabajo",
        registro.ot_id,
        "operaciones",
        operacion.id
      )
    })
  );

  await runTransaction(db, async transaccion => {
    const registroSnap =
      await transaccion.get(registroRef);
    const otSnap =
      await transaccion.get(otRef);
    const operacionSnap =
      await transaccion.get(operacionRef);
    const operacionesSnap = [];

    for (const item of operacionesRefs) {
      operacionesSnap.push(
        await transaccion.get(item.ref)
      );
    }

    if (
      !registroSnap.exists() ||
      registroSnap.data().estado_reproceso !==
        "pendiente"
    ) {
      throw new Error(
        "El reproceso ya fue resuelto."
      );
    }

    if (!otSnap.exists() || !operacionSnap.exists()) {
      throw new Error(
        "No se encontró la OT del reproceso."
      );
    }

    const datosOt = otSnap.data();
    const datosOperacion = operacionSnap.data();
    const pendienteOt = Math.max(
      0,
      Number(
        datosOt.reprocesos_pendientes || 0
      ) - pendiente
    );
    const cantidadOkActualizada =
      Number(datosOperacion.cantidad_ok || 0) +
      ok;
    const cantidadPendienteActualizada =
      Math.max(
        0,
        Number(
          datosOperacion.cantidad_pendiente ||
          0
        ) - ok
      );
    const cantidadRequerida = Number(
      datosOperacion.cantidad_requerida || 0
    );
    const operacionesActualizadas =
      operacionesSnap.map(snapshot => {
        const datos = snapshot.data();

        return snapshot.id ===
          registro.ot_operacion_id
          ? {
            ...datos,
            cantidad_ok: cantidadOkActualizada,
            cantidad_pendiente:
              cantidadPendienteActualizada
          }
          : datos;
      });
    const todasTerminadas =
      operacionesActualizadas.every(
        operacion =>
          Number(
            operacion.cantidad_pendiente
          ) <= 0
      );
    const completada =
      todasTerminadas && pendienteOt === 0;
    const proyeccion = calcularProyeccionOT(
      operacionesActualizadas
    );

    transaccion.update(registroRef, {
      estado_reproceso: "resuelto",
      cantidad_reproceso_pendiente: 0,
      cantidad_resuelta_ok: ok,
      cantidad_resuelta_merma: merma,
      observacion_resolucion:
        limpiarTexto(observacion),
      resuelto_por_id: perfil.uid,
      resuelto_por_nombre: perfil.nombre,
      resuelto_en: serverTimestamp()
    });
    transaccion.update(operacionRef, {
      reproceso_pendiente: Math.max(
        0,
        Number(
          datosOperacion.reproceso_pendiente || 0
        ) - pendiente
      ),
      cantidad_ok: cantidadOkActualizada,
      cantidad_merma:
        Number(
          datosOperacion.cantidad_merma ||
          datosOperacion
            .cantidad_defectuosa ||
          0
        ) + merma,
      cantidad_defectuosa:
        Number(
          datosOperacion.cantidad_defectuosa ||
          0
        ) + merma,
      cantidad_pendiente:
        cantidadPendienteActualizada,
      avance_pct:
        cantidadRequerida > 0
          ? Number(
            Math.min(
              100,
              (
                cantidadOkActualizada /
                cantidadRequerida
              ) * 100
            ).toFixed(2)
          )
          : 0,
      estado:
        cantidadPendienteActualizada === 0
          ? "completada"
          : "en_proceso",
      fecha_fin:
        cantidadPendienteActualizada === 0
          ? serverTimestamp()
          : null,
      fecha_actualizacion: serverTimestamp()
    });
    transaccion.update(otRef, {
      reprocesos_pendientes: pendienteOt,
      merma_total:
        Number(datosOt.merma_total || 0) +
        merma,
      ...proyeccion,
      estado: completada
        ? "completada"
        : "en_produccion",
      fecha_real_fin: completada
        ? serverTimestamp()
        : null,
      estimado_horas_restantes:
        completada
          ? 0
          : proyeccion
            .estimado_horas_restantes,
      fecha_estimada_fin:
        completada
          ? serverTimestamp()
          : proyeccion.fecha_estimada_fin,
      fecha_actualizacion: serverTimestamp()
    });
    transaccion.set(eventoRef, {
      sesion_id: registro.sesion_id,
      empresa_id: perfil.empresa_id,
      planta_id: registro.planta_id,
      ot_id: registro.ot_id,
      ot_operacion_id:
        registro.ot_operacion_id,
      operario_id: registro.operario_id,
      tipo: "resolucion_reproceso",
      cantidad_ok: ok,
      cantidad_defectuosa: merma,
      cantidad_reproceso: -pendiente,
      registro_calidad_id: registro.id,
      observacion: limpiarTexto(observacion),
      timestamp: serverTimestamp(),
      registrado_por_id: perfil.uid,
      modelo_version: 2
    });
  });
};
