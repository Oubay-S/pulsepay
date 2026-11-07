import type { ClientPortalInvoice, OfferView } from '@/lib/client-portal/types';
import { formatMoney } from '@/lib/client-portal/format';
import OfferCard from './OfferCard';
import { ShieldCheckIcon, SparklesIcon } from './icons';

interface OfferPanelProps {
  offers: OfferView[];
  invoice: ClientPortalInvoice;
  businessName: string;
  demoNow: string;
  onAccept: (id: string) => void;
  acceptingId: string | null;
  error: { offerId: string; message: string } | null;
  variant: 'side' | 'inline';
}

export default function OfferPanel({
  offers,
  invoice,
  businessName,
  demoNow,
  onAccept,
  acceptingId,
  error,
  variant,
}: OfferPanelProps) {
  return (
    <section
      className={`pp-offers pp-offers--${variant}`}
      aria-label="Payment options"
    >
      <div className="pp-offers__head">
        <span className="pp-offers__icon" aria-hidden>
          <ShieldCheckIcon width={18} height={18} />
        </span>
        <div>
          <h2 className="pp-offers__title">Options to settle</h2>
          <p className="pp-offers__sub">
            Within {businessName}&apos;s rules. Anything else goes to the owner.
          </p>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="pp-offers__empty">
          <SparklesIcon width={18} height={18} />
          {invoice.status === 'PAID' ? (
            <p>This invoice is settled. Nothing left to do — thank you.</p>
          ) : invoice.status === 'SUPERSEDED' || invoice.status === 'PARTIALLY_PAID' ? (
            <p>A payment arrangement is active. The details are in your conversation.</p>
          ) : (
            <p>
              No options yet. Reply to the assistant and we&apos;ll find a way forward within the
              business&apos;s rules.
            </p>
          )}
        </div>
      ) : (
        <div className="pp-offers__list">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              invoice={invoice}
              businessName={businessName}
              demoNow={demoNow}
              onAccept={onAccept}
              busy={acceptingId === offer.id}
              error={error?.offerId === offer.id ? error.message : null}
            />
          ))}
        </div>
      )}

      {offers.length > 0 && invoice.status !== 'PAID' ? (
        <p className="pp-offers__footnote">
          You can also ask a question below. A person from {businessName} can step in at any time.
        </p>
      ) : null}

      {invoice.status === 'PAID' ? (
        <p className="pp-offers__paid">
          Paid {formatMoney(invoice.amount, invoice.currency)} · no balance remaining
        </p>
      ) : null}
    </section>
  );
}
