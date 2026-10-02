import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

const FEE_WALLET =
  new anchor.web3.PublicKey(
    "GCcZkwkhGhzqBt6Eoc2nJCZFvgYdFAnh1hWuuARi774Z" // This have to be the same as the one in rust
  );

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scan(program: anchor.Program) {
  console.log("Scanning orders...\n");

  const orders = await program.account.order.all();

  const openDisputeOrders =
    orders.filter((o) => o.account.state === 7);

  console.log(
    "OpenDispute Orders:",
    openDisputeOrders.length,
    "\n"
  );

  const txPromises: Promise<any>[] = [];

  for (const order of openDisputeOrders) {
    const acc = order.account;

    const openDisputeAt =
      Number(acc.openDisputeAt);

    const deadline =
      openDisputeAt + 24 * 3600;

    const now =
      Math.floor(Date.now() / 1000);

    const expired =
      now >= deadline;

    console.log("Order:", order.publicKey.toBase58());
    console.log("Order Index:", acc.orderIndex.toString());
    console.log("Expired:", expired);

    if (!expired) continue;

    const orderIndex =
      new anchor.BN(acc.orderIndex);

    const orderPda =
      order.publicKey;

    const [escrowPda] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          orderPda.toBuffer()
        ],
        program.programId
      );

    console.log("Trigger buyer_win:", orderPda.toBase58());

    const txPromise = program.methods
      .buyerWin(orderIndex)
      .accounts({
        order: orderPda,
        escrow: escrowPda,
        buyer: acc.buyerWallet,
        seller: acc.sellerWallet,
        feeWallet: FEE_WALLET
      })
      .rpc()
      .then(tx => {
        console.log("BuyerWin TX:", tx);
      })
      .catch(err => {
        console.log("BuyerWin failed:", err.message);
      });

    txPromises.push(txPromise);
  }

  await Promise.allSettled(txPromises);
}

async function main() {
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const wallet = anchor.Wallet.local();

  const provider =
    new anchor.AnchorProvider(
      connection,
      wallet,
      {}
    );

  anchor.setProvider(provider);

  const program =
    new anchor.Program(
      idl as anchor.Idl,
      provider
    );

  console.log("Keeper bot started...\n");

  while (true) {
    try {
      await scan(program);
    } catch (err) {
      console.log("Keeper error:", err);
    }

    console.log("Sleeping 10 seconds...\n");

    await sleep(10000);
  }
}

main();