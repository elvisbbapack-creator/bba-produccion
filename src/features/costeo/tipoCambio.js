export const TIPO_CAMBIO_CLP_USD_FALLBACK = 915;

const URL_DOLAR_OBSERVADO =
  "https://mindicador.cl/api/dolar";

const redondearTipoCambio = valor =>
  Math.round(Number(valor) * 100) / 100;

export const obtenerTipoCambioClpUsdActual = async ({
  fetchImpl = fetch,
  signal
} = {}) => {
  const respuesta = await fetchImpl(URL_DOLAR_OBSERVADO, {
    signal
  });

  if (!respuesta.ok) {
    throw new Error(
      "No se pudo obtener el tipo de cambio actual."
    );
  }

  const datos = await respuesta.json();
  const valor =
    datos?.serie?.[0]?.valor ??
    datos?.valor ??
    datos?.dolar?.valor;

  if (!Number.isFinite(Number(valor))) {
    throw new Error(
      "La fuente no entregó un tipo de cambio válido."
    );
  }

  return {
    valor: redondearTipoCambio(valor),
    fecha: datos?.serie?.[0]?.fecha || datos?.fecha || "",
    fuente: "mindicador.cl / dólar observado"
  };
};
