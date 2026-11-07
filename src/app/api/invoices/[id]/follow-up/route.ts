import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { callLLM } from '@/lib/llm';
import { buildFollowUpPrompt, followUpTemplate } from '@/lib/agent/prompt';
import { getDemoNow } from '@/lib/demo-clock';
import { sendFollowUpEmail } from '@/lib/email';
import { nanoid } from 'nanoid';

// LLM calls can be slow on free tiers.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    // Fetch invoice with business and client
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*, business:businesses(*), client:clients(*)')
      .eq('id', id)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const client = invoice.client;
    const business = invoice.business;

    // Check or create conversation. Demo invoices can have an alias token too
    // (e.g. demo-inv2-sarah-001), so .single() would fail and create a third one.
    // ponytail: token order picks the primary demo token; store a primary flag if aliases grow.
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at')
      .order('token')
      .limit(1)
      .maybeSingle();

    if (!conversation) {
      const token = nanoid(12);
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          invoice_id: id,
          token,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (convErr) {
        return NextResponse.json({ error: convErr.message }, { status: 500 });
      }
      conversation = newConv;
    }

    const llmResult = await callLLM({
      messages: [
        {
          role: 'system',
          content: buildFollowUpPrompt({ business, client, invoice, now: await getDemoNow() }),
        },
        { role: 'user', content: 'Write the follow-up message.' },
      ],
    });

    // The generic fallback reply makes no sense as a first message, so use a template instead.
    const followUpText =
      llmResult.providerUsed === 'primary' || llmResult.providerUsed === 'fallback'
        ? llmResult.content
        : followUpTemplate({ client, invoice });

    // Record message in conversation
    await supabase.from('messages').insert({
      conversation_id: conversation!.id,
      sender: 'AGENT',
      content: followUpText,
      intent: 'FOLLOW_UP',
    });

    // Log event
    await supabase.from('events').insert({
      type: 'FOLLOW_UP_SENT',
      actor: 'AGENT',
      entity_type: 'invoice',
      entity_id: id,
      payload: {
        token: conversation!.token,
        preview: followUpText,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const clientPageUrl = `${appUrl}/c/${conversation!.token}`;

    // Email is a delivery convenience: a failure must not block the follow-up.
    const email = client?.email
      ? await sendFollowUpEmail({
          to: client.email,
          clientName: client.name,
          businessName: business?.name || 'PulsePay',
          invoiceNumber: invoice.paypal_invoice_id,
          amount: Number(invoice.amount),
          currency: invoice.currency || 'USD',
          dueDate: invoice.due_date,
          url: clientPageUrl,
        })
      : { sent: false, skipped: true };

    return NextResponse.json({
      success: true,
      conversation_id: conversation!.id,
      token: conversation!.token,
      message: followUpText,
      client_page_url: clientPageUrl,
      email,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

