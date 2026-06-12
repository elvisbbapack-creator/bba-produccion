export const materialesPcl0001 = [
  {
    id: "mp-tubo-15",
    codigo: "MP0001",
    tipo: "MP",
    nombre: "Tubo 15x15x1 mm",
    unidad_medida: "unidad",
    es_comprado: true
  },
  {
    id: "rf-lateral-290-cortado",
    codigo: "RF0001",
    tipo: "RF",
    nombre: "Tubo lateral 290 cortado",
    unidad_medida: "unidad",
    es_comprado: false
  },
  {
    id: "rf-lateral-290-perforado",
    codigo: "RF0002",
    tipo: "RF",
    nombre: "Tubo lateral 290 perforado",
    unidad_medida: "unidad",
    es_comprado: false
  }
];

export const rutaPcl0001 = {
  id: "ruta-pcl0001-v1",
  producto_id: "pcl0001",
  version: 1,
  estado: "publicada",
  operaciones: [
    {
      id: "ruta-op-dt0001",
      secuencia: 10,
      operacion_id: "op-dt0001",
      operacion_codigo: "DT0001",
      operacion_nombre: "Corte lateral 290",
      proceso_id: "pr0001",
      proceso_nombre: "Corte",
      subproceso_id: "sp0001",
      subproceso_nombre: "Tubo en prensa",
      material_entrada_id: "mp-tubo-15",
      material_salida_id:
        "rf-lateral-290-cortado",
      medida: "290",
      unidades_por_producto: 4,
      unidades_por_hora: 120,
      dependencias: []
    },
    {
      id: "ruta-op-dt0005",
      secuencia: 20,
      operacion_id: "op-dt0005",
      operacion_codigo: "DT0005",
      operacion_nombre: "Perforacion 4 hoyos",
      proceso_id: "pr0001",
      proceso_nombre: "Corte",
      subproceso_id: "sp0003",
      subproceso_nombre:
        "Corte laser fibra tubo",
      material_entrada_id:
        "rf-lateral-290-cortado",
      material_salida_id:
        "rf-lateral-290-perforado",
      medida: "290",
      unidades_por_producto: 4,
      unidades_por_hora: 80,
      dependencias: [
        {
          ruta_operacion_id:
            "ruta-op-dt0001",
          porcentaje_minimo_avance: 20,
          requiere_material_disponible: true
        }
      ]
    }
  ]
};

