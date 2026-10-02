import * as anchor from "@coral-xyz/anchor";
import idl from "../target/idl/nector.json";

// Metaplex Core program id (verified against the mpl-core crate's own
// generated::programs::MPL_CORE_ID, not from memory).
const MPL_CORE_PROGRAM_ID = new anchor.web3.PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

// Usage:
//   npx ts-node -T tests/list_core_nft.ts <ASSET_ADDRESS> <PRICE_SOL> [COLLECTION_ADDRESS]
//
// COLLECTION_ADDRESS is only needed if the asset belongs to a Metaplex Core
// collection (check the asset's updateAuthority — if it's type "Collection",
// pass that collection's address here). Omit it if the asset has no
// collection (updateAuthority type "Address" or "None").
//
// Example (no collection):
//   npx ts-node -T tests/list_core_nft.ts D9hjZeBRUGjGp2DyKgdzzpShncsqE2GX5bvfkAQ68dc9 1.5

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
  const priceSol = parseFloat(args[1]);
  const collection = args[2] ? new anchor.web3.PublicKey(args[2]) : null;

  if (!asset || Number.isNaN(priceSol)) {
    throw new Error(
      "Usage: list_core_nft.ts <ASSET_ADDRESS> <PRICE_SOL> [COLLECTION_ADDRESS]"
    );
  }

  // Sanity check up front — same check the on-chain handler does — so we
  // fail fast with a clear message instead of a raw AnchorError.
  const assetInfo = await connection.getAccountInfo(asset);
  if (!assetInfo || !assetInfo.owner.equals(MPL_CORE_PROGRAM_ID)) {
    throw new Error(
      `${asset.toBase58()} isn't owned by the Metaplex Core program (owner: ${assetInfo?.owner.toBase58() ?? "account not found"}). ` +
      `Use list_nft.ts instead for classic SPL/Token-2022 NFTs.`
    );
  }

  const priceLamports = new anchor.BN(
    Math.round(priceSol * anchor.web3.LAMPORTS_PER_SOL)
  );

  const seller = provider.wallet.publicKey;

  // ---------- listing nonce + PDA (same seeds/state as list_nft.ts, keyed
  // on the Core asset's own address instead of an SPL mint) ----------
  const [listingCounterPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("nft_listing_counter"), seller.toBuffer(), asset.toBuffer()],
    program.programId
  );

  const listingCounterAccount = await (program.account as any).nftListingCounter.fetchNullable(listingCounterPda);
  const listingNonce = listingCounterAccount ? (listingCounterAccount.nextNonce as anchor.BN) : new anchor.BN(0);

  const [listingPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("nft_listing"),
      seller.toBuffer(),
      asset.toBuffer(),
      listingNonce.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // "no collection" sentinel expected by the on-chain instruction: pass
  // the mpl-core program id itself when there's no collection.
  const collectionOrProgram = collection ?? MPL_CORE_PROGRAM_ID;

  console.log("Listing PDA:", listingPda.toBase58());
  console.log("Collection:", collection ? collection.toBase58() : "(none)");

  const tx = await program.methods
    .listCoreNft(priceLamports)
    .accounts({
      listingCounter: listingCounterPda,
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
  console.log("| Core NFT listed!   |");
  console.log("----------------------");
  console.log("Asset:", asset.toBase58());
  console.log("Price:", priceSol, "SOL");
  console.log("----------------------");
  console.log("TX:", tx);
  console.log("Listing PDA:", listingPda.toBase58());
  console.log("");
}

main();
