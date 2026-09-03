const MOVEMENT_KEY_CODES = new Set(['KeyW', 'ArrowUp'])

export class ArchiveMovementGate {
  private blockedUntilRelease = new Set<string>()

  captureHeldKeys(heldKeys: ReadonlySet<string>) {
    heldKeys.forEach((code) => {
      if (MOVEMENT_KEY_CODES.has(code)) this.blockedUntilRelease.add(code)
    })
  }

  blocksTextInput(code: string) {
    return this.blockedUntilRelease.has(code)
  }

  release(code: string) {
    this.blockedUntilRelease.delete(code)
  }

  reset() {
    this.blockedUntilRelease.clear()
  }
}
