import { User, Github, Layers } from "lucide-react";
import Image from "next/image";

export default function TrustBadges() {
  return (
    <div className="flex gap-8 items-center text-[#A6A6A6] text-[12px] tracking-wide">
      
      {/* NON-CUSTODIAL */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#1C1C1C] flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        <h1>NON-CUSTODIAL</h1>
      </div>

      {/* OPEN SOURCE */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#1C1C1C] flex items-center justify-center">
          <Github size={16} className="text-white" />
        </div>
        <h1>OPEN SOURCE</h1>
      </div>

      {/* BUILT ON SOLANA */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#1C1C1C] flex items-center justify-center">
          <Image
          src="/5731.png"
          width={14}
          height={14}
          alt="logo"
          />
        </div>
        <h1>BUILT ON SOLANA</h1>
      </div>

    </div>
  );
}
