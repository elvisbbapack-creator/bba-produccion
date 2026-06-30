import {
  normalizarCodigoOperacionCatalogo,
  prepararOperacionCatalogo,
  validarOperacionCatalogo
} from "./detallesRepository";

test("normaliza código y textos de operación", () => {
  expect(
    normalizarCodigoOperacionCatalogo(
      " op 0001 "
    )
  ).toBe("OP0001");

  expect(
    prepararOperacionCatalogo(
      {
        codigo: "op0001",
        nombre: " Corte lateral 290 ",
        pieza_id: "pieza-1",
        pieza_codigo: "PZ0001",
        pieza_nombre: "Lateral 290",
        medida: " 290 mm ",
        material_entrada_id: "mp-tubo",
        material_salida_id: "rf-tubo"
      },
      "bba",
      "operacion-1"
    )
  ).toEqual({
    id: "operacion-1",
    empresa_id: "bba",
    codigo: "OP0001",
    nombre: "Corte lateral 290",
    pieza_id: "pieza-1",
    pieza_codigo: "PZ0001",
    pieza_nombre: "Lateral 290",
    medida: "290 mm",
    material_entrada_id: "mp-tubo",
    material_salida_id: "rf-tubo",
    activo: true
  });
});

test("exige código OP, pieza, nombre, medida y material", () => {
  expect(
    validarOperacionCatalogo({
      id: "operacion-1",
      codigo: "DT0001",
      nombre: "",
      pieza_id: "",
      medida: "",
      material_entrada_id: ""
    })
  ).toEqual([
    "El código de operación debe usar el formato OP0001.",
    "La operación requiere nombre.",
    "Selecciona una pieza.",
    "La operación requiere medida.",
    "Selecciona el material de entrada."
  ]);
});

test("rechaza códigos OP duplicados", () => {
  expect(
    validarOperacionCatalogo(
      {
        id: "operacion-2",
        codigo: "OP0001",
        nombre: "Corte lateral",
        pieza_id: "pieza-1",
        medida: "290",
        material_entrada_id: "mp-tubo"
      },
      [{
        id: "operacion-1",
        codigo: "OP0001"
      }]
    )
  ).toContain(
    "El código OP0001 ya existe."
  );
});
