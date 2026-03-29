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
}

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
  contracts.stableController !== zeroAddress &&
  contracts.stableToken !== zeroAddress &&
  Boolean(fheEndpoints.coFheUrl) &&
  Boolean(fheEndpoints.verifierUrl) &&
  Boolean(fheEndpoints.thresholdNetworkUrl)

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
