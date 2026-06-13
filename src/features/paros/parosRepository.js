import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";

const limpiarTexto = (valor) =>
  (valor || "").toString().trim();

export const normalizarCodigoParo = (valor) =>
  limpiarTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");

export const prepararMotivoParo = (
  datos,
  empresaId
) => ({
  empresa_id: empresaId,
  codigo: normalizarCodigoParo(datos.codigo),
  nombre: limpiarTexto(datos.nombre),
  categoria: datos.categoria || "operacional",
  afecta_eficiencia:
    datos.afecta_eficiencia !== false,
  activo: datos.activo !== false
});

export const validarMotivoParo = (
  motivo,
  existentes = []
) => {
  const errores = [];

  if (!/^PAR\d{4,}$/.test(motivo.codigo)) {
    errores.push(
      "El código debe usar el formato PAR0001."
    );
  }

  if (!motivo.nombre) {
    errores.push("El nombre es obligatorio.");
  }

  if (
    existentes.some(
      item => item.codigo === motivo.codigo
    )
  ) {
    errores.push(
      `El código ${motivo.codigo} ya existe.`
    );
  }

  return errores;
};

export const listarMotivosParo = async (
  db,
  empresaId
) => {
  const snapshot = await getDocs(
    query(
      collection(db, "catalogo_motivos_paro"),
      where("empresa_id", "==", empresaId)
    )
  );

  return snapshot.docs
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .sort((a, b) =>
      (a.codigo || "").localeCompare(
        b.codigo || ""
      )
    );
};

export const crearMotivoParo = async (
  db,
  empresaId,
  datos
) => {
  const motivo = prepararMotivoParo(
    datos,
    empresaId
  );
  const existentes = await listarMotivosParo(
    db,
    empresaId
  );
  const errores = validarMotivoParo(
    motivo,
    existentes
  );

  if (errores.length > 0) {
    throw new Error(errores.join(" "));
  }

  const referencia = doc(
    db,
    "catalogo_motivos_paro",
    `${empresaId}__${motivo.codigo}`
  );

  await setDoc(referencia, {
    ...motivo,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp()
  });

  return {
    id: referencia.id,
    ...motivo
  };
};
