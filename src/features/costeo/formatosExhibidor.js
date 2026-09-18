const normalizar = valor =>
  (valor || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const FORMATOS_EXHIBIDOR = [
  ["grande", "Grande"],
  ["mediano", "Mediano"],
  ["pequeno", "Pequeño"],
  ["sobremesa", "Sobremesa"],
  ["ganchera", "Ganchera"]
];

export const CONSUMOS_POR_FORMATO = {
  pintura_negra_electrostatica: {
    grande: 1, mediano: 0.75, pequeno: 0.5,
    sobremesa: 0.3, ganchera: 0.2
  },
  alambre_mig: {
    grande: 0.024, mediano: 0.018, pequeno: 0.015,
    sobremesa: 0.01, ganchera: 0.008
  },
  gas_recarga_45_kg: {
    grande: 0.09, mediano: 0.07, pequeno: 0.05,
    sobremesa: 0.03, ganchera: 0.025
  },
  gas_argomix_10m3: {
    grande: 0.013, mediano: 0.01, pequeno: 0.008,
    sobremesa: 0.005, ganchera: 0.003
  }
};

export const identificarConsumoPorFormato = material => {
  const texto = normalizar(
    `${material?.codigo || ""} ${material?.nombre || ""}`
  );

  if (texto.includes("pintura negra") && texto.includes("electrostatica")) {
    return "pintura_negra_electrostatica";
  }
  if (texto.includes("alambre mig")) return "alambre_mig";
  if (texto.includes("gas") && texto.includes("recarga") && texto.includes("45")) {
    return "gas_recarga_45_kg";
  }
  if (
    texto.includes("gas") &&
    texto.includes("argomix") &&
    (texto.includes("10m3") || texto.includes("10 m3"))
  ) return "gas_argomix_10m3";

  return "";
};

export const obtenerRecomendacionFormato = (material, formato) => {
  const clave = identificarConsumoPorFormato(material);
  const consumo = CONSUMOS_POR_FORMATO[clave]?.[formato];

  return Number.isFinite(consumo) ? { clave, consumo } : null;
};
