export const crearPerfilAutenticado = (
  usuario,
  claims = {}
) => {
  if (!usuario) {
    return null;
  }

  return {
    id: usuario.uid,
    uid: usuario.uid,
    nombre:
      usuario.displayName ||
      usuario.email ||
      "Usuario BBA",
    email: usuario.email || "",
    rol: claims.rol || "",
    empresa_id: claims.empresa_id || "",
    planta_ids: Array.isArray(claims.planta_ids)
      ? claims.planta_ids
      : [],
    permisos: claims.permisos || {},
    autenticado: true
  };
};

export const validarPerfilAutenticado = (perfil) => {
  if (perfil?.activo === false) {
    return "El usuario está inactivo.";
  }

  if (!perfil?.rol) {
    return "El usuario no tiene un rol asignado.";
  }

  if (!perfil.empresa_id) {
    return "El usuario no tiene una empresa asignada.";
  }

  if (
    perfil.rol !== "gerencia" &&
    perfil.planta_ids.length === 0
  ) {
    return "El usuario no tiene una planta asignada.";
  }

  return "";
};
