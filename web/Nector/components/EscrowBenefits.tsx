import { CheckCircle2 } from 'lucide-react';

export default function EscrowBenefits() {
  return (
    <div className="
      bg-[#2A2A2A]
      rounded-2xl
      px-8
      py-6
      max-w-[760px]
      mx-auto
    ">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-[#EDEDED] text-[14px]">

        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2FE4E4] mt-[2px]" />
          <span>
            <strong>Non-custodial escrow</strong><br />
            <span className="text-[#A6A6A6]">
              (Platform never holds funds)
            </span>
          </span>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2FE4E4] mt-[2px]" />
          <span>
            Funds locked by rules, not people
          </span>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2FE4E4] mt-[2px]" />
          <span>
            Transparent & verifiable on-chain transactions
          </span>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2FE4E4] mt-[2px]" />
          <span>
            Open-source smart contracts
          </span>
        </div>

        <div className="flex items-start gap-3 md:col-span-2 justify-center">
          <CheckCircle2 className="w-5 h-5 text-[#2FE4E4] mt-[2px]" />
          <span>
            No chargebacks, no manual manipulation
          </span>
        </div>

      </div>
    </div>
  );
}
