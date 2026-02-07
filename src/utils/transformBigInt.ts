/** npm imports */
import { ContractTransaction } from 'ethers'

export const transformBigInt = (obj: ContractTransaction) => {
  const newObj = { ...obj }
  for (let key in obj) {
    if (typeof obj[key as keyof ContractTransaction] === 'bigint')
      newObj[key as keyof ContractTransaction] = String(obj[key as keyof ContractTransaction])
  }

  return newObj
}
