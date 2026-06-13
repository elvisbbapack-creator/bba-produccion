import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
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
