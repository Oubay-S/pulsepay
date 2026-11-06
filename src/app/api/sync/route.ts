import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listPayPalInvoices } from '@/lib/paypal/toolkit';
import { calculatePriorityScore } from '@/lib/scoring';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));

    // Find target business
    let businessId = body.business_id;
    if (!businessId) {
      const { data: biz } = await supabase.from('businesses').select('id').limit(1).single();
      businessId = biz?.id;
    }

    if (!businessId) {
      return NextResponse.json({ error: 'No business found to attach invoices' }, { status: 404 });
    }

    // Call PayPal Invoicing API to fetch recent invoices
    const { invoices: paypalInvoices } = await listPayPalInvoices(1, 20);

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const ppInv of paypalInvoices) {
      try {
        const paypalId = ppInv.id;
        const amount = parseFloat(ppInv.amount?.value || ppInv.due_amount?.value || '0');
        const currency = ppInv.amount?.currency_code || 'USD';
        const dueDate = ppInv.detail?.payment_term?.due_date || new Date().toISOString();
        const clientEmail = ppInv.primary_recipients?.[0]?.billing_info?.email_address || 'client@example.com';
        const clientGivenName = ppInv.primary_recipients?.[0]?.billing_info?.name?.given_name || 'Client';
        const clientSurname = ppInv.primary_recipients?.[0]?.billing_info?.name?.surname || '';
        const clientName = `${clientGivenName} ${clientSurname}`.trim();

        // 1. Upsert Client
        let clientId: string;
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('business_id', businessId)
          .eq('email', clientEmail)
          .single();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: newClient } = await supabase
            .from('clients')
            .insert({
              business_id: businessId,
              name: clientName,
              email: clientEmail,
              on_time_rate: 100,
            })
            .select('id')
            .single();
          clientId = newClient!.id;
        }

        // 2. Compute Priority Score
        const priority = calculatePriorityScore(
          { amount, due_date: dueDate, status: 'SENT' },
          { name: clientName, on_time_rate: 100, total_invoices: 1 },
          new Date()
        );

        // 3. Upsert Invoice
        const { data: existingInv } = await supabase
          .from('invoices')
          .select('id')
          .eq('paypal_invoice_id', paypalId)
          .single();

        if (existingInv) {
          await supabase
            .from('invoices')
            .update({
              amount,
              currency,
              due_date: dueDate,
              priority_score: priority.score,
              priority_reason: priority.reason,
              synced_at: new Date().toISOString(),
            })
            .eq('id', existingInv.id);
          updatedCount++;
        } else {
          const { data: insertedInv } = await supabase
            .from('invoices')
            .insert({
              business_id: businessId,
              client_id: clientId,
              paypal_invoice_id: paypalId,
              amount,
              currency,
              due_date: dueDate,
              status: 'SENT',
              priority_score: priority.score,
              priority_reason: priority.reason,
            })
            .select('id')
            .single();

          if (insertedInv) {
            // Create conversation token for client page
            const token = nanoid(12);
            await supabase.from('conversations').insert({
              invoice_id: insertedInv.id,
              token,
              status: 'ACTIVE',
            });
            createdCount++;
          }
        }
      } catch (itemErr: unknown) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        errors.push(`Error syncing invoice ${ppInv.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      synced: paypalInvoices.length,
      created: createdCount,
      updated: updatedCount,
      errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

