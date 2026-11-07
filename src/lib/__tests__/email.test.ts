import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFollowUpEmail, sendFollowUpEmail } from '../email';

const baseInput = {
  to: 'marcus@example.com',
  clientName: 'Marcus Reed',
  businessName: 'Studio Chen Creative LLC',
  invoiceNumber: 'INV2-MARCUS-002',
  amount: 1200,
  currency: 'USD',
  dueDate: '2026-10-20T12:00:00.000Z',
  url: 'https://pulsepay.example/c/demo-token',
};

describe('Follow-up email', () => {
  it('builds a personal subject and both HTML and text bodies', () => {
    const email = buildFollowUpEmail(baseInput);

    assert.match(email.subject, /Studio Chen Creative LLC/);
    assert.match(email.subject, /INV2-MARCUS-002/);
    assert.match(email.text, /Hi Marcus,/);
    assert.match(email.text, /\$1,200/);
    assert.match(email.text, /https:\/\/pulsepay\.example\/c\/demo-token/);
    assert.match(email.html, /View invoice &amp; reply/);
    assert.match(email.html, /INV2-MARCUS-002/);
  });

  it('escapes user-controlled content in the HTML body', () => {
    const email = buildFollowUpEmail({
      ...baseInput,
      clientName: '<b>Marcus</b>',
      businessName: 'Studio <script>alert(1)</script>',
      invoiceNumber: 'INV"><img src=x onerror=alert(1)>',
    });

    assert.doesNotMatch(email.html, /<script>/);
    assert.doesNotMatch(email.html, /<img src=x/);
    assert.match(email.html, /&lt;script&gt;/);
    assert.match(email.html, /&lt;b&gt;Marcus&lt;\/b&gt;/);
  });

  it('skips delivery when Resend is not configured', async () => {
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const result = await sendFollowUpEmail(baseInput);

    if (previous !== undefined) process.env.RESEND_API_KEY = previous;
    assert.deepEqual(result, { sent: false, skipped: true });
  });
});
