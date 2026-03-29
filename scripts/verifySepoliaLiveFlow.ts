import { readFileSync } from 'fs'
import path from 'path'

import hre from 'hardhat'
import { Wallet } from 'ethers'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

type DeploymentManifest = {
  network: string
  deployer: string
  contracts: {
    voteToken: string
    voteFaucet: string
    gaugeController: string
    stableToken: string
    stableController: string
  }
  assets: Array<{
    id: string
    symbol: string
    token: string
    faucet: string
  }>
  pools: Array<{
    id: number
    name: string
    pool: string
  }>
}

const TESTNET_ENDPOINTS = {
  coFheUrl: 'https://testnet-cofhe.fhenix.zone',
  verifierUrl: 'https://testnet-cofhe-vrf.fhenix.zone',
  thresholdNetworkUrl: 'https://testnet-cofhe-tn.fhenix.zone',
} as const

async function initializeWallet(wallet: Wallet) {
  const result = await cofhejs.initializeWithEthers({
    ethersProvider: hre.ethers.provider,
    ethersSigner: wallet,
    environment: 'TESTNET',
    securityZones: [0],
    ...TESTNET_ENDPOINTS,
  })

  if (!result.success) {
    throw new Error(result.error.message)
  }
}

async function encryptUint8(value: bigint) {
  const result = await cofhejs.encrypt([Encryptable.uint8(value)] as const)
  if (!result.success) {
    throw new Error(result.error.message)
  }

  return result.data[0]
}

async function readManifest() {
  const manifestPath =
    process.env.DEPLOYMENT_MANIFEST ??
    path.join(process.cwd(), 'deployments', `noctra-${hre.network.name}.json`)

  return JSON.parse(readFileSync(manifestPath, 'utf8')) as DeploymentManifest
}

async function main() {
  if (hre.network.name !== 'eth-sepolia') {
    throw new Error(`This verification script expects eth-sepolia, received ${hre.network.name}.`)
  }

  const privateKey = process.env.PRIVATE_KEY ?? process.env.WALLET_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('Set PRIVATE_KEY or WALLET_PRIVATE_KEY before running this script.')
  }

  const manifest = await readManifest()
  const wallet = new Wallet(privateKey, hre.ethers.provider)

  const [voteToken, voteFaucet, gaugeController] = await Promise.all([
    hre.ethers.getContractAt('VeilToken', manifest.contracts.voteToken, wallet),
    hre.ethers.getContractAt('VeilFaucet', manifest.contracts.voteFaucet, wallet),
    hre.ethers.getContractAt('ConfidentialGaugeController', manifest.contracts.gaugeController, wallet),
  ])

  const assets = new Map(
    await Promise.all(
      manifest.assets.map(async (asset) => [
        asset.id,
        {
          ...asset,
          tokenContract: await hre.ethers.getContractAt('MockAssetToken', asset.token, wallet),
          faucetContract: await hre.ethers.getContractAt('VeilFaucet', asset.faucet, wallet),
        },
      ]),
    ),
  )

  const pools = new Map(
    await Promise.all(
      manifest.pools.map(async (pool) => [
        pool.id,
        {
          ...pool,
          poolContract: await hre.ethers.getContractAt('VeilLiquidityPool', pool.pool, wallet),
        },
      ]),
    ),
  )

  const fhEth = assets.get('fhETH')
  const fhUsdc = assets.get('fhUSDC')
  const wBtc = assets.get('wBTC')
  const sDai = assets.get('sDAI')
  const ethUsdcPool = pools.get(0)
  const wBtcEthPool = pools.get(1)
  const sDaiUsdcPool = pools.get(2)

  if (!fhEth || !fhUsdc || !wBtc || !sDai || !ethUsdcPool || !wBtcEthPool || !sDaiUsdcPool) {
    throw new Error('Missing expected assets or pools in the deployment manifest.')
  }

  const balanceBefore = await hre.ethers.provider.getBalance(wallet.address)
  console.log(`Wallet: ${wallet.address}`)
  console.log(`Sepolia ETH before verification: ${hre.ethers.formatEther(balanceBefore)}`)

  await initializeWallet(wallet)

  if (await voteFaucet.canClaim(wallet.address)) {
    const tx = await voteFaucet.claim()
    await tx.wait()
    console.log(`NTRA faucet claim succeeded: ${tx.hash}`)
  } else {
    console.log('NTRA faucet already on cooldown for this wallet, skipping claim.')
  }

  for (const asset of [fhEth, fhUsdc, wBtc, sDai]) {
    if (await asset.faucetContract.canClaim(wallet.address)) {
      const tx = await asset.faucetContract.claim()
      await tx.wait()
      console.log(`${asset.symbol} faucet claim succeeded: ${tx.hash}`)
    } else {
      console.log(`${asset.symbol} faucet already on cooldown, skipping claim.`)
    }
  }

  const lockPosition = await gaugeController.locks(wallet.address)
  if (lockPosition.amount === 0n) {
    await (await voteToken.approve(await gaugeController.getAddress(), 100n)).wait()
    const lockTx = await gaugeController.lock(60n, BigInt(2 * 365 * 24 * 60 * 60))
    await lockTx.wait()
    console.log(`Initial veNTRA lock succeeded: ${lockTx.hash}`)

    const increaseTx = await gaugeController.increaseLockAmount(10n)
    await increaseTx.wait()
    console.log(`Lock increase succeeded: ${increaseTx.hash}`)

    const extendTx = await gaugeController.extendLock(BigInt(30 * 24 * 60 * 60))
    await extendTx.wait()
    console.log(`Lock extension succeeded: ${extendTx.hash}`)
  } else {
    console.log(`Existing lock detected, reusing it. Amount=${lockPosition.amount.toString()} unlock=${lockPosition.unlockTime.toString()}`)
  }

  const publicBalance = await voteToken.balanceOf(wallet.address)
  if (publicBalance >= 20n) {
    const wrapTx = await voteToken.wrap(wallet.address, 20n)
    await wrapTx.wait()
    console.log(`NTRA wrap succeeded: ${wrapTx.hash}`)
  } else {
    console.log(`Public NTRA balance too small to wrap 20, current=${publicBalance.toString()}`)
  }

  const encryptedWrappedBalance = await voteToken.encBalances(wallet.address)
  const wrappedBalance = await cofhejs.unseal(encryptedWrappedBalance, FheTypes.Uint128)
  if (!wrappedBalance.success) {
    throw new Error(wrappedBalance.error.message)
  }
  console.log(`Wrapped NTRA decrypted for holder: ${wrappedBalance.data.toString()}`)

  const epochId = await gaugeController.currentEpoch()
  const alreadyVoted = await gaugeController.hasVotedInEpoch(epochId, wallet.address)
  if (!alreadyVoted) {
    const voteTx = await gaugeController.vote(epochId, await encryptUint8(2n))
    await voteTx.wait()
    console.log(`Encrypted shadow gauge vote succeeded: ${voteTx.hash}`)
  } else {
    console.log(`Wallet already voted in epoch ${epochId.toString()}, skipping vote.`)
  }

  const hiddenGaugeHandle = await gaugeController.getEncryptedGaugeWeight(epochId, 2)
  const hiddenGaugeProbe = await cofhejs.unseal(hiddenGaugeHandle, FheTypes.Uint128)
  console.log(`Pre-reveal gauge decrypt success: ${hiddenGaugeProbe.success}`)

  const quotedSwapOut = await wBtcEthPool.poolContract.getAmountOut(await wBtc.tokenContract.getAddress(), 10n)
  await (await wBtc.tokenContract.approve(await wBtcEthPool.poolContract.getAddress(), 10n)).wait()
  const swapTx = await wBtcEthPool.poolContract.swap(await wBtc.tokenContract.getAddress(), 10n, quotedSwapOut - 1n)
  await swapTx.wait()
  console.log(`Swap succeeded: 10 wBTC -> ${quotedSwapOut.toString()} fhETH, tx=${swapTx.hash}`)

  const [pool0Reserve0, pool0Reserve1] = await ethUsdcPool.poolContract.getReserves()
  const pool0Amount0 = 50n
  const pool0Amount1 = (pool0Amount0 * pool0Reserve1) / pool0Reserve0
  await (await fhEth.tokenContract.approve(await ethUsdcPool.poolContract.getAddress(), pool0Amount0)).wait()
  await (await fhUsdc.tokenContract.approve(await ethUsdcPool.poolContract.getAddress(), pool0Amount1)).wait()
  const lp0Tx = await ethUsdcPool.poolContract.addLiquidity(pool0Amount0, pool0Amount1)
  await lp0Tx.wait()
  console.log(`ETH/fhUSDC LP add succeeded: ${lp0Tx.hash}`)

  const [pool2Reserve0, pool2Reserve1] = await sDaiUsdcPool.poolContract.getReserves()
  const pool2Amount0 = 20n
  const pool2Amount1 = (pool2Amount0 * pool2Reserve1) / pool2Reserve0
  await (await sDai.tokenContract.approve(await sDaiUsdcPool.poolContract.getAddress(), pool2Amount0)).wait()
  await (await fhUsdc.tokenContract.approve(await sDaiUsdcPool.poolContract.getAddress(), pool2Amount1)).wait()
  const lp2Tx = await sDaiUsdcPool.poolContract.addLiquidity(pool2Amount0, pool2Amount1)
  await lp2Tx.wait()
  console.log(`sDAI/fhUSDC LP add succeeded: ${lp2Tx.hash}`)

  const ethUsdcLpBalance = await ethUsdcPool.poolContract.balanceOf(wallet.address)
  const sDaiUsdcLpBalance = await sDaiUsdcPool.poolContract.balanceOf(wallet.address)
  const votingPower = await gaugeController.votingPowerOf(wallet.address)
  const ntraCooldown = await voteFaucet.getNextClaimAt(wallet.address)
  const balanceAfter = await hre.ethers.provider.getBalance(wallet.address)

  console.log(`Live verification summary:`)
  console.log(`- veNTRA voting power: ${votingPower.toString()}`)
  console.log(`- ETH/fhUSDC LP balance: ${ethUsdcLpBalance.toString()}`)
  console.log(`- sDAI/fhUSDC LP balance: ${sDaiUsdcLpBalance.toString()}`)
  console.log(`- NTRA faucet next claim at: ${ntraCooldown.toString()}`)
  console.log(`- Sepolia ETH after verification: ${hre.ethers.formatEther(balanceAfter)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
