import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Target, CheckCircle2, ChevronRight, ChevronLeft, 
  Save, User, Zap, Hash, Trophy, Keyboard, Search, X, Trash2,
  ScanLine, Lock, ShieldCheck, ChevronsLeft, ChevronsRight,
  Info, RotateCcw, Check, Sparkles
} from 'lucide-react';
import { ArcheryEvent, ScoreEntry, Archer, CategoryType, TargetType, ScoreLog, ScorerAccess } from '../types';
import { CATEGORY_LABELS } from '../constants';
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

  // 4. STANDARD 10-RING FACE (FACE_122, FACE_80, FACE_60, FACE_40, FACE_3X20, STANDARD, FACE_MEGA_MENDUNG)
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
function calculateEndSummary(arrows: ArrowVal[], targetType?: TargetType) {
  let total = 0;
  let count6 = 0;
  let count5 = 0;

  arrows.forEach(v => {
    if (v === -1 || v === 'M' || v === 0) return;

    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
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
      const config = (event.settings?.categoryConfigs || {})[a.category as CategoryType];
      const numArrows = config?.arrows || 6;

      const existing = scoresList
        .filter(s => {
          if (s.isDeleted) return false;
          const norm = (s.sessionId === '1' || s.sessionId === '2' || !s.sessionId) ? 'QUAL' : s.sessionId;
          return s.archerId === a.id && s.endIndex === currentEnd && norm === 'QUAL';
        })
        .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))[0];

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

        // Check if arrows were all -1 or zeros with non-zero total (legacy manual total)
        const hasRealArrows = loadedArrows.some(v => v !== -1 && v !== 0) || (existing.total === 0 && loadedArrows.every(v => v === 0 || v === -1));

        if (hasRealArrows) {
          const summary = calculateEndSummary(loadedArrows, config?.targetType);
          newScores[a.id] = {
            arrows: loadedArrows,
            total: existing.total || summary.total,
            count6: existing.count6 ?? summary.count6,
            count5: existing.count5 ?? summary.count5,
            isManualTotal: false
          };
        } else {
          newScores[a.id] = {
            arrows: loadedArrows,
            total: existing.total || 0,
            count6: existing.count6 || 0,
            count5: existing.count5 || 0,
            isManualTotal: existing.total > 0
          };
        }
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

  // Calculate cumulative scores (Total score before this end)
  const cumulativeScores = useMemo(() => {
    const scoresList = event.scores || [];
    const map: Record<string, number> = {};

    archersToDisplay.forEach(a => {
      let pastTotal = 0;
      scoresList.forEach(s => {
        if (s.isDeleted) return;
        const norm = (s.sessionId === '1' || s.sessionId === '2' || !s.sessionId) ? 'QUAL' : s.sessionId;
        if (s.archerId === a.id && norm === 'QUAL' && typeof s.endIndex === 'number' && s.endIndex < currentEnd) {
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
    const config = archer ? (event.settings?.categoryConfigs || {})[archer.category as CategoryType] : null;

    setLocalArcherScores(prev => {
      const current = prev[archerId] || {
        arrows: new Array(config?.arrows || 6).fill(-1),
        total: 0,
        count6: 0,
        count5: 0
      };

      const newArrows = [...current.arrows];
      newArrows[arrowIdx] = val;

      const summary = calculateEndSummary(newArrows, config?.targetType);

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
  const handleSaveTarget = () => {
    const scoresToSave: ScoreEntry[] = [];
    const now = Date.now();

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
    });

    if (scoresToSave.length > 0) {
      onSaveScore(scoresToSave);
      setDirtyArchers({});
    }

    setShowToast(`Bantalan ${selectedTarget} - Rambahan ${currentEnd + 1} Tersimpan!`);

    // Auto advance to next target
    setTimeout(() => {
      setShowToast(null);
      const curIdx = allowedTargets.indexOf(selectedTarget);
      if (curIdx < allowedTargets.length - 1) {
        setSelectedTarget(allowedTargets[curIdx + 1]);
      } else if (currentEnd < totalEnds - 1) {
        setSelectedTarget(allowedTargets[0]);
        setCurrentEnd(prev => prev + 1);
      }
    }, 1000);
  };

  // QR Scanner Handler
  const handleScan = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'SCORING_SHEET' && parsed.eventId === event.id) {
        if (allowedTargets.length > 0 && !allowedTargets.includes(parsed.targetNo)) {
          alert(`Akses Ditolak: Anda hanya memiliki hak akses untuk Bantalan ${allowedTargets.join(', ')}.`);
          return;
        }
        setMode('TARGET');
        setSelectedTarget(parsed.targetNo);
        setSearchTerm('');
        setShowScanner(false);
        setShowToast(`Bantalan ${parsed.targetNo}${parsed.position} Terpilih!`);
        setTimeout(() => {
          setShowToast(null);
          cellRefs.current[`${parsed.archerId}-0`]?.focus();
        }, 1000);
      } else {
        alert("QR Code tidak cocok dengan event ini.");
      }
    } catch {
      alert("Format QR Code tidak valid.");
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

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* Top Header & Ianseo Navigation */}
      <div className="bg-white rounded-3xl p-5 md:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl transition-all active:scale-95 border border-slate-200"
              title="Kembali ke Panel Event"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-purple-200">
                  <Target className="w-3.5 h-3.5 text-purple-600" />
                  Score Entry (IanSeo Matrix)
                </span>
                {currentScorer?.assignedTargets && currentScorer.assignedTargets.length > 0 && (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-600" /> Bantalan: {allowedTargets.join(', ')}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-black font-oswald uppercase italic text-slate-900 tracking-tight mt-1">
                Rekap Skor Meja Utama
              </h2>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={() => setShowScanner(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
            >
              <ScanLine className="w-4 h-4 text-purple-600" /> Scan QR Scoresheet
            </button>

            <button 
              onClick={() => setShowKeypad(prev => !prev)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 border ${
                showKeypad 
                  ? 'bg-purple-50 text-purple-700 border-purple-200' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Keyboard className="w-4 h-4" /> {showKeypad ? 'Sembunyikan Keypad' : 'Tampilkan Keypad'}
            </button>

            <button 
              onClick={handleSaveTarget}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black font-oswald uppercase italic tracking-wider text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Save className="w-4 h-4" /> Simpan Bantalan (Ctrl + S)
            </button>
          </div>
        </div>

        {/* Target & End Navigation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-5">
          {/* Target Stepper */}
          <div className="md:col-span-5 flex items-center gap-2">
            <button 
              onClick={() => {
                const curIdx = allowedTargets.indexOf(selectedTarget);
                if (curIdx > 0) setSelectedTarget(allowedTargets[curIdx - 1]);
              }}
              disabled={allowedTargets.indexOf(selectedTarget) <= 0}
              className="p-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-slate-800 transition-all active:scale-95"
              title="Bantalan Sebelumnya (PageUp)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center justify-between shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">BANTALAN</span>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(Number(e.target.value))}
                  className="bg-transparent text-2xl md:text-3xl font-black font-oswald italic tracking-tight text-white outline-none cursor-pointer text-center"
                >
                  {allowedTargets.map(t => (
                    <option key={t} value={t} className="bg-slate-900 text-white text-base font-bold">
                      Bantalan {t}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                dari {allowedTargets.length}
              </span>
            </div>

            <button 
              onClick={() => {
                const curIdx = allowedTargets.indexOf(selectedTarget);
                if (curIdx < allowedTargets.length - 1) setSelectedTarget(allowedTargets[curIdx + 1]);
              }}
              disabled={allowedTargets.indexOf(selectedTarget) >= allowedTargets.length - 1}
              className="p-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-slate-800 transition-all active:scale-95"
              title="Bantalan Berikutnya (PageDown)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* End / Rambahan Tabs */}
          <div className="md:col-span-7 flex items-center gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: totalEnds }).map((_, idx) => {
              const isActive = currentEnd === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentEnd(idx)}
                  className={`flex-1 min-w-[70px] py-3 px-2 rounded-2xl font-black font-oswald uppercase italic text-xs tracking-wider transition-all border ${
                    isActive 
                      ? 'bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-200 scale-105 z-10' 
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="text-[9px] opacity-70 font-sans font-bold">END</div>
                  <div className="text-base font-black">{idx + 1}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ianseo Target Quick Strip */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            Status Bantalan:
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
                className={`w-9 h-9 rounded-xl font-black text-xs font-oswald italic transition-all shrink-0 border flex items-center justify-center relative ${
                  isSelected 
                    ? 'ring-2 ring-purple-600 ring-offset-2 scale-110 font-extrabold z-10' 
                    : 'hover:opacity-80'
                } ${colorBadge}`}
                title={`Bantalan ${t} - ${status === 'FULL' ? 'Semua Terisi' : status === 'PARTIAL' ? 'Sebagian Terisi' : 'Belum Ada Skor'}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Ianseo Score Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Subheader with Info */}
        <div className="p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-black font-oswald text-xl italic flex items-center justify-center shadow-xs">
              {selectedTarget}
            </span>
            <div>
              <h3 className="text-lg font-black font-oswald uppercase italic text-slate-900 leading-none">
                Bantalan {selectedTarget} &bull; Rambahan {currentEnd + 1}
              </h3>
              <p className="text-[11px] font-semibold text-slate-700 mt-1">
                Ketik nilai panah di keyboard (Numpad) &bull; Kursor otomatis loncat ke panah berikutnya
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Lengkap
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Belum Lengkap
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span> Kosong
            </span>
          </div>
        </div>

        {/* The Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center border-r border-slate-800">Target</th>
                <th className="py-3 px-4 min-w-[220px] border-r border-slate-800">Pemanah &amp; Klub</th>
                <th className="py-3 px-4 min-w-[140px] border-r border-slate-800">Kategori &amp; Face</th>
                <th className="py-3 px-4 text-center border-r border-slate-800" colSpan={maxArrowsInScope}>
                  Anak Panah (Nilai Sesuai Warna Face Target)
                </th>
                <th className="py-3 px-3 w-20 text-center border-r border-slate-800 bg-slate-800">End Tot</th>
                <th className="py-3 px-3 w-24 text-center border-r border-slate-800 bg-slate-850">Kumulatif</th>
                <th className="py-3 px-3 w-16 text-center border-r border-slate-800">10+X / 6s</th>
                <th className="py-3 px-3 w-14 text-center border-r border-slate-800">X / 5s</th>
                <th className="py-3 px-3 w-16 text-center">Reset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-bold">
              {archersToDisplay.map((archer, archerIdx) => {
                const config = (event.settings?.categoryConfigs || {})[archer.category as CategoryType];
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
                    <td className="py-4 px-4 text-center border-r border-slate-100">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-900 text-white font-black font-oswald text-xl italic flex items-center justify-center shadow-xs">
                        {archer.targetNo || selectedTarget}{archer.position || String.fromCharCode(65 + archerIdx)}
                      </div>
                    </td>

                    {/* Archer Name & Club */}
                    <td className="py-4 px-4 border-r border-slate-100">
                      <div className="font-black font-oswald uppercase italic text-base text-slate-900 leading-tight">
                        {archer.name}
                      </div>
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mt-0.5 truncate max-w-[200px]">
                        {archer.club || 'Independen'}
                      </div>
                    </td>

                    {/* Category & Face Info */}
                    <td className="py-4 px-4 border-r border-slate-100">
                      <div className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-200 truncate max-w-[160px]">
                        {CATEGORY_LABELS[archer.category] || archer.category}
                      </div>
                      <div className="text-[10px] font-bold text-slate-700 mt-1 flex items-center gap-1">
                        <Target className="w-3 h-3 text-purple-600" />
                        {targetType === TargetType.PUTA ? 'Puta (2-1)' : 
                         targetType === TargetType.TRADITIONAL_PUTA ? 'Trad Puta (2-1)' :
                         targetType === TargetType.TRADITIONAL_6_RING ? '6-Ring (6-1)' :
                         targetType === TargetType.FACE_5_RING ? '5-Ring (5-1)' :
                         'WA Standard (10-1)'}
                      </div>
                    </td>

                    {/* Arrow Inputs with Exact Face Target Colors */}
                    <td className="py-3 px-3 border-r border-slate-100" colSpan={maxArrowsInScope}>
                      <div className="flex items-center gap-2 justify-center">
                        {Array.from({ length: numArrows }).map((_, arrowIdx) => {
                          const val = archerScore.arrows[arrowIdx] ?? -1;
                          const style = getArrowTargetStyle(val, targetType);
                          const isActive = activeCell?.archerId === archer.id && activeCell?.arrowIdx === arrowIdx;

                          return (
                            <div key={arrowIdx} className="relative flex flex-col items-center">
                              <span className="text-[8px] font-black text-slate-700 uppercase mb-1">
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
                                className={`w-12 h-14 md:w-14 md:h-16 text-center font-black font-oswald text-2xl md:text-3xl rounded-2xl border-2 transition-all cursor-pointer select-none outline-none ${
                                  isActive
                                    ? 'ring-4 ring-purple-500/30 border-purple-600 scale-105 z-10 shadow-lg'
                                    : `${style.border} ${val !== -1 ? 'shadow-xs' : 'hover:border-slate-400'}`
                                } ${style.bg} ${style.text}`}
                              />
                            </div>
                          );
                        })}

                        {/* If this category has fewer arrows than maxArrowsInScope, show padded blanks */}
                        {numArrows < maxArrowsInScope && Array.from({ length: maxArrowsInScope - numArrows }).map((_, i) => (
                          <div key={i} className="w-12 h-14 md:w-14 md:h-16 rounded-2xl bg-slate-50 border border-dashed border-slate-200 opacity-30 flex items-center justify-center text-slate-300 font-black text-xs">
                            N/A
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* End Total */}
                    <td className="py-4 px-3 text-center border-r border-slate-100 bg-slate-50/50">
                      <div className="font-black font-oswald text-3xl italic text-slate-900">
                        {archerScore.total || 0}
                      </div>
                      <span className="text-[9px] font-bold text-slate-700 uppercase">
                        {isTargetFilled ? '✓ Lengkap' : hasAnyScore ? 'Proses' : '-'}
                      </span>
                    </td>

                    {/* Cumulative Total (Previous ends + this end) */}
                    <td className="py-4 px-3 text-center border-r border-slate-100 bg-purple-50/30">
                      <div className="font-black font-oswald text-2xl italic text-purple-900">
                        {grandTotal}
                      </div>
                      <span className="text-[9px] font-bold text-purple-600 uppercase tracking-tighter">
                        +{archerScore.total || 0}
                      </span>
                    </td>

                    {/* 10+X or 6s count */}
                    <td className="py-4 px-3 text-center border-r border-slate-100 font-black font-oswald text-xl text-amber-800">
                      {archerScore.count6 || 0}
                    </td>

                    {/* X or 5s count */}
                    <td className="py-4 px-3 text-center border-r border-slate-100 font-black font-oswald text-xl text-amber-700">
                      {archerScore.count5 || 0}
                    </td>

                    {/* Reset Button */}
                    <td className="py-4 px-3 text-center">
                      <button
                        onClick={() => handleResetArcherEnd(archer.id)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        title="Reset skor pemanah ini pada rambahan aktif"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {archersToDisplay.length === 0 && (
                <tr>
                  <td colSpan={10 + maxArrowsInScope} className="py-16 text-center text-slate-400">
                    <User className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-bold text-sm">Tidak ada pemanah pada Bantalan {selectedTarget}</p>
                    <p className="text-xs mt-1">Pastikan atlet sudah dialokasikan bantalan melalui Admin Panel.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Quick Save Button */}
        {archersToDisplay.length > 0 && (
          <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-semibold text-slate-700">
              💡 <b>Tip Kecepatan Operator:</b> Tekan <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-[10px]">Ctrl + S</kbd> untuk simpan &amp; otomatis lanjut ke bantalan berikutnya.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleSaveTarget}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black font-oswald uppercase italic tracking-wider text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-200 active:scale-95"
              >
                <Save className="w-5 h-5" /> SIMPAN &amp; LANJUT KE BANTALAN BERIKUTNYA
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On-Screen Ianseo Quick Keypad (Optional reference & touch/mouse click) */}
      {showKeypad && activeArcher && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm animate-in slide-in-from-bottom-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs font-oswald italic">
                {activeArcher.targetNo}{activeArcher.position}
              </span>
              <div>
                <span className="text-xs font-black font-oswald uppercase italic text-slate-900">
                  Keypad Input: {activeArcher.name}
                </span>
                <span className="text-[10px] text-slate-700 font-semibold block">
                  Klik tombol untuk mengisi panah yang sedang aktif (P{(activeCell?.arrowIdx ?? 0) + 1})
                </span>
              </div>
            </div>

            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 self-start sm:self-center">
              Warna Target: {activeConfig?.targetType || 'Standard'}
            </span>
          </div>

          {/* Target Face Colored Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
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
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-black font-oswald text-2xl md:text-3xl border-2 transition-all shadow-sm active:scale-95 flex items-center justify-center ${style.bg} ${style.text} ${style.border} hover:brightness-105 hover:scale-105`}
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
              className="px-5 h-14 sm:h-16 rounded-2xl font-black text-xs uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all active:scale-95 flex items-center gap-2"
              title="Hapus panah aktif (Backspace)"
            >
              <RotateCcw className="w-4 h-4" /> Hapus
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
