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
