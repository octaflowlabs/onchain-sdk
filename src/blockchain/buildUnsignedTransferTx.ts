/** npm imports */
import { Interface, JsonRpcProvider, formatUnits, parseUnits, TransactionRequest } from 'ethers'

/** local imports */
import { getProvider } from './getProvider'
import { estimateGasLimitFromProvider } from './estimateGasLimitFromProvider'
import {
  BuildMaxNativeTransferTxOptions,
  BuildMaxNativeTransferTxResponse,
  BuildUnsignedTransferTxOptions,
  UnsignedTransferTxResponse,
} from '../types/common'

export const buildUnsignedTransferTx = async (
  options: BuildUnsignedTransferTxOptions,
): Promise<UnsignedTransferTxResponse> => {
  const provider = getProvider(options.rpcUrl, options.chainId)
  if (!provider) throw new Error('Could not create provider with given rpcUrl and chainId')

  try {
    let unsignedTx: TransactionRequest = { to: options.tokenAddress }

    const isNativeToken =
      !options.tokenAddress ||
      options.tokenAddress?.toLowerCase() === '0x0000000000000000000000000000000000000000' ||
      options.tokenAddress?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

    if (!isNativeToken) {
      if (!options.tokenAddress) throw new Error('Token address is required for token transfer')
      const code = await provider.getCode(options.tokenAddress)
      if (code === '0x' || code === '0x0') throw new Error('Invalid token address')

      const erc20Interface = new Interface(['function transfer(address to, uint256 amount)'])
      const decimals = options.tokenDecimals ?? 18
      if (!options.value) throw new Error('Value is required for token transfer')

      const amountParsed = parseUnits(options.value, decimals)

      unsignedTx = {
        ...unsignedTx,
        data: erc20Interface.encodeFunctionData('transfer', [options.toAddress, amountParsed]),
        value: 0n,
      }
    } else {
      if (!options.value) throw new Error('Native transfer requires value')
      unsignedTx = {
        to: options.toAddress,
        data: '0x',
        value: parseUnits(options.value, 18),
      }
    }

    if (options.chainId) unsignedTx.chainId = options.chainId

    const nonce = await provider.getTransactionCount(options.fromAddress, 'pending')

    const estimateGas = await estimateGasLimitFromProvider({
      provider: provider as JsonRpcProvider,
      unsignedTx,
      walletAddress: options.fromAddress,
      defaultGasLimit: options.defaultGasLimit,
    })

    const unsignedTxToReturn: TransactionRequest = {
      from: options.fromAddress,
      to: unsignedTx.to,
      data: unsignedTx.data,
      value: unsignedTx.value?.toString(),
      gasLimit: estimateGas.gasLimit.toString(),
      chainId: unsignedTx.chainId,
      nonce,
      maxFeePerGas: estimateGas.feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: estimateGas.feeData.maxPriorityFeePerGas?.toString(),
    }

    if (estimateGas.feeData.gasPrice)
      unsignedTxToReturn.gasPrice = estimateGas.feeData.gasPrice.toString()

    const gasReserve = estimateGas.feeData.maxFeePerGas
      ? estimateGas.gasLimit * estimateGas.feeData.maxFeePerGas
      : estimateGas.feeData.gasPrice
        ? estimateGas.gasLimit * estimateGas.feeData.gasPrice
        : undefined

    try {
      await provider.call({
        from: options.fromAddress,
        to: unsignedTx.to,
        data: unsignedTx.data,
        value: unsignedTx.value,
        gasLimit: estimateGas.gasLimit,
      })
    } catch (error: any) {
      throw new Error(
        'Transaction would revert, provider call unsuccessful: ' + error.message || error,
      )
    }

    return {
      unsignedTx: unsignedTxToReturn,
      nonce,
      gasEstimated: estimateGas.gasEstimated.toString(),
      gasLimit: estimateGas.gasLimit.toString(),
      gasReserve: gasReserve?.toString(),
      bufferPercentage: estimateGas.bufferPercentage,
      feeData: {
        maxFeePerGas: estimateGas.feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: estimateGas.feeData.maxPriorityFeePerGas?.toString(),
        gasPrice: estimateGas.feeData.gasPrice?.toString(),
      },
      //   suggestedGasFees: estimateGas.suggestedGasFees,
      //   humanReadableFees: humanReadableGasEstimation,
    }
  } catch (error) {
    console.error('Error building unsigned transfer transaction:', error)
    throw error
  }
}

export const buildMaxNativeTransferTx = async (
  options: BuildMaxNativeTransferTxOptions,
): Promise<BuildMaxNativeTransferTxResponse> => {
  const isNativeToken =
    !options.tokenAddress ||
    options.tokenAddress?.toLowerCase() === '0x0000000000000000000000000000000000000000' ||
    options.tokenAddress?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

  if (!isNativeToken) throw new Error('Max native transfer requires a native token address')

  const provisionalTx = await buildUnsignedTransferTx({
    ...options,
    value: '0',
    tokenAddress: options.tokenAddress,
  })

  if (!provisionalTx.gasReserve) throw new Error('Could not determine gas reserve for max send')

  const balanceWei = parseUnits(options.balance, 18)
  const gasReserveWei = BigInt(provisionalTx.gasReserve)
  const sendableWei = balanceWei - gasReserveWei

  if (sendableWei <= 0n) throw new Error('Insufficient balance to cover gas reserve')

  const sendableValue = formatUnits(sendableWei, 18)

  const finalTx = await buildUnsignedTransferTx({
    ...options,
    value: sendableValue,
    tokenAddress: options.tokenAddress,
  })

  return {
    ...finalTx,
    sendableValue,
  }
}
