/**
 * External signer — spec 004-external-signer
 *
 * Satisfies:
 *  - ES-3   accepts the same already-resolved TransactionRequest shape signTransaction accepts,
 *           in particular prepareTransaction's output; resolves nothing itself
 *  - ES-4   transaction type is whatever ethers' own inferType() decides; never set here
 *  - ES-5   the signing digest is computed here, from the resolved TransactionRequest, and is
 *           exactly what signDigest receives
 *  - ES-6   the returned string is the same shape signTransaction returns: Transaction.from
 *           parses it and broadcastTransaction accepts it unchanged
 *  - ES-7   the recovered address is computed from the signature alone and compared to
 *           signer.address; ES_SIGNATURE_MISMATCH before anything is returned
 *  - ES-10  signDigest's rejection propagates unchanged — no try/catch on that call
 *  - ES-14  an under-resolved tx raises ES_UNRESOLVED_TRANSACTION before signDigest is called
 *  - FC-E1  serialized signed transaction that broadcastTransaction accepts unchanged
 *  - FC-E2  signDigest is called exactly once, with a 0x-prefixed 32-byte digest and nothing else
 *  - FC-E3  the 65-byte r ‖ s ‖ v signature is converted by Signature.from, which derives both
 *           v and yParity; no arithmetic on v anywhere in this file
 *  - FC-E4  a distinguishable error rather than a transaction signed by an unexpected key
 *  - FC-E5  no private key is required, derived or accepted on this path
 *  - FC-E8  exported from the package entry point
 */

/** npm imports */
import { Transaction, Signature, keccak256 } from 'ethers'

/** local imports */
import { TransactionRequest } from '../../types/common'
import { ExternalSigner } from '../../types/externalSigner'
import { ExternalSignerError } from '../../signing/ExternalSignerError'
import { normalizeEvmAddress } from '../../utils/normalizeAddress'

const isPresent = (value: unknown): boolean => value !== null && value !== undefined

const assertResolvedTransaction = (tx: TransactionRequest): void => {
  const missing: string[] = []

  if (!isPresent(tx.chainId)) missing.push('chainId')
  if (!isPresent(tx.nonce)) missing.push('nonce')
  if (!isPresent(tx.gasLimit)) missing.push('gasLimit')

  const hasMaxFee = isPresent(tx.maxFeePerGas)
  const hasPriorityFee = isPresent(tx.maxPriorityFeePerGas)

  if (hasMaxFee !== hasPriorityFee)
    missing.push(hasMaxFee ? 'maxPriorityFeePerGas' : 'maxFeePerGas')
  else if (!hasMaxFee && !isPresent(tx.gasPrice))
    missing.push('maxFeePerGas and maxPriorityFeePerGas, or gasPrice')

  if (missing.length > 0)
    throw new ExternalSignerError(
      'ES_UNRESOLVED_TRANSACTION',
      `Transaction is missing resolved field(s): ${missing.join(', ')}`,
      { missing },
    )
}

const assertRecoveredAddress = (
  recovered: string | null,
  signer: ExternalSigner,
  digest: string,
): void => {
  const expected = normalizeEvmAddress(signer.address)
  const actual = normalizeEvmAddress(recovered)

  if (!expected || !actual || expected !== actual)
    throw new ExternalSignerError(
      'ES_SIGNATURE_MISMATCH',
      'The signature does not recover to the signer address',
      { expected: signer.address, recovered, digest },
    )
}

export const signTransactionWithSigner = async (
  signer: ExternalSigner,
  tx: TransactionRequest,
  rpcUrl?: string,
): Promise<string> => {
  assertResolvedTransaction(tx)

  const populated = Transaction.from(tx as Parameters<typeof Transaction.from>[0])
  const digest = keccak256(populated.unsignedSerialized)

  const signature = await signer.signDigest(digest)

  populated.signature = Signature.from(signature)
  const serialized = populated.serialized

  assertRecoveredAddress(Transaction.from(serialized).from, signer, digest)

  return serialized
}
