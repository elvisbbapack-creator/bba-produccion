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
        producto_id: "producto-1",
        producto_codigo: "pcl0001",
        producto_nombre: " Modular ",
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
    producto_id: "producto-1",
    producto_codigo: "PCL0001",
    producto_nombre: "Modular",
    nombre: "Lateral 290",
    medida: "290 mm",
    material_base_id: "mp-tubo",
    materiales_base: [{
      material_id: "mp-tubo",
      material_codigo: "",
      material_nombre: "",
      cantidad: 1
    }],
    activo: true
  });
});

test("permite múltiples materiales base", () => {
  expect(
    prepararPieza(
      {
        codigo: "pz0100",
        producto_id: "producto-1",
        producto_codigo: "PCL0001",
        producto_nombre: "Modular",
        nombre: "Lateral Armado",
        medida: "Armado",
        materiales_base: [
          {
            material_id: "rf-1",
            material_codigo: "RF0001",
            material_nombre: "Lateral cortado",
            cantidad: "2"
          },
          {
            material_id: "rf-2",
            material_codigo: "RF0002",
            material_nombre: "Alambre doblado",
            cantidad: "4"
          }
        ]
      },
      "bba",
      "pieza-armado"
    )
  ).toEqual({
    id: "pieza-armado",
    empresa_id: "bba",
    codigo: "PZ0100",
    producto_id: "producto-1",
    producto_codigo: "PCL0001",
    producto_nombre: "Modular",
    nombre: "Lateral Armado",
    medida: "Armado",
    material_base_id: "rf-1",
    materiales_base: [
      {
        material_id: "rf-1",
        material_codigo: "RF0001",
        material_nombre: "Lateral cortado",
        cantidad: 2
      },
      {
        material_id: "rf-2",
        material_codigo: "RF0002",
        material_nombre: "Alambre doblado",
        cantidad: 4
      }
    ],
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

test("rechaza materiales base repetidos", () => {
  expect(
    validarPieza({
      id: "pieza-1",
      codigo: "PZ0001",
      nombre: "Lateral",
      medida: "290",
      materiales_base: [
        {
          material_id: "rf-1",
          material_codigo: "RF0001",
          cantidad: 1
        },
        {
          material_id: "rf-1",
          material_codigo: "RF0001",
          cantidad: 1
        }
      ]
    })
  ).toContain(
    "El material base RF0001 está repetido."
  );
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
