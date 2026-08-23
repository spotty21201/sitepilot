import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SITEPILOT_URL;
const expectedEngine = process.env.EXPECTED_SPATIAL_ENGINE;
const artifactDir = process.env.SITEPILOT_ARTIFACT_DIR;

if (!baseUrl || !expectedEngine || !artifactDir) {
  throw new Error('SITEPILOT_URL, EXPECTED_SPATIAL_ENGINE, and SITEPILOT_ARTIFACT_DIR are required.');
}
if (!['legacy', 'spatial-console'].includes(expectedEngine)) {
  throw new Error(`Unsupported EXPECTED_SPATIAL_ENGINE: ${expectedEngine}`);
}

await fs.mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const consoleEvents = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    consoleEvents.push({ type: message.type(), text: message.text() });
  }
});
page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message }));

const output = (name) => path.join(artifactDir, name);
const scenarioButton = (prefix) => page.locator('button[aria-pressed]').filter({ hasText: prefix }).first();

async function collectState() {
  return page.evaluate(() => {
    const metricText = (label) => {
      const labelNode = [...document.querySelectorAll('span')]
        .find((node) => node.textContent?.trim() === label);
      return labelNode?.parentElement?.innerText ?? null;
    };
    const engine = document.querySelector('[data-spatial-engine]');
    const activeScenario = [...document.querySelectorAll('button[aria-pressed="true"]')]
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
      .find((text) => text?.includes('m²')) ?? null;
    return {
      activeScenario,
      metrics: {
        gfa: metricText('Total GFA'),
        far: metricText('FAR / KLB Ratio'),
        coverage: metricText('Site Coverage (KDB)'),
        unbuilt: metricText('Unbuilt Site Area'),
      },
      engine: engine?.getAttribute('data-spatial-engine') ?? null,
      caseId: engine?.getAttribute('data-case-id') ?? null,
      scenarioId: engine?.getAttribute('data-scenario-id') ?? null,
      revisionId: engine?.getAttribute('data-canonical-revision') ?? null,
      massCount: engine?.getAttribute('data-mass-count') ?? null,
      massSignature: engine?.getAttribute('data-mass-signature') ?? null,
      selectedMassId: engine?.getAttribute('data-selected-mass-id') ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
      compliance: document.querySelector('[title*="Envelope"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    };
  });
}

async function inspectCanvas(name) {
  const canvas = page.locator('canvas').first();
  const buffer = await canvas.screenshot({ path: output(name) });
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sumSquares = 0;
  let nonDarkPixels = 0;
  const pixels = info.width * info.height;
  for (let index = 0; index < data.length; index += info.channels) {
    const luminance = (data[index] + data[index + 1] + data[index + 2]) / 3;
    sum += luminance;
    sumSquares += luminance * luminance;
    if (luminance > 35) nonDarkPixels += 1;
  }
  const mean = sum / pixels;
  return {
    width: info.width,
    height: info.height,
    bytes: buffer.length,
    meanLuminance: Number(mean.toFixed(3)),
    luminanceVariance: Number((sumSquares / pixels - mean * mean).toFixed(3)),
    nonDarkPixelRatio: Number((nonDarkPixels / pixels).toFixed(4)),
  };
}

async function selectMass() {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) return false;
  const candidates = [[0.55, 0.52], [0.62, 0.56], [0.48, 0.54], [0.56, 0.62], [0.5, 0.44]];
  for (const [xRatio, yRatio] of candidates) {
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
    await page.waitForTimeout(180);
    if (await page.locator('aside[aria-label="Mass Development Properties"]').count()) return true;
  }
  return false;
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const initial = await collectState();
  if (initial.engine !== expectedEngine) {
    throw new Error(`Expected ${expectedEngine}, mounted ${initial.engine}.`);
  }
  if (initial.canvasCount !== 1) throw new Error(`Expected one canvas, found ${initial.canvasCount}.`);

  await scenarioButton('A: Low-Rise Heritage Villas').click();
  await page.waitForTimeout(300);
  const scenarioA = await collectState();
  await page.screenshot({ path: output(`${expectedEngine}-scenario-a.png`), fullPage: true });

  await scenarioButton('B: Mid-Rise Mixed-Use').click();
  await page.waitForTimeout(300);
  const scenarioB = await collectState();
  await page.screenshot({ path: output(`${expectedEngine}-scenario-b.png`), fullPage: true });
  const canvasEvidence = await inspectCanvas(`${expectedEngine}-canvas.png`);
  if (canvasEvidence.luminanceVariance < 8 || canvasEvidence.nonDarkPixelRatio < 0.005) {
    throw new Error(`Canvas appears blank: ${JSON.stringify(canvasEvidence)}`);
  }

  const selected = await selectMass();
  if (!selected) throw new Error('Could not select a canonical mass through the production viewport.');
  const selectedBefore = await collectState();
  const inspector = page.locator('aside[aria-label="Mass Development Properties"]');
  const inputs = inspector.locator('input');
  const inputValuesBefore = await inputs.evaluateAll((nodes) => nodes.map((node) => node.value));
  await page.screenshot({ path: output(`${expectedEngine}-selected-mass.png`), fullPage: true });

  const widthInput = inputs.nth(0);
  const committedWidth = Number(inputValuesBefore[0]) + 1;
  await widthInput.fill(String(committedWidth));
  await widthInput.press('Enter');
  await page.waitForTimeout(350);
  const afterEdit = await collectState();
  const inputValuesAfterEdit = await inputs.evaluateAll((nodes) => nodes.map((node) => node.value));
  if (afterEdit.revisionId === selectedBefore.revisionId) throw new Error('Accepted edit did not advance the viewer revision.');
  if (afterEdit.massSignature === selectedBefore.massSignature && expectedEngine === 'spatial-console') {
    throw new Error('Accepted edit did not update the Spatial Console geometry signature.');
  }

  await page.getByRole('button', { name: 'Undo action' }).click();
  await page.waitForTimeout(300);
  const afterUndo = await collectState();
  const inputValuesAfterUndo = await inputs.evaluateAll((nodes) => nodes.map((node) => node.value));

  await page.getByRole('button', { name: 'Redo action' }).click();
  await page.waitForTimeout(300);
  const afterRedo = await collectState();
  const inputValuesAfterRedo = await inputs.evaluateAll((nodes) => nodes.map((node) => node.value));

  const beforeCancel = await collectState();
  await widthInput.fill('9999');
  await widthInput.press('Escape');
  await page.waitForTimeout(250);
  const afterCancel = await collectState();
  const cancelledValue = await widthInput.inputValue();

  const beforeRejectedEdit = await collectState();
  await page.evaluate(() => {
    const storagePrototype = Object.getPrototypeOf(localStorage);
    window.__sitepilotOriginalSetItem = storagePrototype.setItem;
    storagePrototype.setItem = function rejectedPersistence() {
      throw new Error('forced-stage2-persistence-rejection');
    };
  });
  await widthInput.fill(String(committedWidth + 1));
  await widthInput.press('Enter');
  await page.waitForTimeout(300);
  const afterRejectedEdit = await collectState();
  await page.evaluate(() => {
    const storagePrototype = Object.getPrototypeOf(localStorage);
    storagePrototype.setItem = window.__sitepilotOriginalSetItem;
    delete window.__sitepilotOriginalSetItem;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const afterRejectedReload = await collectState();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download COLLADA DAE File' }).click();
  const download = await downloadPromise;
  const daePath = output(download.suggestedFilename());
  await download.saveAs(daePath);
  const dae = await fs.readFile(daePath, 'utf8');
  const daeInspection = {
    filename: download.suggestedFilename(),
    bytes: Buffer.byteLength(dae),
    meter: /<unit[^>]*meter="([^"]+)"/.exec(dae)?.[1] ?? null,
    upAxis: /<up_axis>([^<]+)<\/up_axis>/.exec(dae)?.[1] ?? null,
    geometryCount: (dae.match(/<geometry\b/g) ?? []).length,
    objectCount: (dae.match(/<instance_geometry\b/g) ?? []).length,
    sha256Input: dae.replace(/<created>[^<]*<\/created>/g, '<created/>').replace(/<modified>[^<]*<\/modified>/g, '<modified/>'),
  };

  await page.getByRole('button', { name: 'TOP — orthographic plan view' }).click();
  await page.waitForTimeout(450);
  const afterViewInteraction = await collectState();
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('*')) {
      if (element.scrollLeft !== 0) element.scrollLeft = 0;
    }
  });
  await page.screenshot({ path: output(`${expectedEngine}-top-view.png`), fullPage: true });

  const lifecycle = [];
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.getByRole('button', { name: '2D Site Plan (Illustrative) view' }).click();
    await page.waitForTimeout(180);
    lifecycle.push({ cycle, mode: '2D', canvases: await page.locator('canvas').count() });
    await page.getByRole('button', { name: '3D Spatial Model view' }).click();
    await page.waitForTimeout(300);
    lifecycle.push({ cycle, mode: '3D', canvases: await page.locator('canvas').count() });
  }

  const beforeReload = await collectState();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const afterReload = await collectState();

  const applicationConsoleEvents = consoleEvents.filter(({ text }) => (
    !text.includes('GL Driver Message')
    && !text.includes('GPU stall due to ReadPixels')
    && !text.includes('GL_INVALID_OPERATION')
    && !text.includes('forced-stage2-persistence-rejection')
    && !text.includes('[SitePilot Spatial Command] PERSISTENCE_FAILED')
  ));
  const report = {
    url: baseUrl,
    expectedEngine,
    initial,
    scenarioA,
    scenarioB,
    canvasEvidence,
    selection: { selected, selectedBefore, inputValuesBefore },
    edit: { committedWidth, afterEdit, inputValuesAfterEdit },
    undo: { afterUndo, inputValuesAfterUndo },
    redo: { afterRedo, inputValuesAfterRedo },
    cancelled: {
      before: beforeCancel,
      after: afterCancel,
      inputValue: cancelledValue,
      revisionUnchanged: beforeCancel.revisionId === afterCancel.revisionId,
      geometryUnchanged: beforeCancel.massSignature === afterCancel.massSignature,
    },
    rejected: {
      before: beforeRejectedEdit,
      after: afterRejectedEdit,
      afterReload: afterRejectedReload,
      revisionUnchanged: beforeRejectedEdit.revisionId === afterRejectedEdit.revisionId,
      geometryUnchanged: beforeRejectedEdit.massSignature === afterRejectedEdit.massSignature,
      persistedRevisionUnchanged: beforeRejectedEdit.revisionId === afterRejectedReload.revisionId,
      persistedGeometryUnchanged: beforeRejectedEdit.massSignature === afterRejectedReload.massSignature,
      expectedConsoleEvents: consoleEvents.filter(({ text }) => (
        text.includes('forced-stage2-persistence-rejection')
        || text.includes('[SitePilot Spatial Command] PERSISTENCE_FAILED')
      )),
    },
    dae: { ...daeInspection, sha256Input: undefined },
    daeNormalized: daeInspection.sha256Input,
    viewInteraction: {
      beforeRevision: afterCancel.revisionId,
      after: afterViewInteraction,
      canonicalRevisionUnchanged: afterViewInteraction.revisionId === afterCancel.revisionId,
    },
    lifecycle,
    reload: {
      before: beforeReload,
      after: afterReload,
      revisionPreserved: beforeReload.revisionId === afterReload.revisionId,
      geometryPreserved: beforeReload.massSignature === afterReload.massSignature,
    },
    consoleEvents,
    applicationConsoleEvents,
  };
  await fs.writeFile(output(`${expectedEngine}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    engine: expectedEngine,
    scenarioA: scenarioA.metrics,
    scenarioB: scenarioB.metrics,
    afterEdit: afterEdit.metrics,
    cancelled: report.cancelled,
    rejected: report.rejected,
    dae: report.dae,
    lifecycle,
    reload: report.reload,
    canvasEvidence,
    applicationConsoleEvents,
  }, null, 2));
} finally {
  await browser.close();
}
