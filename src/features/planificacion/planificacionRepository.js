import {
  doc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  calcularProyeccionOT,
  listarOperacionesOT
} from "../ordenes/ordenesRepository";
import {
  clasificarRiesgoOT
} from "../resumenes/resumenesRepository";

const fechaAValor = valor => {
  if (!valor) {
    return null;
  }

  const fecha = typeof valor.toDate === "function"
    ? valor.toDate()
    : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

const prioridadEstadoDT = cuello => {
  if (cuello?.pendiente_estandar) {
    return 0;
  }

  if (
    ["disponible", "en_proceso"].includes(
      cuello?.estado
    )
  ) {
    return 2;
  }

  return 1;
};

const accionRecomendada = cuello => {
  if (cuello?.pendiente_estandar) {
    return "definir_estandar";
  }

  if (
    ["pendiente", "bloqueada"].includes(
      cuello?.estado
    )
  ) {
    return "desbloquear_dt";
  }

  return "producir_ahora";
};

export const compararPrioridadPlan = (
  izquierda,
  derecha
) => {
  const estado =
    prioridadEstadoDT(derecha.cuello_carga) -
    prioridadEstadoDT(izquierda.cuello_carga);

  if (estado !== 0) {
    return estado;
  }

  const riesgo =
    Number(derecha.prioridad_riesgo || 0) -
    Number(izquierda.prioridad_riesgo || 0);

  if (riesgo !== 0) {
    return riesgo;
  }

  const entregaIzquierda = fechaAValor(
    izquierda.fecha_planificada_entrega
  );
  const entregaDerecha = fechaAValor(
    derecha.fecha_planificada_entrega
  );
  const entrega = (
    entregaIzquierda?.getTime() ??
      Number.MAX_SAFE_INTEGER
  ) - (
    entregaDerecha?.getTime() ??
      Number.MAX_SAFE_INTEGER
  );

  if (entrega !== 0) {
    return entrega;
  }

  return (
    Number(derecha.correlativo || 0) -
    Number(izquierda.correlativo || 0)
  );
};

export const construirPlanPrioridades = (
  ordenes = [],
  fechaReferencia = new Date()
) => {
  const grupos = new Map();

  ordenes
    .map(orden =>
      clasificarRiesgoOT(
        orden,
        fechaReferencia
      )
    )
    .filter(orden =>
      orden.cuello_carga?.subproceso_id &&
      Number(
        orden.cuello_carga.cantidad_pendiente ||
        0
      ) > 0
    )
    .forEach(orden => {
      const subprocesoId =
        orden.cuello_carga.subproceso_id;
      const actuales =
        grupos.get(subprocesoId) || [];

      actuales.push({
        ...orden,
        accion_recomendada:
          accionRecomendada(orden.cuello_carga)
      });
      grupos.set(subprocesoId, actuales);
    });

  return [...grupos.entries()]
    .map(([subprocesoId, ordenesGrupo]) => {
      const secuencia = [...ordenesGrupo]
        .sort(compararPrioridadPlan)
        .map((orden, indice) => ({
          ...orden,
          prioridad_plan: indice + 1
        }));

      return {
        subproceso_id: subprocesoId,
        subproceso_nombre:
          secuencia[0]?.cuello_carga
            ?.subproceso_nombre || "",
        ots_compitiendo: secuencia.length,
        cantidad_total_pendiente:
          secuencia.reduce(
            (total, orden) =>
              total +
              Number(
                orden.cuello_carga
                  .cantidad_pendiente || 0
              ),
            0
          ),
        horas_carga_compartida:
          Number(
            secuencia.reduce(
              (total, orden) =>
                total +
                Number(
                  orden.cuello_carga
                    .horas_restantes || 0
                ),
              0
            ).toFixed(2)
          ),
        conflicto_capacidad:
          secuencia.length > 1,
        siguiente_ot: secuencia[0] || null,
        secuencia
      };
    })
    .sort((a, b) => {
      if (
        a.conflicto_capacidad !==
        b.conflicto_capacidad
      ) {
        return a.conflicto_capacidad ? -1 : 1;
      }

      return compararPrioridadPlan(
        a.siguiente_ot,
        b.siguiente_ot
      );
    });
};

export const recalcularResumenesPlanificacion =
  async ({
    db,
    perfil,
    plantaId,
    ordenes = []
  }) => {
    const resultados = await Promise.all(
      ordenes.map(async orden => {
        const operaciones =
          await listarOperacionesOT(
            db,
            perfil.empresa_id,
            plantaId,
            orden.id
          );
        const proyeccion = calcularProyeccionOT(
          operaciones,
          new Date()
        );

        await updateDoc(
          doc(db, "ordenes_trabajo", orden.id),
          {
            ...proyeccion,
            fecha_actualizacion:
              serverTimestamp()
          }
        );

        return {
          ...orden,
          ...proyeccion
        };
      })
    );

    return resultados;
  };
