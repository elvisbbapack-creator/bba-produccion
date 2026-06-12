import {
  convertirFecha,
  fechaParaInput,
  formatearFecha,
  normalizarDocumento,
  normalizarEstandar,
  normalizarOrdenTrabajo
} from "./compatibilidad";

test("conserva el ID y normaliza la fecha heredada de una OT", () => {
  const fecha = {
    toDate: () => new Date("2026-06-12T00:00:00Z")
  };

  const ot = normalizarOrdenTrabajo("ot-1", {
    nombre: "OT-001",
    fecha_de_entrega: fecha
  });

  expect(ot.id).toBe("ot-1");
  expect(ot.fecha_entrega).toBe(fecha);
  expect(ot.fecha_de_entrega).toBe(fecha);
});

test("prioriza el nombre actual de fecha de entrega", () => {
  const ot = normalizarOrdenTrabajo("ot-2", {
    fecha_entrega: "2026-07-01",
    fecha_de_entrega: "2026-06-30"
  });

  expect(ot.fecha_entrega).toBe("2026-07-01");
});

test("normaliza ambos nombres del estandar de unidades por hora", () => {
  const anterior = normalizarEstandar("e-1", {
    unidades_hora: "125"
  });
  const actual = normalizarEstandar("e-2", {
    unidades_por_hora: 80
  });

  expect(anterior.unidades_por_hora).toBe(125);
  expect(anterior.unidades_hora).toBe(125);
  expect(actual.unidades_por_hora).toBe(80);
  expect(actual.unidades_hora).toBe(80);
});

test("conserva el ID en documentos de configuracion", () => {
  expect(
    normalizarDocumento("producto-1", {
      id: "id-interno-incorrecto",
      nombre: "Mod 2N60 CL"
    })
  ).toEqual({
    id: "producto-1",
    nombre: "Mod 2N60 CL"
  });
});

test("formatea fechas Firestore, texto invalido y valores vacios", () => {
  expect(
    formatearFecha({
      toDate: () => new Date(2026, 5, 12)
    })
  ).toBe(new Date(2026, 5, 12).toLocaleDateString());
  expect(formatearFecha("sin-fecha")).toBe("sin-fecha");
  expect(formatearFecha(null)).toBe("-");
});

test("convierte fechas sin desplazar el dia por zona horaria", () => {
  const fecha = convertirFecha("2026-07-01");

  expect(fecha.getFullYear()).toBe(2026);
  expect(fecha.getMonth()).toBe(6);
  expect(fecha.getDate()).toBe(1);
  expect(fechaParaInput(fecha)).toBe("2026-07-01");
});

test("convierte un Timestamp heredado al formato de input", () => {
  expect(
    fechaParaInput({
      toDate: () => new Date(2026, 5, 12)
    })
  ).toBe("2026-06-12");
});
