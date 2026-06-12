import {
  getAuth,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { app } from "../firebase";
import {
  crearPerfilAutenticado,
  validarPerfilAutenticado
} from "./perfil";

const auth = getAuth(app);

export const iniciarSesion = async (
  email,
  password
) => {
  return signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
};

export const cerrarSesion = () =>
  signOut(auth);

export const obtenerPerfilFirebase = async (
  usuario
) => {
  const token = await getIdTokenResult(
    usuario,
    true
  );
  const perfil = crearPerfilAutenticado(
    usuario,
    token.claims
  );
  const error = validarPerfilAutenticado(perfil);

  if (error) {
    throw new Error(error);
  }

  return perfil;
};

export const observarSesion = (
  alCambiar,
  alFallar
) => {
  return onAuthStateChanged(
    auth,
    alCambiar,
    alFallar
  );
};

export const mensajeErrorAutenticacion = (
  error
) => {
  const codigo = error?.code || "";

  if (
    codigo === "auth/invalid-credential" ||
    codigo === "auth/wrong-password" ||
    codigo === "auth/user-not-found"
  ) {
    return "Correo o contraseña incorrectos.";
  }

  if (codigo === "auth/too-many-requests") {
    return "Demasiados intentos. Espera unos minutos.";
  }

  if (codigo === "auth/network-request-failed") {
    return "No se pudo conectar con Firebase.";
  }

  return error?.message ||
    "No se pudo iniciar sesión.";
};
