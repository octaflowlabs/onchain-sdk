/**
 * buildSwapTx — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-19  returns exactly one unsigned transaction whose destination, calldata and value
 *            are those carried by the quote
 *  - SDK-20  an expired quote fails with QUOTE_EXPIRED and produces no transaction
 *  - SDK-21  an allowance below the input amount fails with INSUFFICIENT_ALLOWANCE and
 *            produces no transaction
 *  - SDK-22  gas limit, nonce and fee data are resolved, so the result is ready to sign with
 *            no further preparation
 *  - SDK-23  a swap that reverts in pre-flight simulation fails with EXECUTION_REVERTED and
 *            produces no transaction
 *
 * D-3 separates two concerns the existing gas path conflates. `estimateGasLimitFromProvider`
 * swallows a reverting estimate and returns a default limit, which for a swap would hand back
 * a signable transaction guaranteed to revert and burn the whole limit. So the simulation is
 * run here directly as a gate, and its numeric result is discarded: the limit comes from the
 * quote's own `gasLimit` plus a flat 5%. `prepareTransaction` is deliberately not reused —
 * its dynamic 5-30% buffer would compute a limit this function throws away, at the cost of a
 * second `estimateGas` round-trip.
 */

/** npm imports */
import { formatUnits, TransactionRequest } from 'ethers'

/** local imports */
import { getProvider } from '../blockchain/getProvider'
import { fetchFeeSnapshot } from '../blockchain/fetchFeeSnapshot'
import { isNativeTokenAddress } from './internal/nativeToken'
import { readAllowance } from './internal/allowance'
import { SwapError } from './SwapError'
import { BuildSwapTxParams, SwapQuote } from '../types/swap'
import { PrepareTransactionResult } from '../types/common'

const GAS_LIMIT_BUFFER_PERCENT = 5

interface ResolvedFeeData {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  gasPrice?: bigint
}

const applyGasBuffer = (gasLimit: bigint): bigint =>
  gasLimit + (gasLimit * BigInt(GAS_LIMIT_BUFFER_PERCENT)) / 100n

const toBigIntOrUndefined = (value: bigint | string | undefined): bigint | undefined =>
  value === undefined ? undefined : BigInt(value)

/**
 * `fetchFeeSnapshot` types its fee fields as `bigint | string` and throws a plain Error when
 * the node returns no usable fee data. Both are normalized here: the fields to `bigint`, and
 * the failure to PROVIDER_ERROR, so no untyped error escapes this operation (SDK-32).
 */
const readFeeData = async (
  rpcUrl: string,
  chainId: number,
  gasLimit: bigint,
): Promise<ResolvedFeeData> => {
  try {
    const { feeData } = await fetchFeeSnapshot({ rpcUrl, chainId, gasLimit })

    return {
      maxFeePerGas: toBigIntOrUndefined(feeData?.maxFeePerGas),
      maxPriorityFeePerGas: toBigIntOrUndefined(feeData?.maxPriorityFeePerGas),
      gasPrice: toBigIntOrUndefined(feeData?.gasPrice),
    }
  } catch (error) {
    throw new SwapError('PROVIDER_ERROR', 'Could not read current network fees', error)
  }
}

/**
 * A reverting simulation and an unreachable node must not collapse into one code (D-3).
 * `INSUFFICIENT_FUNDS` is neither revert-shaped nor an infrastructure fault, but reporting it
 * as PROVIDER_ERROR would invite the consumer to retry an operation that cannot succeed, so
 * it is treated as a failed simulation.
 */
const isSimulationFailure = (code: unknown): boolean =>
  code === 'CALL_EXCEPTION' || code === 'INSUFFICIENT_FUNDS' || code === 'UNPREDICTABLE_GAS_LIMIT'

const simulateOrThrow = async (
  provider: NonNullable<ReturnType<typeof getProvider>>,
  quote: SwapQuote,
  walletAddress: string,
): Promise<bigint> => {
  try {
    return await provider.estimateGas({
      from: walletAddress,
      to: quote.raw.to,
      data: quote.raw.data,
      value: quote.raw.value,
    })
  } catch (error) {
    const code = (error as { code?: unknown })?.code

    if (isSimulationFailure(code))
      throw new SwapError(
        'EXECUTION_REVERTED',
        'The swap transaction would revert on-chain and was not returned',
        error,
      )

    throw new SwapError(
      'PROVIDER_ERROR',
      'Could not simulate the swap transaction against the node',
      error,
    )
  }
}

export const buildSwapTx = async ({
  quote,
  walletAddress,
  rpcUrl,
}: BuildSwapTxParams): Promise<PrepareTransactionResult> => {
  if (Date.now() >= quote.expiresAt)
    throw new SwapError('QUOTE_EXPIRED', 'This quote has expired; request a new one', {
      expiresAt: quote.expiresAt,
    })

  if (!isNativeTokenAddress(quote.fromToken.address)) {
    const allowance = await readAllowance({
      rpcUrl,
      chainId: quote.fromChainId,
      tokenAddress: quote.fromToken.address,
      owner: walletAddress,
      spender: quote.spender,
    })

    if (allowance < quote.fromAmount)
      throw new SwapError(
        'INSUFFICIENT_ALLOWANCE',
        'The spender is not yet approved for the input amount',
        { allowance, required: quote.fromAmount },
      )
  }

  const provider = getProvider(rpcUrl, quote.fromChainId)
  if (!provider)
    throw new SwapError('PROVIDER_ERROR', 'Could not create provider to build the swap transaction')

  const gasEstimated = await simulateOrThrow(provider, quote, walletAddress)
  const gasLimit = applyGasBuffer(quote.raw.gasLimit ?? gasEstimated)

  const [nonce, feeData] = await Promise.all([
    provider.getTransactionCount(walletAddress, 'pending'),
    readFeeData(rpcUrl, quote.fromChainId, gasLimit),
  ])

  const unsignedTx: TransactionRequest = {
    from: walletAddress,
    to: quote.raw.to,
    data: quote.raw.data,
    value: quote.raw.value,
    gasLimit,
    chainId: quote.fromChainId,
    nonce,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  }

  if (feeData.gasPrice) unsignedTx.gasPrice = feeData.gasPrice

  const gasPriceForReserve = feeData.maxFeePerGas ?? feeData.gasPrice
  const gasReserve = gasPriceForReserve ? gasLimit * gasPriceForReserve : undefined

  return {
    unsignedTx,
    nonce,
    gasEstimated,
    gasLimit,
    gasReserve,
    bufferPercentage: GAS_LIMIT_BUFFER_PERCENT,
    feeData,
    humanReadableGasReserve: gasReserve ? formatUnits(gasReserve, 18) : 'N/A',
  }
}
