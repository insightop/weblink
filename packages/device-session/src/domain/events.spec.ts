import { describe, expect, it, vi } from 'vitest'
import { TypedEventEmitter } from './events'

interface TestEvents {
  ping: void
  data: { value: number }
  msg: string
}

class TestEmitter extends TypedEventEmitter<TestEvents> {
  emit<K extends keyof TestEvents>(event: K, payload: TestEvents[K]): void {
    super.emit(event, payload)
  }
}

describe('TypedEventEmitter', () => {
  it('注册 handler 后 emit 调用 handler', () => {
    const emitter = new TestEmitter()
    const handler = vi.fn()
    emitter.on('ping', handler)
    emitter.emit('ping', undefined)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('多个 handler 同一事件均被调用', () => {
    const emitter = new TestEmitter()
    const h1 = vi.fn()
    const h2 = vi.fn()
    emitter.on('data', h1)
    emitter.on('data', h2)
    emitter.emit('data', { value: 42 })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
    expect(h1).toHaveBeenCalledWith({ value: 42 })
  })

  it('on 返回 unsubscribe 函数', () => {
    const emitter = new TestEmitter()
    const handler = vi.fn()
    const unsub = emitter.on('msg', handler)
    emitter.emit('msg', 'hello')
    expect(handler).toHaveBeenCalledOnce()

    unsub()
    emitter.emit('msg', 'world')
    expect(handler).toHaveBeenCalledTimes(1) // 仍然只调用一次
  })

  it('off 显式移除 handler', () => {
    const emitter = new TestEmitter()
    const handler = vi.fn()
    emitter.on('msg', handler)
    emitter.off('msg', handler)
    emitter.emit('msg', 'test')
    expect(handler).not.toHaveBeenCalled()
  })

  it('removeAllListeners 清空所有事件', () => {
    const emitter = new TestEmitter()
    const h1 = vi.fn()
    const h2 = vi.fn()
    emitter.on('ping', h1)
    emitter.on('data', h2)
    emitter.removeAllListeners()
    emitter.emit('ping', undefined)
    emitter.emit('data', { value: 1 })
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it('未注册的事件 emit 不报错', () => {
    const emitter = new TestEmitter()
    expect(() => emitter.emit('ping', undefined)).not.toThrow()
  })

  it('传递 payload 给 handler', () => {
    const emitter = new TestEmitter()
    const handler = vi.fn()
    emitter.on('data', handler)
    emitter.emit('data', { value: 99 })
    expect(handler).toHaveBeenCalledWith({ value: 99 })
  })
})
