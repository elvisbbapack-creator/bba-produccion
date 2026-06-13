import {
  prepararMotivoParo,
  validarMotivoParo
} from "./parosRepository";

test("normaliza y valida un motivo de paro", () => {
  const motivo = prepararMotivoParo(
    {
      codigo: " par0001 ",
      nombre: "Falta de material",
      categoria: "material"
    },
    "bba"
  );

  expect(motivo).toMatchObject({
    codigo: "PAR0001",
    nombre: "Falta de material",
    categoria: "material",
    afecta_eficiencia: true
  });
  expect(
    validarMotivoParo(motivo)
  ).toEqual([]);
});

test("rechaza código inválido o duplicado", () => {
  expect(
    validarMotivoParo(
      { codigo: "P1", nombre: "" },
      []
    )
  ).toHaveLength(2);

  expect(
    validarMotivoParo(
      {
        codigo: "PAR0001",
        nombre: "Falla"
      },
      [{ codigo: "PAR0001" }]
    )
  ).toContain(
    "El código PAR0001 ya existe."
  );
});
