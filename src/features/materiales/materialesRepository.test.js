import { TIPOS_MATERIAL } from "../../domain/produccionV2";
import {
  normalizarCodigoMaterial,
  prepararMaterial,
  validarNuevoMaterial
} from "./materialesRepository";

test("normaliza el codigo y los textos del material", () => {
  expect(
    normalizarCodigoMaterial(" mp 0001 ")
  ).toBe("MP0001");

  expect(
    prepararMaterial(
      {
        codigo: "mp0001",
        tipo: TIPOS_MATERIAL.MATERIA_PRIMA,
        nombre: " Tubo 15x15 ",
        unidad_medida: " metro ",
        es_comprado: true,
        costo_unitario_referencial: "1250.5",
        moneda: "CLP",
        minimo_compra: "6",
        proveedor_preferente_id: "prov-1",
        proveedor_preferente_codigo: "PRV001",
        proveedor_preferente_nombre: "Acero Centro"
      },
      "bba",
      "material-1"
    )
  ).toEqual({
    id: "material-1",
    empresa_id: "bba",
    codigo: "MP0001",
    tipo: TIPOS_MATERIAL.MATERIA_PRIMA,
    producto_id: "",
    producto_codigo: "",
    producto_nombre: "",
    productos_asociados: [],
    nombre: "Tubo 15x15",
    unidad_medida: "metro",
    costo_unitario_referencial: 1250.5,
    moneda: "CLP",
    minimo_compra: 6,
    proveedor_preferente_id: "prov-1",
    proveedor_preferente_codigo: "PRV001",
    proveedor_preferente_nombre: "Acero Centro",
    costo_origen: "catalogo_material",
    es_comprado: true,
    activo: true
  });
});

test("RF nunca queda marcado como comprado", () => {
  const material = prepararMaterial(
    {
      codigo: "RF0001",
      tipo: TIPOS_MATERIAL.RECURSO_FABRICACION,
      producto_id: "producto-1",
      producto_codigo: "pcl0001",
      producto_nombre: "Modular",
      productos_asociados: [{
        producto_id: "producto-2",
        producto_codigo: "PCL0002",
        producto_nombre: "Display alternativo"
      }],
      nombre: "Tubo cortado",
      unidad_medida: "unidad",
      es_comprado: true
    },
    "bba",
    "material-2"
  );

  expect(material.es_comprado).toBe(false);
  expect(material.producto_id).toBe("producto-1");
  expect(material.producto_codigo).toBe("PCL0001");
  expect(material.productos_asociados).toEqual([
    {
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular"
    },
    {
      producto_id: "producto-2",
      producto_codigo: "PCL0002",
      producto_nombre: "Display alternativo"
    }
  ]);
  expect(validarNuevoMaterial(material)).toEqual([]);
});

test("permite crear suministros productivos comprados", () => {
  const material = prepararMaterial(
    {
      codigo: "SUM0001",
      tipo: TIPOS_MATERIAL.SUMINISTRO,
      nombre: "Tinta UV C",
      unidad_medida: "ml",
      es_comprado: true
    },
    "bba",
    "material-sum"
  );

  expect(material.tipo).toBe("SUM");
  expect(material.es_comprado).toBe(true);
  expect(validarNuevoMaterial(material)).toEqual([]);
});

test("rechaza codigos duplicados", () => {
  const material = prepararMaterial(
    {
      codigo: "MP0001",
      tipo: TIPOS_MATERIAL.MATERIA_PRIMA,
      nombre: "Tubo",
      unidad_medida: "metro"
    },
    "bba",
    "material-2"
  );

  expect(
    validarNuevoMaterial(material, [
      {
        id: "material-1",
        codigo: "MP0001"
      }
    ])
  ).toContain("El codigo MP0001 ya existe.");
});

test("permite editar el mismo material sin marcarlo duplicado", () => {
  const material = prepararMaterial(
    {
      codigo: "MP0001",
      tipo: TIPOS_MATERIAL.MATERIA_PRIMA,
      nombre: "Tubo corregido",
      unidad_medida: "metro"
    },
    "bba",
    "material-1"
  );

  expect(
    validarNuevoMaterial(material, [
      {
        id: "material-1",
        codigo: "MP0001"
      }
    ])
  ).toEqual([]);
});
