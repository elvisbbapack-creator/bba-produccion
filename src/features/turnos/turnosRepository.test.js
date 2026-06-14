import {
  calcularCoberturaSubproceso,
  calcularJornadaSemanal,
  construirMatrizCobertura,
  datosTurnoParaSesion,
  lunesDeSemana,
  normalizarSubprocesosHabilitados,
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

test("construye la matriz de cobertura por subproceso", () => {
  const matriz = construirMatrizCobertura(
    [
      {
        subproceso_id: "SP0001",
        subproceso_nombre: "Prensa"
      },
      {
        subproceso_id: "SP0003",
        subproceso_nombre: "Láser"
      }
    ],
    [
      {
        turno_id: "manana",
        subprocesos_habilitados: [
          "SP0001",
          "SP0003"
        ]
      },
      {
        turno_id: "tarde",
        subprocesos_habilitados: ["SP0001"]
      }
    ]
  );

  expect(matriz[0]).toMatchObject({
    subproceso_id: "SP0001",
    manana: 1,
    tarde: 1,
    noche: 0,
    turnos_base_completos: true
  });
  expect(matriz[1]).toMatchObject({
    subproceso_id: "SP0003",
    manana: 1,
    tarde: 0,
    noche: 0,
    turnos_base_completos: false
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
      turnoId: "manana",
      subprocesosHabilitados: ["SP0001"]
    })
  ).toEqual([]);
});

test("normaliza competencias y calcula cobertura conservadora", () => {
  expect(
    normalizarSubprocesosHabilitados(
      " sp0003, SP0001, sp0003 "
    )
  ).toEqual(["SP0001", "SP0003"]);

  expect(
    calcularCoberturaSubproceso(
      [
        {
          turno_id: "manana",
          subprocesos_habilitados: ["SP0003"]
        },
        {
          turno_id: "manana",
          subprocesos_habilitados: ["SP0003"]
        },
        {
          turno_id: "tarde",
          subprocesos_habilitados: ["SP0003"]
        },
        {
          turno_id: "noche",
          subprocesos_habilitados: ["SP0003"]
        }
      ],
      "sp0003"
    )
  ).toEqual({
    manana: 2,
    tarde: 1,
    noche: 1,
    turnos_base_completos: true,
    operarios_base_conservadores: 1,
    tercer_turno_disponible: true
  });
});

test("congela la programación dentro de la sesión", () => {
  expect(
    datosTurnoParaSesion({
      id: "programacion-1",
      turno_id: "noche",
      turno_nombre: "Noche",
      semana_inicio: "2026-06-08",
      horas_ordinarias: 42,
      horas_extra: 9.75
    })
  ).toEqual({
    turno_id: "noche",
    turno_nombre: "Noche",
    semana_programada: "2026-06-08",
    programacion_turno_id: "programacion-1",
    sesion_programada: true,
    horas_ordinarias_programadas: 42,
    horas_extra_programadas: 9.75
  });

  expect(
    datosTurnoParaSesion()
      .sesion_programada
  ).toBe(false);
});
