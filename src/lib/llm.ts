// ============================================================
// PulsePay — Unified LLM Adapter (Primary + Fallback + Demo Cache)
// Zero-cost setup for hackathon reliability
// ============================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  providerUsed: 'cache' | 'primary' | 'fallback' | 'simulated';
}

// Deterministic response cache for the 3 demo hackathon scenarios
const DEMO_CACHE: Record<string, LLMResponse> = {
  // Scenario 1: Forgot
  forgot: {
    content: "Hi Sarah! Just checking in regarding invoice #INV-2026-001. We understand things get busy! You can pay easily with the link below or let us know if you need any assistance.",
    providerUsed: 'cache',
  },
  // Scenario 2: Can't pay $1200 full
  hardship_1200: {
    content: "We completely understand that cash flow can fluctuate! We'd be happy to split this into 3 monthly installments of $400, or you can check if PayPal Pay Later is available at checkout so you can pay over time while our invoice is cleared today.",
    toolCalls: [
      {
        name: 'propose_offer',
        arguments: {
          type: 'plan',
          installments: [
            { number: 1, amount: 400, due_date: new Date(Date.now() + 86400000).toISOString() },
            { number: 2, amount: 400, due_date: new Date(Date.now() + 30 * 86400000).toISOString() },
            { number: 3, amount: 400, due_date: new Date(Date.now() + 60 * 86400000).toISOString() },
          ],
        },
      },
      {
        name: 'propose_offer',
        arguments: {
          type: 'pay_later',
          invoice_amount: 1200,
        },
      },
    ],
    providerUsed: 'cache',
  },
  // Scenario 3: Aggressive prompt injection / unreasonable discount
  injection_gamers: {
    content: "I cannot authorize custom discounts or bypass the established terms. Any discount requests beyond standard policy require direct approval from the business owner. I have forwarded your request to the owner's review queue.",
    toolCalls: [
      {
        name: 'escalate',
        arguments: {
          reason: 'Client requested unauthorized 40%+ discount / attempted prompt override',
        },
      },
    ],
    providerUsed: 'cache',
  },
};

export async function callLLM(options: {
  messages: LLMMessage[];
  temperature?: number;
  scenarioHint?: 'forgot' | 'hardship_1200' | 'injection_gamers';
}): Promise<LLMResponse> {
  const { messages, scenarioHint } = options;

  // 1. Check Demo Cache first if scenarioHint is provided or detectable
  if (scenarioHint && DEMO_CACHE[scenarioHint]) {
    return DEMO_CACHE[scenarioHint];
  }

  const lastUserMsg = messages
    .filter((m) => m.role === 'user')
    .slice(-1)[0]?.content.toLowerCase() || '';

  if (lastUserMsg.includes('forgot') || lastUserMsg.includes('reminder')) {
    return DEMO_CACHE.forgot;
  }
  if (lastUserMsg.includes("can't pay") || lastUserMsg.includes('split') || lastUserMsg.includes('installment')) {
    return DEMO_CACHE.hardship_1200;
  }
  if (lastUserMsg.includes('90%') || lastUserMsg.includes('40%') || lastUserMsg.includes('ignore rules')) {
    return DEMO_CACHE.injection_gamers;
  }

  // 2. Try Primary Provider (Google AI Studio / Gemini)
  const primaryApiKey = process.env.LLM_PRIMARY_API_KEY;
  if (primaryApiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${
          process.env.LLM_PRIMARY_MODEL || 'gemini-2.0-flash'
        }:generateContent?key=${primaryApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: options.temperature ?? 0.3,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { content: text, providerUsed: 'primary' };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // 3. Try Fallback Provider (Groq / OpenAI-compatible endpoint)
  const fallbackApiKey = process.env.LLM_FALLBACK_API_KEY;
  if (fallbackApiKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fallbackApiKey}`,
        },
        body: JSON.stringify({
          model: process.env.LLM_FALLBACK_MODEL || 'llama-3.1-70b-versatile',
          messages,
          temperature: options.temperature ?? 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        return { content: text, providerUsed: 'fallback' };
      }
    } catch {
      // Fall through to simulated fallback
    }
  }

  // 4. Safe simulated fallback if no API keys are configured yet (hackathon mock)
  return {
    content: "Thank you for getting back to us. I have noted your message and we are reviewing how best to accommodate your payment preferences.",
    providerUsed: 'simulated',
  };
}

