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
  ).map(material => {
    const expresionConsumo = limpiarTexto(
      material.expresion_consumo
    );
    const politicaFormulaConsumoReal =
      expresionConsumo &&
      (numero(material.piezas_por_plancha) > 0 ||
        numero(material.fraccion_por_pieza) > 0);

    return {
      tipo_linea:
        limpiarTexto(material.tipo_linea) || "material",
      material_id: material.material_id || "",
      codigo: limpiarTexto(material.codigo),
      nombre: limpiarTexto(material.nombre),
      unidad: limpiarTexto(material.unidad),
      expresion_consumo: expresionConsumo,
      unidad_expresion_consumo:
        limpiarTexto(
          material.unidad_expresion_consumo
        ) || "mm",
      piezas_calculadas: numero(
        material.piezas_calculadas
      ),
      cortes_calculados: numero(
        material.cortes_calculados
      ),
      cortes_por_subproducto: numero(
        material.cortes_por_subproducto
      ),
      subproductos: numero(material.subproductos),
      fraccion_por_pieza: numero(
        material.fraccion_por_pieza
      ),
      consumo_pieza_formula: numero(
        material.consumo_pieza_formula
      ),
      consumo_total_formula: numero(
        material.consumo_total_formula
      ),
      cortes_por_pieza: numero(
        material.cortes_por_pieza
      ),
      cortes_por_producto: numero(
        material.cortes_por_producto
      ),
      dobleces_por_producto: numero(
        material.dobleces_por_producto
      ),
      dobleces_por_pieza: numero(
        material.dobleces_por_pieza
      ),
      dobleces_total: numero(
        material.dobleces_total
      ),
      longitud_por_pieza: numero(
        material.longitud_por_pieza
      ),
      piezas_por_plancha: numero(
        material.piezas_por_plancha
      ),
      piezas_por_producto: numero(
        material.piezas_por_producto
      ),
      consumo_unitario: numero(
        material.consumo_unitario
      ),
      merma_porcentaje: numero(
        material.merma_porcentaje
      ),
      costo_unitario: numero(material.costo_unitario),
      peso_kg_por_unidad: numero(
        material.peso_kg_por_unidad
      ),
      tipo_formula_consumo: limpiarTexto(
        material.tipo_formula_consumo
      ),
      formula_material_indice: limpiarTexto(
        material.formula_material_indice
      ),
      formula_material_id:
        material.formula_material_id || "",
      formula_material_codigo: limpiarTexto(
        material.formula_material_codigo
      ),
      formula_material_nombre: limpiarTexto(
        material.formula_material_nombre
      ),
      area_m2_por_producto: numero(
        material.area_m2_por_producto
      ),
      consumo_tinta_ml_por_m2: numero(
        material.consumo_tinta_ml_por_m2
      ),
      consumo_tinta_ml_total: numero(
        material.consumo_tinta_ml_total
      ),
      costo_origen: limpiarTexto(material.costo_origen),
      minimo_compra: numero(material.minimo_compra),
      politica_minimo_compra:
        material.politica_minimo_compra ===
          "consumo_real" ||
        politicaFormulaConsumoReal
          ? "consumo_real"
          : "cobrar_minimo",
      proveedor: limpiarTexto(material.proveedor),
      proveedor_id: material.proveedor_id || "",
      proveedor_codigo: limpiarTexto(
        material.proveedor_codigo
      ),
      moneda: limpiarTexto(material.moneda) || "CLP"
    };
  });
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
      tipo_formula_tiempo: limpiarTexto(
        proceso.tipo_formula_tiempo
      ),
      formula_tiempo: limpiarTexto(
        proceso.formula_tiempo
      ),
      formula_material_indice: limpiarTexto(
        proceso.formula_material_indice
      ),
      formula_material_id:
        proceso.formula_material_id || "",
      formula_material_codigo: limpiarTexto(
        proceso.formula_material_codigo
      ),
      formula_material_nombre: limpiarTexto(
        proceso.formula_material_nombre
      ),
      unidad_formula_tiempo:
        limpiarTexto(
          proceso.unidad_formula_tiempo
        ) || "mm",
      segundos_por_metro: numero(
        proceso.segundos_por_metro
      ),
      metros_por_minuto: numero(
        proceso.metros_por_minuto
      ),
      puntos_mig: numero(proceso.puntos_mig),
      cordones_simples: numero(
        proceso.cordones_simples
      ),
      cordones_perimetrales: numero(
        proceso.cordones_perimetrales
      ),
      segundos_por_punto_mig: numero(
        proceso.segundos_por_punto_mig
      ),
      segundos_por_cordon_simple: numero(
        proceso.segundos_por_cordon_simple
      ),
      segundos_por_cordon_perimetral: numero(
        proceso.segundos_por_cordon_perimetral
      ),
      segundos_por_doblez: numero(
        proceso.segundos_por_doblez
      ),
      segundos_por_corte: numero(
        proceso.segundos_por_corte
      ),
      segundos_por_producto: numero(
        proceso.segundos_por_producto
      ),
      metros_totales_calculados: numero(
        proceso.metros_totales_calculados
      ),
      piezas_calculadas: numero(
        proceso.piezas_calculadas
      ),
      cortes_calculados: numero(
        proceso.cortes_calculados
      ),
      golpes_calculados: numero(
        proceso.golpes_calculados
      ),
      dobleces_por_pieza: numero(
        proceso.dobleces_por_pieza
      ),
      dobleces_total: numero(
        proceso.dobleces_total
      ),
      longitud_por_pieza: numero(
        proceso.longitud_por_pieza
      ),
      formula_tiempo_detalle:
        proceso.formula_tiempo_detalle || null,
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
      porcentaje_costo_operativo: numero(
        proceso.porcentaje_costo_operativo
      ),
      costo_operativo_origen:
        limpiarTexto(proceso.costo_operativo_origen),
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
    moneda: limpiarTexto(datos.moneda) || "CLP",
    tipo_cambio_clp_usd: numero(
      datos.tipo_cambio_clp_usd
    ),
    indirectos_porcentaje: numero(
      datos.indirectos_porcentaje
    ),
    costo_operativo_hora: numero(
      datos.costo_operativo_hora
    ),
    costo_operativo_origen:
      limpiarTexto(datos.costo_operativo_origen),
    costo_operativo_config_id:
      datos.costo_operativo_config_id || "",
    margen_porcentaje: numero(
      datos.margen_porcentaje
    ),
    tipo_margen:
      datos.tipo_margen === "markup"
        ? "markup"
        : "margen_bruto",
    factor_riesgo_porcentaje: numero(
      datos.factor_riesgo_porcentaje
    ),
    dias_compra: numero(datos.dias_compra),
    dias_ingenieria: numero(datos.dias_ingenieria),
    horas_disponibles_dia: numero(
      datos.horas_disponibles_dia
    ),
    desfase_flujo_horas: numero(
      datos.desfase_flujo_horas
    ),
    exportacion: {
      incoterm:
        limpiarTexto(datos.incoterm).toUpperCase() ||
        "EXW",
      destino: limpiarTexto(
        datos.destino_internacional
      ),
      pais_destino: limpiarTexto(datos.pais_destino),
      modalidad_carga:
        limpiarTexto(datos.modalidad_carga) || "auto",
      unidades_por_caja: numero(
        datos.unidades_por_caja
      ),
      largo_caja_cm: numero(datos.largo_caja_cm),
      ancho_caja_cm: numero(datos.ancho_caja_cm),
      alto_caja_cm: numero(datos.alto_caja_cm),
      factor_estiba: numero(datos.factor_estiba) || 1,
      capacidad_camion_m3: numero(
        datos.capacidad_camion_m3
      ),
      capacidad_camion_kg: numero(
        datos.capacidad_camion_kg
      ),
      flete_internacional: numero(
        datos.flete_internacional
      ),
      costo_ltl_m3: numero(datos.costo_ltl_m3),
      costo_ltl_minimo: numero(
        datos.costo_ltl_minimo
      ),
      seguro_porcentaje: numero(
        datos.seguro_porcentaje
      ),
      seguro_sobre_porcentaje: numero(
        datos.seguro_sobre_porcentaje
      ),
      gastos_exportacion: numero(
        datos.gastos_exportacion
      ),
      otros_costos_exportacion: numero(
        datos.otros_costos_exportacion
      ),
      dias_preparacion_exportacion: numero(
        datos.dias_preparacion_exportacion
      ),
      dias_transito: numero(datos.dias_transito),
      destinos_comparacion: Array.isArray(
        datos.destinos_exportacion_comparacion
      )
        ? datos.destinos_exportacion_comparacion
        : []
    }
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
  tipo_cambio_clp_usd:
    cotizacion.supuestos?.tipo_cambio_clp_usd ?? 915,
  descripcion: cotizacion.descripcion || "",
  riesgos: cotizacion.riesgos || "",
  escalas: Array.isArray(cotizacion.escalas)
    ? cotizacion.escalas.join(", ")
    : cotizacion.escalas || "50, 100, 500",
  indirectos_porcentaje:
    cotizacion.supuestos?.indirectos_porcentaje ?? 18,
  costo_operativo_hora:
    cotizacion.supuestos?.costo_operativo_hora ?? 0,
  costo_operativo_origen:
    cotizacion.supuestos?.costo_operativo_origen || "",
  costo_operativo_config_id:
    cotizacion.supuestos?.costo_operativo_config_id ||
    "",
  margen_porcentaje:
    cotizacion.supuestos?.margen_porcentaje ?? 35,
  tipo_margen:
    cotizacion.supuestos?.tipo_margen || "margen_bruto",
  factor_riesgo_porcentaje:
    cotizacion.supuestos?.factor_riesgo_porcentaje ?? 8,
  dias_compra:
    cotizacion.supuestos?.dias_compra ?? 5,
  dias_ingenieria:
    cotizacion.supuestos?.dias_ingenieria ?? 2,
  horas_disponibles_dia:
    cotizacion.supuestos?.horas_disponibles_dia ?? 14,
  desfase_flujo_horas:
    cotizacion.supuestos?.desfase_flujo_horas ?? 2,
  incoterm:
    cotizacion.supuestos?.exportacion?.incoterm ||
    "EXW",
  destino_internacional:
    cotizacion.supuestos?.exportacion?.destino || "",
  pais_destino:
    cotizacion.supuestos?.exportacion?.pais_destino ||
    "",
  modalidad_carga:
    cotizacion.supuestos?.exportacion?.modalidad_carga ||
    "auto",
  unidades_por_caja:
    cotizacion.supuestos?.exportacion
      ?.unidades_por_caja ?? 1,
  largo_caja_cm:
    cotizacion.supuestos?.exportacion
      ?.largo_caja_cm ?? 0,
  ancho_caja_cm:
    cotizacion.supuestos?.exportacion
      ?.ancho_caja_cm ?? 0,
  alto_caja_cm:
    cotizacion.supuestos?.exportacion?.alto_caja_cm ?? 0,
  factor_estiba:
    cotizacion.supuestos?.exportacion?.factor_estiba ??
    1,
  capacidad_camion_m3:
    cotizacion.supuestos?.exportacion
      ?.capacidad_camion_m3 ?? 90,
  capacidad_camion_kg:
    cotizacion.supuestos?.exportacion
      ?.capacidad_camion_kg ?? 25000,
  flete_internacional:
    cotizacion.supuestos?.exportacion
      ?.flete_internacional ?? 0,
  costo_ltl_m3:
    cotizacion.supuestos?.exportacion?.costo_ltl_m3 ??
    0,
  costo_ltl_minimo:
    cotizacion.supuestos?.exportacion
      ?.costo_ltl_minimo ?? 0,
  seguro_porcentaje:
    cotizacion.supuestos?.exportacion
      ?.seguro_porcentaje ?? 0.3,
  seguro_sobre_porcentaje:
    cotizacion.supuestos?.exportacion
      ?.seguro_sobre_porcentaje ?? 110,
  gastos_exportacion:
    cotizacion.supuestos?.exportacion
      ?.gastos_exportacion ?? 0,
  otros_costos_exportacion:
    cotizacion.supuestos?.exportacion
      ?.otros_costos_exportacion ?? 0,
  dias_preparacion_exportacion:
    cotizacion.supuestos?.exportacion
      ?.dias_preparacion_exportacion ?? 0,
  dias_transito:
    cotizacion.supuestos?.exportacion?.dias_transito ??
    0,
  destinos_exportacion_comparacion:
    Array.isArray(
      cotizacion.supuestos?.exportacion
        ?.destinos_comparacion
    ) &&
    cotizacion.supuestos.exportacion.destinos_comparacion
      .length > 0
      ? cotizacion.supuestos.exportacion
          .destinos_comparacion
      : ["Argentina", "Paraguay", "Uruguay"],
  materiales: Array.isArray(cotizacion.materiales)
    ? cotizacion.materiales
    : [],
  procesos: Array.isArray(cotizacion.procesos)
    ? cotizacion.procesos
    : []
});

export const listarCotizacionesTecnicas = async (
  db,
  empresaId,
  limite = 200
) => {
  const snapshot = await getDocs(
    query(
      collection(db, COLECCION),
      where("empresa_id", "==", empresaId),
      limit(limite)
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
