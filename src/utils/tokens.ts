export type NativeTokenType = {
  [chainId: number]: { symbol: string; decimals: number; name: string }
}

const NATIVE_TOKENS: NativeTokenType = {
  1: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
  11155111: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
  56: { symbol: 'BNB', decimals: 18, name: 'BNB Chain' },
  137: { symbol: 'POL', decimals: 18, name: 'Polygon' },
}

export default NATIVE_TOKENS
