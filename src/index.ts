/** ABIs exports */
import ERC20_TOKEN_CONTRACT_ABI from './ABIs/ERC20_TOKEN_CONTRACT_ABI'
export { ERC20_TOKEN_CONTRACT_ABI }

/** constants exports */
export { GAS_LIMIT_PER_TX_TYPE, MULTICALL3_ADDRESS } from './constants/constants'
export { NetworkField, NetworkRegistry, NETWORKS_REGISTRY } from './constants/NETWORKS_REGISTRY'
export {
  BASIC_TOKENS_BY_CHAIN,
  BasicTokenData,
  BasicTokenSymbol,
  ChainTokenDataMap,
} from './constants/BASIC_TOKENS_REGISTRY'
export {
  STABLECOIN_CONTRACTS_BY_CHAIN_ID,
  getStablecoinContractBySymbolAndChainId,
  getStablecoinContractsByChainId,
  isAllowedStablecoinContract,
  StablecoinContractData,
  StablecoinContractsByChainId,
  StablecoinSymbol,
} from './constants/STABLECOINS_REGISTRY'

/** basic blockchain exports */
export {
  buildBaseUnsignedTransferTx,
  buildMaxNativeTransferTx,
  buildUnsignedTransferTx,
} from './blockchain/buildUnsignedTransferTx'
export { broadcastTransaction } from './blockchain/broadcastTransaction'
export { estimateGasLimitFromProvider } from './blockchain/estimateGasLimitFromProvider'
export { getProvider } from './blockchain/getProvider'
export { txStatus } from './blockchain/txStatus'
export { getBalance, getBalances } from './blockchain/getBalances'
export { estimateTransaction } from './blockchain/estimateTransaction'
export { prepareTransaction } from './blockchain/prepareTransaction'
export {
  fetchFeeSnapshot,
  type FetchFeeSnapshotOptions,
  type FeeSnapshotTxKind,
} from './blockchain/fetchFeeSnapshot'
export {
  type GetTokenMetadataParams,
  type TokenMetadata,
  getTokenMetadata,
} from './blockchain/getTokenMetadata'
export { isVerified } from './blockchain/isTokenVerified'

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
export { normalizeAddress, normalizeEvmAddress } from './utils/normalizeAddress'
export { toGwei, tryParseGweiToWei, parseGasLimit } from './utils/parseGasFees'
export {
  getFeePresets,
  calcReserve,
  estimateSeconds,
  getBlockTime,
  BLOCK_TIME_BY_CHAIN,
} from './utils/feePresets'

/** webhook exports */
export { extractPoolInboundStablecoinEvents } from './webhooks/alchemyAddressActivity'

/** types exports */
export {
  BroadcastTransactionOptions,
  BuildMaxNativeTransferTxOptions,
  BuildUnsignedTransferTxOptions,
  EstimateGasLimitFromProviderProps,
  GasEstimateResult,
  TxStatusOptions,
  BuildBaseUnsignedTransferTxParams,
  TxStatusResponse,
  EstimateTransactionOptions,
  EstimateTransactionResult,
  PrepareTransactionParams,
  PrepareTransactionResult,
  FormatAmountOptions,
  TransactionRequest,
  GetBalanceParams,
  GetBalancesParams,
  GetBalancesChainRequest,
  GetBalanceResult,
  ChainBalances,
  TokenBalance,
  ChainGroup,
  FeePreset,
  FeePresetLabel,
  FeeEstimateSeconds,
  ResolvedFees,
  EIP1559Fees,
  LegacyFees,
  FeeModel,
  FeeHistoryData,
  FeeDataInput,
} from './types/common'

/** swap exports */
export { SwapError, isSwapError } from './swap/SwapError'
export { getSwapSupportedChainIds } from './constants/SWAP_SUPPORTED_CHAINS'

/** swap types exports */
export {
  SwapState,
  SwapPhase,
  SwapTxOutcome,
  SwapErrorCode,
  SwapTokenInfo,
  SwapRouteSummary,
  LifiTransactionRequest,
  SwapQuote,
  GetSwapQuoteParams,
  BuildSwapApprovalTxsParams,
  BuildSwapTxParams,
  ResolveSwapStateParams,
} from './types/swap'
