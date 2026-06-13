import {
  calcularIndicadoresSesion,
  calcularDisponibilidadPorMaterial,
  calcularTiemposSesion,
  obtenerOperacionesDisponibles,
  validarDatosCalidadReporte,
  validarInicioSesion
} from "./ejecucionRepository";

const operaciones = [
  {
    id: "DT0001",
    ruta_operacion_id: "DT0001",
    material_entrada_id: "MP0001",
    material_salida_id: "RF0001",
    cantidad_ok: 100,
    cantidad_defectuosa: 5,
    cantidad_consumida: 105,
    cantidad_pendiente: 300,
    avance_pct: 25,
    estado: "en_proceso",
    dependencias: []
  },
  {
    id: "DT0005",
    ruta_operacion_id: "DT0005",
    material_entrada_id: "RF0001",
    material_salida_id: "RF0002",
    cantidad_ok: 0,
    cantidad_defectuosa: 0,
    cantidad_consumida: 0,
    cantidad_pendiente: 400,
    avance_pct: 0,
    estado: "pendiente",
    dependencias: [{
      ruta_operacion_id: "DT0001",
      porcentaje_minimo_avance: 20,
      requiere_material_disponible: true
    }]
  }
];

test("calcula RF disponible para el siguiente paso", () => {
  expect(
    calcularDisponibilidadPorMaterial(
      operaciones
    )
  ).toMatchObject({
    RF0001: 100,
    RF0002: 0
  });
});

test("calcula rendimiento, calidad y eficiencia con calidad", () => {
  expect(
    calcularIndicadoresSesion({
      cantidadOk: 80,
      cantidadDefectuosa: 20,
      cantidadReproceso: 0,
      unidadesPorHora: 100,
      tiempoProductivoSeg: 3600
    })
  ).toEqual({
    evaluar_eficiencia: true,
    produccion_total: 100,
    produccion_esperada: 100,
    rendimiento_pct: 100,
    calidad_pct: 80,
    eficiencia_calidad_pct: 80
  });
});

test("una medición sin estándar no calcula eficiencia", () => {
  expect(
    calcularIndicadoresSesion({
      cantidadOk: 70,
      cantidadDefectuosa: 5,
      unidadesPorHora: 0,
      tiempoProductivoSeg: 3600
    })
  ).toEqual({
    evaluar_eficiencia: false,
    produccion_total: 75,
    produccion_esperada: 0,
    rendimiento_pct: null,
    calidad_pct: 93.33,
    eficiencia_calidad_pct: null
  });
});

test("descuenta paros del tiempo productivo", () => {
  expect(
    calcularTiemposSesion({
      inicio: new Date("2026-06-13T10:00:00Z"),
      fin: new Date("2026-06-13T11:00:00Z"),
      tiempoParoSeg: 900
    })
  ).toEqual({
    tiempo_total_seg: 3600,
    tiempo_paro_seg: 900,
    tiempo_paro_descontable_seg: 900,
    tiempo_productivo_seg: 2700
  });
});

test("conserva paros planificados sin descontarlos", () => {
  expect(
    calcularTiemposSesion({
      inicio: new Date("2026-06-13T10:00:00Z"),
      fin: new Date("2026-06-13T11:00:00Z"),
      tiempoParoSeg: 900,
      tiempoParoDescontableSeg: 0
    })
  ).toEqual({
    tiempo_total_seg: 3600,
    tiempo_paro_seg: 900,
    tiempo_paro_descontable_seg: 0,
    tiempo_productivo_seg: 3600
  });
});

test("habilita operaciones por avance y RF", () => {
  expect(
    obtenerOperacionesDisponibles(operaciones)
      .map(operacion => operacion.id)
  ).toEqual(["DT0001", "DT0005"]);
});

test("exige OT, operación y operario", () => {
  expect(
    validarInicioSesion({
      orden: null,
      operacion: null,
      operarioCodigo: "",
      operarioNombre: ""
    })
  ).toHaveLength(4);
});

test("exige defecto y causa cuando hay merma o reproceso", () => {
  expect(
    validarDatosCalidadReporte({
      cantidadDefectuosa: 1,
      cantidadReproceso: 0
    })
  ).toHaveLength(2);

  expect(
    validarDatosCalidadReporte({
      cantidadDefectuosa: 0,
      cantidadReproceso: 2,
      defecto: { id: "DEF0001" },
      causa: { id: "CAU0001" }
    })
  ).toEqual([]);
});
