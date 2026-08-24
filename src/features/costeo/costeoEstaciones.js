const normalizarTextoEstacion = valor =>
  (valor || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const textoProcesoEstacion = proceso =>
  normalizarTextoEstacion(
    [
      proceso?.proceso_nombre,
      proceso?.estacion_nombre
    ]
      .filter(Boolean)
      .join(" ")
  );

export const esEstacionSoldaduraMig = proceso => {
  const texto = textoProcesoEstacion(proceso);

  return (
    /\bsmig\b/.test(texto) ||
    /\bmig\b/.test(texto) ||
    texto.includes("soldadora mig") ||
    texto.includes("soladora mig") ||
    texto.includes("soldadura mig")
  );
};
