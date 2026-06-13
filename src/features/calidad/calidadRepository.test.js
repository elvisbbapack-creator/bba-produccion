import {
  validarCatalogoCalidad
} from "./calidadRepository";

test("valida códigos y duplicados de calidad", () => {
  expect(
    validarCatalogoCalidad(
      {
        codigo: "DEF0001",
        nombre: "Soldadura incompleta"
      },
      [],
      "DEF"
    )
  ).toEqual([]);

  expect(
    validarCatalogoCalidad(
      {
        codigo: "DEF1",
        nombre: ""
      },
      [],
      "DEF"
    )
  ).toHaveLength(2);

  expect(
    validarCatalogoCalidad(
      {
        codigo: "CAU0001",
        nombre: "Parámetro incorrecto"
      },
      [{ codigo: "CAU0001" }],
      "CAU"
    )
  ).toContain(
    "El código CAU0001 ya existe."
  );
});
