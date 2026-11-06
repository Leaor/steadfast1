// Fails a test on `pageerror` / `console.error` (ARCHITECTURE §9), with a per-test allowlist
// for intentionally aborted requests. Also records 4xx/5xx and failed subresource requests.
export function watchPage(page) {
  const state = { errors: [], http: [], failed: [], allow: [], allowHttp: [] };
  page.on('pageerror', (e) => state.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location();
    state.errors.push(`console.error: ${m.text()}${loc?.url ? ` @ ${loc.url}:${loc.lineNumber}` : ''}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) state.http.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || '';
    // Media elements routinely cancel range requests when they switch or pause; not an error.
    if (/ERR_ABORTED/.test(f) && /\.(mp4|webm)(\?|$)/.test(r.url())) return;
    state.failed.push(`${f} ${r.method()} ${r.url()}`);
  });
  return {
    state,
    /** Allow console errors / page errors matching the regex for this test. */
    allow(re) { state.allow.push(re); },
    /** Allow HTTP >= 400 responses whose "STATUS METHOD URL" line matches the regex. */
    allowHttp(re) { state.allowHttp.push(re); },
    unexpectedErrors() { return state.errors.filter((e) => !state.allow.some((re) => re.test(e))); },
    httpErrors() { return state.http.filter((e) => !state.allowHttp.some((re) => re.test(e))); },
    failedRequests() { return state.failed.filter((e) => !state.allow.some((re) => re.test(e))); },
  };
}
