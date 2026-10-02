import { Wallet, Truck, CheckCircle } from 'lucide-react';

export default function EscrowSteps() {
  return (
    <div className="w-full">

      {/* steps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-20 text-center">

        {/* STEP 1 */}
        <div className="relative flex flex-col items-center">
          <div className="w-[96px] h-[96px] rounded-full bg-[#1C1C1C] flex items-center justify-center z-10">
            <Wallet className="w-10 h-10 text-white" />
          </div>

          <h3 className="mt-8 text-white text-[20px] font-medium">
            Fund Escrow
          </h3>

          <p className="mt-4 text-[#A6A6A6] text-[15px] max-w-[280px] leading-[1.7]">
            The buyer deposits funds into the secure smart contract.
            Money is locked and cannot be withdrawn by the seller yet.
          </p>
        </div>

        {/* STEP 2 */}
        <div className="relative flex flex-col items-center">
          <div className="w-[96px] h-[96px] rounded-full bg-[#1C1C1C] flex items-center justify-center z-10">
            <Truck className="w-10 h-10 text-white" />
          </div>

          <h3 className="mt-8 text-white text-[20px] font-medium">
            Deliver Service
          </h3>

          <p className="mt-4 text-[#A6A6A6] text-[15px] max-w-[280px] leading-[1.7]">
            The seller ships the item or delivers the digital service,
            knowing the funds are safely waiting in the vault.
          </p>
        </div>

        {/* STEP 3 */}
        <div className="relative flex flex-col items-center">
          <div className="w-[96px] h-[96px] rounded-full bg-[#1C1C1C] flex items-center justify-center z-10">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>

          <h3 className="mt-8 text-white text-[20px] font-medium">
            Release Funds
          </h3>

          <p className="mt-4 text-[#A6A6A6] text-[15px] max-w-[280px] leading-[1.7]">
            The buyer confirms receipt. The smart contract automatically
            releases the funds to the seller. Transaction complete.
          </p>
        </div>

      </div>
    </div>
  );
}
