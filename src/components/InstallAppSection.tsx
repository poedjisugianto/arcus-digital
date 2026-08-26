import React from 'react';
import { motion } from 'motion/react';
import { 
  Download, Smartphone, Monitor, CheckCircle2, 
  Sparkles, Zap, WifiOff, ShieldCheck, ArrowRight,
  Laptop, Apple, Chrome, Layers
} from 'lucide-react';
import { PlatformType } from '../hooks/usePWAInstall';

interface Props {
  onOpenInstallModal: (defaultTab?: 'mobile' | 'desktop') => void;
  platform: PlatformType;
  isInstallable: boolean;
  isInstalled: boolean;
  onPromptInstall: () => Promise<boolean>;
}

export const InstallAppSection: React.FC<Props> = ({
  onOpenInstallModal,
  platform,
  isInstallable,
  isInstalled,
  onPromptInstall
}) => {
  return (
    <section id="install-app" className="py-20 md:py-28 px-6 lg:px-12 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-arcus-red/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-[1400px] mx-auto relative z-10 space-y-12 md:space-y-16">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-300">
              PROGRESSIVE WEB APP (PWA)
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black font-oswald uppercase italic tracking-tighter leading-tight">
            INSTAL ARCUS DIGITAL <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-arcus-red via-orange-400 to-yellow-400">
              DI PC, LAPTOP & SMARTPHONE
            </span>
          </h2>

          <p className="text-xs md:text-sm text-white/60 font-medium leading-relaxed max-w-2xl">
            Akses turnamen & input skor secara instan tanpa perlu unduh file berat dari toko aplikasi. 
            Berjalan cepat, ringan, layar penuh, dan mendukung mode input saat koneksi internet rendah di lapangan.
          </p>
        </div>

        {/* 2 Main Cards: PC vs Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          
          {/* Card 1: PC & Laptop */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="p-8 md:p-10 rounded-[2.5rem] bg-white/[0.04] border border-white/10 backdrop-blur-xl relative overflow-hidden group flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Monitor className="w-8 h-8" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full text-white/70">
                  Windows • macOS • Linux
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black font-oswald uppercase italic tracking-tight text-white">
                  Versi Komputer & Laptop
                </h3>
                <p className="text-xs md:text-sm text-white/60 font-medium leading-relaxed">
                  Bagus untuk Panitia & Operator Skoring: Jendela mandiri layar penuh, shortcut desktop instan, cetak ID card & scoring sheet lebih leluasa.
                </p>
              </div>

              {/* Feature Points */}
              <ul className="space-y-2.5 pt-2 text-xs font-semibold text-white/80">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Jendela aplikasi independen tanpa tab browser</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Shortcut ikon di Desktop & Start Menu</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dukungan cetak A4/A6 & export Excel cepat</span>
                </li>
              </ul>
            </div>

            <div className="pt-8 mt-6 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => {
                  if (platform === 'desktop' && isInstallable) {
                    onPromptInstall();
                  } else {
                    onOpenInstallModal('desktop');
                  }
                }}
                className="w-full sm:flex-1 py-4 px-6 bg-white text-slate-900 hover:bg-blue-500 hover:text-white rounded-2xl font-black font-oswald uppercase italic text-sm tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 group/btn"
              >
                <Download className="w-4 h-4 text-arcus-red group-hover/btn:text-white" />
                <span>{platform === 'desktop' && isInstallable ? 'Instal di PC Sekarang' : 'Panduan Pasang PC'}</span>
              </button>
              <button
                onClick={() => onOpenInstallModal('desktop')}
                className="w-full sm:w-auto py-4 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
              >
                Petunjuk Lengkap
              </button>
            </div>
          </motion.div>

          {/* Card 2: Smartphone (Android & iOS) */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="p-8 md:p-10 rounded-[2.5rem] bg-white/[0.04] border border-white/10 backdrop-blur-xl relative overflow-hidden group flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 rounded-3xl bg-arcus-red/10 border border-arcus-red/20 text-arcus-red flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Smartphone className="w-8 h-8" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full text-white/70">
                  Android • iPhone • iPad
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black font-oswald uppercase italic tracking-tight text-white">
                  Versi Smartphone & Tablet
                </h3>
                <p className="text-xs md:text-sm text-white/60 font-medium leading-relaxed">
                  Dirancang khusus untuk Wasit, Scorer Bantalan, dan Atlet. Input skor cepat dengan tombol numerik sentuh besar dan minim kuota.
                </p>
              </div>

              {/* Feature Points */}
              <ul className="space-y-2.5 pt-2 text-xs font-semibold text-white/80">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Ikon aplikasi di layar utama HP (Home Screen)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Tetap bisa input skor meski koneksi di lapangan lambat</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Ukuran sangat ringan (tanpa download ratusan MB)</span>
                </li>
              </ul>
            </div>

            <div className="pt-8 mt-6 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => {
                  if ((platform === 'android' || platform === 'ios') && isInstallable) {
                    onPromptInstall();
                  } else {
                    onOpenInstallModal('mobile');
                  }
                }}
                className="w-full sm:flex-1 py-4 px-6 bg-arcus-red hover:bg-white hover:text-arcus-red text-white rounded-2xl font-black font-oswald uppercase italic text-sm tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>{platform === 'android' && isInstallable ? 'Instal di HP Sekarang' : 'Pasang di Android / iPhone'}</span>
              </button>
              <button
                onClick={() => onOpenInstallModal('mobile')}
                className="w-full sm:w-auto py-4 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
              >
                Petunjuk Lengkap
              </button>
            </div>
          </motion.div>

        </div>

        {/* 3 Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide text-white">0 Detik Waktu Muat</h4>
              <p className="text-[11px] text-white/90 font-medium">Buka seketika tanpa jeda browser.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide text-white">Hemat Kuota Internet</h4>
              <p className="text-[11px] text-white/90 font-medium">Data tersimpan di cache lokal perangkat.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide text-white">Aman & Terverifikasi</h4>
              <p className="text-[11px] text-white/90 font-medium">Enkripsi standar PWA modern.</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default InstallAppSection;
