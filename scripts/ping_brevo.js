// ping_brevo.js
//
// Keeps BREVO_API_KEY alive. Brevo deactivates an API key after 90 days with
// no calls, which would silently break forgot-password — the endpoint would
// start 401ing at exactly the moment a locked-out user needs it.
//
// This deliberately does NOT send an email.
//
// Brevo's policy counts *API calls made with the key*, not emails delivered,
// so a read-only GET satisfies it. Sending a real "fake OTP" instead would:
//   - deliver junk to a live inbox every run,
//   - spend the 300/day free quota,
//   - and train spam filters against the sender address, which matters a lot
//     here because the real OTP has to reach users' inboxes.
//
// /v3/account is the cheapest authenticated read Brevo offers, and it returns
// the remaining email credits as a useful side effect.
//
// Usage:
//   BREVO_API_KEY=xkeysib-... node scripts/ping_brevo.js

async function run() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set.');
  }

  const response = await fetch('https://api.brevo.com/v3/account', {
    method: 'GET',
    headers: { 'api-key': apiKey, accept: 'application/json' },
  });

  if (response.status === 401) {
    throw new Error(
      'Brevo rejected the key (401). It has already expired or been revoked — ' +
        'generate a new one at https://app.brevo.com/settings/keys/api and update ' +
        'BREVO_API_KEY everywhere it is set (.env, the host, GitHub secrets).'
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo ping failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const account = await response.json();

  // The response shape has shifted across Brevo API versions, so read
  // defensively rather than assuming a fixed path — a keepalive that crashes
  // on an unexpected payload defeats its own purpose.
  const email = account?.email ?? 'unknown account';
  const plan = Array.isArray(account?.plan) ? account.plan[0] : null;
  const credits = plan?.credits ?? plan?.creditsType ?? null;

  console.log(`✅ Brevo keep-alive OK — key is active for ${email}.`);
  if (credits !== null) {
    console.log(`   Remaining credits: ${credits}`);
  }
}

run().catch((err) => {
  console.error('❌ Brevo keep-alive failed:', err.message);
  process.exit(1);
});
