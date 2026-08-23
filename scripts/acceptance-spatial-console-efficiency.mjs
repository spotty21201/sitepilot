import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SITEPILOT_URL;
const artifactDir = process.env.SITEPILOT_ARTIFACT_DIR;
if (!baseUrl || !artifactDir) throw new Error('SITEPILOT_URL and SITEPILOT_ARTIFACT_DIR are required.');

await fs.mkdir(artifactDir, { recursive: true });
const output = (name) => path.join(artifactDir, name);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
const page = await context.newPage();
const consoleEvents = [];
page.on('console', (message) => {
  if (message.type() === 'warning' || message.type() === 'error') consoleEvents.push({ type: message.type(), text: message.text() });
});
page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message }));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const scenarioButton = (prefix) => page.locator('button[aria-pressed]').filter({ hasText: prefix }).first();

async function state() {
  return page.evaluate(() => {
    const engine = document.querySelector('[data-spatial-engine]');
    return {
      engine: engine?.getAttribute('data-spatial-engine'),
      revision: engine?.getAttribute('data-canonical-revision'),
      signature: engine?.getAttribute('data-mass-signature'),
      count: Number(engine?.getAttribute('data-mass-count') ?? 0),
      selected: engine?.getAttribute('data-selected-mass-id'),
      canvas: document.querySelectorAll('canvas').length,
      north: engine?.getAttribute('data-north-angle'),
      selectionState: document.querySelector('[aria-label="Spatial Console editing tools"]')?.getAttribute('data-selection-state'),
    };
  });
}

async function canvasPoint(candidates = [[0.48, 0.54], [0.55, 0.52], [0.62, 0.56], [0.5, 0.44]]) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas has no browser box.');
  for (const [xRatio, yRatio] of candidates) {
    const point = { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(120);
    if ((await state()).selected) return { ...point, box };
  }
  throw new Error('Could not select a production mass through the canvas.');
}

async function drag(point, dx, dy, screenshot) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 8 });
  await page.waitForTimeout(180);
  if (screenshot) await page.screenshot({ path: output(screenshot), fullPage: true });
}

async function setView(preset) {
  if (preset === 'TOP' || preset === 'ISO') {
    await page.getByRole('button', { name: `${preset} Spatial Console view` }).click();
    return;
  }
  await page.getByRole('button', { name: 'Open cardinal view controls' }).click();
  await page.getByRole('button', { name: `${preset} Spatial Console view` }).click();
}

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  assert((await state()).engine === 'spatial-console', 'Spatial Console build did not mount.');
  assert((await state()).canvas === 1, 'Spatial Console did not mount exactly one canvas.');
  assert((await state()).selectionState === 'none', 'No-selection state is not compact.');
  await page.screenshot({ path: output('01-no-selection.png'), fullPage: true });

  await page.getByRole('button', { name: '2D Site Plan (Illustrative) view' }).click();
  assert((await state()).canvas === 0, '2D mode retained a WebGL canvas.');
  await page.getByRole('button', { name: '3D Spatial Model view' }).click();
  await page.waitForTimeout(250);
  assert((await state()).canvas === 1, '3D remount did not restore one canvas.');

  for (const scenario of ['A: Low-Rise Heritage Villas', 'B: Mid-Rise Mixed-Use', 'C: Speculative High-Density']) {
    await scenarioButton(scenario).click();
    await page.waitForTimeout(180);
    assert((await state()).engine === 'spatial-console', `Scenario ${scenario} left Spatial Console.`);
  }
  await scenarioButton('A: Low-Rise Heritage Villas').click();
  await page.waitForTimeout(180);

  let selected = await canvasPoint();
  assert((await state()).selectionState === 'selected', 'Selection did not expose contextual inspector.');
  await page.screenshot({ path: output('02-selected-mass.png'), fullPage: true });

  await page.getByRole('button', { name: 'Move tool' }).click();
  const beforeCancel = await state();
  await drag(selected, -20, 0, '03-move-preview.png');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(220);
  const afterCancel = await state();
  assert(afterCancel.revision === beforeCancel.revision && afterCancel.signature === beforeCancel.signature, 'Cancelled move changed canonical state.');

  await drag(selected, -20, 0, '04-move-accepted.png');
  await page.mouse.up();
  await page.waitForTimeout(280);
  const moved = await state();
  assert(moved.revision !== beforeCancel.revision, 'Committed move did not create a canonical revision.');
  await page.getByRole('button', { name: 'Undo action' }).click();
  await page.waitForTimeout(180);
  assert((await state()).signature === beforeCancel.signature, 'Undo did not restore the move.');
  await page.getByRole('button', { name: 'Redo action' }).click();
  await page.waitForTimeout(180);
  assert((await state()).signature === moved.signature, 'Redo did not restore the move.');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await scenarioButton('A: Low-Rise Heritage Villas').click();
  await page.waitForTimeout(160);
  assert((await state()).signature === moved.signature, 'Reload did not restore accepted canonical geometry.');
  selected = await canvasPoint();

  await page.getByRole('button', { name: 'Move tool' }).click();
  const beforeRejected = await state();
  await drag(selected, 620, 0, '05-rejected-move.png');
  assert((await page.locator('[data-interaction-region="validation"]').innerText()).includes('Preview rejected'), 'Invalid move did not report preview rejection.');
  await page.mouse.up();
  await page.waitForTimeout(240);
  const rejected = await state();
  assert(rejected.revision === beforeRejected.revision && rejected.signature === beforeRejected.signature, 'Rejected move changed canonical state.');

  await scenarioButton('B: Mid-Rise Mixed-Use').click();
  await page.waitForTimeout(220);
  selected = await canvasPoint([[0.55, 0.52], [0.48, 0.54], [0.62, 0.56]]);
  const box = selected.box;
  await page.getByRole('button', { name: 'Resize tool' }).click();
  const beforeResize = await state();
  await drag({ x: box.x + box.width * 0.645, y: box.y + box.height * 0.475 }, -8, 0, '06-resize-preview.png');
  await page.mouse.up();
  await page.waitForTimeout(260);
  assert((await state()).revision !== beforeResize.revision, 'Resize did not commit one revision.');

  await page.getByRole('button', { name: 'Floors tool' }).click();
  const beforeFloors = await state();
  await drag(selected, 0, -28, '07-floors-preview.png');
  await page.mouse.up();
  await page.waitForTimeout(260);
  assert((await state()).revision !== beforeFloors.revision, 'Floors edit did not commit one revision.');

  const widthInput = page.getByRole('textbox', { name: 'W numeric value' });
  const oldWidth = Number(await widthInput.inputValue());
  await widthInput.fill(String(oldWidth - 0.5));
  await widthInput.press('Enter');
  await page.waitForTimeout(220);
  await page.screenshot({ path: output('08-numeric-editing.png'), fullPage: true });

  const beforeDuplicate = await state();
  await page.getByRole('button', { name: 'Duplicate selected mass' }).click();
  await page.waitForTimeout(220);
  assert((await state()).count === beforeDuplicate.count + 1, 'Duplicate did not create one mass.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete selected mass' }).click();
  await page.waitForTimeout(220);
  assert((await state()).count === beforeDuplicate.count, 'Delete did not remove selected duplicate.');
  await page.getByRole('button', { name: 'Undo action' }).click();
  await page.waitForTimeout(180);
  assert((await state()).count === beforeDuplicate.count + 1, 'Undo did not restore deleted duplicate.');
  selected = await canvasPoint();

  for (const preset of ['TOP', 'ISO', 'NORTH', 'SOUTH', 'EAST', 'WEST']) {
    await setView(preset);
    await page.waitForTimeout(180);
    if (preset === 'TOP') await page.screenshot({ path: output('09-top.png'), fullPage: true });
    if (preset === 'ISO') await page.screenshot({ path: output('10-iso.png'), fullPage: true });
  }
  await setView('ISO');
  await page.getByRole('button', { name: 'Use orthographic projection' }).click();
  await page.getByRole('button', { name: 'Fit parcel in Spatial Console' }).click();
  await page.getByRole('button', { name: 'Fit proposal in Spatial Console' }).click();
  await page.getByRole('button', { name: 'Fit selected mass in Spatial Console' }).click();

  await page.getByRole('button', { name: 'Constraints display mode' }).click();
  await page.screenshot({ path: output('11-constraints.png'), fullPage: true });
  await page.getByRole('button', { name: 'Monochrome display mode' }).click();
  await page.getByRole('button', { name: 'Development display mode' }).click();
  assert(await page.getByRole('button', { name: 'Measurement unavailable in Spatial Console' }).isDisabled(), 'Measurement must be honestly unavailable.');

  await page.getByRole('button', { name: 'Toggle spatial legend' }).click();
  await page.screenshot({ path: output('12-legend-expanded.png'), fullPage: true });
  await page.getByRole('button', { name: 'Toggle spatial legend' }).click();
  await page.screenshot({ path: output('13-legend-collapsed.png'), fullPage: true });

  await page.getByRole('button', { name: 'Inspect System Runtime Diagnostics' }).click();
  await page.screenshot({ path: output('14-diagnostics.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Clear mass selection' }).click();
  assert((await state()).selectionState === 'none', 'Clear selection retained expanded inspector.');

  await page.setViewportSize({ width: 1280, height: 760 });
  await page.waitForTimeout(180);
  await page.screenshot({ path: output('15-small-viewport.png'), fullPage: true });
  const boxes = await page.evaluate(() => {
    const box = (selector) => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return { camera: box('[aria-label="Spatial Console camera controls"]'), editor: box('[aria-label="Spatial Console editing tools"]') };
  });
  assert(boxes.camera && boxes.editor && !(boxes.camera.x < boxes.editor.x + boxes.editor.width && boxes.camera.x + boxes.camera.width > boxes.editor.x && boxes.camera.y < boxes.editor.y + boxes.editor.height && boxes.camera.y + boxes.camera.height > boxes.editor.y), 'Camera and edit controls overlap at 1280x760.');

  let fallbackActivated = false;
  for (const failedWebGlRequests of [1, 2, 4, 6]) {
    const fallback = await browser.newContext({ viewport: { width: 1280, height: 760 } });
    await fallback.addInitScript((failedRequests) => {
      const original = HTMLCanvasElement.prototype.getContext;
      let failures = 0;
      HTMLCanvasElement.prototype.getContext = function forcedContext(type, ...args) {
        if (String(type).includes('webgl') && failures++ < failedRequests) return null;
        return original.call(this, type, ...args);
      };
    }, failedWebGlRequests);
    const fallbackPage = await fallback.newPage();
    await fallbackPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await fallbackPage.waitForTimeout(550);
    fallbackActivated = await fallbackPage.locator('[data-spatial-engine="legacy"]').count() === 1;
    if (fallbackActivated) {
      await fallbackPage.screenshot({ path: output('16-legacy-fallback.png'), fullPage: true });
    }
    await fallback.close();
    if (fallbackActivated) break;
  }
  assert(fallbackActivated, 'Forced initialization failure did not activate legacy renderer.');

  const applicationErrors = consoleEvents.filter(({ text }) => !text.includes('GL Driver Message') && !text.includes('GPU stall due to ReadPixels'));
  assert(applicationErrors.length === 0, `Unexpected console events: ${applicationErrors.map(({ text }) => text).join(' | ')}`);
  await fs.writeFile(output('efficiency-browser-report.json'), JSON.stringify({
    url: baseUrl,
    moved,
    rejected,
    boxes,
    applicationErrors,
  }, null, 2));
  console.log(JSON.stringify({ moved, rejected, boxes, applicationErrors }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
