import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import idl from "../target/idl/nector.json";

// Same platform fee wallet hardcoded in the on-chain buy_nft handler.
const FEE_WALLET = new anchor.web3.PublicKey(
  "GCcZkwkhGhzqBt6Eoc2nJCZFvgYdFAnh1hWuuARi774Z"
);

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
//   npx ts-node -T tests/buy_nft.ts <SELLER_ADDRESS> <MINT_ADDRESS>
//
// Example:
//   npx ts-node -T tests/buy_nft.ts BbzdZAvBuNDcagzuUrzbwTiaaRkChAu5x8XMUkYbHYDt 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

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
  const mint = new anchor.web3.PublicKey(args[1]);

  if (!seller || !mint) {
    throw new Error("Usage: buy_nft.ts <SELLER_ADDRESS> <MINT_ADDRESS>");
  }

  const buyer = provider.wallet.publicKey;

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

  // ---------- read the listing so we can show the price before paying ----------
  const listingAccountClient = program.account.nftListing as any;
  const listing = await listingAccountClient.fetch(listingPda);
  const priceLamports = listing.priceLamports as anchor.BN;
  const priceSol = priceLamports.toNumber() / anchor.web3.LAMPORTS_PER_SOL;

  console.log("Listing PDA:", listingPda.toBase58());
  console.log("Price:", priceSol, "SOL");

  // ---------- vault ATA (authority = listing PDA) and buyer's destination ATA ----------
  const vaultNftAta = getAssociatedTokenAddressSync(mint, listingPda, true, tokenProgramId);
  const buyerNftAta = getAssociatedTokenAddressSync(mint, buyer, false, tokenProgramId);

  const tx = await program.methods
    .buyNft()
    .accounts({
      listing: listingPda,
      mint,
      vaultNftAta,
      buyerNftAta,
      buyer,
      seller,
      feeWallet: FEE_WALLET,
      tokenProgram: tokenProgramId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("");
  console.log("----------------------");
  console.log("|   NFT purchased!   |");
  console.log("----------------------");
  console.log("Mint:", mint.toBase58());
  console.log("Seller:", seller.toBase58());
  console.log("Paid:", priceSol, "SOL");
  console.log("----------------------");
  console.log("TX:", tx);
  console.log("");
}

main();