import {
  obtenerTipoCambioClpUsdActual
} from "./tipoCambio";

test("obtiene el dólar observado desde la fuente externa", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      serie: [
        {
          valor: 914.193,
          fecha: "2026-08-19T04:00:00.000Z"
        }
      ]
    })
  });

  await expect(
    obtenerTipoCambioClpUsdActual({ fetchImpl })
  ).resolves.toEqual({
    valor: 914.19,
    fecha: "2026-08-19T04:00:00.000Z",
    fuente: "mindicador.cl / dólar observado"
  });
});

test("rechaza respuestas sin valor válido", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ serie: [] })
  });

  await expect(
    obtenerTipoCambioClpUsdActual({ fetchImpl })
  ).rejects.toThrow(
    "La fuente no entregó un tipo de cambio válido."
  );
});
