import {
  extraerCatalogoProcesosRuta,
  prepararComposicionProducto,
  prepararOperacionRuta,
  prepararProducto,
  validarComposicionProducto,
  validarRecalibracionEstandar,
  validarOperacionBasica,
  validarProducto
} from "./productosRepository";

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
      cantidad: "1"
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
      cantidad: 1
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

test("extrae catálogo único de procesos y subprocesos de rutas", () => {
  const catalogo = extraerCatalogoProcesosRuta(
    [
      {
        proceso_id: "PR0001",
        proceso_nombre: "Corte",
        subproceso_id: "SP0001",
        subproceso_nombre: "Tubo en prensa"
      },
      {
        proceso_id: "PR0001",
        proceso_nombre: "Corte",
        subproceso_id: "SP0002",
        subproceso_nombre: "Corte alambre"
      }
    ],
    [
      {
        proceso_id: "pr0002",
        proceso_nombre: "Doblez",
        subproceso_id: "sp0005",
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
      codigo: "SP0001",
      nombre: "Tubo en prensa",
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte"
    },
    {
      codigo: "SP0002",
      nombre: "Corte alambre",
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte"
    },
    {
      codigo: "SP0005",
      nombre: "Doblez lata",
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
      subproceso_codigo: "SP0003",
      subproceso_nombre: "Laser tubo",
      material_entrada_id: "rf-1",
      materiales_entrada: [{
        material_id: "rf-1",
        material_codigo: "RF0001",
        material_nombre: "Tubo cortado",
        cantidad: "1"
      }],
      material_salida_id: "rf-2",
      unidades_por_producto: "4",
      unidades_por_hora: "80",
      dependencia_id: "OP0001",
      porcentaje_minimo_avance: "20"
    },
    "producto-1",
    "OP0005"
  );

  expect(operacion).toMatchObject({
    operacion_codigo: "OP0005",
    pieza_codigo: "PZ0001",
    pieza_nombre: "Lateral 290",
    material_entrada_id: "rf-1",
    materiales_entrada: [{
      material_id: "rf-1",
      material_codigo: "RF0001",
      material_nombre: "Tubo cortado",
      cantidad: 1
    }],
    secuencia: 20,
    unidades_por_producto: 4,
    dependencias: [{
      ruta_operacion_id: "OP0001",
      porcentaje_minimo_avance: 20,
      requiere_material_disponible: true
    }]
  });
  expect(
    validarOperacionBasica(operacion)
  ).toEqual([]);
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
