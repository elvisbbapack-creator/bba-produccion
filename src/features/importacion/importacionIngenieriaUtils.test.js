import {
  hojasPlantillaIngenieria,
  leerIngenieriaDesdeWorkbook,
  resumenIngenieria,
  validarIngenieriaImportada
} from "./importacionIngenieriaUtils";
import * as XLSX from "xlsx";

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
  procesos: [{
    codigo: "PR0001",
    nombre: "Corte",
    activo: true,
    estaciones: [{
      codigo: "ET0001",
      nombre: "Tubo en prensa",
      activo: true
    }]
  }],
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
    subproducto_codigo: "SUB0001",
    pieza_codigo: "PZ0001",
    material_entrada_codigo: "MP0001",
    material_salida_codigo: "RF0001"
  }],
  rutas: [{
    tipo_ruta: "PRODUCTO",
    producto_codigo: "PCL0001",
    codigo: "OP0001",
    proceso_codigo: "PR0001",
    proceso_nombre: "Corte",
    estacion_codigo: "ET0001",
    estacion_nombre: "Tubo en prensa",
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
    procesos: 1,
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
        subproducto_codigo: "SUB9999"
      }],
      rutas: [{
        ...dataValida.rutas[0],
        codigo: "OP9999",
        producto_codigo: "PCL9999",
        subproducto_codigo: "SUB9999",
        dependencia_operacion_codigo: "OP9998"
      }]
    });

  expect(resultado.errores).toEqual(
    expect.arrayContaining([
      "Subproducto SUB0001 referencia producto inexistente PCL9999.",
      "Subproducto SUB0001 referencia pieza salida inexistente PZ9999.",
      "Operación OP0001 referencia pieza inexistente PZ9999.",
      "Operación OP0001 referencia subproducto inexistente SUB9999.",
      "Ruta referencia operación inexistente OP9999.",
      "Ruta OP9999 referencia producto inexistente PCL9999.",
      "Ruta producto OP9999 referencia subproducto inexistente SUB9999.",
      "Ruta OP9999 depende de operación inexistente OP9998."
    ])
  );
});

test("advierte pieza salida sin armado o terminado sin bloquear importación", () => {
  const resultado =
    validarIngenieriaImportada({
      ...dataValida,
      piezas: [
        ...dataValida.piezas,
        {
          codigo: "PZ0200",
          nombre: "Grafica lateral",
          medida: ""
        }
      ],
      subproductos: [{
        ...dataValida.subproductos[0],
        pieza_salida_codigo: "PZ0200"
      }]
    });

  expect(resultado.errores).toEqual([]);
  expect(resultado.advertencias).toEqual(
    expect.arrayContaining([
      'Subproducto SUB0001 usa pieza salida PZ0200 sin "Armado" o "Terminado"; revisa si realmente es la pieza final del subproducto.',
      "Pieza PZ0200 no tiene medida; se podrá completar después."
    ])
  );
});

test("plantilla usa estaciones ET en rutas y no subprocesos visibles", () => {
  [
    hojasPlantillaIngenieria.Ruta_Producto[0],
    hojasPlantillaIngenieria.Ruta_Subproducto[0]
  ].forEach(encabezados => {
    expect(encabezados).toEqual(
      expect.arrayContaining([
        "estacion_codigo",
        "estacion_nombre"
      ])
    );
    expect(encabezados).not.toContain(
      "subproceso_codigo"
    );
    expect(encabezados).not.toContain(
      "subproceso_nombre"
    );
  });

  expect(
    hojasPlantillaIngenieria.Procesos_ET[0]
  ).toEqual([
    "proceso_codigo",
    "proceso_nombre",
    "estacion_codigo",
    "estacion_nombre"
  ]);
});

test("plantilla vincula operaciones OP con subproductos", () => {
  expect(
    hojasPlantillaIngenieria.Operaciones_OP[0]
  ).toEqual(
    expect.arrayContaining([
      "operacion_codigo",
      "operacion_nombre",
      "subproducto_codigo",
      "pieza_codigo"
    ])
  );
});

test("acepta medidas vacías como advertencia", () => {
  const resultado =
    validarIngenieriaImportada({
      ...dataValida,
      piezas: dataValida.piezas.map(pieza =>
        pieza.codigo === "PZ0001"
          ? { ...pieza, medida: "" }
          : pieza
      )
    });

  expect(resultado.errores).toEqual([]);
  expect(resultado.advertencias).toContain(
    "Pieza PZ0001 no tiene medida; se podrá completar después."
  );
});

test("lee ruta de subproducto con unidades_por_subproducto y dependencias múltiples", () => {
  const workbook = XLSX.utils.book_new();
  const agregarHoja = (nombre, filas) => {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(filas),
      nombre
    );
  };

  agregarHoja("Materiales_MP_SUM", [
    [
      "tipo",
      "codigo",
      "nombre",
      "unidad_medida"
    ],
    ["MP", "MP008", "Lata", "metro"]
  ]);
  agregarHoja("Productos_PCL", [
    ["producto_codigo", "producto_nombre", "familia"],
    ["PCL1", "Modular", "Exhibidores"]
  ]);
  agregarHoja("Piezas_PZ", [
    [
      "pieza_codigo",
      "pieza_nombre",
      "medida",
      "material_base_codigo"
    ],
    ["PZ1", "Lata bandeja", "", "MP008"]
  ]);
  agregarHoja("Subproductos_SUB", [
    [
      "subproducto_codigo",
      "subproducto_nombre",
      "producto_codigo",
      "pieza_salida_codigo"
    ],
    ["SUB1", "Bandeja", "PCL1", "PZ1"]
  ]);
  agregarHoja("Operaciones_OP", [
    [
      "operacion_codigo",
      "operacion_nombre",
      "subproducto_codigo",
      "pieza_codigo",
      "material_entrada_codigo"
    ],
    ["OP1", "Corte", "SUB1", "PZ1", "MP008"],
    ["OP2", "Doblez", "SUB1", "PZ1", "MP008"],
    ["OP3", "Soldadura", "SUB1", "PZ1", "MP008"]
  ]);
  agregarHoja("Ruta_Subproducto", [
    [
      "producto_codigo",
      "subproducto_codigo",
      "operacion_codigo",
      "proceso_codigo",
      "proceso_nombre",
      "estacion_codigo",
      "estacion_nombre",
      "unidades_por_subproducto",
      "unidades_por_hora",
      "secuencia",
      "dependencia_operacion_codigo"
    ],
    [
      "PCL1",
      "SUB1",
      "OP3",
      "PR1",
      "Soldadura",
      "ET1",
      "Soldadora",
      "2",
      "50",
      "3",
      "OP1, OP2"
    ]
  ]);

  const resultado =
    leerIngenieriaDesdeWorkbook(
      workbook,
      XLSX
    );

  expect(resultado.materiales[0].codigo).toBe(
    "MP0008"
  );
  expect(resultado.rutas[0]).toMatchObject({
    producto_codigo: "PCL0001",
    subproducto_codigo: "SUB0001",
    codigo: "OP0003",
    unidades_por_producto: 2,
    dependencia_operacion_codigos: [
      "OP0001",
      "OP0002"
    ]
  });
});

test("expande componentes y rutas con códigos separados por coma", () => {
  const workbook = XLSX.utils.book_new();
  const agregarHoja = (nombre, filas) => {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(filas),
      nombre
    );
  };

  agregarHoja("Materiales_MP_SUM", [
    ["tipo", "codigo", "nombre", "unidad_medida"],
    ["MP", "MP1", "Tubo", "metro"]
  ]);
  agregarHoja("Productos_PCL", [
    ["producto_codigo", "producto_nombre", "familia"],
    ["PCL1", "Modular", "Exhibidores"]
  ]);
  agregarHoja("Piezas_PZ", [
    [
      "pieza_codigo",
      "pieza_nombre",
      "medida",
      "material_base_codigo"
    ],
    ["PZ1", "Lateral terminado", "", "MP1"],
    ["PZ2", "Bandeja terminada", "", "MP1"],
    ["PZ30", "Lateral 290", "", "MP1"],
    ["PZ31", "Lateral 350", "", "MP1"]
  ]);
  agregarHoja("Subproductos_SUB", [
    [
      "subproducto_codigo",
      "subproducto_nombre",
      "producto_codigo",
      "pieza_salida_codigo"
    ],
    ["SUB7", "Lateral", "PCL1", "PZ1"],
    ["SUB8", "Bandeja", "PCL1", "PZ2"]
  ]);
  agregarHoja("Componentes_Subproducto", [
    [
      "subproducto_codigo",
      "pieza_componente_codigo",
      "cantidad"
    ],
    ["SUB7,SUB8", "PZ30,PZ31", "2"]
  ]);
  agregarHoja("Operaciones_OP", [
    [
      "operacion_codigo",
      "operacion_nombre",
      "subproducto_codigo",
      "pieza_codigo",
      "material_entrada_codigo"
    ],
    ["OP27", "Soldar", "SUB7,SUB8", "PZ30", "MP1"]
  ]);
  agregarHoja("Ruta_Subproducto", [
    [
      "producto_codigo",
      "subproducto_codigo",
      "operacion_codigo",
      "proceso_codigo",
      "proceso_nombre",
      "estacion_codigo",
      "estacion_nombre",
      "unidades_por_subproducto",
      "unidades_por_hora",
      "secuencia"
    ],
    [
      "PCL1",
      "SUB7,SUB8",
      "OP27",
      "PR1",
      "Soldadura",
      "ET1",
      "Soldadora",
      "1",
      "20",
      "1"
    ]
  ]);

  const resultado =
    leerIngenieriaDesdeWorkbook(
      workbook,
      XLSX
    );

  expect(resultado.errores).toEqual([]);
  expect(resultado.componentesSubproducto).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        subproducto_codigo: "SUB0007",
        pieza_codigo: "PZ0030"
      }),
      expect.objectContaining({
        subproducto_codigo: "SUB0008",
        pieza_codigo: "PZ0031"
      })
    ])
  );
  expect(resultado.componentesSubproducto).toHaveLength(4);
  expect(resultado.operaciones[0].subproducto_codigos).toEqual([
    "SUB0007",
    "SUB0008"
  ]);
  expect(resultado.rutas).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        subproducto_codigo: "SUB0007",
        codigo: "OP0027"
      }),
      expect.objectContaining({
        subproducto_codigo: "SUB0008",
        codigo: "OP0027"
      })
    ])
  );
});
