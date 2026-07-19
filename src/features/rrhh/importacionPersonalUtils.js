const limpiarTexto = valor =>
  (valor || "").toString().trim();

const normalizarEncabezado = valor =>
  limpiarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const normalizarCodigo = valor =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

const normalizarLista = valor =>
  limpiarTexto(valor)
    .split(/[,;|]/)
    .map(limpiarTexto)
    .filter(Boolean);

const booleano = valor => {
  const texto = limpiarTexto(valor).toLowerCase();
  return ![
    "no",
    "false",
    "falso",
    "0",
    "inactivo",
    "baja",
    "despedido",
    "renuncio",
    "renunció"
  ].includes(texto);
};

const leerFilas = (hoja, xlsx) => {
  if (!hoja) {
    return [];
  }

  return xlsx.utils.sheet_to_json(hoja, {
    defval: "",
    raw: false
  }).map(fila =>
    Object.fromEntries(
      Object.entries(fila).map(([clave, valor]) => [
        normalizarEncabezado(clave),
        limpiarTexto(valor)
      ])
    )
  );
};

const obtenerHoja = (workbook, nombres) => {
  const nombre = nombres.find(
    candidato => workbook.Sheets[candidato]
  );

  return nombre ? workbook.Sheets[nombre] : null;
};

export const hojasPlantillaPersonal = {
  Personal: [
    [
      "codigo_persona",
      "nombre",
      "rol_laboral",
      "activo",
      "planta_id",
      "equipo",
      "fecha_ingreso",
      "fecha_salida",
      "motivo_salida",
      "habilidades_estacion_ids",
      "observacion"
    ],
    [
      "PER0001",
      "Operario Ejemplo",
      "operario",
      "verdadero",
      "chile",
      "Alexis",
      "2026-07-19",
      "",
      "",
      "PR0001__ET0001; PR0002__ET0003",
      "Migrado desde app anterior"
    ]
  ]
};

export const leerPersonalDesdeWorkbook = (
  workbook,
  xlsx
) => {
  const filas = leerFilas(
    obtenerHoja(workbook, [
      "Personal",
      "Operarios",
      "RRHH"
    ]),
    xlsx
  );
  const errores = [];
  const advertencias = [];
  const codigos = new Set();
  const nombres = new Set();

  const personas = filas
    .map((fila, indice) => {
      const codigo =
        normalizarCodigo(
          fila.codigo_persona ||
          fila.codigo ||
          fila.operario_codigo
        );
      const nombre = limpiarTexto(fila.nombre);
      const rolLaboral =
        limpiarTexto(fila.rol_laboral || fila.rol) ||
        "operario";
      const activo = booleano(fila.activo);
      const habilidades =
        normalizarLista(
          fila.habilidades_estacion_ids ||
          fila.habilidades ||
          fila.estaciones
        ).map(normalizarCodigo);
      const nombreNormalizado =
        nombre.toLowerCase();

      if (!nombre) {
        errores.push(
          `Fila ${indice + 2}: falta nombre.`
        );
      }

      if (
        codigo &&
        !/^PER\d{4,}$/.test(codigo)
      ) {
        errores.push(
          `Fila ${indice + 2}: el código ${codigo} debe usar formato PER0001.`
        );
      }

      if (codigo && codigos.has(codigo)) {
        errores.push(
          `Persona ${codigo} está duplicada en el Excel.`
        );
      }
      if (codigo) {
        codigos.add(codigo);
      }

      if (
        nombreNormalizado &&
        nombres.has(nombreNormalizado)
      ) {
        advertencias.push(
          `El nombre ${nombre} aparece más de una vez; se recomienda revisar antes de importar.`
        );
      }
      if (nombreNormalizado) {
        nombres.add(nombreNormalizado);
      }

      return {
        codigo,
        codigo_persona: codigo,
        nombre,
        rol_laboral: rolLaboral,
        activo,
        planta_id:
          limpiarTexto(fila.planta_id) || "chile",
        equipo: activo
          ? limpiarTexto(fila.equipo)
          : "",
        fecha_ingreso: limpiarTexto(
          fila.fecha_ingreso
        ),
        fecha_salida: activo
          ? ""
          : limpiarTexto(fila.fecha_salida),
        motivo_salida: activo
          ? ""
          : limpiarTexto(fila.motivo_salida),
        observacion: limpiarTexto(
          fila.observacion
        ),
        habilidades_estacion_ids: habilidades
      };
    })
    .filter(persona =>
      persona.nombre || persona.codigo
    );

  if (personas.length === 0) {
    errores.push(
      "El Excel debe incluir al menos una persona."
    );
  }

  return {
    personas,
    errores,
    advertencias
  };
};

export const resumenPersonal = data => ({
  personas: data?.personas?.length || 0,
  errores: data?.errores?.length || 0,
  advertencias: data?.advertencias?.length || 0
});
