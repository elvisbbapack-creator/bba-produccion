import { TIPOS_MATERIAL } from "../../domain/produccionV2";
import {
  normalizarCodigoMaterial,
  prepararMaterial,
  siguienteCodigoMaterial,
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
    subproducto_id: "",
    subproducto_codigo: "",
    subproducto_nombre: "",
    subproductos_asociados: [],
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
      subproducto_id: "sub-1",
      subproducto_codigo: "sub0001",
      subproducto_nombre: "Lateral",
      subproductos_asociados: [{
        subproducto_id: "sub-2",
        subproducto_codigo: "SUB0002",
        subproducto_nombre: "Bandeja",
        producto_id: "producto-1",
        producto_codigo: "PCL0001",
        producto_nombre: "Modular"
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
  expect(material.subproducto_id).toBe("sub-1");
  expect(material.subproducto_codigo).toBe("SUB0001");
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
  expect(material.subproductos_asociados).toEqual([
    {
      subproducto_id: "sub-1",
      subproducto_codigo: "SUB0001",
      subproducto_nombre: "Lateral",
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular"
    },
    {
      subproducto_id: "sub-2",
      subproducto_codigo: "SUB0002",
      subproducto_nombre: "Bandeja",
      producto_id: "producto-1",
      producto_codigo: "PCL0001",
      producto_nombre: "Modular"
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

test("calcula el siguiente código disponible por tipo", () => {
  const materiales = [
    { codigo: "MP0001" },
    { codigo: "MP0003" },
    { codigo: "RF0001" },
    { codigo: "SUM0001" },
    { codigo: "SUM0002" }
  ];

  expect(
    siguienteCodigoMaterial("MP", materiales)
  ).toBe("MP0002");
  expect(
    siguienteCodigoMaterial("RF", materiales)
  ).toBe("RF0002");
  expect(
    siguienteCodigoMaterial("SUM", materiales)
  ).toBe("SUM0003");
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
