export const normalizarOrdenTrabajo = (id, data = {}) => {
  const fechaEntrega =
    data.fecha_entrega ?? data.fecha_de_entrega ?? "";

  return {
    ...data,
    id,
    fecha_entrega: fechaEntrega,
    fecha_de_entrega: fechaEntrega
  };
};

export const normalizarEstandar = (id, data = {}) => {
  const unidadesHora = Number(
    data.unidades_por_hora ?? data.unidades_hora ?? 0
  );

  return {
    ...data,
    id,
    unidades_por_hora: unidadesHora,
    unidades_hora: unidadesHora
  };
};

export const normalizarDocumento = (id, data = {}) => ({
  ...data,
  id
});

export const convertirFecha = (valor) => {
  if (!valor) {
    return null;
  }

  if (valor.toDate) {
    return valor.toDate();
  }

  if (valor instanceof Date) {
    return valor;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [year, month, day] =
      valor.split("-").map(Number);

    return new Date(year, month - 1, day);
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

export const fechaParaInput = (valor) => {
  if (!valor) {
    return "";
  }

  if (
    typeof valor === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return valor;
  }

  const fecha = convertirFecha(valor);

  if (!fecha) {
    return "";
  }

  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const formatearFecha = (valor) => {
  if (!valor) {
    return "-";
  }

  const fecha = convertirFecha(valor);

  return !fecha
    ? String(valor)
    : fecha.toLocaleDateString();
};
