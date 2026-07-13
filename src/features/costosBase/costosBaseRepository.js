import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";

const COLECCION = "costos_base_estacion";

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

export const claveCostoEstacion = datos =>
  `${datos.proceso_codigo || ""}__${datos.estacion_codigo || ""}`;

export const calcularCostoBaseEstacion = (
  datos = {}
) => {
  const costoLaboralPrincipal =
    numero(datos.cantidad_maquinistas || 1) *
    numero(datos.costo_hora_maquinista);
  const costoAyudantes =
    numero(datos.cantidad_ayudantes) *
    numero(datos.costo_hora_ayudante);
  const vidaUtilHoras =
    numero(datos.vida_util_horas) || 0;
  const depreciacionHora =
    vidaUtilHoras > 0
      ? (
          numero(datos.valor_equipo) -
          numero(datos.valor_residual)
        ) / vidaUtilHoras
      : numero(datos.depreciacion_hora);
  const energiaHora =
    numero(datos.kw_hora) *
    numero(datos.costo_kwh) *
    (numero(datos.factor_uso_porcentaje || 100) / 100);
  const mantencionHora = numero(
    datos.mantencion_hora
  );
  const costoHoraTotal =
    costoLaboralPrincipal +
    costoAyudantes +
    depreciacionHora +
    energiaHora +
    mantencionHora;

  return {
    costo_laboral_principal: redondear(
      costoLaboralPrincipal
    ),
    costo_ayudantes: redondear(costoAyudantes),
    depreciacion_hora: redondear(depreciacionHora),
    energia_hora: redondear(energiaHora),
    mantencion_hora: redondear(mantencionHora),
    costo_hora_total: redondear(costoHoraTotal)
  };
};

export const prepararCostoBaseEstacion = (
  datos,
  perfil,
  id
) => {
  const calculos = calcularCostoBaseEstacion(datos);

  return {
    id,
    empresa_id: perfil.empresa_id,
    planta_id:
      datos.planta_id ||
      perfil.planta_ids?.[0] ||
      "chile",
    proceso_codigo: limpiarTexto(
      datos.proceso_codigo
    ),
    proceso_nombre: limpiarTexto(
      datos.proceso_nombre
    ),
    estacion_codigo: limpiarTexto(
      datos.estacion_codigo
    ),
    estacion_nombre: limpiarTexto(
      datos.estacion_nombre
    ),
    rol_maquinista: limpiarTexto(
      datos.rol_maquinista
    ),
    cantidad_maquinistas:
      numero(datos.cantidad_maquinistas) || 1,
    costo_hora_maquinista: numero(
      datos.costo_hora_maquinista
    ),
    requiere_ayudante:
      numero(datos.cantidad_ayudantes) > 0,
    cantidad_ayudantes: numero(
      datos.cantidad_ayudantes
    ),
    costo_hora_ayudante: numero(
      datos.costo_hora_ayudante
    ),
    equipo_nombre: limpiarTexto(
      datos.equipo_nombre
    ),
    valor_equipo: numero(datos.valor_equipo),
    valor_residual: numero(datos.valor_residual),
    vida_util_horas: numero(datos.vida_util_horas),
    kw_hora: numero(datos.kw_hora),
    costo_kwh: numero(datos.costo_kwh),
    factor_uso_porcentaje:
      numero(datos.factor_uso_porcentaje) || 100,
    mantencion_hora: numero(datos.mantencion_hora),
    observacion: limpiarTexto(datos.observacion),
    activo: datos.activo !== false,
    ...calculos
  };
};

export const validarCostoBaseEstacion = costo => {
  const errores = [];

  if (!costo.proceso_codigo) {
    errores.push("Selecciona un proceso.");
  }

  if (!costo.estacion_codigo) {
    errores.push("Selecciona una estación.");
  }

  if (costo.costo_hora_total <= 0) {
    errores.push(
      "El costo hora total debe ser mayor a cero."
    );
  }

  return errores;
};

export const listarCostosBaseEstacion = async (
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
      `${a.proceso_nombre || ""} ${a.estacion_nombre || ""}`
        .localeCompare(
          `${b.proceso_nombre || ""} ${b.estacion_nombre || ""}`
        )
    );
};

export const guardarCostoBaseEstacion = async (
  db,
  perfil,
  datos
) => {
  const id = `${perfil.empresa_id}__${claveCostoEstacion(datos)}`;
  const referencia = doc(db, COLECCION, id);
  const costo = prepararCostoBaseEstacion(
    datos,
    perfil,
    id
  );
  const errores = validarCostoBaseEstacion(costo);

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  await setDoc(
    referencia,
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

