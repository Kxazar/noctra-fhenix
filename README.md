# Noctra: Fhenix Confidential DeFi Demo

This repository started from the official `cofhe-hardhat-starter` and now contains a larger Fhenix showcase focused on a tighter surface:

- confidential private voting
- a ve-style gauge controller inspired by Curve and Aerodrome
- wrapped encrypted NTRA balances for private operator flows
- an on-chain NTRA faucet that dispenses 100 tokens once per 24 hours per wallet
- constant-product swap pools with LP minting
- a Next.js interface with dedicated tabs for faucet, swap, LP, veNTRA, and shadow gauges
- demo mode now and live Fhenix mode later

## What is included

### `PrivateVoting`

A minimal CoFHE voting primitive that keeps tallies hidden until reveal.

### `ConfidentialGaugeController`

A ve-tokenomics module where:

- users lock `NTRA`
- voting power decays linearly with time
- every vote is submitted as encrypted `InEuint8`
- all gauge tallies are updated each vote with `FHE.select(...)`
- epoch weights stay hidden until `revealEpoch`

### `VeilToken`

A hybrid vote token with:

- standard ERC20 balances for locking and public liquidity flows
- encrypted balances for shielded treasury or user balances
- `wrap(...)` and encrypted transfer paths modeled after Fhenix FHERC20 patterns
- integer-style token units (`0` decimals) so wallet and faucet amounts are human-readable in the demo

### `VeilFaucet`

An on-chain faucet for `NTRA` where:

- each wallet can claim `100 NTRA`
- claims are limited to one request every `24 hours`
- cooldown enforcement lives in the contract, not in the frontend

### `VeilLiquidityPool`

A minimal CPMM rail where:

- supported market pairs can be swapped directly
- LP shares are minted on-chain when liquidity is added
- gauge rewards can be pushed to pool recipient addresses at epoch settlement

### `frontend/`

A Next.js app called `Noctra` that includes:

- a top-level `Protocol / About` switch between execution rails and architecture notes
- a compact architecture overview inside the `About` tab
- a dedicated NTRA faucet tab
- a dedicated swap tab
- a dedicated LP tab
- a veNTRA planner and encrypted NTRA wrap flow
- a confidential shadow gauge console
- demo mode by default
- live-ready mode via env vars for RPC, CoFHE endpoints, and deployed contract addresses

## Prerequisites

- Node.js 20+
- `corepack` or `pnpm`

## Setup

### Contracts

```bash
corepack pnpm install
```

### Frontend

```bash
cd frontend
corepack pnpm install
```

## Contract demos

### Private voting

```bash
corepack pnpm demo:voting
corepack pnpm test:voting
```

### Confidential gauges

```bash
corepack pnpm demo:gauges
corepack pnpm test:gauges
```

### NTRA faucet

```bash
corepack pnpm test:faucet
```

### Swap and LP

```bash
corepack pnpm test:pools
```

### Wallet flow verification

Run the full faucet -> lock -> wrap -> hidden vote -> swap -> LP -> epoch settlement flow with a provided private key:

```bash
WALLET_PRIVATE_KEY=... corepack pnpm demo:wallet-check
```

### Full-stack deployment

Deploy the full Noctra stack and print frontend env vars:

```bash
corepack pnpm deploy:veilflow
corepack pnpm eth-sepolia:deploy-veilflow
corepack pnpm arb-sepolia:deploy-veilflow
```

The current live Sepolia deployment manifest is stored in:

```bash
deployments/noctra-eth-sepolia.json
```

You can replay a live wallet verification run against that manifest with:

```bash
PRIVATE_KEY=... node_modules/.bin/hardhat run scripts/verifySepoliaLiveFlow.ts --network eth-sepolia
```

### Full suite

```bash
corepack pnpm test
```

## Frontend usage

### Demo mode

The interface ships in demo mode by default and can be deployed immediately without live contracts:

```bash
cd frontend
corepack pnpm dev
```

### Live mode

Copy `frontend/.env.example` into your local env file and provide:

- RPC URL
- CoFHE endpoint URLs
- deployed contract addresses
- NTRA faucet address
- pool addresses
- market asset token addresses

Then switch:

```bash
NEXT_PUBLIC_APP_MODE=live
```

## Important files

- `contracts/PrivateVoting.sol`
- `contracts/ConfidentialGaugeController.sol`
- `contracts/VeilToken.sol`
- `contracts/VeilFaucet.sol`
- `contracts/MockAssetToken.sol`
- `contracts/VeilLiquidityPool.sol`
- `scripts/privateVotingDemo.ts`
- `scripts/confidentialVeGaugeDemo.ts`
- `scripts/deployVeilFlowStack.ts`
- `scripts/verifyWalletProtocolFlow.ts`
- `test/ConfidentialGaugeController.test.ts`
- `test/VeilFaucet.test.ts`
- `test/VeilLiquidityPool.test.ts`
- `frontend/app/page.tsx`
- `frontend/hooks/useCofhe.ts`

## Current status

- Hardhat suite is green locally
- `frontend` production build is green locally
- the frontend is deployable now in demo mode and becomes interactive in live mode once envs are provided
