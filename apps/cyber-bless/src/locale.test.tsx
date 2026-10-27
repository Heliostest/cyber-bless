// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { configureLocale } from '@wbr/i18n'
import { useDeveloperLocale } from './locale'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

afterEach(() => { configureLocale('zh-Hans'); document.body.replaceChildren() })
it('updates a mounted developer route without replacing its draft input', async () => {
  configureLocale('zh-Hans')
  const host = document.createElement('div'); document.body.append(host)
  function Probe() { const locale = useDeveloperLocale(); return <><p>{locale}</p><input defaultValue="写好了" /></> }
  const root = createRoot(host)
  await act(() => { root.render(<Probe />) })
  const input = host.querySelector('input')!; input.focus(); input.setSelectionRange(1, 2)
  await act(() => { configureLocale('en') })
  expect(host.querySelector('p')?.textContent).toBe('en')
  expect(host.querySelector('input')).toBe(input)
  expect(input.value).toBe('写好了'); expect(input.selectionStart).toBe(1)
  await act(() => { root.unmount() })
})
