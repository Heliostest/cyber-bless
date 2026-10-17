export const GLOBAL_DISCLAIMER =
  '本应用以互动场景呈现器物、文化与日常心意，不替代真实宗教仪式，也不承诺宗教效力。'

export const FORBIDDEN_SUCCESS_PHRASES = [
  '参拜成功',
  '作福完成',
  '通关',
  '功德',
] as const

export function assertSafeCopy(text: string): void {
  for (const p of FORBIDDEN_SUCCESS_PHRASES) {
    if (text.includes(p)) {
      throw new Error(`forbidden copy: contains "${p}"`)
    }
  }
}
