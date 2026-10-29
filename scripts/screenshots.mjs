// Screenshots for docs/guide, from index.html served with `python -m http.server 4180` in the repository root.
// Firefox, English, muted. Run by hand when the interface changes: `node scripts/screenshots.mjs`.
// Needs Playwright (not a dependency of the project): set PLAYWRIGHT to the path of its index.mjs.

const { firefox } = await import(process.env.PLAYWRIGHT ?? '@playwright/test');

const url = process.env.URL ?? 'http://127.0.0.1:4180/';
const out = 'docs/guide/img/';
const browser = await firefox.launch({ firefoxUserPrefs: { 'media.volume_scale': '0.0' } });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })).newPage();

await page.goto(url);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}start.png` });

await page.locator('input[type=file]').first().setInputFiles('demo.mp3');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}loaded.png` });

// Markers: M for a section and C for a chord at the playhead, L to move it. A new marker takes the
// focus to name it; Enter leaves the field.
const mark = async (key, name) => {
  await page.keyboard.press(key);
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
};
const forward = async (seconds) => {
  for (let i = 0; i < seconds / 5; i++) await page.keyboard.press('l');
};
await page.keyboard.press('Home');
await mark('m', 'Intro');
await mark('c', 'Am');
await forward(10);
await mark('m', 'Verse');
await mark('c', 'F');
await forward(10);
await mark('m', 'Chorus');
await mark('c', 'C');
await forward(10);
await mark('m', 'Outro');
await mark('c', 'G');
await page.keyboard.press('Home');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}markers.png` });

// Tempo: tap T on the beat, 500 ms apart (120 bpm).
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('t');
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${out}tempo.png` });

// A loop: the I and O keys at two points of the playhead.
await page.keyboard.press('Home');
for (let i = 0; i < 2; i++) await page.keyboard.press('l');
await page.keyboard.press('i');
for (let i = 0; i < 2; i++) await page.keyboard.press('l');
await page.keyboard.press('o');
await page.keyboard.press('r');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}loop.png` });

await browser.close();
