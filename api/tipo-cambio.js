const responderJson = (respuesta, estado, datos) => {
  respuesta.status(estado);
  respuesta.setHeader("Content-Type", "application/json; charset=utf-8");
  respuesta.setHeader(
    "Cache-Control",
    "s-maxage=1800, stale-while-revalidate=86400"
  );
  respuesta.json(datos);
};

const fetchConTimeout = async (url, timeoutMs = 7000) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controlador.signal });
  } finally {
    clearTimeout(temporizador);
  }
};

const desdeMindicador = async () => {
  const respuesta = await fetchConTimeout(
    "https://mindicador.cl/api/dolar"
  );
  if (!respuesta.ok) throw new Error("mindicador no disponible");
  const datos = await respuesta.json();
  const valor = Number(
    datos?.serie?.[0]?.valor ?? datos?.valor ?? datos?.dolar?.valor
  );
  if (!Number.isFinite(valor)) throw new Error("valor inválido");
  return {
    valor: Math.round(valor * 100) / 100,
    fecha: datos?.serie?.[0]?.fecha || datos?.fecha || "",
    fuente: "mindicador.cl / dólar observado"
  };
};

const desdeReferenciaMercado = async () => {
  const respuesta = await fetchConTimeout(
    "https://open.er-api.com/v6/latest/USD"
  );
  if (!respuesta.ok) throw new Error("referencia alternativa no disponible");
  const datos = await respuesta.json();
  const valor = Number(datos?.rates?.CLP);
  if (!Number.isFinite(valor)) throw new Error("valor alternativo inválido");
  return {
    valor: Math.round(valor * 100) / 100,
    fecha: datos?.time_last_update_utc || "",
    fuente: "referencia de mercado USD/CLP (respaldo)"
  };
};

module.exports = async (solicitud, respuesta) => {
  if (solicitud.method !== "GET") {
    return responderJson(respuesta, 405, {
      error: "Método no permitido"
    });
  }

  try {
    return responderJson(respuesta, 200, await desdeMindicador());
  } catch (errorPrincipal) {
    try {
      return responderJson(
        respuesta,
        200,
        await desdeReferenciaMercado()
      );
    } catch (errorAlternativo) {
      return responderJson(respuesta, 503, {
        error: "No fue posible obtener el tipo de cambio."
      });
    }
  }
};
