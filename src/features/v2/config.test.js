import {
  obtenerInterfazV2Activa,
  puedeAdministrarV2,
  puedeOperarV2
} from "./config";

test("activa la interfaz V2 solo con true explicito", () => {
  expect(obtenerInterfazV2Activa("true")).toBe(true);
  expect(obtenerInterfazV2Activa("TRUE")).toBe(false);
  expect(obtenerInterfazV2Activa("false")).toBe(false);
});

test("permite operación V2 al supervisor con planta", () => {
  expect(
    puedeOperarV2({
      autenticado: true,
      empresa_id: "bba",
      planta_ids: ["chile"],
      rol: "supervisor"
    })
  ).toBe(true);
  expect(
    puedeOperarV2({
      autenticado: true,
      empresa_id: "bba",
      planta_ids: [],
      rol: "supervisor"
    })
  ).toBe(false);
});

test("permite administrar V2 a jefatura y gerencia autenticadas", () => {
  const base = {
    autenticado: true,
    empresa_id: "bba"
  };

  expect(
    puedeAdministrarV2({
      ...base,
      rol: "jefe"
    })
  ).toBe(true);
  expect(
    puedeAdministrarV2({
      ...base,
      rol: "gerencia"
    })
  ).toBe(true);
  expect(
    puedeAdministrarV2({
      ...base,
      rol: "supervisor"
    })
  ).toBe(false);
  expect(
    puedeAdministrarV2({
      rol: "jefe",
      empresa_id: "bba"
    })
  ).toBe(false);
});
