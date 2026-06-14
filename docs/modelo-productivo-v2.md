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

### Recalibracion de estandares

El jefe o gerencia puede actualizar `unidades_por_hora` desde una ruta
publicada. El sistema no modifica la version vigente ni las OT ya creadas:

1. exige un nuevo valor positivo y un motivo;
2. copia la ruta completa a la siguiente version;
3. registra en el DT modificado el estandar anterior, motivo, usuario y fecha;
4. retira la ruta anterior y activa la nueva version;
5. aplica el nuevo estandar solamente a las OT creadas posteriormente.

Esto permite corregir un dato inicial alejado de la realidad o reconocer una
mejora comprobada del proceso sin alterar indicadores historicos.

Una operacion nueva tambien puede publicarse con `unidades_por_hora = 0`.
Mientras permanezca asi:

- las sesiones se identifican como `en_medicion`;
- se registran cantidades, tiempo y calidad;
- no se calcula rendimiento ni eficiencia;
- la sesion no participa en resumenes de eficiencia ni ranking.
- la OT muestra su proyeccion como pendiente de estandar, en lugar de asumir
  cero horas restantes.

Durante una OT activa, jefe o gerencia puede establecer o cambiar el estandar
las veces que sea necesario. Cada cambio crea un evento `cambio_estandar` con
valor anterior, valor nuevo, motivo, usuario y fecha. El nuevo valor se aplica
solo a sesiones iniciadas posteriormente. Las sesiones activas y finalizadas
conservan el estandar congelado con el que comenzaron.

### Sugerencia de estandar

Cada cierre de sesion actualiza un unico documento
`resumenes_estandar_operacion/{otId_otOperacionId}`. Guarda como maximo las
12 mediciones recientes, evitando consultar el historial completo.

Una medicion es valida para sugerir estandar cuando:

- tiene al menos 45 minutos productivos;
- alcanza al menos 95% de calidad;
- produjo unidades OK.

La sugerencia usa la mediana de unidades OK por hora:

- 1 medicion valida: confianza inicial;
- 2 a 4: confianza media;
- 5 o mas: confianza alta.

El jefe ve la tendencia reciente y debe aprobar expresamente la sugerencia.
La aprobacion usa el mismo evento trazable de cambio de estandar y se aplica
solo a sesiones nuevas.

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
cantidad_total_requerida
cantidad_total_ok
cantidad_total_pendiente
estimado_horas_restantes
fecha_estimada_fin
creada_por_id
creada_por_nombre
fecha_creacion
modelo_version: 2
```

La proyeccion usa la mayor carga restante entre operaciones porque BBA puede
ejecutar varios procesos en simultaneo:

```text
velocidad_efectiva =
  unidades_por_hora_por_recurso
  * recursos_paralelos
  * (disponibilidad_pct / 100)
horas_operacion = cantidad_pendiente / velocidad_efectiva
horas_restantes_ot = max(horas_operacion)
fecha_estimada_fin = fecha_actual + horas_restantes_ot
```

Es una estimacion operativa basada en los estandares vigentes. Se recalcula con
cada reporte y puede cambiar por paros, reprocesos o variaciones de rendimiento.

### `configuracion_capacidad/{empresaId_plantaId}`

```text
empresa_id
planta_id
turnos_base
turnos_ampliados
horas_tercer_turno
calendario_version
actualizado_por_id
actualizado_en
```

El simulador mantiene los turnos base en todos los DT y aplica el escenario
ampliado solamente al DT con mayor carga restante. Luego recalcula el maximo
entre todos los DT, porque al aliviar un proceso otro puede convertirse en el
nuevo cuello de botella.

Calendarios base:

- En ambas plantas los turnos son rotativos. Estas ventanas representan la
  cobertura productiva disponible de la planta y no implican que un mismo
  operario permanezca asignado permanentemente a mañana, tarde o noche.
- Chile: lunes a miercoles, mañana 07:00-15:00 y tarde 15:00-22:30; jueves a
  sabado, mañana 07:00-14:00 y tarde 14:00-21:15. Se descuentan 30 minutos de
  colacion por turno. Esto produce 42 horas efectivas semanales en mañana y
  41,25 horas en tarde según los horarios informados. El tercer turno funciona
  lunes a miercoles de 22:30 a 07:00 y jueves a sabado de 21:15 a 07:00.
  Descontando 30 minutos diarios de colacion, suma 51,75 horas de cobertura
  efectiva semanal. Las horas ordinarias y extra deben calcularse por operario
  a partir de su programacion rotativa y sus horas acumuladas.
- Peru: lunes a sabado, mañana 06:00-14:00, tarde 14:00-22:00 y tercer turno
  22:00-06:00. Cada turno tiene ocho horas y los turnos base equivalen a 48
  horas semanales por turno.

Los terceros turnos de Chile y Peru usan horarios fijos por planta. El campo
`horas_tercer_turno` se conserva por compatibilidad con configuraciones
anteriores, pero el calendario vigente determina la capacidad efectiva.

### `capacidad_procesos/{empresa_planta_subproceso}`

```text
empresa_id
planta_id
proceso_id
proceso_nombre
subproceso_id
subproceso_nombre
maquinas_disponibles
operarios_disponibles_turno
operarios_por_recurso
disponibilidad_pct
recursos_paralelos
factor_capacidad
operarios_requeridos_turno
estado_datos: provisional | validada
activo
actualizado_por_id
actualizado_por_nombre
actualizado_en
```

El estándar se interpreta como unidades por hora de un recurso productivo
(máquina, línea o puesto). Los recursos paralelos quedan limitados por la menor
capacidad entre equipos disponibles y dotación disponible. Si un subproceso aún
no tiene configuración, la simulación usa de forma conservadora un recurso al
100% y lo muestra como pendiente de configurar.

Una capacidad solo queda `validada` cuando el jefe confirma que máquinas,
dotación y disponibilidad fueron verificadas en planta. Las capacidades
ausentes o provisionales pueden producir una proyección orientativa, pero el
sistema no emite recomendaciones de ampliación de turnos hasta validar el
cuello de botella. Una estimación puede guardarse como provisional con su
motivo, sin marcar la confirmación. La OT de referencia resume capacidades validadas,
provisionales y faltantes.

Cada creación o cambio exige un motivo de al menos 10 caracteres y se registra
atómicamente en la subcolección `historial`. El historial es inmutable y conserva
valores anteriores, valores nuevos, responsable y fecha. La pantalla consulta
solo las últimas 20 modificaciones del subproceso seleccionado.

### `capacidad_procesos/{capacidadId}/historial/{historialId}`

```text
empresa_id
planta_id
capacidad_id
proceso_id
subproceso_id
tipo_cambio: creacion | actualizacion
motivo
valores_anteriores
valores_nuevos
actualizado_por_id
actualizado_por_nombre
actualizado_en
modelo_version: 2
```

Para controlar jornadas y horas extra por persona se agregara una programacion
semanal de turnos por operario. El simulador actual calcula capacidad por
proceso y planta; no asigna automaticamente personas a cada franja.

### `programacion_turnos/{empresa_planta_semana_operario}`

La programación semanal rotativa registra:

```text
empresa_id
planta_id
semana_inicio
operario_id
operario_codigo
operario_nombre
turno_id: manana | tarde | noche
turno_nombre
subprocesos_habilitados[]
horas_efectivas
horas_ordinarias
horas_extra
actualizado_por_id
actualizado_en
```

El identificador determinista evita duplicar un operario en la misma semana.
Guardar nuevamente reemplaza su turno y congela los subprocesos para los que
está habilitado esa semana. Chile controla 42 horas ordinarias y marca 9,75
horas extra cuando se asigna toda la semana nocturna; Peru controla 48 horas
sin excedente en sus tres turnos.

Al iniciar producción, el supervisor selecciona un operario de la programación
semanal que esté habilitado para el subproceso del DT. La transacción vuelve a
validar esa competencia y la sesión congela turno, semana, horas ordinarias y
horas extra planificadas. Existe un ingreso excepcional para contingencias,
pero la sesión queda marcada como no programada.

Para proyectar capacidad, el simulador cuenta operarios habilitados por turno.
En los dos turnos base usa de forma conservadora la menor cobertura entre
mañana y tarde cuando ambos tienen al menos un operario habilitado. La dotación
objetivo se obtiene de los recursos configurados y se conserva aunque la
velocidad proyectada se reduzca por falta de personal. Solo recomienda ampliar
a noche cuando mañana, tarde y noche tienen la dotación habilitada suficiente
para operar todos los recursos calculados.

La programación semanal toma su selector de `capacidad_procesos`, evitando leer
todas las rutas de productos para construir el catálogo. La matriz de cobertura
muestra por subproceso la relación `habilitados / requeridos` en mañana, tarde
y noche. También indica cuántos operarios faltan en cada turno base; el
simulador muestra la brecha exacta para que el jefe pueda reasignar o incorporar
personal antes de ampliar el cuello de botella.

Para cargar `capacidad_procesos`, el jefe puede elegir una OT V2 de referencia.
La pantalla lee únicamente las operaciones de esa OT, deduplica sus
subprocesos y completa códigos y nombres. Esto evita recorrer todas las rutas o
todas las OT; la entrada manual queda disponible para subprocesos nuevos.

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
turno_nombre
semana_programada
programacion_turno_id
sesion_programada
horas_ordinarias_programadas
horas_extra_programadas
ot_id
ot_codigo
ot_operacion_id
operacion_id
operacion_codigo
operario_id
operario_nombre
supervisor_id
estado: activa | pausada | finalizada | anulada
inicio
fin
tiempo_productivo_seg
tiempo_paro_seg
tiempo_paro_descontable_seg
tiempo_total_seg
paro_inicio
motivo_paro_id
motivo_paro_codigo
motivo_paro_nombre
estandar_unidades_hora
estandar_estado: en_medicion | vigente
ruta_version
fecha_operativa
```

Varios documentos pueden estar activos para la misma operacion de OT, uno por
operario o equipo de trabajo. El estandar se copia al iniciar la sesion y nunca
se reemplaza retroactivamente.

### `catalogo_motivos_paro/{motivoId}`

```text
codigo
nombre
categoria: operacional | maquina | material | calidad | planificacion | seguridad
afecta_eficiencia
activo
empresa_id
```

Cada pausa y reanudacion crea un evento. La sesion acumula
`tiempo_paro_seg`, de modo que los indicadores finales usan:

```text
tiempo_productivo = tiempo_total - tiempo_paro_descontable
```

`tiempo_paro_seg` conserva todas las detenciones para analitica. El campo
`tiempo_paro_descontable_seg` excluye pausas planificadas que no deben afectar
el rendimiento.

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

### `catalogo_causas/{causaId}`

```text
codigo, nombre, activo, empresa_id
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
cantidad_merma
cantidad_reproceso_pendiente
estado_reproceso: no_aplica | pendiente | resuelto
defecto_id
causa_id
timestamp
```

La cantidad defectuosa representa merma. La cantidad a reproceso representa
material recuperable y mantiene la OT abierta hasta que Calidad distribuya
todo el saldo entre unidades recuperadas OK y merma final.

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

El piloto V2 guarda `ranking_operarios` dentro del resumen diario de planta.
De esta forma el televisor mantiene una sola escucha aunque aumente la cantidad
de operarios. Antes de activar produccion real, la escritura de estos resumenes
debe trasladarse desde el cliente a una Cloud Function o backend confiable.

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
- Registrar pausas y reanudaciones con motivos normalizados y descontar el
  tiempo detenido de la eficiencia.

La sesion finalizada conserva `rendimiento_pct`, `calidad_pct` y
`eficiencia_calidad_pct`. En pruebas muy breves el rendimiento puede ser alto
porque el tiempo productivo se mide en segundos; en planta se calcula sobre la
duracion real de la sesion.

### Fase 5 - Resumenes y expansion

- Migrar dashboard y ranking a resumenes. Implementado inicialmente en
  `bba-erp-pruebas` con una sola escucha por planta para el televisor.
- Activar multi-planta.
- Preparar exportacion analitica para IA.

## Criterios de cierre de OT

Una OT puede pasar a `completada` cuando:

1. Todas las operaciones obligatorias tienen `cantidad_pendiente <= 0`.
2. No hay sesiones activas.
3. No hay defectos o reprocesos pendientes de resolucion.

Una OT completada deja de aparecer al iniciar produccion, pero permanece
consultable en historicos.
