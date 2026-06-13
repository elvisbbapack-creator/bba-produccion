import {
  prepararOperacionRuta,
  prepararProducto,
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

test("prepara una operacion con dependencia parcial", () => {
  const operacion = prepararOperacionRuta(
    {
      empresa_id: "bba",
      secuencia: "20",
      codigo: "dt0005",
      nombre: "Perforacion 4 hoyos",
      proceso_codigo: "PR0001",
      proceso_nombre: "Corte",
      subproceso_codigo: "SP0003",
      subproceso_nombre: "Laser tubo",
      material_entrada_id: "rf-1",
      material_salida_id: "rf-2",
      unidades_por_producto: "4",
      unidades_por_hora: "80",
      dependencia_id: "DT0001",
      porcentaje_minimo_avance: "20"
    },
    "producto-1",
    "DT0005"
  );

  expect(operacion).toMatchObject({
    operacion_codigo: "DT0005",
    secuencia: 20,
    unidades_por_producto: 4,
    dependencias: [{
      ruta_operacion_id: "DT0001",
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
