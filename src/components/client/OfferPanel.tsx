import type {
  ClientPortalInvoice,
  ClientPortalPayLater,
  OfferView,
} from '@/lib/client-portal/types';
import OfferCard from './OfferCard';
import { SparklesIcon } from './icons';

interface OfferPanelProps {
  offers: OfferView[];
  invoice: ClientPortalInvoice;
  businessName: string;
  demoNow: string;
  paylater: ClientPortalPayLater | null;
  hasPayable: boolean;
  onAccept: (id: string) => void;
  onCaptured: () => void;
  acceptingId: string | null;
  error: { offerId: string; message: string } | null;
  variant: 'side' | 'inline';
}

export default function OfferPanel({
  offers,
  invoice,
  businessName,
  demoNow,
  paylater,
  hasPayable,
  onAccept,
  onCaptured,
  acceptingId,
  error,
  variant,
}: OfferPanelProps) {
  if (invoice.status === 'PAID') return null;

  return (
    <section
      className={`pp-offers pp-offers--${variant}`}
      aria-label="Payment options"
    >
      <div className="pp-offers__head">
        <div>
          <h2 className="pp-offers__title">Ways to pay</h2>
          <p className="pp-offers__sub">
            Within {businessName}&apos;s rules. Anything else goes to the owner.
          </p>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="pp-offers__empty">
          <SparklesIcon width={18} height={18} />
          {invoice.status === 'SUPERSEDED' || invoice.status === 'PARTIALLY_PAID' ? (
            <p>A payment arrangement is active. The details are in your conversation.</p>
          ) : hasPayable ? (
            <p>
              Your PayPal payment link is ready. Use the Pay button above to finish the payment.
            </p>
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
              paylater={paylater}
              onAccept={onAccept}
              onCaptured={onCaptured}
              busy={acceptingId === offer.id}
              error={error?.offerId === offer.id ? error.message : null}
            />
          ))}
        </div>
      )}

      {offers.length > 0 ? (
        <p className="pp-offers__footnote">
          You can also ask a question below. A person from {businessName} can step in at any time.
        </p>
      ) : null}
    </section>
  );
}
