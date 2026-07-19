import {
  normalizarCodigoPieza,
  prepararPieza,
  prepararSubproductosAsociados,
  siguienteCodigoPieza,
  validarPieza
} from "./piezasRepository";

test("calcula siguiente código de pieza disponible", () => {
  expect(
    siguienteCodigoPieza([
      { codigo: "PZ0001" },
      { codigo: "PZ0003" }
    ])
  ).toBe("PZ0002");
});

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
        productos_asociados: [{
          producto_id: "producto-2",
          producto_codigo: "pcl0002",
          producto_nombre: "Modular Peru"
        }],
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
    relacion_principal_tipo: "producto",
    productos_asociados: [
      {
        producto_id: "producto-1",
        producto_codigo: "PCL0001",
        producto_nombre: "Modular"
      },
      {
        producto_id: "producto-2",
        producto_codigo: "PCL0002",
        producto_nombre: "Modular Peru"
      }
    ],
    subproducto_id: "",
    subproducto_codigo: "",
    subproducto_nombre: "",
    subproductos_asociados: [],
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
            cantidad: "0,58"
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
    relacion_principal_tipo: "producto",
    productos_asociados: [{
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular"
    }],
    subproducto_id: "",
    subproducto_codigo: "",
    subproducto_nombre: "",
    subproductos_asociados: [],
    nombre: "Lateral Armado",
    medida: "Armado",
    material_base_id: "rf-1",
    materiales_base: [
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
    ],
    activo: true
  });
});

test("normaliza subproductos asociados de pieza", () => {
  expect(
    prepararSubproductosAsociados(
      [{
        subproducto_id: "sub-2",
        subproducto_codigo: "sub0002",
        subproducto_nombre: "Lateral",
        producto_id: "producto-2",
        producto_codigo: "pcl0002",
        producto_nombre: "Modular Peru"
      }],
      {
        subproducto_id: "sub-1",
        subproducto_codigo: "sub0001",
        subproducto_nombre: "Bandeja",
        producto_id: "producto-1",
        producto_codigo: "pcl0001",
        producto_nombre: "Modular Chile"
      }
    )
  ).toEqual([
    {
      subproducto_id: "sub-1",
      subproducto_codigo: "SUB0001",
      subproducto_nombre: "Bandeja",
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular Chile"
    },
    {
      subproducto_id: "sub-2",
      subproducto_codigo: "SUB0002",
      subproducto_nombre: "Lateral",
      producto_id: "producto-2",
      producto_codigo: "PCL0002",
      producto_nombre: "Modular Peru"
    }
  ]);
});

test("prepara pieza relacionada principalmente a subproducto", () => {
  expect(
    prepararPieza(
      {
        codigo: "pz0200",
        relacion_principal_tipo: "subproducto",
        producto_id: "producto-1",
        producto_codigo: "PCL0001",
        producto_nombre: "Modular",
        subproducto_id: "sub-1",
        subproducto_codigo: "SUB0001",
        subproducto_nombre: "Bandeja",
        nombre: "Bandeja Armado",
        medida: "Armado"
      },
      "bba",
      "pieza-sub"
    )
  ).toMatchObject({
    id: "pieza-sub",
    empresa_id: "bba",
    codigo: "PZ0200",
    relacion_principal_tipo: "subproducto",
    producto_id: "producto-1",
    subproducto_id: "sub-1",
    subproducto_codigo: "SUB0001",
    subproducto_nombre: "Bandeja",
    productos_asociados: [{
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular"
    }],
    subproductos_asociados: [{
      subproducto_id: "sub-1",
      subproducto_codigo: "SUB0001",
      subproducto_nombre: "Bandeja",
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular"
    }]
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
