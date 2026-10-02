import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

async function main() {

  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = new anchor.Program(
    idl as anchor.Idl,
    provider
  );

  const orderIndex = new anchor.BN(process.argv[2]);
  const seller = new anchor.web3.PublicKey(process.argv[3]);

  // order PDA
  const [orderPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("order"),
      seller.toBuffer(),
      orderIndex.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // escrow PDA
  const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), orderPda.toBuffer()],
    program.programId
  );

  const order = await program.account.order.fetch(orderPda);

  const buyer = order.buyerWallet;

  console.log("");
  console.log("Trigger confirm timeout...");
  console.log("Order:", orderPda.toBase58());

  const tx = await program.methods
    .confirmTimeout(orderIndex)
    .accounts({
      order: orderPda,
      escrow: escrowPda,
      buyer: buyer,
      seller: seller
    })
    .rpc();

  console.log("");
  console.log("--------------------------");
  console.log("| Confirm Timeout Done  |");
  console.log("--------------------------");
  console.log("TX:", tx);
}

main();