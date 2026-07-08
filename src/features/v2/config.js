const ROLES_ADMINISTRACION_V2 = [
  "jefe",
  "gerencia"
];

const ROLES_OPERACION_V2 = [
  "supervisor",
  ...ROLES_ADMINISTRACION_V2
];

export const PERMISOS_V2 = [
  {
    clave: "usuarios.gestionar",
    modulo: "Usuarios",
    nombre: "Gestionar usuarios y permisos"
  },
  {
    clave: "dashboard.ver",
    modulo: "Dashboard",
    nombre: "Ver dashboard y ranking"
  },
  {
    clave: "produccion.operar",
    modulo: "Producción",
    nombre: "Ejecutar producción"
  },
  {
    clave: "produccion.configurar",
    modulo: "Producción",
    nombre: "Configurar producción clásica"
  },
  {
    clave: "ots.gestionar",
    modulo: "OT",
    nombre: "Crear y gestionar OT"
  },
  {
    clave: "ingenieria.gestionar",
    modulo: "Ingeniería",
    nombre: "Gestionar ingeniería, rutas y catálogos"
  },
  {
    clave: "planificacion.gestionar",
    modulo: "Planificación",
    nombre: "Gestionar planificación y cuellos"
  },
  {
    clave: "turnos.gestionar",
    modulo: "Turnos",
    nombre: "Gestionar turnos y dotación"
  },
  {
    clave: "estandares.gestionar",
    modulo: "Estándares",
    nombre: "Gestionar estándares"
  },
  {
    clave: "calidad.gestionar",
    modulo: "Calidad",
    nombre: "Gestionar calidad y reprocesos"
  },
  {
    clave: "paros.gestionar",
    modulo: "Paros",
    nombre: "Gestionar motivos de paro"
  },
  {
    clave: "almacen.gestionar",
    modulo: "Almacén",
    nombre: "Gestionar almacén"
  },
  {
    clave: "ajustes.gerenciales",
    modulo: "Ajustes",
    nombre: "Realizar ajustes gerenciales"
  },
  {
    clave: "importacion.gestionar",
    modulo: "Importación",
    nombre: "Importar ingeniería"
  }
];

export const permisosPorRol = rol => {
  if (rol === "gerencia") {
    return Object.fromEntries(
      PERMISOS_V2.map(permiso => [
        permiso.clave,
        true
      ])
    );
  }

  if (rol === "jefe") {
    return {
      "dashboard.ver": true,
      "produccion.operar": true,
      "produccion.configurar": true,
      "ots.gestionar": true,
      "ingenieria.gestionar": true,
      "planificacion.gestionar": true,
      "turnos.gestionar": true,
      "estandares.gestionar": true,
      "calidad.gestionar": true,
      "paros.gestionar": true,
      "almacen.gestionar": true,
      "ajustes.gerenciales": true,
      "importacion.gestionar": true
    };
  }

  if (rol === "supervisor") {
    return {
      "dashboard.ver": true,
      "produccion.operar": true
    };
  }

  if (rol === "tv") {
    return {
      "dashboard.ver": true
    };
  }

  return {};
};

export const permisosEfectivosV2 = perfil => ({
  ...permisosPorRol(perfil?.rol),
  ...(perfil?.permisos || {})
});

export const tienePermisoV2 = (
  perfil,
  permiso
) =>
  Boolean(
    perfil?.autenticado &&
    perfil?.empresa_id &&
    permisosEfectivosV2(perfil)[permiso]
  );

export const obtenerInterfazV2Activa = (
  valor = process.env.REACT_APP_V2_ENABLED
) => valor === "true";

export const interfazV2Activa =
  obtenerInterfazV2Activa();

export const puedeAdministrarV2 = (perfil) =>
  Boolean(
    perfil?.autenticado &&
    perfil?.empresa_id &&
    (
      ROLES_ADMINISTRACION_V2.includes(
        perfil?.rol
      ) ||
      tienePermisoV2(
        perfil,
        "planificacion.gestionar"
      ) ||
      tienePermisoV2(
        perfil,
        "ingenieria.gestionar"
      ) ||
      tienePermisoV2(
        perfil,
        "almacen.gestionar"
      )
    )
  );

export const puedeOperarV2 = (perfil) =>
  Boolean(
    perfil?.autenticado &&
    perfil?.empresa_id &&
    Array.isArray(perfil?.planta_ids) &&
    perfil.planta_ids.length > 0 &&
    (
      ROLES_OPERACION_V2.includes(perfil?.rol) ||
      tienePermisoV2(
        perfil,
        "produccion.operar"
      )
    )
  );

export const puedeVerDashboardV2 = (perfil) =>
  Boolean(
    perfil?.autenticado &&
    perfil?.empresa_id &&
    Array.isArray(perfil?.planta_ids) &&
    perfil.planta_ids.length > 0 &&
    (
      [
        ...ROLES_OPERACION_V2,
        "tv"
      ].includes(perfil?.rol) ||
      tienePermisoV2(
        perfil,
        "dashboard.ver"
      )
    )
  );

export const puedeGestionarUsuariosV2 =
  perfil =>
    Boolean(
      perfil?.autenticado &&
      perfil?.empresa_id &&
      (
        perfil?.rol === "gerencia" ||
        tienePermisoV2(
          perfil,
          "usuarios.gestionar"
        )
      )
    );
