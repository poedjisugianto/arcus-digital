
import React, { useMemo } from 'react';
import { 
  Users, Trophy, DollarSign, Activity, 
  TrendingUp, Calendar, Target, ArrowUpRight,
  ArrowDownRight, CheckCircle2, Clock, AlertCircle, Plus,
  ChevronRight, Sparkles, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { ArcheryEvent, User, CategoryType } from '../types';
import ArcusLogo from './ArcusLogo';

interface Props {
  user: User;
  events: ArcheryEvent[];
  onManageEvent: (id: string) => void;
  onCreateEvent: () => void;
}

const AdminDashboard: React.FC<Props> = ({ user, events = [], onManageEvent, onCreateEvent }) => {
  const stats = useMemo(() => {
    try {
      const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
      const totalEvents = safeEvents.length;
      
      const totalArchers = safeEvents.reduce((acc, e) => {
        try {
          const archers = Array.isArray(e?.archers) ? e.archers : [];
          const count = archers.filter(a => a && a.category !== CategoryType.OFFICIAL).length;
          return acc + Math.max(count, Number((e as any)?.registrationCount) || 0);
        } catch (err) {
          console.warn("Error calculating archers for event", e?.id, err);
          return acc;
        }
      }, 0);

      const totalOfficials = safeEvents.reduce((acc, e) => {
        try {
          const archers = Array.isArray(e?.archers) ? e.archers : [];
          const officials = Array.isArray(e?.officials) ? e.officials : [];
          const fromArchers = archers.filter(a => a && a.category === CategoryType.OFFICIAL).length;
          const fromOfficials = officials.length;
          return acc + Math.max(fromArchers + fromOfficials, Number((e as any)?.officialCount) || 0);
        } catch (err) {
          console.warn("Error calculating officials for event", e?.id, err);
          return acc;
        }
      }, 0);

      const totalPeople = totalArchers + totalOfficials;

      const totalRevenue = safeEvents.reduce((acc, e) => {
        try {
          const archers = Array.isArray(e?.archers) ? e.archers : [];
          const officials = Array.isArray(e?.officials) ? e.officials : [];
          const archerRevenue = archers.reduce((a, arc) => a + (Number(arc?.totalPaid) || 0), 0);
          const officialRevenue = officials.reduce((a, off) => a + (Number(off?.totalPaid) || 0), 0);
          return acc + archerRevenue + officialRevenue;
        } catch (err) {
          console.warn("Error calculating revenue for event", e?.id, err);
          return acc;
        }
      }, 0);

      const activeEvents = safeEvents.filter(e => e?.status === 'ONGOING').length;
      const upcomingEvents = safeEvents.filter(e => e?.status === 'UPCOMING').length;
      const completedEvents = safeEvents.filter(e => e?.status === 'COMPLETED').length;
      const draftEvents = safeEvents.filter(e => e?.status === 'DRAFT').length;

      // Chart data: Archers per event
      const archerData = safeEvents.slice(0, 5).map(e => {
        const name = e?.settings?.tournamentName || 'UNNAMED';
        const archersCount = Array.isArray(e?.archers) ? e.archers.length : 0;
        return {
          name: name.length > 18 ? name.substring(0, 15) + '...' : name,
          fullName: name,
          archers: Math.max(archersCount, Number((e as any)?.registrationCount) || 0),
          id: e?.id
        };
      });

      // Status distribution
      const statusData = [
        { name: 'Sedang Berjalan', value: activeEvents, color: '#10b981' },
        { name: 'Mendatang', value: upcomingEvents, color: '#3b82f6' },
        { name: 'Selesai', value: completedEvents, color: '#64748b' },
        { name: 'Draf', value: draftEvents, color: '#f59e0b' }
      ].filter(s => s.value > 0);

      // Fallback status if empty
      if (statusData.length === 0 && totalEvents === 0) {
        statusData.push({ name: 'Belum Ada Event', value: 1, color: '#e2e8f0' });
      }

      return { 
        totalEvents, totalArchers, totalRevenue, totalPeople, totalOfficials,
        activeEvents, upcomingEvents, completedEvents, draftEvents,
        archerData, statusData
      };
    } catch (criticalErr) {
      console.error("Critical error in AdminDashboard stats memo", criticalErr);
      return {
        totalEvents: 0, totalArchers: 0, totalRevenue: 0, totalPeople: 0, totalOfficials: 0,
        activeEvents: 0, upcomingEvents: 0, completedEvents: 0, draftEvents: 0,
        archerData: [], statusData: []
      };
    }
  }, [events]);

  if (!user) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-200 space-y-3">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-lg font-black font-oswald uppercase text-red-900">Sesi Bermasalah</h3>
        <p className="text-xs font-medium text-red-600">Mohon login ulang untuk mengakses dashboard admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <DashboardCard 
          title="Total Event" 
          value={stats.totalEvents} 
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50 border-blue-100 text-blue-600"
          badgeText="+2 Bulan Ini"
          badgeType="success"
        />
        <DashboardCard 
          title="Total Peserta" 
          value={stats.totalPeople} 
          icon={<Users className="w-5 h-5 text-purple-600" />}
          iconBg="bg-purple-50 border-purple-100 text-purple-600"
          badgeText={`${stats.totalArchers} Atlet • ${stats.totalOfficials} Official`}
          badgeType="neutral"
        />
        <DashboardCard 
          title="Estimasi Omzet" 
          value={`Rp ${stats.totalRevenue.toLocaleString('id-ID')}`} 
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50 border-emerald-100 text-emerald-600"
          badgeText="+8% Pertumbuhan"
          badgeType="success"
        />
        <DashboardCard 
          title="Event Aktif" 
          value={stats.activeEvents} 
          icon={<Activity className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-50 border-amber-100 text-amber-600"
          badgeText={stats.activeEvents > 0 ? "Sedang Berjalan" : "Tidak Ada Aktif"}
          badgeType={stats.activeEvents > 0 ? "active" : "neutral"}
        />
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Bar Chart: Distribusi Archer */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-arcus-red border border-red-100 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black font-oswald uppercase tracking-tight text-slate-900">
                  Distribusi Archer &amp; Peserta
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Jumlah pendaftar pada 5 event terakhir
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Analitik Turnamen
            </span>
          </div>
          
          <div className="h-[260px] w-full">
            {stats.archerData.length === 0 || stats.archerData.every(d => d.archers === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Target className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">Belum ada data pendaftar turnamen</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Grafik pendaftar per event akan otomatis muncul di sini.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.archerData} margin={{ top: 15, right: 15, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={{ stroke: '#e2e8f0' }} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800">
                            <p className="font-bold text-slate-200">{data.fullName || data.name}</p>
                            <p className="font-black text-emerald-400 text-sm">
                              {data.archers} <span className="text-[10px] font-normal text-slate-300">Peserta Terdaftar</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="archers" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  >
                    {stats.archerData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index % 2 === 0 ? '#ef4444' : '#1e293b'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Pie / Donut Chart */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <PieIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black font-oswald uppercase tracking-tight text-slate-900">
                  Status Event
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Kondisi dan status operasional
                </p>
              </div>
            </div>
          </div>
          
          <div className="h-[160px] w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xl text-xs font-bold border border-slate-800">
                          {data.name}: <span className="text-emerald-400">{data.value} Event</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-2xl font-black font-oswald text-slate-900 leading-none">{stats.totalEvents}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mt-0.5">Total Event</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            {stats.statusData.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] font-bold text-slate-700 truncate">{s.name}</span>
                </div>
                <span className="text-xs font-black font-oswald text-slate-900 ml-1.5">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Events Table / Card Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-6 bg-arcus-red rounded-full" />
              <h3 className="text-lg sm:text-xl font-black font-oswald uppercase tracking-tight text-slate-900">
                Event yang Dikelola
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 ml-5">
              Daftar turnamen dan sesi panahan aktif Anda
            </p>
          </div>
          
          <button 
            onClick={onCreateEvent}
            className="px-5 py-2.5 bg-arcus-red hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Buat Event Baru
          </button>
        </div>

        {events.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">Belum Ada Event</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">Klik tombol Buat Event Baru di atas untuk memulai kejuaraan panahan pertama Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3.5">Turnamen / Event</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Peserta</th>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {events.slice(0, 6).map(event => (
                  <tr key={event.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 border border-slate-200 group-hover:border-arcus-red/40 transition-colors">
                          <ArcusLogo className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate leading-tight group-hover:text-arcus-red transition-colors">
                            {event.settings?.tournamentName || 'Untitled Tournament'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {event.settings?.location || 'Lokasi Belum Ditentukan'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                        event.status === 'ONGOING' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        event.status === 'UPCOMING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        event.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {event.status === 'ONGOING' ? 'Sedang Jalan' :
                         event.status === 'UPCOMING' ? 'Mendatang' :
                         event.status === 'DRAFT' ? 'Draf' :
                         event.status === 'COMPLETED' ? 'Selesai' : event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{Math.max((event.archers || []).length + (event.officials || []).length, (event as any).registrationCount || 0)} Orang</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium text-[11px]">
                      {event.settings?.eventDate || 'TBA'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onManageEvent(event.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-arcus-red hover:text-white text-slate-700 rounded-lg text-xs font-bold transition-all group-hover:shadow-xs active:scale-95"
                      >
                        <span>Kelola</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  badgeText?: string;
  badgeType?: 'success' | 'active' | 'neutral';
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  title, 
  value, 
  icon, 
  iconBg,
  badgeText, 
  badgeType = 'neutral' 
}) => (
  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all hover:border-slate-300 flex flex-col justify-between group">
    <div className="flex items-center justify-between gap-2">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${iconBg}`}>
        {icon}
      </div>
      
      {badgeText && (
        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider truncate max-w-[170px] ${
          badgeType === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
          badgeType === 'active' ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
          'bg-slate-50 text-slate-600 border border-slate-200'
        }`}>
          {badgeText}
        </span>
      )}
    </div>

    <div className="mt-4">
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider leading-none mb-1.5">
        {title}
      </p>
      <h4 className="text-2xl sm:text-3xl font-black font-oswald text-slate-900 leading-none tracking-tight">
        {value}
      </h4>
    </div>
  </div>
);

export default AdminDashboard;

