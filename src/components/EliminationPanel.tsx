import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArcheryEvent, CategoryType, Match, Archer, TargetType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { Trophy, GitBranch, User, Save, RefreshCw, ChevronRight, Swords, ArrowLeft, Trash2, Settings2, Zap, Medal, Plus, Minus, Check, FileText, X, AlertTriangle, Bell, Volume2, Target, BarChart3, ListOrdered, Award, Scale, Printer, Sliders, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { playShootOffAlarm, playVictorySound } from '../lib/soundAlarm';
import PrintRoundReportModal from './PrintRoundReportModal';
import PrintEliminationSheetsModal from './PrintEliminationSheetsModal';

interface Props {
  event: ArcheryEvent;
  onUpdateMatches: (matches: Record<CategoryType, Match[]>) => void;
  onBack: () => void;
}

const EliminationPanel: React.FC<Props> = ({ event, onUpdateMatches, onBack }) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>(() => {
    const saved = localStorage.getItem(`elim_cat_${event.id}`);
    return (saved as CategoryType) || CategoryType.ADULT_PUTRA;
  });
  const [showSavedFlag, setShowSavedFlag] = useState(false);
  const [flagMessage, setFlagMessage] = useState('');
  const [activeShootOffMatchId, setActiveShootOffMatchId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showEliminationPrintModal, setShowEliminationPrintModal] = useState(false);
  const [printMatchId, setPrintMatchId] = useState<string | undefined>(undefined);

  // Compact Mode and Zoom Scale for PC Monitor Friendly Display
  const [isCompact, setIsCompactState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('elim_compact_mode');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const setIsCompact = (val: boolean) => {
    setIsCompactState(val);
    try {
      localStorage.setItem('elim_compact_mode', val ? 'true' : 'false');
    } catch {}
  };

  const [zoomScale, setZoomScaleState] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('elim_zoom_scale'));
      return saved >= 60 && saved <= 125 ? saved : 85;
    } catch {
      return 85;
    }
  });

  const setZoomScale = (val: number) => {
    setZoomScaleState(val);
    try {
      localStorage.setItem('elim_zoom_scale', val.toString());
    } catch {}
  };

  const [tieBreakTab, setTieBreakTab] = useState<Record<string, 'SHOOT_OFF' | 'COUNTBACK'>>({});
  const config = (event.settings.categoryConfigs || {})[activeCategory as CategoryType];
  const defaultTieBreak = config?.tieBreakMethod === 'COUNTBACK' ? 'COUNTBACK' : 'SHOOT_OFF';
  const [modalTieBreakTab, setModalTieBreakTab] = useState<'SHOOT_OFF' | 'COUNTBACK'>('SHOOT_OFF');

  // Update default tab when activeCategory / config changes
  useEffect(() => {
    if (config?.tieBreakMethod === 'COUNTBACK') {
      setModalTieBreakTab('COUNTBACK');
    } else {
      setModalTieBreakTab('SHOOT_OFF');
    }
  }, [config?.tieBreakMethod, activeCategory]);

  // Persist active category
  useEffect(() => {
    localStorage.setItem(`elim_cat_${event.id}`, activeCategory);
  }, [activeCategory, event.id]);
  
  const [selectedMatchForEnds, setSelectedMatchForEnds] = useState<Match | null>(null);

  const currentMatches = event.matches[activeCategory] || [];

  const triggerFlag = (msg: string) => {
    setFlagMessage(msg);
    setShowSavedFlag(true);
    setTimeout(() => setShowSavedFlag(false), 3000);
  };

  const archersInCategory = useMemo(() => {
    return event.archers.filter(a => a.category === activeCategory);
  }, [event.archers, activeCategory]);

  const rankedArchers = useMemo(() => {
    let baseSession = 'QUAL';
    if (config?.eliminationStages && config.eliminationStages.length > 0) {
      const smallestStage = Math.min(...config.eliminationStages);
      baseSession = `ELIM_${smallestStage}`;
    }

    const scoresList = event.scores || [];
    return archersInCategory.map(archer => {
      const archerScores = scoresList.filter(s => s.archerId === archer.id && s.sessionId === baseSession);
      const total = archerScores.reduce((acc, curr) => acc + curr.total, 0);
      
      const manualSixes = archerScores.reduce((acc, curr) => acc + (curr.count6 || 0), 0);
      const manualFives = archerScores.reduce((acc, curr) => acc + (curr.count5 || 0), 0);
      
      const isSmallTarget = config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA;
      const allArrows = archerScores.flatMap(s => s.arrows || []).filter(v => v !== -1);
      const arrowSixes = allArrows.filter(v => isSmallTarget ? v === 2 : (v === 'X' || v === 6)).length;
      const arrowFives = allArrows.filter(v => isSmallTarget ? v === 1 : v === 5).length;
      
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
  }, [archersInCategory, event.scores, config]);

  const initializeBracket = (size: number, fromQual = false) => {
    const newMatches: Match[] = [];
    let currentRoundSize = size;
    const config = (event.settings.categoryConfigs || {})[activeCategory as CategoryType];
    const numEnds = config?.ends || 5;
    
    while (currentRoundSize >= 2) {
      const numMatchesInRound = currentRoundSize / 2;
      for (let i = 1; i <= numMatchesInRound; i++) {
        newMatches.push({
          id: `m-${activeCategory}-${currentRoundSize}-${i}`,
          category: activeCategory,
          archerAId: undefined,
          archerBId: undefined,
          scoreA: 0,
          scoreB: 0,
          endsA: Array(numEnds).fill(0),
          endsB: Array(numEnds).fill(0),
          winnerId: undefined,
          round: currentRoundSize.toString(),
          matchNo: i,
          status: 'PENDING',
          isShootOff: false
        });
      }
      currentRoundSize /= 2;
    }

    newMatches.push({
      id: `m-${activeCategory}-1-1`,
      category: activeCategory,
      archerAId: undefined,
      archerBId: undefined,
      scoreA: 0,
      scoreB: 0,
      endsA: Array(numEnds).fill(0),
      endsB: Array(numEnds).fill(0),
      winnerId: undefined,
      round: "1", 
      matchNo: 1,
      status: 'PENDING',
      isShootOff: false
    });

    if (fromQual) {
      const seeds = rankedArchers.slice(0, size);
      const firstRoundMatches = newMatches.filter(m => m.round === size.toString());
      for (let i = 0; i < firstRoundMatches.length; i++) {
        const m = firstRoundMatches[i];
        m.archerAId = seeds[i]?.id;
        m.archerBId = seeds[size - 1 - i]?.id;
      }
    }

    onUpdateMatches({ ...event.matches, [activeCategory]: newMatches });
    triggerFlag(`Bagan ${size} Besar Berhasil Dibuat`);
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track tied matches for shoot-off alarm
  const tiedMatches = useMemo(() => {
    return currentMatches.filter(m => 
      m.archerAId && 
      m.archerBId && 
      (m.scoreA > 0 || m.scoreB > 0) && 
      m.scoreA === m.scoreB && 
      !m.winnerId
    );
  }, [currentMatches]);

  const updateMatch = (matchId: string, updates: Partial<Match>) => {
    let updated = currentMatches.map((m: Match) => {
      if (m.id === matchId) {
        const newMatch = { ...m, ...updates };
        // Recalculate total scores if ends are updated
        if (updates.endsA) newMatch.scoreA = updates.endsA.reduce((a: number, b: number) => a + b, 0);
        if (updates.endsB) newMatch.scoreB = updates.endsB.reduce((a: number, b: number) => a + b, 0);
        
        // Detect shoot-off condition
        if (newMatch.scoreA === newMatch.scoreB && (newMatch.scoreA > 0 || newMatch.scoreB > 0)) {
          if (!newMatch.winnerId && !newMatch.isShootOff) {
            newMatch.isShootOff = true;
          }
        }
        
        return newMatch;
      }
      return m;
    });
    const targetMatch = updated.find(m => m.id === matchId);
    
    if (targetMatch) {
      // If winnerId is being updated (either set or cleared)
      if ('winnerId' in updates) {
        const winnerId = updates.winnerId;
        const currentRound = parseInt(targetMatch.round);
        const nextRound = currentRound / 2;
        
        if (winnerId) {
          playVictorySound();
        }

        // Advance winner to next round
        if (nextRound >= 2) {
          const nextMatchNo = Math.ceil((targetMatch.matchNo || 0) / 2);
          const nextMatchId = `m-${activeCategory}-${nextRound}-${nextMatchNo}`;
          const isA = (targetMatch.matchNo || 0) % 2 !== 0;
          
          updated = updated.map((um: Match) => {
            if (um.id === nextMatchId) {
              return isA ? { ...um, archerAId: winnerId } : { ...um, archerBId: winnerId };
            }
            return um;
          });
        }

        // Handle losers in Semi-Finals (Round 4) moving to Bronze Match (Round 1)
        if (currentRound === 4) {
          const loserId = winnerId ? (winnerId === targetMatch.archerAId ? targetMatch.archerBId : targetMatch.archerAId) : undefined;
          const bronzeMatchId = `m-${activeCategory}-1-1`;
          const isA = targetMatch.matchNo === 1;
          
          updated = updated.map((um: Match) => {
            if (um.id === bronzeMatchId) {
              return isA ? { ...um, archerAId: loserId } : { ...um, archerBId: loserId };
            }
            return um;
          });
        }

        // Auto-scroll to next round if a winner was selected
        if (winnerId && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const currentRoundIndex = roundsData.findIndex(r => r.round === currentRound);
          if (currentRoundIndex !== -1 && currentRoundIndex < roundsData.length - 1) {
             setTimeout(() => {
               const nextRoundElement = container.children[currentRoundIndex + 1] as HTMLElement;
               if (nextRoundElement) {
                 container.scrollTo({
                   left: nextRoundElement.offsetLeft - 40,
                   behavior: 'smooth'
                 });
               }
             }, 100);
          }
        }
      }
    }
    onUpdateMatches({ ...event.matches, [activeCategory]: updated });
    if (updates.winnerId) triggerFlag("Pemenang Match Berhasil Disimpan");
    
    // Update local state if modal is open
    if (selectedMatchForEnds?.id === matchId) {
      setSelectedMatchForEnds(updated.find(m => m.id === matchId) || null);
    }
  };

  const getArcherStats = (id: string | undefined) => {
    const found = rankedArchers.find(a => a.id === id);
    return {
      sixes: found?.sixes || 0,
      fives: found?.fives || 0,
      total: found?.total || 0,
    };
  };

  const handleApplyShootOffWinner = (match: Match) => {
    if (!match.archerAId || !match.archerBId) return;
    
    const valA = match.shootOffA !== undefined ? (match.shootOffA === 'X' ? 11 : Number(match.shootOffA)) : -1;
    const valB = match.shootOffB !== undefined ? (match.shootOffB === 'X' ? 11 : Number(match.shootOffB)) : -1;
    
    let winnerId: string | undefined = undefined;
    let reason = '';

    if (valA > valB) {
      winnerId = match.archerAId;
      reason = `Menang Shoot-Off (${match.shootOffA} vs ${match.shootOffB})`;
    } else if (valB > valA) {
      winnerId = match.archerBId;
      reason = `Menang Shoot-Off (${match.shootOffB} vs ${match.shootOffA})`;
    } else if (match.shootOffClosestA && !match.shootOffClosestB) {
      winnerId = match.archerAId;
      reason = `Menang Shoot-Off: Panah Terdekat ke Pusat (Closest to Center / X)`;
    } else if (match.shootOffClosestB && !match.shootOffClosestA) {
      winnerId = match.archerBId;
      reason = `Menang Shoot-Off: Panah Terdekat ke Pusat (Closest to Center / X)`;
    } else if (match.shootOffDistanceA !== undefined && match.shootOffDistanceB !== undefined) {
      if (match.shootOffDistanceA < match.shootOffDistanceB) {
        winnerId = match.archerAId;
        reason = `Menang Shoot-Off: Jarak ke Pusat Lebih Dekat (${match.shootOffDistanceA}mm vs ${match.shootOffDistanceB}mm)`;
      } else if (match.shootOffDistanceB < match.shootOffDistanceA) {
        winnerId = match.archerBId;
        reason = `Menang Shoot-Off: Jarak ke Pusat Lebih Dekat (${match.shootOffDistanceB}mm vs ${match.shootOffDistanceA}mm)`;
      }
    }

    if (!winnerId) {
      triggerFlag("Pilih panah unggul / centang panah terdekat ke pusat!");
      return;
    }

    updateMatch(match.id, { 
      winnerId, 
      tieBreakMethod: 'SHOOT_OFF',
      isShootOff: true, 
      tieBreakWinnerReason: reason,
      status: 'COMPLETED' 
    });
    triggerFlag(`Shoot-Off Selesai! ${reason} -> Pemenang: ${getArcherName(winnerId)}`);
  };

  const handleApplyCountbackWinner = (match: Match) => {
    if (!match.archerAId || !match.archerBId) return;

    const statsA = getArcherStats(match.archerAId);
    const statsB = getArcherStats(match.archerBId);

    const sixA = match.countback6_A !== undefined ? match.countback6_A : statsA.sixes;
    const sixB = match.countback6_B !== undefined ? match.countback6_B : statsB.sixes;

    const fiveA = match.countback5_A !== undefined ? match.countback5_A : statsA.fives;
    const fiveB = match.countback5_B !== undefined ? match.countback5_B : statsB.fives;

    const totA = match.countbackTotal_A !== undefined ? match.countbackTotal_A : statsA.total;
    const totB = match.countbackTotal_B !== undefined ? match.countbackTotal_B : statsB.total;

    let winnerId: string | undefined = undefined;
    let reason = '';

    if (sixA > sixB) {
      winnerId = match.archerAId;
      reason = `Menang Jumlah Angka 6 Terbanyak (${sixA} vs ${sixB})`;
    } else if (sixB > sixA) {
      winnerId = match.archerBId;
      reason = `Menang Jumlah Angka 6 Terbanyak (${sixB} vs ${sixA})`;
    } else if (fiveA > fiveB) {
      winnerId = match.archerAId;
      reason = `Menang Jumlah Angka 5 Terbanyak (${fiveA} vs ${fiveB})`;
    } else if (fiveB > fiveA) {
      winnerId = match.archerBId;
      reason = `Menang Jumlah Angka 5 Terbanyak (${fiveB} vs ${fiveA})`;
    } else if (totA > totB) {
      winnerId = match.archerAId;
      reason = `Menang Total Poin Kualifikasi (${totA} vs ${totB})`;
    } else if (totB > totA) {
      winnerId = match.archerBId;
      reason = `Menang Total Poin Kualifikasi (${totB} vs ${totA})`;
    }

    if (!winnerId) {
      triggerFlag("Perolehan angka 6 & 5 sama! Tentukan pemenang manual atau lakukan 1 panah Shoot-Off.");
      return;
    }

    updateMatch(match.id, {
      winnerId,
      tieBreakMethod: 'COUNTBACK',
      countback6_A: sixA,
      countback6_B: sixB,
      countback5_A: fiveA,
      countback5_B: fiveB,
      countbackTotal_A: totA,
      countbackTotal_B: totB,
      tieBreakWinnerReason: reason,
      status: 'COMPLETED'
    });
    triggerFlag(`Countback Selesai! ${reason} -> Pemenang: ${getArcherName(winnerId)}`);
  };

  const autoSelectWinner = (match: Match) => {
    if (!match.archerAId || !match.archerBId) return;
    if (match.scoreA === match.scoreB) {
      playShootOffAlarm();
      updateMatch(match.id, { isShootOff: true });
      setActiveShootOffMatchId(match.id);
      triggerFlag("Skor Seri! Silakan Pilih Metode: Shoot-Off atau Jumlah Poin (Countback 6/5)");
      return;
    }
    const winnerId = match.scoreA > match.scoreB ? match.archerAId : match.archerBId;
    updateMatch(match.id, { winnerId, status: 'COMPLETED' });
  };

  const getArcherName = (id: string | undefined) => {
    return archersInCategory.find(a => a.id === id)?.name || 'TBA';
  };

  const getArcherClub = (id: string | undefined) => {
    return archersInCategory.find(a => a.id === id)?.club || '-';
  };

  const roundsData = useMemo(() => {
    const rounds: Record<string, Match[]> = {};
    currentMatches.forEach((m: Match) => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    
    const sortedRounds = Object.keys(rounds).sort((a, b) => parseInt(b) - parseInt(a));
    const data = sortedRounds.filter(r => parseInt(r) > 1).map(r => {
      const roundNum = parseInt(r);
      return {
        label: roundNum === 2 ? 'FINAL' : roundNum === 4 ? 'SEMI FINAL (4 BESAR)' : roundNum === 8 ? 'QUARTER FINAL (8 BESAR)' : roundNum === 16 ? '1/8 FINAL (16 BESAR)' : roundNum === 32 ? '1/16 FINAL (32 BESAR)' : roundNum === 64 ? '1/32 FINAL (64 BESAR)' : `1/${roundNum/2} FINAL`,
        round: roundNum,
        matches: rounds[r].sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0))
      };
    });

    if (rounds["1"]) {
      data.push({ label: 'PEREBUTAN JUARA 3 / PENENTUAN JUARA', round: 1, matches: rounds["1"] });
    }
    return data;
  }, [currentMatches]);

  const finalMatch = currentMatches.find(m => m.round === "2");
  const bronzeMatch = currentMatches.find(m => m.round === "1");
  const winners = {
    juara1: finalMatch?.winnerId,
    juara2: finalMatch?.winnerId ? (finalMatch.winnerId === finalMatch.archerAId ? finalMatch.archerBId : finalMatch.archerAId) : undefined,
    juara3: bronzeMatch?.winnerId,
    juara4: bronzeMatch?.winnerId ? (bronzeMatch.winnerId === bronzeMatch.archerAId ? bronzeMatch.archerBId : bronzeMatch.archerAId) : undefined
  };

  return (
    <div className="space-y-6 relative" id="elimination-panel-root">
      {/* Saved Success Flag */}
      {showSavedFlag && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white">
            <Check className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">{flagMessage}</span>
          </div>
        </div>
      )}

      {/* Alert Banner for Active Shoot-Offs */}
      {tiedMatches.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse border-2 border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-orange-600 flex items-center justify-center font-black shrink-0 shadow-lg">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black font-oswald uppercase italic tracking-wide">
                PERINGATAN SHOOT-OFF ({tiedMatches.length} Match Imbang)
              </h3>
              <p className="text-[11px] sm:text-xs font-bold text-white/90">
                Ditemukan nilai seri pada babak aduan! Wajib lakukan 1 tembakan Shoot-Off untuk penentuan pemenang.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => playShootOffAlarm()}
              className="px-4 py-2.5 bg-white text-orange-700 hover:bg-orange-50 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Volume2 className="w-4 h-4" /> Bunyikan Alarm
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border">
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black font-oswald uppercase italic leading-none">Manajemen Bagan Eliminasi &amp; Shoot-Off</h2>
              {tiedMatches.length > 0 && (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider rounded-lg border border-amber-300">
                  {tiedMatches.length} Shoot-Off
                </span>
              )}
              {config?.tournamentFlowMode === 'DIRECT_SHOOT_OFF' ? (
                <span className="px-2.5 py-1 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider rounded-lg shadow-sm">
                  Mode: Shoot-Off Sejak Eliminasi
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-[9px] font-black uppercase tracking-wider rounded-lg border border-purple-200">
                  Mode: Perangkingan Poin (Shoot-Off di Aduan)
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
              {config?.tournamentFlowMode === 'DIRECT_SHOOT_OFF' 
                ? 'Sistem Gugur Langsung: Seri di babak eliminasi diselesaikan dengan 1 Panah Shoot-Off'
                : 'Sistem Peringkat Poin: Seri di kualifikasi dihitung Countback; Shoot-Off aktif di babak aduan'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setPrintMatchId(undefined);
              setShowEliminationPrintModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-800 hover:brightness-110 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-purple-900/20 active:scale-95 transition-all whitespace-nowrap"
            title="Cetak Lembar Skoring Aduan Fisik untuk Wasit & Scorer di Lapangan"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Lembar Aduan Fisik</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-600/20 active:scale-95 transition-all whitespace-nowrap"
            title="Cetak & Laporan Data Master Skor Babak & Penyaringan"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan Resmi</span>
          </button>
          
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl border overflow-x-auto max-w-full no-scrollbar">
            {(Object.keys(CategoryType) as CategoryType[]).map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-100'}`}
              >
                {(cat || '').replace('ADULT_', '').replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {currentMatches.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-12 lg:p-20 border-2 border-dashed border-slate-200 text-center space-y-8 animate-in fade-in zoom-in-95">
          <div className="bg-purple-50 p-8 rounded-full inline-block">
            <Zap className="w-16 h-16 text-purple-400" />
          </div>
          <div className="max-w-xl mx-auto space-y-6">
            <h3 className="text-2xl font-black font-oswald uppercase italic text-slate-900">Mulai Babak Eliminasi</h3>
            <p className="text-slate-800 text-xs font-semibold">Pilih ukuran bagan eliminasi yang diinginkan. Hasil kualifikasi otomatis ditempatkan berdasarkan ranking peringkat atlet.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-700 tracking-widest">Auto-Seeding Hasil Peringkat</p>
                {config?.h2hStartSize && config.h2hStartSize > 0 && (
                  <div className="flex items-center justify-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 mb-1">
                    <Zap className="w-3 h-3 fill-current" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Sesuai Konfigurasi: {config.h2hStartSize} Besar</span>
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  {[8, 16, 32, 64].map(s => {
                    const isRecommended = config?.h2hStartSize === s;
                    return (
                      <button 
                        key={s} 
                        onClick={() => initializeBracket(s, true)} 
                        className={`px-4 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all flex flex-col items-center ${
                          isRecommended ? 'bg-blue-600 text-white shadow-blue-500/20 scale-110' : 'bg-purple-600 text-white shadow-purple-500/20 hover:scale-105'
                        }`}
                      >
                        <span>Top {s}</span>
                        <span className="text-[7px] opacity-70 mt-0.5">{s === 8 ? 'Quarter' : s === 16 ? '1/8' : s === 32 ? '1/16' : '1/32'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-700 tracking-widest">Bagan Manual Kosong</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[8, 16, 32, 64].map(s => (
                    <button key={s} onClick={() => initializeBracket(s, false)} className="px-4 py-3 bg-white text-slate-600 border rounded-xl font-black text-[10px] uppercase hover:bg-slate-100 transition-all flex flex-col items-center">
                      <span>{s} Besar</span>
                      <span className="text-[7px] text-slate-700 mt-0.5">Bagan Kosong</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Winners / Podium Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Juara 1', archer: winners.juara1, color: 'text-yellow-500 bg-yellow-50 border-yellow-200 shadow-yellow-100' },
              { label: 'Juara 2', archer: winners.juara2, color: 'text-slate-800 bg-slate-50 border-slate-200' },
              { label: 'Juara 3', archer: winners.juara3, color: 'text-orange-500 bg-orange-50 border-orange-200' },
              { label: 'Juara 4', archer: winners.juara4, color: 'text-slate-700 bg-white border-slate-100' }
            ].map((p, i) => (
              <div key={i} className={`p-6 rounded-[2rem] border-2 ${p.color} text-center space-y-2 relative overflow-hidden shadow-sm`}>
                <Medal className="w-8 h-8 mx-auto opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{p.label}</p>
                <h4 className="text-lg font-black font-oswald uppercase italic leading-none truncate">{p.archer ? getArcherName(p.archer) : 'TBA'}</h4>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
             <div className="flex items-center gap-2.5 flex-wrap">
               <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[10px] font-black uppercase">
                 <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                 Kuning/Oranye = Shoot-Off (Seri)
               </div>

               {/* Physical Elimination Sheet Quick Button */}
               <button
                 onClick={() => {
                   setPrintMatchId(undefined);
                   setShowEliminationPrintModal(true);
                 }}
                 className="px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-800 hover:brightness-110 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
                 title="Cetak Lembar Skoring Aduan Fisik untuk Lapangan"
               >
                 <Swords className="w-3.5 h-3.5" />
                 <span>Cetak Lembar Aduan Lapangan</span>
               </button>
             </div>
             
             <div className="flex flex-wrap items-center gap-2">
               {/* Mode Ringkas / Compact Toggle */}
               <button
                 onClick={() => setIsCompact(!isCompact)}
                 className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                   isCompact 
                     ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                     : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                 }`}
                 title="Perkecil ukuran kartu bagan agar muat banyak di layar monitor PC"
               >
                 <Sliders className="w-3.5 h-3.5" />
                 <span>{isCompact ? 'Mode Ringkas: ON' : 'Mode Ringkas'}</span>
               </button>

               {/* Zoom Controller */}
               <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 gap-1">
                 <button
                   onClick={() => setZoomScale(Math.max(60, zoomScale - 10))}
                   className="p-1 hover:bg-white rounded-lg transition-colors text-slate-600 disabled:opacity-40"
                   disabled={zoomScale <= 60}
                   title="Zoom Out / Perkecil"
                 >
                   <ZoomOut className="w-3.5 h-3.5" />
                 </button>

                 <select
                   value={zoomScale}
                   onChange={(e) => setZoomScale(Number(e.target.value))}
                   className="bg-transparent font-black text-slate-800 outline-none cursor-pointer text-[10px] uppercase px-1 py-0.5"
                   title="Pilih Skala Zoom Layar"
                 >
                   <option value={65}>Zoom: 65% (Super Ringkas)</option>
                   <option value={75}>Zoom: 75% (Laptop Kecil)</option>
                   <option value={85}>Zoom: 85% (PC Ideal)</option>
                   <option value={95}>Zoom: 95% (Hampir Penuh)</option>
                   <option value={100}>Zoom: 100% (Normal)</option>
                   <option value={115}>Zoom: 115% (Besar)</option>
                 </select>

                 <button
                   onClick={() => setZoomScale(Math.min(125, zoomScale + 10))}
                   className="p-1 hover:bg-white rounded-lg transition-colors text-slate-600 disabled:opacity-40"
                   disabled={zoomScale >= 125}
                   title="Zoom In / Perbesar"
                 >
                   <ZoomIn className="w-3.5 h-3.5" />
                 </button>

                 {zoomScale !== 85 && (
                   <button
                     onClick={() => setZoomScale(85)}
                     className="px-1.5 py-0.5 bg-white text-purple-700 hover:bg-purple-50 rounded text-[9px] font-black uppercase transition-colors"
                     title="Reset Zoom ke 85%"
                   >
                     Reset
                   </button>
                 )}
               </div>

               {/* Reset Bracket Button */}
               <button 
                 onClick={() => { if(window.confirm('Hapus seluruh bagan untuk kategori ini?')) { onUpdateMatches({ ...event.matches, [activeCategory]: [] }); triggerFlag("Bagan Berhasil Direset"); } }}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-red-100"
                 title="Hapus dan reset seluruh bagan kategori ini"
               >
                 <Trash2 className="w-3.5 h-3.5" />
                 <span>Reset Bagan</span>
               </button>
             </div>
          </div>

          {/* Bracket Visualization */}
          <div 
            ref={scrollContainerRef} 
            className={`flex ${isCompact ? 'gap-5' : 'gap-12'} overflow-x-auto pb-12 pt-4 px-4 no-scrollbar scroll-smooth transition-all`}
            style={{ zoom: `${zoomScale}%` }}
          >
            {roundsData.map((round, rIndex) => (
              <div key={round.round} className={`flex flex-col ${isCompact ? 'gap-4 min-w-[285px] max-w-[305px]' : 'gap-8 min-w-[370px]'}`}>
                <div className="text-center">
                  <span className={`${isCompact ? 'px-4 py-1 text-[9px]' : 'px-6 py-2 text-[10px]'} rounded-full font-black uppercase tracking-[0.2em] italic border-2 shadow-lg inline-block ${round.round === 1 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-900 border-purple-500 text-white'}`}>
                    {round.label}
                  </span>
                </div>
                
                <div className={`flex flex-col h-full justify-around ${isCompact ? 'gap-4' : 'gap-8'}`}>
                  {round.matches.map((match) => {
                    const isTied = match.archerAId && match.archerBId && match.scoreA === match.scoreB && (match.scoreA > 0 || match.scoreB > 0);
                    const isShootOffActive = isTied || match.isShootOff;
                    const hasShootOffRecord = match.tieBreakMethod === 'SHOOT_OFF' || match.isShootOff || match.shootOffA !== undefined || match.shootOffB !== undefined;
                    const hasCountbackRecord = match.tieBreakMethod === 'COUNTBACK' || (match.tieBreakWinnerReason && match.tieBreakWinnerReason.includes('Jumlah Angka'));
                    const currentTab = tieBreakTab[match.id] || (hasCountbackRecord ? 'COUNTBACK' : hasShootOffRecord ? 'SHOOT_OFF' : defaultTieBreak);
                    const statsA = getArcherStats(match.archerAId);
                    const statsB = getArcherStats(match.archerBId);
                    const sixA = match.countback6_A !== undefined ? match.countback6_A : statsA.sixes;
                    const sixB = match.countback6_B !== undefined ? match.countback6_B : statsB.sixes;
                    const fiveA = match.countback5_A !== undefined ? match.countback5_A : statsA.fives;
                    const fiveB = match.countback5_B !== undefined ? match.countback5_B : statsB.fives;
                    const totA = match.countbackTotal_A !== undefined ? match.countbackTotal_A : statsA.total;
                    const totB = match.countbackTotal_B !== undefined ? match.countbackTotal_B : statsB.total;

                    return (
                      <div key={match.id} className="relative group">
                        <div className={`bg-white ${isCompact ? 'rounded-2xl' : 'rounded-[2.5rem]'} border-2 overflow-hidden shadow-lg transition-all duration-300 ${
                          isTied && !match.winnerId 
                            ? 'border-amber-500 ring-4 ring-amber-400/50 shadow-amber-500/20 animate-pulse' 
                            : match.winnerId 
                              ? 'border-purple-200 ring-4 ring-purple-50' 
                              : 'border-slate-100'
                        }`}>
                          {/* Match Header Badge */}
                          <div className={`${isCompact ? 'px-3.5 py-1.5 text-[9px]' : 'px-6 py-2.5 text-[10px]'} flex items-center justify-between border-b font-black uppercase tracking-wider ${
                            isTied && !match.winnerId 
                              ? 'bg-amber-500 text-slate-950 font-black' 
                              : hasCountbackRecord
                                ? 'bg-emerald-900 text-white'
                                : hasShootOffRecord 
                                  ? 'bg-purple-900 text-white' 
                                  : 'bg-slate-50 text-slate-700'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span>Match #{match.matchNo}</span>
                              {hasCountbackRecord ? (
                                <span className="px-2 py-0.5 bg-emerald-400 text-slate-950 rounded text-[8px] font-black uppercase">
                                  COUNTBACK (6/5)
                                </span>
                              ) : hasShootOffRecord ? (
                                <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 rounded text-[8px] font-black uppercase">
                                  SHOOT-OFF
                                </span>
                              ) : null}
                            </div>
                            {isTied && !match.winnerId ? (
                              <button 
                                onClick={() => playShootOffAlarm()} 
                                className="flex items-center gap-1 bg-white/20 hover:bg-white/40 text-black px-2 py-0.5 rounded text-[8px] font-black uppercase"
                              >
                                <Volume2 className="w-3 h-3" /> Alarm
                              </button>
                            ) : match.winnerId ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> SELESAI
                              </span>
                            ) : (
                              <span>ROUND {match.round}</span>
                            )}
                          </div>

                          {/* Tied Alert Notification Banner */}
                          {isTied && !match.winnerId && (
                            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-amber-900 text-[10px] font-black">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>SKOR SERI ({match.scoreA} - {match.scoreB})! Pilih Shoot-Off atau Countback (6/5)</span>
                              </div>
                              <button
                                onClick={() => setActiveShootOffMatchId(activeShootOffMatchId === match.id ? null : match.id)}
                                className="text-[9px] font-black uppercase px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-all shrink-0"
                              >
                                {activeShootOffMatchId === match.id ? 'Tutup Panel Tie-Break' : 'Pilih Metode Penentu'}
                              </button>
                            </div>
                          )}

                          {/* Historical Display: Data Sebelum vs Sesudah Tie-Break */}
                          {hasCountbackRecord && match.winnerId && (
                            <div className="bg-emerald-50/80 border-b border-emerald-200 px-6 py-2.5 flex flex-col gap-1 text-[9px] font-black uppercase">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-900">
                                  <span className="text-emerald-600 font-bold">Skor Regulasi:</span>
                                  <span className="px-2 py-0.5 bg-white rounded border border-emerald-200 text-emerald-800">{match.scoreA} - {match.scoreB}</span>
                                </div>
                                <div className="text-emerald-800 bg-emerald-200/90 px-2 py-0.5 rounded font-black">
                                  CB: 6s({sixA} vs {sixB}) | 5s({fiveA} vs {fiveB})
                                </div>
                              </div>
                              {match.tieBreakWinnerReason && (
                                <p className="text-[8px] text-emerald-700 font-bold normal-case italic">
                                  {match.tieBreakWinnerReason}
                                </p>
                              )}
                            </div>
                          )}

                          {hasShootOffRecord && !hasCountbackRecord && (
                            <div className="bg-purple-50/70 border-b border-purple-100 px-6 py-2.5 flex flex-col gap-1 text-[9px] font-black uppercase">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-purple-900">
                                  <span className="text-purple-500 font-bold">Skor Regulasi:</span>
                                  <span className="px-2 py-0.5 bg-white rounded border text-purple-700">{match.scoreA} - {match.scoreB}</span>
                                </div>
                                <div className="flex items-center gap-2 text-purple-900">
                                  <span className="text-amber-600 font-bold">Hasil Shoot-Off:</span>
                                  <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded font-black">
                                    {match.shootOffA !== undefined ? match.shootOffA : '-'}{match.shootOffClosestA ? ' (X)' : ''} vs {match.shootOffB !== undefined ? match.shootOffB : '-'}{match.shootOffClosestB ? ' (X)' : ''}
                                  </span>
                                </div>
                              </div>
                              {match.tieBreakWinnerReason && (
                                <p className="text-[8px] text-purple-700 font-bold normal-case italic">
                                  {match.tieBreakWinnerReason}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Slot A - Quick Input */}
                          <div className={`${isCompact ? 'p-3 gap-2.5' : 'p-6 gap-4'} flex items-center justify-between border-b ${match.winnerId === match.archerAId ? 'bg-purple-50/50' : ''}`}>
                            <div className={`flex items-center ${isCompact ? 'gap-2.5' : 'gap-4'} flex-1 min-w-0`}>
                               <div className={`${isCompact ? 'w-7 h-7 text-[11px] rounded-lg' : 'w-10 h-10 text-xs rounded-xl'} flex items-center justify-center font-black shrink-0 ${match.winnerId === match.archerAId ? 'bg-purple-600 text-white shadow-lg' : match.scoreA > match.scoreB ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                 {match.winnerId === match.archerAId ? <Check className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} /> : 'A'}
                                </div>
                                <div className="min-w-0">
                                  <span className={`font-black uppercase font-oswald ${isCompact ? 'text-xs leading-tight' : 'text-sm'} italic truncate block ${match.winnerId === match.archerAId ? 'text-purple-700' : 'text-slate-600'}`}>
                                    {getArcherName(match.archerAId)}
                                  </span>
                                  <span className={`${isCompact ? 'text-[7.5px]' : 'text-[8px]'} font-bold text-slate-700 uppercase tracking-wider truncate block`}>
                                    {getArcherClub(match.archerAId)}
                                  </span>
                                </div>
                            </div>
                            
                            <div className={`flex items-center ${isCompact ? 'gap-1.5' : 'gap-2'} shrink-0`}>
                               <button onClick={() => updateMatch(match.id, { scoreA: Math.max(0, match.scoreA - 1) })} className={`${isCompact ? 'w-6 h-6 rounded-md' : 'w-8 h-8 rounded-lg'} bg-slate-50 border flex items-center justify-center hover:bg-slate-100 active:scale-90 transition-all text-slate-700`}><Minus className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} /></button>
                               <div className={`${isCompact ? 'w-10 h-10 rounded-xl text-xl' : 'w-14 h-14 rounded-2xl text-2xl'} flex items-center justify-center font-black font-oswald border-2 shadow-inner ${
                                 isTied 
                                   ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                   : match.scoreA > match.scoreB 
                                     ? 'bg-green-50 border-green-200 text-green-700' 
                                     : 'bg-white border-slate-100 text-slate-900'
                               }`}>
                                 {match.scoreA}
                                </div>
                               <button onClick={() => updateMatch(match.id, { scoreA: match.scoreA + 1 })} className={`${isCompact ? 'w-6 h-6 rounded-md' : 'w-8 h-8 rounded-lg'} bg-purple-50 border-purple-100 border flex items-center justify-center hover:bg-purple-100 active:scale-90 transition-all text-purple-600`}><Plus className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} /></button>
                            </div>
                          </div>

                          {/* Slot B - Quick Input */}
                          <div className={`${isCompact ? 'p-3 gap-2.5' : 'p-6 gap-4'} flex items-center justify-between ${match.winnerId === match.archerBId ? 'bg-purple-50/50' : ''}`}>
                            <div className={`flex items-center ${isCompact ? 'gap-2.5' : 'gap-4'} flex-1 min-w-0`}>
                               <div className={`${isCompact ? 'w-7 h-7 text-[11px] rounded-lg' : 'w-10 h-10 text-xs rounded-xl'} flex items-center justify-center font-black shrink-0 ${match.winnerId === match.archerBId ? 'bg-purple-600 text-white shadow-lg' : match.scoreB > match.scoreA ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                 {match.winnerId === match.archerBId ? <Check className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} /> : 'B'}
                                </div>
                                <div className="min-w-0">
                                  <span className={`font-black uppercase font-oswald ${isCompact ? 'text-xs leading-tight' : 'text-sm'} italic truncate block ${match.winnerId === match.archerBId ? 'text-purple-700' : 'text-slate-600'}`}>
                                    {getArcherName(match.archerBId)}
                                  </span>
                                  <span className={`${isCompact ? 'text-[7.5px]' : 'text-[8px]'} font-bold text-slate-700 uppercase tracking-wider truncate block`}>
                                    {getArcherClub(match.archerBId)}
                                  </span>
                                </div>
                            </div>
                            
                            <div className={`flex items-center ${isCompact ? 'gap-1.5' : 'gap-2'} shrink-0`}>
                               <button onClick={() => updateMatch(match.id, { scoreB: Math.max(0, match.scoreB - 1) })} className={`${isCompact ? 'w-6 h-6 rounded-md' : 'w-8 h-8 rounded-lg'} bg-slate-50 border flex items-center justify-center hover:bg-slate-100 active:scale-90 transition-all text-slate-700`}><Minus className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} /></button>
                               <div className={`${isCompact ? 'w-10 h-10 rounded-xl text-xl' : 'w-14 h-14 rounded-2xl text-2xl'} flex items-center justify-center font-black font-oswald border-2 shadow-inner ${
                                 isTied 
                                   ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                   : match.scoreB > match.scoreA 
                                     ? 'bg-green-50 border-green-200 text-green-700' 
                                     : 'bg-white border-slate-100 text-slate-900'
                               }`}>
                                 {match.scoreB}
                                </div>
                               <button onClick={() => updateMatch(match.id, { scoreB: match.scoreB + 1 })} className={`${isCompact ? 'w-6 h-6 rounded-md' : 'w-8 h-8 rounded-lg'} bg-purple-50 border-purple-100 border flex items-center justify-center hover:bg-purple-100 active:scale-90 transition-all text-purple-600`}><Plus className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} /></button>
                            </div>
                          </div>

                          {/* DUAL TIE-BREAK RESOLUTION PANEL: OPSI 1 (Shoot-Off) vs OPSI 2 (Countback 6/5) */}
                          {(isTied || activeShootOffMatchId === match.id || hasShootOffRecord || hasCountbackRecord) && (
                            <div className="bg-amber-50/70 p-5 border-t border-amber-200 space-y-4">
                              {/* Option Tab Switcher */}
                              <div className="flex bg-slate-200/80 p-1 rounded-2xl gap-1">
                                <button
                                  onClick={() => setTieBreakTab(prev => ({ ...prev, [match.id]: 'SHOOT_OFF' }))}
                                  className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                                    currentTab === 'SHOOT_OFF'
                                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                                      : 'bg-transparent text-slate-700 hover:text-slate-950'
                                  }`}
                                >
                                  <Target className="w-3.5 h-3.5" /> Opsi 1: Shoot-Off (1 Panah)
                                </button>
                                <button
                                  onClick={() => setTieBreakTab(prev => ({ ...prev, [match.id]: 'COUNTBACK' }))}
                                  className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                                    currentTab === 'COUNTBACK'
                                      ? 'bg-emerald-600 text-white font-black shadow-md'
                                      : 'bg-transparent text-slate-700 hover:text-slate-950'
                                  }`}
                                >
                                  <BarChart3 className="w-3.5 h-3.5" /> Opsi 2: Jumlah Poin (6 &amp; 5)
                                </button>
                              </div>

                              {/* TAB 1: SHOOT-OFF (1 ARROW) */}
                              {currentTab === 'SHOOT_OFF' ? (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-amber-950 font-black text-xs font-oswald uppercase italic">
                                      <Target className="w-4 h-4 text-amber-600" />
                                      Input Skor 1 Panah Shoot-Off
                                    </div>
                                    <span className="text-[8px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded uppercase">
                                      World Archery Rule
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    {/* Archer A Shoot Off */}
                                    <div className="bg-white p-3 rounded-2xl border border-amber-200 space-y-2">
                                      <p className="text-[9px] font-black text-slate-600 uppercase truncate">
                                        Panah A ({getArcherName(match.archerAId)})
                                      </p>
                                      <div className="flex items-center gap-1.5">
                                        {['X', 10, 9, 8, 7, 0].map(val => (
                                          <button
                                            key={val}
                                            onClick={() => updateMatch(match.id, { shootOffA: val })}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                                              match.shootOffA === val 
                                                ? 'bg-amber-500 text-slate-950 shadow-md font-black scale-105' 
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                          >
                                            {val}
                                          </button>
                                        ))}
                                      </div>
                                      <button
                                        onClick={() => updateMatch(match.id, { shootOffClosestA: !match.shootOffClosestA, shootOffClosestB: false })}
                                        className={`w-full py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all ${
                                          match.shootOffClosestA 
                                            ? 'bg-amber-500 text-slate-950 border-amber-600 font-black' 
                                            : 'bg-slate-50 text-slate-800 border-slate-200'
                                        }`}
                                      >
                                        {match.shootOffClosestA ? '★ Panah Terdekat ke Tengah' : 'Tandai Terdekat ke Titik Tengah'}
                                      </button>
                                    </div>

                                    {/* Archer B Shoot Off */}
                                    <div className="bg-white p-3 rounded-2xl border border-amber-200 space-y-2">
                                      <p className="text-[9px] font-black text-slate-600 uppercase truncate">
                                        Panah B ({getArcherName(match.archerBId)})
                                      </p>
                                      <div className="flex items-center gap-1.5">
                                        {['X', 10, 9, 8, 7, 0].map(val => (
                                          <button
                                            key={val}
                                            onClick={() => updateMatch(match.id, { shootOffB: val })}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                                              match.shootOffB === val 
                                                ? 'bg-amber-500 text-slate-950 shadow-md font-black scale-105' 
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                          >
                                            {val}
                                          </button>
                                        ))}
                                      </div>
                                      <button
                                        onClick={() => updateMatch(match.id, { shootOffClosestB: !match.shootOffClosestB, shootOffClosestA: false })}
                                        className={`w-full py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all ${
                                          match.shootOffClosestB 
                                            ? 'bg-amber-500 text-slate-950 border-amber-600 font-black' 
                                            : 'bg-slate-50 text-slate-800 border-slate-200'
                                        }`}
                                      >
                                        {match.shootOffClosestB ? '★ Panah Terdekat ke Tengah' : 'Tandai Terdekat ke Titik Tengah'}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApplyShootOffWinner(match)}
                                      className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black text-[9px] uppercase tracking-widest rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Tetapkan Pemenang Shoot-Off
                                    </button>
                                    {(hasShootOffRecord || hasCountbackRecord) && (
                                      <button
                                        onClick={() => updateMatch(match.id, { isShootOff: false, shootOffA: undefined, shootOffB: undefined, shootOffClosestA: false, shootOffClosestB: false, tieBreakMethod: undefined, tieBreakWinnerReason: undefined })}
                                        className="px-3 py-2.5 bg-white border border-slate-200 text-slate-800 hover:text-red-600 rounded-xl text-[9px] font-black uppercase transition-all"
                                      >
                                        Hapus S.O
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* TAB 2: COUNTBACK (JUMLAH POINT TERTINGGI 6 & 5) */
                                <div className="space-y-4 animate-in fade-in duration-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-emerald-950 font-black text-xs font-oswald uppercase italic">
                                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                                      Perolehan Jumlah Poin Tertinggi (Countback)
                                    </div>
                                    <span className="text-[8px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded uppercase">
                                      Prioritas: Angka 6 ➔ Angka 5 ➔ Total Poin
                                    </span>
                                  </div>

                                  <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3">
                                    {/* Perbandingan Angka 6 */}
                                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
                                      <div className="text-left w-1/3 min-w-0">
                                        <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(match.archerAId)}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <button onClick={() => updateMatch(match.id, { countback6_A: Math.max(0, sixA - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                          <span className="font-black text-base font-oswald text-purple-700">{sixA}</span>
                                          <button onClick={() => updateMatch(match.id, { countback6_A: sixA + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                                        </div>
                                      </div>
                                      <div className="text-center px-2">
                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full font-black text-[9px] uppercase tracking-wider block">
                                          Jumlah Angka 6 (X)
                                        </span>
                                        <span className="text-[8px] text-slate-700 font-bold block mt-0.5">
                                          {sixA > sixB ? 'A Lebih Banyak' : sixB > sixA ? 'B Lebih Banyak' : 'Sama (Imbang)'}
                                        </span>
                                      </div>
                                      <div className="text-right w-1/3 min-w-0">
                                        <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(match.archerBId)}</p>
                                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                          <button onClick={() => updateMatch(match.id, { countback6_B: Math.max(0, sixB - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                          <span className="font-black text-base font-oswald text-slate-900">{sixB}</span>
                                          <button onClick={() => updateMatch(match.id, { countback6_B: sixB + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Perbandingan Angka 5 */}
                                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
                                      <div className="text-left w-1/3 min-w-0">
                                        <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(match.archerAId)}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <button onClick={() => updateMatch(match.id, { countback5_A: Math.max(0, fiveA - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                          <span className="font-black text-base font-oswald text-purple-700">{fiveA}</span>
                                          <button onClick={() => updateMatch(match.id, { countback5_A: fiveA + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                                        </div>
                                      </div>
                                      <div className="text-center px-2">
                                        <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-full font-black text-[9px] uppercase tracking-wider block">
                                          Jumlah Angka 5 (10)
                                        </span>
                                        <span className="text-[8px] text-slate-700 font-bold block mt-0.5">
                                          {fiveA > fiveB ? 'A Lebih Banyak' : fiveB > fiveA ? 'B Lebih Banyak' : 'Sama (Imbang)'}
                                        </span>
                                      </div>
                                      <div className="text-right w-1/3 min-w-0">
                                        <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(match.archerBId)}</p>
                                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                          <button onClick={() => updateMatch(match.id, { countback5_B: Math.max(0, fiveB - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                          <span className="font-black text-base font-oswald text-slate-900">{fiveB}</span>
                                          <button onClick={() => updateMatch(match.id, { countback5_B: fiveB + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Ringkasan Skor Kualifikasi */}
                                    <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-xl text-[9px] font-black">
                                      <span className="text-emerald-800">Total Poin: <b>{totA}</b></span>
                                      <span className="text-slate-500 uppercase tracking-widest text-[8px]">Skor Total Kualifikasi</span>
                                      <span className="text-emerald-800">Total Poin: <b>{totB}</b></span>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApplyCountbackWinner(match)}
                                      className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-[9px] uppercase tracking-widest rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                    >
                                      <Award className="w-3.5 h-3.5" /> Hitung &amp; Tetapkan Pemenang Countback
                                    </button>
                                    <button
                                      onClick={() => updateMatch(match.id, { countback6_A: statsA.sixes, countback6_B: statsB.sixes, countback5_A: statsA.fives, countback5_B: statsB.fives, countbackTotal_A: statsA.total, countbackTotal_B: statsB.total })}
                                      className="px-3 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-purple-600 rounded-xl text-[9px] font-black uppercase transition-all"
                                      title="Ambil Ulang Data Kualifikasi"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Winner Decision Buttons */}
                          <div className={`bg-slate-50 ${isCompact ? 'px-3 py-2 gap-1.5' : 'px-6 py-4 gap-3'} flex flex-col border-t`}>
                             <div className={`flex ${isCompact ? 'gap-1.5' : 'gap-3'}`}>
                               <button 
                                 disabled={!match.archerAId}
                                 onClick={() => updateMatch(match.id, { winnerId: match.archerAId, status: 'COMPLETED' })} 
                                 className={`flex-1 ${isCompact ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'} font-black uppercase tracking-widest border transition-all ${match.winnerId === match.archerAId ? 'bg-purple-600 text-white border-purple-600 shadow-xl' : match.scoreA > match.scoreB ? 'bg-white border-green-500 text-green-600 ring-2 ring-green-50' : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'}`}
                               >
                                 {match.winnerId === match.archerAId ? 'A Menang' : match.scoreA > match.scoreB ? 'A Unggul' : 'Pilih A'}
                               </button>
                               <button 
                                 disabled={!match.archerBId}
                                 onClick={() => updateMatch(match.id, { winnerId: match.archerBId, status: 'COMPLETED' })} 
                                 className={`flex-1 ${isCompact ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'} font-black uppercase tracking-widest border transition-all ${match.winnerId === match.archerBId ? 'bg-purple-600 text-white border-purple-600 shadow-xl' : match.scoreB > match.scoreA ? 'bg-white border-green-500 text-green-600 ring-2 ring-green-50' : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'}`}
                               >
                                 {match.winnerId === match.archerBId ? 'B Menang' : match.scoreB > match.scoreA ? 'B Unggul' : 'Pilih B'}
                               </button>
                             </div>

                             <button 
                               onClick={() => setSelectedMatchForEnds(match)}
                               className={`w-full ${isCompact ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'} bg-white text-slate-600 font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-all border border-slate-200`}
                             >
                               <FileText className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} /> Input Skor Rambahan &amp; Tie-Break
                             </button>
                             
                             {!match.winnerId && match.archerAId && match.archerBId && (match.scoreA > 0 || match.scoreB > 0) && (
                               <button 
                                 onClick={() => autoSelectWinner(match)}
                                 className={`w-full ${isCompact ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'} font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border ${
                                   isTied 
                                     ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 shadow-lg font-black animate-pulse' 
                                     : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200'
                                 }`}
                               >
                                 <Zap className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} /> {isTied ? 'Pilih Metode Tie-Break' : 'Selesai & Lanjut'}
                               </button>
                             )}

                             {match.winnerId && (
                               <button onClick={() => updateMatch(match.id, { winnerId: undefined })} className={`w-full ${isCompact ? 'py-1 rounded-lg text-[8px]' : 'py-2 rounded-xl text-[9px]'} bg-white text-slate-400 hover:text-red-500 border border-slate-200 transition-all flex items-center justify-center gap-1.5 font-black uppercase tracking-widest`}>
                                 <RefreshCw className="w-3 h-3" /> Reset Pemenang
                               </button>
                             )}
                          </div>
                        </div>
                        
                        {/* Connector Line Visualization */}
                        {rIndex < roundsData.length - 1 && round.round !== 1 && (
                          <div className={`absolute top-1/2 ${isCompact ? '-right-5 w-5' : '-right-12 w-12'} h-[2px] bg-slate-200 pointer-events-none`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-End & Tie-Break Score Input Modal */}
      {selectedMatchForEnds && (() => {
        const m = selectedMatchForEnds;
        const sA = getArcherStats(m.archerAId);
        const sB = getArcherStats(m.archerBId);
        const mSixA = m.countback6_A !== undefined ? m.countback6_A : sA.sixes;
        const mSixB = m.countback6_B !== undefined ? m.countback6_B : sB.sixes;
        const mFiveA = m.countback5_A !== undefined ? m.countback5_A : sA.fives;
        const mFiveB = m.countback5_B !== undefined ? m.countback5_B : sB.fives;
        const mTotA = m.countbackTotal_A !== undefined ? m.countbackTotal_A : sA.total;
        const mTotB = m.countbackTotal_B !== undefined ? m.countbackTotal_B : sB.total;

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center gap-3">
                 <div>
                    <h3 className="text-lg sm:text-xl font-black font-oswald uppercase italic leading-none">Input Skor Rambahan &amp; Penentuan Tie-Break</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Match #{m.matchNo} - ID: {m.id}</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPrintMatchId(m.id);
                        setShowEliminationPrintModal(true);
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                      title="Cetak Lembar Skoring Aduan Fisik Khusus Match Ini"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cetak Lembar Aduan Match Ini</span>
                    </button>
                    <button onClick={() => setSelectedMatchForEnds(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                 {/* Archer A */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white font-black">A</div>
                       <div>
                          <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">{getArcherName(m.archerAId)}</h4>
                          <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">{getArcherClub(m.archerAId)}</p>
                       </div>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                       {(m.endsA || Array(5).fill(0)).map((score, idx) => (
                          <div key={idx} className="space-y-2">
                             <p className="text-[9px] font-black text-slate-700 uppercase text-center">End {idx + 1}</p>
                             <input 
                                type="number" 
                                value={score} 
                                onChange={(e) => {
                                   const newEnds = [...(m.endsA || Array(5).fill(0))];
                                   newEnds[idx] = parseInt(e.target.value) || 0;
                                   updateMatch(m.id, { endsA: newEnds });
                                }}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black text-lg focus:border-purple-600 outline-none transition-all"
                             />
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="h-px bg-slate-100" />

                 {/* Archer B */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black">B</div>
                       <div>
                          <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">{getArcherName(m.archerBId)}</h4>
                          <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">{getArcherClub(m.archerBId)}</p>
                       </div>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                       {(m.endsB || Array(5).fill(0)).map((score, idx) => (
                          <div key={idx} className="space-y-2">
                             <p className="text-[9px] font-black text-slate-700 uppercase text-center">End {idx + 1}</p>
                             <input 
                                type="number" 
                                value={score} 
                                onChange={(e) => {
                                   const newEnds = [...(m.endsB || Array(5).fill(0))];
                                   newEnds[idx] = parseInt(e.target.value) || 0;
                                   updateMatch(m.id, { endsB: newEnds });
                                }}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black text-lg focus:border-purple-600 outline-none transition-all"
                             />
                          </div>
                       ))}
                    </div>
                 </div>

                 {/* Dual Tie-Break Detailed Section */}
                 <div className="p-6 bg-amber-50/80 rounded-3xl border border-amber-200 space-y-4">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                          <h5 className="font-black font-oswald uppercase italic text-amber-950 text-base">Metode Penentuan Pemenang (Jika Seri)</h5>
                       </div>
                       <span className="text-[9px] font-bold text-amber-800 bg-amber-200 px-2.5 py-0.5 rounded-full uppercase">Pilih Opsi 1 / Opsi 2</span>
                    </div>

                    {/* Modal Tab Switcher */}
                    <div className="flex bg-amber-200/60 p-1 rounded-2xl gap-1">
                      <button
                        onClick={() => setModalTieBreakTab('SHOOT_OFF')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                          modalTieBreakTab === 'SHOOT_OFF'
                            ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                            : 'text-amber-900 hover:text-slate-950'
                        }`}
                      >
                        <Target className="w-3.5 h-3.5" /> Opsi 1: Shoot-Off (1 Panah)
                      </button>
                      <button
                        onClick={() => setModalTieBreakTab('COUNTBACK')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                          modalTieBreakTab === 'COUNTBACK'
                            ? 'bg-emerald-600 text-white font-black shadow-md'
                            : 'text-amber-900 hover:text-slate-950'
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" /> Opsi 2: Jumlah Poin (6 &amp; 5)
                      </button>
                    </div>

                    {modalTieBreakTab === 'SHOOT_OFF' ? (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3">
                              <p className="text-[10px] font-black uppercase text-purple-700">Panah Atlet A ({getArcherName(m.archerAId)})</p>
                              <div className="flex gap-1.5 flex-wrap">
                                 {['X', 10, 9, 8, 7, 6, 0].map(val => (
                                    <button
                                       key={val}
                                       onClick={() => updateMatch(m.id, { shootOffA: val })}
                                       className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                          m.shootOffA === val 
                                             ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                                             : 'bg-slate-100 text-slate-700'
                                       }`}
                                    >
                                       {val}
                                    </button>
                                 ))}
                              </div>
                              <button
                                 onClick={() => updateMatch(m.id, { shootOffClosestA: !m.shootOffClosestA, shootOffClosestB: false })}
                                 className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${
                                    m.shootOffClosestA 
                                       ? 'bg-amber-500 text-slate-950 border-amber-600 font-black' 
                                       : 'bg-slate-50 text-slate-800 border-slate-200'
                                 }`}
                              >
                                 {m.shootOffClosestA ? '★ Panah Terdekat ke Titik Pusat' : 'Tandai Terdekat ke Pusat'}
                              </button>
                           </div>

                           <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3">
                              <p className="text-[10px] font-black uppercase text-slate-900">Panah Atlet B ({getArcherName(m.archerBId)})</p>
                              <div className="flex gap-1.5 flex-wrap">
                                 {['X', 10, 9, 8, 7, 6, 0].map(val => (
                                    <button
                                       key={val}
                                       onClick={() => updateMatch(m.id, { shootOffB: val })}
                                       className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                          m.shootOffB === val 
                                             ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                                             : 'bg-slate-100 text-slate-700'
                                       }`}
                                    >
                                       {val}
                                    </button>
                                 ))}
                              </div>
                              <button
                                 onClick={() => updateMatch(m.id, { shootOffClosestB: !m.shootOffClosestB, shootOffClosestA: false })}
                                 className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${
                                    m.shootOffClosestB 
                                       ? 'bg-amber-500 text-slate-950 border-amber-600 font-black' 
                                       : 'bg-slate-50 text-slate-800 border-slate-200'
                                 }`}
                              >
                                 {m.shootOffClosestB ? '★ Panah Terdekat ke Titik Pusat' : 'Tandai Terdekat ke Pusat'}
                              </button>
                           </div>
                        </div>

                        <button
                          onClick={() => handleApplyShootOffWinner(m)}
                          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" /> Tetapkan Pemenang Shoot-Off
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3">
                          {/* Perbandingan Angka 6 */}
                          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
                            <div className="text-left w-1/3 min-w-0">
                              <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(m.archerAId)}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <button onClick={() => updateMatch(m.id, { countback6_A: Math.max(0, mSixA - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                <span className="font-black text-base font-oswald text-purple-700">{mSixA}</span>
                                <button onClick={() => updateMatch(m.id, { countback6_A: mSixA + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                              </div>
                            </div>
                            <div className="text-center px-2">
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full font-black text-[9px] uppercase tracking-wider block">
                                Jumlah Angka 6 (X)
                              </span>
                              <span className="text-[8px] text-slate-700 font-bold block mt-0.5">
                                {mSixA > mSixB ? 'A Lebih Banyak' : mSixB > mSixA ? 'B Lebih Banyak' : 'Sama (Imbang)'}
                              </span>
                            </div>
                            <div className="text-right w-1/3 min-w-0">
                              <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(m.archerBId)}</p>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <button onClick={() => updateMatch(m.id, { countback6_B: Math.max(0, mSixB - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                <span className="font-black text-base font-oswald text-slate-900">{mSixB}</span>
                                <button onClick={() => updateMatch(m.id, { countback6_B: mSixB + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                              </div>
                            </div>
                          </div>

                          {/* Perbandingan Angka 5 */}
                          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
                            <div className="text-left w-1/3 min-w-0">
                              <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(m.archerAId)}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <button onClick={() => updateMatch(m.id, { countback5_A: Math.max(0, mFiveA - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                <span className="font-black text-base font-oswald text-purple-700">{mFiveA}</span>
                                <button onClick={() => updateMatch(m.id, { countback5_A: mFiveA + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                              </div>
                            </div>
                            <div className="text-center px-2">
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-full font-black text-[9px] uppercase tracking-wider block">
                                Jumlah Angka 5 (10)
                              </span>
                              <span className="text-[8px] text-slate-700 font-bold block mt-0.5">
                                {mFiveA > mFiveB ? 'A Lebih Banyak' : mFiveB > mFiveA ? 'B Lebih Banyak' : 'Sama (Imbang)'}
                              </span>
                            </div>
                            <div className="text-right w-1/3 min-w-0">
                              <p className="text-[8px] font-black uppercase text-slate-500 truncate">{getArcherName(m.archerBId)}</p>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <button onClick={() => updateMatch(m.id, { countback5_B: Math.max(0, mFiveB - 1) })} className="w-5 h-5 rounded bg-slate-200 text-[10px] font-bold">-</button>
                                <span className="font-black text-base font-oswald text-slate-900">{mFiveB}</span>
                                <button onClick={() => updateMatch(m.id, { countback5_B: mFiveB + 1 })} className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">+</button>
                              </div>
                            </div>
                          </div>

                          {/* Ringkasan Skor Kualifikasi */}
                          <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-xl text-[9px] font-black">
                            <span className="text-emerald-800">Total Poin: <b>{mTotA}</b></span>
                            <span className="text-slate-500 uppercase tracking-widest text-[8px]">Skor Total Kualifikasi</span>
                            <span className="text-emerald-800">Total Poin: <b>{mTotB}</b></span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleApplyCountbackWinner(m)}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Award className="w-4 h-4" /> Hitung &amp; Tetapkan Pemenang Countback (6/5)
                        </button>
                      </div>
                    )}
                 </div>
              </div>

              <div className="p-8 bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex gap-10">
                    <div>
                       <p className="text-[9px] font-black text-slate-700 uppercase">Total A</p>
                       <p className="text-2xl font-black font-oswald text-purple-600 leading-none">{m.scoreA}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-700 uppercase">Total B</p>
                       <p className="text-2xl font-black font-oswald text-slate-900 leading-none">{m.scoreB}</p>
                    </div>
                 </div>
                 <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                       onClick={() => {
                          if (m.scoreA === m.scoreB && (m.scoreA > 0 || m.scoreB > 0)) {
                             if (modalTieBreakTab === 'COUNTBACK') {
                               handleApplyCountbackWinner(m);
                             } else {
                               handleApplyShootOffWinner(m);
                             }
                          }
                          setSelectedMatchForEnds(null);
                       }} 
                       className="flex-1 sm:flex-none px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all"
                    >
                       Simpan &amp; Tutup
                    </button>
                 </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showPrintModal && (
        <PrintRoundReportModal
          event={event}
          initialCategory={activeCategory}
          initialRound="QUAL_QUALIFIED"
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {showEliminationPrintModal && (
        <PrintEliminationSheetsModal
          isOpen={showEliminationPrintModal}
          event={event}
          initialCategory={activeCategory}
          initialMatchId={printMatchId}
          onClose={() => {
            setShowEliminationPrintModal(false);
            setPrintMatchId(undefined);
          }}
        />
      )}
    </div>
  );
};

export default EliminationPanel;
