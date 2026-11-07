// Tools the LLM may call. None of them move money: proposals go through the
// policy guard, escalations go to the owner's approval queue.
// Invoice and client facts are given in the system prompt, so no read tools are needed.
// Tool use is forced and each call carries the client-facing "message", because some
// models otherwise write text OR call a tool, never both (see llm.ts).

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const message = { type: 'string', description: 'What the client will read. Describe any offer in plain words.' };

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'reply',
    description: 'Answer the client in plain text when no offer, escalation or dispute is needed',
    parameters: { type: 'object', properties: { message }, required: ['message'] },
  },
  {
    name: 'propose_offer',
    description: 'Propose one arrangement to the client: early-payment discount, installment plan, or PayPal Pay Later',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['discount', 'plan', 'pay_later'],
          description: 'Type of proposed arrangement',
        },
        discount_pct: {
          type: 'number',
          description: 'If discount: percentage off (e.g. 5 for 5%)',
        },
        deadline_hours: {
          type: 'number',
          description: 'If discount: hours client has to pay (e.g. 48)',
        },
        installments: {
          type: 'array',
          description: 'If plan: installments with amounts adding up to the invoice total',
          items: {
            type: 'object',
            properties: {
              number: { type: 'number' },
              amount: { type: 'number' },
              due_date: { type: 'string', description: 'ISO 8601, e.g. 2026-01-31T00:00:00Z' },
            },
            required: ['number', 'amount', 'due_date'],
          },
        },
        invoice_amount: {
          type: 'number',
          description: 'If pay_later: original total amount',
        },
        message,
      },
      required: ['type'],
    },
  },
  {
    name: 'escalate',
    description: 'Send the request to the business owner when the client asks for more than the policy allows',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'For the owner: what the client asked for and why it needs them' },
        message,
      },
      required: ['reason', 'message'],
    },
  },
  {
    name: 'flag_dispute',
    description: 'Stop automated negotiation and notify the owner of a complaint about the work or service',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'For the owner: client concerns regarding deliverables or service' },
        message,
      },
      required: ['reason', 'message'],
    },
  },
];
