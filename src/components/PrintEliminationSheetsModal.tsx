import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Printer, Swords, Trophy, Filter, Users, 
  CheckCircle2, AlertCircle, FileText, Download, ShieldCheck,
  Calendar, MapPin, Scissors, Sparkles, Check, RotateCcw
} from 'lucide-react';
import { ArcheryEvent, CategoryType, Match, Archer, TargetType, CategoryConfig } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { resolveGoogleDriveUrl } from '../lib/photoService';
import { findCategoryConfig } from '../lib/firestoreUtils';
import ArcusLogo from './ArcusLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: ArcheryEvent;
  initialCategory?: CategoryType;
  initialMatchId?: string;
}

export const PrintEliminationSheetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  event,
  initialCategory,
  initialMatchId
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'ALL'>(initialCategory || 'ALL');
  const [selectedRound, setSelectedRound] = useState<string>('ALL');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(initialMatchId || 'ALL');
  const [sheetType, setSheetType] = useState<'SCHEDULED' | 'BLANK'>('SCHEDULED');
  const [blankCount, setBlankCount] = useState<number>(4);
  const [layoutMode, setLayoutMode] = useState<'2_PER_PAGE' | '1_PER_PAGE'>('2_PER_PAGE');
  const [scoringSystemOverride, setScoringSystemOverride] = useState<'AUTO' | 'SET_SYSTEM' | 'TOTAL_SCORE'>('AUTO');
  const [numEndsOverride, setNumEndsOverride] = useState<number>(5);
  const [numArrowsOverride, setNumArrowsOverride] = useState<number>(3);

  // Set initial category when modal opens
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (initialMatchId) {
      setSelectedMatchId(initialMatchId);
    }
  }, [initialMatchId]);

  if (!isOpen) return null;

  const tournamentName = event.settings?.tournamentName || 'Turnamen Panahan Arcus';
  const tournamentDate = event.settings?.eventDate || '-';
  const tournamentLocation = event.settings?.location || 'Indonesia';
  const eventLogo = event.settings?.logoUrl ? resolveGoogleDriveUrl(event.settings.logoUrl) : null;
  const secondaryLogo = event.settings?.secondaryLogoUrl ? resolveGoogleDriveUrl(event.settings.secondaryLogoUrl) : null;
  const clubLogo = event.settings?.clubLogoUrl ? resolveGoogleDriveUrl(event.settings.clubLogoUrl) : null;

  // Helper to find category config
  const getCategoryConfig = (cat?: string): CategoryConfig | null => {
    if (!cat) return null;
    return findCategoryConfig(cat, event.settings?.categoryConfigs);
  };

  // Archer helper
  const getArcher = (id?: string): Archer | undefined => {
    if (!id) return undefined;
    return (event.archers || []).find(a => a.id === id);
  };

  // Collect all matches across categories
  const allCategoryKeys = Object.keys(event.matches || {}) as CategoryType[];

  // Active matches based on category filter
  const availableMatches = useMemo(() => {
    const list: (Match & { categoryKey: CategoryType })[] = [];
    allCategoryKeys.forEach(cat => {
      if (selectedCategory !== 'ALL' && cat !== selectedCategory) return;
      const catMatches = event.matches[cat] || [];
      catMatches.forEach(m => {
        list.push({ ...m, categoryKey: cat });
      });
    });
    return list;
  }, [event.matches, selectedCategory, allCategoryKeys]);

  // Available rounds in the selected category
  const availableRounds = useMemo(() => {
    const roundsSet = new Set<string>();
    availableMatches.forEach(m => {
      if (m.round) roundsSet.add(m.round);
    });
    return Array.from(roundsSet).sort((a, b) => parseInt(b) - parseInt(a));
  }, [availableMatches]);

  // Round label generator
  const getRoundLabel = (roundStr: string): string => {
    const r = parseInt(roundStr);
    if (r === 1) return 'PEREBUTAN JUARA 3 (BRONZE)';
    if (r === 2) return 'FINAL (GOLD MEDAL)';
    if (r === 4) return 'SEMI FINAL (4 BESAR)';
    if (r === 8) return 'QUARTER FINAL (8 BESAR)';
    if (r === 16) return '1/8 FINAL (16 BESAR)';
    if (r === 32) return '1/16 FINAL (32 BESAR)';
    if (r === 64) return '1/32 FINAL (64 BESAR)';
    return `BABAK ${roundStr}`;
  };

  // Filtered matches to print
  const matchesToPrint = useMemo(() => {
    if (sheetType === 'BLANK') return [];
    let list = availableMatches;
    if (selectedRound !== 'ALL') {
      list = list.filter(m => m.round === selectedRound);
    }
    if (selectedMatchId !== 'ALL') {
      list = list.filter(m => m.id === selectedMatchId);
    }
    // Sort matches: round descending (earlier rounds first), then matchNo
    return list.sort((a, b) => {
      const rA = parseInt(a.round) || 0;
      const rB = parseInt(b.round) || 0;
      if (rA !== rB) return rB - rA;
      return (a.matchNo || 0) - (b.matchNo || 0);
    });
  }, [availableMatches, selectedRound, selectedMatchId, sheetType]);

  // Group matches for 2-per-page or 1-per-page
  const pagesData = useMemo(() => {
    if (sheetType === 'BLANK') {
      const pages: any[][] = [];
      const perPage = layoutMode === '2_PER_PAGE' ? 2 : 1;
      const totalBlankSheets = blankCount;
      let currentBatch: any[] = [];
      for (let i = 0; i < totalBlankSheets; i++) {
        currentBatch.push({ isBlank: true, blankIndex: i + 1 });
        if (currentBatch.length === perPage) {
          pages.push(currentBatch);
          currentBatch = [];
        }
      }
      if (currentBatch.length > 0) {
        pages.push(currentBatch);
      }
      return pages;
    }

    const perPage = layoutMode === '2_PER_PAGE' ? 2 : 1;
    const pages: (Match & { categoryKey: CategoryType })[][] = [];
    for (let i = 0; i < matchesToPrint.length; i += perPage) {
      pages.push(matchesToPrint.slice(i, i + perPage));
    }
    return pages;
  }, [matchesToPrint, sheetType, blankCount, layoutMode]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex flex-col justify-between overflow-hidden">
      {/* Control Toolbar (Hidden in Print) */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black font-oswald uppercase italic tracking-wide flex items-center gap-2">
              <span>Cetak Lembar Skoring Aduan (Match Play)</span>
              <span className="text-[10px] bg-purple-500/30 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-400/30">
                Fisik Lapangan
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">
              Format resmi lembar skoring eliminasi 1 vs 1 untuk wasit & scorer di lapangan
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Sheet Type Toggle */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setSheetType('SCHEDULED')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                sheetType === 'SCHEDULED' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bagan Terjadwal</span>
            </button>
            <button
              onClick={() => setSheetType('BLANK')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                sheetType === 'BLANK' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Lembar Kosong</span>
            </button>
          </div>

          {/* Category Filter */}
          {sheetType === 'SCHEDULED' && (
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value as any);
                setSelectedRound('ALL');
                setSelectedMatchId('ALL');
              }}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs font-bold outline-none cursor-pointer hover:border-slate-600"
            >
              <option value="ALL">Semua Kategori</option>
              {allCategoryKeys.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
          )}

          {/* Round Filter */}
          {sheetType === 'SCHEDULED' && (
            <select
              value={selectedRound}
              onChange={(e) => {
                setSelectedRound(e.target.value);
                setSelectedMatchId('ALL');
              }}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs font-bold outline-none cursor-pointer hover:border-slate-600"
            >
              <option value="ALL">Semua Babak</option>
              {availableRounds.map(r => (
                <option key={r} value={r}>
                  {getRoundLabel(r)}
                </option>
              ))}
            </select>
          )}

          {/* Layout Mode (2 per page vs 1 per page) */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setLayoutMode('2_PER_PAGE')}
              title="2 Match per Halaman A4 (Hemat Kertas & Pas Papan Jalan)"
              className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 ${
                layoutMode === '2_PER_PAGE' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scissors className="w-3 h-3" />
              <span>2 Match/A4 (Hemat)</span>
            </button>
            <button
              onClick={() => setLayoutMode('1_PER_PAGE')}
              title="1 Match per Halaman A4 (Format Besar)"
              className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 ${
                layoutMode === '1_PER_PAGE' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>1 Match/A4</span>
            </button>
          </div>

          {/* Blank Sheet Count */}
          {sheetType === 'BLANK' && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400">Jumlah Lembar:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={blankCount}
                onChange={(e) => setBlankCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center font-bold text-white text-xs"
              />
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-red-600/30 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak ({pagesData.length} Hal)</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Print / Preview Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 print:bg-white print:p-0">
        <div className="max-w-[210mm] mx-auto space-y-8 print:space-y-0 print:max-w-none">
          {pagesData.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center space-y-4 shadow-md">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="text-lg font-black font-oswald uppercase text-slate-800">
                Tidak Ada Pertandingan Yang Cocok
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Bagan aduan belum dibuat atau tidak ada pertandingan pada filter kategori/babak yang dipilih. Anda dapat membuat bagan terlebih dahulu atau memilih opsi <b>"Lembar Kosong"</b> untuk mencetak lembar cadangan.
              </p>
              <button
                onClick={() => setSheetType('BLANK')}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Cetak Lembar Aduan Kosong
              </button>
            </div>
          ) : (
            pagesData.map((pageMatches, pageIndex) => (
              <div 
                key={pageIndex} 
                className={`bg-white shadow-xl print:shadow-none p-5 sm:p-8 print:p-6 rounded-2xl print:rounded-none min-h-[280mm] print:min-h-0 flex flex-col justify-between ${
                  pageIndex < pagesData.length - 1 ? 'print:break-after-page' : ''
                }`}
                style={{ pageBreakAfter: pageIndex < pagesData.length - 1 ? 'always' : 'auto' }}
              >
                {pageMatches.map((item, itemIdx) => {
                  const isBlank = item.isBlank;
                  const match = isBlank ? null : (item as Match & { categoryKey: CategoryType });
                  const categoryKey = match?.categoryKey || (selectedCategory !== 'ALL' ? selectedCategory : CategoryType.ADULT_PUTRA);
                  const catConfig = getCategoryConfig(categoryKey);
                  
                  const scoringSystem = scoringSystemOverride !== 'AUTO' 
                    ? scoringSystemOverride 
                    : (catConfig?.scoringSystem || 'SET_SYSTEM');

                  const isSetSystem = scoringSystem === 'SET_SYSTEM';
                  const totalEnds = numEndsOverride || catConfig?.matchEnds || 5;
                  const arrowsPerEnd = numArrowsOverride || catConfig?.matchArrowsPerEnd || 3;

                  const archerA = getArcher(match?.archerAId);
                  const archerB = getArcher(match?.archerBId);

                  const roundTitle = match ? getRoundLabel(match.round) : 'BABAK ADUAN (MATCH PLAY)';
                  const categoryLabel = CATEGORY_LABELS[categoryKey] || categoryKey;

                  return (
                    <div 
                      key={itemIdx} 
                      className={`flex flex-col justify-between ${
                        layoutMode === '2_PER_PAGE' && itemIdx === 0 && pageMatches.length > 1 
                          ? 'pb-6 mb-6 border-b-2 border-dashed border-slate-300 relative print:pb-4 print:mb-4' 
                          : ''
                      }`}
                    >
                      {/* Scissor cutting guide indicator for 2-per-page */}
                      {layoutMode === '2_PER_PAGE' && itemIdx === 0 && pageMatches.length > 1 && (
                        <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-white px-3 text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest border border-slate-200 rounded-full print:border-none">
                          <Scissors className="w-3 h-3 text-slate-500" />
                          <span>Garis Potong / Lembar 1 & 2</span>
                        </div>
                      )}

                      {/* Header Section */}
                      <div className="border-b-2 border-slate-900 pb-2 mb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {eventLogo ? (
                              <img src={eventLogo} alt="Logo" className="w-10 h-10 object-contain" crossOrigin="anonymous" />
                            ) : clubLogo ? (
                              <img src={clubLogo} alt="Club Logo" className="w-10 h-10 object-contain" crossOrigin="anonymous" />
                            ) : (
                              <div className="w-8 h-8">
                                <ArcusLogo className="w-8 h-8 text-purple-700" />
                              </div>
                            )}
                            <div>
                              <h1 className="text-xs sm:text-sm font-black font-oswald uppercase tracking-tight text-slate-950 leading-tight">
                                {tournamentName}
                              </h1>
                              <p className="text-[9px] font-semibold text-slate-600 flex items-center gap-2">
                                <span>{tournamentDate}</span>
                                <span>•</span>
                                <span>{tournamentLocation}</span>
                              </p>
                            </div>
                          </div>

                          {/* Header Badge */}
                          <div className="text-right">
                            <div className="inline-block bg-slate-900 text-white px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider font-oswald">
                              LEMBAR SKORING ADUAN / MATCH PLAY
                            </div>
                            <div className="text-[9px] font-black text-slate-800 uppercase mt-0.5">
                              {isSetSystem ? 'FORMAT: SET SYSTEM (TARGET 6 POIN)' : 'FORMAT: AKUMULASI TOTAL SKOR'}
                            </div>
                          </div>
                        </div>

                        {/* Match Info Bar */}
                        <div className="mt-2 grid grid-cols-4 gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-300 text-[9.5px] font-bold text-slate-850">
                          <div>
                            <span className="text-slate-500 block text-[7.5px] uppercase">Kategori</span>
                            <span className="font-black text-slate-900 uppercase truncate block">
                              {isBlank ? '................................................' : categoryLabel}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[7.5px] uppercase">Babak</span>
                            <span className="font-black text-slate-900 uppercase truncate block">
                              {isBlank ? '................................................' : roundTitle}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[7.5px] uppercase">Nomor Match</span>
                            <span className="font-black text-purple-900 uppercase block">
                              {isBlank ? 'Match #..........' : `Match #${match?.matchNo || '-'}`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block text-[7.5px] uppercase">Bantalan Target</span>
                            <span className="font-black text-slate-900 uppercase block">
                              {isBlank ? 'Target: ..........' : `Target: ${archerA?.targetNo || archerB?.targetNo || '-'}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Archer Profiles Bar */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {/* Archer A */}
                        <div className="border border-slate-900 rounded-lg p-1.5 bg-slate-50">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black bg-purple-700 text-white px-1.5 py-0.5 rounded uppercase">
                              PEMANAH A ({archerA?.targetNo ? `${archerA.targetNo}${archerA.position || 'A'}` : 'POSISI A'})
                            </span>
                            <span className="text-[8px] font-bold text-slate-500">{archerA?.registrationNo || 'Slot A'}</span>
                          </div>
                          <div className="mt-1">
                            <div className="font-black text-xs font-oswald uppercase text-slate-950 truncate">
                              {isBlank ? 'Nama: ................................................................' : (archerA?.name || 'TBA')}
                            </div>
                            <div className="text-[8.5px] font-bold text-slate-600 uppercase truncate">
                              {isBlank ? 'Klub: .................................................................' : (archerA?.club || '-')}
                            </div>
                          </div>
                        </div>

                        {/* Archer B */}
                        <div className="border border-slate-900 rounded-lg p-1.5 bg-slate-50">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded uppercase">
                              PEMANAH B ({archerB?.targetNo ? `${archerB.targetNo}${archerB.position || 'B'}` : 'POSISI B'})
                            </span>
                            <span className="text-[8px] font-bold text-slate-500">{archerB?.registrationNo || 'Slot B'}</span>
                          </div>
                          <div className="mt-1">
                            <div className="font-black text-xs font-oswald uppercase text-slate-950 truncate">
                              {isBlank ? 'Nama: ................................................................' : (archerB?.name || 'TBA')}
                            </div>
                            <div className="text-[8.5px] font-bold text-slate-600 uppercase truncate">
                              {isBlank ? 'Klub: .................................................................' : (archerB?.club || '-')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* The Main Match Play Scoring Table */}
                      <div className="border-2 border-slate-900 rounded-lg overflow-hidden mb-2">
                        <table className="w-full border-collapse text-center text-[9px]">
                          <thead>
                            {/* Super Header */}
                            <tr className="bg-slate-900 text-white font-black text-[8px] uppercase tracking-wider">
                              <th className="py-1 px-1 border-r border-slate-700 w-12" rowSpan={2}>
                                End
                              </th>
                              <th className="py-1 px-2 border-r border-slate-700" colSpan={arrowsPerEnd + (isSetSystem ? 3 : 2)}>
                                Pemanah A: {isBlank ? '(A)' : (archerA?.name || 'A')}
                              </th>
                              <th className="py-1 px-2" colSpan={arrowsPerEnd + (isSetSystem ? 3 : 2)}>
                                Pemanah B: {isBlank ? '(B)' : (archerB?.name || 'B')}
                              </th>
                            </tr>
                            {/* Column Subheaders */}
                            <tr className="bg-slate-200 text-slate-900 font-black text-[8px] uppercase border-b border-slate-900">
                              {/* Archer A Columns */}
                              {Array.from({ length: arrowsPerEnd }).map((_, aIdx) => (
                                <th key={`a-col-${aIdx}`} className="py-0.5 px-1 border-r border-slate-400 w-7">
                                  P{aIdx + 1}
                                </th>
                              ))}
                              <th className="py-0.5 px-1 border-r border-slate-400 bg-slate-300 w-8">End</th>
                              {isSetSystem && (
                                <th className="py-0.5 px-1 border-r border-slate-400 bg-purple-100 text-purple-950 w-9">
                                  Poin (2/1/0)
                                </th>
                              )}
                              <th className="py-0.5 px-1 border-r border-slate-900 bg-purple-200 text-purple-950 w-9">
                                Total
                              </th>

                              {/* Archer B Columns */}
                              {Array.from({ length: arrowsPerEnd }).map((_, bIdx) => (
                                <th key={`b-col-${bIdx}`} className="py-0.5 px-1 border-r border-slate-400 w-7">
                                  P{bIdx + 1}
                                </th>
                              ))}
                              <th className="py-0.5 px-1 border-r border-slate-400 bg-slate-300 w-8">End</th>
                              {isSetSystem && (
                                <th className="py-0.5 px-1 border-r border-slate-400 bg-purple-100 text-purple-950 w-9">
                                  Poin (2/1/0)
                                </th>
                              )}
                              <th className="py-0.5 px-1 bg-purple-200 text-purple-950 w-9">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300 font-bold">
                            {Array.from({ length: totalEnds }).map((_, endIdx) => {
                              const endScoreA = match?.endsA?.[endIdx];
                              const endScoreB = match?.endsB?.[endIdx];

                              return (
                                <tr key={endIdx} className={endIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                  {/* End Index Badge */}
                                  <td className="py-2.5 px-1 font-black bg-slate-100 border-r border-slate-400 text-slate-800">
                                    {endIdx + 1}
                                  </td>

                                  {/* Archer A Arrows */}
                                  {Array.from({ length: arrowsPerEnd }).map((_, arrowIdx) => (
                                    <td key={`a-arrow-${arrowIdx}`} className="py-2.5 px-1 border-r border-slate-300 font-bold text-slate-900">
                                      {/* Blank line for writing */}
                                    </td>
                                  ))}
                                  {/* Archer A End Score */}
                                  <td className="py-2.5 px-1 border-r border-slate-400 bg-slate-50 font-black text-slate-900">
                                    {endScoreA !== undefined && endScoreA > 0 ? endScoreA : ''}
                                  </td>
                                  {/* Archer A Set Points */}
                                  {isSetSystem && (
                                    <td className="py-2.5 px-1 border-r border-slate-400 font-black text-purple-900">
                                    </td>
                                  )}
                                  {/* Archer A Running Total */}
                                  <td className="py-2.5 px-1 border-r border-slate-900 bg-purple-50/50 font-black text-purple-950">
                                  </td>

                                  {/* Archer B Arrows */}
                                  {Array.from({ length: arrowsPerEnd }).map((_, arrowIdx) => (
                                    <td key={`b-arrow-${arrowIdx}`} className="py-2.5 px-1 border-r border-slate-300 font-bold text-slate-900">
                                    </td>
                                  ))}
                                  {/* Archer B End Score */}
                                  <td className="py-2.5 px-1 border-r border-slate-400 bg-slate-50 font-black text-slate-900">
                                    {endScoreB !== undefined && endScoreB > 0 ? endScoreB : ''}
                                  </td>
                                  {/* Archer B Set Points */}
                                  {isSetSystem && (
                                    <td className="py-2.5 px-1 border-r border-slate-400 font-black text-purple-900">
                                    </td>
                                  )}
                                  {/* Archer B Running Total */}
                                  <td className="py-2.5 px-1 bg-purple-50/50 font-black text-purple-950">
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Total Summary Row */}
                            <tr className="bg-slate-200 text-slate-950 font-black border-t-2 border-slate-900 text-[9.5px]">
                              <td className="py-2 px-1 border-r border-slate-400 uppercase tracking-widest text-[8px]">
                                TOTAL
                              </td>
                              <td colSpan={arrowsPerEnd} className="py-2 px-1 border-r border-slate-400 text-right pr-2 text-[8px] uppercase text-slate-600">
                                {isSetSystem ? 'Total Poin Set A:' : 'Total Skor A:'}
                              </td>
                              <td className="py-2 px-1 border-r border-slate-400 font-black text-sm font-oswald text-slate-950">
                                {match?.scoreA !== undefined && match.scoreA > 0 ? match.scoreA : ''}
                              </td>
                              {isSetSystem && (
                                <td className="py-2 px-1 border-r border-slate-400 font-black text-sm font-oswald text-purple-900">
                                  {match?.scoreA !== undefined && match.scoreA > 0 ? match.scoreA : ''}
                                </td>
                              )}
                              <td className="py-2 px-1 border-r border-slate-900 font-black text-sm font-oswald bg-purple-200">
                                {match?.scoreA !== undefined && match.scoreA > 0 ? match.scoreA : ''}
                              </td>

                              <td colSpan={arrowsPerEnd} className="py-2 px-1 border-r border-slate-400 text-right pr-2 text-[8px] uppercase text-slate-600">
                                {isSetSystem ? 'Total Poin Set B:' : 'Total Skor B:'}
                              </td>
                              <td className="py-2 px-1 border-r border-slate-400 font-black text-sm font-oswald text-slate-950">
                                {match?.scoreB !== undefined && match.scoreB > 0 ? match.scoreB : ''}
                              </td>
                              {isSetSystem && (
                                <td className="py-2 px-1 border-r border-slate-400 font-black text-sm font-oswald text-purple-900">
                                  {match?.scoreB !== undefined && match.scoreB > 0 ? match.scoreB : ''}
                                </td>
                              )}
                              <td className="py-2 px-1 font-black text-sm font-oswald bg-purple-200">
                                {match?.scoreB !== undefined && match.scoreB > 0 ? match.scoreB : ''}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Tie-Break & Shoot-Off Section */}
                      <div className="border border-slate-900 rounded-lg p-2 bg-amber-50/50 mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8.5px] font-black uppercase text-amber-950 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-600" />
                            <span>BABAK TAMBAHAN / SHOOT-OFF (JIKA SERI 5-5 ATAU SKOR TOTAL SAMA)</span>
                          </span>
                          <span className="text-[7.5px] font-bold text-amber-800 uppercase">
                            1 Panah / Terdekat Titik Pusat (X)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-[9px] font-bold">
                          <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-amber-200">
                            <span>Panah Shoot-Off Pemanah A:</span>
                            <span className="font-black text-sm font-oswald text-slate-950 w-16 text-center border-b border-slate-400">
                              {match?.shootOffA !== undefined ? `${match.shootOffA}${match.shootOffClosestA ? ' (X)' : ''}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-amber-200">
                            <span>Panah Shoot-Off Pemanah B:</span>
                            <span className="font-black text-sm font-oswald text-slate-950 w-16 text-center border-b border-slate-400">
                              {match?.shootOffB !== undefined ? `${match.shootOffB}${match.shootOffClosestB ? ' (X)' : ''}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[8px] text-slate-700">
                          <span>Catatan Wasit: Panah Terdekat ke Titik Pusat (Closest to Center / X): [ &nbsp;&nbsp;&nbsp; ] Pemanah A &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp;&nbsp;&nbsp; ] Pemanah B</span>
                          <span>Jarak Ukur (mm): A: ......... mm &nbsp;|&nbsp; B: ......... mm</span>
                        </div>
                      </div>

                      {/* Result & Signatures Box */}
                      <div className="grid grid-cols-3 gap-2 border border-slate-900 rounded-lg p-2 bg-slate-50 text-[9px]">
                        {/* Winner Declaration */}
                        <div className="flex flex-col justify-between border-r border-slate-300 pr-2">
                          <span className="text-[7.5px] font-black uppercase text-slate-500">Pemenang Pertandingan:</span>
                          <div className="font-black text-xs font-oswald uppercase text-purple-900 mt-1 truncate">
                            {match?.winnerId === match?.archerAId && archerA 
                              ? `✓ ${archerA.name}` 
                              : match?.winnerId === match?.archerBId && archerB 
                                ? `✓ ${archerB.name}` 
                                : '................................................'}
                          </div>
                          <div className="text-[8px] font-bold text-slate-600 mt-1">
                            Skor Akhir: {match?.winnerId ? `${match.scoreA} - ${match.scoreB}` : '........ - ........'}
                          </div>
                        </div>

                        {/* Archer Signatures */}
                        <div className="flex flex-col justify-between border-r border-slate-300 pr-2">
                          <div className="grid grid-cols-2 gap-2 text-center text-[7.5px] font-bold text-slate-700">
                            <div>
                              <span>Tanda Tangan Atlet A</span>
                              <div className="h-9 border-b border-slate-400 mt-1"></div>
                              <span className="text-[7px] text-slate-500 truncate block mt-0.5">
                                {isBlank ? '(Nama Atlet A)' : (archerA?.name || 'Pemanah A')}
                              </span>
                            </div>
                            <div>
                              <span>Tanda Tangan Atlet B</span>
                              <div className="h-9 border-b border-slate-400 mt-1"></div>
                              <span className="text-[7px] text-slate-500 truncate block mt-0.5">
                                {isBlank ? '(Nama Atlet B)' : (archerB?.name || 'Pemanah B')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Scorer / Judge Signature */}
                        <div className="flex flex-col justify-between text-center text-[7.5px] font-bold text-slate-700 pl-1">
                          <span>Tanda Tangan Wasit / Scorer</span>
                          <div className="h-9 border-b border-slate-400 mt-1"></div>
                          <span className="text-[7px] text-slate-500 block mt-0.5">
                            (Nama & Tanda Tangan Wasit Lapangan)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintEliminationSheetsModal;
