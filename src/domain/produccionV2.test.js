import {
  calcularDisponibilidadRF,
  congelarRutaParaOT,
  dependenciasCumplidas,
  registrarResultadoOperacion,
  validarMaterial,
  validarRuta
} from "./produccionV2";
import {
  materialesPcl0001,
  rutaPcl0001
} from "./fixtures/pcl0001";

test("valida materiales MP, RF y SUM con codigos estables", () => {
  expect(
    materialesPcl0001.flatMap(validarMaterial)
  ).toEqual([]);

  expect(
    validarMaterial({
      id: "suministro",
      codigo: "SUM0001",
      tipo: "SUM",
      nombre: "Tinta UV C",
      unidad_medida: "ml"
    })
  ).toEqual([]);

  expect(
    validarMaterial({
      id: "material-invalido",
      codigo: "MP1",
      tipo: "MP",
      nombre: "Tubo",
      unidad_medida: "unidad"
    })
  ).toContain(
    "El codigo debe comenzar con MP y usar un correlativo."
  );
});

test("valida la ruta PCL0001 sin errores", () => {
  expect(
    validarRuta(
      rutaPcl0001,
      materialesPcl0001
    )
  ).toEqual([]);
});

test("permite una ruta nueva con estándar pendiente", () => {
  expect(
    validarRuta(
      {
        ...rutaPcl0001,
        operaciones:
          rutaPcl0001.operaciones.map(
            (operacion, indice) => ({
              ...operacion,
              unidades_por_hora:
                indice === 0 ? 0 : 80
            })
          )
      },
      materialesPcl0001
    )
  ).toEqual([]);
});

test("congela la ruta y calcula 400 unidades para una OT de 100", () => {
  const operaciones = congelarRutaParaOT({
    ruta: rutaPcl0001,
    materiales: materialesPcl0001,
    cantidadProducto: 100
  });

  expect(operaciones).toHaveLength(2);
  expect(operaciones[0]).toMatchObject({
    operacion_codigo: "DT0001",
    cantidad_requerida: 400,
    cantidad_pendiente: 400,
    estado: "disponible",
    modelo_version: 2
  });
  expect(operaciones[1]).toMatchObject({
    operacion_codigo: "DT0005",
    cantidad_requerida: 400,
    estado: "pendiente",
    material_entrada_codigo: "RF0001"
  });
});

test("calcula RF disponible descontando consumo y descarte", () => {
  expect(
    calcularDisponibilidadRF({
      cantidadProducidaOk: 120,
      cantidadConsumida: 75,
      cantidadDescartada: 5
    })
  ).toBe(40);
});

test("actualiza avance, calidad y pendiente de una operacion", () => {
  const [corte] = congelarRutaParaOT({
    ruta: rutaPcl0001,
    materiales: materialesPcl0001,
    cantidadProducto: 100
  });

  const parcial = registrarResultadoOperacion(
    corte,
    {
      cantidadOk: 100,
      cantidadDefectuosa: 8,
      cantidadReproceso: 3
    }
  );

  expect(parcial).toMatchObject({
    cantidad_ok: 100,
    cantidad_defectuosa: 8,
    cantidad_reproceso: 3,
    cantidad_pendiente: 300,
    avance_pct: 25,
    estado: "en_proceso"
  });

  const completada =
    registrarResultadoOperacion(
      parcial,
      { cantidadOk: 320 }
    );

  expect(completada).toMatchObject({
    cantidad_ok: 420,
    cantidad_pendiente: 0,
    avance_pct: 100,
    estado: "completada"
  });
});

test("habilita una operacion con avance parcial y RF disponible", () => {
  const operaciones = congelarRutaParaOT({
    ruta: rutaPcl0001,
    materiales: materialesPcl0001,
    cantidadProducto: 100
  });
  const corte = {
    ...operaciones[0],
    avance_pct: 25
  };
  const perforacion = operaciones[1];

  expect(
    dependenciasCumplidas(
      perforacion,
      {
        [corte.ruta_operacion_id]: corte
      },
      {
        [perforacion.material_entrada_id]: 10
      }
    )
  ).toBe(true);
});

test("bloquea una operacion sin avance o sin RF disponible", () => {
  const operaciones = congelarRutaParaOT({
    ruta: rutaPcl0001,
    materiales: materialesPcl0001,
    cantidadProducto: 100
  });
  const corte = {
    ...operaciones[0],
    avance_pct: 10
  };
  const perforacion = operaciones[1];
  const operacionesPorId = {
    [corte.ruta_operacion_id]: corte
  };

  expect(
    dependenciasCumplidas(
      perforacion,
      operacionesPorId,
      {
        [perforacion.material_entrada_id]: 10
      }
    )
  ).toBe(false);

  corte.avance_pct = 25;

  expect(
    dependenciasCumplidas(
      perforacion,
      operacionesPorId,
      {}
    )
  ).toBe(false);
});

test("rechaza rutas con dependencias ciclicas", () => {
  const rutaInvalida = {
    ...rutaPcl0001,
    operaciones: rutaPcl0001.operaciones.map(
      operacion => ({
        ...operacion,
        dependencias:
          operacion.id === "ruta-op-dt0001"
            ? [{
                ruta_operacion_id:
                  "ruta-op-dt0005",
                porcentaje_minimo_avance: 10
              }]
            : operacion.dependencias
      })
    )
  };

  expect(
    validarRuta(
      rutaInvalida,
      materialesPcl0001
    )
  ).toContain(
    "La ruta contiene dependencias ciclicas."
  );
});

test("exige dependencia explicita del productor de un RF", () => {
  const rutaSinDependencia = {
    ...rutaPcl0001,
    operaciones: rutaPcl0001.operaciones.map(
      operacion =>
        operacion.id === "ruta-op-dt0005"
          ? {
              ...operacion,
              dependencias: []
            }
          : operacion
    )
  };

  expect(
    validarRuta(
      rutaSinDependencia,
      materialesPcl0001
    )
  ).toContain(
    "La operacion DT0005 debe depender de quien produce RF0001."
  );
});
