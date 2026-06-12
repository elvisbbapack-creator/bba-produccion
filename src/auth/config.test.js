import {
  MODOS_AUTENTICACION,
  obtenerModoAutenticacion
} from "./config";

test("usa modo heredado para valores no reconocidos", () => {
  expect(obtenerModoAutenticacion("otro")).toBe(
    MODOS_AUTENTICACION.LEGACY
  );
});

test("activa Firebase solo con el valor explicito", () => {
  expect(
    obtenerModoAutenticacion("firebase")
  ).toBe(MODOS_AUTENTICACION.FIREBASE);
  expect(
    obtenerModoAutenticacion("FIREBASE")
  ).toBe(MODOS_AUTENTICACION.LEGACY);
});
