import React, { useState, useMemo } from 'react';
import { 
  Search, Trash2, ArrowLeft, 
  X, Check, UserPlus, Printer, Users as UsersIcon, Image as ImageIcon, FileDown, Pencil
} from 'lucide-react';
import { Archer, CategoryType, TournamentSettings, GlobalSettings, RegistrationStatus, ParticipantRegistration } from '../types';
import { CATEGORY_LABELS } from '../constants';
import OfficialEditModal from './OfficialEditModal';

interface Props {
  officials: ParticipantRegistration[];
  onUpdate: (official: ParticipantRegistration) => void;
  onRemove: (id: string) => void;
  onGoToIdCardEditor?: () => void;
  onBack: () => void;
  settings: TournamentSettings;
}

const OfficialList: React.FC<Props> = ({ officials, onUpdate, onRemove, onGoToIdCardEditor, onBack, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOfficial, setEditingOfficial] = useState<ParticipantRegistration | null>(null);
  const [officialToDelete, setOfficialToDelete] = useState<ParticipantRegistration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    return (officials || []).filter(o => 
      !o ? false : (
        (o.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (o.club || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (o.email || '').toLowerCase().includes((searchTerm || '').toLowerCase())
      )
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [officials, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = filtered;
      if (dataToExport.length === 0) {
        alert("Tidak ada data untuk diekspor");
        return;
      }

      const headers = ["Nama", "No KTA", "Klub", "Kontak", "Email", "Status"];
      const csvRows = [];
      csvRows.push(headers.join(","));

      for (const o of dataToExport) {
        const row = [
          `"${o.name}"`,
          `"${o.ktaNumber || '-'}"`,
          `"${o.club}"`,
          `"${o.phone || '-'}"`,
          `"${o.email || '-'}"`,
          `"${o.status}"`
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Data_Official_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Gagal mengekspor data: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FBFBFD] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm"><ArrowLeft className="w-5 h-5 text-slate-800" /></button>
          <div className="flex flex-col">
             <h2 className="text-xl font-black font-oswald uppercase italic tracking-tighter text-slate-900">Manajemen Official</h2>
             <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest leading-none">Database Tim Pendukung</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={onGoToIdCardEditor}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-600/20"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Kartu Official
          </button>
          <button 
            onClick={handlePrint}
            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-slate-200 transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Daftar
          </button>
          <button 
            onClick={handleExportCSV}
            className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100"
          >
            <FileDown className="w-3.5 h-3.5" />
            Ekspor CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input 
              type="text" 
              placeholder="Cari nama atau klub official..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white transition-all text-xs font-bold outline-none text-slate-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Official / Pelatih</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">No. KTA</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Klub / Pengcab</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Kontak</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                        {(o.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-black text-slate-900 uppercase italic font-oswald">{o.name || 'TANPA NAMA'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {o.ktaNumber ? (
                      <span className="font-mono font-bold text-[10px] text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block uppercase">
                        {o.ktaNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-bold italic text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-800 uppercase">{o.club}</td>
                  <td className="px-6 py-4">
                    <p className="text-[10px] font-black text-slate-600">{o.phone || '-'}</p>
                    <p className="text-[8px] font-bold text-slate-700">{o.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={o.status}
                      onChange={(e) => onUpdate({ ...o, status: e.target.value as RegistrationStatus })}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${
                        o.status === RegistrationStatus.APPROVED || o.status === RegistrationStatus.CONFIRMED
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : o.status === RegistrationStatus.REJECTED
                          ? 'bg-red-50 text-red-600 border-red-100'
                          : o.status === RegistrationStatus.PAID
                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}
                    >
                      <option value={RegistrationStatus.PENDING}>Pending</option>
                      <option value={RegistrationStatus.PAID}>Paid</option>
                      <option value={RegistrationStatus.APPROVED}>Approved</option>
                      <option value={RegistrationStatus.CONFIRMED}>Confirmed</option>
                      <option value={RegistrationStatus.REJECTED}>Rejected</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                         onClick={() => setEditingOfficial(o)}
                         className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                         title="Edit Data Official"
                       >
                         <Pencil className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => setOfficialToDelete(o)} 
                         className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                         title="Hapus Official"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <UsersIcon className="w-12 h-12" />
                      <p className="text-xs font-black uppercase tracking-widest">Tidak ada data official</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Print Content */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8">
         <div className="text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-bold uppercase">{settings.tournamentName}</h1>
            <h2 className="text-xl font-bold uppercase mt-1">Daftar Akreditasi Official / Manager</h2>
         </div>
         <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-2 text-sm text-left">Nama Lengkap</th>
                <th className="border border-black p-2 text-sm text-left">Asal Klub</th>
                <th className="border border-black p-2 text-sm text-left">Status</th>
                <th className="border border-black p-2 text-sm text-right">TTD</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td className="border border-black p-2 text-xs uppercase font-bold">{o.name}</td>
                  <td className="border border-black p-2 text-xs uppercase">{o.club}</td>
                  <td className="border border-black p-2 text-xs uppercase">{o.status === 'APPROVED' || o.status === 'CONFIRMED' || o.status === 'PAID' ? 'TERVALIDASI' : 'PENDING'}</td>
                  <td className="border border-black p-2 text-xs h-12 w-32"></td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>

      {/* Edit Official Modal */}
      <OfficialEditModal
        isOpen={!!editingOfficial}
        official={editingOfficial}
        onClose={() => setEditingOfficial(null)}
        onSave={async (updated) => {
          await onUpdate(updated);
          setEditingOfficial(null);
        }}
        settings={settings}
      />

      {/* Delete Official Confirmation Modal */}
      {officialToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 sm:p-7 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0 shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black font-oswald uppercase italic tracking-wide text-slate-900 leading-tight">
                  Hapus Data Official?
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
              <p className="font-black text-slate-900 text-sm">{officialToDelete.name}</p>
              <p className="text-slate-600 font-medium">Klub: <span className="font-bold text-slate-800">{officialToDelete.club}</span></p>
              <p className="text-slate-600 font-medium">Kontak: <span className="font-bold text-slate-800">{officialToDelete.phone || '-'}</span></p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOfficialToDelete(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!officialToDelete) return;
                  setIsDeleting(true);
                  try {
                    await onRemove(officialToDelete.id);
                    setOfficialToDelete(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficialList;
