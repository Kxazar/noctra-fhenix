# Noctra

Noctra is a live Fhenix CoFHE DeFi demo that pushes encrypted state beyond toy voting examples and into a ve-style liquidity coordination flow.

Live app:

- [noctra-fhenix.vercel.app](https://noctra-fhenix.vercel.app)

Repository:

- [Kxazar/noctra-fhenix](https://github.com/Kxazar/noctra-fhenix)

As of March 29, 2026, Noctra is deployed on `Ethereum Sepolia` and the core wallet flow has been exercised on-chain from a real wallet.

## What Noctra Demonstrates

Noctra combines a few ideas in one surface:

- a public `NTRA` faucet for protocol bootstrapping
- `veNTRA` time-decaying governance locks
- encrypted shadow gauge voting
- public swap and LP rails
- live epoch-oriented emissions routing
- optional confidential balance flows powered by Fhenix CoFHE

The main point is simple:

- market structure stays public
- liquidity stays public
- emissions stay public
- voter intent stays hidden until reveal

That makes Noctra a more realistic FHE showcase for DeFi coordination, where hidden preference and emission routing matter more than private counters.

## Why We Built It This Way

Most privacy demos stop at a sealed ballot or a hidden balance. We wanted to show that Fhenix can also support coordination primitives that feel closer to Curve and Aerodrome style tokenomics:

- users claim a governance token
- users lock it into a decaying ve-position
- users direct weekly emissions through encrypted votes
- pools remain fully visible and usable
- the market sees the outcome, but not the intent during the epoch

That is the core Noctra thesis: visible liquidity, hidden governance intent.

## Product Surface

The app is organized into two top-level views:

- `Protocol`
- `About`

The `Protocol` view exposes the live user actions:

- `Faucet`
- `Swap`
- `LP`
- `veNTRA`
- `Shadow Gauges`

The `About` view explains the protocol model and how Fhenix is used under the hood.

## Protocol Loop

Noctra follows one compact cycle:

1. claim `NTRA`
2. lock into `veNTRA`
3. optionally wrap part of the balance into confidential storage
4. submit an encrypted vote for a gauge
5. trade into active markets or provide LP
6. settle emissions after the epoch reveal path becomes available

This lets us demonstrate both sides of the system at once:

- public DeFi state and execution
- encrypted governance intent and selective reveal

## Core Contracts

### `ConfidentialGaugeController`

This is the core coordination contract.

- accepts encrypted votes as `InEuint8`
- tracks ve-style voting power
- updates encrypted gauge tallies
- supports epoch reveal and settlement flows
- routes emissions to pools after the epoch

### `VeilToken`

This is the governance token contract behind `NTRA`.

- standard ERC-20 balances are used for faucet claims, swaps, LP, and locking
- encrypted balances support confidential wrapped holdings
- `wrap(...)` moves public balances into an FHE-protected accounting path

### `VeilFaucet`

This bootstraps governance inventory for testing.

- `100 NTRA` per claim
- one claim every `24 hours`
- enforced on-chain

### `VeilLiquidityPool`

This is the simplified AMM layer used by the live demo.

- constant-product swaps
- LP minting
- on-chain reserves
- gauge settlement hooks for emission routing

### `PrivateVoting`

The original minimal voting primitive is still included as a smaller reference example.

### Additional Confidential Modules

The repository also keeps extra confidential experiments that are useful as R&D reference material, even though the public UI is intentionally focused on `NTRA`, `veNTRA`, swaps, LP, and shadow gauges.

## How Noctra Uses Fhenix

Noctra is not just visually themed around privacy. The protocol and frontend directly use the Fhenix stack.

### FHE Library Inside Contracts

The contracts use Fhenix FHE primitives directly, including:

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

Those primitives are what let the gauge controller branch on encrypted inputs, aggregate hidden votes, and manage reveal permissions without collapsing everything back into public state.

### Fhenix SDK and Wallet Flow

The frontend and verification scripts use the Fhenix SDK flow, including:

- `cofhejs.initializeWithViem(...)`
- `cofhejs.initializeWithEthers(...)`
- `cofhejs.createPermit(...)`
- `cofhejs.encrypt(...)`
- `cofhejs.decrypt(...)`
- `Encryptable.uint8(...)`
- `Encryptable.uint128(...)`

In practice that means:

- the wallet encrypts vote intent before submission
- the app requests permits for values that are allowed to be revealed
- decrypt happens only through the proper permission path

### Confidential UX Model

Noctra deliberately keeps the privacy model understandable:

- pool reserves are public
- LP balances are public
- emission budgets are public
- the chosen gauge remains hidden during the epoch
- only permitted decrypt paths can surface protected values

This is the real reason Fhenix matters here: privacy becomes a coordination tool, not only a storage gimmick.

## Live Deployment

Current live network:

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

The live frontend is configured for Sepolia and the UI now explicitly guards actions so users do not accidentally try to transact on the wrong chain.

## What We Verified On-Chain

The live verification script is:

- `scripts/verifySepoliaLiveFlow.ts`

The verified Sepolia flow covers:

- faucet claim path
- ve lock detection and management flow
- `wrap(...)` submission
- encrypted gauge vote path
- swap execution
- LP provision flow

Run it with:

```bash
PRIVATE_KEY=... node_modules/.bin/hardhat run scripts/verifySepoliaLiveFlow.ts --network eth-sepolia
```

There is also a local mock end-to-end flow:

```bash
WALLET_PRIVATE_KEY=... corepack pnpm demo:wallet-check
```

## Current Status

What is working today:

- live frontend deployment
- live Sepolia contracts
- wallet connect flow in the UI
- Sepolia network enforcement in protocol actions
- encrypted vote submission path
- swaps and LP adds on live deployment
- ve lock flow on live deployment

Known caveat:

- wrapped `NTRA` decrypt on live Sepolia still has an integration edge case in the reveal path
- the `wrap(...)` transaction itself succeeds, but the holder-side decrypt result is not yet consistently becoming ready on the live testnet path

That issue is isolated to the wrapped-balance reveal flow. The rest of the live protocol surface is working and has been exercised.

## Local Development

Install:

```bash
corepack pnpm install
cd frontend
corepack pnpm install
```

Compile:

```bash
corepack pnpm compile
```

Tests:

```bash
corepack pnpm test
corepack pnpm test:gauges
corepack pnpm test:faucet
corepack pnpm test:pools
```

Frontend:

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

Legacy `veilflow` aliases remain in `package.json` only for compatibility with earlier iterations of the project.

## Important Files

- `contracts/ConfidentialGaugeController.sol`
- `contracts/VeilToken.sol`
- `contracts/VeilFaucet.sol`
- `contracts/VeilLiquidityPool.sol`
- `scripts/deployVeilFlowStack.ts`
- `scripts/verifySepoliaLiveFlow.ts`
- `frontend/components/LandingShell.tsx`
- `frontend/components/GaugeBoard.tsx`
- `frontend/components/LockPlanner.tsx`
- `frontend/components/WalletControls.tsx`
- `frontend/hooks/useCofhe.ts`

## Summary

Noctra is a practical Fhenix showcase for encrypted coordination in DeFi.

It demonstrates that with CoFHE and the Fhenix SDK, we can keep liquidity and market structure visible while keeping the most gameable governance signal private until the protocol is ready to reveal it.
