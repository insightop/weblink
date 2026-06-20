import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { DeviceIdentityStore } from './DeviceIdentityStore'
import type { PersistedHardwareIdentity } from '../domain/types'

describe('DeviceIdentityStore', () => {
  let store: DeviceIdentityStore

  beforeEach(() => {
    store = new DeviceIdentityStore('test-device')
  })

  afterEach(async () => {
    await store.clear()
  })

  it('初始时加载返回 null', async () => {
    const result = await store.load()
    expect(result).toBeNull()
  })

  it('保存后加载返回相同值', async () => {
    const identity: PersistedHardwareIdentity = {
      type: 'serial',
      usbVendorId: 0x1a86,
      usbProductId: 0x7523,
      lastConfig: { baudRate: 115200 },
    }
    await store.save(identity)
    const loaded = await store.load()
    expect(loaded).toEqual(identity)
  })

  it('覆盖保存后加载返回新值', async () => {
    await store.save({ type: 'serial', usbVendorId: 0xaaaa, usbProductId: 0xbbbb })
    await store.save({ type: 'usb', usbVendorId: 0xcccc, usbProductId: 0xdddd })
    const loaded = await store.load()
    expect(loaded?.type).toBe('usb')
  })

  it('clear 后加载返回 null', async () => {
    await store.save({ type: 'serial' })
    await store.clear()
    const result = await store.load()
    expect(result).toBeNull()
  })

  it('不同 storageKey 的 store 互相独立', async () => {
    const storeA = new DeviceIdentityStore('key-a')
    const storeB = new DeviceIdentityStore('key-b')

    await storeA.save({ type: 'serial', usbVendorId: 0x1111, usbProductId: 0x2222 })
    await storeB.save({ type: 'usb', usbVendorId: 0x3333, usbProductId: 0x4444 })

    const loadedA = await storeA.load()
    const loadedB = await storeB.load()

    expect(loadedA?.usbVendorId).toBe(0x1111)
    expect(loadedB?.usbVendorId).toBe(0x3333)

    await storeA.clear()
    expect(await storeA.load()).toBeNull()
    expect(await storeB.load()).not.toBeNull() // B 不受影响

    await storeB.clear()
  })
})
