import {
  getAuth,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  doc,
  getDoc
} from "firebase/firestore";
import { app } from "../firebase";
import { db } from "../firebase";
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
  const perfilBase = crearPerfilAutenticado(
    usuario,
    token.claims
  );

  const perfilSnap = await getDoc(
    doc(db, "usuarios", usuario.uid)
  );

  const datosPerfil =
    perfilSnap.exists()
      ? perfilSnap.data()
      : {};

  const perfil = {
    ...perfilBase,
    ...datosPerfil,
    id: usuario.uid,
    uid: usuario.uid,
    email:
      datosPerfil.email ||
      perfilBase.email,
    nombre:
      datosPerfil.nombre ||
      perfilBase.nombre,
    rol:
      datosPerfil.rol ||
      perfilBase.rol,
    empresa_id:
      datosPerfil.empresa_id ||
      perfilBase.empresa_id,
    planta_ids:
      Array.isArray(datosPerfil.planta_ids)
        ? datosPerfil.planta_ids
        : perfilBase.planta_ids,
    permisos: {
      ...(perfilBase.permisos || {}),
      ...(datosPerfil.permisos || {})
    },
    autenticado: true
  };

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
