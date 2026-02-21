export const getShortenTransactionHashOrAddress = (
  txHashOrAddress: string,
  firstPartLength: number = 6,
  lastPartLength: number = 4,
): string => {
  const firstCharacters = txHashOrAddress.substring(0, firstPartLength)
  const lastCharacters = txHashOrAddress.slice(-lastPartLength)

  return `${firstCharacters}...${lastCharacters}`
}

export const getShortenData = (
  data: string,
  firstPartLength: number = 12,
  lastPartLength: number = 12,
): string => {
  const firstCharacters = data.substring(0, firstPartLength)
  const lastCharacters = data.slice(-lastPartLength)

  return `${firstCharacters}...${lastCharacters}`
}
