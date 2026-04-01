import type { Address } from 'viem'

export const zeroAddress = '0x0000000000000000000000000000000000000000' as Address

export const appMode = process.env.NEXT_PUBLIC_APP_MODE === 'live' ? 'live' : 'demo'

export const liveEnvironment =
  process.env.NEXT_PUBLIC_FHENIX_ENV === 'MAINNET'
    ? 'MAINNET'
    : process.env.NEXT_PUBLIC_FHENIX_ENV === 'LOCAL'
      ? 'LOCAL'
      : process.env.NEXT_PUBLIC_FHENIX_ENV === 'MOCK'
        ? 'MOCK'
        : 'TESTNET'

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545'
export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 42069)
export const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME ?? 'CoFHE Local'
export const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL ?? 'http://127.0.0.1:8545'

export const contracts = {
  gaugeController: (process.env.NEXT_PUBLIC_GAUGE_CONTROLLER_ADDRESS ?? zeroAddress) as Address,
  voteToken: (process.env.NEXT_PUBLIC_VEIL_TOKEN_ADDRESS ?? zeroAddress) as Address,
  stableController: (process.env.NEXT_PUBLIC_STABLE_CONTROLLER_ADDRESS ?? zeroAddress) as Address,
  stableToken: (process.env.NEXT_PUBLIC_STABLE_TOKEN_ADDRESS ?? zeroAddress) as Address,
  faucet: (process.env.NEXT_PUBLIC_VEIL_FAUCET_ADDRESS ?? zeroAddress) as Address,
}

export const marketAssets = [
  {
    id: 'fhETH',
    name: process.env.NEXT_PUBLIC_ASSET_0_NAME ?? 'fhETH',
    address: (process.env.NEXT_PUBLIC_ASSET_0_ADDRESS ?? zeroAddress) as Address,
    faucet: (process.env.NEXT_PUBLIC_ASSET_0_FAUCET_ADDRESS ?? zeroAddress) as Address,
  },
  {
    id: 'fhUSDC',
    name: process.env.NEXT_PUBLIC_ASSET_1_NAME ?? 'fhUSDC',
    address: (process.env.NEXT_PUBLIC_ASSET_1_ADDRESS ?? zeroAddress) as Address,
    faucet: (process.env.NEXT_PUBLIC_ASSET_1_FAUCET_ADDRESS ?? zeroAddress) as Address,
  },
  {
    id: 'wBTC',
    name: process.env.NEXT_PUBLIC_ASSET_2_NAME ?? 'wBTC',
    address: (process.env.NEXT_PUBLIC_ASSET_2_ADDRESS ?? zeroAddress) as Address,
    faucet: (process.env.NEXT_PUBLIC_ASSET_2_FAUCET_ADDRESS ?? zeroAddress) as Address,
  },
  {
    id: 'sDAI',
    name: process.env.NEXT_PUBLIC_ASSET_3_NAME ?? 'sDAI',
    address: (process.env.NEXT_PUBLIC_ASSET_3_ADDRESS ?? zeroAddress) as Address,
    faucet: (process.env.NEXT_PUBLIC_ASSET_3_FAUCET_ADDRESS ?? zeroAddress) as Address,
  },
]

export const liquidityPools = [
  {
    id: 0,
    name: process.env.NEXT_PUBLIC_POOL_0_NAME ?? 'ETH / fhUSDC',
    address: (process.env.NEXT_PUBLIC_POOL_0_ADDRESS ?? zeroAddress) as Address,
  },
  {
    id: 1,
    name: process.env.NEXT_PUBLIC_POOL_1_NAME ?? 'wBTC / fhETH',
    address: (process.env.NEXT_PUBLIC_POOL_1_ADDRESS ?? zeroAddress) as Address,
  },
  {
    id: 2,
    name: process.env.NEXT_PUBLIC_POOL_2_NAME ?? 'sDAI / fhUSDC',
    address: (process.env.NEXT_PUBLIC_POOL_2_ADDRESS ?? zeroAddress) as Address,
  },
]

export const collateralTokens = [
  {
    id: 0,
    name: process.env.NEXT_PUBLIC_COLLATERAL_0_NAME ?? 'ETH / fhUSDC LP',
    address: (process.env.NEXT_PUBLIC_COLLATERAL_0_ADDRESS ?? zeroAddress) as Address,
  },
  {
    id: 1,
    name: process.env.NEXT_PUBLIC_COLLATERAL_1_NAME ?? 'sDAI / fhUSDC LP',
    address: (process.env.NEXT_PUBLIC_COLLATERAL_1_ADDRESS ?? zeroAddress) as Address,
  },
].filter((item) => item.address !== zeroAddress || appMode === 'demo')

export const fheEndpoints = {
  coFheUrl: process.env.NEXT_PUBLIC_COFHE_URL,
  verifierUrl: process.env.NEXT_PUBLIC_ZK_VERIFIER_URL,
  thresholdNetworkUrl: process.env.NEXT_PUBLIC_THRESHOLD_URL,
}

export const isLiveConfigured =
  appMode === 'live' &&
  contracts.gaugeController !== zeroAddress &&
  contracts.voteToken !== zeroAddress &&
  Boolean(fheEndpoints.coFheUrl) &&
  Boolean(fheEndpoints.verifierUrl) &&
  Boolean(fheEndpoints.thresholdNetworkUrl)

export const isFaucetConfigured = contracts.faucet !== zeroAddress
export const isVoteTokenConfigured = contracts.voteToken !== zeroAddress
export const arePoolsConfigured = liquidityPools.some((pool) => pool.address !== zeroAddress)
export const areAssetsConfigured = marketAssets.some((asset) => asset.address !== zeroAddress)

export const gaugeControllerAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'currentEpoch',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'votingPowerOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint128' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getEncryptedGaugeWeight',
    inputs: [
      { name: 'epochId', type: 'uint256' },
      { name: 'gaugeId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'lock',
    inputs: [
      { name: 'amount', type: 'uint128' },
      { name: 'duration', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'vote',
    inputs: [
      { name: 'epochId', type: 'uint256' },
      {
        name: 'encryptedGaugeIndex',
        type: 'tuple',
        components: [
          { name: 'ctHash', type: 'uint256' },
          { name: 'securityZone', type: 'uint8' },
          { name: 'utype', type: 'uint8' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

export const confidentialStableControllerAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'collateralValueOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getEncryptedDebt',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'depositCollateral',
    inputs: [
      { name: 'collateralTypeId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'mintStable',
    inputs: [
      {
        name: 'desiredAmount',
        type: 'tuple',
        components: [
          { name: 'ctHash', type: 'uint256' },
          { name: 'securityZone', type: 'uint8' },
          { name: 'utype', type: 'uint8' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

export const erc20Abi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const veilTokenAbi = [
  ...erc20Abi,
  {
    type: 'function',
    stateMutability: 'view',
    name: 'encBalances',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'decryptBalance',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getDecryptBalanceResultSafe',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: '', type: 'uint128' },
      { name: '', type: 'bool' },
    ],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'wrap',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'amount', type: 'uint128' },
    ],
    outputs: [],
  },
] as const

export const stableTokenAbi = [
  ...erc20Abi,
  {
    type: 'function',
    stateMutability: 'view',
    name: 'encBalances',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const faucetAbi = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'claim',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'canClaim',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getNextClaimAt',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const poolAbi = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'addLiquidity',
    inputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
    outputs: [{ name: 'liquidity', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'swap',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getAmountOut',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getReserves',
    inputs: [],
    outputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
    ],
  },
] as const
