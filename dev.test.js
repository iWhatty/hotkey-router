import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from './core.js'
import { installDevWarnings } from './dev.js'

describe('installDevWarnings', () => {
  let router, warnings, uninstall
  const handler = () => {}

  beforeEach(() => {
    router = createRouter()
    warnings = { warn: vi.fn(), info: vi.fn() }
    uninstall = installDevWarnings(router, { platform: 'windows', browser: 'chrome', console: warnings })
  })

  it('warns once when a shifted key-based binding can never match on US layouts', () => {
    router.bind('ctrl+shift+,', handler)
    router.bind('ctrl+shift+,', handler)
    expect(warnings.warn).toHaveBeenCalledOnce()
    expect(warnings.warn.mock.calls[0][0]).toContain('ctrl+shift+code:Comma')
  })

  it('keeps the way the combo was written in the suggestion', () => {
    router.bind('mod+shift+/ up', handler)
    router.bind('^+.', handler)
    expect(warnings.warn.mock.calls[0][0]).toContain('"mod+shift+code:Slash up"')
    expect(warnings.warn.mock.calls[1][0]).toContain('"^+code:Period"')
  })

  it('accepts code: bindings, unshifted punctuation, and shifted letters', () => {
    const options = { warnOnReserved: false }
    router.bind('ctrl+shift+code:Comma', handler, null, options)
    router.bind('ctrl+,', handler, null, options)
    router.bind('ctrl+shift+k', handler, null, options)
    router.bind('shift+?', handler, null, options)
    expect(warnings.warn).not.toHaveBeenCalled()
  })

  it('warnOnReserved suppresses reservation warnings only', () => {
    const options = { warnOnReserved: false }
    router.bind('ctrl+t', handler, null, options)
    router.bind('ctrl+shift+1', handler, null, options)
    expect(warnings.warn).toHaveBeenCalledOnce()
    expect(warnings.warn.mock.calls[0][0]).toContain('ctrl+shift+code:Digit1')
  })

  it('uninstall removes both warnings', () => {
    uninstall()
    router.bind('ctrl+t', handler)
    router.bind('ctrl+shift+2', handler)
    expect(warnings.warn).not.toHaveBeenCalled()
    expect(warnings.info).not.toHaveBeenCalled()
  })
})
