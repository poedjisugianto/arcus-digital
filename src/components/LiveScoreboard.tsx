import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trophy, Clock, X, Swords, Medal, LayoutList, Target, ChevronRight, ChevronDown, ListFilter, Info, Activity, Monitor, Search, Check, Maximize2, Pause, Play, ChevronLeft, Youtube, Heart, AlertTriangle, Award, Sparkles, Table as TableIcon, ArrowUp } from 'lucide-react';
import { ArcheryEvent, CategoryType, Match, TargetType, Sponsorship } from '../types';
import { CATEGORY_LABELS } from '../constants';
import ArcusLogo from './ArcusLogo';
import { motion, AnimatePresence } from 'motion/react';
import { resolveGoogleDriveUrl } from '../lib/photoService';

interface Props {
  state: ArcheryEvent;
  onBack: () => void;
  startInTVMode?: boolean;
}

const SponsorMatras = () => {
  const [index, setIndex] = useState(0);
  const sponsors = [
    { title: "HIT THE TARGET", desc: "ARCUS DIGITAL - SMART ARCHERY SYSTEM", color: "bg-arcus-red" },
    { title: "POWERED BY", desc: "TRADITIONAL ARCHERY INDONESIA", color: "bg-slate-900" },
    { title: "OFFICIAL PARTNER", desc: "LOCAL CLUB ARCHERY INDONESIA", color: "bg-blue-900" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % sponsors.length);
    }, 180000); // 3 Menit (180 detik)
    return () => clearInterval(timer);
  }, []);

  const current = sponsors[index];

  return (
    <div className={`hidden xl:flex items-center gap-4 ${current.color} rounded-lg px-6 py-2 border border-white/10 shadow-lg animate-in fade-in duration-1000 overflow-hidden relative group shrink-0`}>
       <div className="absolute inset-0 bg-white/5 skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-[2000ms]" />
       <div className="relative z-10 flex flex-col">
          <p className="text-[8px] font-black text-white/90 uppercase italic tracking-[0.2em]">{current.title}</p>
          <p className="text-white text-xs font-black uppercase italic tracking-tighter">{current.desc}</p>
       </div>
    </div>
  );
};

const FooterSponsorshipSlider = ({ tournamentName, sponsorships, isTVMode }: { tournamentName: string, sponsorships?: Sponsorship[], isTVMode: boolean }) => {
  const [index, setIndex] = useState(0);
  const sponsors = useMemo(() => {
    if (sponsorships && sponsorships.length > 0) {
      return sponsorships.map(s => ({
        title: s.title || "OFFICIAL PARTNER",
        name: s.name || "PARTNER RESMI",
        logoUrl: s.logoUrl || '',
        icon: s.logoUrl ? null : <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
      }));
    }
    return [
      { title: "HOSTED BY", name: tournamentName, logoUrl: '', icon: <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" /> },
      { title: "OFFICIAL PARTNER", name: "ARCUS DIGITAL ARCHERY", logoUrl: '', icon: <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" /> },
      { title: "SUPPORTED BY", name: "TRADITIONAL ARCHERY ID", logoUrl: '', icon: <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" /> },
      { title: "EQUIPMENT BY", name: "ARCUS PRO SHOP", logoUrl: '', icon: <Target className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" /> }
    ];
  }, [tournamentName, sponsorships]);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % sponsors.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  const current = sponsors[index] || sponsors[0];

  return (
    <div className={`px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl border flex items-center gap-3 sm:gap-5 min-w-0 transition-all duration-700 ${
      isTVMode 
        ? 'bg-slate-900/90 border-white/20 text-white shadow-2xl backdrop-blur-md' 
        : 'bg-white border-slate-200/90 text-slate-900 shadow-md ring-1 ring-slate-100'
    }`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1"
        >
          {/* Prominent Logo Showcase Box */}
          <div className="h-12 sm:h-16 min-w-[3.5rem] sm:min-w-[4.5rem] px-3 py-1.5 bg-white rounded-xl border border-slate-200/90 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
            {current.logoUrl ? (
              <img 
                src={resolveGoogleDriveUrl(current.logoUrl)} 
                alt={current.name} 
                className="max-h-9 sm:max-h-13 w-auto max-w-[120px] sm:max-w-[180px] object-contain drop-shadow-xs" 
                referrerPolicy="no-referrer" 
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`logo-fallback ${current.logoUrl ? 'hidden' : 'flex'} items-center justify-center w-full h-full bg-slate-900 text-amber-400 font-black font-oswald text-base sm:text-lg rounded-lg uppercase tracking-wider px-2`}
            >
              {current.icon || (current.name ? current.name.substring(0, 2) : <Award className="w-5 h-5 text-amber-400" />)}
            </div>
          </div>

          {/* Sponsor Title & Name */}
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[8px] sm:text-[9.5px] font-black uppercase tracking-[0.25em] px-2.5 py-0.5 rounded-full font-mono shadow-2xs ${
                isTVMode 
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                  : 'bg-slate-900 text-amber-300'
              }`}>
                {current.title}
              </span>
              {sponsors.length > 1 && (
                <span className={`text-[8px] font-bold ${isTVMode ? 'text-white/60' : 'text-slate-600'}`}>
                  • {index + 1}/{sponsors.length}
                </span>
              )}
            </div>
            <p className={`text-xs sm:text-xl font-black font-oswald uppercase italic tracking-wider truncate leading-tight ${
              isTVMode ? 'text-white' : 'text-slate-950'
            }`}>
              {current.name}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Multiple sponsor indicator dots */}
      {sponsors.length > 1 && (
        <div className="flex flex-col gap-1 pl-1 shrink-0">
          {sponsors.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index 
                  ? (isTVMode ? 'bg-amber-400 w-3.5' : 'bg-slate-900 w-3.5') 
                  : (isTVMode ? 'bg-white/20 w-1.5' : 'bg-slate-200 w-1.5')
              }`}
              title={`Sponsor ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TVVideoSponsor = ({ sponsorships }: { sponsorships?: Sponsorship[] }) => {
  const [index, setIndex] = useState(0);
  const sponsorsWithVideo = useMemo(() => 
    (sponsorships || []).filter(s => s.videoUrl), 
    [sponsorships]
  );

  useEffect(() => {
    if (sponsorsWithVideo.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % sponsorsWithVideo.length);
    }, 60000); 
    return () => clearInterval(timer);
  }, [sponsorsWithVideo.length]);

  if (sponsorsWithVideo.length === 0) return null;

  const current = sponsorsWithVideo[index];
  
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      const id = (match && match[2].length === 11) ? match[2] : null;
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}`;
    }
    return url;
  };

  return (
    <div className="w-full h-full bg-black rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white/5 relative group">
       <iframe 
         src={getEmbedUrl(current.videoUrl!)} 
         className="w-full h-full border-0" 
         allow="autoplay; encrypted-media" 
         allowFullScreen
         title={`Sponsor Video: ${current.name}`}
       />
       <div className="absolute top-8 left-8 flex items-center gap-3">
          <div className="bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-3 border border-white/10">
             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black text-white uppercase tracking-widest">ARCUS BROADCAST</span>
          </div>
       </div>
       <div className="absolute bottom-8 left-8 right-8">
          <div className="bg-slate-950/80 backdrop-blur-md p-6 rounded-2xl flex items-center justify-between border border-white/10">
             <div className="flex items-center gap-4">
                {current.logoUrl && <img src={resolveGoogleDriveUrl(current.logoUrl)} className="w-12 h-12 rounded-xl object-contain bg-white p-2" alt="" referrerPolicy="no-referrer" />}
                <div>
                  <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">{current.title}</p>
                  <p className="text-xl font-black text-white uppercase font-oswald italic tracking-wider">{current.name}</p>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const LiveScoreboard: React.FC<Props> = ({ state, onBack, startInTVMode = false }) => {
  const [activeTab, setActiveTab] = useState<'KUALIFIKASI' | 'ELIMINASI'>('KUALIFIKASI');
  const [filterCategory, setFilterCategory] = useState<CategoryType>(CategoryType.ADULT_PUTRA);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSession, setActiveSession] = useState<string>('QUAL');
  const [isTVMode, setIsTVMode] = useState(startInTVMode);
  const [isPaused, setIsPaused] = useState(false);
  const [elimDisplayMode, setElimDisplayMode] = useState<'CARDS' | 'BRACKET'>('BRACKET');
  const [viewMode, setViewMode] = useState<'COMPACT' | 'CARDS' | 'TABLE'>('COMPACT');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false);
  const [pageRange, setPageRange] = useState<number | 'ALL'>('ALL');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pageSize = 25;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowScrollTop(el.scrollTop > 250);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setPageRange('ALL');
    setShowQualifiedOnly(false);
  }, [filterCategory, activeSession]);

  const settings: any = state?.settings || {};
  const config = (settings.categoryConfigs || {})[filterCategory];
  const archersList = state?.archers || [];
  
  const allCategories = useMemo(() => [
    CategoryType.ADULT_PUTRA,
    CategoryType.ADULT_PUTRI,
    CategoryType.U18_PUTRA,
    CategoryType.U18_PUTRI,
    CategoryType.U12_PUTRA,
    CategoryType.U12_PUTRI,
    CategoryType.U9_PUTRA,
    CategoryType.U9_PUTRI
  ], []);

  // TV Mode Auto-Rotation
  useEffect(() => {
    if (!isTVMode || isPaused) return;

    const timer = setInterval(() => {
      setFilterCategory(prev => {
        const currentIndex = allCategories.indexOf(prev);
        const nextIndex = (currentIndex + 1) % allCategories.length;
        return allCategories[nextIndex];
      });
      setActiveSession('QUAL');
      
      // Reset scroll when category changes
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 20000); // Cycle every 20 seconds

    return () => clearInterval(timer);
  }, [isTVMode, isPaused, allCategories]);

  // TV Mode Auto-Scrolling
  useEffect(() => {
    if (!isTVMode || isPaused) return;

    let scrollInterval: NodeJS.Timeout;
    let direction = 1;
    
    const startScrolling = () => {
      scrollInterval = setInterval(() => {
        if (scrollContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          
          if (direction === 1 && scrollTop + clientHeight >= scrollHeight - 2) {
            // Stay at bottom for a bit
            clearInterval(scrollInterval);
            setTimeout(() => {
              direction = -1;
              startScrolling();
            }, 5000);
          } else if (direction === -1 && scrollTop <= 0) {
            // Stay at top for a bit
            clearInterval(scrollInterval);
            setTimeout(() => {
              direction = 1;
              startScrolling();
            }, 5000);
          } else {
            scrollContainerRef.current.scrollBy({ top: direction * 0.5, behavior: 'auto' });
          }
        }
      }, 30); // Very smooth slow scroll
    };

    startScrolling();
    return () => clearInterval(scrollInterval);
  }, [isTVMode, isPaused, filterCategory]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
        setIsTVMode(true);
    } else {
        document.exitFullscreen();
        setIsTVMode(false);
    }
  };

  const availableSessions = useMemo(() => {
    const sessions = ['QUAL'];
    if (config?.eliminationStages) {
      config.eliminationStages.forEach(size => {
        sessions.push(`ELIM_${size}`);
      });
    }
    return sessions;
  }, [config]);

  const isSmallTarget = config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA;
  const isSixRing = config?.targetType === TargetType.TRADITIONAL_6_RING;
  const isFiveRing = config?.targetType === TargetType.FACE_5_RING;
  const labelSix = isSmallTarget ? '2s' : (isFiveRing ? '5s' : (isSixRing ? '6s' : '10s/X'));
  const labelFive = isSmallTarget ? '1s' : (isFiveRing ? '4s' : (isSixRing ? '5s' : '9s'));

  const matches = useMemo(() => {
    return (state?.matches as any)?.[filterCategory] || [];
  }, [state?.matches, filterCategory]);

  const roundsData = useMemo(() => {
    const rounds: Record<string, Match[]> = {};
    matches.forEach((m: Match) => {
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
  }, [matches]);

  const currentCutoffInfo = useMemo(() => {
    const rawStages = config?.eliminationStages && config.eliminationStages.length > 0
      ? [...config.eliminationStages].map((s: any) => parseInt(s)).filter((s: number) => !isNaN(s) && s > 0).sort((a: number, b: number) => b - a)
      : [];
    const h2h = config?.h2hStartSize || (matches.length > 0 ? Math.max(...matches.map((m: Match) => parseInt(m.round))) : 0);

    // KUALIFIKASI:
    if (activeSession === 'QUAL') {
      // Jika ada tahapan penyaringan bertahap (contoh [32, 16]), tahap pertama adalah 32 Besar
      if (rawStages.length > 0) {
        const firstStage = rawStages[0];
        return {
          size: firstStage,
          label: `${firstStage} BESAR`,
          fullLabel: `BATAS LOLOS PENYARINGAN (${firstStage} BESAR)`,
          subLabel: `Lolos ke Babak Penyaringan ${firstStage} Besar`
        };
      }
      // Jika langsung ke aduan (H2H)
      if (h2h > 0) {
        return {
          size: h2h,
          label: `${h2h} BESAR`,
          fullLabel: `BATAS LOLOS BABAK ADUAN (${h2h} BESAR)`,
          subLabel: `Lolos ke Bagan Aduan ${h2h} Besar`
        };
      }
      return { size: 0, label: '', fullLabel: '', subLabel: '' };
    }

    // BABAK PENYARINGAN BERTINGKAT (ELIM_32, ELIM_16, dst):
    if (activeSession.startsWith('ELIM_')) {
      const currentStageSize = parseInt(activeSession.replace('ELIM_', ''));
      const stageIndex = rawStages.indexOf(currentStageSize);
      
      // Jika masih ada babak penyaringan berikutnya (contoh dari 32 lanjut ke 16)
      if (stageIndex !== -1 && stageIndex < rawStages.length - 1) {
        const nextStage = rawStages[stageIndex + 1];
        return {
          size: nextStage,
          label: `${nextStage} BESAR`,
          fullLabel: `BATAS LOLOS PENYARINGAN (${nextStage} BESAR)`,
          subLabel: `Lolos ke Babak Penyaringan ${nextStage} Besar`
        };
      }
      
      // Jika sudah di babak penyaringan terkecil, tahap berikutnya adalah babak Aduan (H2H)
      if (h2h > 0) {
        return {
          size: h2h,
          label: `${h2h} BESAR`,
          fullLabel: `BATAS LOLOS BABAK ADUAN (${h2h} BESAR)`,
          subLabel: `Lolos ke Bagan Aduan ${h2h} Besar`
        };
      }
    }

    return {
      size: h2h,
      label: h2h > 0 ? `${h2h} BESAR` : '',
      fullLabel: h2h > 0 ? `BATAS LOLOS BABAK ADUAN (${h2h} BESAR)` : '',
      subLabel: ''
    };
  }, [config, activeSession, matches]);

  const eliminationSize = currentCutoffInfo.size;

  const leaderBoard = useMemo(() => {
    const archersList = state.archers || [];
    const scoresList = state.scores || [];
    const data = archersList
      .filter(a => a.category === filterCategory)
      .map(archer => {
        const scores = scoresList.filter(s => s.archerId === archer.id && s.sessionId === activeSession && !s.isDeleted);
        const total = scores.reduce((acc, curr) => acc + curr.total, 0);
        
        const manualSixes = scores.reduce((acc, curr) => acc + (curr.count6 || 0), 0);
        const manualFives = scores.reduce((acc, curr) => acc + (curr.count5 || 0), 0);
        
        const allArrows = scores.flatMap(s => s.arrows || []).filter(v => v !== -1);
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
        
        const hasManual = scores.some(s => s.count6 !== undefined);
        const sixes = hasManual ? manualSixes : arrowSixes;
        const fives = hasManual ? manualFives : arrowFives;
        
        // Map scores for each end
        const endScores = Array.from({ length: config?.ends || 0 }).map((_, i) => {
          const s = scores.find(sc => sc.endIndex === i && sc.sessionId === activeSession);
          return s ? s.total : null;
        });
        
        return { ...archer, total, sixes, fives, endScores };
      })
      .filter(a => activeSession === 'QUAL' || a.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.sixes !== a.sixes) return b.sixes - a.sixes;
        return b.fives - a.fives;
      });

    return data.map((item, idx, arr) => {
      const isTie = arr.some((other, oIdx) => 
        oIdx !== idx && other.total === item.total && other.sixes === item.sixes && other.fives === item.fives
      );
      
      let tieLabel = "";
      let displayRank = idx + 1;

      if (isTie) {
        const tieGroup = arr.filter(o => o.total === item.total && o.sixes === item.sixes && o.fives === item.fives);
        const firstInTie = arr.findIndex(o => o.total === item.total && o.sixes === item.sixes && o.fives === item.fives);
        const posInTie = tieGroup.findIndex(o => o.id === item.id);
        tieLabel = String.fromCharCode(65 + posInTie);
        displayRank = firstInTie + 1;
      }
      
      return { ...item, tieLabel, displayRank, labelSix, labelFive };
    });
  }, [state, filterCategory, activeSession, config, isSmallTarget, labelSix, labelFive]);

  const filteredLeaderBoard = useMemo(() => {
    if (!searchTerm) return leaderBoard;
    const search = searchTerm.toLowerCase();
    return leaderBoard.filter(a => 
      (a.name || '').toLowerCase().includes(search) || 
      (a.club || '').toLowerCase().includes(search) ||
      (String(a.targetNo || '') + String(a.position || '')).toLowerCase().includes(search)
    );
  }, [leaderBoard, searchTerm]);

  const displayedLeaderBoard = useMemo(() => {
    if (showQualifiedOnly && eliminationSize > 0) {
      return filteredLeaderBoard.filter((_, idx) => (idx + 1) <= eliminationSize);
    }
    return filteredLeaderBoard;
  }, [filteredLeaderBoard, showQualifiedOnly, eliminationSize]);

  const paginatedLeaderBoard = useMemo(() => {
    if (pageRange === 'ALL' || searchTerm.trim() !== '') {
      return displayedLeaderBoard;
    }
    const pageIdx = typeof pageRange === 'number' ? pageRange : 0;
    const start = pageIdx * pageSize;
    return displayedLeaderBoard.slice(start, start + pageSize);
  }, [displayedLeaderBoard, pageRange, searchTerm]);

  const hasVideoSponsors = useMemo(() => 
    (settings.sponsorships || []).some(s => s.videoUrl), 
    [settings.sponsorships]
  );

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col font-sans transition-colors duration-1000 ${isTVMode ? 'bg-[#0F172A]' : 'bg-[#F8F9FB] text-slate-900'}`}>
      {/* Header */}
      <div className={`${isTVMode ? 'bg-slate-900/50 backdrop-blur-md border-b border-white/5 py-4 shadow-2xl' : 'bg-white border-b py-2 sm:py-3 shadow-sm'} px-6 sm:px-10 flex items-center justify-between shrink-0 transition-all duration-700`}>
        <div className="flex items-center gap-6">
           {!isTVMode && (
             <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
               <X className="w-5 h-5 text-slate-700" />
             </button>
           )}
           <div className="flex items-center gap-4">
             <div className={`${isTVMode ? 'bg-white p-2 rounded-xl' : ''}`}>
               <ArcusLogo className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-700" />
             </div>
             <div>
               <h1 className={`text-lg sm:text-2xl font-black font-oswald uppercase italic tracking-tighter leading-none ${isTVMode ? 'text-white' : 'text-slate-900'}`}>
                 {isTVMode ? 'ARCUS DIGITAL DISPLAY' : 'LIVE BOARD'}
               </h1>
               {isTVMode && (
                 <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   REALTIME UPDATING • {CATEGORY_LABELS[filterCategory]}
                 </p>
               )}
             </div>
           </div>
        </div>
        
        <div className="flex items-center gap-6">
          <SponsorMatras />
          
          <div className="flex items-center gap-3">
            {isTVMode && (
              <button 
                onClick={() => setIsTVMode(false)}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 bg-white text-slate-900 hover:bg-slate-100"
              >
                <Monitor className="w-4 h-4" />
                <span>Close TV Mode</span>
              </button>
            )}
            
            {isTVMode && (
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={`p-3 rounded-2xl transition-all active:scale-95 ${isPaused ? 'bg-arcus-red text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {!isTVMode && (
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
             <button onClick={() => setActiveTab('KUALIFIKASI')} className={`px-5 sm:px-8 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'KUALIFIKASI' ? 'bg-white shadow-md text-slate-900' : 'text-slate-700'}`}>Kualifikasi</button>
             <button onClick={() => setActiveTab('ELIMINASI')} className={`px-5 sm:px-8 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'ELIMINASI' ? 'bg-white shadow-md text-slate-900' : 'text-slate-700'}`}>Aduan</button>
          </div>
        )}
      </div>

      {!isTVMode && (
        <>
          {/* Sleek Category Bar */}
          <div className="bg-[#FBFBFD] border-b flex items-center gap-2 px-3 sm:px-6 py-1.5 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
              {allCategories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => {
                    setFilterCategory(cat);
                    setActiveSession('QUAL');
                  }} 
                  className={`px-3 py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase whitespace-nowrap border transition-all shrink-0 ${
                    filterCategory === cat 
                      ? 'bg-arcus-red border-arcus-red text-white shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Session & Quick Qualification Filter Bar */}
          {activeTab === 'KUALIFIKASI' && (
            <div className="bg-white border-b px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {availableSessions.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Babak:</span>
                    <div className="flex gap-1">
                      {availableSessions.map(sess => (
                        <button 
                          key={sess} 
                          onClick={() => setActiveSession(sess)} 
                          className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all ${
                            activeSession === sess 
                              ? 'bg-slate-900 border-slate-900 text-white' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {sess === 'QUAL' ? 'KUALIFIKASI' : (sess || '').replace('ELIM_', 'TOP ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact Search Bar & View Mode Switcher */}
          <div className="bg-[#FBFBFD] border-b px-3 sm:px-6 py-1.5 shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari nama, klub, bantalan..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-arcus-red transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {activeTab === 'KUALIFIKASI' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden xs:inline">
                  {displayedLeaderBoard.length} Pemanah
                </span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode('COMPACT')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                      viewMode === 'COMPACT' ? 'bg-white shadow-2xs text-slate-900 font-black' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Format Baris Kompak (Muat belasan peserta per layar, scroll sangat ringan)"
                  >
                    <span>Baris</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('CARDS')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                      viewMode === 'CARDS' ? 'bg-white shadow-2xs text-slate-900 font-black' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Format Kartu Atlet"
                  >
                    <LayoutList className="w-3 h-3 text-arcus-red" />
                    <span>Kartu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('TABLE')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                      viewMode === 'TABLE' ? 'bg-white shadow-2xs text-slate-900 font-black' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Format Tabel Lengkap"
                  >
                    <TableIcon className="w-3 h-3 text-blue-600" />
                    <span>Tabel</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-Bar: Navigasi Rentang Peringkat (Paging) & Filter Lolos untuk Kategori Besar */}
          {activeTab === 'KUALIFIKASI' && (
            <div className="bg-slate-100/90 border-b px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs">
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Tombol Cepat: Zona Lolos Eliminasi */}
                {eliminationSize > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowQualifiedOnly(prev => !prev);
                      setPageRange('ALL');
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider border transition-all ${
                      showQualifiedOnly
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                    }`}
                    title={`Saring hanya pemanah di zona aman lolos eliminasi (${eliminationSize} Besar)`}
                  >
                    <Trophy className="w-3 h-3 text-amber-300" />
                    <span>Zona Lolos ({eliminationSize} Besar)</span>
                  </button>
                )}

                {/* Range Pagination / Quick Jump (Jika pemanah > 25) */}
                {filteredLeaderBoard.length > 25 && !showQualifiedOnly && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">
                      Rentang:
                    </span>
                    {Array.from({ length: Math.ceil(filteredLeaderBoard.length / pageSize) }).map((_, pIdx) => {
                      const startRank = pIdx * pageSize + 1;
                      const endRank = Math.min((pIdx + 1) * pageSize, filteredLeaderBoard.length);
                      const isSelected = pageRange === pIdx;
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setPageRange(pIdx)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-oswald transition-all ${
                            isSelected
                              ? 'bg-slate-900 text-white shadow-2xs font-black'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {startRank}-{endRank}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setPageRange('ALL')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-oswald transition-all ${
                        pageRange === 'ALL'
                          ? 'bg-slate-900 text-white shadow-2xs font-black'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Semua
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[10px] font-bold text-slate-500 font-oswald uppercase tracking-wider shrink-0">
                {displayedLeaderBoard.length} Pemanah {showQualifiedOnly ? `(Top ${eliminationSize})` : ''}
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Content Area */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-auto custom-scrollbar ${isTVMode ? 'bg-[#0F172A] p-0' : 'bg-slate-50/50'}`}
      >
        <div className={`${isTVMode ? 'w-full' : 'w-full max-w-[1600px] mx-auto'}`}>
           <div className={isTVMode && hasVideoSponsors ? "grid grid-cols-1 lg:grid-cols-2 h-full" : ""}>
              {/* Score Side */}
              <div className={isTVMode && hasVideoSponsors ? "h-full border-r border-white/5 overflow-auto custom-scrollbar" : ""}>
                 {activeTab === 'KUALIFIKASI' ? (
              <div className={`${isTVMode ? 'bg-transparent' : ''} transition-all duration-700`}>
                 {/* 1. HIGH-DENSITY COMPACT ROW VIEW (Default for Mobile & Dense Leaderboards) */}
                 {!isTVMode && viewMode === 'COMPACT' && (
                   <div className="bg-white border-y sm:border sm:rounded-xl overflow-hidden shadow-2xs">
                     {/* Sticky Column Header */}
                     <div className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 px-2.5 sm:px-3 py-1.5 flex items-center text-[9px] font-black uppercase tracking-wider text-slate-500 select-none shadow-2xs">
                       <div className="w-7 sm:w-8 text-center shrink-0">Rank</div>
                       <div className="w-8 sm:w-10 text-center shrink-0">TGT</div>
                       <div className="flex-1 min-w-0 px-1 sm:px-2">Nama & Klub</div>
                       <div className="hidden xs:block w-14 text-right shrink-0">{labelSix}/{labelFive}</div>
                       <div className="w-12 sm:w-16 text-right shrink-0">Total</div>
                       <div className="w-4 sm:w-5 shrink-0" />
                     </div>

                     {/* Compact Rows */}
                     <div className="divide-y divide-slate-100">
                       {paginatedLeaderBoard.map((row, idx) => {
                         const actualRankIdx = (pageRange === 'ALL' || searchTerm.trim() !== '' ? 0 : (pageRange as number) * pageSize) + idx;
                         const isLastQualified = eliminationSize > 0 && (actualRankIdx + 1) === eliminationSize;
                         const isQualified = eliminationSize > 0 && (actualRankIdx + 1) <= eliminationSize;
                         const isExpanded = expandedRowId === row.id;

                         return (
                           <React.Fragment key={row.id}>
                             <div 
                               onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                               className={`cursor-pointer transition-colors ${
                                 isQualified ? 'hover:bg-emerald-50/50 bg-emerald-50/15' : 'hover:bg-slate-50'
                               } ${actualRankIdx % 2 === 1 && !isQualified ? 'bg-slate-50/30' : ''}`}
                             >
                               <div className="flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 gap-1.5 leading-none">
                                 {/* Rank Badge */}
                                 <div className="w-7 sm:w-8 flex items-center justify-center shrink-0">
                                   <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center font-black font-oswald text-[10px] sm:text-xs shadow-2xs ${
                                     actualRankIdx === 0 
                                       ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 font-black' 
                                       : actualRankIdx === 1 
                                         ? 'bg-gradient-to-br from-slate-200 to-zinc-400 text-slate-900 font-black' 
                                         : actualRankIdx === 2 
                                           ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white font-black' 
                                           : isQualified 
                                             ? 'bg-emerald-500 text-white' 
                                             : 'bg-slate-100 text-slate-700 font-bold'
                                   }`}>
                                     {row.displayRank || (actualRankIdx + 1)}{row.tieLabel || ''}
                                   </div>
                                 </div>

                                 {/* Target */}
                                 <div className="w-8 sm:w-10 text-center shrink-0">
                                   <span className="font-oswald font-black text-[11px] sm:text-xs text-blue-600">
                                     {row.targetNo > 0 ? `${row.targetNo}${row.position || ''}` : '-'}
                                   </span>
                                 </div>

                                 {/* Archer Name & Club - Single ultra-compact clean line */}
                                 <div className="flex-1 min-w-0 px-1 sm:px-2 flex items-center gap-1.5 truncate">
                                   <span className="text-[12px] sm:text-[13px] font-black font-oswald uppercase italic tracking-tight text-slate-900 truncate">
                                     {row.name}
                                   </span>
                                   {row.club && (
                                     <span className="text-[9.5px] sm:text-[10.5px] font-semibold text-slate-400 uppercase truncate">
                                       · {row.club}
                                     </span>
                                   )}
                                   {isQualified && (
                                     <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[7px] font-black uppercase tracking-wider shrink-0 leading-none">
                                       QUAL
                                     </span>
                                   )}
                                 </div>

                                 {/* Xs/6s & 5s */}
                                 <div className="hidden xs:block w-14 text-right font-oswald text-[10px] font-bold text-slate-400 shrink-0">
                                   <span>{row.sixes}</span> / <span>{row.fives}</span>
                                 </div>

                                 {/* Total Score */}
                                 <div className="w-12 sm:w-16 text-right shrink-0">
                                   <span className="text-sm sm:text-base font-black font-oswald text-slate-900 italic tracking-tight">
                                     {row.total}
                                   </span>
                                 </div>

                                 {/* Chevron Expand Indicator */}
                                 <div className="w-4 sm:w-5 text-center text-slate-400 shrink-0">
                                   {isExpanded ? (
                                     <ChevronDown className="w-3.5 h-3.5 text-slate-600 mx-auto" />
                                   ) : (
                                     <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                                   )}
                                 </div>
                               </div>

                               {/* Expandable Rambahan Detail Drawer */}
                               {isExpanded && (
                                 <div className="px-3 sm:px-4 py-2 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                                   <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                     <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 shrink-0">Rambahan:</span>
                                     {row.endScores && row.endScores.length > 0 ? (
                                       row.endScores.map((score, sIdx) => (
                                         <div 
                                           key={sIdx} 
                                           className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-oswald flex items-center gap-1 ${
                                             score !== null ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                                           }`}
                                         >
                                           <span className="opacity-50 text-[7px]">R{sIdx+1}:</span>
                                           <span>{score !== null ? score : '-'}</span>
                                         </div>
                                       ))
                                     ) : (
                                       <span className="text-[10px] text-slate-400 italic">Belum ada skor rambahan</span>
                                     )}
                                   </div>
                                   <div className="flex items-center gap-2 text-[10px] text-slate-600 font-oswald">
                                     <span>{labelSix}: <strong>{row.sixes}</strong></span>
                                     <span>{labelFive}: <strong>{row.fives}</strong></span>
                                   </div>
                                 </div>
                               )}
                             </div>

                             {/* Cutoff Line */}
                             {isLastQualified && !showQualifiedOnly && (
                               <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white py-1 px-4 text-center flex items-center justify-center gap-1.5 shadow-2xs">
                                 <Trophy className="w-3 h-3 text-amber-300 shrink-0" />
                                 <span className="text-[9px] font-black uppercase tracking-[0.2em] font-oswald italic">
                                   {currentCutoffInfo.fullLabel}
                                 </span>
                               </div>
                             )}
                           </React.Fragment>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* 2. Cards View (When viewMode === 'CARDS') */}
                 {!isTVMode && viewMode === 'CARDS' && (
                   <div className="p-3 space-y-2">
                     {displayedLeaderBoard.map((row, idx) => {
                       const isLastQualified = eliminationSize > 0 && (idx + 1) === eliminationSize;
                       const isQualified = eliminationSize > 0 && (idx + 1) <= eliminationSize;
                       const isExpanded = expandedRowId === row.id;

                       return (
                         <React.Fragment key={row.id}>
                           <div 
                             onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                             className={`bg-white rounded-xl p-2.5 sm:p-3 border transition-all shadow-2xs hover:shadow-xs cursor-pointer relative overflow-hidden ${
                               isQualified 
                                 ? 'border-emerald-300/80 bg-gradient-to-r from-white via-white to-emerald-50/20' 
                                 : 'border-slate-200/90'
                             }`}
                           >
                             <div className="flex items-center gap-2.5">
                               {/* Rank */}
                               <div className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center font-black font-oswald shrink-0 shadow-2xs ${
                                 idx === 0 
                                   ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 font-black' 
                                   : idx === 1 
                                     ? 'bg-gradient-to-br from-slate-200 to-zinc-400 text-slate-900 font-black' 
                                     : idx === 2 
                                       ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white font-black' 
                                       : isQualified 
                                         ? 'bg-emerald-500 text-white' 
                                         : 'bg-slate-100 text-slate-700 font-bold'
                               }`}>
                                 <span className="text-xs font-black leading-none">{row.displayRank || (idx + 1)}{row.tieLabel || ''}</span>
                               </div>

                               {/* Name & Info */}
                               <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-1.5 truncate">
                                   <span className="text-xs sm:text-sm font-black font-oswald uppercase italic tracking-tight text-slate-900 truncate">
                                     {row.name}
                                   </span>
                                   {isQualified && (
                                     <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[7.5px] font-black uppercase tracking-wider shrink-0 leading-none">
                                       QUAL
                                     </span>
                                   )}
                                 </div>
                                 <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 font-medium truncate">
                                   {row.targetNo > 0 && (
                                     <span className="px-1 py-0.2 bg-blue-50 text-blue-700 font-bold font-oswald rounded text-[9px] uppercase shrink-0">
                                       🎯 {row.targetNo}{row.position || ''}
                                     </span>
                                   )}
                                   <span className="truncate">{row.club || '-'}</span>
                                 </div>
                               </div>

                               {/* Total Score */}
                               <div className="text-right shrink-0">
                                 <div className="text-lg sm:text-xl font-black font-oswald text-slate-900 italic tracking-tight leading-none">
                                   {row.total}
                                 </div>
                                 <div className="text-[9px] font-bold text-slate-400 font-oswald mt-0.5">
                                   {row.sixes} / {row.fives}
                                 </div>
                               </div>

                               {/* Chevron */}
                               <div className="text-slate-400 pl-1">
                                 {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                               </div>
                             </div>

                             {/* Rambahan if opened */}
                             {isExpanded && row.endScores && (
                               <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar">
                                 <span className="text-[8px] font-black uppercase text-slate-400 shrink-0">Rambahan:</span>
                                 {row.endScores.map((score, sIdx) => (
                                   <div key={sIdx} className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold font-oswald flex items-center gap-0.5">
                                     <span className="opacity-50 text-[7px]">R{sIdx+1}:</span>
                                     <span>{score !== null ? score : '-'}</span>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>

                           {isLastQualified && !showQualifiedOnly && (
                             <div className="py-1">
                               <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-2xs text-center">
                                 <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                 <span className="text-[9px] font-black uppercase tracking-[0.2em] italic font-oswald">
                                   {currentCutoffInfo.fullLabel}
                                 </span>
                               </div>
                             </div>
                           )}
                         </React.Fragment>
                       );
                     })}
                   </div>
                 )}

                 {/* 2. Desktop & Full Table View */}
                 <div className={`${isTVMode ? 'block bg-transparent' : viewMode === 'CARDS' ? 'hidden' : viewMode === 'TABLE' ? 'block bg-white' : 'hidden sm:block bg-white'} overflow-x-auto custom-scrollbar transition-all duration-700`}>
                   <table className={`w-full text-left border-collapse ${isTVMode ? '' : 'min-w-[700px]'}`}>
                     <thead>
                       <tr className={`${isTVMode ? 'bg-slate-800/30 text-white/80' : 'bg-slate-50 text-slate-700'} text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] border-b border-slate-200/80`}>
                         <th className={`py-3 sm:py-5 text-center ${isTVMode ? 'px-16 w-48' : 'px-3 sm:px-6 w-16 sm:w-24'}`}>Rank</th>
                         <th className={`py-3 sm:py-5 text-center ${isTVMode ? 'px-6 w-48' : 'px-2 sm:px-6 w-16 sm:w-24'}`}>TGT</th>
                         <th className={`px-4 sm:px-6 py-3 sm:py-5 ${isTVMode ? 'w-auto' : 'min-w-[220px]'}`}>Nama & Klub Pemanah</th>
                         {!isTVMode && <th className="px-3 sm:px-6 py-3 sm:py-5">Scores Per Rambahan</th>}
                         <th className="px-2 sm:px-4 py-3 sm:py-5 text-center w-12 sm:w-16">{labelSix}</th>
                         <th className="px-2 sm:px-4 py-3 sm:py-5 text-center w-12 sm:w-16">{labelFive}</th>
                         <th className={`py-3 sm:py-5 text-right ${isTVMode ? 'px-16' : 'px-4 sm:px-8'} w-24 sm:w-36`}>Total</th>
                       </tr>
                     </thead>
                     <tbody className={`divide-y ${isTVMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                       {filteredLeaderBoard.map((row, idx) => {
                         const isLastQualified = eliminationSize > 0 && (idx + 1) === eliminationSize;
                         const isQualified = eliminationSize > 0 && (idx + 1) <= eliminationSize;
                         
                         return (
                            <React.Fragment key={row.id}>
                              <tr className={`group transition-all duration-300 ${isTVMode ? 'hover:bg-white/5' : 'hover:bg-slate-50/80'} ${isQualified && !isTVMode ? 'bg-emerald-50/20' : ''}`}>
                                {/* Rank */}
                                <td className={`${isTVMode ? 'py-12 px-16' : 'py-3 sm:py-5 px-3 sm:px-6'}`}>
                                   <div className={`mx-auto rounded-xl sm:rounded-2xl flex items-center justify-center font-black font-oswald shadow-sm sm:shadow-md transition-all ${isTVMode ? 'w-24 h-24 text-6xl shadow-sun-500/20' : 'w-8 h-8 sm:w-11 sm:h-11 text-xs sm:text-xl'} ${
                                     idx === 0 
                                       ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 ring-2 ring-amber-300/50' 
                                       : idx === 1 
                                         ? 'bg-gradient-to-br from-slate-200 to-zinc-400 text-slate-900 ring-2 ring-slate-300/50' 
                                         : idx === 2 
                                           ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white ring-2 ring-orange-400/50' 
                                           : isTVMode 
                                             ? 'bg-white/10 text-white/90' 
                                             : isQualified 
                                               ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                                               : 'bg-slate-100 text-slate-700'
                                   }`}>
                                     {row.displayRank || (idx + 1)}{row.tieLabel || ''}
                                   </div>
                                </td>

                                {/* Target */}
                                <td className={`${isTVMode ? 'py-12 px-6' : 'py-3 sm:py-5 px-2 sm:px-6'}`}>
                                   <div className="text-center">
                                     <span className={`font-black font-oswald italic tracking-tighter ${isTVMode ? 'text-7xl text-arcus-sun' : 'text-sm sm:text-2xl text-blue-600'}`}>
                                       {row.targetNo > 0 ? `${row.targetNo}${row.position}` : '-'}
                                     </span>
                                   </div>
                                </td>

                                {/* Archer Info (Enlarged Participant Name) */}
                                <td className={`${isTVMode ? 'py-12 px-6' : 'py-3 sm:py-5 px-4 sm:px-6'}`}>
                                   <div className="flex flex-col min-w-0">
                                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                                        <p className={`font-black font-oswald italic uppercase leading-tight tracking-tight transition-colors break-words ${isTVMode ? 'text-8xl text-white' : 'text-sm sm:text-base lg:text-lg text-slate-900 group-hover:text-arcus-red'}`}>
                                          {row.name}
                                        </p>
                                        {isQualified && (
                                          <span className={`bg-emerald-500 font-black text-white rounded-md uppercase tracking-wider leading-none shadow-sm ${isTVMode ? 'px-6 py-3 text-base' : 'px-2 py-0.5 text-[8px] sm:text-[10px]'}`}>QUAL</span>
                                        )}
                                      </div>
                                      <p className={`font-bold uppercase tracking-wider truncate ${isTVMode ? 'text-2xl text-white/70 mt-3' : 'text-xs sm:text-sm text-slate-600 mt-0.5 sm:mt-1'}`}>
                                        {row.club || '-'}
                                      </p>
                                   </div>
                                </td>

                                {/* Scores Per Rambahan */}
                                {!isTVMode && (
                                  <td className="py-3 sm:py-5 px-2 sm:px-6">
                                     <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                        {(row.endScores || []).map((score, sIdx) => (
                                          <div 
                                            key={sIdx} 
                                            className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex flex-col items-center justify-center border transition-all ${score !== null ? 'bg-slate-900 border-slate-900 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                          >
                                            <span className="text-[6px] sm:text-[7px] font-bold opacity-60 uppercase">R{sIdx + 1}</span>
                                            <span className="text-[10px] sm:text-xs font-black font-oswald">{score !== null ? score : '-'}</span>
                                          </div>
                                        ))}
                                     </div>
                                  </td>
                                )}

                                {/* Sixes / Xs */}
                                <td className={`text-center ${isTVMode ? 'py-12 px-4' : 'py-3 sm:py-5 px-2 sm:px-4'}`}>
                                   <span className={`font-black font-oswald ${isTVMode ? 'text-5xl text-white/60' : 'text-sm sm:text-xl text-slate-700'}`}>{row.sixes}</span>
                                </td>

                                {/* Fives */}
                                <td className={`text-center ${isTVMode ? 'py-12 px-4' : 'py-3 sm:py-5 px-2 sm:px-4'}`}>
                                   <span className={`font-black font-oswald ${isTVMode ? 'text-5xl text-white/60' : 'text-sm sm:text-xl text-slate-700'}`}>{row.fives}</span>
                                </td>

                                {/* Total */}
                                <td className={`text-right ${isTVMode ? 'py-12 px-16' : 'py-3 sm:py-5 px-4 sm:px-8'}`}>
                                   <span className={`font-black font-oswald tabular-nums tracking-tighter italic ${isTVMode ? 'text-[10rem] text-white animate-pulse' : 'text-2xl sm:text-4xl lg:text-5xl text-slate-900'}`}>{row.total}</span>
                                </td>
                             </tr>

                             {/* Cutoff Row */}
                             {isLastQualified && (
                               <tr>
                                 <td colSpan={isTVMode ? 6 : 7} className="px-0 py-0">
                                   <div className={`${isTVMode ? 'bg-emerald-500/10' : 'bg-emerald-500'} py-3 sm:py-4 flex items-center justify-center gap-4 sm:gap-6`}>
                                      <div className={`h-px flex-1 ml-6 sm:ml-16 ${isTVMode ? 'bg-emerald-500/20' : 'bg-white/30'}`} />
                                      <div className="flex items-center gap-3">
                                         <Trophy className={`w-4 h-4 sm:w-5 sm:h-5 ${isTVMode ? 'text-emerald-500' : 'text-white'}`} />
                                         <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] italic ${isTVMode ? 'text-emerald-500' : 'text-white'}`}>{currentCutoffInfo.fullLabel}</span>
                                      </div>
                                      <div className={`h-px flex-1 mr-6 sm:mr-16 ${isTVMode ? 'bg-emerald-500/20' : 'bg-white/30'}`} />
                                   </div>
                                 </td>
                               </tr>
                             )}
                           </React.Fragment>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
                 
                 {filteredLeaderBoard.length === 0 && (
                    <div className="py-24 sm:py-40 text-center">
                       <div className="w-16 h-16 sm:w-24 sm:h-24 bg-white/5 rounded-3xl sm:rounded-[3rem] flex items-center justify-center mx-auto mb-6 border border-slate-200">
                         <Monitor className="w-8 h-8 sm:w-12 sm:h-12 text-slate-400" />
                       </div>
                       <p className={`text-lg sm:text-2xl font-black uppercase font-oswald italic tracking-[0.3em] ${isTVMode ? 'text-white/20' : 'text-slate-400'}`}>
                         {searchTerm ? 'Pemanah Tidak Ditemukan' : 'Menunggu Data Skor'}
                       </p>
                    </div>
                 )}
              </div>
            ) : (
              <div className="space-y-6">
                {!isTVMode && matches.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4 mb-4">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-black font-oswald uppercase italic text-slate-900 tracking-tight">Format Bagan Aduan</h3>
                      <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none mt-1">Gunakan geser horizontal untuk menjelajahi babak eliminasi</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-center">
                      <button 
                        type="button"
                        onClick={() => setElimDisplayMode('BRACKET')} 
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${elimDisplayMode === 'BRACKET' ? 'bg-white shadow-md text-slate-900' : 'text-slate-700 hover:text-slate-600'}`}
                      >
                        <Swords className="w-3.5 h-3.5 text-arcus-red" />
                        Visual Bagan (Bracket)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setElimDisplayMode('CARDS')} 
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${elimDisplayMode === 'CARDS' ? 'bg-white shadow-md text-slate-900' : 'text-slate-700 hover:text-slate-600'}`}
                      >
                        <LayoutList className="w-3.5 h-3.5 text-blue-500" />
                        Daftar Match (Grid)
                      </button>
                    </div>
                  </div>
                )}

                {matches.length === 0 ? (
                  <div className="col-span-full py-20 sm:py-40 rounded-[2rem] sm:rounded-[4rem] border-4 border-dashed border-slate-100 text-center flex flex-col items-center justify-center space-y-6">
                     <Swords className="w-12 h-12 sm:w-20 sm:h-20 text-slate-100" />
                     <p className="text-xl sm:text-2xl font-black uppercase text-slate-600 tracking-[0.3em] font-oswald italic">Bagan aduan belum tersedia</p>
                  </div>
                ) : (elimDisplayMode === 'BRACKET' && !isTVMode) ? (
                  <div className="flex gap-12 overflow-x-auto pb-12 pt-4 px-2 no-scrollbar scroll-smooth">
                    {roundsData.map((round, rIndex) => (
                      <div key={round.round} className="flex flex-col gap-8 min-w-[325px]">
                        <div className="text-center">
                          <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] italic border shadow-md inline-block ${round.round === 1 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-950 border-purple-500 text-white'}`}>
                            {round.label}
                          </span>
                        </div>

                        <div className="flex flex-col h-full justify-around gap-8 min-h-[450px]">
                          {round.matches.map((match) => {
                            const archerA = archersList.find(a => a.id === match.archerAId);
                            const archerB = archersList.find(a => a.id === match.archerBId);
                            const isTied = match.archerAId && match.archerBId && match.scoreA === match.scoreB && (match.scoreA > 0 || match.scoreB > 0);
                            const hasShootOffRecord = match.isShootOff || match.shootOffA !== undefined || match.shootOffB !== undefined;

                            return (
                              <div key={match.id} className="relative group">
                                <div className={`bg-white rounded-[2rem] border-2 overflow-hidden shadow-sm hover:shadow-xl transition-all ${
                                  isTied && !match.winnerId 
                                    ? 'border-amber-500 ring-4 ring-amber-400/40 shadow-amber-500/20 animate-pulse' 
                                    : match.winnerId 
                                      ? 'border-purple-200 ring-4 ring-purple-50' 
                                      : 'border-slate-100'
                                }`}>
                                  {/* Match ID Header */}
                                  <div className={`px-5 py-2.5 border-b flex justify-between items-center text-[9px] font-black uppercase tracking-widest ${
                                    isTied && !match.winnerId
                                      ? 'bg-amber-500 text-slate-950 font-black'
                                      : hasShootOffRecord
                                        ? 'bg-purple-900 text-white'
                                        : 'bg-slate-50 text-slate-700 border-slate-100'
                                  }`}>
                                    <div className="flex items-center gap-1.5">
                                      <span>Match #{match.matchNo}</span>
                                      {hasShootOffRecord && (
                                        <span className="px-1.5 py-0.5 bg-yellow-400 text-slate-950 rounded text-[7px] font-black uppercase">
                                          SHOOT-OFF
                                        </span>
                                      )}
                                    </div>
                                    {isTied && !match.winnerId ? (
                                      <span className="flex items-center gap-1 text-slate-950 font-black animate-bounce">
                                        <AlertTriangle className="w-3 h-3 text-red-600 fill-current" /> SHOOT-OFF!
                                      </span>
                                    ) : match.winnerId ? (
                                      <span className="text-emerald-400 flex items-center gap-1">
                                        <Medal className="w-3 h-3" /> SELESAI
                                      </span>
                                    ) : (
                                      <span>ROUND {match.round}</span>
                                    )}
                                  </div>

                                  {/* Display Before & After Shoot-Off in Bracket */}
                                  {hasShootOffRecord && (
                                    <div className="bg-amber-50/80 px-4 py-2 border-b border-amber-200/80 flex items-center justify-between text-[8px] font-black uppercase">
                                      <div className="text-slate-600">
                                        <span className="opacity-60">Regulasi: </span>
                                        <span className="font-bold text-slate-900">{match.scoreA} - {match.scoreB}</span>
                                      </div>
                                      <div className="text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded font-black">
                                        S.O: {match.shootOffA ?? '-'}{match.shootOffClosestA ? ' (X)' : ''} vs {match.shootOffB ?? '-'}{match.shootOffClosestB ? ' (X)' : ''}
                                      </div>
                                    </div>
                                  )}

                                  {/* Slot A */}
                                  <div className={`p-5 flex items-center justify-between gap-3 border-b ${match.winnerId === match.archerAId ? 'bg-purple-50/30' : ''}`}>
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${match.winnerId === match.archerAId ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-700'}`}>
                                        {match.winnerId === match.archerAId ? <Check className="w-4 h-4" /> : 'A'}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`font-black uppercase font-oswald text-xs sm:text-sm italic block truncate leading-tight ${match.winnerId === match.archerAId ? 'text-purple-700' : 'text-slate-900'}`}>
                                            {archerA?.name || 'BYE'}
                                          </span>
                                          {match.shootOffA !== undefined && (
                                            <span className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded text-[7px] font-black shrink-0">
                                              SO: {match.shootOffA}{match.shootOffClosestA ? '★' : ''}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[9px] sm:text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-1 block truncate">
                                          {archerA?.club || '-'} {archerA?.targetNo ? `(Bantalan ${archerA.targetNo}${archerA.position || ''})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black font-oswald border shadow-inner ${
                                      isTied && !match.winnerId 
                                        ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                        : match.scoreA > match.scoreB 
                                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                          : 'bg-white border-slate-100 text-slate-900'
                                    }`}>
                                      {match.scoreA}
                                    </div>
                                  </div>

                                  {/* Slot B */}
                                  <div className={`p-5 flex items-center justify-between gap-3 ${match.winnerId === match.archerBId ? 'bg-purple-50/30' : ''}`}>
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${match.winnerId === match.archerBId ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-700'}`}>
                                        {match.winnerId === match.archerBId ? <Check className="w-4 h-4" /> : 'B'}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`font-black uppercase font-oswald text-xs sm:text-sm italic block truncate leading-tight ${match.winnerId === match.archerBId ? 'text-purple-700' : 'text-slate-900'}`}>
                                            {archerB?.name || 'BYE'}
                                          </span>
                                          {match.shootOffB !== undefined && (
                                            <span className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded text-[7px] font-black shrink-0">
                                              SO: {match.shootOffB}{match.shootOffClosestB ? '★' : ''}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[9px] sm:text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-1 block truncate">
                                          {archerB?.club || '-'} {archerB?.targetNo ? `(Bantalan ${archerB.targetNo}${archerB.position || ''})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black font-oswald border shadow-inner ${
                                      isTied && !match.winnerId 
                                        ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                        : match.scoreB > match.scoreA 
                                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                          : 'bg-white border-slate-100 text-slate-900'
                                    }`}>
                                      {match.scoreB}
                                    </div>
                                  </div>
                                </div>

                                {/* Connector Line Visualization */}
                                {rIndex < roundsData.length - 1 && round.round !== 1 && (
                                  <div className="absolute top-1/2 -right-12 w-12 h-[2px] bg-slate-200 pointer-events-none"></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                 ) : (
                  <div className={`${isTVMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} grid gap-4 sm:gap-10`}>
                    {matches.map((match) => {
                    const archerA = archersList.find(a => a.id === match.archerAId);
                    const archerB = archersList.find(a => a.id === match.archerBId);
                    
                    const isTied = match.archerAId && match.archerBId && match.scoreA === match.scoreB && (match.scoreA > 0 || match.scoreB > 0);
                    const hasShootOffRecord = match.isShootOff || match.shootOffA !== undefined || match.shootOffB !== undefined;
                    
                    return (
                      <div key={match.id} className={`${isTVMode ? 'bg-transparent border-white/5' : 'bg-white border-slate-100 border-2 rounded-2xl sm:rounded-[2.5rem]'} flex flex-col overflow-hidden transition-all duration-700 ${
                        isTied && !match.winnerId ? 'ring-4 ring-amber-400 border-amber-500 shadow-xl shadow-amber-500/20 animate-pulse' : ''
                      }`}>
                         <div className={`${
                           isTied && !match.winnerId 
                             ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black' 
                             : isTVMode 
                               ? 'bg-white/5' 
                               : 'bg-slate-900/80'
                         } backdrop-blur-md px-6 sm:px-10 py-3 sm:py-5 flex justify-between items-center`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <span className={`rounded-full ${isTied && !match.winnerId ? 'bg-white w-3 h-3 animate-ping' : 'bg-arcus-red'} ${isTVMode ? 'w-3 h-3' : 'w-2 h-2'}`} />
                                <span className={`font-black uppercase tracking-[0.3em] ${
                                  isTied && !match.winnerId ? 'text-slate-950 text-xs sm:text-base font-black' : isTVMode ? 'text-white/60 text-lg' : 'text-white/90 text-[8px] sm:text-xs'
                                }`}>
                                  Match #{match.matchNo}
                                </span>
                                {hasShootOffRecord && (
                                  <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-950 rounded-md text-[9px] font-black uppercase tracking-wider">
                                    SHOOT-OFF
                                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                               {isTied && !match.winnerId && (
                                 <span className="px-3 py-1 bg-white text-orange-700 rounded-full font-black text-[9px] uppercase animate-pulse">
                                   ⚠️ SKOR SERI
                                 </span>
                               )}
                               <span className={`font-black uppercase tracking-[0.3em] font-oswald italic ${
                                 isTied && !match.winnerId ? 'text-slate-950 font-black' : 'text-arcus-sun'
                               } ${isTVMode ? 'text-3xl' : 'text-[8px] sm:text-xs'}`}>TOP {match.round}</span>
                            </div>
                         </div>

                         {/* Real-time Shoot-Off Detail Bar (Before vs After) */}
                         {hasShootOffRecord && (
                            <div className={`px-6 sm:px-10 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 border-b ${
                              isTVMode ? 'bg-amber-500/20 border-amber-500/30 text-white' : 'bg-amber-50 border-amber-200 text-amber-950'
                            }`}>
                               <div className="flex items-center gap-2">
                                  <AlertTriangle className={`w-4 h-4 ${isTVMode ? 'text-yellow-400' : 'text-amber-600'}`} />
                                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">
                                     Skor Regulasi (Sebelum): <span className="font-oswald text-sm sm:text-base text-purple-700">{match.scoreA} - {match.scoreB}</span>
                                  </span>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] sm:text-xs font-bold uppercase">1 Panah Shoot-Off:</span>
                                  <span className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg text-xs sm:text-sm font-black font-oswald">
                                     {archerA?.name?.split(' ')[0]}: {match.shootOffA ?? '-'}{match.shootOffClosestA ? ' (★)' : ''} &nbsp;|&nbsp; {archerB?.name?.split(' ')[0]}: {match.shootOffB ?? '-'}{match.shootOffClosestB ? ' (★)' : ''}
                                  </span>
                               </div>
                            </div>
                         )}
                         
                         <div className={`${isTVMode ? 'p-0 py-10 space-y-4' : 'p-4 sm:p-10 space-y-3 sm:space-y-8'}`}>
                            {/* Archer A */}
                            <div className={`flex items-center justify-between transition-all duration-500 ${isTVMode ? 'p-8 bg-white/5 border-white/5' : 'p-3 sm:p-8 rounded-xl sm:rounded-3xl border-l-4 sm:border-l-8 shadow-sm sm:shadow-xl'} ${match.winnerId === match.archerAId ? 'bg-emerald-500/20 border-emerald-500' : !isTVMode ? 'bg-slate-50 border-slate-200' : ''}`}>
                               <div className="flex items-center gap-4 sm:gap-10">
                                  <div className={`${isTVMode ? 'w-24 h-24 text-4xl' : 'w-9 h-9 sm:w-16 sm:h-16 text-sm sm:text-2xl'} bg-slate-900 rounded-lg sm:rounded-2xl flex items-center justify-center text-white font-black font-oswald italic shadow-2xl shrink-0`}>
                                     {archerA?.targetNo || '-'}{archerA?.position || ''}
                                  </div>
                                  <div>
                                     <div className="flex items-center gap-2">
                                       <p className={`font-black font-oswald uppercase italic leading-tight tracking-tight ${isTVMode ? 'text-7xl text-white' : 'text-base sm:text-xl md:text-2xl text-slate-900'}`}>{archerA?.name || 'BYE'}</p>
                                       {match.shootOffA !== undefined && (
                                         <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] sm:text-xs font-black rounded uppercase">
                                           SO: {match.shootOffA}{match.shootOffClosestA ? ' (X)' : ''}
                                         </span>
                                       )}
                                     </div>
                                     <p className={`font-bold uppercase tracking-wider ${isTVMode ? 'text-xl text-white/70 mt-4' : 'text-xs sm:text-sm text-slate-600 mt-1 sm:mt-2'}`}>{archerA?.club || '-'}</p>
                                  </div>
                                </div>
                                <div className={`font-black font-oswald italic tracking-tighter tabular-nums ${isTVMode ? 'text-[10rem]' : 'text-3xl sm:text-6xl'} ${match.winnerId === match.archerAId ? 'text-emerald-500' : 'text-white/80'}`}>
                                   {match.scoreA}
                                </div>
                            </div>

                            <div className={`flex justify-center relative z-10 ${isTVMode ? '-my-10' : '-my-6'}`}>
                               <div className={`${isTVMode ? 'w-24 h-24 text-3xl' : 'w-8 h-8 sm:w-14 sm:h-14 text-xs sm:text-xl'} bg-arcus-red rounded-full flex items-center justify-center text-white font-black italic shadow-lg border-2 sm:border-4 border-white`}>VS</div>
                            </div>

                            {/* Archer B */}
                            <div className={`flex items-center justify-between transition-all duration-500 ${isTVMode ? 'p-8 bg-white/5 border-white/5' : 'p-3 sm:p-8 rounded-xl sm:rounded-3xl border-l-4 sm:border-l-8 shadow-sm sm:shadow-xl'} ${match.winnerId === match.archerBId ? 'bg-emerald-500/20 border-emerald-500' : !isTVMode ? 'bg-slate-50 border-slate-200' : ''}`}>
                               <div className="flex items-center gap-4 sm:gap-10">
                                  <div className={`${isTVMode ? 'w-24 h-24 text-4xl' : 'w-9 h-9 sm:w-16 sm:h-16 text-sm sm:text-2xl'} bg-slate-900 rounded-lg sm:rounded-2xl flex items-center justify-center text-white font-black font-oswald italic shadow-2xl shrink-0`}>
                                     {archerB?.targetNo || '-'}{archerB?.position || ''}
                                  </div>
                                  <div>
                                     <p className={`font-black font-oswald uppercase italic leading-tight tracking-tight ${isTVMode ? 'text-7xl text-white' : 'text-base sm:text-xl md:text-2xl text-slate-900'}`}>{archerB?.name || 'BYE'}</p>
                                     <p className={`font-bold uppercase tracking-wider ${isTVMode ? 'text-xl text-white/70 mt-4' : 'text-xs sm:text-sm text-slate-600 mt-1 sm:mt-2'}`}>{archerB?.club || '-'}</p>
                                  </div>
                               </div>
                               <div className={`font-black font-oswald italic tracking-tighter tabular-nums ${isTVMode ? 'text-[10rem]' : 'text-3xl sm:text-6xl'} ${match.winnerId === match.archerBId ? 'text-emerald-500' : 'text-white/80'}`}>
                                  {match.scoreB}
                               </div>
                            </div>
                         </div>
                         
                         {match.winnerId && (
                           <motion.div 
                             initial={{ opacity: 0, y: 20 }}
                             animate={{ opacity: 1, y: 0 }}
                             className={`bg-emerald-500/20 text-center border-t border-emerald-500/20 ${isTVMode ? 'py-8' : 'py-4'}`}
                           >
                              <p className={`font-black text-emerald-500 uppercase tracking-[0.4em] italic flex items-center justify-center gap-6 ${isTVMode ? 'text-2xl' : 'text-xs'}`}>
                                <Medal className={isTVMode ? 'w-8 h-8' : 'w-4 h-4'} />
                                WINNER: {archersList.find(a => a.id === match.winnerId)?.name}
                              </p>
                           </motion.div>
                         )}
                      </div>
                    );
                  })}
                </div>
               )}
            </div>
           )}
        </div>
        
        {/* Video Side - Only TV Mode with Video Sponsors */}
        {isTVMode && hasVideoSponsors && (
          <div className="h-full p-10 flex flex-col">
             <div className="flex-1">
                <TVVideoSponsor sponsorships={settings.sponsorships} />
             </div>
          </div>
        )}
      </div>
    </div>
  </div>
      
      {/* Footer Info */}
      <div className={`shrink-0 flex items-center justify-between gap-4 transition-all duration-700 ${isTVMode ? 'bg-slate-950/80 backdrop-blur-xl border-t border-white/5 p-6 sm:p-8' : 'bg-white border-t p-3 sm:p-4 px-4 sm:px-10'}`}>
          {!isTVMode ? (
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-black text-[9.5px] uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Scoreboard</span>
              </div>
              <span className="text-xs font-black uppercase text-slate-800 font-oswald italic truncate max-w-xs">
                {settings.tournamentName || 'Arcus Archery System'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-6 sm:gap-12">
                <div className="hidden sm:flex items-center gap-4">
                    <Activity className="w-6 h-6 text-emerald-500 animate-pulse" />
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] leading-none ${isTVMode ? 'text-white/80' : 'text-slate-700'}`}>System Status</p>
                      <p className={`text-[10px] font-black uppercase tracking-[0.1em] mt-1.5 ${isTVMode ? 'text-white' : 'text-slate-900'}`}>Live Data Feed Optimized</p>
                    </div>
                </div>
                <div className={`flex items-center gap-5 sm:border-l sm:pl-12 ${isTVMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <Clock className="w-6 h-6 text-arcus-sun" />
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] leading-none ${isTVMode ? 'text-white/80' : 'text-slate-700'}`}>Local Time</p>
                      <p className={`text-xl font-black font-oswald uppercase tracking-wider mt-1 tabular-nums ${isTVMode ? 'text-white' : 'text-slate-900'}`}>
                          {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                </div>
            </div>
          )}
          <div className="flex items-center gap-6 w-full sm:w-auto justify-center sm:justify-end min-w-0">
              <FooterSponsorshipSlider tournamentName={settings.tournamentName || 'Turnamen Panahan'} sponsorships={settings.sponsorships} isTVMode={isTVMode} />
          </div>
      </div>

      {/* Floating Scroll-to-Top Button */}
      {showScrollTop && !isTVMode && (
        <button
          type="button"
          onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-16 right-4 sm:bottom-20 sm:right-8 z-50 px-3 py-2 bg-slate-900/90 hover:bg-slate-900 text-white rounded-full shadow-xl backdrop-blur-xs transition-all flex items-center gap-1.5 text-xs font-bold border border-white/20 active:scale-95 animate-fade-in"
          title="Kembali ke Peringkat 1 (Paling Atas)"
        >
          <ArrowUp className="w-3.5 h-3.5 text-arcus-sun" />
          <span className="text-[10px] font-black font-oswald uppercase tracking-wider pr-0.5">Ke Atas</span>
        </button>
      )}
    </div>
  );
};

export default LiveScoreboard;
