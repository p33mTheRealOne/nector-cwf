'use client';

import { useState } from 'react';

const faqs = [
  {
    question: "What happens if the seller doesn’t deliver the item?",
    answer:
      "If the seller fails to ship before the agreed deadline, the smart contract automatically refunds the buyer. No manual intervention required.",
  },
  {
    question: "What if the buyer receives the item but doesn’t confirm?",
    answer:
      "Once the seller marks the item as shipped, a confirmation timer starts. If the buyer doesn’t respond within the time window, the funds are automatically released to the seller.",
  },
  {
    question: "What happens if there is a dispute between buyer and seller?",
    answer:
      "In case of a dispute, funds are temporarily locked while the contract follows predefined rules. There is no admin decision — outcomes are determined by on-chain logic and time-based rules.",
  },
  {
    question: "Is this escrow service non-custodial?",
    answer:
      "Yes. Nector never holds user funds. All payments are locked in a Solana smart contract and can only be released according to the contract rules.",
  },
  {
    question: "Is this escrow safe for large transactions?",
    answer:
      "Escrow rules are enforced by smart contracts, not human trust. The contract has not been audited yet, so we recommend starting with small amounts.",
  },
  {
    question: "Do I need crypto knowledge to use this escrow?",
    answer:
      "No. You only need a wallet to send and receive payments. The escrow logic runs automatically in the background.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="mt-15 space-y-3">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={index}
            className="rounded-[10px] bg-[#2A2A2A] overflow-hidden transition"
          >
            {/* QUESTION */}
            <button
              onClick={() => toggle(index)}
              className="
                w-full
                flex
                items-center
                justify-between
                px-5
                py-4
                text-left
                text-[15px]
                lg:text-[16px]
                font-medium
                transition
              "
            >
              <span className={isOpen ? 'text-[#2FE4E4]' : 'text-white'}>
                {faq.question}
              </span>

              <span
                className={`
                  transition-transform
                  ${isOpen ? 'rotate-180 text-[#2FE4E4]' : 'rotate-0 text-[#A6A6A6]'}
                `}
              >
                ▾
              </span>
            </button>

            {/* ANSWER */}
            <div
              className={`
                grid
                transition-all
                duration-300
                ease-in-out
                ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
              `}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-[#A6A6A6] text-[14px] leading-[1.6]">
                  {faq.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
