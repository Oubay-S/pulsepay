// ============================================================
// PulsePay — Demo Seed & Reset Utility
// Seeds Business, Policies, Clients, and the 3 Hackathon Scenarios
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePriorityScore } from './scoring';

export async function resetAndSeedDatabase(): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();

  // 1. Reset demo clock
  await supabase
    .from('demo_clock')
    .upsert({ id: 1, offset_days: 0, updated_at: new Date().toISOString() });

  // 2. Clear previous demo data
  // Cascading deletes will clear dependent rows
  await supabase.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 3. Create Demo Business
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .insert({
      name: 'Studio Pulse Creative',
      paypal_merchant_email: 'merchant-test@pulsepay.dev',
      currency: 'USD',
      tone: 'friendly',
    })
    .select()
    .single();

  if (bizErr || !business) {
    throw new Error(`Failed to create demo business: ${bizErr?.message}`);
  }

  // 4. Create Owner Policy
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

  // 5. Create the 3 Demo Clients
  const clientsData = [
    {
      business_id: business.id,
      name: 'Sarah Chen',
      email: 'sarah.chen@example.com',
      on_time_rate: 90,
      total_invoices: 6,
      total_paid: 5,
    },
    {
      business_id: business.id,
      name: 'Marcus Rivera',
      email: 'marcus.rivera@example.com',
      on_time_rate: 60,
      total_invoices: 4,
      total_paid: 2,
    },
    {
      business_id: business.id,
      name: 'Alex Thompson',
      email: 'alex.thompson@example.com',
      on_time_rate: 40,
      total_invoices: 5,
      total_paid: 2,
    },
  ];

  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .insert(clientsData)
    .select();

  if (clientErr || !clients || clients.length < 3) {
    throw new Error(`Failed to insert clients: ${clientErr?.message}`);
  }

  const [sarah, marcus, alex] = clients;
  const now = new Date();

  // 6. Create the 3 Invoices corresponding to the Hackathon Scenarios
  // Scenario 1: Sarah Chen - $850, 7 days overdue (Forgot)
  const sarahDueDate = new Date(now.getTime() - 7 * 86400000);
  const sarahScore = calculatePriorityScore({ amount: 850, due_date: sarahDueDate.toISOString(), status: 'SENT' }, sarah, now);

  // Scenario 2: Marcus Rivera - $1,200, 15 days overdue (Can't pay full / needs plan)
  const marcusDueDate = new Date(now.getTime() - 15 * 86400000);
  const marcusScore = calculatePriorityScore({ amount: 1200, due_date: marcusDueDate.toISOString(), status: 'SENT' }, marcus, now);

  // Scenario 3: Alex Thompson - $3,500, 30 days overdue (Tries to game rules / needs owner approval)
  const alexDueDate = new Date(now.getTime() - 30 * 86400000);
  const alexScore = calculatePriorityScore({ amount: 3500, due_date: alexDueDate.toISOString(), status: 'SENT' }, alex, now);

  const invoicesToInsert = [
    {
      business_id: business.id,
      client_id: sarah.id,
      paypal_invoice_id: 'INV2-SARAH-001',
      amount: 850,
      currency: 'USD',
      due_date: sarahDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: sarahScore.score,
      priority_reason: sarahScore.reason,
      description: 'Brand identity & logo package',
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
      description: 'Web application frontend sprint',
    },
    {
      business_id: business.id,
      client_id: alex.id,
      paypal_invoice_id: 'INV2-ALEX-003',
      amount: 3500,
      currency: 'USD',
      due_date: alexDueDate.toISOString(),
      status: 'SENT' as const,
      priority_score: alexScore.score,
      priority_reason: alexScore.reason,
      description: 'Quarterly enterprise maintenance & architecture',
    },
  ];

  const { data: insertedInvoices, error: invErr } = await supabase
    .from('invoices')
    .insert(invoicesToInsert)
    .select();

  if (invErr || !insertedInvoices) {
    throw new Error(`Failed to insert invoices: ${invErr?.message}`);
  }

  // 7. Initialize standard client conversation tokens for each scenario
  for (const inv of insertedInvoices) {
    const token = `demo-${inv.paypal_invoice_id.toLowerCase()}`;
    await supabase.from('conversations').insert({
      invoice_id: inv.id,
      token,
      status: 'ACTIVE',
    });
  }

  // 8. Log Initial Event
  await supabase.from('events').insert({
    type: 'DEMO_DATA_SEEDED',
    actor: 'SYSTEM',
    payload: {
      businessId: business.id,
      invoicesCreated: insertedInvoices.length,
    },
  });

  return {
    success: true,
    message: `Database successfully re-seeded with business "${business.name}" and 3 demo scenarios.`,
  };
}

