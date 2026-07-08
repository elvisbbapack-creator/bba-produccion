import {
  obtenerInterfazV2Activa,
  puedeAdministrarV2,
  puedeGestionarRRHHV2,
  puedeGestionarUsuariosV2,
  puedeOperarV2,
  puedeVerDashboardV2,
  tienePermisoV2
} from "./config";

test("activa la interfaz V2 solo con true explicito", () => {
  expect(obtenerInterfazV2Activa("true")).toBe(true);
  expect(obtenerInterfazV2Activa("TRUE")).toBe(false);
  expect(obtenerInterfazV2Activa("false")).toBe(false);
});

test("permite al rol TV ver el dashboard V2", () => {
  const perfilTv = {
    autenticado: true,
    empresa_id: "bba",
    planta_ids: ["chile"],
    rol: "tv"
  };

  expect(puedeVerDashboardV2(perfilTv)).toBe(
    true
  );
  expect(puedeOperarV2(perfilTv)).toBe(false);
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

test("habilita permisos finos desde el perfil", () => {
  const perfil = {
    autenticado: true,
    empresa_id: "bba",
    planta_ids: ["chile"],
    rol: "supervisor",
    permisos: {
      "usuarios.gestionar": true
    }
  };

  expect(
    tienePermisoV2(
      perfil,
      "usuarios.gestionar"
    )
  ).toBe(true);
  expect(
    puedeGestionarUsuariosV2(perfil)
  ).toBe(true);
});

test("gerencia puede gestionar usuarios sin permiso manual", () => {
  expect(
    puedeGestionarUsuariosV2({
      autenticado: true,
      empresa_id: "bba",
      rol: "gerencia",
      permisos: {}
    })
  ).toBe(true);
});

test("jefatura y permiso fino gestionan RRHH", () => {
  const base = {
    autenticado: true,
    empresa_id: "bba"
  };

  expect(
    puedeGestionarRRHHV2({
      ...base,
      rol: "jefe"
    })
  ).toBe(true);

  expect(
    puedeGestionarRRHHV2({
      ...base,
      rol: "supervisor",
      permisos: {
        "rrhh.gestionar": true
      }
    })
  ).toBe(true);

  expect(
    puedeGestionarRRHHV2({
      ...base,
      rol: "supervisor",
      permisos: {}
    })
  ).toBe(false);
});

test("no gestiona usuarios sin autenticacion ni empresa", () => {
  expect(
    puedeGestionarUsuariosV2({
      autenticado: false,
      empresa_id: "bba",
      rol: "gerencia"
    })
  ).toBe(false);

  expect(
    puedeGestionarUsuariosV2({
      autenticado: true,
      rol: "gerencia"
    })
  ).toBe(false);
});
