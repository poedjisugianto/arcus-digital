import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Target, QrCode, X, User, Delete, CheckCircle2, 
  ChevronRight, ChevronLeft, Trash2, ScanLine, ShieldCheck, Lock, LogOut, Eye, Swords
} from 'lucide-react';
import { ArcheryEvent, ScoreEntry, Archer, TargetType, ScoreLog, CategoryType, ScorerAccess } from '../types';
import { getCategoryDisplayName } from '../constants';
import { findCategoryConfig } from '../lib/firestoreUtils';
import {
  getCategoryScoringStages,
  getNormalizedScoreSession,
  getStageParticipantsAndCompletion
} from '../lib/bracketSeeding';
import { sortArrowsDescending } from '../lib/scoreSorting';
import QRScanner from './QRScanner';

interface Props {
  state: ArcheryEvent;
  currentScorer?: ScorerAccess | null;
  onSaveScore: (score: ScoreEntry | ScoreEntry[], log?: ScoreLog | ScoreLog[]) => void;
  onBack?: () => void;
  onLogoutScorer?: () => void;
  onOpenElimination?: (category: string) => void;
}

const ScoringPanel: React.FC<Props> = ({ state, currentScorer, onSaveScore, onBack, onLogoutScorer, onOpenElimination }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL'>('ALL');
  const [showAllFallback, setShowAllFallback] = useState(false);

  const activeWaves = state.settings?.scorerActiveFilter?.activeWaves || [];
  const activeCategories = state.settings?.scorerActiveFilter?.activeCategories || [];
  const hasAdminActiveFilter = activeWaves.length > 0 || activeCategories.length > 0;
  const isFocusedFilterActive = hasAdminActiveFilter && !showAllFallback;
  
  const allowedTargets = useMemo(() => {
    const total = state.settings?.totalTargets || 1;
    const allTargets = Array.from({ length: total }, (_, i) => i + 1);
    if (!currentScorer || !currentScorer.assignedTargets || currentScorer.assignedTargets.length === 0) {
      return allTargets;
    }
    const filtered = Array.from(
      new Set(
        currentScorer.assignedTargets.filter(
          (t): t is number => typeof t === 'number' && Number.isFinite(t) && t >= 1 && t <= total
        )
      )
    );
    return filtered.length > 0 ? filtered : allTargets;
  }, [state.settings?.totalTargets, currentScorer]);

  const [selectedTarget, setSelectedTarget] = useState<number>(() => allowedTargets[0] || 1);
  const [selectedArcherId, setSelectedArcherId] = useState<string | null>(null);
  const [activeSessionByCategory, setActiveSessionByCategory] = useState<Record<string, string>>({});
  const manualSessionCategoriesRef = useRef<Set<string>>(new Set());
  const [currentEnd, setCurrentEnd] = useState(0);
  const [tempArrows, setTempArrows] = useState<(number | 'X')[]>([]);
  const [activeArrowIndex, setActiveArrowIndex] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [quickSaveMode, setQuickSaveMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('arcus_scorer_quick_save') === '1';
    } catch {
      return false;
    }
  });

  const toggleQuickSaveMode = () => {
    setQuickSaveMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('arcus_scorer_quick_save', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  // Archers scoped to this scorer's assigned targets + active tournament wave/category focus filter
  const scopedArchers = useMemo(() => {
    return (state.archers || []).filter(a => {
      if (!a || a.category === CategoryType.OFFICIAL) return false;
      if (allowedTargets.length > 0 && !allowedTargets.includes(Number(a.targetNo))) {
        return false;
      }
      if (isFocusedFilterActive) {
        if (activeWaves.length > 0 && !activeWaves.includes(Number(a.wave) || 1)) {
          return false;
        }
        if (activeCategories.length > 0 && !activeCategories.includes(a.category)) {
          return false;
        }
      }
      return true;
    });
  }, [state.archers, allowedTargets, isFocusedFilterActive, activeWaves, activeCategories]);

  const availableCategories = useMemo(() => {
    return Array.from(
      new Set(
        scopedArchers
          .map(a => a.category)
          .filter((cat): cat is string => Boolean(cat))
      )
    );
  }, [scopedArchers]);

  // Keep selectedTarget inside allowedTargets and auto-jump to first target with active archers if current target is empty
  useEffect(() => {
    if (!allowedTargets.includes(selectedTarget)) {
      setSelectedTarget(allowedTargets[0] || 1);
      return;
    }
    if (!isDirty && scopedArchers.length > 0) {
      const hasOnCurrent = scopedArchers.some(a => Number(a.targetNo) === selectedTarget);
      if (!hasOnCurrent) {
        const firstActiveTarget = allowedTargets.find(t => scopedArchers.some(a => Number(a.targetNo) === t));
        if (firstActiveTarget !== undefined && firstActiveTarget !== selectedTarget) {
          setSelectedTarget(firstActiveTarget);
          setSelectedArcherId(null);
        }
      }
    }
  }, [allowedTargets, selectedTarget, scopedArchers, isDirty]);

  // Auto-select single active category, or reset if selected category is no longer available
  useEffect(() => {
    if (availableCategories.length === 1) {
      if (selectedCategory !== availableCategories[0]) {
        setSelectedCategory(availableCategories[0]);
      }
    } else if (selectedCategory !== 'ALL' && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory('ALL');
    }
  }, [availableCategories, selectedCategory]);

  const selectedArcher = useMemo(() => {
    return (state.archers || []).find(a => a.id === selectedArcherId);
  }, [state.archers, selectedArcherId]);

  const activeCategoryForStages = useMemo(() => {
    if (selectedArcher?.category) return selectedArcher.category;
    if (selectedCategory !== 'ALL') return selectedCategory;
    return availableCategories[0] || '';
  }, [selectedArcher?.category, selectedCategory, availableCategories]);

  const activeCategoryConfig = useMemo(() => {
    if (!activeCategoryForStages) return null;
    return findCategoryConfig(activeCategoryForStages, state.settings?.categoryConfigs) || null;
  }, [activeCategoryForStages, state.settings?.categoryConfigs]);

  const categoryStages = useMemo(() => {
    return getCategoryScoringStages(activeCategoryConfig);
  }, [activeCategoryConfig]);

  const categoryStageStatusMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getStageParticipantsAndCompletion>> = {};
    if (!activeCategoryForStages) return map;
    const catArchers = (state.archers || []).filter(
      a => a && a.category !== CategoryType.OFFICIAL && a.category === activeCategoryForStages
    );
    categoryStages.forEach(st => {
      map[st.sessionId] = getStageParticipantsAndCompletion(
        catArchers,
        state.scores || [],
        activeCategoryConfig,
        st.sessionId
      );
    });
    return map;
  }, [activeCategoryForStages, state.archers, state.scores, activeCategoryConfig, categoryStages]);

  const activeSession = useMemo(() => {
    if (!activeCategoryForStages || categoryStages.length === 0) return 'QUAL';
    const chosen = activeSessionByCategory[activeCategoryForStages];
    if (chosen && categoryStages.some(s => s.sessionId === chosen)) {
      return chosen;
    }
    const firstIncomplete = categoryStages.find(st => !categoryStageStatusMap[st.sessionId]?.isComplete);
    return (firstIncomplete || categoryStages[categoryStages.length - 1]).sessionId;
  }, [activeCategoryForStages, activeSessionByCategory, categoryStages, categoryStageStatusMap]);

  // Auto-open the next incomplete elimination stage when opening a category whose qualification is already complete
  useEffect(() => {
    if (!activeCategoryForStages || categoryStages.length <= 1) return;
    if (manualSessionCategoriesRef.current.has(activeCategoryForStages)) return;
    const firstIncomplete = categoryStages.find(st => !categoryStageStatusMap[st.sessionId]?.isComplete);
    const targetSession = (firstIncomplete || categoryStages[categoryStages.length - 1]).sessionId;
    if (activeSessionByCategory[activeCategoryForStages] !== targetSession) {
      setActiveSessionByCategory(prev => ({ ...prev, [activeCategoryForStages]: targetSession }));
      setCurrentEnd(0);
    }
  }, [activeCategoryForStages, categoryStages, categoryStageStatusMap]);

  const activeStageInfo = categoryStageStatusMap[activeSession];
  const currentStageIndex = categoryStages.findIndex(s => s.sessionId === activeSession);
  const currentStageMeta = categoryStages[currentStageIndex] || categoryStages[0];
  const nextStageMeta = currentStageIndex >= 0 && currentStageIndex < categoryStages.length - 1
    ? categoryStages[currentStageIndex + 1]
    : null;

  const handleSelectSession = (sessionId: string) => {
    if (!activeCategoryForStages) return;
    manualSessionCategoriesRef.current.add(activeCategoryForStages);
    setActiveSessionByCategory(prev => ({ ...prev, [activeCategoryForStages]: sessionId }));
    setCurrentEnd(0);
    setIsDirty(false);
    setActiveArrowIndex(null);
  };

  const archersAtTarget = useMemo(() => {
    const base = scopedArchers.filter(
      a => Number(a.targetNo) === selectedTarget && (selectedCategory === 'ALL' || a.category === selectedCategory)
    );
    const filtered =
      activeSession.startsWith('ELIM_') && activeStageInfo?.hasPreviousStageScores
        ? base.filter(a => a.category !== activeCategoryForStages || activeStageInfo.qualifiedIds.has(a.id))
        : base;
    return filtered.sort((a, b) => (a.position || "").localeCompare(b.position || ""));
  }, [scopedArchers, selectedTarget, selectedCategory, activeSession, activeStageInfo, activeCategoryForStages]);

  // If in an ELIM_N stage and current target has no qualified archers, auto-jump to a target that does
  useEffect(() => {
    if (!activeSession.startsWith('ELIM_') || !activeStageInfo?.hasPreviousStageScores) return;
    if (isDirty) return;
    if (archersAtTarget.length > 0) return;

    const targetWithQualifiers = allowedTargets.find(t =>
      scopedArchers.some(
        a =>
          Number(a.targetNo) === t &&
          (selectedCategory === 'ALL' || a.category === selectedCategory) &&
          (a.category !== activeCategoryForStages || activeStageInfo.qualifiedIds.has(a.id))
      )
    );
    if (targetWithQualifiers !== undefined && targetWithQualifiers !== selectedTarget) {
      setSelectedTarget(targetWithQualifiers);
      setSelectedArcherId(null);
    }
  }, [activeSession, activeStageInfo, archersAtTarget.length, allowedTargets, scopedArchers, selectedCategory, activeCategoryForStages, selectedTarget, isDirty]);

  const config = selectedArcher
    ? (findCategoryConfig(selectedArcher.category, state.settings?.categoryConfigs) || null)
    : activeCategoryConfig;

  const isElimSession = activeSession.startsWith('ELIM_');
  const effectiveEnds = isElimSession
    ? Math.max(1, Number(config?.eliminationEnds) || 2)
    : Math.max(1, Number(config?.ends) || 6);
  const effectiveArrows = isElimSession
    ? Math.max(1, Number(config?.eliminationArrows) || 6)
    : Math.max(1, Number(config?.arrows) || 6);

  useEffect(() => {
    if (currentEnd >= effectiveEnds) {
      setCurrentEnd(0);
    }
  }, [effectiveEnds, currentEnd]);

  useEffect(() => {
    setIsDirty(false);
    setActiveArrowIndex(null);
  }, [selectedArcherId, currentEnd, activeSession]);

  useEffect(() => {
    if (selectedArcher && config && !isDirty) {
      // 1. Check if there's a draft for THIS specific archer/session/end
      const draftKey = `scoring_draft_${state.id}_${activeSession}_${selectedArcherId}_${currentEnd}`;
      const savedDraft = localStorage.getItem(draftKey);
      
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        if (Array.isArray(parsedDraft) && parsedDraft.length === effectiveArrows) {
          setTempArrows(parsedDraft);
          return;
        }
      }

      // 2. If no draft, check if there's already a SAVED score for this session & end
      const existing = (state.scores || [])
        .filter(s => {
          if (s.isDeleted) return false;
          const norm = getNormalizedScoreSession(s.sessionId);
          return s.archerId === selectedArcherId && s.endIndex === currentEnd && norm === activeSession;
        })
        .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))[0];
      const loaded = existing?.arrows ? existing.arrows.slice(0, effectiveArrows) : [];
      while (loaded.length < effectiveArrows) loaded.push(-1);
      setTempArrows(loaded.length > 0 ? loaded : new Array(effectiveArrows).fill(-1));
    }
  }, [selectedArcherId, currentEnd, activeSession, state.scores, config, state.id, isDirty, effectiveArrows]);

  // Persist tempArrows to draft as they are entered
  useEffect(() => {
    if (selectedArcherId && tempArrows.length > 0) {
      const draftKey = `scoring_draft_${state.id}_${activeSession}_${selectedArcherId}_${currentEnd}`;
      if (tempArrows.some(v => v !== -1)) {
        localStorage.setItem(draftKey, JSON.stringify(tempArrows));
      } else {
        // If everything is cleared, remove the draft so it doesn't re-appear
        localStorage.removeItem(draftKey);
      }
    }
  }, [tempArrows, selectedArcherId, currentEnd, activeSession, state.id]);

  const keypadValues: (number | 'X' | 'M')[] = useMemo(() => {
    if (config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA) {
      return [2, 1, 'M'];
    } else if (config?.targetType === TargetType.TRADITIONAL_6_RING) {
      return [6, 5, 4, 3, 2, 1, 0];
    } else if (config?.targetType === TargetType.FACE_5_RING) {
      return [5, 4, 3, 2, 1, 0];
    } else if (config?.targetType === TargetType.FACE_3X20) {
      return ['X', 10, 9, 8, 7, 6, 0];
    }
    return ['X', 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  }, [config]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or scanner is open
      if (showScanner) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = (e.key || '').toLowerCase();
      
      // Numbers 1-9
      if (/^[1-9]$/.test(key)) {
        const val = parseInt(key);
        if (keypadValues.includes(val)) {
          handleInput(val);
        }
      } 
      // 0 mapped to 10 or 0 depending on context
      else if (key === '0') {
        if (keypadValues.includes(10)) handleInput(10);
        else if (keypadValues.includes(0)) handleInput(0);
      }
      // X for X
      else if (key === 'x' || key === '*') {
        if (keypadValues.includes('X')) handleInput('X');
      }
      // M for Miss
      else if (key === 'm' || key === '/') {
        if (keypadValues.includes('M')) handleInput('M');
        else if (keypadValues.includes(0)) handleInput(0);
      }
      // Backspace to delete
      else if (key === 'backspace' || key === 'delete') {
        handleDeleteArrow();
      }
      // Enter to trigger verification & review dialog
      else if (key === 'enter') {
        const hasValues = tempArrows.some(v => v !== -1);
        if (hasValues) {
          setShowConfirmModal(true);
        }
      }
      // Navigation
      else if (key === 'arrowleft') {
        setCurrentEnd(prev => Math.max(0, prev - 1));
      }
      else if (key === 'arrowright') {
        setCurrentEnd(prev => Math.min(effectiveEnds - 1, prev + 1));
      }
      else if (key === 'arrowup') {
        const archerIdx = archersAtTarget.findIndex(a => a.id === selectedArcherId);
        if (archerIdx > 0) {
          setSelectedArcherId(archersAtTarget[archerIdx - 1].id);
        }
      }
      else if (key === 'arrowdown') {
        const archerIdx = archersAtTarget.findIndex(a => a.id === selectedArcherId);
        if (archerIdx < archersAtTarget.length - 1) {
          setSelectedArcherId(archersAtTarget[archerIdx + 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedArcherId, currentEnd, tempArrows, keypadValues, config, effectiveEnds, archersAtTarget, activeArrowIndex]);

  const handleInput = (val: number | 'X' | 'M') => {
    if (!config) return;
    setIsDirty(true);
    const scoreVal = val === 'M' ? 0 : val;

    // If user explicitly clicked on an arrow box, update that specific arrow then auto-sort descending
    if (activeArrowIndex !== null && activeArrowIndex < effectiveArrows) {
      const newArrows = [...tempArrows];
      newArrows[activeArrowIndex] = scoreVal;
      const sortedArrows = sortArrowsDescending(newArrows);
      setTempArrows(sortedArrows);

      const nextEmpty = sortedArrows.indexOf(-1);
      setActiveArrowIndex(nextEmpty !== -1 ? nextEmpty : null);
      return;
    }

    // Otherwise, fill the first available empty slot (-1) then auto-sort descending
    const nextIdx = tempArrows.indexOf(-1);
    if (nextIdx !== -1) {
      const newArrows = [...tempArrows];
      newArrows[nextIdx] = scoreVal;
      const sortedArrows = sortArrowsDescending(newArrows);
      setTempArrows(sortedArrows);
      
      // CRITICAL: NO AUTO-SAVE! Team can examine & verify every arrow before saving
      const nextEmpty = sortedArrows.indexOf(-1);
      setActiveArrowIndex(nextEmpty !== -1 ? nextEmpty : null);
    }
  };

  const handleDeleteArrow = () => {
    setIsDirty(true);
    const newArrows = [...tempArrows];

    // If an arrow box is actively selected and has a value, clear it and keep sorted
    if (activeArrowIndex !== null && newArrows[activeArrowIndex] !== -1) {
      newArrows[activeArrowIndex] = -1;
      const sortedArrows = sortArrowsDescending(newArrows);
      setTempArrows(sortedArrows);
      const nextEmpty = sortedArrows.indexOf(-1);
      setActiveArrowIndex(nextEmpty !== -1 ? nextEmpty : null);
      return;
    }

    // Otherwise, delete the last filled arrow
    const lastFilledIdx = newArrows.map(x => x !== -1).lastIndexOf(true);
    if (lastFilledIdx !== -1) {
      newArrows[lastFilledIdx] = -1;
      const sortedArrows = sortArrowsDescending(newArrows);
      setTempArrows(sortedArrows);
      const nextEmpty = sortedArrows.indexOf(-1);
      setActiveArrowIndex(nextEmpty !== -1 ? nextEmpty : null);
    }
  };

  const currentEndTotal = useMemo(() => {
    if (!config) return 0;
    let maxVal = 10;
    if (config.targetType === TargetType.PUTA || config.targetType === TargetType.TRADITIONAL_PUTA) {
      maxVal = 2;
    } else if (config.targetType === TargetType.TRADITIONAL_6_RING) {
      maxVal = 6;
    } else if (config.targetType === TargetType.FACE_5_RING) {
      maxVal = 5;
    }
    return tempArrows.reduce<number>((acc, v) => {
      if (v === -1) return acc;
      return acc + (v === 'X' ? maxVal : Number(v));
    }, 0);
  }, [tempArrows, config]);

  const filledArrowsCount = useMemo(() => {
    return tempArrows.filter(v => v !== -1).length;
  }, [tempArrows]);

  const isAllArrowsFilled = useMemo(() => {
    return !!config && tempArrows.length === effectiveArrows && tempArrows.every(v => v !== -1);
  }, [tempArrows, config, effectiveArrows]);

  const handleSave = (arrows: (number | 'X')[]) => {
    if (!selectedArcherId || !config || !selectedArcher) return;
    
    // Always store arrows sorted from highest to lowest ('X' > 10 > 9 > ... > 0)
    const sortedArrows = sortArrowsDescending(arrows);

    // Check if it's a reset (all -1)
    const isReset = sortedArrows.every(v => v === -1);
    
    let maxVal = 10;
    if (config.targetType === TargetType.PUTA || config.targetType === TargetType.TRADITIONAL_PUTA) {
      maxVal = 2;
    } else if (config.targetType === TargetType.TRADITIONAL_6_RING) {
      maxVal = 6;
    } else if (config.targetType === TargetType.FACE_5_RING) {
      maxVal = 5;
    }

    const total = sortedArrows.reduce<number>((acc, v) => {
      if (v === -1) return acc;
      const scoreVal = v === 'X' ? maxVal : Number(v);
      return acc + scoreVal;
    }, 0);
    
    // Calculate counts for tie-break based on target type
    const targetType = config.targetType;
    let count6 = 0;
    let count5 = 0;

    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      count6 = sortedArrows.filter(v => v === 2).length;
      count5 = sortedArrows.filter(v => v === 1).length;
    } else if (targetType === TargetType.TRADITIONAL_6_RING) {
      count6 = sortedArrows.filter(v => v === 6).length;
      count5 = sortedArrows.filter(v => v === 5).length;
    } else if (targetType === TargetType.FACE_5_RING) {
      count6 = sortedArrows.filter(v => v === 5).length;
      count5 = sortedArrows.filter(v => v === 4).length;
    } else {
      // Standard 10-ring face (X, 10, 9, 8...)
      count6 = sortedArrows.filter(v => v === 'X' || v === 10).length;
      count5 = sortedArrows.filter(v => v === 9).length;
    }
    
    const savedEntry: ScoreEntry = {
      archerId: selectedArcherId,
      sessionId: activeSession,
      endIndex: currentEnd,
      arrows: sortedArrows,
      total,
      count6,
      count5,
      lastUpdated: Date.now(),
      isDeleted: isReset
    };
    onSaveScore(savedEntry);

    // Clear draft after successful save
    const draftKey = `scoring_draft_${state.id}_${activeSession}_${selectedArcherId}_${currentEnd}`;
    localStorage.removeItem(draftKey);

    // Reset status dirty immediately
    setIsDirty(false);
    setActiveArrowIndex(null);
    setShowConfirmModal(false);

    if (isReset) {
      setShowToast(`Data Rambahan ${currentEnd + 1} Direset!`);
      setTimeout(() => setShowToast(null), 1500);
      setTempArrows(new Array(effectiveArrows).fill(-1));
      return;
    }

    // Reset tempArrows immediately so the "draft saver" effect 
    // doesn't catch the old arrows for the NEW archerId/currentEnd
    setTempArrows(new Array(effectiveArrows).fill(-1));

    // Check if saving this end completes the entire current stage for this archer's category
    const savedCat = selectedArcher.category;
    const savedCatConfig = findCategoryConfig(savedCat, state.settings?.categoryConfigs) || config;
    const stagesForCat = getCategoryScoringStages(savedCatConfig);
    const stageIdx = stagesForCat.findIndex(st => st.sessionId === activeSession);
    const catArchers = (state.archers || []).filter(
      a => a && a.category !== CategoryType.OFFICIAL && a.category === savedCat
    );
    const completionAfterSave = getStageParticipantsAndCompletion(
      catArchers,
      state.scores || [],
      savedCatConfig,
      activeSession,
      [savedEntry]
    );

    if (completionAfterSave.isComplete) {
      if (stageIdx >= 0 && stageIdx < stagesForCat.length - 1) {
        const nextStage = stagesForCat[stageIdx + 1];
        manualSessionCategoriesRef.current.delete(savedCat);
        setActiveSessionByCategory(prev => ({ ...prev, [savedCat]: nextStage.sessionId }));
        setCurrentEnd(0);
        setSelectedArcherId(null);
        setShowToast(`Babak ${stagesForCat[stageIdx].label} Selesai! Membuka Input Skor ${nextStage.label}...`);
        setTimeout(() => setShowToast(null), 2800);
        return;
      } else if ((savedCatConfig?.h2hStartSize || 0) > 0) {
        setShowToast(`Babak ${stagesForCat[stageIdx]?.label || 'Kualifikasi'} Selesai! Siap Lanjut ke Bagan Aduan (${savedCatConfig.h2hStartSize} Besar).`);
        setTimeout(() => setShowToast(null), 3000);
      }
    }

    setShowToast(`Skor ${selectedArcher?.name} (${currentStageMeta?.shortLabel || 'Kualifikasi'} • R${currentEnd + 1}) Disimpan!`);
    setTimeout(() => setShowToast(null), 1600);

    // Auto Advance logic (Pindah Archer -> Pindah Bantalan berikutnya yang diizinkan -> Pindah Rambahan)
    const archerIdx = archersAtTarget.findIndex(a => a.id === selectedArcherId);
    if (archerIdx < archersAtTarget.length - 1) {
      setSelectedArcherId(archersAtTarget[archerIdx + 1].id);
    } else {
      const currentTargetIdx = allowedTargets.indexOf(selectedTarget);
      if (currentTargetIdx >= 0 && currentTargetIdx < allowedTargets.length - 1) {
        // Pindah ke target berikutnya dalam alokasi petugas ini
        setSelectedTarget(allowedTargets[currentTargetIdx + 1]);
      } else if (currentEnd < effectiveEnds - 1) {
        // Kembali ke target pertama dan lanjut ke rambahan berikutnya
        setSelectedTarget(allowedTargets[0] || 1);
        setCurrentEnd(currentEnd + 1);
      }
    }
  };

  const handleResetEnd = () => {
    if (!config || !selectedArcherId) return;
    setIsDirty(true);
    const emptyArrows = new Array(effectiveArrows).fill(-1);
    setTempArrows(emptyArrows);
    handleSave(emptyArrows);
  };

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
        // Plain text barcode (e.g. from Code128 / Code39 or manual scan)
        const trimmed = data.trim();
        const archerList = state.archers || [];
        const found = archerList.find(a => a.id === trimmed) ||
                      archerList.find(a => `${a.targetNo}${a.position}`.toUpperCase() === trimmed.toUpperCase()) ||
                      archerList.find(a => trimmed.toUpperCase().includes(`${a.targetNo}${a.position}`.toUpperCase()));
        if (found) {
          archerId = found.id;
          targetNo = found.targetNo;
          position = found.position || '';
        }
      }

      if (archerId) {
        const archer = (state.archers || []).find(a => a.id === archerId);
        const actualTarget = targetNo || archer?.targetNo;

        if (allowedTargets.length > 0 && actualTarget && !allowedTargets.includes(actualTarget)) {
          alert(`Akses Ditolak: Anda hanya memiliki akses untuk Bantalan ${allowedTargets.join(', ')}.`);
          return;
        }

        if (actualTarget) {
          setSelectedTarget(actualTarget);
        }
        if (archer && isFocusedFilterActive) {
          const outsideWave = activeWaves.length > 0 && !activeWaves.includes(Number(archer.wave) || 1);
          const outsideCat = activeCategories.length > 0 && !activeCategories.includes(archer.category);
          if (outsideWave || outsideCat) {
            setShowAllFallback(true);
            setSelectedCategory('ALL');
          }
        }
        setSelectedArcherId(archerId);
        setShowScanner(false);
        const nameDisplay = archer ? ` (${archer.name})` : '';
        setShowToast(`Pemanah Bantalan ${actualTarget || ''}${position || archer?.position || ''}${nameDisplay} Terpilih!`);
        setTimeout(() => setShowToast(null), 2200);
        return;
      }

      alert("QR Code / Barcode tidak cocok atau data atlet tidak ditemukan dalam event ini.");
    } catch {
      alert("Gagal membaca barcode atlet.");
    }
  };

  const getButtonStyles = (val: number | 'X' | 'M') => {
    const targetType = config?.targetType;
    
    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      if (val === 2) return 'bg-[#800000] text-white border-[#600000]';
      if (val === 1) return 'bg-yellow-400 text-slate-900 border-yellow-600';
      return 'bg-slate-900 text-white border-slate-700'; // M
    }
    
    if (targetType === TargetType.TRADITIONAL_6_RING) {
      if (val === 6 || val === 5 || val === 4) return 'bg-yellow-400 text-slate-900 border-yellow-600';
      if (val === 3) return 'bg-red-600 text-white border-red-800';
      if (val === 2) return 'bg-white text-slate-900 border-slate-200';
      if (val === 1) return 'bg-blue-600 text-white border-blue-800';
      return 'bg-slate-900 text-white border-slate-700';
    }

    if (targetType === TargetType.FACE_5_RING) {
      if (val === 5) return 'bg-yellow-400 text-slate-900 border-yellow-600';
      if (val === 4) return 'bg-red-600 text-white border-red-800';
      if (val === 3) return 'bg-blue-600 text-white border-blue-800';
      if (val === 2) return 'bg-slate-900 text-white border-slate-700';
      if (val === 1) return 'bg-white text-slate-900 border-slate-300';
      return 'bg-slate-900 text-white border-slate-700';
    }

    // FACE MEGA MENDUNG FESPATI (10, 9, 6 Kuning; 8, 5 Merah; 7, 4, 1 Putih; 3 Biru Muda; 2 Biru Tua; M Hitam)
    if (targetType === TargetType.FACE_MEGA_MENDUNG) {
      if (val === 'X' || val === 10 || val === 9 || val === 6) return 'bg-yellow-400 text-slate-900 border-yellow-600';
      if (val === 8 || val === 5) return 'bg-red-600 text-white border-red-800';
      if (val === 7 || val === 4 || val === 1) return 'bg-white text-slate-900 border-slate-300';
      if (val === 3) return 'bg-sky-400 text-slate-900 border-sky-500';
      if (val === 2) return 'bg-blue-900 text-white border-blue-950';
      return 'bg-slate-900 text-white border-slate-700';
    }

    if (val === 'X' || val === 10 || val === 9) return 'bg-yellow-400 text-slate-900 border-yellow-600';
    if (val === 8 || val === 7) return 'bg-red-600 text-white border-red-800';
    if (val === 6 || val === 5) return 'bg-blue-600 text-white border-blue-800';
    if (val === 4 || val === 3) return 'bg-slate-900 text-white border-slate-700';
    if (val === 2 || val === 1) return 'bg-white text-slate-900 border-slate-300';
    return 'bg-slate-900 text-white border-slate-700';
  };

  const mobileGridColsClass = keypadValues.length >= 7 ? 'grid-cols-4 sm:grid-cols-3' : 'grid-cols-3';

  return (
    <div className="fixed inset-0 h-[100dvh] bg-white z-[100] flex flex-col font-inter overflow-hidden select-none">
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      
      {/* High Contrast Header (Sunlight Optimized & Compact on Mobile) */}
      <div className="bg-white text-slate-900 px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-1.5 sm:gap-3 shrink-0 shadow-sm border-b border-slate-200">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={onBack} className="p-2 sm:p-3 bg-slate-100 rounded-lg active:scale-90 text-slate-600 shrink-0"><ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black uppercase font-oswald leading-none tracking-tight text-slate-900">Bantalan {selectedTarget}</h2>
                {currentScorer?.assignedTargets && currentScorer.assignedTargets.length > 0 && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 bg-purple-100 text-purple-700 text-[8px] font-black rounded-md uppercase tracking-wider items-center gap-1 border border-purple-200">
                    <Lock className="w-2.5 h-2.5" /> Bantalan {allowedTargets.join(', ')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleQuickSaveMode}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black rounded-md uppercase tracking-wider border transition-colors active:scale-95 ${
                    quickSaveMode
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                  title={quickSaveMode ? 'Mode Simpan 1-Klik aktif: tekan Simpan langsung menyimpan tanpa popup' : 'Mode Verifikasi aktif: tampilkan popup teliti sebelum simpan'}
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>{quickSaveMode ? 'Simpan 1-Klik' : 'Verifikasi'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  {currentScorer ? `Petugas: ${currentScorer.name}` : 'Field Score Terminal'}
                </p>
                {currentScorer && onLogoutScorer && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Ganti petugas / keluar dari akun ${currentScorer.name}? Anda harus memasukkan kode akses kembali untuk masuk.`)) {
                        onLogoutScorer();
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded border border-red-200 transition-colors active:scale-95 shrink-0"
                    title="Ganti Petugas / Keluar"
                  >
                    <LogOut className="w-2.5 h-2.5" /> Keluar
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 font-sans shrink-0">
             <button onClick={() => setShowScanner(true)} className="p-2 sm:p-3 bg-arcus-red text-white rounded-lg active:scale-90 transition-all shadow-md"><ScanLine className="w-4 h-4 sm:w-5 sm:h-5" /></button>
             <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar max-w-[130px] sm:max-w-[200px] px-1.5 sm:px-2 bg-slate-50 border border-slate-100 p-0.5 sm:p-1 rounded-lg">
                {allowedTargets.map((targetNum) => (
                  <button 
                    key={targetNum} 
                    type="button"
                    onClick={() => setSelectedTarget(targetNum)}
                    className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-black text-[10px] transition-all border ${selectedTarget === targetNum ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-transparent border-transparent text-slate-900 opacity-60'}`}
                  >
                    {targetNum}
                  </button>
                ))}
              </div>
          </div>
        </div>
        
        {/* Category Filter + Backup Tampilkan Semua Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1 min-w-0">
            {(availableCategories.length > 1 || showAllFallback) && (
              <button 
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${selectedCategory === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                ALL
              </button>
            )}
            {availableCategories.map((cat) => (
              <button 
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border whitespace-nowrap transition-all shrink-0 ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                {getCategoryDisplayName(cat, state.settings?.categoryConfigs)}
              </button>
            ))}
            {availableCategories.length === 0 && (
              <span className="text-[10px] font-bold text-slate-500 italic py-1.5">
                Tidak ada peserta aktif pada filter sesi/kategori saat ini
              </span>
            )}
          </div>

          {hasAdminActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setShowAllFallback(prev => !prev);
                setSelectedCategory('ALL');
              }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all active:scale-95 ${
                showAllFallback
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              }`}
              title={showAllFallback ? 'Kembali ke mode fokus sesi/kategori aktif dari panitia' : 'Tombol cadangan: tampilkan seluruh kategori & sesi di bantalan tugas Anda'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showAllFallback ? 'Kembali Fokus' : 'Tampilkan Semua'}</span>
            </button>
          )}
        </div>

        {/* Stage / Session Switcher (Kualifikasi -> Eliminasi Penyaringan Skor) */}
        {categoryStages.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 border-t border-slate-100">
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 shrink-0 mr-1">
              Babak:
            </span>
            {categoryStages.map(st => {
              const stInfo = categoryStageStatusMap[st.sessionId];
              const isSel = activeSession === st.sessionId;
              const isDone = Boolean(stInfo?.isComplete);
              return (
                <button
                  key={st.sessionId}
                  type="button"
                  onClick={() => handleSelectSession(st.sessionId)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                    isSel
                      ? st.sessionId === 'QUAL'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-purple-700 text-white border-purple-700 shadow-xs'
                      : isDone
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{st.label}</span>
                  {isDone && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Banner when current stage is complete & next stage or H2H is ready */}
        {activeStageInfo?.isComplete && (nextStageMeta || (activeCategoryConfig?.h2hStartSize || 0) > 0) && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[10px] font-bold leading-snug">
                {nextStageMeta
                  ? `Babak ${currentStageMeta?.label} (${getCategoryDisplayName(activeCategoryForStages, state.settings?.categoryConfigs)}) selesai! Lanjut input skor ${nextStageMeta.label}.`
                  : `Babak ${currentStageMeta?.label} (${getCategoryDisplayName(activeCategoryForStages, state.settings?.categoryConfigs)}) selesai! Siap masuk Bagan Aduan (${activeCategoryConfig?.h2hStartSize} Besar).`}
              </span>
            </div>
            {nextStageMeta ? (
              <button
                type="button"
                onClick={() => handleSelectSession(nextStageMeta.sessionId)}
                className="shrink-0 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs active:scale-95"
              >
                <span>Buka {nextStageMeta.label}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : onOpenElimination ? (
              <button
                type="button"
                onClick={() => onOpenElimination(activeCategoryForStages)}
                className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Buka Bagan Aduan ({activeCategoryConfig?.h2hStartSize} Besar)</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-slate-50 overflow-hidden">
        {/* Archer Selection - Compact Strip on Mobile, Sidebar on Desktop */}
        <div className="w-full md:w-64 bg-[#FBFBFD] border-b md:border-b-0 md:border-r border-slate-200 px-2 py-1.5 md:p-2 overflow-x-auto no-scrollbar flex md:flex-col gap-1.5 md:gap-2 shrink-0">
          {archersAtTarget.map((a, idx) => {
            const elimRank = activeSession.startsWith('ELIM_') ? activeStageInfo?.rankMap?.[a.id] : undefined;
            return (
              <button 
                key={a.id || `archer-${idx}`} 
                type="button"
                onClick={() => setSelectedArcherId(a.id)}
                className={`min-w-[104px] flex-1 md:flex-none px-2.5 py-1.5 md:p-4 rounded-lg text-left border transition-all duration-200 ${selectedArcherId === a.id ? 'bg-arcus-sun border-yellow-500 text-black shadow-sm md:shadow-md' : 'bg-white border-slate-200 text-slate-900'}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-black uppercase tracking-wider">
                    <span>{a.targetNo}{a.position}</span>
                    {elimRank && (
                      <span className="ml-1 px-1 py-0.5 rounded bg-purple-700 text-white text-[8px] font-black">
                        #{elimRank}
                      </span>
                    )}
                    {(a.sessionName || a.wave > 1) && (
                      <span className="hidden md:inline ml-1 text-[8px] font-semibold text-slate-500">
                        • {a.sessionName || `Sesi ${a.wave}`}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                     <div className="flex gap-0.5 overflow-hidden max-w-[48px] md:max-w-[60px]">
                        {Array.from({ length: effectiveEnds }).map((_, i) => (
                           <div key={`dot-${a.id || idx}-${i}`} className={`w-1 h-1 rounded-full shrink-0 ${(state.scores || []).find(s => s.archerId === a.id && s.endIndex === i && getNormalizedScoreSession(s.sessionId) === activeSession && !s.isDeleted) ? 'bg-slate-900' : 'bg-slate-200'}`} />
                        ))}
                     </div>
                  </div>
                </div>
                <p className={`font-black uppercase font-oswald text-xs sm:text-sm md:text-base truncate mt-0.5 md:mt-1 italic tracking-tight ${selectedArcherId === a.id ? 'text-black' : 'text-slate-600'}`}>{a.name}</p>
              </button>
            );
          })}
          {archersAtTarget.length === 0 && (
            <div className="p-4 md:p-8 text-center text-slate-900 font-bold italic text-xs uppercase">Bantalan Kosong</div>
          )}
        </div>

        {/* Scoring Area + Pinned Bottom Action Bar (No Scroll Required on Mobile) */}
        <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
          {!selectedArcher ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-200 gap-4 sm:gap-6 p-4">
              <User className="w-16 h-16 sm:w-24 sm:h-24" />
              <p className="text-xs font-black uppercase tracking-[0.4em] italic text-slate-700 text-center">Silakan Pilih Pemanah</p>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col justify-between px-3 py-2 sm:p-6 md:p-8 gap-2 sm:gap-4 overflow-y-auto">
                {/* Selected Archer Header Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 sm:pb-3 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-[11px] sm:text-sm font-black px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-900 text-white rounded-lg sm:rounded-xl shadow-xs shrink-0">
                      {selectedArcher.targetNo}{selectedArcher.position}
                      {(selectedArcher.sessionName || (selectedArcher.wave && selectedArcher.wave > 1)) && (
                        <span className="hidden sm:inline ml-1.5 text-[9px] font-bold text-amber-300">
                          • {selectedArcher.sessionName || `Sesi ${selectedArcher.wave}`}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <h3 className="text-sm sm:text-xl font-black uppercase font-oswald tracking-tight text-slate-900 leading-tight truncate">
                          {selectedArcher.name}
                        </h3>
                        {isElimSession && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shrink-0">
                            {currentStageMeta?.shortLabel || 'Elim'}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
                        {selectedArcher.club || 'Independen'} • {getCategoryDisplayName(selectedArcher.category, state.settings?.categoryConfigs)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                      {currentStageMeta?.shortLabel || 'Rambahan'}
                    </span>
                    <span className="text-sm sm:text-lg font-black font-mono text-slate-900 leading-none">
                      R{currentEnd + 1}<span className="text-[10px] sm:text-xs text-slate-400 font-normal">/{effectiveEnds}</span>
                    </span>
                  </div>
                </div>

                {/* Progress, Ends & Arrow Boxes */}
                <div className="space-y-2 sm:space-y-4 text-center">
                  {/* Ends Navigation */}
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-max min-w-full">
                      {Array.from({ length: effectiveEnds }).map((_, i) => {
                        const scoreForEnd = (state.scores || []).find(
                          s =>
                            s.archerId === selectedArcherId &&
                            s.endIndex === i &&
                            getNormalizedScoreSession(s.sessionId) === activeSession &&
                            !s.isDeleted
                        );
                        return (
                          <button 
                            key={`end-${i}`} 
                            type="button"
                            onClick={() => setCurrentEnd(i)} 
                            className={`min-w-[36px] sm:min-w-10 h-8 sm:h-10 px-1.5 rounded-lg sm:rounded-xl text-xs font-black border transition-all flex flex-col items-center justify-center shrink-0 leading-tight ${
                              currentEnd === i 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                : scoreForEnd 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-[9px]">R{i + 1}</span>
                            {scoreForEnd && <span className="text-[8px] font-bold opacity-80">{scoreForEnd.total}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                 
                  {/* Arrow Boxes */}
                  <div className="flex justify-center flex-wrap gap-1.5 sm:gap-3">
                    {tempArrows.map((a, i) => {
                      const isActive = activeArrowIndex === i;
                      const isFilled = a !== -1;
                      const filledStyle = isFilled ? getButtonStyles(a === 0 ? 'M' : a) : '';
                      return (
                        <button
                          key={`arrow-${i}`} 
                          type="button"
                          onClick={() => setActiveArrowIndex(i === activeArrowIndex ? null : i)}
                          className={`min-w-[46px] flex-1 max-w-[58px] h-12 sm:flex-none sm:w-20 sm:h-22 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-between p-1 sm:p-2 transition-all relative ${
                            isActive 
                              ? isFilled 
                                ? `${filledStyle} ring-2 sm:ring-4 ring-blue-500 shadow-md scale-105`
                                : 'border-blue-600 bg-blue-50/80 ring-2 sm:ring-4 ring-blue-500/40 shadow-md scale-105 text-blue-900'
                              : isFilled 
                                ? `${filledStyle} shadow-xs hover:scale-102` 
                                : 'border-dashed border-slate-300 bg-slate-50/70 text-slate-300 hover:border-slate-400'
                          }`}
                          title={`Anak panah ${i + 1} - Klik untuk koreksi nilai`}
                        >
                          <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-wider leading-none ${
                            isFilled ? 'opacity-80' : isActive ? 'text-blue-700 font-extrabold' : 'text-slate-400'
                          }`}>
                            P{i + 1}
                          </span>
                          <span className="text-lg sm:text-4xl font-black leading-none">
                            {a === -1 ? '-' : (a === 0 ? 'M' : a)}
                          </span>
                          <span className={`hidden sm:block text-[7px] font-bold uppercase tracking-wider ${isFilled ? 'opacity-70' : 'text-slate-400'}`}>
                            {isActive ? 'Aktif' : isFilled ? 'Ubah' : 'Isi'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Compact Inline Summary Bar on Mobile, Detailed Box on Tablet/Desktop */}
                  <div className="max-w-md mx-auto">
                    <div className={`px-3 py-1.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-between gap-2 text-left ${
                      isAllArrowsFilled
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                        : filledArrowsCount > 0
                          ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={`w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 font-black text-[10px] sm:text-xs ${
                          isAllArrowsFilled 
                            ? 'bg-emerald-600 text-white' 
                            : filledArrowsCount > 0 
                              ? 'bg-amber-500 text-white' 
                              : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isAllArrowsFilled ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> : `${filledArrowsCount}/${effectiveArrows}`}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider block truncate">
                            {isAllArrowsFilled ? 'Lengkap — Siap Disimpan' : 'Input Skor Berjalan'}
                          </span>
                          <p className="hidden sm:block text-[10px] opacity-80 leading-snug mt-0.5">
                            {isAllArrowsFilled
                              ? 'Periksa kembali kesesuaian skor di atas, lalu tekan Simpan Skor.'
                              : 'Isi seluruh anak panah, periksa, lalu tekan Simpan Skor.'}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] sm:text-xs font-black px-2 py-0.5 sm:py-1 rounded-md bg-white border border-slate-200/80 text-slate-900 font-mono tabular-nums">
                          R{currentEnd + 1}: {currentEndTotal}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* High Contrast Sunlight Keypad (4-col on mobile for zero scroll) */}
                <div className="w-full max-w-lg mx-auto flex flex-col gap-1.5 sm:gap-3 pb-1">
                  {/* Keyboard Helper */}
                  <div className="hidden lg:flex items-center justify-center gap-4 mb-1">
                     <div className="flex items-center gap-1.5 opacity-40">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[9px] font-mono">1-9</kbd>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Score</span>
                     </div>
                     <div className="flex items-center gap-1.5 opacity-40">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[9px] font-mono">0</kbd>
                        <span className="text-[8px] font-bold uppercase tracking-widest">10</span>
                     </div>
                     <div className="flex items-center gap-1.5 opacity-40">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[9px] font-mono">X</kbd>
                        <span className="text-[8px] font-bold uppercase tracking-widest">X</span>
                     </div>
                     <div className="flex items-center gap-1.5 opacity-40">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[9px] font-mono">M</kbd>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Miss</span>
                     </div>
                     <div className="flex items-center gap-1.5 opacity-40">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[9px] font-mono">BS</kbd>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Undo</span>
                     </div>
                     <div className="flex items-center gap-1.5 opacity-40">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[9px] font-mono">↵</kbd>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Save</span>
                     </div>
                  </div>

                  <div className={`grid ${mobileGridColsClass} gap-1.5 sm:gap-3`}>
                    {keypadValues.map((val, idx) => (
                      <button 
                        key={`pad-${String(val)}-${idx}`} 
                        type="button"
                        onClick={() => handleInput(val)}
                        className={`h-11 sm:h-16 md:h-20 rounded-xl sm:rounded-2xl text-xl sm:text-3xl md:text-4xl font-black shadow-sm active:scale-95 transition-all flex items-center justify-center border-b-4 ${getButtonStyles(val)}`}
                      >
                        {val}
                      </button>
                    ))}
                    <button 
                      type="button"
                      onClick={handleDeleteArrow}
                      className={`${keypadValues.length === 7 ? 'flex' : 'hidden sm:flex'} h-11 sm:h-16 md:h-20 bg-white text-red-500 rounded-xl sm:rounded-2xl flex-col items-center justify-center active:scale-95 transition-all border-2 border-slate-200 shadow-sm hover:bg-red-50 hover:border-red-200`}
                      title="Hapus / Koreksi Anak Panah"
                    >
                      <Delete className="w-5 h-5 sm:w-8 sm:h-8" />
                      <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider">Hapus</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pinned Bottom Action Bar - Always Reachable Without Scrolling */}
              <div className="shrink-0 bg-white border-t border-slate-200 px-3 py-2 sm:px-6 sm:py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <div className="w-full max-w-lg mx-auto flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleDeleteArrow}
                    className="sm:hidden h-12 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-black uppercase text-[9px] tracking-wider active:scale-95 transition-all flex flex-col items-center justify-center shrink-0"
                    title="Hapus panah terakhir"
                  >
                    <Delete className="w-4 h-4 text-red-500" />
                    <span>Hapus</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleResetEnd}
                    className="h-12 sm:h-14 px-3 sm:px-5 bg-red-50 text-red-600 border border-red-200 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-wider shadow-2xs active:scale-95 transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 hover:bg-red-100 shrink-0"
                    title="Reset skor rambahan ini"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Reset</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (!tempArrows.some(v => v !== -1)) return;
                      if (quickSaveMode) {
                        handleSave(tempArrows);
                      } else {
                        setShowConfirmModal(true);
                      }
                    }}
                    disabled={!tempArrows.some(v => v !== -1)}
                    className={`flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black uppercase text-xs sm:text-base tracking-wider sm:tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 ${
                      isAllArrowsFilled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 shadow-emerald-600/30 ring-2 sm:ring-4 ring-emerald-400/30'
                        : tempArrows.some(v => v !== -1)
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800'
                          : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                    <span className="truncate">
                      {quickSaveMode
                        ? isAllArrowsFilled ? `Simpan R${currentEnd + 1} (${currentEndTotal})` : `Simpan R${currentEnd + 1}`
                        : isAllArrowsFilled ? `Teliti & Simpan R${currentEnd + 1} (${currentEndTotal})` : 'Teliti & Simpan Skor'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Scorer Verification & Review Modal (Anti Auto-Save) */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black font-oswald uppercase italic text-slate-900 leading-tight">
                    Teliti & Verifikasi Skor
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Rambahan {currentEnd + 1} • Bantalan {selectedTarget}{selectedArcher?.position}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Archer Info Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Pemanah</span>
                <span className="text-sm font-black text-slate-900 uppercase leading-tight block">{selectedArcher?.name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-semibold text-slate-600 uppercase">{selectedArcher?.club || '-'}</span>
                  {selectedArcher?.ktaNumber && (
                    <span className="text-[7.5px] font-mono font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                      KTA: {selectedArcher.ktaNumber}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Target</span>
                <span className="text-xl font-black text-arcus-red font-oswald">{selectedTarget}{selectedArcher?.position}</span>
              </div>
            </div>

            {/* Arrows Preview Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Rincian Anak Panah</span>
                <span className="text-[10px] font-bold text-slate-600">Total: <strong className="text-slate-900 text-sm font-black">{currentEndTotal} Poin</strong></span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {tempArrows.map((arrow, idx) => (
                  <div 
                    key={`confirm-arrow-${idx}`}
                    className={`h-11 rounded-xl flex items-center justify-center font-black text-base border-2 shadow-xs ${
                      arrow === -1 
                        ? 'bg-slate-100 border-dashed border-slate-300 text-slate-400' 
                        : getButtonStyles(arrow)
                    }`}
                  >
                    {arrow === -1 ? '-' : arrow}
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[10px] leading-relaxed flex items-start gap-2">
              <span className="text-amber-600 font-bold shrink-0">⚠️</span>
              <span>Pastikan tim scorer telah meneliti dan mencocokkan skor dengan lembar fisik / bantalan sebelum konfirmasi.</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="py-3 px-4 rounded-xl border border-slate-200 font-bold text-xs uppercase text-slate-700 hover:bg-slate-100 transition-all active:scale-95 text-center"
              >
                Koreksi Skor
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  handleSave(tempArrows);
                }}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Simpan Resmi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant Notification Toast */}
      {showToast && (
        <div className="fixed bottom-20 sm:bottom-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-3xl font-black text-xs uppercase shadow-2xl animate-in slide-in-from-bottom-10 flex items-center gap-3 border-2 border-white/20 z-[150] whitespace-nowrap max-w-[92vw]">
           <CheckCircle2 className="w-5 h-5 shrink-0" /> <span className="truncate">{showToast}</span>
        </div>
      )}
    </div>
  );
};

export default ScoringPanel;