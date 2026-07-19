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

### `operarios/{personaId}`

La coleccion `operarios` se mantiene como puente con la primera app, pero en
V2 representa personas de planta codificadas desde RRHH:

```text
empresa_id
planta_id
codigo: PER0001
codigo_persona: PER0001
operario_codigo: PER0001
nombre
rol_laboral: operario | supervisor | jefe | gerente | auxiliar
activo
equipo: Alexis | Pablo
habilidades_estacion_ids: [PR0001__ET0001]
habilidades_estaciones: [{
  proceso_codigo,
  proceso_nombre,
  estacion_codigo,
  estacion_nombre
}]
fecha_ingreso
fecha_salida
motivo_salida
observacion
```

`Personas y Operarios (V2)` permite crear personas manualmente y descargar una
plantilla Excel independiente de la ingenieria. Esta plantilla sirve para migrar
personal desde la app anterior, actualizar equipos y cargar habilidades por
estacion. `rol_laboral` describe la funcion real de la persona en RRHH; no
otorga acceso al sistema. Si una persona queda inactiva o es auxiliar, puede
quedar sin equipo y sin habilidades productivas para no contaminar el balance de
dotacion ni las sugerencias de IA.

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
debe tener codigo propio para enlazar una salida con la siguiente entrada. El
nombre y la unidad de medida pueden corregirse sin cambiar el codigo.

### `catalogo_piezas/{empresaId}__{codigoPZ}`

```text
empresa_id
codigo: PZ0001
nombre
medida
material_base_id
materiales_base: [{
  material_id,
  material_codigo,
  material_nombre,
  cantidad
}]
activo
creado_en
actualizado_en
```

La pieza representa el componente fisico: lateral, bandeja, cabecero, gancho,
lata, armado soldado, etc. Una misma pieza puede pasar por varias operaciones
productivas. `material_base_id` se conserva por compatibilidad y corresponde al
primer material de `materiales_base`; las piezas nuevas pueden usar uno o varios
MP/RF como materiales base.

### `catalogo_subproductos/{empresaId}__{codigoSUB}`

```text
empresa_id
codigo: SUB0001
nombre
producto_id
producto_codigo
producto_nombre
pieza_salida_id
pieza_salida_codigo
pieza_salida_nombre
componentes: [{
  pieza_id,
  pieza_codigo,
  pieza_nombre,
  cantidad
}]
activo
creado_en
actualizado_en
```

El subproducto agrupa piezas que se unen, normalmente por soldadura. La salida
del subproducto es una pieza fisica nueva, nombrada como el subproducto mas la
palabra `Armado` (por ejemplo `Lateral Armado`). Esa pieza armada puede entrar
despues a lavado, pintura, embalaje u otra operacion de ruta.

En `Productos y Rutas`, las operaciones pueden asociarse a un subproducto del
producto seleccionado. Esto permite ver que una operacion pertenece, por ejemplo,
al armado de un lateral, bandeja o cabecero. Si una ruta ya esta publicada, se
debe crear una nueva version en borrador para agregar subproductos u operaciones;
la version publicada sigue vigente para las OT hasta que se publique la nueva.

### Composición del producto

Además de la ruta productiva, cada producto puede guardar una `composicion` con
lo que lleva una unidad terminada:

```text
composicion: [{
  tipo: SUBPRODUCTO | PIEZA | MATERIAL,
  categoria: subproducto | pieza_grafica | accesorio | empaque | otro,
  item_id,
  item_codigo,
  item_nombre,
  cantidad
}]
```

Ejemplo: `2 x Lateral`, `2 x Bandeja`, `3 x Cruceta`, `1 x Cabecero`, piezas
graficas, accesorios y caja de empaque. La composicion responde "que lleva el
producto"; la ruta responde "como se fabrica".

## Importador de ingenieria Excel

El modulo `Importar Ingenieria Excel (V2)` descarga una plantilla V3 `.xlsx`
para cargar ingenieria completa con estas hojas:

```text
Materiales_MP_SUM
Recursos_RF
Procesos_ET
Productos_PCL
Subproductos_SUB
Piezas_PZ
Composicion_Producto
Componentes_Subproducto
Operaciones_OP
Ruta_Producto
Ruta_Subproducto
```

El importador primero lee el archivo, normaliza codigos, valida referencias
cruzadas y muestra una vista previa. Solo permite confirmar la importacion si no
hay errores criticos. Los registros que ya existen se usan como referencia y se
omiten para evitar duplicados. La V3 puede crear `MP`, `RF` y `SUM`; `RT` no es
un tipo formal del modelo actual. En `Piezas_PZ`, `material_base_codigo` acepta
uno o varios codigos separados por coma (por ejemplo `RF0001, RF0002`) y
`material_base_cantidad` permite las cantidades equivalentes. En
`Operaciones_OP`, `subproducto_codigo` vincula la operacion al subproducto
cuando corresponde, y `material_entrada_codigo` / `material_entrada_cantidad`
permiten varios materiales con cantidades reales. Las rutas se cargan desde
`Ruta_Producto` y `Ruta_Subproducto`, separando el catalogo de operaciones de
la secuencia productiva, estandar, proceso y estacion. La plantilla visible usa
`estacion_codigo` y `estacion_nombre`; los campos `subproceso_*` quedan solo
como compatibilidad interna con archivos antiguos.

### `catalogo_procesos_estaciones/{empresaId}__{codigoPR}`

Catalogo maestro nuevo para reemplazar `config_procesos`.

```text
empresa_id
codigo: PR0001
nombre: Corte
activo
estaciones: [{
  codigo: ET0001,
  nombre: Laser fibra tubo,
  activo
}]
```

La ingenieria visible usa `Proceso` + `Estacion de trabajo`. No se crean
codigos `SP` nuevos. Durante la transicion, algunas colecciones aun conservan
campos `subproceso_id` como compatibilidad tecnica, pero se llenan con el codigo
ET de la estacion.

### `catalogo_operaciones/{empresaId}__{codigoOP}`

```text
empresa_id
codigo: OP0001
nombre
pieza_id
pieza_codigo
pieza_nombre
medida
material_entrada_id
materiales_entrada: [{
  material_id,
  material_codigo,
  material_nombre,
  cantidad
}]
material_salida_id
activo
creado_en
actualizado_en
```

La operacion representa una etapa productiva sobre una pieza: corte, perforado,
doblez, soldadura, pintura, embalaje, etc. Al seleccionar un codigo `OP` en una
ruta, el sistema completa nombre, pieza, medida, materiales de entrada y RF de
salida sugerido. `material_entrada_id` se conserva por compatibilidad y
corresponde al primer material de `materiales_entrada`. Las rutas ya guardadas
conservan su copia congelada.

### `inventario_materiales/{empresaId}__{plantaId}__{materialId}`

```text
empresa_id
planta_id
material_id
material_codigo
material_nombre
material_tipo: MP | RF
unidad_medida
stock_actual
stock_reservado
stock_disponible
actualizado_por_id
actualizado_en
modelo_version: 2
```

El saldo se guarda por material y planta para evitar recalcular stock desde
todo el historial. `stock_reservado` permite separar lo comprometido para una
OT del stock libre. Este documento es el punto de lectura rapido para jefes y
futuras alertas de faltantes.

### `movimientos_almacen/{movimientoId}`

```text
empresa_id
planta_id
material_id
material_codigo
tipo: recepcion | ajuste_positivo | ajuste_negativo | reserva_ot |
  liberacion_reserva | consumo_ot
cantidad
ot_codigo
referencia
observacion
stock_anterior
stock_nuevo
stock_reservado_anterior
stock_reservado_nuevo
stock_disponible_nuevo
usuario_id
fecha
modelo_version: 2
```

El historial es inmutable. Recepciones y ajustes positivos aumentan stock;
ajustes negativos y consumos descuentan stock disponible; reservas aumentan
stock reservado sin mover stock actual; liberar reserva reduce stock reservado.

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
estado: borrador | publicada | retirada | anulada
vigente_desde
creada_por
motivo_anulacion
anulada_por
anulada_en
fecha_creacion
```

Las rutas en `borrador` pueden eliminarse junto con sus operaciones si aun no
tienen OT asociadas. Las rutas `publicada` no se borran fisicamente: se marcan
como `anulada` con motivo, usuario y fecha para mantener trazabilidad. Si la
ruta anulada era la activa del producto, deja de estar disponible para nuevas
OT hasta publicar una version correcta.

### `productos/{productoId}/rutas/{rutaId}/operaciones/{rutaOperacionId}`

```text
secuencia
operacion_id
operacion_codigo
proceso_id
proceso_nombre
estacion_id
estacion_nombre
subproceso_id (compatibilidad: copia de estacion_id)
subproceso_nombre (compatibilidad: copia de estacion_nombre)
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
cuello_carga
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

`cuello_carga` conserva en el documento principal de la OT el DT con mayor
carga restante: código, nombre, subproceso, cantidad pendiente y horas
estimadas. El dashboard consulta únicamente las OTs activas y este resumen
denormalizado; no recorre sus subcolecciones de operaciones ni historiales.
Ordena primero OTs atrasadas, luego proyecciones posteriores a la entrega y
operaciones pendientes de estándar.

El Planificador de Prioridades agrupa las OTs activas por el
`subproceso_id` de su `cuello_carga`. Dentro de cada grupo prioriza DT
disponibles o en proceso, riesgo de entrega y fecha comprometida. Las
operaciones bloqueadas indican que primero debe resolverse su dependencia o RF,
y las que no tienen estándar se excluyen de una proyección confiable. La
secuencia es una recomendación y no cambia automáticamente ninguna OT.
Las OTs creadas antes de `cuello_carga` pueden recalcularse manualmente desde
el planificador. Esa acción lee una vez sus operaciones y actualiza el resumen;
la consulta normal del planificador sigue sin recorrer subcolecciones.
Cuando el jefe necesita ver cuanto falta de cada DT, el planificador abre el
detalle de una OT bajo demanda. Esa accion lee solo
`ordenes_trabajo/{otId}/operaciones` de la OT seleccionada, ordena los DT
pendientes con el cuello primero, muestra unidades pendientes, horas conocidas,
DTs sin estandar y cachea el resultado en pantalla. Cada DT muestra ademas una
sugerencia concreta: cubrir dotacion base, preparar noche, activar 3er turno
solo en el cuello, revisar capacidad, definir estandar, desbloquear
dependencias o no mover recursos si el DT no es el cuello. Asi se entrega
visibilidad operativa fina sin multiplicar lecturas de Firebase para todas las
OTs activas.

La recomendacion de turnos del planificador compara la carga conocida del
subproceso contra la capacidad semanal estimada con 2 turnos y con 3 turnos.
Usa capacidades validadas de `capacidad_procesos`, `programacion_turnos` de la
semana vigente y los calendarios de Chile/Peru. El resultado puede ser mantener
2 turnos, activar 3er turno, preparar dotacion nocturna, cubrir dotacion base o
reforzar capacidad. La recomendacion no reasigna operarios ni modifica OTs;
solo orienta la decision del jefe. La tarjeta de decision compara el escenario
actual de 2 turnos contra el escenario ampliado de 3 turnos, mostrando capacidad
semanal, dias estimados de termino, fecha proyectada, horas que seguirian
faltando y ahorro estimado en dias/semanas. Tambien resume el aporte del turno
noche y la dotacion cubierta por turno para explicar por que sugiere mantener,
ampliar o reforzar. Cada tarjeta muestra tambien el estado de capacidad del
subproceso: `faltante`, `provisional` o `validada`.
Cuando la estacion requiere ayudante, la tarjeta muestra la dotacion por
estacion, por ejemplo `1 principal + 1 ayudante`, junto con los operarios
requeridos por turno para explicar la brecha real.
Las capacidades provisionales se muestran con sus recursos, factor, dotacion y
disponibilidad, pero bloquean recomendaciones de turnos hasta que el jefe las
valide en planta. Si falta capacidad validada, el planificador
permite abrir
`Capacidad por Proceso (V2)` con la planta y el subproceso del cuello ya
precargados para completar la configuracion. Cuando existe OT de referencia, la
pantalla intenta completar tambien proceso y nombre desde sus operaciones. Si
la capacidad existe pero falta
dotacion base o nocturna, permite abrir `Programacion de Turnos (V2)` con la
planta, semana operativa, subproceso y turno sugerido precargados. En Turnos la
franja contextual muestra que la programacion viene del Planificador, indica el
subproceso, turno y semana, y al volver deja una alerta en el Planificador para
recalcular y confirmar si la brecha de dotacion desaparecio. En ambos casos, al
venir desde el planificador la pantalla permite volver directamente al
planificador para recalcular la decision y muestra una franja contextual con ese
siguiente paso. Al guardar una capacidad desde una OT de referencia, la pantalla recalcula
la preparacion de esa OT y avisa si ya estan todas sus capacidades validadas
para volver al Planificador o si aun quedan capacidades provisionales/faltantes.
El encabezado del Planificador resume subprocesos con carga, OTs involucradas,
horas de carga, capacidad faltante/provisional/validada, recomendaciones
accionables y bloqueos por dotacion para priorizar la revision diaria. Cada
tarjeta del resumen funciona como filtro rapido y permite volver a ver todo el
plan sin recargar datos.

El jefe puede registrar la decision tomada desde la misma tarjeta del
Planificador. El registro se guarda en `decisiones_planificador` con la
recomendacion original, la decision real, comentario opcional, OT priorizada,
subproceso, capacidad usada, dotacion, ahorro estimado y usuario responsable.
Este historial no modifica OTs ni turnos automaticamente; sirve como auditoria y
base futura para comparar recomendaciones contra resultados reales con IA.
La vista `Historial Decisiones Planificador (V2)` consulta decisiones recientes
con limite por planta y permite filtrar en pantalla por subproceso, OT/producto
y tipo de decision para controlar lecturas en Firebase. Tambien muestra un
aprendizaje operativo con porcentaje de coincidencia entre recomendacion y
decision real, decisiones distintas, ahorro estimado y subprocesos con mas
casos para revisar.
Para medir impacto posterior, la misma vista lee solo `ordenes_trabajo/{otId}`
y `resumenes_ot/{otId}` de las decisiones recientes. Con eso muestra avance,
riesgo de entrega, eficiencia con calidad y calidad posterior sin recorrer
eventos de produccion ni subcolecciones.

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
`operarios_por_recurso` representa la dotacion real de una estacion. Si la
estacion trabaja con operario principal y ayudante, se registra `2`; si requiere
dos ayudantes, se registra `3`. Esto reduce los recursos paralelos disponibles
cuando la dotacion no alcanza y aumenta `operarios_requeridos_turno`, afectando
directamente la brecha que ve el Planificador.

Una capacidad solo queda `validada` cuando el jefe confirma que máquinas,
dotación y disponibilidad fueron verificadas en planta. Las capacidades
ausentes o provisionales pueden producir una proyección orientativa, pero el
sistema no emite recomendaciones de ampliación de turnos hasta validar el
cuello de botella. Una estimación puede guardarse como provisional con su
motivo, sin marcar la confirmación. La OT de referencia resume capacidades validadas,
provisionales y faltantes.

La pantalla de capacidad muestra una guia de validacion antes de guardar:
estandar usado por el subproceso, capacidad calculada por turno, dotacion
requerida, impacto en el Planificador y advertencias para confirmar maquinas,
dotacion y disponibilidad reales. Si el dato corresponde a la primera hora de
arranque, debe guardarse como provisional y ajustarse despues de observar la
produccion real.

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
Si la capacidad del subproceso indica que la estacion requiere ayudante, la
sesion exige registrar equipo de apoyo. El operario principal mantiene la
medicion de eficiencia/ranking, pero los ayudantes quedan guardados en
`equipo_apoyo` y bloqueados en `ocupacion_operarios` hasta finalizar el turno,
evitando asignaciones simultaneas.

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
y noche. Tambien muestra la dotacion por estacion, por ejemplo `1 principal + 1
ayudante`, para explicar por que un subproceso requiere mas personas por turno.
Tambien indica cuántos operarios faltan en cada turno base; el simulador muestra
la brecha exacta para que el jefe pueda reasignar o incorporar personal antes de
ampliar el cuello de botella.

La recomendación sigue un orden operativo. Si la capacidad está validada pero
mañana o tarde no alcanzan la dotación objetivo, primero simula completar los
turnos base y muestra el ahorro calendario y la nueva fecha estimada. Solo
después evalúa habilitar la brecha nocturna y el ahorro adicional de un tercer
turno. Esto evita usar horas extra para compensar una asignación base
incompleta.

Cuando existe excedente de operarios calificados en otro turno, el simulador
identifica candidatos concretos para reasignación. Solo propone una persona si
el turno de origen conserva la dotación requerida después del movimiento. La
sugerencia es informativa: el jefe debe revisar la rotación, jornada y
continuidad de las demás OTs antes de modificar la programación semanal.
El Planificador muestra esas mismas reasignaciones sugeridas cuando la brecha
de dotacion base o nocturna tiene candidatos concretos. La tarjeta indica
operario, turno de origen y turno destino, pero no modifica la rotacion
automaticamente.

### `ocupacion_operarios/{empresa_planta_operario}`

Mantiene un bloqueo liviano por operario. Al iniciar una sesión, la misma
transacción verifica que `activa` no sea verdadera y registra la sesión, OT y
operación actuales. Las pausas conservan la ocupación; el cierre de la sesión
la libera. El selector de ejecución y las sugerencias de reasignación excluyen
ocupados, evitando asignaciones simultáneas sin consultar historiales.

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

### Backlog posterior a mejoras prioritarias

Orden sugerido despues de estabilizar Planificador, capacidad, turnos,
ejecucion, calidad y bajo consumo de lecturas:

1. Almacen V2: recepcion, stock MP/RF, consumo por OT, reservas para procesos
   y movimientos trazables. Primer corte implementado con saldos por
   material/planta e historial inmutable. Pendiente: movimientos entre planta y
   bodega, alertas de faltantes antes de iniciar produccion y consumo automatico
   desde ejecucion.
2. Compras/abastecimiento: solicitudes por faltantes de MP/RF y trazabilidad
   contra recepcion de almacen.
3. Costeo productivo: consumo real, horas hombre, reprocesos, merma y costo
   por OT/producto.
4. Analitica IA: prediccion de cuellos, recomendacion de dotacion y deteccion
   de estandares desactualizados.

## Criterios de cierre de OT

Una OT puede pasar a `completada` cuando:

1. Todas las operaciones obligatorias tienen `cantidad_pendiente <= 0`.
2. No hay sesiones activas.
3. No hay defectos o reprocesos pendientes de resolucion.

Una OT completada deja de aparecer al iniciar produccion, pero permanece
consultable en historicos.
