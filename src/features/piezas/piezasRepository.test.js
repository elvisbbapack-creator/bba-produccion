import {
  normalizarCodigoPieza,
  prepararPieza,
  validarPieza
} from "./piezasRepository";

test("normaliza código y textos de pieza", () => {
  expect(
    normalizarCodigoPieza(" pz 0001 ")
  ).toBe("PZ0001");

  expect(
    prepararPieza(
      {
        codigo: "pz0001",
        nombre: " Lateral 290 ",
        medida: " 290 mm ",
        material_base_id: "mp-tubo"
      },
      "bba",
      "pieza-1"
    )
  ).toEqual({
    id: "pieza-1",
    empresa_id: "bba",
    codigo: "PZ0001",
    nombre: "Lateral 290",
    medida: "290 mm",
    material_base_id: "mp-tubo",
    activo: true
  });
});

test("exige código PZ, nombre y medida", () => {
  expect(
    validarPieza({
      id: "pieza-1",
      codigo: "DT0001",
      nombre: "",
      medida: ""
    })
  ).toEqual([
    "El código de pieza debe usar el formato PZ0001.",
    "La pieza requiere nombre.",
    "La pieza requiere medida."
  ]);
});

test("rechaza piezas duplicadas", () => {
  expect(
    validarPieza(
      {
        id: "pieza-2",
        codigo: "PZ0001",
        nombre: "Lateral",
        medida: "290"
      },
      [{
        id: "pieza-1",
        codigo: "PZ0001"
      }]
    )
  ).toContain(
    "El código PZ0001 ya existe."
  );
});
