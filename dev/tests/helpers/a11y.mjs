// axe via @axe-core/playwright; fails on serious and critical impacts (ARCHITECTURE §9).
import * as axeMod from '@axe-core/playwright';
const AxeBuilder = axeMod.AxeBuilder || axeMod.default?.AxeBuilder || axeMod.default;

/**
 * Runs axe and returns the serious/critical violations (ARCHITECTURE §9).
 * `include`: scope the scan to one subtree (e.g. an open dialog: `[id="sf-cart-drawer"] dialog`), so a
 * modal state is audited on its own rather than drowned out by (inert) page content behind it.
 */
export async function axeSeriousViolations(page, testInfo, { name = 'axe', exclude = [], include = null } = {}) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('#sf-preview-ribbon');
  if (include) builder = builder.include(include);
  for (const sel of exclude) builder = builder.exclude(sel);
  const result = await builder.analyze();
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify({ url: page.url(), violations: result.violations }, null, 2),
    contentType: 'application/json',
  });
  return bad.map((v) => ({
    id: v.id, impact: v.impact, help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n').slice(0, 2).join(' ')}`),
  }));
}
