import React from 'react';
import { 
  Calendar, MapPin, Users, Trophy, Target, 
  ChevronRight, ArrowLeft, Share2, Download, 
  ShieldCheck, Info, Clock, Award, CheckCircle2,
  ExternalLink, Smartphone
} from 'lucide-react';
import { ArcheryEvent, CategoryType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import ArcusLogo from './ArcusLogo';
import { generateGoogleCalendarLink, generateICalFile } from '../lib/calendarUtils';
import { safeFormatDateTime } from '../lib/dateUtils';
import { resolveGoogleDriveUrl } from '../lib/photoService';

interface Props {
  event: ArcheryEvent;
  onBack: () => void;
  onRegister: () => void;
  onShare: () => void;
  onViewParticipants: () => void;
  onViewLiveScoreboard: () => void;
}

export default function EventInfo({ event, onBack, onRegister, onShare, onViewParticipants, onViewLiveScoreboard }: Props) {
  const isExpired = event.settings?.registrationDeadline && new Date() > new Date(event.settings?.registrationDeadline);
  const isRegistrationOpen = event.status !== 'DRAFT' && event.status !== 'COMPLETED';
  
  // Gabungkan peserta dari archers dan registrations secara unik berdasarkan ID (hanya kategori atlet yang valid)
  const activeArchers = React.useMemo(() => {
    const fromArchers = (event.archers || []).filter(a => {
      const status = (a.status || 'PENDING').toUpperCase();
      return !['REJECTED', 'CANCELLED'].includes(status) && a.category !== CategoryType.OFFICIAL;
    });
    const fromRegs = (event.registrations || [])
      .filter((r: any) => {
        const status = (r.status || 'PENDING').toUpperCase();
        return !['REJECTED', 'CANCELLED'].includes(status) && r.regType !== 'OFFICIAL' && r.category !== CategoryType.OFFICIAL;
      })
      .map((r: any) => ({
        ...r,
        category: r.category as CategoryType,
        targetNo: r.targetNo || 0,
        wave: r.wave || 1
      }));

    const map = new Map<string, any>();
    fromRegs.forEach(r => map.set(r.id, r));
    fromArchers.forEach(a => map.set(a.id, { ...(map.get(a.id) || {}), ...a }));

    return Array.from(map.values());
  }, [event.archers, event.registrations]);

  // Total atlet terdaftar yang valid dan selaras 100% dengan daftar peserta
  const hasLoadedList = (event.archers && event.archers.length > 0) || (event.registrations && event.registrations.length > 0) || event.isDetailedLoaded;
  const totalParticipants = hasLoadedList ? activeArchers.length : (event.registrationCount || activeArchers.length || 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-arcus-red selection:text-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-2 md:px-12 h-14 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-6">
            <button 
              onClick={onBack}
              className="p-1.5 md:p-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg md:rounded-2xl transition-all"
            >
              <ArrowLeft className="w-4 h-4 md:w-6 md:h-6" />
            </button>
            <div className="flex items-center gap-1.5 md:gap-3">
              <ArcusLogo className="w-7 h-7 md:w-10 md:h-10" />
              <div className="flex flex-col">
                <h2 className="text-[10px] md:text-xl font-black font-oswald uppercase italic leading-none tracking-tighter text-slate-900">Informasi Event</h2>
                <span className="text-[5px] md:text-[8px] font-black text-arcus-red uppercase tracking-[0.2em]">{event.settings?.tournamentName || 'Arcus Digital'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            <button 
              onClick={onShare}
              className="p-1.5 md:p-3 text-slate-700 hover:text-arcus-red hover:bg-slate-50 rounded-lg md:rounded-2xl transition-all"
            >
              <Share2 className="w-3.5 h-3.5 md:w-5 md:h-5" />
            </button>
            {isRegistrationOpen && (
              <button 
                onClick={onRegister}
                className="bg-arcus-red text-white px-3 md:px-8 py-2 md:py-3 rounded-lg md:rounded-2xl text-[7px] md:text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-red-200 whitespace-nowrap"
              >
                Daftar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-12 py-6 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 md:space-y-12">
            {/* Pamphlet Display */}
            {event.settings?.pamphletUrl && (
              <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm group">
                <img 
                  src={resolveGoogleDriveUrl(event.settings.pamphletUrl)} 
                  alt="Event Pamphlet" 
                  className="w-full h-auto object-contain bg-slate-50"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            
            {/* Hero Card */}
            <div className="bg-white rounded-3xl p-6 md:p-10 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-arcus-red/5 -mr-32 -mt-32 rounded-full" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-arcus-red/10 text-arcus-red text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-4 md:mb-6">
                  <Award className="w-3 h-3" />
                  {event.status === 'ACTIVE' ? 'Live Now' : 'Upcoming Event'}
                </div>
                <h1 className="text-2xl md:text-5xl font-black font-oswald uppercase italic leading-tight mb-6 md:mb-8 tracking-tight text-slate-900">
                  {event.settings?.tournamentName || 'Untitled Event'}
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-arcus-red" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-0.5">Tanggal</p>
                      <p className="text-sm font-bold text-slate-900 uppercase tracking-wide">{event.settings?.eventDate || 'Belum Ditentukan'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                      <Clock className="w-5 h-5 text-arcus-red" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-0.5">Waktu</p>
                      <p className="text-sm font-bold text-slate-900 uppercase tracking-wide">{event.settings?.executionTime || '08:00 - Selesai'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-arcus-red" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-0.5">Lokasi</p>
                      <p className="text-sm font-bold text-slate-900 uppercase tracking-wide truncate max-w-[120px]">{event.settings?.location || 'Lokasi Belum Ditentukan'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-3xl p-4 md:p-10 border border-slate-100 shadow-sm">
              <h3 className="text-lg md:text-2xl font-black font-oswald uppercase italic text-slate-900 mb-4 md:mb-8 flex items-center gap-3">
                <Target className="w-4 h-4 md:w-6 md:h-6 text-arcus-red" />
                Kategori Lomba
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-1.5 md:gap-4">
                {event?.settings?.categoryConfigs && Object.keys(event.settings.categoryConfigs || {}).filter(c => c !== CategoryType.OFFICIAL).length > 0 ? (
                  Object.keys(event.settings.categoryConfigs || {})
                    .filter(cat => cat !== CategoryType.OFFICIAL)
                    .map((cat) => (
                      <div key={cat} className="flex items-center justify-between p-2 md:p-4 bg-slate-50 rounded-lg md:rounded-2xl border border-slate-100 group hover:border-arcus-red transition-all">
                      <div className="flex items-center gap-1.5 md:gap-3">
                        <div className="w-6 h-6 md:w-8 md:h-8 bg-white rounded flex items-center justify-center text-slate-900 text-[8px] md:text-[10px] font-black font-oswald italic group-hover:bg-arcus-red group-hover:text-white transition-all shrink-0">
                          {cat.split('_')[0]}
                        </div>
                        <span className="text-[7px] md:text-[10px] font-black text-slate-900 uppercase tracking-tight line-clamp-1 md:line-clamp-2 leading-none md:leading-tight">{CATEGORY_LABELS[cat] || cat}</span>
                      </div>
                      <ChevronRight className="w-2.5 h-2.5 text-slate-600 group-hover:text-arcus-red hidden sm:block" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-8 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Belum Ada Kategori Lomba</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rundown / Agenda */}
            {event.settings?.rundown && event.settings.rundown.length > 0 && (
              <div className="bg-white rounded-3xl p-6 md:p-10 border border-slate-100 shadow-sm space-y-6 md:space-y-8">
                <h3 className="text-lg md:text-2xl font-black font-oswald uppercase italic text-slate-900 flex items-center gap-3">
                  <Clock className="w-4 h-4 md:w-6 md:h-6 text-arcus-red" />
                  Rundown &amp; Jadwal Tanding
                </h3>
                
                <div className="overflow-hidden border border-slate-100 rounded-2xl md:rounded-[2rem]">
                  <div className="divide-y divide-slate-100">
                    {event.settings.rundown.map((item) => (
                      <div key={item.id} className="p-4 md:p-6 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="px-3.5 py-2 bg-white rounded-xl shadow-sm text-center border border-slate-100 shrink-0 min-w-[80px]">
                            <p className="text-xs font-black text-slate-800 leading-none">{item.startTime}</p>
                            <p className="text-[9px] font-bold text-slate-700 mt-1 uppercase tracking-wide">s/d {item.endTime}</p>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">{item.activity}</h4>
                            <div className="flex flex-wrap items-center gap-2">
                              {item.category && item.category !== 'ALL' && item.category !== 'REST' && item.category !== 'OPENING' && item.category !== 'AWARDS' ? (
                                <span className="px-2 py-0.5 bg-red-50 border border-red-100 rounded text-[8px] font-black text-arcus-red uppercase tracking-widest">
                                  {CATEGORY_LABELS[item.category as CategoryType] || item.category}
                                </span>
                              ) : item.category === 'REST' ? (
                                <span className="px-2 py-0.5 bg-orange-50 border border-orange-100 rounded text-[8px] font-black text-orange-600 uppercase tracking-widest">
                                  Istirahat
                                </span>
                              ) : item.category === 'OPENING' ? (
                                <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-[8px] font-black text-blue-600 uppercase tracking-widest">
                                  Pembukaan
                                </span>
                              ) : item.category === 'AWARDS' ? (
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-[8px] font-black text-emerald-600 uppercase tracking-widest">
                                  Penyerahan Medali
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[8px] font-black text-slate-800 uppercase tracking-widest">
                                  Umum / Semua Sesi
                                </span>
                              )}
                              
                              {item.date && (
                                <span className="text-[10px] font-bold text-slate-700">
                                  • {item.date}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-xs font-medium text-slate-800 italic mt-1 font-sans">
                                * {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Verified Participants List */}
            <div className="bg-white rounded-3xl p-6 md:p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg md:text-2xl font-black font-oswald uppercase italic text-slate-900 flex items-center gap-3">
                  <Users className="w-4 h-4 md:w-6 md:h-6 text-arcus-red" />
                  Daftar Peserta
                </h3>
                <button 
                  onClick={onViewParticipants}
                  className="text-[10px] font-black uppercase tracking-widest text-arcus-red hover:text-slate-900 transition-colors flex items-center gap-2"
                >
                  Lihat Semua <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {activeArchers.length > 0 ? (
                <div className="space-y-3">
                  {activeArchers.slice(0, 10).map((archer) => (
                    <div key={archer.id} className={`flex items-center justify-between p-4 bg-slate-50 rounded-2xl border transition-all ${['APPROVED', 'PAID', 'CONFIRMED'].includes((archer.status || 'PENDING').toUpperCase()) ? 'border-slate-100 group hover:border-emerald-500' : 'border-slate-100 group hover:border-amber-500'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xs md:text-sm font-black font-oswald italic text-slate-700 transition-all">
                          {['APPROVED', 'PAID', 'CONFIRMED'].includes((archer.status || 'PENDING').toUpperCase()) ? (
                            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                          ) : (
                            <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-500 animate-pulse" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm md:text-lg font-black font-oswald uppercase italic text-slate-900 leading-none">{archer.name}</p>
                          <p className="text-[8px] md:text-[10px] font-bold text-slate-700 uppercase tracking-widest mt-1">{archer.club}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="hidden md:block">
                          <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-700 uppercase tracking-widest">
                            {CATEGORY_LABELS[archer.category as CategoryType] || archer.category}
                          </span>
                        </div>
                        {['APPROVED', 'PAID', 'CONFIRMED'].includes((archer.status || 'PENDING').toUpperCase()) ? (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-1.5 h-1.5 md:w-2 md:h-2" /> TERVERIFIKASI
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-1.5 h-1.5 md:w-2 md:h-2" /> MENUNGGU
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {activeArchers.length > 10 && (
                    <button 
                      onClick={onViewParticipants}
                      className="w-full py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-900 transition-colors"
                    >
                      + {activeArchers.length - 10} Peserta Lainnya
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                   <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-loose">
                     Belum ada peserta yang mendaftar.<br/>
                     Daftarkan diri Anda sekarang untuk menjadi yang pertama.
                   </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 md:space-y-8">
            {/* Action Card */}
            <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 border border-slate-100 shadow-xl shadow-slate-200">
              <div className="text-center mb-6 md:mb-8">
                <p className="text-[8px] md:text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mb-2">Total Peserta</p>
                <p className="text-5xl md:text-6xl font-black font-oswald uppercase italic text-slate-900 leading-none">{totalParticipants}</p>
                <p className="text-[8px] md:text-[9px] font-bold text-arcus-red uppercase tracking-widest mt-2">Atlet Terdaftar</p>
              </div>
              
              <div className="space-y-4">
                {isRegistrationOpen ? (
                  <>
                    <button 
                      onClick={onRegister}
                      className="w-full py-5 bg-arcus-red text-white rounded-[2rem] font-black font-oswald uppercase italic text-xl hover:bg-slate-900 transition-all shadow-xl shadow-arcus-red/20 flex items-center justify-center gap-3"
                    >
                      Daftar Sekarang
                    </button>
                    {event.settings?.registrationDeadline && (
                      <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest text-center">
                        Batas Akhir: {safeFormatDateTime(event.settings?.registrationDeadline)}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="w-full py-5 bg-slate-100 text-slate-700 rounded-[2rem] font-black font-oswald uppercase italic text-xl text-center">
                      Pendaftaran Tutup
                    </div>
                    {isExpired && (
                      <p className="text-[9px] font-black text-arcus-red uppercase tracking-widest text-center">
                        Waktu pendaftaran sudah berakhir
                      </p>
                    )}
                  </div>
                )}

                <button 
                  onClick={onViewLiveScoreboard}
                  className="w-full py-5 bg-slate-900 border border-slate-800 text-white hover:bg-arcus-red hover:border-arcus-red rounded-[2rem] font-black font-oswald uppercase italic text-xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Live Score &amp; Bagan Aduan
                </button>

                <div className="grid grid-cols-2 gap-3 pb-4">
                  <a 
                    href={generateGoogleCalendarLink({
                      title: event.settings?.tournamentName || 'Event',
                      description: event.settings?.description || '',
                      location: event.settings?.location || '',
                      startDate: event.settings?.eventDate || ''
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  >
                    Google Cal
                  </a>
                  <button 
                    onClick={() => generateICalFile({
                      title: event.settings?.tournamentName || 'Event',
                      description: event.settings?.description || '',
                      location: event.settings?.location || '',
                      startDate: event.settings?.eventDate || ''
                    })}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                  >
                    Apple / iCal
                  </button>
                </div>
                {event.settings?.thbUrl && (
                  <a 
                    href={event.settings?.thbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-[2rem] font-black font-oswald uppercase italic text-xl hover:border-slate-900 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                  >
                    <Download className="w-5 h-5" />
                    Download THB
                  </a>
                )}
                {event.settings?.waGroupLink && (
                  <a 
                    href={event.settings?.waGroupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black font-oswald uppercase italic text-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 shadow-sm"
                  >
                    <Smartphone className="w-5 h-5" />
                    Grup WA Peserta
                  </a>
                )}
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full" />
              <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                  <ShieldCheck className="w-8 h-8 text-arcus-red" />
                  <div>
                    <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Status Event</p>
                    <p className="text-xs font-bold uppercase tracking-wider">Terverifikasi Arcus</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Clock className="w-8 h-8 text-arcus-red" />
                  <div>
                    <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Live Updates</p>
                    <p className="text-xs font-bold uppercase tracking-wider">Real-time Scoring</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <p className="text-[9px] font-bold text-white/70 uppercase leading-relaxed tracking-widest">
                    Event ini menggunakan sistem Arcus Digital Tournament OS untuk akurasi data dan transparansi skor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
