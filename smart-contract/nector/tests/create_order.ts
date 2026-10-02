import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

const LAMPORTS_PER_SOL = 1_000_000_000;

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

  const PROGRAM_ID = new anchor.web3.PublicKey(
    "9buv2Wao6udvrauoot3JuGGJ8cB3ULfX2r1BzVNw1h64"
  );

  const program = new anchor.Program(idl as any, provider);

  const args = process.argv.slice(2);
  const modeArg = args[0];
  const productTypeArg = args[1];
  const orderName = args[2];
  const buyerWallet = new anchor.web3.PublicKey(args[3]);
  const priceSol = parseFloat(args[4]);
  const shippingHours = parseInt(args[5]);
  const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

  const priceLamports = new anchor.BN(
    Math.round(priceSol * LAMPORTS_PER_SOL)
  );

  // ---------- Seller PDA ----------
  const [sellerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("seller"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const sellerAccountClient = program.account.sellerAccount as any;

  // ---------- init seller ----------
  try {
    await sellerAccountClient.fetch(sellerPda);
    console.log("Seller already initialized");
  } catch {
    console.log("Initializing seller...");
    await program.methods
      .initSeller()
      .accounts({
        sellerAccount: sellerPda,
        seller: provider.wallet.publicKey,
      })
      .rpc();
  }

  // ---------- get counter ----------
  const sellerAccount = await sellerAccountClient.fetch(sellerPda);
  const orderIndex = sellerAccount.orderCount as anchor.BN;

  console.log("Order index:", orderIndex.toString());

  // ---------- Order PDA ----------
  const orderIndexBuffer = orderIndex.toArrayLike(Buffer, "le", 8);

  const [orderPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("order"),
      provider.wallet.publicKey.toBuffer(),
      orderIndexBuffer,
    ],
    program.programId
  );

  // ---------- enums ----------
  const mode = modeArg === "BTR" ? 0 : 1;
  const productType = productTypeArg === "physical" ? 0 : 1;
  if (productType === 1 && mode !== 0) {
    throw new Error("Digital product must use BTR mode");
  }
  
  if (productType === 1) {
    if (shippingHours <= 0 || shippingHours > 48) {
      throw new Error("Digital shipping must be between 1-48 hours");
    }
  }

  if (productType === 0) {
    if (shippingHours <= 0 || shippingHours > 720) {
      throw new Error("Physical shipping must be between 1-720 hours");
    }
  }

  if (shippingHours > 720) {
    throw new Error("Shipping too long");
  }
  // ---------- create order ----------
  const tx = await program.methods
    .createOrder(
      orderIndex,
      mode,
      productType,
      orderName,
      buyerWallet,
      priceLamports,
      shippingHours
    )
    .accounts({
      sellerAccount: sellerPda,
      order: orderPda,
      seller: provider.wallet.publicKey,
    })
    .rpc();
  console.log("");
  console.log("Name:", orderName);
  console.log("----------------------");
  console.log("|   Order created!   |");
  console.log("----------------------");
  console.log("Price:", priceSol ,"SOL");
  console.log("Type:", productType ,);
  console.log("Mode:", mode ,);
  console.log("Shipping:", shippingHours ,"hrs");
  console.log("----------------------");
  console.log("TX:", tx);
  console.log("Order PDA:", orderPda.toBase58());
  console.log("");
}

main();