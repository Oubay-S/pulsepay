import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeClientPortalData,
  normalizeOffers,
} from '../normalize';
import {
  daysPastDue,
  formatMoney,
  initials,
  pluralize,
} from '../format';
import type { ClientPortalInvoice } from '../types';

const invoice: ClientPortalInvoice = {
  id: '11111111-1111-4111-8111-111111111111',
  number: 'INV2-MARCUS-002',
  amount: 1200,
  currency: 'USD',
  dueDate: '2026-10-20T12:00:00.000Z',
  description: 'Checkout redesign',
  status: 'SENT',
};

function planOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    invoice_id: invoice.id,
    conversation_id: 'conv-1',
    type: 'PLAN',
    terms: {
      type: 'plan',
      installments: [
        { number: 1, amount: 400, due_date: '2026-11-08T12:00:00.000Z' },
        { number: 2, amount: 400, due_date: '2026-12-08T12:00:00.000Z' },
        { number: 3, amount: 400, due_date: '2027-01-08T12:00:00.000Z' },
      ],
    },
    status: 'PROPOSED',
    approved_by: 'POLICY',
    rejection_reason: null,
    created_at: '2026-11-07T12:00:00.000Z',
    updated_at: '2026-11-07T12:00:00.000Z',
    installments: [],
    ...overrides,
  };
}

describe('Client portal formatting', () => {
  it('formats whole amounts without unnecessary cents', () => {
    assert.equal(formatMoney(1200, 'USD'), '$1,200');
    assert.equal(formatMoney(400.5, 'USD'), '$400.50');
  });

  it('counts whole days past due from the due date', () => {
    assert.equal(daysPastDue('2026-10-20T12:00:00.000Z', '2026-11-07T09:00:00.000Z'), 18);
    assert.equal(daysPastDue('2026-12-01T12:00:00.000Z', '2026-11-07T09:00:00.000Z'), 0);
  });

  it('builds readable initials and plurals', () => {
    assert.equal(initials('Marcus Reed'), 'MR');
    assert.equal(initials('Studio Chen Creative LLC'), 'SC');
    assert.equal(pluralize(1, 'day'), '1 day');
    assert.equal(pluralize(3, 'day'), '3 days');
  });
});

describe('Client portal payload normalization', () => {
  it('safely normalizes a full payload', () => {
    const data = normalizeClientPortalData({
      conversation_id: 'conv-1',
      status: 'ACTIVE',
      business_name: 'Studio Chen Creative LLC',
      client_name: 'Marcus Reed',
      business_tone: 'friendly',
      demo_now: '2026-11-07T12:00:00.000Z',
      invoice: {
        id: invoice.id,
        paypal_invoice_id: invoice.number,
        amount: 1200,
        currency: 'USD',
        due_date: invoice.dueDate,
        description: 'Checkout redesign',
        status: 'SENT',
      },
      messages: [
        {
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender: 'AGENT',
          content: 'Hello',
          intent: 'FOLLOW_UP',
          created_at: '2026-11-07T12:00:00.000Z',
        },
      ],
      offers: [planOffer()],
    });

    assert.equal(data.businessName, 'Studio Chen Creative LLC');
    assert.equal(data.clientName, 'Marcus Reed');
    assert.equal(data.invoice.amount, 1200);
    assert.equal(data.messages.length, 1);
    assert.equal(data.offers.length, 1);
  });

  it('survives a malformed payload without throwing', () => {
    const data = normalizeClientPortalData({
      status: 'UNKNOWN',
      invoice: { amount: 'not-a-number' },
      messages: [{ sender: 'ALIEN' }, null],
      offers: [{ id: 'missing-fields' }],
    });

    assert.equal(data.status, 'ACTIVE');
    assert.equal(data.invoice.amount, 0);
    assert.equal(data.invoice.status, 'SENT');
    assert.equal(data.messages.length, 0);
    assert.equal(data.offers.length, 0);
  });
});

describe('Client portal offer normalization', () => {
  it('turns a valid plan into an acceptable 3 × $400 offer', () => {
    const offers = normalizeOffers([planOffer()], invoice);

    assert.equal(offers.length, 1);
    assert.equal(offers[0].kind, 'plan');
    if (offers[0].kind !== 'plan') return;

    assert.equal(offers[0].installments.length, 3);
    assert.equal(offers[0].totalAmount, 1200);
    assert.equal(offers[0].canAccept, true);
  });

  it('keeps Pay Later informational and ranks it below an actionable plan', () => {
    const offers = normalizeOffers(
      [
        {
          id: 'later-1',
          invoice_id: invoice.id,
          type: 'PAY_LATER',
          terms: { type: 'pay_later', invoice_amount: 1200 },
          status: 'PROPOSED',
          created_at: '2026-11-07T12:01:00.000Z',
          installments: [],
        },
        planOffer(),
      ],
      invoice
    );

    assert.equal(offers[0].kind, 'plan');
    assert.equal(offers[1].kind, 'pay_later');
    if (offers[1].kind !== 'pay_later') return;
    assert.equal(offers[1].canAccept, false);
  });

  it('treats the legacy 35% seed request as an owner request, not a proposal', () => {
    const offers = normalizeOffers(
      [
        {
          id: 'request-1',
          invoice_id: invoice.id,
          type: 'DISCOUNT',
          terms: {
            requested_discount_pct: 35,
            discounted_amount: 780,
            reason: 'Client requested 35% off',
          },
          status: 'PENDING_APPROVAL',
          created_at: '2026-11-07T12:00:00.000Z',
          installments: [],
        },
      ],
      invoice
    );

    assert.equal(offers.length, 1);
    assert.equal(offers[0].kind, 'request');
    assert.equal(offers[0].canAccept, false);
    assert.equal(offers[0].awaitingApproval, true);
    if (offers[0].kind !== 'request') return;
    assert.equal(offers[0].requestedDiscountPct, 35);
    assert.equal(offers[0].requestedAmount, 780);
  });

  it('renders an accepted legacy plan from stored installments', () => {
    const offers = normalizeOffers(
      [
        {
          id: 'legacy-plan',
          invoice_id: invoice.id,
          type: 'PLAN',
          terms: {
            installments: 3,
            first_amount: 400,
            installment_amount: 400,
            total_amount: 1200,
          },
          status: 'ACCEPTED',
          created_at: '2026-11-07T12:00:00.000Z',
          installments: [
            {
              id: 'inst-1',
              arrangement_id: 'legacy-plan',
              number: 1,
              amount: 400,
              due_date: '2026-11-07T12:00:00.000Z',
              status: 'PAID',
              paid_at: '2026-11-07T13:00:00.000Z',
              paypal_invoice_id: null,
              created_at: '2026-11-07T12:00:00.000Z',
            },
            {
              id: 'inst-2',
              arrangement_id: 'legacy-plan',
              number: 2,
              amount: 400,
              due_date: '2026-12-07T12:00:00.000Z',
              status: 'SCHEDULED',
              paid_at: null,
              paypal_invoice_id: null,
              created_at: '2026-11-07T12:00:00.000Z',
            },
            {
              id: 'inst-3',
              arrangement_id: 'legacy-plan',
              number: 3,
              amount: 400,
              due_date: '2027-01-07T12:00:00.000Z',
              status: 'SCHEDULED',
              paid_at: null,
              paypal_invoice_id: null,
              created_at: '2026-11-07T12:00:00.000Z',
            },
          ],
        },
      ],
      invoice
    );

    assert.equal(offers.length, 1);
    assert.equal(offers[0].kind, 'plan');
    if (offers[0].kind !== 'plan') return;
    assert.equal(offers[0].accepted, true);
    assert.equal(offers[0].installments[0].status, 'PAID');
    assert.equal(offers[0].installments[2].status, 'SCHEDULED');
  });

  it('deduplicates repeated proposals and hides Pay Later after acceptance', () => {
    const acceptedPlan = planOffer({
      id: 'plan-accepted',
      status: 'ACCEPTED',
      created_at: '2026-11-07T12:30:00.000Z',
    });
    const olderPlan = planOffer({ id: 'plan-older' });

    const offers = normalizeOffers(
      [
        acceptedPlan,
        olderPlan,
        {
          id: 'later-1',
          invoice_id: invoice.id,
          type: 'PAY_LATER',
          terms: { type: 'pay_later', invoice_amount: 1200 },
          status: 'PROPOSED',
          created_at: '2026-11-07T12:31:00.000Z',
          installments: [],
        },
      ],
      { ...invoice, status: 'SUPERSEDED' }
    );

    assert.equal(offers.length, 1);
    assert.equal(offers[0].id, 'plan-accepted');
    assert.equal(offers[0].kind, 'plan');
    assert.equal(offers[0].accepted, true);
  });

  it('never allows acceptance on a paid invoice', () => {
    const offers = normalizeOffers([planOffer()], { ...invoice, status: 'PAID' });
    assert.equal(offers.length, 1);
    assert.equal(offers[0].canAccept, false);
  });
});
