export interface TransactionActivityDedupeInput {
  hash?: string | null
  log?: {
    logIndex?: string | null
  } | null
}

export const getTransactionActivityDedupeKey = (
  activity: TransactionActivityDedupeInput,
): string | null => {
  const hash = activity.hash?.trim()
  if (!hash) return null

  const logIndex = activity.log?.logIndex?.trim()
  return logIndex ? `${hash}:${logIndex}` : hash
}
