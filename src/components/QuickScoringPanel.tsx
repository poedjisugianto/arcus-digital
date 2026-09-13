import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Target, CheckCircle2, ChevronRight, ChevronLeft, 
  Save, User, Zap, Hash, Trophy, Keyboard, Search, X, Trash2,
  ScanLine, Lock, ShieldCheck, ChevronsLeft, ChevronsRight,
  Info, RotateCcw, Check, Sparkles, Monitor, Maximize2, Minimize2,
  Sliders, SlidersHorizontal
} from 'lucide-react';
import { ArcheryEvent, ScoreEntry, Archer, CategoryType, TargetType, ScoreLog, ScorerAccess, CategoryConfig } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { findCategoryConfig } from '../lib/firestoreUtils';
import QRScanner from './QRScanner';

interface Props {
  event: ArcheryEvent;
  currentScorer?: ScorerAccess | null;
  onSaveScore: (score: ScoreEntry | ScoreEntry[], log?: ScoreLog | ScoreLog[]) => void;
  onBack: () => void;
}

export type ArrowVal = number | 'X' | 'M' | -1;

interface ArcherScoreState {
  arrows: ArrowVal[];
  total: number;
  count6: number;
  count5: number;
  isManualTotal?: boolean;
}

export function getScoreTimestamp(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val.seconds !== undefined) {
    return val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1e6 : 0);
  }
  if (typeof val === 'string') {
    const t = Date.parse(val);
    return isNaN(t) ? 0 : t;
  }
  return 0;
}

/**
 * Styling helper strictly adhering to saved Face Target colors:
 * - World Archery 10-Ring: Gold (X, 10, 9), Red (8, 7), Blue (6, 5), Black (4, 3), White (2, 1), Green (M)
 * - Puta / Traditional Puta: Maroon (2 - Hit), Yellow/Gold (1 - Poin), Dark (M - Miss)
 * - Traditional 6-Ring: Gold (6, 5, 4), Red (3), White (2), Blue (1), Dark (M)
 * - Face 5-Ring (U9/U12): Gold (5), Red (4), Blue (3), Black (2), White (1), Green (M)
 */
export function getArrowTargetStyle(val: number | 'X' | 'M' | string | -1, targetType?: TargetType) {
  if (val === -1 || val === '' || val === undefined) {
    return {
      bg: 'bg-white',
      text: 'text-slate-300',
      border: 'border-slate-200 border-dashed',
      label: '-'
    };
  }

  // 1. PUTA & TRADITIONAL PUTA
  if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
    if (val === 2 || val === '2') {
      return { bg: 'bg-[#800000]', text: 'text-white', border: 'border-[#600000]', label: '2' };
    }
    if (val === 1 || val === '1') {
      return { bg: 'bg-yellow-400', text: 'text-slate-900', border: 'border-yellow-600', label: '1' };
    }
    return { bg: 'bg-slate-900', text: 'text-white', border: 'border-slate-700', label: 'M' };
  }

  // 2. TRADITIONAL 6-RING
  if (targetType === TargetType.TRADITIONAL_6_RING) {
    const num = Number(val);
    if (num === 6 || num === 5 || num === 4) {
      return { bg: 'bg-yellow-400', text: 'text-slate-900', border: 'border-yellow-600', label: String(num) };
    }
    if (num === 3) {
      return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', label: '3' };
    }
    if (num === 2) {
      return { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', label: '2' };
    }
    if (num === 1) {
      return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700', label: '1' };
    }
    return { bg: 'bg-slate-900', text: 'text-white', border: 'border-slate-700', label: 'M' };
  }

  // 3. FACE 5-RING (U9 / U12)
  if (targetType === TargetType.FACE_5_RING) {
    const num = Number(val);
    if (num === 5) {
      return { bg: 'bg-yellow-400', text: 'text-slate-900', border: 'border-yellow-600', label: '5' };
    }
    if (num === 4) {
      return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', label: '4' };
    }
    if (num === 3) {
      return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700', label: '3' };
    }
    if (num === 2) {
      return { bg: 'bg-slate-900', text: 'text-white', border: 'border-slate-700', label: '2' };
    }
    if (num === 1) {
      return { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', label: '1' };
    }
    return { bg: 'bg-emerald-800', text: 'text-white', border: 'border-emerald-950', label: 'M' };
  }

  // 4. FACE MEGA MENDUNG (FESPATI STANDAR RESMI)
  // Spot Atas: 10 & 9 (Kuning), 8 (Merah), 7 (Putih)
  // Spot Bawah: 6 (Kuning), 5 (Merah), 4 (Putih), 3 (Biru Muda/Cyan)
  // Kontur Luar: 2 (Biru Tua/Navy)
  // Lingkaran Luar 100cm: 1 (Putih)
  // Luar Target: M (Hitam)
  if (targetType === TargetType.FACE_MEGA_MENDUNG) {
    if (val === 'X') {
      return { bg: 'bg-yellow-400', text: 'text-slate-900', border: 'border-yellow-500', label: 'X' };
    }
    const num = Number(val);
    if (num === 10 || num === 9 || num === 6) {
      return { bg: 'bg-yellow-400', text: 'text-slate-900', border: 'border-yellow-500', label: String(num) };
    }
    if (num === 8 || num === 5) {
      return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', label: String(num) };
    }
    if (num === 7 || num === 4 || num === 1) {
      return { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-400', label: String(num) };
    }
    if (num === 3) {
      return { bg: 'bg-sky-400', text: 'text-slate-900', border: 'border-sky-500', label: '3' };
    }
    if (num === 2) {
      return { bg: 'bg-blue-900', text: 'text-white', border: 'border-blue-950', label: '2' };
    }
    return { bg: 'bg-slate-900', text: 'text-white', border: 'border-slate-700', label: 'M' };
  }

  // 5. STANDARD 10-RING FACE (FACE_122, FACE_80, FACE_60, FACE_40, FACE_3X20, STANDARD)
  if (val === 'X' || val === 10 || val === '10' || val === 9 || val === '9') {
    return { bg: 'bg-yellow-400', text: 'text-slate-900', border: 'border-yellow-500', label: String(val) };
  }
  if (val === 8 || val === '8' || val === 7 || val === '7') {
    return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', label: String(val) };
  }
  if (val === 6 || val === '6' || val === 5 || val === '5') {
    return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700', label: String(val) };
  }
  if (val === 4 || val === '4' || val === 3 || val === '3') {
    return { bg: 'bg-slate-900', text: 'text-white', border: 'border-slate-700', label: String(val) };
  }
  if (val === 2 || val === '2' || val === 1 || val === '1') {
    return { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', label: String(val) };
  }
  return { bg: 'bg-emerald-800', text: 'text-white', border: 'border-emerald-950', label: 'M' };
}

/**
 * Helper to calculate total, 10s/6s, and 9s/5s based on target type
 */
function calculateEndSummary(arrows: ArrowVal[], targetType?: TargetType, catConfig?: CategoryConfig | null) {
  let total = 0;
  let count6 = 0;
  let count5 = 0;

  const h1 = catConfig?.highestScore1;
  const h2 = catConfig?.highestScore2;

  arrows.forEach(v => {
    if (v === -1 || v === 'M' || v === 0) return;

    if (h1 || h2) {
      if (h1 === '10+X') {
        if (v === 10 || v === 'X') count6 += 1;
      } else if (h1 === 'X') {
        if (v === 'X') count6 += 1;
      } else {
        const num1 = parseInt(h1 || '');
        if (!isNaN(num1) && v === num1) count6 += 1;
      }

      if (h2 === 'X') {
        if (v === 'X') count5 += 1;
      } else {
        const num2 = parseInt(h2 || '');
        if (!isNaN(num2) && v === num2) count5 += 1;
      }

      const num = v === 'X' ? 10 : Number(v);
      total += (isNaN(num) ? 0 : num);
    } else if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      if (v === 2) {
        count6 += 1;
        total += 2;
      } else if (v === 1) {
        count5 += 1;
        total += 1;
      }
    } else if (targetType === TargetType.TRADITIONAL_6_RING) {
      const num = Number(v);
      if (num === 6) count6 += 1;
      if (num === 5) count5 += 1;
      total += num;
    } else if (targetType === TargetType.FACE_5_RING) {
      const num = Number(v);
      if (num === 5) count6 += 1;
      if (num === 4) count5 += 1;
      total += num;
    } else if (targetType === TargetType.FACE_MEGA_MENDUNG) {
      const num = Number(v);
      if (num === 10) count6 += 1;
      if (num === 9) count5 += 1;
      total += num;
    } else {
      // Standard 10-Ring
      if (v === 'X' || v === 10) count6 += 1;
      if (v === 9) count5 += 1;
      const num = v === 'X' ? 10 : Number(v);
      total += (isNaN(num) ? 0 : num);
    }
  });

  return { total, count6, count5 };
}

/**
 * Keypad options per target type
 */
function getKeypadOptions(targetType?: TargetType): (number | 'X' | 'M')[] {
  if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
    return [2, 1, 'M'];
  }
  if (targetType === TargetType.TRADITIONAL_6_RING) {
    return [6, 5, 4, 3, 2, 1, 'M'];
  }
  if (targetType === TargetType.FACE_5_RING) {
    return [5, 4, 3, 2, 1, 'M'];
  }
  if (targetType === TargetType.FACE_3X20) {
    return ['X', 10, 9, 8, 7, 6, 'M'];
  }
  return ['X', 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 'M'];
}

const QuickScoringPanel: React.FC<Props> = ({ event, currentScorer, onSaveScore, onBack }) => {
  const [mode, setMode] = useState<'TARGET' | 'CATEGORY'>('TARGET');
  
  const allowedTargets = useMemo(() => {
    const total = event.settings?.totalTargets || 1;
    const allTargets = Array.from({ length: total }, (_, i) => i + 1);
    if (!currentScorer || !currentScorer.assignedTargets || currentScorer.assignedTargets.length === 0) {
      return allTargets;
    }
    const filtered = currentScorer.assignedTargets.filter(t => t >= 1 && t <= total);
    return filtered.length > 0 ? filtered : allTargets;
  }, [event.settings?.totalTargets, currentScorer]);

  const [selectedTarget, setSelectedTarget] = useState<number>(() => allowedTargets[0] || 1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'ALL'>('ALL');
  const [currentEnd, setCurrentEnd] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showKeypad, setShowKeypad] = useState(true);

  // Density & PC Screen Viewport settings (default 'compact' for optimal PC display)
  const [density, setDensityState] = useState<'compact' | 'normal'>(() => {
    try {
      return (localStorage.getItem('quick_scoring_density') as 'compact' | 'normal') || 'compact';
    } catch {
      return 'compact';
    }
  });

  const setDensity = (val: 'compact' | 'normal') => {
    setDensityState(val);
    try {
      localStorage.setItem('quick_scoring_density', val);
    } catch {}
  };

  const [zoomScale, setZoomScaleState] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('quick_scoring_zoom'));
      return saved >= 75 && saved <= 125 ? saved : 100;
    } catch {
      return 100;
    }
  });

  const setZoomScale = (val: number) => {
    setZoomScaleState(val);
    try {
      localStorage.setItem('quick_scoring_zoom', val.toString());
    } catch {}
  };

  const [autoAdvanceTarget, setAutoAdvanceTargetState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('quick_scoring_auto_advance');
      return saved !== null ? saved === 'true' : false; // Default false: stay on current target so user sees confirmation
    } catch {
      return false;
    }
  });

  const setAutoAdvanceTarget = (val: boolean) => {
    setAutoAdvanceTargetState(val);
    try {
      localStorage.setItem('quick_scoring_auto_advance', String(val));
    } catch {}
  };

  // Active focus: [archerId, arrowIndex]
  const [activeCell, setActiveCell] = useState<{ archerId: string; arrowIdx: number } | null>(null);
  
  // Local state for arrows and scores per archer
  const [localArcherScores, setLocalArcherScores] = useState<Record<string, ArcherScoreState>>({});
  const [dirtyArchers, setDirtyArchers] = useState<Record<string, boolean>>({});

  // Refs for direct input elements
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Ensure selected target is valid
  useEffect(() => {
    if (!allowedTargets.includes(selectedTarget)) {
      setSelectedTarget(allowedTargets[0] || 1);
    }
  }, [allowedTargets, selectedTarget]);

  const availableCategories = useMemo(() => {
    return Array.from(new Set(event.archers.map(a => a.category)));
  }, [event.archers]);

  // Archers in active scope
  const archersInScope = useMemo(() => {
    if (mode === 'TARGET') {
      return event.archers.filter(a => a.targetNo === selectedTarget && allowedTargets.includes(a.targetNo));
    } else {
      return event.archers.filter(a => 
        (selectedCategory === 'ALL' || a.category === selectedCategory) &&
        allowedTargets.includes(a.targetNo)
      );
    }
  }, [event.archers, selectedTarget, selectedCategory, mode, allowedTargets]);

  // Sorted by position A, B, C, D
  const archersToDisplay = useMemo(() => {
    let filtered = [...archersInScope];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        (a.name || '').toLowerCase().includes(term) || 
        (a.club || '').toLowerCase().includes(term) ||
        `${a.targetNo || ''}${a.position || ''}`.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => {
      const wA = a.wave || 1;
      const wB = b.wave || 1;
      if (wA !== wB) return wA - wB;

      const tA = (a.targetNo === 0 || a.targetNo === undefined) ? 9999 : a.targetNo;
      const tB = (b.targetNo === 0 || b.targetNo === undefined) ? 9999 : b.targetNo;
      if (tA !== tB) return tA - tB;

      return (a.position || "").localeCompare(b.position || "");
    });
  }, [archersInScope, searchTerm]);

  // Determine max arrows per end among archers in scope (usually 6 or 3)
  const maxArrowsInScope = useMemo(() => {
    if (archersToDisplay.length === 0) return 6;
    let max = 6;
    archersToDisplay.forEach(a => {
      const config = (event.settings?.categoryConfigs || {})[a.category as CategoryType];
      if (config?.arrows && config.arrows > max) max = config.arrows;
    });
    return max;
  }, [archersToDisplay, event.settings?.categoryConfigs]);

  // Determine total ends from category config or default 6
  const totalEnds = useMemo(() => {
    if (archersToDisplay.length === 0) return 6;
    const firstArcher = archersToDisplay[0];
    const config = (event.settings?.categoryConfigs || {})[firstArcher.category as CategoryType];
    return config?.ends || 6;
  }, [archersToDisplay, event.settings?.categoryConfigs]);

  // Load existing scores into local state when switching Target or End
  useEffect(() => {
    const newScores: Record<string, ArcherScoreState> = {};
    const scoresList = event.scores || [];

    archersToDisplay.forEach(a => {
      const config = findCategoryConfig(a.category, event.settings?.categoryConfigs);
      const numArrows = config?.arrows || 6;

      const existing = scoresList
        .filter(s => {
          if (!s || s.isDeleted) return false;
          const norm = (s.sessionId === '1' || s.sessionId === '2' || !s.sessionId) ? 'QUAL' : s.sessionId;
          const isSameArcher = String(s.archerId) === String(a.id);
          const isSameEnd = Number(s.endIndex) === Number(currentEnd);
          return isSameArcher && isSameEnd && norm === 'QUAL';
        })
        .sort((scoreA, scoreB) => getScoreTimestamp(scoreB.lastUpdated) - getScoreTimestamp(scoreA.lastUpdated))[0];

      if (existing) {
        let loadedArrows: ArrowVal[] = new Array(numArrows).fill(-1);
        if (Array.isArray(existing.arrows) && existing.arrows.length > 0) {
          loadedArrows = existing.arrows.slice(0, numArrows).map((v: any): ArrowVal => {
            if (v === -1 || v === null || v === undefined) return -1;
            if (v === 'X' || v === 'x') return 'X';
            if (v === 'M' || v === 'm') return 'M';
            const num = Number(v);
            return isNaN(num) ? -1 : num;
          });
          while (loadedArrows.length < numArrows) {
            loadedArrows.push(-1);
          }
        }

        const summary = calculateEndSummary(loadedArrows, config?.targetType, config);
        newScores[a.id] = {
          arrows: loadedArrows,
          total: existing.total !== undefined ? existing.total : summary.total,
          count6: existing.count6 !== undefined ? existing.count6 : summary.count6,
          count5: existing.count5 !== undefined ? existing.count5 : summary.count5,
          isManualTotal: false
        };
      } else {
        newScores[a.id] = {
          arrows: new Array(numArrows).fill(-1),
          total: 0,
          count6: 0,
          count5: 0,
          isManualTotal: false
        };
      }
    });

    setLocalArcherScores(newScores);
    setDirtyArchers({});
  }, [selectedTarget, currentEnd, mode, selectedCategory, archersToDisplay, event.scores, event.settings?.categoryConfigs]);

  const tableArcherConfig = useMemo(() => {
    const focusedArcher = archersToDisplay.find(a => a.id === activeCell?.archerId) || archersToDisplay[0];
    if (!focusedArcher) return null;
    return findCategoryConfig(focusedArcher.category, event.settings?.categoryConfigs);
  }, [archersToDisplay, activeCell, event.settings?.categoryConfigs]);

  const scoringColumnLabels = useMemo(() => {
    if (tableArcherConfig?.highestScore1 || tableArcherConfig?.highestScore2) {
      return {
        col1: tableArcherConfig.highestScore1 || '10+X',
        col2: tableArcherConfig.highestScore2 || 'X'
      };
    }
    const t = tableArcherConfig?.targetType;
    if (t === TargetType.PUTA || t === TargetType.TRADITIONAL_PUTA) {
      return { col1: '2s', col2: '1s' };
    }
    if (t === TargetType.TRADITIONAL_6_RING) {
      return { col1: '6s', col2: '5s' };
    }
    if (t === TargetType.FACE_5_RING) {
      return { col1: '5s', col2: '4s' };
    }
    if (t === TargetType.FACE_MEGA_MENDUNG) {
      return { col1: '10s', col2: '9s' };
    }
    return { col1: '10+X / 6s', col2: 'X / 5s' };
  }, [tableArcherConfig]);

  // Calculate cumulative scores (Total score before this end)
  const cumulativeScores = useMemo(() => {
    const scoresList = event.scores || [];
    const map: Record<string, number> = {};

    archersToDisplay.forEach(a => {
      let pastTotal = 0;
      scoresList.forEach(s => {
        if (!s || s.isDeleted) return;
        const norm = (s.sessionId === '1' || s.sessionId === '2' || !s.sessionId) ? 'QUAL' : s.sessionId;
        const isSameArcher = String(s.archerId) === String(a.id);
        const endNum = Number(s.endIndex ?? 0);
        if (isSameArcher && norm === 'QUAL' && !isNaN(endNum) && endNum < currentEnd) {
          pastTotal += (s.total || 0);
        }
      });
      map[a.id] = pastTotal;
    });

    return map;
  }, [archersToDisplay, event.scores, currentEnd]);

  // Target completion overview for rapid visual status
  const targetCompletionMap = useMemo(() => {
    const scoresList = event.scores || [];
    const res: Record<number, 'FULL' | 'PARTIAL' | 'EMPTY'> = {};

    allowedTargets.forEach(tNum => {
      const archersOnTarget = event.archers.filter(a => a.targetNo === tNum);
      if (archersOnTarget.length === 0) {
        res[tNum] = 'EMPTY';
        return;
      }

      let scoredCount = 0;
      archersOnTarget.forEach(a => {
        const hasScore = scoresList.some(s => 
          !s.isDeleted && 
          s.archerId === a.id && 
          s.endIndex === currentEnd && 
          (s.sessionId === 'QUAL' || !s.sessionId || s.sessionId === '1')
        );
        if (hasScore) scoredCount++;
      });

      if (scoredCount === archersOnTarget.length) {
        res[tNum] = 'FULL';
      } else if (scoredCount > 0) {
        res[tNum] = 'PARTIAL';
      } else {
        res[tNum] = 'EMPTY';
      }
    });

    return res;
  }, [event.archers, event.scores, allowedTargets, currentEnd]);

  // Move focus to next arrow cell, or next archer's first cell
  const advanceToNextCell = useCallback((archerId: string, arrowIdx: number) => {
    const archerIdx = archersToDisplay.findIndex(a => a.id === archerId);
    if (archerIdx === -1) return;

    const a = archersToDisplay[archerIdx];
    const config = (event.settings?.categoryConfigs || {})[a.category as CategoryType];
    const maxArrows = config?.arrows || 6;

    if (arrowIdx < maxArrows - 1) {
      // Next arrow of same archer
      const nextIdx = arrowIdx + 1;
      setActiveCell({ archerId, arrowIdx: nextIdx });
      cellRefs.current[`${archerId}-${nextIdx}`]?.focus();
    } else {
      // Last arrow of this archer -> jump to first arrow of NEXT archer
      if (archerIdx < archersToDisplay.length - 1) {
        const nextArcher = archersToDisplay[archerIdx + 1];
        setActiveCell({ archerId: nextArcher.id, arrowIdx: 0 });
        cellRefs.current[`${nextArcher.id}-0`]?.focus();
      } else {
        // All archers on target filled! Keep active or focus save
        setActiveCell(null);
      }
    }
  }, [archersToDisplay, event.settings?.categoryConfigs]);

  // Move focus to previous arrow cell
  const retreatToPreviousCell = useCallback((archerId: string, arrowIdx: number) => {
    const archerIdx = archersToDisplay.findIndex(a => a.id === archerId);
    if (archerIdx === -1) return;

    if (arrowIdx > 0) {
      const prevIdx = arrowIdx - 1;
      setActiveCell({ archerId, arrowIdx: prevIdx });
      cellRefs.current[`${archerId}-${prevIdx}`]?.focus();
    } else if (archerIdx > 0) {
      const prevArcher = archersToDisplay[archerIdx - 1];
      const prevConfig = (event.settings?.categoryConfigs || {})[prevArcher.category as CategoryType];
      const prevMax = (prevConfig?.arrows || 6) - 1;
      setActiveCell({ archerId: prevArcher.id, arrowIdx: prevMax });
      cellRefs.current[`${prevArcher.id}-${prevMax}`]?.focus();
    }
  }, [archersToDisplay, event.settings?.categoryConfigs]);

  // Set an arrow's value and auto calculate
  const handleSetArrowValue = useCallback((archerId: string, arrowIdx: number, val: number | 'X' | 'M' | -1) => {
    const archer = archersToDisplay.find(a => a.id === archerId);
    const config = findCategoryConfig(archer?.category, event.settings?.categoryConfigs);

    setLocalArcherScores(prev => {
      const current = prev[archerId] || {
        arrows: new Array(config?.arrows || 6).fill(-1),
        total: 0,
        count6: 0,
        count5: 0
      };

      const newArrows = [...current.arrows];
      newArrows[arrowIdx] = val;

      const summary = calculateEndSummary(newArrows, config?.targetType, config);

      return {
        ...prev,
        [archerId]: {
          arrows: newArrows,
          total: summary.total,
          count6: summary.count6,
          count5: summary.count5,
          isManualTotal: false
        }
      };
    });

    setDirtyArchers(prev => ({ ...prev, [archerId]: true }));

    // If a valid value was placed (not clearing to -1), auto advance!
    if (val !== -1) {
      advanceToNextCell(archerId, arrowIdx);
    }
  }, [archersToDisplay, event.settings?.categoryConfigs, advanceToNextCell]);

  // Handle keystrokes on cell
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    archerId: string,
    arrowIdx: number,
    targetType?: TargetType
  ) => {
    const key = e.key;

    // Navigation Keys
    if (key === 'ArrowRight') {
      e.preventDefault();
      advanceToNextCell(archerId, arrowIdx);
      return;
    }
    if (key === 'ArrowLeft') {
      e.preventDefault();
      retreatToPreviousCell(archerId, arrowIdx);
      return;
    }
    if (key === 'ArrowDown') {
      e.preventDefault();
      const currentArcherIdx = archersToDisplay.findIndex(a => a.id === archerId);
      if (currentArcherIdx < archersToDisplay.length - 1) {
        const nextA = archersToDisplay[currentArcherIdx + 1];
        cellRefs.current[`${nextA.id}-${arrowIdx}`]?.focus();
      }
      return;
    }
    if (key === 'ArrowUp') {
      e.preventDefault();
      const currentArcherIdx = archersToDisplay.findIndex(a => a.id === archerId);
      if (currentArcherIdx > 0) {
        const prevA = archersToDisplay[currentArcherIdx - 1];
        cellRefs.current[`${prevA.id}-${arrowIdx}`]?.focus();
      }
      return;
    }
    if (key === 'Tab' || key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        retreatToPreviousCell(archerId, arrowIdx);
      } else {
        advanceToNextCell(archerId, arrowIdx);
      }
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      const currentVal = localArcherScores[archerId]?.arrows[arrowIdx];
      if (currentVal !== -1) {
        handleSetArrowValue(archerId, arrowIdx, -1);
      } else {
        retreatToPreviousCell(archerId, arrowIdx);
      }
      return;
    }

    // PUTA / TRADITIONAL PUTA Keypad Rules
    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      if (key === '2') {
        e.preventDefault();
        handleSetArrowValue(archerId, arrowIdx, 2);
        return;
      }
      if (key === '1') {
        e.preventDefault();
        handleSetArrowValue(archerId, arrowIdx, 1);
        return;
      }
      if (key.toLowerCase() === 'm' || key === '0' || key === '-' || key === '/') {
        e.preventDefault();
        handleSetArrowValue(archerId, arrowIdx, 'M');
        return;
      }
      return;
    }

    // TRADITIONAL 6-RING Keypad Rules
    if (targetType === TargetType.TRADITIONAL_6_RING) {
      if (['6', '5', '4', '3', '2', '1'].includes(key)) {
        e.preventDefault();
        handleSetArrowValue(archerId, arrowIdx, Number(key));
        return;
      }
      if (key.toLowerCase() === 'm' || key === '0' || key === '-' || key === '/') {
        e.preventDefault();
        handleSetArrowValue(archerId, arrowIdx, 'M');
        return;
      }
      return;
    }

    // FACE 5-RING Keypad Rules
    if (targetType === TargetType.FACE_5_RING) {
      if (['5', '4', '3', '2', '1'].includes(key)) {
        e.preventDefault();
        handleSetArrowValue(archerId, arrowIdx, Number(key));
        return;
      }
      if (key.toLowerCase() === 'm' || key === '0' || key === '-' || key === '/') {
        e.preventDefault();
        handleSetArrowValue(archerId, arrowIdx, 'M');
        return;
      }
      return;
    }

    // STANDARD 10-RING Keypad Rules (WA)
    // X, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, M
    if (key.toLowerCase() === 'x' || key === '+' || key === '*') {
      e.preventDefault();
      handleSetArrowValue(archerId, arrowIdx, 'X');
      return;
    }

    // Numpad 0 or letter M -> M (Miss)
    if (key.toLowerCase() === 'm' || key === '-' || key === '/') {
      e.preventDefault();
      handleSetArrowValue(archerId, arrowIdx, 'M');
      return;
    }

    // Check for 10 or 0
    if (key === '0') {
      // In many archery software (IANSEO), 0 directly inputs 10, or 10 is typed
      e.preventDefault();
      handleSetArrowValue(archerId, arrowIdx, 10);
      return;
    }

    if (['9', '8', '7', '6', '5', '4', '3', '2', '1'].includes(key)) {
      e.preventDefault();
      handleSetArrowValue(archerId, arrowIdx, Number(key));
      return;
    }
  };

  // Global Page Navigation Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (showScanner) return;
      
      // Ctrl + S: Save All
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveTarget();
        return;
      }

      // PageUp / PageDown for Target Switch
      if (e.key === 'PageDown') {
        e.preventDefault();
        const curIdx = allowedTargets.indexOf(selectedTarget);
        if (curIdx < allowedTargets.length - 1) {
          setSelectedTarget(allowedTargets[curIdx + 1]);
        }
        return;
      }

      if (e.key === 'PageUp') {
        e.preventDefault();
        const curIdx = allowedTargets.indexOf(selectedTarget);
        if (curIdx > 0) {
          setSelectedTarget(allowedTargets[curIdx - 1]);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedTarget, allowedTargets, showScanner]);

  // Reset an archer's end
  const handleResetArcherEnd = (archerId: string) => {
    const archer = archersToDisplay.find(a => a.id === archerId);
    if (!confirm(`Reset nilai Rambahan ${currentEnd + 1} untuk ${archer?.name || 'pemanah ini'}?`)) return;

    const config = archer ? (event.settings?.categoryConfigs || {})[archer.category as CategoryType] : null;
    const numArrows = config?.arrows || 6;
    const dummyArrows: (number | 'X')[] = new Array(numArrows).fill(-1);

    onSaveScore({
      archerId,
      sessionId: 'QUAL',
      endIndex: currentEnd,
      arrows: dummyArrows,
      total: 0,
      count6: 0,
      count5: 0,
      lastUpdated: Date.now(),
      isDeleted: true
    });

    setLocalArcherScores(prev => ({
      ...prev,
      [archerId]: {
        arrows: new Array(numArrows).fill(-1),
        total: 0,
        count6: 0,
        count5: 0,
        isManualTotal: false
      }
    }));

    setShowToast(`Skor ${archer?.name || ''} direset.`);
    setTimeout(() => setShowToast(null), 1500);
  };

  // Save Target Scores
  const handleSaveTarget = (shouldAdvance?: boolean) => {
    const advance = shouldAdvance !== undefined ? shouldAdvance : autoAdvanceTarget;
    const scoresToSave: ScoreEntry[] = [];
    const now = Date.now();
    const updatedLocalScores: Record<string, ArcherScoreState> = { ...localArcherScores };

    archersToDisplay.forEach(a => {
      const state = localArcherScores[a.id];
      if (!state) return;

      const config = (event.settings?.categoryConfigs || {})[a.category as CategoryType];
      const numArrows = config?.arrows || 6;

      // Filter or sanitize arrows
      const finalArrows: (number | 'X')[] = state.arrows.map((v: ArrowVal): (number | 'X') => {
        if (v === -1 || v === 'M') return 0;
        return v;
      });

      // Pad up to category arrows count
      while (finalArrows.length < numArrows) {
        finalArrows.push(0);
      }

      scoresToSave.push({
        archerId: a.id,
        sessionId: 'QUAL',
        endIndex: currentEnd,
        arrows: finalArrows,
        total: state.total,
        count6: state.count6,
        count5: state.count5,
        lastUpdated: now
      });

      // Retain in local state immediately so no visual loss or race condition occurs
      updatedLocalScores[a.id] = {
        ...state,
        arrows: [...state.arrows],
        total: state.total,
        count6: state.count6,
        count5: state.count5,
        isManualTotal: false
      };
    });

    if (scoresToSave.length > 0) {
      setLocalArcherScores(updatedLocalScores);
      onSaveScore(scoresToSave);
      setDirtyArchers({});
    }

    setShowToast(`Bantalan ${selectedTarget} - Rambahan ${currentEnd + 1} Tersimpan!`);

    if (advance) {
      setTimeout(() => {
        setShowToast(null);
        const curIdx = allowedTargets.indexOf(selectedTarget);
        if (curIdx < allowedTargets.length - 1) {
          setSelectedTarget(allowedTargets[curIdx + 1]);
        } else if (currentEnd < totalEnds - 1) {
          setSelectedTarget(allowedTargets[0]);
          setCurrentEnd(prev => prev + 1);
        }
      }, 750);
    } else {
      setTimeout(() => setShowToast(null), 1800);
    }
  };

  // QR & Barcode Scanner Handler
  const handleScan = (data: string) => {
    try {
      let archerId = '';
      let targetNo: number | undefined = undefined;
      let position = '';

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'SCORING_SHEET' || parsed.archerId) {
          archerId = parsed.archerId || parsed.id;
          targetNo = parsed.targetNo ? Number(parsed.targetNo) : undefined;
          position = parsed.position || '';
        }
      } catch {
        const trimmed = data.trim();
        const archers = event.archers || [];
        const found = archers.find(a => a.id === trimmed) ||
                      archers.find(a => `${a.targetNo}${a.position}`.toUpperCase() === trimmed.toUpperCase()) ||
                      archers.find(a => trimmed.toUpperCase().includes(`${a.targetNo}${a.position}`.toUpperCase()));
        if (found) {
          archerId = found.id;
          targetNo = found.targetNo;
          position = found.position || '';
        }
      }

      if (archerId) {
        const archer = (event.archers || []).find(a => a.id === archerId);
        const actualTarget = targetNo || archer?.targetNo;

        if (allowedTargets.length > 0 && actualTarget && !allowedTargets.includes(actualTarget)) {
          alert(`Akses Ditolak: Anda hanya memiliki hak akses untuk Bantalan ${allowedTargets.join(', ')}.`);
          return;
        }

        if (actualTarget) {
          setMode('TARGET');
          setSelectedTarget(actualTarget);
        }
        setSearchTerm('');
        setShowScanner(false);
        const nameDisplay = archer ? ` (${archer.name})` : '';
        setShowToast(`Bantalan ${actualTarget || ''}${position || archer?.position || ''}${nameDisplay} Terpilih!`);
        setTimeout(() => {
          setShowToast(null);
          cellRefs.current[`${archerId}-0`]?.focus();
        }, 800);
        return;
      }

      alert("QR Code / Barcode tidak cocok dengan data atlet event ini.");
    } catch {
      alert("Gagal membaca kode peserta.");
    }
  };

  // Active archer for on-screen keypad
  const activeArcher = useMemo(() => {
    if (!activeCell) return archersToDisplay[0] || null;
    return archersToDisplay.find(a => a.id === activeCell.archerId) || archersToDisplay[0] || null;
  }, [activeCell, archersToDisplay]);

  const activeConfig = useMemo(() => {
    if (!activeArcher) return null;
    return (event.settings?.categoryConfigs || {})[activeArcher.category as CategoryType];
  }, [activeArcher, event.settings?.categoryConfigs]);

  const keypadOptions = useMemo(() => {
    return getKeypadOptions(activeConfig?.targetType);
  }, [activeConfig]);

  const isCompact = density === 'compact';

  return (
    <div className={`space-y-4 pb-16 animate-in fade-in duration-300 ${isCompact ? 'max-w-[100vw]' : ''}`}>
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* Top Header & Ianseo Navigation */}
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs ${isCompact ? 'p-3 md:p-4' : 'p-5 md:p-7'}`}>
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 ${isCompact ? 'pb-3' : 'pb-5'}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-all active:scale-95 border border-slate-200"
              title="Kembali ke Panel Event"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-purple-200">
                  <Target className="w-3 h-3 text-purple-600" />
                  Score Entry (IanSeo Matrix)
                </span>
                {currentScorer?.assignedTargets && currentScorer.assignedTargets.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-600" /> Bantalan: {allowedTargets.join(', ')}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold border border-slate-200 flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-slate-500" /> {isCompact ? 'Mode Ringkas PC' : 'Mode Normal'}
                </span>
              </div>
              <h2 className={`${isCompact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} font-black font-oswald uppercase italic text-slate-900 tracking-tight mt-0.5`}>
                Rekap Skor Meja Utama
              </h2>
            </div>
          </div>

          {/* Controls & Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Viewport Density Toggle for PC */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  isCompact ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilan ringkas disesuaikan layar PC agar semua kolom terlihat tanpa geser"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ringkas PC</span>
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  !isCompact ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilan standar / sentuh"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Normal</span>
              </button>
            </div>

            {/* Zoom Scale Selector */}
            <div className="flex items-center bg-slate-100 px-2 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <span className="text-[10px] text-slate-400 mr-1.5">Zoom:</span>
              <select
                value={zoomScale}
                onChange={(e) => setZoomScale(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
              >
                <option value={80}>80% (Kecil)</option>
                <option value={90}>90% (Sedang)</option>
                <option value={100}>100% (Normal)</option>
                <option value={110}>110% (Besar)</option>
              </select>
            </div>

            <button 
              onClick={() => setShowScanner(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-slate-200"
              title="Scan QR Code Atlet"
            >
              <ScanLine className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">Scan QR</span>
            </button>

            <button 
              onClick={() => setShowKeypad(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border ${
                showKeypad 
                  ? 'bg-purple-50 text-purple-700 border-purple-200' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{showKeypad ? 'Tutup Keypad' : 'Keypad'}</span>
            </button>

            {/* Save Buttons: Save Current & Save and Advance */}
            <button 
              onClick={() => handleSaveTarget(false)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black font-oswald uppercase italic tracking-wider text-xs md:text-sm flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              title="Simpan skor tanpa berpindah bantalan (Ctrl + S)"
            >
              <Save className="w-3.5 h-3.5" /> Simpan (Ctrl+S)
            </button>

            <button 
              onClick={() => handleSaveTarget(true)}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black font-oswald uppercase italic tracking-wider text-xs md:text-sm flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              title="Simpan dan langsung lanjut ke bantalan berikutnya"
            >
              Simpan &amp; Lanjut ➜
            </button>
          </div>
        </div>

        {/* Target & End Navigation Controls */}
        <div className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${isCompact ? 'pt-3' : 'pt-5'}`}>
          {/* Target Stepper */}
          <div className="md:col-span-4 flex items-center gap-2">
            <button 
              onClick={() => {
                const curIdx = allowedTargets.indexOf(selectedTarget);
                if (curIdx > 0) setSelectedTarget(allowedTargets[curIdx - 1]);
              }}
              disabled={allowedTargets.indexOf(selectedTarget) <= 0}
              className={`bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-slate-800 transition-all active:scale-95 ${isCompact ? 'p-2' : 'p-3'}`}
              title="Bantalan Sebelumnya (PageUp)"
            >
              <ChevronLeft className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
            </button>

            <div className={`flex-1 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-xs ${isCompact ? 'px-3 py-1.5' : 'px-5 py-3'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">BANTALAN</span>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(Number(e.target.value))}
                  className={`bg-transparent font-black font-oswald italic tracking-tight text-white outline-none cursor-pointer text-center ${isCompact ? 'text-xl' : 'text-2xl md:text-3xl'}`}
                >
                  {allowedTargets.map(t => (
                    <option key={t} value={t} className="bg-slate-900 text-white text-base font-bold">
                      Bantalan {t}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[9px] font-bold text-slate-400">
                dari {allowedTargets.length}
              </span>
            </div>

            <button 
              onClick={() => {
                const curIdx = allowedTargets.indexOf(selectedTarget);
                if (curIdx < allowedTargets.length - 1) setSelectedTarget(allowedTargets[curIdx + 1]);
              }}
              disabled={allowedTargets.indexOf(selectedTarget) >= allowedTargets.length - 1}
              className={`bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-slate-800 transition-all active:scale-95 ${isCompact ? 'p-2' : 'p-3'}`}
              title="Bantalan Berikutnya (PageDown)"
            >
              <ChevronRight className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
            </button>
          </div>

          {/* End / Rambahan Tabs */}
          <div className="md:col-span-8 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {Array.from({ length: totalEnds }).map((_, idx) => {
              const isActive = currentEnd === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentEnd(idx)}
                  className={`flex-1 min-w-[54px] rounded-xl font-black font-oswald uppercase italic tracking-wider transition-all border ${
                    isCompact ? 'py-1 px-1 text-xs' : 'py-3 px-2 text-xs'
                  } ${
                    isActive 
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs scale-102 z-10' 
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="text-[8px] opacity-75 font-sans font-bold">END</div>
                  <div className={isCompact ? 'text-sm font-black' : 'text-base font-black'}>{idx + 1}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ianseo Target Quick Strip */}
        <div className={`border-t border-slate-100 flex items-center justify-between gap-2 overflow-x-auto ${isCompact ? 'mt-2.5 pt-2.5' : 'mt-4 pt-4'}`}>
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 shrink-0 mr-1">
              Bantalan:
            </span>
            {allowedTargets.map(t => {
              const status = targetCompletionMap[t];
              const isSelected = selectedTarget === t;

              let colorBadge = 'bg-slate-100 text-slate-700 border-slate-200';
              if (status === 'FULL') {
                colorBadge = 'bg-emerald-500 text-white border-emerald-600 shadow-xs';
              } else if (status === 'PARTIAL') {
                colorBadge = 'bg-amber-400 text-slate-900 border-amber-500 shadow-xs';
              }

              return (
                <button
                  key={t}
                  onClick={() => setSelectedTarget(t)}
                  className={`rounded-lg font-black font-oswald italic transition-all shrink-0 border flex items-center justify-center relative ${
                    isCompact ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs'
                  } ${
                    isSelected 
                      ? 'ring-2 ring-purple-600 ring-offset-1 scale-105 font-extrabold z-10' 
                      : 'hover:opacity-80'
                  } ${colorBadge}`}
                  title={`Bantalan ${t} - ${status === 'FULL' ? 'Semua Terisi' : status === 'PARTIAL' ? 'Sebagian Terisi' : 'Belum Ada Skor'}`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Auto advance toggle checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-600 shrink-0 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              checked={autoAdvanceTarget}
              onChange={(e) => setAutoAdvanceTarget(e.target.checked)}
              className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <span>Auto-loncat bantalan setelah simpan</span>
          </label>
        </div>
      </div>

      {/* Main Ianseo Score Matrix Table */}
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
        style={{ zoom: `${zoomScale}%` }}
      >
        {/* Table Subheader with Info */}
        <div className={`${isCompact ? 'p-3 px-4' : 'p-5'} bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3`}>
          <div className="flex items-center gap-2.5">
            <span className={`${isCompact ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl'} rounded-xl bg-slate-900 text-white font-black font-oswald italic flex items-center justify-center shadow-xs`}>
              {selectedTarget}
            </span>
            <div>
              <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-black font-oswald uppercase italic text-slate-900 leading-none`}>
                Bantalan {selectedTarget} &bull; Rambahan {currentEnd + 1}
              </h3>
              <p className="text-[10px] md:text-[11px] font-semibold text-slate-600 mt-0.5">
                Ketik nilai di Numpad &bull; Panah otomatis lompat ke atlet berikutnya setelah terisi penuh &bull; Tekan Tab atau Panah
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Lengkap
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Sebagian
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span> Kosong
            </span>
          </div>
        </div>

        {/* The Matrix Table */}
        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse ${isCompact ? 'min-w-[700px]' : 'min-w-[900px]'}`}>
            <thead>
              <tr className="bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider">
                <th className={`${isCompact ? 'py-2 px-2 w-12' : 'py-3 px-4 w-16'} text-center border-r border-slate-800`}>Target</th>
                <th className={`${isCompact ? 'py-2 px-3 min-w-[150px]' : 'py-3 px-4 min-w-[220px]'} border-r border-slate-800`}>Pemanah &amp; Klub</th>
                <th className={`${isCompact ? 'py-2 px-2 min-w-[110px]' : 'py-3 px-4 min-w-[140px]'} border-r border-slate-800`}>Kategori &amp; Face</th>
                <th className={`${isCompact ? 'py-2 px-2' : 'py-3 px-4'} text-center border-r border-slate-800`} colSpan={maxArrowsInScope}>
                  Anak Panah (Nilai Sesuai Face Target)
                </th>
                <th className={`${isCompact ? 'py-2 px-2 w-16' : 'py-3 px-3 w-20'} text-center border-r border-slate-800 bg-slate-800`}>End Tot</th>
                <th className={`${isCompact ? 'py-2 px-2 w-20' : 'py-3 px-3 w-24'} text-center border-r border-slate-800 bg-slate-850`}>Kumulatif</th>
                <th className={`${isCompact ? 'py-2 px-2 w-12' : 'py-3 px-3 w-16'} text-center border-r border-slate-800`}>{scoringColumnLabels.col1}</th>
                <th className={`${isCompact ? 'py-2 px-2 w-12' : 'py-3 px-3 w-14'} text-center border-r border-slate-800`}>{scoringColumnLabels.col2}</th>
                <th className={`${isCompact ? 'py-2 px-2 w-12' : 'py-3 px-3 w-16'} text-center`}>Reset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-bold">
              {archersToDisplay.map((archer, archerIdx) => {
                const config = findCategoryConfig(archer.category, event.settings?.categoryConfigs);
                const targetType = config?.targetType;
                const numArrows = config?.arrows || 6;
                const archerScore = localArcherScores[archer.id] || {
                  arrows: new Array(numArrows).fill(-1),
                  total: 0,
                  count6: 0,
                  count5: 0
                };

                const prevTotal = cumulativeScores[archer.id] || 0;
                const grandTotal = prevTotal + (archerScore.total || 0);

                const isTargetFilled = archerScore.arrows.slice(0, numArrows).every(v => v !== -1);
                const hasAnyScore = archerScore.arrows.slice(0, numArrows).some(v => v !== -1);

                return (
                  <tr 
                    key={archer.id}
                    className={`hover:bg-slate-50/90 transition-colors ${
                      activeCell?.archerId === archer.id ? 'bg-purple-50/40' : ''
                    }`}
                  >
                    {/* Position Badge: 1A, 1B, etc */}
                    <td className={`${isCompact ? 'py-2 px-2' : 'py-4 px-4'} text-center border-r border-slate-100`}>
                      <div className={`${isCompact ? 'w-8 h-8 text-sm rounded-lg' : 'w-12 h-12 text-xl rounded-2xl'} mx-auto bg-slate-900 text-white font-black font-oswald italic flex items-center justify-center shadow-xs`}>
                        {archer.targetNo || selectedTarget}{archer.position || String.fromCharCode(65 + archerIdx)}
                      </div>
                    </td>

                    {/* Archer Name & Club */}
                    <td className={`${isCompact ? 'py-2 px-2' : 'py-4 px-4'} border-r border-slate-100`}>
                      <div className={`font-black font-oswald uppercase italic text-slate-900 leading-tight truncate ${isCompact ? 'text-sm max-w-[170px]' : 'text-base max-w-[220px]'}`}>
                        {archer.name}
                      </div>
                      <div className={`font-bold text-slate-500 uppercase tracking-wider mt-0.5 truncate ${isCompact ? 'text-[10px] max-w-[150px]' : 'text-[11px] max-w-[200px]'}`}>
                        {archer.club || 'Independen'}
                      </div>
                    </td>

                    {/* Category & Face Info */}
                    <td className={`${isCompact ? 'py-2 px-2' : 'py-4 px-4'} border-r border-slate-100`}>
                      <div className={`inline-block bg-slate-100 text-slate-800 rounded-md font-black uppercase tracking-wider border border-slate-200 truncate ${
                        isCompact ? 'px-1.5 py-0.5 text-[9px] max-w-[120px]' : 'px-2.5 py-1 text-[10px] max-w-[160px]'
                      }`}>
                        {CATEGORY_LABELS[archer.category] || archer.category}
                      </div>
                      <div className="text-[9px] font-bold text-slate-600 mt-0.5 flex items-center gap-1">
                        <Target className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                        <span className="truncate">
                          {targetType === TargetType.PUTA ? 'Puta (2-1)' : 
                           targetType === TargetType.TRADITIONAL_PUTA ? 'Trad Puta' :
                           targetType === TargetType.TRADITIONAL_6_RING ? '6-Ring' :
                           targetType === TargetType.FACE_5_RING ? '5-Ring' :
                           targetType === TargetType.FACE_MEGA_MENDUNG ? 'Mega Mendung' :
                           'WA Standard'}
                        </span>
                      </div>
                    </td>

                    {/* Arrow Inputs with Exact Face Target Colors */}
                    <td className={`${isCompact ? 'py-1.5 px-2' : 'py-3 px-3'} border-r border-slate-100`} colSpan={maxArrowsInScope}>
                      <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'} justify-center`}>
                        {Array.from({ length: numArrows }).map((_, arrowIdx) => {
                          const val = archerScore.arrows[arrowIdx] ?? -1;
                          const style = getArrowTargetStyle(val, targetType);
                          const isActive = activeCell?.archerId === archer.id && activeCell?.arrowIdx === arrowIdx;

                          return (
                            <div key={arrowIdx} className="relative flex flex-col items-center">
                              <span className={`font-black text-slate-700 uppercase ${isCompact ? 'text-[7px] mb-0.5' : 'text-[8px] mb-1'}`}>
                                P{arrowIdx + 1}
                              </span>
                              <input
                                ref={el => {
                                  cellRefs.current[`${archer.id}-${arrowIdx}`] = el;
                                }}
                                type="text"
                                readOnly
                                value={val === -1 ? '' : (val === 0 ? 'M' : val)}
                                onFocus={() => setActiveCell({ archerId: archer.id, arrowIdx })}
                                onClick={() => setActiveCell({ archerId: archer.id, arrowIdx })}
                                onKeyDown={(e) => handleCellKeyDown(e, archer.id, arrowIdx, targetType)}
                                placeholder="-"
                                className={`text-center font-black font-oswald rounded-xl border transition-all cursor-pointer select-none outline-none ${
                                  isCompact 
                                    ? 'w-8 h-9 sm:w-9 sm:h-10 md:w-9 md:h-11 text-lg md:text-xl' 
                                    : 'w-12 h-14 md:w-14 md:h-16 text-2xl md:text-3xl border-2'
                                } ${
                                  isActive
                                    ? 'ring-3 ring-purple-500/40 border-purple-600 scale-105 z-10 shadow-md'
                                    : `${style.border} ${val !== -1 ? 'shadow-2xs' : 'hover:border-slate-400'}`
                                } ${style.bg} ${style.text}`}
                              />
                            </div>
                          );
                        })}

                        {/* If this category has fewer arrows than maxArrowsInScope, show padded blanks */}
                        {numArrows < maxArrowsInScope && Array.from({ length: maxArrowsInScope - numArrows }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`rounded-xl bg-slate-50 border border-dashed border-slate-200 opacity-20 flex items-center justify-center text-slate-300 font-black text-xs ${
                              isCompact ? 'w-8 h-9 sm:w-9 sm:h-10' : 'w-12 h-14 md:w-14 md:h-16'
                            }`}
                          >
                            -
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* End Total */}
                    <td className={`${isCompact ? 'py-2 px-2' : 'py-4 px-3'} text-center border-r border-slate-100 bg-slate-50/50`}>
                      <div className={`font-black font-oswald italic text-slate-900 ${isCompact ? 'text-xl' : 'text-3xl'}`}>
                        {archerScore.total || 0}
                      </div>
                      <span className="text-[8px] md:text-[9px] font-bold text-slate-600 uppercase">
                        {isTargetFilled ? '✓ Lengkap' : hasAnyScore ? 'Proses' : '-'}
                      </span>
                    </td>

                    {/* Cumulative Total (Previous ends + this end) */}
                    <td className={`${isCompact ? 'py-2 px-2' : 'py-4 px-3'} text-center border-r border-slate-100 bg-purple-50/30`}>
                      <div className={`font-black font-oswald italic text-purple-900 ${isCompact ? 'text-lg' : 'text-2xl'}`}>
                        {grandTotal}
                      </div>
                      <span className="text-[8px] md:text-[9px] font-bold text-purple-600 uppercase tracking-tighter">
                        +{archerScore.total || 0}
                      </span>
                    </td>

                    {/* 10+X or 6s count */}
                    <td className={`${isCompact ? 'py-2 px-2 text-base' : 'py-4 px-3 text-xl'} text-center border-r border-slate-100 font-black font-oswald text-amber-800`}>
                      {archerScore.count6 || 0}
                    </td>

                    {/* X or 5s count */}
                    <td className={`${isCompact ? 'py-2 px-2 text-base' : 'py-4 px-3 text-xl'} text-center border-r border-slate-100 font-black font-oswald text-amber-700`}>
                      {archerScore.count5 || 0}
                    </td>

                    {/* Reset Button */}
                    <td className={`${isCompact ? 'py-2 px-1' : 'py-4 px-3'} text-center`}>
                      <button
                        onClick={() => handleResetArcherEnd(archer.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                        title="Reset skor pemanah ini pada rambahan aktif"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {archersToDisplay.length === 0 && (
                <tr>
                  <td colSpan={10 + maxArrowsInScope} className="py-12 text-center text-slate-400">
                    <User className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                    <p className="font-bold text-sm">Tidak ada pemanah pada Bantalan {selectedTarget}</p>
                    <p className="text-xs mt-1">Pastikan atlet sudah dialokasikan bantalan melalui Admin Panel.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Dual Save Buttons */}
        {archersToDisplay.length > 0 && (
          <div className={`${isCompact ? 'p-3' : 'p-5'} bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3`}>
            <div className="text-xs font-semibold text-slate-600">
              💡 <b>Navigasi Cepat PC:</b> Tekan <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-[10px]">Ctrl + S</kbd> untuk simpan, <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-[10px]">PageUp</kbd> / <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-[10px]">PageDown</kbd> ganti bantalan.
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSaveTarget(false)}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black font-oswald uppercase italic tracking-wider text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95"
                title="Simpan skor tanpa loncat bantalan"
              >
                <Save className="w-4 h-4" /> SIMPAN SKOR (Ctrl+S)
              </button>

              <button
                type="button"
                onClick={() => handleSaveTarget(true)}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black font-oswald uppercase italic tracking-wider text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95"
                title="Simpan skor dan langsung pindah ke bantalan berikutnya"
              >
                SIMPAN &amp; LANJUT ➜
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On-Screen Ianseo Quick Keypad (Optional reference & touch/mouse click) */}
      {showKeypad && activeArcher && (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs animate-in slide-in-from-bottom-3 ${isCompact ? 'p-3' : 'p-5'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs font-oswald italic">
                {activeArcher.targetNo}{activeArcher.position}
              </span>
              <div>
                <span className="text-xs font-black font-oswald uppercase italic text-slate-900">
                  Keypad: {activeArcher.name}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold block">
                  Klik tombol untuk mengisi panah aktif (P{(activeCell?.arrowIdx ?? 0) + 1})
                </span>
              </div>
            </div>

            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 self-start sm:self-center">
              Target: {activeConfig?.targetType || 'Standard'}
            </span>
          </div>

          {/* Target Face Colored Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-start">
            {keypadOptions.map((opt, i) => {
              const style = getArrowTargetStyle(opt, activeConfig?.targetType);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (!activeCell) {
                      handleSetArrowValue(activeArcher.id, 0, opt);
                    } else {
                      handleSetArrowValue(activeCell.archerId, activeCell.arrowIdx, opt);
                    }
                  }}
                  className={`${isCompact ? 'w-10 h-10 sm:w-11 sm:h-11 text-xl' : 'w-14 h-14 sm:w-16 sm:h-16 text-2xl md:text-3xl'} rounded-xl font-black font-oswald border transition-all shadow-2xs active:scale-95 flex items-center justify-center ${style.bg} ${style.text} ${style.border} hover:brightness-105`}
                >
                  {opt}
                </button>
              );
            })}

            {/* Backspace Button */}
            <button
              type="button"
              onClick={() => {
                if (!activeCell) return;
                handleSetArrowValue(activeCell.archerId, activeCell.arrowIdx, -1);
              }}
              className={`${isCompact ? 'px-3 h-10 sm:h-11 text-[11px]' : 'px-5 h-14 sm:h-16 text-xs'} rounded-xl font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all active:scale-95 flex items-center gap-1.5`}
              title="Hapus panah aktif (Backspace)"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Hapus
            </button>
          </div>
        </div>
      )}

      {/* Floating Save Toast */}
      {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-7 py-3.5 rounded-2xl font-black font-oswald uppercase italic tracking-wider text-sm shadow-2xl animate-in slide-in-from-bottom-10 flex items-center gap-3 z-[300] border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {showToast}
        </div>
      )}
    </div>
  );
};

export default QuickScoringPanel;
