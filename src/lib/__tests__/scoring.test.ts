import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriorityScore } from '../scoring';

describe('Scoring — Priority & Explainability Engine', () => {
  const refDate = new Date('2026-11-06T12:00:00Z');

  it('assigns score 0 to paid invoices', () => {
    const invoice = {
      amount: 1500,
      due_date: '2026-10-20T00:00:00Z',
      status: 'PAID' as const,
    };

    const res = calculatePriorityScore(invoice, null, refDate);
    assert.equal(res.score, 0);
    assert.match(res.reason, /settled in full/i);
  });

  it('assigns score 0 to cancelled or superseded invoices', () => {
    const cancelled = {
      amount: 2000,
      due_date: '2026-10-01T00:00:00Z',
      status: 'CANCELLED' as const,
    };
    const resCancelled = calculatePriorityScore(cancelled, null, refDate);
    assert.equal(resCancelled.score, 0);
    assert.match(resCancelled.reason, /cancelled/i);

    const superseded = {
      amount: 1200,
      due_date: '2026-10-15T00:00:00Z',
      status: 'SUPERSEDED' as const,
    };
    const resSuperseded = calculatePriorityScore(superseded, null, refDate);
    assert.equal(resSuperseded.score, 0);
    assert.match(resSuperseded.reason, /superseded/i);
  });

  it('assigns low urgency score (10) to invoices due today or in the future', () => {
    const invoice = {
      amount: 1000,
      due_date: '2026-11-06T00:00:00Z',
      status: 'SENT' as const,
    };

    const res = calculatePriorityScore(invoice, null, refDate);
    assert.equal(res.score, 10);
    assert.match(res.reason, /due today/i);
  });

  it('calculates higher urgency for long overdue invoices with high dollar value and risky clients', () => {
    const overdueInvoice = {
      amount: 3500,
      due_date: '2026-10-07T00:00:00Z', // 30 days overdue
      status: 'SENT' as const,
    };

    const riskyClient = {
      name: 'Alex Thompson',
      on_time_rate: 40,
      total_invoices: 5,
    };

    const res = calculatePriorityScore(overdueInvoice, riskyClient, refDate);
    assert.ok(res.score >= 70, `Score expected >= 70, received ${res.score}`);
    assert.match(res.reason, /30 days overdue/);
    assert.match(res.reason, /\$3,500/);
    assert.match(res.reason, /high-risk history \(40% on-time\)/);
  });

  it('recognizes reliable client history in explainable reason', () => {
    const overdueInvoice = {
      amount: 850,
      due_date: '2026-10-30T00:00:00Z', // 7 days overdue
      status: 'SENT' as const,
    };

    const goodClient = {
      name: 'Elena Rostova',
      on_time_rate: 90,
      total_invoices: 6,
    };

    const res = calculatePriorityScore(overdueInvoice, goodClient, refDate);
    assert.match(res.reason, /reliable client \(90% on-time\)/);
  });
});
