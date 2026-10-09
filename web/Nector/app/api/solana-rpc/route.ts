import { NextRequest, NextResponse } from "next/server"



export const runtime = "nodejs"

export const dynamic = "force-dynamic"



const ALLOWED_METHODS = new Set([

  "getAccountInfo",

  "getBalance",

  "getBlock",

  "getBlockHeight",

  "getBlockProduction",

  "getBlocks",

  "getEpochInfo",

  "getFeeForMessage",

  "getFirstAvailableBlock",

  "getGenesisHash",

  "getIdentity",

  "getInflationGovernor",

  "getLatestBlockhash",

  "getMultipleAccounts",

  "getProgramAccounts",

  "getSignatureStatuses",

  "getSignaturesForAddress",

  "getSlot",

  "getTokenAccountBalance",

  "getTokenAccountsByOwner",

  "getTokenSupply",

  "getTransaction",

  "getTokenLargestAccounts",

  "getVersion",

  "isBlockhashValid",

  "minimumLedgerSlot",

  "sendTransaction",

  "simulateTransaction",



  // Metaplex DAS API (Digital Asset Standard) — needed by Umi's

  // dasApi() plugin to resolve compressed NFTs and to fall back for

  // any asset type not covered by the plain Token Metadata PDA lookup.

  // Only works if SOLANA_RPC_URL points at a DAS-enabled provider

  // (e.g. Helius) — plain api.mainnet-beta.solana.com does not

  // implement these and will just return a JSON-RPC "method not

  // found" error upstream, which is fine, it'll just fail closed.

  "getAsset",

  "getAssetProof",

  "getAssetsByOwner",

  "getAssetsByGroup",

  "getAssetsByAuthority",

  "getAssetsByCreator",

  "searchAssets",

])



export async function POST(req: NextRequest) {

  try {

    const rpcUrl = process.env.SOLANA_RPC_URL



    if (!rpcUrl) {

      console.error("[solana-rpc] SOLANA_RPC_URL is not configured")



      return NextResponse.json(

        {

          jsonrpc: "2.0",

          error: {

            code: -32603,

            message: "Solana RPC is not configured on the server.",

          },

          id: null,

        },

        { status: 500 }

      )

    }



    const body = await req.json()



    if (!body || typeof body !== "object") {

      return NextResponse.json(

        {

          jsonrpc: "2.0",

          error: {

            code: -32600,

            message: "Invalid JSON-RPC request.",

          },

          id: null,

        },

        { status: 400 }

      )

    }



    const method = body.method



    if (typeof method !== "string") {

      return NextResponse.json(

        {

          jsonrpc: "2.0",

          error: {

            code: -32600,

            message: "Missing JSON-RPC method.",

          },

          id: body.id ?? null,

        },

        { status: 400 }

      )

    }



    if (!ALLOWED_METHODS.has(method)) {

      return NextResponse.json(

        {

          jsonrpc: "2.0",

          error: {

            code: -32601,

            message: `RPC method not allowed: ${method}`,

          },

          id: body.id ?? null,

        },

        { status: 403 }

      )

    }



    const upstreamResponse = await fetch(rpcUrl, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

      },

      body: JSON.stringify(body),



      // Don't let Next.js cache blockchain RPC calls.

      cache: "no-store",

    })



    const text = await upstreamResponse.text()



    let data: unknown



    try {

      data = JSON.parse(text)

    } catch {

      data = {

        jsonrpc: "2.0",

        error: {

          code: -32603,

          message: "Invalid response from upstream Solana RPC.",

        },

        id: body.id ?? null,

      }

    }



    return NextResponse.json(data, {

      status: upstreamResponse.status,

    })

  } catch (error) {

    console.error("[solana-rpc]", error)



    return NextResponse.json(

      {

        jsonrpc: "2.0",

        error: {

          code: -32603,

          message: "Solana RPC proxy error.",

        },

        id: null,

      },

      { status: 500 }

    )

  }

}
