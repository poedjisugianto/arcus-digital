import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Search, Printer, Download, Users, 
  CheckCircle2, Info, Building2, Target, ShieldCheck, 
  Sparkles, Smartphone, QrCode, RefreshCw, X, ChevronRight,
  Filter, Check, User
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ArcheryEvent, Archer, CategoryType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import ArcusLogo from './ArcusLogo';

interface Props {
  event: ArcheryEvent;
  onBack: () => void;
  initialClub?: string;
  initialSearch?: string;
}

export default function SelfServiceIdCardPortal({ 
  event, 
  onBack, 
  initialClub = '', 
  initialSearch = '' 
}: Props) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedClub, setSelectedClub] = useState<string>(initialClub);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedParticipant, setSelectedParticipant] = useState<Archer | null>(null);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ARCHERS' | 'OFFICIALS'>('ALL');

  // Consolidate all participants (Archers + Officials + Registrations)
  const allParticipants = useMemo(() => {
    const list: Archer[] = [];
    const idMap = new Set<string>();

    // 1. From archers
    (event.archers || []).forEach(a => {
      if (!idMap.has(a.id)) {
        idMap.add(a.id);
        list.push(a);
      }
    });

    // 2. From registrations (if any not yet in archers)
    (event.registrations || []).forEach((r: any) => {
      if (!idMap.has(r.id)) {
        idMap.add(r.id);
        list.push({
          ...r,
          targetNo: r.targetNo || 0,
          wave: r.wave || 1,
          category: r.category || CategoryType.OFFICIAL
        });
      }
    });

    // 3. From officials
    (event.officials || []).forEach((o: any) => {
      if (!idMap.has(o.id)) {
        idMap.add(o.id);
        list.push({
          ...o,
          category: CategoryType.OFFICIAL,
          targetNo: 0,
          wave: 1
        });
      }
    });

    return list;
  }, [event.archers, event.registrations, event.officials]);

  // Extract unique clubs with participant count
  const clubsSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    allParticipants.forEach(p => {
      const clubName = (p.club || 'Umum / Mandiri').trim();
      counts[clubName] = (counts[clubName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allParticipants]);

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allParticipants.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [allParticipants]);

  // Filter participants
  const filteredParticipants = useMemo(() => {
    return allParticipants.filter(p => {
      const matchesSearch = !searchTerm.trim() || 
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.club || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.registrationNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (`${p.targetNo}${p.position || ''}`).toLowerCase().includes(searchTerm.toLowerCase());

      const matchesClub = !selectedClub || 
        (p.club || 'Umum / Mandiri').toLowerCase() === selectedClub.toLowerCase();

      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

      const matchesTab = activeTab === 'ALL' || 
        (activeTab === 'OFFICIALS' && p.category === CategoryType.OFFICIAL) ||
        (activeTab === 'ARCHERS' && p.category !== CategoryType.OFFICIAL);

      return matchesSearch && matchesClub && matchesCategory && matchesTab;
    });
  }, [allParticipants, searchTerm, selectedClub, selectedCategory, activeTab]);

  // Trigger browser print for single or batch
  const handlePrintSingle = (participant: Archer) => {
    setSelectedParticipant(participant);
    setIsBatchPrinting(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePrintBatch = () => {
    setSelectedParticipant(null);
    setIsBatchPrinting(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const tournamentName = event.settings?.tournamentName || 'Turnamen Panahan';
  const eventDate = event.settings?.eventDate || 'Jadwal Turnamen';
  const location = event.settings?.location || 'Lokasi Pertandingan';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-arcus-red selection:text-white">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-id-card-area, #printable-id-card-area * {
            visibility: visible;
          }
          #printable-id-card-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-after {
            page-break-after: always;
            break-after: page;
          }
          .id-card-print-item {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Top Header Navigation (Screen Only) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <ArcusLogo className="w-8 h-8 sm:w-10 sm:h-10" />
              <div>
                <h1 className="text-sm sm:text-lg font-black font-oswald uppercase italic tracking-tight text-slate-900 leading-none">
                  Cetak Kartu Peserta Mandiri
                </h1>
                <p className="text-[10px] font-bold text-arcus-red uppercase tracking-widest mt-0.5">
                  {tournamentName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {filteredParticipants.length > 0 && (
              <button
                onClick={handlePrintBatch}
                className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-slate-900 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-arcus-red transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Cetak Semua Hasil</span> ({filteredParticipants.length})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 no-print">
        
        {/* Notice & Instructions Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-radial from-arcus-red/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-arcus-red rounded-xl text-white shadow-md">
                  <QrCode className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base sm:text-xl font-black font-oswald uppercase italic tracking-wide">
                    E-ID Card &amp; Presensi Mandiri
                  </h2>
                  <p className="text-xs text-slate-300">
                    Cetak atau simpan kartu ini di HP untuk verifikasi cepat di meja registrasi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto bg-white/10 px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>QR Presensi 1 Detik</span>
              </div>
            </div>

            {/* 3 Step Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-arcus-red text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Cari Data Anda</h4>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Ketik nama atlet, no. pendaftaran, atau pilih <b>nama klub</b> Anda.
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-arcus-red text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Unduh / Cetak Kartu</h4>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Cetak di kertas / simpan screenshot kartu digital ke galeri HP Anda.
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-arcus-red text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Tunjukkan Saat Hadir</h4>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Tunjukkan QR Code ke kamera scanner panitia saat tiba di lapangan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Universal Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari nama atlet, nomor WA, no. registrasi, atau bantalan..."
                className="w-full pl-10 pr-9 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-arcus-red transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Club Filter Dropdown */}
            <div className="md:col-span-3">
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedClub}
                  onChange={e => setSelectedClub(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-arcus-red transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- SEMUA KLUB / KONTINGEN --</option>
                  {clubsSummary.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count} Peserta)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category Filter */}
            <div className="md:col-span-3">
              <div className="relative">
                <Target className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-arcus-red transition-all appearance-none cursor-pointer"
                >
                  <option value="ALL">-- SEMUA KATEGORI --</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat as CategoryType] || cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Club Chips for Fast Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-arcus-red" />
                Pilih Klub untuk Cetak Kolektif:
              </span>
              {selectedClub && (
                <button
                  onClick={() => setSelectedClub('')}
                  className="text-[10px] font-bold text-arcus-red hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Reset Pilihan Klub
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
              <button
                onClick={() => setSelectedClub('')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  !selectedClub 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Semua ({allParticipants.length})
              </button>
              {clubsSummary.slice(0, 15).map(club => {
                const isSelected = selectedClub === club.name;
                return (
                  <button
                    key={club.name}
                    onClick={() => setSelectedClub(isSelected ? '' : club.name)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-arcus-red text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{club.name}</span>
                    <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {club.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Club Banner when selected */}
          {selectedClub && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    Pendaftaran Kolektif: {selectedClub}
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Ditemukan <b>{filteredParticipants.length} Peserta</b> dari kontingen ini.
                  </p>
                </div>
              </div>
              <button
                onClick={handlePrintBatch}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Semua Kartu Tim ({filteredParticipants.length} Kartu)
              </button>
            </div>
          )}
        </div>

        {/* Results Counter & Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Daftar Peserta &amp; Kartu ID ({filteredParticipants.length})
            </h3>
            <span className="text-[10px] font-bold text-slate-600">
              Klik pada kartu untuk pratinjau &amp; cetak
            </span>
          </div>

          {filteredParticipants.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-black uppercase italic text-slate-900">
                Tidak ada data peserta yang cocok
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Coba ubah kata kunci pencarian, nomor pendaftaran, atau reset filter klub Anda.
              </p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedClub(''); setSelectedCategory('ALL'); }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase hover:bg-arcus-red transition-all"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredParticipants.map((p) => {
                const isOfficial = p.category === CategoryType.OFFICIAL;
                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Visual Card Header */}
                    <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          isOfficial ? 'bg-blue-600 text-white' : 'bg-arcus-red text-white'
                        }`}>
                          {isOfficial ? 'OFFICIAL CREW' : (CATEGORY_LABELS[p.category as CategoryType] || p.category)}
                        </span>
                        <span className="text-[9px] font-mono text-slate-300">
                          {p.id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-white/60" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black font-oswald uppercase italic tracking-tight text-white truncate group-hover:text-amber-400 transition-colors">
                            {p.name}
                          </h4>
                          <p className="text-[10px] text-slate-300 truncate font-semibold uppercase">
                            {p.club || 'Umum / Mandiri'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card Body Info */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-slate-50/50">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-[8px] font-bold text-slate-600 uppercase block">Target / Bantalan</span>
                          <span className="text-base font-black font-oswald text-arcus-red italic">
                            {p.targetNo && p.targetNo > 0 ? `${p.targetNo}${p.position || ''}` : '-'}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-[8px] font-bold text-slate-600 uppercase block">Gelombang / Sesi</span>
                          <span className="text-base font-black font-oswald text-slate-900 italic">
                            Sesi {p.wave || 1}
                          </span>
                        </div>
                      </div>

                      {/* QR Preview Mini */}
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-slate-100 rounded-lg">
                            <QRCodeSVG value={p.id} size={34} level="M" />
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-slate-600 uppercase block">No. Pendaftaran</span>
                            <span className="text-[10px] font-mono font-bold text-slate-800">
                              {p.registrationNo || p.id.substring(0, 8)}
                            </span>
                          </div>
                        </div>
                        {p.checkedIn && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-black rounded-md uppercase">
                            Hadir
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => setSelectedParticipant(p)}
                          className="py-2.5 bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                          Pratinjau
                        </button>
                        <button
                          onClick={() => handlePrintSingle(p)}
                          className="py-2.5 bg-slate-900 text-white hover:bg-arcus-red rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Cetak
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Preview Single Card (Screen Only) */}
      {selectedParticipant && !isBatchPrinting && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-arcus-red" />
                <h3 className="text-sm font-black font-oswald uppercase italic text-slate-900">
                  Pratinjau Kartu Peserta
                </h3>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Standar ID Card Mockup (2:3 Aspect Ratio) */}
            <div className="max-w-[280px] mx-auto w-full aspect-[2/3] bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 rounded-2xl shadow-xl border-2 border-slate-800 p-5 flex flex-col justify-between text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-arcus-red/20 rounded-full blur-2xl pointer-events-none" />
              
              {/* Card Header */}
              <div className="flex items-center justify-between relative z-10">
                <ArcusLogo className="w-6 h-6" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                  E-PASS IDENTITAS
                </span>
              </div>

              {/* Middle Section */}
              <div className="text-center space-y-3 relative z-10 my-auto">
                {/* Photo & QR side-by-side or stacked */}
                <div className="flex items-center justify-center gap-3">
                  <div className="w-16 h-20 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                    {selectedParticipant.photoUrl ? (
                      <img src={selectedParticipant.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-white/50" />
                    )}
                  </div>
                  <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
                    <QRCodeSVG value={selectedParticipant.id} size={64} level="H" />
                  </div>
                </div>

                <div>
                  <span className={`inline-block px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    selectedParticipant.category === CategoryType.OFFICIAL ? 'bg-blue-600 text-white' : 'bg-arcus-red text-white'
                  }`}>
                    {selectedParticipant.category === CategoryType.OFFICIAL 
                      ? 'OFFICIAL CREW' 
                      : (CATEGORY_LABELS[selectedParticipant.category as CategoryType] || selectedParticipant.category)}
                  </span>
                  <h3 className="text-base font-black font-oswald uppercase italic tracking-tight text-white mt-1 leading-tight">
                    {selectedParticipant.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-300 uppercase mt-0.5">
                    {selectedParticipant.club || 'Umum / Mandiri'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-white/10 rounded-xl p-2 border border-white/10">
                  <div>
                    <span className="text-[7px] font-bold text-slate-400 uppercase block">Target</span>
                    <span className="text-sm font-black font-oswald text-yellow-400">
                      {selectedParticipant.targetNo && selectedParticipant.targetNo > 0 ? `${selectedParticipant.targetNo}${selectedParticipant.position || ''}` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[7px] font-bold text-slate-400 uppercase block">Sesi</span>
                    <span className="text-sm font-black font-oswald text-white">
                      Sesi {selectedParticipant.wave || 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="text-center pt-2 border-t border-white/10 relative z-10">
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  {tournamentName}
                </p>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Anda dapat melakukan <b>screenshot</b> tampilan kartu ini di smartphone Anda untuk ditunjukkan ke panitia saat presensi.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedParticipant(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold uppercase hover:bg-slate-200 transition-all"
              >
                Tutup
              </button>
              <button
                onClick={() => handlePrintSingle(selectedParticipant)}
                className="flex-1 py-3 bg-slate-900 hover:bg-arcus-red text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Cetak Kartu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT AREA (Hidden in normal UI, visible only when user clicks Print)       */}
      {/* ========================================================================= */}
      <div id="printable-id-card-area" className="hidden print:block">
        <div className="text-center mb-6 pb-4 border-b border-slate-300">
          <h1 className="text-xl font-black font-oswald uppercase italic tracking-tight text-black">
            {tournamentName}
          </h1>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Kartu Peserta Resmi &bull; {eventDate} &bull; {location}
          </p>
          {selectedClub && isBatchPrinting && (
            <p className="text-xs font-black text-black uppercase mt-1">
              Kolektif Kontingen: {selectedClub} ({filteredParticipants.length} Peserta)
            </p>
          )}
        </div>

        {/* Grid of ID cards for Printing (Formatted 2x2 or 2x3 per page) */}
        <div className="grid grid-cols-2 gap-6">
          {(isBatchPrinting ? filteredParticipants : selectedParticipant ? [selectedParticipant] : []).map((person, idx) => {
            const isOfficial = person.category === CategoryType.OFFICIAL;
            return (
              <div
                key={person.id}
                className="id-card-print-item w-[85mm] h-[125mm] mx-auto border-2 border-black rounded-2xl p-4 flex flex-col justify-between bg-white text-black relative break-inside-avoid"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-800 block">ARCUS ARCHERY OS</span>
                    <h4 className="text-[10px] font-black font-oswald uppercase italic truncate max-w-[50mm]">
                      {tournamentName}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[7px] font-bold uppercase text-slate-700 block">ID PESERTA</span>
                    <span className="text-[9px] font-mono font-black">{person.id.slice(-6).toUpperCase()}</span>
                  </div>
                </div>

                {/* Badge Category */}
                <div className="text-center my-1">
                  <span className={`inline-block px-3 py-0.5 rounded-full text-[9px] font-black uppercase border border-black ${
                    isOfficial ? 'bg-slate-200 text-black' : 'bg-black text-white'
                  }`}>
                    {isOfficial ? 'OFFICIAL CREW' : (CATEGORY_LABELS[person.category as CategoryType] || person.category)}
                  </span>
                </div>

                {/* Center Content: Photo & QR */}
                <div className="flex items-center justify-center gap-3 my-2">
                  <div className="w-[28mm] h-[36mm] border-2 border-black rounded-xl flex items-center justify-center overflow-hidden bg-slate-50">
                    {person.photoUrl ? (
                      <img src={person.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2">
                        <User className="w-8 h-8 mx-auto text-slate-400" />
                        <span className="text-[7px] font-bold text-slate-500 uppercase block mt-1">FOTO PESERTA</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-2 border-black rounded-xl flex flex-col items-center justify-center">
                    <QRCodeSVG value={person.id} size={80} level="H" />
                    <span className="text-[7px] font-mono font-bold mt-1 text-center">
                      {person.registrationNo || person.id.substring(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Name & Club */}
                <div className="text-center space-y-0.5 border-t border-b border-dashed border-slate-300 py-1.5">
                  <h3 className="text-sm font-black font-oswald uppercase italic leading-tight">
                    {person.name}
                  </h3>
                  <p className="text-[10px] font-bold uppercase text-slate-800">
                    {person.club || 'Umum / Mandiri'}
                  </p>
                </div>

                {/* Target & Wave Boxes */}
                <div className="grid grid-cols-2 gap-2 text-center my-1">
                  <div className="border border-black rounded-lg p-1">
                    <span className="text-[7px] font-bold uppercase block text-slate-700">Bantalan</span>
                    <span className="text-sm font-black font-oswald italic">
                      {person.targetNo && person.targetNo > 0 ? `${person.targetNo}${person.position || ''}` : '-'}
                    </span>
                  </div>
                  <div className="border border-black rounded-lg p-1">
                    <span className="text-[7px] font-bold uppercase block text-slate-700">Gelombang / Sesi</span>
                    <span className="text-sm font-black font-oswald italic">
                      Sesi {person.wave || 1}
                    </span>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="text-center pt-1 border-t border-black text-[7px] font-bold text-slate-700 uppercase">
                  Tunjukkan barcode/QR saat daftar ulang di meja registrasi
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
