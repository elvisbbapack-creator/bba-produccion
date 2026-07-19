import {
  normalizarCodigoOperacionCatalogo,
  prepararOperacionCatalogo,
  siguienteCodigoOperacionCatalogo,
  validarOperacionCatalogo
} from "./detallesRepository";

test("calcula siguiente código de operación disponible", () => {
  expect(
    siguienteCodigoOperacionCatalogo([
      { codigo: "OP0001" },
      { codigo: "OP0003" }
    ])
  ).toBe("OP0002");
});

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
        producto_id: "producto-1",
        producto_codigo: "pcl0001",
        producto_nombre: " Modular ",
        subproducto_id: "sub-1",
        subproducto_codigo: "SUB0001",
        subproducto_nombre: "Lateral",
        productos_asociados: [{
          producto_id: "producto-2",
          producto_codigo: "PCL0002",
          producto_nombre: "Display alternativo"
        }],
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
    producto_id: "producto-1",
    producto_codigo: "PCL0001",
    producto_nombre: "Modular",
    subproducto_id: "sub-1",
    subproducto_codigo: "SUB0001",
    subproducto_nombre: "Lateral",
    productos_asociados: [
      {
        producto_id: "producto-1",
        producto_codigo: "PCL0001",
        producto_nombre: "Modular"
      },
      {
        producto_id: "producto-2",
        producto_codigo: "PCL0002",
        producto_nombre: "Display alternativo"
      }
    ],
    pieza_id: "pieza-1",
    pieza_codigo: "PZ0001",
    pieza_nombre: "Lateral 290",
    medida: "290 mm",
    material_entrada_id: "mp-tubo",
    materiales_entrada: [{
      material_id: "mp-tubo",
      material_codigo: "",
      material_nombre: "",
      cantidad: 1
    }],
    material_salida_id: "rf-tubo",
    activo: true
  });
});

test("permite varios materiales de entrada", () => {
  expect(
    prepararOperacionCatalogo(
      {
        codigo: "op0002",
        nombre: "Soldadura lateral armado",
        producto_id: "producto-1",
        producto_codigo: "PCL0001",
        producto_nombre: "Modular",
        pieza_id: "pieza-armado",
        pieza_codigo: "PZ0100",
        pieza_nombre: "Lateral Armado",
        medida: "Armado",
        materiales_entrada: [
          {
            material_id: "rf-1",
            material_codigo: "RF0001",
            material_nombre: "Lateral cortado",
            cantidad: "0,58"
          },
          {
            material_id: "rf-2",
            material_codigo: "RF0002",
            material_nombre: "Alambre doblado",
            cantidad: "4"
          }
        ],
        material_salida_id: "rf-armado"
      },
      "bba",
      "operacion-2"
    )
  ).toMatchObject({
    producto_id: "producto-1",
    producto_codigo: "PCL0001",
    producto_nombre: "Modular",
    subproducto_id: "",
    subproducto_codigo: "",
    subproducto_nombre: "",
    productos_asociados: [{
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular"
    }],
    material_entrada_id: "rf-1",
    materiales_entrada: [
      {
        material_id: "rf-1",
        material_codigo: "RF0001",
        material_nombre: "Lateral cortado",
        cantidad: 0.58
      },
      {
        material_id: "rf-2",
        material_codigo: "RF0002",
        material_nombre: "Alambre doblado",
        cantidad: 4
      }
    ]
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

test("rechaza materiales de entrada repetidos", () => {
  expect(
    validarOperacionCatalogo({
      id: "operacion-1",
      codigo: "OP0001",
      nombre: "Soldadura",
      pieza_id: "pieza-1",
      medida: "Armado",
      material_entrada_id: "rf-1",
      material_salida_id: "rf-3",
      materiales_entrada: [
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
    "El material de entrada RF0001 está repetido."
  );
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
