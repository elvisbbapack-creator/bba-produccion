# Firestore actual - BBA Produccion

Este documento describe el modelo que usa la aplicacion antes de introducir el
modelo productivo V2. El inventario se obtuvo del codigo fuente; no se hicieron
lecturas ni escrituras sobre los datos reales de Firestore.

## Colecciones operativas

### `ordenes_trabajo`

Campos observados:

- `nombre`: codigo o nombre de la OT.
- `cliente`
- `producto`: texto libre.
- `cantidad`
- `fecha_inicio`
- `fecha_entrega`
- `estado`: `activa`, `pausada` o `cerrada`.
- `fecha_creacion`
- `estructura_producto`: copia del arreglo `config_productos.estructura`.
- `procesos`: copia de `config_procesos`, incluyendo subprocesos y detalles.

Problemas:

- Las consultas eliminan el ID del documento.
- Se guardan dos representaciones de la ruta: `estructura_producto` y
  `procesos`.
- `cantidad_objetivo` no se multiplica consistentemente por la cantidad de la
  OT.
- Algunas pantallas esperan `fecha_de_entrega` y otras `fecha_entrega`.

### `produccion_activa`

Campos observados:

- `operario`
- `ot`
- `proceso`
- `subproceso`
- `detalle`
- `iniciado_por`
- `inicio`
- `estado`: `activo` o `detenido`.
- `cantidad_actual`
- `motivo_paro`
- `inicio_paro`

Problemas:

- Las relaciones se realizan mediante nombres.
- No existe `ot_id`, `operario_id`, `operacion_ot_id`, empresa ni planta.
- No existe una sesion estable que vincule paros, produccion y ajustes.

### `registros_produccion`

Campos observados:

- `operario`, `rol`, `ot`, `proceso`, `subproceso`, `detalle`
- `cantidad_ok`
- `inicio`/`fin` o `hora_inicio`/`hora_fin`
- `tiempo_horas` o `horas_trabajadas`
- `eficiencia`, `estado_eficiencia`
- `fecha`, `iniciado_por`
- `tipo`, `tipo_ajuste`, `motivo_ajuste`, `ajustado_por`
- `anulado`, `anulado_por`, `fecha_anulacion`

Problemas:

- Hay nombres alternativos para los mismos conceptos.
- No se registra cantidad defectuosa, merma ni reproceso.
- No se conserva la version del estandar aplicada.
- No se puede atribuir de forma inequívoca el registro a una operacion de OT.

### `paros_produccion`

Campos observados:

- `operario`, `ot`, `proceso`, `subproceso`, `detalle`
- `motivo`
- `inicio_paro`, `fin_paro`
- `estado`: `activo` o `finalizado`.

Problemas:

- La asociacion con una produccion se reconstruye por textos y fechas.
- Leer la coleccion completa sera costoso cuando crezca el historial.

### `ajustes_produccion`

Campos observados:

- `produccion_id`
- horas y cantidades originales/nuevas
- `motivo`, `responsable`, `fecha_ajuste`

## Colecciones de configuracion

### `config_productos`

- `nombre`
- `activo`
- `estructura[]`
- `fecha_creacion`

Cada elemento de `estructura` puede contener:

- `operacion`: codigo de operacion maestra.
- `material`: texto libre.
- `medida`
- `cantidad`
- `unidades_hora`

Problema critico: el estado `productosConfig` existe, pero la coleccion no se
carga en `cargarDatos`.

### `operaciones_maestras`

- `codigo`
- `nombre`
- `proceso`
- `subproceso`
- `activo`
- `fecha_creacion`

### `config_procesos`

- `nombre`
- `activo`
- `fecha_creacion`
- `subprocesos[]`

Cada subproceso contiene `nombre`, `activo` y `detalles[]`. Cada detalle puede
contener `nombre`, `material`, `medida`, `cantidad_objetivo` y `activo`.

### Colecciones heredadas

- `procesos`
- `subprocesos`
- `estandares`
- `usuarios`
- `operarios`

En `estandares` el codigo consulta tanto `unidades_hora` como
`unidades_por_hora`; debe normalizarse antes de depender del valor.

## Riesgos prioritarios

1. Relaciones por nombres editables en vez de IDs.
2. Dos modelos productivos coexistiendo sin una fuente unica.
3. Inconsistencias de nombres y tipos de campos.
4. Falta de empresa, planta, turno y zona horaria.
5. Historial sin IDs de sesion y operacion de OT.
6. Consultas historicas que no filtran por planta ni periodo.
7. Documentos de OT potencialmente grandes si toda la ruta crece en un arreglo.
8. Ausencia de reglas y configuracion de Firebase versionadas en el repositorio.

