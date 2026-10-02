# Nector Smart Contract V0.3

## Overview

Nector Smart Contract V0.3 is the latest version of Nector's deterministic, non-custodial escrow protocol built on Solana.

V0.3 introduces NFT trading with escrow protection, allowing users to buy and sell NFTs through Nector without the usual buyer or seller bond.

## What's New?

### NFT Trading With Escrow Protection

Nector V0.3 adds support for NFT trading with escrow protection.

Buyers can fund an NFT purchase through the escrow contract while the seller is required to fulfill the trade according to the predefined deal conditions.

### No Buyer/Seller Bond for NFT Trades

Unlike physical product escrow, NFT trades do not require the usual buyer or seller bond.

This makes NFT transactions simpler while still keeping the funds protected by the escrow smart contract.

### Simple NFT Trading Flow

Nector is designed to make NFT trading as simple as possible.

The buyer and seller can create a deal, lock the required funds in escrow, and complete the transaction through predefined smart contract rules without relying on a traditional middleman.

## Prerequisites

Install Rust, the Solana CLI, and Anchor Framework on Windows (WSL), Linux, or Mac.

https://www.anchor-lang.com/docs/installation

```bash
# Verify that the installation was successful, check the Rust version:
rustc --version

# Verify that the installation was successful, check the Solana CLI version:
solana --version

# Verify that the installation was successful, check the Anchor CLI version:
anchor --version

# See your current config:
solana config get

# Set to devnet:
solana config set --url devnet

# Create new wallet:
solana-keygen new

# Request an airdrop of devnet SOL:
solana airdrop 5

# Check your wallet's SOL balance:
solana balance # If it shows 5, you're good to go!
```

Prepare the project
```bash
# Clone repo:
git clone https://github.com/p33mTheRealOne/nector-smart-contract-V0.3

# Install node modules
yarn
```

## Start

### Build Program

```bash
# Build the program
# This will generate new keypair for the program if doesn't exist
anchor build

# Sync all keys:
anchor keys sync

# If the program_id in lib.rs changed. Build the program again:
anchor build
```

### Deploy program

```bash
# Set to devnet:
solana config set --url devnet

# Make sure you have some SOL in your wallet beacuse this will cost you some SOL
solana balance

# Deploy program to devnet 
solana program deploy target/deploy/nector_smart_contract_V0_3.so
```

### Test

https://github.com/p33mTheRealOne/nector-smart-contract-V0.3/tree/main/tests/how_to_use

# Learn more:
https://nector.chat/docs
