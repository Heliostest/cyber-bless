import type { GestureHandle } from './types'
import { formatNumber, graphemeLength, subscribeLocale, translate } from '@wbr/i18n'

export type WishWriteOpts = {
  maxLen?: number
  /**
   * Whether the host keeps the line (the App saves it as a new 心愿); the note
   * under the box says so. Hosts that keep nothing pass false.
   */
  saves?: boolean
  onSubmit?(text: string): void
}

/** Copy of the wish box. The line goes to `onSubmit`; the host may keep it. */
export const WISH_WRITE_COPY = {
  label: '写一句想说的话',
  placeholder: '写一句想说的话…',
  submit: '写好了',
  /** Under the box, when the host keeps the line. */
  note: '写好后会存进心愿',
  /** Under the box, when it keeps nothing. */
  unsaved: '只在此刻，不会保存',
  /** The host's confirmation once the line is kept. */
  saved: '已存进心愿',
  empty: '先写一句，再点「写好了」。',
} as const

let boxes = 0

export function createWishWrite(opts: WishWriteOpts): GestureHandle {
  const maxLen = opts.maxLen ?? 40
  const restingNote = opts.saves === false ? WISH_WRITE_COPY.unsaved : WISH_WRITE_COPY.note

  let el: HTMLElement | null = null
  let form: HTMLFormElement | null = null
  let input: HTMLInputElement | null = null
  let submit: HTMLButtonElement | null = null
  let note: HTMLSpanElement | null = null
  let count: HTMLSpanElement | null = null
  let enabled = true
  let composing = false
  let stopLocale = () => {}

  /** The note under the box, or a gentle nudge after an empty submit. */
  const setNudge = (on: boolean) => {
    if (!note) return
    note.textContent = translate(on ? WISH_WRITE_COPY.empty : restingNote)
    note.toggleAttribute('data-nudge', on)
  }

  const onInput = () => {
    if (!input || !count) return
    count.textContent = `${formatNumber(graphemeLength(input.value))}/${formatNumber(maxLen)}`
    if (note?.hasAttribute('data-nudge')) setNudge(false)
  }

  const onSubmit = (e: Event) => {
    e.preventDefault()
    if (!enabled || composing || !input) return
    const text = input.value.trim()
    if (text.length < 1) {
      setNudge(true)
      input.focus()
      return
    }
    if (graphemeLength(text) > maxLen) return
    opts.onSubmit?.(text)
  }
  const compositionStart = () => { composing = true }
  const compositionEnd = () => { composing = false; onInput() }
  const refreshCopy = () => {
    if (!input || !submit || !note || !count) return
    input.placeholder = translate(WISH_WRITE_COPY.placeholder)
    input.setAttribute('aria-label', translate(WISH_WRITE_COPY.label))
    submit.textContent = translate(WISH_WRITE_COPY.submit)
    note.textContent = translate(note.hasAttribute('data-nudge') ? WISH_WRITE_COPY.empty : restingNote)
    count.textContent = `${formatNumber(graphemeLength(input.value))}/${formatNumber(maxLen)}`
  }

  return {
    mount(target) {
      el = target
      const metaId = `wish-write-meta-${++boxes}`
      form = document.createElement('form')
      input = document.createElement('input')
      input.type = 'text'
      // The visible/product limit counts graphemes. This broader encoding cap only bounds input size.
      input.maxLength = Math.max(1024, maxLen * 32)
      input.placeholder = translate(WISH_WRITE_COPY.placeholder)
      input.enterKeyHint = 'done'
      input.setAttribute('aria-label', translate(WISH_WRITE_COPY.label))
      input.setAttribute('aria-describedby', metaId)
      submit = document.createElement('button')
      submit.type = 'submit'
      submit.textContent = translate(WISH_WRITE_COPY.submit)
      // Note (and nudges) on the left, n/maxLen on the right.
      const meta = document.createElement('p')
      meta.className = 'wish-write-meta'
      meta.id = metaId
      note = document.createElement('span')
      note.setAttribute('aria-live', 'polite')
      count = document.createElement('span')
      meta.append(note, count)
      setNudge(false)
      onInput()
      form.append(input, submit, meta)
      form.addEventListener('submit', onSubmit)
      input.addEventListener('input', onInput)
      input.addEventListener('compositionstart', compositionStart)
      input.addEventListener('compositionend', compositionEnd)
      stopLocale = subscribeLocale(refreshCopy)
      el.appendChild(form)
    },
    update() {},
    dispose() {
      stopLocale()
      if (form) {
        form.removeEventListener('submit', onSubmit)
        form.remove()
      }
      input?.removeEventListener('input', onInput)
      input?.removeEventListener('compositionstart', compositionStart)
      input?.removeEventListener('compositionend', compositionEnd)
      form = null
      input = null
      submit = null
      note = null
      count = null
      el = null
    },
    setEnabled(on) {
      enabled = on
      if (input) input.disabled = !on
      if (submit) submit.disabled = !on
    },
  }
}
