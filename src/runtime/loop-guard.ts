import { MaxDepthError } from './types.ts'

export class LoopGuard {
  private depth: number = 0
  private maxDepth: number

  constructor (maxDepth: number) {
    this.maxDepth = maxDepth
  }

  enter (): void {
    this.depth++
    if (this.depth > this.maxDepth) {
      throw new MaxDepthError(this.maxDepth)
    }
  }

  exit (): void {
    this.depth--
  }
}
