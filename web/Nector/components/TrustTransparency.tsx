import { Code2, ShieldCheck, Gavel } from 'lucide-react';

export default function TrustTransparency() {
  return (
    <section className="bg-black py-24">
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

        {/* ===== LEFT CONTENT ===== */}
        <div>
          <h2 className="text-white text-[28px] lg:text-[36px] font-medium mb-12">
            Built for trust and transparency
          </h2>

          <div className="space-y-10">

            {/* Item 1 */}
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#1E1E1E] flex items-center justify-center">
                <Code2 className="text-[#2FE4E4] w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white text-[16px] font-medium">
                  Verifiable Logic
                </h3>
                <p className="mt-1 text-[#A6A6A6] text-[14px] leading-[1.6] max-w-[420px]">
                  Our escrow logic is open-source and auditable.
                  We don't rely on hidden backends; we rely on code.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#1E1E1E] flex items-center justify-center">
                <ShieldCheck className="text-[#2FE4E4] w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white text-[16px] font-medium">
                  No Manual Intervention
                </h3>
                <p className="mt-1 text-[#A6A6A6] text-[14px] leading-[1.6] max-w-[420px]">
                  Funds move only when conditions are met.
                  No human bias, no frozen accounts without cause.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#1E1E1E] flex items-center justify-center">
                <Gavel className="text-[#2FE4E4] w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white text-[16px] font-medium">
                  Transparent Dispute System
                </h3>
                <p className="mt-1 text-[#A6A6A6] text-[14px] leading-[1.6] max-w-[420px]">
                  If a dispute arises, neutral arbitrators review
                  evidence on-chain to decide the outcome fairly.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ===== RIGHT CODE CARD ===== */}
        <div className="relative">
          <div className="
            bg-[#2A2A2A]
            rounded-2xl
            p-6
            text-[13px]
            font-mono
            text-[#EDEDED]
            shadow-lg
          ">

            {/* Window dots */}
            <div className="flex gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
            </div>

            {/* Code */}
            <pre className="leading-[1.7] overflow-x-auto">
{`function releaseFunds(orderId) {
  const order = await getOrder(orderId);

  // Ensure security checks
  if (order.status !== 'CONFIRMED') {
    throw new Error('Buyer has not confirmed');
  }

  // Atomic transfer
  await transfer(order.seller, order.amount);

  // Close order
  order.status = 'CONFIRMED';
  return true;
}`}
            </pre>
          </div>
        </div>

      </div>
    </section>
  );
}
