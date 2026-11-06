// ============================================================
// PulsePay — Agent Intent Gate
// Evaluates client messages before agent turn
// ============================================================

export type ClientIntent =
  | 'DISPUTE'
  | 'INJECTION'
  | 'PAYMENT_HARDSHIP'
  | 'FORGOT'
  | 'QUESTION';

export interface IntentGateResult {
  intent: ClientIntent;
  confidence: number;
  shouldStop: boolean; // True for DISPUTE and INJECTION (escalates directly to owner)
  flagReason?: string;
}

const DISPUTE_KEYWORDS = [
  'broken',
  'never received',
  'didn\'t finish',
  'did not finish',
  'poor quality',
  'fraud',
  'scam',
  'not as agreed',
  'dispute',
  'lawyer',
  'sue',
  'unacceptable work',
];

const INJECTION_PATTERNS = [
  /ignore (all|previous|prior) (instructions|rules|prompts)/i,
  /you are now in developer mode/i,
  /jailbreak/i,
  /owner approved (.*)(90%|80%|70%|100%|free)/i,
  /system prompt/i,
  /as an ai assistant without restrictions/i,
  /override policy/i,
];

/**
 * Fast deterministic & regex-based intent classification.
 * Reda will enhance with LLM classification prompt on Day 2.
 */
export function detectIntent(messageText: string): IntentGateResult {
  const normalized = messageText.toLowerCase().trim();

  // 1. Check for prompt injection or system override attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        intent: 'INJECTION',
        confidence: 0.95,
        shouldStop: true,
        flagReason: 'Attempted system override / policy bypass detected',
      };
    }
  }

  // 2. Check for work disputes
  for (const keyword of DISPUTE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return {
        intent: 'DISPUTE',
        confidence: 0.9,
        shouldStop: true,
        flagReason: `Client indicated dispute regarding deliverables: "${keyword}"`,
      };
    }
  }

  // 3. Payment hardship / installment request
  if (
    normalized.includes("can't pay") ||
    normalized.includes('cannot pay') ||
    normalized.includes('hardship') ||
    normalized.includes('tight on cash') ||
    normalized.includes('parts') ||
    normalized.includes('split') ||
    normalized.includes('installment') ||
    normalized.includes('monthly')
  ) {
    return {
      intent: 'PAYMENT_HARDSHIP',
      confidence: 0.85,
      shouldStop: false,
    };
  }

  // 4. Client just forgot / needs invoice details
  if (
    normalized.includes('forgot') ||
    normalized.includes('missed it') ||
    normalized.includes('busy') ||
    normalized.includes('paying now') ||
    normalized.includes('resend')
  ) {
    return {
      intent: 'FORGOT',
      confidence: 0.85,
      shouldStop: false,
    };
  }

  // 5. Default general question / inquiry
  return {
    intent: 'QUESTION',
    confidence: 0.7,
    shouldStop: false,
  };
}

