"use client";

import Image from "next/image";
import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type SubChildItem = {
  label: string;
  path: string;
};

type ChildItem = {
  label: string;
  path?: string;
  children?: SubChildItem[];
};

type Item = {
  id: string;
  label: string;
  path?: string;
  children?: ChildItem[];
};

type DocsSidebarProps = {
  className?: string;
};

export default function DocsSidebar({ className = "" }: DocsSidebarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openSubId, setOpenSubId] = useState<string | null>(null);

  const items: Item[] = [
    { 
      id: "getting-started",
      label: "Getting Started",
      children: [
        { label: "Introduction", path: "/docs/introduction" },
        { label: "How Nector Works", path: "/docs/how-it-works" },
      ],
    },
    {
      id: "core-concepts",
      label: "Core Concepts",
      children: [
        { label: "Dispute System", path: "/docs/dispute" },
        { label: "Draw Dispute Mode", path: "/docs/mode" },
        { label: "Timeout System", path: "/docs/timeout" },
      ],
    },

    {
      id: "developer",
      label: "Developer",
      children: [
        { label: "Nector Mini", path: "/docs/nector-mini" },
        {
          label: "Nector Smart Contract",
          children: [
            { label: "Nector Smart Contract V0.3", path: "/docs/nector-smart-contract-v0.3" },
            { label: "Nector Smart Contract V0.2", path: "/docs/nector-smart-contract-v0.2" },
            { label: "Nector Smart Contract V0.1", path: "/docs/nector-smart-contract-v0.1" },
          ],
        },
        { label: "Nector1K", path: "/docs/nector1k" },
      ],
    },

    {
      id: "security-model",
      label: "Security Model", 
      path: "/docs/security"
    },
    {
      id: "whitepaper",
      label: "Whitepaper", 
      path: "/nector-whitepaper.pdf"
    },
  ];

  const pathname = usePathname();

  useEffect(() => {
    items.forEach((item) => {
      if (
        item.children?.some(
          (child) =>
            pathname === child.path ||
            child.children?.some((sub) => pathname === sub.path)
        )
      ) {
        setOpenId(item.id);
      }
      item.children?.forEach((child) => {
        if (child.children?.some((sub) => pathname === sub.path)) {
          setOpenSubId(child.label);
        }
      });
    });
  }, [pathname]);

  return (
    <aside
      className={`sticky top-[70px] h-[calc(100vh-70px)] w-[260px]
                  self-start bg-black border-r border-[#2E2E2E] p-4 ${className}`}
    >
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const isActiveParent = item.children?.some(
            (child) =>
              pathname === child.path ||
              child.children?.some((sub) => pathname === sub.path)
          );

          const isOpen =
            openId === item.id ||
            item.children?.some(
              (child) =>
                pathname === child.path ||
                child.children?.some((sub) => pathname === sub.path)
            );

          return (
            <Fragment key={item.id}>
              {item.children ? (
                <li
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className={`group cursor-pointer flex items-center justify-between px-4 py-2 rounded-lg transition font-medium
                    ${
                      isActiveParent
                        ? "text-[#A6A6A6] bg-transparent"
                        : "text-[#A6A6A6] hover:text-[#26D9D9] hover:bg-[#041616]"
                    }
                  `}
                >
                  {item.label}

                  <Image
                    src="/back-svgrepo-com.svg"
                    width={14}
                    height={14}
                    alt="arrow"
                    className={`transition ${
                      isOpen ? "rotate-90" : "rotate-180"
                    }`}
                  />
                </li>
              ) : item.path ? (
                <li>
                  <Link
                    href={item.path}
                    className={`block px-4 py-2 rounded-lg transition font-medium
                      ${
                        pathname === item.path
                          ? "text-[#26D9D9] bg-[#041616]"
                          : "text-[#A6A6A6] hover:text-[#26D9D9] hover:bg-[#041616]"
                      }
                    `}
                  >
                    {item.label}
                  </Link>
                </li>
              ) : null}

              <AnimatePresence>
                {isOpen && item.children && (
                  <motion.ul
                    key={item.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="ml-6 mt-2 flex flex-col gap-2 overflow-hidden"
                  >
                    {item.children.map((child) => {
                      if (child.children) {
                        const isSubActiveParent = child.children.some(
                          (sub) => pathname === sub.path
                        );
                        const isSubOpen =
                          openSubId === child.label || isSubActiveParent;

                        return (
                          <Fragment key={child.label}>
                            <li
                              onClick={() =>
                                setOpenSubId(isSubOpen ? null : child.label)
                              }
                              className={`group cursor-pointer flex items-center justify-between px-3 py-2 rounded-md transition
                                ${
                                  isSubActiveParent
                                    ? "text-[#A6A6A6] bg-transparent"
                                    : "text-[#A6A6A6] hover:text-[#26D9D9] hover:bg-[#041616]"
                                }
                              `}
                            >
                              {child.label}

                              <Image
                                src="/back-svgrepo-com.svg"
                                width={12}
                                height={12}
                                alt="arrow"
                                className={`transition ${
                                  isSubOpen ? "rotate-90" : "rotate-180"
                                }`}
                              />
                            </li>

                            <AnimatePresence>
                              {isSubOpen && (
                                <motion.ul
                                  key={child.label}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="ml-4 flex flex-col gap-2 overflow-hidden"
                                >
                                  {child.children.map((subChild) => {
                                    const isSubActive =
                                      pathname === subChild.path;

                                    return (
                                      <li key={subChild.path}>
                                        <Link
                                          href={subChild.path}
                                          className={`block px-3 py-2 rounded-md transition
                                            ${
                                              isSubActive
                                                ? "text-[#26D9D9] bg-[#041616]"
                                                : "text-[#A6A6A6] hover:text-[#26D9D9] hover:bg-[#041616]"
                                            }
                                          `}
                                        >
                                          {subChild.label}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </motion.ul>
                              )}
                            </AnimatePresence>
                          </Fragment>
                        );
                      }

                      const isActive = pathname === child.path;

                      return (
                        <li key={child.path}>
                          <Link
                            href={child.path!}
                            className={`block px-3 py-2 rounded-md transition
                              ${
                                isActive
                                  ? "text-[#26D9D9] bg-[#041616]"
                                  : "text-[#A6A6A6] hover:text-[#26D9D9] hover:bg-[#041616]"
                              }
                            `}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </Fragment>
          );
        })}
      </ul>
    </aside>
  );
}