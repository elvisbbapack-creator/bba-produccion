import * as XLSX from "xlsx";
import {
  crearFilaPepsico,
  crearFilasPepsico,
  crearLibroPepsico,
  obtenerMonedaPais
} from "./pepsicoExport";

const cotizacionBase = {
  id: "cot-1",
  nombre_producto: "Básico 7N100",
  datos_pepsico: {
    pais: "Chile",
    link_planos: "https://example.com/planos",
    graficos_laterales: "SI",
    produccion_minima_semanal: 2000,
    concepto_adicional: 5,
    concepto_adicional_aplicacion: "exw",
    concepto_adicional_descripcion: "Control de calidad"
  },
  materiales: [
    { codigo: "MP1", nombre: "Alambre", categoria_pepsico: "alambre" },
    { codigo: "SUM1", nombre: "Pintura", categoria_pepsico: "pintura" },
    { codigo: "SUM2", nombre: "Caja", categoria_pepsico: "empaque" }
  ],
  resultados: [
    {
      cantidad: 100,
      costo_materiales: 6500,
      costo_procesos: 2000,
      costo_operativo: 500,
      costo_indirecto: 300,
      costo_riesgo: 200,
      utilidad: 3000,
      detalle_materiales: [
        { costo_material: 4000 },
        { costo_material: 1500 },
        { costo_material: 1000 }
      ],
      lead_time_flujo_dias: 12
    }
  ]
};

test("arma una fila PepsiCo por cantidad y reconcilia EXW", () => {
  const fila = crearFilaPepsico({
    cotizacion: cotizacionBase,
    resultado: cotizacionBase.resultados[0]
  });

  expect(fila).toMatchObject({
    pais: "Chile",
    moneda: "CLP",
    cantidad: 100,
    total_mp: 55,
    total_accesorios: 10,
    mano_obra: 20,
    gastos_produccion: 15,
    total_produccion: 35,
    utilidad: 30,
    exw: 130,
    cuadra_exw: true,
    pendientes: []
  });
  expect(fila.porcentajes.total).toBe(1);
});

test("usa USD fuera de Chile y ordena país, producto y cantidad", () => {
  const exportacion = {
    ...cotizacionBase,
    id: "cot-2",
    nombre_producto: "Modelo B",
    datos_pepsico: {
      ...cotizacionBase.datos_pepsico,
      pais: "Argentina"
    },
    resultados: [
      { ...cotizacionBase.resultados[0], cantidad: 200 },
      { ...cotizacionBase.resultados[0], cantidad: 50 }
    ]
  };
  const filas = crearFilasPepsico([exportacion, cotizacionBase]);

  expect(obtenerMonedaPais("Chile")).toBe("CLP");
  expect(obtenerMonedaPais("Uruguay")).toBe("USD");
  expect(filas.map(fila => `${fila.pais}-${fila.cantidad}`)).toEqual([
    "Chile-100",
    "Argentina-50",
    "Argentina-200"
  ]);
});

test("genera las formulas principales del Excel", () => {
  const fila = crearFilaPepsico({
    cotizacion: cotizacionBase,
    resultado: cotizacionBase.resultados[0]
  });
  const libro = crearLibroPepsico([fila]);
  const hoja = libro.Sheets["Costos PepsiCo"];

  expect(hoja.O2.f).toBe("SUM(F2:N2)");
  expect(hoja.V2.f).toBe("SUM(P2:U2)");
  expect(hoja.AA2.f).toBe("O2+V2+Y2+Z2");
  expect(hoja.AQ2.f).toBe(
    'IF(AA2=0,"",SUM(AL2:AP2))'
  );

  const bytes = XLSX.write(libro, {
    type: "array",
    bookType: "xlsx"
  });
  expect(bytes.byteLength).toBeGreaterThan(1000);
});

test("marca materiales con costo sin categoría", () => {
  const cotizacion = {
    ...cotizacionBase,
    materiales: [
      { codigo: "MPX", nombre: "Material especial" }
    ],
    resultados: [{
      ...cotizacionBase.resultados[0],
      detalle_materiales: [{ costo_material: 1000 }]
    }]
  };
  const fila = crearFilaPepsico({
    cotizacion,
    resultado: cotizacion.resultados[0]
  });

  expect(fila.pendientes).toEqual([
    "MPX - Material especial"
  ]);
});
