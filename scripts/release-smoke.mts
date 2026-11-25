import hotkeys, { comboFromEvent, detectPlatform, parseHotkey } from 'hotkey-router'
import { createRouter } from 'hotkey-router/core'
import { installDevWarnings } from 'hotkey-router/dev'
import { HOTKEY_DATA } from 'hotkey-router/reservations'
import { trigger } from 'hotkey-router/testing'

const router = createRouter()
const uninstall: () => void = installDevWarnings(router)
const hotkey: string = parseHotkey('ctrl+k').raw
const triggered: boolean = trigger(router, hotkey)
const recorded: string | null = comboFromEvent(new KeyboardEvent('keydown'))
const platform: string | null = detectPlatform()
const schema: string = HOTKEY_DATA.version.schema
// @ts-expect-error Parsing is available as a named export.
hotkeys.parseHotkey(hotkey)
uninstall()
