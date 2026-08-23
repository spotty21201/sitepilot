import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const baseUrl = process.env.SITEPILOT_URL;
const artifactDir = process.env.SITEPILOT_ARTIFACT_DIR;
const legacyReportPath = process.env.SITEPILOT_LEGACY_REPORT;
if (!baseUrl || !artifactDir) {
  throw new Error('SITEPILOT_URL and SITEPILOT_ARTIFACT_DIR are required.');
}

await fs.mkdir(artifactDir, { recursive: true });
const output = (name) => path.join(artifactDir, name);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
const page = await context.newPage();
const consoleEvents = [];
page.on('console', (message) => {
  if (message.type() === 'warning' || message.type() === 'error') {
    consoleEvents.push({ type: message.type(), text: message.text() });
  }
});
page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message }));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const scenarioButton = (prefix) => page.locator('button[aria-pressed]').filter({ hasText: prefix }).first();
const spatialRoot = () => page.locator('[data-spatial-engine="spatial-console"]');

async function collectState() {
  return page.evaluate(() => {
    const metricText = (label) => {
      const labelNode = [...document.querySelectorAll('span')]
        .find((node) => node.textContent?.trim() === label);
      return labelNode?.parentElement?.innerText ?? null;
    };
    const engine = document.querySelector('[data-spatial-engine]');
    return {
      engine: engine?.getAttribute('data-spatial-engine') ?? null,
      caseId: engine?.getAttribute('data-case-id') ?? null,
      scenarioId: engine?.getAttribute('data-scenario-id') ?? null,
      revisionId: engine?.getAttribute('data-canonical-revision') ?? null,
      massCount: Number(engine?.getAttribute('data-mass-count') ?? 0),
      massSignature: engine?.getAttribute('data-mass-signature') ?? null,
      selectedMassId: engine?.getAttribute('data-selected-mass-id') ?? null,
      northAngle: engine?.getAttribute('data-north-angle') ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
      metrics: {
        gfa: metricText('Total GFA'),
        far: metricText('FAR / KLB Ratio'),
        coverage: metricText('Site Coverage (KDB)'),
        unbuilt: metricText('Unbuilt Site Area'),
      },
      validation: document.querySelector('[data-interaction-region="validation"]')?.textContent?.trim() ?? null,
    };
  });
}

async function canvasBox() {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('Spatial Console canvas has no browser box.');
  return box;
}

async function selectMass(candidates = [[0.48, 0.54], [0.55, 0.52], [0.62, 0.56], [0.5, 0.44]]) {
  const box = await canvasBox();
  for (const [xRatio, yRatio] of candidates) {
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
    await page.waitForTimeout(120);
    if (await spatialRoot().getAttribute('data-selected-mass-id')) {
      return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio, xRatio, yRatio };
    }
  }
  throw new Error('Could not select a canonical mass through the production canvas.');
}

async function dragPreview(point, dx, dy, screenshot) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 8 });
  await page.waitForTimeout(180);
  if (screenshot) await page.screenshot({ path: output(screenshot), fullPage: true });
}

async function findRenderedResizeGrip(box) {
  const png = await page.screenshot();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const minX = Math.max(0, Math.floor(box.x + box.width * 0.28));
  const maxX = Math.min(info.width - 1, Math.ceil(box.x + box.width * 0.94));
  const minY = Math.max(0, Math.floor(box.y + box.height * 0.16));
  const maxY = Math.min(info.height - 1, Math.ceil(box.y + box.height * 0.90));
  const matches = new Set();
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const offset = (y * info.width + x) * channels;
      const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
      if (r >= 205 && g >= 165 && g <= 215 && b >= 85 && b <= 165 && r - b >= 55 && g - b >= 35) {
        matches.add(y * info.width + x);
      }
    }
  }

  const components = [];
  while (matches.size > 0) {
    const first = matches.values().next().value;
    const stack = [first];
    matches.delete(first);
    let count = 0; let sumX = 0; let sumY = 0;
    let componentMinX = info.width; let componentMaxX = 0;
    let componentMinY = info.height; let componentMaxY = 0;
    while (stack.length > 0) {
      const pixel = stack.pop();
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      count += 1; sumX += x; sumY += y;
      componentMinX = Math.min(componentMinX, x); componentMaxX = Math.max(componentMaxX, x);
      componentMinY = Math.min(componentMinY, y); componentMaxY = Math.max(componentMaxY, y);
      for (const neighbor of [pixel - 1, pixel + 1, pixel - info.width, pixel + info.width]) {
        if (matches.delete(neighbor)) stack.push(neighbor);
      }
    }
    const width = componentMaxX - componentMinX + 1;
    const height = componentMaxY - componentMinY + 1;
    if (count >= 5 && count <= 250 && width <= 22 && height <= 22) {
      components.push({ x: sumX / count, y: sumY / count, count });
    }
  }
  components.sort((a, b) => (
    Math.hypot(a.x - (box.x + box.width * 0.62), a.y - (box.y + box.height * 0.50))
    - Math.hypot(b.x - (box.x + box.width * 0.62), b.y - (box.y + box.height * 0.50))
  ));
  if (!components[0]) throw new Error('Could not locate a rendered resize grip in the production canvas.');
  return components[0];
}

async function numericInput(label) {
  return page.getByRole('textbox', { name: `${label} numeric value` });
}

function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  assert((await collectState()).engine === 'spatial-console', 'Spatial Console build mounted the wrong engine.');
  assert((await collectState()).canvasCount === 1, 'Spatial Console must mount exactly one canvas.');

  await scenarioButton('A: Low-Rise Heritage Villas').click();
  await page.waitForTimeout(300);
  const scenarioA = await collectState();
  await page.screenshot({ path: output('01-default-integrated-console.png'), fullPage: true });

  await scenarioButton('B: Mid-Rise Mixed-Use').click();
  await page.waitForTimeout(300);
  const scenarioB = await collectState();
  await page.screenshot({ path: output('02-scenario-b.png'), fullPage: true });

  let legacyComparison = null;
  if (legacyReportPath) {
    const legacy = JSON.parse(await fs.readFile(legacyReportPath, 'utf8'));
    legacyComparison = {
      scenarioA: scenarioA.metrics,
      legacyScenarioA: legacy.scenarioA.metrics,
      scenarioB: scenarioB.metrics,
      legacyScenarioB: legacy.scenarioB.metrics,
      scenarioAMatches: JSON.stringify(scenarioA.metrics) === JSON.stringify(legacy.scenarioA.metrics),
      scenarioBMatches: JSON.stringify(scenarioB.metrics) === JSON.stringify(legacy.scenarioB.metrics),
    };
    assert(legacyComparison.scenarioAMatches && legacyComparison.scenarioBMatches, 'Legacy and Spatial metrics diverged.');
  }

  await scenarioButton('A: Low-Rise Heritage Villas').click();
  await page.waitForTimeout(250);
  let selectedPoint = await selectMass();
  await page.screenshot({ path: output('03-selected-mass.png'), fullPage: true });

  await page.getByRole('button', { name: 'Move tool' }).click();
  const beforeCancel = await collectState();
  await dragPreview(selectedPoint, -20, 0, '04-move-preview.png');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(250);
  const afterCancel = await collectState();
  assert(afterCancel.revisionId === beforeCancel.revisionId, 'Cancelled move changed the canonical revision.');
  assert(afterCancel.massSignature === beforeCancel.massSignature, 'Cancelled move changed canonical geometry.');

  await dragPreview(selectedPoint, -20, 0);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const acceptedMove = await collectState();
  assert(acceptedMove.revisionId !== beforeCancel.revisionId, 'Accepted move did not create one revision.');
  await page.screenshot({ path: output('05-accepted-move.png'), fullPage: true });

  await page.getByRole('button', { name: 'Undo action' }).click();
  await page.waitForTimeout(300);
  const undoMove = await collectState();
  assert(undoMove.massSignature === beforeCancel.massSignature, 'Undo did not restore move geometry.');
  await page.getByRole('button', { name: 'Redo action' }).click();
  await page.waitForTimeout(300);
  const redoMove = await collectState();
  assert(redoMove.massSignature === acceptedMove.massSignature, 'Redo did not restore the exact accepted move.');

  const persistedMove = await collectState();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await scenarioButton('A: Low-Rise Heritage Villas').click();
  await page.waitForTimeout(250);
  const reloadedMove = await collectState();
  assert(reloadedMove.revisionId === persistedMove.revisionId, 'Reload lost accepted revision.');
  assert(reloadedMove.massSignature === persistedMove.massSignature, 'Reload lost accepted geometry.');

  selectedPoint = await selectMass();
  await page.getByRole('button', { name: 'Move tool' }).click();
  const beforeRejectedMove = await collectState();
  await dragPreview(selectedPoint, 620, 0, '06-rejected-move.png');
  const rejectedPreviewText = await page.locator('[data-interaction-region="validation"]').innerText();
  assert(rejectedPreviewText.includes('Preview rejected'), 'Out-of-envelope move was not marked rejected.');
  await page.mouse.up();
  await page.waitForTimeout(300);
  const rejectedMove = await collectState();
  assert(rejectedMove.revisionId === beforeRejectedMove.revisionId, 'Rejected move created a revision.');
  assert(rejectedMove.massSignature === beforeRejectedMove.massSignature, 'Rejected move changed canonical geometry.');

  await scenarioButton('B: Mid-Rise Mixed-Use').click();
  await page.waitForTimeout(300);
  await selectMass([[0.55, 0.52], [0.48, 0.54], [0.62, 0.56]]);
  const box = await canvasBox();
  await page.getByRole('button', { name: 'Resize tool' }).click();
  await page.waitForTimeout(180);
  const beforeResize = await collectState();
  const resizeHandle = await findRenderedResizeGrip(box);
  await dragPreview(resizeHandle, 15, 0, '07-resize-preview.png');
  await page.mouse.up();
  await page.waitForTimeout(350);
  const resized = await collectState();
  assert(resized.revisionId !== beforeResize.revisionId, 'Resize handle did not commit a revision.');

  await page.getByRole('button', { name: 'Floors tool' }).click();
  await page.waitForTimeout(180);
  const beforeFloors = await collectState();
  const floorHandle = { x: box.x + box.width * 0.55, y: box.y + box.height * 0.488 };
  // Decrease one floor so the direct-manipulation commit stays within the
  // Golden Project's verified Subzone R.9 eight-floor / 32m constraint.
  await dragPreview(floorHandle, 0, 16, '08-height-floor-preview.png');
  await page.mouse.up();
  await page.waitForTimeout(350);
  const floorsChanged = await collectState();
  assert(floorsChanged.revisionId !== beforeFloors.revisionId, 'Floor handle did not commit a revision.');

  const widthInput = await numericInput('W');
  const widthBefore = Number(await widthInput.inputValue());
  await widthInput.fill(String(widthBefore - 0.5));
  await widthInput.press('Enter');
  await page.waitForTimeout(350);
  const numericEdit = await collectState();
  assert(numericEdit.revisionId !== floorsChanged.revisionId, 'Exact numeric edit did not commit.');
  await page.screenshot({ path: output('09-numeric-entry.png'), fullPage: true });

  const beforeDuplicate = await collectState();
  await page.getByRole('button', { name: 'Duplicate selected mass' }).click();
  await page.waitForTimeout(350);
  const duplicated = await collectState();
  assert(duplicated.massCount === beforeDuplicate.massCount + 1, 'Duplicate did not add one stable mass identity.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete selected mass' }).click();
  await page.waitForTimeout(350);
  const deleted = await collectState();
  assert(deleted.massCount === beforeDuplicate.massCount, 'Delete did not remove the duplicate.');
  await page.getByRole('button', { name: 'Undo action' }).click();
  await page.waitForTimeout(300);
  const undoDelete = await collectState();
  assert(undoDelete.massCount === beforeDuplicate.massCount + 1, 'Undo delete did not restore identity.');
  await page.getByRole('button', { name: 'Undo action' }).click();
  await page.waitForTimeout(300);
  const undoDuplicate = await collectState();
  assert(undoDuplicate.massCount === beforeDuplicate.massCount, 'Undo duplicate did not restore baseline count.');

  await selectMass([[0.55, 0.52], [0.48, 0.54], [0.62, 0.56]]);
  const xInput = await numericInput('X');
  const beforePersistenceFailure = await collectState();
  await page.evaluate(() => {
    const storagePrototype = Object.getPrototypeOf(localStorage);
    window.__sitepilotOriginalSetItem = storagePrototype.setItem;
    storagePrototype.setItem = function rejectedPersistence() {
      throw new Error('forced-phase2-persistence-rejection');
    };
  });
  await xInput.fill(String(Number(await xInput.inputValue()) + 0.5));
  await xInput.press('Enter');
  await page.waitForTimeout(300);
  const persistenceFailure = await collectState();
  await page.evaluate(() => {
    const storagePrototype = Object.getPrototypeOf(localStorage);
    storagePrototype.setItem = window.__sitepilotOriginalSetItem;
    delete window.__sitepilotOriginalSetItem;
  });
  assert(persistenceFailure.revisionId === beforePersistenceFailure.revisionId, 'Persistence failure changed revision.');
  assert(persistenceFailure.massSignature === beforePersistenceFailure.massSignature, 'Persistence failure changed geometry.');

  const scenarioBIsolation = await collectState();
  await scenarioButton('A: Low-Rise Heritage Villas').click();
  await page.waitForTimeout(300);
  const scenarioAIsolation = await collectState();
  assert(scenarioAIsolation.massSignature === reloadedMove.massSignature, 'Scenario B edits leaked into Scenario A.');
  await scenarioButton('B: Mid-Rise Mixed-Use').click();
  await page.waitForTimeout(300);
  assert((await collectState()).massSignature === scenarioBIsolation.massSignature, 'Scenario switch lost Scenario B state.');
  await page.screenshot({ path: output('10-scenario-switch.png'), fullPage: true });

  const cameraEvidence = [];
  for (const preset of ['TOP', 'ISO', 'NORTH', 'SOUTH', 'EAST', 'WEST']) {
    if (!['TOP', 'ISO'].includes(preset)) {
      await page.getByRole('button', { name: 'Open cardinal view controls' }).click();
      await page.waitForTimeout(80);
    }
    await page.getByRole('button', { name: `${preset} Spatial Console view` }).click();
    await page.waitForTimeout(300);
    cameraEvidence.push({ preset, northAngle: (await collectState()).northAngle });
    if (preset === 'TOP') await page.screenshot({ path: output('11-north-top.png'), fullPage: true });
    if (preset === 'ISO') await page.screenshot({ path: output('12-north-iso.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'ISO Spatial Console view' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Use orthographic projection' }).click();
  await page.waitForTimeout(250);
  const orthographic = await collectState();
  assert(cameraEvidence.some((entry, index) => index > 0 && entry.northAngle !== cameraEvidence[0].northAngle), 'North indicator did not respond to camera azimuth.');
  await page.screenshot({ path: output('13-unified-camera-controls.png'), fullPage: true });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download COLLADA DAE File' }).click();
  const download = await downloadPromise;
  const daePath = output(download.suggestedFilename());
  await download.saveAs(daePath);
  const dae = await fs.readFile(daePath, 'utf8');
  const daeEvidence = {
    path: daePath,
    bytes: Buffer.byteLength(dae),
    meter: /<unit[^>]*meter="([^"]+)"/.exec(dae)?.[1] ?? null,
    upAxis: /<up_axis>([^<]+)<\/up_axis>/.exec(dae)?.[1] ?? null,
    geometryCount: (dae.match(/<geometry\b/g) ?? []).length,
    objectCount: (dae.match(/<instance_geometry\b/g) ?? []).length,
    containsRejectedCoordinate: /(?:^|\s)620(?:\s|$)/.test(dae),
  };
  assert(daeEvidence.meter === '1.0' && daeEvidence.upAxis === 'Z_UP', 'DAE unit or axis changed.');
  assert(daeEvidence.geometryCount === 7 && daeEvidence.objectCount === 7, 'DAE object count changed unexpectedly.');

  const lifecycle = [];
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.getByRole('button', { name: '2D Site Plan (Illustrative) view' }).click();
    await page.waitForTimeout(180);
    lifecycle.push({ cycle, mode: '2D', canvases: await page.locator('canvas').count() });
    await page.getByRole('button', { name: '3D Spatial Model view' }).click();
    await page.waitForTimeout(300);
    lifecycle.push({ cycle, mode: '3D', canvases: await page.locator('canvas').count() });
  }
  assert(lifecycle.every((entry) => entry.canvases === (entry.mode === '3D' ? 1 : 0)), 'Canvas lifecycle leaked a renderer.');

  await page.setViewportSize({ width: 1280, height: 760 });
  await page.waitForTimeout(300);
  const cameraBox = await page.getByLabel('Spatial Console camera controls').boundingBox();
  const editorBox = await page.getByLabel('Spatial Console editing tools').boundingBox();
  const validationBox = await page.locator('[data-interaction-region="validation"]').boundingBox();
  const compactCollisions = {
    cameraEditor: boxesOverlap(cameraBox, editorBox),
    cameraValidation: boxesOverlap(cameraBox, validationBox),
    editorValidation: boxesOverlap(editorBox, validationBox),
  };
  assert(!Object.values(compactCollisions).some(Boolean), 'Spatial overlays collide at 1280x760.');
  await page.screenshot({ path: output('14-small-viewport.png'), fullPage: true });

  const fallbackContext = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  await fallbackContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    let rejected = false;
    HTMLCanvasElement.prototype.getContext = function controlledGetContext(type, ...args) {
      if (!rejected && String(type).includes('webgl')) {
        rejected = true;
        return null;
      }
      return original.call(this, type, ...args);
    };
  });
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(baseUrl, { waitUntil: 'networkidle' });
  await fallbackPage.waitForTimeout(800);
  const fallback = {
    engine: await fallbackPage.locator('[data-spatial-engine]').getAttribute('data-spatial-engine'),
    diagnostic: await fallbackPage.getByText('Spatial Console unavailable · Legacy renderer active').count(),
    canvasCount: await fallbackPage.locator('canvas').count(),
  };
  assert(fallback.engine === 'legacy' && fallback.diagnostic === 1, 'Spatial initialization failure did not expose legacy fallback.');
  await fallbackPage.screenshot({ path: output('15-legacy-fallback.png'), fullPage: true });
  await fallbackContext.close();

  const applicationConsoleEvents = consoleEvents.filter(({ text }) => (
    !text.includes('GL Driver Message')
    && !text.includes('GPU stall due to ReadPixels')
    && !text.includes('forced-phase2-persistence-rejection')
    && !text.includes('[SitePilot Spatial Command] PERSISTENCE_FAILED')
  ));
  const report = {
    url: baseUrl,
    scenarioA,
    scenarioB,
    legacyComparison,
    move: { beforeCancel, afterCancel, acceptedMove, undoMove, redoMove, persistedMove, reloadedMove },
    rejectedMove: { before: beforeRejectedMove, after: rejectedMove, previewText: rejectedPreviewText },
    resize: { before: beforeResize, after: resized },
    floors: { before: beforeFloors, after: floorsChanged },
    numericEdit,
    identity: { beforeDuplicate, duplicated, deleted, undoDelete, undoDuplicate },
    persistenceFailure: { before: beforePersistenceFailure, after: persistenceFailure },
    isolation: { scenarioA: scenarioAIsolation, scenarioB: scenarioBIsolation },
    cameraEvidence,
    orthographic,
    daeEvidence,
    lifecycle,
    compactCollisions,
    fallback,
    consoleEvents,
    applicationConsoleEvents,
  };
  await fs.writeFile(output('phase2-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    legacyComparison,
    move: report.move,
    rejectedMove: report.rejectedMove,
    resize: report.resize,
    floors: report.floors,
    identity: report.identity,
    persistenceFailure: report.persistenceFailure,
    cameraEvidence,
    daeEvidence,
    lifecycle,
    compactCollisions,
    fallback,
    applicationConsoleEvents,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
