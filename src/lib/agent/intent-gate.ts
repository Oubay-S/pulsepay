// Deterministic intent gate, run on every client message before the LLM.
// DISPUTE and INJECTION stop the agent and go to the owner.

export type ClientIntent = 'DISPUTE' | 'INJECTION' | 'PAYMENT_HARDSHIP' | 'FORGOT' | 'QUESTION';

export interface IntentGateResult {
  intent: ClientIntent;
  shouldStop: boolean;
  flagReason?: string;
}

// First match wins, so order matters: safety intents before negotiation intents.
const RULES: [ClientIntent, RegExp][] = [
  [
    'INJECTION',
    new RegExp(
      [
        String.raw`\b(ignore|disregard|forget|bypass|override)\b.{0,25}\b(instructions?|rules?|prompts?|polic(y|ies)|guidelines?)\b`,
        String.raw`\b(developer mode|jailbreak|system prompt|you are now (in|an?)|pretend (you|to be)|without (any )?restrictions)\b`,
        String.raw`\b(owner|manager|boss)\b.{0,30}\b(approved|said|agreed|authori[sz]ed|allowed|promised)\b.{0,40}(\d+ ?%|\bfree\b|\bwaive)`,
      ].join('|'),
      'i'
    ),
  ],
  [
    'DISPUTE',
    // "never received" is excluded when it refers to the invoice/link itself (that is FORGOT, not a dispute).
    /\b(broken|never (received|got)\b(?! (the |your |an? )?(invoice|link|email|bill|reminder))|did(n't| not) (finish|deliver)|poor quality|fraud|scam|not as (agreed|described)|dispute|chargeback|lawyer|attorney|sue|unacceptable)\b/i,
  ],
  [
    'PAYMENT_HARDSHIP',
    /\b((can't|cannot|unable to) (pay|afford)|hardship|tight on cash|parts|split|installments?|monthly|payment plan)\b/i,
  ],
  ['FORGOT', /\b(forgot|slipped my mind|missed (it|this)|busy|paying (it )?now|resend)\b/i],
];

export function detectIntent(messageText: string): IntentGateResult {
  const text = messageText.replace(/[‘’]/g, "'"); // phone keyboards send curly apostrophes ("can’t")

  for (const [intent, pattern] of RULES) {
    const match = text.match(pattern);
    if (!match) continue;
    if (intent === 'INJECTION') {
      return { intent, shouldStop: true, flagReason: 'Attempted system override / policy bypass detected' };
    }
    if (intent === 'DISPUTE') {
      return { intent, shouldStop: true, flagReason: `Client indicated dispute regarding deliverables: "${match[0]}"` };
    }
    return { intent, shouldStop: false };
  }

  return { intent: 'QUESTION', shouldStop: false };
}
