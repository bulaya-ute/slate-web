import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver (it's a layout-dependent API and
// jsdom does no real layout) — every browser Slate actually runs in does.
// react-resizable-panels (the workspace shell's panel/resize mechanics)
// requires the constructor to exist to mount at all, so stub it here
// rather than in every test that renders the workspace shell.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
