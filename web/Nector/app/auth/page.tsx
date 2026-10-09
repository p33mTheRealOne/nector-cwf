import { Suspense } from 'react';
import AuthPageClient from './AuthPageClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AuthPageClient />
    </Suspense>
  );
}