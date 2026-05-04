import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyiF21dtbrFjdu8H-w5df0Ul87upa2vaY",
  authDomain: "bba-produccion.firebaseapp.com",
  projectId: "bba-produccion",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);