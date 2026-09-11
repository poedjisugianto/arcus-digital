import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Clock, AlertTriangle, Check, X, Wrench, Headphones, Lock } from 'lucide-react';
import { TechnicalSupportAccess, TournamentSettings } from '../types';
import { useSupportCountdown } from '../lib/supportAccess';

interface Props {
  settings: TournamentSettings;
  onUpdateSettings: (updates: Partial<TournamentSettings>) => void;
  currentUserEmail?: string;
  isSuperAdmin?: boolean;
}

export const TechnicalSupportCard: React.FC<Props> = ({
  settings,
  onUpdateSettings,
  currentUserEmail,
  isSuperAdmin = false,
}) => {
  const support = settings.technicalSupport;
  const countdown = useSupportCountdown(support);
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [issueNote, setIssueNote] = useState<string>(support?.issueNote || '');
  const [isActivating, setIsActivating] = useState(false);

  const handleGrantAccess = () => {
    const now = Date.now();
    const durationHours = selectedDuration;
    const expiresAt = now + durationHours * 60 * 60 * 1000;

    const newSupport: TechnicalSupportAccess = {
      enabled: true,
      grantedAt: now,
      expiresAt,
      durationHours,
      issueNote: issueNote.trim() || 'Permintaan bantuan teknis turnamen',
      grantedByEmail: currentUserEmail || 'Penyelenggara'
    };

    onUpdateSettings({ technicalSupport: newSupport });
    setIsActivating(false);
  };

  const handleRevokeAccess = () => {
    if (!confirm('Apakah Anda yakin ingin menutup dan mencabut izin bantuan teknis Super Admin sekarang?')) return;

    const revokedSupport: TechnicalSupportAccess = {
      ...(support || { enabled: false }),
      enabled: false,
      expiresAt: Date.now()
    };

    onUpdateSettings({ technicalSupport: revokedSupport });
  };

  if (countdown.active && support?.enabled) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-200/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
              <Headphones className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-amber-900">
                  Izin Bantuan Teknis Super Admin
                </span>
                <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse">
                  Aktif
                </span>
              </div>
              <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                Super Admin dapat masuk ke dashboard ini untuk membantu kendala teknis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="bg-white px-4 py-2 rounded-xl border border-amber-300 text-center shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 block">
                Sisa Waktu Akses
              </span>
              <span className="font-mono text-base sm:text-lg font-black text-amber-950">
                {countdown.formatted}
              </span>
            </div>

            {!isSuperAdmin && (
              <button
                type="button"
                onClick={handleRevokeAccess}
                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
                title="Tutup izin bantuan teknis sekarang"
              >
                <X className="w-4 h-4" /> Cabut Izin
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-white/80 p-4 rounded-xl border border-amber-200">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Catatan Kendala dari Penyelenggara:
            </span>
            <p className="font-bold text-slate-800 italic">
              "{support.issueNote || 'Tidak ada catatan spesifik.'}"
            </p>
          </div>

          <div className="bg-white/80 p-4 rounded-xl border border-amber-200 space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Diberikan oleh: <span className="text-slate-800 font-bold">{support.grantedByEmail || 'Penyelenggara'}</span>
            </p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Durasi Sesi: <span className="text-slate-800 font-bold">{support.durationHours || 2} Jam</span>
            </p>
            <p className="text-[8px] text-amber-800 font-medium">
              * Akses akan otomatis hangus saat waktu habis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shadow-xs">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black uppercase font-oswald italic tracking-wide text-slate-900">
                Izin Bantuan Teknis Super Admin
              </h4>
              <span className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                Terkunci (Aman)
              </span>
            </div>
            <p className="text-[10px] text-slate-600 font-medium mt-0.5">
              Berikan izin sementara ke tim teknis pusat untuk memeriksa dan menyelesaikan kendala di event ini
            </p>
          </div>
        </div>

        {!isActivating ? (
          <button
            type="button"
            onClick={() => setIsActivating(true)}
            className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <ShieldCheck className="w-4 h-4" /> Buka Izin Bantuan
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsActivating(false)}
            className="px-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold self-start sm:self-auto"
          >
            Batal
          </button>
        )}
      </div>

      {isActivating ? (
        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-950 block mb-2">
              1. Pilih Batas Durasi Akses (Otomatis Hangus):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { hours: 2, label: '2 Jam', desc: 'Rekomendasi Perbaikan Cepat' },
                { hours: 6, label: '6 Jam', desc: 'Sesi Pertandingan 1/2 Hari' },
                { hours: 24, label: '24 Jam', desc: 'Turnamen Seharian Penuh' }
              ].map(opt => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setSelectedDuration(opt.hours)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    selectedDuration === opt.hours
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-300'
                      : 'bg-white text-slate-800 border-purple-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase font-mono">{opt.label}</span>
                    {selectedDuration === opt.hours && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <p className={`text-[9px] mt-1 ${selectedDuration === opt.hours ? 'text-purple-100' : 'text-slate-500'}`}>
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-950 block mb-1">
                2. Catatan Kendala yang Dihadapi (Opsional):
              </span>
              <input
                type="text"
                value={issueNote}
                onChange={e => setIssueNote(e.target.value)}
                placeholder="Contoh: Tolong bantu cek bagan eliminasi Barebow ada yang dobel / skor macet..."
                className="w-full p-3 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-purple-600"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-purple-200/80">
            <p className="text-[9px] text-purple-900 font-medium">
              * Super Admin hanya dapat masuk selama durasi di atas, dan Anda dapat mencabut akses kapan saja.
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsActivating(false)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleGrantAccess}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95"
              >
                Konfirmasi & Berikan Izin
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-600">
          <Lock className="w-5 h-5 text-slate-400 shrink-0" />
          <p className="text-[10px] leading-relaxed">
            Data event Anda saat ini <strong>terkunci secara privat</strong>. Tim Super Admin tidak dapat mengubah pengaturan atau skor event ini kecuali Anda mengaktifkan tombol <strong>"Buka Izin Bantuan"</strong> di atas saat memerlukan bantuan operasional.
          </p>
        </div>
      )}
    </div>
  );
};

export const TechnicalSupportModeBanner: React.FC<{
  settings: TournamentSettings;
  onExit: () => void;
  onRevokeAccess?: () => void;
  isSuperAdmin?: boolean;
}> = ({ settings, onExit, onRevokeAccess, isSuperAdmin = false }) => {
  const support = settings.technicalSupport;
  const countdown = useSupportCountdown(support);

  if (!countdown.active || !support?.enabled) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-4 py-2.5 shadow-lg border-b border-amber-400 sticky top-0 z-[250] animate-in slide-in-from-top-2 duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="font-black uppercase tracking-widest text-[10px] sm:text-[11px] bg-white/20 px-2 py-0.5 rounded">
                Mode Bantuan Teknis Super Admin
              </span>
              <span className="font-mono font-black text-amber-100 text-xs sm:text-sm">
                ⏱️ {countdown.formatted}
              </span>
            </div>
            <p className="text-[9px] text-white/90 font-medium truncate max-w-xl">
              Izin dari: <strong>{support.grantedByEmail || 'Penyelenggara'}</strong>
              {support.issueNote ? ` • Kendala: "${support.issueNote}"` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRevokeAccess && !isSuperAdmin && (
            <button
              type="button"
              onClick={onRevokeAccess}
              className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Cabut Akses
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm transition-all"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
