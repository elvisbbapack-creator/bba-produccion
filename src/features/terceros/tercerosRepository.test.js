import {
  TIPOS_TERCERO,
  normalizarCodigoTercero,
  prepararTercero,
  siguienteCodigoTercero,
  validarTercero
} from "./tercerosRepository";

test("normaliza codigo de tercero", () => {
  expect(
    normalizarCodigoTercero(" cli 001 ")
  ).toBe("CLI001");
});

test("propone siguiente codigo por tipo de tercero", () => {
  expect(
    siguienteCodigoTercero(
      [
        { codigo: "CLI001" },
        { codigo: "CLI003" },
        { codigo: "PRV001" }
      ],
      TIPOS_TERCERO.CLIENTE
    )
  ).toBe("CLI002");

  expect(
    siguienteCodigoTercero(
      [
        { codigo: "CLI001" },
        { codigo: "PRV001" },
        { codigo: "PRV002" }
      ],
      TIPOS_TERCERO.PROVEEDOR
    )
  ).toBe("PRV003");
});

test("prepara tercero con datos base", () => {
  expect(
    prepararTercero(
      {
        codigo: "prv 001",
        nombre: "Proveedor Uno",
        pais: "",
        activo: true
      },
      "bba",
      TIPOS_TERCERO.PROVEEDOR,
      "id-1"
    )
  ).toMatchObject({
    id: "id-1",
    empresa_id: "bba",
    tipo: "proveedor",
    codigo: "PRV001",
    nombre: "Proveedor Uno",
    pais: "Chile",
    activo: true
  });
});

test("valida codigo duplicado", () => {
  const tercero = prepararTercero(
    {
      codigo: "CLI001",
      nombre: "Cliente Nuevo"
    },
    "bba",
    TIPOS_TERCERO.CLIENTE,
    "nuevo"
  );

  expect(
    validarTercero(tercero, [
      {
        id: "otro",
        codigo: "CLI001"
      }
    ])
  ).toContain("El código CLI001 ya existe.");
});
