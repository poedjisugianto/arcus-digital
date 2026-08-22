import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Camera, Barcode as BarcodeIcon, Search, CheckCircle2, 
  AlertCircle, User, ShieldCheck, Printer, RefreshCw, Sparkles,
  MapPin, Trophy, Target, ArrowRight, UserCheck, Clock, Check
} from 'lucide-react';
import { Archer, ArcheryEvent, RegistrationStatus, CategoryType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { Barcode } from './Barcode';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from 'sonner';

interface Props {
  event?: ArcheryEvent;
  archers?: Archer[];
  eventTitle?: string;
  onUpdateArcher?: (archer: Archer) => void;
  onUpdateParticipant?: (archer: Archer) => void;
  onBulkUpdateArchers?: (archers: Archer[]) => void;
  onClose: () => void;
  isOpen?: boolean;
  initialQuery?: string;
}

export const ParticipantScannerModal: React.FC<Props> = ({
  event,
  archers: propArchers,
  eventTitle: propEventTitle,
  onUpdateArcher,
  onUpdateParticipant,
  onBulkUpdateArchers,
  onClose,
  isOpen = true,
  initialQuery = ''
}) => {
  if (!isOpen) return null;

  const archers = propArchers || event?.archers || [];
  const eventTitle = propEventTitle || event?.settings?.tournamentName || 'Turnamen Panahan';
  const updateArcher = (a: Archer) => {
    if (onUpdateParticipant) onUpdateParticipant(a);
    else if (onUpdateArcher) onUpdateArcher(a);
  };
  const [scanInput, setScanInput] = useState(initialQuery);
  const [selectedArcher, setSelectedArcher] = useState<Archer | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedTime, setLastScannedTime] = useState<number | null>(null);
  const [recentScans, setRecentScans] = useState<{ archer: Archer; time: string; success: boolean }[]>([]);
  const [audioFeedback] = useState(() => {
    // Simple Web Audio API beep
    return () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        // AudioContext not allowed or unsupported
      }
    };
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = 'barcode-camera-reader';

  // Stats
  const stats = useMemo(() => {
    const total = (archers || []).filter(a => a.category !== CategoryType.OFFICIAL).length;
    const checkedIn = (archers || []).filter(a => a.checkedIn && a.category !== CategoryType.OFFICIAL).length;
    const percent = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    return { total, checkedIn, remaining: total - checkedIn, percent };
  }, [archers]);

  // Keep input focused for handheld barcode scanners
  useEffect(() => {
    if (!isCameraActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCameraActive, selectedArcher]);

  // Global scanner listener for fast keystrokes from USB barcode scanners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user presses Escape, close modal
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lookup archer by code / ID / query
  const findArcher = (query: string): Archer | undefined => {
    if (!query || !query.trim()) return undefined;
    const clean = query.trim().toLowerCase();

    // 1. Exact ID match (e.g. m-arc-xxxx or full id)
    let found = (archers || []).find(a => a.id.toLowerCase() === clean);
    if (found) return found;

    // 2. Exact registrationNo match
    found = (archers || []).find(a => (a.registrationNo || '').toLowerCase() === clean);
    if (found) return found;

    // 3. Exact PIN match
    found = (archers || []).find(a => a.pin && a.pin.toLowerCase() === clean);
    if (found) return found;

    // 4. Target code match (e.g. "14A", "1B", "target-14A")
    const targetMatch = clean.replace('target-', '').replace('bantalan-', '');
    found = (archers || []).find(a => `${a.targetNo}${a.position}`.toLowerCase() === targetMatch);
    if (found) return found;

    // 5. Partial name / club match
    found = (archers || []).find(a => 
      a.name.toLowerCase().includes(clean) || 
      a.club.toLowerCase().includes(clean)
    );

    return found;
  };

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanInput.trim()) return;

    processBarcode(scanInput.trim());
    setScanInput('');
  };

  const processBarcode = (scannedText: string) => {
    audioFeedback();
    
    // Try to parse if it's JSON from QR, otherwise plain string from 1D Barcode
    let targetQuery = scannedText;
    try {
      if (scannedText.startsWith('{') && scannedText.endsWith('}')) {
        const parsed = JSON.parse(scannedText);
        if (parsed.archerId) targetQuery = parsed.archerId;
        else if (parsed.id) targetQuery = parsed.id;
      }
    } catch (err) {
      // not JSON, keep as is
    }

    const archer = findArcher(targetQuery);
    if (archer) {
      setSelectedArcher(archer);
      setLastScannedTime(Date.now());
      setRecentScans(prev => [
        { archer, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), success: true },
        ...prev.slice(0, 7)
      ]);
      toast.success(`Data ditemukan: ${archer.name} (${archer.targetNo}${archer.position})`);
    } else {
      toast.error(`Data barcode "${targetQuery}" tidak ditemukan.`);
      setRecentScans(prev => [
        { archer: { name: targetQuery, club: 'Tidak Ditemukan', category: '-' } as any, time: new Date().toLocaleTimeString('id-ID'), success: false },
        ...prev.slice(0, 7)
      ]);
    }
  };

  // Toggle Check-In status
  const handleToggleCheckIn = (archer: Archer) => {
    const newCheckedIn = !archer.checkedIn;
    const updated: Archer = {
      ...archer,
      checkedIn: newCheckedIn,
      checkInTimestamp: newCheckedIn ? Date.now() : undefined,
      updatedAt: Date.now()
    };

    updateArcher(updated);
    setSelectedArcher(updated);
    audioFeedback();

    if (newCheckedIn) {
      toast.success(`✓ ${archer.name} Berhasil Registrasi Ulang / Check-In!`);
    } else {
      toast.info(`Status Check-In ${archer.name} Dibatalkan`);
    }
  };

  // Start / Stop Camera Scanner
  const startCamera = async () => {
    setIsCameraActive(true);
    setCameraError(null);

    setTimeout(async () => {
      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        const html5QrCode = new Html5Qrcode(scannerRegionId, {
          formatsToSupport,
          verbose: false
        });
        qrCodeInstanceRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 320, height: 180 },
            aspectRatio: 1.777778
          },
          (decodedText) => {
            processBarcode(decodedText);
          },
          () => {}
        );
      } catch (err: any) {
        console.error('Camera Scanner Error:', err);
        setCameraError('Gagal membuka kamera. Pastikan izin kamera aktif.');
        setIsCameraActive(false);
      }
    }, 200);
  };

  const stopCamera = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
        await qrCodeInstanceRef.current.clear();
      } catch (e) {
        console.warn(e);
      }
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex flex-col items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between relative border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/30">
              <BarcodeIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black font-oswald uppercase tracking-tight italic">
                  Scanner Barcode & Registrasi Ulang
                </h2>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                  Live Sync
                </span>
              </div>
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-0.5">
                Support Handheld Barcode Scanner (USB/Bluetooth) & Kamera HP/PC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Statistics Ribbon */}
        <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-100 p-3 text-center shrink-0">
          <div>
            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Total Peserta</span>
            <span className="text-sm md:text-base font-black text-slate-800 font-oswald">{stats.total}</span>
          </div>
          <div>
            <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider block">Sudah Hadir</span>
            <span className="text-sm md:text-base font-black text-emerald-600 font-oswald">{stats.checkedIn}</span>
          </div>
          <div>
            <span className="text-[8px] font-black uppercase text-amber-600 tracking-wider block">Belum Hadir</span>
            <span className="text-sm md:text-base font-black text-amber-600 font-oswald">{stats.remaining}</span>
          </div>
          <div>
            <span className="text-[8px] font-black uppercase text-purple-600 tracking-wider block">Progres</span>
            <span className="text-sm md:text-base font-black text-purple-600 font-oswald">{stats.percent}%</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Scanner Input Bar & Controls */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <form onSubmit={handleScanSubmit} className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-purple-600">
                <BarcodeIcon className="w-5 h-5" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan barcode kartu / ketik Nama, Klub, No Bantalan (Contoh: 14A)..."
                className="w-full pl-12 pr-28 py-4 bg-slate-50 border-2 border-purple-200 focus:border-purple-600 focus:bg-white rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 shadow-inner"
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
              >
                <Search className="w-3.5 h-3.5" /> Cari
              </button>
            </form>

            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              className={`px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border ${
                isCameraActive 
                  ? 'bg-red-500 text-white border-red-600 shadow-lg shadow-red-500/20' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              {isCameraActive ? 'Tutup Kamera' : 'Buka Kamera'}
            </button>
          </div>

          {/* Camera Scanner Viewport */}
          {isCameraActive && (
            <div className="bg-slate-950 rounded-3xl p-4 overflow-hidden relative border border-slate-800 shadow-2xl flex flex-col items-center">
              <div className="w-full max-w-md aspect-video relative rounded-2xl overflow-hidden bg-black">
                <div id={scannerRegionId} className="w-full h-full" />
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_12px_#ef4444] animate-pulse pointer-events-none" />
              </div>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-3 text-center">
                Arahkan garis merah ke barcode batang pada kartu peserta
              </p>
            </div>
          )}

          {cameraError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Scanned Participant Result Card */}
          {selectedArcher ? (
            <div className="bg-white rounded-3xl border-2 border-purple-200 p-6 shadow-xl relative overflow-hidden space-y-6 animate-in zoom-in-95 duration-200">
              
              {/* Card Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                    {selectedArcher.photoUrl ? (
                      <img src={selectedArcher.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-purple-600 tracking-widest bg-purple-50 px-2.5 py-1 rounded-md inline-block mb-1">
                      {CATEGORY_LABELS[selectedArcher.category as CategoryType] || selectedArcher.category}
                    </span>
                    <h3 className="text-2xl font-black font-oswald uppercase text-slate-900 leading-none">
                      {selectedArcher.name}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedArcher.club}
                    </p>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-3">
                  {selectedArcher.checkedIn ? (
                    <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-700 px-4 py-2 rounded-2xl text-right">
                      <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Terdaftar Ulang
                      </div>
                      {selectedArcher.checkInTimestamp && (
                        <span className="text-[9px] font-mono text-emerald-600 block mt-0.5">
                          {new Date(selectedArcher.checkInTimestamp).toLocaleTimeString('id-ID')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border-2 border-amber-300 text-amber-700 px-4 py-2 rounded-2xl text-right">
                      <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
                        <Clock className="w-4 h-4 text-amber-600" /> Belum Registrasi Ulang
                      </div>
                      <span className="text-[9px] font-bold text-amber-600 block mt-0.5">
                        Menunggu Check-In
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Bantalan & Posisi</span>
                  <span className="text-xl font-black text-slate-900 font-oswald">
                    {selectedArcher.targetNo || '-'}{selectedArcher.position || ''}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Gelombang / Sesi</span>
                  <span className="text-xl font-black text-slate-900 font-oswald">
                    Sesi {selectedArcher.wave || 1}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Status Pembayaran</span>
                  <span className={`text-xs font-black uppercase px-2 py-1 rounded-lg inline-block mt-1 ${
                    selectedArcher.status === RegistrationStatus.APPROVED || selectedArcher.status === RegistrationStatus.CONFIRMED || selectedArcher.status === RegistrationStatus.PAID
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedArcher.status}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">ID Peserta</span>
                  <span className="text-xs font-mono font-bold text-slate-600 truncate block mt-1">
                    {selectedArcher.registrationNo || selectedArcher.id.substring(0, 10)}
                  </span>
                </div>
              </div>

              {/* Barcode Display */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                <Barcode 
                  value={selectedArcher.id}
                  width={1.6}
                  height={36}
                  fontSize={10}
                  displayValue={true}
                  text={`ID: ${selectedArcher.id.substring(0, 12)} • ${selectedArcher.targetNo}${selectedArcher.position}`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleToggleCheckIn(selectedArcher)}
                  className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                    selectedArcher.checkedIn
                      ? 'bg-slate-200 hover:bg-red-100 hover:text-red-700 text-slate-700 border border-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                  }`}
                >
                  {selectedArcher.checkedIn ? (
                    <>
                      <X className="w-4 h-4" /> Batalkan Check-In
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" /> Konfirmasi Registrasi Ulang (Check-In)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedArcher(null);
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Scan Berikutnya
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 px-6 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-3 bg-slate-50/50">
              <BarcodeIcon className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
              <h4 className="text-base font-black font-oswald uppercase text-slate-700">
                Siap Memindai Barcode Kartu Peserta
              </h4>
              <p className="text-xs font-bold text-slate-400 max-w-md mx-auto">
                Gunakan scanner barcode batang (laser/USB) atau kamera untuk langsung membaca data peserta dan melakukan registrasi ulang secara instan.
              </p>
            </div>
          )}

          {/* Recent Scanned Log */}
          {recentScans.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block px-1">
                Riwayat Pemindaian Terakhir ({recentScans.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recentScans.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => item.success && setSelectedArcher(item.archer)}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                      item.success 
                        ? 'bg-white hover:bg-slate-50 border-slate-200' 
                        : 'bg-red-50 border-red-100 text-red-600 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={`w-2 h-2 rounded-full ${item.success ? (item.archer.checkedIn ? 'bg-emerald-500' : 'bg-purple-500') : 'bg-red-500'}`} />
                      <div className="truncate">
                        <span className="font-bold text-slate-800 block truncate">{item.archer.name}</span>
                        <span className="text-[9px] text-slate-400 block truncate">{item.archer.club} • {item.archer.targetNo || ''}{item.archer.position || ''}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          <span>Tekan ESC untuk menutup</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black uppercase text-[9px] transition-all"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
};

export default ParticipantScannerModal;
