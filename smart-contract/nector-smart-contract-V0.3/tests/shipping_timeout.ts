import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

async function main() {

  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const program = new anchor.Program(
    idl as anchor.Idl,
    provider
  );

  const orderIndex = new anchor.BN(process.argv[2]);
  const seller = new anchor.web3.PublicKey(process.argv[3]);

  // ---------------- derive Order PDA ----------------

  const [orderPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("order"),
      seller.toBuffer(),
      orderIndex.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // ---------------- derive Escrow PDA ----------------

  const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      orderPda.toBuffer()
    ],
    program.programId
  );

  // ---------------- fetch order ----------------

  const orderAccount = await program.account.order.fetch(orderPda);

  const buyer = orderAccount.buyerWallet;

  console.log("");
  console.log("-------------");
  console.log("Shipping Timeout Trigger");
  console.log("-------------");
  console.log("Order:", orderPda.toBase58());
  console.log("Buyer:", buyer.toBase58());
  console.log("Seller:", seller.toBase58());

  // ---------------- execute tx ----------------

  const tx = await program.methods
    .shippingTimeout(orderIndex)
    .accounts({
      order: orderPda,
      escrow: escrowPda,
      buyer: buyer,
      seller: seller,
      feeWallet: new anchor.web3.PublicKey(
        "GCcZkwkhGhzqBt6Eoc2nJCZFvgYdFAnh1hWuuARi774Z" // This have to be the same as the one in rust
      ),
    })
    .rpc();

  console.log("");
  console.log("---------------------------");
  console.log("|  Shipping Timeout Done  |");
  console.log("---------------------------");
  console.log("TX:", tx);
  console.log("");
}

main();