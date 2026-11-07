import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectIntent } from '@/lib/agent/intent-gate';
import { callLLM } from '@/lib/llm';
import { AGENT_TOOLS } from '@/lib/agent/tools';
import { buildNegotiationPrompt } from '@/lib/agent/prompt';
import { getDemoNow } from '@/lib/demo-clock';
import { checkPolicy } from '@/lib/guard/policy-guard';
import type { PolicyRow } from '@/types/database';

// LLM calls can be slow on free tiers.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const clientContent = (body.content || '').trim();

    if (!clientContent) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    // 1. Fetch conversation, invoice, policy, business
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('*, invoice:invoices(*, client:clients(*), business:businesses(*, policies(*)))')
      .eq('token', token)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const invoice = conversation.invoice;
    const business = invoice.business;
    const policy: PolicyRow = business.policies?.[0] || {
      business_id: business.id,
      max_discount_pct: 10,
      max_installments: 3,
      min_first_payment_pct: 30,
      approval_threshold: 2000,
      max_messages_per_day: 5,
      quiet_hours_start: 22,
      quiet_hours_end: 8,
      updated_at: new Date().toISOString(),
    };

    // 2. Run Intent Gate
    const intentResult = detectIntent(clientContent);

    // Record Client Message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'CLIENT',
      content: clientContent,
      intent: intentResult.intent,
    });

    // 3. Handle Intent Gate Stops (Dispute / Injection)
    if (intentResult.shouldStop) {
      if (intentResult.intent === 'DISPUTE') {
        await supabase
          .from('conversations')
          .update({ status: 'DISPUTED' })
          .eq('id', conversation.id);

        const disputeArrangement = await supabase
          .from('arrangements')
          .insert({
            invoice_id: invoice.id,
            conversation_id: conversation.id,
            type: 'DISCOUNT',
            terms: { reason: intentResult.flagReason || 'Deliverable dispute flagged by client' },
            status: 'PENDING_APPROVAL',
            approved_by: null,
          })
          .select()
          .single();

        const replyContent =
          "I have paused automated follow-ups regarding this invoice and escalated your note directly to the business owner. They will review your concerns personally.";

        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender: 'AGENT',
          content: replyContent,
          intent: 'DISPUTE_ACKNOWLEDGED',
        });

        return NextResponse.json({
          status: 'DISPUTED',
          message: replyContent,
          dispute: disputeArrangement.data,
        });
      }

      if (intentResult.intent === 'INJECTION') {
        const replyContent =
          "I cannot adjust agreed terms, bypass business rules, or apply unauthorized discounts. Any policy exceptions require manual review and sign-off by the business owner.";

        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender: 'AGENT',
          content: replyContent,
          intent: 'SECURITY_REFUSAL',
        });

        // Escalate to owner queue
        await supabase.from('arrangements').insert({
          invoice_id: invoice.id,
          conversation_id: conversation.id,
          type: 'DISCOUNT',
          terms: { reason: 'Unauthorized discount or prompt manipulation attempt' },
          status: 'PENDING_APPROVAL',
        });

        return NextResponse.json({
          status: 'ACTIVE',
          message: replyContent,
        });
      }
    }

    // 4. Normal Negotiation / Assistant Turn
    // Last 10 messages (newest first from the DB, reversed back to chronological)
    const { data: previousMessages } = await supabase
      .from('messages')
      .select('sender, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const formattedHistory = (previousMessages || []).reverse().map((m) => ({
      role: m.sender === 'AGENT' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));

    const systemPrompt = buildNegotiationPrompt({
      business,
      client: invoice.client,
      invoice,
      policy,
      now: await getDemoNow(),
    });

    const llmResponse = await callLLM({
      messages: [{ role: 'system', content: systemPrompt }, ...formattedHistory],
      tools: AGENT_TOOLS,
      invoiceAmount: invoice.amount,
    });

    // Save assistant message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'AGENT',
      content: llmResponse.content,
      intent: intentResult.intent,
    });

    // 5. Process any structured proposals emitted
    const createdOffers = [];
    if (llmResponse.toolCalls) {
      for (const call of llmResponse.toolCalls) {
        if (call.name === 'escalate' || call.name === 'flag_dispute') {
          if (call.name === 'flag_dispute') {
            await supabase.from('conversations').update({ status: 'DISPUTED' }).eq('id', conversation.id);
          }
          await supabase.from('arrangements').insert({
            invoice_id: invoice.id,
            conversation_id: conversation.id,
            type: 'DISCOUNT',
            terms: { reason: String(call.arguments.reason || call.name) },
            status: 'PENDING_APPROVAL',
          });
        }
        if (call.name === 'propose_offer') {
          const proposalCandidate = call.arguments;
          const guardResult = await checkPolicy(proposalCandidate, policy, invoice);

          if (guardResult.allowed) {
            const status = guardResult.needsApproval ? 'PENDING_APPROVAL' : 'PROPOSED';
            const { data: newArrangement } = await supabase
              .from('arrangements')
              .insert({
                invoice_id: invoice.id,
                conversation_id: conversation.id,
                type: (proposalCandidate.type as string).toUpperCase() as 'DISCOUNT' | 'PLAN' | 'PAY_LATER',
                terms: proposalCandidate,
                status,
                approved_by: guardResult.needsApproval ? null : 'POLICY',
              })
              .select('*, installments(*)')
              .single();

            if (newArrangement) {
              createdOffers.push(newArrangement);
            }
          }
        }
      }
    }

    // Return full updated message list & offers
    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    const { data: allOffers } = await supabase
      .from('arrangements')
      .select('*, installments(*)')
      .eq('invoice_id', invoice.id)
      .in('status', ['PROPOSED', 'PENDING_APPROVAL', 'ACCEPTED'])
      .order('created_at', { ascending: false });

    return NextResponse.json({
      status: conversation.status,
      messages: allMessages || [],
      offers: allOffers || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

