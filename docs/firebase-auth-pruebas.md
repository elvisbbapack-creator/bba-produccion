# Firebase Auth de pruebas

Entorno creado el 12 de junio de 2026 para validar autenticacion sin tocar los
proyectos existentes.

## Recursos

- Proyecto: `bba-erp-pruebas`
- Firestore: `(default)`
- Region: `southamerica-west1` (Santiago)
- Hosting: `https://bba-erp-pruebas.web.app`
- Proveedor: Email/Password

## Cuentas sinteticas

```text
supervisor.chile@example.com
jefe.chile@example.com
gerencia.bba@example.com
tv.chile@example.com
```

Cada cuenta usa custom claims con:

```text
empresa_id: bba
rol: supervisor | jefe | gerencia | tv
planta_ids: chile o chile/peru
```

Las contrasenas no se guardan en el repositorio.

## Reglas

`firebase/firestore.rules.test` permite lecturas autenticadas sobre las
colecciones heredadas para probar la aplicacion actual. Estas reglas fueron
desplegadas solamente en `bba-erp-pruebas`.

El catalogo `materiales` exige rol `jefe` o `gerencia` para crear o cambiar
el estado. Los documentos no se eliminan y su empresa no puede modificarse.

Los productos y sus rutas versionadas tambien exigen rol `jefe` o `gerencia`.
Las operaciones publicadas conservan documentos separados para evitar arreglos
grandes y reducir lecturas al consultar un producto concreto.

Las reglas V2 propuestas siguen separadas y no se han desplegado en produccion.

## Verificacion

- Las cuatro cuentas iniciaron sesion mediante la API de Firebase.
- Los cuatro tokens incluyeron los claims esperados.
- El supervisor inicio sesion en Hosting y llego al panel BBA.
- No hubo lecturas Firestore antes del login ni errores de consola despues.
