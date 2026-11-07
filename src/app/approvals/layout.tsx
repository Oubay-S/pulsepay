import type { Metadata } from 'next';
import '../pulsepay-theme.css';
import './approvals.css';

export const metadata: Metadata = {
  title: 'Approvals · PulsePay',
  description: 'Review requests that fall outside the assistant policy.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
