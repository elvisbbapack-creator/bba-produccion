import {
  extraerCatalogoProcesosRuta,
  prepararComposicionProducto,
  prepararOperacionRuta,
  prepararProducto,
  siguienteCodigoOperacionRuta,
  siguienteCodigoProducto,
  validarComposicionProducto,
  validarRecalibracionEstandar,
  validarOperacionBasica,
  validarProducto
} from "./productosRepository";

test("calcula siguientes códigos de producto y operación de ruta", () => {
  expect(
    siguienteCodigoProducto([
      { codigo: "PCL0001" },
      { codigo: "PCL0003" }
    ])
  ).toBe("PCL0002");

  expect(
    siguienteCodigoOperacionRuta([
      { operacion_codigo: "OP0001" },
      { codigo: "OP0002" }
    ])
  ).toBe("OP0003");
});

test("prepara y valida un producto PCL", () => {
  const producto = prepararProducto(
    {
      codigo: " pcl 0001 ",
      nombre: " Modular 2N60 ",
      familia: " Exhibidores "
    },
    "bba",
    "bba__PCL0001"
  );

  expect(producto).toMatchObject({
    codigo: "PCL0001",
    nombre: "Modular 2N60",
    familia: "Exhibidores",
    empresa_id: "bba"
  });
  expect(validarProducto(producto)).toEqual([]);
});

test("rechaza productos duplicados", () => {
  const producto = prepararProducto(
    {
      codigo: "PCL0001",
      nombre: "Modular"
    },
    "bba",
    "producto-2"
  );

  expect(
    validarProducto(producto, [{
      id: "producto-1",
      codigo: "PCL0001"
    }])
  ).toContain("El codigo PCL0001 ya existe.");
});

test("prepara y valida composición del producto", () => {
  const composicion = prepararComposicionProducto([
    {
      tipo: "subproducto",
      categoria: "subproducto",
      item_id: "sub-lateral",
      item_codigo: "sub0001",
      item_nombre: "Lateral",
      cantidad: "2"
    },
    {
      tipo: "material",
      categoria: "empaque",
      item_id: "mp-caja",
      item_codigo: "mp0009",
      item_nombre: "Caja empaque",
      cantidad: "0,5"
    }
  ]);

  expect(composicion).toEqual([
    {
      tipo: "SUBPRODUCTO",
      categoria: "subproducto",
      item_id: "sub-lateral",
      item_codigo: "SUB0001",
      item_nombre: "Lateral",
      cantidad: 2
    },
    {
      tipo: "MATERIAL",
      categoria: "empaque",
      item_id: "mp-caja",
      item_codigo: "MP0009",
      item_nombre: "Caja empaque",
      cantidad: 0.5
    }
  ]);
  expect(
    validarComposicionProducto(composicion)
  ).toEqual([]);
});

test("rechaza composición duplicada o sin cantidad", () => {
  expect(
    validarComposicionProducto([
      {
        tipo: "SUBPRODUCTO",
        item_id: "sub-lateral",
        item_codigo: "SUB0001",
        cantidad: 2
      },
      {
        tipo: "SUBPRODUCTO",
        item_id: "sub-lateral",
        item_codigo: "SUB0001",
        cantidad: 0
      }
    ])
  ).toEqual([
    "El item 2 requiere cantidad mayor que cero.",
    "El item SUB0001 está repetido."
  ]);
});

test("extrae catálogo único de procesos y estaciones de rutas", () => {
  const catalogo = extraerCatalogoProcesosRuta(
    [
      {
        proceso_id: "PR0001",
        proceso_nombre: "Corte",
        estacion_id: "ET0001",
        estacion_nombre: "Prensa"
      },
      {
        proceso_id: "PR0001",
        proceso_nombre: "Corte",
        estacion_id: "ET0002",
        estacion_nombre: "Corte alambre"
      }
    ],
    [
      {
        proceso_id: "pr0002",
        proceso_nombre: "Doblez",
        estacion_codigo: "et0005",
        subproceso_nombre: "Doblez lata"
      }
    ]
  );

  expect(catalogo.procesos).toEqual([
    {
      codigo: "PR0001",
      nombre: "Corte"
    },
    {
      codigo: "PR0002",
      nombre: "Doblez"
    }
  ]);
  expect(catalogo.subprocesos).toEqual([
    {
      codigo: "ET0001",
      nombre: "Prensa",
      estacion_codigo: "ET0001",
      estacion_nombre: "Prensa",
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte"
    },
    {
      codigo: "ET0002",
      nombre: "Corte alambre",
      estacion_codigo: "ET0002",
      estacion_nombre: "Corte alambre",
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte"
    },
    {
      codigo: "ET0005",
      nombre: "Doblez lata",
      estacion_codigo: "ET0005",
      estacion_nombre: "Doblez lata",
      proceso_codigo: "PR0002",
      proceso_nombre: "Doblez"
    }
  ]);
});

test("prepara una operacion con dependencia parcial", () => {
  const operacion = prepararOperacionRuta(
    {
      empresa_id: "bba",
      secuencia: "20",
      codigo: "op0005",
      nombre: "Perforacion 4 hoyos",
      pieza_id: "pieza-1",
      pieza_codigo: "PZ0001",
      pieza_nombre: "Lateral 290",
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte",
      estacion_codigo: "ET0003",
      estacion_nombre: "Laser tubo",
      material_entrada_id: "rf-1",
      materiales_entrada: [{
        material_id: "rf-1",
        material_codigo: "RF0001",
        material_nombre: "Tubo cortado",
        cantidad: "0,29"
      }],
      material_salida_id: "rf-2",
      unidades_por_producto: "4",
      unidades_por_hora: "80",
      dependencias: [
        {
          ruta_operacion_id: "OP0001",
          porcentaje_minimo_avance: "20"
        },
        {
          ruta_operacion_id: "OP0002",
          porcentaje_minimo_avance: "50"
        }
      ]
    },
    "producto-1",
    "OP0005"
  );

  expect(operacion).toMatchObject({
    operacion_codigo: "OP0005",
    pieza_codigo: "PZ0001",
    pieza_nombre: "Lateral 290",
    estacion_id: "ET0003",
    estacion_nombre: "Laser tubo",
    subproceso_id: "ET0003",
    subproceso_nombre: "Laser tubo",
    material_entrada_id: "rf-1",
    materiales_entrada: [{
      material_id: "rf-1",
      material_codigo: "RF0001",
      material_nombre: "Tubo cortado",
      cantidad: 0.29
    }],
    secuencia: 20,
    unidades_por_producto: 4,
    dependencias: [{
      ruta_operacion_id: "OP0001",
      porcentaje_minimo_avance: 20,
      requiere_material_disponible: true
    }, {
      ruta_operacion_id: "OP0002",
      porcentaje_minimo_avance: 50,
      requiere_material_disponible: true
    }]
  });
  expect(
    validarOperacionBasica(operacion)
  ).toEqual([]);
});

test("rechaza dependencias repetidas en una operación", () => {
  const operacion = prepararOperacionRuta(
    {
      empresa_id: "bba",
      secuencia: "20",
      codigo: "op0005",
      nombre: "Perforacion 4 hoyos",
      pieza_id: "pieza-1",
      pieza_codigo: "PZ0001",
      pieza_nombre: "Lateral 290",
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte",
      estacion_codigo: "ET0003",
      estacion_nombre: "Laser tubo",
      materiales_entrada: [{
        material_id: "rf-1",
        material_codigo: "RF0001",
        material_nombre: "Tubo cortado",
        cantidad: "1"
      }],
      material_salida_id: "rf-2",
      unidades_por_producto: "4",
      unidades_por_hora: "80",
      dependencias: [
        {
          ruta_operacion_id: "OP0001",
          porcentaje_minimo_avance: "20"
        },
        {
          ruta_operacion_id: "OP0001",
          porcentaje_minimo_avance: "50"
        }
      ]
    },
    "producto-1",
    "OP0005"
  );

  expect(
    validarOperacionBasica(operacion)
  ).toContain(
    "La dependencia OP0001 está repetida."
  );
});

test("valida una recalibración trazable del estándar", () => {
  expect(
    validarRecalibracionEstandar({
      valorAnterior: 80,
      valorNuevo: 120,
      motivo:
        "Mejora comprobada durante producción."
    })
  ).toEqual([]);

  expect(
    validarRecalibracionEstandar({
      valorAnterior: 80,
      valorNuevo: 80,
      motivo: "Error"
    })
  ).toEqual(expect.arrayContaining([
    "El nuevo estándar debe ser diferente al actual.",
    "Indica un motivo de al menos 10 caracteres."
  ]));
});
