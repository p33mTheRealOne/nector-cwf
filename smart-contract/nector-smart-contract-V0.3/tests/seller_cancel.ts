import * as anchor from "@coral-xyz/anchor"
import { PublicKey, SystemProgram } from "@solana/web3.js"

const connection = new anchor.web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
)

const wallet = anchor.AnchorProvider.env().wallet

const provider = new anchor.AnchorProvider(
  connection,
  wallet,
  { commitment: "confirmed" }
)

anchor.setProvider(provider)

const program = anchor.workspace.Nector
const PROGRAM_ID = program.programId

async function main() {

  const seller = provider.wallet.publicKey

  const buyer =
    new PublicKey(process.argv[3])

  const orderIndex =
    new anchor.BN(process.argv[2])

  const [order] =
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("order"),
        seller.toBuffer(),
        orderIndex.toArrayLike(Buffer,"le",8)
      ],
      PROGRAM_ID
    )

  const [escrow] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), order.toBuffer()],
      PROGRAM_ID
    )

  console.log("order:", order.toBase58())
  console.log("escrow:", escrow.toBase58())

  const tx =
    await program.methods
      .sellerCancel(orderIndex)
      .accounts({
        order,
        escrow,
        buyer,
        seller,
        systemProgram: SystemProgram.programId
      })
      .rpc()

  console.log("TX:", tx)

}

main()