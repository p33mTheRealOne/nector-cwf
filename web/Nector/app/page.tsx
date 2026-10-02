// app/page.tsx



//DO NOT MODIFY!!!!




import { supabaseServer } from '@/lib/supabase/server';
import LandingPage from '@/components/Landing';
import AppHome from './Chat/AppHome';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nector | Chat-Based, Non-Custodial Escrow Platform Built on Solana',
  description:
    'Secure escrow directly in chat. Nector is a non-custodial escrow platform on Solana with automated smart contract payouts — no middleman needed. Perfect for buying and selling digital and physical products.',
  openGraph: {
    title: 'Nector | Chat-Based, Non-Custodial Escrow Platform Built on Solana',
    description:
      'Secure escrow directly in chat. Nector is a non-custodial escrow platform on Solana with automated smart contract payouts — no middleman needed. Perfect for buying and selling digital and physical products.',
    type: 'website',
    url: 'https://www.nector.chat/',
    siteName: 'Nector',
    images: [
      {
        url: 'https://www.nector.chat/og.png',
        width: 1200,
        height: 630,
        alt: 'Nector - Chat Escrow Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nector | Chat-Based, Non-Custodial Escrow Platform Built on Solana',
    description:
      'Secure escrow directly in chat. Nector is a non-custodial escrow platform on Solana with automated smart contract payouts — no middleman needed. Perfect for buying and selling digital and physical products.',
    images: ['https://www.nector.chat/og.png'],
  },
  alternates: {
    canonical: 'https://www.nector.chat',
  },
};

export default async function Page() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <LandingPage />;

  const displayName = (user.user_metadata as any)?.display_name;
  if (!displayName || !String(displayName).trim()) {
    redirect('/onboarding/username');
  }

  return <AppHome/>;
}
