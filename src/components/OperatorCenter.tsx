import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, Database, ArrowLeft, ShieldAlert, Edit3, 
  User, FileText, CheckCircle2, History, AlertCircle, 
  ChevronRight, Hash, Trash2, Download, Printer, FileDown,
  Delete, X as CloseIcon, Save, Plus, Minus, ScanLine,
  Clock, RotateCcw, Award, Check, Target, Info, Sparkles,
  ArrowRight, Undo2, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { ArcheryEvent, ScoreEntry, ScoreLog, Archer, CategoryType, TargetType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import QRScanner from './QRScanner';

interface Props {
  event: ArcheryEvent;
  onSaveScore: (score: ScoreEntry | ScoreEntry[], log?: ScoreLog | ScoreLog[]) => void;
  onBack: () => void;
}

type ArrowVal = number | 'X' | 'M' | -1;

const OperatorCenter: React.FC<Props> = ({ event, onSaveScore, onBack }) => {
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem('op_name_draft') || '');
  const [editReason, setEditReason] = useState(() => localStorage.getItem('op_reason_draft') || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'ALL'>('ALL');
  const [selectedArcherId, setSelectedArcherId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'ARROW' | 'RAMBAHAN'>('ARROW');
  const [showScanner, setShowScanner] = useState(false);
  
  // States for Rambahan & Arrow Selection
  const [targetEnd, setTargetEnd] = useState(0);
  const [activeSession, setActiveSession] = useState<string>('QUAL');

  // States for Rambahan Input Mode
  const [rambahanScore, setRambahanScore] = useState(0);
  const [rambahan6s, setRambahan6s] = useState(0);
  const [rambahan5s, setRambahan5s] = useState(0);

  // States for Per-Arrow Mode
  const [activeArrowIndex, setActiveArrowIndex] = useState<number | null>(0);
  const [tempArrows, setTempArrows] = useState<ArrowVal[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Persist operator name and reason
  useEffect(() => {
    localStorage.setItem('op_name_draft', operatorName);
  }, [operatorName]);

  useEffect(() => {
    localStorage.setItem('op_reason_draft', editReason);
  }, [editReason]);

  const availableCategories = useMemo(() => {
    return Array.from(new Set(event.archers.map(a => a.category)));
  }, [event.archers]);

  const filteredArchers = useMemo(() => {
    return event.archers.filter(a => 
      ((a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
       (a.club || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
       `${a.targetNo || ''}${a.position || ''}`.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (selectedCategory === 'ALL' || a.category === selectedCategory)
    );
  }, [event.archers, searchTerm, selectedCategory]);

  const selectedArcher = useMemo(() => {
    return event.archers.find(a => a.id === selectedArcherId) || null;
  }, [event.archers, selectedArcherId]);

  const config = useMemo(() => {
    if (!selectedArcher) return null;
    return (event.settings.categoryConfigs || {})[selectedArcher.category as CategoryType] || null;
  }, [event.settings.categoryConfigs, selectedArcher]);

  const totalEnds = config?.ends || (Number(event.settings?.totalEnds) > 0 ? Number(event.settings.totalEnds) : 6);
  const arrowsCount = config?.arrows || (Number(event.settings?.arrowsPerEnd) > 0 ? Number(event.settings.arrowsPerEnd) : 6);

  const availableSessions = useMemo(() => {
    if (!selectedArcher || !config) return ['QUAL'];
    const sessions = ['QUAL'];
    if (config.eliminationStages && config.eliminationStages.length > 0) {
      config.eliminationStages.forEach(size => {
        sessions.push(`ELIM_${size}`);
      });
    }
    return sessions;
  }, [selectedArcher, config]);

  // Existing score for this specific archer, session, and end
  const existingScore = useMemo(() => {
    if (!selectedArcherId) return null;
    return (event.scores || []).find(s => 
      s.archerId === selectedArcherId && 
      s.endIndex === targetEnd && 
      (s.sessionId === activeSession || (!s.sessionId && activeSession === 'QUAL')) && 
      !s.isDeleted
    ) || null;
  }, [event.scores, selectedArcherId, targetEnd, activeSession]);

  // Sync tempArrows when targetEnd, selectedArcherId, or activeSession changes
  useEffect(() => {
    if (!selectedArcher) {
      setTempArrows([]);
      setIsDirty(false);
      return;
    }

    if (existingScore && Array.isArray(existingScore.arrows) && existingScore.arrows.length > 0) {
      const loaded: ArrowVal[] = existingScore.arrows.slice(0, arrowsCount).map((v: any) => {
        if (v === 'X' || v === 'x') return 'X';
        if (v === 'M' || v === 'm') return 'M';
        if (v === 0) return 'M';
        if (typeof v === 'number') return v;
        return -1;
      });
      while (loaded.length < arrowsCount) {
        loaded.push(-1);
      }
      setTempArrows(loaded);
      setRambahanScore(existingScore.total || 0);
      setRambahan6s(existingScore.count6 || 0);
      setRambahan5s(existingScore.count5 || 0);
    } else {
      setTempArrows(new Array(arrowsCount).fill(-1));
      setRambahanScore(0);
      setRambahan6s(0);
      setRambahan5s(0);
    }
    setActiveArrowIndex(0);
    setIsDirty(false);
  }, [selectedArcherId, targetEnd, activeSession, existingScore, arrowsCount]);

  // Keypad values based on target type
  const keypadValues: (number | 'X' | 'M')[] = useMemo(() => {
    const targetType = config?.targetType;
    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      return [2, 1, 'M'];
    } else if (targetType === TargetType.TRADITIONAL_6_RING) {
      return [6, 5, 4, 3, 2, 1, 'M'];
    } else if (targetType === TargetType.FACE_5_RING) {
      return [5, 4, 3, 2, 1, 'M'];
    } else if (targetType === TargetType.FACE_3X20) {
      return ['X', 10, 9, 8, 7, 6, 'M'];
    }
    return ['X', 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 'M'];
  }, [config?.targetType]);

  // Button style helper matching archery target rings
  const getButtonStyles = useCallback((val: number | 'X' | 'M') => {
    const targetType = config?.targetType;
    
    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      if (val === 2) return 'bg-[#800000] text-white border-[#600000] shadow-sm';
      if (val === 1) return 'bg-yellow-400 text-slate-900 border-yellow-600 shadow-sm';
      return 'bg-slate-900 text-white border-slate-700 shadow-sm'; // M
    }
    
    if (targetType === TargetType.TRADITIONAL_6_RING) {
      if (val === 6 || val === 5 || val === 4) return 'bg-yellow-400 text-slate-900 border-yellow-600 shadow-sm';
      if (val === 3) return 'bg-red-600 text-white border-red-800 shadow-sm';
      if (val === 2) return 'bg-white text-slate-900 border-slate-300 shadow-sm';
      if (val === 1) return 'bg-blue-600 text-white border-blue-800 shadow-sm';
      return 'bg-slate-900 text-white border-slate-700 shadow-sm';
    }

    if (targetType === TargetType.FACE_5_RING) {
      if (val === 5) return 'bg-yellow-400 text-slate-900 border-yellow-600 shadow-sm';
      if (val === 4) return 'bg-red-600 text-white border-red-800 shadow-sm';
      if (val === 3) return 'bg-blue-600 text-white border-blue-800 shadow-sm';
      if (val === 2) return 'bg-slate-900 text-white border-slate-700 shadow-sm';
      if (val === 1) return 'bg-white text-slate-900 border-slate-300 shadow-sm';
      return 'bg-slate-900 text-white border-slate-700 shadow-sm';
    }

    if (val === 'X' || val === 10 || val === 9) return 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm';
    if (val === 8 || val === 7) return 'bg-red-600 text-white border-red-700 shadow-sm';
    if (val === 6 || val === 5) return 'bg-blue-600 text-white border-blue-700 shadow-sm';
    if (val === 4 || val === 3) return 'bg-slate-900 text-white border-slate-700 shadow-sm';
    if (val === 2 || val === 1) return 'bg-white text-slate-900 border-slate-300 shadow-sm';
    return 'bg-slate-850 text-white border-slate-700 shadow-sm'; // M
  }, [config?.targetType]);

  // Arrow value entry handler
  const handleInputArrow = useCallback((val: number | 'X' | 'M') => {
    if (!selectedArcher || arrowsCount === 0) return;
    setIsDirty(true);

    const idx = activeArrowIndex !== null && activeArrowIndex < arrowsCount
      ? activeArrowIndex
      : tempArrows.findIndex(v => v === -1);

    const targetIdx = idx !== -1 ? idx : 0;

    setTempArrows(prev => {
      const next = [...prev];
      next[targetIdx] = val;
      return next;
    });

    // Advance to next arrow index
    if (targetIdx + 1 < arrowsCount) {
      setActiveArrowIndex(targetIdx + 1);
    } else {
      setActiveArrowIndex(targetIdx);
    }
  }, [selectedArcher, arrowsCount, activeArrowIndex, tempArrows]);

  // Delete/Backspace arrow handler
  const handleDeleteArrow = useCallback(() => {
    if (!selectedArcher || arrowsCount === 0) return;
    setIsDirty(true);

    const currIdx = activeArrowIndex !== null ? activeArrowIndex : arrowsCount - 1;
    setTempArrows(prev => {
      const next = [...prev];
      next[currIdx] = -1;
      return next;
    });

    if (currIdx > 0) {
      setActiveArrowIndex(currIdx - 1);
    }
  }, [selectedArcher, arrowsCount, activeArrowIndex]);

  // Reset current end arrows
  const handleResetEnd = () => {
    if (window.confirm(`Kosongkan semua panah pada Rambahan #${targetEnd + 1}?`)) {
      setTempArrows(new Array(arrowsCount).fill(-1));
      setActiveArrowIndex(0);
      setIsDirty(true);
      toast.info(`Panah Rambahan #${targetEnd + 1} dikosongkan`);
    }
  };

  // Revert back to original saved arrows
  const handleRevertToSaved = () => {
    if (existingScore && existingScore.arrows) {
      const loaded: ArrowVal[] = existingScore.arrows.slice(0, arrowsCount).map((v: any) => {
        if (v === 'X' || v === 'x') return 'X';
        if (v === 'M' || v === 'm') return 'M';
        if (v === 0) return 'M';
        if (typeof v === 'number') return v;
        return -1;
      });
      while (loaded.length < arrowsCount) loaded.push(-1);
      setTempArrows(loaded);
      setActiveArrowIndex(0);
      setIsDirty(false);
      toast.info("Mengembalikan ke data skor yang tersimpan");
    } else {
      setTempArrows(new Array(arrowsCount).fill(-1));
      setActiveArrowIndex(0);
      setIsDirty(false);
    }
  };

  // Physical Keyboard Support for fast operation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (inputMode !== 'ARROW' || !selectedArcher || showScanner) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = (e.key || '').toLowerCase();

      // Number keys 1-9
      if (/^[1-9]$/.test(key)) {
        const val = parseInt(key);
        if (keypadValues.includes(val)) {
          e.preventDefault();
          handleInputArrow(val);
        }
      }
      // 0 key mapped to 10 or 0 / M
      else if (key === '0') {
        e.preventDefault();
        if (keypadValues.includes(10)) handleInputArrow(10);
        else if (keypadValues.includes(0)) handleInputArrow(0);
        else if (keypadValues.includes('M')) handleInputArrow('M');
      }
      // 'x' key for X
      else if (key === 'x' || key === '*') {
        e.preventDefault();
        if (keypadValues.includes('X')) handleInputArrow('X');
      }
      // 'm' key for Miss
      else if (key === 'm' || key === '/') {
        e.preventDefault();
        if (keypadValues.includes('M')) handleInputArrow('M');
      }
      // Backspace / Delete
      else if (key === 'backspace' || key === 'delete') {
        e.preventDefault();
        handleDeleteArrow();
      }
      // Arrow keys for slot navigation
      else if (key === 'arrowleft') {
        e.preventDefault();
        setActiveArrowIndex(prev => prev !== null ? Math.max(0, prev - 1) : 0);
      }
      else if (key === 'arrowright') {
        e.preventDefault();
        setActiveArrowIndex(prev => prev !== null ? Math.min(arrowsCount - 1, prev + 1) : 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputMode, selectedArcher, showScanner, keypadValues, arrowsCount, handleInputArrow, handleDeleteArrow]);

  // Calculate real-time stats for current arrows
  const arrowCalculations = useMemo(() => {
    let maxVal = 10;
    const targetType = config?.targetType;
    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      maxVal = 2;
    } else if (targetType === TargetType.TRADITIONAL_6_RING) {
      maxVal = 6;
    } else if (targetType === TargetType.FACE_5_RING) {
      maxVal = 5;
    }

    let calculatedTotal = 0;
    let count6 = 0;
    let count5 = 0;
    let filledCount = 0;

    tempArrows.forEach(v => {
      if (v === -1) return;
      filledCount++;
      if (v === 'X') {
        calculatedTotal += maxVal;
      } else if (v === 'M') {
        calculatedTotal += 0;
      } else {
        calculatedTotal += Number(v);
      }
    });

    if (targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA) {
      count6 = tempArrows.filter(v => v === 2).length;
      count5 = tempArrows.filter(v => v === 1).length;
    } else if (targetType === TargetType.TRADITIONAL_6_RING) {
      count6 = tempArrows.filter(v => v === 6).length;
      count5 = tempArrows.filter(v => v === 5).length;
    } else if (targetType === TargetType.FACE_5_RING) {
      count6 = tempArrows.filter(v => v === 5).length;
      count5 = tempArrows.filter(v => v === 4).length;
    } else {
      // Standard 10-ring face
      count6 = tempArrows.filter(v => v === 'X' || v === 10).length;
      count5 = tempArrows.filter(v => v === 9).length;
    }

    const oldTotal = existingScore?.total ?? 0;
    const diff = calculatedTotal - oldTotal;

    return { calculatedTotal, count6, count5, filledCount, oldTotal, diff };
  }, [tempArrows, config?.targetType, existingScore]);

  // Save Per-Arrow Correction
  const handleSaveArrowCorrection = () => {
    if (!selectedArcher) return;

    if (!operatorName.trim()) {
      toast.error("Nama Operator wajib diisi sebelum menyimpan koreksi!");
      return;
    }

    if (!editReason.trim()) {
      toast.error("Alasan Audit / Catatan Koreksi wajib diisi untuk integritas data turnamen!");
      return;
    }

    // Convert tempArrows to standard ScoreEntry.arrows representation: 'X' or number (M / -1 -> 0)
    const finalArrows: (number | 'X')[] = tempArrows.map(v => {
      if (v === 'X') return 'X';
      if (v === 'M' || v === -1) return 0;
      return Number(v);
    });

    const isReset = tempArrows.every(v => v === -1);

    const scoreEntry: ScoreEntry = {
      archerId: selectedArcher.id,
      sessionId: activeSession,
      endIndex: targetEnd,
      arrows: finalArrows,
      total: arrowCalculations.calculatedTotal,
      count6: arrowCalculations.count6,
      count5: arrowCalculations.count5,
      lastUpdated: Date.now(),
      isDeleted: isReset
    };

    const arrowsSummary = tempArrows.map(v => v === -1 ? '-' : v).join(', ');
    const oldArrowsSummary = existingScore?.arrows ? existingScore.arrows.join(', ') : 'Belum Ada';

    const log: ScoreLog = {
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      archerId: selectedArcher.id,
      sessionId: activeSession,
      endIndex: targetEnd,
      oldTotal: existingScore?.total ?? 0,
      newTotal: arrowCalculations.calculatedTotal,
      timestamp: Date.now(),
      operatorName: operatorName.trim(),
      reason: `Koreksi Per-Arrow [End #${targetEnd + 1}]: ${editReason.trim()} | Panah Lama: [${oldArrowsSummary}] ➔ Baru: [${arrowsSummary}]`
    };

    onSaveScore(scoreEntry, log);
    setIsDirty(false);
    toast.success(`Koreksi Rambahan #${targetEnd + 1} (${selectedArcher.name}) berhasil disimpan & dicatat ke Audit Log!`);
  };

  // Save Rambahan Mode
  const handleSaveRambahan = () => {
    if (!selectedArcher) return;

    if (!operatorName.trim()) {
      toast.error("Nama Operator wajib diisi!");
      return;
    }

    if (!editReason.trim()) {
      toast.error("Alasan Audit / Catatan Koreksi wajib diisi!");
      return;
    }

    const dummyArrows: (number | 'X')[] = new Array(arrowsCount).fill(0);
    for (let i = 0; i < rambahan6s; i++) {
      if (i < dummyArrows.length) dummyArrows[i] = 'X';
    }
    
    const scoreEntry: ScoreEntry = {
      archerId: selectedArcher.id,
      sessionId: activeSession,
      endIndex: targetEnd,
      arrows: dummyArrows,
      total: rambahanScore,
      count6: rambahan6s,
      count5: rambahan5s,
      lastUpdated: Date.now()
    };

    const log: ScoreLog = {
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      archerId: selectedArcher.id,
      sessionId: activeSession,
      endIndex: targetEnd,
      oldTotal: existingScore?.total ?? 0,
      newTotal: rambahanScore,
      timestamp: Date.now(),
      operatorName: operatorName.trim(),
      reason: `Input Cepat Rambahan [End #${targetEnd + 1}]: ${editReason.trim()} (6s: ${rambahan6s}, 5s: ${rambahan5s})`
    };

    onSaveScore(scoreEntry, log);
    toast.success(`Skor Rambahan #${targetEnd + 1} (${selectedArcher.name}) berhasil disimpan!`);
  };

  // QR Scan Handler
  const handleScan = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'SCORING_SHEET' && parsed.eventId === event.id) {
        setSelectedCategory('ALL');
        setSearchTerm('');
        setSelectedArcherId(parsed.archerId);
        setShowScanner(false);
        toast.success("Lembar skor berhasil dipindai!");
      } else {
        toast.error("QR Code tidak valid untuk event ini.");
      }
    } catch (e) {
      toast.error("Gagal membaca QR Code.");
    }
  };

  // Filtered audit logs for the selected archer
  const archerAuditLogs = useMemo(() => {
    if (!selectedArcherId) return [];
    return (event.scoreLogs || [])
      .filter(l => l.archerId === selectedArcherId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [event.scoreLogs, selectedArcherId]);

  return (
    <div className="space-y-8 max-w-[1500px] mx-auto pb-20 px-2 sm:px-4">
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      
      {/* Top Navigation & Controls Bar */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 w-full xl:w-auto">
          <button 
            onClick={onBack} 
            className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all active:scale-95 shrink-0"
            title="Kembali ke Menu Admin"
          >
            <ArrowLeft className="w-6 h-6 text-slate-800" />
          </button>
          <div>
            <h2 className="text-2xl font-black font-oswald uppercase italic tracking-wide text-slate-900">
              Operator Data Console
            </h2>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">
              Audit Log & Koreksi Skor Resmi (Per-Arrow & Per-Rambahan)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end">
          <button 
            onClick={() => setShowScanner(true)}
            className="bg-arcus-red hover:bg-red-700 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 shadow-md active:scale-95 transition-all"
          >
            <ScanLine className="w-4 h-4" /> Scan Sheet
          </button>
          <a 
            href="https://ais-pre-ihwvpfbazwbyenzfsn3unw-238734823836.asia-southeast1.run.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <Clock className="w-4 h-4" /> Buka Timer
          </a>

          <div className="relative">
            <input 
              type="text" 
              placeholder="Nama Operator / Juri..." 
              value={operatorName}
              onChange={e => setOperatorName(e.target.value)}
              className="py-3 px-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold focus:border-blue-500 outline-none w-48"
            />
          </div>

          {/* Mode Switcher Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setInputMode('ARROW')}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                inputMode === 'ARROW'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Per-Arrow
            </button>
            <button
              onClick={() => setInputMode('RAMBAHAN')}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                inputMode === 'RAMBAHAN'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Per-Rambahan
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Archer List & Search */}
        <div className="xl:col-span-4 bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden flex flex-col h-[760px] shadow-sm">
          <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Cari atlet, klub, bantalan (1A, 2B)..." 
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button 
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                  selectedCategory === 'ALL' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Semua
              </button>
              {availableCategories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat as CategoryType)}
                  className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border whitespace-nowrap transition-all ${
                    selectedCategory === cat 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredArchers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                Tidak ada pemanah yang cocok
              </div>
            ) : (
              filteredArchers.map(a => {
                const isSelected = selectedArcherId === a.id;
                // Calculate total recorded score in QUAL
                const archerTotal = (event.scores || [])
                  .filter(s => s.archerId === a.id && (!s.sessionId || s.sessionId === 'QUAL') && !s.isDeleted)
                  .reduce((acc, s) => acc + (s.total || 0), 0);

                return (
                  <button 
                    key={a.id} 
                    onClick={() => setSelectedArcherId(a.id)}
                    className={`w-full p-4 text-left rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                        : 'bg-white border-slate-100 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {a.targetNo ? `${a.targetNo}${a.position || ''}` : 'No Bantalan'}
                        </span>
                        <span className={`text-[10px] font-bold uppercase truncate ${
                          isSelected ? 'text-blue-100' : 'text-slate-400'
                        }`}>
                          {a.club || '-'}
                        </span>
                      </div>
                      <p className="font-black font-oswald uppercase text-base italic truncate mt-1">
                        {a.name}
                      </p>
                      <p className={`text-[9px] font-bold uppercase truncate ${
                        isSelected ? 'text-blue-200' : 'text-slate-400'
                      }`}>
                        {CATEGORY_LABELS[a.category as CategoryType] || a.category}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-lg font-black font-oswald leading-none ${
                        isSelected ? 'text-white' : 'text-slate-800'
                      }`}>
                        {archerTotal}
                      </div>
                      <span className={`text-[8px] font-bold uppercase tracking-wider ${
                        isSelected ? 'text-blue-200' : 'text-slate-400'
                      }`}>
                        Poin
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Correction Workspace */}
        <div className="xl:col-span-8">
          {!selectedArcher ? (
            <div className="h-[760px] bg-white flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[3rem] p-10 text-center space-y-4 shadow-sm">
              <div className="p-6 bg-slate-50 rounded-full border border-slate-200 text-slate-300">
                <Target className="w-16 h-16" />
              </div>
              <p className="font-oswald uppercase italic font-black text-xl tracking-wider text-slate-600">
                Pilih Pemanah untuk Melakukan Audit & Koreksi Skor
              </p>
              <p className="text-xs text-slate-400 max-w-md">
                Pilih salah satu atlet di daftar sebelah kiri atau gunakan tombol Scan Sheet untuk membuka data rambahan atlet yang bersangkutan.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] border border-slate-200 p-6 sm:p-10 space-y-8 shadow-sm">
              {/* Archer Identity Card */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-6 gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-black uppercase tracking-wider">
                      Bantalan {selectedArcher.targetNo || '-'}{selectedArcher.position || ''}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {selectedArcher.club || 'Independen'}
                    </span>
                  </div>
                  <h3 className="text-3xl font-black font-oswald uppercase italic text-slate-900 leading-tight">
                    {selectedArcher.name}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">
                    {CATEGORY_LABELS[selectedArcher.category as CategoryType] || selectedArcher.category} • {totalEnds} Rambahan × {arrowsCount} Panah {config?.distance ? `• Jarak ${config.distance}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-slate-100 rounded-2xl text-slate-700 font-black font-oswald text-sm italic uppercase tracking-wider border border-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {inputMode === 'ARROW' ? 'Koreksi Per-Arrow' : 'Input Per-Rambahan'}
                  </div>
                </div>
              </div>

              {/* Rambahan & Session Selection Bar */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Babak:
                    </label>
                    <select 
                      value={activeSession} 
                      onChange={e => setActiveSession(e.target.value)} 
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-500"
                    >
                      {availableSessions.map(s => (
                        <option key={s} value={s}>
                          {s === 'QUAL' ? 'Kualifikasi' : (s || '').replace('ELIM_', 'Eliminasi Top ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {existingScore ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Rambahan #{targetEnd + 1} Terisi (Total: {existingScore.total} poin)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Rambahan #{targetEnd + 1} Belum Ada Data
                    </div>
                  )}
                </div>

                {/* Rambahan Selector Badges */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                  {Array.from({ length: totalEnds }).map((_, i) => {
                    const score = (event.scores || []).find(s => 
                      s.archerId === selectedArcher.id && 
                      s.endIndex === i && 
                      (s.sessionId === activeSession || (!s.sessionId && activeSession === 'QUAL')) && 
                      !s.isDeleted
                    );
                    const isActive = targetEnd === i;

                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setTargetEnd(i);
                        }}
                        className={`px-4 py-2.5 rounded-2xl border transition-all shrink-0 text-left ${
                          isActive
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-102'
                            : score
                              ? 'bg-white border-slate-300 text-slate-800 hover:border-blue-400'
                              : 'bg-slate-100 border-dashed border-slate-300 text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-wider">
                          End #{i + 1}
                        </div>
                        <div className="text-sm font-black font-oswald leading-none mt-0.5">
                          {score ? `${score.total} pts` : '-'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ========================================================= */}
              {/* MODE 1: KOREKSI PER-ARROW */}
              {/* ========================================================= */}
              {inputMode === 'ARROW' && (
                <div className="space-y-8 animate-in fade-in">
                  {/* Arrow Slot Boxes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-blue-600" />
                        Kotak Panah Rambahan #{targetEnd + 1} ({arrowsCount} Panah):
                      </label>
                      <div className="flex items-center gap-2">
                        {isDirty && (
                          <button
                            onClick={handleRevertToSaved}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all"
                            title="Kembalikan nilai ke data tersimpan"
                          >
                            <Undo2 className="w-3 h-3" />
                            Kembalikan Asli
                          </button>
                        )}
                        <button
                          onClick={handleResetEnd}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-all"
                          title="Kosongkan rambahan ini"
                        >
                          <Trash2 className="w-3 h-3" />
                          Reset Rambahan
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {tempArrows.map((val, idx) => {
                        const isActive = activeArrowIndex === idx;
                        const isFilled = val !== -1;
                        const buttonColor = isFilled ? getButtonStyles(val) : '';

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveArrowIndex(idx)}
                            className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-between p-2.5 transition-all relative ${
                              isActive
                                ? isFilled
                                  ? `${buttonColor} ring-4 ring-blue-500 shadow-lg scale-105`
                                  : 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/40 shadow-lg scale-105 text-blue-900'
                                : isFilled
                                  ? `${buttonColor} shadow-sm hover:scale-102`
                                  : 'border-dashed border-slate-300 bg-white text-slate-300 hover:border-slate-400'
                            }`}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              isFilled ? 'opacity-80' : isActive ? 'text-blue-700 font-black' : 'text-slate-400'
                            }`}>
                              Panah {idx + 1}
                            </span>

                            <span className="text-3xl font-black font-oswald leading-none">
                              {val === -1 ? '-' : val}
                            </span>

                            <span className={`text-[8px] font-bold uppercase tracking-wider ${
                              isFilled ? 'opacity-70' : 'text-slate-300'
                            }`}>
                              {isActive ? 'Aktif' : isFilled ? 'Terekam' : 'Kosong'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Virtual Keypad for Arrows */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Papan Nilai / Keypad Target:
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:inline-block">
                        Tips: Anda juga bisa menekan angka/huruf keyboard (X, 10, 9..0, M, Backspace)
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
                      {keypadValues.map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleInputArrow(val)}
                          className={`h-14 sm:h-16 rounded-2xl text-xl sm:text-2xl font-black font-oswald active:scale-95 transition-all flex items-center justify-center border-b-4 ${getButtonStyles(val)}`}
                        >
                          {val}
                        </button>
                      ))}
                      
                      <button
                        type="button"
                        onClick={handleDeleteArrow}
                        className="h-14 sm:h-16 bg-white text-red-600 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-all border-2 border-slate-200 border-b-4 hover:bg-red-50 hover:border-red-300 shadow-sm"
                        title="Hapus Nilai Panah Saat Ini"
                      >
                        <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">Hapus</span>
                      </button>
                    </div>
                  </div>

                  {/* Calculation & Diff Banner */}
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6 w-full md:w-auto justify-around md:justify-start">
                      <div className="text-center md:text-left">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Total Rambahan #{targetEnd + 1}
                        </div>
                        <div className="text-4xl sm:text-5xl font-black font-oswald text-amber-400">
                          {arrowCalculations.calculatedTotal}
                        </div>
                      </div>

                      <div className="h-12 w-px bg-slate-700" />

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          Statistik Panah
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold">
                          <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded border border-amber-400/30">
                            {config?.targetType === TargetType.PUTA ? '2 (Puta)' : 'X / 10'}: {arrowCalculations.count6}
                          </span>
                          <span className="px-2 py-0.5 bg-red-400/20 text-red-300 rounded border border-red-400/30">
                            {config?.targetType === TargetType.PUTA ? '1' : '9'}: {arrowCalculations.count5}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Diff Indicator */}
                    <div className="text-right w-full md:w-auto border-t md:border-t-0 border-slate-700 pt-3 md:pt-0">
                      {existingScore ? (
                        <div className="flex flex-col items-center md:items-end">
                          <div className="text-[10px] font-bold uppercase text-slate-400">
                            Perbandingan Data:
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs line-through text-slate-400 font-mono">
                              Lama: {arrowCalculations.oldTotal}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm font-black font-mono text-emerald-400">
                              Baru: {arrowCalculations.calculatedTotal}
                            </span>
                            {arrowCalculations.diff !== 0 && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono ${
                                arrowCalculations.diff > 0 
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                                  : 'bg-red-500/20 text-red-300 border border-red-400/30'
                              }`}>
                                {arrowCalculations.diff > 0 ? `+${arrowCalculations.diff}` : arrowCalculations.diff}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">
                          Input data baru untuk rambahan #{targetEnd + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Audit Details & Save Button */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                          Alasan Audit / Catatan Koreksi Juri (Wajib):
                        </label>
                        <span className="text-[10px] text-slate-400">
                          Akan tersimpan permanen di Audit Log
                        </span>
                      </div>

                      {/* Quick Reason Chips */}
                      <div className="flex flex-wrap gap-2">
                        {[
                          'Koreksi lembar skor fisik atlet',
                          'Keputusan wasit / juri target',
                          'Salah input scorer lapangan',
                          'Hasil protes resmi disetujui',
                          'Koreksi panah tertukar bantalan'
                        ].map(reason => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => setEditReason(reason)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 transition-all active:scale-95"
                          >
                            + {reason}
                          </button>
                        ))}
                      </div>

                      <textarea 
                        value={editReason} 
                        onChange={e => setEditReason(e.target.value)} 
                        placeholder="Contoh: Koreksi panah ke-2 dari 8 menjadi 9 sesuai verifikasi lembar fisik bertandatangan wasit..." 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs resize-none h-24 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <button 
                      onClick={handleSaveArrowCorrection} 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2.5"
                    >
                      <Save className="w-5 h-5" />
                      Simpan Koreksi Per-Arrow & Catat Log Audit
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MODE 2: INPUT CEPAT PER-RAMBAHAN */}
              {/* ========================================================= */}
              {inputMode === 'RAMBAHAN' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                        Total Skor Rambahan #{targetEnd + 1}
                      </label>
                      <input 
                        type="number" 
                        value={rambahanScore} 
                        onChange={e => setRambahanScore(Number(e.target.value))} 
                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-3xl font-oswald outline-none focus:border-blue-500" 
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                        {config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA 
                          ? 'Jumlah 2 (Puta)' 
                          : 'Jumlah X / 10'}
                      </label>
                      <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                        <button 
                          onClick={() => setRambahan6s(Math.max(0, rambahan6s - 1))} 
                          className="p-3 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-xs"
                        >
                          <Minus className="w-4 h-4 text-slate-700" />
                        </button>
                        <span className="flex-1 text-center font-black font-oswald text-2xl">{rambahan6s}</span>
                        <button 
                          onClick={() => setRambahan6s(rambahan6s + 1)} 
                          className="p-3 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-xs"
                        >
                          <Plus className="w-4 h-4 text-slate-700" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                        {config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA 
                          ? 'Jumlah 1' 
                          : 'Jumlah 9'}
                      </label>
                      <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                        <button 
                          onClick={() => setRambahan5s(Math.max(0, rambahan5s - 1))} 
                          className="p-3 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-xs"
                        >
                          <Minus className="w-4 h-4 text-slate-700" />
                        </button>
                        <span className="flex-1 text-center font-black font-oswald text-2xl">{rambahan5s}</span>
                        <button 
                          onClick={() => setRambahan5s(rambahan5s + 1)} 
                          className="p-3 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-xs"
                        >
                          <Plus className="w-4 h-4 text-slate-700" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Alasan Audit / Catatan Operator
                    </label>
                    <textarea 
                      value={editReason} 
                      onChange={e => setEditReason(e.target.value)} 
                      placeholder="Tulis alasan audit atau koreksi..." 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs resize-none h-24 focus:border-blue-500 outline-none" 
                    />
                  </div>

                  <button 
                    onClick={handleSaveRambahan} 
                    className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2.5"
                  >
                    <Save className="w-5 h-5" />
                    Simpan Skor Rambahan & Log Audit
                  </button>
                </div>
              )}

              {/* ========================================================= */}
              {/* AUDIT LOG HISTORY TABLE FOR THIS ARCHER */}
              {/* ========================================================= */}
              <div className="border-t border-slate-100 pt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-black font-oswald uppercase tracking-wider text-slate-800">
                      Riwayat Audit Log Pemanah Ini ({archerAuditLogs.length} Catatan)
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Jejak Audit Resmi
                  </span>
                </div>

                {archerAuditLogs.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Belum ada riwayat koreksi audit untuk atlet ini.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {archerAuditLogs.map(log => (
                      <div 
                        key={log.id} 
                        className="p-4 bg-slate-50 hover:bg-blue-50/40 rounded-2xl border border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 font-oswald uppercase">
                              {log.operatorName || 'Operator'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold uppercase">
                              End #{(log.endIndex ?? 0) + 1}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs font-medium italic">
                            "{log.reason}"
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono text-xs font-black text-slate-800">
                            {log.oldTotal ?? 0} ➔ <span className="text-blue-600 font-black">{log.newTotal ?? 0} pts</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperatorCenter;
