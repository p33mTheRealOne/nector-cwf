import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

const FEE_WALLET =
  new anchor.web3.PublicKey(
    "GCcZkwkhGhzqBt6Eoc2nJCZFvgYdFAnh1hWuuARi774Z" // This have to be the same as the one in rust
  );

async function main() {

  const connection =
    new anchor.web3.Connection(
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

  const orderIndex =
    new anchor.BN(process.argv[2]);

  const seller =
    new anchor.web3.PublicKey(
      process.argv[3]
    );

  const [orderPda] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("order"),
        seller.toBuffer(),
        orderIndex.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

  const [escrowPda] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        orderPda.toBuffer()
      ],
      program.programId
    );

  const orderAccount = await program.account.order.fetch(orderPda);
  const buyer = orderAccount.buyerWallet;

  const tx =
    await program.methods
      .buyerWin(orderIndex)
      .accounts({
        order: orderPda,
        escrow: escrowPda,
        buyer: buyer,
        seller: seller,
        feeWallet: FEE_WALLET
      })
      .rpc();

  console.log("Buyer won dispute");
  console.log("TX:", tx);
}

main();