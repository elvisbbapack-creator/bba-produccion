import {
  normalizarCodigoDetalle,
  prepararDetalle,
  validarDetalle
} from "./detallesRepository";

test("normaliza código y textos del DT", () => {
  expect(
    normalizarCodigoDetalle(" dt 0001 ")
  ).toBe("DT0001");

  expect(
    prepararDetalle(
      {
        codigo: "dt0001",
        nombre: " Lateral 290 ",
        medida: " 290 mm ",
        material_entrada_id: "mp-tubo",
        material_salida_id: "rf-tubo"
      },
      "bba",
      "detalle-1"
    )
  ).toEqual({
    id: "detalle-1",
    empresa_id: "bba",
    codigo: "DT0001",
    nombre: "Lateral 290",
    medida: "290 mm",
    material_entrada_id: "mp-tubo",
    material_salida_id: "rf-tubo",
    activo: true
  });
});

test("exige código, nombre, medida y material", () => {
  expect(
    validarDetalle({
      id: "detalle-1",
      codigo: "D1",
      nombre: "",
      medida: "",
      material_entrada_id: ""
    })
  ).toEqual([
    "El código DT debe usar el formato DT0001.",
    "El DT requiere nombre.",
    "El DT requiere medida.",
    "Selecciona el material de entrada."
  ]);
});

test("rechaza códigos DT duplicados", () => {
  expect(
    validarDetalle(
      {
        id: "detalle-2",
        codigo: "DT0001",
        nombre: "Lateral",
        medida: "290",
        material_entrada_id: "mp-tubo"
      },
      [{
        id: "detalle-1",
        codigo: "DT0001"
      }]
    )
  ).toContain(
    "El código DT0001 ya existe."
  );
});

test("permite editar el mismo DT sin marcar duplicado", () => {
  expect(
    validarDetalle(
      {
        id: "detalle-1",
        codigo: "DT0001",
        nombre: "Lateral corregido",
        medida: "291",
        material_entrada_id: "mp-tubo"
      },
      [{
        id: "detalle-1",
        codigo: "DT0001"
      }]
    )
  ).toEqual([]);
});
