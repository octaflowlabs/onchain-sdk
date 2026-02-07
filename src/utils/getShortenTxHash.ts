export const getShortenTransactionHash = (txHash: string): string => {
  const firstCharacters = txHash.substring(0, 6)
  const lastCharacters = txHash.slice(-4)

  return `${firstCharacters}...${lastCharacters}`
}
