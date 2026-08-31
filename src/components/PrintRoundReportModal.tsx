import React, { useState, useMemo } from 'react';
import { 
  Printer, Download, Copy, Check, X, Trophy, Medal, 
  Target, Award, Calendar, MapPin, Users, ChevronRight,
  FileSpreadsheet, ShieldCheck, Sparkles, Filter
} from 'lucide-react';
import { ArcheryEvent, CategoryType, Match, Archer, TargetType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import ArcusLogo from './ArcusLogo';
import { toast } from 'sonner';

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  event: ArcheryEvent;
  initialCategory?: CategoryType;
  initialRound?: string; // 'QUAL', 'QUAL_QUALIFIED', '64', '32', '16', '8', '4', '2', '1', 'BRACKET_ALL', 'FINAL_STANDINGS'
}

export default function PrintRoundReportModal({
  isOpen = true,
  onClose,
  event,
  initialCategory = CategoryType.ADULT_PUTRA,
  initialRound = 'QUAL'
}: Props) {
  if (isOpen === false) return null;
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(initialCategory);
  const [selectedRoundType, setSelectedRoundType] = useState<string>(initialRound);
  const [qualifiedCutoff, setQualifiedCutoff] = useState<number>(32); // Default top 32
  const [hasCopiedText, setHasCopiedText] = useState(false);

  // Sync state if initial props change
  React.useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  React.useEffect(() => {
    if (initialRound) setSelectedRoundType(initialRound);
  }, [initialRound]);

  const config = useMemo(() => {
    return (event.settings.categoryConfigs || {})[selectedCategory];
  }, [event.settings, selectedCategory]);

  const archersInCategory = useMemo(() => {
    return (event.archers || []).filter(a => a.category === selectedCategory);
  }, [event.archers, selectedCategory]);

  const matchesInCategory = useMemo(() => {
    return (event.matches?.[selectedCategory] || []);
  }, [event.matches, selectedCategory]);

  // Tie-breaker and target type detection
  const isSmallTarget = config?.targetType === TargetType.PUTA || config?.targetType === TargetType.TRADITIONAL_PUTA;
  const isSixRing = config?.targetType === TargetType.TRADITIONAL_6_RING;
  const isFiveRing = config?.targetType === TargetType.FACE_5_RING;

  const tieBreakLabels = useMemo(() => {
    if (isSmallTarget) return { highest: '2s', second: '1s' };
    if (isSixRing) return { highest: '6s', second: '5s' };
    if (isFiveRing) return { highest: '5s', second: '4s' };
    return { highest: '10+X', second: '9s' };
  }, [isSmallTarget, isSixRing, isFiveRing]);

  // Calculate qualification rankings
  const rankedArchers = useMemo(() => {
    const scoresList = event.scores || [];
    const baseSession = 'QUAL';

    const list = archersInCategory.map(archer => {
      const archerScores = scoresList.filter(s => s.archerId === archer.id && s.sessionId === baseSession && !s.isDeleted);
      const total = archerScores.reduce((acc, curr) => acc + curr.total, 0);

      const manualSixes = archerScores.reduce((acc, curr) => acc + (curr.count6 || 0), 0);
      const manualFives = archerScores.reduce((acc, curr) => acc + (curr.count5 || 0), 0);

      const allArrows = archerScores.flatMap(s => s.arrows || []).filter(v => v !== undefined && v !== -1);
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
        arrowSixes = allArrows.filter(v => v === 'X' || v === 10).length;
        arrowFives = allArrows.filter(v => v === 9).length;
      }

      const hasManual = archerScores.some(s => s.count6 !== undefined && s.count6 !== 0);
      const sixes = hasManual ? manualSixes : arrowSixes;
      const fives = hasManual ? manualFives : arrowFives;

      return {
        ...archer,
        total,
        sixes,
        fives
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.sixes !== a.sixes) return b.sixes - a.sixes;
      return b.fives - a.fives;
    });

    return list.map((item, idx, arr) => {
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
      return { ...item, tieLabel, displayRank, seed: idx + 1 };
    });
  }, [archersInCategory, event.scores, isSmallTarget, isSixRing, isFiveRing]);

  const getArcherById = (id?: string) => {
    if (!id) return null;
    return rankedArchers.find(a => a.id === id) || archersInCategory.find(a => a.id === id);
  };

  // Extract rounds available from matches
  const availableRounds = useMemo(() => {
    const roundsMap = new Set<string>();
    matchesInCategory.forEach(m => {
      roundsMap.add(m.round);
    });
    return Array.from(roundsMap).sort((a, b) => parseInt(b) - parseInt(a));
  }, [matchesInCategory]);

  // Helper labels
  const getRoundLabel = (roundKey: string) => {
    switch (roundKey) {
      case 'QUAL':
        return 'Babak Kualifikasi (Leaderboard Lengkap)';
      case 'QUAL_QUALIFIED':
        return `Daftar Lolos Eliminasi (Top ${qualifiedCutoff} Besar & Bagan Lawan)`;
      case '64':
        return 'Babak 1/32 Final (64 Besar)';
      case '32':
        return 'Babak 1/16 Final (32 Besar)';
      case '16':
        return 'Babak 1/8 Final (16 Besar)';
      case '8':
        return 'Babak Perempat Final / Quarter Final (8 Besar)';
      case '4':
        return 'Babak Semi Final (4 Besar)';
      case '1':
        return 'Babak Perebutan Juara 3 (Bronze Medal Match)';
      case '2':
        return 'Babak FINAL / Perebutan Medali Emas (Gold Medal Match)';
      case 'BRACKET_ALL':
        return 'Bagan Eliminasi Lengkap (Full Tree Bracket)';
      case 'FINAL_STANDINGS':
        return 'Hasil Akhir Turnamen & Daftar Medalis (Podium Juara)';
      default:
        return `Babak Round ${roundKey}`;
    }
  };

  // Winners calculation
  const finalMatch = matchesInCategory.find(m => m.round === "2");
  const bronzeMatch = matchesInCategory.find(m => m.round === "1");
  const winners = useMemo(() => {
    const j1Id = finalMatch?.winnerId;
    const j2Id = finalMatch?.winnerId ? (finalMatch.winnerId === finalMatch.archerAId ? finalMatch.archerBId : finalMatch.archerAId) : undefined;
    const j3Id = bronzeMatch?.winnerId;
    const j4Id = bronzeMatch?.winnerId ? (bronzeMatch.winnerId === bronzeMatch.archerAId ? bronzeMatch.archerBId : bronzeMatch.archerAId) : undefined;

    return {
      juara1: getArcherById(j1Id),
      juara2: getArcherById(j2Id),
      juara3: getArcherById(j3Id),
      juara4: getArcherById(j4Id),
    };
  }, [finalMatch, bronzeMatch, rankedArchers]);

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const tournamentName = event.settings.tournamentName || 'Tournament';
    const categoryName = CATEGORY_LABELS[selectedCategory] || selectedCategory;

    if (selectedRoundType === 'QUAL') {
      headers = ['Rank', 'Seed', 'Bantalan', 'Nama Atlet', 'Klub', 'Kategori', tieBreakLabels.highest, tieBreakLabels.second, 'Total Skor'];
      rows = rankedArchers.map(a => [
        `"${a.displayRank}${a.tieLabel}"`,
        a.seed,
        `"${a.targetNo || '-'}${a.position || ''}"`,
        `"${a.name}"`,
        `"${a.club || '-'}"`,
        `"${categoryName}"`,
        a.sixes,
        a.fives,
        a.total
      ]);
    } else if (selectedRoundType === 'QUAL_QUALIFIED') {
      const topArchers = rankedArchers.slice(0, qualifiedCutoff);
      headers = ['Seed', 'Rank Kualifikasi', 'Nama Atlet', 'Klub', 'Total Skor Kualifikasi', 'Status', 'Lawan Match 1'];
      rows = topArchers.map((a, idx) => {
        const opponentSeed = qualifiedCutoff - idx;
        const opponent = rankedArchers[opponentSeed - 1];
        return [
          `Seed ${idx + 1}`,
          `"${a.displayRank}${a.tieLabel}"`,
          `"${a.name}"`,
          `"${a.club || '-'}"`,
          a.total,
          'LOLOS ELIMINASI',
          `"${opponent ? `Seed ${opponentSeed}: ${opponent.name} (${opponent.club || '-'})` : `Seed ${opponentSeed} (BYE)`}"`
        ];
      });
    } else if (['64', '32', '16', '8', '4', '2', '1'].includes(selectedRoundType)) {
      const roundMatches = matchesInCategory.filter(m => m.round === selectedRoundType).sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0));
      headers = ['Match #', 'Seed A', 'Nama Atlet A', 'Klub A', 'Skor A', 'Skor B', 'Nama Atlet B', 'Klub B', 'Seed B', 'Pemenang', 'Keterangan Tie Break'];
      rows = roundMatches.map(m => {
        const archerA = getArcherById(m.archerAId);
        const archerB = getArcherById(m.archerBId);
        const winner = getArcherById(m.winnerId);
        const posA = (archerA as any)?.targetNo ? `TGT ${archerA?.targetNo}${archerA?.position || ''}` : '-';
        const posB = (archerB as any)?.targetNo ? `TGT ${archerB?.targetNo}${archerB?.position || ''}` : '-';
        return [
          m.matchNo || 1,
          posA,
          `"${archerA?.name || 'TBA'}"`,
          `"${archerA?.club || '-'}"`,
          m.scoreA,
          m.scoreB,
          `"${archerB?.name || 'TBA'}"`,
          `"${archerB?.club || '-'}"`,
          posB,
          `"${winner ? winner.name : 'Belum Selesai'}"`,
          `"${m.tieBreakWinnerReason || (m.isShootOff ? 'Shoot-Off' : '-')}"`
        ];
      });
    } else if (selectedRoundType === 'FINAL_STANDINGS') {
      headers = ['Posisi', 'Medali', 'Nama Atlet', 'Klub / Kontingen', 'Kategori'];
      rows = [
        ['Juara 1', 'Emas (Gold)', `"${winners.juara1?.name || 'TBA'}"`, `"${winners.juara1?.club || '-'}"`, `"${categoryName}"`],
        ['Juara 2', 'Perak (Silver)', `"${winners.juara2?.name || 'TBA'}"`, `"${winners.juara2?.club || '-'}"`, `"${categoryName}"`],
        ['Juara 3', 'Perunggu (Bronze)', `"${winners.juara3?.name || 'TBA'}"`, `"${winners.juara3?.club || '-'}"`, `"${categoryName}"`],
        ['Juara 4', 'Peringkat 4', `"${winners.juara4?.name || 'TBA'}"`, `"${winners.juara4?.club || '-'}"`, `"${categoryName}"`],
      ];
    } else {
      // BRACKET_ALL
      headers = ['Round', 'Match #', 'Atlet A', 'Skor A', 'Skor B', 'Atlet B', 'Pemenang'];
      rows = matchesInCategory.map(m => {
        const archerA = getArcherById(m.archerAId);
        const archerB = getArcherById(m.archerBId);
        const winner = getArcherById(m.winnerId);
        return [
          `Round ${m.round}`,
          m.matchNo || 1,
          `"${archerA?.name || 'TBA'}"`,
          m.scoreA,
          m.scoreB,
          `"${archerB?.name || 'TBA'}"`,
          `"${winner ? winner.name : '-'}"`
        ];
      });
    }

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Hasil_${tournamentName.replace(/\s+/g, '_')}_${selectedCategory}_${selectedRoundType}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("File CSV Berhasil Diunduh");
  };

  // Copy WhatsApp Summary
  const handleCopySummary = () => {
    const tournamentName = event.settings.tournamentName || 'Turnamen Panahan';
    const categoryName = CATEGORY_LABELS[selectedCategory] || selectedCategory;
    const dateStr = event.settings.eventDate || new Date().toLocaleDateString('id-ID');

    let text = `🏹 *HASIL RESMI ${tournamentName.toUpperCase()}*\n`;
    text += `📂 Kategori: *${categoryName}*\n`;
    text += `📅 Tanggal: ${dateStr}\n`;
    text += `📍 Babak: *${getRoundLabel(selectedRoundType)}*\n`;
    text += `------------------------------------\n\n`;

    if (selectedRoundType === 'QUAL') {
      text += `🏆 *TOP 10 PERINGKAT KUALIFIKASI:*\n`;
      rankedArchers.slice(0, 10).forEach((a, i) => {
        text += `${i + 1}. *${a.name}* (${a.club || '-'}) - Skor: *${a.total}* (${tieBreakLabels.highest}: ${a.sixes})\n`;
      });
      text += `\n_Total Peserta Terdaftar: ${rankedArchers.length} Archer_\n`;
    } else if (selectedRoundType === 'QUAL_QUALIFIED') {
      text += `🎯 *PESERTA LOLOS BABAK ELIMINASI (TOP ${qualifiedCutoff}):*\n`;
      rankedArchers.slice(0, qualifiedCutoff).forEach((a, i) => {
        const opponentSeed = qualifiedCutoff - i;
        const opponent = rankedArchers[opponentSeed - 1];
        text += `• Seed ${i + 1}: *${a.name}* (${a.club || '-'}) [Skor: ${a.total}] ➔ vs Seed ${opponentSeed}: ${opponent ? opponent.name : 'BYE'}\n`;
      });
    } else if (['64', '32', '16', '8', '4', '2', '1'].includes(selectedRoundType)) {
      const roundMatches = matchesInCategory.filter(m => m.round === selectedRoundType).sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0));
      text += `⚔️ *HASIL PERTANDINGAN ${getRoundLabel(selectedRoundType).toUpperCase()}:*\n\n`;
      roundMatches.forEach(m => {
        const archerA = getArcherById(m.archerAId);
        const archerB = getArcherById(m.archerBId);
        const winner = getArcherById(m.winnerId);
        text += `Match #${m.matchNo}: ${archerA?.name || 'TBA'} [${m.scoreA}] vs [${m.scoreB}] ${archerB?.name || 'TBA'}\n`;
        if (winner) {
          text += `  ➔ *Pemenang:* ${winner.name} ${m.tieBreakWinnerReason ? `(${m.tieBreakWinnerReason})` : ''}\n`;
        }
      });
    } else if (selectedRoundType === 'FINAL_STANDINGS') {
      text += `🎖️ *DAFTAR JUARA & MEDALIS RESMI:*\n\n`;
      text += `🥇 *JUARA 1 (EMAS):* ${winners.juara1?.name || 'TBA'} (${winners.juara1?.club || '-'})\n`;
      text += `🥈 *JUARA 2 (PERAK):* ${winners.juara2?.name || 'TBA'} (${winners.juara2?.club || '-'})\n`;
      text += `🥉 *JUARA 3 (PERUNGGU):* ${winners.juara3?.name || 'TBA'} (${winners.juara3?.club || '-'})\n`;
      if (winners.juara4) {
        text += `🎖️ *JUARA 4:* ${winners.juara4.name} (${winners.juara4.club || '-'})\n`;
      }
    }

    text += `\n_Dicetak otomatis via ARCUS Tournament OS_\n`;
    navigator.clipboard.writeText(text);
    setHasCopiedText(true);
    toast.success("Ringkasan hasil berhasil disalin ke clipboard!");
    setTimeout(() => setHasCopiedText(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Control Bar - Hidden on print */}
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 mb-4 shadow-2xl flex flex-col gap-4 print:hidden shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-arcus-red/10 text-arcus-red flex items-center justify-center font-black">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black font-oswald uppercase italic tracking-tight text-slate-900 leading-none">
                Pusat Cetak &amp; Laporan Skor Babak
              </h2>
              <p className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-widest mt-1">
                Cetak Lembar Resmi Kualifikasi, 32 Besar, 16 Besar, Perempat Final, Semi Final hingga Podium
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              {hasCopiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {hasCopiedText ? 'Tersalin' : 'Salin Teks WA'}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" /> Download CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-arcus-red hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-arcus-red/30 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" /> CETAK SEKARANG / PDF
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Selection Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Category Dropdown */}
          <div>
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block mb-1.5">
              1. Pilih Kategori:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CategoryType)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-arcus-red"
            >
              {(Object.keys(CategoryType) as CategoryType[])
                .filter(c => c !== CategoryType.OFFICIAL)
                .map(cat => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] || cat}
                  </option>
                ))}
            </select>
          </div>

          {/* Round Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block mb-1.5">
              2. Pilih Babak / Dokumen yang Dicetak:
            </label>
            <select
              value={selectedRoundType}
              onChange={(e) => setSelectedRoundType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-arcus-red"
            >
              <optgroup label="Babak Kualifikasi">
                <option value="QUAL">Hasil Kualifikasi Lengkap (Semua Archer)</option>
                <option value="QUAL_QUALIFIED">Daftar Archer Lolos ke Babak Eliminasi</option>
              </optgroup>
              <optgroup label="Babak Eliminasi / Aduan">
                {availableRounds.includes("64") && <option value="64">Babak 1/32 Final (64 Besar)</option>}
                {availableRounds.includes("32") && <option value="32">Babak 1/16 Final (32 Besar)</option>}
                {availableRounds.includes("16") && <option value="16">Babak 1/8 Final (16 Besar)</option>}
                {availableRounds.includes("8") && <option value="8">Babak Quarter Final (8 Besar)</option>}
                {availableRounds.includes("4") && <option value="4">Babak Semi Final (4 Besar)</option>}
                {availableRounds.includes("1") && <option value="1">Babak Perebutan Juara 3 (Bronze Match)</option>}
                {availableRounds.includes("2") && <option value="2">Babak FINAL (Gold Medal Match)</option>}
                <option value="BRACKET_ALL">Seluruh Pertandingan Bagan Eliminasi</option>
              </optgroup>
              <optgroup label="Rekapitulasi Akhir">
                <option value="FINAL_STANDINGS">Hasil Akhir &amp; Podium Medalis (Juara 1, 2, 3, 4)</option>
              </optgroup>
            </select>
          </div>

          {/* Qualified Cutoff Setting (if in QUAL_QUALIFIED mode) */}
          <div>
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block mb-1.5">
              3. Batas Kuota Lolos (Cutoff):
            </label>
            <div className="flex items-center gap-2">
              {[8, 16, 32, 64].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setQualifiedCutoff(num);
                    setSelectedRoundType('QUAL_QUALIFIED');
                  }}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedRoundType === 'QUAL_QUALIFIED' && qualifiedCutoff === num
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Top {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Printable Sheet Container (Standard A4 Paper Styling) */}
      <div 
        id="printable-report-sheet"
        className="w-full max-w-5xl bg-white rounded-3xl p-6 sm:p-12 shadow-2xl border border-slate-200 print:shadow-none print:border-0 print:p-0 print:m-0 print:rounded-none print:w-full print:max-w-none text-slate-900 font-sans"
      >
        
        {/* Official Header */}
        <div className="border-b-4 border-slate-900 pb-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <ArcusLogo className="w-14 h-14 sm:w-16 sm:h-16 shrink-0" />
              <div>
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-arcus-red block">
                  OFFICIAL TOURNAMENT SCORE REPORT
                </span>
                <h1 className="text-xl sm:text-3xl font-black font-oswald uppercase italic tracking-tight text-slate-900 leading-none">
                  {event.settings.tournamentName || 'TURNAMEN PANAHAN RESMI'}
                </h1>
                <div className="flex items-center gap-4 text-[9px] sm:text-xs font-bold text-slate-700 mt-1 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> {event.settings.location || 'Indonesia'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /> {event.settings.eventDate ? new Date(event.settings.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
                </div>
              </div>
            </div>

            <div className="text-right border-2 border-slate-900 p-2 sm:p-3 rounded-2xl bg-slate-50 text-center min-w-[130px]">
              <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-700 tracking-widest">Kategori Lomba</p>
              <p className="text-xs sm:text-base font-black font-oswald uppercase text-slate-900 italic leading-tight">
                {CATEGORY_LABELS[selectedCategory] || selectedCategory}
              </p>
              <p className="text-[8px] font-black text-arcus-red uppercase mt-0.5">
                Jarak: {config?.distance || 'Standard'}
              </p>
            </div>
          </div>

          {/* Sub-Header / Round Indicator */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-arcus-red rounded-full" />
              <h2 className="text-sm sm:text-lg font-black font-oswald uppercase italic text-slate-900 tracking-wide">
                {getRoundLabel(selectedRoundType)}
              </h2>
            </div>
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-700 uppercase tracking-widest">
              Total Atlet: <span className="text-slate-950 font-black">{archersInCategory.length}</span> | Status: <span className="text-emerald-700 font-black">RESMI (VERIFIED)</span>
            </div>
          </div>
        </div>

        {/* Content Body Based on Selected Round */}

        {/* 1. Full Qualification Leaderboard */}
        {selectedRoundType === 'QUAL' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-center w-12 rounded-l-lg">Rank</th>
                  <th className="py-2.5 px-2 text-center w-12">Seed</th>
                  <th className="py-2.5 px-2 text-center w-16">Bantalan</th>
                  <th className="py-2.5 px-3">Nama Atlet</th>
                  <th className="py-2.5 px-3">Klub / Kontingen</th>
                  <th className="py-2.5 px-3 text-center">{tieBreakLabels.highest}</th>
                  <th className="py-2.5 px-3 text-center">{tieBreakLabels.second}</th>
                  <th className="py-2.5 px-4 text-right rounded-r-lg">Total Skor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rankedArchers.map((archer, index) => (
                  <tr key={archer.id} className={index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                    <td className="py-2 px-3 text-center font-black font-oswald text-xs sm:text-sm">
                      <span className={`inline-block w-6 h-6 rounded-md text-center leading-6 ${
                        index === 0 ? 'bg-amber-400 text-slate-950 font-black' :
                        index === 1 ? 'bg-slate-300 text-slate-950 font-black' :
                        index === 2 ? 'bg-orange-300 text-slate-950 font-black' :
                        'text-slate-800'
                      }`}>
                        {archer.displayRank}{archer.tieLabel}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-700 text-[10px]">
                      #{archer.seed}
                    </td>
                    <td className="py-2 px-2 text-center font-black font-oswald text-slate-900 text-xs">
                      {archer.targetNo || '-'}{archer.position || ''}
                    </td>
                    <td className="py-2 px-3 font-black text-slate-900 uppercase font-oswald text-sm">
                      {archer.name}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-700 uppercase text-[10px]">
                      {archer.club || '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-800">
                      {archer.sixes}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-800">
                      {archer.fives}
                    </td>
                    <td className="py-2 px-4 text-right font-black font-oswald text-base sm:text-lg text-slate-950">
                      {archer.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Qualification Cutoff & Match Pairing (e.g. Top 32 Lolos Eliminasi) */}
        {selectedRoundType === 'QUAL_QUALIFIED' && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-950 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="font-bold">
                  Daftar {qualifiedCutoff} atlet terbaik dengan peringkat kualifikasi tertinggi yang resmi berhak maju ke Babak Eliminasi.
                </span>
              </div>
              <span className="font-black px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] uppercase tracking-wider">
                Bagan Top {qualifiedCutoff}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: qualifiedCutoff / 2 }).map((_, matchIdx) => {
                const seedA = matchIdx + 1;
                const seedB = qualifiedCutoff - matchIdx;
                const archerA = rankedArchers[seedA - 1];
                const archerB = rankedArchers[seedB - 1];

                return (
                  <div key={matchIdx} className="border-2 border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 text-[9px] font-black uppercase text-slate-700">
                      <span>Match #{matchIdx + 1}</span>
                      <span className="text-arcus-red">Seed {seedA} vs Seed {seedB}</span>
                    </div>

                    {/* Slot A */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded bg-slate-900 text-white text-center text-[10px] font-black leading-6 shrink-0">
                          {seedA}
                        </span>
                        <div className="min-w-0">
                          <p className="font-black font-oswald text-xs uppercase italic truncate text-slate-900">
                            {archerA ? archerA.name : 'TBA'}
                          </p>
                          <p className="text-[8px] font-bold text-slate-700 uppercase truncate">
                            {archerA ? archerA.club || '-' : '-'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-oswald text-slate-900 shrink-0">
                        {archerA ? `Skor: ${archerA.total}` : '-'}
                      </span>
                    </div>

                    {/* Slot B */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded bg-slate-700 text-white text-center text-[10px] font-black leading-6 shrink-0">
                          {seedB}
                        </span>
                        <div className="min-w-0">
                          <p className="font-black font-oswald text-xs uppercase italic truncate text-slate-900">
                            {archerB ? archerB.name : 'BYE / KOSONG'}
                          </p>
                          <p className="text-[8px] font-bold text-slate-700 uppercase truncate">
                            {archerB ? archerB.club || '-' : '-'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-oswald text-slate-900 shrink-0">
                        {archerB ? `Skor: ${archerB.total}` : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Specific Elimination Round (64, 32, 16, 8, 4, 1, 2) */}
        {['64', '32', '16', '8', '4', '1', '2'].includes(selectedRoundType) && (
          <div className="space-y-4">
            {matchesInCategory.filter(m => m.round === selectedRoundType).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-600 text-xs">
                Belum ada data bagan eliminasi untuk babak ini. Silakan buat atau input skor di panel Eliminasi.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-12 rounded-l-lg">Match</th>
                    <th className="py-2.5 px-3">Archer A (Seed / Klub)</th>
                    <th className="py-2.5 px-3 text-center w-16">Skor A</th>
                    <th className="py-2.5 px-3 text-center w-16">Skor B</th>
                    <th className="py-2.5 px-3">Archer B (Seed / Klub)</th>
                    <th className="py-2.5 px-3 rounded-r-lg">Pemenang &amp; Catatan Tie-Break</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {matchesInCategory
                    .filter(m => m.round === selectedRoundType)
                    .sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0))
                    .map((m) => {
                      const archerA = getArcherById(m.archerAId);
                      const archerB = getArcherById(m.archerBId);
                      const winner = getArcherById(m.winnerId);
                      const isWinA = m.winnerId && m.winnerId === m.archerAId;
                      const isWinB = m.winnerId && m.winnerId === m.archerBId;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 text-center font-black font-oswald text-slate-700">
                            #{m.matchNo}
                          </td>
                          <td className="py-3 px-3">
                            <p className={`font-black font-oswald text-xs sm:text-sm uppercase italic ${isWinA ? 'text-purple-700 font-black' : 'text-slate-900'}`}>
                              {archerA?.name || 'TBA'}
                            </p>
                            <p className="text-[8px] font-bold text-slate-700 uppercase">
                              {archerA?.targetNo ? `TGT ${archerA.targetNo}${archerA.position || ''} • ` : ''}{archerA?.club || '-'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-black font-oswald ${
                              isWinA ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {m.scoreA}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-black font-oswald ${
                              isWinB ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {m.scoreB}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <p className={`font-black font-oswald text-xs sm:text-sm uppercase italic ${isWinB ? 'text-purple-700 font-black' : 'text-slate-900'}`}>
                              {archerB?.name || 'TBA'}
                            </p>
                            <p className="text-[8px] font-bold text-slate-700 uppercase">
                              {archerB?.targetNo ? `TGT ${archerB.targetNo}${archerB.position || ''} • ` : ''}{archerB?.club || '-'}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            {winner ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px] uppercase">
                                  <Check className="w-3 h-3" /> {winner.name}
                                </span>
                                {m.tieBreakWinnerReason && (
                                  <p className="text-[8px] font-bold text-purple-700 mt-0.5 italic">
                                    {m.tieBreakWinnerReason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600 italic">Belum Selesai</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 4. Full Elimination Tree / Bracket */}
        {selectedRoundType === 'BRACKET_ALL' && (
          <div className="space-y-6">
            <div className="space-y-6">
              {availableRounds.map(roundNum => {
                const roundMatches = matchesInCategory.filter(m => m.round === roundNum).sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0));
                return (
                  <div key={roundNum} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-900 text-white px-4 py-2 text-[10px] font-black uppercase tracking-wider flex items-center justify-between">
                      <span>{getRoundLabel(roundNum)}</span>
                      <span>{roundMatches.length} Matches</span>
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {roundMatches.map(m => {
                        const archerA = getArcherById(m.archerAId);
                        const archerB = getArcherById(m.archerBId);
                        const winner = getArcherById(m.winnerId);
                        return (
                          <div key={m.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <div className="flex justify-between text-[8px] font-bold text-slate-700 mb-1">
                              <span>Match #{m.matchNo}</span>
                              <span className="text-purple-700 font-black">{winner ? `Menang: ${winner.name}` : 'TBA'}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                              <span className={`truncate font-bold ${m.winnerId === m.archerAId ? 'text-purple-700 font-black' : 'text-slate-800'}`}>
                                {archerA?.name || 'TBA'}
                              </span>
                              <span className="font-oswald font-black ml-2">{m.scoreA}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                              <span className={`truncate font-bold ${m.winnerId === m.archerBId ? 'text-purple-700 font-black' : 'text-slate-800'}`}>
                                {archerB?.name || 'TBA'}
                              </span>
                              <span className="font-oswald font-black ml-2">{m.scoreB}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Final Standings & Medallists (Podium) */}
        {selectedRoundType === 'FINAL_STANDINGS' && (
          <div className="space-y-8">
            {/* Podium Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              {/* Silver (2nd) */}
              <div className="border-2 border-slate-300 rounded-3xl p-6 bg-slate-50 flex flex-col items-center justify-between order-2 sm:order-1">
                <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 mb-3">
                  <Medal className="w-8 h-8" />
                </div>
                <div>
                  <span className="px-3 py-1 bg-slate-700 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    JUARA 2 / PERAK (SILVER)
                  </span>
                  <h3 className="text-lg font-black font-oswald uppercase italic text-slate-900 mt-2">
                    {winners.juara2?.name || 'TBA'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-700 uppercase">
                    {winners.juara2?.club || '-'}
                  </p>
                </div>
              </div>

              {/* Gold (1st) */}
              <div className="border-4 border-amber-400 rounded-3xl p-6 bg-amber-50/50 flex flex-col items-center justify-between order-1 sm:order-2 shadow-lg scale-105">
                <div className="w-16 h-16 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center mb-3 shadow-md">
                  <Trophy className="w-9 h-9" />
                </div>
                <div>
                  <span className="px-4 py-1 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black uppercase tracking-wider">
                    JUARA 1 / EMAS (GOLD)
                  </span>
                  <h3 className="text-xl font-black font-oswald uppercase italic text-slate-950 mt-2">
                    {winners.juara1?.name || 'TBA'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-700 uppercase">
                    {winners.juara1?.club || '-'}
                  </p>
                </div>
              </div>

              {/* Bronze (3rd) */}
              <div className="border-2 border-orange-300 rounded-3xl p-6 bg-orange-50/50 flex flex-col items-center justify-between order-3">
                <div className="w-14 h-14 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center mb-3">
                  <Medal className="w-8 h-8" />
                </div>
                <div>
                  <span className="px-3 py-1 bg-orange-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    JUARA 3 / PERUNGGU (BRONZE)
                  </span>
                  <h3 className="text-lg font-black font-oswald uppercase italic text-slate-900 mt-2">
                    {winners.juara3?.name || 'TBA'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-700 uppercase">
                    {winners.juara3?.club || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Standings Table */}
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-center w-16 rounded-l-lg">Peringkat</th>
                  <th className="py-2.5 px-3">Medali / Penghargaan</th>
                  <th className="py-2.5 px-4">Nama Archer</th>
                  <th className="py-2.5 px-4">Klub / Kontingen</th>
                  <th className="py-2.5 px-4 text-right rounded-r-lg">Kategori</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-amber-50/70 font-black">
                  <td className="py-2.5 px-3 text-center font-oswald text-base text-amber-900">1</td>
                  <td className="py-2.5 px-3 text-amber-800">Medali Emas (Gold Medalist)</td>
                  <td className="py-2.5 px-4 font-oswald text-sm text-slate-950">{winners.juara1?.name || 'TBA'}</td>
                  <td className="py-2.5 px-4 text-slate-700 uppercase">{winners.juara1?.club || '-'}</td>
                  <td className="py-2.5 px-4 text-right text-slate-700">{CATEGORY_LABELS[selectedCategory]}</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="py-2.5 px-3 text-center font-oswald text-base text-slate-900">2</td>
                  <td className="py-2.5 px-3 text-slate-700">Medali Perak (Silver Medalist)</td>
                  <td className="py-2.5 px-4 font-oswald text-sm text-slate-950 font-black">{winners.juara2?.name || 'TBA'}</td>
                  <td className="py-2.5 px-4 text-slate-700 uppercase">{winners.juara2?.club || '-'}</td>
                  <td className="py-2.5 px-4 text-right text-slate-700">{CATEGORY_LABELS[selectedCategory]}</td>
                </tr>
                <tr className="bg-orange-50/50 font-bold">
                  <td className="py-2.5 px-3 text-center font-oswald text-base text-orange-900">3</td>
                  <td className="py-2.5 px-3 text-orange-800">Medali Perunggu (Bronze Medalist)</td>
                  <td className="py-2.5 px-4 font-oswald text-sm text-slate-950 font-black">{winners.juara3?.name || 'TBA'}</td>
                  <td className="py-2.5 px-4 text-slate-700 uppercase">{winners.juara3?.club || '-'}</td>
                  <td className="py-2.5 px-4 text-right text-slate-700">{CATEGORY_LABELS[selectedCategory]}</td>
                </tr>
                {winners.juara4 && (
                  <tr className="bg-white">
                    <td className="py-2.5 px-3 text-center font-oswald text-base text-slate-700">4</td>
                    <td className="py-2.5 px-3 text-slate-600">Peringkat 4 (Semi-Finalist)</td>
                    <td className="py-2.5 px-4 font-oswald text-sm text-slate-900 font-black">{winners.juara4.name}</td>
                    <td className="py-2.5 px-4 text-slate-700 uppercase">{winners.juara4.club || '-'}</td>
                    <td className="py-2.5 px-4 text-right text-slate-700">{CATEGORY_LABELS[selectedCategory]}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Signatures & Verification Stamp */}
        <div className="mt-12 pt-8 border-t-2 border-slate-900 text-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 text-center sm:text-left">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-700 tracking-widest">Tempat &amp; Tanggal Pengesahan</p>
              <p className="font-bold text-slate-900">
                {event.settings.location || 'Indonesia'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-[8px] text-slate-600 italic">
                Dicetak via ARCUS Smart Archery Tournament OS • Waktu: {new Date().toLocaleTimeString('id-ID')}
              </p>
            </div>

            <div className="flex items-center gap-12 text-center">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-700 tracking-widest mb-14">
                  Ketua Wasit / Chief Judge (CJ)
                </p>
                <div className="border-t border-slate-400 w-36 mx-auto pt-1">
                  <p className="font-black uppercase text-[10px] text-slate-900">( ....................................... )</p>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase text-slate-700 tracking-widest mb-14">
                  Technical Delegate (TD)
                </p>
                <div className="border-t border-slate-400 w-36 mx-auto pt-1">
                  <p className="font-black uppercase text-[10px] text-slate-900">( ....................................... )</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
