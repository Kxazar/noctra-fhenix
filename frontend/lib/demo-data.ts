export const demoEpoch = {
  id: 0,
  weeklyEmission: 12_500,
  hiddenVotes: 3,
}

export const demoGauges = [
  {
    id: 0,
    name: 'ETH / fhUSDC',
    pairLabel: 'volatile flagship pool',
    revealedWeight: 1_100,
    emissionShare: 10_096,
    angle: 'high-beta route for directional liquidity',
  },
  {
    id: 1,
    name: 'wBTC / fhETH',
    pairLabel: 'blue-chip reserve route',
    revealedWeight: 0,
    emissionShare: 0,
    angle: 'treasury-grade pair kept dormant this epoch',
  },
  {
    id: 2,
    name: 'sDAI / fhUSDC',
    pairLabel: 'stable carry corridor',
    revealedWeight: 300,
    emissionShare: 2_403,
    angle: 'defensive pool that still attracts hidden votes',
  },
]

export const demoCollateralTypes = [
  {
    id: 0,
    name: 'ETH / fhUSDC LP',
    pair: 'selected volatile pair',
    priceE4: 250_000,
    deposited: 100,
    collateralValue: 2_500,
  },
  {
    id: 1,
    name: 'sDAI / fhUSDC LP',
    pair: 'selected stable carry pair',
    priceE4: 120_000,
    deposited: 50,
    collateralValue: 600,
  },
]

export const demoStablePosition = {
  collateralValue: 3_100,
  maxMintableAt160: 1_937,
  encryptedDebt: 1_937,
  encryptedStableBalance: 1_937,
}

export const protocolHighlights = [
  've-style lockups create time-decaying voting power similar to Curve and Aerodrome.',
  'Gauge votes stay encrypted during the epoch, so routing intent is hidden until reveal.',
  'Selected LP pairs can back vhUSD at a minimum 160% collateral ratio.',
  'Both VEIL and vhUSD support wrapped encrypted balances for shielded treasury and user flows.',
]
