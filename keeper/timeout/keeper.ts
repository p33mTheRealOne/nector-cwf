import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(__dirname, "../.env.local"),
});

import * as anchor from "@coral-xyz/anchor";
import idl from "../idl/nector.json";
import { createClient } from "@supabase/supabase-js";

/**
 * ============================================================
 * ENV / SUPABASE
 * ============================================================
 */

if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * ============================================================
 * CONSTANTS
 * ============================================================
 *
 * SellerFunded     = 2
 * MarkShipped      = 5
 * OpenDispute      = 7
 * SellerResponded  = 10
 */

const SELLER_FUNDED_STATE = 2;
const OPEN_DISPUTE_STATE = 7;
const SELLER_RESPONDED_STATE = 10;
const MARK_SHIPPED_STATE = 5;

const CONFIRM_TIMEOUT_SECONDS = 24 * 60 * 60;
const DISCUSSION_TIMEOUT_SECONDS = 24 * 60 * 60;
const RESPOND_TIMEOUT_SECONDS = 24 * 60 * 60;

/**
 * Solana Incinerator address.
 *
 * Native SOL cannot be burned using a protocol-level burn
 * instruction. Sending lamports to this permanently
 * unspendable address is used by the Nector program as the
 * penalty "burn".
 */
const BURN_WALLET = new anchor.web3.PublicKey(
  "1nc1nerator11111111111111111111111111111111"
);

/**
 * ============================================================
 * MAINNET CONFIG
 * ============================================================
 *
 * Uses:
 *
 * SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
 *
 * in:
 *
 * /root/keeper/.env.local
 *
 * Falls back to the public Solana Mainnet RPC if the
 * environment variable is not present.
 */

const RPC_URL = process.env.SOLANA_RPC_URL?.trim();

if (!RPC_URL) {
  throw new Error("Missing SOLANA_RPC_URL in .env.local");
}

try {
  const rpcUrl = new URL(RPC_URL);

  if (!["http:", "https:"].includes(rpcUrl.protocol)) {
    throw new Error("SOLANA_RPC_URL must use http:// or https://");
  }

  if (/devnet|testnet/i.test(rpcUrl.hostname)) {
    throw new Error(
      `Devnet/Testnet RPC is not allowed: ${rpcUrl.hostname}`
    );
  }
} catch (err) {
  throw new Error(
    `Invalid SOLANA_RPC_URL: ${
      err instanceof Error ? err.message : String(err)
    }`
  );
}

/**
 * Mainnet Nector program ID from idl/nector.json
 */
const EXPECTED_PROGRAM_ID =
  "WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb";

const SCAN_INTERVAL_MS = 10_000;

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

type OrderEntry = {
  publicKey: anchor.web3.PublicKey;
  account: any;
};

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSafeRpcLabel(rpcUrl: string): string {
  try {
    const url = new URL(rpcUrl);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "configured RPC";
  }
}

function getEscrowPda(
  program: anchor.Program,
  orderPda: anchor.web3.PublicKey
) {
  const [escrowPda] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        orderPda.toBuffer(),
      ],
      program.programId
    );

  return escrowPda;
}

/**
 * Update Supabase order status and insert the same
 * escrow_update message used by the original bots.
 */
async function updateSupabaseAfterTimeout(
  orderPda: anchor.web3.PublicKey,
  status: string,
  messageAction: string
) {
  const txOrder = orderPda.toBase58();

  const { data, error } = await supabase
    .from("escrow_orders")
    .select("*")
    .eq("escrow_pda", txOrder)
    .single();

  if (error || !data) {
    console.log(
      "Not found on Supabase:",
      txOrder
    );

    return;
  }

  const { error: updateError } = await supabase
    .from("escrow_orders")
    .update({
      status,
    })
    .eq("escrow_pda", txOrder);

  if (updateError) {
    console.log(
      "Supabase update failed:",
      updateError.message
    );

    return;
  }

  console.log(
    `Supabase updated: ${status}`,
    txOrder
  );

  const { error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: data.conversation_id,
      sender_id: data.seller_id,
      receiver_id: data.buyer_id,
      body: `escrow_update:${txOrder}:${messageAction}`,
      message_type: "escrow_update",
    });

  if (msgError) {
    console.log(
      "Message insert failed:",
      msgError.message
    );
  } else {
    console.log("Message inserted");
  }
}

/**
 * ============================================================
 * 1. CONFIRM TIMEOUT
 * ============================================================
 *
 * state === 5
 * markShippedAt + 24 hours
 * confirmTimeout(orderIndex)
 * Supabase -> Completed
 * message -> confirm_timeout
 */

async function confirmTimeout(
  program: anchor.Program,
  orders: OrderEntry[]
) {
  console.log(
    "\n========== CONFIRM TIMEOUT =========="
  );

  const markShippedOrders = orders.filter(
    (o) => o.account.state === MARK_SHIPPED_STATE
  );

  console.log(
    "MarkShipped Orders:",
    markShippedOrders.length
  );

  const txPromises: Promise<any>[] = [];

  for (const order of markShippedOrders) {
    const acc = order.account;

    const shippedAt = Number(
      acc.markShippedAt
    );

    const deadline =
      shippedAt + CONFIRM_TIMEOUT_SECONDS;

    const now = Math.floor(
      Date.now() / 1000
    );

    const expired = now >= deadline;

    const orderPda = order.publicKey;

    console.log(
      "Confirm check:",
      orderPda.toBase58(),
      "| expired:",
      expired
    );

    if (!expired) {
      continue;
    }

    const orderIndex =
      new anchor.BN(acc.orderIndex);

    const escrowPda =
      getEscrowPda(
        program,
        orderPda
      );

    console.log(
      "Trigger confirm timeout:",
      orderPda.toBase58()
    );

    const txPromise = program.methods
      .confirmTimeout(orderIndex)
      .accounts({
        order: orderPda,
        escrow: escrowPda,
        buyer: acc.buyerWallet,
        seller: acc.sellerWallet,
      })
      .rpc()
      .then(async (tx) => {
        console.log(
          "Confirm timeout TX:",
          tx
        );

        await updateSupabaseAfterTimeout(
          orderPda,
          "Completed",
          "confirm_timeout"
        );
      })
      .catch((err) => {
        console.log(
          "Confirm timeout failed:",
          err?.message ?? err
        );
      });

    txPromises.push(txPromise);
  }

  await Promise.allSettled(txPromises);
}

/**
 * ============================================================
 * 2. DISCUSSION TIMEOUT
 * ============================================================
 *
 * state === 10
 * sellerRespondAt + 24 hours
 * draw(orderIndex)
 * burnWallet
 * Supabase -> Cancelled
 * message -> draw
 */

async function discussionTimeout(
  program: anchor.Program,
  orders: OrderEntry[]
) {
  console.log(
    "\n========== DISCUSSION TIMEOUT =========="
  );

  const respondedOrders = orders.filter(
    (o) =>
      o.account.state ===
      SELLER_RESPONDED_STATE
  );

  console.log(
    "SellerResponded Orders:",
    respondedOrders.length
  );

  const txPromises: Promise<any>[] = [];

  for (const order of respondedOrders) {
    const acc = order.account;

    const respondedAt = Number(
      acc.sellerRespondAt
    );

    const deadline =
      respondedAt +
      DISCUSSION_TIMEOUT_SECONDS;

    const now = Math.floor(
      Date.now() / 1000
    );

    const expired = now >= deadline;

    const orderPda = order.publicKey;

    console.log(
      "Discussion check:",
      orderPda.toBase58(),
      "| expired:",
      expired
    );

    if (!expired) {
      continue;
    }

    const orderIndex =
      new anchor.BN(acc.orderIndex);

    const escrowPda =
      getEscrowPda(
        program,
        orderPda
      );

    console.log(
      "Trigger draw:",
      orderPda.toBase58()
    );

    const txPromise = program.methods
      .draw(orderIndex)
      .accounts({
        order: orderPda,
        escrow: escrowPda,
        buyer: acc.buyerWallet,
        seller: acc.sellerWallet,
        burnWallet: BURN_WALLET,
      })
      .rpc()
      .then(async (tx) => {
        console.log(
          "Draw TX:",
          tx
        );

        await updateSupabaseAfterTimeout(
          orderPda,
          "Cancelled",
          "draw"
        );
      })
      .catch((err) => {
        console.log(
          "Draw failed:",
          err?.message ?? err
        );
      });

    txPromises.push(txPromise);
  }

  await Promise.allSettled(txPromises);
}

/**
 * ============================================================
 * 3. RESPOND TIMEOUT
 * ============================================================
 *
 * state === 7
 * openDisputeAt + 24 hours
 * buyerWin(orderIndex)
 * burnWallet
 * Supabase -> Completed
 * message -> respond_timeout
 */

async function respondTimeout(
  program: anchor.Program,
  orders: OrderEntry[]
) {
  console.log(
    "\n========== RESPOND TIMEOUT =========="
  );

  const openDisputeOrders = orders.filter(
    (o) =>
      o.account.state ===
      OPEN_DISPUTE_STATE
  );

  console.log(
    "OpenDispute Orders:",
    openDisputeOrders.length
  );

  const txPromises: Promise<any>[] = [];

  for (const order of openDisputeOrders) {
    const acc = order.account;

    const openDisputeAt = Number(
      acc.openDisputeAt
    );

    const deadline =
      openDisputeAt +
      RESPOND_TIMEOUT_SECONDS;

    const now = Math.floor(
      Date.now() / 1000
    );

    const expired = now >= deadline;

    const orderPda = order.publicKey;

    console.log(
      "Respond check:",
      orderPda.toBase58(),
      "| expired:",
      expired
    );

    if (!expired) {
      continue;
    }

    const orderIndex =
      new anchor.BN(acc.orderIndex);

    const escrowPda =
      getEscrowPda(
        program,
        orderPda
      );

    console.log(
      "Trigger buyer_win:",
      orderPda.toBase58()
    );

    const txPromise = program.methods
      .buyerWin(orderIndex)
      .accounts({
        order: orderPda,
        escrow: escrowPda,
        buyer: acc.buyerWallet,
        seller: acc.sellerWallet,
        burnWallet: BURN_WALLET,
      })
      .rpc()
      .then(async (tx) => {
        console.log(
          "BuyerWin TX:",
          tx
        );

        await updateSupabaseAfterTimeout(
          orderPda,
          "Completed",
          "respond_timeout"
        );
      })
      .catch((err) => {
        console.log(
          "BuyerWin failed:",
          err?.message ?? err
        );
      });

    txPromises.push(txPromise);
  }

  await Promise.allSettled(txPromises);
}

/**
 * ============================================================
 * 4. SHIPPING TIMEOUT
 * ============================================================
 *
 * state === 2
 * sellerFundedAt + shippingHours * 3600
 * shippingTimeout(orderIndex)
 * burnWallet
 * Supabase -> Cancelled
 * message -> shipping_timeout
 */

async function shippingTimeout(
  program: anchor.Program,
  orders: OrderEntry[]
) {
  console.log(
    "\n========== SHIPPING TIMEOUT =========="
  );

  const sellerFundedOrders = orders.filter(
    (o) =>
      o.account.state ===
      SELLER_FUNDED_STATE
  );

  console.log(
    "SellerFunded Orders:",
    sellerFundedOrders.length
  );

  const txPromises: Promise<any>[] = [];

  for (const order of sellerFundedOrders) {
    const acc = order.account;

    const fundedAt = Number(
      acc.sellerFundedAt
    );

    const shippingHours = Number(
      acc.shippingHours
    );

    const deadline =
      fundedAt +
      shippingHours * 3600;

    const now = Math.floor(
      Date.now() / 1000
    );

    const expired = now >= deadline;

    const orderPda = order.publicKey;

    console.log(
      "Shipping check:",
      orderPda.toBase58(),
      "| expired:",
      expired
    );

    if (!expired) {
      continue;
    }

    const orderIndex =
      new anchor.BN(acc.orderIndex);

    const escrowPda =
      getEscrowPda(
        program,
        orderPda
      );

    console.log(
      "Trigger shipping timeout:",
      orderPda.toBase58()
    );

    const txPromise = program.methods
      .shippingTimeout(orderIndex)
      .accounts({
        order: orderPda,
        escrow: escrowPda,
        buyer: acc.buyerWallet,
        seller: acc.sellerWallet,
        burnWallet: BURN_WALLET,
      })
      .rpc()
      .then(async (tx) => {
        console.log(
          "Shipping timeout TX:",
          tx
        );

        await updateSupabaseAfterTimeout(
          orderPda,
          "Cancelled",
          "shipping_timeout"
        );
      })
      .catch((err) => {
        console.log(
          "Shipping timeout failed:",
          err?.message ?? err
        );
      });

    txPromises.push(txPromise);
  }

  await Promise.allSettled(txPromises);
}

/**
 * ============================================================
 * SCAN ALL
 * ============================================================
 *
 * Fetches all Order accounts ONCE every scan.
 *
 * The same order list is then passed to all four
 * timeout handlers.
 */

async function scanAll(
  program: anchor.Program
) {
  console.log(
    "\n========================================"
  );

  console.log(
    "Keeper scan started"
  );

  console.log(
    "Time:",
    new Date().toISOString()
  );

  console.log(
    "========================================"
  );

  const orders =
    (await (program.account as any).order.all()) as OrderEntry[];

  console.log(
    "Total orders:",
    orders.length
  );

  await Promise.allSettled([
    confirmTimeout(
      program,
      orders
    ),

    discussionTimeout(
      program,
      orders
    ),

    respondTimeout(
      program,
      orders
    ),

    shippingTimeout(
      program,
      orders
    ),
  ]);

  console.log(
    "\nKeeper scan finished"
  );
}

/**
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main() {
  /**
   * ==========================================================
   * CONNECTION
   * ==========================================================
   */

  const connection =
    new anchor.web3.Connection(
      RPC_URL,
      "confirmed"
    );

  /**
   * ==========================================================
   * WALLET
   * ==========================================================
   *
   * Uses:
   *
   * ~/.config/solana/bot.json
   *
   * on the RackNerd server.
   */

  const KEYPAIR_PATH = path.resolve(__dirname, "../bot.json");

  if (!fs.existsSync(KEYPAIR_PATH)) {
    throw new Error(`Keeper wallet not found: ${KEYPAIR_PATH}`);
  }

  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"))
  );

  const keypair = anchor.web3.Keypair.fromSecretKey(secretKey);
  const wallet = new anchor.Wallet(keypair);

  /**
   * ==========================================================
   * PROVIDER
   * ==========================================================
   */

  const provider =
    new anchor.AnchorProvider(
      connection,
      wallet,
      {
        commitment: "confirmed",
      }
    );

  anchor.setProvider(provider);

  /**
   * ==========================================================
   * PROGRAM
   * ==========================================================
   */

  const program =
    new anchor.Program(
      idl as anchor.Idl,
      provider
    );

  /**
   * ==========================================================
   * SAFETY CHECKS
   * ==========================================================
   *
   * These checks prevent accidentally running a Mainnet
   * Keeper against the wrong program.
   */

  const actualProgramId =
    program.programId.toBase58();

  if (
    actualProgramId !==
    EXPECTED_PROGRAM_ID
  ) {
    throw new Error(
      [
        "WRONG NECTOR PROGRAM ID!",
        `Expected: ${EXPECTED_PROGRAM_ID}`,
        `Actual:   ${actualProgramId}`,
        "",
        "The IDL does not match the expected Mainnet Nector program.",
      ].join("\n")
    );
  }

  /**
   * Verify the Mainnet RPC can actually see the program.
   */

  const programInfo =
    await connection.getAccountInfo(program.programId);

  if (!programInfo) {
    throw new Error(
      `Program ${program.programId.toBase58()} is not deployed on this network`
    );
  }

  if (!programInfo.executable) {
    throw new Error(
      `Account ${program.programId.toBase58()} exists but is not executable`
    );
  }

  console.log(
    "Program verified:",
    program.programId.toBase58()
  );

  /**
   * ==========================================================
   * STARTUP INFORMATION
   * ==========================================================
   */

  console.log(
    "\n========================================"
  );

  console.log(
    "       NECTOR UNIFIED KEEPER"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Network: MAINNET"
  );

  console.log(
    "Keeper wallet:",
    wallet.publicKey.toBase58()
  );

  console.log(
    "Program ID:",
    program.programId.toBase58()
  );

  console.log(
    "RPC:",
    getSafeRpcLabel(RPC_URL)
  );

  console.log(
    "Scan interval:",
    SCAN_INTERVAL_MS / 1000,
    "seconds"
  );

  console.log(
    "Burn wallet:",
    BURN_WALLET.toBase58()
  );

  console.log(
    "========================================\n"
  );

  /**
   * ==========================================================
   * KEEPER LOOP
   * ==========================================================
   */

  while (true) {
    try {
      await scanAll(program);
    } catch (err) {
      console.error(
        "Keeper scan error:",
        err
      );
    }

    console.log(
      `\nSleeping ${
        SCAN_INTERVAL_MS / 1000
      } seconds...\n`
    );

    await sleep(
      SCAN_INTERVAL_MS
    );
  }
}

/**
 * ============================================================
 * START
 * ============================================================
 */

main().catch((err) => {
  console.error(
    "Fatal keeper error:",
    err
  );

  process.exit(1);
});