import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

// Verified against the mpl-core crate's own generated::programs::MPL_CORE_ID.
const MPL_CORE_PROGRAM_ID = new anchor.web3.PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

// Usage:
//   npx ts-node -T tests/cancel_core_nft.ts <ASSET_ADDRESS> [COLLECTION_ADDRESS]

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

  const program = new anchor.Program(idl as any, provider);

  const args = process.argv.slice(2);
  const asset = new anchor.web3.PublicKey(args[0]);
  const collection = args[1] ? new anchor.web3.PublicKey(args[1]) : null;

  if (!asset) {
    throw new Error("Usage: cancel_core_nft.ts <ASSET_ADDRESS> [COLLECTION_ADDRESS]");
  }

  const seller = provider.wallet.publicKey;

  // ---------- active listing PDA ----------
  const listings = await (program.account.nftListing as any).all([
    { memcmp: { offset: 8, bytes: seller.toBase58() } },
    { memcmp: { offset: 40, bytes: asset.toBase58() } },
  ]);

  const activeListing = listings.find((x: any) => Number(x.account.state) === 0);
  if (!activeListing) {
    throw new Error("Active NFT listing not found");
  }

  const listingNonce = activeListing.account.nonce as anchor.BN;
  const [listingPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("nft_listing"),
      seller.toBuffer(),
      asset.toBuffer(),
      listingNonce.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  console.log("Listing PDA:", listingPda.toBase58());

  const collectionOrProgram = collection ?? MPL_CORE_PROGRAM_ID;

  const tx = await program.methods
    .cancelCoreNft()
    .accounts({
      listing: listingPda,
      asset,
      collectionOrProgram,
      seller,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("");
  console.log("----------------------");
  console.log("| Core listing cancelled! |");
  console.log("----------------------");
  console.log("Asset:", asset.toBase58());
  console.log("----------------------");
  console.log("TX:", tx);
  console.log("");
}

main();
