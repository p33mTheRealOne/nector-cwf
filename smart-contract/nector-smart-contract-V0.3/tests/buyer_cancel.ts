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

  const buyer = provider.wallet.publicKey;

  // derive Order PDA
  const [orderPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("order"),
      seller.toBuffer(),
      orderIndex.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // derive Escrow PDA
  const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      orderPda.toBuffer()
    ],
    program.programId
  );

  console.log("Cancelling order...");
  console.log("Order Index:", orderIndex.toString());
  console.log("Buyer:", buyer.toBase58());

  const tx = await program.methods
    .buyerCancel(orderIndex)
    .accounts({
      order: orderPda,
      escrow: escrowPda,
      buyer: buyer,
      seller: seller
    })
    .rpc();

  console.log("--------------");
  console.log("Order Cancelled");
  console.log("--------------");
  console.log("TX:", tx);
}

main();