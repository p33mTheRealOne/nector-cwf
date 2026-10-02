import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import idl from "../target/idl/nector.json";

// The on-chain program now accepts NFTs minted under either the classic
// SPL Token program or Token-2022 (see list_nft.rs / buy_nft.rs /
// cancel_nft_listing.rs — they use anchor_spl::token_interface). Which
// one applies depends on the mint itself, so resolve it from the chain
// instead of assuming TOKEN_PROGRAM_ID. This must match whichever
// program actually owns the mint account, or every downstream ATA
// derivation (and the tx itself) will be wrong.
async function resolveTokenProgram(
  connection: anchor.web3.Connection,
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) {
    throw new Error(`Mint account not found: ${mint.toBase58()}`);
  }

  const owner = info.owner;
  const ownerStr = owner.toBase58();

  if (ownerStr !== TOKEN_PROGRAM_ID.toBase58() && ownerStr !== TOKEN_2022_PROGRAM_ID.toBase58()) {
    throw new Error(
      `Mint ${mint.toBase58()} isn't owned by the SPL Token or Token-2022 program (owner: ${ownerStr}). ` +
      `Metaplex Core assets and compressed NFTs aren't supported by list_nft/buy_nft/cancel_nft_listing.`
    );
  }

  return owner;
}

// Usage:
//   npx ts-node -T tests/cancel_nft_listing.ts <MINT_ADDRESS>
//
// Example:
//   npx ts-node -T tests/cancel_nft_listing.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

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
  const mint = new anchor.web3.PublicKey(args[0]);

  if (!mint) {
    throw new Error("Usage: cancel_nft_listing.ts <MINT_ADDRESS>");
  }

  const seller = provider.wallet.publicKey;

  // Resolve which token program this mint actually belongs to.
  const tokenProgramId = await resolveTokenProgram(connection, mint);

  // ---------- active listing PDA ----------
  const listings = await (program.account.nftListing as any).all([
    { memcmp: { offset: 8, bytes: seller.toBase58() } },
    { memcmp: { offset: 40, bytes: mint.toBase58() } },
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
      mint.toBuffer(),
      listingNonce.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // ---------- vault ATA (authority = listing PDA) and seller's return ATA ----------
  const vaultNftAta = getAssociatedTokenAddressSync(mint, listingPda, true, tokenProgramId);
  const sellerNftAta = getAssociatedTokenAddressSync(mint, seller, false, tokenProgramId);

  console.log("Listing PDA:", listingPda.toBase58());
  console.log("Token program:", tokenProgramId.toBase58());

  const tx = await program.methods
    .cancelNftListing()
    .accounts({
      listing: listingPda,
      mint,
      vaultNftAta,
      sellerNftAta,
      seller,
      tokenProgram: tokenProgramId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("");
  console.log("----------------------");
  console.log("| Listing cancelled! |");
  console.log("----------------------");
  console.log("Mint:", mint.toBase58());
  console.log("----------------------");
  console.log("TX:", tx);
  console.log("");
}

main();