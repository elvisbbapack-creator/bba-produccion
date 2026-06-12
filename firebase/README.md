# Firebase - propuesta V2

Los archivos de esta carpeta son una propuesta revisable. No estan conectados
a `firebase.json` y no deben desplegarse en produccion mientras la aplicacion
use el selector local de usuarios en lugar de Firebase Authentication.

## Estado actual

- Proyecto detectado en el frontend: `bba-produccion`.
- No existe una sesion autorizada de Firebase CLI en esta maquina.
- Las reglas e indices remotos no pudieron consultarse.
- La aplicacion no autentica usuarios con Firebase Auth.
- Los roles actuales solo existen como datos de interfaz y no son confiables
  para reglas de seguridad.

## Archivos

- `firestore.rules.proposed`: reglas V2 basadas en Firebase Auth y custom
  claims.
- `firestore.indexes.proposed.json`: indices previstos para consultas
  multi-planta y resumenes.
- `firebase.emulator.json`: configuracion exclusiva para validacion local con
  el proyecto ficticio `demo-bba`.
- `firestore.rules.test` y `firebase.test.json`: reglas temporales compatibles
  con las colecciones heredadas, destinadas unicamente a `bba-erp-pruebas`.
- `../firebase.hosting-test.json`: configuracion de Hosting exclusiva para la
  compilacion Auth de `bba-erp-pruebas`.

El emulador de Firestore requiere Java. En la revision del 12 de junio de 2026
esta maquina no tenia un runtime de Java instalado, por lo que la sintaxis de
las reglas debe validarse en CI o en un entorno de desarrollo con Java antes de
activar `firebase.json`.

## Claims requeridos

Cada usuario autenticado debe recibir claims administrados desde backend:

```json
{
  "empresa_id": "bba",
  "planta_ids": ["chile"],
  "rol": "supervisor"
}
```

Roles previstos:

- `supervisor`: ejecucion productiva de sus plantas.
- `jefe`: ejecucion, OT y correcciones de sus plantas.
- `gerencia`: lectura global y administracion operativa.
- `tv`: lectura exclusiva de resumenes y rankings.

Los custom claims nunca deben asignarse desde el navegador.

## Orden seguro de activacion

1. Crear un proyecto o base de prueba separado de produccion.
2. Implementar Firebase Authentication.
3. Migrar usuarios y asignar claims desde un entorno backend confiable.
4. Probar cada rol con Firebase Emulator Suite.
5. Comparar reglas propuestas con las reglas reales de produccion.
6. Configurar `firebase.json` solo cuando las pruebas sean satisfactorias.
7. Desplegar primero indices y esperar que terminen de construirse.
8. Desplegar reglas en una ventana controlada y verificar Chile.

No se deben desplegar estas reglas directamente sobre la planta activa.
