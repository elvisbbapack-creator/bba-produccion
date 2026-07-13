import {
  TIPOS_TERCERO,
  normalizarCodigoTercero,
  prepararTercero,
  validarTercero
} from "./tercerosRepository";

test("normaliza codigo de tercero", () => {
  expect(
    normalizarCodigoTercero(" cli 001 ")
  ).toBe("CLI001");
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

