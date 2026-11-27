import { afterEach } from 'vitest'

// Yield one macrotask turn between synchronous tests so worker birpc heartbeats flush promptly.
afterEach(() => new Promise<void>(resolve => setImmediate(resolve)))
