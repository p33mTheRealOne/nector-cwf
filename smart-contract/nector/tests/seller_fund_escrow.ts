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
    [Buffer.from("escrow"), orderPda.toBuffer()],
    program.programId
  );

  const tx = await program.methods
    .sellerFundEscrow(orderIndex)
    .accounts({
      order: orderPda,
      escrow: escrowPda,
      seller: provider.wallet.publicKey,
      feeWallet: new anchor.web3.PublicKey(
        "GCcZkwkhGhzqBt6Eoc2nJCZFvgYdFAnh1hWuuARi774Z" // This have to be the same as the one in rust
      ),
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .rpc();

  const orderAccount = await program.account.order.fetch(orderPda);

  const fundedAt = orderAccount.sellerFundedAt.toNumber();
  const shippingHours = orderAccount.shippingHours;
  const deadline = fundedAt + shippingHours * 3600;

  const priceLamports = orderAccount.priceLamports.toNumber();
  const bondLamports = orderAccount.bondLamports.toNumber();
  const feeLamports = orderAccount.feeLamports.toNumber();
  const totalLamports = orderAccount.totalLamports.toNumber();

  const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

  const price = priceLamports / LAMPORTS_PER_SOL;
  const bond = bondLamports / LAMPORTS_PER_SOL;
  const fee = price * 0.01;
  const total = bond + fee;

  console.log("");
  console.log("Seller funded at:", fundedAt);
  console.log("UTC:", new Date(fundedAt * 1000).toUTCString());
  console.log("Shipping window:", shippingHours, "hours");

  console.log("Shipping deadline:", deadline);
  console.log("Deadline UTC:", new Date(deadline * 1000).toUTCString());
  console.log("-------------------------");
  console.log("| Seller escrow funded! |");
  console.log("-------------------------");
  console.log("Bond:", bond ,"SOL");
  console.log("Fee:", fee ,"SOL");
  console.log("Total:", total ,"SOL");
  console.log("-------------------------");
  console.log("TX:", tx);
  console.log("Escrow PDA:", escrowPda.toBase58());
  console.log("");
}

main();