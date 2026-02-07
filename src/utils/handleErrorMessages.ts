export const errorMessagesForBroadcast: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Insufficient funds for gas.',
  NONCE_EXPIRED: 'Nonce expired.',
  REPLACEMENT_UNDERPRICED: 'Replacement transaction underpriced.',
  INVALID_SIGNATURE: 'Invalid transaction signature.',
  GAS_PRICE_TOO_LOW: 'Gas price too low.',
  UNDERPRICED: 'Gas price too low.',
  OUT_OF_GAS: 'Transaction ran out of gas.',
  UNPREDICTABLE_GAS_LIMIT: 'Unpredictable gas limit. Transaction might fail.',
  INVALID_ARGUMENT: 'Invalid input arguments provided.',
  UNKNOWN_ERROR: 'Unknown error.',
}

export const errorMessagesForGasLimitEstimation: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Error: Insufficient funds to cover transaction fees.',
  CALL_EXCEPTION: 'Error: The transaction would revert (CALL_EXCEPTION).',
  OUT_OF_GAS: 'Error: Transaction would run out of gas.',
  UNPREDICTABLE_GAS_LIMIT: 'Error: Unable to estimate gas. The transaction may fail.',
  INVALID_ARGUMENT: 'Error: Invalid input arguments provided for gas estimation.',
  GAS_LIMIT_REACHED: 'Error: Gas estimation exceeds block gas limit.',
  UNKNOWN_ERROR: 'Unknown error.',
}

//TODO: Make methofds to parse errors and return user friendly messages based on the above records
