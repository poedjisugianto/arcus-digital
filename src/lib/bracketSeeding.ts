import { Archer, BracketPairingSystem, CategoryConfig, Match, ScoreEntry, TargetType } from '../types';

export interface RankedArcher extends Archer {
  total: number;
  sixes: number;
  fives: number;
}

/**
 * Menghasilkan urutan nomor seed standar World Archery untuk ukuran bagan 2, 4, 8, 16, 32, 64.
 * Contoh:
 * - 4 besar -> [1, 4, 3, 2] => Match 1 (1 vs 4), Match 2 (3 vs 2)
 * - 8 besar -> [1, 8, 5, 4, 3, 6, 7, 2] => 1 & 2 berada di sisi berlawanan (bertemu di Final)
 */
export function getWorldArcherySeedOrder(size: number): number[] {
  let seeds = [1, 2];
  let currentSize = 2;
  while (currentSize < size) {
    currentSize *= 2;
    const next: number[] = [];
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const opp = currentSize + 1 - s;
      if (i % 2 === 0) {
        next.push(s, opp);
      } else {
        next.push(opp, s);
      }
    }
    seeds = next;
  }
  return seeds;
}

/**
 * Mengembalikan pasangan peringkat [seedA, seedB] untuk babak pertama ukuran bagan tertentu.
 * - Jika ukuran === 4 dan sistem = 'TOP4_1V2_3V4' => [[1, 2], [3, 4]] (Semifinal lalu Final)
 * - Untuk 8 Besar ke atas atau sistem 'WORLD_ARCHERY' => mengikuti aturan World Archery
 */
export function getSeedPairsForSize(
  size: number,
  pairingSystem: BracketPairingSystem = 'WORLD_ARCHERY'
): Array<[number, number]> {
  if (size === 4 && pairingSystem === 'TOP4_1V2_3V4') {
    return [
      [1, 2],
      [3, 4]
    ];
  }

  const order = getWorldArcherySeedOrder(size);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < order.length; i += 2) {
    pairs.push([order[i], order[i + 1]]);
  }
  return pairs;
}

/**
 * Menghitung daftar peringkat atlet untuk penentuan posisi bagan eliminasi.
 * Jika ada babak penyaringan (ELIM_*) yang sudah memiliki skor > 0, gunakan sesi penyaringan terkecil tersebut;
 * jika belum ada, gunakan sesi kualifikasi (QUAL).
 */
export function buildRankedArchersForElimination(
  archersInCategory: Archer[],
  scoresList: ScoreEntry[] = [],
  config?: Partial<CategoryConfig> | null
): RankedArcher[] {
  let baseSession = 'QUAL';
  if (config?.eliminationStages && config.eliminationStages.length > 0) {
    const smallestStage = Math.min(...config.eliminationStages);
    const stageSession = `ELIM_${smallestStage}`;
    const hasStageScores = archersInCategory.some(archer =>
      scoresList.some(
        s => s.archerId === archer.id && s.sessionId === stageSession && !s.isDeleted && (s.total || 0) > 0
      )
    );
    if (hasStageScores) {
      baseSession = stageSession;
    }
  }

  const isSmallTarget =
    config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA;
  const isSixRing = config?.targetType === TargetType.TRADITIONAL_6_RING;
  const isFiveRing = config?.targetType === TargetType.FACE_5_RING;

  return archersInCategory
    .map(archer => {
      const archerScores = scoresList.filter(
        s => s.archerId === archer.id && s.sessionId === baseSession && !s.isDeleted
      );
      const total = archerScores.reduce((acc, curr) => acc + curr.total, 0);

      const manualSixes = archerScores.reduce((acc, curr) => acc + (curr.count6 || 0), 0);
      const manualFives = archerScores.reduce((acc, curr) => acc + (curr.count5 || 0), 0);

      const allArrows = archerScores.flatMap(s => s.arrows || []).filter(v => v !== -1);
      let arrowSixes = 0;
      let arrowFives = 0;
      if (isSmallTarget) {
        arrowSixes = allArrows.filter(v => v === 2).length;
        arrowFives = allArrows.filter(v => v === 1).length;
      } else if (isSixRing) {
        arrowSixes = allArrows.filter(v => v === 6).length;
        arrowFives = allArrows.filter(v => v === 5).length;
      } else if (isFiveRing) {
        arrowSixes = allArrows.filter(v => v === 5).length;
        arrowFives = allArrows.filter(v => v === 4).length;
      } else {
        arrowSixes = allArrows.filter(v => v === 'X' || v === 10 || v === 6).length;
        arrowFives = allArrows.filter(v => v === 9 || v === 5).length;
      }

      const hasManual = archerScores.some(s => s.count6 !== undefined);
      const sixes = hasManual ? manualSixes : arrowSixes;
      const fives = hasManual ? manualFives : arrowFives;

      return { ...archer, total, sixes, fives };
    })
    .filter(a => baseSession === 'QUAL' || a.total > 0)
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.sixes !== a.sixes) return b.sixes - a.sixes;
      return b.fives - a.fives;
    });
}

/**
 * Mengisi otomatis archerAId & archerBId pada match yang masih menyimpan seedRankA/seedRankB
 * dan belum dimulai (skor 0-0 & belum ada pemenang).
 */
export function syncMatchesWithRankedArchers(
  matches: Match[],
  rankedArchers: RankedArcher[]
): { updatedMatches: Match[]; changed: boolean } {
  if (!matches || matches.length === 0) {
    return { updatedMatches: matches, changed: false };
  }

  const scoredArchers = rankedArchers.filter(a => (a.total || 0) > 0);
  if (scoredArchers.length === 0) {
    return { updatedMatches: matches, changed: false };
  }

  let changed = false;
  const updatedMatches = matches.map(m => {
    const isLocked = Boolean(m.winnerId) || m.scoreA > 0 || m.scoreB > 0 || Boolean(m.isShootOff);
    if (isLocked || (!m.seedRankA && !m.seedRankB)) {
      return m;
    }

    const resolvedA = m.seedRankA ? scoredArchers[m.seedRankA - 1]?.id : m.archerAId;
    const resolvedB = m.seedRankB ? scoredArchers[m.seedRankB - 1]?.id : m.archerBId;

    const nextA = m.seedRankA ? resolvedA : m.archerAId;
    const nextB = m.seedRankB ? resolvedB : m.archerBId;

    if (nextA !== m.archerAId || nextB !== m.archerBId) {
      changed = true;
      return {
        ...m,
        archerAId: nextA,
        archerBId: nextB
      };
    }
    return m;
  });

  return { updatedMatches, changed };
}
