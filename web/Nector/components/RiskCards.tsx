import { Package, DollarSign, RotateCcw, UserX } from "lucide-react";

const items = [
  {
    icon: Package,
    title: "Item Not Received",
    desc: "Buyers pay upfront but the seller never ships the goods or ghosts the buyer.",
  },
  {
    icon: DollarSign,
    title: "Non-Payment",
    desc: "Freelancers deliver work but the client refuses to pay or disappears.",
  },
  {
    icon: RotateCcw,
    title: "Chargeback Fraud",
    desc: "Sellers ship items, buyers claim fraud, and the bank forcibly reverses the payment.",
  },
  {
    icon: UserX,
    title: "No Middleman",
    desc: "P2P marketplaces lack a trusted layer to hold funds during the exchange.",
  },
];

export default function RiskCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((item, i) => (
        <div
          key={i}
          className="
            bg-[#2A2A2A]
            rounded-[16px]
            p-6
            text-left
            hover:bg-[#303030]
            transition
          "
        >
          <div className="w-9 h-9 rounded-md bg-[#1F1F1F] flex items-center justify-center mb-4">
            <item.icon className="w-5 h-5 text-[#E53935]" />
          </div>

          <h3 className="text-white text-[15px] font-semibold mb-2">
            {item.title}
          </h3>

          <p className="text-[#A6A6A6] text-[13px] leading-[1.5]">
            {item.desc}
          </p>
        </div>
      ))}
    </div>
  );
}
