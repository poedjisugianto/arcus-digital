import React from 'react';
import { X, Copy, Check, Share2, Globe, MessageCircle, Twitter, Facebook, ExternalLink, QrCode } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournamentName: string;
  url: string; // The primary URL (tournament info)
  registerUrl?: string; // Optional registration URL
}

export default function ShareModal({ isOpen, onClose, tournamentName, url, registerUrl }: Props) {
  const [copied, setCopied] = React.useState<'info' | 'register' | null>(null);
  const [nativeShareSuccess, setNativeShareSuccess] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = (link: string, type: 'info' | 'register') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tournamentName || 'Arcus Archery Tournament',
          text: `Ikuti turnamen ${tournamentName || 'Panahan'} di Arcus Digital:`,
          url: url
        });
        setNativeShareSuccess(true);
        setTimeout(() => setNativeShareSuccess(false), 2500);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share error:', err);
        }
      }
    } else {
      handleCopy(url, 'info');
    }
  };

  const shareText = `Ikuti turnamen ${tournamentName || 'Panahan'} di Arcus Digital: ${url}`;

  const shareOptions = [
    { 
      name: 'WhatsApp', 
      icon: MessageCircle, 
      color: 'bg-emerald-500 hover:bg-emerald-600', 
      link: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}` 
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
      link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` 
    }
  ];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-arcus-red rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                <Share2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-oswald uppercase italic text-slate-900 leading-tight">Bagikan Event</h3>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest truncate max-w-[200px]">{tournamentName || 'Arcus Archery'}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-900 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Web Share API Quick Button */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-arcus-red to-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <Share2 className="w-4 h-4" />
              {nativeShareSuccess ? 'Berhasil Dibagikan!' : 'Bagikan via Aplikasi Lain (Share Sheet)'}
            </button>
          )}

          {/* URL inputs */}
          <div className="space-y-4">
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
                  className={`px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5 shrink-0 ${copied === 'info' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  {copied === 'info' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'info' ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>

            {registerUrl && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-emerald-700 uppercase tracking-wider ml-1">Link Pendaftaran Peserta</label>
                <div className="flex gap-2 p-1.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 focus-within:border-emerald-400 transition-colors">
                  <input 
                    readOnly
                    value={registerUrl}
                    className="flex-1 bg-transparent px-3 text-xs font-semibold text-emerald-900 outline-none select-all"
                    onFocus={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => handleCopy(registerUrl, 'register')}
                    className={`px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5 shrink-0 ${copied === 'register' ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-800 text-white hover:bg-emerald-900'}`}
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
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-1">Bagikan Langsung Ke</p>
            <div className="grid grid-cols-3 gap-3">
              {shareOptions.map(option => (
                <a 
                  key={option.name}
                  href={option.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-all group active:scale-95"
                >
                  <div className={`w-11 h-11 ${option.color} rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform mb-2`}>
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
