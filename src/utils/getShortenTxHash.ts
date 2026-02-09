export const getShortenTransactionHashOrAddress = (txHashOrAddress: string): string => {
  const firstCharacters = txHashOrAddress.substring(0, 6)
  const lastCharacters = txHashOrAddress.slice(-4)

  return `${firstCharacters}...${lastCharacters}`
}

export const getShortenData = (data: string): string => {
  const firstCharacters = data.substring(0, 12)
  const lastCharacters = data.slice(-12)

  return `${firstCharacters}...${lastCharacters}`
}
