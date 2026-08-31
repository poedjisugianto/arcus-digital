import React, { useState, useMemo } from 'react';
import { 
  Printer, Download, Copy, Check, X, Users, 
  Target, Award, Calendar, MapPin, Filter,
  FileSpreadsheet, Sparkles, CheckCircle2, ArrowUpDown
} from 'lucide-react';
import { ArcheryEvent, CategoryType, Archer, ParticipantRegistration } from '../types';
import { CATEGORY_LABELS } from '../constants';
import ArcusLogo from './ArcusLogo';
import { toast } from 'sonner';

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  event: ArcheryEvent;
  initialCategory?: string; // 'ALL' or specific CategoryType
  officials?: ParticipantRegistration[];
}

export default function PrintParticipantListModal({
  isOpen = true,
  onClose,
  event,
  initialCategory = 'ALL',
  officials = []
}: Props) {
  if (!isOpen) return null;

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'ALL');
  const [docType, setDocType] = useState<'ARCHERS_TARGET' | 'ARCHERS_CLUB' | 'OFFICIALS'>('ARCHERS_TARGET');
  const [sortBy, setSortBy] = useState<'TARGET' | 'NAME' | 'CLUB'>('TARGET');
  const [showSignatureColumn, setShowSignatureColumn] = useState<boolean>(true);
  const [showPinColumn, setShowPinColumn] = useState<boolean>(false);
  const [hasCopiedText, setHasCopiedText] = useState(false);

  const tournamentName = event.settings?.tournamentName || 'Arcus Archery Tournament';
  const tournamentLocation = event.settings?.location || 'Indonesia';
  const tournamentDate = event.settings?.eventDate || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const allArchers = useMemo(() => {
    return event.archers || [];
  }, [event.archers]);

  const allOfficials = useMemo(() => {
    return officials.length > 0 ? officials : (event.officials || []);
  }, [officials, event.officials]);

  const availableCategories = useMemo(() => {
    const list: CategoryType[] = [];
    const configs = event?.settings?.categoryConfigs || {};
    (Object.keys(CategoryType) as CategoryType[]).forEach(cat => {
      if (cat !== CategoryType.OFFICIAL) {
        const count = allArchers.filter(a => a.category === cat).length;
        if (count > 0 || (configs && (configs as any)[cat])) {
          list.push(cat);
        }
      }
    });
    return list;
  }, [allArchers, event?.settings?.categoryConfigs]);

  // Categories to render in document
  const categoriesToRender = useMemo(() => {
    if (docType === 'OFFICIALS') return [];
    if (selectedCategory === 'ALL') {
      return availableCategories.filter(cat => allArchers.some(a => a.category === cat));
    }
    return [selectedCategory as CategoryType];
  }, [docType, selectedCategory, availableCategories, allArchers]);

  // Sort archers function
  const sortArchers = (list: Archer[]) => {
    return [...list].sort((a, b) => {
      if (sortBy === 'TARGET') {
        const wA = a.wave || 1;
        const wB = b.wave || 1;
        if (wA !== wB) return wA - wB;
        const tA = a.targetNo || 999;
        const tB = b.targetNo || 999;
        if (tA !== tB) return tA - tB;
        return (a.position || '').localeCompare(b.position || '');
      } else if (sortBy === 'NAME') {
        return (a.name || '').localeCompare(b.name || '');
      } else {
        const cComp = (a.club || '').localeCompare(b.club || '');
        if (cComp !== 0) return cComp;
        return (a.name || '').localeCompare(b.name || '');
      }
    });
  };

  // Summary stats
  const stats = useMemo(() => {
    const activeArchers = selectedCategory === 'ALL' 
      ? allArchers 
      : allArchers.filter(a => a.category === selectedCategory);
    
    const uniqueClubs = new Set(activeArchers.map(a => (a.club || '').trim()).filter(Boolean));
    const targetAssigned = activeArchers.filter(a => a.targetNo && a.targetNo > 0).length;

    return {
      totalArchers: activeArchers.length,
      totalClubs: uniqueClubs.size,
      targetAssigned,
      totalOfficials: allOfficials.length
    };
  }, [allArchers, selectedCategory, allOfficials]);

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    try {
      let csvContent = '';
      if (docType === 'OFFICIALS') {
        const headers = ['No', 'Nama Official', 'Klub / Kontingen', 'Kontak / HP', 'Email', 'Status'];
        const rows = allOfficials.map((o, idx) => [
          idx + 1,
          `"${o.name || '-'}"`,
          `"${o.club || '-'}"`,
          `"${o.phone || '-'}"`,
          `"${o.email || '-'}"`,
          `"${o.status || 'TERKONFIRMASI'}"`
        ]);
        csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      } else {
        const headers = ['No', 'Nomor Bantalan', 'Posisi', 'Nama Atlet', 'Klub / Kontingen', 'Kategori', 'Sesi', 'PIN', 'Status'];
        const targetList = selectedCategory === 'ALL' 
          ? allArchers 
          : allArchers.filter(a => a.category === selectedCategory);
        
        const sortedList = sortArchers(targetList);
        const rows = sortedList.map((a, idx) => [
          idx + 1,
          `"${a.targetNo || '-'}"`,
          `"${a.position || '-'}"`,
          `"${a.name || '-'}"`,
          `"${a.club || '-'}"`,
          `"${CATEGORY_LABELS[a.category as CategoryType] || a.category}"`,
          `"${a.wave || 1}"`,
          `"${a.pin || '-'}"`,
          `"${a.status || 'TERKONFIRMASI'}"`
        ]);
        csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Daftar_Peserta_${tournamentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('File Excel / CSV berhasil diunduh');
    } catch (e: any) {
      toast.error('Gagal mengekspor data: ' + e.message);
    }
  };

  // Copy Summary text for WhatsApp
  const handleCopySummary = () => {
    let text = `📋 *DAFTAR PESERTA & BANTALAN - ${tournamentName.toUpperCase()}*\n`;
    text += `📍 Lokasi: ${tournamentLocation}\n`;
    text += `📅 Tanggal: ${tournamentDate}\n`;
    text += `👥 Total Atlet: ${stats.totalArchers} Pemanah (${stats.totalClubs} Klub/Kontingen)\n\n`;

    if (docType === 'OFFICIALS') {
      text += `*DAFTAR OFFICIAL TIM:*\n`;
      allOfficials.forEach((o, i) => {
        text += `${i + 1}. ${o.name} (${o.club || '-'})\n`;
      });
    } else {
      categoriesToRender.forEach(cat => {
        const catArchers = sortArchers(allArchers.filter(a => a.category === cat));
        if (catArchers.length === 0) return;
        text += `\n🎯 *KATEGORI: ${CATEGORY_LABELS[cat] || cat}* (${catArchers.length} Peserta)\n`;
        catArchers.forEach((a, i) => {
          const targetStr = a.targetNo ? `[${a.targetNo}${a.position || ''}]` : `[-]`;
          text += `${i + 1}. ${targetStr} ${a.name} - ${a.club || '-'}\n`;
        });
      });
    }

    text += `\n_Dicetak otomatis via ARCUS Tournament OS_\n`;
    navigator.clipboard.writeText(text);
    setHasCopiedText(true);
    toast.success('Ringkasan daftar peserta disalin ke clipboard');
    setTimeout(() => setHasCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static print:overflow-visible print:block">
      {/* Modal Dialog Window Container */}
      <div className="w-full max-w-5xl h-full max-h-[92vh] bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden print:border-0 print:shadow-none print:max-h-none print:overflow-visible print:bg-white print:rounded-none print:h-auto print:max-w-none">
        
        {/* Modal Top Control Header - Hidden on print */}
        <div className="shrink-0 bg-white border-b border-slate-200 p-4 sm:p-5 shadow-sm space-y-3.5 print:hidden">
          
          {/* Header Row: Title & Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-arcus-red text-white flex items-center justify-center font-black shadow-md shadow-arcus-red/30 shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-black font-oswald uppercase italic tracking-tight text-slate-900 leading-none">
                  Cetak Lembar Daftar Peserta Resmi
                </h2>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                  Format A4/F4 Resmi • Penempatan Bantalan • Presensi &amp; Paraf Atlet
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                title="Salin ringkasan daftar peserta untuk WhatsApp"
              >
                {hasCopiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-300" />}
                <span>{hasCopiedText ? 'Tersalin!' : 'Salin WA'}</span>
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
                className="px-5 py-2.5 bg-arcus-red hover:bg-red-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-arcus-red/30 transition-all active:scale-95 whitespace-nowrap"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
            {/* Document Type */}
            <div>
              <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest block mb-1 flex items-center gap-1">
                <Target className="w-3 h-3 text-arcus-red" /> 1. Jenis Dokumen:
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-arcus-red shadow-xs"
              >
                <option value="ARCHERS_TARGET">Daftar Pemanah &amp; Bantalan</option>
                <option value="OFFICIALS">Daftar Official Tim / Kontingen</option>
              </select>
            </div>

            {/* Category Selector */}
            {docType !== 'OFFICIALS' && (
              <div>
                <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest block mb-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-600" /> 2. Kategori Divisi:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-arcus-red shadow-xs"
                >
                  <option value="ALL">Semua Kategori ({allArchers.length} Peserta)</option>
                  {availableCategories.map(cat => {
                    const count = allArchers.filter(a => a.category === cat).length;
                    return (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat] || cat} ({count} Peserta)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Sorting */}
            {docType !== 'OFFICIALS' && (
              <div>
                <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest block mb-1 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-emerald-600" /> 3. Urutkan Berdasarkan:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-arcus-red shadow-xs"
                >
                  <option value="TARGET">Nomor Bantalan (01A, 01B...)</option>
                  <option value="NAME">Nama Pemanah (A - Z)</option>
                  <option value="CLUB">Klub / Kontingen</option>
                </select>
              </div>
            )}

            {/* Options Toggle */}
            <div className="flex flex-col justify-center gap-1.5 pt-4 sm:pt-0">
              <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-800">
                <input 
                  type="checkbox" 
                  checked={showSignatureColumn} 
                  onChange={(e) => setShowSignatureColumn(e.target.checked)}
                  className="rounded border-slate-300 text-arcus-red focus:ring-arcus-red"
                />
                <span>Kolom Tanda Tangan / Paraf</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-800">
                <input 
                  type="checkbox" 
                  checked={showPinColumn} 
                  onChange={(e) => setShowPinColumn(e.target.checked)}
                  className="rounded border-slate-300 text-arcus-red focus:ring-arcus-red"
                />
                <span>Tampilkan Nomor PIN Atlet</span>
              </label>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-[10px] font-medium text-slate-700 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span>👥 <strong>{stats.totalArchers}</strong> Pemanah Terdaftar</span>
              <span>🏢 <strong>{stats.totalClubs}</strong> Klub/Kontingen</span>
              <span>🎯 <strong>{stats.targetAssigned}</strong> Siap di Bantalan</span>
            </div>
            <span className="font-bold text-arcus-red">Format: Standar Cetak Kertas A4 / F4 Portrait</span>
          </div>
        </div>

        {/* Modal Body / Paper Sheet Preview (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-200/70 flex justify-center print:p-0 print:bg-white print:overflow-visible print:block">
          <div 
            id="printable-participant-sheet"
            className="w-full max-w-4xl bg-white rounded-2xl p-6 sm:p-10 shadow-xl border border-slate-300 print:shadow-none print:border-0 print:p-0 print:m-0 print:rounded-none print:w-full print:max-w-none text-slate-900 font-sans"
          >
            {/* Render Official List Mode */}
            {docType === 'OFFICIALS' ? (
              <div>
                {/* Official Header */}
                <div className="border-b-4 border-slate-900 pb-4 mb-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <ArcusLogo className="w-14 h-14 sm:w-16 sm:h-16 shrink-0" />
                      <div>
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 block">
                          OFFICIAL TEAM &amp; CONTINGENT DIRECTORY
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black font-oswald uppercase tracking-tight text-slate-950">
                          {tournamentName}
                        </h1>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Daftar Official, Manajer &amp; Pelatih Tim
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-[10px] font-bold text-slate-600 hidden sm:block shrink-0">
                      <p>{tournamentLocation}</p>
                      <p>{tournamentDate}</p>
                      <p className="text-blue-600 font-black mt-1">TOTAL: {allOfficials.length} OFFICIAL</p>
                    </div>
                  </div>
                </div>

                {/* Table for Officials */}
                <table className="w-full border-collapse border-2 border-black text-left text-xs mb-8">
                  <thead>
                    <tr className="bg-slate-100 font-bold uppercase text-[10px] text-black">
                      <th className="border border-black py-2 px-2 text-center w-10">No</th>
                      <th className="border border-black py-2 px-3">Nama Lengkap Official</th>
                      <th className="border border-black py-2 px-3">Klub / Kontingen</th>
                      <th className="border border-black py-2 px-3 text-center">No. WhatsApp / HP</th>
                      <th className="border border-black py-2 px-3 text-center w-24">Status</th>
                      {showSignatureColumn && (
                        <th className="border border-black py-2 px-3 text-center w-28">Tanda Tangan</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {allOfficials.length === 0 ? (
                      <tr>
                        <td colSpan={showSignatureColumn ? 6 : 5} className="border border-black py-8 text-center text-slate-500 font-bold">
                          Belum ada data official yang terdaftar.
                        </td>
                      </tr>
                    ) : (
                      allOfficials.map((off, idx) => (
                        <tr key={off.id || idx} className="border-b border-black hover:bg-slate-50">
                          <td className="border border-black py-2 px-2 text-center font-bold text-[11px]">{idx + 1}</td>
                          <td className="border border-black py-2 px-3 font-bold uppercase text-[11px] text-slate-950">{off.name}</td>
                          <td className="border border-black py-2 px-3 font-semibold uppercase text-[10px] text-slate-800">{off.club || '-'}</td>
                          <td className="border border-black py-2 px-3 text-center text-[10px]">{off.phone || '-'}</td>
                          <td className="border border-black py-2 px-2 text-center text-[9px] font-black uppercase text-blue-700">
                            {off.status || 'TERDAFTAR'}
                          </td>
                          {showSignatureColumn && (
                            <td className="border border-black py-2 px-2 text-center text-[9px] text-slate-400 italic">
                              ....................
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Footer Signatures */}
                <div className="mt-12 pt-6 flex justify-between items-end text-center text-xs font-bold text-black border-t border-dashed border-slate-300">
                  <div className="w-56">
                    <p className="text-[10px] text-slate-600 mb-14">
                      Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="border-b border-black mb-1.5"></div>
                    <p className="uppercase font-black text-[11px]">Koordinator Kesekretariatan</p>
                  </div>
                  <div className="w-56">
                    <p className="text-[10px] text-slate-600 mb-14">{tournamentLocation}</p>
                    <div className="border-b border-black mb-1.5"></div>
                    <p className="uppercase font-black text-[11px]">Ketua Panitia Pelaksana</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Render Archer List Mode (Categorized with Page Breaks) */
              <div>
                {categoriesToRender.map((category, catIdx) => {
                  const catArchers = sortArchers(allArchers.filter(a => a.category === category));
                  const catLabel = CATEGORY_LABELS[category] || category;
                  const isMultiPage = categoriesToRender.length > 1;

                  return (
                    <div 
                      key={category} 
                      className={`printable-category-section ${catIdx > 0 ? 'page-break-before-always mt-12 pt-6 border-t-2 border-black' : ''}`}
                    >
                      {/* Document Header for Category */}
                      <div className="border-b-4 border-slate-900 pb-4 mb-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <ArcusLogo className="w-12 h-12 sm:w-14 sm:h-14 shrink-0" />
                            <div>
                              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.25em] text-arcus-red block">
                                OFFICIAL TOURNAMENT ENTRY &amp; TARGET ASSIGNMENT
                              </span>
                              <h1 className="text-lg sm:text-2xl font-black font-oswald uppercase tracking-tight text-slate-950">
                                {tournamentName}
                              </h1>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="bg-slate-900 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded">
                                  Kategori: {catLabel}
                                </span>
                                <span className="text-[10px] font-bold text-slate-700">
                                  ({catArchers.length} Pemanah)
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-[10px] font-bold text-slate-600 hidden sm:block shrink-0">
                            <p>{tournamentLocation}</p>
                            <p>{tournamentDate}</p>
                            <p className="text-slate-900 font-bold mt-0.5">
                              Hal {catIdx + 1} dari {categoriesToRender.length}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Archer Table */}
                      <table className="w-full border-collapse border-2 border-black text-left text-xs mb-6">
                        <thead>
                          <tr className="bg-slate-100 font-bold uppercase text-[10px] text-black">
                            <th className="border border-black py-2 px-1 text-center w-8">No</th>
                            <th className="border border-black py-2 px-2 text-center w-16 bg-slate-200">Bantalan</th>
                            <th className="border border-black py-2 px-3">Nama Lengkap Atlet</th>
                            <th className="border border-black py-2 px-3">Klub / Kontingen</th>
                            <th className="border border-black py-2 px-1 text-center w-12">Sesi</th>
                            {showPinColumn && (
                              <th className="border border-black py-2 px-2 text-center w-16">PIN</th>
                            )}
                            <th className="border border-black py-2 px-2 text-center w-20">Status</th>
                            {showSignatureColumn && (
                              <th className="border border-black py-2 px-2 text-center w-28">Paraf Atlet</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {catArchers.length === 0 ? (
                            <tr>
                              <td colSpan={showSignatureColumn ? 7 : 6} className="border border-black py-8 text-center text-slate-500 font-bold">
                                Belum ada pemanah terdaftar di kategori ini.
                              </td>
                            </tr>
                          ) : (
                            catArchers.map((archer, idx) => {
                              const targetCode = archer.targetNo 
                                ? `${String(archer.targetNo).padStart(2, '0')}${archer.position || ''}` 
                                : '-';

                              return (
                                <tr key={archer.id || idx} className="border-b border-black hover:bg-slate-50">
                                  <td className="border border-black py-1.5 px-1 text-center font-bold text-[10px] text-slate-700">
                                    {idx + 1}
                                  </td>
                                  <td className="border border-black py-1.5 px-2 text-center font-black text-xs sm:text-sm bg-slate-50 text-slate-950">
                                    {targetCode}
                                  </td>
                                  <td className="border border-black py-1.5 px-3 font-bold uppercase text-[11px] text-slate-950">
                                    {archer.name}
                                  </td>
                                  <td className="border border-black py-1.5 px-3 font-semibold uppercase text-[10px] text-slate-800">
                                    {archer.club || '-'}
                                  </td>
                                  <td className="border border-black py-1.5 px-1 text-center text-[10px] font-bold text-slate-700">
                                    {archer.wave || 1}
                                  </td>
                                  {showPinColumn && (
                                    <td className="border border-black py-1.5 px-2 text-center font-mono text-[10px] font-bold text-slate-700">
                                      {archer.pin || '-'}
                                    </td>
                                  )}
                                  <td className="border border-black py-1.5 px-2 text-center text-[8px] font-black uppercase text-emerald-800">
                                    {archer.status || 'OK'}
                                  </td>
                                  {showSignatureColumn && (
                                    <td className="border border-black py-1.5 px-2 text-center text-[9px] text-slate-400 italic">
                                      ....................
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>

                      {/* Footer Signatures for Each Category Sheet */}
                      <div className="mt-8 pt-4 flex justify-between items-end text-center text-xs font-bold text-black border-t border-dashed border-slate-300">
                        <div className="w-56">
                          <p className="text-[10px] text-slate-600 mb-12">
                            Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <div className="border-b border-black mb-1"></div>
                          <p className="uppercase font-black text-[10px]">Koordinator Lapangan / TD</p>
                        </div>
                        <div className="w-56">
                          <p className="text-[10px] text-slate-600 mb-12">{tournamentLocation}</p>
                          <div className="border-b border-black mb-1"></div>
                          <p className="uppercase font-black text-[10px]">Ketua Panitia Pelaksana</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
