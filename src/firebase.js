import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey:
    process.env.REACT_APP_FIREBASE_API_KEY ||
    "AIzaSyCyiF21dtbrFjdu8H-w5df0Ul87upa2vaY",
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
    "bba-produccion.firebaseapp.com",
  projectId:
    process.env.REACT_APP_FIREBASE_PROJECT_ID ||
    "bba-produccion",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(
  app,
  "southamerica-west1"
);
