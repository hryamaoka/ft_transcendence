import { randomInt } from 'node:crypto';

export const ROLES = ['werewolf', 'villager', 'seer', 'knight', 'medium'];
export const TEAM = { werewolf: 'werewolves', villager: 'village', seer: 'village', knight: 'village', medium: 'village' };

// Returns an error code if the settings can't be used with this many players.
export function checkRoles(count, { werewolves, seer, knight, medium = 0 }) {
  if (werewolves < 1) return 'need_werewolf';
  // werewolves must start as a minority or the game is over at once
  if (werewolves * 2 >= count) return 'too_many_werewolves';
  if (werewolves + seer + knight + medium > count) return 'too_many_roles';
  return null;
}

// Fisher-Yates shuffle with a cryptographic RNG so roles can't be predicted.
export function assignRoles(userIds, { werewolves, seer, knight, medium }) {
  const roles = Array(werewolves).fill('werewolf');
  if (seer) roles.push('seer');
  if (knight) roles.push('knight');
  if (medium) roles.push('medium');
  while (roles.length < userIds.length) roles.push('villager');
  for (let i = roles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return new Map(userIds.map((id, i) => [id, roles[i]]));
}
