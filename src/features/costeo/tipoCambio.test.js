import {
  obtenerTipoCambioClpUsdActual
} from "./tipoCambio";

test("obtiene el dólar observado desde la fuente externa", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      valor: 914.193,
      fecha: "2026-08-19T04:00:00.000Z",
      fuente: "mindicador.cl / dólar observado"
    })
  });

  await expect(
    obtenerTipoCambioClpUsdActual({
      fetchImpl,
      almacenamiento: null
    })
  ).resolves.toEqual({
    valor: 914.19,
    fecha: "2026-08-19T04:00:00.000Z",
    fuente: "mindicador.cl / dólar observado"
  });
});

test("rechaza respuestas sin valor válido", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({})
  });

  await expect(
    obtenerTipoCambioClpUsdActual({
      fetchImpl,
      almacenamiento: null
    })
  ).rejects.toThrow(
    "La fuente no entregó un tipo de cambio válido."
  );
});

test("usa el último valor válido si las fuentes no responden", async () => {
  const almacenamiento = {
    getItem: jest.fn().mockReturnValue(JSON.stringify({
      valor: 950.25,
      fecha: "2026-09-15T04:00:00.000Z",
      fuente: "dólar observado",
      guardado_en: Date.now()
    })),
    setItem: jest.fn()
  };

  await expect(
    obtenerTipoCambioClpUsdActual({
      fetchImpl: jest.fn().mockRejectedValue(
        new Error("Failed to fetch")
      ),
      almacenamiento
    })
  ).resolves.toEqual({
    valor: 950.25,
    fecha: "2026-09-15T04:00:00.000Z",
    fuente: "dólar observado · guardado localmente"
  });
});
