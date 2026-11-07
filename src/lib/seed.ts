// ============================================================
// PulsePay — Production-Grade Demo Seed & Reset Utility
// Seeds Business, Policies, Realistic B2B Clients, Invoices,
// Staged Installments, and the 3 Core Hackathon Scenarios.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePriorityScore } from './scoring';

export async function resetAndSeedDatabase(): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();

  // 1. Reset demo clock
  await supabase
    .from('demo_clock')
    .upsert({ id: 1, offset_days: 0, updated_at: new Date().toISOString() });

  // 2. Clear previous demo data (cascading foreign keys will clean children)
  await supabase.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 3. Create Demo Business: Studio Chen Creative LLC (Sarah Chen)
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

  // 4. Create Merchant Negotiation Policy
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

  // 5. Create 8 Realistic B2B Clients with authentic personas
  const clientsData = [
    {
      business_id: business.id,
      name: 'Elena Rostova',
      email: 'elena.rostova@aurahealth.co', // VP Marketing, Aura Health Media
      on_time_rate: 90,
      total_invoices: 6,
      total_paid: 5,
    },
    {
      business_id: business.id,
      name: 'Marcus Reed',
      email: 'm.reed@apexathletics.io', // Co-Founder & CEO, Apex Athletics
      on_time_rate: 65,
      total_invoices: 5,
      total_paid: 3,
    },
    {
      business_id: business.id,
      name: 'Julian Hayes',
      email: 'j.hayes@vanguardlogic.com', // VP Engineering, Vanguard Logic Systems
      on_time_rate: 40,
      total_invoices: 4,
      total_paid: 1,
    },
    {
      business_id: business.id,
      name: 'Dr. Aris Thorne',
      email: 'thorne@kromabiotech.org', // Chief Medical Officer, Kroma BioTech Labs
      on_time_rate: 55,
      total_invoices: 3,
      total_paid: 1,
    },
    {
      business_id: business.id,
      name: 'Nadia Benali',
      email: 'nadia.benali@atlasmediagroup.com', // Head of Strategy, Atlas Media Group
      on_time_rate: 85,
      total_invoices: 7,
      total_paid: 6,
    },
    {
      business_id: business.id,
      name: 'Lucas Moreau',
      email: 'l.moreau@solsticerobotics.com', // Product Director, Solstice Robotics Inc.
      on_time_rate: 30,
      total_invoices: 5,
      total_paid: 1,
    },
    {
      business_id: business.id,
      name: 'Chloe Dupont',
      email: 'c.dupont@lumierestudio.fr', // Creative Director, Lumière Studio Paris
      on_time_rate: 95,
      total_invoices: 8,
      total_paid: 8,
    },
    {
      business_id: business.id,
      name: 'Tariq Al-Mansoor',
      email: 'tariq@oasisventures.co', // Managing Partner, Oasis Ventures
      on_time_rate: 80,
      total_invoices: 4,
      total_paid: 3,
    },
  ];

  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .insert(clientsData)
    .select();

  if (clientErr || !clients || clients.length < 8) {
    throw new Error(`Failed to insert clients: ${clientErr?.message}`);
  }

  const [elena, marcus, julian, aris, nadia, lucas, chloe, tariq] = clients;
  const now = new Date();

  // 6. Define 8 Realistic Invoices spanning all aging buckets & scenarios
  // Bucket 1: 0–30 Days Overdue
  const elenaDueDate = new Date(now.getTime() - 7 * 86400000); // 7 days late
  const elenaScore = calculatePriorityScore({ amount: 850, due_date: elenaDueDate.toISOString(), status: 'SENT' }, elena, now);

  const nadiaDueDate = new Date(now.getTime() - 12 * 86400000); // 12 days late
  const nadiaScore = calculatePriorityScore({ amount: 650, due_date: nadiaDueDate.toISOString(), status: 'SENT' }, nadia, now);

  // Bucket 2: 31–60 Days Overdue
  const marcusDueDate = new Date(now.getTime() - 18 * 86400000); // 18 days late
  const marcusScore = calculatePriorityScore({ amount: 1200, due_date: marcusDueDate.toISOString(), status: 'SENT' }, marcus, now);

  const julianDueDate = new Date(now.getTime() - 35 * 86400000); // 35 days late
  const julianScore = calculatePriorityScore({ amount: 3500, due_date: julianDueDate.toISOString(), status: 'SENT' }, julian, now);

  const arisDueDate = new Date(now.getTime() - 48 * 86400000); // 48 days late
  const arisScore = calculatePriorityScore({ amount: 2800, due_date: arisDueDate.toISOString(), status: 'SENT' }, aris, now);

  const tariqDueDate = new Date(now.getTime() - 28 * 86400000); // 28 days late (installment arrangement active)
  const tariqScore = calculatePriorityScore({ amount: 2400, due_date: tariqDueDate.toISOString(), status: 'PARTIALLY_PAID' }, tariq, now);

  // Bucket 3: 60+ Days Overdue (Critical Severity)
  const lucasDueDate = new Date(now.getTime() - 68 * 86400000); // 68 days late
  const lucasScore = calculatePriorityScore({ amount: 1750, due_date: lucasDueDate.toISOString(), status: 'SENT' }, lucas, now);

  // Bucket 4: Settled / Paid (Populates Recovered KPI)
  const chloeDueDate = new Date(now.getTime() - 24 * 86400000);
  const chloeScore = calculatePriorityScore({ amount: 920, due_date: chloeDueDate.toISOString(), status: 'PAID' }, chloe, now);

  const invoicesToInsert = [
    {
      business_id: business.id,
      client_id: elena.id,
      paypal_invoice_id: 'INV2-ELENA-001',
      amount: 850,
      currency: 'USD',
      due_date: elenaDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: elenaScore.score,
      priority_reason: elenaScore.reason,
      description: 'Q3 Brand Guidelines & Visual Asset Refresh',
    },
    {
      business_id: business.id,
      client_id: marcus.id,
      paypal_invoice_id: 'INV2-MARCUS-002',
      amount: 1200,
      currency: 'USD',
      due_date: marcusDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: marcusScore.score,
      priority_reason: marcusScore.reason,
      description: 'E-Commerce Checkout Redesign & Mobile Prototype',
    },
    {
      business_id: business.id,
      client_id: julian.id,
      paypal_invoice_id: 'INV2-ALEX-003', // Preserves INV2-ALEX-003 for team compatibility
      amount: 3500,
      currency: 'USD',
      due_date: julianDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: julianScore.score,
      priority_reason: julianScore.reason,
      description: 'Enterprise Design System & React Component Library',
    },
    {
      business_id: business.id,
      client_id: aris.id,
      paypal_invoice_id: 'INV2-KROMA-004',
      amount: 2800,
      currency: 'USD',
      due_date: arisDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: arisScore.score,
      priority_reason: arisScore.reason,
      description: 'Interactive Clinical Trial Data Visualization Dashboard',
    },
    {
      business_id: business.id,
      client_id: nadia.id,
      paypal_invoice_id: 'INV2-ATLAS-005',
      amount: 650,
      currency: 'USD',
      due_date: nadiaDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: nadiaScore.score,
      priority_reason: nadiaScore.reason,
      description: 'Keynote Investor Presentation & Infographic Kit',
    },
    {
      business_id: business.id,
      client_id: lucas.id,
      paypal_invoice_id: 'INV2-SOLSTICE-006',
      amount: 1750,
      currency: 'USD',
      due_date: lucasDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: lucasScore.score,
      priority_reason: lucasScore.reason,
      description: 'Telemetry Interface & Realtime Mission Control UI',
    },
    {
      business_id: business.id,
      client_id: chloe.id,
      paypal_invoice_id: 'INV2-LUMIERE-007',
      amount: 920,
      currency: 'USD',
      due_date: chloeDueDate.toISOString(),
      status: 'PAID' as const,
      priority_score: chloeScore.score,
      priority_reason: chloeScore.reason,
      description: 'Custom Typography Licensing & Editorial Layouts',
    },
    {
      business_id: business.id,
      client_id: tariq.id,
      paypal_invoice_id: 'INV2-OASIS-008',
      amount: 2400,
      currency: 'USD',
      due_date: tariqDueDate.toISOString(),
      status: 'PARTIALLY_PAID' as const,
      priority_score: tariqScore.score,
      priority_reason: tariqScore.reason,
      description: 'Annual Strategic Design Advisory — Q3 Retainer',
    },
  ];

  const { data: insertedInvoices, error: invErr } = await supabase
    .from('invoices')
    .insert(invoicesToInsert)
    .select();

  if (invErr || !insertedInvoices || insertedInvoices.length < 8) {
    throw new Error(`Failed to insert invoices: ${invErr?.message}`);
  }

  // 7. Initialize Client Portal Conversation Tokens
  for (const inv of insertedInvoices) {
    const token = `demo-${inv.paypal_invoice_id.toLowerCase()}`;
    await supabase.from('conversations').insert({
      invoice_id: inv.id,
      token,
      status: 'ACTIVE',
    });
  }

  // Add alias token for backward compatibility with docs/CURRENT_STATUS.md
  // ("demo-inv2-sarah-001" points to Elena's invoice INV2-ELENA-001)
  const elenaInv = insertedInvoices.find((i) => i.paypal_invoice_id === 'INV2-ELENA-001');
  if (elenaInv) {
    await supabase.from('conversations').insert({
      invoice_id: elenaInv.id,
      token: 'demo-inv2-sarah-001',
      status: 'ACTIVE',
    });
  }

  // 8. Pre-seed Active Staged Installment Plan for Tariq (Oasis Ventures)
  // Demonstrates the Staged Installment Scheduler and Arrangement Timeline
  const tariqInv = insertedInvoices.find((i) => i.paypal_invoice_id === 'INV2-OASIS-008');
  if (tariqInv) {
    const { data: tariqArrangement } = await supabase
      .from('arrangements')
      .insert({
        invoice_id: tariqInv.id,
        type: 'PLAN',
        terms: {
          installments: 3,
          first_amount: 800,
          installment_amount: 800,
          total_amount: 2400,
        },
        status: 'ACCEPTED',
        approved_by: 'AGENT_AUTO',
      })
      .select()
      .single();

    if (tariqArrangement) {
      await supabase.from('installments').insert([
        {
          arrangement_id: tariqArrangement.id,
          number: 1,
          amount: 800,
          due_date: new Date(now.getTime() - 14 * 86400000).toISOString(),
          status: 'PAID',
          paid_at: new Date(now.getTime() - 14 * 86400000).toISOString(),
          paypal_invoice_id: 'INV2-OASIS-008-INST-1',
        },
        {
          arrangement_id: tariqArrangement.id,
          number: 2,
          amount: 800,
          due_date: new Date(now.getTime() + 16 * 86400000).toISOString(),
          status: 'SCHEDULED',
          paypal_invoice_id: null,
        },
        {
          arrangement_id: tariqArrangement.id,
          number: 3,
          amount: 800,
          due_date: new Date(now.getTime() + 46 * 86400000).toISOString(),
          status: 'SCHEDULED',
          paypal_invoice_id: null,
        },
      ]);
    }
  }

  // 9. Pre-seed Pending Approval for Julian (Vanguard Logic)
  // Ensures the "Needs Approval" KPI badge displays 1 item immediately
  const julianInv = insertedInvoices.find((i) => i.paypal_invoice_id === 'INV2-ALEX-003');
  if (julianInv) {
    await supabase.from('arrangements').insert({
      invoice_id: julianInv.id,
      type: 'DISCOUNT',
      terms: {
        requested_discount_pct: 35,
        discounted_amount: 2275,
        reason: 'Client requested 35% discount citing budget freezes; exceeds 10% policy threshold',
      },
      status: 'PENDING_APPROVAL',
      approved_by: null,
    });
  }

  // 10. Log Initial Seed Event
  await supabase.from('events').insert({
    type: 'DEMO_DATA_SEEDED',
    actor: 'SYSTEM',
    payload: {
      businessId: business.id,
      invoicesCreated: insertedInvoices.length,
      clientsCreated: clients.length,
      timestamp: new Date().toISOString(),
    },
  });

  return {
    success: true,
    message: `Database successfully seeded with "${business.name}", 8 realistic B2B clients, aging buckets, staged installments, and pending approvals.`,
  };
}
