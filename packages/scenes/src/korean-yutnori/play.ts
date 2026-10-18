export type YutPlay = {
  position: number
  mask: number
  turns: number
  phase: 'throw' | 'move' | 'again'
}

const MAX_TURNS = 999999

/** Each set bit is a flat face up; four round faces advance five spaces. */
export function yutSteps(mask: number): number {
  const faces = mask & 15
  let flat = 0
  for (let i = 0; i < 4; i++) flat += (faces >> i) & 1
  return flat || 5
}

export function encodeYutPlay(play: YutPlay): string {
  return `yut1-${play.position}-${play.mask}-${play.turns}-${play.phase}`
}

export function restoreYutPlay(raw: string | undefined, progress: number): YutPlay {
  const match = raw && raw.length <= 32 ? /^yut1-(0|[1-9][0-9]*)-(0|[1-9][0-9]*)-(0|[1-9][0-9]*)-(throw|move|again)$/.exec(raw) : null
  if (match && match[0] === raw) {
    const position = Number(match[1]), mask = Number(match[2]), turns = Number(match[3])
    if (position < 20 && mask < 16 && turns <= MAX_TURNS) return { position, mask, turns, phase: match[4] as YutPlay['phase'] }
  }
  const checkpoint = Number.isFinite(progress) ? progress : 0
  if (checkpoint >= 3) return { position: 2, mask: 5, turns: 1, phase: 'again' }
  if (checkpoint >= 2) return { position: 0, mask: 5, turns: 1, phase: 'move' }
  return { position: 0, mask: 5, turns: 0, phase: 'throw' }
}

export function throwYut(play: YutPlay, random: () => number = Math.random): YutPlay {
  if (play.phase === 'move') return play
  const sample = random()
  const normalized = Number.isFinite(sample) ? Math.min(1 - Number.EPSILON, Math.max(0, sample)) : 0
  return { ...play, mask: Math.floor(normalized * 16), turns: Math.min(MAX_TURNS, play.turns + 1), phase: 'move' }
}

export function moveYut(play: YutPlay): YutPlay {
  if (play.phase !== 'move') return play
  return { ...play, position: (play.position + yutSteps(play.mask)) % 20, phase: 'again' }
}
