import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import {
  congelarRutaParaOT
} from "../../domain/produccionV2";
import {
  obtenerRuta
} from "../productos/productosRepository";
import {
  listarMateriales
} from "../materiales/materialesRepository";

const limpiarTexto = (valor) =>
  (valor || "").toString().trim();

const numeroPositivo = (valor) =>
  Number.isFinite(Number(valor)) &&
  Number(valor) > 0;

const codigoPlanta = (plantaId) =>
  limpiarTexto(plantaId)
    .toUpperCase()
    .slice(0, 3);

export const calcularProyeccionOT = (
  operaciones = [],
  fechaReferencia = new Date()
) => {
  const totalRequerido = operaciones.reduce(
    (total, operacion) =>
      total +
      Number(operacion.cantidad_requerida || 0),
    0
  );
  const totalOk = operaciones.reduce(
    (total, operacion) =>
      total + Number(operacion.cantidad_ok || 0),
    0
  );
  const totalPendiente = operaciones.reduce(
    (total, operacion) =>
      total +
      Number(operacion.cantidad_pendiente || 0),
    0
  );
  const horasPorOperacion = operaciones.map(
    operacion => {
      const pendiente = Number(
        operacion.cantidad_pendiente || 0
      );
      const velocidad = Number(
        operacion.unidades_por_hora || 0
      );

      return velocidad > 0
        ? pendiente / velocidad
        : 0;
    }
  );
  const horasRestantes = Math.max(
    0,
    ...horasPorOperacion
  );
  const referencia = new Date(fechaReferencia);
  const fechaEstimadaFin = new Date(
    referencia.getTime() +
    horasRestantes * 60 * 60 * 1000
  );
  const avance = totalRequerido > 0
    ? Math.min(
      100,
      (totalOk / totalRequerido) * 100
    )
    : 0;

  return {
    cantidad_total_requerida: totalRequerido,
    cantidad_total_ok: totalOk,
    cantidad_total_pendiente: totalPendiente,
    avance_pct: Number(avance.toFixed(2)),
    estimado_horas_restantes: Number(
      horasRestantes.toFixed(2)
    ),
    fecha_estimada_fin: fechaEstimadaFin
  };
};

export const simularTurnosOT = (
  operaciones = [],
  {
    turnosBase = 2,
    turnosCuello = 3,
    horasPorTurno = 8,
    fechaReferencia = new Date()
  } = {}
) => {
  const capacidadBaseDia =
    Number(turnosBase) *
    Number(horasPorTurno);
  const capacidadAmpliadaDia =
    Number(turnosCuello) *
    Number(horasPorTurno);

  if (
    capacidadBaseDia <= 0 ||
    capacidadAmpliadaDia <= 0
  ) {
    throw new Error(
      "La configuración de turnos debe ser positiva."
    );
  }

  const cargas = operaciones.map(operacion => {
    const pendiente = Number(
      operacion.cantidad_pendiente || 0
    );
    const velocidad = Number(
      operacion.unidades_por_hora || 0
    );
    const horasTrabajo = velocidad > 0
      ? pendiente / velocidad
      : 0;

    return {
      id:
        operacion.id ||
        operacion.ruta_operacion_id,
      codigo: operacion.operacion_codigo,
      nombre: operacion.operacion_nombre,
      cantidad_pendiente: pendiente,
      unidades_por_hora: velocidad,
      horas_trabajo: Number(
        horasTrabajo.toFixed(2)
      ),
      dias_base: Number(
        (horasTrabajo / capacidadBaseDia)
          .toFixed(3)
      )
    };
  });
  const cuello = [...cargas].sort(
    (a, b) => b.dias_base - a.dias_base
  )[0] || null;
  const escenario = cargas.map(carga => {
    const ampliada =
      carga.id === cuello?.id;
    const diasEscenario =
      carga.horas_trabajo /
      (
        ampliada
          ? capacidadAmpliadaDia
          : capacidadBaseDia
      );

    return {
      ...carga,
      es_cuello_botella: ampliada,
      turnos_escenario:
        ampliada ? turnosCuello : turnosBase,
      dias_escenario: Number(
        diasEscenario.toFixed(3)
      )
    };
  });
  const diasBase = Math.max(
    0,
    ...cargas.map(carga => carga.dias_base)
  );
  const diasEscenario = Math.max(
    0,
    ...escenario.map(
      carga => carga.dias_escenario
    )
  );
  const referencia = new Date(fechaReferencia);
  const fechaBase = new Date(
    referencia.getTime() +
    diasBase * 24 * 60 * 60 * 1000
  );
  const fechaEscenario = new Date(
    referencia.getTime() +
    diasEscenario * 24 * 60 * 60 * 1000
  );
  const ahorroHoras = Math.max(
    0,
    (diasBase - diasEscenario) * 24
  );

  return {
    turnos_base: Number(turnosBase),
    turnos_cuello: Number(turnosCuello),
    horas_por_turno: Number(horasPorTurno),
    cuello_botella: cuello,
    operaciones: escenario,
    dias_base: Number(diasBase.toFixed(3)),
    dias_escenario: Number(
      diasEscenario.toFixed(3)
    ),
    fecha_fin_base: fechaBase,
    fecha_fin_escenario: fechaEscenario,
    ahorro_horas_calendario: Number(
      ahorroHoras.toFixed(2)
    ),
    recomienda_ampliar:
      Boolean(cuello) && ahorroHoras >= 0.5
  };
};

const idConfiguracionCapacidad = (
  empresaId,
  plantaId
) => `${empresaId}__${plantaId}`;

export const obtenerConfiguracionCapacidad =
  async (db, empresaId, plantaId) => {
    const referencia = doc(
      db,
      "configuracion_capacidad",
      idConfiguracionCapacidad(
        empresaId,
        plantaId
      )
    );
    const snapshot = await getDoc(referencia);

    return snapshot.exists()
      ? {
        id: snapshot.id,
        ...snapshot.data()
      }
      : {
        empresa_id: empresaId,
        planta_id: plantaId,
        turnos_base: 2,
        turnos_ampliados: 3,
        horas_efectivas_turno: 8
      };
  };

export const guardarConfiguracionCapacidad =
  async ({
    db,
    perfil,
    plantaId,
    turnosBase,
    turnosAmpliados,
    horasEfectivasTurno
  }) => {
    const valores = [
      turnosBase,
      turnosAmpliados,
      horasEfectivasTurno
    ].map(Number);

    if (
      valores.some(
        valor =>
          !Number.isFinite(valor) ||
          valor <= 0
      ) ||
      valores[1] <= valores[0]
    ) {
      throw new Error(
        "La capacidad requiere horas positivas y más turnos en el escenario ampliado."
      );
    }

    const referencia = doc(
      db,
      "configuracion_capacidad",
      idConfiguracionCapacidad(
        perfil.empresa_id,
        plantaId
      )
    );
    const configuracion = {
      empresa_id: perfil.empresa_id,
      planta_id: plantaId,
      turnos_base: valores[0],
      turnos_ampliados: valores[1],
      horas_efectivas_turno: valores[2],
      actualizado_por_id: perfil.uid,
      actualizado_en: serverTimestamp()
    };

    await setDoc(
      referencia,
      configuracion,
      { merge: true }
    );

    return configuracion;
  };

export const formatearCodigoOT = (
  plantaId,
  correlativo
) => {
  return `OT-${codigoPlanta(plantaId)}-${String(
    correlativo
  ).padStart(6, "0")}`;
};

export const prepararOrden = ({
  codigo,
  correlativo,
  empresaId,
  plantaId,
  clienteNombre,
  producto,
  cantidadProducto,
  fechaInicio,
  fechaEntrega,
  perfil
}) => ({
  codigo,
  correlativo,
  empresa_id: empresaId,
  planta_id: plantaId,
  cliente_id: "",
  cliente_nombre: limpiarTexto(
    clienteNombre
  ),
  producto_id: producto.id,
  producto_codigo: producto.codigo,
  producto_nombre: producto.nombre,
  ruta_id: `v${producto.version_ruta_activa}`,
  ruta_version: Number(
    producto.version_ruta_activa
  ),
  cantidad_producto: Number(
    cantidadProducto
  ),
  estado: "liberada",
  fecha_planificada_inicio:
    fechaInicio
      ? new Date(`${fechaInicio}T12:00:00`)
      : null,
  fecha_planificada_entrega:
    fechaEntrega
      ? new Date(`${fechaEntrega}T12:00:00`)
      : null,
  fecha_real_inicio: null,
  fecha_real_fin: null,
  avance_pct: 0,
  cantidad_total_requerida: 0,
  cantidad_total_ok: 0,
  cantidad_total_pendiente: 0,
  estimado_horas_restantes: 0,
  fecha_estimada_fin: null,
  merma_total: 0,
  reprocesos_pendientes: 0,
  creada_por_id: perfil.uid,
  creada_por_nombre: perfil.nombre,
  modelo_version: 2
});

export const validarDatosOrden = ({
  plantaId,
  clienteNombre,
  producto,
  cantidadProducto,
  fechaInicio,
  fechaEntrega
}) => {
  const errores = [];

  if (!plantaId) {
    errores.push("Selecciona una planta.");
  }

  if (!limpiarTexto(clienteNombre)) {
    errores.push("La OT requiere cliente.");
  }

  if (
    !producto ||
    !producto.version_ruta_activa
  ) {
    errores.push(
      "Selecciona un producto con ruta publicada."
    );
  }

  if (!numeroPositivo(cantidadProducto)) {
    errores.push(
      "La cantidad debe ser mayor que cero."
    );
  }

  if (
    fechaInicio &&
    fechaEntrega &&
    fechaEntrega < fechaInicio
  ) {
    errores.push(
      "La fecha de entrega no puede ser anterior al inicio."
    );
  }

  return errores;
};

export const listarOrdenesV2 = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "ordenes_trabajo"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId),
      where("modelo_version", "==", 2)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort(
      (a, b) =>
        Number(b.correlativo) -
        Number(a.correlativo)
    );
};

export const listarOperacionesOT = async (
  db,
  empresaId,
  plantaId,
  otId
) => {
  const snapshot = await getDocs(
    query(
      collection(
        db,
        "ordenes_trabajo",
        otId,
        "operaciones"
      ),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort(
      (a, b) =>
        Number(a.secuencia) -
        Number(b.secuencia)
    );
};

export const crearOrdenV2 = async ({
  db,
  perfil,
  plantaId,
  clienteNombre,
  producto,
  cantidadProducto,
  fechaInicio,
  fechaEntrega
}) => {
  const errores = validarDatosOrden({
    plantaId,
    clienteNombre,
    producto,
    cantidadProducto,
    fechaInicio,
    fechaEntrega
  });

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const [ruta, materiales] = await Promise.all([
    obtenerRuta(
      db,
      producto.id,
      perfil.empresa_id,
      producto.version_ruta_activa
    ),
    listarMateriales(
      db,
      perfil.empresa_id
    )
  ]);

  if (ruta.estado !== "publicada") {
    throw new Error(
      "La ruta seleccionada no está publicada."
    );
  }

  const operaciones = congelarRutaParaOT({
    ruta,
    materiales,
    cantidadProducto
  });
  const proyeccion = calcularProyeccionOT(
    operaciones,
    fechaInicio
      ? new Date(`${fechaInicio}T12:00:00`)
      : new Date()
  );
  const correlativoId =
    `${perfil.empresa_id}__${plantaId}__ot`;
  const correlativoRef = doc(
    db,
    "correlativos",
    correlativoId
  );
  const otRef = doc(
    collection(db, "ordenes_trabajo")
  );
  let ordenCreada;

  await runTransaction(
    db,
    async transaccion => {
      const correlativoSnap =
        await transaccion.get(correlativoRef);
      const siguiente =
        Number(
          correlativoSnap.exists()
            ? correlativoSnap.data().ultimo
            : 0
        ) + 1;
      const codigo = formatearCodigoOT(
        plantaId,
        siguiente
      );
      const orden = prepararOrden({
        codigo,
        correlativo: siguiente,
        empresaId: perfil.empresa_id,
        plantaId,
        clienteNombre,
        producto,
        cantidadProducto,
        fechaInicio,
        fechaEntrega,
        perfil
      });

      transaccion.set(correlativoRef, {
        empresa_id: perfil.empresa_id,
        planta_id: plantaId,
        tipo: "ot",
        ultimo: siguiente,
        actualizado_en: serverTimestamp()
      });
      transaccion.set(otRef, {
        ...orden,
        ...proyeccion,
        fecha_creacion: serverTimestamp(),
        fecha_actualizacion: serverTimestamp()
      });

      operaciones.forEach(operacion => {
        const operacionRef = doc(
          db,
          "ordenes_trabajo",
          otRef.id,
          "operaciones",
          operacion.ruta_operacion_id
        );

        transaccion.set(operacionRef, {
          ...operacion,
          empresa_id: perfil.empresa_id,
          planta_id: plantaId,
          ot_id: otRef.id,
          ot_codigo: codigo,
          fecha_creacion: serverTimestamp(),
          fecha_actualizacion:
            serverTimestamp()
        });
      });

      ordenCreada = {
        id: otRef.id,
        ...orden
      };
    }
  );

  return {
    orden: ordenCreada,
    operaciones
  };
};
