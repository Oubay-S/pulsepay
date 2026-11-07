// ============================================================
// PulsePay — PayPal → Supabase Invoice Sync
//
// Pulls every page of the merchant's PayPal invoices and reconciles
// them with the local database. Rules:
//   • Never invent a recipient email.
//   • Never import an untracked PulsePay demo/test invoice.
//   • Never resurrect a SUPERSEDED invoice from PayPal status.
//   • Never downgrade a PAID invoice to SENT.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listPayPalInvoices } from '@/lib/paypal/toolkit';
import { isPulsePayGeneratedNote } from '@/lib/paypal/invoices';
import { calculatePriorityScore } from '@/lib/scoring';
import { nanoid } from 'nanoid';
import type { InvoiceStatus } from '@/types/database';
import type { PayPalInvoice } from '@/types/paypal';

// Paginating the full PayPal account can take several seconds.
export const maxDuration = 60;

type Supabase = ReturnType<typeof createAdminClient>;

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface ClientInfo {
  name: string;
  on_time_rate: number;
  total_invoices: number;
}

interface TrackedInvoice {
  id: string;
  business_id: string;
  paypal_invoice_id: string;
  status: InvoiceStatus;
  description: string | null;
  client: ClientInfo | null;
}

/** Supabase types a to-one embed as an array; normalize at the boundary. */
interface TrackedInvoiceRow extends Omit<TrackedInvoice, 'client'> {
  client: ClientInfo | ClientInfo[] | null;
}

/** Maps a PayPal invoice status onto the database status enum. */
function mapPayPalStatus(status: string | undefined): InvoiceStatus | null {
  switch (status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'SENT':
    case 'UNPAID':
    case 'OVERDUE':
    case 'SCHEDULED':
      return 'SENT';
    case 'PAID':
    case 'MARKED_AS_PAID':
      return 'PAID';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'PARTIALLY_PAID':
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
      // REFUNDED lands with migration 002; PARTIALLY_PAID keeps the current
      // check constraint valid in the meantime.
      return 'PARTIALLY_PAID';
    default:
      return null;
  }
}

/** Parses PayPal's `yyyy-MM-dd` or ISO date-time strings. */
function parsePayPalDate(value: string | undefined): Date | null {
  if (!value) return null;

  const parsed = new Date(
    value.length === 10 ? `${value}T00:00:00Z` : value
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isActiveStatus(status: InvoiceStatus): boolean {
  return status === 'SENT' || status === 'PARTIALLY_PAID';
}

async function fetchAllPayPalInvoices(): Promise<PayPalInvoice[]> {
  const first = await listPayPalInvoices(1, PAGE_SIZE);
  const invoices = [...first.invoices];
  const pages = Math.min(Math.max(first.totalPages, 1), MAX_PAGES);

  for (let page = 2; page <= pages; page += 1) {
    const next = await listPayPalInvoices(page, PAGE_SIZE);
    invoices.push(...next.invoices);
  }

  return invoices;
}

async function resolveClientId(
  supabase: Supabase,
  businessId: string,
  email: string,
  name: string,
  cache: Map<string, string>
): Promise<string> {
  const key = email.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: existing, error } = await supabase
    .from('clients')
    .select('id')
    .eq('business_id', businessId)
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up client ${email}: ${error.message}`);
  }

  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from('clients')
    .insert({
      business_id: businessId,
      name,
      email,
      on_time_rate: 100,
    })
    .select('id')
    .single();

  if (insertError || !created) {
    throw new Error(
      `Failed to create client ${email}: ${insertError?.message ?? 'no row returned'}`
    );
  }

  cache.set(key, created.id);
  return created.id;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));

    // Find target business.
    let businessId =
      typeof body.business_id === 'string' ? body.business_id : undefined;

    if (!businessId) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .maybeSingle();
      businessId = biz?.id;
    }

    if (!businessId) {
      return NextResponse.json(
        { error: 'No business found to attach invoices' },
        { status: 404 }
      );
    }

    // Fetch every page of PayPal invoices.
    const paypalInvoices = await fetchAllPayPalInvoices();

    // Load every tracked invoice once instead of querying per PayPal invoice.
    const { data: trackedRows, error: trackedError } = await supabase
      .from('invoices')
      .select(
        'id, business_id, paypal_invoice_id, status, description, client:clients(name, on_time_rate, total_invoices)'
      )
      .not('paypal_invoice_id', 'is', null);

    if (trackedError) {
      return NextResponse.json({ error: trackedError.message }, { status: 500 });
    }

    const tracked = new Map<string, TrackedInvoice>();
    for (const row of (trackedRows ?? []) as unknown as TrackedInvoiceRow[]) {
      tracked.set(row.paypal_invoice_id, {
        ...row,
        client: Array.isArray(row.client) ? (row.client[0] ?? null) : row.client,
      });
    }

    const clientCache = new Map<string, string>();
    const errors: string[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const ppInv of paypalInvoices) {
      try {
        const paypalId = ppInv.id;
        if (!paypalId) {
          skipped += 1;
          continue;
        }

        const note = ppInv.detail?.note;
        const existing = tracked.get(paypalId);

        // Old demo/test invoices are never imported back after a DB reset.
        if (!existing && isPulsePayGeneratedNote(note)) {
          skipped += 1;
          continue;
        }

        const amountValue = ppInv.amount?.value ?? ppInv.due_amount?.value;
        const amount = amountValue ? Number.parseFloat(amountValue) : Number.NaN;

        if (!Number.isFinite(amount) || amount <= 0) {
          skipped += 1;
          errors.push(`Invoice ${paypalId}: missing or invalid amount`);
          continue;
        }

        const currency =
          ppInv.amount?.currency_code ??
          ppInv.detail?.currency_code ??
          'USD';
        const dueDate =
          parsePayPalDate(ppInv.detail?.payment_term?.due_date) ??
          parsePayPalDate(ppInv.detail?.invoice_date) ??
          new Date();
        const mappedStatus = mapPayPalStatus(ppInv.status);
        const noteDescription = note
          ?.replace(/\[PulsePay demo\]/gi, '')
          .trim();

        // ---------- Reconcile a tracked invoice ----------
        if (existing) {
          if (existing.business_id !== businessId) {
            skipped += 1;
            errors.push(
              `Invoice ${paypalId} already belongs to another business`
            );
            continue;
          }

          const updates: Record<string, unknown> = {
            amount,
            currency,
            due_date: dueDate.toISOString(),
            description:
              noteDescription ||
              existing.description ||
              `PayPal invoice ${paypalId}`,
            synced_at: new Date().toISOString(),
          };

          // SUPERSEDED is a PulsePay decision; PayPal only knows CANCELLED.
          // PAID must never be downgraded by a stale PayPal status.
          const canChangeStatus =
            mappedStatus !== null &&
            existing.status !== 'SUPERSEDED' &&
            !(existing.status === 'PAID' && mappedStatus !== 'PAID');

          const nextStatus = canChangeStatus
            ? (mappedStatus as InvoiceStatus)
            : existing.status;

          if (nextStatus !== existing.status) {
            updates.status = nextStatus;
          }

          if (isActiveStatus(nextStatus)) {
            const priority = calculatePriorityScore(
              {
                amount,
                due_date: dueDate.toISOString(),
                status: nextStatus,
              },
              existing.client,
              new Date()
            );
            updates.priority_score = priority.score;
            updates.priority_reason = priority.reason;
          } else if (nextStatus === 'PAID') {
            updates.priority_score = 0;
            updates.priority_reason = 'Paid via PayPal';
          }

          const { error } = await supabase
            .from('invoices')
            .update(updates)
            .eq('id', existing.id);

          if (error) {
            throw new Error(`Failed to update invoice ${paypalId}: ${error.message}`);
          }

          updated += 1;
          continue;
        }

        // ---------- Import a new invoice ----------
        // A cancelled invoice PulsePay never tracked is history, not work.
        if (mappedStatus === 'CANCELLED') {
          skipped += 1;
          continue;
        }

        const email = ppInv.primary_recipients?.[0]?.billing_info?.email_address
          ?.trim();

        if (!email) {
          skipped += 1;
          errors.push(
            `Invoice ${paypalId}: no recipient email; skipped instead of inventing one`
          );
          continue;
        }

        const name = ppInv.primary_recipients?.[0]?.billing_info?.name;
        const clientName =
          `${name?.given_name ?? ''} ${name?.surname ?? ''}`.trim() ||
          email.split('@')[0];

        const clientId = await resolveClientId(
          supabase,
          businessId,
          email,
          clientName,
          clientCache
        );

        const status = mappedStatus ?? 'SENT';
        const priority = isActiveStatus(status)
          ? calculatePriorityScore(
              { amount, due_date: dueDate.toISOString(), status },
              {
                name: clientName,
                on_time_rate: 100,
                total_invoices: 1,
              },
              new Date()
            )
          : {
              score: 0,
              reason:
                status === 'PAID' ? 'Paid via PayPal' : 'Imported from PayPal',
            };

        const { data: insertedInv, error: insertError } = await supabase
          .from('invoices')
          .insert({
            business_id: businessId,
            client_id: clientId,
            paypal_invoice_id: paypalId,
            amount,
            currency,
            due_date: dueDate.toISOString(),
            status,
            priority_score: priority.score,
            priority_reason: priority.reason,
            description: noteDescription || `PayPal invoice ${paypalId}`,
            synced_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError || !insertedInv) {
          throw new Error(
            `Failed to insert invoice ${paypalId}: ${insertError?.message ?? 'no row returned'}`
          );
        }

        const { error: conversationError } = await supabase
          .from('conversations')
          .insert({
            invoice_id: insertedInv.id,
            token: nanoid(12),
            status: 'ACTIVE',
          });

        if (conversationError) {
          errors.push(
            `Invoice ${paypalId}: created but conversation failed (${conversationError.message})`
          );
        }

        created += 1;
      } catch (itemErr: unknown) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        errors.push(`Error syncing invoice ${ppInv.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      synced: paypalInvoices.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
