# Noctra

Noctra is a Fhenix-native DeFi demo that combines:

- `veNTRA` time-decaying governance
- encrypted shadow gauge voting
- live swap and LP rails
- a public `NTRA` faucet
- wrapped confidential balances powered by Fhenix CoFHE

Live site:

- [noctra-fhenix.vercel.app](https://noctra-fhenix.vercel.app)

Repository:

- [Kxazar/noctra-fhenix](https://github.com/Kxazar/noctra-fhenix)

As of March 29, 2026, the public deployment is live on `Ethereum Sepolia` and the core user flow has been verified on-chain from a real wallet:

- faucet claim
- ve lock
- lock increase
- lock extension
- NTRA wrap
- encrypted gauge vote
- swap
- add liquidity

## Why This Exists

Most FHE demos stop at a private counter or a hidden vote. Noctra pushes Fhenix closer to a real DeFi coordination surface:

- liquidity is visible
- gauges are visible
- emissions are visible
- but voter intent stays private until the epoch reveal

That makes it a useful showcase for the part of DeFi where information asymmetry matters most: emission routing, position signaling, and hidden preference discovery.

## What We Built

### Protocol Surface

The public app is split into two top-level views:

- `Protocol`
- `About`

Inside `Protocol`, the live interface is organized into:

- `Faucet`
- `Swap`
- `LP`
- `veNTRA`
- `Shadow Gauges`

### Core Contracts

#### `ConfidentialGaugeController`

This is the heart of the protocol.

- Users lock `NTRA`
- Voting power decays linearly over time
- Votes are submitted as encrypted `InEuint8`
- Gauge tallies update through encrypted branching
- The winning distribution remains hidden until reveal

#### `VeilToken`

This is the governance asset behind Noctra.

- Public ERC-20 balances support locking, swapping, and LP flows
- Encrypted balances support shielded holdings
- `wrap(...)` moves public balances into confidential storage

#### `VeilFaucet`

This bootstraps wallets with governance inventory.

- `100 NTRA` per claim
- `1` request every `24 hours`
- Enforced on-chain, not only in the UI

#### `VeilLiquidityPool`

This is the simplified AMM layer used for the live demo.

- constant-product swaps
- LP minting
- on-chain reserves
- gauge rewards can be routed into pool recipients at epoch settlement

#### `PrivateVoting`

The original minimal voting primitive is still included as a smaller CoFHE example.

#### Experimental Stable Rail

The repository still contains an experimental confidential stable module:

- `ConfidentialStableController`
- `VeilStablecoin`

It is intentionally not the focus of the current public UI, which is centered on `NTRA`, `veNTRA`, swaps, LP, and shadow gauges.

## Fhenix Functionality Used

Noctra is not only “inspired by” Fhenix. It actively uses the stack in several places.

### FHE Library

The contracts use the Fhenix FHE library primitives directly, including:

- `FHE.asEuint8(...)`
- `FHE.asEuint128(...)`
- `FHE.eq(...)`
- `FHE.select(...)`
- `FHE.add(...)`
- `FHE.sub(...)`
- `FHE.decrypt(...)`
- `FHE.getDecryptResultSafe(...)`
- `FHE.allowThis(...)`
- `FHE.allow(...)`
- `FHE.allowSender(...)`
- `FHE.allowGlobal(...)`

These functions are what make hidden vote routing work inside `ConfidentialGaugeController`.

### CoFHE SDK

The frontend and verification scripts use the Fhenix SDK flow:

- `cofhejs.initializeWithViem(...)`
- `cofhejs.initializeWithEthers(...)`
- `cofhejs.createPermit(...)`
- `cofhejs.encrypt(...)`
- `cofhejs.decrypt(...)`
- `cofhejs.unseal(...)`
- `Encryptable.uint8(...)`
- `Encryptable.uint128(...)`

This is how wallets create encrypted inputs for votes and decrypt outputs they are permitted to see.

### Permit-Based Reveal Model

The UI uses the Fhenix permission model instead of pretending private values are globally readable.

- voters can submit encrypted intent
- contracts can selectively allow visibility
- holders can decrypt values through permits
- epoch aggregates can be revealed later without exposing voter choice during the epoch

## Architecture Summary

Noctra follows one compact loop:

1. claim `NTRA`
2. lock into `veNTRA`
3. optionally wrap into a confidential balance
4. route weekly emissions through encrypted shadow gauge voting
5. swap into pools or provide LP
6. settle emissions after the epoch reveal

The key design point is simple:

- pool state is public
- emissions are public
- but vote direction is private until reveal

## Live Deployment

Current chain:

- `Ethereum Sepolia`

Deployment manifest:

- [deployments/noctra-eth-sepolia.json](./deployments/noctra-eth-sepolia.json)

Live contract addresses:

- `NTRA`: `0x4709e09bEADDA02461cDAa4A9Dd8274F410B2e4d`
- `Faucet`: `0x4C8BaF36691894a1997D77Dfa021d63129448BC0`
- `Gauge Controller`: `0x7B67fBbB1549f3b2CcEa0bE8E44c8cDEEEa689c3`
- `ETH / fhUSDC`: `0xd832249432F04166017c2A9FDbD55B6839ed781b`
- `wBTC / fhETH`: `0x8478f07C5Fc86329a66b612ffbb7b73C5b1bAcEB`
- `sDAI / fhUSDC`: `0x6eDD2363fD5a4822b269E21B88D5AAF3d8ff1D87`

## On-Chain Verification

The live verification script is:

- `scripts/verifySepoliaLiveFlow.ts`

It currently checks:

- faucet claims
- lock flow
- wrap flow
- encrypted vote submission
- swap execution
- LP deposit flow

Run it with:

```bash
PRIVATE_KEY=... node_modules/.bin/hardhat run scripts/verifySepoliaLiveFlow.ts --network eth-sepolia
```

There is also a mock-environment end-to-end verification flow:

```bash
WALLET_PRIVATE_KEY=... corepack pnpm demo:wallet-check
```

## Local Development

### Install

```bash
corepack pnpm install
cd frontend
corepack pnpm install
```

### Compile

```bash
corepack pnpm compile
```

### Tests

```bash
corepack pnpm test
corepack pnpm test:gauges
corepack pnpm test:faucet
corepack pnpm test:pools
```

### Frontend

```bash
cd frontend
corepack pnpm dev
```

## Deployment Commands

Recommended commands:

```bash
corepack pnpm deploy:noctra
corepack pnpm eth-sepolia:deploy-noctra
corepack pnpm arb-sepolia:deploy-noctra
```

Legacy `veilflow` deploy aliases are still kept in `package.json` for compatibility.

## Important Files

- `contracts/ConfidentialGaugeController.sol`
- `contracts/VeilToken.sol`
- `contracts/VeilFaucet.sol`
- `contracts/VeilLiquidityPool.sol`
- `contracts/PrivateVoting.sol`
- `scripts/deployVeilFlowStack.ts`
- `scripts/verifySepoliaLiveFlow.ts`
- `frontend/components/LandingShell.tsx`
- `frontend/components/GaugeBoard.tsx`
- `frontend/components/LockPlanner.tsx`
- `frontend/hooks/useCofhe.ts`

## Current Status

- live frontend deployed
- live Sepolia contracts deployed
- core wallet flow verified on-chain
- shadow gauge vote flow confirmed to stay private before reveal
- public UI focused on `NTRA`, `veNTRA`, swap, LP, and shadow gauges
