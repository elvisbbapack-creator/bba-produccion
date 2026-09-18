import {
  obtenerRecomendacionFormato,
  obtenerUnidadesHoraPorFormato
} from "./formatosExhibidor";

const casos = [
  ["Pintura Negra Electrostática x 1 Kilo", [1, 0.75, 0.5, 0.3, 0.2]],
  ["SUM Alambre Mig", [0.024, 0.018, 0.015, 0.01, 0.008]],
  ["SUM Gas recarga 45 kg", [0.09, 0.07, 0.05, 0.03, 0.025]],
  ["SUM Gas Mezcla Argomix 10m3", [0.013, 0.01, 0.008, 0.005, 0.003]]
];
const formatos = ["grande", "mediano", "pequeno", "sobremesa", "ganchera"];

test.each(casos)("propone la tabla completa para %s", (nombre, consumos) => {
  formatos.forEach((formato, indice) => {
    expect(
      obtenerRecomendacionFormato({ nombre }, formato)?.consumo
    ).toBe(consumos[indice]);
  });
});

test("no propone consumo para materiales sin regla", () => {
  expect(
    obtenerRecomendacionFormato(
      { nombre: "Tornillo autoperforante" },
      "grande"
    )
  ).toBeNull();
});

test("propone las unidades por hora de los procesos según formato", () => {
  expect(formatos.map(obtenerUnidadesHoraPorFormato))
    .toEqual([10, 20, 30, 40, 80]);
  expect(obtenerUnidadesHoraPorFormato(""))
    .toBe(0);
});
