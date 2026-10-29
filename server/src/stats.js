import { prisma } from './db.js';
import { TEAM } from './roles.js';

const won = (p) => TEAM[p.role] === p.game.winner;

export const ACHIEVEMENTS = {
  first_game: (s) => s.games >= 1,
  first_win: (s) => s.wins >= 1,
  veteran: (s) => s.games >= 10,
  wolf_win: (s) => s.winsAs.werewolf >= 1,
  seer_win: (s) => s.winsAs.seer >= 1,
  knight_win: (s) => s.winsAs.knight >= 1,
  medium_win: (s) => s.winsAs.medium >= 1,
  survivor: (s) => s.survivedWins >= 3,
};

function summarize(rows) {
  const s = { games: rows.length, wins: 0, survivedWins: 0, winsAs: { werewolf: 0, villager: 0, seer: 0, knight: 0, medium: 0 } };
  for (const p of rows) {
    if (!won(p)) continue;
    s.wins++;
    s.winsAs[p.role]++;
    if (p.alive) s.survivedWins++;
  }
  s.losses = s.games - s.wins;
  s.winRate = s.games ? Math.round((s.wins / s.games) * 100) : 0;
  // 10 xp per game played, 30 more per win; 100 xp per level
  s.xp = s.games * 10 + s.wins * 30;
  s.level = 1 + Math.floor(s.xp / 100);
  s.achievements = Object.keys(ACHIEVEMENTS).filter((k) => ACHIEVEMENTS[k](s));
  return s;
}

const finished = { game: { finishedAt: { not: null } } };

// Everyone who finished a game, best first: wins, then win rate, then fewer games.
export async function leaderboard() {
  const rows = await prisma.gamePlayer.findMany({
    where: finished,
    select: { userId: true, role: true, alive: true, game: { select: { winner: true } }, user: { select: { name: true, avatar: true } } },
  });
  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, { id: r.userId, name: r.user.name, avatar: r.user.avatar, rows: [] });
    byUser.get(r.userId).rows.push(r);
  }
  return [...byUser.values()]
    .map(({ rows: list, ...u }) => {
      const { games, wins, winRate, level } = summarize(list);
      return { ...u, games, wins, winRate, level };
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.games - b.games)
    .map((u, i) => ({ ...u, rank: i + 1 }));
}

export async function userStats(userId) {
  const rows = await prisma.gamePlayer.findMany({
    where: { userId, ...finished },
    orderBy: { game: { finishedAt: 'desc' } },
    select: {
      role: true, alive: true,
      game: {
        select: {
          id: true, winner: true, finishedAt: true, bots: true,
          players: { where: { userId: { not: userId } }, select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  const stats = summarize(rows);
  const board = await leaderboard();
  stats.rank = board.find((u) => u.id === userId)?.rank ?? null;
  stats.history = rows.slice(0, 20).map((p) => ({
    id: p.game.id,
    date: p.game.finishedAt,
    role: p.role,
    won: won(p),
    survived: p.alive,
    others: p.game.players.map((o) => o.user.name),
    bots: p.game.bots,
  }));
  return stats;
}
