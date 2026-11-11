// ============================================================
// PulsePay — Demo Seed & Reset Utility
// Seeds a business, policies, realistic B2B clients, invoices,
// a staged installment plan, and a pending approval.
//
// Every invoice is a real PayPal Sandbox invoice. There are no
// fake `INV2-...` identifiers and no mock fallback: if PayPal is
// not configured, seeding fails loudly.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePriorityScore } from './scoring';
import {
  PULSEPAY_DEMO_MARKER,
  buildInvoicePayload,
  isPulsePayGeneratedNote,
} from './paypal/invoices';
import type { CreatedInvoice, InvoiceDraft } from './paypal/invoices';
import {
  cancelPayPalInvoice,
  createPayPalInvoice,
  listPayPalInvoices,
  recordInvoicePayment,
  sendPayPalInvoiceWithLink,
} from './paypal/toolkit';

const DAY = 86_400_000;
const DEMO_MARKER = PULSEPAY_DEMO_MARKER;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

type SeedInvoiceStatus = 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'SUPERSEDED';

interface InvoiceSpec {
  key: string;
  clientIndex: number;
  amount: number;
  dueDaysAgo: number;
  description: string;
  token: string;
  aliasTokens?: string[];
  /** Amount recorded as an external payment right after sending. */
  payment?: number;
}

/**
 * Cancels leftover PulsePay invoices before a reset so the Sandbox merchant
 * account does not accumulate duplicate demo invoices on every seed.
 *
 * Paid invoices are historical records and cannot be cancelled; they are left
 * untouched and sync will not import them again (see `isPulsePayGeneratedNote`).
 */
async function cancelStalePulsePayInvoices(): Promise<{
  cancelled: number;
  skipped: number;
}> {
  const first = await listPayPalInvoices(1, 100);
  const invoices = [...first.invoices];
  const pages = Math.min(first.totalPages || 1, 20);

  for (let page = 2; page <= pages; page += 1) {
    const next = await listPayPalInvoices(page, 100);
    invoices.push(...next.invoices);
  }

  let cancelled = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    if (!isPulsePayGeneratedNote(invoice.detail?.note)) continue;

    if (
      ['PAID', 'MARKED_AS_PAID', 'CANCELLED', 'REFUNDED'].includes(invoice.status)
    ) {
      skipped += 1;
      continue;
    }

    try {
      await cancelPayPalInvoice(invoice.id, 'PulsePay demo reset');
      cancelled += 1;
    } catch {
      // A partially paid invoice cannot be cancelled; it stays as history.
      skipped += 1;
    }
  }

  return { cancelled, skipped };
}

/**
 * Creates an invoice and records its ID before sending, so a failed send can
 * still be cleaned up by the caller.
 */
async function createDemoInvoice(
  draft: InvoiceDraft,
  createdIds: string[]
): Promise<CreatedInvoice> {
  const payload = buildInvoicePayload(draft);
  const created = await createPayPalInvoice(payload);
  createdIds.push(created.id);

  const sent = await sendPayPalInvoiceWithLink(created.id);

  return { id: created.id, payerLink: sent.payerLink };
}

export async function resetAndSeedDatabase(): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = createAdminClient();

  // 1. Cancel leftover demo invoices in PayPal before touching the database.
  const cleanup = await cancelStalePulsePayInvoices();

  // 2. Reset demo clock.
  await supabase
    .from('demo_clock')
    .upsert({ id: 1, offset_days: 0, updated_at: new Date().toISOString() });

  // 3. Clear previous demo data (cascading foreign keys clean children).
  await supabase
    .from('businesses')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  // Events have no foreign key to businesses, so clear them explicitly.
  await supabase.from('events').delete().not('id', 'is', null);

  // 4. Create demo business.
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .insert({
      name: 'Studio Chen Creative LLC',
      paypal_merchant_email: 'billing@studiochen.design',
      currency: 'USD',
      tone: 'friendly',
    })
    .select()
    .single();

  if (bizErr || !business) {
    throw new Error(`Failed to create demo business: ${bizErr?.message}`);
  }

  // 5. Merchant negotiation policy.
  const { error: polErr } = await supabase.from('policies').insert({
    business_id: business.id,
    max_discount_pct: 10,
    max_installments: 3,
    min_first_payment_pct: 30,
    approval_threshold: 2000,
    max_messages_per_day: 5,
    quiet_hours_start: 22,
    quiet_hours_end: 8,
  });

  if (polErr) {
    throw new Error(`Failed to create policy: ${polErr.message}`);
  }

  // 6. Eight realistic B2B clients.
  const clientsData = [
    {
      business_id: business.id,
      name: 'Elena Rostova',
      email: 'elena.rostova@aurahealth.co',
      on_time_rate: 90,
      total_invoices: 6,
      total_paid: 5,
    },
    {
      business_id: business.id,
      name: 'Marcus Reed',
      email: 'm.reed@apexathletics.io',
      on_time_rate: 65,
      total_invoices: 5,
      total_paid: 3,
    },
    {
      business_id: business.id,
      name: 'Julian Hayes',
      email: 'j.hayes@vanguardlogic.com',
      on_time_rate: 40,
      total_invoices: 4,
      total_paid: 1,
    },
    {
      business_id: business.id,
      name: 'Dr. Aris Thorne',
      email: 'thorne@kromabiotech.org',
      on_time_rate: 55,
      total_invoices: 3,
      total_paid: 1,
    },
    {
      business_id: business.id,
      name: 'Nadia Benali',
      email: 'nadia.benali@atlasmediagroup.com',
      on_time_rate: 85,
      total_invoices: 7,
      total_paid: 6,
    },
    {
      business_id: business.id,
      name: 'Lucas Moreau',
      email: 'l.moreau@solsticerobotics.com',
      on_time_rate: 30,
      total_invoices: 5,
      total_paid: 1,
    },
    {
      business_id: business.id,
      name: 'Chloe Dupont',
      email: 'c.dupont@lumierestudio.fr',
      on_time_rate: 95,
      total_invoices: 8,
      total_paid: 8,
    },
    {
      business_id: business.id,
      name: 'Tariq Al-Mansoor',
      email: 'tariq@oasisventures.co',
      on_time_rate: 80,
      total_invoices: 4,
      total_paid: 3,
    },
  ];

  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .insert(clientsData)
    .select();

  if (clientErr || !clients || clients.length < clientsData.length) {
    throw new Error(`Failed to insert clients: ${clientErr?.message}`);
  }

  const now = new Date();

  // 7. Invoice specs. Amounts and aging buckets match the demo script.
  const invoiceSpecs: InvoiceSpec[] = [
    {
      key: 'elena',
      clientIndex: 0,
      amount: 850,
      dueDaysAgo: 7,
      description: 'Q3 Brand Guidelines & Visual Asset Refresh',
      token: 'demo-inv2-elena-001',
      aliasTokens: ['demo-inv2-sarah-001'],
    },
    {
      key: 'marcus',
      clientIndex: 1,
      amount: 1200,
      dueDaysAgo: 18,
      description: 'E-Commerce Checkout Redesign & Mobile Prototype',
      token: 'demo-inv2-marcus-002',
    },
    {
      key: 'julian',
      clientIndex: 2,
      amount: 3500,
      dueDaysAgo: 35,
      description: 'Enterprise Design System & React Component Library',
      token: 'demo-inv2-alex-003',
      aliasTokens: ['demo-inv2-julian-003'],
    },
    {
      key: 'aris',
      clientIndex: 3,
      amount: 2800,
      dueDaysAgo: 48,
      description: 'Interactive Clinical Trial Data Visualization Dashboard',
      token: 'demo-inv2-kroma-004',
      payment: 1000,
    },
    {
      key: 'nadia',
      clientIndex: 4,
      amount: 650,
      dueDaysAgo: 12,
      description: 'Keynote Investor Presentation & Infographic Kit',
      token: 'demo-inv2-atlas-005',
    },
    {
      key: 'lucas',
      clientIndex: 5,
      amount: 1750,
      dueDaysAgo: 68,
      description: 'Telemetry Interface & Realtime Mission Control UI',
      token: 'demo-inv2-solstice-006',
    },
    {
      key: 'chloe',
      clientIndex: 6,
      amount: 920,
      dueDaysAgo: 24,
      description: 'Custom Typography Licensing & Editorial Layouts',
      token: 'demo-inv2-lumiere-007',
      payment: 920,
    },
    {
      key: 'tariq',
      clientIndex: 7,
      amount: 2400,
      dueDaysAgo: 28,
      description: 'Annual Strategic Design Advisory — Q3 Retainer',
      token: 'demo-inv2-oasis-008',
    },
  ];

  const createdPayPalIds: string[] = [];

  try {
    // 8. Create and send every invoice as a real PayPal Sandbox invoice.
    const settled = await Promise.allSettled(
      invoiceSpecs.map(async (spec) => {
        const client = clients[spec.clientIndex];
        const dueDate = daysAgo(spec.dueDaysAgo);
        const invoiceDate = new Date(dueDate.getTime() - 14 * DAY);

        const created = await createDemoInvoice(
          {
            businessName: business.name,
            clientName: client.name,
            clientEmail: client.email,
            currency: 'USD',
            amount: spec.amount,
            description: spec.description,
            note: `${DEMO_MARKER} ${spec.description}`,
            invoiceDate,
            dueDate,
          },
          createdPayPalIds
        );

        return {
          spec,
          client,
          dueDate,
          paypalId: created.id,
          status: 'SENT' as SeedInvoiceStatus,
          payerLink: created.payerLink,
        };
      })
    );

    const failures = settled.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    if (failures.length > 0) {
      const reasons = failures
        .map((failure) =>
          failure.reason instanceof Error
            ? failure.reason.message
            : String(failure.reason)
        )
        .join(' | ');
      throw new Error(`Failed to create ${failures.length} demo invoice(s): ${reasons}`);
    }

    const prepared = settled.map(
      (result) => (result as PromiseFulfilledResult<{
        spec: InvoiceSpec;
        client: (typeof clients)[number];
        dueDate: Date;
        paypalId: string;
        status: SeedInvoiceStatus;
        payerLink?: string;
      }>).value
    );

    // 9. Record real payments so PayPal's status matches the dashboard.
    await Promise.all(
      prepared.map(async (row) => {
        if (!row.spec.payment) return;

        await recordInvoicePayment(row.paypalId, row.spec.payment, {
          note: `${DEMO_MARKER} Payment recorded by seed`,
        });

        row.status =
          row.spec.payment >= row.spec.amount ? 'PAID' : 'PARTIALLY_PAID';
      })
    );

    // 10. Tariq's plan: supersede the parent invoice and pay installment 1.
    const tariq = prepared.find((row) => row.spec.key === 'tariq');
    if (!tariq) {
      throw new Error('Tariq invoice was not prepared');
    }

    await cancelPayPalInvoice(
      tariq.paypalId,
      'Superseded by installment plan (demo seed)'
    );
    tariq.status = 'SUPERSEDED';

    const installmentOne = await createDemoInvoice(
      {
        businessName: business.name,
        clientName: tariq.client.name,
        clientEmail: tariq.client.email,
        currency: 'USD',
        amount: 800,
        description: `Installment 1 of 3 — ${tariq.spec.description}`,
        note: `${DEMO_MARKER} Installment 1 of 3`,
        invoiceDate: daysAgo(28),
        dueDate: daysAgo(14),
      },
      createdPayPalIds
    );

    await recordInvoicePayment(installmentOne.id, 800, {
      note: `${DEMO_MARKER} Installment 1 paid`,
    });

    // 11. Persist invoices with their real PayPal IDs.
    const invoiceRows = prepared.map(({ spec, client, dueDate, paypalId, status }) => {
      const priority =
        status === 'SENT' || status === 'PARTIALLY_PAID'
          ? calculatePriorityScore(
              {
                amount: spec.amount,
                due_date: dueDate.toISOString(),
                status,
              },
              client,
              now
            )
          : {
              score: 0,
              reason:
                status === 'PAID'
                  ? 'Paid via PayPal'
                  : 'Superseded by installment plan',
            };

      return {
        business_id: business.id,
        client_id: client.id,
        paypal_invoice_id: paypalId,
        amount: spec.amount,
        currency: 'USD',
        due_date: dueDate.toISOString(),
        status,
        priority_score: priority.score,
        priority_reason: priority.reason,
        description: spec.description,
      };
    });

    const { data: insertedInvoices, error: invErr } = await supabase
      .from('invoices')
      .insert(invoiceRows)
      .select();

    if (
      invErr ||
      !insertedInvoices ||
      insertedInvoices.length !== invoiceRows.length
    ) {
      throw new Error(`Failed to insert invoices: ${invErr?.message}`);
    }

    // 12. Stable client portal tokens (independent of PayPal IDs).
    const specByPaypalId = new Map(
      prepared.map((row) => [row.paypalId, row.spec])
    );

    const conversations = insertedInvoices.flatMap((invoice) => {
      const spec = specByPaypalId.get(invoice.paypal_invoice_id);
      if (!spec) return [];

      return [spec.token, ...(spec.aliasTokens ?? [])].map((token) => ({
        invoice_id: invoice.id,
        token,
        status: 'ACTIVE',
      }));
    });

    if (conversations.length > 0) {
      const { error: conversationError } = await supabase
        .from('conversations')
        .insert(conversations);

      if (conversationError) {
        throw new Error(
          `Failed to create client conversations: ${conversationError.message}`
        );
      }
    }

    // Link seeded arrangements to their conversation so owner messages land in
    // the client chat, not just on the offer card.
    const { data: conversationRows } = await supabase
      .from('conversations')
      .select('id, token');

    const conversationIdByToken = new Map(
      (conversationRows ?? []).map((row) => [row.token, row.id])
    );

    // 13. Staged installment plan for Tariq (Oasis Ventures).
    const tariqInvoice = insertedInvoices.find(
      (invoice) => invoice.paypal_invoice_id === tariq.paypalId
    );

    if (!tariqInvoice) {
      throw new Error('Tariq invoice row was not inserted');
    }

    const installmentDueDates = [
      daysAgo(14),
      daysFromNow(16),
      daysFromNow(46),
    ];

    const { data: tariqArrangement, error: arrangementError } = await supabase
      .from('arrangements')
      .insert({
        invoice_id: tariqInvoice.id,
        conversation_id: conversationIdByToken.get(tariq.spec.token) ?? null,
        type: 'PLAN',
        terms: {
          type: 'plan',
          original_amount: tariq.spec.amount,
          num_installments: 3,
          installments: installmentDueDates.map((dueDate, index) => ({
            number: index + 1,
            amount: 800,
            due_date: dueDate.toISOString(),
          })),
        },
        status: 'ACCEPTED',
        approved_by: 'AGENT_AUTO',
      })
      .select()
      .single();

    if (arrangementError || !tariqArrangement) {
      throw new Error(
        `Failed to create Tariq arrangement: ${arrangementError?.message}`
      );
    }

    const { error: installmentError } = await supabase
      .from('installments')
      .insert([
        {
          arrangement_id: tariqArrangement.id,
          number: 1,
          amount: 800,
          due_date: installmentDueDates[0].toISOString(),
          status: 'PAID',
          paid_at: installmentDueDates[0].toISOString(),
          paypal_invoice_id: installmentOne.id,
        },
        {
          arrangement_id: tariqArrangement.id,
          number: 2,
          amount: 800,
          due_date: installmentDueDates[1].toISOString(),
          status: 'SCHEDULED',
          paypal_invoice_id: null,
        },
        {
          arrangement_id: tariqArrangement.id,
          number: 3,
          amount: 800,
          due_date: installmentDueDates[2].toISOString(),
          status: 'SCHEDULED',
          paypal_invoice_id: null,
        },
      ]);

    if (installmentError) {
      throw new Error(
        `Failed to create Tariq installments: ${installmentError.message}`
      );
    }

    // 14. Pending approval for Julian (Vanguard Logic).
    const julianInvoice = insertedInvoices.find(
      (invoice) =>
        invoice.paypal_invoice_id ===
        prepared.find((row) => row.spec.key === 'julian')?.paypalId
    );

    if (julianInvoice) {
      const { error: approvalError } = await supabase
        .from('arrangements')
        .insert({
          invoice_id: julianInvoice.id,
          conversation_id: conversationIdByToken.get('demo-inv2-alex-003') ?? null,
          type: 'DISCOUNT',
          terms: {
            requested_discount_pct: 35,
            discounted_amount: 2275,
            reason:
              'Client requested 35% discount citing budget freezes; exceeds 10% policy threshold',
          },
          status: 'PENDING_APPROVAL',
          approved_by: null,
        });

      if (approvalError) {
        throw new Error(
          `Failed to create pending approval: ${approvalError.message}`
        );
      }
    }

    // 15. Log the seed event.
    await supabase.from('events').insert({
      type: 'DEMO_DATA_SEEDED',
      actor: 'SYSTEM',
      payload: {
        businessId: business.id,
        invoicesCreated: insertedInvoices.length,
        clientsCreated: clients.length,
        paypalInvoicesCancelled: cleanup.cancelled,
        paypalInvoicesKept: cleanup.skipped,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message:
        `Seeded "${business.name}" with ${clients.length} clients and ` +
        `${insertedInvoices.length} real PayPal Sandbox invoices. ` +
        `Cancelled ${cleanup.cancelled} stale demo invoice(s) before seeding.`,
    };
  } catch (error) {
    // Never leave payable invoices behind when a seed fails halfway through.
    await Promise.all(
      createdPayPalIds.map(async (paypalId) => {
        try {
          await cancelPayPalInvoice(paypalId, 'PulsePay demo seed failed');
        } catch {
          // Already paid or already cancelled.
        }
      })
    );

    throw error;
  }
}
