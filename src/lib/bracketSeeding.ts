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

export interface CategoryScoringStage {
  sessionId: string;
  label: string;
  shortLabel: string;
  stageSize: number | null;
  ends: number;
  arrows: number;
}

export function getNormalizedScoreSession(sessionId?: string | number | null): string {
  if (!sessionId || sessionId === '1' || sessionId === '2' || sessionId === 1 || sessionId === 2) {
    return 'QUAL';
  }
  return String(sessionId);
}

export function getCategoryScoringStages(
  config?: Partial<CategoryConfig> | null
): CategoryScoringStage[] {
  const qualEnds = Math.max(1, Number(config?.ends) || 6);
  const qualArrows = Math.max(1, Number(config?.arrows) || 6);
  const stages: CategoryScoringStage[] = [
    {
      sessionId: 'QUAL',
      label: 'Kualifikasi',
      shortLabel: 'Kualifikasi',
      stageSize: null,
      ends: qualEnds,
      arrows: qualArrows
    }
  ];

  const elimSizes = Array.from(
    new Set(
      (config?.eliminationStages || [])
        .map((s: any) => parseInt(String(s), 10))
        .filter((s: number) => !isNaN(s) && s > 0)
    )
  ).sort((a, b) => b - a);

  const elimEnds = Math.max(1, Number(config?.eliminationEnds) || 2);
  const elimArrows = Math.max(1, Number(config?.eliminationArrows) || 6);

  elimSizes.forEach(size => {
    stages.push({
      sessionId: `ELIM_${size}`,
      label: `Eliminasi Top ${size}`,
      shortLabel: `Top ${size}`,
      stageSize: size,
      ends: elimEnds,
      arrows: elimArrows
    });
  });

  return stages;
}

export function buildRankedArchersForSession(
  archersInCategory: Archer[],
  scoresList: ScoreEntry[] = [],
  config?: Partial<CategoryConfig> | null,
  sessionId: string = 'QUAL'
): RankedArcher[] {
  const normTargetSession = getNormalizedScoreSession(sessionId);
  const isSmallTarget =
    config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA;
  const isSixRing = config?.targetType === TargetType.TRADITIONAL_6_RING;
  const isFiveRing = config?.targetType === TargetType.FACE_5_RING;

  return archersInCategory
    .map(archer => {
      const latestByEnd = new Map<number, ScoreEntry>();
      scoresList.forEach(s => {
        if (!s || s.isDeleted) return;
        if (String(s.archerId) !== String(archer.id)) return;
        if (getNormalizedScoreSession(s.sessionId) !== normTargetSession) return;
        const endIdx = Number(s.endIndex ?? 0);
        const existing = latestByEnd.get(endIdx);
        if (!existing || (s.lastUpdated || 0) >= (existing.lastUpdated || 0)) {
          latestByEnd.set(endIdx, s);
        }
      });

      const archerScores = Array.from(latestByEnd.values());
      const total = archerScores.reduce((acc, curr) => acc + (curr.total || 0), 0);

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
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.sixes !== a.sixes) return b.sixes - a.sixes;
      return b.fives - a.fives;
    });
}

export function getStageParticipantsAndCompletion(
  archersInCategory: Archer[],
  scoresList: ScoreEntry[] = [],
  config?: Partial<CategoryConfig> | null,
  sessionId: string = 'QUAL',
  extraSavedScores: ScoreEntry[] = []
): {
  isComplete: boolean;
  completedArchersCount: number;
  totalArchersCount: number;
  stageArchers: Archer[];
  qualifiedIds: Set<string>;
  rankMap: Record<string, number>;
  hasPreviousStageScores: boolean;
} {
  const mergedMap = new Map<string, ScoreEntry>();
  [...scoresList, ...extraSavedScores].forEach(s => {
    if (!s || !s.archerId) return;
    const sess = getNormalizedScoreSession(s.sessionId);
    const key = `${s.archerId}_${sess}_${Number(s.endIndex ?? 0)}`;
    const prev = mergedMap.get(key);
    if (!prev || (s.lastUpdated || 0) >= (prev.lastUpdated || 0)) {
      mergedMap.set(key, s);
    }
  });
  const effectiveScores = Array.from(mergedMap.values());

  const stages = getCategoryScoringStages(config);
  const currentStageIdx = stages.findIndex(st => st.sessionId === sessionId);
  const currentStage = stages[currentStageIdx] || stages[0];
  const withTargets = archersInCategory.filter(a => Number(a.targetNo) > 0);
  const baseArchers = withTargets.length > 0 ? withTargets : archersInCategory;

  let stageArchers: Archer[] = baseArchers;
  const rankMap: Record<string, number> = {};
  let hasPreviousStageScores = false;

  if (currentStageIdx > 0 && currentStage.stageSize) {
    const prevStage = stages[currentStageIdx - 1];
    const rankedPrev = buildRankedArchersForSession(
      baseArchers,
      effectiveScores,
      config,
      prevStage.sessionId
    );
    const scoredPrev = rankedPrev.filter(a => (a.total || 0) > 0);
    hasPreviousStageScores = scoredPrev.length > 0;

    if (hasPreviousStageScores) {
      const qualifiers = scoredPrev.slice(0, currentStage.stageSize);
      qualifiers.forEach((a, idx) => {
        rankMap[a.id] = idx + 1;
      });
      stageArchers = qualifiers;
    }
  }

  const qualifiedIds = new Set(stageArchers.map(a => a.id));
  const requiredEnds = currentStage.ends;

  let completedArchersCount = 0;
  stageArchers.forEach(archer => {
    const completedEnds = new Set<number>();
    effectiveScores.forEach(s => {
      if (s.isDeleted) return;
      if (String(s.archerId) !== String(archer.id)) return;
      if (getNormalizedScoreSession(s.sessionId) !== currentStage.sessionId) return;
      const endIdx = Number(s.endIndex);
      if (!isNaN(endIdx) && endIdx >= 0 && endIdx < requiredEnds) {
        completedEnds.add(endIdx);
      }
    });
    if (completedEnds.size >= requiredEnds) {
      completedArchersCount += 1;
    }
  });

  const totalArchersCount = stageArchers.length;
  const isComplete = totalArchersCount > 0 && completedArchersCount >= totalArchersCount;

  return {
    isComplete,
    completedArchersCount,
    totalArchersCount,
    stageArchers,
    qualifiedIds,
    rankMap,
    hasPreviousStageScores
  };
}

