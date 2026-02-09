/** ABIs exports */
import ERC20_TOKEN_CONTRACT_ABI from './ABIs/ERC20_TOKEN_CONTRACT_ABI'
export { ERC20_TOKEN_CONTRACT_ABI }

/** constants exports */
export { GAS_LIMIT_PER_TX_TYPE } from './constants/constants'

/** basic blockchain exports */
export {
  buildMaxNativeTransferTx,
  buildUnsignedTransferTx,
} from './blockchain/buildUnsignedTransferTx'
export { broadcastTransaction } from './blockchain/broadcastTransaction'
export { estimateGasLimitFromProvider } from './blockchain/estimateGasLimitFromProvider'
export { getProvider } from './blockchain/getProvider'
export { txStatus } from './blockchain/txStatus'

/** services exports */
export {
  EvmWalletService,
  EvmGeneratedWallet,
  EvmDerivedWallet,
} from './services/evm-wallet-core/evmWalletService'
export { EntropySource } from './services/evm-wallet-core/entropy'
export { createWallet, signMessage, signTransaction } from './services/evm-wallet-core/signer'

/** utils exports */
export { getShortenTransactionHashOrAddress, getShortenData } from './utils/getShortenTxHash'
export { transformBigInt } from './utils/transformBigInt'
import NATIVE_TOKENS from './utils/tokens'
export { NATIVE_TOKENS }
export { formattedAmountForDisplay, parsedAmount } from './utils/formatAmount'
export {
  handleErrorMessages,
  errorMessagesForBroadcast,
  errorMessagesForGasLimitEstimation,
} from './utils/handleErrorMessages'
export { normalizeAddress } from './utils/normalizeAddress'

/** rpc exports */
export { validateRpcUrl, ensurePublicHost, testJsonRpc } from './rpc/index'

/** types exports */
export {
  BroadcastTransactionOptions,
  BuildMaxNativeTransferTxOptions,
  BuildMaxNativeTransferTxResponse,
  BuildUnsignedTransferTxOptions,
  EstimateGasLimitFromProviderProps,
  GasEstimateResult,
  TxStatusOptions,
  TxStatusResponse,
  UnsignedTransferTxResponse,
  FormatAmountOptions,
  TransactionRequest,
} from './types/common'
