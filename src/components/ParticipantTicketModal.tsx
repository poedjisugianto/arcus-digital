import React, { useState } from 'react';
import { 
  X, Printer, Share2, Smartphone, QrCode as QrIcon, 
  CheckCircle2, ShieldCheck, Target, Trophy, Info, 
  Download, ArrowRight, Check, AlertCircle, ChevronLeft, ChevronRight,
  MapPin, ExternalLink
} from 'lucide-react';
import { Barcode } from './Barcode';
import { QRCodeSVG } from 'qrcode.react';
import { CATEGORY_LABELS } from '../constants';
import { CategoryType } from '../types';
import { resolveGoogleDriveUrl } from '../lib/photoService';
import { getGoogleMapsUrl } from '../lib/mapsHelper';

export interface TicketParticipant {
  id: string;
  name: string;
  club?: string;
  category?: string;
  registrationNo?: string;
  status?: string;
  targetNo?: number;
  position?: string;
  wave?: number;
  photoUrl?: string;
  ktaNumber?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournamentName?: string;
  tournamentDate?: string;
  tournamentLocation?: string;
  mapsUrl?: string;
  logoUrl?: string;
  secondaryLogoUrl?: string;
  clubLogoUrl?: string;
  participants: TicketParticipant[];
  initialIndex?: number;
  onOpenInvoice?: () => void;
}

export const ParticipantTicketModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tournamentName = 'Turnamen Panahan Arcus',
  tournamentDate,
  tournamentLocation,
  mapsUrl,
  logoUrl,
  secondaryLogoUrl,
  clubLogoUrl,
  participants,
  initialIndex = 0,
  onOpenInvoice
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  if (!isOpen || !participants || participants.length === 0) return null;

  const current = participants[currentIndex] || participants[0];
  const barcodeValue = current.id || current.registrationNo || `REG-${Date.now()}`;
  const categoryLabel = CATEGORY_LABELS[current.category as CategoryType] || current.category || 'UMUM';

  const handlePrint = () => {
    window.print();
  };

  const handleShareWA = () => {
    const text = encodeURIComponent(
      `🎯 *E-TIKET & BARCODE DAFTAR ULANG TURNAMEN*\n\n` +
      `🏆 *Event:* ${tournamentName}\n` +
      `👤 *Nama:* ${current.name}\n` +
      `🏢 *Klub:* ${current.club || '-'}\n` +
      `🏹 *Kategori:* ${categoryLabel}\n` +
      `🔢 *No. Registrasi / Barcode:* ${current.registrationNo || current.id}\n` +
      (current.targetNo ? `🎯 *Bantalan:* Target ${current.targetNo}${current.position || ''}\n` : '') +
      `\n⚠️ *PENTING:* Tunjukkan barcode ini di meja registrasi saat tiba di lokasi untuk absen / daftar ulang otomatis via scan barcode.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto no-print animate-in fade-in duration-300">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          body > * {
            display: none !important;
          }
          #printable-ticket-card {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 480px !important;
            margin: 0 auto !important;
            padding: 16px !important;
            background: white !important;
            color: black !important;
            border: 2px solid #000 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="w-full max-w-lg my-auto space-y-4 animate-in zoom-in-95 duration-200">
        
        {/* Navigation if multiple participants */}
        {participants.length > 1 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between text-white shadow-lg no-print">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-xs font-bold flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>

            <span className="text-xs font-bold text-slate-300">
              Peserta <span className="text-white font-black">{currentIndex + 1}</span> dari <span className="text-white font-black">{participants.length}</span>
            </span>

            <button
              onClick={() => setCurrentIndex(prev => Math.min(participants.length - 1, prev + 1))}
              disabled={currentIndex === participants.length - 1}
              className="px-3 py-1.5 rounded-xl bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-xs font-bold flex items-center gap-1 transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* The Ticket Card */}
        <div 
          id="printable-ticket-card"
          className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 text-slate-900 relative"
        >
          {/* Header Strip */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-start gap-3 relative z-10">
              <div className="space-y-1.5 flex-1 min-w-0">
                {/* Multi-Logos on ticket if present */}
                {(logoUrl || secondaryLogoUrl || clubLogoUrl) && (
                  <div className="flex items-center gap-2 mb-1">
                    {logoUrl && (
                      <img 
                        src={resolveGoogleDriveUrl(logoUrl)} 
                        alt="Logo Event" 
                        className="h-8 max-w-[45px] object-contain rounded"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {clubLogoUrl && (
                      <img 
                        src={resolveGoogleDriveUrl(clubLogoUrl)} 
                        alt="Logo Klub" 
                        className="h-7 max-w-[40px] object-contain rounded"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {secondaryLogoUrl && (
                      <img 
                        src={resolveGoogleDriveUrl(secondaryLogoUrl)} 
                        alt="Logo Organisasi" 
                        className="h-7 max-w-[40px] object-contain rounded"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                )}

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-600/30 border border-red-500/40 text-red-200 rounded-full text-[9px] font-black uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3 text-red-400" />
                  E-Tiket Daftar Ulang Resmi
                </span>
                <h3 className="text-lg sm:text-xl font-black font-oswald uppercase italic tracking-wide text-white leading-tight">
                  {tournamentName}
                </h3>
                {(tournamentDate || tournamentLocation) && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-300 font-medium">
                    <span>{[tournamentDate, tournamentLocation].filter(Boolean).join(' • ')}</span>
                    {getGoogleMapsUrl(tournamentLocation, mapsUrl) && (
                      <a
                        href={getGoogleMapsUrl(tournamentLocation, mapsUrl)!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/40 hover:bg-blue-600 border border-blue-400/50 text-blue-200 text-[9px] font-black uppercase tracking-wider transition-all"
                        title="Buka Lokasi di Google Maps"
                      >
                        <MapPin className="w-2.5 h-2.5 text-red-400" /> Buka Peta
                      </a>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all no-print shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Participant Info Body */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Athlete Name & Category */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center font-black font-oswald text-2xl uppercase shadow-lg shadow-red-600/20 shrink-0">
                {current.name.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider leading-none">Nama Atlet / Peserta</p>
                <h4 className="text-lg sm:text-xl font-black font-oswald text-slate-900 uppercase italic truncate leading-tight mt-0.5">
                  {current.name}
                </h4>
                <p className="text-xs font-bold text-slate-600 uppercase mt-0.5">
                  {current.club || 'Umum'}
                </p>
              </div>

              {current.targetNo && current.targetNo > 0 && (
                <div className="text-center bg-slate-900 text-white px-3 py-2 rounded-xl shrink-0">
                  <span className="text-[8px] font-black text-slate-400 uppercase block leading-none">Bantalan</span>
                  <span className="text-base sm:text-lg font-black font-oswald text-red-400">
                    {current.targetNo}{current.position || ''}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[8.5px] font-black text-slate-700 uppercase block">Kategori</span>
                <span className="font-extrabold text-slate-800 uppercase text-[11px]">
                  {categoryLabel}
                </span>
              </div>
              <div>
                <span className="text-[8.5px] font-black text-slate-700 uppercase block">No. Registrasi</span>
                <span className="font-mono font-black text-red-600 text-[11px] truncate block">
                  {current.registrationNo || current.id}
                </span>
              </div>
              {current.ktaNumber && (
                <div>
                  <span className="text-[8.5px] font-black text-slate-700 uppercase block">No. KTA</span>
                  <span className="font-mono font-bold text-slate-700 text-[11px]">
                    {current.ktaNumber}
                  </span>
                </div>
              )}
              <div>
                <span className="text-[8.5px] font-black text-slate-700 uppercase block">Status Tiket</span>
                <span className="inline-flex items-center gap-1 font-black text-emerald-600 text-[10px] uppercase">
                  <CheckCircle2 className="w-3 h-3" /> Terdaftar Resmi
                </span>
              </div>
            </div>

            {/* BARCODE & QR CODE CENTRAL DISPLAY */}
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                {/* QR Code */}
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
                  <QRCodeSVG 
                    value={barcodeValue} 
                    size={88}
                    level="M"
                    includeMargin={false}
                  />
                  <span className="text-[7.5px] font-mono text-slate-700 font-bold block mt-1 uppercase">Scan QR</span>
                </div>

                {/* Code128 Barcode */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-0 overflow-hidden">
                  <div className="w-full flex justify-center overflow-x-auto py-1">
                    <Barcode 
                      value={barcodeValue}
                      width={1.6}
                      height={44}
                      fontSize={11}
                      displayValue={true}
                    />
                  </div>
                  <span className="text-[7.5px] font-black text-slate-700 uppercase tracking-wider block mt-0.5">
                    Laser Barcode (Code-128)
                  </span>
                </div>
              </div>

              {/* Instructions Box */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-left flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-slate-700">
                  <p className="text-[10px] font-black text-amber-900 uppercase tracking-wide">
                    PETUNJUK DAFTAR ULANG DI LOKASI:
                  </p>
                  <p className="text-[9.5px] font-semibold leading-relaxed">
                    Tunjukkan barcode ini (dari layar HP atau cetakan) kepada panitia di meja registrasi. Begitu dipindai, Anda akan <strong>otomatis tercatat hadir (Check-in)</strong>.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="bg-slate-50 border-t border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-2.5 no-print">
            <button
              onClick={handleShareWA}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Smartphone className="w-4 h-4" /> Kirim ke WhatsApp
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" /> Cetak / Simpan Tiket
            </button>

            {onOpenInvoice && (
              <button
                onClick={() => {
                  onClose();
                  onOpenInvoice();
                }}
                className="py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs uppercase transition-all"
              >
                Lihat Invoice
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ParticipantTicketModal;
