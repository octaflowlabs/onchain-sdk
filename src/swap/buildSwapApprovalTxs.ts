/**
 * buildSwapApprovalTxs — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-13  the current on-chain allowance is read before any approval transaction is built
 *  - SDK-14  a native input needs no approval; an empty list is returned without reading
 *            allowance at all
 *  - SDK-15  an allowance already covering the input amount also yields an empty list
 *  - SDK-16  a zero allowance yields exactly one unlimited approval
 *  - SDK-17  a non-zero, insufficient allowance yields a reset-to-zero followed by an
 *            unlimited approval, in that order
 *  - SDK-18  every approval transaction targets the input token contract
 *  - FC-4    the two-transaction case must be broadcast in order, each confirmed before the
 *            next — a correctness requirement here, not just advice, because of how the
 *            nonces below are assigned
 *
 * D-7: the two-transaction path is the trap. Preparing both transactions independently would
 * have each read the wallet's pending transaction count separately, before either has been
 * broadcast, so both would land on the same nonce and the second would be rejected as a
 * replacement. The nonce is read exactly once here — via `prepareTransaction` for the first
 * transaction — and the second reuses that reading plus one, built by hand from
 * `estimateTransaction` (which does not touch the nonce) instead of a second
 * `prepareTransaction` call that would read it again.
 */

/** npm imports */
import { Interface, MaxUint256, TransactionRequest } from 'ethers'

/** local imports */
import { isNativeTokenAddress } from './internal/nativeToken'
import { readAllowance } from './internal/allowance'
import { prepareTransaction } from '../blockchain/prepareTransaction'
import { estimateTransaction } from '../blockchain/estimateTransaction'
import { GAS_LIMIT_PER_TX_TYPE } from '../constants/constants'
import { BuildSwapApprovalTxsParams } from '../types/swap'

const ERC20_APPROVE_INTERFACE = new Interface(['function approve(address spender, uint256 amount)'])

const buildApprovalCall = (
  tokenAddress: string,
  spender: string,
  amount: bigint,
): { to: string; data: string; value: bigint } => ({
  to: tokenAddress,
  data: ERC20_APPROVE_INTERFACE.encodeFunctionData('approve', [spender, amount]),
  value: 0n,
})

export const buildSwapApprovalTxs = async ({
  quote,
  walletAddress,
  rpcUrl,
}: BuildSwapApprovalTxsParams): Promise<TransactionRequest[]> => {
  if (isNativeTokenAddress(quote.fromToken.address)) return []

  const allowance = await readAllowance({
    rpcUrl,
    chainId: quote.fromChainId,
    tokenAddress: quote.fromToken.address,
    owner: walletAddress,
    spender: quote.spender,
  })

  if (allowance >= quote.fromAmount) return []

  const approveMaxCall = buildApprovalCall(quote.fromToken.address, quote.spender, MaxUint256)

  if (allowance === 0n) {
    const prepared = await prepareTransaction({
      rpcUrl,
      chainId: quote.fromChainId,
      tx: approveMaxCall,
      fromAddress: walletAddress,
      defaultGasLimit: GAS_LIMIT_PER_TX_TYPE.DEFAULT_APPROVAL,
    })

    return [prepared.unsignedTx]
  }

  const resetToZeroCall = buildApprovalCall(quote.fromToken.address, quote.spender, 0n)

  const preparedReset = await prepareTransaction({
    rpcUrl,
    chainId: quote.fromChainId,
    tx: resetToZeroCall,
    fromAddress: walletAddress,
    defaultGasLimit: GAS_LIMIT_PER_TX_TYPE.DEFAULT_APPROVAL,
  })

  const approveMaxEstimate = await estimateTransaction({
    rpcUrl,
    chainId: quote.fromChainId,
    tx: approveMaxCall,
    fromAddress: walletAddress,
    defaultGasLimit: GAS_LIMIT_PER_TX_TYPE.DEFAULT_APPROVAL,
  })

  const approveMaxTx: TransactionRequest = {
    from: walletAddress,
    to: approveMaxCall.to,
    data: approveMaxCall.data,
    value: approveMaxCall.value,
    gasLimit: approveMaxEstimate.gasLimit,
    chainId: quote.fromChainId,
    nonce: preparedReset.nonce + 1,
    maxFeePerGas: approveMaxEstimate.feeData.maxFeePerGas,
    maxPriorityFeePerGas: approveMaxEstimate.feeData.maxPriorityFeePerGas,
  }

  if (approveMaxEstimate.feeData.gasPrice)
    approveMaxTx.gasPrice = approveMaxEstimate.feeData.gasPrice

  return [preparedReset.unsignedTx, approveMaxTx]
}
