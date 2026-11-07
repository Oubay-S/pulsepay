// Live check of the agent turn: real providers + the demo cache, each proposal run through the policy guard.
// Usage: npx tsx --env-file=.env.local scripts/test-llm.ts
import { callLLM, type LLMMessage } from '../src/lib/llm';
import { AGENT_TOOLS } from '../src/lib/agent/tools';
import { buildNegotiationPrompt } from '../src/lib/agent/prompt';
import { checkPolicy } from '../src/lib/guard/policy-guard';
import type { BusinessRow, ClientRow, InvoiceRow, PolicyRow } from '../src/types/database';

const now = new Date();
const business = { name: 'Studio Chen Creative LLC', tone: 'friendly' } as BusinessRow;
const client = { name: 'Marcus Reed', on_time_rate: 65, total_invoices: 6 } as ClientRow;
const invoice = {
  id: 'inv-test',
  paypal_invoice_id: 'INV2-MARCUS-002',
  amount: 1200,
  currency: 'USD',
  due_date: new Date(now.getTime() - 18 * 86_400_000).toISOString(),
  description: null,
} as InvoiceRow;
const policy = {
  max_discount_pct: 10,
  max_installments: 3,
  min_first_payment_pct: 30,
  approval_threshold: 2000,
} as PolicyRow;

const system = buildNegotiationPrompt({ business, client, invoice, policy, now });
const followUp = 'Hi Marcus, just a friendly check-in on invoice INV2-MARCUS-002 for $1,200. Let us know if we can help.';

async function turn(label: string, clientText: string) {
  const messages: LLMMessage[] = [
    { role: 'system', content: system },
    { role: 'assistant', content: followUp },
    { role: 'user', content: clientText },
  ];
  const res = await callLLM({ messages, tools: AGENT_TOOLS, invoiceAmount: invoice.amount });
  console.log(`\n=== ${label} [${res.providerUsed}] ===\nClient: ${clientText}\nAgent:  ${res.content}`);
  for (const call of res.toolCalls ?? []) {
    const verdict =
      call.name === 'propose_offer'
        ? await checkPolicy(call.arguments, policy, invoice)
        : 'goes to owner queue';
    console.log(`  tool ${call.name}`, JSON.stringify(call.arguments), '\n  guard:', JSON.stringify(verdict));
  }
}

const scenarios: [string, string][] = [
  ['hardship', "I'm tight on cash this month, I can't afford $1,200 right now."],
  ['big discount', 'Give me 40% off and I will pay today.'],
  ['small discount', 'If I pay by tomorrow, can I get a small discount?'],
];

async function main() {
  for (const [label, text] of scenarios) await turn(label, text);

  // Same scenarios with no providers, to check the demo cache fallback.
  delete process.env.LLM_PRIMARY_API_KEY;
  delete process.env.LLM_FALLBACK_API_KEY;
  for (const [label, text] of scenarios) await turn(`${label} (cache)`, text);
}

main();
