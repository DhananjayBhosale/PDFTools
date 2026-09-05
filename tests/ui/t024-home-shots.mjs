/*
 * T024 evidence harness for the Home / Tools surface.
 *
 * Captures the phone, tablet, desktop, dark and 200%-text views, and measures
 * the things the owner feedback names: the rhythm above the first row, the row
 * pitch, the practical target sizes, and whether the page ever scrolls
 * sideways. Screenshots plus a metrics JSON land in output/t024-home/.
 *
 * Usage: PDF_CHEF_URL=http://127.0.0.1:3000 node tests/ui/t024-home-shots.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:3000';
const outputDir = path.join(process.cwd(), 'output', 't024-home');

/** Viewports the acceptance list asks for, plus the two adaptation widths. */
const VIEWPORTS = [
  { name: 'phone-320x568', width: 320, height: 568 },
  { name: 'phone-393x852', width: 393, height: 852 },
  { name: 'tablet-834x1112', width: 834, height: 1112 },
  { name: 'desktop-1280x900', width: 1280, height: 900 },
];

const settings = {
  autoDownload: false,
  keepLocalHistory: true,
  confirmLargeJobs: false,
  largeFileWarningMb: 80,
  onboardingComplete: true,
};

const measure = () =>
  // eslint-disable-next-line no-undef
  window.__t024Measure();

const MEASURE_SOURCE = () => {
  const rect = (selector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { top: +box.top.toFixed(1), height: +box.height.toFixed(1), width: +box.width.toFixed(1) };
  };

  // eslint-disable-next-line no-undef
  window.__t024Measure = () => {
    const rows = [...document.querySelectorAll('.chef-divided-list > li > a')];
    const segments = [...document.querySelectorAll('[aria-pressed]')];
    const search = document.querySelector('#tool-search');
    const searchTarget = search?.closest('label');
    const list = document.querySelector('.chef-divided-list');
    const firstRow = rows[0]?.getBoundingClientRect();
    const bubble = rows[0]?.querySelector('span[aria-hidden]')?.getBoundingClientRect();
    const title = rows[0]?.querySelector('span > span > span');
    const subtitle = rows[0]?.querySelector('.chef-clamp-2');
    const heading = document.querySelector('h1');
    const logo = document.querySelector('h1')?.parentElement?.parentElement?.querySelector('img');

    return {
      docScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      horizontalPageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      heading: heading
        ? {
            fontSize: getComputedStyle(heading).fontSize,
            lineHeight: getComputedStyle(heading).lineHeight,
            fontWeight: getComputedStyle(heading).fontWeight,
          }
        : null,
      logo: logo ? { width: +logo.getBoundingClientRect().width.toFixed(1) } : null,
      privacy: rect('[role="note"]'),
      searchVisual: search ? +search.getBoundingClientRect().height.toFixed(1) : null,
      searchTarget: searchTarget ? +searchTarget.getBoundingClientRect().height.toFixed(1) : null,
      categoryShell: rect('[aria-pressed]')
        ? +document.querySelector('[aria-pressed]').parentElement.getBoundingClientRect().height.toFixed(1)
        : null,
      categoryLines: new Set(segments.map((node) => Math.round(node.getBoundingClientRect().top))).size,
      // The pressable box, and the box the `.chef-hit-y` extension actually
      // covers. The extension is vertical only (`inset-inline: 0`), so the hit
      // width is the element's own width and neighbours cannot overlap.
      segments: segments.map((node, index) => {
        const box = node.getBoundingClientRect();
        const before = getComputedStyle(node, '::before');
        const hitHeight = Math.max(box.height, parseFloat(before.minHeight) || 0);
        const next = segments[index + 1]?.getBoundingClientRect();
        const sameLine = next && Math.abs(next.top - box.top) < 2;
        return {
          label: node.getAttribute('aria-label'),
          hitWidth: +box.width.toFixed(1),
          visualHeight: +box.height.toFixed(1),
          hitHeight: +hitHeight.toFixed(1),
          meets44: box.width >= 44 && hitHeight >= 44,
          // Positive means a gap to the next segment on the same line; negative
          // would mean the hit boxes overlap.
          gapToNext: sameLine ? +(next.left - box.right).toFixed(1) : null,
        };
      }),
      segmentsMeet44: segments.every((node) => {
        const box = node.getBoundingClientRect();
        const hit = Math.max(box.height, parseFloat(getComputedStyle(node, '::before').minHeight) || 0);
        return box.width >= 44 && hit >= 44;
      }),
      segmentOverlap: segments.some((node, index) => {
        const box = node.getBoundingClientRect();
        const next = segments[index + 1]?.getBoundingClientRect();
        return Boolean(next) && Math.abs(next.top - box.top) < 2 && next.left < box.right - 0.5;
      }),
      // Does the visible prompt actually fit inside the field, or is the reader
      // seeing a clipped sentence?
      searchPrompt: (() => {
        if (!search) return null;
        const style = getComputedStyle(search);
        const probe = document.createElement('span');
        probe.textContent = search.placeholder;
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font};letter-spacing:${style.letterSpacing};`;
        document.body.append(probe);
        const textWidth = probe.getBoundingClientRect().width;
        probe.remove();
        const available =
          search.getBoundingClientRect().width -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight) -
          parseFloat(style.borderLeftWidth) -
          parseFloat(style.borderRightWidth);
        return {
          text: search.placeholder,
          textWidth: +textWidth.toFixed(1),
          available: +available.toFixed(1),
          fits: textWidth <= available,
          ariaLabel: search.getAttribute('aria-label'),
        };
      })(),
      rowCount: rows.length,
      listTop: list ? +list.getBoundingClientRect().top.toFixed(1) : null,
      firstRowTop: firstRow ? +firstRow.top.toFixed(1) : null,
      rowHeights: rows.slice(0, 8).map((node) => +node.getBoundingClientRect().height.toFixed(1)),
      minRowHeight: rows.length ? Math.min(...rows.map((node) => node.getBoundingClientRect().height)) : null,
      bubble: bubble ? { width: +bubble.width.toFixed(1), height: +bubble.height.toFixed(1) } : null,
      rowTitle: title ? { fontSize: getComputedStyle(title).fontSize, lineHeight: getComputedStyle(title).lineHeight } : null,
      rowSubtitle: subtitle
        ? { fontSize: getComputedStyle(subtitle).fontSize, lineHeight: getComputedStyle(subtitle).lineHeight }
        : null,
      dividerInset: (() => {
        const second = document.querySelector('.chef-divided-list > li + li');
        return second ? getComputedStyle(second, '::before').marginInlineStart : null;
      })(),
      listScrollHeight: list ? +list.getBoundingClientRect().height.toFixed(1) : null,
      documentHeight: document.documentElement.scrollHeight,
    };
  };
};

const shoot = async (page, name) => {
  await page.screenshot({ path: path.join(outputDir, `${name}.png`) });
};

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {};
const consoleErrors = [];

const makeContext = async ({ width, height, dark = false, textScale = null, reducedMotion = null }) => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light',
    reducedMotion: reducedMotion ?? 'no-preference',
  });
  await context.addInitScript(
    ([serialisedSettings, theme, scale]) => {
      localStorage.setItem('pdfchef.workspace.settings.v1', serialisedSettings);
      localStorage.setItem('theme', theme);
      if (scale) localStorage.setItem('pdfchef.appearance.text-scale.v1', scale);
    },
    [JSON.stringify(settings), dark ? 'dark' : 'light', textScale],
  );
  await context.addInitScript(MEASURE_SOURCE);
  return context;
};

const open = async (context) => {
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'PDF Chef' }).waitFor();
  await page.waitForTimeout(350);
  return page;
};

try {
  for (const viewport of VIEWPORTS) {
    const context = await makeContext(viewport);
    const page = await open(context);
    await shoot(page, viewport.name);
    report[viewport.name] = await page.evaluate(measure);

    // Scrolled to the catalog, so the row rhythm is visible on its own.
    await page.evaluate(() => window.scrollTo(0, 520));
    await page.waitForTimeout(200);
    await shoot(page, `${viewport.name}-scrolled`);
    await page.evaluate(() => window.scrollTo(0, 0));

    if (viewport.width < 500) {
      // Search active, so the clear control and the result count are on record.
      await page.fill('#tool-search', 'sign');
      await page.waitForTimeout(300);
      await shoot(page, `${viewport.name}-search`);
      await page.fill('#tool-search', '');
      await page.waitForTimeout(200);

      // Keyboard: tab to the first segment and record the visible ring.
      await page.focus('#tool-search');
      await page.keyboard.press('Tab');
      await shoot(page, `${viewport.name}-focus-ring`);
      report[`${viewport.name}-focus`] = await page.evaluate(() => {
        const active = document.activeElement;
        const style = getComputedStyle(active);
        return { tag: active.tagName, label: active.getAttribute('aria-label'), outline: style.outlineWidth };
      });
    }

    await context.close();
  }

  // Dark theme at the phone width.
  {
    const context = await makeContext({ width: 393, height: 852, dark: true });
    const page = await open(context);
    await shoot(page, 'phone-393x852-dark');
    report['phone-393x852-dark'] = await page.evaluate(measure);
    await context.close();
  }

  // Dark theme, desktop.
  {
    const context = await makeContext({ width: 1280, height: 900, dark: true });
    const page = await open(context);
    await shoot(page, 'desktop-1280x900-dark');
    await context.close();
  }

  // 200% text: the app's own "larger" step plus a true 2x root scale, which is
  // what a browser text-size setting of 200% actually does to a rem layout.
  for (const viewport of [
    { name: 'phone-320x568-text200', width: 320, height: 568 },
    { name: 'phone-393x852-text200', width: 393, height: 852 },
  ]) {
    const context = await makeContext({ ...viewport, textScale: 'larger' });
    const page = await open(context);
    await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '2'));
    await page.waitForTimeout(250);
    await shoot(page, viewport.name);
    report[viewport.name] = await page.evaluate(measure);
    await context.close();
  }

  // Reduced motion, to record that the press state is still legible.
  {
    const context = await makeContext({ width: 393, height: 852, reducedMotion: 'reduce' });
    const page = await open(context);
    const row = page.locator('.chef-divided-list > li > a').first();
    await row.hover();
    await page.mouse.down();
    await page.waitForTimeout(120);
    await shoot(page, 'phone-393x852-reduced-motion-pressed');
    await page.mouse.up();
    report['reduced-motion'] = await page.evaluate(() => {
      const node = document.querySelector('.chef-divided-list > li > a');
      return { transition: getComputedStyle(node).transitionDuration };
    });
    await context.close();
  }

  // Press feedback at normal motion, captured mid-press.
  {
    const context = await makeContext({ width: 393, height: 852 });
    const page = await open(context);
    const row = page.locator('.chef-divided-list > li > a').first();
    await row.hover();
    await page.mouse.down();
    await page.waitForTimeout(120);
    await shoot(page, 'phone-393x852-pressed');
    await page.mouse.up();
    await context.close();
  }

  report.consoleErrors = consoleErrors;
  await fs.writeFile(path.join(outputDir, 'metrics.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
