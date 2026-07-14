import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";

const COLECCION = "costos_operativos_planta";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
};

const redondear = (valor, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round(numero(valor) * factor) / factor;
};

export const ITEMS_OPERATIVOS_BASE = [
  {
    categoria: "personal",
    nombre: "Contador",
    cantidad: 1
  },
  {
    categoria: "personal",
    nombre: "Administrador",
    cantidad: 1
  },
  {
    categoria: "personal",
    nombre: "Jefe de Planta",
    cantidad: 1
  },
  {
    categoria: "personal",
    nombre: "Subjefe de Planta",
    cantidad: 1
  },
  {
    categoria: "personal",
    nombre: "Supervisor",
    cantidad: 2
  },
  {
    categoria: "personal",
    nombre: "Personal de limpieza",
    cantidad: 1
  },
  {
    categoria: "infraestructura",
    nombre: "Arriendo de bodega",
    cantidad: 1
  },
  {
    categoria: "servicio",
    nombre: "Agua potable",
    cantidad: 1
  },
  {
    categoria: "servicio",
    nombre: "Agua en bidones",
    cantidad: 1
  },
  {
    categoria: "insumo",
    nombre: "Insumos de limpieza",
    cantidad: 1
  },
  {
    categoria: "insumo",
    nombre: "Insumos de oficina",
    cantidad: 1
  },
  {
    categoria: "infraestructura",
    nombre: "Gastos comunes del condominio",
    cantidad: 1
  },
  {
    categoria: "otro",
    nombre: "Otros costos operativos",
    cantidad: 1
  }
];

export const itemOperativoVacio = () => ({
  categoria: "otro",
  nombre: "",
  cantidad: 1,
  costo_mensual_unitario: 0,
  observacion: ""
});

const normalizarItems = items =>
  (Array.isArray(items) && items.length > 0
    ? items
    : ITEMS_OPERATIVOS_BASE
  ).map(item => ({
    categoria: limpiarTexto(item.categoria) || "otro",
    nombre: limpiarTexto(item.nombre),
    cantidad: numero(item.cantidad) || 1,
    costo_mensual_unitario: numero(
      item.costo_mensual_unitario
    ),
    observacion: limpiarTexto(item.observacion)
  }));

export const calcularCostosOperativos = (
  datos = {}
) => {
  const items = normalizarItems(datos.items);
  const costoMensualTotal = items.reduce(
    (total, item) =>
      total +
      numero(item.cantidad) *
        numero(item.costo_mensual_unitario),
    0
  );
  const horasProductivasMes = Math.max(
    numero(datos.horas_productivas_mes),
    1
  );
  const costoOperativoHora =
    costoMensualTotal / horasProductivasMes;

  return {
    costo_mensual_total: redondear(costoMensualTotal),
    horas_productivas_mes: redondear(
      horasProductivasMes,
      1
    ),
    costo_operativo_hora: redondear(
      costoOperativoHora
    )
  };
};

export const prepararCostosOperativos = (
  datos,
  perfil,
  id
) => {
  const items = normalizarItems(datos.items);
  const calculos = calcularCostosOperativos({
    ...datos,
    items
  });

  return {
    id,
    empresa_id: perfil.empresa_id,
    planta_id:
      datos.planta_id ||
      perfil.planta_ids?.[0] ||
      "chile",
    nombre:
      limpiarTexto(datos.nombre) ||
      `Costos operativos ${datos.planta_id || "chile"}`,
    moneda: limpiarTexto(datos.moneda) || "CLP",
    periodo: limpiarTexto(datos.periodo) || "mensual",
    activo: datos.activo !== false,
    items,
    ...calculos
  };
};

export const validarCostosOperativos = costo => {
  const errores = [];

  if (!costo.planta_id) {
    errores.push("Selecciona una planta.");
  }

  if (costo.costo_mensual_total <= 0) {
    errores.push(
      "Ingresa al menos un costo operativo mensual."
    );
  }

  if (costo.horas_productivas_mes <= 0) {
    errores.push(
      "Ingresa las horas productivas mensuales."
    );
  }

  return errores;
};

export const listarCostosOperativos = async (
  db,
  empresaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, COLECCION),
      where("empresa_id", "==", empresaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) =>
      `${a.planta_id || ""} ${a.nombre || ""}`.localeCompare(
        `${b.planta_id || ""} ${b.nombre || ""}`
      )
    );
};

export const guardarCostosOperativos = async (
  db,
  perfil,
  datos
) => {
  const plantaId =
    datos.planta_id ||
    perfil.planta_ids?.[0] ||
    "chile";
  const id = `${perfil.empresa_id}__${plantaId}`;
  const costo = prepararCostosOperativos(
    {
      ...datos,
      planta_id: plantaId
    },
    perfil,
    id
  );
  const errores = validarCostosOperativos(costo);

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(
    doc(db, COLECCION, id),
    {
      ...costo,
      actualizado_por_id: perfil.uid || "",
      actualizado_por_nombre:
        perfil.nombre || "",
      actualizado_en: serverTimestamp(),
      creado_en: datos.creado_en || serverTimestamp()
    },
    {
      merge: true
    }
  );

  return costo;
};
