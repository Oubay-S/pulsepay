import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPlanCounter,
  counterAmount,
  defaultCounterDiscount,
  describeRequest,
  explainApproval,
  isDispute,
  isInvoicePayable,
} from '../normalize';
import type { ApprovalArrangement } from '../types';
import type { PolicyRow } from '@/types/database';

const policy: PolicyRow = {
  business_id: 'biz-1',
  max_discount_pct: 10,
  max_installments: 3,
  min_first_payment_pct: 30,
  approval_threshold: 2000,
  max_messages_per_day: 5,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  updated_at: '2026-11-07T12:00:00.000Z',
};

function approval(overrides: Partial<ApprovalArrangement> = {}): ApprovalArrangement {
  return {
    id: 'arr-1',
    invoice_id: 'inv-1',
    conversation_id: 'conv-1',
    type: 'DISCOUNT',
    terms: { requested_discount_pct: 35, discounted_amount: 780, reason: 'Budget freeze' },
    status: 'PENDING_APPROVAL',
    approved_by: null,
    rejection_reason: null,
    created_at: '2026-11-07T12:00:00.000Z',
    updated_at: '2026-11-07T12:00:00.000Z',
    invoice: {
      id: 'inv-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      paypal_invoice_id: 'INV-1',
      parent_invoice_id: null,
      amount: 1200,
      currency: 'USD',
      due_date: '2026-10-20T12:00:00.000Z',
      status: 'SENT',
      priority_score: 50,
      priority_reason: null,
      description: null,
      synced_at: '2026-11-07T12:00:00.000Z',
      created_at: '2026-11-07T12:00:00.000Z',
      client: {
        id: 'client-1',
        business_id: 'biz-1',
        name: 'Marcus Reed',
        email: 'marcus@example.com',
        on_time_rate: 65,
        total_invoices: 5,
        total_paid: 3,
        created_at: '2026-11-07T12:00:00.000Z',
      },
    },
    conversation: { status: 'ACTIVE', token: 'demo-token' },
    ...overrides,
  };
}

describe('Approvals normalization', () => {
  it('recognizes a legacy discount request as non-executable', () => {
    const request = describeRequest(approval());

    assert.equal(request.kind, 'discount');
    assert.equal(request.executable, false);
    assert.equal(request.requestedDiscountPct, 35);
    assert.equal(request.requestedAmount, 780);
    assert.equal(request.reason, 'Budget freeze');
  });

  it('recognizes a valid discount proposal as executable', () => {
    const request = describeRequest(
      approval({
        terms: { type: 'discount', discount_pct: 5, deadline_hours: 48 },
      })
    );

    assert.equal(request.kind, 'discount');
    assert.equal(request.executable, true);
    assert.equal(request.proposal?.type, 'discount');
  });

  it('recognizes a valid installment plan', () => {
    const request = describeRequest(
      approval({
        type: 'PLAN',
        terms: {
          type: 'plan',
          installments: [
            { number: 1, amount: 400, due_date: '2026-11-08T12:00:00.000Z' },
            { number: 2, amount: 400, due_date: '2026-12-08T12:00:00.000Z' },
            { number: 3, amount: 400, due_date: '2027-01-08T12:00:00.000Z' },
          ],
        },
      })
    );

    assert.equal(request.kind, 'plan');
    assert.equal(request.executable, true);
  });

  it('caps the default counter at the policy maximum', () => {
    assert.equal(defaultCounterDiscount(approval(), 10), 10);
    assert.equal(defaultCounterDiscount(approval({ terms: { requested_discount_pct: 7 } }), 10), 7);
  });

  it('builds a counter-plan that sums back to the invoice amount', () => {
    const plan = buildPlanCounter({
      invoiceAmount: 1200,
      installments: 3,
      firstAmount: 400,
      firstDueDate: '2026-11-07T12:00:00.000Z',
    });

    assert.equal(plan.type, 'plan');
    if (plan.type !== 'plan') return;
    assert.equal(plan.installments.length, 3);
    assert.equal(
      plan.installments.reduce((sum, installment) => sum + installment.amount, 0),
      1200
    );
  });

  it('calculates the discounted amount safely', () => {
    assert.equal(counterAmount(1200, 10), 1080);
    assert.equal(counterAmount(3500, 35), 2275);
  });

  it('explains the threshold, discount limit, and disputes', () => {
    assert.match(explainApproval(approval(), policy), /35% discount/);

    const highValue = approval({
      invoice: { ...approval().invoice, amount: 3500 },
    });
    assert.match(explainApproval(highValue, policy), /approval threshold/);

    const dispute = approval({
      conversation: { status: 'DISPUTED', token: 'demo-token' },
    });
    assert.equal(isDispute(dispute), true);
    assert.match(explainApproval(dispute, policy), /disputed the work/);
  });

  it('knows which invoice states are still payable', () => {
    assert.equal(isInvoicePayable('SENT'), true);
    assert.equal(isInvoicePayable('PARTIALLY_PAID'), true);
    assert.equal(isInvoicePayable('PAID'), false);
    assert.equal(isInvoicePayable('SUPERSEDED'), false);
  });
});
