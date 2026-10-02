import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

// Verified against the mpl-core crate's own generated::programs::MPL_CORE_ID.
const MPL_CORE_PROGRAM_ID = new anchor.web3.PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

// Same platform fee wallet hardcoded in the on-chain buy_core_nft handler.
const FEE_WALLET = new anchor.web3.PublicKey(
  "5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR"
);

// Usage:
//   npx ts-node -T tests/buy_core_nft.ts <SELLER_ADDRESS> <ASSET_ADDRESS> [COLLECTION_ADDRESS]
//
// COLLECTION_ADDRESS must match whatever was passed to list_core_nft.ts for
// this asset (omit if the asset has no collection).

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
  const seller = new anchor.web3.PublicKey(args[0]);
  const asset = new anchor.web3.PublicKey(args[1]);
  const collection = args[2] ? new anchor.web3.PublicKey(args[2]) : null;

  if (!seller || !asset) {
    throw new Error("Usage: buy_core_nft.ts <SELLER_ADDRESS> <ASSET_ADDRESS> [COLLECTION_ADDRESS]");
  }

  const buyer = provider.wallet.publicKey;

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

  const listingAccountClient = program.account.nftListing as any;
  const listing = await listingAccountClient.fetch(listingPda);
  const priceLamports = listing.priceLamports as anchor.BN;
  const priceSol = priceLamports.toNumber() / anchor.web3.LAMPORTS_PER_SOL;

  console.log("Listing PDA:", listingPda.toBase58());
  console.log("Price:", priceSol, "SOL");

  const collectionOrProgram = collection ?? MPL_CORE_PROGRAM_ID;

  const tx = await program.methods
    .buyCoreNft()
    .accounts({
      listing: listingPda,
      asset,
      collectionOrProgram,
      buyer,
      seller,
      feeWallet: FEE_WALLET,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("");
  console.log("----------------------");
  console.log("| Core NFT purchased!|");
  console.log("----------------------");
  console.log("Asset:", asset.toBase58());
  console.log("Seller:", seller.toBase58());
  console.log("Paid:", priceSol, "SOL");
  console.log("----------------------");
  console.log("TX:", tx);
  console.log("");
}

main();
