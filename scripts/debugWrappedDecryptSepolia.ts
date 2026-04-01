import { readFileSync } from 'fs'
import path from 'path'

import hre from 'hardhat'
import { Wallet } from 'ethers'
import { cofhejs, FheTypes } from 'cofhejs/node'

type DeploymentManifest = {
  contracts: {
    voteToken: string
  }
}

const TESTNET_ENDPOINTS = {
  coFheUrl: 'https://testnet-cofhe.fhenix.zone',
  verifierUrl: 'https://testnet-cofhe-vrf.fhenix.zone',
  thresholdNetworkUrl: 'https://testnet-cofhe-tn.fhenix.zone',
} as const

function readManifest() {
  const manifestPath =
    process.env.DEPLOYMENT_MANIFEST ??
    path.join(process.cwd(), 'deployments', `noctra-${hre.network.name}.json`)

  return JSON.parse(readFileSync(manifestPath, 'utf8')) as DeploymentManifest
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  if (hre.network.name !== 'eth-sepolia') {
    throw new Error(`This script expects eth-sepolia, received ${hre.network.name}.`)
  }

  const privateKey = process.env.PRIVATE_KEY ?? process.env.WALLET_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('Set PRIVATE_KEY or WALLET_PRIVATE_KEY before running this script.')
  }

  const manifest = readManifest()
  const wallet = new Wallet(privateKey, hre.ethers.provider)

  const init = await cofhejs.initializeWithEthers({
    ethersProvider: hre.ethers.provider,
    ethersSigner: wallet,
    environment: 'TESTNET',
    generatePermit: true,
    securityZones: [0],
    ...TESTNET_ENDPOINTS,
  })

  if (!init.success) {
    throw new Error(init.error.message)
  }

  const permit = init.data ?? cofhejs.getPermit().data
  if (!permit) {
    throw new Error('Permit was not created.')
  }

  const voteToken = await hre.ethers.getContractAt('VeilToken', manifest.contracts.voteToken, wallet)
  const account = wallet.address

  console.log(`Wallet: ${account}`)
  console.log(`Permit hash: ${permit.getHash()}`)

  const publicBalanceBefore = await voteToken.balanceOf(account)
  const handleBefore = await voteToken.encBalances(account)
  console.log(`Public NTRA before optional wrap: ${publicBalanceBefore.toString()}`)
  console.log(`Encrypted balance handle before optional wrap: ${handleBefore.toString()}`)

  if (publicBalanceBefore > 0n) {
    const wrapAmount = publicBalanceBefore >= 1n ? 1n : 0n
    if (wrapAmount > 0n) {
      const wrapTx = await voteToken.wrap(account, wrapAmount)
      await wrapTx.wait()
      console.log(`Fresh wrap tx: ${wrapTx.hash}`)
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const handle = await voteToken.encBalances(account)
    console.log(`Attempt ${attempt + 1} handle: ${handle.toString()}`)

    const permission = permit.getPermission()
    const body = {
      ct_tempkey: handle.toString(16).padStart(64, '0'),
      host_chain_id: 11155111,
      permit: permission,
    }

    const [sealOutputRes, decryptRes] = await Promise.all([
      fetch(`${TESTNET_ENDPOINTS.thresholdNetworkUrl}/sealoutput`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      fetch(`${TESTNET_ENDPOINTS.thresholdNetworkUrl}/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ])

    const sealOutputJson = await sealOutputRes.json()
    const decryptJson = await decryptRes.json()

    console.log(`sealoutput raw: ${JSON.stringify(sealOutputJson)}`)
    console.log(`decrypt raw: ${JSON.stringify(decryptJson)}`)

    const unsealResult = await cofhejs.unseal(handle, FheTypes.Uint128, account, permit.getHash())
    const decryptResult = await cofhejs.decrypt(handle, FheTypes.Uint128, account, permit.getHash())

    console.log(
      `cofhejs.unseal success=${unsealResult.success}${unsealResult.success ? ` value=${unsealResult.data.toString()}` : ` error=${unsealResult.error.message}`}`,
    )
    console.log(
      `cofhejs.decrypt success=${decryptResult.success}${decryptResult.success ? ` value=${decryptResult.data.toString()}` : ` error=${decryptResult.error.message}`}`,
    )

    const decryptTx = await voteToken.decryptBalance(account)
    await decryptTx.wait()
    console.log(`contract decrypt tx: ${decryptTx.hash}`)

    for (let poll = 0; poll < 4; poll++) {
      const [result, ready] = await voteToken.getDecryptBalanceResultSafe(account)
      console.log(`contract decrypt poll ${poll + 1}: ready=${ready} value=${result.toString()}`)
      if (ready) {
        break
      }
      await sleep(5000)
    }

    await sleep(10000)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
