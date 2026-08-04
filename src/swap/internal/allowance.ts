/**
 * Allowance reader — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-13  before producing any approval transaction, the current on-chain allowance
 *            granted to the quote's spender is read
 *  - SDK-21  buildSwapTx relies on this reading to detect insufficient allowance
 *
 * An RPC failure raises PROVIDER_ERROR rather than returning zero. Returning zero on failure
 * would fabricate an approval requirement: a wallet that already has sufficient allowance
 * would be sent an unnecessary approval because the read silently failed, not because the
 * allowance was actually insufficient.
 */

/** npm imports */
import { Contract } from 'ethers'

/** local imports */
import { getProvider } from '../../blockchain/getProvider'
import { SwapError } from '../SwapError'
import ERC20_TOKEN_CONTRACT_ABI from '../../ABIs/ERC20_TOKEN_CONTRACT_ABI'

interface ReadAllowanceParams {
  rpcUrl: string
  chainId: number
  tokenAddress: string
  owner: string
  spender: string
}

export const readAllowance = async ({
  rpcUrl,
  chainId,
  tokenAddress,
  owner,
  spender,
}: ReadAllowanceParams): Promise<bigint> => {
  const provider = getProvider(rpcUrl, chainId)
  if (!provider)
    throw new SwapError('PROVIDER_ERROR', 'Could not create provider to read allowance')

  const token = new Contract(tokenAddress, ERC20_TOKEN_CONTRACT_ABI, provider)

  try {
    const allowance: bigint = await token.allowance(owner, spender)
    return allowance
  } catch (error) {
    throw new SwapError('PROVIDER_ERROR', 'Could not read allowance from the input token', error)
  }
}
