const limpiarTexto = valor =>
  (valor || "").toString().trim();

const normalizarCodigo = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(
      /^(MP|RF|SUM|PCL|SUB|PZ|OP|PR|ET)(\d+)$/,
      (_, prefijo, numeroCodigo) =>
        `${prefijo}${numeroCodigo.padStart(4, "0")}`
    );

const numero = valor => {
  const valorNumerico = Number(
    limpiarTexto(valor).replace(",", ".")
  );
  return Number.isFinite(valorNumerico)
    ? valorNumerico
    : 0;
};

const booleano = valor => {
  const texto = limpiarTexto(valor).toLowerCase();
  return ![
    "no",
    "false",
    "falso",
    "0",
    "inactivo"
  ].includes(texto);
};

const normalizarEncabezado = valor =>
  limpiarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const normalizarListaCodigos = valor =>
  limpiarTexto(valor)
    .split(/[,;|]/)
    .map(normalizarCodigo)
    .filter(Boolean);

const normalizarListaDependencias = valor =>
  normalizarListaCodigos(valor);

const primeraReferencia = valor =>
  normalizarListaCodigos(valor)[0] ||
  normalizarCodigo(valor);

const normalizarListaNumeros = valor =>
  limpiarTexto(valor)
    .split(/[,;|]/)
    .map(numero)
    .filter(valorNumerico =>
      Number.isFinite(valorNumerico)
    );

const consolidarComponentesSubproducto = (
  componentes = []
) => {
  const componentesPorClave = new Map();

  componentes.forEach(componente => {
    const clave = [
      componente.subproducto_codigo,
      componente.pieza_codigo
    ].join("::");
    const existente =
      componentesPorClave.get(clave);

    if (existente) {
      componentesPorClave.set(clave, {
        ...existente,
        cantidad:
          Number(existente.cantidad || 0) +
          Number(componente.cantidad || 0)
      });
      return;
    }

    componentesPorClave.set(clave, componente);
  });

  return Array.from(componentesPorClave.values());
};

const leerFilas = (hoja, xlsx) => {
  if (!hoja) {
    return [];
  }

  const filas = xlsx.utils.sheet_to_json(hoja, {
    defval: "",
    raw: false
  });

  return filas.map(fila =>
    Object.fromEntries(
      Object.entries(fila).map(([clave, valor]) => [
        normalizarEncabezado(clave),
        limpiarTexto(valor)
      ])
    )
  );
};

const validarUnicos = (
  registros,
  campo,
  etiqueta,
  errores
) => {
  const vistos = new Set();
  registros.forEach(registro => {
    const valor = registro[campo];
    if (!valor) {
      return;
    }
    if (vistos.has(valor)) {
      errores.push(
        `${etiqueta} ${valor} está duplicado en el Excel.`
      );
    }
    vistos.add(valor);
  });
};

const agruparProcesosEstaciones = filas => {
  const procesos = new Map();

  filas
    .filter(fila =>
      fila.proceso_codigo ||
      fila.proceso_nombre ||
      fila.estacion_codigo ||
      fila.estacion_nombre
    )
    .forEach(fila => {
      const codigo = normalizarCodigo(
        fila.proceso_codigo
      );
      if (!procesos.has(codigo)) {
        procesos.set(codigo, {
          codigo,
          nombre: limpiarTexto(
            fila.proceso_nombre
          ),
          activo: true,
          estaciones: []
        });
      }

      const proceso = procesos.get(codigo);
      if (!proceso.nombre) {
        proceso.nombre = limpiarTexto(
          fila.proceso_nombre
        );
      }

      const estacionCodigo = normalizarCodigo(
        fila.estacion_codigo ||
        fila.subproceso_codigo
      );
      const estacionNombre = limpiarTexto(
        fila.estacion_nombre ||
        fila.subproceso_nombre
      );

      if (estacionCodigo || estacionNombre) {
        proceso.estaciones.push({
          codigo: estacionCodigo,
          nombre: estacionNombre,
          activo: true
        });
      }
    });

  return Array.from(procesos.values());
};

export const hojasPlantillaIngenieria = {
  Materiales_MP_SUM: [
    [
      "tipo",
      "codigo",
      "nombre",
      "unidad_medida",
      "costo_unitario_referencial",
      "moneda",
      "minimo_compra",
      "proveedor_preferente_nombre"
    ],
    [
      "MP",
      "MP0001",
      "Tubo 15x15x1 mm",
      "metro",
      "1250",
      "CLP",
      "6",
      "Proveedor ejemplo"
    ],
    [
      "SUM",
      "SUM0001",
      "Tinta UV Cyan",
      "litro",
      "18500",
      "CLP",
      "1",
      "Proveedor tintas"
    ]
  ],
  Recursos_RF: [
    [
      "codigo",
      "nombre",
      "unidad_medida",
      "producto_codigo",
      "subproducto_codigo"
    ],
    [
      "RF0001",
      "Tubo lateral cortado 290",
      "unidad",
      "PCL0001",
      "SUB0001"
    ]
  ],
  Procesos_ET: [
    [
      "proceso_codigo",
      "proceso_nombre",
      "estacion_codigo",
      "estacion_nombre"
    ],
    [
      "PR0001",
      "Corte",
      "ET0001",
      "Tubo en prensa"
    ]
  ],
  Productos_PCL: [
    ["producto_codigo", "producto_nombre", "familia"],
    ["PCL0001", "Modular 2N60 H85 Ecuador", "Exhibidores"]
  ],
  Subproductos_SUB: [
    [
      "subproducto_codigo",
      "subproducto_nombre",
      "producto_codigo",
      "pieza_salida_codigo"
    ],
    ["SUB0001", "Lateral", "PCL0001", "PZ0100"]
  ],
  Piezas_PZ: [
    [
      "pieza_codigo",
      "pieza_nombre",
      "medida",
      "material_base_codigo",
      "material_base_cantidad",
      "producto_codigo",
      "subproducto_codigo"
    ],
    [
      "PZ0001",
      "Lateral 290",
      "290 mm",
      "MP0001",
      "0.29",
      "PCL0001",
      "SUB0001"
    ],
    [
      "PZ0100",
      "Lateral Armado",
      "Armado",
      "RF0001",
      "2",
      "PCL0001",
      "SUB0001"
    ]
  ],
  Composicion_Producto: [
    [
      "producto_codigo",
      "tipo",
      "categoria",
      "item_codigo",
      "cantidad"
    ],
    ["PCL0001", "SUBPRODUCTO", "subproducto", "SUB0001", "2"]
  ],
  Componentes_Subproducto: [
    [
      "subproducto_codigo",
      "pieza_componente_codigo",
      "cantidad"
    ],
    ["SUB0001", "PZ0001", "2"]
  ],
  Operaciones_OP: [
    [
      "operacion_codigo",
      "operacion_nombre",
      "subproducto_codigo",
      "pieza_codigo",
      "material_entrada_codigo",
      "material_entrada_cantidad",
      "material_salida_codigo"
    ],
    [
      "OP0001",
      "Corte lateral 290",
      "SUB0001",
      "PZ0001",
      "MP0001",
      "0.29",
      "RF0001"
    ]
  ],
  Ruta_Producto: [
    [
      "producto_codigo",
      "operacion_codigo",
      "proceso_codigo",
      "proceso_nombre",
      "estacion_codigo",
      "estacion_nombre",
      "subproducto_codigo",
      "unidades_por_producto",
      "unidades_por_hora",
      "secuencia",
      "dependencia_operacion_codigo",
      "porcentaje_minimo_avance"
    ],
    [
      "PCL0001",
      "OP0001",
      "PR0001",
      "Corte",
      "ET0001",
      "Tubo en prensa",
      "SUB0001",
      "2",
      "120",
      "1",
      "",
      ""
    ]
  ],
  Ruta_Subproducto: [
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
      "dependencia_operacion_codigo",
      "porcentaje_minimo_avance"
    ],
    [
      "PCL0001",
      "SUB0001",
      "OP0001",
      "PR0001",
      "Corte",
      "ET0001",
      "Tubo en prensa",
      "2",
      "120",
      "1",
      "",
      ""
    ]
  ]
};

const obtenerHoja = (workbook, nombres = []) =>
  nombres
    .map(nombre => workbook.Sheets[nombre])
    .find(Boolean);

export const leerIngenieriaDesdeWorkbook = (
  workbook,
  xlsx
) => {
  const materialFilas = leerFilas(
    obtenerHoja(workbook, ["Materiales_MP_SUM"]),
    xlsx
  );
  const recursoRfFilas = leerFilas(
    obtenerHoja(workbook, ["Recursos_RF"]),
    xlsx
  );
  const procesoFilas = leerFilas(
    obtenerHoja(workbook, ["Procesos_ET"]),
    xlsx
  );
  const productoFilas = leerFilas(
    obtenerHoja(workbook, [
      "Productos_PCL",
      "Producto"
    ]),
    xlsx
  );
  const piezaFilas = leerFilas(
    obtenerHoja(workbook, ["Piezas_PZ", "Piezas"]),
    xlsx
  );
  const subproductoFilas = leerFilas(
    obtenerHoja(workbook, [
      "Subproductos_SUB",
      "Subproductos"
    ]),
    xlsx
  );
  const composicionFilas = leerFilas(
    obtenerHoja(workbook, ["Composicion_Producto"]),
    xlsx
  );
  const componenteFilas = leerFilas(
    workbook.Sheets.Componentes_Subproducto,
    xlsx
  );
  const operacionFilas = leerFilas(
    obtenerHoja(workbook, [
      "Operaciones_OP",
      "Operaciones"
    ]),
    xlsx
  );
  const rutaProductoFilas = leerFilas(
    obtenerHoja(workbook, ["Ruta_Producto"]),
    xlsx
  );
  const rutaSubproductoFilas = leerFilas(
    obtenerHoja(workbook, ["Ruta_Subproducto"]),
    xlsx
  );

  const materiales = [
    ...materialFilas
      .filter(fila => fila.codigo || fila.nombre)
      .map(fila => ({
        tipo: normalizarCodigo(fila.tipo),
        codigo: normalizarCodigo(fila.codigo),
        nombre: limpiarTexto(fila.nombre),
        unidad_medida: limpiarTexto(
          fila.unidad_medida
        ) || "unidad",
        costo_unitario_referencial: numero(
          fila.costo_unitario_referencial
        ),
        moneda:
          limpiarTexto(fila.moneda) || "CLP",
        minimo_compra: numero(fila.minimo_compra),
        proveedor_preferente_nombre:
          limpiarTexto(
            fila.proveedor_preferente_nombre
          ),
        es_comprado: booleano(fila.es_comprado),
        activo: booleano(fila.activo)
      })),
    ...recursoRfFilas
      .filter(fila => fila.codigo || fila.nombre)
      .map(fila => ({
        tipo: "RF",
        codigo: normalizarCodigo(fila.codigo),
        nombre: limpiarTexto(fila.nombre),
        unidad_medida: limpiarTexto(
          fila.unidad_medida
        ) || "unidad",
        producto_codigo: normalizarCodigo(
          fila.producto_codigo
        ),
        subproducto_codigo: normalizarCodigo(
          fila.subproducto_codigo
        ),
        es_comprado: false,
        activo: booleano(fila.activo)
      }))
  ];

  const procesos = agruparProcesosEstaciones(
    procesoFilas
  );

  const productos = productoFilas
    .filter(fila =>
      fila.producto_codigo ||
      fila.producto_nombre
    )
    .map(fila => ({
      codigo: normalizarCodigo(
        fila.producto_codigo
      ),
      nombre: limpiarTexto(
        fila.producto_nombre
      ),
      familia: limpiarTexto(fila.familia),
      activo: true
    }));

  const piezas = piezaFilas
    .filter(fila =>
      fila.pieza_codigo || fila.pieza_nombre
    )
    .map(fila => ({
      codigo: normalizarCodigo(
        fila.pieza_codigo
      ),
      nombre: limpiarTexto(fila.pieza_nombre),
      medida: limpiarTexto(fila.medida),
      material_base_codigo: normalizarCodigo(
        fila.material_base_codigo
      ),
      materiales_base_codigos:
        normalizarListaCodigos(
          fila.material_base_codigo
        ),
      materiales_base_cantidades:
        normalizarListaNumeros(
          fila.material_base_cantidad
        ),
      producto_codigo: normalizarCodigo(
        fila.producto_codigo
      ),
      subproducto_codigo: normalizarCodigo(
        fila.subproducto_codigo
      ),
      activo: true
    }));

  const subproductos = subproductoFilas
    .filter(fila =>
      fila.subproducto_codigo ||
      fila.subproducto_nombre
    )
    .map(fila => ({
      codigo: normalizarCodigo(
        fila.subproducto_codigo
      ),
      nombre: limpiarTexto(
        fila.subproducto_nombre
      ),
      producto_codigo: normalizarCodigo(
        fila.producto_codigo
      ),
      pieza_salida_codigo: normalizarCodigo(
        fila.pieza_salida_codigo
      ),
      activo: true
    }));

  const composicionProducto = composicionFilas
    .filter(fila =>
      fila.producto_codigo || fila.item_codigo
    )
    .map(fila => ({
      producto_codigo: normalizarCodigo(
        fila.producto_codigo
      ),
      tipo: normalizarCodigo(fila.tipo),
      categoria: limpiarTexto(fila.categoria),
      item_codigo: normalizarCodigo(
        fila.item_codigo
      ),
      cantidad: numero(fila.cantidad)
    }));

  const componentesSubproducto =
    consolidarComponentesSubproducto(
      componenteFilas.flatMap(fila => {
        const subproductosCodigos =
          normalizarListaCodigos(
            fila.subproducto_codigo
          );
        const piezasCodigos =
          normalizarListaCodigos(
            fila.pieza_codigo ||
              fila.pieza_componente_codigo
          );
        const cantidad = numero(fila.cantidad);

        if (
          subproductosCodigos.length === 0 &&
          piezasCodigos.length === 0
        ) {
          return [];
        }

        return subproductosCodigos.flatMap(
          subproductoCodigo =>
            piezasCodigos.map(piezaCodigo => ({
              subproducto_codigo:
                subproductoCodigo,
              pieza_codigo: piezaCodigo,
              cantidad
            }))
        );
      })
    );

  const operaciones = operacionFilas
    .filter(fila =>
      fila.operacion_codigo ||
      fila.operacion_nombre
    )
    .map(fila => ({
      producto_codigo: normalizarCodigo(
        fila.producto_codigo
      ),
      codigo: normalizarCodigo(
        fila.operacion_codigo
      ),
      nombre: limpiarTexto(
        fila.operacion_nombre
      ),
      pieza_codigo: normalizarCodigo(
        fila.pieza_codigo
      ),
      subproducto_codigo: primeraReferencia(
        fila.subproducto_codigo
      ),
      subproducto_codigos: normalizarListaCodigos(
        fila.subproducto_codigo
      ),
      proceso_codigo: normalizarCodigo(
        fila.proceso_codigo
      ),
      proceso_nombre: limpiarTexto(
        fila.proceso_nombre
      ),
      estacion_codigo: normalizarCodigo(
        fila.estacion_codigo ||
        fila.subproceso_codigo
      ),
      estacion_nombre: limpiarTexto(
        fila.estacion_nombre ||
        fila.subproceso_nombre
      ),
      material_entrada_codigo: normalizarCodigo(
        fila.material_entrada_codigo
      ),
      materiales_entrada_codigos:
        normalizarListaCodigos(
          fila.material_entrada_codigo
        ),
      materiales_entrada_cantidades:
        normalizarListaNumeros(
          fila.material_entrada_cantidad
        ),
      material_salida_codigo: normalizarCodigo(
        fila.material_salida_codigo
      ),
      unidades_por_producto: numero(
        fila.unidades_por_producto ||
        fila.unidades_por_subproducto
      ),
      unidades_por_hora: numero(
        fila.unidades_por_hora
      ),
      secuencia: numero(fila.secuencia),
      dependencia_operacion_codigo:
        normalizarCodigo(
          fila.dependencia_operacion_codigo
        ),
      dependencia_operacion_codigos:
        normalizarListaDependencias(
          fila.dependencia_operacion_codigo
        ),
      porcentaje_minimo_avance: numero(
        fila.porcentaje_minimo_avance
      )
    }));

  const rutasProducto = rutaProductoFilas
    .filter(fila =>
      fila.producto_codigo ||
      fila.operacion_codigo
    )
    .map(fila => ({
      tipo_ruta: "PRODUCTO",
      producto_codigo: normalizarCodigo(
        fila.producto_codigo
      ),
      codigo: normalizarCodigo(
        fila.operacion_codigo
      ),
      proceso_codigo: normalizarCodigo(
        fila.proceso_codigo
      ),
      proceso_nombre: limpiarTexto(
        fila.proceso_nombre
      ),
      estacion_codigo: normalizarCodigo(
        fila.estacion_codigo ||
        fila.subproceso_codigo
      ),
      estacion_nombre: limpiarTexto(
        fila.estacion_nombre ||
        fila.subproceso_nombre
      ),
      subproducto_codigo: primeraReferencia(
        fila.subproducto_codigo
      ),
      subproducto_codigos: normalizarListaCodigos(
        fila.subproducto_codigo
      ),
      unidades_por_producto: numero(
        fila.unidades_por_producto ||
        fila.unidades_por_subproducto
      ),
      unidades_por_hora: numero(
        fila.unidades_por_hora
      ),
      secuencia: numero(fila.secuencia),
      dependencia_operacion_codigo:
        normalizarCodigo(
          fila.dependencia_operacion_codigo
        ),
      dependencia_operacion_codigos:
        normalizarListaDependencias(
          fila.dependencia_operacion_codigo
        ),
      porcentaje_minimo_avance: numero(
        fila.porcentaje_minimo_avance
      )
    }));

  const rutasSubproducto = rutaSubproductoFilas
    .filter(fila =>
      fila.subproducto_codigo ||
      fila.operacion_codigo
    )
    .flatMap(fila => {
      const subproductosCodigos =
        normalizarListaCodigos(
          fila.subproducto_codigo
        );

      return subproductosCodigos.map(
        subproductoCodigo => ({
          tipo_ruta: "SUBPRODUCTO",
          producto_codigo: normalizarCodigo(
            fila.producto_codigo
          ),
          subproducto_codigo: subproductoCodigo,
          codigo: normalizarCodigo(
            fila.operacion_codigo
          ),
          proceso_codigo: normalizarCodigo(
            fila.proceso_codigo
          ),
          proceso_nombre: limpiarTexto(
            fila.proceso_nombre
          ),
          estacion_codigo: normalizarCodigo(
            fila.estacion_codigo ||
            fila.subproceso_codigo
          ),
          estacion_nombre: limpiarTexto(
            fila.estacion_nombre ||
            fila.subproceso_nombre
          ),
          unidades_por_producto: numero(
            fila.unidades_por_producto ||
            fila.unidades_por_subproducto
          ),
          unidades_por_hora: numero(
            fila.unidades_por_hora
          ),
          secuencia: numero(fila.secuencia),
          dependencia_operacion_codigo:
            normalizarCodigo(
              fila.dependencia_operacion_codigo
            ),
          dependencia_operacion_codigos:
            normalizarListaDependencias(
              fila.dependencia_operacion_codigo
            ),
          porcentaje_minimo_avance: numero(
            fila.porcentaje_minimo_avance
          )
        })
      );
    });

  const rutas = [
    ...rutasProducto,
    ...rutasSubproducto
  ];

  return validarIngenieriaImportada({
    materiales,
    procesos,
    productos,
    piezas,
    subproductos,
    composicionProducto,
    componentesSubproducto,
    operaciones,
    rutas:
      rutas.length > 0
        ? rutas
        : operaciones.map(operacion => ({
            ...operacion,
            tipo_ruta: "PRODUCTO",
            estacion_codigo:
              operacion.estacion_codigo ||
              operacion.subproceso_codigo ||
              "",
            estacion_nombre:
              operacion.estacion_nombre ||
              operacion.subproceso_nombre ||
              ""
          }))
  });
};

export const validarIngenieriaImportada = data => {
  const errores = [];
  const advertencias = [];
  const productosPorCodigo = new Map(
    data.productos.map(producto => [
      producto.codigo,
      producto
    ])
  );
  const materialesPorCodigo = new Map(
    (data.materiales || []).map(material => [
      material.codigo,
      material
    ])
  );
  const piezasPorCodigo = new Map(
    data.piezas.map(pieza => [
      pieza.codigo,
      pieza
    ])
  );
  const subproductosPorCodigo = new Map(
    data.subproductos.map(subproducto => [
      subproducto.codigo,
      subproducto
    ])
  );
  const operacionesPorCodigo = new Map(
    data.operaciones.map(operacion => [
      operacion.codigo,
      operacion
    ])
  );

  validarUnicos(
    data.materiales || [],
    "codigo",
    "El material",
    errores
  );
  validarUnicos(
    data.procesos || [],
    "codigo",
    "El proceso",
    errores
  );
  validarUnicos(
    data.productos,
    "codigo",
    "El producto",
    errores
  );
  validarUnicos(
    data.piezas,
    "codigo",
    "La pieza",
    errores
  );
  validarUnicos(
    data.subproductos,
    "codigo",
    "El subproducto",
    errores
  );
  validarUnicos(
    data.operaciones,
    "codigo",
    "La operación",
    errores
  );

  (data.materiales || []).forEach(material => {
    if (!["MP", "RF", "SUM"].includes(material.tipo)) {
      errores.push(
        `Material ${material.codigo || "(sin código)"} requiere tipo MP, RF o SUM.`
      );
    }
    if (
      material.tipo &&
      material.codigo &&
      !new RegExp(`^${material.tipo}\\d{4,}$`)
        .test(material.codigo)
    ) {
      errores.push(
        `Material ${material.codigo || "(sin código)"} debe comenzar con ${material.tipo} y usar correlativo.`
      );
    }
    if (!material.nombre) {
      errores.push(
        `Material ${material.codigo} requiere nombre.`
      );
    }
    if (!material.unidad_medida) {
      errores.push(
        `Material ${material.codigo} requiere unidad_medida.`
      );
    }
  });

  (data.procesos || []).forEach(proceso => {
    if (!/^PR\d{4,}$/.test(proceso.codigo)) {
      errores.push(
        `Proceso ${proceso.codigo || "(sin código)"} debe usar formato PR0001.`
      );
    }
    if (!proceso.nombre) {
      errores.push(
        `Proceso ${proceso.codigo} requiere nombre.`
      );
    }
    if ((proceso.estaciones || []).length === 0) {
      errores.push(
        `Proceso ${proceso.codigo} requiere al menos una estación ET.`
      );
    }

    const estacionesUsadas = new Set();
    (proceso.estaciones || []).forEach(estacion => {
      if (!/^ET\d{4,}$/.test(estacion.codigo)) {
        errores.push(
          `Estación ${estacion.codigo || "(sin código)"} del proceso ${proceso.codigo} debe usar formato ET0001.`
        );
      }
      if (!estacion.nombre) {
        errores.push(
          `Estación ${estacion.codigo} del proceso ${proceso.codigo} requiere nombre.`
        );
      }
      if (estacionesUsadas.has(estacion.codigo)) {
        errores.push(
          `Proceso ${proceso.codigo} repite estación ${estacion.codigo}.`
        );
      }
      estacionesUsadas.add(estacion.codigo);
    });
  });

  data.productos.forEach(producto => {
    if (!/^PCL\d{4,}$/.test(producto.codigo)) {
      errores.push(
        `Producto ${producto.codigo || "(sin código)"} debe usar formato PCL0001.`
      );
    }
    if (!producto.nombre) {
      errores.push(
        `Producto ${producto.codigo} requiere nombre.`
      );
    }
  });

  data.piezas.forEach(pieza => {
    if (!/^PZ\d{4,}$/.test(pieza.codigo)) {
      errores.push(
        `Pieza ${pieza.codigo || "(sin código)"} debe usar formato PZ0001.`
      );
    }
    if (!pieza.nombre) {
      errores.push(
        `Pieza ${pieza.codigo} requiere nombre.`
      );
    }
    if (!pieza.medida) {
      advertencias.push(
        `Pieza ${pieza.codigo} no tiene medida; se podrá completar después.`
      );
    }

    const materialesBase = new Set();
    (pieza.materiales_base_codigos || []).forEach(
      materialCodigo => {
        if (!materialCodigo) {
          return;
        }
        if (materialesBase.has(materialCodigo)) {
          errores.push(
            `Pieza ${pieza.codigo} repite material base ${materialCodigo}.`
          );
        }
        materialesBase.add(materialCodigo);
      }
    );
  });

  data.subproductos.forEach(subproducto => {
    const piezaSalida =
      subproducto.pieza_salida_codigo
        ? piezasPorCodigo.get(
            subproducto.pieza_salida_codigo
          )
        : null;

    if (!/^SUB\d{4,}$/.test(subproducto.codigo)) {
      errores.push(
        `Subproducto ${subproducto.codigo || "(sin código)"} debe usar formato SUB0001.`
      );
    }
    if (
      !productosPorCodigo.has(
        subproducto.producto_codigo
      )
    ) {
      errores.push(
        `Subproducto ${subproducto.codigo} referencia producto inexistente ${subproducto.producto_codigo}.`
      );
    }
    if (
      subproducto.pieza_salida_codigo &&
      !piezaSalida
    ) {
      errores.push(
        `Subproducto ${subproducto.codigo} referencia pieza salida inexistente ${subproducto.pieza_salida_codigo}.`
      );
    } else if (
      !/(armado|terminado)/i.test(
        piezaSalida.nombre
      )
    ) {
      advertencias.push(
        `Subproducto ${subproducto.codigo} usa pieza salida ${piezaSalida.codigo} sin "Armado" o "Terminado"; revisa si realmente es la pieza final del subproducto.`
      );
    }
  });

  data.componentesSubproducto.forEach(
    componente => {
      if (
        !subproductosPorCodigo.has(
          componente.subproducto_codigo
        )
      ) {
        errores.push(
          `Componente referencia subproducto inexistente ${componente.subproducto_codigo}.`
        );
      }
      if (
        !piezasPorCodigo.has(
          componente.pieza_codigo
        )
      ) {
        errores.push(
          `Componente referencia pieza inexistente ${componente.pieza_codigo}.`
        );
      }
      if (componente.cantidad <= 0) {
        errores.push(
          `Componente ${componente.subproducto_codigo}/${componente.pieza_codigo} requiere cantidad mayor que cero.`
        );
      }
    }
  );

  data.subproductos.forEach(subproducto => {
    const componentes =
      data.componentesSubproducto.filter(
        componente =>
          componente.subproducto_codigo ===
          subproducto.codigo
      );
    if (componentes.length === 0) {
      advertencias.push(
        `Subproducto ${subproducto.codigo} quedará pendiente de componentes.`
      );
    }
  });

  (data.composicionProducto || []).forEach(item => {
    if (!productosPorCodigo.has(item.producto_codigo)) {
      errores.push(
        `Composición referencia producto inexistente ${item.producto_codigo}.`
      );
    }
    if (
      !["SUBPRODUCTO", "PIEZA", "MATERIAL"]
        .includes(item.tipo)
    ) {
      errores.push(
        `Composición ${item.producto_codigo}/${item.item_codigo} requiere tipo SUBPRODUCTO, PIEZA o MATERIAL.`
      );
    }
    const existeItem =
      item.tipo === "SUBPRODUCTO"
        ? subproductosPorCodigo.has(item.item_codigo)
        : item.tipo === "PIEZA"
          ? piezasPorCodigo.has(item.item_codigo)
          : materialesPorCodigo.has(item.item_codigo);
    if (!existeItem) {
      errores.push(
        `Composición ${item.producto_codigo} referencia item inexistente ${item.item_codigo}.`
      );
    }
    if (item.cantidad <= 0) {
      errores.push(
        `Composición ${item.producto_codigo}/${item.item_codigo} requiere cantidad mayor que cero.`
      );
    }
  });

  data.operaciones.forEach(operacion => {
    const materialesEntradaCodigos =
      (operacion.materiales_entrada_codigos || [])
        .length > 0
        ? operacion.materiales_entrada_codigos
        : operacion.material_entrada_codigo
          ? [operacion.material_entrada_codigo]
          : [];

    if (!/^OP\d{4,}$/.test(operacion.codigo)) {
      errores.push(
        `Operación ${operacion.codigo || "(sin código)"} debe usar formato OP0001.`
      );
    }
    if (
      !piezasPorCodigo.has(operacion.pieza_codigo)
    ) {
      errores.push(
        `Operación ${operacion.codigo} referencia pieza inexistente ${operacion.pieza_codigo}.`
      );
    }
    if (
      !operacion.nombre ||
      !operacion.pieza_codigo
    ) {
      errores.push(
        `Operación ${operacion.codigo} requiere nombre y pieza.`
      );
    }
    const subproductosOperacion =
      operacion.subproducto_codigos?.length > 0
        ? operacion.subproducto_codigos
        : operacion.subproducto_codigo
          ? [operacion.subproducto_codigo]
          : [];
    const subproductosOperacionInexistentes =
      subproductosOperacion.filter(
        subproductoCodigo =>
          !subproductosPorCodigo.has(
            subproductoCodigo
          )
      );

    if (
      subproductosOperacionInexistentes.length > 0
    ) {
      errores.push(
        `Operación ${operacion.codigo} referencia subproducto inexistente ${subproductosOperacionInexistentes.join(",")}.`
      );
    }
    if (
      !operacion.material_entrada_codigo ||
      materialesEntradaCodigos.length === 0
    ) {
      errores.push(
        `Operación ${operacion.codigo} requiere material de entrada.`
      );
    }
    const entradasUsadas = new Set();
    materialesEntradaCodigos.forEach(
      materialCodigo => {
        if (entradasUsadas.has(materialCodigo)) {
          errores.push(
            `Operación ${operacion.codigo} repite material entrada ${materialCodigo}.`
          );
        }
        entradasUsadas.add(materialCodigo);
      });
  });

  (data.rutas || []).forEach(ruta => {
    const operacion = operacionesPorCodigo.get(
      ruta.codigo
    );
    if (!operacion) {
      errores.push(
        `Ruta referencia operación inexistente ${ruta.codigo}.`
      );
    }
    if (!productosPorCodigo.has(ruta.producto_codigo)) {
      errores.push(
        `Ruta ${ruta.codigo} referencia producto inexistente ${ruta.producto_codigo}.`
      );
    }
    if (
      ruta.tipo_ruta === "SUBPRODUCTO" &&
      !subproductosPorCodigo.has(ruta.subproducto_codigo)
    ) {
      errores.push(
        `Ruta subproducto ${ruta.codigo} referencia subproducto inexistente ${ruta.subproducto_codigo}.`
      );
    }
    if (
      ruta.tipo_ruta === "PRODUCTO" &&
      ruta.subproducto_codigo &&
      !subproductosPorCodigo.has(ruta.subproducto_codigo)
    ) {
      errores.push(
        `Ruta producto ${ruta.codigo} referencia subproducto inexistente ${ruta.subproducto_codigo}.`
      );
    }
    if (
      !ruta.proceso_codigo ||
      !ruta.proceso_nombre ||
      !ruta.estacion_codigo ||
      !ruta.estacion_nombre
    ) {
      errores.push(
        `Ruta ${ruta.codigo} requiere proceso y estación.`
      );
    }
    if (ruta.unidades_por_producto <= 0) {
      errores.push(
        `Ruta ${ruta.codigo} requiere unidades_por_producto mayor que cero.`
      );
    }
    if (ruta.unidades_por_hora <= 0) {
      errores.push(
        `Ruta ${ruta.codigo} requiere unidades_por_hora mayor que cero.`
      );
    }
    if (ruta.secuencia <= 0) {
      errores.push(
        `Ruta ${ruta.codigo} requiere secuencia mayor que cero.`
      );
    }
    const dependenciasRuta =
      ruta.dependencia_operacion_codigos?.length > 0
        ? ruta.dependencia_operacion_codigos
        : ruta.dependencia_operacion_codigo
          ? [ruta.dependencia_operacion_codigo]
          : [];
    const dependenciasInexistentes =
      dependenciasRuta.filter(
        dependencia =>
          !operacionesPorCodigo.has(dependencia)
      );

    if (dependenciasInexistentes.length > 0) {
      errores.push(
        `Ruta ${ruta.codigo} depende de operación inexistente ${dependenciasInexistentes.join(", ")}.`
      );
    }
  });

  if (data.productos.length === 0) {
    errores.push(
      "El Excel debe incluir al menos un producto."
    );
  }

  if ((data.rutas || []).length === 0) {
    advertencias.push(
      "El Excel no incluye operaciones de ruta."
    );
  }

  return {
    ...data,
    errores,
    advertencias
  };
};

export const resumenIngenieria = data => ({
  materiales: data?.materiales?.length || 0,
  procesos: data?.procesos?.length || 0,
  productos: data?.productos?.length || 0,
  piezas: data?.piezas?.length || 0,
  subproductos: data?.subproductos?.length || 0,
  composicion:
    data?.composicionProducto?.length || 0,
  componentes:
    data?.componentesSubproducto?.length || 0,
  operaciones: data?.operaciones?.length || 0,
  rutas: data?.rutas?.length || 0,
  errores: data?.errores?.length || 0,
  advertencias: data?.advertencias?.length || 0
});
