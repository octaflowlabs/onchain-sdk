/** npm imports */
import dns from 'dns/promises'
import { LookupAddress } from 'dns'
import net from 'net'

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
]

export const validateRpcUrl = (rpcUrl: string, allowLocal: boolean = false): URL => {
  let url: URL

  try {
    url = new URL(rpcUrl)
    if (!allowLocal && ['localhost', '127.0.0.1', '::1'].includes(url.hostname))
      throw new Error('Localhost URLs are not allowed')
  } catch {
    throw new Error('Invalid RPC URL')
  }

  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol))
    throw new Error('Unsupported protocol. Only http, https, ws, and wss are allowed.')

  if (['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Localhost RPC not allowed')
  return url
}

export const ensurePublicHost = async (rpcUrl: string): Promise<boolean> => {
  const url = validateRpcUrl(rpcUrl)

  try {
    const addresses: LookupAddress[] = await dns.lookup(url.hostname, { all: true })
    const hasPrivateIp = addresses
      .filter((a: LookupAddress) => net.isIP(a.address))
      .some((a: LookupAddress) => PRIVATE_IP_RANGES.some((r) => r.test(a.address)))

    if (hasPrivateIp) throw new Error('RPC URL resolves to a private IP address')

    return true
  } catch (error) {
    console.error('Error validating RPC URL:', error)
    throw new Error('Failed to validate RPC URL')
  }
}

export const testJsonRpc = async (
  rpcUrl: string,
  method = 'eth_chainId',
  params: any[] = [],
): Promise<unknown> => {
  await ensurePublicHost(rpcUrl)
  const payload = { jsonrpc: '2.0', id: 1, method, params }
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return data as unknown
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`RPC test failed: ${errorMessage}`)
  }
}
