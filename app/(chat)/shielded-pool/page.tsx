import { DunPlaygroundClient } from '@/components/dun-playground/dun-playground-client';

export const metadata = {
  title: 'Dun Protocol - Shielded Privacy Pool',
  description: 'Test privacy-preserving deposits and withdrawals on Solana',
};

export default function DunPlaygroundPage() {
  return <DunPlaygroundClient />;
}
