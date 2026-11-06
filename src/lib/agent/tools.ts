// ============================================================
// PulsePay — Agent Tool Definitions
// LLM gets ONLY low-risk & read tools. Money moves only via Executor.
// ============================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_invoice',
    description: 'Fetch details and breakdown of the current overdue invoice',
    parameters: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Internal invoice UUID' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'get_client_history',
    description: 'Check historical on-time payment rate and previous invoice count for this client',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'Internal client UUID' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'send_message',
    description: 'Send a polite, helpful message to the client on their conversation page',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Text message to display to client' },
      },
      required: ['message'],
    },
  },
  {
    name: 'propose_offer',
    description: 'Propose a structured arrangement: discount, installment plan, or Pay Later',
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
          description: 'If plan: array of installment breakdown with amounts and due dates',
          items: {
            type: 'object',
            properties: {
              number: { type: 'number' },
              amount: { type: 'number' },
              due_date: { type: 'string' },
            },
            required: ['number', 'amount', 'due_date'],
          },
        },
        invoice_amount: {
          type: 'number',
          description: 'If pay_later: original total amount',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'escalate',
    description: 'Escalate conversation to the business owner when client requests exceed policy rules',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Specific explanation of why escalation is required' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'flag_dispute',
    description: 'Immediately stop automated negotiation and notify owner of a client work dispute',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Client concerns regarding deliverables or service' },
      },
      required: ['reason'],
    },
  },
];

