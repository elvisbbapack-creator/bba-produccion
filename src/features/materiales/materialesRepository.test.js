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
        es_comprado: true
      },
      "bba",
      "material-1"
    )
  ).toEqual({
    id: "material-1",
    empresa_id: "bba",
    codigo: "MP0001",
    tipo: TIPOS_MATERIAL.MATERIA_PRIMA,
    nombre: "Tubo 15x15",
    unidad_medida: "metro",
    es_comprado: true,
    activo: true
  });
});

test("RF nunca queda marcado como comprado", () => {
  const material = prepararMaterial(
    {
      codigo: "RF0001",
      tipo: TIPOS_MATERIAL.RECURSO_FABRICACION,
      nombre: "Tubo cortado",
      unidad_medida: "unidad",
      es_comprado: true
    },
    "bba",
    "material-2"
  );

  expect(material.es_comprado).toBe(false);
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
