# auris

App HTML autocontenida para transcribir canciones. Un solo archivo, `index.html`, sin dependencias ni servidor: se abre con doble click y se le arrastra el audio encima.

Creada el 2026-08-25. Nombrada `auris` (latin: el oido, y en Ciceron el criterio del oyente formado) el 2026-08-25.

## Decisiones

- Velocidad sin cambio de tono con `preservesPitch` del elemento audio, no con time-stretch propio.
- Reproduccion con `<audio>`, no con un grafo Web Audio: `preservesPitch` solo actua sobre el elemento. Web Audio se usa unicamente para `decodeAudioData` al calcular los picos.
- Picos precalculados a 128 muestras por pico. Cada columna de pixel agrega el rango que le corresponde.
- Canvas en `position:absolute` dentro de `#mainwrap`, medido con `ResizeObserver`. Motivo: con el canvas dimensionado por flex, escribir `canvas.height` realimentaba el layout y la altura derivaba en cada resize.
- Persistencia por archivo en localStorage, clave `nombre+tamano+duracion`: secciones, acordes, loop, velocidad y preservacion de tono.
- Color de acento en localStorage global, clave `transcript:accent`. Es preferencia, no va por archivo.
- Las claves de localStorage mantienen el prefijo `transcript:` despues del cambio de nombre. Renombrarlas a `auris:` habria dejado huerfanos los marcadores ya guardados por mykl al probar la app.
- Dos tipos de marcador en bandas propias: secciones con `M`, acordes con `C`. Bandas de 15 / 20 / 18 px para escala de tiempo, secciones y acordes.
- Etiquetas con reserva de hueco: si dos marcadores se pisarian, la segunda etiqueta no se dibuja y queda solo la marca.
- Atajos en modal sobre la onda en vez de panel fijo en el lateral, para no gastar espacio permanente.
- Teclas de transporte estilo JKL. `L` paso de ser loop on/off a seek adelante; el loop on/off se movio a `R`.

## Estado y pendientes

- Funcional. Confirmado por mykl el 2026-08-25.
- Verificacion hecha: `node --check` sobre el script extraido del HTML, y prueba en node de las funciones de color (`mix`, `rgba`).
- Verificacion NO hecha: prueba en navegador desde Claude Code. La extension de Chrome no conectaba en toda la sesion ("Browser extension is not connected"). Las pruebas de comportamiento las hizo mykl a mano.
- `1..9` salta solo a secciones, no a acordes. Planteado a mykl, sin decidir.
- Fuera de alcance, no solicitado: deteccion de tono o acordes, transposicion, export MIDI.
