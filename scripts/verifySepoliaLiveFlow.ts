import { readFileSync } from 'fs'
import path from 'path'

import hre from 'hardhat'
import { NonceManager, Wallet } from 'ethers'
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
    generatePermit: true,
    securityZones: [0],
    ...TESTNET_ENDPOINTS,
  })

  if (!result.success) {
    throw new Error(result.error.message)
  }

  const permit = result.data ?? cofhejs.getPermit().data
  return permit?.getHash()
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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForBalanceDecrypt(
  voteToken: Awaited<ReturnType<typeof hre.ethers.getContractAt>>,
  account: string,
  retries = 12,
  delayMs = 5000,
) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const [amount, decrypted] = await voteToken.getDecryptBalanceResultSafe(account)
    if (decrypted) {
      return amount
    }
    await sleep(delayMs)
  }

  return null
}

async function tryPermitReveal(
  handle: bigint,
  walletAddress: string,
  permitHash: string | undefined,
  retries = 4,
  delayMs = 5000,
) {
  if (!permitHash) {
    return null
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    const unsealResult = await cofhejs.unseal(handle, FheTypes.Uint128, walletAddress, permitHash)
    if (unsealResult.success) {
      return { method: 'unseal' as const, value: unsealResult.data }
    }

    const decryptResult = await cofhejs.decrypt(handle, FheTypes.Uint128, walletAddress, permitHash)
    if (decryptResult.success) {
      return { method: 'decrypt' as const, value: decryptResult.data }
    }

    if (attempt < retries - 1) {
      await sleep(delayMs)
    }
  }

  return null
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
  const rawWallet = new Wallet(privateKey, hre.ethers.provider)
  const wallet = new NonceManager(rawWallet)

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

  const walletAddress = rawWallet.address
  const balanceBefore = await hre.ethers.provider.getBalance(walletAddress)
  console.log(`Wallet: ${walletAddress}`)
  console.log(`Sepolia ETH before verification: ${hre.ethers.formatEther(balanceBefore)}`)

  const permitHash = await initializeWallet(rawWallet)

  if (await voteFaucet.canClaim(walletAddress)) {
    const tx = await voteFaucet.claim()
    await tx.wait()
    console.log(`NTRA faucet claim succeeded: ${tx.hash}`)
  } else {
    console.log('NTRA faucet already on cooldown for this wallet, skipping claim.')
  }

  for (const asset of [fhEth, fhUsdc, wBtc, sDai]) {
    if (await asset.faucetContract.canClaim(walletAddress)) {
      const tx = await asset.faucetContract.claim()
      await tx.wait()
      console.log(`${asset.symbol} faucet claim succeeded: ${tx.hash}`)
    } else {
      console.log(`${asset.symbol} faucet already on cooldown, skipping claim.`)
    }
  }

  const lockPosition = await gaugeController.locks(walletAddress)
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

  const publicBalance = await voteToken.balanceOf(walletAddress)
  if (publicBalance >= 20n) {
    const wrapTx = await voteToken.wrap(walletAddress, 20n)
    await wrapTx.wait()
    console.log(`NTRA wrap succeeded: ${wrapTx.hash}`)
  } else {
    console.log(`Public NTRA balance too small to wrap 20, current=${publicBalance.toString()}`)
  }

  const encryptedWrappedBalance = await voteToken.encBalances(walletAddress)
  const wrappedBalance = await tryPermitReveal(encryptedWrappedBalance, walletAddress, permitHash, 4, 5000)

  if (wrappedBalance) {
    console.log(`Wrapped NTRA decrypted for holder via ${wrappedBalance.method}: ${wrappedBalance.value.toString()}`)
  } else {
    console.log('Permit-based wrapped NTRA reveal stayed unavailable. Falling back to contract-side decrypt.')

    const decryptTx = await voteToken.decryptBalance(walletAddress)
    await decryptTx.wait()

    const fallbackBalance = await waitForBalanceDecrypt(voteToken, walletAddress)
    if (fallbackBalance === null) {
      console.log('Wrapped NTRA decrypt is still pending on Sepolia after the fallback request.')
    } else {
      console.log(`Wrapped NTRA decrypted for holder: ${fallbackBalance.toString()}`)
    }
  }

  const epochId = await gaugeController.currentEpoch()
  const alreadyVoted = await gaugeController.hasVotedInEpoch(epochId, walletAddress)
  if (!alreadyVoted) {
    const voteTx = await gaugeController.vote(epochId, await encryptUint8(2n))
    await voteTx.wait()
    console.log(`Encrypted shadow gauge vote succeeded: ${voteTx.hash}`)
  } else {
    console.log(`Wallet already voted in epoch ${epochId.toString()}, skipping vote.`)
  }

  const hiddenGaugeHandle = await gaugeController.getEncryptedGaugeWeight(epochId, 2)
  const hiddenGaugeProbe = await tryPermitReveal(hiddenGaugeHandle, walletAddress, permitHash, 1, 0)
  console.log(`Pre-reveal gauge decrypt success: ${hiddenGaugeProbe !== null}`)
  if (!hiddenGaugeProbe) {
    console.log('Pre-reveal gauge decrypt stayed blocked as expected.')
  }

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

  const ethUsdcLpBalance = await ethUsdcPool.poolContract.balanceOf(walletAddress)
  const sDaiUsdcLpBalance = await sDaiUsdcPool.poolContract.balanceOf(walletAddress)
  const votingPower = await gaugeController.votingPowerOf(walletAddress)
  const ntraCooldown = await voteFaucet.getNextClaimAt(walletAddress)
  const balanceAfter = await hre.ethers.provider.getBalance(walletAddress)

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
