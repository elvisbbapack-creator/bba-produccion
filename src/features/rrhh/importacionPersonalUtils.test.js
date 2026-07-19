import * as XLSX from "xlsx";
import {
  leerPersonalDesdeWorkbook,
  resumenPersonal
} from "./importacionPersonalUtils";
import {
  siguienteCodigoPersona
} from "./rrhhRepository";

const workbookDesdeFilas = filas => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(filas),
    "Personal"
  );
  return workbook;
};

test("lee personal codificado desde Excel", () => {
  const workbook = workbookDesdeFilas([
    [
      "codigo_persona",
      "nombre",
      "rol_laboral",
      "activo",
      "planta_id",
      "equipo",
      "habilidades_estacion_ids"
    ],
    [
      "PER0007",
      "Operario Uno",
      "operario",
      "verdadero",
      "chile",
      "Alexis",
      "PR0001__ET0001; PR0002__ET0002"
    ]
  ]);

  const data = leerPersonalDesdeWorkbook(
    workbook,
    XLSX
  );

  expect(data.errores).toEqual([]);
  expect(data.personas[0]).toMatchObject({
    codigo: "PER0007",
    nombre: "Operario Uno",
    rol_laboral: "operario",
    activo: true,
    equipo: "Alexis",
    habilidades_estacion_ids: [
      "PR0001__ET0001",
      "PR0002__ET0002"
    ]
  });
  expect(resumenPersonal(data)).toEqual({
    personas: 1,
    errores: 0,
    advertencias: 0
  });
});

test("valida formato y duplicidad de codigo", () => {
  const workbook = workbookDesdeFilas([
    ["codigo_persona", "nombre"],
    ["OP001", "Operario Uno"],
    ["OP001", "Operario Dos"]
  ]);

  const data = leerPersonalDesdeWorkbook(
    workbook,
    XLSX
  );

  expect(data.errores).toContain(
    "Fila 2: el código OP001 debe usar formato PER0001."
  );
  expect(data.errores).toContain(
    "Persona OP001 está duplicada en el Excel."
  );
});

test("calcula el siguiente codigo PER disponible", () => {
  expect(
    siguienteCodigoPersona([
      { codigo: "PER0002" },
      { codigo: "PER0010" },
      { codigo: "OP001" }
    ])
  ).toBe("PER0011");
});
