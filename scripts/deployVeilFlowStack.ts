import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

import hre from 'hardhat'

import { deployVeilFlowStack } from './veilflowStack'

function getExplorerUrl(networkName: string) {
  if (networkName === 'eth-sepolia') return 'https://sepolia.etherscan.io'
  if (networkName === 'arb-sepolia') return 'https://sepolia.arbiscan.io'
  return 'http://127.0.0.1:8545'
}

function getChainName(networkName: string) {
  if (networkName === 'eth-sepolia') return 'Ethereum Sepolia'
  if (networkName === 'arb-sepolia') return 'Arbitrum Sepolia'
  return 'CoFHE Local'
}

function getFhenixEnv(networkName: string) {
  return networkName === 'eth-sepolia' || networkName === 'arb-sepolia' ? 'TESTNET' : 'MOCK'
}

async function main() {
  if (hre.network.name === 'hardhat' && hre.cofhe.isPermittedEnvironment('MOCK')) {
    await hre.cofhe.mocks.deployMocks({
      deployTestBed: true,
      gasWarning: false,
      silent: true,
    })
  }

  const stack = await deployVeilFlowStack()
  const networkName = hre.network.name
  const networkConfig = hre.network.config as { chainId?: number; url?: string }

  const deployment = {
    network: networkName,
    chainId: networkConfig.chainId ?? 42069,
    deployer: stack.owner.address,
    weeklyEmission: stack.weeklyEmission.toString(),
    emissionInventory: stack.emissionInventory.toString(),
    contracts: {
      voteToken: await stack.voteToken.getAddress(),
      voteFaucet: await stack.voteFaucet.getAddress(),
      gaugeController: await stack.gaugeController.getAddress(),
      stableToken: await stack.stableToken.getAddress(),
      stableController: await stack.stableController.getAddress(),
    },
    assets: await Promise.all(
      stack.assets.map(async (asset) => ({
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        token: await asset.token.getAddress(),
        faucet: await asset.faucet.getAddress(),
      })),
    ),
    pools: await Promise.all(
      stack.pools.map(async (pool) => ({
        id: pool.id,
        name: pool.name,
        symbol: pool.symbol,
        token0Id: pool.token0Id,
        token1Id: pool.token1Id,
        pool: await pool.pool.getAddress(),
        seed0: pool.seed0.toString(),
        seed1: pool.seed1.toString(),
        collateralPriceE4: pool.collateralPriceE4?.toString() ?? null,
      })),
    ),
  }

  const envLines = [
    `NEXT_PUBLIC_APP_MODE=live`,
    `NEXT_PUBLIC_FHENIX_ENV=${getFhenixEnv(networkName)}`,
    `NEXT_PUBLIC_RPC_URL=${networkConfig.url ?? 'http://127.0.0.1:8545'}`,
    `NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`,
    `NEXT_PUBLIC_CHAIN_NAME=${getChainName(networkName)}`,
    `NEXT_PUBLIC_EXPLORER_URL=${getExplorerUrl(networkName)}`,
    `NEXT_PUBLIC_COFHE_URL=${getFhenixEnv(networkName) === 'TESTNET' ? 'https://testnet-cofhe.fhenix.zone' : ''}`,
    `NEXT_PUBLIC_ZK_VERIFIER_URL=${getFhenixEnv(networkName) === 'TESTNET' ? 'https://testnet-cofhe-vrf.fhenix.zone' : ''}`,
    `NEXT_PUBLIC_THRESHOLD_URL=${getFhenixEnv(networkName) === 'TESTNET' ? 'https://testnet-cofhe-tn.fhenix.zone' : ''}`,
    `NEXT_PUBLIC_GAUGE_CONTROLLER_ADDRESS=${deployment.contracts.gaugeController}`,
    `NEXT_PUBLIC_VEIL_TOKEN_ADDRESS=${deployment.contracts.voteToken}`,
    `NEXT_PUBLIC_VEIL_FAUCET_ADDRESS=${deployment.contracts.voteFaucet}`,
    `NEXT_PUBLIC_POOL_0_NAME=${deployment.pools[0].name}`,
    `NEXT_PUBLIC_POOL_0_ADDRESS=${deployment.pools[0].pool}`,
    `NEXT_PUBLIC_POOL_1_NAME=${deployment.pools[1].name}`,
    `NEXT_PUBLIC_POOL_1_ADDRESS=${deployment.pools[1].pool}`,
    `NEXT_PUBLIC_POOL_2_NAME=${deployment.pools[2].name}`,
    `NEXT_PUBLIC_POOL_2_ADDRESS=${deployment.pools[2].pool}`,
    `NEXT_PUBLIC_ASSET_0_NAME=${deployment.assets[0].symbol}`,
    `NEXT_PUBLIC_ASSET_0_ADDRESS=${deployment.assets[0].token}`,
    `NEXT_PUBLIC_ASSET_1_NAME=${deployment.assets[1].symbol}`,
    `NEXT_PUBLIC_ASSET_1_ADDRESS=${deployment.assets[1].token}`,
    `NEXT_PUBLIC_ASSET_2_NAME=${deployment.assets[2].symbol}`,
    `NEXT_PUBLIC_ASSET_2_ADDRESS=${deployment.assets[2].token}`,
    `NEXT_PUBLIC_ASSET_3_NAME=${deployment.assets[3].symbol}`,
    `NEXT_PUBLIC_ASSET_3_ADDRESS=${deployment.assets[3].token}`,
  ]

  const outputDir = path.join(process.cwd(), 'deployments')
  mkdirSync(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, `noctra-${networkName}.json`)
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        ...deployment,
        frontendEnv: envLines,
      },
      null,
      2,
    ),
  )

  console.log(`Noctra stack deployed on ${networkName}`)
  console.log(`Deployment manifest: ${outputPath}`)
  console.log('')
  console.log(envLines.join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
