
import React, { useState, useMemo } from 'react';
import { ArcheryEvent, ParticipantRegistration, Archer, GlobalSettings, CategoryType } from '../types';
import { 
  DollarSign, X, Check, Copy, Landmark, Clock, 
  TrendingUp, CreditCard, ArrowUpRight, AlertCircle, 
  Receipt, ShieldCheck, Zap, Info, Printer, Search, ExternalLink, Filter
} from 'lucide-react';
import ArcusLogo from './ArcusLogo';
import { CATEGORY_LABELS } from '../constants';

interface Props {
  event: ArcheryEvent;
  globalSettings: GlobalSettings;
  onApproveRegistration: (regId: string) => void;
  onPayPlatformFee: (eventId: string) => void;
  onBack: () => void;
  isSuperAdmin?: boolean;
}

const FinancePanel: React.FC<Props> = ({ event, globalSettings, onApproveRegistration, onPayPlatformFee, onBack, isSuperAdmin = false }) => {
  const [copied, setCopied] = useState(false);
  const [showProofOverlay, setShowProofOverlay] = useState<{ 
    url: string; 
    id: string; 
    name?: string; 
    club?: string; 
    amount?: number; 
    category?: string;
    isPending?: boolean;
  } | null>(null);
  const [showSavedFlag, setShowSavedFlag] = useState(false);
  const [flagMessage, setFlagMessage] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'WITH_PROOF'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  const isKidsCategory = (cat: string) => {
    return [
      'U18_PUTRA', 'U18_PUTRI', 
      'U12_PUTRA', 'U12_PUTRI', 
      'U9_PUTRA', 'U9_PUTRI'
    ].includes(cat);
  };

  // Simplify: Use registrations list primarily for verification
  // and include archers/officials only for total count reference
  const uniqueParticipants = Array.from(
    new Map([
      ...(event.archers || []),
      ...(event.officials || []),
      ...(event.registrations || [])
    ].map(p => [p.id || (p as any).email, p])).values()
  );
  
  // Pending registrations are those in registrations array PLUS anyone pending in archers/officials
  const pendingFromRegs = event.registrations || [];
  const pendingFromArchers = (event.archers || []).filter(a => a.status === 'PENDING' || !a.status);
  const pendingFromOfficials = (event.officials || []).filter(o => o.status === 'PENDING' || !o.status);
  
  // Combine and deduplicate
  const pendingRegistrations = Array.from(
    new Map([
      ...pendingFromArchers,
      ...pendingFromOfficials,
      ...pendingFromRegs
    ].map(p => [p.id, p])).values()
  );

  // All combined participants for full verification history
  const allRegistrations = useMemo(() => {
    const entries: [string, any][] = [
      ...(event.archers || []).map(a => [a.id, { ...a, regType: 'ARCHER' as const }] as [string, any]),
      ...(event.officials || []).map(o => [o.id, { ...o, regType: 'OFFICIAL' as const }] as [string, any]),
      ...(event.registrations || []).map(r => [r.id, r] as [string, any])
    ];
    return Array.from(new Map<string, any>(entries).values());
  }, [event.archers, event.officials, event.registrations]);

  const countWithProof = useMemo(() => {
    return allRegistrations.filter(r => !!(r.paymentProof || r.paymentProofUrl)).length;
  }, [allRegistrations]);

  const displayRegistrations = useMemo(() => {
    return allRegistrations.filter(reg => {
      const isPending = reg.status === 'PENDING' || !reg.status;
      const isConfirmed = reg.status === 'CONFIRMED' || reg.status === 'APPROVED' || reg.status === 'PAID';
      const hasProof = !!(reg.paymentProof || reg.paymentProofUrl);

      if (filterTab === 'PENDING' && !isPending) return false;
      if (filterTab === 'CONFIRMED' && !isConfirmed) return false;
      if (filterTab === 'WITH_PROOF' && !hasProof) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (reg.name || '').toLowerCase().includes(q);
        const matchesClub = (reg.club || '').toLowerCase().includes(q);
        const matchesEmail = (reg.email || '').toLowerCase().includes(q);
        const matchesPhone = (reg.phone || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClub && !matchesEmail && !matchesPhone) return false;
      }

      return true;
    });
  }, [allRegistrations, filterTab, searchQuery]);

  const totalRevenue = uniqueParticipants.reduce((acc, curr) => acc + (curr.totalPaid || (curr as any).platformFee || 0), 0);
  
  const totalPlatformFees = event.settings.isFreeEvent ? 0 : uniqueParticipants.reduce((acc, curr) => {
    const fee = curr.platformFee && curr.platformFee > 0 
      ? curr.platformFee 
      : (isKidsCategory(curr.category) ? globalSettings.feeKids : globalSettings.feeAdult);
    return acc + fee;
  }, 0);
  const netBalance = totalRevenue - totalPlatformFees;
  const isFeePaid = event.settings.platformFeePaidToOwner || event.settings.isFreeEvent;

  const triggerFlag = (msg: string) => {
    setFlagMessage(msg);
    setShowSavedFlag(true);
    setTimeout(() => setShowSavedFlag(false), 3000);
  };

  const copyRegLink = () => {
    const url = window.location.origin + "?event=" + event.id;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = (id: string) => {
    onApproveRegistration(id);
    triggerFlag("Pendaftaran Berhasil Dikonfirmasi");
  };

  const handlePayFee = () => {
    onPayPlatformFee(event.id);
    triggerFlag("Fee Platform Berhasil Dibayar");
  };

  return (
    <div className="space-y-6 relative">
      {/* Saved Success Flag */}
      {showSavedFlag && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white">
            <Check className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">{flagMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div className="flex items-center gap-4">
           <div className="bg-slate-50 p-3 rounded-2xl border">
              <DollarSign className="w-6 h-6 text-arcus-red" />
           </div>
           <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-oswald uppercase italic leading-none">Laporan Finansial</h3>
                {event.settings.isFreeEvent && (
                  <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter">Internal / Free</span>
                )}
              </div>
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-1">Sistem: Pembayaran Terpusat (Super Admin)</p>
           </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={copyRegLink}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${copied ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Link Pendaftaran' : 'Link Pendaftaran'}
          </button>
          <button onClick={onBack} className="p-3 bg-slate-50 text-slate-700 hover:text-arcus-red rounded-2xl border transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Revenue vs Fee Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5">
           <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
                    <TrendingUp className="w-5 h-5" />
                 </div>
                 <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">Total Akumulasi Pendaftaran (Bruto)</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <div className="space-y-1">
                   <p className="text-6xl font-black font-oswald italic tracking-tighter tabular-nums text-emerald-400">Rp {totalRevenue.toLocaleString()}</p>
                   <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest italic">Total uang masuk via Gateway & Manual ke Rekening Pusat</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-3">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-700">
                      <span>Total Biaya Platform</span>
                      <span className="text-orange-400">- Rp {totalPlatformFees.toLocaleString()}</span>
                   </div>
                   <div className="h-px bg-white/10"></div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Saldo Bersih Panitia</span>
                      <span className="text-xl font-bold font-oswald text-white tabular-nums">Rp {netBalance.toLocaleString()}</span>
                   </div>
                </div>
              </div>
              <div className="pt-4 flex items-center gap-4">
                 <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Aliran Dana: Dikelola Super Admin</span>
                 </div>
              </div>
           </div>
           <ArcusLogo className="absolute right-[-40px] bottom-[-40px] w-64 h-64 opacity-[0.03] rotate-12 pointer-events-none" />
        </div>

        <div className={`rounded-[3rem] p-10 flex flex-col justify-between relative overflow-hidden shadow-xl border ${isFeePaid ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
           <div className="space-y-6">
              <div className="flex items-center justify-between">
                 <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isFeePaid ? 'text-green-600' : 'text-slate-600'}`}>Status Pencairan Dana</h4>
                 {isFeePaid ? <ShieldCheck className="w-6 h-6 text-green-600" /> : <Clock className="w-6 h-6 text-slate-700" />}
              </div>
              <div>
                 <p className={`text-4xl font-black font-oswald italic leading-none ${isFeePaid ? 'text-green-700' : 'text-slate-700'}`}>Rp {netBalance.toLocaleString()}</p>
                 <p className={`text-[9px] font-bold uppercase mt-2 ${isFeePaid ? 'text-green-600' : 'text-slate-800'}`}>
                    {isFeePaid ? 'Sudah Dicairkan ke Panitia' : 'Tersedia untuk Dicairkan'}
                 </p>
              </div>
           </div>
           
           {!isFeePaid && netBalance > 0 && isSuperAdmin && (
             <button 
               onClick={handlePayFee}
               className="mt-8 bg-emerald-600 text-white w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-3"
             >
               Konfirmasi Pencairan <Landmark className="w-4 h-4" />
             </button>
           )}

           {isFeePaid && (
             <div className="mt-8 bg-green-600/10 border border-green-200 p-4 rounded-2xl text-center">
                <p className="text-[9px] font-black text-green-700 uppercase tracking-widest">Dana Telah Ditransfer ke Rekening Panitia</p>
             </div>
           )}
        </div>
      </div>

      {/* Verification List & Proof Inspector */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 sm:px-8 py-6 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black font-oswald uppercase text-slate-900 flex items-center gap-3 italic text-lg">
              <Receipt className="w-5 h-5 text-emerald-600" /> Verifikasi Pendaftaran & Bukti Transfer
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Cek foto struk pembayaran peserta, konfirmasi keikutsertaan, atau filter berdasarkan status
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-blue-100">
              Total: {uniqueParticipants.length}
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-amber-200">
              Pending: {pendingRegistrations.length}
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-200">
              Ada Bukti: {countWithProof}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 sm:px-8 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterTab('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filterTab === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Menunggu Konfirmasi ({pendingRegistrations.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('WITH_PROOF')}
              className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filterTab === 'WITH_PROOF'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ada Bukti Transfer ({countWithProof})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('CONFIRMED')}
              className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filterTab === 'CONFIRMED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sudah Disetujui
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filterTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({allRegistrations.length})
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pemanah / klub / kontak..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
 
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[9px] font-black uppercase tracking-widest border-b text-slate-700">
                <th className="px-8 py-4">Pemanah & Klub</th>
                <th className="px-8 py-4">Kontak</th>
                <th className="px-8 py-4">Metode</th>
                <th className="px-8 py-4 text-center">Bukti Bayar</th>
                <th className="px-8 py-4 text-right">Nominal</th>
                <th className="px-8 py-4 text-right pr-12">Status / Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRegistrations.map(reg => {
                const isPending = reg.status === 'PENDING' || !reg.status;
                const proofUrl = reg.paymentProofUrl || reg.paymentProof;
                return (
                  <tr key={reg.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-900 uppercase font-oswald italic leading-none">{reg.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-700 font-black uppercase">{reg.club}</span>
                        {reg.category && (
                          <span className="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded uppercase">
                            {CATEGORY_LABELS[reg.category as CategoryType] || reg.category}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-[10px] font-black text-slate-600">{reg.phone || '-'}</p>
                      <p className="text-[8px] text-slate-700 truncate max-w-[140px]">{reg.email || '-'}</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border text-center ${reg.paymentType === 'GATEWAY' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                          {reg.paymentType || 'MANUAL'}
                        </span>
                        {reg.paymentType === 'GATEWAY' && (
                          <span className="text-[7px] font-bold text-blue-500 uppercase tracking-tighter flex items-center gap-1">
                            <Zap className="w-2 h-2" /> Auto-Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {proofUrl ? (
                        <div className="flex flex-col items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => setShowProofOverlay({ 
                              url: proofUrl, 
                              id: reg.id,
                              name: reg.name,
                              club: reg.club,
                              amount: reg.totalPaid || 0,
                              category: reg.category,
                              isPending
                            })} 
                            className="w-12 h-12 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-sm hover:scale-110 hover:shadow-md transition-all relative group/thumb cursor-pointer"
                            title="Klik untuk memperbesar bukti transfer"
                          >
                            <img src={proofUrl} className="w-full h-full object-cover" alt="Bukti Transfer" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white text-[8px] font-bold">
                              Lihat
                            </div>
                          </button>
                          <span className="text-[8px] font-black text-emerald-700 uppercase tracking-wider">
                            Ada Bukti
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic font-bold">
                          {reg.paymentType === 'GATEWAY' ? 'Otomatis/Gateway' : 'Tanpa Bukti'}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right font-black text-slate-900">
                      Rp {(reg.totalPaid || 0).toLocaleString()}
                    </td>
                    <td className="px-8 py-5 text-right pr-12">
                      {isPending ? (
                        <button 
                          type="button"
                          onClick={() => handleApprove(reg.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 ml-auto"
                        >
                          <Check className="w-3.5 h-3.5" /> SETUJUI
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3" /> {reg.status || 'CONFIRMED'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayRegistrations.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Receipt className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-600 font-black uppercase tracking-widest text-xs">
                      Tidak ada data pendaftaran yang sesuai
                    </p>
                    <p className="text-slate-400 text-[10px] mt-1">
                      Coba ubah kata kunci pencarian atau pilih tab filter lain.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Overlay Modal */}
      {showProofOverlay && (
        <div 
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[500] flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in" 
          onClick={() => setShowProofOverlay(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Info */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">
                  Bukti Transfer Pendaftaran
                </span>
                <h4 className="text-base font-black font-oswald uppercase italic text-white leading-tight">
                  {showProofOverlay.name || 'Peserta'}
                </h4>
                <p className="text-[10px] text-slate-300 font-bold">
                  {showProofOverlay.club || '-'} • Rp {(showProofOverlay.amount || 0).toLocaleString()}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowProofOverlay(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Proof Image Box */}
            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto max-h-[60vh]">
              <img 
                src={showProofOverlay.url} 
                className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-lg border border-white/10" 
                alt="Bukti Transfer Penuh" 
              />
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <a 
                href={showProofOverlay.url} 
                target="_blank" 
                rel="noreferrer"
                className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-xs"
              >
                <ExternalLink className="w-3 h-3" /> Buka Tab Baru
              </a>

              <div className="flex items-center gap-2">
                {showProofOverlay.isPending && (
                  <button 
                    type="button"
                    onClick={() => {
                      handleApprove(showProofOverlay.id);
                      setShowProofOverlay(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> SETUJUI PENDAFTARAN
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setShowProofOverlay(null)}
                  className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePanel;
