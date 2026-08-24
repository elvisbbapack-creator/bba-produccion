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
  registrarMovimientoAlmacen,
  TIPOS_MOVIMIENTO_ALMACEN
} from "../almacen/almacenRepository";

export const ESTADOS_SOLICITUD_COMPRA = {
  PENDIENTE: "pendiente",
  EN_OC: "en_oc",
  CERRADA: "cerrada",
  ANULADA: "anulada"
};

export const ESTADOS_ORDEN_COMPRA = {
  BORRADOR: "borrador",
  APROBADA: "aprobada",
  ENVIADA: "enviada",
  PARCIAL_RECIBIDA: "parcial_recibida",
  RECIBIDA: "recibida",
  ANULADA: "anulada"
};

export const PRIORIDADES_COMPRA = [
  "normal",
  "alta",
  "urgente"
];

export const AREAS_SOLICITUD_COMPRA = [
  {
    id: "produccion",
    nombre: "Producción"
  },
  {
    id: "almacen",
    nombre: "Almacén"
  },
  {
    id: "ingenieria",
    nombre: "Ingeniería"
  },
  {
    id: "mantencion",
    nombre: "Mantención"
  },
  {
    id: "calidad",
    nombre: "Calidad"
  },
  {
    id: "administracion",
    nombre: "Administración"
  },
  {
    id: "comercial",
    nombre: "Comercial"
  },
  {
    id: "rrhh",
    nombre: "RRHH"
  },
  {
    id: "gerencia",
    nombre: "Gerencia"
  }
];

export const MOTIVOS_SOLICITUD_COMPRA = [
  {
    id: "reposicion_stock",
    nombre: "Reposición de stock"
  },
  {
    id: "consumo_ot",
    nombre: "Consumo por OT"
  },
  {
    id: "compra_urgente",
    nombre: "Compra urgente"
  },
  {
    id: "mantencion",
    nombre: "Mantención"
  },
  {
    id: "prototipo_cotizacion",
    nombre: "Prototipo o cotización"
  },
  {
    id: "herramienta_equipo",
    nombre: "Herramienta o equipo"
  },
  {
    id: "oficina_aseo",
    nombre: "Oficina o aseo"
  },
  {
    id: "otro",
    nombre: "Otro"
  }
];

const limpiarTexto = valor =>
  (valor || "").toString().trim();

const buscarCatalogo = (catalogo, id) =>
  catalogo.find(item => item.id === limpiarTexto(id));

const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
};

const generarTokenCompartir = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 14)}`;
};

const normalizarCodigo = valor =>
  limpiarTexto(valor).toUpperCase();

const idOrdenCompra = (empresaId, codigo) =>
  `${empresaId}__${codigo}`;

export const siguienteCodigoOrdenCompra = (
  ordenes = []
) => {
  const usados = new Set(
    ordenes
      .map(orden => normalizarCodigo(orden.codigo))
      .filter(codigo => /^OC\d{4,}$/.test(codigo))
  );
  let correlativo = 1;

  while (
    usados.has(
      `OC${String(correlativo).padStart(4, "0")}`
    )
  ) {
    correlativo += 1;
  }

  return `OC${String(correlativo).padStart(4, "0")}`;
};

export const proveedorDesdeMaterial = (
  material = {},
  proveedores = []
) => {
  const proveedor =
    proveedores.find(item =>
      item.id ===
        material.proveedor_preferente_id ||
      item.codigo ===
        material.proveedor_preferente_codigo
    ) || null;

  return {
    proveedor_id:
      proveedor?.id ||
      material.proveedor_preferente_id ||
      "",
    proveedor_codigo:
      proveedor?.codigo ||
      material.proveedor_preferente_codigo ||
      "",
    proveedor_nombre:
      proveedor?.nombre ||
      material.proveedor_preferente_nombre ||
      "Sin proveedor asignado",
    proveedor_email: proveedor?.email || "",
    proveedor_telefono: proveedor?.telefono || "",
    condicion_pago:
      proveedor?.condicion_pago || ""
  };
};

export const prepararSolicitudCompra = ({
  empresaId,
  plantaId,
  material,
  proveedor,
  cantidad,
  prioridad = "normal",
  areaSolicitante = "produccion",
  motivoSolicitud = "reposicion_stock",
  fechaRequerida = "",
  otCodigo = "",
  solicitudInternaId = "",
  solicitudInternaCodigo = "",
  lineaSolicitudNumero = 0,
  origen = "manual",
  observacion = "",
  usuario
}) => {
  const area =
    buscarCatalogo(
      AREAS_SOLICITUD_COMPRA,
      areaSolicitante
    ) || AREAS_SOLICITUD_COMPRA[0];
  const motivo =
    buscarCatalogo(
      MOTIVOS_SOLICITUD_COMPRA,
      motivoSolicitud
    ) || MOTIVOS_SOLICITUD_COMPRA[0];

  return {
  empresa_id: limpiarTexto(empresaId),
  planta_id: limpiarTexto(plantaId),
  area_solicitante_id: area.id,
  area_solicitante_nombre: area.nombre,
  motivo_solicitud_id: motivo.id,
  motivo_solicitud_nombre: motivo.nombre,
  solicitud_interna_id: limpiarTexto(
    solicitudInternaId
  ),
  solicitud_interna_codigo: limpiarTexto(
    solicitudInternaCodigo
  ),
  linea_solicitud_numero: numero(
    lineaSolicitudNumero
  ),
  material_id: limpiarTexto(material?.id),
  material_codigo: limpiarTexto(material?.codigo),
  material_nombre: limpiarTexto(material?.nombre),
  material_tipo: limpiarTexto(material?.tipo),
  unidad_medida: limpiarTexto(
    material?.unidad_medida
  ),
  costo_unitario_referencial: numero(
    material?.costo_unitario_referencial
  ),
  moneda: limpiarTexto(material?.moneda) || "CLP",
  proveedor_id: limpiarTexto(
    proveedor?.proveedor_id || proveedor?.id
  ),
  proveedor_codigo: limpiarTexto(
    proveedor?.proveedor_codigo ||
      proveedor?.codigo
  ),
  proveedor_nombre:
    limpiarTexto(
      proveedor?.proveedor_nombre ||
        proveedor?.nombre
    ) || "Sin proveedor asignado",
  proveedor_email: limpiarTexto(
    proveedor?.proveedor_email ||
      proveedor?.email
  ),
  proveedor_telefono: limpiarTexto(
    proveedor?.proveedor_telefono ||
      proveedor?.telefono
  ),
  cantidad: numero(cantidad),
  prioridad: PRIORIDADES_COMPRA.includes(
    prioridad
  )
    ? prioridad
    : "normal",
  fecha_requerida: limpiarTexto(fechaRequerida),
  ot_codigo: normalizarCodigo(otCodigo),
  origen:
    limpiarTexto(origen) || "solicitud_interna",
  observacion: limpiarTexto(observacion),
  estado: ESTADOS_SOLICITUD_COMPRA.PENDIENTE,
  solicitado_por_id: limpiarTexto(usuario?.uid),
  solicitado_por_nombre: limpiarTexto(
    usuario?.nombre
  ),
  solicitado_por_email: limpiarTexto(
    usuario?.email || usuario?.correo
  ),
  modelo_version: 2
  };
};

export const validarSolicitudCompra = solicitud => {
  const errores = [];

  if (!solicitud.empresa_id) {
    errores.push("Falta empresa.");
  }

  if (!solicitud.planta_id) {
    errores.push("Selecciona planta.");
  }

  if (!solicitud.area_solicitante_id) {
    errores.push("Selecciona área solicitante.");
  }

  if (!solicitud.material_id) {
    errores.push("Selecciona material o suministro.");
  }

  if (solicitud.cantidad <= 0) {
    errores.push(
      "La cantidad solicitada debe ser mayor que cero."
    );
  }

  return errores;
};

export const prepararItemOrdenCompra = (
  solicitud
) => {
  const cantidad = numero(solicitud.cantidad);
  const costoUnitario = numero(
    solicitud.costo_unitario_referencial
  );

  return {
    solicitud_compra_id: solicitud.id || "",
    material_id: solicitud.material_id,
    material_codigo: solicitud.material_codigo,
    material_nombre: solicitud.material_nombre,
    material_tipo: solicitud.material_tipo,
    unidad_medida: solicitud.unidad_medida,
    cantidad,
    costo_unitario: costoUnitario,
    moneda: solicitud.moneda || "CLP",
    total_linea: cantidad * costoUnitario,
    ot_codigo: solicitud.ot_codigo || "",
    area_solicitante_id:
      solicitud.area_solicitante_id || "",
    area_solicitante_nombre:
      solicitud.area_solicitante_nombre || "",
    motivo_solicitud_id:
      solicitud.motivo_solicitud_id || "",
    motivo_solicitud_nombre:
      solicitud.motivo_solicitud_nombre || "",
    solicitado_por_id:
      solicitud.solicitado_por_id || "",
    solicitado_por_nombre:
      solicitud.solicitado_por_nombre || "",
    solicitado_por_email:
      solicitud.solicitado_por_email || "",
    fecha_requerida:
      solicitud.fecha_requerida || "",
    solicitud_interna_id:
      solicitud.solicitud_interna_id || "",
    solicitud_interna_codigo:
      solicitud.solicitud_interna_codigo || "",
    linea_solicitud_numero:
      solicitud.linea_solicitud_numero || 0,
    observacion: solicitud.observacion || ""
  };
};

export const calcularTotalesOrdenCompra = (
  items = []
) => {
  const subtotal = items.reduce(
    (total, item) =>
      total + numero(item.total_linea),
    0
  );

  return {
    subtotal,
    total: subtotal
  };
};

export const prepararOrdenCompra = ({
  empresaId,
  plantaId,
  codigo,
  proveedor,
  solicitudes,
  observacion = "",
  usuario
}) => {
  const items = solicitudes.map(
    prepararItemOrdenCompra
  );
  const totales =
    calcularTotalesOrdenCompra(items);

  return {
    empresa_id: limpiarTexto(empresaId),
    planta_id: limpiarTexto(plantaId),
    codigo: normalizarCodigo(codigo),
    proveedor_id: limpiarTexto(
      proveedor?.proveedor_id || proveedor?.id
    ),
    proveedor_codigo: limpiarTexto(
      proveedor?.proveedor_codigo ||
        proveedor?.codigo
    ),
    proveedor_nombre:
      limpiarTexto(
        proveedor?.proveedor_nombre ||
          proveedor?.nombre
      ) || "Sin proveedor asignado",
    proveedor_email: limpiarTexto(
      proveedor?.proveedor_email ||
        proveedor?.email
    ),
    proveedor_telefono: limpiarTexto(
      proveedor?.proveedor_telefono ||
        proveedor?.telefono
    ),
    condicion_pago:
      limpiarTexto(proveedor?.condicion_pago),
    moneda: items[0]?.moneda || "CLP",
    items,
    subtotal: totales.subtotal,
    total: totales.total,
    observacion: limpiarTexto(observacion),
    estado: ESTADOS_ORDEN_COMPRA.BORRADOR,
    token_compartir: generarTokenCompartir(),
    compartir_activo: true,
    creado_por_id: limpiarTexto(usuario?.uid),
    creado_por_nombre: limpiarTexto(
      usuario?.nombre
    ),
    modelo_version: 2
  };
};

export const construirRutaPublicaOrdenCompra = orden =>
  orden?.token_compartir
    ? `/oc-publica/${encodeURIComponent(
        orden.token_compartir
      )}`
    : "";

const obtenerOrigenPublicoOrdenCompra = () =>
  limpiarTexto(
    process.env.REACT_APP_PUBLIC_OC_BASE_URL
  ) ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "");

export const construirUrlPublicaOrdenCompra = (
  orden,
  origen = obtenerOrigenPublicoOrdenCompra()
) => {
  const ruta = construirRutaPublicaOrdenCompra(orden);

  if (!ruta) {
    return "";
  }

  return `${limpiarTexto(origen).replace(/\/$/, "")}${ruta}`;
};

const prepararOrdenCompraPublica = orden => ({
  empresa_id: limpiarTexto(orden?.empresa_id),
  planta_id: limpiarTexto(orden?.planta_id),
  codigo: limpiarTexto(orden?.codigo),
  proveedor_nombre: limpiarTexto(orden?.proveedor_nombre),
  proveedor_email: limpiarTexto(orden?.proveedor_email),
  proveedor_telefono: limpiarTexto(orden?.proveedor_telefono),
  condicion_pago: limpiarTexto(orden?.condicion_pago),
  moneda: limpiarTexto(orden?.moneda) || "CLP",
  items: Array.isArray(orden?.items) ? orden.items : [],
  subtotal: numero(orden?.subtotal),
  total: numero(orden?.total),
  observacion: limpiarTexto(orden?.observacion),
  estado: limpiarTexto(orden?.estado),
  token_compartir: limpiarTexto(orden?.token_compartir),
  compartir_activo: orden?.compartir_activo !== false,
  modelo_version: 2
});

export const publicarOrdenCompraCompartida = async ({
  db,
  orden
}) => {
  const token =
    limpiarTexto(orden?.token_compartir) ||
    generarTokenCompartir();
  const ordenCompartida = prepararOrdenCompraPublica({
    ...orden,
    token_compartir: token,
    compartir_activo: true
  });

  await setDoc(
    doc(db, "ordenes_compra_publicas", token),
    {
      ...ordenCompartida,
      publicado_en: serverTimestamp()
    },
    { merge: true }
  );

  return {
    ...orden,
    token_compartir: token,
    compartir_activo: true
  };
};

export const obtenerOrdenCompraPublica = async (
  db,
  token
) => {
  const tokenLimpio = limpiarTexto(token);

  if (!tokenLimpio) {
    return null;
  }

  const snapshot = await getDoc(
    doc(db, "ordenes_compra_publicas", tokenLimpio)
  );

  if (!snapshot.exists()) {
    return null;
  }

  const datos = snapshot.data();

  return datos.compartir_activo === false
    ? null
    : {
        id: snapshot.id,
        ...datos
      };
};

export const validarOrdenCompra = orden => {
  const errores = [];

  if (!orden.codigo) {
    errores.push("Falta código de OC.");
  }

  if (!orden.proveedor_nombre) {
    errores.push("Selecciona proveedor.");
  }

  if (!orden.items?.length) {
    errores.push(
      "Agrega al menos un material a la OC."
    );
  }

  orden.items.forEach(item => {
    if (!item.material_id) {
      errores.push(
        "La OC contiene una línea sin material."
      );
    }

    if (numero(item.cantidad) <= 0) {
      errores.push(
        `La cantidad de ${item.material_codigo} debe ser mayor que cero.`
      );
    }
  });

  return errores;
};

export const agruparSolicitudesPorProveedor = (
  solicitudes = []
) => {
  const grupos = new Map();

  solicitudes
    .filter(
      solicitud =>
        solicitud.estado ===
        ESTADOS_SOLICITUD_COMPRA.PENDIENTE
    )
    .forEach(solicitud => {
      const clave =
        solicitud.proveedor_id ||
        solicitud.proveedor_nombre ||
        "sin_proveedor";

      if (!grupos.has(clave)) {
        grupos.set(clave, {
          proveedor_id: solicitud.proveedor_id,
          proveedor_codigo:
            solicitud.proveedor_codigo,
          proveedor_nombre:
            solicitud.proveedor_nombre,
          proveedor_email:
            solicitud.proveedor_email,
          proveedor_telefono:
            solicitud.proveedor_telefono,
          solicitudes: []
        });
      }

      grupos.get(clave).solicitudes.push(solicitud);
    });

  return [...grupos.values()].sort((a, b) =>
    (a.proveedor_nombre || "").localeCompare(
      b.proveedor_nombre || ""
    )
  );
};

export const construirTextoOrdenCompra = (
  orden,
  { urlPublica = "" } = {}
) => {
  const lineas = [
    `Orden de compra ${orden.codigo}`,
    `Proveedor: ${orden.proveedor_nombre}`,
    `Planta: ${orden.planta_id}`,
    "",
    "Detalle:"
  ];

  orden.items.forEach(item => {
    const contexto = [
      item.area_solicitante_nombre,
      item.motivo_solicitud_nombre,
      item.solicitud_interna_codigo
        ? `Req ${item.solicitud_interna_codigo}`
        : "",
      item.ot_codigo ? `OT ${item.ot_codigo}` : ""
    ].filter(Boolean);

    lineas.push([
      `- ${item.material_codigo} ${item.material_nombre}: ${item.cantidad} ${item.unidad_medida}`,
      contexto.length ? `(${contexto.join(" | ")})` : ""
    ].filter(Boolean).join(" "));
  });

  lineas.push("");
  lineas.push(
    `Total referencial: ${orden.moneda} ${Math.round(
      numero(orden.total)
    ).toLocaleString("es-CL")}`
  );

  if (orden.observacion) {
    lineas.push(`Observación: ${orden.observacion}`);
  }

  if (urlPublica) {
    lineas.push("");
    lineas.push(
      `Puedes revisar y descargar la OC aquí: ${urlPublica}`
    );
  }

  return lineas.join("\n");
};

export const crearEnlaceCorreoOrdenCompra =
  (orden, opciones = {}) => {
    const asunto = encodeURIComponent(
      `OC ${orden.codigo} - BBA`
    );
    const cuerpo = encodeURIComponent(
      construirTextoOrdenCompra(orden, opciones)
    );
    const email = encodeURIComponent(
      orden.proveedor_email || ""
    );

    return `mailto:${email}?subject=${asunto}&body=${cuerpo}`;
  };

export const crearEnlaceWhatsappOrdenCompra =
  (orden, opciones = {}) => {
    const telefono = limpiarTexto(
      orden.proveedor_telefono
    ).replace(/[^\d]/g, "");
    const texto = encodeURIComponent(
      construirTextoOrdenCompra(orden, opciones)
    );

    return telefono
      ? `https://wa.me/${telefono}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
  };

const correosSolicitantesOrden = orden => [
  ...new Set(
    (orden.items || [])
      .map(item => limpiarTexto(item.solicitado_por_email))
      .filter(Boolean)
  )
];

const codigosSolicitudInternaOrden = orden => [
  ...new Set(
    (orden.items || [])
      .map(item =>
        limpiarTexto(item.solicitud_interna_codigo)
      )
      .filter(Boolean)
  )
];

export const construirTextoAvisoInternoOrdenCompra = (
  orden,
  evento = "emitida"
) => {
  const accion =
    evento === "recibida"
      ? "fue recibida en Almacén"
      : "fue emitida por Compras";
  const lineas = [
    `La OC ${orden.codigo} ${accion}.`,
    `Proveedor: ${orden.proveedor_nombre}`,
    `Planta: ${orden.planta_id}`,
    `Estado: ${orden.estado}`,
    `Total referencial: ${orden.moneda} ${Math.round(
      numero(orden.total)
    ).toLocaleString("es-CL")}`,
    ""
  ];
  const requerimientos =
    codigosSolicitudInternaOrden(orden);

  if (requerimientos.length > 0) {
    lineas.push(
      `Solicitud(es) interna(s): ${requerimientos.join(", ")}`
    );
    lineas.push("");
  }

  lineas.push("Detalle:");
  (orden.items || []).forEach(item => {
    const contexto = [
      item.solicitado_por_nombre
        ? `Solicitó: ${item.solicitado_por_nombre}`
        : "",
      item.area_solicitante_nombre,
      item.ot_codigo ? `OT ${item.ot_codigo}` : ""
    ].filter(Boolean);

    lineas.push([
      `- ${item.material_codigo} ${item.material_nombre}: ${item.cantidad} ${item.unidad_medida}`,
      contexto.length ? `(${contexto.join(" | ")})` : ""
    ].filter(Boolean).join(" "));
  });

  if (evento === "recibida") {
    lineas.push("");
    lineas.push(
      "Almacén ya registró la recepción y el stock fue actualizado."
    );
  }

  return lineas.join("\n");
};

const enlaceCorreo = ({
  para = [],
  cc = [],
  asunto,
  cuerpo
}) => {
  const destinatarios = para
    .map(limpiarTexto)
    .filter(Boolean)
    .join(",");
  const parametros = new URLSearchParams();

  parametros.set("subject", asunto);
  parametros.set("body", cuerpo);

  const copia = cc
    .map(limpiarTexto)
    .filter(Boolean)
    .join(",");

  if (copia) {
    parametros.set("cc", copia);
  }

  return `mailto:${destinatarios}?${parametros.toString()}`;
};

export const crearEnlaceCorreoAvisoSolicitantes =
  (orden, { correoContabilidad = "", evento = "emitida" } = {}) =>
    enlaceCorreo({
      para: correosSolicitantesOrden(orden),
      cc: correoContabilidad ? [correoContabilidad] : [],
      asunto: `OC ${orden.codigo} ${evento} - BBA`,
      cuerpo: construirTextoAvisoInternoOrdenCompra(
        orden,
        evento
      )
    });

export const crearEnlaceCorreoAvisoContabilidad =
  (orden, { correoContabilidad = "", evento = "emitida" } = {}) =>
    enlaceCorreo({
      para: correoContabilidad ? [correoContabilidad] : [],
      asunto: `OC ${orden.codigo} ${evento} - Contabilidad BBA`,
      cuerpo: construirTextoAvisoInternoOrdenCompra(
        orden,
        evento
      )
    });

export const listarSolicitudesCompra = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "solicitudes_compra"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) => {
      const derecha =
        b.solicitado_en?.toMillis?.() || 0;
      const izquierda =
        a.solicitado_en?.toMillis?.() || 0;
      return derecha - izquierda;
    });
};

export const listarOrdenesCompra = async (
  db,
  empresaId,
  plantaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "ordenes_compra"),
      where("empresa_id", "==", empresaId),
      where("planta_id", "==", plantaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) => {
      const derecha =
        b.creado_en?.toMillis?.() || 0;
      const izquierda =
        a.creado_en?.toMillis?.() || 0;
      return derecha - izquierda;
    });
};

export const crearSolicitudCompra = async ({
  db,
  perfil,
  plantaId,
  material,
  proveedor,
  cantidad,
  prioridad,
  fechaRequerida,
  otCodigo,
  solicitudInternaId,
  solicitudInternaCodigo,
  lineaSolicitudNumero,
  areaSolicitante,
  motivoSolicitud,
  origen,
  observacion
}) => {
  const solicitud = prepararSolicitudCompra({
    empresaId: perfil.empresa_id,
    plantaId,
    material,
    proveedor,
    cantidad,
    prioridad,
    areaSolicitante,
    motivoSolicitud,
    fechaRequerida,
    otCodigo,
    solicitudInternaId,
    solicitudInternaCodigo,
    lineaSolicitudNumero,
    origen,
    observacion,
    usuario: perfil
  });
  const errores =
    validarSolicitudCompra(solicitud);

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const solicitudRef = doc(
    collection(db, "solicitudes_compra")
  );

  await runTransaction(db, async transaccion => {
    transaccion.set(solicitudRef, {
      ...solicitud,
      solicitado_en: serverTimestamp(),
      actualizado_en: serverTimestamp()
    });
  });

  return {
    id: solicitudRef.id,
    ...solicitud
  };
};

export const generarOrdenCompraDesdeSolicitudes =
  async ({
    db,
    perfil,
    plantaId,
    codigo,
    proveedor,
    solicitudes,
    observacion
  }) => {
    const orden = prepararOrdenCompra({
      empresaId: perfil.empresa_id,
      plantaId,
      codigo,
      proveedor,
      solicitudes,
      observacion,
      usuario: perfil
    });
    const errores = validarOrdenCompra(orden);

    if (errores.length > 0) {
      throw new Error(errores.join(" "));
    }

    const ordenRef = doc(
      db,
      "ordenes_compra",
      idOrdenCompra(
        perfil.empresa_id,
        orden.codigo
      )
    );

    await runTransaction(db, async transaccion => {
      const ordenSnapshot =
        await transaccion.get(ordenRef);

      if (ordenSnapshot.exists()) {
        throw new Error(
          `La OC ${orden.codigo} ya existe. Actualiza la página para tomar el siguiente correlativo.`
        );
      }

      transaccion.set(ordenRef, {
        ...orden,
        creado_en: serverTimestamp(),
        actualizado_en: serverTimestamp()
      });

      solicitudes.forEach(solicitud => {
        transaccion.update(
          doc(
            db,
            "solicitudes_compra",
            solicitud.id
          ),
          {
            estado:
              ESTADOS_SOLICITUD_COMPRA.EN_OC,
            orden_compra_id: ordenRef.id,
            orden_compra_codigo:
              orden.codigo,
            actualizado_en: serverTimestamp()
          }
        );
      });
    });

    return {
      id: ordenRef.id,
      ...orden
    };
  };

export const actualizarEstadoOrdenCompra =
  async ({
    db,
    perfil,
    orden,
    estado
  }) => {
    if (
      !Object.values(ESTADOS_ORDEN_COMPRA).includes(
        estado
      )
    ) {
      throw new Error(
        "Selecciona un estado válido para la OC."
      );
    }

    const ordenRef = doc(
      db,
      "ordenes_compra",
      orden.id
    );

    await runTransaction(db, async transaccion => {
      const snapshot =
        await transaccion.get(ordenRef);

      if (!snapshot.exists()) {
        throw new Error("La OC ya no existe.");
      }

      const actual = snapshot.data();

      if (
        actual.empresa_id !== perfil.empresa_id ||
        actual.planta_id !== orden.planta_id
      ) {
        throw new Error(
          "La OC no pertenece a esta planta."
        );
      }

      transaccion.update(ordenRef, {
        estado,
        actualizado_por_id: perfil.uid || "",
        actualizado_por_nombre:
          perfil.nombre || "",
        actualizado_en: serverTimestamp(),
        ...(estado ===
        ESTADOS_ORDEN_COMPRA.ENVIADA
          ? {
            enviada_en: serverTimestamp(),
            enviada_por_id: perfil.uid || "",
            enviada_por_nombre:
              perfil.nombre || ""
          }
          : {})
      });
    });
  };

export const recibirOrdenCompraCompleta =
  async ({
    db,
    perfil,
    plantaId,
    orden
  }) => {
    if (!orden?.items?.length) {
      throw new Error(
        "La OC no tiene líneas para recibir."
      );
    }

    for (const item of orden.items) {
      await registrarMovimientoAlmacen({
        db,
        perfil,
        plantaId,
        material: {
          id: item.material_id,
          codigo: item.material_codigo,
          nombre: item.material_nombre,
          tipo: item.material_tipo,
          unidad_medida: item.unidad_medida
        },
        tipo: TIPOS_MOVIMIENTO_ALMACEN.RECEPCION,
        cantidad: item.cantidad,
        referencia: orden.codigo,
        observacion:
          `Recepción de compra ${orden.codigo}`
      });
    }

    await actualizarEstadoOrdenCompra({
      db,
      perfil,
      orden,
      estado: ESTADOS_ORDEN_COMPRA.RECIBIDA
    });
  };
