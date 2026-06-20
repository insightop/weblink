type Handler<T> = (payload: T) => void

export class TypedEventEmitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<unknown>>>()

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<unknown>)
    return () => this.off(event, handler)
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>)
  }

  removeAllListeners(): void {
    this.handlers.clear()
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      handler(payload)
    }
  }
}
