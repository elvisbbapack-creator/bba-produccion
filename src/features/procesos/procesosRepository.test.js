import {
  aCatalogoProcesosRuta,
  prepararProceso,
  validarProceso
} from "./procesosRepository";

test("prepara y valida proceso con estaciones", () => {
  const proceso = prepararProceso(
    {
      codigo: " pr0001 ",
      nombre: " Corte ",
      estaciones: [
        {
          codigo: " et0001 ",
          nombre: " Laser fibra tubo "
        }
      ]
    },
    "bba",
    "bba__PR0001"
  );

  expect(proceso).toEqual({
    id: "bba__PR0001",
    empresa_id: "bba",
    codigo: "PR0001",
    nombre: "Corte",
    estaciones: [{
      codigo: "ET0001",
      nombre: "Laser fibra tubo",
      activo: true
    }],
    activo: true
  });
  expect(validarProceso(proceso)).toEqual([]);
});

test("rechaza estaciones sin codigo ET o repetidas", () => {
  const proceso = prepararProceso(
    {
      codigo: "PR0001",
      nombre: "Corte",
      estaciones: [
        { codigo: "SP0001", nombre: "Viejo" },
        { codigo: "ET0002", nombre: "Prensa" },
        { codigo: "ET0002", nombre: "Prensa 2" }
      ]
    },
    "bba",
    "bba__PR0001"
  );

  expect(validarProceso(proceso)).toEqual([
    "La estación 1 debe usar el formato ET0001.",
    "La estación ET0002 está repetida."
  ]);
});

test("convierte procesos a referencias para rutas", () => {
  expect(
    aCatalogoProcesosRuta([
      {
        codigo: "PR0001",
        nombre: "Corte",
        activo: true,
        estaciones: [{
          codigo: "ET0001",
          nombre: "Laser fibra tubo",
          activo: true
        }]
      }
    ])
  ).toEqual([{
    proceso_codigo: "PR0001",
    proceso_nombre: "Corte",
    estacion_codigo: "ET0001",
    estacion_nombre: "Laser fibra tubo"
  }]);
});
