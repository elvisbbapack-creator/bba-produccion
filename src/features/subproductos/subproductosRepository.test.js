import {
  normalizarCodigoSubproducto,
  prepararSubproducto,
  validarSubproducto
} from "./subproductosRepository";

const baseSubproducto = {
  id: "sub-1",
  codigo: "SUB0001",
  nombre: "Lateral",
  producto_id: "producto-1",
  producto_codigo: "PCL0001",
  producto_nombre: "Modular",
  pieza_salida_id: "pieza-armado",
  pieza_salida_codigo: "PZ0100",
  pieza_salida_nombre: "Lateral Armado",
  componentes: [{
    pieza_id: "pieza-1",
    pieza_codigo: "PZ0001",
    pieza_nombre: "Lateral 290",
    cantidad: 2
  }]
};

test("normaliza codigo y componentes de subproducto", () => {
  expect(
    normalizarCodigoSubproducto(" sub 0001 ")
  ).toBe("SUB0001");

  expect(
    prepararSubproducto(
      {
        codigo: "sub0001",
        nombre: " Lateral ",
        producto_id: "producto-1",
        producto_codigo: " pcl0001 ",
        producto_nombre: " Modular ",
        pieza_salida_id: "pieza-armado",
        pieza_salida_codigo: " pz0100 ",
        pieza_salida_nombre:
          " Lateral Armado ",
        componentes: [{
          pieza_id: "pieza-1",
          pieza_codigo: " pz0001 ",
          pieza_nombre: " Lateral 290 ",
          cantidad: "2"
        }]
      },
      "bba",
      "sub-1"
    )
  ).toEqual({
    id: "sub-1",
    empresa_id: "bba",
    codigo: "SUB0001",
    nombre: "Lateral",
    producto_id: "producto-1",
    producto_codigo: "PCL0001",
    producto_nombre: "Modular",
    pieza_salida_id: "pieza-armado",
    pieza_salida_codigo: "PZ0100",
    pieza_salida_nombre: "Lateral Armado",
    componentes: [{
      pieza_id: "pieza-1",
      pieza_codigo: "PZ0001",
      pieza_nombre: "Lateral 290",
      cantidad: 2
    }],
    activo: true
  });
});

test("valida campos obligatorios y salida armado", () => {
  expect(
    validarSubproducto({
      id: "sub-1",
      codigo: "SP0001",
      nombre: "",
      producto_id: "",
      pieza_salida_id: "",
      pieza_salida_nombre: "Lateral",
      componentes: []
    })
  ).toEqual([
    "El codigo de subproducto debe usar el formato SUB0001.",
    "El subproducto requiere nombre.",
    "Selecciona el producto al que pertenece.",
    "Selecciona la pieza de salida Armado.",
    "La pieza de salida debe ser la pieza Armado del subproducto.",
    "Agrega al menos una pieza componente."
  ]);
});

test("rechaza pieza de salida como componente y duplicados", () => {
  expect(
    validarSubproducto({
      ...baseSubproducto,
      componentes: [
        {
          pieza_id: "pieza-armado",
          pieza_codigo: "PZ0100",
          pieza_nombre: "Lateral Armado",
          cantidad: 1
        },
        {
          pieza_id: "pieza-1",
          pieza_codigo: "PZ0001",
          pieza_nombre: "Lateral 290",
          cantidad: 2
        },
        {
          pieza_id: "pieza-1",
          pieza_codigo: "PZ0001",
          pieza_nombre: "Lateral 290",
          cantidad: 3
        }
      ]
    })
  ).toEqual([
    "La pieza de salida no puede ser tambien componente.",
    "La pieza PZ0001 esta repetida en los componentes."
  ]);
});

test("rechaza codigo duplicado", () => {
  expect(
    validarSubproducto(
      {
        ...baseSubproducto,
        id: "sub-2"
      },
      [{
        id: "sub-1",
        codigo: "SUB0001"
      }]
    )
  ).toContain(
    "El codigo SUB0001 ya existe."
  );
});
