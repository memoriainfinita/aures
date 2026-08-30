# Tempo grid: design

Diseno aprobado por mykl el 2026-08-30. Origen: la rejilla de compases con tap tempo aplazada ese mismo dia en `state.md`.

Problema que motiva el diseno: hay canciones cuya intro no empieza en el pulso 1, asi que una rejilla anclada en 0 nunca cuadra. El origen del tempo tiene que poder moverse.

## Modelo

```
S.tempo = [ {t, bpm, beats}, ... ]   // ordenado por t
```

- Cada anclaje gobierna desde su `t` hasta el `t` del siguiente, o hasta el final del audio.
- El `t` de un anclaje es el pulso 1 de un compas.
- Pulso k del tramo: `t + k*60/bpm`.
- Linea de compas cada `beats` pulsos. `beats` se declara por anclaje, por defecto 4.
- Antes del primer anclaje no se dibuja rejilla.
- En un cambio de tramo el compas se corta donde este. El anclaje nuevo reinicia el compas 1. No se cuadra el compas partido.
- La numeracion de compases cuenta compases completos desde el primer anclaje y sigue a traves de los tramos.

El desfase de la intro no es un parametro: es la posicion del anclaje. Mover el anclaje desplaza toda la rejilla de su tramo.

## Tap y ajuste

Tecla `T`, usando `audio.currentTime` en el momento de la pulsacion. La serie se corta tras 3 s sin golpes; el siguiente `T` abre un anclaje nuevo.

- Golpe 1: crea el anclaje en ese instante, con el BPM del tramo anterior, o 120 si no hay ninguno.
- Golpe 2 en adelante: `bpm = 60*(n-1)/(ultimo - primero)`. Se usan primero y ultimo, no el promedio de intervalos consecutivos, porque asi el error de la mano no se acumula: cuanto mas golpes, mas exacto.
- La rejilla se redibuja durante la serie.
- Barra de estado durante la serie: `tap 6 · 128.4 BPM`.

Ajuste fino sobre un anclaje existente:

- Arrastre en la banda de tempo: mueve `t`, no toca el BPM. Reutiliza el camino de `drag` de los marcadores con una variante propia.
- Lista lateral: campo de BPM, campo de pulsos por compas, botones `x2` y `/2`, boton de borrar.

`x2` y `/2` estan porque golpear a mitad de tiempo es lo normal.

## Dibujo

Cuarta banda `TMP = 14 px` entre la regla de tiempo y la de secciones. `LANE = RUL + TMP + SEC + CHO`. `bandAt()` gana un caso. Coste: 14 px permanentes de altura de onda.

`drawGrid()` se dibuja despues del fondo y antes de la onda, solo por debajo de `LANE`:

| Elemento | Color | Regla |
|---|---|---|
| Linea de compas | `#3c4658`, 1 px | siempre que el compas ocupe mas de ~4 px |
| Linea de pulso | `#2a3140`, 1 px | se omite si el espaciado cae por debajo de ~6 px |

Si el compas baja de ~4 px no se dibuja nada de ese tramo. No se usa el color de acento: ese es del cursor.

En la banda de tempo, cada anclaje: marca vertical y etiqueta `128 · 4/4`, con la misma reserva de hueco que ya usan las otras bandas. Numero de compas dibujado en la banda cuando quepa.

## Datos, deshacer, verificacion

- `snapshot()` anade `tempo: S.tempo`. `applyData()` lo lee con el mismo `Array.isArray` que `markers`.
- Un `.aures.json` anterior carga sin rejilla. Uno nuevo abierto en una version anterior ignora el campo. Sin migracion.
- `markerState()` pasa a `{markers, chords, tempo}`: `Ctrl+Z` deshace tambien los anclajes. Cambia la decision registrada el 2026-08-30 de limitar el deshacer a marcadores. Motivo: aquella excluia loop, velocidad y acento por ser estado de transporte, y un anclaje es anotacion estructural, del mismo tipo que un marcador.
- Verificacion: extraer `tempoSpans()`, `beatTimes()` y `bpmFromTaps()` como funciones puras y probarlas en node; `node --check` sobre el script extraido del HTML. El comportamiento lo prueba mykl a mano, como en las sesiones anteriores.

## Fuera de alcance

- Imantado de marcadores a la rejilla. Decidido el 2026-08-30: la rejilla es guia visual y no toca `addMarker` ni el arrastre de marcadores.
