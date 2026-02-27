/** npm imports */
import { Wallet, HDNodeWallet, Mnemonic, getAddress } from 'ethers'

/** local imports */
import { EntropySource } from './entropy'

export interface EvmGeneratedWallet {
  address: string
  mnemonic: string
  privateKey: string
  path: string
}

export interface EvmDerivedWallet {
  address: string
  privateKey: string
  path: string
  publicKey: string
}

export class EvmWalletService {
  private readonly DEFAULT_DERIVATION_PATH: string = "m/44'/60'/0'/0"

  constructor(private entropy: EntropySource) {}

  public generateNewWallet(
    accountIndex: number = 0,
    wordCount: 12 | 15 | 18 | 21 | 24 = 12,
  ): EvmGeneratedWallet {
    const entropy = this.getEntropyForWordCount(wordCount)
    const randomBytesArray = this.entropy.randomBytes(entropy)
    const customMnemonic = Mnemonic.fromEntropy(randomBytesArray)

    const path = `${this.DEFAULT_DERIVATION_PATH}/${accountIndex}`
    const hdNode = HDNodeWallet.fromMnemonic(customMnemonic, path)

    return {
      address: hdNode.address,
      mnemonic: customMnemonic.phrase,
      privateKey: hdNode.privateKey,
      path,
    }
  }

  public generateMultipleWallets(
    mnemonic: string,
    count: number,
    startIndex: number = 0,
  ): EvmDerivedWallet[] {
    this.validateMnemonic(mnemonic)

    const wallets: EvmDerivedWallet[] = []
    const mnemonicObject = Mnemonic.fromPhrase(mnemonic)

    for (let i = 0; i < count; i++) {
      const accountIndex = startIndex + i
      const path = `${this.DEFAULT_DERIVATION_PATH}/${accountIndex}`
      const hdNode = HDNodeWallet.fromMnemonic(mnemonicObject, path)

      wallets.push({
        address: hdNode.address,
        privateKey: hdNode.privateKey,
        path,
        publicKey: hdNode.publicKey,
      })
    }

    return wallets
  }

  public deriveWalletFromMnemonic(
    mnemonic: string,
    accountIndex: number = 0,
    customPath?: string,
  ): EvmDerivedWallet {
    this.validateMnemonic(mnemonic)

    const path = customPath || `${this.DEFAULT_DERIVATION_PATH}/${accountIndex}`
    const mnemonicObject = Mnemonic.fromPhrase(mnemonic)
    const hdNode = HDNodeWallet.fromMnemonic(mnemonicObject, path)

    return {
      address: hdNode.address,
      privateKey: hdNode.privateKey,
      path,
      publicKey: hdNode.publicKey,
    }
  }

  public deriveFromPrivateKey(privateKey: string): Omit<EvmDerivedWallet, 'path'> {
    const wallet = new Wallet(privateKey)

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.signingKey.publicKey,
    }
  }

  public getFirstAvailableIndexForMnemonicImport(
    mnemonic: string,
    existingAddresses: string[],
    maxIndicesToCheck: number = 20,
  ): { index: number; wallet: EvmDerivedWallet } | null {
    this.validateMnemonic(mnemonic)

    const existingSet = new Set(existingAddresses.map((addr) => getAddress(addr)))

    for (let i = 0; i < maxIndicesToCheck; i++) {
      const wallet = this.deriveWalletFromMnemonic(mnemonic, i)
      const normalizedAddress = getAddress(wallet.address)
      if (!existingSet.has(normalizedAddress)) {
        return { index: i, wallet }
      }
    }

    return null
  }

  public async signMessage(privateKey: string, message: string): Promise<string> {
    const wallet = new Wallet(privateKey)
    return await wallet.signMessage(message)
  }

  isValidMnemonic(mnemonic: string): boolean {
    try {
      Mnemonic.fromPhrase(mnemonic)
      return true
    } catch {
      return false
    }
  }

  private validateMnemonic(mnemonic: string): void {
    if (!this.isValidMnemonic(mnemonic)) throw new Error('Invalid mnemonic phrase')
  }

  private getEntropyForWordCount(wordCount: 12 | 15 | 18 | 21 | 24): number {
    const entropyMap: Record<number, number> = {
      12: 16, // 128 bits
      15: 20, // 160 bits
      18: 24, // 192 bits
      21: 28, // 224 bits
      24: 32, // 256 bits
    }

    return entropyMap[wordCount]
  }
}
