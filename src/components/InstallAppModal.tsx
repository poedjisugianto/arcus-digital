import React, { useState } from 'react';
import { 
  X, Download, Smartphone, Monitor, CheckCircle2, 
  Share, PlusSquare, ArrowRight, ShieldCheck, Zap, 
  WifiOff, Sparkles, ChevronRight, Laptop, ExternalLink, HelpCircle
} from 'lucide-react';
import ArcusLogo from './ArcusLogo';
import { PlatformType } from '../hooks/usePWAInstall';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  platform: PlatformType;
  isInstallable: boolean;
  isInstalled: boolean;
  onPromptInstall: () => Promise<boolean>;
  initialTab?: 'mobile' | 'desktop';
}

export const InstallAppModal: React.FC<Props> = ({
  isOpen,
  onClose,
  platform: currentPlatform,
  isInstallable,
  isInstalled,
  onPromptInstall,
  initialTab
}) => {
  const [activeTab, setActiveTab] = useState<'mobile' | 'desktop'>(
    initialTab || (currentPlatform === 'desktop' ? 'desktop' : 'mobile')
  );

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);
  const [mobileSubTab, setMobileSubTab] = useState<'android' | 'ios'>(
    currentPlatform === 'ios' ? 'ios' : 'android'
  );
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    const success = await onPromptInstall();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[300] flex flex-col items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 md:p-8 bg-slate-950 text-white flex items-center justify-between relative border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-arcus-red rounded-2xl flex items-center justify-center p-2.5 shadow-lg shadow-arcus-red/30">
              <ArcusLogo className="w-full h-full text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black font-oswald uppercase tracking-tight italic">
                  Instal Arcus Digital
                </h2>
                <span className="bg-arcus-red/20 text-rose-300 border border-arcus-red/30 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                  PWA Ready
                </span>
              </div>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
                Aplikasi Resmi • Bisa di HP & PC / Komputer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all active:scale-95"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection: Mobile vs Desktop */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'mobile'
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-arcus-red" />
            <span>Smartphone (HP & Tablet)</span>
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'desktop'
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-500" />
            <span>Komputer / Laptop (PC)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
          
          {isInstalled || installSuccess ? (
            <div className="p-6 bg-emerald-50 border-2 border-emerald-500/30 rounded-3xl text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black font-oswald uppercase text-emerald-900 italic">
                Aplikasi Sudah Terpasang!
              </h3>
              <p className="text-xs font-bold text-emerald-700 max-w-md mx-auto">
                Arcus Digital sudah berjalan sebagai aplikasi terpasang di perangkat Anda. Anda dapat membukanya langsung dari layar utama / desktop kapan saja.
              </p>
            </div>
          ) : null}

          {/* Quick Install Banner if Browser Supports Direct Prompt */}
          {isInstallable && !isInstalled && !installSuccess && (
            <div className="p-5 bg-gradient-to-r from-arcus-red to-orange-500 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-red-500/20">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Instal Cepat 1-Klik</span>
                </div>
                <h4 className="text-lg font-black font-oswald uppercase tracking-tight">
                  Pasang Otomatis di Perangkat Ini
                </h4>
                <p className="text-[11px] text-white/80 font-medium">
                  Klik tombol di samping untuk langsung menambahkan ke layar utama / menu aplikasi.
                </p>
              </div>
              <button
                onClick={handleNativeInstall}
                className="w-full sm:w-auto px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl font-black font-oswald uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all shrink-0"
              >
                <Download className="w-4 h-4 text-arcus-red" />
                Instal Sekarang
              </button>
            </div>
          )}

          {/* MOBILE GUIDE */}
          {activeTab === 'mobile' && (
            <div className="space-y-6">
              {/* Mobile OS Switch */}
              <div className="flex items-center justify-center gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-xs mx-auto">
                <button
                  onClick={() => setMobileSubTab('android')}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    mobileSubTab === 'android' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Android (Chrome / Browser)
                </button>
                <button
                  onClick={() => setMobileSubTab('ios')}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    mobileSubTab === 'ios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  iPhone / iPad (Safari)
                </button>
              </div>

              {mobileSubTab === 'android' ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Cara Pasang di HP Android:
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs font-oswald">
                        01
                      </div>
                      <h5 className="text-xs font-black uppercase text-slate-900">Buka di Chrome</h5>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                        Buka website turnamen menggunakan browser <strong>Google Chrome</strong> di smartphone Android Anda.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs font-oswald">
                        02
                      </div>
                      <h5 className="text-xs font-black uppercase text-slate-900">Menu Titik Tiga (⋮)</h5>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                        Tap ikon <strong>menu tiga titik (⋮)</strong> di sudut kanan atas layar browser Chrome.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs font-oswald">
                        03
                      </div>
                      <h5 className="text-xs font-black uppercase text-slate-900">Instal Aplikasi</h5>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                        Pilih <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>. Ikon Arcus akan muncul di HP Anda!
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Cara Pasang di iPhone & iPad (iOS Safari):
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs font-oswald">
                        01
                      </div>
                      <h5 className="text-xs font-black uppercase text-slate-900">Buka di Safari</h5>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                        Pastikan Anda membuka website ini menggunakan browser bawaan <strong>Safari</strong> pada iPhone/iPad.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs font-oswald">
                        02
                      </div>
                      <h5 className="text-xs font-black uppercase text-slate-900">Tombol Share (⎋)</h5>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                        Tap tombol <strong>Bagikan / Share</strong> (ikon kotak dengan panah ke atas) di bagian bawah layar.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs font-oswald">
                        03
                      </div>
                      <h5 className="text-xs font-black uppercase text-slate-900">Add to Home Screen</h5>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                        Gulir ke bawah dan pilih <strong>"Add to Home Screen"</strong> (Tambah ke Layar Utama), lalu tap <strong>"Add"</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DESKTOP / PC GUIDE */}
          {activeTab === 'desktop' && (
            <div className="space-y-6">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Cara Pasang di Laptop / PC (Windows & macOS):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs font-oswald">
                    01
                  </div>
                  <h5 className="text-xs font-black uppercase text-slate-900">Gunakan Chrome / Edge</h5>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    Buka situs web turnamen menggunakan browser <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> di PC/Laptop Anda.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs font-oswald">
                    02
                  </div>
                  <h5 className="text-xs font-black uppercase text-slate-900">Ikon Pasang di Address Bar</h5>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    Lihat di sebelah kanan kolom alamat URL (address bar), klik ikon <strong>Pasang / Install [⊕]</strong> atau klik tombol <strong>"Instal Sekarang"</strong> di atas.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs font-oswald">
                    03
                  </div>
                  <h5 className="text-xs font-black uppercase text-slate-900">Buka Seperti Aplikasi PC</h5>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    Arcus Digital akan memiliki jendela mandiri tanpa tab browser, muncul di Desktop & Start Menu, dan berjalan super cepat!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Benefits Grid */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Keunggulan Aplikasi Terpasang (PWA):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-[11px] font-black uppercase text-slate-900">Ringan & Instan</h5>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                    Hanya ukuran beberapa kilobyte tanpa memakan ruang penyimpanan perangkat.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-[11px] font-black uppercase text-slate-900">Bisa Offline</h5>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                    Bantalan & wasit tetap dapat memasukkan skor meskipun sinyal di lapangan buruk.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-[11px] font-black uppercase text-slate-900">Selalu Terupdate</h5>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                    Otomatis sinkron dengan pembaruan sistem terbaru tanpa perlu install ulang manual.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          <span>Arcus Archery Progressive Web App (PWA)</span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

export default InstallAppModal;
