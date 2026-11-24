import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Trophy, Medal, MapPin, Building2, Search,
  FileSpreadsheet, Download, Printer, ChevronDown, ChevronUp,
  Award, Filter, Users, AlertCircle, CheckCircle2
} from 'lucide-react';
import { ArcheryEvent } from '../types';
import ArcusLogo from './ArcusLogo';
import {
  computeMedalStandings,
  MedalGroupingMode,
  MedalWinnerDetail
} from '../lib/medalStandings';
import { exportToExcel, exportToCSV } from '../lib/excelHelper';
import { toast } from 'sonner';

interface Props {
  event: ArcheryEvent;
  onBack: () => void;
}

export default function MedalStandingsPanel({ event, onBack }: Props) {
  const [groupMode, setGroupMode] = useState<MedalGroupingMode>('REGION');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDetails, setShowDetails] = useState<boolean>(true);
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>({});

  const summary = useMemo(
    () => computeMedalStandings(event, groupMode, categoryFilter),
    [event, groupMode, categoryFilter]
  );

  const filteredStandings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return summary.standings;

    return summary.standings.filter(item => {
      if (item.name.toLowerCase().includes(q)) return true;
      return item.medals.some(
        m =>
          m.archerName.toLowerCase().includes(q) ||
          m.categoryLabel.toLowerCase().includes(q) ||
          m.club.toLowerCase().includes(q) ||
          m.region.toLowerCase().includes(q)
      );
    });
  }, [summary.standings, searchTerm]);

  const topThree = useMemo(
    () => filteredStandings.filter(s => !s.isUnspecified).slice(0, 3),
    [filteredStandings]
  );

  const groupLabel = groupMode === 'REGION' ? 'Daerah' : 'Klub';
  const tournamentName = event.settings?.tournamentName || 'Turnamen Panahan';

  const toggleRowCollapse = (key: string) => {
    setCollapsedKeys(prev => ({
      ...prev,
      [key]: !(prev[key] ?? false)
    }));
  };

  const getMedalBadge = (medal: MedalWinnerDetail['medal']) => {
    switch (medal) {
      case 'GOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider shrink-0">
            🥇 Emas
          </span>
        );
      case 'SILVER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-black uppercase tracking-wider shrink-0">
            🥈 Perak
          </span>
        );
      case 'BRONZE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-900 border border-orange-300 text-[10px] font-black uppercase tracking-wider shrink-0">
            🥉 Perunggu
          </span>
        );
    }
  };

  const buildExportData = () => {
    const location = event.settings?.location || '-';
    const eventDate = event.settings?.eventDate || '-';
    const exportTime = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const metadata = [
      { label: 'Nama Turnamen:', value: tournamentName },
      { label: 'Lokasi:', value: location },
      { label: 'Tanggal:', value: eventDate },
      { label: 'Pengelompokan Klasemen:', value: `Berdasarkan ${groupLabel} (Standar Olimpiade: Emas > Perak > Perunggu)` },
      { label: 'Filter Kategori:', value: categoryFilter === 'ALL' ? 'Semua Kategori' : (summary.availableCategories.find(c => c.key === categoryFilter)?.label || categoryFilter) },
      { label: 'Waktu Ekspor:', value: `${exportTime} WIB` }
    ];

    const headers = [
      'Peringkat',
      groupMode === 'REGION' ? 'Nama Daerah' : 'Nama Klub',
      'Medali Emas (Juara 1)',
      'Medali Perak (Juara 2)',
      'Medali Perunggu (Juara 3)',
      'Total Medali',
      'Rincian Atlet & Kategori Peraih Medali'
    ];

    const rows = filteredStandings.map(s => [
      s.rank,
      s.name,
      s.gold,
      s.silver,
      s.bronze,
      s.total,
      s.medals
        .map(m => `[${m.medalLabel}] ${m.archerName} (${m.categoryLabel}${groupMode === 'REGION' && m.club !== '-' ? ` - ${m.club}` : ''}${groupMode === 'CLUB' && m.region !== '-' ? ` - ${m.region}` : ''})`)
        .join(' | ')
    ]);

    const safeFileName = `Klasemen_Medali_${groupLabel}_${tournamentName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}`;

    return {
      title: `KLASEMEN PEROLEHAN MEDALI PER ${groupLabel.toUpperCase()} - ${tournamentName.toUpperCase()}`,
      metadata,
      headers,
      rows,
      safeFileName
    };
  };

  const handleExportExcel = () => {
    if (filteredStandings.length === 0) {
      toast.warning('Belum ada data medali untuk diekspor.');
      return;
    }
    try {
      const payload = buildExportData();
      exportToExcel({
        fileName: payload.safeFileName,
        sheetName: `Klasemen Per ${groupLabel}`,
        title: payload.title,
        metadata: payload.metadata,
        headers: payload.headers,
        rows: payload.rows
      });
      toast.success(`Klasemen medali per ${groupLabel.toLowerCase()} berhasil diunduh (.xlsx)`);
    } catch (err: any) {
      toast.error('Gagal mengekspor Excel: ' + err.message);
    }
  };

  const handleExportCSV = () => {
    if (filteredStandings.length === 0) {
      toast.warning('Belum ada data medali untuk diekspor.');
      return;
    }
    try {
      const payload = buildExportData();
      exportToCSV({
        fileName: payload.safeFileName,
        title: payload.title,
        metadata: payload.metadata,
        headers: payload.headers,
        rows: payload.rows
      });
      toast.success(`Klasemen medali per ${groupLabel.toLowerCase()} berhasil diunduh (.csv)`);
    } catch (err: any) {
      toast.error('Gagal mengekspor CSV: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-arcus-red selection:text-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs print:hidden">
        <div className="max-w-[1400px] mx-auto px-3 md:px-10 h-16 md:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 md:gap-5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 md:p-2.5 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all active:scale-95 shrink-0"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <ArcusLogo className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm md:text-xl font-black font-oswald uppercase italic leading-none tracking-tight text-slate-900 truncate">
                  Klasemen Medali &amp; Juara Umum
                </h1>
                <p className="text-[9px] md:text-[10px] font-black text-arcus-red uppercase tracking-widest truncate mt-0.5">
                  {tournamentName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              title="Ekspor Klasemen Medali & Rincian Atlet ke Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ekspor Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 md:px-3.5 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-arcus-red hover:bg-red-700 text-white px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block px-6 pt-4 pb-4 border-b-2 border-slate-900 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Laporan Resmi Perolehan Medali
            </p>
            <h1 className="text-2xl font-black font-oswald uppercase text-slate-900">
              {tournamentName}
            </h1>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              Pengelompokan: Berdasarkan {groupLabel} (Standar Medali: Emas → Perak → Perunggu)
            </p>
          </div>
          <div className="text-right text-xs font-bold text-slate-600">
            <p>{event.settings?.location || ''}</p>
            <p>{event.settings?.eventDate || ''}</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-6 md:py-10 space-y-6 md:space-y-8">
        {/* Controls & Grouping Switcher */}
        <div className="bg-white rounded-3xl p-4 md:p-6 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Grouping Mode Toggle */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto">
              <button
                type="button"
                onClick={() => setGroupMode('REGION')}
                className={`flex-1 lg:flex-initial px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  groupMode === 'REGION'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                <MapPin className={`w-4 h-4 ${groupMode === 'REGION' ? 'text-amber-400' : 'text-slate-500'}`} />
                Berdasarkan Daerah
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('CLUB')}
                className={`flex-1 lg:flex-initial px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  groupMode === 'CLUB'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                <Building2 className={`w-4 h-4 ${groupMode === 'CLUB' ? 'text-amber-400' : 'text-slate-500'}`} />
                Berdasarkan Klub
              </button>
            </div>

            {/* Search, Category Filter, Toggle Details */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 lg:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={`Cari ${groupLabel.toLowerCase()}, atlet, atau kategori...`}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-arcus-red transition-all"
                />
              </div>

              <div className="relative">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto pl-8 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-arcus-red cursor-pointer"
                >
                  <option value="ALL">Semua Kategori ({summary.availableCategories.length})</option>
                  {summary.availableCategories.map(cat => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextVal = !showDetails;
                  setShowDetails(nextVal);
                  setCollapsedKeys({});
                }}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                  showDetails
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                {showDetails ? 'Sembunyikan Rincian Atlet' : 'Tampilkan Rincian Atlet'}
              </button>
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Total {groupLabel}
                </p>
                <p className="text-xl font-black font-oswald text-slate-900">
                  {filteredStandings.filter(s => !s.isUnspecified).length}
                </p>
              </div>
              {groupMode === 'REGION' ? (
                <MapPin className="w-5 h-5 text-arcus-red opacity-70" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-600 opacity-70" />
              )}
            </div>
            <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/70 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-800">
                  Medali Emas
                </p>
                <p className="text-xl font-black font-oswald text-amber-950">{summary.totalGold}</p>
              </div>
              <span className="text-xl">🥇</span>
            </div>
            <div className="p-3 bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                  Medali Perak
                </p>
                <p className="text-xl font-black font-oswald text-slate-900">{summary.totalSilver}</p>
              </div>
              <span className="text-xl">🥈</span>
            </div>
            <div className="p-3 bg-orange-50/70 rounded-2xl border border-orange-200/70 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-800">
                  Medali Perunggu
                </p>
                <p className="text-xl font-black font-oswald text-orange-950">{summary.totalBronze}</p>
              </div>
              <span className="text-xl">🥉</span>
            </div>
          </div>

          {groupMode === 'REGION' && summary.missingGroupValueCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">
                Terdapat <strong>{summary.missingGroupValueCount}</strong> medali pemenang dari data peserta lama yang belum memiliki isian <strong>Nama Daerah</strong>. Anda dapat melengkapinya melalui menu <em>Manajemen Peserta → Edit Peserta</em>.
              </p>
            </div>
          )}
        </div>

        {/* Top 3 Juara Umum Highlight */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topThree.map((item, idx) => {
              const cardTheme =
                idx === 0
                  ? 'bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/20'
                  : idx === 1
                  ? 'bg-white text-slate-900 border-slate-200 shadow-sm'
                  : 'bg-white text-slate-900 border-orange-200 shadow-sm';

              return (
                <div
                  key={item.key}
                  className={`rounded-3xl p-6 border relative overflow-hidden transition-all ${cardTheme}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 ${
                          idx === 0
                            ? 'bg-slate-950 text-amber-300'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-orange-100 text-orange-900'
                        }`}
                      >
                        Peringkat #{item.rank} {groupLabel}
                      </span>
                      <h2 className="text-lg md:text-2xl font-black font-oswald uppercase italic leading-tight truncate">
                        {item.name}
                      </h2>
                    </div>
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-slate-950/15 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {idx === 0 ? <Trophy className="w-6 h-6" /> : <Medal className="w-6 h-6" />}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-black/10 text-center">
                    <div>
                      <p className="text-[9px] font-black uppercase opacity-75">Emas</p>
                      <p className="text-xl font-black font-oswald">{item.gold}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase opacity-75">Perak</p>
                      <p className="text-xl font-black font-oswald">{item.silver}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase opacity-75">Perunggu</p>
                      <p className="text-xl font-black font-oswald">{item.bronze}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase opacity-75">Total</p>
                      <p className="text-xl font-black font-oswald">{item.total}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Main Standings Table + Athlete/Category Breakdown */}
        {filteredStandings.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-arcus-red" />
                <h3 className="text-base md:text-lg font-black font-oswald uppercase italic text-slate-900">
                  Daftar Perolehan Medali per {groupLabel} ({filteredStandings.length})
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 hidden sm:inline">
                Urutan Standar Olimpiade: Emas → Perak → Perunggu
              </span>
            </div>

            <div className="space-y-3">
              {filteredStandings.map(contingent => {
                const isExpanded = collapsedKeys[contingent.key] !== undefined
                  ? !collapsedKeys[contingent.key]
                  : showDetails;

                return (
                  <div
                    key={contingent.key}
                    className={`bg-white rounded-3xl border overflow-hidden shadow-xs transition-all break-inside-avoid ${
                      contingent.isUnspecified
                        ? 'border-amber-200 bg-amber-50/20'
                        : contingent.rank === 1
                        ? 'border-amber-300 ring-1 ring-amber-200/60'
                        : 'border-slate-200/80'
                    }`}
                  >
                    {/* Contingent Summary Header Row */}
                    <div
                      onClick={() => toggleRowCollapse(contingent.key)}
                      className="p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-black font-oswald text-base md:text-xl shrink-0 ${
                            contingent.isUnspecified
                              ? 'bg-amber-100 text-amber-800'
                              : contingent.rank === 1
                              ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-sm'
                              : contingent.rank === 2
                              ? 'bg-slate-200 text-slate-900'
                              : contingent.rank === 3
                              ? 'bg-orange-200 text-orange-950'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {contingent.isUnspecified ? '?' : `#${contingent.rank}`}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm md:text-lg font-black font-oswald uppercase italic text-slate-900 truncate">
                              {contingent.name}
                            </h4>
                            {contingent.rank === 1 && !contingent.isUnspecified && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black uppercase tracking-wider">
                                Peringkat 1
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                            {contingent.medals.length} Penghargaan Podium dari{' '}
                            {new Set(contingent.medals.map(m => m.category)).size} Kategori
                          </p>
                        </div>
                      </div>

                      {/* Medal Counters */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-center min-w-[54px]">
                          <p className="text-[8px] font-black text-amber-800 uppercase">Emas</p>
                          <p className="text-base font-black font-oswald text-amber-950 leading-none mt-0.5">
                            {contingent.gold}
                          </p>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[54px]">
                          <p className="text-[8px] font-black text-slate-600 uppercase">Perak</p>
                          <p className="text-base font-black font-oswald text-slate-900 leading-none mt-0.5">
                            {contingent.silver}
                          </p>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-center min-w-[54px]">
                          <p className="text-[8px] font-black text-orange-800 uppercase">Perunggu</p>
                          <p className="text-base font-black font-oswald text-orange-950 leading-none mt-0.5">
                            {contingent.bronze}
                          </p>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-center min-w-[54px]">
                          <p className="text-[8px] font-black text-slate-300 uppercase">Total</p>
                          <p className="text-base font-black font-oswald leading-none mt-0.5">
                            {contingent.total}
                          </p>
                        </div>

                        <span className="p-1.5 text-slate-400 print:hidden">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>

                    {/* Medalist Breakdown: Kategori & Nama Atlet */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 md:px-6 py-3.5">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200/80">
                                <th className="py-2 pr-3 w-28">Medali</th>
                                <th className="py-2 pr-3">Nama Atlet</th>
                                <th className="py-2 pr-3">Kategori</th>
                                <th className="py-2 pr-3">
                                  {groupMode === 'REGION' ? 'Nama Klub' : 'Asal Daerah'}
                                </th>
                                <th className="py-2 text-right">Sumber Hasil</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60">
                              {contingent.medals.map((m, mIdx) => (
                                <tr key={`${contingent.key}-${m.category}-${m.medal}-${m.archerId}-${mIdx}`} className="hover:bg-white/70">
                                  <td className="py-2.5 pr-3 whitespace-nowrap">
                                    {getMedalBadge(m.medal)}
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <span className="font-black text-slate-900 uppercase">
                                      {m.archerName}
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <span className="inline-block px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-extrabold text-slate-800 uppercase">
                                      {m.categoryLabel}
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3 text-[11px] font-bold text-slate-600 uppercase">
                                    {groupMode === 'REGION' ? m.club : m.region}
                                  </td>
                                  <td className="py-2.5 text-right whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 uppercase">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      {m.source}
                                      {m.score > 0 && m.source === 'Kualifikasi' ? ` (${m.score})` : ''}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 md:p-16 text-center border border-slate-200/80 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-black font-oswald uppercase italic text-slate-900">
                Belum Ada Data Perolehan Medali
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {searchTerm
                  ? 'Tidak ada daerah, klub, atlet, atau kategori yang cocok dengan pencarian Anda.'
                  : 'Klasemen medali akan otomatis terisi setelah ada pemenang pada Babak Eliminasi/Aduan atau skor Kualifikasi tercatat.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
