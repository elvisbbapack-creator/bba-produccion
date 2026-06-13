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

La recalibracion de estandares crea una nueva version publicada de la ruta,
registra valor anterior, valor nuevo, motivo, usuario y fecha, y conserva sin
cambios las OT existentes. Solo las OT nuevas toman el estandar actualizado.
En el piloto, `DT0001` paso de 120 a 125 unidades por hora y `PCL0001` creo la
ruta V2, manteniendo la OT piloto enlazada a su copia congelada anterior.

El flujo admite operaciones nuevas sin estandar. La primera sesion funciona
como medicion: registra produccion y calidad, pero no eficiencia ni ranking.
Jefe o gerencia puede establecer y reajustar el estandar de una OT activa
cuantas veces sea necesario; cada sesion conserva el valor vigente al momento
de iniciarse y cada cambio queda registrado como evento inmutable.
En la OT piloto, `DT0001` se ajusto durante la ejecucion de 120 a 125
unidades/hora. La pantalla confirmo que el cambio se aplica solo a sesiones
nuevas y no se detectaron errores de consola.

La sugerencia inteligente conserva hasta 12 mediciones recientes por DT y usa
la mediana de unidades OK/hora. Solo considera sesiones de al menos 45 minutos
y 95% de calidad. El jefe puede revisar tendencia, confianza y diferencia
contra el estandar vigente antes de aprobar.

La programación semanal de turnos rotativos permite asignar mañana, tarde o
noche por operario y planta. Usa un documento por persona y semana, calcula
jornada ordinaria y horas extra, y resume cuántos operarios cubren cada turno.
La validacion piloto asigno `OPTEST1` al turno noche de Chile y mostro 42 horas
ordinarias, 9,75 horas extra y una persona de cobertura nocturna.
La ejecución carga la programación de la semana actual y completa código,
nombre y turno del operario. También conserva un ingreso excepcional marcado
para no detener la planta ante una contingencia.

Las OT V2 usan correlativo transaccional por planta y solo pueden crearlas
`jefe` o `gerencia`. El piloto `OT-CHI-000001` congelo la ruta de `PCL0001`
para 100 productos, generando 400 unidades pendientes en cada operacion.

El supervisor probo la ejecucion V2 con sesiones para `DT0001` y `DT0005`.
Los reportes actualizaron pendiente, disponibilidad RF, calidad y eficiencia,
y generaron eventos inmutables para auditoria.

El piloto de Paros V2 creo el motivo `PAR0001 - Falta de material`. Una sesion
de `DT0001` fue pausada, reanudada y finalizada correctamente; la duracion del
paro quedo acumulada en la sesion y se desconto del tiempo productivo usado
para calcular rendimiento y eficiencia.

La proyeccion de OT V2 se valido con `OT-CHI-000001`. Despues de un reporte,
la OT mostro 27,25% de avance, 218 unidades OK, 582 pendientes y cerca de
cuatro horas restantes. Estos agregados quedaron guardados en la OT para que
la pantalla no tenga que reconstruirlos leyendo el historial de eventos.

El simulador de capacidad detecto `DT0005 - Perforacion 4 hoyos` como cuello
de botella, con 320 unidades pendientes y cuatro horas de trabajo. Manteniendo
dos turnos en los demas DT y ampliando solo `DT0005` a tres turnos, proyecto
un ahorro cercano a dos horas calendario. La configuracion piloto de Chile
quedo guardada con dos turnos base, tres ampliados y ocho horas efectivas.

El 13 de junio de 2026 el simulador se actualizo con calendarios por planta.
Chile muestra 42 horas efectivas semanales para el turno de mañana y 41,25
para el turno de tarde según los horarios informados; Peru usa 48 horas por
turno y un tercer turno de 22:00 a 06:00. La proyeccion omite los domingos.
El tercer turno de Chile usa 22:30-07:00 de lunes a miercoles y 21:15-07:00
de jueves a sabado. Descontando la colacion suma 51,75 horas de cobertura
efectiva semanal. Los turnos de ambas plantas son rotativos, por lo que las
horas ordinarias y extra se calcularan por operario cuando se incorpore su
programacion semanal.

El rol `tv` ingresa directamente al Dashboard V2. El ranking y los indicadores
diarios se obtienen desde un unico documento `resumenes_planta_turno`, evitando
leer sesiones y eventos historicos en cada actualizacion del televisor.

Las reglas V2 propuestas siguen separadas y no se han desplegado en produccion.

## Verificacion

- Las cuatro cuentas iniciaron sesion mediante la API de Firebase.
- Los cuatro tokens incluyeron los claims esperados.
- El supervisor inicio sesion en Hosting y llego al panel BBA.
- No hubo lecturas Firestore antes del login ni errores de consola despues.
- El jefe valido el calendario de Chile y `DT0005` continuo identificado como
  cuello de botella en la OT piloto.
