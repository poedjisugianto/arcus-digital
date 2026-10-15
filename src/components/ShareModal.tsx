import React from 'react';
import { 
  X, Copy, Check, Share2, Globe, MessageCircle, Twitter, Facebook, 
  Image as ImageIcon, Sparkles, Download, Smartphone
} from 'lucide-react';
import { resolveGoogleDriveUrl } from '../lib/photoService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournamentName: string;
  url: string; // The primary URL (tournament info)
  registerUrl?: string; // Optional registration URL
  pamphletUrl?: string;
  location?: string;
  eventDate?: string;
  description?: string;
  eventId?: string;
}

export default function ShareModal({ 
  isOpen, 
  onClose, 
  tournamentName, 
  url, 
  registerUrl,
  pamphletUrl,
  location,
  eventDate,
  description,
  eventId
}: Props) {
  const [copied, setCopied] = React.useState<'info' | 'register' | 'waText' | null>(null);
  const [nativeShareSuccess, setNativeShareSuccess] = React.useState(false);
  const [isSharingImage, setIsSharingImage] = React.useState(false);
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);

  if (!isOpen) return null;

  const resolvedPamphlet = pamphletUrl ? resolveGoogleDriveUrl(pamphletUrl) : '/og-banner.jpg';
  const displayTitle = tournamentName || 'Turnamen Panahan';
  const displayLocation = location || 'Lapangan Panahan';
  const displayDate = eventDate || 'Sesuai Jadwal Panitia';
  const domainName = typeof window !== 'undefined' ? window.location.hostname : 'arcus-archery';

  const formattedShareMessage = `🏹 *${displayTitle.toUpperCase()}*
${eventDate ? `📅 Tanggal: *${displayDate}*\n` : ''}${location ? `📍 Lokasi: *${displayLocation}*\n` : ''}
Ayo ikuti turnamen dan pantau live score langsung melalui tautan resmi:
🔗 Info & Live Score: ${url}
${registerUrl ? `📝 Pendaftaran Peserta: ${registerUrl}\n` : ''}
_Platform Digital Archery Tournament by ARCUS_`;

  const handleCopy = (text: string, type: 'info' | 'register' | 'waText') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(type);
      setTimeout(() => setCopied(null), 2500);
    } catch (e) {
      console.error('Failed to copy text:', e);
    }
  };

  // Share pamphlet as real image file directly to WhatsApp / Share Sheet
  const handleShareWithImage = async () => {
    setIsSharingImage(true);
    try {
      const imgSource = resolvedPamphlet || (eventId ? `/api/og-image?event=${eventId}` : '/og-banner.jpg');
      
      let blob: Blob | null = null;
      if (imgSource.startsWith('data:image/')) {
        const parts = imgSource.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        const res = await fetch(imgSource);
        blob = await res.blob();
      }

      if (blob) {
        const fileName = `pamflet-${displayTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'turnamen'}.jpg`;
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

        if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: displayTitle,
            text: formattedShareMessage
          });
          setNativeShareSuccess(true);
          setTimeout(() => setNativeShareSuccess(false), 2500);
          return;
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn("Direct file share not supported or cancelled:", err);
      }
    } finally {
      setIsSharingImage(false);
    }

    // Fallback: standard native share with text & link
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: displayTitle,
          text: formattedShareMessage,
          url: url
        });
        setNativeShareSuccess(true);
        setTimeout(() => setNativeShareSuccess(false), 2500);
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }

    // Ultimate fallback: copy WhatsApp broadcast text
    handleCopy(formattedShareMessage, 'waText');
  };

  // Download pamphlet image directly to gallery/storage
  const handleDownloadImage = async () => {
    try {
      const imgSource = resolvedPamphlet || (eventId ? `/api/og-image?event=${eventId}` : '/og-banner.jpg');
      const safeTitle = displayTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'turnamen';

      if (imgSource.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = imgSource;
        a.download = `pamflet-${safeTitle}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const res = await fetch(imgSource);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `pamflet-${safeTitle}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (e) {
      window.open(resolvedPamphlet, '_blank');
    }
  };

  const shareOptions = [
    { 
      name: 'WhatsApp', 
      icon: MessageCircle, 
      color: 'bg-emerald-500 hover:bg-emerald-600', 
      link: `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedShareMessage)}` 
    },
    { 
      name: 'Facebook', 
      icon: Facebook, 
      color: 'bg-blue-600 hover:bg-blue-700', 
      link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` 
    },
    { 
      name: 'Twitter / X', 
      icon: Twitter, 
      color: 'bg-slate-900 hover:bg-black', 
      link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(formattedShareMessage)}` 
    }
  ];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-arcus-red rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black font-oswald uppercase italic text-slate-900 leading-tight">Bagikan Pamflet & Event</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[240px] sm:max-w-[300px]">{displayTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-900 hover:text-white transition-all"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          
          {/* PRIMARY HERO BUTTON: Share Photo Directly to WhatsApp with Caption */}
          <div>
            <button
              onClick={handleShareWithImage}
              disabled={isSharingImage}
              className="w-full py-4 px-5 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl font-black uppercase text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/25 active:scale-[0.98] transition-all group"
            >
              <Smartphone className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>
                {isSharingImage 
                  ? 'Menyiapkan Gambar Pamflet...' 
                  : nativeShareSuccess 
                  ? '✓ Berhasil Dibagikan!' 
                  : 'Kirim Pamflet Foto + Teks ke WhatsApp'}
              </span>
            </button>
          </div>

          {/* Social Media Link Card Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-arcus-red" />
                Pratinjau Pamflet Turnamen
              </span>
              <button
                onClick={handleDownloadImage}
                className="text-[10px] font-bold text-slate-700 hover:text-arcus-red bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadSuccess ? 'Tersimpan!' : 'Unduh Pamflet'}
              </button>
            </div>

            {/* Visual card */}
            <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 text-white shadow-md border border-slate-800">
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                {/* Pamphlet image */}
                <div className="relative w-full h-44 sm:h-52 bg-slate-900 flex items-center justify-center overflow-hidden">
                  <img 
                    src={resolvedPamphlet} 
                    alt="Pamflet Event"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/og-banner.jpg';
                    }}
                  />
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[9px] font-black uppercase tracking-wider text-white border border-white/10 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-red-400" />
                    {pamphletUrl ? 'Pamflet Resmi' : 'Banner Turnamen'}
                  </div>
                </div>

                {/* Card text */}
                <div className="p-3.5 bg-slate-900/95 space-y-1">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-500" /> {domainName}
                  </p>
                  <h4 className="font-bold text-xs sm:text-sm text-white line-clamp-1">
                    {displayTitle} | ARCUS Archery
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                    {description || `Turnamen Panahan${location ? ` di ${location}` : ''}. Pendaftaran peserta online, jadwal bantalan otomatis, dan skor langsung.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Copy Rich WhatsApp Broadcast */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                Format Pesan WhatsApp Siap Kirim
              </span>
              <button
                onClick={() => handleCopy(formattedShareMessage, 'waText')}
                className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all flex items-center gap-1 ${
                  copied === 'waText' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                }`}
              >
                {copied === 'waText' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === 'waText' ? 'Tersalin!' : 'Salin Teks'}
              </button>
            </div>
            <p className="text-[11px] text-emerald-950 font-medium bg-white/90 p-3 rounded-xl border border-emerald-100/80 whitespace-pre-line line-clamp-3 leading-relaxed select-all">
              {formattedShareMessage}
            </p>
          </div>

          {/* URL inputs */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-1">Link Informasi Event & Live Score</label>
              <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-slate-400 transition-colors">
                <input 
                  readOnly
                  value={url}
                  className="flex-1 bg-transparent px-3 text-xs font-semibold text-slate-800 outline-none select-all"
                  onFocus={(e) => e.target.select()}
                />
                <button 
                  onClick={() => handleCopy(url, 'info')}
                  className={`px-4 py-2 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5 shrink-0 ${copied === 'info' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  {copied === 'info' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'info' ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>

            {registerUrl && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider ml-1">Link Langsung Pendaftaran Peserta</label>
                <div className="flex gap-2 p-1.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 focus-within:border-emerald-400 transition-colors">
                  <input 
                    readOnly
                    value={registerUrl}
                    className="flex-1 bg-transparent px-3 text-xs font-semibold text-emerald-950 outline-none select-all"
                    onFocus={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => handleCopy(registerUrl, 'register')}
                    className={`px-4 py-2 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5 shrink-0 ${copied === 'register' ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-800 text-white hover:bg-emerald-900'}`}
                  >
                    {copied === 'register' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === 'register' ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Social Media Share Buttons */}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Kirim via Aplikasi</p>
            <div className="grid grid-cols-3 gap-3">
              {shareOptions.map(option => (
                <a 
                  key={option.name}
                  href={option.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-all group active:scale-95 shadow-xs"
                >
                  <div className={`w-10 h-10 ${option.color} rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform mb-1.5`}>
                    <option.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider text-center">{option.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
