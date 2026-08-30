# aures

App HTML autocontenida para transcribir canciones. Un solo archivo, `index.html`, sin dependencias ni servidor: se abre con doble click y se le arrastra el audio encima.

Creada el 2026-08-25. Nombrada `aures` el 2026-08-25: plural de auris, los oidos, y en latin clasico la facultad de oir y el juicio de quien la tiene educada (`aures eruditae`). Se descarto el singular `auris` porque designa el organo, no el oido musical.

## Decisiones

- Velocidad sin cambio de tono con `preservesPitch` del elemento audio, no con time-stretch propio.
- Reproduccion con `<audio>`, no con un grafo Web Audio: `preservesPitch` solo actua sobre el elemento. Web Audio se usa unicamente para `decodeAudioData` al calcular los picos.
- Picos precalculados a 128 muestras por pico. Cada columna de pixel agrega el rango que le corresponde.
- Canvas en `position:absolute` dentro de `#mainwrap`, medido con `ResizeObserver`. Motivo: con el canvas dimensionado por flex, escribir `canvas.height` realimentaba el layout y la altura derivaba en cada resize.
- Persistencia por archivo en localStorage, clave `nombre+tamano+duracion`: secciones, acordes, loop, velocidad y preservacion de tono.
- Color de acento en localStorage global, clave `aures:accent`. Es preferencia, no va por archivo.
- Las claves de localStorage usan el prefijo `aures:`. Renombradas desde `transcript:` el 2026-08-30, sin migracion: mykl confirmo que no habia marcadores guardados.
- Dos tipos de marcador en bandas propias: secciones con `M`, acordes con `C`. Bandas de 15 / 20 / 18 px para escala de tiempo, secciones y acordes.
- Etiquetas con reserva de hueco: si dos marcadores se pisarian, la segunda etiqueta no se dibuja y queda solo la marca.
- Atajos en modal sobre la onda en vez de panel fijo en el lateral, para no gastar espacio permanente.
- Teclas de transporte estilo JKL. `L` paso de ser loop on/off a seek adelante; el loop on/off se movio a `R`.

- Licencia GPL-3.0-or-later, elegida por mykl el 2026-08-25. Texto canonico descargado de gnu.org, no transcrito.
- Repo publico: GitHub Pages no sirve repos privados sin plan de pago.
- `1..9` navega solo secciones, no acordes. Decidido el 2026-08-30. Las dos bandas se guardan ordenadas por tiempo, asi que `1..9` es "ir a la seccion n" en orden de cancion. Los acordes son densos: nueve teclas solo alcanzarian los primeros compases. El acceso por acorde ya existe y es mejor, el doble click hace loop hasta el siguiente marcador en las dos bandas.
- Interfaz y comentarios del codigo en ingles. Traducidos desde espanol el 2026-08-30: 49 cadenas de interfaz y 48 comentarios. Motivo: repo publico con README en ingles. Los identificadores ya estaban en ingles, no se toco ninguno.
- `demo.mp3` incluido en el repo: 40 s sinteticos generados con un script propio el 2026-08-30, sin derechos de terceros. Permite probar la app sin aportar audio y es la fuente de las capturas.
- `screenshot.png` en el README, generado contra `demo.mp3`. Las capturas nunca se hacen contra audio real.
- Guardar y cargar por archivo `.aures.json`, uno por cancion, arrastrable sobre la ventana igual que el audio. Decidido el 2026-08-30 porque localStorage no cruza de maquina.
- El documento importado se valida contra `size` y `duration` del audio abierto, con 0.05 s de tolerancia, nunca contra el nombre: renombrar el mp3 no debe romper la correspondencia. Si no coinciden, no se importa nada y se avisa en la barra de estado.
- `snapshot()` y `applyData()` compartidos por localStorage y por el archivo: un solo formato de datos, no dos.
- Deshacer y rehacer de anotacion estructural, pila de 50 instantaneas de `{markers, chords, tempo}`. El loop, la velocidad, el acento y las bandas visibles quedan fuera a proposito: incluirlos haria `Ctrl+Z` impredecible a mitad de transcripcion, deshaciendo un arrastre de loop cuando lo que se quiere deshacer es un borrado. Los anclajes de tempo si entran porque son anotacion, del mismo tipo que un marcador. Sin boton: `Ctrl+Z`, `Ctrl+Shift+Z` y tambien `Ctrl+Y`.
- El arrastre de un marcador guarda su estado previo en un pendiente al `mousedown` y solo lo apila en `mouseup` si `moved`: un click simple sobre un marcador hace seek y no debe dejar un paso de deshacer vacio.

- Rejilla de compases sobre anclajes de tempo, `S.tempo = [{t, bpm, beats}]`. Cada anclaje gobierna hasta el siguiente y su `t` es el pulso 1 de un compas. El desfase de una intro que no empieza en el pulso 1 no es un parametro: es la posicion del anclaje, y se arregla arrastrandolo. Diseno completo en `docs/2026-08-30-tempo-grid-design.md`, plan en `docs/2026-08-30-tempo-grid-plan.md`.
- La rejilla es guia visual y no imanta. No toca `addMarker()` ni el arrastre de marcadores.
- Sin denominador de cifra de compas: no cambia donde caen las lineas, que es lo unico que se dibuja. La etiqueta de un anclaje es `128 · 4`.
- El BPM del tap sale del primer y ultimo golpe, no del promedio de intervalos: asi el error de la mano no se acumula y mas golpes dan mas precision. Fuera de 30 a 300 el golpe se descarta.
- El corte de serie del tap va por reloj de pared, `performance.now()`, no por `audio.currentTime`: con el audio parado el tiempo del medio no avanza y la serie no caducaria nunca. Los valores del tap si salen de `audio.currentTime`, que corre en tiempo del medio y da el BPM correcto aunque se escuche a 0.5x.
- La latencia entre lo que se oye y la llegada de la tecla no se compensa. El desplazamiento es sistematico y se corrige arrastrando el anclaje, que es el mismo gesto que resuelve la intro.
- Las bandas de tempo, secciones y acordes se ocultan y se muestran. Al ocultar, la banda colapsa y la onda gana su alto: `laneLayout()` recalcula el apilado y `LANE` dejo de ser constante. Ocultar el tempo oculta tambien la rejilla, que es el ruido que se quiere quitar.
- Que bandas se ven es preferencia global en `aures:lanes`, junto a `aures:accent`, y no entra en `snapshot()`: lo que miras no es propiedad de la cancion y no debe viajar en el `.aures.json`.
- `Shift+M`, `Shift+C` y `Shift+T` ocultan; la minuscula sigue anadiendo o tapeando. Se comprueba `e.shiftKey`, no la caja de la letra, para que Bloq Mayus no invierta las dos acciones. Anadir sobre una banda oculta la vuelve a mostrar, porque si no la tecla parece no hacer nada.
- Primera prueba automatica del proyecto: `tools/tempo.test.mjs`, sin framework ni dependencias. Extrae el bloque puro de `index.html` por los centinelas `PURE-TEMPO-START` y `PURE-TEMPO-END` y lo corre en node. 26 aserciones. Todo lo que se pueda calcular sin lienzo ni DOM vive dentro de esos centinelas.
- Los documentos de diseno y plan viven en `docs/`, y sus versiones anteriores en `docs/.backups/`.

## Estado y pendientes

- Funcional. Confirmado por mykl el 2026-08-25.
- Publicado el 2026-08-25 en https://github.com/memoriainfinita/aures. Repo publico, rama `main`.
- GitHub Pages sirviendo desde la raiz de `main`: https://memoriainfinita.github.io/aures/. Sin workflow ni build; cada push actualiza la app. La primera construccion tardo 230 s en responder.
- Comprobado el 2026-08-25: el HTML que sirve Pages es identico byte a byte al local, y la build quedo en estado `built` sin errores.
- Verificacion hecha: `node --check` sobre el script extraido del HTML, `node tools/tempo.test.mjs` con 26 aserciones en verde, y prueba en node de las funciones de color (`mix`, `rgba`).
- La rejilla, el tap y la ocultacion de bandas: probados a mano por mykl el 2026-08-30, funcionan.
- Pruebas de comportamiento hechas a mano por mykl. La extension de Chrome no conectaba, ni el 2026-08-25 ni el 2026-08-30.
- Publicado el 2026-08-30: `bd2aa4e..ec4fde8` empujado a `main`. Pages reconstruye sola en cada push. Comprobado ese dia: el HTML servido pesa lo mismo que el local, 56201 bytes, y contiene los centinelas y `laneLayout`.
- `screenshot.png` rehecha por mykl el 2026-08-30 contra `demo.mp3`, 1920x936: tres anclajes de tempo (120, 60, 120), la rejilla cambiando de paso en cada uno, la numeracion de compases siguiendo a traves de los tramos, y un loop activo.

## Pendientes

- Fuera de alcance por decision, no por olvido: compensacion de latencia del tap, deteccion automatica de tempo a partir del audio, denominador de la cifra de compas, e imantado de marcadores a la rejilla.
- Descartados el 2026-08-30, no volver sobre ellos sin motivo nuevo: heredar el nombre del acorde anterior al crear uno, y exportar el cifrado como texto.
