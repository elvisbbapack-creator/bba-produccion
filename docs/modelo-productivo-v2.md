# Modelo productivo V2

## Objetivo

Relacionar producto, materiales, semielaborados, ruta, OT y ejecucion de planta
con IDs estables. El modelo debe soportar Chile y Peru, produccion simultanea,
calidad, bajo consumo de lecturas y datos historicos aptos para IA.

## Principios

1. Toda entidad usa ID; el nombre queda como dato descriptivo.
2. Todo documento operativo incluye `empresa_id` y `planta_id`.
3. La ruta del producto se versiona.
4. La OT conserva una copia congelada de la version utilizada.
5. Cada operacion de OT tiene su propio documento de avance.
6. Los eventos historicos son inmutables; las correcciones generan auditoria.
7. Los dashboards leen resumenes, no reconstruyen todo el historial.
8. Los campos de fecha operativa usan timestamp de servidor y zona horaria.

## Catalogos

### `empresas/{empresaId}`

```text
codigo, nombre, activo
```

### `plantas/{plantaId}`

```text
empresa_id, codigo, nombre, pais, zona_horaria, activo
```

Ejemplos de zona horaria: `America/Santiago` y `America/Lima`.

### `materiales/{materialId}`

```text
codigo: MP0001 | RF0001
tipo: MP | RF
nombre
unidad_medida: unidad | kg | metro | plancha
es_comprado
activo
empresa_id
```

`RF` es un recurso en fabricacion generado por una operacion anterior. Cada RF
debe tener codigo propio para enlazar una salida con la siguiente entrada.

### `procesos/{procesoId}`

```text
codigo, nombre, activo, empresa_id
```

### `subprocesos/{subprocesoId}`

```text
codigo, nombre, proceso_id, activo, empresa_id
```

### `operaciones/{operacionId}`

```text
codigo
nombre
proceso_id
subproceso_id
unidad_produccion
activo
empresa_id
```

La operacion maestra define que se hace. Los materiales, cantidades y
estandares se definen en la ruta del producto.

## Producto y ruta versionada

### `productos/{productoId}`

```text
codigo
nombre
familia
activo
empresa_id
version_ruta_activa
fecha_creacion
fecha_actualizacion
```

### `productos/{productoId}/rutas/{rutaId}`

```text
version
estado: borrador | publicada | retirada
vigente_desde
creada_por
fecha_creacion
```

### `productos/{productoId}/rutas/{rutaId}/operaciones/{rutaOperacionId}`

```text
secuencia
operacion_id
operacion_codigo
proceso_id
proceso_nombre
subproceso_id
subproceso_nombre
nombre
material_entrada_id
material_entrada_codigo
material_salida_id
material_salida_codigo
medida
unidades_por_producto
cantidad_salida_por_ciclo
unidades_por_hora
merma_esperada_pct
control_calidad_requerido
activo
```

Los nombres y codigos se copian junto con los IDs para mostrar historicos sin
lecturas adicionales y conservar la descripcion vigente en ese momento.

## Ejemplo PCL0001

Ruta simplificada para `PCL0001 Mod 2N60 CL`:

```text
DT0001 Corte lateral 290
  entrada: MP0001 Tubo 15x15x1
  salida: RF0001 Tubo lateral 290 cortado
  unidades_por_producto: 4

DT0005 Perforacion 4 hoyos
  entrada: RF0001 Tubo lateral 290 cortado
  salida: RF0002 Tubo lateral 290 perforado
  unidades_por_producto: 4
  depende_de: DT0001
```

Para una OT de 100 productos, ambas operaciones requieren 400 unidades. La
disponibilidad para `DT0005` se obtiene de:

```text
RF0001 disponible =
  cantidad OK producida por DT0001
  - cantidad consumida por DT0005
  - cantidad descartada
```

`DT0005` puede comenzar antes de que `DT0001` termine, siempre que exista
material disponible y se cumpla el porcentaje minimo configurado. Otras ramas
de corte, doblez y soldadura pueden ejecutarse simultaneamente.

### Dependencias

Cada operacion puede tener cero o varias dependencias:

```text
dependencias: [
  {
    ruta_operacion_id,
    porcentaje_minimo_avance,
    requiere_material_disponible
  }
]
```

Esto permite iniciar procesos simultaneos o comenzar una operacion cuando la
anterior alcance un porcentaje definido.

## Orden de trabajo

### `ordenes_trabajo/{otId}`

```text
codigo
correlativo
empresa_id
planta_id
cliente_id
cliente_nombre
producto_id
producto_codigo
producto_nombre
ruta_id
ruta_version
cantidad_producto
estado: borrador | liberada | en_produccion | pausada | completada | cerrada
fecha_planificada_inicio
fecha_planificada_entrega
fecha_real_inicio
fecha_real_fin
avance_pct
creada_por_id
creada_por_nombre
fecha_creacion
modelo_version: 2
```

### `ordenes_trabajo/{otId}/operaciones/{otOperacionId}`

Es la copia congelada de una operacion de ruta:

```text
ruta_operacion_id
operacion_id
operacion_codigo
operacion_nombre
proceso_id
proceso_nombre
subproceso_id
subproceso_nombre
material_entrada_id
material_entrada_codigo
material_salida_id
material_salida_codigo
medida
unidades_por_producto
cantidad_requerida
cantidad_ok
cantidad_defectuosa
cantidad_reproceso
cantidad_consumida
cantidad_pendiente
unidades_por_hora
dependencias
estado: pendiente | disponible | en_proceso | completada | bloqueada
avance_pct
fecha_inicio
fecha_fin
```

Al crear la OT:

```text
cantidad_requerida = cantidad_producto * unidades_por_producto
cantidad_pendiente = cantidad_requerida
```

Guardar las operaciones como subcoleccion evita superar el limite de tamano de
un documento y permite actualizar una operacion sin reescribir toda la OT.

## Ejecucion

### `sesiones_produccion/{sesionId}`

Sustituye gradualmente a `produccion_activa`:

```text
empresa_id
planta_id
turno_id
ot_id
ot_codigo
ot_operacion_id
operacion_id
operacion_codigo
operario_id
operario_nombre
supervisor_id
estado: activa | detenida | finalizada | anulada
inicio
fin
tiempo_productivo_seg
tiempo_paro_seg
estandar_unidades_hora
ruta_version
fecha_operativa
```

Varios documentos pueden estar activos para la misma operacion de OT, uno por
operario o equipo de trabajo.

### `eventos_produccion/{eventoId}`

```text
sesion_id
empresa_id
planta_id
ot_id
ot_operacion_id
operario_id
tipo: inicio | pausa | reanudacion | reporte | finalizacion | ajuste | anulacion
cantidad_ok
cantidad_defectuosa
cantidad_reproceso
motivo_id
observacion
timestamp
registrado_por_id
dispositivo_id
modelo_version: 2
```

Estos eventos forman el historial para auditoria e IA. No deben editarse; una
correccion genera un nuevo evento.

## Calidad

### `catalogo_defectos/{defectoId}`

```text
codigo, nombre, proceso_id, severidad, activo, empresa_id
```

### `registros_calidad/{registroId}`

```text
sesion_id
evento_id
ot_id
ot_operacion_id
operario_id
cantidad_inspeccionada
cantidad_ok
cantidad_defectuosa
cantidad_reproceso
defecto_id
causa_id
timestamp
```

Indicadores:

```text
rendimiento = produccion_total / produccion_esperada
calidad = cantidad_ok / produccion_total
eficiencia_calidad = rendimiento * calidad
```

Los tres valores deben conservarse; el ranking usa `eficiencia_calidad`.

## Resumenes para bajo consumo

```text
resumenes_operario_dia/{plantaId_fecha_operarioId}
resumenes_ot/{otId}
resumenes_ot_operacion/{otOperacionId}
resumenes_planta_turno/{plantaId_fecha_turnoId}
```

El televisor consulta un unico resumen de planta y el ranking diario. Los
resumenes deben actualizarse mediante transaccion o funcion de backend al
registrar eventos, no mediante lectura completa del historial.

## Consultas e indices previstos

- Sesiones activas por `planta_id + estado`.
- OT seleccionables por `planta_id + estado + fecha_creacion`.
- Eventos por `planta_id + fecha_operativa + timestamp`.
- Eventos por `ot_id + ot_operacion_id + timestamp`.
- Resumen de operario por `planta_id + fecha + eficiencia_calidad`.

Toda pantalla historica debe usar rango de fechas, limite y paginacion.

## Migracion gradual

### Fase 0 - Estabilizacion

- Conservar colecciones actuales.
- Corregir carga de `config_productos` e IDs de OT.
- Crear adaptadores que normalicen nombres de campos heredados.
- Versionar reglas e indices de Firebase.

### Fase 1 - Catalogos V2

- Crear plantas Chile y Peru.
- Crear catalogos de materiales MP/RF y operaciones con IDs.
- Importar productos existentes como borradores.
- No cambiar todavia el registro de produccion de Chile.

### Fase 2 - Rutas versionadas

- Construir rutas V2 desde la interfaz. Implementado inicialmente para V1
  en el entorno `bba-erp-pruebas`.
- Publicar una ruta piloto. Completado con `PCL0001` en pruebas.
- Validar cantidades y dependencias con un producto real. El piloto usa cuatro
  unidades por producto y habilita `DT0005` al 20% de avance de `DT0001`.

### Fase 3 - OT V2

- Las nuevas OT piloto usan `modelo_version: 2`. Implementado en
  `bba-erp-pruebas` con correlativo automático por planta.
- Las OT actuales siguen usando el flujo heredado.
- La seleccion de produccion detecta la version y usa el flujo correspondiente.

### Fase 4 - Ejecucion y calidad

- Registrar sesiones y eventos V2. Implementado inicialmente en
  `bba-erp-pruebas`.
- Actualizar avances mediante transacciones. El piloto habilita operaciones
  dependientes al cumplir avance minimo y disponibilidad RF.
- Incorporar defectos, merma y reproceso.

La sesion finalizada conserva `rendimiento_pct`, `calidad_pct` y
`eficiencia_calidad_pct`. En pruebas muy breves el rendimiento puede ser alto
porque el tiempo productivo se mide en segundos; en planta se calcula sobre la
duracion real de la sesion.

### Fase 5 - Resumenes y expansion

- Migrar dashboard y ranking a resumenes.
- Activar multi-planta.
- Preparar exportacion analitica para IA.

## Criterios de cierre de OT

Una OT puede pasar a `completada` cuando:

1. Todas las operaciones obligatorias tienen `cantidad_pendiente <= 0`.
2. No hay sesiones activas.
3. No hay defectos o reprocesos pendientes de resolucion.

Una OT completada deja de aparecer al iniciar produccion, pero permanece
consultable en historicos.
