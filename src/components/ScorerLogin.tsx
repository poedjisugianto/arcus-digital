import React, { useState, useEffect } from 'react';
import { ShieldCheck, Target, ChevronLeft, ArrowRight, AlertCircle, UserCheck, RotateCcw } from 'lucide-react';
import { ArcheryEvent, ScorerAccess } from '../types';
import ArcusLogo from './ArcusLogo';

interface ScorerLoginProps {
  events: ArcheryEvent[];
  onLogin: (event: ArcheryEvent, scorer: ScorerAccess) => void;
  onBack: () => void;
}

interface SavedScorerSession {
  eventId: string;
  scorer: ScorerAccess;
  accessCode: string;
  timestamp: number;
}

const SCORER_SESSION_STORAGE_KEY = 'arcus_scorer_session';

const ScorerLogin: React.FC<ScorerLoginProps> = ({ events, onLogin, onBack }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedScorerSession | null>(null);

  // Load saved session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCORER_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedScorerSession;
        if (parsed?.accessCode && parsed?.scorer) {
          setSavedSession(parsed);
          setCode(parsed.accessCode);
        }
      }
    } catch (e) {
      console.warn("Could not read scorer session", e);
    }
  }, []);

  const handleQuickResume = () => {
    if (!savedSession) return;
    setError(null);
    setIsSubmitting(true);

    // Try finding the exact event and fresh scorer info
    const targetEvent = events.find(e => e.id === savedSession.eventId) || 
      events.find(e => e.scorerAccess?.some(s => s.accessCode === savedSession.accessCode));
    
    if (targetEvent) {
      const freshScorer = targetEvent.scorerAccess?.find(s => s.accessCode === savedSession.accessCode) || savedSession.scorer;
      onLogin(targetEvent, freshScorer);
      return;
    }

    // If events not yet loaded from cloud or event not found in current list, retry with saved data
    if (events.length === 0) {
      setError('Sedang memuat data turnamen dari cloud, silakan tunggu sebentar...');
      setIsSubmitting(false);
      return;
    }

    setError('Event atau kode akses sesi sebelumnya tidak ditemukan lagi.');
    setIsSubmitting(false);
  };

  const handleClearSavedSession = () => {
    try {
      localStorage.removeItem(SCORER_SESSION_STORAGE_KEY);
    } catch (e) {}
    setSavedSession(null);
    setCode('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (events.length === 0) {
      setError('Sedang menghubungkan ke server turnamen, mohon coba beberapa detik lagi.');
      setIsSubmitting(false);
      return;
    }

    // Find the event and scorer that matches the code
    let found = false;
    for (const event of events) {
      const scorer = event.scorerAccess?.find((s: ScorerAccess) => s.accessCode === code);
      if (scorer) {
        try {
          localStorage.setItem(SCORER_SESSION_STORAGE_KEY, JSON.stringify({
            eventId: event.id,
            scorer,
            accessCode: code,
            timestamp: Date.now()
          }));
        } catch (storageErr) {
          console.warn("Failed to save scorer session to localStorage", storageErr);
        }

        onLogin(event, scorer);
        found = true;
        break;
      }
    }

    if (!found) {
      setError('Kode akses tidak valid atau tidak ditemukan pada turnamen aktif.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-white rounded-3xl shadow-xl shadow-purple-600/10">
            <ArcusLogo className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black font-oswald uppercase italic tracking-tight text-slate-900">Akses Tim Lapangan</h1>
          <p className="text-slate-900 font-bold uppercase text-[10px] tracking-widest italic opacity-70">Masukkan kode akses 4-digit yang diberikan oleh panitia.</p>
        </div>

        {savedSession && (
          <div className="bg-purple-50 border border-purple-200 p-5 rounded-3xl space-y-3 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-purple-900">
                <UserCheck className="w-4 h-4 text-purple-600" /> Sesi Tersimpan di HP Ini
              </span>
              <button
                type="button"
                onClick={handleClearSavedSession}
                className="text-[9px] font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                title="Hapus sesi tersimpan"
              >
                <RotateCcw className="w-3 h-3" /> Ganti Akun
              </button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-slate-900">{savedSession.scorer.name}</p>
                <p className="text-[10px] font-bold text-purple-800">
                  {savedSession.scorer.assignedTargets && savedSession.scorer.assignedTargets.length > 0 
                    ? `Bantalan: ${savedSession.scorer.assignedTargets.join(', ')}` 
                    : 'Semua Bantalan'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleQuickResume}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-purple-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-purple-700 active:scale-95 transition-all flex items-center gap-2"
              >
                Lanjutkan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <label className="block group">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1 group-focus-within:text-purple-600 transition-colors">Kode Akses (4 Digit)</span>
              <input 
                type="text" 
                maxLength={4}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="mt-2 block w-full rounded-2xl border-slate-200 p-6 border font-black text-4xl text-center tracking-[0.5em] outline-none focus:ring-8 ring-purple-500/10 focus:border-purple-500 transition-all shadow-inner bg-slate-50"
                required
                autoFocus
              />
            </label>
          </div>

          <button 
            type="submit" 
            disabled={code.length !== 4 || isSubmitting}
            className="w-full bg-purple-600 text-white font-black py-6 rounded-2xl shadow-xl shadow-purple-600/20 hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center gap-4 text-lg uppercase tracking-widest disabled:opacity-50 disabled:grayscale disabled:scale-100"
          >
            {isSubmitting ? 'Memverifikasi...' : 'Masuk Panel Scorer'}
            <ArrowRight className="w-6 h-6" />
          </button>
        </form>

        <button 
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 text-slate-900 hover:text-purple-600 font-black uppercase text-[10px] tracking-widest transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali ke Beranda
        </button>

        <div className="pt-12 text-center">
          <div className="inline-flex items-center gap-2 text-slate-600">
            <Target className="w-4 h-4" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em]">ARCUS TOURNAMENT OS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScorerLogin;
