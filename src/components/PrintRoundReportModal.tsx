import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, Download, Copy, Check, X, Trophy, Medal, 
  Target, Award, Calendar, MapPin, Users, ChevronRight,
  FileSpreadsheet, ShieldCheck, Sparkles, Filter, Swords,
  Search, CheckCircle2, UserCheck, AlertCircle, RefreshCw
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
  initialRound = 'QUAL_QUALIFIED' // Default directly to qualification cutoff & advancing archers
}: Props) {
  if (isOpen === false) return null;
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(initialCategory);
  const [selectedRoundType, setSelectedRoundType] = useState<string>(initialRound);
  const [qualifiedCutoff, setQualifiedCutoff] = useState<number>(32); // Default top 32
  const [onlyQualifiedFilter, setOnlyQualifiedFilter] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hasCopiedText, setHasCopiedText] = useState(false);
  const [isPrintingNow, setIsPrintingNow] = useState(false);

  // Sync state if initial props change
  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (initialRound) setSelectedRoundType(initialRound);
  }, [initialRound]);

  // Handle printing-active body class for perfect print isolation
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('printing-active');
      setIsPrintingNow(true);
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-active');
      setIsPrintingNow(false);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-active');
    };
  }, []);

  const config = useMemo(() => {
    return (event.settings?.categoryConfigs || {})[selectedCategory];
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
    if (isSmallTarget) return { highest: '2s (Hit)', second: '1s (Point)' };
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
      return { 
        ...item, 
        tieLabel, 
        displayRank, 
        seed: idx + 1,
        isQualified: idx < qualifiedCutoff
      };
    });
  }, [archersInCategory, event.scores, isSmallTarget, isSixRing, isFiveRing, qualifiedCutoff]);

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
        return 'Laporan Master Hasil Kualifikasi Lengkap (Seluruh Archer)';
      case 'QUAL_QUALIFIED':
        return `Data Peserta Masuk ke Babak Selanjutnya dalam Penyaringan (Top ${qualifiedCutoff} Besar & Bagan Aduan)`;
      case '64':
        return 'Laporan Pertandingan Babak 1/32 Final (64 Besar)';
      case '32':
        return 'Laporan Pertandingan Babak 1/16 Final (32 Besar)';
      case '16':
        return 'Laporan Pertandingan Babak 1/8 Final (16 Besar)';
      case '8':
        return 'Laporan Pertandingan Babak Perempat Final / Quarter Final (8 Besar)';
      case '4':
        return 'Laporan Pertandingan Babak Semi Final (4 Besar)';
      case '1':
        return 'Laporan Pertandingan Babak Perebutan Juara 3 (Bronze Medal Match)';
      case '2':
        return 'Laporan Pertandingan Babak FINAL (Gold Medal Match)';
      case 'BRACKET_ALL':
        return 'Rekapitulasi Seluruh Pertandingan Bagan Eliminasi (Master Tree)';
      case 'FINAL_STANDINGS':
        return 'Hasil Akhir Turnamen & Daftar Medalis (Podium Juara)';
      default:
        return `Laporan Pertandingan Babak ${roundKey}`;
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

  // Match Pairings calculation for Qualification Cutoff
  const matchPairings = useMemo(() => {
    const numMatches = Math.floor(qualifiedCutoff / 2);
    const pairs: Array<{
      matchNo: number;
      seedA: number;
      archerA: any;
      seedB: number;
      archerB: any;
      status: string;
      targetAlloc?: string;
    }> = [];

    for (let i = 0; i < numMatches; i++) {
      const seedA = i + 1;
      const seedB = qualifiedCutoff - i;
      const archerA = rankedArchers[seedA - 1];
      const archerB = rankedArchers[seedB - 1];

      let status = 'Pertandingan Langsung';
      if (!archerA && !archerB) status = 'Kosong';
      else if (!archerB) status = `Seed ${seedA} Lolos Otomatis (BYE)`;
      else if (!archerA) status = `Seed ${seedB} Lolos Otomatis (BYE)`;

      pairs.push({
        matchNo: i + 1,
        seedA,
        archerA,
        seedB,
        archerB,
        status,
        targetAlloc: `TGT ${Math.floor(i / 2) + 1}${i % 2 === 0 ? 'A/B' : 'C/D'}`
      });
    }
    return pairs;
  }, [rankedArchers, qualifiedCutoff]);

  // Filtered archers list for table display
  const displayedArchers = useMemo(() => {
    let list = rankedArchers;
    if (selectedRoundType === 'QUAL_QUALIFIED' && onlyQualifiedFilter) {
      list = list.filter(a => a.isQualified);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(a => 
        (a.name || '').toLowerCase().includes(q) ||
        (a.club || '').toLowerCase().includes(q) ||
        (a.targetNo || '').toString().includes(q)
      );
    }
    return list;
  }, [rankedArchers, selectedRoundType, onlyQualifiedFilter, searchTerm]);

  // Print Action
  const handlePrint = () => {
    document.body.classList.add('printing-active');
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Export CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const tournamentName = event.settings?.tournamentName || 'Tournament';
    const categoryName = CATEGORY_LABELS[selectedCategory] || selectedCategory;

    if (selectedRoundType === 'QUAL') {
      headers = ['Rank', 'Seed', 'Bantalan', 'Nama Atlet', 'Klub / Kontingen', 'Kategori', tieBreakLabels.highest, tieBreakLabels.second, 'Total Skor', 'Status Penyaringan'];
      rows = rankedArchers.map(a => [
        `"${a.displayRank}${a.tieLabel}"`,
        a.seed,
        `"${a.targetNo || '-'}${a.position || ''}"`,
        `"${a.name}"`,
        `"${a.club || '-'}"`,
        `"${categoryName}"`,
        a.sixes,
        a.fives,
        a.total,
        a.isQualified ? `LOLOS TOP ${qualifiedCutoff}` : 'TERELIMINASI'
      ]);
    } else if (selectedRoundType === 'QUAL_QUALIFIED') {
      headers = ['Seed Eliminasi', 'Rank Kualifikasi', 'Bantalan Kualifikasi', 'Nama Atlet', 'Klub / Kontingen', 'Kategori', tieBreakLabels.highest, tieBreakLabels.second, 'Total Skor Kualifikasi', 'Status Kelulusan', 'Lawan Match Pertama Babak Eliminasi'];
      rows = rankedArchers.map((a, idx) => {
        const seedNum = idx + 1;
        const opponentSeed = qualifiedCutoff - idx;
        const opponent = rankedArchers[opponentSeed - 1];
        const isQual = seedNum <= qualifiedCutoff;
        return [
          isQual ? `Seed ${seedNum}` : '-',
          `"${a.displayRank}${a.tieLabel}"`,
          `"${a.targetNo || '-'}${a.position || ''}"`,
          `"${a.name}"`,
          `"${a.club || '-'}"`,
          `"${categoryName}"`,
          a.sixes,
          a.fives,
          a.total,
          isQual ? `LOLOS KE BABAK ELIMINASI (TOP ${qualifiedCutoff})` : 'TERELIMINASI (TIDAK LOLOS CUTOFF)',
          isQual ? `"${opponent ? `Seed ${opponentSeed}: ${opponent.name} (${opponent.club || '-'})` : `Seed ${opponentSeed} (BYE)`}"` : '-'
        ];
      });
    } else if (['64', '32', '16', '8', '4', '2', '1'].includes(selectedRoundType)) {
      const roundMatches = matchesInCategory.filter(m => m.round === selectedRoundType).sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0));
      headers = ['Match #', 'Bantalan A', 'Nama Atlet A', 'Klub A', 'Skor A', 'Skor B', 'Nama Atlet B', 'Klub B', 'Bantalan B', 'Pemenang', 'Keterangan Tie Break'];
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
      headers = ['Posisi', 'Medali / Penghargaan', 'Nama Atlet', 'Klub / Kontingen', 'Kategori'];
      rows = [
        ['Juara 1', 'Medali Emas (Gold Medal)', `"${winners.juara1?.name || 'TBA'}"`, `"${winners.juara1?.club || '-'}"`, `"${categoryName}"`],
        ['Juara 2', 'Medali Perak (Silver Medal)', `"${winners.juara2?.name || 'TBA'}"`, `"${winners.juara2?.club || '-'}"`, `"${categoryName}"`],
        ['Juara 3', 'Medali Perunggu (Bronze Medal)', `"${winners.juara3?.name || 'TBA'}"`, `"${winners.juara3?.club || '-'}"`, `"${categoryName}"`],
        ['Juara 4', 'Peringkat 4 (Semi-Finalist)', `"${winners.juara4?.name || 'TBA'}"`, `"${winners.juara4?.club || '-'}"`, `"${categoryName}"`],
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
    link.setAttribute('download', `MasterData_${tournamentName.replace(/\s+/g, '_')}_${selectedCategory}_${selectedRoundType}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("File CSV Master Data Berhasil Diunduh");
  };

  // Copy WhatsApp Summary
  const handleCopySummary = () => {
    const tournamentName = event.settings?.tournamentName || 'Turnamen Panahan';
    const categoryName = CATEGORY_LABELS[selectedCategory] || selectedCategory;
    const dateStr = event.settings?.eventDate || new Date().toLocaleDateString('id-ID');

    let text = `🏹 *DOKUMEN RESMI HASIL PENYARINGAN & SKOR*\n`;
    text += `🏆 *${tournamentName.toUpperCase()}*\n`;
    text += `📂 Kategori: *${categoryName}*\n`;
    text += `📅 Tanggal: ${dateStr}\n`;
    text += `📍 Laporan: *${getRoundLabel(selectedRoundType)}*\n`;
    text += `------------------------------------\n\n`;

    if (selectedRoundType === 'QUAL_QUALIFIED') {
      text += `🎯 *DAFTAR ATLET MASUK KE BABAK ELIMINASI (TOP ${qualifiedCutoff}):*\n\n`;
      rankedArchers.slice(0, qualifiedCutoff).forEach((a, i) => {
        const opponentSeed = qualifiedCutoff - i;
        const opponent = rankedArchers[opponentSeed - 1];
        text += `${i + 1}. *Seed ${i + 1}: ${a.name}* (${a.club || '-'})\n`;
        text += `   ➔ Skor Kualifikasi: *${a.total}* | Rank: ${a.displayRank}${a.tieLabel} | TGT: ${a.targetNo || '-'}${a.position || ''}\n`;
        text += `   ➔ Lawan Match 1: Seed ${opponentSeed} [${opponent ? opponent.name : 'BYE'}]\n\n`;
      });
      text += `_Total Peserta Lolos Penyaringan: ${Math.min(rankedArchers.length, qualifiedCutoff)} atlet_\n`;
    } else if (selectedRoundType === 'QUAL') {
      text += `🏆 *PERINGKAT KUALIFIKASI LENGKAP:*\n\n`;
      rankedArchers.forEach((a, i) => {
        text += `${i + 1}. *${a.name}* (${a.club || '-'}) - Skor: *${a.total}* (${tieBreakLabels.highest}: ${a.sixes}) [${a.isQualified ? `Lolos Top ${qualifiedCutoff}` : 'Gugur'}]\n`;
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

    text += `\n_Dicetak resmi via ARCUS Archery Tournament System_\n`;
    navigator.clipboard.writeText(text);
    setHasCopiedText(true);
    toast.success("Ringkasan hasil berhasil disalin ke clipboard!");
    setTimeout(() => setHasCopiedText(false), 3000);
  };

  // Printable Sheet Component
  const renderPrintableDocument = () => {
    const tournamentName = event.settings?.tournamentName || 'TURNAMEN PANAHAN RESMI';
    const categoryLabel = CATEGORY_LABELS[selectedCategory] || selectedCategory;
    const dateFormatted = event.settings?.eventDate 
      ? new Date(event.settings.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
      <div 
        id="printable-report-sheet"
        className="w-full bg-white text-slate-900 font-sans p-6 sm:p-8"
        style={{ colorScheme: 'light' }}
      >
        {/* Document Official Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <ArcusLogo className="w-12 h-12 shrink-0" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-red-600 block">
                  DOKUMEN RESMI TURNAMEN &amp; REKAPITULASI DATA MASTER
                </span>
                <h1 className="text-xl sm:text-2xl font-black font-oswald uppercase italic tracking-tight text-slate-900 leading-tight">
                  {tournamentName}
                </h1>
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-700 mt-0.5 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> {event.settings?.location || 'Indonesia'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /> {dateFormatted}</span>
                </div>
              </div>
            </div>

            <div className="text-right border border-slate-900 px-3 py-2 rounded-xl bg-slate-50 text-center shrink-0 min-w-[140px]">
              <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Kategori Lomba</p>
              <p className="text-sm font-black font-oswald uppercase text-slate-900 leading-tight">
                {categoryLabel}
              </p>
              <p className="text-[8px] font-bold text-red-600 uppercase mt-0.5">
                Jarak: {config?.distance || 'Standard'} • Target: {config?.targetType || 'Standard'}
              </p>
            </div>
          </div>

          {/* Sub Header Title Bar */}
          <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-600 rounded-full" />
              <h2 className="text-sm sm:text-base font-black font-oswald uppercase italic text-slate-900 tracking-wide">
                {getRoundLabel(selectedRoundType)}
              </h2>
            </div>
            <div className="text-[9px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-3">
              <span>Total Terdaftar: <strong className="text-slate-950">{archersInCategory.length}</strong></span>
              <span>•</span>
              <span>Lolos Eliminasi: <strong className="text-emerald-700">Top {qualifiedCutoff}</strong></span>
              <span>•</span>
              <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[8px] font-black">OFFICIAL VERIFIED</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: DATA MASTER PESERTA MASUK KE BABAK SELANJUTNYA (PENYARINGAN / QUAL_QUALIFIED) */}
        {selectedRoundType === 'QUAL_QUALIFIED' && (
          <div className="space-y-6">
            
            {/* Table 1: Master Data Archers Advancing to Elimination */}
            <div>
              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-t-lg flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  TABEL 1: DATA MASTER ATLET LOLOS KE BABAK ELIMINASI (TOP {qualifiedCutoff} BESAR)
                </span>
                <span>TOTAL LOLOS: {Math.min(rankedArchers.length, qualifiedCutoff)} ATLET</span>
              </div>

              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 text-[9px] font-black uppercase tracking-wider border-b border-slate-300">
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Seed</th>
                    <th className="py-2 px-2 text-center w-12 border-r border-slate-300">Rank</th>
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Bantalan</th>
                    <th className="py-2 px-3 border-r border-slate-300">Nama Lengkap Atlet</th>
                    <th className="py-2 px-3 border-r border-slate-300">Klub / Kontingen</th>
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">{tieBreakLabels.highest}</th>
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">{tieBreakLabels.second}</th>
                    <th className="py-2 px-3 text-right w-20 border-r border-slate-300">Skor Kual.</th>
                    <th className="py-2 px-3 text-center border-r border-slate-300">Status Penyaringan</th>
                    <th className="py-2 px-3">Lawan Putaran 1 Eliminasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rankedArchers.slice(0, qualifiedCutoff).map((archer, index) => {
                    const seedNum = index + 1;
                    const opponentSeed = qualifiedCutoff - index;
                    const opponent = rankedArchers[opponentSeed - 1];

                    return (
                      <tr key={archer.id} className={index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="py-1.5 px-2 text-center font-black font-oswald text-xs border-r border-slate-200">
                          <span className="inline-block px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-black">
                            #{seedNum}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-slate-800 text-xs border-r border-slate-200">
                          {archer.displayRank}{archer.tieLabel}
                        </td>
                        <td className="py-1.5 px-2 text-center font-black font-oswald text-slate-900 text-xs border-r border-slate-200">
                          {archer.targetNo || '-'}{archer.position || ''}
                        </td>
                        <td className="py-1.5 px-3 font-black text-slate-900 uppercase font-oswald text-xs border-r border-slate-200">
                          {archer.name}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-slate-700 uppercase text-[10px] border-r border-slate-200">
                          {archer.club || '-'}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-slate-800 text-xs border-r border-slate-200">
                          {archer.sixes}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-slate-800 text-xs border-r border-slate-200">
                          {archer.fives}
                        </td>
                        <td className="py-1.5 px-3 text-right font-black font-oswald text-sm text-slate-950 border-r border-slate-200">
                          {archer.total}
                        </td>
                        <td className="py-1.5 px-3 text-center border-r border-slate-200">
                          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-black text-[9px] uppercase tracking-wide">
                            LOLOS ELIMINASI
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-xs font-bold text-slate-800">
                          {opponent ? (
                            <span>vs <strong>Seed {opponentSeed}</strong>: {opponent.name} ({opponent.club || '-'})</span>
                          ) : (
                            <span className="text-emerald-700 font-black italic">BYE (Lolos Otomatis)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table 2: Elimination Match Pairings Matrix */}
            <div>
              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-t-lg flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  TABEL 2: BAGAN PASANGAN PERTANDINGAN BABAK PERTAMA ELIMINASI (ROUND OF {qualifiedCutoff})
                </span>
                <span>{matchPairings.length} PERTANDINGAN</span>
              </div>

              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 text-[9px] font-black uppercase tracking-wider border-b border-slate-300">
                    <th className="py-2 px-2 text-center w-12 border-r border-slate-300">Match</th>
                    <th className="py-2 px-3 border-r border-slate-300">Posisi A (Unggulan Atas)</th>
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Skor A</th>
                    <th className="py-2 px-2 text-center w-10 border-r border-slate-300">VS</th>
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Skor B</th>
                    <th className="py-2 px-3 border-r border-slate-300">Posisi B (Unggulan Bawah)</th>
                    <th className="py-2 px-3 text-center border-r border-slate-300 w-24">Bantalan</th>
                    <th className="py-2 px-3">Status Pertandingan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {matchPairings.map((pair) => {
                    const archerA = pair.archerA;
                    const archerB = pair.archerB;

                    return (
                      <tr key={pair.matchNo} className={pair.matchNo % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="py-1.5 px-2 text-center font-black font-oswald text-slate-900 text-xs border-r border-slate-200">
                          #{pair.matchNo}
                        </td>
                        
                        {/* Archer A */}
                        <td className="py-1.5 px-3 border-r border-slate-200">
                          <p className="font-black font-oswald text-xs uppercase text-slate-900">
                            Seed {pair.seedA}: {archerA ? archerA.name : 'TBA'}
                          </p>
                          <p className="text-[9px] font-bold text-slate-600 uppercase">
                            {archerA ? `${archerA.club || '-'} • Bantalan ${archerA.targetNo || '-'}${archerA.position || ''}` : '-'}
                          </p>
                        </td>
                        <td className="py-1.5 px-2 text-center font-black font-oswald text-slate-900 text-xs border-r border-slate-200 bg-slate-100/60">
                          {archerA ? archerA.total : '-'}
                        </td>

                        {/* VS Divider */}
                        <td className="py-1.5 px-2 text-center font-black font-oswald text-slate-500 text-[10px] border-r border-slate-200">
                          VS
                        </td>

                        {/* Archer B */}
                        <td className="py-1.5 px-2 text-center font-black font-oswald text-slate-900 text-xs border-r border-slate-200 bg-slate-100/60">
                          {archerB ? archerB.total : '-'}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200">
                          <p className="font-black font-oswald text-xs uppercase text-slate-900">
                            Seed {pair.seedB}: {archerB ? archerB.name : 'BYE (KOSONG)'}
                          </p>
                          <p className="text-[9px] font-bold text-slate-600 uppercase">
                            {archerB ? `${archerB.club || '-'} • Bantalan ${archerB.targetNo || '-'}${archerB.position || ''}` : 'Lolos Otomatis'}
                          </p>
                        </td>

                        {/* Target Allocation */}
                        <td className="py-1.5 px-3 text-center font-black font-oswald text-slate-900 text-xs border-r border-slate-200">
                          {pair.targetAlloc || '-'}
                        </td>

                        {/* Status */}
                        <td className="py-1.5 px-3 text-xs font-bold text-slate-800">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            !archerB ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-900'
                          }`}>
                            {pair.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table 3: Non-Qualified Archers (If not filtered out) */}
            {rankedArchers.length > qualifiedCutoff && (
              <div>
                <div className="bg-slate-700 text-white px-3 py-1.5 rounded-t-lg flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                  <span>TABEL 3: DAFTAR ATLET TIDAK LOLOS CUTOFF PENYARINGAN (PERINGKAT {qualifiedCutoff + 1} S/D {rankedArchers.length})</span>
                  <span>TOTAL GUGUR: {rankedArchers.length - qualifiedCutoff} ATLET</span>
                </div>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-wider border-b border-slate-300">
                      <th className="py-1.5 px-2 text-center w-12 border-r border-slate-300">Rank</th>
                      <th className="py-1.5 px-2 text-center w-14 border-r border-slate-300">Bantalan</th>
                      <th className="py-1.5 px-3 border-r border-slate-300">Nama Lengkap Atlet</th>
                      <th className="py-1.5 px-3 border-r border-slate-300">Klub / Kontingen</th>
                      <th className="py-1.5 px-2 text-center w-14 border-r border-slate-300">{tieBreakLabels.highest}</th>
                      <th className="py-1.5 px-2 text-center w-14 border-r border-slate-300">{tieBreakLabels.second}</th>
                      <th className="py-1.5 px-3 text-right w-20 border-r border-slate-300">Total Skor</th>
                      <th className="py-1.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rankedArchers.slice(qualifiedCutoff).map((archer, index) => (
                      <tr key={archer.id} className={index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="py-1 px-2 text-center font-bold text-slate-600 text-xs border-r border-slate-200">
                          {archer.displayRank}{archer.tieLabel}
                        </td>
                        <td className="py-1 px-2 text-center font-bold text-slate-600 text-xs border-r border-slate-200">
                          {archer.targetNo || '-'}{archer.position || ''}
                        </td>
                        <td className="py-1 px-3 font-bold text-slate-800 uppercase text-xs border-r border-slate-200">
                          {archer.name}
                        </td>
                        <td className="py-1 px-3 font-medium text-slate-600 uppercase text-[10px] border-r border-slate-200">
                          {archer.club || '-'}
                        </td>
                        <td className="py-1 px-2 text-center font-medium text-slate-600 text-xs border-r border-slate-200">
                          {archer.sixes}
                        </td>
                        <td className="py-1 px-2 text-center font-medium text-slate-600 text-xs border-r border-slate-200">
                          {archer.fives}
                        </td>
                        <td className="py-1 px-3 text-right font-bold text-slate-700 text-xs border-r border-slate-200">
                          {archer.total}
                        </td>
                        <td className="py-1 px-3 text-center text-[9px] font-bold text-slate-500 uppercase">
                          Tereliminasi di Babak Kualifikasi
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* SECTION 2: FULL QUALIFICATION LEADERBOARD (QUAL) */}
        {selectedRoundType === 'QUAL' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white px-3 py-1.5 rounded-t-lg flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
              <span>LEADERBOARD RESMI KUALIFIKASI LENGKAP</span>
              <span>TOTAL: {rankedArchers.length} ATLET</span>
            </div>

            <table className="w-full text-left text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 text-[9px] font-black uppercase tracking-wider border-b border-slate-300">
                  <th className="py-2 px-2 text-center w-12 border-r border-slate-300">Rank</th>
                  <th className="py-2 px-2 text-center w-12 border-r border-slate-300">Seed</th>
                  <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Bantalan</th>
                  <th className="py-2 px-3 border-r border-slate-300">Nama Lengkap Atlet</th>
                  <th className="py-2 px-3 border-r border-slate-300">Klub / Kontingen</th>
                  <th className="py-2 px-2 text-center w-14 border-r border-slate-300">{tieBreakLabels.highest}</th>
                  <th className="py-2 px-2 text-center w-14 border-r border-slate-300">{tieBreakLabels.second}</th>
                  <th className="py-2 px-3 text-right w-20 border-r border-slate-300">Total Skor</th>
                  <th className="py-2 px-3 text-center">Status Penyaringan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rankedArchers.map((archer, index) => (
                  <tr key={archer.id} className={index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="py-1.5 px-2 text-center font-black font-oswald text-xs border-r border-slate-200">
                      {archer.displayRank}{archer.tieLabel}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold text-slate-700 text-xs border-r border-slate-200">
                      #{archer.seed}
                    </td>
                    <td className="py-1.5 px-2 text-center font-black font-oswald text-slate-900 text-xs border-r border-slate-200">
                      {archer.targetNo || '-'}{archer.position || ''}
                    </td>
                    <td className="py-1.5 px-3 font-black text-slate-900 uppercase font-oswald text-xs border-r border-slate-200">
                      {archer.name}
                    </td>
                    <td className="py-1.5 px-3 font-bold text-slate-700 uppercase text-[10px] border-r border-slate-200">
                      {archer.club || '-'}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold text-slate-800 text-xs border-r border-slate-200">
                      {archer.sixes}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold text-slate-800 text-xs border-r border-slate-200">
                      {archer.fives}
                    </td>
                    <td className="py-1.5 px-3 text-right font-black font-oswald text-sm text-slate-950 border-r border-slate-200">
                      {archer.total}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                        archer.isQualified 
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {archer.isQualified ? `Lolos Top ${qualifiedCutoff}` : 'Gugur'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTION 3: SPECIFIC ELIMINATION ROUND */}
        {['64', '32', '16', '8', '4', '2', '1'].includes(selectedRoundType) && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white px-3 py-1.5 rounded-t-lg flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
              <span>{getRoundLabel(selectedRoundType).toUpperCase()}</span>
              <span>{matchesInCategory.filter(m => m.round === selectedRoundType).length} PERTANDINGAN</span>
            </div>

            {matchesInCategory.filter(m => m.round === selectedRoundType).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 text-slate-600 text-xs">
                Belum ada data pertandingan eliminasi untuk babak ini.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 text-[9px] font-black uppercase tracking-wider border-b border-slate-300">
                    <th className="py-2 px-2 text-center w-12 border-r border-slate-300">Match</th>
                    <th className="py-2 px-3 border-r border-slate-300">Archer A (Seed &amp; Klub)</th>
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Skor A</th>
                    <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Skor B</th>
                    <th className="py-2 px-3 border-r border-slate-300">Archer B (Seed &amp; Klub)</th>
                    <th className="py-2 px-3">Pemenang &amp; Catatan Tie-Break</th>
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
                          <td className="py-2 px-2 text-center font-black font-oswald text-slate-800 text-xs border-r border-slate-200">
                            #{m.matchNo}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <p className={`font-black font-oswald text-xs uppercase ${isWinA ? 'text-purple-700' : 'text-slate-900'}`}>
                              {archerA?.name || 'TBA'}
                            </p>
                            <p className="text-[9px] font-bold text-slate-600 uppercase">
                              {archerA?.club || '-'}
                            </p>
                          </td>
                          <td className="py-2 px-2 text-center font-black font-oswald text-sm text-slate-900 border-r border-slate-200 bg-slate-100/60">
                            {m.scoreA}
                          </td>
                          <td className="py-2 px-2 text-center font-black font-oswald text-sm text-slate-900 border-r border-slate-200 bg-slate-100/60">
                            {m.scoreB}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <p className={`font-black font-oswald text-xs uppercase ${isWinB ? 'text-purple-700' : 'text-slate-900'}`}>
                              {archerB?.name || 'TBA'}
                            </p>
                            <p className="text-[9px] font-bold text-slate-600 uppercase">
                              {archerB?.club || '-'}
                            </p>
                          </td>
                          <td className="py-2 px-3">
                            {winner ? (
                              <div>
                                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-black text-[9px] uppercase">
                                  Menang: {winner.name}
                                </span>
                                {m.tieBreakWinnerReason && (
                                  <p className="text-[8px] font-bold text-purple-700 mt-0.5 italic">
                                    {m.tieBreakWinnerReason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Belum Selesai</span>
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

        {/* SECTION 4: FULL BRACKET TREE */}
        {selectedRoundType === 'BRACKET_ALL' && (
          <div className="space-y-6">
            {availableRounds.map(roundNum => {
              const roundMatches = matchesInCategory.filter(m => m.round === roundNum).sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0));
              return (
                <div key={roundNum} className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-900 text-white px-3 py-1 text-[9px] font-black uppercase tracking-wider flex items-center justify-between">
                    <span>{getRoundLabel(roundNum)}</span>
                    <span>{roundMatches.length} Pertandingan</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[8px] font-black uppercase tracking-wider border-b border-slate-200">
                        <th className="py-1 px-2 text-center w-12 border-r border-slate-200">Match</th>
                        <th className="py-1 px-3 border-r border-slate-200">Archer A</th>
                        <th className="py-1 px-2 text-center w-12 border-r border-slate-200">Skor</th>
                        <th className="py-1 px-3 border-r border-slate-200">Archer B</th>
                        <th className="py-1 px-2 text-center w-12 border-r border-slate-200">Skor</th>
                        <th className="py-1 px-3">Pemenang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {roundMatches.map(m => {
                        const archerA = getArcherById(m.archerAId);
                        const archerB = getArcherById(m.archerBId);
                        const winner = getArcherById(m.winnerId);
                        return (
                          <tr key={m.id}>
                            <td className="py-1 px-2 text-center font-bold text-slate-700 border-r border-slate-200">#{m.matchNo}</td>
                            <td className="py-1 px-3 font-bold text-slate-900 border-r border-slate-200">{archerA?.name || 'TBA'}</td>
                            <td className="py-1 px-2 text-center font-bold text-slate-900 border-r border-slate-200">{m.scoreA}</td>
                            <td className="py-1 px-3 font-bold text-slate-900 border-r border-slate-200">{archerB?.name || 'TBA'}</td>
                            <td className="py-1 px-2 text-center font-bold text-slate-900 border-r border-slate-200">{m.scoreB}</td>
                            <td className="py-1 px-3 font-black text-purple-800">{winner ? winner.name : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* SECTION 5: FINAL STANDINGS & MEDALLISTS */}
        {selectedRoundType === 'FINAL_STANDINGS' && (
          <div className="space-y-6">
            <div className="bg-slate-900 text-white px-3 py-1.5 rounded-t-lg flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
              <span>DAFTAR JUARA &amp; MEDALIS RESMI</span>
              <span>PODIUM FINAL</span>
            </div>

            <table className="w-full text-left text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 text-[9px] font-black uppercase tracking-wider border-b border-slate-300">
                  <th className="py-2 px-3 text-center w-16 border-r border-slate-300">Peringkat</th>
                  <th className="py-2 px-3 border-r border-slate-300">Medali / Penghargaan</th>
                  <th className="py-2 px-4 border-r border-slate-300">Nama Archer</th>
                  <th className="py-2 px-4 border-r border-slate-300">Klub / Kontingen</th>
                  <th className="py-2 px-4 text-right">Kategori</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-amber-50 font-black">
                  <td className="py-2 px-3 text-center font-oswald text-base text-amber-900 border-r border-slate-300">1</td>
                  <td className="py-2 px-3 text-amber-900 border-r border-slate-300">MEDALI EMAS (GOLD MEDALIST)</td>
                  <td className="py-2 px-4 font-oswald text-sm text-slate-950 border-r border-slate-300">{winners.juara1?.name || 'TBA'}</td>
                  <td className="py-2 px-4 text-slate-700 uppercase border-r border-slate-300">{winners.juara1?.club || '-'}</td>
                  <td className="py-2 px-4 text-right text-slate-700">{categoryLabel}</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="py-2 px-3 text-center font-oswald text-base text-slate-900 border-r border-slate-300">2</td>
                  <td className="py-2 px-3 text-slate-800 border-r border-slate-300">MEDALI PERAK (SILVER MEDALIST)</td>
                  <td className="py-2 px-4 font-oswald text-sm text-slate-950 font-black border-r border-slate-300">{winners.juara2?.name || 'TBA'}</td>
                  <td className="py-2 px-4 text-slate-700 uppercase border-r border-slate-300">{winners.juara2?.club || '-'}</td>
                  <td className="py-2 px-4 text-right text-slate-700">{categoryLabel}</td>
                </tr>
                <tr className="bg-orange-50 font-bold">
                  <td className="py-2 px-3 text-center font-oswald text-base text-orange-900 border-r border-slate-300">3</td>
                  <td className="py-2 px-3 text-orange-900 border-r border-slate-300">MEDALI PERUNGGU (BRONZE MEDALIST)</td>
                  <td className="py-2 px-4 font-oswald text-sm text-slate-950 font-black border-r border-slate-300">{winners.juara3?.name || 'TBA'}</td>
                  <td className="py-2 px-4 text-slate-700 uppercase border-r border-slate-300">{winners.juara3?.club || '-'}</td>
                  <td className="py-2 px-4 text-right text-slate-700">{categoryLabel}</td>
                </tr>
                {winners.juara4 && (
                  <tr className="bg-white">
                    <td className="py-2 px-3 text-center font-oswald text-base text-slate-700 border-r border-slate-300">4</td>
                    <td className="py-2 px-3 text-slate-600 border-r border-slate-300">PERINGKAT 4 (SEMI-FINALIST)</td>
                    <td className="py-2 px-4 font-oswald text-sm text-slate-900 font-black border-r border-slate-300">{winners.juara4.name}</td>
                    <td className="py-2 px-4 text-slate-700 uppercase border-r border-slate-300">{winners.juara4.club || '-'}</td>
                    <td className="py-2 px-4 text-right text-slate-700">{categoryLabel}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Signatures & Verification Stamp */}
        <div className="mt-8 pt-4 border-t-2 border-slate-900 text-xs">
          <div className="flex items-center justify-between gap-8 text-left">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-700 tracking-widest">Tempat &amp; Tanggal Pengesahan</p>
              <p className="font-bold text-slate-900">
                {event.settings?.location || 'Indonesia'}, {dateFormatted}
              </p>
              <p className="text-[8px] text-slate-500 italic">
                Dicetak resmi via ARCUS Archery Tournament OS • Waktu: {new Date().toLocaleTimeString('id-ID')}
              </p>
            </div>

            <div className="flex items-center gap-12 text-center">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-700 tracking-widest mb-10">
                  Ketua Wasit / Chief Judge (CJ)
                </p>
                <div className="border-t border-slate-400 w-36 mx-auto pt-1">
                  <p className="font-black uppercase text-[9px] text-slate-900">( ....................................... )</p>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase text-slate-700 tracking-widest mb-10">
                  Technical Delegate (TD)
                </p>
                <div className="border-t border-slate-400 w-36 mx-auto pt-1">
                  <p className="font-black uppercase text-[9px] text-slate-900">( ....................................... )</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <>
      {/* 1. Modal Preview Window - For Screen View */}
      <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 print:hidden">
        
        {/* Modal Dialog Window Container */}
        <div className="w-full max-w-6xl h-full max-h-[94vh] bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden">

          {/* Modal Top Control Header - Non-scrollable, Fixed at top */}
          <div className="shrink-0 bg-white border-b border-slate-200 p-4 sm:p-5 shadow-sm space-y-3.5">
            
            {/* Header Row: Title & Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black shadow-md shadow-red-600/30 shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-black font-oswald uppercase italic tracking-tight text-slate-900 leading-none">
                    Pusat Cetak &amp; Laporan Skor Babak
                  </h2>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                    Data Master Penyaringan, Lolos Eliminasi &amp; Rekapitulasi Skor Resmi
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                  title="Salin ringkasan hasil untuk dibagikan ke WhatsApp"
                >
                  {hasCopiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-300" />}
                  <span>{hasCopiedText ? 'Tersalin!' : 'Salin Teks WA'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                  title="Download tabel dalam format Excel (.CSV)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 
                  <span>Export Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-95 whitespace-nowrap"
                  title="Cetak berkas atau simpan sebagai PDF"
                >
                  <Printer className="w-4 h-4" /> 
                  <span>CETAK / SIMPAN PDF</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl transition-all border border-slate-200 ml-1"
                  title="Tutup Jendela Cetak"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
              
              {/* 1. Category Selector */}
              <div>
                <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest block mb-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-red-600" /> 1. Kategori Divisi:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as CategoryType)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
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

              {/* 2. Round / Document Type */}
              <div className="lg:col-span-2">
                <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest block mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3 text-indigo-600" /> 2. Jenis Dokumen / Babak Laporan:
                </label>
                <select
                  value={selectedRoundType}
                  onChange={(e) => setSelectedRoundType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs font-sans"
                >
                  <optgroup label="⭐ Penyaringan &amp; Lolos Eliminasi (Utama)">
                    <option value="QUAL_QUALIFIED">
                      🎯 DATA MASTER: Peserta Masuk Babak Selanjutnya (Top Cutoff &amp; Lawan Eliminasi)
                    </option>
                    <option value="QUAL">
                      📊 DATA MASTER: Hasil Kualifikasi Lengkap (Leaderboard Semua Peserta)
                    </option>
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

              {/* 3. Qualified Cutoff Setting */}
              <div>
                <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest block mb-1 flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-500" /> 3. Kuota Lolos (Cutoff):
                </label>
                <div className="flex items-center gap-1">
                  {[8, 16, 32, 64].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setQualifiedCutoff(num);
                        setSelectedRoundType('QUAL_QUALIFIED');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                        selectedRoundType === 'QUAL_QUALIFIED' && qualifiedCutoff === num
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      Top {num}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Quick Notice */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-[9px] font-medium text-emerald-950 flex items-center justify-between flex-wrap gap-1">
              <span>✅ <strong>Fokus Data Master:</strong> Dokumen cetak bersih khusus data resmi kualifikasi, eliminasi, dan penyaringan. Tanpa tombol dashboard.</span>
              <span className="font-bold text-slate-700">Format: Standard A4 Portrait</span>
            </div>
          </div>

          {/* Modal Body / Paper Sheet Preview (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-200/80 flex justify-center">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {renderPrintableDocument()}
            </div>
          </div>

        </div>
      </div>

      {/* 2. Pure Print Portal in document.body - ONLY rendered for browser print dialog */}
      {typeof document !== 'undefined' && createPortal(
        <div className="print-area-portal">
          {renderPrintableDocument()}
        </div>,
        document.body
      )}
    </>
  );
}
