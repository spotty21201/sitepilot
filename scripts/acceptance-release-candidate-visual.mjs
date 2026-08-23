import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SITEPILOT_URL;
const artifactDir = process.env.SITEPILOT_ARTIFACT_DIR;
if (!baseUrl || !artifactDir) {
  throw new Error('SITEPILOT_URL and SITEPILOT_ARTIFACT_DIR are required.');
}

await fs.mkdir(artifactDir, { recursive: true });
const output = (name) => path.join(artifactDir, name);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
const page = await context.newPage();
const applicationErrors = [];
page.on('pageerror', (error) => applicationErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('GL Driver Message')) {
    applicationErrors.push(message.text());
  }
});

const scenarioButton = (prefix) => page.locator('button[aria-pressed]').filter({ hasText: prefix }).first();

async function fontFamilies(rootSelector) {
  return page.locator(rootSelector).evaluate((root) => {
    const families = new Set();
    for (const element of root.querySelectorAll('*')) {
      if (element.getClientRects().length > 0 && element.textContent?.trim()) {
        families.add(getComputedStyle(element).fontFamily);
      }
    }
    return [...families].sort();
  });
}

async function selectVisibleMass() {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Spatial Console canvas has no browser box.');
  for (const [xRatio, yRatio] of [[0.48, 0.54], [0.55, 0.52], [0.62, 0.56], [0.5, 0.44]]) {
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
    await page.waitForTimeout(140);
    const selected = await page.locator('[data-spatial-engine="spatial-console"]').getAttribute('data-selected-mass-id');
    if (selected) return selected;
  }
  throw new Error('Could not select a canonical mass through the production canvas.');
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(650);

  const engine = await page.locator('[data-spatial-engine]').getAttribute('data-spatial-engine');
  assert(engine === 'spatial-console', `Expected default Spatial Console, received ${engine}.`);
  assert(await page.locator('canvas').count() === 1, 'Default release candidate did not mount exactly one canvas.');
  assert(await page.getByRole('button', { name: /Measure|Measurement/ }).count() === 0, 'Unavailable Measurement remains in the primary rail.');
  await page.screenshot({ path: output('01-decision-room-1600x950.png'), fullPage: true });
  await page.screenshot({ path: output('02-spatial-no-selection-1600x950.png'), fullPage: true });

  const selectedMassId = await selectVisibleMass();
  await page.screenshot({ path: output('03-spatial-selected-mass-1600x950.png'), fullPage: true });

  const scenarioEvidence = [];
  for (const [prefix, name] of [
    ['A: Low-Rise Heritage Villas', '04-scenario-a-1600x950.png'],
    ['B: Mid-Rise Mixed-Use', '05-scenario-b-1600x950.png'],
    ['C: Speculative High-Density', '06-scenario-c-constraint-1600x950.png'],
  ]) {
    await scenarioButton(prefix).click();
    await page.waitForTimeout(260);
    if (prefix.startsWith('C:')) {
      await page.getByRole('button', { name: 'Constraints display mode' }).click();
      await page.waitForTimeout(180);
    }
    scenarioEvidence.push({
      prefix,
      scenarioId: await page.locator('[data-spatial-engine]').getAttribute('data-scenario-id'),
      revisionId: await page.locator('[data-spatial-engine]').getAttribute('data-canonical-revision'),
      canvasCount: await page.locator('canvas').count(),
    });
    await page.screenshot({ path: output(name), fullPage: true });
  }

  await page.getByRole('button', { name: 'Evidence Ledger' }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: output('07-evidence-ledger-1600x950.png'), fullPage: true });
  const search = page.getByPlaceholder('Search the ledger');
  await search.focus();
  await search.fill('boundary');
  const focusStyle = await search.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor };
  });
  await page.screenshot({ path: output('08-evidence-expanded-focus-1600x950.png'), fullPage: true });
  const evidenceFonts = await fontFamilies('[aria-labelledby="evidence-ledger-title"]');
  assert(evidenceFonts.every((family) => /Inter|JetBrains Mono/.test(family)), `Evidence Ledger rendered an unexpected family: ${evidenceFonts.join(', ')}`);
  assert(focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth === '2px', 'Evidence keyboard focus is not visibly outlined.');

  await page.getByTitle('Create New Opportunity').click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: output('09-new-opportunity-1600x950.png'), fullPage: true });
  const newOpportunityFonts = await fontFamilies('[aria-labelledby="new-case-modal-title"]');
  const newOpportunityTokens = await page.locator(':root').evaluate((root) => {
    const style = getComputedStyle(root);
    return ['--bg-primary', '--bg-secondary', '--bg-tertiary', '--text-primary', '--text-secondary', '--status-verified', '--status-assumed', '--status-warning', '--status-error', '--status-evidence']
      .reduce((tokens, key) => ({ ...tokens, [key]: style.getPropertyValue(key).trim() }), {});
  });
  assert(newOpportunityFonts.every((family) => /Inter|JetBrains Mono/.test(family)), `New Opportunity rendered an unexpected family: ${newOpportunityFonts.join(', ')}`);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Compare all scenarios side-by-side' }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: output('10-scenario-comparison-1600x950.png'), fullPage: true });
  const comparisonFonts = await fontFamilies('[aria-labelledby="scenario-comparison-title"]');
  const comparisonVerdicts = await page
    .locator('[aria-labelledby="scenario-comparison-title"]')
    .getByText(/^(COMPLIANT|CONSTRAINED)$/)
    .allTextContents();
  assert(comparisonFonts.some((family) => /Inter/.test(family)), 'Scenario Comparison prose does not use Inter.');
  assert(comparisonFonts.some((family) => /JetBrains Mono/.test(family)), 'Scenario Comparison numeric values do not use JetBrains Mono.');
  assert(
    comparisonVerdicts.filter((verdict) => verdict === 'COMPLIANT').length === 2
      && comparisonVerdicts.filter((verdict) => verdict === 'CONSTRAINED').length === 1,
    `Scenario Comparison did not preserve canonical A/B compliant and C constrained status: ${comparisonVerdicts.join(', ')}`
  );
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1280, height: 760 });
  await page.waitForTimeout(240);
  await page.screenshot({ path: output('11-decision-room-1280x760.png'), fullPage: true });
  await page.getByRole('button', { name: 'Evidence Ledger' }).click();
  await page.screenshot({ path: output('12-evidence-ledger-1280x760.png'), fullPage: true });
  await page.getByTitle('Create New Opportunity').click();
  await page.screenshot({ path: output('13-new-opportunity-1280x760.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Compare all scenarios side-by-side' }).click();
  await page.screenshot({ path: output('14-scenario-comparison-1280x760.png'), fullPage: true });

  assert(applicationErrors.length === 0, `Application errors: ${applicationErrors.join(' | ')}`);
  const report = {
    url: baseUrl,
    viewportEvidence: ['1600x950', '1280x760'],
    engine,
    selectedMassId,
    scenarioEvidence,
    evidenceFonts,
    newOpportunityFonts,
    comparisonFonts,
    comparisonVerdicts,
    focusStyle,
    newOpportunityTokens,
    measurementInPrimaryRail: false,
    applicationErrors,
  };
  await fs.writeFile(output('visual-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await browser.close();
}
