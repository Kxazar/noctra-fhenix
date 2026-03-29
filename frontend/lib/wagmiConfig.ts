import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { injected } from '@wagmi/core'

import { chainId, chainName, explorerUrl, rpcUrl } from '@/lib/contracts'

export const appChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
    public: {
      http: [rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: explorerUrl,
    },
  },
})

export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors: [injected()],
  transports: {
    [appChain.id]: http(rpcUrl),
  },
  ssr: false,
})
