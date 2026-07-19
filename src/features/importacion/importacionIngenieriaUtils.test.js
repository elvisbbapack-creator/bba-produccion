import {
  resumenIngenieria,
  validarIngenieriaImportada
} from "./importacionIngenieriaUtils";

const dataValida = {
  materiales: [
    {
      tipo: "MP",
      codigo: "MP0001",
      nombre: "Tubo",
      unidad_medida: "metro"
    },
    {
      tipo: "RF",
      codigo: "RF0001",
      nombre: "Lateral cortado",
      unidad_medida: "unidad"
    }
  ],
  productos: [{
    codigo: "PCL0001",
    nombre: "Modular",
    familia: "Exhibidores"
  }],
  piezas: [
    {
      codigo: "PZ0001",
      nombre: "Lateral",
      medida: "290"
    },
    {
      codigo: "PZ0100",
      nombre: "Lateral Armado",
      medida: "Armado"
    }
  ],
  subproductos: [{
    codigo: "SUB0001",
    nombre: "Lateral",
    producto_codigo: "PCL0001",
    pieza_salida_codigo: "PZ0100"
  }],
  componentesSubproducto: [{
    subproducto_codigo: "SUB0001",
    pieza_codigo: "PZ0001",
    cantidad: 2
  }],
  composicionProducto: [{
    producto_codigo: "PCL0001",
    tipo: "SUBPRODUCTO",
    categoria: "subproducto",
    item_codigo: "SUB0001",
    cantidad: 2
  }],
  operaciones: [{
    producto_codigo: "PCL0001",
    codigo: "OP0001",
    nombre: "Corte lateral",
    pieza_codigo: "PZ0001",
    proceso_codigo: "PR0001",
    proceso_nombre: "Corte",
    subproceso_codigo: "SP0001",
    subproceso_nombre: "Tubo en prensa",
    material_entrada_codigo: "MP0001",
    material_salida_codigo: "RF0001",
    unidades_por_producto: 2,
    unidades_por_hora: 120,
    secuencia: 1,
    dependencia_operacion_codigo: "",
    porcentaje_minimo_avance: 0
  }],
  rutas: [{
    tipo_ruta: "PRODUCTO",
    producto_codigo: "PCL0001",
    codigo: "OP0001",
    proceso_codigo: "PR0001",
    proceso_nombre: "Corte",
    subproceso_codigo: "ET0001",
    subproceso_nombre: "Tubo en prensa",
    subproducto_codigo: "SUB0001",
    unidades_por_producto: 2,
    unidades_por_hora: 120,
    secuencia: 1,
    dependencia_operacion_codigo: "",
    porcentaje_minimo_avance: 0
  }]
};

test("valida una ingeniería de producto completa", () => {
  const resultado =
    validarIngenieriaImportada(dataValida);

  expect(resultado.errores).toEqual([]);
  expect(resumenIngenieria(resultado)).toEqual({
    materiales: 2,
    productos: 1,
    piezas: 2,
    subproductos: 1,
    composicion: 1,
    componentes: 1,
    operaciones: 1,
    rutas: 1,
    errores: 0,
    advertencias: 0
  });
});

test("detecta referencias cruzadas inválidas", () => {
  const resultado =
    validarIngenieriaImportada({
      ...dataValida,
      subproductos: [{
        codigo: "SUB0001",
        nombre: "Lateral",
        producto_codigo: "PCL9999",
        pieza_salida_codigo: "PZ9999"
      }],
      operaciones: [{
        ...dataValida.operaciones[0],
        pieza_codigo: "PZ9999",
        dependencia_operacion_codigo: "OP9999"
      }],
      rutas: [{
        ...dataValida.rutas[0],
        codigo: "OP9999",
        producto_codigo: "PCL9999",
        subproducto_codigo: "SUB9999"
      }]
    });

  expect(resultado.errores).toEqual(
    expect.arrayContaining([
      "Subproducto SUB0001 referencia producto inexistente PCL9999.",
      "Subproducto SUB0001 referencia pieza salida inexistente PZ9999.",
      "Operación OP0001 referencia pieza inexistente PZ9999.",
      "Operación OP0001 depende de operación inexistente OP9999.",
      "Ruta referencia operación inexistente OP9999.",
      "Ruta OP9999 referencia producto inexistente PCL9999.",
      "Ruta producto OP9999 referencia subproducto inexistente SUB9999."
    ])
  );
});
