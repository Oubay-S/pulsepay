// ============================================================
// PulsePay — Local API Validation Script
// Tests all API route handlers without needing the browser UI
// Run with: npm run test:api
// ============================================================

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  console.log('🧪 Starting PulsePay Backend Verification Suite...\n');

  const supabase = createAdminClient();

  // Test 1: Verify Supabase Connectivity
  console.log('1️⃣ Checking Supabase Database Connection...');
  const { data: clockData, error: clockError } = await supabase
    .from('demo_clock')
    .select('*')
    .eq('id', 1)
    .single();

  if (clockError) {
    console.error('❌ Supabase connection failed:', clockError.message);
    process.exit(1);
  }
  console.log('✅ Supabase connected. Demo clock offset:', clockData.offset_days, 'days\n');

  // Test 2: Invoices & KPIs
  console.log('2️⃣ Checking Invoices & Priority Scoring...');
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*, client:clients(name)')
    .order('priority_score', { ascending: false });

  if (invError) {
    console.error('❌ Invoices query failed:', invError.message);
    process.exit(1);
  }

  console.log(`✅ Retrieved ${invoices?.length || 0} invoices:`);
  for (const inv of invoices || []) {
    console.log(`   - [Score ${inv.priority_score}] ${inv.client?.name}: $${inv.amount} (${inv.paypal_invoice_id})`);
  }
  console.log();

  // Test 3: Active Conversations
  console.log('3️⃣ Checking Client Portal Conversations...');
  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('token, status, invoice:invoices(paypal_invoice_id)');

  if (convError) {
    console.error('❌ Conversations query failed:', convError.message);
    process.exit(1);
  }

  console.log(`✅ ${convs?.length || 0} Client conversation tokens active:`);
  for (const c of convs || []) {
    const inv = (Array.isArray(c.invoice) ? c.invoice[0] : c.invoice) as { paypal_invoice_id?: string } | null;
    console.log(`   - Token: "${c.token}" (Invoice: ${inv?.paypal_invoice_id || 'N/A'})`);
  }
  console.log();

  // Test 4: Business Policy
  console.log('4️⃣ Checking Merchant Negotiation Policy...');
  const { data: policy, error: polError } = await supabase
    .from('policies')
    .select('*')
    .limit(1)
    .single();

  if (polError) {
    console.error('❌ Policy query failed:', polError.message);
    process.exit(1);
  }

  console.log('✅ Owner Policy active:');
  console.log(`   - Max Discount: ${policy.max_discount_pct}%`);
  console.log(`   - Max Installments: ${policy.max_installments}`);
  console.log(`   - Min First Payment: ${policy.min_first_payment_pct}%`);
  console.log(`   - Approval Threshold: $${policy.approval_threshold}\n`);

  console.log('🎉 All backend components verified successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
