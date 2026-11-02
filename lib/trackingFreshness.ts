/**
 * Fraicheur de la position affichee sur les cartes de suivi.
 *
 * « En direct » s'affichait des qu'une position existait, meme vieille d'une
 * heure : le client voyait un repere fige presente comme du temps reel. Le
 * libelle dit maintenant l'age reel de la derniere position recue.
 */

// A 5 s d'intervalle d'envoi, une minute sans position ne s'explique pas par
// un simple arret a un feu.
export const LIVE_THRESHOLD_MS = 60_000;

export interface PositionFreshness {
  /** Libelle de la barre d'informations, ex. « Il y a 4 min ». */
  label: string;
  /** Libelle du badge plein ecran, ex. « IL Y A 4 MIN ». */
  badge: string;
  live: boolean;
}

export function getPositionFreshness(
  updatedAt: string | null,
  now: number,
  hasPosition: boolean,
): PositionFreshness {
  if (!hasPosition) return { label: 'Hors ligne', badge: 'HORS LIGNE', live: false };

  const age = updatedAt ? now - new Date(updatedAt).getTime() : 0;
  if (age < LIVE_THRESHOLD_MS) return { label: 'En direct', badge: 'EN DIRECT', live: true };

  const minutes = Math.round(age / 60_000);
  if (minutes < 60) {
    return { label: `Il y a ${minutes} min`, badge: `IL Y A ${minutes} MIN`, live: false };
  }
  return { label: 'Position ancienne', badge: 'POSITION ANCIENNE', live: false };
}
