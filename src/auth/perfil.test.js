import {
  crearPerfilAutenticado,
  validarPerfilAutenticado
} from "./perfil";

test("crea un perfil con claims de empresa, planta y rol", () => {
  const perfil = crearPerfilAutenticado(
    {
      uid: "u-1",
      displayName: "Supervisor Chile",
      email: "supervisor@bba.cl"
    },
    {
      rol: "supervisor",
      empresa_id: "bba",
      planta_ids: ["chile"]
    }
  );

  expect(perfil).toMatchObject({
    id: "u-1",
    nombre: "Supervisor Chile",
    rol: "supervisor",
    empresa_id: "bba",
    planta_ids: ["chile"],
    autenticado: true
  });
  expect(validarPerfilAutenticado(perfil)).toBe("");
});

test("rechaza perfiles sin alcance de seguridad", () => {
  const perfil = crearPerfilAutenticado(
    {
      uid: "u-2",
      email: "usuario@bba.com"
    },
    {
      rol: "supervisor",
      empresa_id: "bba"
    }
  );

  expect(validarPerfilAutenticado(perfil)).toBe(
    "El usuario no tiene una planta asignada."
  );
});

test("gerencia puede tener alcance global sin planta", () => {
  const perfil = crearPerfilAutenticado(
    {
      uid: "u-3",
      email: "gerencia@bba.com"
    },
    {
      rol: "gerencia",
      empresa_id: "bba"
    }
  );

  expect(validarPerfilAutenticado(perfil)).toBe("");
});

