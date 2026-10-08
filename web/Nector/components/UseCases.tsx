import {
  Truck,
  Laptop,
  Bitcoin,
  Gamepad2,
  Briefcase,
  Code2,
} from 'lucide-react';

const items = [
  {
    icon: Truck,
    title: 'Seller',
    desc: 'Never deliver without protection. Ensure payment is secured before you ship.',
  },
  {
    icon: Laptop,
    title: 'Freelancers',
    desc: 'Never work for free again. Ensure the client funds the project before you write a single line of code.',
  },
  {
    icon: Bitcoin,
    title: 'P2P Traders',
    desc: 'Exchange cryptocurrency or digital assets with strangers safely.',
  },
  {
    icon: Gamepad2,
    title: 'Digital Goods',
    desc: 'Safe buying and selling of domains, gaming accounts, and software licenses.',
  },
  {
    icon: Briefcase,
    title: 'Agencies',
    desc: 'Manage high-ticket client retainers with milestone-based escrow releases.',
  },
  {
    icon: Code2,
    title: 'Developers',
    desc: 'Build your own secure apps using our robust SDKs and comprehensive documentation.',
  },
];

export default function UseCases() {
  return (
    <section className="bg-black py-15">
      <div className="max-w-[1200px] mx-auto px-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className="
                  bg-[#2A2A2A]
                  rounded-2xl
                  p-6
                  transition
                  hover:bg-[#2F2F2F]
                "
              >
                <div className="mb-4">
                  <Icon className="w-6 h-6 text-[#2FE4E4]" />
                </div>

                <h3 className="text-white text-[16px] font-medium">
                  {item.title}
                </h3>

                <p className="mt-2 text-[#A6A6A6] text-[14px] leading-[1.6]">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
