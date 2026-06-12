export const MODOS_AUTENTICACION = {
  LEGACY: "legacy",
  FIREBASE: "firebase"
};

export const obtenerModoAutenticacion = (
  valor = process.env.REACT_APP_AUTH_MODE
) => {
  return valor === MODOS_AUTENTICACION.FIREBASE
    ? MODOS_AUTENTICACION.FIREBASE
    : MODOS_AUTENTICACION.LEGACY;
};

export const modoAutenticacion =
  obtenerModoAutenticacion();

export const autenticacionFirebaseActiva =
  modoAutenticacion ===
  MODOS_AUTENTICACION.FIREBASE;

