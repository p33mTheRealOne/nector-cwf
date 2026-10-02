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
  const seller = provider.wallet.publicKey;

  // derive order PDA
  const [orderPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("order"),
      seller.toBuffer(),
      orderIndex.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  console.log("");
  console.log("Marking order as shipped...");
  console.log("Order:", orderPda.toBase58());

  const tx = await program.methods
    .markShipped(orderIndex)
    .accounts({
      order: orderPda,
      seller: seller,
    })
    .rpc();

  console.log("");
  console.log("--------------------");
  console.log("|   Mark Shipped   |");
  console.log("--------------------");
  console.log("TX:", tx);
  console.log("");
}

main();