/** local imports */
import { getShortenData } from './getShortenTxHash'

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

type HandleErrorType = {
  e: any
  message: string
}

export const handleErrorMessages = ({ e, message }: HandleErrorType): void => {
  const timestamp = new Date().toISOString()
  handleEthersError(e, timestamp)
}

const handleEthersError = (error: any, timestamp: string): void => {
  if (!isEthersError(error)) {
    console.log(`Non-ethers error at ${timestamp}:`, error)
    return
  }

  const { code, reason, transaction, info } = error
  const { to, from, data } = transaction || {}
  const payloadError = info?.error?.message || 'No additional error info'
  const params: any[] = info?.payload?.params || []

  console.error(
    `🚨 ${timestamp}: Ethers Error: ${reason || 'Unknown reason, check transaction parameters!'} (Code: ${code || 'N/A'})`,
  )

  if (transaction) {
    const functionSignature = data ? data.slice(0, 10) : undefined
    if (functionSignature)
      console.log(`✏️  The function signature detected is: ${functionSignature}`)

    console.log(`
      📋 Transaction Details:
      - From: ${from || 'N/A'}
      - To: ${to || 'N/A'}
      - Data: ${data ? `${getShortenData(data)}` : 'N/A'}
    `)
  }

  if (params.length > 0) {
    console.log(`📊 Additional Parameters: ${params}`)
    params.forEach((param: any, index: number) => {
      const excludedFields = ['data', 'to', 'from']

      const processedParams = Object.fromEntries(
        Object.entries(param).map(([key, value]) => {
          if (excludedFields.includes(key)) return [key, value]
          if (typeof value === 'string' && value.startsWith('0x')) return [key, parseInt(value, 16)]

          return [key, value]
        }),
      )

      console.log(`[${index}]: ${JSON.stringify(processedParams, null, 2)}`)
    })
  } else console.log('🔧 Params: No additional params provided.')

  if (payloadError) console.error(`🔍 Details: ${payloadError}`)
  else console.error('No further details available.')
}

export const isEthersError = (error: any): boolean =>
  error &&
  typeof error === 'object' &&
  (error.code || error.action || error.transaction) &&
  error.constructor?.name?.includes('Error')
