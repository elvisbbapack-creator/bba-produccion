# Nucleo productivo V2

La primera implementacion del modelo V2 vive en
`src/domain/produccionV2.js`. Es logica pura: no lee ni escribe Firestore y no
esta conectada a las pantallas de produccion actuales.

## Capacidades

- Validacion de catalogos MP y RF.
- Validacion de rutas y codigos unicos.
- Deteccion de dependencias inexistentes, propias o ciclicas.
- Verificacion de que cada RF tenga una operacion productora.
- Congelacion de una ruta para una cantidad concreta de OT.
- Calculo de cantidad requerida y pendiente.
- Registro acumulado de OK, defectos y reproceso.
- Disponibilidad de RF descontando consumo y descarte.
- Inicio parcial de operaciones por porcentaje y material disponible.

## Ejemplo verificado

El fixture `PCL0001` incluye:

```text
DT0001 Corte lateral 290
MP0001 -> RF0001

DT0005 Perforacion 4 hoyos
RF0001 -> RF0002
```

Para una OT de 100 productos y cuatro laterales por producto, ambas operaciones
quedan congeladas con 400 unidades requeridas. Perforacion puede comenzar al
20% de avance de corte si existe RF0001 disponible.

## Siguiente conexion

La interfaz V2 debera usar estas funciones antes de escribir:

```text
productos/{productoId}/rutas/{rutaId}
productos/{productoId}/rutas/{rutaId}/operaciones
ordenes_trabajo/{otId}/operaciones
```

Las colecciones heredadas continuan sin cambios hasta completar un piloto.
