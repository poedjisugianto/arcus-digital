import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArcheryEvent, CategoryType, Match, Archer, TargetType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { Trophy, GitBranch, User, Save, RefreshCw, ChevronRight, Swords, ArrowLeft, Trash2, Settings2, Zap, Medal, Plus, Minus, Check, FileText, X, AlertTriangle, Bell, Volume2, Target } from 'lucide-react';
import { playShootOffAlarm, playVictorySound } from '../lib/soundAlarm';

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

  const config = (event.settings.categoryConfigs || {})[activeCategory as CategoryType];

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

  const handleApplyShootOffWinner = (match: Match) => {
    if (!match.archerAId || !match.archerBId) return;
    
    const valA = match.shootOffA !== undefined ? (match.shootOffA === 'X' ? 11 : Number(match.shootOffA)) : -1;
    const valB = match.shootOffB !== undefined ? (match.shootOffB === 'X' ? 11 : Number(match.shootOffB)) : -1;
    
    let winnerId: string | undefined = undefined;

    if (valA > valB) {
      winnerId = match.archerAId;
    } else if (valB > valA) {
      winnerId = match.archerBId;
    } else if (match.shootOffClosestA && !match.shootOffClosestB) {
      winnerId = match.archerAId;
    } else if (match.shootOffClosestB && !match.shootOffClosestA) {
      winnerId = match.archerBId;
    } else if (match.shootOffDistanceA !== undefined && match.shootOffDistanceB !== undefined) {
      if (match.shootOffDistanceA < match.shootOffDistanceB) {
        winnerId = match.archerAId;
      } else if (match.shootOffDistanceB < match.shootOffDistanceA) {
        winnerId = match.archerBId;
      }
    }

    if (!winnerId) {
      triggerFlag("Pilih panah unggul / centang panah terdekat ke pusat!");
      return;
    }

    updateMatch(match.id, { 
      winnerId, 
      isShootOff: true, 
      status: 'COMPLETED' 
    });
    triggerFlag(`Shoot-Off Selesai! Pemenang: ${getArcherName(winnerId)}`);
  };

  const autoSelectWinner = (match: Match) => {
    if (!match.archerAId || !match.archerBId) return;
    if (match.scoreA === match.scoreB) {
      playShootOffAlarm();
      updateMatch(match.id, { isShootOff: true });
      setActiveShootOffMatchId(match.id);
      triggerFlag("Skor Seri! Wajib Melakukan Shoot-off");
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
              <h2 className="text-xl font-black font-oswald uppercase italic leading-none">Manajemen Bagan Eliminasi & Shoot-Off</h2>
              {tiedMatches.length > 0 && (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider rounded-lg border border-amber-300">
                  {tiedMatches.length} Shoot-Off
                </span>
              )}
            </div>
            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-1">Sistem Eliminasi (64 / 32 / 16 / 8 Besar) & Aduan Final</p>
          </div>
        </div>
        
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

          <div className="flex flex-wrap items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[10px] font-black uppercase">
                 <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                 Warna Kuning/Oranye Berkedip = Mode Shoot-Off (Nilai Imbang)
               </div>
             </div>
             
             <div className="flex gap-3">
               <button 
                 onClick={() => { if(window.confirm('Hapus seluruh bagan untuk kategori ini?')) { onUpdateMatches({ ...event.matches, [activeCategory]: [] }); triggerFlag("Bagan Berhasil Direset"); } }}
                 className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
               >
                 <Trash2 className="w-4 h-4" /> Reset Bagan
               </button>
             </div>
          </div>

          {/* Bracket Visualization */}
          <div ref={scrollContainerRef} className="flex gap-12 overflow-x-auto pb-12 pt-4 px-4 no-scrollbar scroll-smooth">
            {roundsData.map((round, rIndex) => (
              <div key={round.round} className="flex flex-col gap-8 min-w-[370px]">
                <div className="text-center">
                  <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] italic border-2 shadow-lg ${round.round === 1 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-900 border-purple-500 text-white'}`}>
                    {round.label}
                  </span>
                </div>
                
                <div className="flex flex-col h-full justify-around gap-8">
                  {round.matches.map((match) => {
                    const isTied = match.archerAId && match.archerBId && match.scoreA === match.scoreB && (match.scoreA > 0 || match.scoreB > 0);
                    const isShootOffActive = isTied || match.isShootOff;
                    const hasShootOffRecord = match.isShootOff || match.shootOffA !== undefined || match.shootOffB !== undefined;

                    return (
                      <div key={match.id} className="relative group">
                        <div className={`bg-white rounded-[2.5rem] border-2 overflow-hidden shadow-lg transition-all duration-300 ${
                          isTied && !match.winnerId 
                            ? 'border-amber-500 ring-4 ring-amber-400/50 shadow-amber-500/20 animate-pulse' 
                            : match.winnerId 
                              ? 'border-purple-200 ring-4 ring-purple-50' 
                              : 'border-slate-100'
                        }`}>
                          {/* Match Header Badge */}
                          <div className={`px-6 py-2.5 flex items-center justify-between border-b text-[10px] font-black uppercase tracking-wider ${
                            isTied && !match.winnerId 
                              ? 'bg-amber-500 text-slate-950 font-black' 
                              : hasShootOffRecord 
                                ? 'bg-purple-900 text-white' 
                                : 'bg-slate-50 text-slate-700'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span>Match #{match.matchNo}</span>
                              {hasShootOffRecord && (
                                <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 rounded text-[8px] font-black uppercase">
                                  SHOOT-OFF
                                </span>
                              )}
                            </div>
                            {isTied && !match.winnerId ? (
                              <button 
                                onClick={() => playShootOffAlarm()} 
                                className="flex items-center gap-1 bg-white/20 hover:bg-white/40 text-black px-2 py-0.5 rounded text-[8px] font-black uppercase"
                              >
                                <Volume2 className="w-3 h-3" /> Alarm
                              </button>
                            ) : match.winnerId ? (
                              <span className="text-emerald-500 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> SELESAI
                              </span>
                            ) : (
                              <span>ROUND {match.round}</span>
                            )}
                          </div>

                          {/* Tied Alert Notification Banner */}
                          {isTied && !match.winnerId && (
                            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-amber-900 text-[10px] font-black">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>SKOR SERI ({match.scoreA} - {match.scoreB})! Wajib Shoot-Off</span>
                              </div>
                              <button
                                onClick={() => setActiveShootOffMatchId(activeShootOffMatchId === match.id ? null : match.id)}
                                className="text-[9px] font-black uppercase px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-all"
                              >
                                {activeShootOffMatchId === match.id ? 'Tutup Panel S.O' : 'Input Shoot-Off'}
                              </button>
                            </div>
                          )}

                          {/* Historical Display: Data Sebelum vs Sesudah Shoot-Off */}
                          {hasShootOffRecord && (
                            <div className="bg-purple-50/70 border-b border-purple-100 px-6 py-2.5 flex items-center justify-between text-[9px] font-black uppercase">
                              <div className="flex items-center gap-2 text-purple-900">
                                <span className="text-purple-500 font-bold">Skor Regulasi (Sebelum):</span>
                                <span className="px-2 py-0.5 bg-white rounded border text-purple-700">{match.scoreA} - {match.scoreB}</span>
                              </div>
                              <div className="flex items-center gap-2 text-purple-900">
                                <span className="text-amber-600 font-bold">Hasil Shoot-Off:</span>
                                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded font-black">
                                  {match.shootOffA !== undefined ? match.shootOffA : '-'}{match.shootOffClosestA ? ' (X)' : ''} vs {match.shootOffB !== undefined ? match.shootOffB : '-'}{match.shootOffClosestB ? ' (X)' : ''}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Slot A - Quick Input */}
                          <div className={`p-6 flex items-center justify-between gap-4 border-b ${match.winnerId === match.archerAId ? 'bg-purple-50/50' : ''}`}>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${match.winnerId === match.archerAId ? 'bg-purple-600 text-white shadow-lg' : match.scoreA > match.scoreB ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                 {match.winnerId === match.archerAId ? <Check className="w-5 h-5" /> : 'A'}
                                </div>
                                <div className="min-w-0">
                                  <span className={`font-black uppercase font-oswald text-sm italic truncate block ${match.winnerId === match.archerAId ? 'text-purple-700' : 'text-slate-600'}`}>
                                    {getArcherName(match.archerAId)}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-700 uppercase tracking-wider truncate block">
                                    {getArcherClub(match.archerAId)}
                                  </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                               <button onClick={() => updateMatch(match.id, { scoreA: Math.max(0, match.scoreA - 1) })} className="w-8 h-8 rounded-lg bg-slate-50 border flex items-center justify-center hover:bg-slate-100 active:scale-90 transition-all text-slate-700"><Minus className="w-4 h-4" /></button>
                               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black font-oswald border-2 shadow-inner ${
                                 isTied 
                                   ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                   : match.scoreA > match.scoreB 
                                     ? 'bg-green-50 border-green-200 text-green-700' 
                                     : 'bg-white border-slate-100 text-slate-900'
                               }`}>
                                 {match.scoreA}
                               </div>
                               <button onClick={() => updateMatch(match.id, { scoreA: match.scoreA + 1 })} className="w-8 h-8 rounded-lg bg-purple-50 border-purple-100 border flex items-center justify-center hover:bg-purple-100 active:scale-90 transition-all text-purple-600"><Plus className="w-4 h-4" /></button>
                            </div>
                          </div>

                          {/* Slot B - Quick Input */}
                          <div className={`p-6 flex items-center justify-between gap-4 ${match.winnerId === match.archerBId ? 'bg-purple-50/50' : ''}`}>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${match.winnerId === match.archerBId ? 'bg-purple-600 text-white shadow-lg' : match.scoreB > match.scoreA ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                 {match.winnerId === match.archerBId ? <Check className="w-5 h-5" /> : 'B'}
                                </div>
                                <div className="min-w-0">
                                  <span className={`font-black uppercase font-oswald text-sm italic truncate block ${match.winnerId === match.archerBId ? 'text-purple-700' : 'text-slate-600'}`}>
                                    {getArcherName(match.archerBId)}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-700 uppercase tracking-wider truncate block">
                                    {getArcherClub(match.archerBId)}
                                  </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                               <button onClick={() => updateMatch(match.id, { scoreB: Math.max(0, match.scoreB - 1) })} className="w-8 h-8 rounded-lg bg-slate-50 border flex items-center justify-center hover:bg-slate-100 active:scale-90 transition-all text-slate-700"><Minus className="w-4 h-4" /></button>
                               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black font-oswald border-2 shadow-inner ${
                                 isTied 
                                   ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                   : match.scoreB > match.scoreA 
                                     ? 'bg-green-50 border-green-200 text-green-700' 
                                     : 'bg-white border-slate-100 text-slate-900'
                               }`}>
                                 {match.scoreB}
                               </div>
                               <button onClick={() => updateMatch(match.id, { scoreB: match.scoreB + 1 })} className="w-8 h-8 rounded-lg bg-purple-50 border-purple-100 border flex items-center justify-center hover:bg-purple-100 active:scale-90 transition-all text-purple-600"><Plus className="w-4 h-4" /></button>
                            </div>
                          </div>

                          {/* Shoot-Off Direct Scoring Input Box (Expands when tied or opened) */}
                          {(isTied || activeShootOffMatchId === match.id || hasShootOffRecord) && (
                            <div className="bg-amber-50/70 p-5 border-t border-amber-200 space-y-4">
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
                                {hasShootOffRecord && (
                                  <button
                                    onClick={() => updateMatch(match.id, { isShootOff: false, shootOffA: undefined, shootOffB: undefined, shootOffClosestA: false, shootOffClosestB: false })}
                                    className="px-3 py-2.5 bg-white border border-slate-200 text-slate-800 hover:text-red-600 rounded-xl text-[9px] font-black uppercase transition-all"
                                  >
                                    Hapus S.O
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Winner Decision Buttons */}
                          <div className="bg-slate-50 px-6 py-4 flex flex-col gap-3 border-t">
                             <div className="flex gap-3">
                               <button 
                                 disabled={!match.archerAId}
                                 onClick={() => updateMatch(match.id, { winnerId: match.archerAId, status: 'COMPLETED' })} 
                                 className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${match.winnerId === match.archerAId ? 'bg-purple-600 text-white border-purple-600 shadow-xl' : match.scoreA > match.scoreB ? 'bg-white border-green-500 text-green-600 ring-4 ring-green-50' : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'}`}
                               >
                                 {match.winnerId === match.archerAId ? 'A Menang' : match.scoreA > match.scoreB ? 'A Unggul' : 'Pilih A'}
                               </button>
                               <button 
                                 disabled={!match.archerBId}
                                 onClick={() => updateMatch(match.id, { winnerId: match.archerBId, status: 'COMPLETED' })} 
                                 className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${match.winnerId === match.archerBId ? 'bg-purple-600 text-white border-purple-600 shadow-xl' : match.scoreB > match.scoreA ? 'bg-white border-green-500 text-green-600 ring-4 ring-green-50' : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'}`}
                               >
                                 {match.winnerId === match.archerBId ? 'B Menang' : match.scoreB > match.scoreA ? 'B Unggul' : 'Pilih B'}
                               </button>
                             </div>

                             <button 
                               onClick={() => setSelectedMatchForEnds(match)}
                               className="w-full py-3 bg-white text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all border border-slate-200"
                             >
                               <FileText className="w-3 h-3" /> Input Skor Rambahan &amp; Shoot-Off
                             </button>
                             
                             {!match.winnerId && match.archerAId && match.archerBId && (match.scoreA > 0 || match.scoreB > 0) && (
                               <button 
                                 onClick={() => autoSelectWinner(match)}
                                 className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${
                                   isTied 
                                     ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 shadow-lg font-black animate-pulse' 
                                     : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200'
                                 }`}
                               >
                                 <Zap className="w-3 h-3" /> {isTied ? 'Mulai Shoot-Off' : 'Selesai & Lanjut'}
                               </button>
                             )}

                             {match.winnerId && (
                               <button onClick={() => updateMatch(match.id, { winnerId: undefined })} className="w-full py-2 bg-white text-slate-300 hover:text-red-500 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest">
                                 <RefreshCw className="w-3 h-3" /> Reset Pemenang
                               </button>
                             )}
                          </div>
                        </div>
                        
                        {/* Connector Line Visualization */}
                        {rIndex < roundsData.length - 1 && round.round !== 1 && (
                          <div className="absolute top-1/2 -right-12 w-12 h-[2px] bg-slate-100 pointer-events-none"></div>
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

      {/* Per-End & Shoot-Off Score Input Modal */}
      {selectedMatchForEnds && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
               <div>
                  <h3 className="text-xl font-black font-oswald uppercase italic leading-none">Input Skor Per-Rambahan &amp; Shoot-Off</h3>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-1">Match ID: {selectedMatchForEnds.id}</p>
               </div>
               <button onClick={() => setSelectedMatchForEnds(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6 text-slate-700" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
               {/* Archer A */}
               <div className="space-y-4">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white font-black">A</div>
                     <div>
                        <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">{getArcherName(selectedMatchForEnds.archerAId)}</h4>
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">{getArcherClub(selectedMatchForEnds.archerAId)}</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                     {(selectedMatchForEnds.endsA || Array(5).fill(0)).map((score, idx) => (
                        <div key={idx} className="space-y-2">
                           <p className="text-[9px] font-black text-slate-700 uppercase text-center">End {idx + 1}</p>
                           <input 
                              type="number" 
                              value={score} 
                              onChange={(e) => {
                                 const newEnds = [...(selectedMatchForEnds.endsA || Array(5).fill(0))];
                                 newEnds[idx] = parseInt(e.target.value) || 0;
                                 updateMatch(selectedMatchForEnds.id, { endsA: newEnds });
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
                        <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">{getArcherName(selectedMatchForEnds.archerBId)}</h4>
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">{getArcherClub(selectedMatchForEnds.archerBId)}</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                     {(selectedMatchForEnds.endsB || Array(5).fill(0)).map((score, idx) => (
                        <div key={idx} className="space-y-2">
                           <p className="text-[9px] font-black text-slate-700 uppercase text-center">End {idx + 1}</p>
                           <input 
                              type="number" 
                              value={score} 
                              onChange={(e) => {
                                 const newEnds = [...(selectedMatchForEnds.endsB || Array(5).fill(0))];
                                 newEnds[idx] = parseInt(e.target.value) || 0;
                                 updateMatch(selectedMatchForEnds.id, { endsB: newEnds });
                              }}
                              className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black text-lg focus:border-purple-600 outline-none transition-all"
                           />
                        </div>
                     ))}
                  </div>
               </div>

               {/* Shoot-Off Detailed Section */}
               <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <h5 className="font-black font-oswald uppercase italic text-amber-950 text-base">Penentuan Shoot-Off (Jika Skor Akhir Seri)</h5>
                     </div>
                     <span className="text-[9px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded uppercase">1 Panah Penentu</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3">
                        <p className="text-[10px] font-black uppercase text-purple-700">Panah Atlet A ({getArcherName(selectedMatchForEnds.archerAId)})</p>
                        <div className="flex gap-1.5 flex-wrap">
                           {['X', 10, 9, 8, 7, 6, 0].map(val => (
                              <button
                                 key={val}
                                 onClick={() => updateMatch(selectedMatchForEnds.id, { shootOffA: val })}
                                 className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    selectedMatchForEnds.shootOffA === val 
                                       ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                                       : 'bg-slate-100 text-slate-700'
                                 }`}
                              >
                                 {val}
                              </button>
                           ))}
                        </div>
                        <button
                           onClick={() => updateMatch(selectedMatchForEnds.id, { shootOffClosestA: !selectedMatchForEnds.shootOffClosestA, shootOffClosestB: false })}
                           className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${
                              selectedMatchForEnds.shootOffClosestA 
                                 ? 'bg-amber-500 text-slate-950 border-amber-600 font-black' 
                                 : 'bg-slate-50 text-slate-800 border-slate-200'
                           }`}
                        >
                           {selectedMatchForEnds.shootOffClosestA ? '★ Panah Terdekat ke Titik Pusat' : 'Tandai Terdekat ke Pusat'}
                        </button>
                     </div>

                     <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3">
                        <p className="text-[10px] font-black uppercase text-slate-900">Panah Atlet B ({getArcherName(selectedMatchForEnds.archerBId)})</p>
                        <div className="flex gap-1.5 flex-wrap">
                           {['X', 10, 9, 8, 7, 6, 0].map(val => (
                              <button
                                 key={val}
                                 onClick={() => updateMatch(selectedMatchForEnds.id, { shootOffB: val })}
                                 className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    selectedMatchForEnds.shootOffB === val 
                                       ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                                       : 'bg-slate-100 text-slate-700'
                                 }`}
                              >
                                 {val}
                              </button>
                           ))}
                        </div>
                        <button
                           onClick={() => updateMatch(selectedMatchForEnds.id, { shootOffClosestB: !selectedMatchForEnds.shootOffClosestB, shootOffClosestA: false })}
                           className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${
                              selectedMatchForEnds.shootOffClosestB 
                                 ? 'bg-amber-500 text-slate-950 border-amber-600 font-black' 
                                 : 'bg-slate-50 text-slate-800 border-slate-200'
                           }`}
                        >
                           {selectedMatchForEnds.shootOffClosestB ? '★ Panah Terdekat ke Titik Pusat' : 'Tandai Terdekat ke Pusat'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="flex gap-10">
                  <div>
                     <p className="text-[9px] font-black text-slate-700 uppercase">Total A</p>
                     <p className="text-2xl font-black font-oswald text-purple-600 leading-none">{selectedMatchForEnds.scoreA}</p>
                  </div>
                  <div>
                     <p className="text-[9px] font-black text-slate-700 uppercase">Total B</p>
                     <p className="text-2xl font-black font-oswald text-slate-900 leading-none">{selectedMatchForEnds.scoreB}</p>
                  </div>
               </div>
               <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                     onClick={() => {
                        if (selectedMatchForEnds.scoreA === selectedMatchForEnds.scoreB && (selectedMatchForEnds.scoreA > 0 || selectedMatchForEnds.scoreB > 0)) {
                           handleApplyShootOffWinner(selectedMatchForEnds);
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
      )}
    </div>
  );
};

export default EliminationPanel;
