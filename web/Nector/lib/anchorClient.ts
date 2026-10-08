import * as anchor from "@coral-xyz/anchor"
import {
  Commitment,
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js"
import idl from "@/idl/nector.json"

export const PROGRAM_ID = new PublicKey(
  "WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb"
)

const CLIENT_RPC_URL = "/api/solana-rpc"

/*
 * IMPORTANT
 *
 * We intentionally DO NOT use a WebSocket endpoint here.
 *
 * /api/solana-rpc is HTTP-only. Everything that normally relies on
 * WebSocket subscriptions (connection.confirmTransaction, onSignature, ...)
 * is replaced with HTTP polling of getSignatureStatuses().
 */

type SignableTransaction = Transaction | VersionedTransaction

function isVersionedTransaction(
  tx: SignableTransaction
): tx is VersionedTransaction {
  return tx instanceof VersionedTransaction
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class TransactionExpiredError extends Error {
  signature: string

  constructor(signature: string) {
    super(
      `Transaction was not confirmed before its blockhash expired. ` +
        `It was not executed. Signature: ${signature}`
    )
    this.name = "TransactionExpiredError"
    this.signature = signature
  }
}

export class TransactionTimeoutError extends Error {
  signature: string

  constructor(signature: string, seconds: number) {
    super(
      `Transaction confirmation timed out after ${seconds}s. ` +
        `The transaction may still have succeeded. Signature: ${signature}`
    )
    this.name = "TransactionTimeoutError"
    this.signature = signature
  }
}

/*
 * A transaction that LANDED but failed on-chain. We turn the raw
 * {"InstructionError":[2,{"Custom":6011}]} into the same text Anchor
 * prints for simulation failures, so the rest of the app can detect
 * contract errors (InvalidState, AlreadyFunded, ...) the same way no matter
 * whether the failure was caught in preflight or after landing.
 */
function makeTransactionFailedError(err: any, signature: string): Error {
  let custom: number | null = null

  try {
    const ixErr = err?.InstructionError
    if (Array.isArray(ixErr) && ixErr[1] && typeof ixErr[1] === "object") {
      if (typeof ixErr[1].Custom === "number") custom = ixErr[1].Custom
    }
  } catch {
    // ignore
  }

  if (custom !== null) {
    const known = (idl as any)?.errors?.find((e: any) => e.code === custom)
    if (known) {
      const e: any = new Error(
        `AnchorError: Error Code: ${known.name}. Error Number: ${custom}. ` +
          `Error Message: ${known.msg}. Signature: ${signature}`
      )
      e.code = custom
      e.signature = signature
      return e
    }
  }

  const e: any = new Error(
    `Transaction failed: ${JSON.stringify(err)}. Signature: ${signature}`
  )
  e.signature = signature
  return e
}

function errorText(e: any): string {
  return [e?.message, e?.transactionMessage, typeof e === "string" ? e : ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function isBlockhashNotFound(e: any): boolean {
  return errorText(e).includes("blockhash not found")
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

/*
 * "Blockhash not found" during the preflight simulation almost always means
 * the RPC node that answered sendTransaction hasn't seen the (brand new)
 * blockhash yet — the RPC sits behind a load balancer and the node that
 * served getLatestBlockhash is a bit ahead of the one that simulates.
 *
 * Re-sending the SAME signed transaction a moment later fixes it, and the
 * user doesn't need to approve anything again.
 */
async function sendRawWithRetry(
  connection: Connection,
  raw: Uint8Array,
  options: {
    skipPreflight: boolean
    preflightCommitment: Commitment
    maxRetries: number
  }
): Promise<string> {
  const delays = [500, 800, 1200, 1500, 2000]

  for (let i = 0; ; i++) {
    try {
      return await connection.sendRawTransaction(raw, options)
    } catch (e) {
      if (!isBlockhashNotFound(e)) throw e

      if (i < delays.length) {
        await sleep(delays[i])
        continue
      }

      // The simulating node never caught up. Let the network decide
      // instead: skip the preflight and watch the result on-chain.
      return await connection.sendRawTransaction(raw, {
        ...options,
        skipPreflight: true,
      })
    }
  }
}

function statusSatisfies(
  confirmationStatus: string | null | undefined,
  commitment: Commitment
): boolean {
  if (confirmationStatus === "finalized") return true
  if (commitment === "finalized") return false
  if (confirmationStatus === "confirmed") return true
  return commitment === "processed" && confirmationStatus === "processed"
}

/*
 * Polls getSignatureStatuses() until the transaction reaches `commitment`.
 *
 *  - If we have the raw transaction we keep re-broadcasting it every ~2s.
 *    Without this a transaction that the RPC node silently drops (very
 *    common under load) never lands and we'd just wait for the timeout.
 *  - If we know the blockhash we stop as soon as it expires, so the user
 *    gets a definite answer ("not executed") instead of waiting 60s.
 *
 * Resolves with { err } — err is the on-chain error if it landed and failed.
 */
async function pollUntilConfirmed(
  connection: Connection,
  signature: string,
  commitment: Commitment,
  opts: { raw?: Uint8Array; blockhash?: string; timeoutMs?: number } = {}
): Promise<{ err: any | null }> {
  const timeoutMs = opts.timeoutMs ?? 90_000
  const startedAt = Date.now()
  let lastRebroadcast = startedAt
  let lastValidityCheck = startedAt
  let blockhashExpired = false
  let invalidStreak = 0

  const readStatus = async () => {
    const response = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    })
    return response.value[0]
  }

  while (true) {
    let status: Awaited<ReturnType<typeof readStatus>> = null

    try {
      status = await readStatus()
    } catch (e) {
      // transient RPC hiccup — keep polling
      console.warn("[anchorClient] getSignatureStatuses failed, retrying", e)
    }

    if (status) {
      if (status.err) return { err: status.err }
      if (statusSatisfies(status.confirmationStatus, commitment)) {
        return { err: null }
      }
    }

    const now = Date.now()

    if (blockhashExpired) {
      // Give the network a final moment, then check one last time,
      // including history, before declaring the transaction dead.
      await sleep(2_500)
      try {
        const last = await readStatus()
        if (last) {
          if (last.err) return { err: last.err }
          if (statusSatisfies(last.confirmationStatus, commitment)) {
            return { err: null }
          }
        }
      } catch {
        // fall through
      }
      throw new TransactionExpiredError(signature)
    }

    if (opts.raw && now - lastRebroadcast >= 2_000) {
      lastRebroadcast = now
      connection
        .sendRawTransaction(opts.raw, { skipPreflight: true, maxRetries: 0 })
        .catch(() => {
          // "already processed" and friends are expected here
        })
    }

    // A blockhash lives ~60-90s. Don't even ask before 20s have passed, and
    // require two "invalid" answers in a row: a lagging RPC node can say
    // "invalid" for a blockhash that is brand new.
    if (
      opts.blockhash &&
      now - startedAt >= 20_000 &&
      now - lastValidityCheck >= 4_000
    ) {
      lastValidityCheck = now
      try {
        const res = await connection.isBlockhashValid(opts.blockhash, {
          commitment: "confirmed",
        })
        invalidStreak = res.value === false ? invalidStreak + 1 : 0
        if (invalidStreak >= 2) blockhashExpired = true
      } catch {
        // RPC without isBlockhashValid — rely on the timeout below
      }
    }

    if (now - startedAt > timeoutMs) {
      throw new TransactionTimeoutError(signature, Math.round(timeoutMs / 1000))
    }

    await sleep(1_000)
  }
}

/* ------------------------------------------------------------------ */
/* Program                                                             */
/* ------------------------------------------------------------------ */

export function getProgram(wallet: any) {
  if (typeof window === "undefined") {
    throw new Error(
      "getProgram() must be called from the browser with a connected wallet."
    )
  }

  const rpcUrl = new URL(CLIENT_RPC_URL, window.location.origin).toString()

  /*
   * No wsEndpoint — see the note at the top of this file.
   */
  const connection = new Connection(rpcUrl, {
    commitment: "confirmed",
  })

  /*
   * Safety net: any code (ours or a library's) that calls
   * connection.confirmTransaction() would otherwise open a WebSocket to
   * wss://<host>/api/solana-rpc, fail, and report a transaction that DID
   * land as "not confirmed in 30 seconds". Route it through HTTP polling.
   */
  ;(connection as any).confirmTransaction = async (
    strategy: any,
    commitment?: Commitment
  ) => {
    const signature: string =
      typeof strategy === "string" ? strategy : strategy?.signature

    const { err } = await pollUntilConfirmed(
      connection,
      signature,
      commitment ?? "confirmed",
      {
        blockhash:
          typeof strategy === "object" ? strategy?.blockhash : undefined,
        timeoutMs: 60_000,
      }
    )

    return { context: { slot: 0 }, value: { err } }
  }

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  })

  /*
   * Replaces Anchor's sendAndConfirm so that:
   *
   * 1. the transaction gets a fresh recentBlockhash + feePayer
   * 2. it is signed by the connected wallet (Phantom etc.)
   * 3. it is sent over HTTP — retrying "Blockhash not found" preflight
   *    failures, which are caused by RPC nodes that lag behind
   * 4. it is confirmed by polling getSignatureStatuses(), re-broadcasting
   *    until it lands or its blockhash expires
   */
  provider.sendAndConfirm = async (
    tx: any,
    signers: any[] = [],
    opts: any = {}
  ): Promise<string> => {
    try {
      if (!isVersionedTransaction(tx)) {
        if (!tx.feePayer && provider.wallet.publicKey) {
          tx.feePayer = provider.wallet.publicKey
        }

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash(
            opts?.preflightCommitment ?? "confirmed"
          )

        tx.recentBlockhash = blockhash
        tx.lastValidBlockHeight = lastValidBlockHeight
      }

      if (signers.length > 0) {
        if (isVersionedTransaction(tx)) {
          tx.sign(signers)
        } else {
          tx.partialSign(...signers)
        }
      }

      if (!provider.wallet.signTransaction) {
        throw new Error(
          "Connected wallet does not support signTransaction()."
        )
      }

      const signedTx = await provider.wallet.signTransaction(tx)
      const raw = signedTx.serialize()

      const blockhash: string | undefined = isVersionedTransaction(signedTx)
        ? signedTx.message.recentBlockhash
        : signedTx.recentBlockhash ?? undefined

      const signature = await sendRawWithRetry(connection, raw, {
        skipPreflight: opts?.skipPreflight ?? false,
        preflightCommitment: opts?.preflightCommitment ?? "confirmed",
        maxRetries: opts?.maxRetries ?? 3,
      })

      console.log("[anchorClient] transaction sent:", signature)

      const { err } = await pollUntilConfirmed(
        connection,
        signature,
        opts?.commitment ?? "confirmed",
        { raw, blockhash, timeoutMs: 90_000 }
      )

      if (err) throw makeTransactionFailedError(err, signature)

      console.log("[anchorClient] transaction confirmed:", signature)

      return signature
    } catch (error) {
      console.error("[anchorClient] sendAndConfirm failed:", error)

      throw error
    }
  }

  return new anchor.Program(idl as any, provider) as any
}
