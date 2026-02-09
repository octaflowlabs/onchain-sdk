/** npm imports */
import { getAddress } from 'ethers'

export const normalizeAddress = (address: string): string => {
  try {
    return getAddress(address)
  } catch (e) {
    console.log('Error normalizing address:', e)
    throw new Error('Error normalizing address: ' + (e instanceof Error ? e.message : String(e)))
  }
}
