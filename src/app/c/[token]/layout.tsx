import type { Metadata } from 'next';
import './portal.css';

export const metadata: Metadata = {
  title: 'Invoice · PulsePay',
  description: 'A private payment page from your invoice provider.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="pp-portal">{children}</div>;
}
