import { BN } from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"
import { PROGRAM_ID } from "./anchorClient"

export function getSellerPDA(wallet: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("seller"), wallet.toBuffer()],
    PROGRAM_ID
  )
}

export function getOrderPDA(
  wallet: PublicKey,
  orderIndex: BN
) {
  const buf = orderIndex.toArrayLike(Buffer, "le", 8)

  return PublicKey.findProgramAddressSync(
    [Buffer.from("order"), wallet.toBuffer(), buf],
    PROGRAM_ID
  )
}