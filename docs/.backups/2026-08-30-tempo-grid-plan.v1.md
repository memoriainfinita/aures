# Tempo grid implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dibujar una rejilla de compases sobre la onda, con anclajes de tempo que se crean golpeando el pulso y se ajustan arrastrandolos, para que una intro que no empieza en el pulso 1 no impida cuadrar la rejilla.

**Architecture:** `S.tempo` es una lista de anclajes ordenada por tiempo; cada uno gobierna hasta el siguiente. Toda la aritmetica vive en tres funciones puras al principio del script, delimitadas por comentarios centinela para que un script de node las extraiga y las pruebe. El resto es dibujo sobre el lienzo existente y una banda nueva que no reutiliza `BANDS`.

**Tech Stack:** HTML, CSS y JavaScript en un unico archivo `index.html`, sin dependencias ni build. Node solo para las pruebas y la comprobacion de sintaxis.

**Spec:** `docs/2026-08-30-tempo-grid-design.md`

## Global Constraints

- Un solo archivo entregable: `index.html`. Nada de dependencias, imports ni servidor.
- Interfaz y comentarios del codigo en ingles. Identificadores en ingles.
- `bpm` valido de 30 a 300. `beats` entero de 1 a 16. `t` de 0 a `duration`.
- `x2` y `/2` no recortan: si el resultado sale de rango no se aplica nada y se avisa.
- La rejilla es guia visual. No toca `addMarker()` ni el arrastre de marcadores.
- El modelo no tiene denominador de compas. La etiqueta de un anclaje es `128 · 4`, nunca `128 · 4/4`.
- Colores fijados por el spec: compas `#3c4658`, pulso `#2a3140`. El color de acento no se usa en la rejilla.
- Cada tarea termina en commit.

## Dos correcciones al spec, decididas al planificar

1. **El corte de serie de 3 s va por reloj de pared, no por tiempo de audio.** El spec dice "3 s sin golpes" sin decir que reloj. Con `audio.currentTime`, si el audio esta parado el tiempo no avanza, la serie no caduca nunca y no se puede empezar un anclaje nuevo. Los valores del tap salen de `audio.currentTime`; el temporizador de corte sale de `performance.now()`.
2. **Son dos sitios con guarda, no tres.** El spec lista `mousedown`, el `mousemove` del cursor y `loopSection()`. Con la rama de tempo saliendo por `return` al principio del `mousedown`, `loopSection()` nunca recibe `"tmp"` y no necesita guarda. El loop de un tramo va en `loopSpan()`, funcion propia.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `index.html` | toda la app. Se toca en siete sitios: estado, matematica pura, geometria de bandas, dibujo, teclado, raton y panel |
| `tools/tempo.test.mjs` | crear. Extrae el bloque puro de `index.html` y lo prueba. Unica prueba automatica del proyecto |
| `docs/2026-08-30-tempo-grid-design.md` | ya existe. Contrato de este plan |

Comprobacion de sintaxis usada en varias tareas, verificada el 2026-08-30 contra el `index.html` actual:

```bash
f="$(mktemp -d)/aures.js" && sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > "$f" && node --check "$f" && echo "check OK"
```

---

### Task 1: Matematica pura del tempo

Unica tarea con pruebas automaticas. Todo lo que se pueda calcular sin lienzo ni DOM vive aqui, para que las tareas siguientes solo dibujen.

**Files:**
- Modify: `index.html` (bloque nuevo justo antes de `/* ---------- canvas ---------- */`, linea 514)
- Create: `tools/tempo.test.mjs`

**Interfaces:**
- Produces:
  - `BPM_MIN = 30`, `BPM_MAX = 300`, `BEATS_MIN = 1`, `BEATS_MAX = 16`
  - `clampBpm(v) -> number`
  - `clampBeats(v) -> number` entero
  - `tempoSpans(anchors, duration) -> [{t, e, bpm, beats, bar}]` ordenado por `t`
  - `beatTimes(span, t0, t1) -> [{t, downbeat, bar}]`
  - `bpmFromTaps(taps) -> number | null`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tools/tempo.test.mjs`:

```js
// extracts the pure tempo block out of index.html and exercises it.
// no framework: node tools/tempo.test.mjs
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.split("/* PURE-TEMPO-START */")[1];
if(src === undefined) throw new Error("PURE-TEMPO-START marker not found in index.html");
const body = src.split("/* PURE-TEMPO-END */")[0];
const M = new Function(body + `
  return {BPM_MIN, BPM_MAX, clampBpm, clampBeats, tempoSpans, beatTimes, bpmFromTaps};`)();

let fails = 0;
function eq(name, got, want){
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if(a === b){ console.log("ok   " + name); return; }
  fails++;
  console.error("FAIL " + name + "\n  got  " + a + "\n  want " + b);
}
function near(name, got, want){
  if(got !== null && Math.abs(got - want) < 1e-6){ console.log("ok   " + name); return; }
  fails++;
  console.error("FAIL " + name + "\n  got  " + got + "\n  want " + want);
}

// bpmFromTaps: first and last tap only
near("120 bpm from five even taps", M.bpmFromTaps([0, .5, 1, 1.5, 2]), 120);
near("uneven middle taps do not move the result", M.bpmFromTaps([0, .6, 1, 1.4, 2]), 120);
eq("one tap is not a tempo", M.bpmFromTaps([1]), null);
eq("paused audio: every tap on the same instant", M.bpmFromTaps([3, 3, 3]), null);
eq("rewinding mid series gives a negative span", M.bpmFromTaps([10, 2]), null);
eq("above 300 bpm is refused", M.bpmFromTaps([0, .1]), null);
eq("below 30 bpm is refused", M.bpmFromTaps([0, 3]), null);

// tempoSpans: each anchor ends where the next begins
eq("no anchors, no spans", M.tempoSpans([], 40), []);
eq("a single anchor runs to the end", M.tempoSpans([{t:2, bpm:120, beats:4}], 40),
   [{t:2, e:40, bpm:120, beats:4, bar:1}]);
eq("the second anchor cuts the first and restarts the bar",
   M.tempoSpans([{t:2, bpm:120, beats:4}, {t:12, bpm:60, beats:3}], 40),
   [{t:2, e:12, bpm:120, beats:4, bar:1}, {t:12, e:40, bpm:60, beats:3, bar:6}]);
eq("the bar an anchor cuts short is not numbered",
   M.tempoSpans([{t:2, bpm:120, beats:4}, {t:13, bpm:60, beats:3}], 40)[1].bar, 6);
eq("anchors are sorted before anything else",
   M.tempoSpans([{t:12, bpm:60, beats:3}, {t:2, bpm:120, beats:4}], 40)[0].t, 2);

// beatTimes: window, downbeats and bar numbers
const sp = {t:2, e:6, bpm:120, beats:4, bar:1};
eq("beats of a four second span at 120", M.beatTimes(sp, 0, 40).map(b => b.t),
   [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
eq("downbeats every four beats", M.beatTimes(sp, 0, 40).filter(b => b.downbeat).map(b => b.t),
   [2, 4, 6]);
eq("bar numbers advance on the downbeat", M.beatTimes(sp, 0, 40).filter(b => b.downbeat).map(b => b.bar),
   [1, 2, 3]);
eq("the window clips the head", M.beatTimes(sp, 3.2, 40).map(b => b.t), [3.5, 4, 4.5, 5, 5.5, 6]);
eq("a window outside the span is empty", M.beatTimes(sp, 20, 30), []);

// clamps
eq("bpm clamps low", M.clampBpm(10), 30);
eq("bpm clamps high", M.clampBpm(900), 300);
eq("beats round and clamp", [M.clampBeats(3.4), M.clampBeats(0), M.clampBeats(99)], [3, 1, 16]);

console.log(fails ? fails + " failing" : "all passing");
process.exit(fails ? 1 : 0);
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `node tools/tempo.test.mjs`
Expected: FAIL con `Error: PURE-TEMPO-START marker not found in index.html`

- [ ] **Step 3: Escribir el bloque puro**

En `index.html`, insertar antes de la linea `/* ---------- canvas ---------- */`:

```js
/* ---------- tempo math ---------- */
// pure: no DOM, no canvas, no S. tools/tempo.test.mjs pulls this block out
// by the markers below and runs it in node. keep it that way.
/* PURE-TEMPO-START */
const BPM_MIN = 30, BPM_MAX = 300, BEATS_MIN = 1, BEATS_MAX = 16;

function clampBpm(v){ return Math.min(BPM_MAX, Math.max(BPM_MIN, v)); }
function clampBeats(v){ return Math.min(BEATS_MAX, Math.max(BEATS_MIN, Math.round(v))); }

// anchors to spans: each one ends where the next begins, and carries the bar
// number it starts on. only whole bars are counted, so the bar an anchor cuts
// short does not add to the numbering.
function tempoSpans(anchors, duration){
  const a = anchors.slice().sort((x, y) => x.t - y.t);
  const out = [];
  let bar = 1;
  for(let i = 0; i < a.length; i++){
    const s = a[i];
    const e = Math.max(s.t, i + 1 < a.length ? a[i+1].t : duration);
    out.push({t:s.t, e, bpm:s.bpm, beats:s.beats, bar});
    bar += Math.floor((e - s.t) / ((60 / s.bpm) * s.beats) + 1e-9);
  }
  return out;
}

// beats of one span inside [t0,t1]. downbeat marks the first beat of a bar
function beatTimes(span, t0, t1){
  const dt = 60 / span.bpm;
  const from = Math.max(span.t, t0), to = Math.min(span.e, t1);
  const out = [];
  if(to < from) return out;
  let k = Math.max(0, Math.ceil((from - span.t) / dt - 1e-9));
  for(let t = span.t + k*dt; t <= to + 1e-9; k++, t = span.t + k*dt){
    out.push({t, downbeat: k % span.beats === 0, bar: span.bar + Math.floor(k / span.beats)});
  }
  return out;
}

// first and last tap, never the mean of the gaps: that way the error of a hand
// does not pile up and more taps mean more precision. out of range means the
// tap is worthless (paused audio, a rewind mid series) and the caller drops it
function bpmFromTaps(taps){
  if(taps.length < 2) return null;
  const span = taps[taps.length - 1] - taps[0];
  if(span <= 0) return null;
  const bpm = 60 * (taps.length - 1) / span;
  return (bpm < BPM_MIN || bpm > BPM_MAX) ? null : bpm;
}
/* PURE-TEMPO-END */
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `node tools/tempo.test.mjs`
Expected: PASS, 20 lineas `ok` y `all passing`. Verificado el 2026-08-30 ejecutando este mismo bloque y esta misma prueba fuera del repo.

- [ ] **Step 5: Commit**

```bash
git add index.html tools/tempo.test.mjs
git commit -m "feat: pure tempo math with node tests"
```

---

### Task 2: Estado, persistencia y deshacer

Los anclajes existen en memoria, se guardan, se cargan y se deshacen. Todavia no se ven.

**Files:**
- Modify: `index.html:294-302` (objeto `S`), `index.html:320-324` (`load()`), `index.html:398-415` (`snapshot()` y `applyData()`), `index.html:487` (`markerState()`), `index.html:495-500` (`applyMarkerState()`)

**Interfaces:**
- Consumes: nada de la tarea 1.
- Produces: `S.tempo` como array de `{t, bpm, beats}`; el campo `tempo` en el formato de `snapshot()`.

- [ ] **Step 1: Anadir el campo al estado**

En `index.html:299-301`, junto a los otros dos arrays:

```js
  markers:[],                                      // sections
  chords:[],                                       // chords
  tempo:[],                                        // tempo anchors: {t, bpm, beats}
  follow:true
```

- [ ] **Step 2: Resetear al abrir otro audio**

En `load()`, la linea que hoy es:

```js
  S.markers = []; S.chords = []; S.loop = {on:false, s:null, e:null};
```

pasa a:

```js
  S.markers = []; S.chords = []; S.tempo = []; S.loop = {on:false, s:null, e:null};
```

Sin esto la rejilla de la cancion anterior sobrevive a abrir otra.

- [ ] **Step 3: Meterlo en el unico formato de datos**

En `snapshot()`, anadir el campo:

```js
function snapshot(){
  return {
    markers: S.markers,
    chords: S.chords,
    tempo: S.tempo,
    loop: S.loop,
    rate: audio.playbackRate,
    pitch: $("pitch").checked
  };
}
```

En `applyData()`, leerlo igual que los otros arrays, de forma que un documento sin el campo deje la lista vacia:

```js
  S.markers = Array.isArray(d.markers) ? d.markers : [];
  S.chords  = Array.isArray(d.chords)  ? d.chords  : [];
  S.tempo   = Array.isArray(d.tempo)   ? d.tempo   : [];
```

- [ ] **Step 4: Meterlo en el deshacer**

`markerState()` pasa a:

```js
function markerState(){ return JSON.stringify({markers:S.markers, chords:S.chords, tempo:S.tempo}); }
```

Y `applyMarkerState()` restaura tambien el campo. `d.tempo` puede faltar si el paso se apilo antes de este cambio dentro de la misma sesion:

```js
function applyMarkerState(json){
  const d = JSON.parse(json);
  S.markers = d.markers;
  S.chords  = d.chords;
  S.tempo   = d.tempo || [];
  renderAll(); refresh(); draw(); save();
}
```

- [ ] **Step 5: Comprobar sintaxis y comportamiento**

Run: el comando de `node --check` de la cabecera del plan
Expected: `check OK`

A mano, con `demo.mp3` abierto y la consola del navegador:

1. `S.tempo.push({t:5, bpm:120, beats:4})` y luego `save()`.
2. Recargar la pagina, volver a abrir `demo.mp3`, comprobar que `S.tempo` tiene el anclaje.
3. Pulsar `S` para exportar y abrir el `.aures.json`: debe tener la clave `tempo`.
4. Abrir un `.aures.json` viejo, de los que no tienen `tempo`: debe cargar sin error y dejar `S.tempo` en `[]`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: carry tempo anchors through state, storage and undo"
```

---

### Task 3: Geometria de la banda

Aparece la cuarta franja, vacia, y el raton deja de reventar sobre ella.

**Files:**
- Modify: `index.html:521-537` (constantes de banda y `BANDS`), `index.html:564-568` (`bandAt()`), `index.html:858-880` (`mousedown`), `index.html:936-953` (`mousemove` del cursor), `index.html:691-700` (fondos de `drawMain()`)

**Interfaces:**
- Consumes: nada.
- Produces: constante `TMP`, `bandAt()` devolviendo `"tmp"`.

- [ ] **Step 1: Insertar la banda entre la regla y las secciones**

Las constantes pasan a:

```js
// top lanes, in CSS px, stacked from the top down
const RUL = 15;                                    // time ruler
const TMP = 14;                                    // tempo anchors
const SEC = 20;                                    // section markers
const CHO = 18;                                    // chord markers
const LANE = RUL + TMP + SEC + CHO;                // total height: the waveform starts here
```

`BANDS` no cambia de forma, pero sus alturas se recalculan solas si estan escritas contra las constantes. Comprobar que quedan asi:

```js
const BANDS = {
  sec: {y0:RUL+TMP, y1:RUL+TMP+SEC, key:"markers", fill:"#ffb300", text:"#ffcf62",
        flag:true,  list:"mlist", ph:"section",
        empty:"No sections yet. Press M while playing."},
  cho: {y0:RUL+TMP+SEC, y1:LANE,  key:"chords",  fill:"#3ddc97", text:"#9af0c8",
        flag:false, list:"clist", ph:"chord",
        empty:"No chords yet. Press C while playing."}
};
```

- [ ] **Step 2: Ensenar la franja nueva a `bandAt()`**

```js
function bandAt(y){
  if(y >= RUL && y < RUL+TMP) return "tmp";
  if(y >= BANDS.sec.y0 && y < BANDS.sec.y1) return "sec";
  if(y >= BANDS.cho.y0 && y < BANDS.cho.y1) return "cho";
  return null;
}
```

- [ ] **Step 3: Guarda en el `mousedown`**

`bandAt()` devuelve ahora un valor que no existe en `BANDS`, y la linea siguiente hace `S[BANDS[band].key]`. Sin esta rama, un click en la franja nueva lanza `TypeError`. La rama definitiva llega en la tarea 6; de momento solo hace seek:

```js
  const band = bandAt(y);
  if(band === "tmp"){ seek(t); return; }
  if(band){
    const arr = S[BANDS[band].key];
```

- [ ] **Step 4: Guarda en el `mousemove` del cursor**

Mismo acceso, mismo `TypeError`, esta vez con solo pasar el raton por encima:

```js
  const band = bandAt(y);
  const onMark = band && band !== "tmp" && nearestMarker(S[BANDS[band].key], t, tolT) >= 0;
```

- [ ] **Step 5: Pintar el fondo de la franja**

En `drawMain()`, los fondos de banda pasan a incluir la nueva, con las franjas de secciones y acordes desplazadas:

```js
  mx2.fillStyle = "#131519"; mx2.fillRect(0, 0, w, RUL*dpr);
  mx2.fillStyle = "#151821"; mx2.fillRect(0, RUL*dpr, w, TMP*dpr);
  mx2.fillStyle = "#181b22"; mx2.fillRect(0, (RUL+TMP)*dpr, w, SEC*dpr);
  mx2.fillStyle = "#141a18"; mx2.fillRect(0, (RUL+TMP+SEC)*dpr, w, CHO*dpr);
  mx2.fillStyle = "#23262e";
  mx2.fillRect(0, RUL*dpr, w, dpr);
  mx2.fillRect(0, (RUL+TMP)*dpr, w, dpr);
  mx2.fillRect(0, (RUL+TMP+SEC)*dpr, w, dpr);
  mx2.fillRect(0, LANE*dpr - dpr, w, dpr);
```

- [ ] **Step 6: Comprobar**

Run: el comando de `node --check`
Expected: `check OK`

A mano, con `demo.mp3` abierto:

1. Se ve una franja vacia entre la regla de tiempo y la de secciones.
2. Pasar el raton por esa franja no lanza nada en la consola.
3. Click en esa franja: mueve el cursor de reproduccion.
4. Los marcadores de seccion y acorde que ya hubiera siguen cayendo en su franja y se pueden arrastrar.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add the tempo lane to the canvas geometry"
```

---

### Task 4: Dibujo de la rejilla y de la banda

**Files:**
- Modify: `index.html` (funciones nuevas junto a `drawBand()`, linea 656), `index.html:634-655` (`drawRuler()`), `index.html:691-732` (`drawMain()`)

**Interfaces:**
- Consumes: `tempoSpans()`, `beatTimes()` de la tarea 1; `S.tempo` de la tarea 2; `TMP`, `LANE` de la tarea 3.
- Produces: `visibleSpans(v) -> [span]`, `drawGrid(w, h, v, spans)`, `drawTempoBand(w, h, v, spans)`, `coveredBy(spans, t) -> boolean`.

- [ ] **Step 1: Escribir las tres funciones de dibujo**

Insertar antes de `function drawMain(){`:

```js
// spans that will actually draw a grid at this zoom. computed once per frame:
// the ruler needs the same list to know where to stay out of the way
function visibleSpans(v){
  const out = [];
  if(!S.tempo.length || !S.duration) return out;
  const w = mc.width;
  for(const sp of tempoSpans(S.tempo, S.duration)){
    if(sp.e <= v.s || sp.t >= v.e || sp.e <= sp.t) continue;
    const barPx = ((60 / sp.bpm) * sp.beats / (v.e - v.s)) * w;
    if(barPx < 4*dpr) continue;                    // too dense to mean anything
    sp.barPx = barPx;
    out.push(sp);
  }
  return out;
}

function coveredBy(spans, t){
  for(const s of spans) if(t >= s.t && t <= s.e) return true;
  return false;
}

// bar and beat lines, under the waveform. never the accent colour: that is the cursor
function drawGrid(w, h, v, spans){
  for(const sp of spans){
    const showBeats = (sp.barPx / sp.beats) >= 6*dpr;
    const showNums  = sp.barPx >= 40*dpr;
    for(const b of beatTimes(sp, v.s, v.e)){
      if(!b.downbeat && !showBeats) continue;
      const x = Math.round(timeToX(b.t, w, v));
      mx2.fillStyle = b.downbeat ? "#3c4658" : "#2a3140";
      mx2.fillRect(x, LANE*dpr, dpr, h - LANE*dpr);
      if(b.downbeat && showNums){
        mx2.fillStyle = "#59627a";
        mx2.font = (9*dpr) + "px ui-monospace,monospace";
        mx2.textBaseline = "middle";
        mx2.fillText(b.bar, x + 3*dpr, (RUL + TMP/2)*dpr);
      }
    }
  }
}

// the anchors themselves, over the bar numbers, with the same gap reservation
// the other lanes use
function drawTempoBand(w, h, v){
  if(!S.tempo.length) return;
  const y0 = RUL*dpr, y1 = (RUL+TMP)*dpr, hh = y1 - y0;
  mx2.font = (10*dpr) + "px ui-sans-serif,system-ui,sans-serif";
  mx2.textBaseline = "middle";
  let lastRight = -1e9;
  for(const a of S.tempo){
    const x = timeToX(a.t, w, v);
    if(x < -80*dpr || x > w + 80*dpr) continue;
    mx2.fillStyle = "#8ea2c6";
    mx2.fillRect(x, y0, 2*dpr, hh);
    mx2.fillStyle = "rgba(142,162,198,.22)";
    mx2.fillRect(x, LANE*dpr, dpr, h - LANE*dpr);
    const label = Math.round(a.bpm) + " · " + a.beats;
    const tw = mx2.measureText(label).width;
    const lx = x + 5*dpr;
    if(lx < lastRight + 3*dpr) continue;           // no gap: only the tick is drawn
    lastRight = lx + tw + 6*dpr;
    mx2.fillStyle = "rgba(14,15,18,.88)";
    mx2.fillRect(lx, y0 + dpr, tw + 6*dpr, hh - 2*dpr);
    mx2.fillStyle = "#b9c8e0";
    mx2.fillText(label, lx + 3*dpr, y0 + hh/2);
  }
}
```

- [ ] **Step 2: Callar la linea larga de la regla donde hay rejilla**

Sin esto se acumulan tres familias de lineas verticales sobre la onda. `drawRuler()` recibe la lista de tramos y conserva siempre su marca corta:

```js
function drawRuler(ctx, w, v, h, spans){
```

y dentro del bucle, la linea larga pasa a ser condicional:

```js
    ctx.beginPath(); ctx.moveTo(x, (RUL-4)*dpr); ctx.lineTo(x, RUL*dpr); ctx.stroke();
    if(!coveredBy(spans, t)){
      ctx.beginPath(); ctx.moveTo(x, LANE*dpr); ctx.lineTo(x, h); ctx.stroke();
    }
```

- [ ] **Step 3: Encajarlo en el orden de dibujo**

En `drawMain()`, despues de `if(!S.duration) return;`. La rejilla va bajo la onda; la banda va sobre el fondo de su franja:

```js
  const spans = visibleSpans(v);
  drawRuler(mx2, w, v, h, spans);
  drawGrid(w, h, v, spans);
```

y la banda de tempo se dibuja junto a las otras dos, despues de `drawWave`:

```js
  drawTempoBand(w, h, v);
  drawBand("cho", w, h, v);
  drawBand("sec", w, h, v);
```

- [ ] **Step 4: Comprobar**

Run: el comando de `node --check`
Expected: `check OK`

A mano, con `demo.mp3` abierto y la consola:

1. `S.tempo = [{t:1.2, bpm:120, beats:4}]; draw();`
2. Se dibujan lineas de compas mas claras y lineas de pulso mas oscuras a partir de 1.2 s, y nada antes.
3. En la banda de tempo aparece la marca y la etiqueta `120 · 4`.
4. Alejar el zoom con la flecha abajo hasta que los pulsos desaparezcan y queden solo los compases, y despues hasta que no quede nada. No debe aparecer una masa de lineas solidas.
5. Con el zoom cerca, la regla de tiempo ya no dibuja su linea larga sobre la onda, pero conserva su marca corta y su etiqueta.
6. `S.tempo = [{t:1.2, bpm:120, beats:4}, {t:9, bpm:90, beats:3}]; draw();` La rejilla cambia de paso en 9 s y la numeracion de compases sigue subiendo.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: draw the tempo grid and the anchor lane"
```

---

### Task 5: Tap tempo

**Files:**
- Modify: `index.html` (funciones nuevas junto a `addMarker()`, linea 968), `index.html:1064-1120` (manejador de `keydown`)

**Interfaces:**
- Consumes: `bpmFromTaps()`, `clampBpm()` de la tarea 1; `S.tempo` de la tarea 2.
- Produces: `spanAt(t) -> anchor | null`, `tap()`, `renderTempoList()` se llama pero se define en la tarea 6.

- [ ] **Step 1: Marcador temporal de la lista**

`tap()` llama a `renderTempoList()`, que llega en la tarea 6. Para que esta tarea sea ejecutable sola, definir el hueco junto a `renderAll()`:

```js
function renderTempoList(){}                       // filled in with the side panel
```

- [ ] **Step 2: Escribir el tap**

Insertar despues de `loopSection()`:

```js
/* ---------- tempo ---------- */

// the anchor governing this instant, to inherit its bpm and beats
function spanAt(t){
  let out = null;
  for(const a of S.tempo) if(a.t <= t && (!out || a.t > out.t)) out = a;
  return out;
}

// a series is a run of taps. it closes after 3 s without one, by wall clock and
// not by audio time: with the audio paused currentTime never advances and the
// series would never expire
let taps = [], tapAnchor = null, tapWall = 0;
const TAP_GAP = 3000;

function tap(){
  const now = audio.currentTime;
  if(taps.length && performance.now() - tapWall > TAP_GAP){ taps = []; tapAnchor = null; }
  tapWall = performance.now();

  if(!taps.length){
    const prev = spanAt(now);
    pushUndo();                                    // one step for the whole series
    tapAnchor = {t: now, bpm: prev ? prev.bpm : 120, beats: prev ? prev.beats : 4};
    S.tempo.push(tapAnchor);
    S.tempo.sort((a, b) => a.t - b.t);
    taps = [now];
    renderTempoList(); draw(); save();
    setStatus("tap 1 · " + Math.round(tapAnchor.bpm) + " BPM");
    return;
  }

  const next = taps.concat([now]);
  const bpm = bpmFromTaps(next);
  if(bpm === null) return;                         // worthless tap: dropped, anchor untouched
  taps = next;
  tapAnchor.bpm = bpm;
  renderTempoList(); draw(); save();
  setStatus("tap " + taps.length + " · " + bpm.toFixed(1) + " BPM");
}
```

No hay `focus()` en ninguna parte, al reves que `addMarker()`. Con el foco dentro de un input el segundo `T` escribiria la letra en el campo y la serie se perderia.

- [ ] **Step 3: Atar la tecla**

En el manejador de `keydown`, junto a las de marcador:

```js
  if(k === "t" || k === "T"){ e.preventDefault(); tap(); return; }
```

- [ ] **Step 4: Comprobar**

Run: el comando de `node --check`
Expected: `check OK`

A mano, con `demo.mp3`:

1. Dar al play y golpear `T` al pulso ocho o diez veces. La barra de estado cuenta los golpes y muestra el BPM, y la rejilla aparece y se va afinando.
2. Parar, esperar mas de 3 s, golpear `T` de nuevo: se crea un segundo anclaje en vez de seguir el primero.
3. Con el audio parado, golpear `T` varias veces seguidas: se crea un anclaje en el primer golpe y los siguientes no lo mueven ni lanzan nada.
4. Golpear `T` a mitad de una serie, rebobinar y golpear otra vez dentro de los 3 s: el golpe se descarta y el BPM no salta.
5. Golpear una serie y `Ctrl+Z`: desaparece el anclaje entero, no golpe a golpe.
6. Golpear a mitad de tiempo, es decir un golpe cada dos pulsos: el BPM sale la mitad. Se arregla en la tarea 6 con `x2`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: tap tempo with T"
```

---

### Task 6: Arrastre, loop del tramo y lista lateral

**Files:**
- Modify: `index.html:244-249` (`aside`), `index.html:85-87` (CSS de las listas), `index.html:858-880` (`mousedown`), `index.html:883-908` (`mousemove`), `index.html:910-935` (`mouseup`), `index.html` (`renderTempoList()` y edicion, junto a `renderList()`), `index.html:1032` (`renderAll()`)

**Interfaces:**
- Consumes: `clampBpm()`, `clampBeats()`, `BPM_MIN`, `BPM_MAX` de la tarea 1; `tap()` y el hueco de `renderTempoList()` de la tarea 5.
- Produces: `loopSpan(i)`, `setBpm(i, v)`, `setBeats(i, v)`, `scaleBpm(i, f)`, `delAnchor(i)`, `renderTempoList()` completa.

- [ ] **Step 1: Contenedor en el panel**

En el `aside`:

```html
    <aside>
      <h2 class="sec">Sections <button id="addmk">Add</button></h2>
      <div id="mlist"></div>
      <h2 class="cho">Chords <button id="addch">Add</button></h2>
      <div id="clist"></div>
      <h2 class="tmp">Tempo</h2>
      <div id="tlist"></div>
    </aside>
```

Sin boton de anadir: un anclaje sin tempo no significa nada, y el tempo se toma con `T`.

- [ ] **Step 2: CSS de la lista y de sus campos**

La lista entra en las reglas que hoy comparten `#mlist` y `#clist`, y el panel pasa a repartir su alto entre tres listas:

```css
aside h2.tmp{border-left:3px solid #8ea2c6;border-top:1px solid var(--line)}
#mlist,#clist,#tlist{flex:1 1 auto;overflow-y:auto;min-height:44px}
#clist{flex-grow:1.6}                              /* there are usually many more chords */
#tlist{flex-grow:.7}                               /* anchors are few */
#mlist .empty,#clist .empty,#tlist .empty{padding:12px;color:var(--dim);font-size:11px}
.mk .num{width:46px;font-size:11px;padding:2px 4px}
.mk .x{padding:2px 6px;font-size:11px}
```

- [ ] **Step 3: Edicion de un anclaje**

Insertar despues de `tap()`:

```js
function setBpm(i, v){
  const a = S.tempo[i];
  if(!a || !isFinite(v)){ renderTempoList(); return; }
  pushUndo();
  a.bpm = clampBpm(v);
  renderTempoList(); draw(); save();
}
function setBeats(i, v){
  const a = S.tempo[i];
  if(!a || !isFinite(v)){ renderTempoList(); return; }
  pushUndo();
  a.beats = clampBeats(v);
  renderTempoList(); draw(); save();
}
// halving and doubling do not clamp: a clamped 200x2 would look like a tempo
// somebody chose, and nobody did
function scaleBpm(i, f){
  const a = S.tempo[i];
  if(!a) return;
  const v = a.bpm * f;
  if(v < BPM_MIN || v > BPM_MAX){ flash("out of " + BPM_MIN + "-" + BPM_MAX + " BPM"); return; }
  pushUndo();
  a.bpm = v;
  renderTempoList(); draw(); save();
}
function delAnchor(i){
  if(!S.tempo[i]) return;
  pushUndo();
  S.tempo.splice(i, 1);
  renderTempoList(); draw(); save();
}
// loop one span, the same gesture the other lanes have on double click
function loopSpan(i){
  const a = S.tempo[i];
  if(!a) return;
  const next = S.tempo[i+1];
  S.loop = {on:true, s:a.t, e: next ? next.t : S.duration};
  seek(a.t);
  refresh(); draw(); save();
  if(audio.paused) audio.play().catch(()=>{});
}
```

- [ ] **Step 4: La lista**

Sustituir el hueco `function renderTempoList(){}` por:

```js
function renderTempoList(){
  const box = $("tlist");
  box.innerHTML = "";
  if(!S.tempo.length){
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = "No tempo yet. Tap the beat with T.";
    box.appendChild(e);
    return;
  }
  S.tempo.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "mk";

    const t = document.createElement("span");
    t.className = "t";
    t.textContent = fmt(a.t);
    t.title = "Go there";
    t.onclick = () => seek(a.t);

    const bpm = document.createElement("input");
    bpm.className = "num";
    bpm.value = a.bpm.toFixed(1);
    bpm.title = "BPM";
    bpm.onchange = () => setBpm(i, parseFloat(bpm.value));

    const beats = document.createElement("input");
    beats.className = "num";
    beats.style.width = "30px";
    beats.value = a.beats;
    beats.title = "Beats per bar";
    beats.onchange = () => setBeats(i, parseFloat(beats.value));

    const half = document.createElement("button");
    half.className = "x"; half.textContent = "/2";
    half.title = "Half the tempo";
    half.onclick = () => scaleBpm(i, 0.5);

    const dbl = document.createElement("button");
    dbl.className = "x"; dbl.textContent = "x2";
    dbl.title = "Double the tempo";
    dbl.onclick = () => scaleBpm(i, 2);

    const del = document.createElement("button");
    del.className = "x"; del.textContent = "x";
    del.title = "Delete this anchor";
    del.onclick = () => delAnchor(i);

    row.append(t, bpm, beats, half, dbl, del);
    box.appendChild(row);
  });
}
```

Y `renderAll()` la incluye:

```js
function renderAll(){ renderList("sec"); renderList("cho"); renderTempoList(); }
```

- [ ] **Step 5: Arrastre y doble click**

La rama provisional de la tarea 3 en el `mousedown` pasa a ser la definitiva:

```js
  const band = bandAt(y);
  if(band === "tmp"){
    const i = nearestMarker(S.tempo, t, tolT);
    if(i < 0){ seek(t); return; }
    if(e.detail === 2){ loopSpan(i); return; }
    pendingUndo = markerState();
    drag = {mode:"tmp", a:S.tempo[i], moved:false, x0:x};
    return;
  }
```

En `mousemove`, junto a la rama `"mk"`:

```js
  if(drag.mode === "tmp"){
    if(!drag.moved && Math.abs(x - drag.x0) <= 3) return;
    drag.moved = true;
    drag.a.t = clamp(t, 0, S.duration);
    draw();
    return;
  }
```

En `mouseup`, junto a la rama `"mk"`. Un click simple sobre un anclaje hace seek y no debe dejar un paso de deshacer vacio:

```js
  if(d.mode === "tmp"){
    if(d.moved){
      pushUndo(pendingUndo);
      S.tempo.sort((a, b) => a.t - b.t);
      renderTempoList(); draw(); save();
    }else{
      seek(d.a.t);
    }
    pendingUndo = null;
    return;
  }
```

Y el cursor sobre la banda avisa de que se puede agarrar:

```js
  const onMark = band && band !== "tmp" && nearestMarker(S[BANDS[band].key], t, tolT) >= 0;
  const onAnchor = band === "tmp" && nearestMarker(S.tempo, t, tolT) >= 0;
  mc.style.cursor = (onMark || onAnchor || onEdge) ? "ew-resize" : "crosshair";
```

- [ ] **Step 6: Comprobar**

Run: el comando de `node --check`
Expected: `check OK`

A mano, con `demo.mp3`:

1. Tomar un tempo con `T`. El anclaje aparece en la lista con su hora, su BPM y sus pulsos por compas.
2. Arrastrar la marca de la banda: la rejilla entera se desplaza y el BPM no cambia. Este es el gesto que resuelve la intro fuera de pulso.
3. Soltar sin haber movido: hace seek y `Ctrl+Z` no deshace nada.
4. Doble click sobre la marca: loop desde ese anclaje hasta el siguiente, o hasta el final, y empieza a sonar.
5. Escribir 90 en el campo de BPM: la rejilla se ensancha. Escribir 5000: se queda en 300. Escribir letras: vuelve al valor anterior.
6. Poner 3 en pulsos por compas: las lineas de compas pasan a caer cada tres pulsos.
7. `x2` sobre 200 BPM: no hace nada y avisa. `x2` sobre 70: pasa a 140.
8. Borrar con la `x`: desaparece el anclaje y su rejilla, y `Ctrl+Z` lo devuelve.
9. Crear dos anclajes y arrastrar el segundo por delante del primero: la lista y la rejilla quedan ordenadas por tiempo.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: drag, edit and loop tempo anchors"
```

---

### Task 7: Ayuda, README y captura

La funcion no esta entregada mientras no este documentada donde se busca.

**Files:**
- Modify: `index.html:216-235` (modal de atajos), `README.md`, `screenshot.png`

- [ ] **Step 1: Atajos**

En la columna `Mouse`, despues de la fila de `lanes`:

```html
                <div class="row"><b>tempo lane</b>drag an anchor to move the grid</div>
```

En la columna `Keyboard`, despues de la fila de `C`:

```html
                <div class="row"><b>T</b>tap the beat</div>
```

- [ ] **Step 2: README**

Anadir la rejilla a la lista de funciones, en ingles y en la forma que ya usan las demas entradas. El texto describe lo que hace, no como se implementa:

- tap the beat with `T` to lay a tempo anchor, and drag it to line the grid up with a song whose intro does not start on beat one
- several anchors per song, each with its own tempo and beats per bar, for songs that change tempo
- the grid is a visual guide: it never moves your markers

- [ ] **Step 3: Captura**

Abrir `demo.mp3`, tomar el tempo con `T`, dejar visibles la banda de tempo con un anclaje y la rejilla sobre la onda, y rehacer `screenshot.png` con el mismo encuadre que la actual. Las capturas se hacen siempre contra `demo.mp3`, nunca contra audio real.

- [ ] **Step 4: Comprobar**

1. Abrir la modal con `?`: aparecen las dos filas nuevas y ninguna columna se desborda.
2. `README.md` renderizado en GitHub: las entradas nuevas encajan con el resto de la lista.
3. La captura muestra la rejilla.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md screenshot.png
git commit -m "docs: document the tempo grid"
```

---

## Cierre

Al terminar la tarea 7, actualizar `state.md`:

- **Decisiones:** las del spec que ahora son codigo, en particular que la rejilla es guia visual y no imanta, que el deshacer incluye los anclajes, y que el corte de serie del tap va por reloj de pared.
- **Estado y pendientes:** la rejilla de compases sale de Pendientes.
- **Pendientes:** anotar lo que quedo fuera de alcance, que sigue vivo como idea: compensacion de latencia del tap, deteccion automatica de tempo, denominador de compas.
