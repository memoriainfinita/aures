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

El desfase de la intro no es un parametro: es la posicion del anclaje. Mover el anclaje desplaza toda la rejilla de su tramo.

### Rangos y validacion

| Campo | Valido | Fuera de rango |
|---|---|---|
| `bpm` | 30 a 300 | se recorta al limite |
| `beats` | entero de 1 a 16 | se recorta al limite |
| `t` | 0 a `duration` | se recorta al limite |

Un valor no numerico en un campo de la lista deja el anclaje como estaba.

El array se mantiene ordenado por `t`, como `markers` y `chords`. Dos anclajes pueden compartir `t`; el que quede segundo tras ordenar gobierna un tramo de duracion cero y no dibuja nada. No se impide.

### Numeracion de compases

Cuenta compases completos desde el primer anclaje y sigue a traves de los tramos. El compas que un anclaje nuevo deja cortado no se numera: el compas 1 del tramo nuevo recibe el numero siguiente al ultimo compas completo del tramo anterior.

## Tap y ajuste

Tecla `T`, usando `audio.currentTime` en el momento de la pulsacion. Verificado el 2026-08-30 contra el manejador de `keydown`: `t` esta libre.

La serie se corta tras 3 s sin golpes; el siguiente `T` abre un anclaje nuevo.

- Golpe 1: crea el anclaje en ese instante, con el BPM del tramo anterior, o 120 si no hay ninguno.
- Golpe 2 en adelante: `bpm = 60*(n-1)/(ultimo - primero)`. Se usan primero y ultimo, no el promedio de intervalos consecutivos, porque asi el error de la mano no se acumula: cuanto mas golpes, mas exacto.
- La rejilla se redibuja durante la serie.
- Barra de estado durante la serie: `tap 6 · 128.4 BPM`.
- Un golpe que deje el BPM fuera de 30 a 300 se ignora y no altera el anclaje. Cubre el caso de golpear con el audio parado, donde `audio.currentTime` no avanza y el intervalo seria cero.

`audio.currentTime` corre en tiempo del medio, no de reloj: con la velocidad a 0.5x el BPM derivado sigue siendo el de la cancion y no hay que corregirlo.

No se compensa la latencia entre lo que se oye y la llegada de la tecla. El anclaje queda desplazado de forma sistematica y se corrige arrastrandolo, que es el mismo gesto que resuelve la intro.

Ajuste fino sobre un anclaje existente:

- Arrastre en la banda de tempo: mueve `t`, no toca el BPM. Reutiliza el camino de `drag` de los marcadores con una variante propia: estado previo guardado en `pendingUndo` al `mousedown`, apilado en `mouseup` solo si hubo movimiento, `clamp` a `0..duration` y reordenacion del array.
- Doble click sobre un anclaje: loop desde ese anclaje hasta el siguiente, o hasta el final. Es lo que ya hace `loopSection` sobre las otras bandas y cae por el mismo `e.detail === 2`.
- Click en la banda de tempo lejos de todo anclaje: seek, como en el resto de bandas. La banda no crea anclajes con el raton; se crean con `T`.
- Lista lateral: campo de BPM, campo de pulsos por compas, botones `x2` y `/2`, boton de borrar. El borrado apila un paso de deshacer, como `delMarker`.

`x2` y `/2` estan porque golpear a mitad de tiempo es lo normal.

## Dibujo

Cuarta banda `TMP = 14 px` entre la regla de tiempo y la de secciones. `LANE = RUL + TMP + SEC + CHO`. `bandAt()` gana un caso. Coste: 14 px permanentes de altura de onda.

`drawGrid()` se dibuja despues del fondo y antes de la onda, solo por debajo de `LANE`:

| Elemento | Color | Regla |
|---|---|---|
| Linea de compas | `#3c4658`, 1 px | siempre que el compas ocupe mas de ~4 px |
| Linea de pulso | `#2a3140`, 1 px | se omite si el espaciado cae por debajo de ~6 px |

Si el compas baja de ~4 px no se dibuja nada de ese tramo. No se usa el color de acento: ese es del cursor.

Se itera solo sobre el rango visible, empezando en el primer pulso posterior a `view.s`, como ya hace `drawRuler`. La rejilla no se dibuja en el lienzo de vista general.

En la banda de tempo, cada anclaje: marca vertical y etiqueta `128 · 4/4`, con la misma reserva de hueco que ya usan las otras bandas. Numero de compas dibujado en la banda cuando quepa.

La banda de tempo no reutiliza `drawBand()` ni `renderList()`: ambas asumen la forma de `BANDS`, con un unico campo de nombre por elemento. La banda lleva `drawTempoBand()` y `renderTempoList()` propias. `BANDS` no cambia; `bandAt()` devuelve `"tmp"` para la franja nueva y quien consume `bandAt()` ignora ese caso salvo el codigo de tempo.

## HTML e interfaz

- Contenedor nuevo en el panel lateral para la lista de anclajes, con su titulo, junto a los de secciones y acordes.
- Modal de atajos: entrada para `T`.
- README: la rejilla entra en la descripcion de funciones. La captura se rehace contra `demo.mp3` si la banda nueva cambia lo que se ve.

## Datos, deshacer, verificacion

- `snapshot()` anade `tempo: S.tempo`. `applyData()` lo lee con el mismo `Array.isArray` que `markers`.
- Un `.aures.json` anterior carga sin rejilla. Uno nuevo abierto en una version anterior ignora el campo. Sin migracion.
- Todo cambio de tempo llama a `save()`, igual que los marcadores.
- `markerState()` pasa a `{markers, chords, tempo}`: `Ctrl+Z` deshace tambien los anclajes. Cambia la decision registrada el 2026-08-30 de limitar el deshacer a marcadores. Motivo: aquella excluia loop, velocidad y acento por ser estado de transporte, y un anclaje es anotacion estructural, del mismo tipo que un marcador.
- Una serie de taps es un solo paso de deshacer: se apila el estado previo al primer golpe, no uno por golpe. Una serie de veinte golpes vaciaria si no la pila de 50.
- Verificacion: extraer `tempoSpans()`, `beatTimes()` y `bpmFromTaps()` como funciones puras y probarlas en node; `node --check` sobre el script extraido del HTML. El comportamiento lo prueba mykl a mano, como en las sesiones anteriores.

## Fuera de alcance

- Imantado de marcadores a la rejilla. Decidido el 2026-08-30: la rejilla es guia visual y no toca `addMarker` ni el arrastre de marcadores.
- Compensacion de latencia del tap.
- Deteccion automatica de tempo a partir del audio.
