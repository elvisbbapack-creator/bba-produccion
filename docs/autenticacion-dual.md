# Autenticacion dual

La aplicacion admite dos modos de acceso durante la migracion.

## Modo heredado

```text
REACT_APP_AUTH_MODE=legacy
```

Es el valor predeterminado. Conserva el selector actual de usuarios y no cambia
la operacion de Chile. Este modo no ofrece seguridad real frente a Firestore y
solo debe mantenerse mientras se prepara la migracion.

## Modo Firebase

```text
REACT_APP_AUTH_MODE=firebase
```

Muestra acceso con correo y contrasena, espera una sesion valida antes de leer
Firestore y construye el perfil desde custom claims.

Claims requeridos:

```json
{
  "empresa_id": "bba",
  "planta_ids": ["chile"],
  "rol": "supervisor"
}
```

El usuario no puede ingresar si falta rol, empresa o planta. Gerencia puede
tener alcance global sin `planta_ids`.

## Activacion

1. Crear usuarios en Firebase Authentication dentro de un entorno de prueba.
2. Asignar custom claims desde Admin SDK o Cloud Functions.
3. Configurar el proyecto Firebase de prueba con
   `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN` y
   `REACT_APP_FIREBASE_PROJECT_ID`.
4. Configurar `REACT_APP_AUTH_MODE=firebase` solo en ese despliegue.
5. Validar supervisor, jefe, gerencia y TV.
6. Activar reglas de Firestore despues de validar todas las consultas.
7. Migrar produccion en una ventana controlada.

Nunca deben almacenarse contrasenas ni credenciales administrativas en `.env`.
