import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { followUpBlockReason } from '../limits';

const policy = { max_messages_per_day: 2, quiet_hours_start: 22, quiet_hours_end: 8 };
const at = (isoUtc: string) => new Date(isoUtc);
const check = (now: Date, sentLast24h = 0, p = policy) =>
  followUpBlockReason({ policy: p, now, sentLast24h, timeZone: 'UTC' });

describe('Follow-up limits', () => {
  it('allows a follow-up during the day under the limit', () => {
    assert.equal(check(at('2026-11-07T14:00:00Z')), null);
  });

  it('blocks once the daily limit is reached', () => {
    assert.match(check(at('2026-11-07T14:00:00Z'), 2) ?? '', /Daily limit/);
  });

  it('blocks quiet hours that wrap past midnight (22 -> 8)', () => {
    for (const time of ['22:00', '23:30', '00:00', '07:59']) {
      assert.match(check(at(`2026-11-07T${time}:00Z`)) ?? '', /Quiet hours/, time);
    }
    assert.equal(check(at('2026-11-07T08:00:00Z')), null);
    assert.equal(check(at('2026-11-07T21:59:00Z')), null);
  });

  it('handles same-day windows and disabled quiet hours', () => {
    const lunch = { ...policy, quiet_hours_start: 12, quiet_hours_end: 14 };
    assert.match(check(at('2026-11-07T13:00:00Z'), 0, lunch) ?? '', /Quiet hours/);
    assert.equal(check(at('2026-11-07T15:00:00Z'), 0, lunch), null);
    const none = { ...policy, quiet_hours_start: 0, quiet_hours_end: 0 };
    assert.equal(check(at('2026-11-07T03:00:00Z'), 0, none), null);
  });

  it('uses the business time zone, not UTC', () => {
    // 05:00 UTC is 21:00 the previous evening in Los Angeles (PST): not quiet there.
    const now = at('2026-11-08T05:00:00Z');
    assert.match(check(now) ?? '', /Quiet hours/);
    assert.equal(
      followUpBlockReason({ policy, now, sentLast24h: 0, timeZone: 'America/Los_Angeles' }),
      null
    );
  });
});
