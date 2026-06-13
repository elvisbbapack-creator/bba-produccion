const ROLES_ADMINISTRACION_V2 = [
  "jefe",
  "gerencia"
];

export const obtenerInterfazV2Activa = (
  valor = process.env.REACT_APP_V2_ENABLED
) => valor === "true";

export const interfazV2Activa =
  obtenerInterfazV2Activa();

export const puedeAdministrarV2 = (perfil) =>
  Boolean(
    perfil?.autenticado &&
    perfil?.empresa_id &&
    ROLES_ADMINISTRACION_V2.includes(
      perfil?.rol
    )
  );
