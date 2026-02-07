export interface EntropySource {
  randomBytes(length: number): Uint8Array
}
