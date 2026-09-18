# Reglas de interpretación de planos para costeo

Estas reglas convierten decisiones de negocio repetibles en criterios verificables del Cotizador. Una regla específica de un proyecto no debe aplicarse automáticamente a otros planos.

## Reglas generales BBA

- Empaque: considerar por defecto **4 etiquetas por caja** para todos los clientes. El valor debe quedar visible y editable en la línea de cartón corrugado.
- Logística y costeo comparten una sola definición de empaque: las medidas exteriores se ingresan en **milímetros** y alimentan la propuesta de consumo de MP0048 — Cartón Corrugado 20C.
- La cantidad planificada de cajas por pallet se ingresa en Logística y alimenta la propuesta de consumo y cantidad necesaria de SUM0016 o SUM0038.
- Cuando un plano indique expresamente que las dimensiones de la caja son interiores, obtener las dimensiones exteriores sumando **10 mm a cada dimensión indicada** (largo, ancho y alto). No sumar 10 mm por lado salvo que el plano o el usuario lo solicite.
- Toda medida inferida o transformada debe quedar identificada en la descripción técnica de la cotización.

## Regla específica: Modular 5N60 H155

- Para esta cotización, reemplazar el perfil cuadrado de **1/2 pulgada calibre 18** indicado en el plano por **MP0001 — Tubo 15×15×1 mm**.
- El marco de los dos laterales se costea con la expresión `(1214+1214+317+317)*2`, equivalente a 6,124 m de tubo antes de merma.
- Las medidas interiores de caja 600×300×1250 mm se registran como medidas exteriores 610×310×1260 mm.
- Considerar 2 exhibidores y 4 etiquetas por caja.

## Control de calidad

- Mantener la cotización con confianza baja mientras falten materiales, suministros o procesos estructurales del plano.
- No inventar el costo de una etiqueta ni de otro insumo ausente del catálogo. Primero debe existir un ítem con unidad y precio vigentes.
