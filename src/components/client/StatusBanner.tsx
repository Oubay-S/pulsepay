import type { ReactNode } from 'react';
import { AlertIcon, CheckCircleIcon, ClockIcon, InfoIcon, WifiOffIcon } from './icons';

export type BannerTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral';

interface StatusBannerProps {
  tone: BannerTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

function BannerIcon({ tone }: { tone: BannerTone }) {
  switch (tone) {
    case 'success':
      return <CheckCircleIcon width={18} height={18} />;
    case 'warning':
      return <ClockIcon width={18} height={18} />;
    case 'danger':
      return <AlertIcon width={18} height={18} />;
    case 'neutral':
      return <WifiOffIcon width={18} height={18} />;
    default:
      return <InfoIcon width={18} height={18} />;
  }
}

export default function StatusBanner({ tone, title, children, action }: StatusBannerProps) {
  return (
    <div
      className={`pp-banner pp-banner--${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className="pp-banner__icon" aria-hidden>
        <BannerIcon tone={tone} />
      </span>
      <div className="pp-banner__copy">
        <p className="pp-banner__title">{title}</p>
        {children ? <div className="pp-banner__body">{children}</div> : null}
      </div>
      {action ? <div className="pp-banner__action">{action}</div> : null}
    </div>
  );
}
