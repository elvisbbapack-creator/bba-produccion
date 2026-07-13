import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import {
  calcularCotizacionTecnica,
  prepararEscalas
} from "./costeoCalculos";

const COLECCION = "cotizaciones_tecnicas";

const limpiarTexto = valor =>
  (valor || "").toString().trim();

const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
};

const normalizarLista = lista =>
  Array.isArray(lista)
    ? lista.filter(Boolean)
    : [];

export const ESTADOS_COTIZACION = [
  "borrador",
  "en_revision",
  "enviada",
  "aprobada",
  "perdida"
];

export const NIVELES_CONFIANZA = [
  "baja",
  "media",
  "alta"
];

export const prepararCotizacionTecnica = (
  datos,
  perfil
) => {
  const escalas = prepararEscalas(datos.escalas);
  const materiales = normalizarLista(
    datos.materiales
  ).map(material => ({
    material_id: material.material_id || "",
    codigo: limpiarTexto(material.codigo),
    nombre: limpiarTexto(material.nombre),
    unidad: limpiarTexto(material.unidad),
    consumo_unitario: numero(
      material.consumo_unitario
    ),
    merma_porcentaje: numero(
      material.merma_porcentaje
    ),
    costo_unitario: numero(material.costo_unitario),
    minimo_compra: numero(material.minimo_compra),
    proveedor: limpiarTexto(material.proveedor),
    proveedor_id: material.proveedor_id || "",
    proveedor_codigo: limpiarTexto(
      material.proveedor_codigo
    ),
    moneda: limpiarTexto(material.moneda) || "CLP"
  }));
  const procesos = normalizarLista(datos.procesos)
    .map(proceso => ({
      proceso_codigo: limpiarTexto(
        proceso.proceso_codigo
      ),
      proceso_nombre: limpiarTexto(
        proceso.proceso_nombre
      ),
      estacion_codigo: limpiarTexto(
        proceso.estacion_codigo
      ),
      estacion_nombre: limpiarTexto(
        proceso.estacion_nombre
      ),
      costo_base_estacion_id:
        proceso.costo_base_estacion_id || "",
      costo_hora_origen: limpiarTexto(
        proceso.costo_hora_origen
      ),
      unidades_por_hora: numero(
        proceso.unidades_por_hora
      ),
      eficiencia_esperada: numero(
        proceso.eficiencia_esperada
      ),
      costo_hora: numero(proceso.costo_hora),
      costo_hora_detalle:
        proceso.costo_hora_detalle || null,
      horas_setup: numero(proceso.horas_setup),
      observacion: limpiarTexto(proceso.observacion)
    }))
    .filter(proceso =>
      proceso.proceso_nombre ||
      proceso.estacion_nombre
    );
  const supuestos = {
    indirectos_porcentaje: numero(
      datos.indirectos_porcentaje
    ),
    margen_porcentaje: numero(
      datos.margen_porcentaje
    ),
    factor_riesgo_porcentaje: numero(
      datos.factor_riesgo_porcentaje
    ),
    dias_compra: numero(datos.dias_compra),
    dias_ingenieria: numero(datos.dias_ingenieria),
    horas_disponibles_dia: numero(
      datos.horas_disponibles_dia
    )
  };
  const resultados = calcularCotizacionTecnica({
    escalas,
    materiales,
    procesos,
    ...supuestos
  });
  const nombre = limpiarTexto(datos.nombre_producto);

  if (!nombre) {
    throw new Error(
      "Ingresa el nombre del producto prototipo."
    );
  }

  if (escalas.length === 0) {
    throw new Error(
      "Ingresa al menos una escala de cotización."
    );
  }

  return {
    empresa_id: perfil.empresa_id,
    planta_id:
      datos.planta_id ||
      perfil.planta_ids?.[0] ||
      "chile",
    cliente_id: datos.cliente_id || "",
    cliente_codigo: limpiarTexto(datos.cliente_codigo),
    cliente: limpiarTexto(datos.cliente),
    nombre_producto: nombre,
    version: limpiarTexto(datos.version) || "V1",
    estado:
      ESTADOS_COTIZACION.includes(datos.estado)
        ? datos.estado
        : "borrador",
    nivel_confianza:
      NIVELES_CONFIANZA.includes(
        datos.nivel_confianza
      )
        ? datos.nivel_confianza
        : "media",
    descripcion: limpiarTexto(datos.descripcion),
    riesgos: limpiarTexto(datos.riesgos),
    moneda: limpiarTexto(datos.moneda) || "CLP",
    escalas,
    materiales,
    procesos,
    supuestos,
    resultados
  };
};

export const guardarCotizacionTecnica = async (
  db,
  perfil,
  datos
) => {
  const cotizacion = prepararCotizacionTecnica(
    datos,
    perfil
  );

  const creado = await addDoc(
    collection(db, COLECCION),
    {
      ...cotizacion,
      creado_por_id: perfil.uid || "",
      creado_por_nombre: perfil.nombre || "",
      creado_en: serverTimestamp(),
      actualizado_por_id: perfil.uid || "",
      actualizado_por_nombre:
        perfil.nombre || "",
      actualizado_en: serverTimestamp()
    }
  );

  return creado.id;
};

export const actualizarCotizacionTecnica = async (
  db,
  perfil,
  cotizacionId,
  datos
) => {
  const cotizacion = prepararCotizacionTecnica(
    datos,
    perfil
  );

  await updateDoc(
    doc(db, COLECCION, cotizacionId),
    {
      ...cotizacion,
      actualizado_por_id: perfil.uid || "",
      actualizado_por_nombre:
        perfil.nombre || "",
      actualizado_en: serverTimestamp()
    }
  );

  return cotizacionId;
};

export const aFormularioCotizacionTecnica = (
  cotizacion = {}
) => ({
  cliente: cotizacion.cliente || "",
  cliente_id: cotizacion.cliente_id || "",
  cliente_codigo: cotizacion.cliente_codigo || "",
  nombre_producto:
    cotizacion.nombre_producto || "",
  version: cotizacion.version || "V1",
  planta_id: cotizacion.planta_id || "chile",
  estado: cotizacion.estado || "borrador",
  nivel_confianza:
    cotizacion.nivel_confianza || "media",
  moneda: cotizacion.moneda || "CLP",
  descripcion: cotizacion.descripcion || "",
  riesgos: cotizacion.riesgos || "",
  escalas: Array.isArray(cotizacion.escalas)
    ? cotizacion.escalas.join(", ")
    : cotizacion.escalas || "50, 100, 500",
  indirectos_porcentaje:
    cotizacion.supuestos?.indirectos_porcentaje ?? 18,
  margen_porcentaje:
    cotizacion.supuestos?.margen_porcentaje ?? 35,
  factor_riesgo_porcentaje:
    cotizacion.supuestos?.factor_riesgo_porcentaje ?? 8,
  dias_compra:
    cotizacion.supuestos?.dias_compra ?? 5,
  dias_ingenieria:
    cotizacion.supuestos?.dias_ingenieria ?? 2,
  horas_disponibles_dia:
    cotizacion.supuestos?.horas_disponibles_dia ?? 14,
  materiales: Array.isArray(cotizacion.materiales)
    ? cotizacion.materiales
    : [],
  procesos: Array.isArray(cotizacion.procesos)
    ? cotizacion.procesos
    : []
});

export const listarCotizacionesTecnicas = async (
  db,
  empresaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, COLECCION),
      where("empresa_id", "==", empresaId),
      limit(30)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) => {
      const fechaA =
        a.creado_en?.toMillis?.() || 0;
      const fechaB =
        b.creado_en?.toMillis?.() || 0;
      return fechaB - fechaA;
    });
};
