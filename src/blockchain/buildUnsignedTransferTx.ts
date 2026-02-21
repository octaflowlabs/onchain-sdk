/** npm imports */
import { Interface, formatUnits, parseEther, parseUnits } from 'ethers'

/** local imports */
import { getProvider } from './getProvider'
import {
  BuildBaseUnsignedTransferTxParams,
  BuildMaxNativeTransferTxOptions,
  BuildUnsignedTransferTxOptions,
  PrepareTransactionResult,
} from '../types/common'
import { prepareTransaction } from './prepareTransaction'

export const buildBaseUnsignedTransferTx = ({
  recipientAddress,
  value,
  tokenAddress,
  tokenDecimals,
}: BuildBaseUnsignedTransferTxParams): { to: string; data: string; value: bigint } => {
  const isNative =
    !tokenAddress ||
    tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000000000' ||
    tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

  if (!isNative) {
    const erc20Interface = new Interface(['function transfer(address to, uint256 amount)'])
    const decimals = tokenDecimals ?? 18
    const amountParsed = parseUnits(value, decimals)

    return {
      to: tokenAddress,
      data: erc20Interface.encodeFunctionData('transfer', [recipientAddress, amountParsed]),
      value: 0n,
    }
  }

  return {
    to: recipientAddress,
    data: '0x',
    value: parseEther(value),
  }
}

export const buildUnsignedTransferTx = async (
  options: BuildUnsignedTransferTxOptions,
): Promise<PrepareTransactionResult> => {
  const provider = getProvider(options.rpcUrl, options.chainId)
  if (!provider) throw new Error('Could not create provider with given rpcUrl and chainId')

  try {
    const baseUnsignedTx = buildBaseUnsignedTransferTx({
      recipientAddress: options.toAddress,
      value: options.value ?? '0',
      tokenAddress: options.tokenAddress,
      tokenDecimals: options.tokenDecimals,
    })

    return prepareTransaction({
      rpcUrl: options.rpcUrl,
      chainId: options.chainId ?? Number((await provider.getNetwork()).chainId),
      tx: baseUnsignedTx,
      fromAddress: options.fromAddress,
      defaultGasLimit: options.defaultGasLimit,
    })
  } catch (error) {
    console.error('Error building unsigned transfer transaction:', error)
    throw error
  }
}

export const buildMaxNativeTransferTx = async (
  options: BuildMaxNativeTransferTxOptions,
): Promise<string> => {
  const provider = getProvider(options.rpcUrl, options.chainId)
  if (!provider) throw new Error('Could not create provider with given rpcUrl and chainId')

  const network = await provider.getNetwork()
  const chainId = options.chainId ?? Number(network.chainId)

  const provisionalTx = await prepareTransaction({
    rpcUrl: options.rpcUrl,
    chainId,
    tx: {
      to: options.toAddress,
      data: '0x',
      value: 0n,
    },
    fromAddress: options.fromAddress,
    defaultGasLimit: options.defaultGasLimit,
  })

  if (!provisionalTx.gasReserve) throw new Error('Could not determine gas reserve for max send')

  const balanceWei = parseEther(options.balance)
  const gasReserveWei = BigInt(provisionalTx.gasReserve)
  const sendableWei = balanceWei - gasReserveWei

  if (sendableWei <= 0n) throw new Error('Insufficient balance to cover gas reserve')

  const sendableValue = formatUnits(sendableWei, 18)

  return sendableValue
}
