const limpiarTexto = valor =>
  (valor || "").toString().trim();

const normalizarCodigo = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const numero = valor => {
  const valorNumerico = Number(valor);
  return Number.isFinite(valorNumerico)
    ? valorNumerico
    : 0;
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

export const hojasPlantillaIngenieria = {
  Producto: [
    ["producto_codigo", "producto_nombre", "familia"],
    ["PCL0001", "Modular 2N60 H85 Ecuador", "Exhibidores"]
  ],
  Piezas: [
    [
      "pieza_codigo",
      "pieza_nombre",
      "medida",
      "material_base_codigo"
    ],
    ["PZ0001", "Lateral 290", "290 mm", "MP0001"],
    ["PZ0100", "Lateral Armado", "Armado", ""]
  ],
  Subproductos: [
    [
      "subproducto_codigo",
      "subproducto_nombre",
      "producto_codigo",
      "pieza_salida_codigo"
    ],
    ["SUB0001", "Lateral", "PCL0001", "PZ0100"]
  ],
  Componentes_Subproducto: [
    [
      "subproducto_codigo",
      "pieza_codigo",
      "cantidad"
    ],
    ["SUB0001", "PZ0001", "2"]
  ],
  Operaciones: [
    [
      "producto_codigo",
      "operacion_codigo",
      "operacion_nombre",
      "pieza_codigo",
      "proceso_codigo",
      "proceso_nombre",
      "subproceso_codigo",
      "subproceso_nombre",
      "material_entrada_codigo",
      "material_salida_codigo",
      "unidades_por_producto",
      "unidades_por_hora",
      "secuencia",
      "dependencia_operacion_codigo",
      "porcentaje_minimo_avance"
    ],
    [
      "PCL0001",
      "OP0001",
      "Corte lateral 290",
      "PZ0001",
      "PR0001",
      "Corte",
      "SP0001",
      "Tubo en prensa",
      "MP0001",
      "RF0001",
      "2",
      "120",
      "1",
      "",
      ""
    ]
  ]
};

export const leerIngenieriaDesdeWorkbook = (
  workbook,
  xlsx
) => {
  const productoFilas = leerFilas(
    workbook.Sheets.Producto,
    xlsx
  );
  const piezaFilas = leerFilas(
    workbook.Sheets.Piezas,
    xlsx
  );
  const subproductoFilas = leerFilas(
    workbook.Sheets.Subproductos,
    xlsx
  );
  const componenteFilas = leerFilas(
    workbook.Sheets.Componentes_Subproducto,
    xlsx
  );
  const operacionFilas = leerFilas(
    workbook.Sheets.Operaciones,
    xlsx
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

  const componentesSubproducto = componenteFilas
    .filter(fila =>
      fila.subproducto_codigo ||
      fila.pieza_codigo
    )
    .map(fila => ({
      subproducto_codigo: normalizarCodigo(
        fila.subproducto_codigo
      ),
      pieza_codigo: normalizarCodigo(
        fila.pieza_codigo
      ),
      cantidad: numero(fila.cantidad)
    }));

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
      proceso_codigo: normalizarCodigo(
        fila.proceso_codigo
      ),
      proceso_nombre: limpiarTexto(
        fila.proceso_nombre
      ),
      subproceso_codigo: normalizarCodigo(
        fila.subproceso_codigo
      ),
      subproceso_nombre: limpiarTexto(
        fila.subproceso_nombre
      ),
      material_entrada_codigo: normalizarCodigo(
        fila.material_entrada_codigo
      ),
      materiales_entrada_codigos:
        normalizarListaCodigos(
          fila.material_entrada_codigo
        ),
      material_salida_codigo: normalizarCodigo(
        fila.material_salida_codigo
      ),
      unidades_por_producto: numero(
        fila.unidades_por_producto
      ),
      unidades_por_hora: numero(
        fila.unidades_por_hora
      ),
      secuencia: numero(fila.secuencia),
      dependencia_operacion_codigo:
        normalizarCodigo(
          fila.dependencia_operacion_codigo
        ),
      porcentaje_minimo_avance: numero(
        fila.porcentaje_minimo_avance
      )
    }));

  return validarIngenieriaImportada({
    productos,
    piezas,
    subproductos,
    componentesSubproducto,
    operaciones
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
    if (!pieza.nombre || !pieza.medida) {
      errores.push(
        `Pieza ${pieza.codigo} requiere nombre y medida.`
      );
    }

    const materialesBase = new Set();
    (pieza.materiales_base_codigos || []).forEach(
      materialCodigo => {
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
    const piezaSalida = piezasPorCodigo.get(
      subproducto.pieza_salida_codigo
    );

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
    if (!piezaSalida) {
      errores.push(
        `Subproducto ${subproducto.codigo} referencia pieza salida inexistente ${subproducto.pieza_salida_codigo}.`
      );
    } else if (
      !piezaSalida.nombre
        .toLowerCase()
        .includes("armado")
    ) {
      errores.push(
        `La pieza salida ${piezaSalida.codigo} del subproducto ${subproducto.codigo} debe incluir "Armado" en el nombre.`
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
      errores.push(
        `Subproducto ${subproducto.codigo} no tiene componentes.`
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
      !productosPorCodigo.has(
        operacion.producto_codigo
      )
    ) {
      errores.push(
        `Operación ${operacion.codigo} referencia producto inexistente ${operacion.producto_codigo}.`
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
      !operacion.proceso_codigo ||
      !operacion.proceso_nombre ||
      !operacion.subproceso_codigo ||
      !operacion.subproceso_nombre
    ) {
      errores.push(
        `Operación ${operacion.codigo} requiere nombre, proceso y subproceso.`
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
    if (operacion.unidades_por_producto <= 0) {
      errores.push(
        `Operación ${operacion.codigo} requiere unidades_por_producto mayor que cero.`
      );
    }
    if (operacion.unidades_por_hora <= 0) {
      errores.push(
        `Operación ${operacion.codigo} requiere unidades_por_hora mayor que cero.`
      );
    }
    if (operacion.secuencia <= 0) {
      errores.push(
        `Operación ${operacion.codigo} requiere secuencia mayor que cero.`
      );
    }
    if (
      operacion.dependencia_operacion_codigo &&
      !operacionesPorCodigo.has(
        operacion.dependencia_operacion_codigo
      )
    ) {
      errores.push(
        `Operación ${operacion.codigo} depende de operación inexistente ${operacion.dependencia_operacion_codigo}.`
      );
    }
  });

  if (data.productos.length === 0) {
    errores.push(
      "El Excel debe incluir al menos un producto."
    );
  }

  if (data.operaciones.length === 0) {
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
  productos: data?.productos?.length || 0,
  piezas: data?.piezas?.length || 0,
  subproductos: data?.subproductos?.length || 0,
  componentes:
    data?.componentesSubproducto?.length || 0,
  operaciones: data?.operaciones?.length || 0,
  errores: data?.errores?.length || 0,
  advertencias: data?.advertencias?.length || 0
});
