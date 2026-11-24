import { ArcheryEvent, Archer, CategoryType, Match, TargetType } from '../types';
import { CATEGORY_LABELS, getCategoryDisplayName } from '../constants';
import { findCategoryConfig } from './firestoreUtils';

export type MedalGroupingMode = 'REGION' | 'CLUB';
export type MedalType = 'GOLD' | 'SILVER' | 'BRONZE';

export interface MedalWinnerDetail {
  category: string;
  categoryLabel: string;
  medal: MedalType;
  medalLabel: 'Emas' | 'Perak' | 'Perunggu';
  rank: 1 | 2 | 3;
  archerId: string;
  archerName: string;
  club: string;
  region: string;
  score: number;
  source: 'Babak Aduan' | 'Kualifikasi';
}

export interface ContingentMedalStanding {
  key: string;
  name: string;
  isUnspecified: boolean;
  rank: number;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  medals: MedalWinnerDetail[];
}

export interface MedalStandingsSummary {
  standings: ContingentMedalStanding[];
  allMedals: MedalWinnerDetail[];
  totalGold: number;
  totalSilver: number;
  totalBronze: number;
  totalMedals: number;
  categoryCountWithMedals: number;
  availableCategories: { key: string; label: string }[];
  missingGroupValueCount: number;
}

const normalizeContingentName = (raw?: string): { key: string; display: string; isUnspecified: boolean } => {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'individu / bebas') {
    return {
      key: '__UNSPECIFIED__',
      display: 'Belum Tercantum',
      isUnspecified: true
    };
  }
  return {
    key: cleaned.toLowerCase(),
    display: cleaned.toUpperCase(),
    isUnspecified: false
  };
};

export function computeMedalStandings(
  event: ArcheryEvent,
  mode: MedalGroupingMode = 'REGION',
  categoryFilter: string = 'ALL'
): MedalStandingsSummary {
  const fromArchers = (event.archers || []).filter(a => {
    const status = (a.status || 'PENDING').toUpperCase();
    return !['REJECTED', 'CANCELLED'].includes(status) && a.category !== CategoryType.OFFICIAL;
  });

  const fromRegs = (event.registrations || [])
    .filter((r: any) => {
      const status = (r.status || 'PENDING').toUpperCase();
      return !['REJECTED', 'CANCELLED'].includes(status) && r.regType !== 'OFFICIAL' && r.category !== CategoryType.OFFICIAL;
    })
    .map((r: any) => ({
      ...r,
      category: r.category as CategoryType,
      targetNo: r.targetNo || 0,
      wave: r.wave || 1
    }));

  const mergedMap = new Map<string, Archer>();
  fromRegs.forEach((r: any) => mergedMap.set(r.id, r));
  fromArchers.forEach(a => {
    const prev = mergedMap.get(a.id);
    mergedMap.set(a.id, {
      ...(prev || {}),
      ...a,
      region: (a.region && a.region.trim()) ? a.region : prev?.region
    });
  });

  const activeArchers = Array.from(mergedMap.values());
  const scoresList = event.scores || [];
  const matchesMap = (event.matches || {}) as Record<string, Match[]>;

  const configuredCats = event.settings?.categoryConfigs
    ? Object.keys(event.settings.categoryConfigs).filter(c => c !== CategoryType.OFFICIAL)
    : [];
  const archerCats = Array.from(
    new Set(activeArchers.map(a => String(a.category)).filter(c => c && c !== CategoryType.OFFICIAL))
  );
  const categoryKeys = Array.from(new Set([...configuredCats, ...archerCats]));

  const availableCategories = categoryKeys.map(cat => ({
    key: cat,
    label: getCategoryDisplayName(cat, event.settings?.categoryConfigs) || CATEGORY_LABELS[cat] || cat
  }));

  const targetCategoryKeys = categoryFilter === 'ALL'
    ? categoryKeys
    : categoryKeys.filter(c => c === categoryFilter);

  const allMedals: MedalWinnerDetail[] = [];
  const categoriesWithMedals = new Set<string>();

  targetCategoryKeys.forEach(cat => {
    const catConfig = findCategoryConfig(cat, event.settings?.categoryConfigs);
    const catLabel = getCategoryDisplayName(cat, event.settings?.categoryConfigs) || CATEGORY_LABELS[cat] || cat;
    const catArchers = activeArchers.filter(a => String(a.category) === cat);

    const rankedArchers = catArchers
      .map(archer => {
        const qualScores = scoresList.filter(
          s => s.archerId === archer.id && s.sessionId === 'QUAL' && !s.isDeleted
        );
        const total = qualScores.reduce((acc, curr) => acc + (curr.total || 0), 0);
        const manualSixes = qualScores.reduce((acc, curr) => acc + (curr.count6 || 0), 0);
        const manualFives = qualScores.reduce((acc, curr) => acc + (curr.count5 || 0), 0);

        const isSmallTarget =
          catConfig?.targetType === TargetType.PUTA ||
          catConfig?.targetType === TargetType.TRADITIONAL_PUTA;
        const isSixRing = catConfig?.targetType === TargetType.TRADITIONAL_6_RING;
        const isFiveRing = catConfig?.targetType === TargetType.FACE_5_RING;
        const allArrows = qualScores
          .flatMap(s => s.arrows || [])
          .filter(v => v !== undefined && v !== -1);

        let arrowSixes = 0;
        let arrowFives = 0;
        const h1 = catConfig?.highestScore1;
        const h2 = catConfig?.highestScore2;

        if (h1 || h2) {
          arrowSixes = allArrows.filter(v => {
            if (h1 === '10+X') return v === 10 || v === 'X';
            if (h1 === 'X') return v === 'X';
            const num = parseInt(h1 || '', 10);
            return !isNaN(num) ? v === num : false;
          }).length;
          arrowFives = allArrows.filter(v => {
            if (h2 === 'X') return v === 'X';
            const num = parseInt(h2 || '', 10);
            return !isNaN(num) ? v === num : false;
          }).length;
        } else if (isSmallTarget) {
          arrowSixes = allArrows.filter(v => v === 2).length;
          arrowFives = allArrows.filter(v => v === 1).length;
        } else if (isSixRing) {
          arrowSixes = allArrows.filter(v => v === 6).length;
          arrowFives = allArrows.filter(v => v === 5).length;
        } else if (isFiveRing) {
          arrowSixes = allArrows.filter(v => v === 5).length;
          arrowFives = allArrows.filter(v => v === 4).length;
        } else if (catConfig?.targetType === TargetType.FACE_MEGA_MENDUNG) {
          arrowSixes = allArrows.filter(v => v === 10).length;
          arrowFives = allArrows.filter(v => v === 9).length;
        } else {
          arrowSixes = allArrows.filter(v => v === 'X' || v === 10).length;
          arrowFives = allArrows.filter(v => v === 9).length;
        }

        const hasManual = qualScores.some(s => s.count6 !== undefined && s.count6 !== 0);
        return {
          ...archer,
          total,
          sixes: hasManual ? manualSixes : arrowSixes,
          fives: hasManual ? manualFives : arrowFives
        };
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.sixes !== a.sixes) return b.sixes - a.sixes;
        return b.fives - a.fives;
      });

    const catMatches = matchesMap[cat] || [];
    const finalMatch = catMatches.find(
      m => m.round === '2' && (m.status === 'COMPLETED' || Boolean(m.winnerId))
    );
    const bronzeMatch = catMatches.find(
      m => m.round === '1' && (m.status === 'COMPLETED' || Boolean(m.winnerId))
    );

    let goldId = finalMatch?.winnerId;
    let silverId = finalMatch?.winnerId
      ? (finalMatch.winnerId === finalMatch.archerAId ? finalMatch.archerBId : finalMatch.archerAId)
      : undefined;
    let bronzeId = bronzeMatch?.winnerId;

    const isFromBracket = Boolean(goldId || bronzeId);
    const sourceLabel: 'Babak Aduan' | 'Kualifikasi' = isFromBracket ? 'Babak Aduan' : 'Kualifikasi';

    if (!isFromBracket) {
      if (rankedArchers[0] && rankedArchers[0].total > 0) goldId = rankedArchers[0].id;
      if (rankedArchers[1] && rankedArchers[1].total > 0) silverId = rankedArchers[1].id;
      if (rankedArchers[2] && rankedArchers[2].total > 0) bronzeId = rankedArchers[2].id;
    }

    const podiumDefs: { rank: 1 | 2 | 3; medal: MedalType; medalLabel: 'Emas' | 'Perak' | 'Perunggu'; id?: string }[] = [
      { rank: 1, medal: 'GOLD', medalLabel: 'Emas', id: goldId },
      { rank: 2, medal: 'SILVER', medalLabel: 'Perak', id: silverId },
      { rank: 3, medal: 'BRONZE', medalLabel: 'Perunggu', id: bronzeId }
    ];

    podiumDefs.forEach(p => {
      if (!p.id) return;
      const found = rankedArchers.find(a => a.id === p.id) || catArchers.find(a => a.id === p.id);
      if (!found) return;

      categoriesWithMedals.add(cat);
      allMedals.push({
        category: cat,
        categoryLabel: catLabel,
        medal: p.medal,
        medalLabel: p.medalLabel,
        rank: p.rank,
        archerId: found.id,
        archerName: found.name,
        club: (found.club || '').trim() || '-',
        region: (found.region || '').trim() || '-',
        score: (found as any).total || 0,
        source: sourceLabel
      });
    });
  });

  const groupMap = new Map<string, ContingentMedalStanding>();
  let missingGroupValueCount = 0;

  allMedals.forEach(item => {
    const rawGroupVal = mode === 'REGION' ? item.region : item.club;
    const norm = normalizeContingentName(rawGroupVal);
    if (norm.isUnspecified) missingGroupValueCount += 1;

    let entry = groupMap.get(norm.key);
    if (!entry) {
      entry = {
        key: norm.key,
        name: norm.display,
        isUnspecified: norm.isUnspecified,
        rank: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        total: 0,
        medals: []
      };
      groupMap.set(norm.key, entry);
    }

    if (item.medal === 'GOLD') entry.gold += 1;
    else if (item.medal === 'SILVER') entry.silver += 1;
    else if (item.medal === 'BRONZE') entry.bronze += 1;

    entry.total += 1;
    entry.medals.push(item);
  });

  const medalOrder: Record<MedalType, number> = { GOLD: 1, SILVER: 2, BRONZE: 3 };

  const sortedStandings = Array.from(groupMap.values())
    .map(entry => ({
      ...entry,
      medals: [...entry.medals].sort((a, b) => {
        if (medalOrder[a.medal] !== medalOrder[b.medal]) {
          return medalOrder[a.medal] - medalOrder[b.medal];
        }
        return a.categoryLabel.localeCompare(b.categoryLabel, 'id');
      })
    }))
    .sort((a, b) => {
      if (a.isUnspecified !== b.isUnspecified) return a.isUnspecified ? 1 : -1;
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, 'id');
    });

  // Assign Olympic-style rank (shared rank when Gold, Silver, Bronze counts match)
  let currentRank = 0;
  let lastKey = '';
  sortedStandings.forEach((item, index) => {
    const sig = `${item.gold}-${item.silver}-${item.bronze}`;
    if (index === 0 || sig !== lastKey) {
      currentRank = index + 1;
      lastKey = sig;
    }
    item.rank = currentRank;
  });

  const totalGold = allMedals.filter(m => m.medal === 'GOLD').length;
  const totalSilver = allMedals.filter(m => m.medal === 'SILVER').length;
  const totalBronze = allMedals.filter(m => m.medal === 'BRONZE').length;

  return {
    standings: sortedStandings,
    allMedals,
    totalGold,
    totalSilver,
    totalBronze,
    totalMedals: allMedals.length,
    categoryCountWithMedals: categoriesWithMedals.size,
    availableCategories,
    missingGroupValueCount
  };
}
