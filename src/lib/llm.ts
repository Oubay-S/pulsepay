// LLM adapter: Gemini (primary) -> Groq (fallback) -> demo cache -> static reply.
// Callers get one response shape whichever provider answered.

import type { ToolDefinition } from '@/lib/agent/tools';

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

interface LLMOptions {
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  invoiceAmount?: number; // lets the demo cache build a plan that passes the policy guard
}

// Shown when no model answered: must not promise anything that won't follow.
const DEFAULT_REPLY = "Thanks for your message. I've noted it, and the business owner will follow up here if needed.";

// Some models (e.g. gpt-oss) return tool calls with no text; the client still needs a message.
export const TOOL_REPLIES: Record<string, string> = {
  propose_offer: 'Here are some options that could help. Take a look below and pick whichever works best for you.',
  escalate: "I can't approve that myself, but I've passed your request to the business owner to review.",
  flag_dispute:
    "I'm sorry to hear that. I've paused reminders and passed your concerns to the business owner, who will look into it personally.",
};

export async function callLLM(options: LLMOptions): Promise<LLMResponse> {
  const providers = [
    { name: 'primary', key: process.env.LLM_PRIMARY_API_KEY, call: callGemini },
    { name: 'fallback', key: process.env.LLM_FALLBACK_API_KEY, call: callGroq },
  ] as const;

  for (const { name, key, call } of providers) {
    if (!key) continue;
    try {
      const raw = await call(key, options);
      raw.toolCalls.forEach(numberInstallments);

      // Tool use is forced (see tools.ts): the client text arrives in each call's "message".
      const messages = new Set<string>();
      for (const c of raw.toolCalls) {
        const m = c.arguments.message;
        if (typeof m === 'string' && m.trim()) messages.add(m.trim());
        delete c.arguments.message;
      }
      const toolCalls = raw.toolCalls.filter((c) => c.name !== 'reply');
      // Each message is meant as the whole reply; models sometimes repeat it per call, so keep the first.
      const content = raw.content || [...messages][0] || '';

      if (!content && !toolCalls.length) throw new Error('empty response');
      return {
        content: content || TOOL_REPLIES[toolCalls[0]?.name] || DEFAULT_REPLY,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        providerUsed: name,
      };
    } catch (err) {
      console.error(`[llm] ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return demoCache(options) ?? { content: DEFAULT_REPLY, providerUsed: 'simulated' };
}

async function callGemini(key: string, { messages, tools, temperature }: LLMOptions) {
  const model = process.env.LLM_PRIMARY_MODEL || 'gemini-3.5-flash-lite';
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');

  const data = await postJSON(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      tools: tools?.length ? [{ functionDeclarations: tools }] : undefined,
      toolConfig: tools?.length ? { functionCallingConfig: { mode: 'ANY' } } : undefined,
      // Gemini 3.x thinks before answering (default "medium"); "low" keeps chat replies fast.
      generationConfig: { temperature: temperature ?? 0.3, thinkingConfig: { thinkingLevel: 'low' } },
    }
  );

  const parts: { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown> } }[] =
    data.candidates?.[0]?.content?.parts ?? [];
  return {
    content: parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim(),
    toolCalls: parts
      .filter((p) => p.functionCall)
      .map((p) => ({ name: p.functionCall!.name, arguments: p.functionCall!.args ?? {} })),
  };
}

async function callGroq(key: string, { messages, tools, temperature }: LLMOptions) {
  const data = await postJSON(
    'https://api.groq.com/openai/v1/chat/completions',
    { Authorization: `Bearer ${key}` },
    {
      model: process.env.LLM_FALLBACK_MODEL || 'openai/gpt-oss-120b',
      messages,
      tools: tools?.map((t) => ({ type: 'function', function: t })),
      tool_choice: tools?.length ? 'required' : undefined,
      temperature: temperature ?? 0.3,
    }
  );

  const message = data.choices?.[0]?.message ?? {};
  const toolCalls: LLMToolCall[] = [];
  for (const call of message.tool_calls ?? []) {
    try {
      // Groq (OpenAI format) sends arguments as a JSON string, Gemini as an object.
      toolCalls.push({ name: call.function.name, arguments: JSON.parse(call.function.arguments || '{}') });
    } catch {
      console.error('[llm] fallback sent invalid tool arguments:', call.function?.arguments);
    }
  }
  return { content: (message.content ?? '').trim(), toolCalls };
}

// Models sometimes drop installment numbers; they follow from list order, so fill them in.
// Amounts and dates are left alone for the policy guard to check.
function numberInstallments(call: LLMToolCall) {
  const { installments } = call.arguments;
  if (!Array.isArray(installments)) return;
  call.arguments.installments = installments.map((item, i) =>
    item && typeof item === 'object' ? { ...item, number: i + 1 } : item
  );
}

// One retry on rate limit / overload (Gemini 503s under load), with a timeout so a
// hung provider can't hang the request.
async function postJSON(url: string, headers: Record<string, string>, body: unknown) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return res.json();
    if (attempt === 1 && (res.status === 429 || res.status === 503)) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// Last resort when both providers are down, so the 3 demo scenarios still respond.
function demoCache({ messages, invoiceAmount }: LLMOptions): LLMResponse | null {
  const last = messages.filter((m) => m.role === 'user').at(-1)?.content.toLowerCase() ?? '';

  if (/\b(can'?t|cannot) (pay|afford)|split|installment/.test(last) && invoiceAmount) {
    const part = Math.round((invoiceAmount / 3) * 100) / 100;
    const day = 86_400_000;
    const installments = [1, 30, 60].map((days, i) => ({
      number: i + 1,
      amount: i < 2 ? part : Math.round((invoiceAmount - 2 * part) * 100) / 100,
      due_date: new Date(Date.now() + days * day).toISOString(),
    }));
    return {
      content: `Completely understood, cash flow can be tight. We can split this into 3 monthly payments of about $${part.toFixed(2)}. If PayPal offers Pay Later to you at checkout, you could also pay over time that way.`,
      toolCalls: [
        { name: 'propose_offer', arguments: { type: 'plan', installments } },
        { name: 'propose_offer', arguments: { type: 'pay_later', invoice_amount: invoiceAmount } },
      ],
      providerUsed: 'cache',
    };
  }
  if (/\d+ ?%|discount|waive/.test(last)) {
    return {
      content: TOOL_REPLIES.escalate,
      toolCalls: [{ name: 'escalate', arguments: { reason: `Client requested: "${last.slice(0, 200)}"` } }],
      providerUsed: 'cache',
    };
  }
  return null;
}
