// check_deployment.js
// Fails when the LIVE site is not running the latest commit on the branch.
//
// -------------------------------------------------------------------------
// WHY THIS EXISTS
// -------------------------------------------------------------------------
// The Vercel frontend stopped deploying on 26 Aug 2026 and nobody noticed
// until 20 Sep. It was not down — it answered every request with a healthy
// 200 and served a two-month-old build, so three commits' worth of work
// (a period label, a whole dashboard tab, a data fix) sat in main looking
// shipped while the client saw none of it.
//
// A plain uptime check would not have caught it: the site was up. The only
// way to see a frozen deployment is to ask the running service WHICH VERSION
// it is, and compare that against the branch. That is all this does.
//
// Run from the daily keep-alive workflow. On a mismatch it exits non-zero,
// the workflow goes red, and GitHub emails whoever owns the repo that day.
//
// Usage:
//   APP_URL=https://... EXPECTED_COMMIT=$(git rev-parse HEAD) node scripts/check_deployment.js
//
// Exit codes:
//   0  live commit matches, or the host reports no commit (warned, not failed)
//   1  the deployment has drifted, or the health endpoint is unreachable

const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');
const EXPECTED = (process.env.EXPECTED_COMMIT || '').trim();

// A deploy triggered by the same push this check runs for may still be
// building. Retrying a few times costs nothing on a daily schedule and
// avoids a red workflow for a deployment that is merely a minute behind.
const ATTEMPTS = 3;
const GAP_MS = 30_000;

function short(sha) {
  return sha ? sha.slice(0, 8) : '(none)';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHealth() {
  // A sleeping free-tier service can take ~60s to wake, which is longer than
  // fetch's default patience on some runtimes — be explicit rather than
  // reporting a cold start as an outage.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${APP_URL}/api/health`, { signal: controller.signal });
    if (!res.ok) throw new Error(`health endpoint returned HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!APP_URL) {
    console.error('APP_URL is not set. Add it as a repository secret pointing at the live site.');
    process.exit(1);
  }
  if (!EXPECTED) {
    console.error('EXPECTED_COMMIT is not set.');
    process.exit(1);
  }

  let health;
  let lastError;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      health = await fetchHealth();
      if (health.commit && health.commit === EXPECTED) break;
      // Matched-but-stale, or unknown: no point retrying an 'unknown', but a
      // stale SHA may just be a build finishing.
      if (health.commit === 'unknown') break;
      lastError = `live commit ${short(health.commit)} != expected ${short(EXPECTED)}`;
    } catch (err) {
      lastError = err.message;
      health = null;
    }
    if (attempt < ATTEMPTS) {
      console.log(`Attempt ${attempt}/${ATTEMPTS}: ${lastError}. Retrying in ${GAP_MS / 1000}s...`);
      await sleep(GAP_MS);
    }
  }

  if (!health) {
    console.error(`FAIL: could not read ${APP_URL}/api/health — ${lastError}`);
    console.error('The site may be down, suspended, or the URL may be wrong.');
    process.exit(1);
  }

  // The host injects no commit (local run, or a platform that does not supply
  // one). Say so clearly, but do not fail: a false red every morning trains
  // people to ignore the alert, which is how the original problem went
  // unnoticed in the first place.
  if (!health.commit || health.commit === 'unknown') {
    console.log('WARNING: the live service reports no commit, so freshness cannot be checked.');
    console.log('On Render this means RENDER_GIT_COMMIT is not reaching the process.');
    process.exit(0);
  }

  if (health.commit !== EXPECTED) {
    console.error('');
    console.error('FAIL: the live site is NOT running the latest commit.');
    console.error(`  live on ${APP_URL}: ${short(health.commit)}`);
    console.error(`  latest on this branch: ${short(EXPECTED)}`);
    console.error('');
    console.error('The deployment has stopped keeping up with the repository.');
    console.error('Check the host dashboard for failed builds, a suspended service,');
    console.error('or an unpaid invoice — all three look identical from outside.');
    process.exit(1);
  }

  console.log(`OK: live site is running ${short(health.commit)}, matching this branch.`);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
