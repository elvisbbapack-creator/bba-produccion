import {
  calcularJornadaSemanal,
  lunesDeSemana,
  validarProgramacionTurno
} from "./turnosRepository";

test("calcula horas extra del turno noche en Chile", () => {
  expect(
    calcularJornadaSemanal("chile", "noche")
  ).toEqual({
    horas_efectivas: 51.75,
    horas_ordinarias: 42,
    horas_extra: 9.75
  });
  expect(
    calcularJornadaSemanal("peru", "noche")
  ).toEqual({
    horas_efectivas: 48,
    horas_ordinarias: 48,
    horas_extra: 0
  });
});

test("normaliza cualquier fecha al lunes de su semana", () => {
  expect(
    lunesDeSemana(
      new Date("2026-06-13T12:00:00")
    )
  ).toBe("2026-06-08");
});

test("valida los datos obligatorios de programación", () => {
  expect(
    validarProgramacionTurno({
      plantaId: "chile",
      semanaInicio: "2026-06-08",
      operarioCodigo: "OP0001",
      operarioNombre: "Ana",
      turnoId: "manana"
    })
  ).toEqual([]);
});
