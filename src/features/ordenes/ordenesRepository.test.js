import {
  formatearCodigoOT,
  prepararOrden,
  validarDatosOrden
} from "./ordenesRepository";

test("genera un correlativo legible por planta", () => {
  expect(
    formatearCodigoOT("chile", 12)
  ).toBe("OT-CHI-000012");
  expect(
    formatearCodigoOT("peru", 3)
  ).toBe("OT-PER-000003");
});

test("prepara una OT V2 liberada", () => {
  const orden = prepararOrden({
    codigo: "OT-CHI-000001",
    correlativo: 1,
    empresaId: "bba",
    plantaId: "chile",
    clienteNombre: "Cliente Demo",
    producto: {
      id: "producto-1",
      codigo: "PCL0001",
      nombre: "Modular",
      version_ruta_activa: 1
    },
    cantidadProducto: "100",
    fechaInicio: "2026-06-15",
    fechaEntrega: "2026-06-20",
    perfil: {
      uid: "usuario-1",
      nombre: "Jefe Chile"
    }
  });

  expect(orden).toMatchObject({
    codigo: "OT-CHI-000001",
    planta_id: "chile",
    producto_codigo: "PCL0001",
    ruta_version: 1,
    cantidad_producto: 100,
    estado: "liberada",
    modelo_version: 2
  });
});

test("valida producto publicado, cantidad y fechas", () => {
  expect(
    validarDatosOrden({
      plantaId: "",
      clienteNombre: "",
      producto: {
        version_ruta_activa: null
      },
      cantidadProducto: 0,
      fechaInicio: "2026-06-20",
      fechaEntrega: "2026-06-15"
    })
  ).toEqual([
    "Selecciona una planta.",
    "La OT requiere cliente.",
    "Selecciona un producto con ruta publicada.",
    "La cantidad debe ser mayor que cero.",
    "La fecha de entrega no puede ser anterior al inicio."
  ]);
});
