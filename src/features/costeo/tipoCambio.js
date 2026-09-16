export const TIPO_CAMBIO_CLP_USD_FALLBACK = 915;

const URL_TIPO_CAMBIO = "/api/tipo-cambio";
const CLAVE_CACHE = "bba_tipo_cambio_clp_usd";
const EDAD_MAXIMA_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const redondearTipoCambio = valor =>
  Math.round(Number(valor) * 100) / 100;

export const obtenerTipoCambioClpUsdActual = async ({
  fetchImpl = fetch,
  signal,
  almacenamiento = typeof localStorage !== "undefined"
    ? localStorage
    : null
} = {}) => {
  try {
    const respuesta = await fetchImpl(URL_TIPO_CAMBIO, {
      signal
    });

    if (!respuesta.ok) {
      throw new Error(
        "No se pudo obtener el tipo de cambio actual."
      );
    }

    const datos = await respuesta.json();
    const valor = datos?.valor;

    if (!Number.isFinite(Number(valor))) {
      throw new Error(
        "La fuente no entregó un tipo de cambio válido."
      );
    }

    const tipoCambio = {
      valor: redondearTipoCambio(valor),
      fecha: datos?.fecha || "",
      fuente: datos?.fuente || "dólar observado"
    };
    almacenamiento?.setItem(
      CLAVE_CACHE,
      JSON.stringify({
        ...tipoCambio,
        guardado_en: Date.now()
      })
    );
    return tipoCambio;
  } catch (error) {
    try {
      const guardado = JSON.parse(
        almacenamiento?.getItem(CLAVE_CACHE) || "null"
      );
      const vigente =
        guardado &&
        Number.isFinite(Number(guardado.valor)) &&
        Date.now() - Number(guardado.guardado_en) <=
          EDAD_MAXIMA_CACHE_MS;
      if (vigente) {
        return {
          valor: redondearTipoCambio(guardado.valor),
          fecha: guardado.fecha || "",
          fuente: `${guardado.fuente || "último valor válido"} · guardado localmente`
        };
      }
    } catch (errorCache) {
      // Si la caché está dañada se conserva el error original.
    }
    throw error;
  }
};
