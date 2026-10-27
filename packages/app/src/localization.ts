import { translate, translateScene, formatDate } from '@wbr/i18n';
import { rituals, type Note, type State } from '@wbr/core';
import { builtInScenes } from '@wbr/core/daily-scenes';

/** Resolve generated display names by identity; unknown historical/remote names remain original. */
export function localizedTitle(item: { id: string; title: string; sceneId?: string; kind?: string }): string {
  if (item.kind === 'badge') return translate('如愿纪念章');
  if (item.kind && item.kind in rituals) return translate(rituals[item.kind as keyof typeof rituals].object);
  const known = builtInScenes.find(scene => scene.id === (item.sceneId ?? item.id));
  return known ? translateScene(known.title) : item.title;
}
export function localizedNote(note: Note, state: State): string {
  if (note.system?.type === 'ritual') return translate('为这个心愿，{p0}', { p0: translate(rituals[note.system.ritual].name) });
  if (note.system?.type === 'scene') {
    const sceneId = note.system.sceneId;
    const entry = builtInScenes.find(entry => entry.id === sceneId);
    return entry ? translate('为这个心愿，{p0}', { p0: translateScene(entry.title) }) : note.text;
  }
  // Legacy provenance requires both a machine ID and the exact corresponding generated text.
  const session = state.sessions.find(session => note.id === `ritual:${session.id}` && note.at === session.completedAt);
  if (session && note.text === `为这个心愿，${rituals[session.ritual].name}`)
    return translate('为这个心愿，{p0}', { p0: translate(rituals[session.ritual].name) });
  const vessel = state.collectibles.find(item => note.id === `vessel:${item.id}` && item.spentAt === note.at);
  if (vessel && note.text === `为这个心愿，${vessel.title}`)
    return translate('为这个心愿，{p0}', { p0: localizedTitle(vessel) });
  return note.text;
}
export const formatTime = (at: string) => formatDate(at, { hour: '2-digit', minute: '2-digit' });
