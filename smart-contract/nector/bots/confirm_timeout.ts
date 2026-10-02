import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scan(program: anchor.Program) {

  console.log("Scanning orders...\n");

  const orders = await program.account.order.all();

  const markShippedOrders =
    orders.filter((o) => o.account.state === 5);

  console.log(
    "MarkShipped Orders:",
    markShippedOrders.length,
    "\n"
  );

  const txPromises: Promise<any>[] = [];

  for (const order of markShippedOrders) {

    const acc = order.account;

    const shippedAt = Number(acc.markShippedAt);

    const deadline =
      shippedAt + 24 * 3600;

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

    console.log("Trigger confirm timeout:", orderPda.toBase58());

    const txPromise = program.methods
      .confirmTimeout(orderIndex)
      .accounts({
        order: orderPda,
        escrow: escrowPda,
        buyer: acc.buyerWallet,
        seller: acc.sellerWallet
      })
      .rpc()
      .then(tx => {
        console.log("Confirm timeout TX:", tx);
      })
      .catch(err => {
        console.log("Confirm timeout failed:", err.message);
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