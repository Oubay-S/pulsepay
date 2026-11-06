import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPolicy } from '../policy-guard';
import type { PolicyRow, InvoiceRow } from '@/types/database';

const basePolicy: PolicyRow = {
  business_id: 'biz-001',
  max_discount_pct: 10,
  max_installments: 3,
  min_first_payment_pct: 30,
  approval_threshold: 2000,
  max_messages_per_day: 5,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  updated_at: new Date().toISOString(),
};

const standardInvoice: InvoiceRow = {
  id: 'inv-001',
  business_id: 'biz-001',
  client_id: 'cli-001',
  paypal_invoice_id: 'INV-100',
  parent_invoice_id: null,
  amount: 1000,
  currency: 'USD',
  due_date: new Date(Date.now() - 7 * 86400000).toISOString(),
  status: 'SENT',
  priority_score: 40,
  priority_reason: '7 days late',
  description: 'Design sprint',
  synced_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const highValueInvoice: InvoiceRow = {
  ...standardInvoice,
  id: 'inv-high',
  amount: 3500, // Exceeds approval_threshold (2000)
};

describe('Policy Guard — Strict Validation Engine', () => {
  it('allows a 5% discount within policy limits (max 10%) without owner approval', async () => {
    const proposal = {
      type: 'discount',
      discount_pct: 5,
      deadline_hours: 48,
    };

    const result = await checkPolicy(proposal, basePolicy, standardInvoice);

    assert.equal(result.allowed, true);
    assert.equal(result.needsApproval, false);
    if (result.allowed) {
      assert.equal(result.proposal.type, 'discount');
    }
  });

  it('routes discount exceeding policy (>10%) to owner approval queue', async () => {
    const proposal = {
      type: 'discount',
      discount_pct: 15, // Policy max is 10
      deadline_hours: 48,
    };

    const result = await checkPolicy(proposal, basePolicy, standardInvoice);

    assert.equal(result.allowed, false);
    assert.equal(result.needsApproval, true);
    assert.match(result.reason, /exceeds policy maximum of 10%/);
  });

  it('requires owner approval for discounts on high-value invoices (>= $2,000)', async () => {
    const proposal = {
      type: 'discount',
      discount_pct: 5,
      deadline_hours: 48,
    };

    const result = await checkPolicy(proposal, basePolicy, highValueInvoice);

    assert.equal(result.allowed, true);
    assert.equal(result.needsApproval, true);
    assert.match(result.reason, /meets or exceeds owner approval threshold/);
  });

  it('allows a valid 3-part installment plan summing to invoice amount', async () => {
    const proposal = {
      type: 'plan',
      installments: [
        { number: 1, amount: 400, due_date: new Date(Date.now() + 86400000).toISOString() },
        { number: 2, amount: 300, due_date: new Date(Date.now() + 30 * 86400000).toISOString() },
        { number: 3, amount: 300, due_date: new Date(Date.now() + 60 * 86400000).toISOString() },
      ],
    };

    const result = await checkPolicy(proposal, basePolicy, standardInvoice);

    assert.equal(result.allowed, true);
    assert.equal(result.needsApproval, false);
  });

  it('rejects installment plan if installment sum does not equal invoice amount', async () => {
    const proposal = {
      type: 'plan',
      installments: [
        { number: 1, amount: 300, due_date: new Date(Date.now() + 86400000).toISOString() },
        { number: 2, amount: 300, due_date: new Date(Date.now() + 30 * 86400000).toISOString() },
      ], // Sum = 600, but invoice is 1000
    };

    const result = await checkPolicy(proposal, basePolicy, standardInvoice);

    assert.equal(result.allowed, false);
    assert.equal(result.needsApproval, false);
    assert.match(result.reason, /does not match invoice total/);
  });

  it('routes installment plan to approval if first installment is under minimum percentage (30%)', async () => {
    const proposal = {
      type: 'plan',
      installments: [
        { number: 1, amount: 200, due_date: new Date(Date.now() + 86400000).toISOString() }, // 20% < 30% min
        { number: 2, amount: 400, due_date: new Date(Date.now() + 30 * 86400000).toISOString() },
        { number: 3, amount: 400, due_date: new Date(Date.now() + 60 * 86400000).toISOString() },
      ],
    };

    const result = await checkPolicy(proposal, basePolicy, standardInvoice);

    assert.equal(result.allowed, false);
    assert.equal(result.needsApproval, true);
    assert.match(result.reason, /below minimum required first payment/);
  });

  it('immediately intercepts disputes and flags them for owner sign-off', async () => {
    const proposal = {
      type: 'dispute',
      reason: 'Deliverable was not received by client',
    };

    const result = await checkPolicy(proposal, basePolicy, standardInvoice);

    assert.equal(result.allowed, false);
    assert.equal(result.needsApproval, true);
    assert.match(result.reason, /Client triggered dispute/);
  });

  it('rejects malformed proposal payloads with invalid types or missing fields', async () => {
    const badProposal = {
      type: 'discount',
      discount_pct: 'invalid_string', // Should be a number
    };

    const result = await checkPolicy(badProposal, basePolicy, standardInvoice);

    assert.equal(result.allowed, false);
    assert.equal(result.needsApproval, false);
    assert.match(result.reason, /Proposal schema error/);
  });
});
