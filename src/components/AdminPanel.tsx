
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Save, Calendar, ImageIcon, FileText, Trophy, Target as TargetIcon, 
  Upload, Trash2, Plus, Landmark, CreditCard, X, MapPin, 
  Link as LinkIcon, Info, Hash, Repeat, Compass, Layers, 
  Users as UsersIcon, AlertTriangle, AlertCircle, ShieldCheck, Zap, ToggleRight, ToggleLeft,
  FileDown, ExternalLink, HelpCircle, Check, ChevronLeft, Smartphone, Clock, Swords, Monitor,
  Heart, Youtube, Video, Crosshair, Scale, Sliders, Award, Printer, GitBranch, Share2, Receipt
} from 'lucide-react';
import { TournamentSettings, CategoryType, TargetType, PaymentMethod, ScorerAccess, CategoryConfig, Sponsorship, Archer, ParticipantRegistration, GlobalSettings, RundownItem, ArcheryEvent } from '../types';
import { CATEGORY_LABELS, TARGET_LABELS } from '../constants';
import { tryRecoverJSON } from '../lib/firestoreUtils';
import { resolveGoogleDriveUrl } from '../lib/photoService';
import ArcherList from './ArcherList';
import OfficialList from './OfficialList';
import PrintRoundReportModal from './PrintRoundReportModal';

interface Props {
  eventId: string;
  settings: TournamentSettings;
  scorerAccess?: ScorerAccess[];
  archers: Archer[];
  officials: ParticipantRegistration[];
  event?: ArcheryEvent;
  onSave: (settings: TournamentSettings) => void;
  onUpdateScorers?: (scorers: ScorerAccess[]) => void;
  onClear: () => void;
  onDelete?: () => void;
  onRemoveParticipant?: (id: string) => void;
  onAddParticipant?: (participant: ParticipantRegistration) => void;
  onUpdateParticipant?: (id: string, updates: Partial<ParticipantRegistration>) => void;
  onBulkUpdateArchers?: (updated: Archer[]) => void;
  onBulkAddParticipants?: (newArchers: Archer[]) => Promise<void> | void;
  onBack: () => void;
  onOpenTV?: () => void;
  onShare?: () => void;
  onManageElimination?: () => void;
  onManageResults?: () => void;
  onManageFinance?: () => void;
  onManageIdCards?: () => void;
  onGoToOperatorCenter?: () => void;
  onGoToQuickScoring?: () => void;
  onGoToFieldScoring?: () => void;
  onRefreshData?: () => void;
  onPushToCloud?: () => void;
  isPushing?: boolean;
  globalSettings: GlobalSettings;
  isSuperAdmin?: boolean;
}

const AdminPanel: React.FC<Props> = ({ 
  eventId, 
  settings, 
  scorerAccess = [], 
  archers = [],
  officials = [],
  event,
  onSave, 
  onUpdateScorers, 
  onClear, 
  onDelete, 
  onRemoveParticipant,
  onAddParticipant,
  onUpdateParticipant,
  onBulkUpdateArchers,
  onBulkAddParticipants,
  onBack, 
  onOpenTV, 
  onShare,
  onManageElimination,
  onManageResults,
  onManageFinance,
  onManageIdCards,
  onGoToOperatorCenter,
  onGoToQuickScoring,
  onGoToFieldScoring,
  onRefreshData,
  onPushToCloud,
  isPushing,
  globalSettings,
  isSuperAdmin = false 
}) => {
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const [localSettings, setLocalSettings] = useState<TournamentSettings>(() => {
    const savedDraft = localStorage.getItem(`admin_draft_${eventId}`);
    if (savedDraft) {
      try {
        return tryRecoverJSON(savedDraft);
      } catch (e) { console.error("Draft parse failed", e); }
    }
    const baseSettings = (settings || {}) as TournamentSettings;
    return {
      ...baseSettings,
      categoryConfigs: baseSettings.categoryConfigs || {}
    } as TournamentSettings;
  });
  const isPractice = localSettings.isPractice;
  const [isDirty, setIsDirty] = useState(false);
  const [localScorers, setLocalScorers] = useState<ScorerAccess[]>(scorerAccess);

  // Sync draft to localStorage when settings change
  useEffect(() => {
    if (isDirty) {
      localStorage.setItem(`admin_draft_${eventId}`, JSON.stringify(localSettings));
    }
  }, [localSettings, eventId, isDirty]);

  const [activeTab, setActiveTab] = useState<'GENERAL' | 'PARTICIPANTS' | 'SCORING' | 'PAYMENT' | 'SCORERS' | 'SPONSORSHIP' | 'RUNDOWN'>('GENERAL');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [showSavedFlag, setShowSavedFlag] = useState(false);
  const [showDraftConfirm, setShowDraftConfirm] = useState(false);
  const [showModeConfirm, setShowModeConfirm] = useState<{ isOpen: boolean; next: boolean; msg: string }>({ isOpen: false, next: false, msg: '' });
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  
  // Only sync from props if the tournament name changes (indicating a different event)
  // or if we're not currently editing (not dirty)
  useEffect(() => {
    if (!isDirty) {
      setLocalSettings(settings || { ...localSettings });
      setLocalScorers(scorerAccess || []);
    }
  }, [settings, scorerAccess, isDirty]);

  const updateSettings = (updates: Partial<TournamentSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const addRundownItem = () => {
    const newItem: RundownItem = {
      id: Math.random().toString(36).substring(2, 9),
      category: 'ALL',
      activity: '',
      startTime: '08:00',
      endTime: '09:00',
      date: localSettings.eventDate || '',
      notes: ''
    };
    updateSettings({ rundown: [...(localSettings.rundown || []), newItem] });
  };

  const removeRundownItem = (id: string) => {
    const filtered = (localSettings.rundown || []).filter(item => item.id !== id);
    updateSettings({ rundown: filtered });
  };

  const updateRundownItem = (id: string, updates: Partial<RundownItem>) => {
    const updated = (localSettings.rundown || []).map(item => {
      if (item.id === id) {
        return { ...item, ...updates };
      }
      return item;
    });
    updateSettings({ rundown: updated });
  };

  const updateCategoryConfig = (cat: CategoryType, field: keyof CategoryConfig, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      categoryConfigs: {
        ...prev.categoryConfigs,
        [cat]: { 
          ...(prev.categoryConfigs?.[cat] as CategoryConfig), 
          [field]: value 
        }
      }
    }));
    setIsDirty(true);
  };

  const addCategory = (cat: CategoryType) => {
    if (localSettings.categoryConfigs?.[cat]) return;
    setLocalSettings(prev => ({
      ...prev,
      categoryConfigs: {
        ...(prev.categoryConfigs || {}),
        [cat]: {
          registrationFee: 0,
          distance: '20m',
          arrows: 36,
          ends: 6,
          targetType: TargetType.STANDARD,
          h2hStartSize: 0,
          eliminationStages: []
        }
      }
    }));
    setIsDirty(true);
  };

  const removeCategory = (cat: CategoryType) => {
    setLocalSettings(prev => {
      const newConfigs = { ...(prev.categoryConfigs || {}) };
      delete newConfigs[cat];
      return { ...prev, categoryConfigs: newConfigs };
    });
    setIsDirty(true);
  };

  const addPaymentMethod = () => {
    const newPm: PaymentMethod = {
      id: 'pm_' + Math.random().toString(36).substr(2, 9),
      provider: 'BCA',
      accountName: 'Bendahara',
      accountNumber: ''
    };
    setLocalSettings(prev => ({ ...prev, paymentMethods: [...(prev.paymentMethods || []), newPm] }));
    setIsDirty(true);
  };

  const removePaymentMethod = (id: string) => {
    setLocalSettings(prev => ({ ...prev, paymentMethods: (prev.paymentMethods || []).filter(pm => pm.id !== id) }));
    setIsDirty(true);
  };

  const updatePaymentMethod = (id: string, field: keyof PaymentMethod, value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).map(pm => pm.id === id ? { ...pm, [field]: value } : pm)
    }));
    setIsDirty(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleFinalSave = () => {
    // Validation for Tournament (not practice)
    if (!localSettings?.isPractice) {
      const missingFields = [];
      if (!localSettings?.tournamentName) missingFields.push('Nama Turnamen');
      if (!localSettings?.description) missingFields.push('Keterangan');
      if (!localSettings?.location) missingFields.push('Lokasi');
      if (!localSettings?.eventDate) missingFields.push('Tanggal');
      if ((localSettings?.paymentMethods || []).length === 0) missingFields.push('Metode Pembayaran');

      if (missingFields.length > 0) {
        setShowDraftConfirm(true);
        setShowConfirmModal(false);
        return;
      }
    }

    executeFinalSave();
  };

  const executeFinalSave = () => {
    onSave(localSettings);
    if (onUpdateScorers) onUpdateScorers(localScorers);
    
    // Clear draft
    localStorage.removeItem(`admin_draft_${eventId}`);
    
    setShowConfirmModal(false);
    setShowDraftConfirm(false);
    setShowSavedFlag(true);
    setIsDirty(false);
    setTimeout(() => setShowSavedFlag(false), 3000);
  };

  const addScorer = () => {
    const total = localSettings.totalTargets || 1;
    const newScorer: ScorerAccess = {
      id: 'scr_' + Math.random().toString(36).substr(2, 9),
      name: `Scorer ${localScorers.length + 1}`,
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      accessCode: Math.floor(1000 + Math.random() * 9000).toString(),
      eventId: '', // Filled by parent
      permissions: ['INPUT_SCORE'],
      assignmentMode: 'ALL',
      assignedTargets: []
    };
    setLocalScorers([...localScorers, newScorer]);
    setIsDirty(true);
  };

  const autoDistributeTargets = () => {
    if (localScorers.length === 0) return;
    const total = localSettings.totalTargets || 1;
    const count = localScorers.length;
    const targetsPerScorer = Math.max(1, Math.ceil(total / count));

    const updated = localScorers.map((s, idx) => {
      const start = (idx * targetsPerScorer) + 1;
      const end = Math.min(total, (idx + 1) * targetsPerScorer);
      
      if (start > total) {
        return {
          ...s,
          assignmentMode: 'RANGE' as const,
          targetRangeStart: total,
          targetRangeEnd: total,
          assignedTargets: [total]
        };
      }
      
      const targets: number[] = [];
      for (let t = start; t <= end; t++) {
        targets.push(t);
      }
      return {
        ...s,
        assignmentMode: 'RANGE' as const,
        targetRangeStart: start,
        targetRangeEnd: end,
        assignedTargets: targets
      };
    });

    setLocalScorers(updated);
    setIsDirty(true);
  };

  const removeScorer = (id: string) => {
    setLocalScorers(localScorers.filter(s => s.id !== id));
    setIsDirty(true);
  };

  const updateScorer = (id: string, field: keyof ScorerAccess, value: any) => {
    setLocalScorers(localScorers.map(s => s.id === id ? { ...s, [field]: value } : s));
    setIsDirty(true);
  };

  const addSponsorship = () => {
    const newSponsor: Sponsorship = {
      id: 'spn_' + Math.random().toString(36).substr(2, 9),
      name: '',
      title: 'OFFICIAL PARTNER',
      videoUrl: ''
    };
    setLocalSettings(prev => ({ 
      ...prev, 
      sponsorships: [...(prev.sponsorships || []), newSponsor] 
    }));
    setIsDirty(true);
  };

  const removeSponsorship = (id: string) => {
    setLocalSettings(prev => ({ 
      ...prev, 
      sponsorships: (prev.sponsorships || []).filter(s => s.id !== id) 
    }));
    setIsDirty(true);
  };

  const updateSponsorship = (id: string, field: keyof Sponsorship, value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      sponsorships: (prev.sponsorships || []).map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
    setIsDirty(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const executeDelete = () => {
    if (onDelete) onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="min-h-screen bg-slate-50" id="settings-form">
      {/* Saved Success Flag */}
      {showSavedFlag && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-600 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 border border-white/20">
            <Check className="w-6 h-6" />
            <span className="text-sm font-black uppercase tracking-widest">Pengaturan Berhasil Disimpan</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-[100] bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (isDirty) {
                  setShowUnsavedConfirm(true);
                } else {
                  onBack();
                }
              }}
              className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-white border border-slate-100 rounded-lg text-slate-700 hover:text-arcus-red transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black font-oswald uppercase italic leading-none tracking-tighter text-slate-900">
                  {isPractice ? 'KONFIGURASI' : 'KONTROL'}
                </h1>
                {isDirty && (
                  <span className="bg-amber-100 text-amber-700 text-[6px] md:text-[7px] font-black px-1 py-0.5 rounded uppercase tracking-widest border border-amber-200 animate-pulse">
                    UNSAVED
                  </span>
                )}
                {!isPractice && (
                  <div className={`px-1.5 py-0.5 rounded text-[6px] md:text-[7px] font-black uppercase tracking-widest border ${localSettings.isActivated !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    {localSettings.isActivated !== false ? 'AKTIF' : 'PENDING'}
                  </div>
                )}
              </div>
              <p className="text-[7px] md:text-[9px] font-bold text-slate-900 uppercase tracking-widest mt-0.5 italic truncate max-w-[120px] md:max-w-none">
                {isPractice ? 'Sesi Scoring' : `EVENT: ${localSettings.tournamentName || 'Untitled'}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onManageFinance && !isPractice && (
              <button 
                type="button"
                onClick={onManageFinance}
                className="px-3.5 md:px-5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-95 shadow-xs"
                title="Lihat Rekap Keuangan & Verifikasi Bukti Transfer"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">KEUANGAN & BUKTI</span>
                <span className="sm:hidden">BUKTI</span>
              </button>
            )}
            {onShare && !isPractice && (
              <button 
                type="button"
                onClick={onShare}
                className="px-3.5 md:px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-700 hover:text-arcus-red hover:border-red-200 transition-all active:scale-95 shadow-sm"
                title="Bagikan Event"
              >
                <Share2 className="w-3.5 h-3.5 text-arcus-red" />
                <span className="hidden sm:inline">BAGIKAN</span>
              </button>
            )}
            {onOpenTV && (
              <button 
                onClick={onOpenTV}
                className="hidden lg:flex px-6 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest items-center gap-3 text-white hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                <Monitor className="w-4 h-4 shadow-sm" /> BIG SCREEN MODE
              </button>
            )}
            <button 
              onClick={onClear}
              className="hidden sm:flex px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-slate-600 hover:text-red-600 transition-all font-sans"
            >
              RESET
            </button>
            <button 
              onClick={handleSubmit}
              disabled={!isDirty}
              className={`flex-1 md:flex-none px-6 md:px-8 py-2.5 md:py-3 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 ${isDirty ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
            >
              <Save className="w-3.5 h-3.5 md:w-4 md:h-4" /> SIMPAN <span className="hidden sm:inline">KONFIGURASI</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex self-start w-fit border-b border-slate-100">
            <button 
              type="button"
              onClick={() => setActiveTab('GENERAL')}
              className={`px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'GENERAL' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <Trophy className={`w-3.5 h-3.5 ${activeTab === 'GENERAL' ? 'text-arcus-red' : ''}`} /> INFO & KATEGORI
              {activeTab === 'GENERAL' && <motion.div layoutId="admTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcus-red" />}
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('RUNDOWN')}
              className={`px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'RUNDOWN' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <Clock className={`w-3.5 h-3.5 ${activeTab === 'RUNDOWN' ? 'text-arcus-red' : ''}`} /> RUNDOWN ACARA
              {activeTab === 'RUNDOWN' && <motion.div layoutId="admTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcus-red" />}
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('PARTICIPANTS')}
              className={`px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'PARTICIPANTS' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <UsersIcon className={`w-3.5 h-3.5 ${activeTab === 'PARTICIPANTS' ? 'text-arcus-red' : ''}`} /> PESERTA
              {activeTab === 'PARTICIPANTS' && <motion.div layoutId="admTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcus-red" />}
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('SCORING')}
              className={`px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'SCORING' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <TargetIcon className={`w-3.5 h-3.5 ${activeTab === 'SCORING' ? 'text-arcus-red' : ''}`} /> INPUT SKOR
              {activeTab === 'SCORING' && <motion.div layoutId="admTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcus-red" />}
            </button>
            {!isPractice && (
              <button 
                type="button"
                onClick={() => setActiveTab('PAYMENT')}
                className={`px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'PAYMENT' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
              >
                <Landmark className={`w-3.5 h-3.5 ${activeTab === 'PAYMENT' ? 'text-arcus-red' : ''}`} /> PEMBAYARAN
                {activeTab === 'PAYMENT' && <motion.div layoutId="admTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcus-red" />}
              </button>
            )}
            {!isPractice && onManageFinance && (
              <button 
                type="button"
                onClick={onManageFinance}
                className="px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50/50 rounded-t-xl"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-600" /> BUKTI BAYAR & KEUANGAN
              </button>
            )}
            <button 
              type="button"
              onClick={() => setActiveTab('SCORERS')}
              className={`px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'SCORERS' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <Smartphone className={`w-3.5 h-3.5 ${activeTab === 'SCORERS' ? 'text-arcus-red' : ''}`} /> AKSES PANITIA
              {activeTab === 'SCORERS' && <motion.div layoutId="admTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcus-red" />}
            </button>
            {!isPractice && (
              <button 
                type="button"
                onClick={() => setActiveTab('SPONSORSHIP')}
                className={`px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'SPONSORSHIP' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
              >
                <Heart className={`w-3.5 h-3.5 ${activeTab === 'SPONSORSHIP' ? 'text-arcus-red' : ''}`} /> SPONSORSHIP
                {activeTab === 'SPONSORSHIP' && <motion.div layoutId="admTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcus-red" />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-10 pb-32">
        {activeTab === 'PARTICIPANTS' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
            <div className="bg-white rounded-[3rem] p-4 md:p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg md:text-2xl font-black font-oswald uppercase italic flex items-center gap-3">
                  <TargetIcon className="w-6 h-6 text-arcus-red" /> Daftar Archer
                </h3>
              </div>
              <ArcherList 
                archers={archers} 
                onBack={() => setActiveTab('GENERAL')} 
                onRemove={onRemoveParticipant || (() => {})}
                onAdd={onAddParticipant || (() => {})}
                onBulkAdd={onBulkAddParticipants}
                onUpdate={(a) => onUpdateParticipant?.(a.id, a)}
                onBulkUpdate={onBulkUpdateArchers || (() => {})}
                onGoToIdCardEditor={onManageIdCards || (() => {})}
                onRefreshData={onRefreshData}
                onPushToCloud={onPushToCloud}
                isPushing={isPushing}
                archersPerTarget={settings.archersPerTarget || 3}
                totalTargets={settings.totalTargets || 20}
                settings={settings}
                eventId={eventId}
                globalSettings={globalSettings}
              />
            </div>

            <div className="bg-white rounded-[3rem] p-4 md:p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg md:text-2xl font-black font-oswald uppercase italic flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" /> Daftar Official
                </h3>
              </div>
              <OfficialList 
                officials={officials} 
                onBack={() => setActiveTab('GENERAL')} 
                onUpdate={(o) => onUpdateParticipant?.(o.id, o)}
                onRemove={onRemoveParticipant || (() => {})}
                onGoToIdCardEditor={onManageIdCards}
                settings={settings}
              />
            </div>
          </div>
        )}

        {activeTab === 'SCORING' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 md:p-12 border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 opacity-10 blur-xl">
                <TargetIcon className="w-96 h-96" />
              </div>
              <div className="relative z-10 max-w-3xl space-y-4">
                <span className="bg-arcus-red text-white text-[7px] md:text-[8px] font-black px-2 py-1 rounded uppercase tracking-[0.25em]">
                  Digital scoring center
                </span>
                <h3 className="text-2xl md:text-4xl font-black font-oswald uppercase italic leading-none tracking-tight">
                  Pusat Penilaian &amp; Rekapitulasi Skor
                </h3>
                <p className="text-slate-600 text-xs md:text-sm font-medium leading-relaxed italic">
                  Kelola seluruh pencatatan nilai sesi kualifikasi turnamen Anda dari satu tempat. Gunakan metode input cepat grid untuk rekap massal, atau konsol koreksi jika terdapat kesalahan atau komplain atlet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Option 1: Quick Grid Scoring */}
              <div className="bg-white hover:bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <TargetIcon className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">
                      1. Quick Scoring Grid
                    </h4>
                    <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                      Input skor super cepat berbasis nomor bantalan kualifikasi. Ideal untuk memasukkan rekap fisik lembar skor secara masif.
                    </p>
                  </div>
                </div>
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={onGoToQuickScoring}
                    className="w-full py-4 text-center bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    Buka Quick Grid
                  </button>
                </div>
              </div>

              {/* Option 2: Operator Center & Audit */}
              <div className="bg-white hover:bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">
                      2. Operator &amp; Audit Desk
                    </h4>
                    <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                      Koreksi &amp; audit skor manual resmi. Dilengkapi audit logs (mencatat alasan perubahan) sesuai standar regulasi judge panitia.
                    </p>
                  </div>
                </div>
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={onGoToOperatorCenter}
                    className="w-full py-4 text-center bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    Buka Operator Desk
                  </button>
                </div>
              </div>

              {/* Option 3: Direct Scorer Terminal */}
              <div className="bg-white hover:bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-600">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">
                      3. Field Scorer Panel
                    </h4>
                    <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                      Tampilan persis dengan gadget yang digunakan oleh Tim Scorer di lapangan atau Atlet di bantalan untuk mencatat skor anak panah.
                    </p>
                  </div>
                </div>
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={onGoToFieldScoring}
                    className="w-full py-4 text-center bg-pink-600 hover:bg-pink-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    Buka Terminal Scorer
                  </button>
                </div>
              </div>

              {/* Option 4: Cetak Laporan Skor & Babak (NEW) */}
              <div className="bg-white hover:bg-slate-50 border-2 border-arcus-red/30 rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between shadow-md transition-all hover:shadow-xl hover:-translate-y-1 duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-arcus-red text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
                  FITUR CETAK RESMI
                </div>
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-arcus-red group-hover:scale-110 transition-transform">
                    <Printer className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">
                      4. Cetak Skor &amp; Hasil Babak
                    </h4>
                    <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                      Cetak hasil kualifikasi (lolos 32/16/8 besar), hasil per babak eliminasi, rekap skor aduan, hingga daftar juara &amp; podium final lomba.
                    </p>
                  </div>
                </div>
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={() => setShowPrintReportModal(true)}
                    className="w-full py-4 text-center bg-arcus-red hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Buka Menu Cetak
                  </button>
                </div>
              </div>

              {/* Option 5: Bagan Eliminasi & Aduan */}
              <div className="bg-white hover:bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Swords className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">
                      5. Bagan Eliminasi &amp; Aduan
                    </h4>
                    <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                      Kelola bagan gugur (bracket), shoot-off, countback, pemenang pertandingan aduan, hingga perebutan medali emas dan perunggu.
                    </p>
                  </div>
                </div>
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={onManageElimination}
                    className="w-full py-4 text-center bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    Kelola Eliminasi
                  </button>
                </div>
              </div>

              {/* Option 6: Rekapitulasi Hasil Lomba */}
              <div className="bg-white hover:bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">
                      6. Hasil Lomba &amp; Podium
                    </h4>
                    <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                      Lihat klasemen akhir, peringkat kualifikasi lengkap dengan tie-break (6/5/X), serta daftar pemenang medali turnamen.
                    </p>
                  </div>
                </div>
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={onManageResults}
                    className="w-full py-4 text-center bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    Lihat Hasil &amp; Podium
                  </button>
                </div>
              </div>

              {/* Option 7: Tournament Timer & Shooting Clock */}
              <div className="bg-white hover:bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
                    <Clock className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black font-oswald uppercase italic text-slate-900">
                      7. Timer &amp; Shooting Clock
                    </h4>
                    <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                      Akses stopwatch terintegrasi &amp; timer official turnamen untuk menghitung durasi tembak atlet (240s / 120s) secara sinkron.
                    </p>
                  </div>
                </div>
                <div className="pt-8 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowTimerModal(true)}
                    className="w-full py-3.5 text-center bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Monitor className="w-4 h-4" /> Sematkan Di Sini
                  </button>
                  <a
                    href="https://ais-pre-ihwvpfbazwbyenzfsn3unw-238734823836.asia-southeast1.run.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 text-center border-2 border-slate-200 hover:border-slate-400 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" /> Buka Tab Baru
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'PARTICIPANTS' && activeTab !== 'SCORING' && (
          <form onSubmit={handleSubmit} className="space-y-16">
            {activeTab === 'GENERAL' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Section: Basic Identity */}
              <div className="space-y-8">
             <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className={`p-2 rounded-xl ${isPractice ? 'bg-teal-50' : 'bg-red-50'}`}>
                  <Info className={`w-5 h-5 ${isPractice ? 'text-teal-600' : 'text-arcus-red'}`} />
                </div>
                <h3 className="text-xl font-black font-oswald uppercase italic text-slate-800">Identitas & Sesi</h3>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    <label className="block group">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Nama Sesi / Turnamen</span>
                      <input type="text" value={localSettings.tournamentName} onChange={e => updateSettings({ tournamentName: e.target.value })} className="mt-1 block w-full rounded-lg border-slate-200 p-3 border font-bold text-base outline-none focus:border-arcus-red transition-all text-slate-900" required />
                    </label>

                    <label className="block group">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Keterangan Singkat</span>
                      <textarea 
                        value={localSettings.description} 
                        onChange={e => updateSettings({ description: e.target.value })} 
                        className="mt-1 block w-full rounded-lg border-slate-200 p-3 border font-bold text-sm outline-none focus:border-arcus-red transition-all h-24 resize-none text-slate-900" 
                        placeholder="Deskripsi turnamen..."
                      />
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="block group">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Lokasi</span>
                        <input type="text" placeholder="Stadion..." value={localSettings.location} onChange={e => updateSettings({ location: e.target.value })} className="block mt-1 w-full rounded-lg border-slate-200 p-3 border font-bold outline-none focus:border-arcus-red text-slate-900" />
                      </label>

                      <label className="block group">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1 italic">Tanggal</span>
                        <input type="text" placeholder="DD - DD MM YYYY" value={localSettings.eventDate} onChange={e => updateSettings({ eventDate: e.target.value })} className="block mt-1 w-full rounded-lg border-slate-200 p-3 border font-bold outline-none focus:border-arcus-red text-slate-900" />
                      </label>

                      <label className="block group">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1 font-sans">Jam Pelaksanaan</span>
                        <input type="text" placeholder="08:00 - Selesai" value={localSettings.executionTime || ''} onChange={e => updateSettings({ executionTime: e.target.value })} className="block mt-1 w-full rounded-lg border-slate-200 p-3 border font-bold outline-none focus:border-arcus-red text-slate-900" />
                      </label>
                    </div>

                    {!isPractice && (
                      <div className="space-y-6 pt-4 border-t border-slate-100">
                        <label className="block group">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-arcus-red" />
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Batas Akhir Pendaftaran Online</span>
                          </div>
                          <input 
                            type="datetime-local" 
                            value={localSettings.registrationDeadline || ''} 
                            onChange={e => updateSettings({ registrationDeadline: e.target.value })} 
                            className="block w-full rounded-lg border-slate-200 p-3 border font-bold text-sm outline-none focus:border-arcus-red transition-all text-slate-900" 
                          />
                        </label>

                        <label className="block group">
                          <div className="flex items-center gap-2 mb-1">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Link WhatsApp Group Peserta</span>
                          </div>
                          <input 
                            type="url" 
                            placeholder="https://chat.whatsapp.com/..."
                            value={localSettings.waGroupLink || ''} 
                            onChange={e => updateSettings({ waGroupLink: e.target.value })} 
                            className="block w-full rounded-lg border-slate-200 p-3 border font-bold text-sm outline-none focus:border-emerald-500 transition-all text-slate-900" 
                          />
                          <p className="mt-1.5 text-[8px] font-bold text-slate-700 uppercase tracking-wider italic">
                            * Link ini akan ditampilkan kepada peserta setelah berhasil mendaftar.
                          </p>
                        </label>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block group">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Total Bantalan</span>
                        <input type="number" value={localSettings.totalTargets} onChange={e => updateSettings({ totalTargets: parseInt(e.target.value) || 1 })} className="block mt-1 w-full rounded-lg border-slate-200 p-3 border font-bold outline-none focus:border-arcus-red text-slate-900" min="1" />
                      </label>

                      <label className="block group">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1 italic">Archer per Target Face</span>
                        <input type="number" value={localSettings.archersPerTarget || 2} onChange={e => updateSettings({ archersPerTarget: parseInt(e.target.value) || 1 })} className="block mt-1 w-full rounded-lg border-slate-200 p-3 border font-bold outline-none focus:border-arcus-red text-slate-900" min="1" max="4" />
                      </label>
                    </div>

                    {/* Mode Toggle */}
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 border-l-4 border-l-arcus-red">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${localSettings.isPractice ? 'bg-teal-100 text-teal-600' : 'bg-amber-100 text-amber-600'}`}>
                            {localSettings.isPractice ? <Zap className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-900 leading-none">Mode Turnamen</p>
                            <p className="text-[8px] font-bold text-slate-700 uppercase mt-1">
                              {localSettings.isPractice ? 'Latihan' : 'Turnamen'}
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const next = !localSettings.isPractice;
                            const msg = next 
                              ? "Ubah ke Mode Latihan? Fitur pendaftaran online akan dinonaktifkan." 
                              : "Ubah ke Mode Turnamen? Fitur pendaftaran online akan diaktifkan.";
                            setShowModeConfirm({ isOpen: true, next, msg });
                          }}
                          className="transition-all active:scale-90"
                        >
                           {!localSettings.isPractice ? <ToggleRight className="w-10 h-10 text-arcus-red" /> : <ToggleLeft className="w-10 h-10 text-slate-600" />}
                        </button>
                      </div>
                    </div>
                </div>

                {!isPractice && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                       <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Fitur Pendaftaran</p>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-lg ${localSettings.enableGateway ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-700'}`}>
                                <Zap className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-xs font-black uppercase text-slate-900 leading-none">Payment Gateway</p>
                                <p className="text-[9px] font-bold text-slate-900 uppercase mt-1">Otomatisasi Status Lunas</p>
                             </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => updateSettings({ enableGateway: !localSettings.enableGateway })}
                            className="transition-all active:scale-90"
                          >
                             {localSettings.enableGateway ? <ToggleRight className="w-10 h-10 text-blue-600" /> : <ToggleLeft className="w-10 h-10 text-slate-600" />}
                          </button>
                       </div>
                        <div className="pt-4 border-t border-slate-200">
                         <label className="block space-y-2">
                            <div className="flex items-center gap-2">
                               <UsersIcon className="w-4 h-4 text-slate-700" />
                               <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Biaya Registrasi Official (Pusat)</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-700 italic">Rp</span>
                              <input 
                                type="number" 
                                value={localSettings.officialFee || 0} 
                                onChange={e => updateSettings({ officialFee: parseInt(e.target.value) || 0 })} 
                                className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-xl font-black italic text-lg text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm" 
                                placeholder="Biaya Official" 
                              />
                            </div>
                         </label>
                       </div>
                    </div>

                    {/* Kebijakan KTA Peserta */}
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                       <div className="flex items-center justify-between">
                         <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Syarat Nomor KTA</p>
                         <span className={`text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                           localSettings.requireKta 
                             ? 'bg-amber-100 text-amber-800 border-amber-300' 
                             : 'bg-slate-200 text-slate-700 border-slate-300'
                         }`}>
                           {localSettings.requireKta ? 'Wajib KTA' : 'Tidak Wajib'}
                         </span>
                       </div>

                       <p className="text-[9px] text-slate-600 font-bold leading-relaxed">
                         Pilih apakah atlet wajib menyertakan nomor KTA saat mendaftar (Event Resmi) atau bisa mengabaikan kolom nomor KTA (Latber / Open / Bebas). Khusus official/pendamping keluarga atlet otomatis dibebaskan dari kewajiban KTA.
                       </p>

                       <div className="grid grid-cols-1 gap-2.5 pt-1">
                         {/* Tombol: Wajib isi Nomer KTA */}
                         <button
                           type="button"
                           onClick={() => updateSettings({ requireKta: true })}
                           className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                             localSettings.requireKta
                               ? 'bg-arcus-red text-white border-arcus-red shadow-lg shadow-arcus-red/25 ring-2 ring-arcus-red/20'
                               : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                           }`}
                         >
                           <div className="flex items-center justify-between gap-2 mb-1">
                             <div className="flex items-center gap-2">
                               <ShieldCheck className={`w-4 h-4 ${localSettings.requireKta ? 'text-white' : 'text-arcus-red'}`} />
                               <span className="text-[10.5px] font-black uppercase tracking-tight">Wajib isi Nomer KTA</span>
                             </div>
                             {localSettings.requireKta && <Check className="w-4 h-4 text-white shrink-0" />}
                           </div>
                           <p className={`text-[8.5px] leading-tight ${localSettings.requireKta ? 'text-red-100 font-medium' : 'text-slate-500 font-medium'}`}>
                             Event Resmi / Kejuaraan Tertutup. Peserta wajib mengisi nomor KTA pada menu input pendaftaran.
                           </p>
                         </button>

                         {/* Tombol: Tidak wajib isi nomer KTA */}
                         <button
                           type="button"
                           onClick={() => updateSettings({ requireKta: false })}
                           className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                             !localSettings.requireKta
                               ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/25 ring-2 ring-slate-900/20'
                               : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                           }`}
                         >
                           <div className="flex items-center justify-between gap-2 mb-1">
                             <div className="flex items-center gap-2">
                               <Zap className={`w-4 h-4 ${!localSettings.requireKta ? 'text-white' : 'text-slate-600'}`} />
                               <span className="text-[10.5px] font-black uppercase tracking-tight">Tidak wajib isi nomer KTA</span>
                             </div>
                             {!localSettings.requireKta && <Check className="w-4 h-4 text-white shrink-0" />}
                           </div>
                           <p className={`text-[8.5px] leading-tight ${!localSettings.requireKta ? 'text-slate-300 font-medium' : 'text-slate-500 font-medium'}`}>
                             Event Tidak Resmi / Latber / Open. Peserta bisa mengabaikan kolom nomor KTA saat mendaftar.
                           </p>
                         </button>
                       </div>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* Section: Media & Documents */}
          {!isPractice && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-black font-oswald uppercase text-slate-800 italic">Media & Publikasi</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowUploadGuide(!showUploadGuide)}
                  className="flex items-center gap-2 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:underline"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Cara Upload
                </button>
              </div>

              {showUploadGuide && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 space-y-4 animate-in slide-in-from-top-4">
                  <h4 className="font-black text-blue-900 uppercase text-xs">Langkah Mendapatkan Link Gambar:</h4>
                  <ol className="text-xs text-blue-700 space-y-2 list-decimal pl-4 font-medium italic">
                    <li><strong>Google Drive:</strong> Upload file gambar ke Google Drive Anda, klik kanan &gt; Bagikan (Share) &gt; Setel ke "Siapa saja yang memiliki link" (Anyone with link), lalu salin link-nya dan tempelkan langsung di bawah ini.</li>
                    <li><strong>Imgur / Postimages:</strong> Upload foto pamflet dari HP/Komputer Anda ke Imgur.com atau Postimages.org, lalu salin "Direct Link" (link berakhiran .jpg, .jpeg, atau .png) dan tempel di bawah.</li>
                  </ol>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                   <label className="block group">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Link Gambar Pamflet / Poster (URL / Google Drive)</span>
                      <div className="relative mt-2">
                        <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input 
                          type="url" 
                          placeholder="Salin link Google Drive Anda di sini..."
                          value={localSettings.pamphletUrl || ''} 
                          onChange={e => updateSettings({ pamphletUrl: resolveGoogleDriveUrl(e.target.value) })} 
                          className="w-full pl-10 pr-5 py-3 bg-white border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-arcus-red transition-all" 
                        />
                      </div>
                   </label>

                   <label className="block group">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Link Technical Hand Book (THB / PDF URL)</span>
                      <div className="relative mt-2">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input 
                          type="url" 
                          placeholder="https://drive.google.com/your-pdf"
                          value={localSettings.thbUrl || ''} 
                          onChange={e => updateSettings({ thbUrl: e.target.value })} 
                          className="w-full pl-10 pr-5 py-3 bg-white border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-arcus-red transition-all" 
                        />
                      </div>
                   </label>
                </div>

                 <div className="bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center gap-4 min-h-[300px] overflow-hidden relative group">
                   {localSettings?.pamphletUrl ? (
                     <div className="relative w-full h-full flex items-center justify-center">
                        <img 
                          src={resolveGoogleDriveUrl(localSettings.pamphletUrl)} 
                          alt="" 
                          className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110"
                        />
                        <div className="relative z-10 p-6 flex flex-col items-center gap-4">
                           <p className="text-[9px] font-black text-white/90 uppercase tracking-[0.3em]">Live Preview</p>
                           <img 
                            src={resolveGoogleDriveUrl(localSettings.pamphletUrl)} 
                            alt="Preview" 
                            className="max-h-72 object-contain rounded-xl shadow-2xl border-4 border-white/10" 
                           />
                        </div>
                     </div>
                   ) : (
                     <div className="text-center space-y-4 text-slate-700">
                        <div className="p-8 bg-white/5 rounded-full border border-white/5">
                           <ImageIcon className="w-16 h-16 mx-auto opacity-10" />
                        </div>
                        <p className="text-[10px] font-black uppercase italic tracking-[0.2em]">Belum Ada Preview Pamflet</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {/* Section: Category Rules */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isPractice ? 'bg-teal-50' : 'bg-red-50'}`}>
                      <Trophy className={`w-6 h-6 ${isPractice ? 'text-teal-600' : 'text-arcus-red'}`} />
                    </div>
                    <h3 className="text-2xl font-black font-oswald uppercase text-slate-800 italic">Aturan Skor Kategori</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          addCategory(e.target.value as CategoryType);
                          e.target.value = '';
                        }
                      }}
                      className="bg-arcus-red text-white border-2 border-arcus-red rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-red-700 hover:border-red-700 transition-all shadow-lg active:scale-95 appearance-none"
                    >
                      <option value="" className="bg-white text-slate-900 font-black">+ TAMBAH KATEGORI</option>
                      {(Object.keys(CategoryType) as CategoryType[])
                        .filter(cat => !localSettings.categoryConfigs?.[cat])
                        .map(cat => (
                          <option key={cat} value={cat} className="bg-white text-slate-900 font-bold">{CATEGORY_LABELS[cat] || cat}</option>
                        ))
                      }
                    </select>
                    <Plus className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                  </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 bg-white border-y border-slate-100 p-6 md:p-10">
              {Object.keys(localSettings.categoryConfigs || {}).length > 0 ? (
                (Object.keys(localSettings.categoryConfigs || {}) as CategoryType[]).map(cat => (
                  <div key={cat} className="p-6 md:p-8 bg-slate-50 border-l-4 border-arcus-red space-y-6 relative group transition-all hover:bg-white shadow-sm">
                    <button 
                      type="button"
                      onClick={() => removeCategory(cat)}
                      className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
                      <p className="font-bold text-slate-800 text-xl uppercase font-oswald italic">{CATEGORY_LABELS[cat] || cat}</p>
                      {!isPractice && (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-arcus-red opacity-50">Rp</span>
                          <input 
                            type="number" 
                            value={localSettings.categoryConfigs?.[cat]?.registrationFee || 0} 
                            onChange={e => updateCategoryConfig(cat, 'registrationFee', parseInt(e.target.value) || 0)} 
                            className="w-full rounded-lg border-slate-200 p-2.5 pl-8 border font-black text-right shadow-sm focus:border-arcus-red transition-all" 
                          />
                        </div>
                      )}
                    </div>
                    {cat !== CategoryType.OFFICIAL && (
                      <>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Jarak</span>
                          <input 
                            type="text" 
                            value={localSettings.categoryConfigs?.[cat]?.distance || ''} 
                            onChange={e => updateCategoryConfig(cat, 'distance', e.target.value)} 
                            className="w-full rounded-lg border-slate-200 p-3 border font-bold text-sm focus:border-arcus-red transition-all text-slate-900" 
                            placeholder="Jarak" 
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Arrow</span>
                          <input 
                            type="number" 
                            value={localSettings.categoryConfigs?.[cat]?.arrows || 0} 
                            onChange={e => updateCategoryConfig(cat, 'arrows', parseInt(e.target.value) || 0)} 
                            className="w-full rounded-lg border-slate-200 p-3 border font-bold text-sm focus:border-arcus-red transition-all text-slate-900" 
                            placeholder="Arrows" 
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Rambahan</span>
                          <input 
                            type="number" 
                            value={localSettings.categoryConfigs?.[cat]?.ends || 0} 
                            onChange={e => updateCategoryConfig(cat, 'ends', parseInt(e.target.value) || 0)} 
                            className="w-full rounded-lg border-slate-200 p-3 border font-bold text-sm focus:border-arcus-red transition-all text-slate-900" 
                            placeholder="Ends" 
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Face Target</span>
                          <select 
                            value={localSettings.categoryConfigs?.[cat]?.targetType || TargetType.STANDARD} 
                            onChange={e => updateCategoryConfig(cat, 'targetType', e.target.value as TargetType)} 
                            className="w-full rounded-lg border-slate-200 p-3 border font-bold text-sm focus:border-arcus-red transition-all text-slate-900"
                          >
                            {(Object.values(TargetType) as TargetType[]).map(t => (
                              <option key={t} value={t}>{TARGET_LABELS[t] || t}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1 flex items-center justify-between">
                            <span>Kuota</span>
                            <span className="text-[8px] font-normal text-slate-700 lowercase italic">kosong = unlimit</span>
                          </span>
                          <input 
                            type="number" 
                            value={localSettings.categoryConfigs?.[cat]?.quota || ''} 
                            onChange={e => updateCategoryConfig(cat, 'quota', e.target.value ? parseInt(e.target.value) : undefined)} 
                            className="w-full rounded-lg border-slate-200 p-3 border font-bold text-sm focus:border-arcus-red transition-all text-slate-900" 
                            placeholder="Unlimited" 
                          />
                        </label>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                           <div className="flex items-center gap-2">
                              <Swords className="w-5 h-5 text-arcus-red" />
                              <p className="text-xs font-black uppercase text-slate-900 tracking-widest font-oswald italic">Alur Pertandingan &amp; Regulasi Aduan</p>
                           </div>
                           <span className="text-[9px] font-black text-white bg-slate-900 px-2.5 py-1 rounded-md uppercase tracking-wider">
                              Eliminasi &amp; Aduan
                           </span>
                        </div>

                        {/* PILIHAN 2 MODE ALUR PERTANDINGAN */}
                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-arcus-red" />
                            Pilih Mode Alur Pertandingan &amp; Ketentuan Shoot-Off:
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Mode 1: Perangkingan Poin */}
                            <div 
                              onClick={() => updateCategoryConfig(cat, 'tournamentFlowMode', 'RANKING_POINTS_STAGE')}
                              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 relative ${
                                (localSettings.categoryConfigs?.[cat]?.tournamentFlowMode || 'RANKING_POINTS_STAGE') === 'RANKING_POINTS_STAGE'
                                  ? 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-100'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                    Mode 1: Poin &amp; Aduan
                                  </span>
                                  {(localSettings.categoryConfigs?.[cat]?.tournamentFlowMode || 'RANKING_POINTS_STAGE') === 'RANKING_POINTS_STAGE' && (
                                    <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center text-white">
                                      <Check className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                <h4 className="text-sm font-black font-oswald uppercase italic text-slate-900 leading-tight">
                                  Mode Perangkingan Poin
                                </h4>
                                <p className="text-[10px] font-bold text-purple-900">
                                  Shoot-Off Mulai Pada Babak Aduan
                                </p>
                                <p className="text-[9px] text-slate-700 font-medium leading-relaxed">
                                  Di babak <b>Kualifikasi &amp; Penyaringan Skor (Top 32/16/8)</b>, nilai seri diselesaikan murni lewat <b>perangkingan poin (Countback jumlah angka 6 &amp; 5, total skor)</b> tanpa shoot-off lapangan. <b>Shoot-Off 1 panah</b> baru aktif saat masuk <b>Babak Aduan 1 vs 1 (H2H)</b>.
                                </p>
                              </div>
                            </div>

                            {/* Mode 2: Shoot-Off Langsung */}
                            <div 
                              onClick={() => updateCategoryConfig(cat, 'tournamentFlowMode', 'DIRECT_SHOOT_OFF')}
                              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 relative ${
                                localSettings.categoryConfigs?.[cat]?.tournamentFlowMode === 'DIRECT_SHOOT_OFF'
                                  ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-100'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                    Mode 2: Shoot-Off Penuh
                                  </span>
                                  {localSettings.categoryConfigs?.[cat]?.tournamentFlowMode === 'DIRECT_SHOOT_OFF' && (
                                    <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white">
                                      <Check className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                <h4 className="text-sm font-black font-oswald uppercase italic text-slate-900 leading-tight">
                                  Mode Shoot-Off Langsung
                                </h4>
                                <p className="text-[10px] font-bold text-amber-900">
                                  Shoot-Off Berlaku Sejak Babak Eliminasi
                                </p>
                                <p className="text-[9px] text-slate-700 font-medium leading-relaxed">
                                  Setelah babak kualifikasi, setiap kali ada skor imbang antar atlet di babak eliminasi/sistem gugur, <b>wajib langsung dilakukan 1 Panah Shoot-Off</b> (skor tertinggi / panah terdekat ke titik X) untuk menentukan pemenang yang lolos.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <label className="block space-y-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Aduan (H2H) Dimulai Dari:</span>
                            <select 
                              value={localSettings.categoryConfigs?.[cat]?.h2hStartSize || 0} 
                              onChange={e => updateCategoryConfig(cat, 'h2hStartSize', parseInt(e.target.value))} 
                              className="w-full rounded-xl border-slate-200 p-3 border font-black text-xs focus:border-arcus-red transition-all text-slate-900"
                            >
                              <option value="0">TIDAK ADA ADUAN (HANYA KUALIFIKASI)</option>
                              <option value="64">64 BESAR (ADUAN / BRACKET)</option>
                              <option value="32">32 BESAR (ADUAN / BRACKET)</option>
                              <option value="16">16 BESAR (ADUAN / BRACKET)</option>
                              <option value="8">8 BESAR (ADUAN / PEREMPAT FINAL)</option>
                              <option value="4">FINAL 4 (ADUAN / SEMI FINAL)</option>
                            </select>
                            <p className="text-[9px] font-bold text-slate-700 italic">Pilih kapan babak Head-to-Head (bracket bagan) dimulai.</p>
                          </label>

                          <div className="space-y-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Babak Penyaringan Skor (Eliminasi):</span>
                            <div className="flex flex-wrap gap-2">
                              {[64, 32, 16, 8, 4].map(size => {
                                const stages = localSettings.categoryConfigs?.[cat]?.eliminationStages || [];
                                const isSelected = stages.includes(size);
                                const h2hStart = localSettings.categoryConfigs?.[cat]?.h2hStartSize || 0;
                                
                                // DISABLE jika stage >= h2h start (karena sudah masuk aduan)
                                const isDisabled = h2hStart > 0 && size <= h2hStart;

                                return (
                                  <button
                                    key={size}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => {
                                      const currentStages = [...stages];
                                      if (isSelected) {
                                        updateCategoryConfig(cat, 'eliminationStages', currentStages.filter(s => s !== size));
                                      } else {
                                        updateCategoryConfig(cat, 'eliminationStages', [...currentStages, size].sort((a, b) => b - a));
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black border transition-all ${
                                      isSelected 
                                        ? 'bg-slate-900 border-slate-900 text-white' 
                                        : isDisabled 
                                          ? 'bg-slate-50 border-slate-100 text-slate-200 cursor-not-allowed'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                    }`}
                                  >
                                    TOP {size}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[9px] font-bold text-slate-700 italic">Pilih tahapan penyaringan skor kualifikasi bertahap sebelum masuk aduan.</p>
                          </div>
                        </div>

                        {/* Pengaturan Aduan & Shoot-Off */}
                        {(localSettings.categoryConfigs?.[cat]?.h2hStartSize || 0) > 0 && (
                          <div className="p-5 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-5">
                            <div className="flex items-center gap-2">
                              <Crosshair className="w-4 h-4 text-purple-700" />
                              <h5 className="text-[11px] font-black uppercase text-purple-950 tracking-wider">
                                Regulasi Penentuan Seri (Shoot-Off / Countback) &amp; Poin Aduan
                              </h5>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Tie-Break / Shoot-Off Method Selector */}
                              <label className="block space-y-1.5">
                                <span className="text-[10px] font-black text-purple-950 uppercase tracking-widest flex items-center gap-1.5">
                                  <Scale className="w-3.5 h-3.5 text-purple-700" />
                                  Metode Penentu Seri (Tie-Break Rule):
                                </span>
                                <select 
                                  value={localSettings.categoryConfigs?.[cat]?.tieBreakMethod || 'BOTH'} 
                                  onChange={e => updateCategoryConfig(cat, 'tieBreakMethod', e.target.value)} 
                                  className="w-full rounded-xl border-purple-200 bg-white p-3 border font-black text-xs text-slate-900 focus:border-purple-600 transition-all shadow-sm"
                                >
                                  <option value="BOTH">FLEKSIBEL / KEDUANYA (PILIH SAAT SERI DI LAPANGAN)</option>
                                  <option value="SHOOT_OFF">SHOOT-OFF (1 PANAH PENENTU / CLOSEST TO CENTER)</option>
                                  <option value="COUNTBACK">COUNTBACK (JUMLAH ANGKA 6 &amp; 5 / X &amp; 10)</option>
                                </select>
                                <p className="text-[9px] font-semibold text-purple-900 italic">
                                  {localSettings.categoryConfigs?.[cat]?.tieBreakMethod === 'SHOOT_OFF' && 'Jika seri, atlet menembak 1 panah penentu. Skor tertinggi / terdekat ke X menang.'}
                                  {localSettings.categoryConfigs?.[cat]?.tieBreakMethod === 'COUNTBACK' && 'Jika seri, pemenang ditentukan dari perolehan angka 6/X terbanyak, lalu 5/10, lalu skor kualifikasi.'}
                                  {(localSettings.categoryConfigs?.[cat]?.tieBreakMethod === 'BOTH' || !localSettings.categoryConfigs?.[cat]?.tieBreakMethod) && 'Juri/Scorer dapat memilih tombol Shoot-Off atau Countback 6/5 secara fleksibel saat skor seri.'}
                                </p>
                              </label>

                              {/* Jumlah Panah Shoot-Off */}
                              <label className="block space-y-1.5">
                                <span className="text-[10px] font-black text-purple-950 uppercase tracking-widest flex items-center gap-1.5">
                                  <Crosshair className="w-3.5 h-3.5 text-purple-700" />
                                  Format Shoot-Off:
                                </span>
                                <select 
                                  value={localSettings.categoryConfigs?.[cat]?.shootOffArrows || 1} 
                                  onChange={e => updateCategoryConfig(cat, 'shootOffArrows', parseInt(e.target.value))} 
                                  className="w-full rounded-xl border-purple-200 bg-white p-3 border font-black text-xs text-slate-900 focus:border-purple-600 transition-all shadow-sm"
                                >
                                  <option value="1">1 ANAK PANAH PENENTU (STANDAR GOLDEN ARROW)</option>
                                  <option value="3">3 ANAK PANAH (1 RAMBAHAN TAMBAHAN PENUH)</option>
                                </select>
                                <p className="text-[9px] font-semibold text-purple-900 italic">
                                  Standar World Archery menggunakan 1 anak panah penentu per atlet.
                                </p>
                              </label>

                              {/* Sistem Poin Aduan */}
                              <label className="block space-y-1.5">
                                <span className="text-[10px] font-black text-purple-950 uppercase tracking-widest flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5 text-purple-700" />
                                  Sistem Penilaian Aduan:
                                </span>
                                <select 
                                  value={localSettings.categoryConfigs?.[cat]?.scoringSystem || 'SET_SYSTEM'} 
                                  onChange={e => updateCategoryConfig(cat, 'scoringSystem', e.target.value)} 
                                  className="w-full rounded-xl border-purple-200 bg-white p-3 border font-black text-xs text-slate-900 focus:border-purple-600 transition-all shadow-sm"
                                >
                                  <option value="SET_SYSTEM">SET SYSTEM (MENANG 2, SERI 1, KALAH 0 - TARGET 6 POIN)</option>
                                  <option value="TOTAL_SCORE">TOTAL CUMULATIVE SCORE (AKUMULASI SELURUH RAMBAHAN)</option>
                                </select>
                                <p className="text-[9px] font-semibold text-purple-900 italic">
                                  Recurve/Standar bow memakai Set System; Compound umum memakai Total Score.
                                </p>
                              </label>

                              {/* Jumlah Rambahan Aduan (Ends) */}
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block space-y-1.5">
                                  <span className="text-[10px] font-black text-purple-950 uppercase tracking-widest">
                                    Rambahan Aduan:
                                  </span>
                                  <input 
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={localSettings.categoryConfigs?.[cat]?.matchEnds || 5}
                                    onChange={e => updateCategoryConfig(cat, 'matchEnds', parseInt(e.target.value) || 5)}
                                    className="w-full rounded-xl border-purple-200 bg-white p-3 border font-black text-xs text-slate-900 focus:border-purple-600 transition-all text-center shadow-sm"
                                    placeholder="5 Rambahan"
                                  />
                                </label>
                                <label className="block space-y-1.5">
                                  <span className="text-[10px] font-black text-purple-950 uppercase tracking-widest">
                                    Panah / Rambahan:
                                  </span>
                                  <input 
                                    type="number"
                                    min="1"
                                    max="6"
                                    value={localSettings.categoryConfigs?.[cat]?.matchArrowsPerEnd || 3}
                                    onChange={e => updateCategoryConfig(cat, 'matchArrowsPerEnd', parseInt(e.target.value) || 3)}
                                    className="w-full rounded-xl border-purple-200 bg-white p-3 border font-black text-xs text-slate-900 focus:border-purple-600 transition-all text-center shadow-sm"
                                    placeholder="3 Panah"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                          <div className="p-1 bg-emerald-500 rounded-full mt-0.5 shrink-0">
                             <Check className="w-3 h-3 text-white" />
                          </div>
                          <div className="space-y-1.5">
                             <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Alur &amp; Regulasi Pertandingan Kategori Ini:</p>
                             <ol className="text-[9px] font-bold text-emerald-800 space-y-1 list-decimal pl-4 italic">
                                <li>Babak Kualifikasi ({localSettings.categoryConfigs?.[cat]?.ends || 6} Rambahan x {localSettings.categoryConfigs?.[cat]?.arrows || 6} Panah @ {localSettings.categoryConfigs?.[cat]?.distance || '20m'})</li>
                                <li>
                                  {localSettings.categoryConfigs?.[cat]?.tournamentFlowMode === 'DIRECT_SHOOT_OFF' ? (
                                    <span className="text-amber-800 font-black">Mode Shoot-Off Langsung: Seri di babak gugur/eliminasi langsung Shoot-Off 1 Panah</span>
                                  ) : (
                                    <span className="text-purple-800 font-black">Mode Perangkingan Poin: Seri di kualifikasi/penyaringan diselesaikan dengan Countback Poin</span>
                                  )}
                                </li>
                                {localSettings.categoryConfigs?.[cat]?.eliminationStages?.map(stage => (
                                  <li key={stage}>Penyaringan Skor Top {stage} Besar (Peringkat Poin)</li>
                                ))}
                                {localSettings.categoryConfigs?.[cat]?.h2hStartSize ? (
                                  <>
                                    <li>Bagan Aduan (Head-to-Head) {localSettings.categoryConfigs?.[cat]?.h2hStartSize} Besar ({localSettings.categoryConfigs?.[cat]?.scoringSystem === 'TOTAL_SCORE' ? 'Akumulasi Total Skor' : 'Set System Target 6 Poin'}, {localSettings.categoryConfigs?.[cat]?.matchEnds || 5} Ends)</li>
                                    <li className="text-purple-900 font-black">
                                      Penentu Seri di Babak Aduan: {
                                        localSettings.categoryConfigs?.[cat]?.tieBreakMethod === 'SHOOT_OFF' 
                                          ? `Shoot-Off (${localSettings.categoryConfigs?.[cat]?.shootOffArrows || 1} Panah Penentu / Terdekat ke Titik Pusat Target)` 
                                          : localSettings.categoryConfigs?.[cat]?.tieBreakMethod === 'COUNTBACK' 
                                            ? 'Countback (Perhitungan Jumlah Angka 6/X terbanyak, lalu 5/10)' 
                                            : `Fleksibel (Shoot-Off ${localSettings.categoryConfigs?.[cat]?.shootOffArrows || 1} Panah atau Countback 6/5 di Lapangan)`
                                      }
                                    </li>
                                  </>
                                ) : (
                                  <li>Penentuan Juara Langsung dari Akumulasi Skor Kualifikasi Akhir</li>
                                )}
                             </ol>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {cat === CategoryType.OFFICIAL && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                        <Info className="w-4 h-4 text-blue-500" />
                        <p className="text-[10px] font-bold text-blue-700 uppercase italic">Hanya biaya pendaftaran.</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full p-12 text-center bg-slate-50 border border-dashed border-slate-200">
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Belum Ada Kategori.</p>
                </div>
              )}
            </div>
          </div>

            </div>
          )}

          {activeTab === 'PAYMENT' && !isPractice && (
            <div className="space-y-12 animate-in fade-in duration-500">
              {/* Card Shortcut to Finance & Proof Verification */}
              {onManageFinance && (
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl border border-emerald-500/20">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Receipt className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg sm:text-xl font-black font-oswald uppercase italic tracking-wide">
                          Verifikasi Bukti Transfer & Rekap Kas
                        </h4>
                        <span className="bg-emerald-500 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-slate-950">
                          LIVE
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-1 max-w-xl">
                        Lihat foto struk transfer yang diunggah pendaftar saat registrasi online, konfirmasi pendaftaran peserta, dan cetak invoice / rekap kas.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onManageFinance}
                    className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 active:scale-95 flex items-center justify-center gap-2 shrink-0 font-bold"
                  >
                    <Receipt className="w-4 h-4" /> Buka Panel Bukti Transfer
                  </button>
                </div>
              )}

              {/* Section: Manual Payment Target */}
              <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-2xl">
                      <Landmark className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-black font-oswald uppercase text-slate-800 italic">Metode Pembayaran Transfer</h3>
                </div>
                <button type="button" onClick={addPaymentMethod} className="bg-arcus-dark text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Tambah Rekening
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {(localSettings.paymentMethods || []).map((pm) => (
                  <div key={pm.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 relative group transition-all shadow-sm">
                    <button type="button" onClick={() => removePaymentMethod(pm.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Nama Bank / Provider</span>
                        <input type="text" placeholder="Contoh: BCA, Mandiri, Dana" value={pm.provider} onChange={e => updatePaymentMethod(pm.id, 'provider', e.target.value)} className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-bold" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Nomor Rekening</span>
                        <input type="text" placeholder="Masukkan nomor rekening..." value={pm.accountNumber} onChange={e => updatePaymentMethod(pm.id, 'accountNumber', e.target.value)} className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-black tracking-widest" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Nama Pemilik Akun</span>
                        <input type="text" placeholder="Nama lengkap pemilik rekening..." value={pm.accountName} onChange={e => updatePaymentMethod(pm.id, 'accountName', e.target.value)} className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-bold" />
                      </div>
                    </div>
                  </div>
                ))}
                {(localSettings.paymentMethods || []).length === 0 && (
                  <div className="col-span-full py-16 text-center space-y-6 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
                      <Landmark className="w-10 h-10 text-slate-200" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Belum Ada Rekening Transfer</p>
                       <p className="text-[10px] text-slate-700 font-medium italic max-w-sm mx-auto">
                         Jika tidak ada rekening yang ditambahkan, sistem akan menggunakan setelan default pusat (jika tersedia).
                       </p>
                    </div>
                    <button type="button" onClick={addPaymentMethod} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest mx-auto">
                      Atur Rekening Sekarang
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {activeTab === 'SCORERS' && (
            <div className="space-y-16 animate-in fade-in duration-500">
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-50 rounded-2xl">
                        <UsersIcon className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black font-oswald uppercase text-slate-800 italic">Tim Lapangan (Scorer)</h3>
                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mt-0.5">Atur kode akses & batasan bantalan per petugas agar tidak tabrakan input</p>
                      </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {localScorers.length > 0 && (
                      <button 
                        type="button" 
                        onClick={autoDistributeTargets} 
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                        title="Bagi rata total bantalan ke seluruh scorer yang ada"
                      >
                        <Zap className="w-3.5 h-3.5 text-purple-600" /> Otomatis Bagi Rata Bantalan
                      </button>
                    )}
                    <button type="button" onClick={addScorer} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md shadow-purple-600/20 hover:bg-purple-700 transition-all">
                      <Plus className="w-3.5 h-3.5" /> Tambah Scorer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {localScorers.map((scorer, scorerIdx) => {
                    const totalTargets = localSettings.totalTargets || 1;
                    const mode = scorer.assignmentMode || (scorer.assignedTargets && scorer.assignedTargets.length > 0 ? 'RANGE' : 'ALL');
                    const assigned = scorer.assignedTargets || [];

                    return (
                      <div key={scorer.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 relative group transition-all shadow-sm space-y-6">
                        <button type="button" onClick={() => removeScorer(scorer.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                        
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Nama Petugas</span>
                          <input 
                            type="text" 
                            value={scorer.name} 
                            onChange={e => updateScorer(scorer.id, 'name', e.target.value)} 
                            className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-bold" 
                            placeholder="Contoh: Scorer Lapangan 1"
                          />
                        </div>

                        <div className="flex items-center justify-between bg-slate-900 p-6 rounded-2xl">
                          <div>
                            <span className="text-[9px] font-black text-white/90 uppercase tracking-widest block">Kode Akses</span>
                            <span className="text-2xl font-black font-mono tracking-[0.3em] text-arcus-red">{scorer.accessCode}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => updateScorer(scorer.id, 'accessCode', Math.floor(1000 + Math.random() * 9000).toString())}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                            title="Acak Kode Akses"
                          >
                            <Repeat className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Target Assignment Section */}
                        <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                              <TargetIcon className="w-3.5 h-3.5 text-purple-600" /> Alokasi Bantalan Target
                            </span>
                            <span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">Total: {totalTargets} Bantalan</span>
                          </div>

                          {/* Mode Tabs */}
                          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                updateScorer(scorer.id, 'assignmentMode', 'ALL');
                                updateScorer(scorer.id, 'assignedTargets', []);
                              }}
                              className={`py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${mode === 'ALL' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-800 hover:text-slate-800'}`}
                            >
                              Semua
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const start = scorer.targetRangeStart || 1;
                                const end = scorer.targetRangeEnd || Math.min(2, totalTargets);
                                const targets = [];
                                for (let t = start; t <= end; t++) targets.push(t);
                                setLocalScorers(localScorers.map(s => s.id === scorer.id ? {
                                  ...s,
                                  assignmentMode: 'RANGE',
                                  targetRangeStart: start,
                                  targetRangeEnd: end,
                                  assignedTargets: targets
                                } : s));
                                setIsDirty(true);
                              }}
                              className={`py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${mode === 'RANGE' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-800 hover:text-slate-800'}`}
                            >
                              Rentang
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateScorer(scorer.id, 'assignmentMode', 'CUSTOM');
                              }}
                              className={`py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${mode === 'CUSTOM' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-800 hover:text-slate-800'}`}
                            >
                              Pilih Manual
                            </button>
                          </div>

                          {/* Mode Content */}
                          {mode === 'ALL' && (
                            <div className="p-3 bg-white rounded-xl border border-slate-100 text-slate-600 text-[10px] font-bold">
                              Petugas dapat mengakses <span className="text-purple-700 font-black">Semua Bantalan (1 - {totalTargets})</span> tanpa pembatasan.
                            </div>
                          )}

                          {mode === 'RANGE' && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block mb-1">Dari Bantalan</span>
                                  <input 
                                    type="number" 
                                    min={1} 
                                    max={totalTargets}
                                    value={scorer.targetRangeStart || 1}
                                    onChange={e => {
                                      const start = Math.max(1, Math.min(totalTargets, parseInt(e.target.value) || 1));
                                      const end = Math.max(start, scorer.targetRangeEnd || start);
                                      const targets = [];
                                      for (let t = start; t <= end; t++) targets.push(t);
                                      setLocalScorers(localScorers.map(s => s.id === scorer.id ? {
                                        ...s,
                                        targetRangeStart: start,
                                        targetRangeEnd: end,
                                        assignedTargets: targets
                                      } : s));
                                      setIsDirty(true);
                                    }}
                                    className="w-full bg-white rounded-xl border border-slate-200 p-2.5 text-center font-black text-sm"
                                  />
                                </div>
                                <div>
                                  <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block mb-1">Sampai Bantalan</span>
                                  <input 
                                    type="number" 
                                    min={scorer.targetRangeStart || 1} 
                                    max={totalTargets}
                                    value={scorer.targetRangeEnd || Math.min(2, totalTargets)}
                                    onChange={e => {
                                      const start = scorer.targetRangeStart || 1;
                                      const end = Math.max(start, Math.min(totalTargets, parseInt(e.target.value) || start));
                                      const targets = [];
                                      for (let t = start; t <= end; t++) targets.push(t);
                                      setLocalScorers(localScorers.map(s => s.id === scorer.id ? {
                                        ...s,
                                        targetRangeStart: start,
                                        targetRangeEnd: end,
                                        assignedTargets: targets
                                      } : s));
                                      setIsDirty(true);
                                    }}
                                    className="w-full bg-white rounded-xl border border-slate-200 p-2.5 text-center font-black text-sm"
                                  />
                                </div>
                              </div>
                              <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between text-[9px] font-black text-purple-700 uppercase">
                                <span>Akses: Bantalan {(scorer.assignedTargets || []).join(', ') || '-'}</span>
                                <span className="bg-purple-200 text-purple-900 px-2 py-0.5 rounded">{(scorer.assignedTargets || []).length} Bantalan</span>
                              </div>
                            </div>
                          )}

                          {mode === 'CUSTOM' && (
                            <div className="space-y-2">
                              <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block">Klik untuk memilih bantalan:</span>
                              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar p-1">
                                {Array.from({ length: totalTargets }, (_, i) => i + 1).map(targetNum => {
                                  const isSelected = (scorer.assignedTargets || []).includes(targetNum);
                                  return (
                                    <button
                                      key={targetNum}
                                      type="button"
                                      onClick={() => {
                                        const current = scorer.assignedTargets || [];
                                        const next = isSelected 
                                          ? current.filter(t => t !== targetNum) 
                                          : [...current, targetNum].sort((a, b) => a - b);
                                        updateScorer(scorer.id, 'assignedTargets', next);
                                      }}
                                      className={`w-9 h-9 rounded-xl font-black text-xs transition-all border ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                    >
                                      {targetNum}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between text-[9px] font-black text-purple-700 uppercase">
                                <span>Akses: {(scorer.assignedTargets || []).length > 0 ? `Bantalan ${(scorer.assignedTargets || []).join(', ')}` : 'Belum dipilih'}</span>
                                <span className="bg-purple-200 text-purple-900 px-2 py-0.5 rounded">{(scorer.assignedTargets || []).length} Bantalan</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                           <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest block px-1">Izin Akses</span>
                           <div className="flex flex-wrap gap-2">
                              {['INPUT_SCORE', 'EDIT_ARCHER', 'MANAGE_MATCHES'].map(perm => (
                                <button
                                  key={perm}
                                  type="button"
                                  onClick={() => {
                                    const current = scorer.permissions || [];
                                    const next = current.includes(perm as any) 
                                      ? current.filter(p => p !== perm)
                                      : [...current, perm as any];
                                    updateScorer(scorer.id, 'permissions', next);
                                  }}
                                  className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${(scorer.permissions || []).includes(perm as any) ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                                >
                                  {perm.replace('_', ' ')}
                                </button>
                              ))}
                           </div>
                        </div>
                      </div>
                    );
                  })}
                  {localScorers.length === 0 && (
                    <div className="md:col-span-2 py-20 text-center space-y-4 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                      <UsersIcon className="w-12 h-12 mx-auto text-slate-600" />
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Belum ada tim lapangan yang ditambahkan</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SPONSORSHIP' && !isPractice && (
            <div className="space-y-16 animate-in fade-in duration-500">
               <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-50 rounded-2xl">
                        <Heart className="w-6 h-6 text-arcus-red" />
                      </div>
                      <h3 className="text-2xl font-black font-oswald uppercase text-slate-800 italic">Sponsorship & Liputan</h3>
                  </div>
                  <button type="button" onClick={addSponsorship} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Tambah Sponsor
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {(localSettings.sponsorships || []).map((sponsor) => (
                    <div key={sponsor.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 relative group transition-all shadow-sm space-y-6">
                      <button type="button" onClick={() => removeSponsorship(sponsor.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Tipe / Judul Sponsor</span>
                          <input 
                            type="text" 
                            value={sponsor.title} 
                            onChange={e => updateSponsorship(sponsor.id, 'title', e.target.value)} 
                            className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-black italic uppercase" 
                            placeholder="Contoh: OFFICIAL PARTNER"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Nama Sponsor</span>
                          <input 
                            type="text" 
                            value={sponsor.name} 
                            onChange={e => updateSponsorship(sponsor.id, 'name', e.target.value)} 
                            className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-bold" 
                            placeholder="Contoh: PT. Maju Jaya"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1 flex items-center gap-2">
                           <Youtube className="w-3.5 h-3.5 text-red-600" /> Link Video Sponsor (Youtube URL)
                        </span>
                        <input 
                          type="url" 
                          value={sponsor.videoUrl || ''} 
                          onChange={e => updateSponsorship(sponsor.id, 'videoUrl', e.target.value)} 
                          className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-bold" 
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                        <p className="text-[8px] font-bold text-slate-700 uppercase tracking-widest mt-2 italic">* Video ini akan ditampilkan pada mode TV/LCD.</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1 flex items-center gap-2">
                           <ImageIcon className="w-3.5 h-3.5 text-blue-600" /> Link Logo Sponsor (URL / Google Drive)
                        </span>
                        <input 
                          type="url" 
                          value={sponsor.logoUrl || ''} 
                          onChange={e => updateSponsorship(sponsor.id, 'logoUrl', resolveGoogleDriveUrl(e.target.value))} 
                          className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 border text-sm font-bold" 
                          placeholder="Salin link logo Google Drive atau Image URL..."
                        />
                      </div>
                    </div>
                  ))}
                  {(localSettings.sponsorships || []).length === 0 && (
                    <div className="md:col-span-2 py-20 text-center space-y-4 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                      <Heart className="w-12 h-12 mx-auto text-slate-600 opacity-30" />
                      <div>
                        <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Belum ada sponsor yang ditambahkan</p>
                        <p className="text-[9px] font-bold text-slate-700 uppercase mt-2 italic">Tambahkan sponsor untuk ditampilkan di slideshow livescore & mode TV.</p>
                      </div>
                      <button type="button" onClick={addSponsorship} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest mt-4">
                        Tambah Sponsor Pertama
                      </button>
                    </div>
                  )}
                </div>
               </div>
            </div>
          )}

          {activeTab === 'RUNDOWN' && (
            <div className="space-y-16 animate-in fade-in duration-500">
               <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-50 rounded-2xl">
                        <Clock className="w-6 h-6 text-arcus-red" />
                      </div>
                      <h3 className="text-2xl font-black font-oswald uppercase text-slate-800 italic">Rundown Kegiatan & Jadwal Lomba</h3>
                  </div>
                  <button type="button" onClick={addRundownItem} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Tambah Rundown
                  </button>
                </div>

                <div className="space-y-6">
                  {(localSettings.rundown || []).map((item) => (
                    <div key={item.id} className="bg-white p-6 md:p-8 rounded-[2rem] border-2 border-slate-100 relative group transition-all shadow-sm space-y-6">
                      <button type="button" onClick={() => removeRundownItem(item.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                      </button>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Kegiatan / Aktivitas</span>
                          <input 
                            type="text" 
                            value={item.activity} 
                            onChange={e => updateRundownItem(item.id, { activity: e.target.value })} 
                            className="w-full rounded-xl border-slate-100 bg-slate-50 p-3.5 border text-sm font-bold text-slate-900" 
                            placeholder="Contoh: Kualifikasi Sesi 1 / Istirahat..."
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Kategori / Sesi</span>
                          <select 
                            value={item.category} 
                            onChange={e => updateRundownItem(item.id, { category: e.target.value })} 
                            className="w-full rounded-xl border-slate-100 bg-slate-50 p-3.5 border text-sm font-bold text-slate-900"
                          >
                            <option value="ALL">Semua Kategori / Event</option>
                            {Object.keys(localSettings.categoryConfigs || {}).map((cat) => (
                              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
                            ))}
                            <option value="REST">Istirahat / Sholat / Makan</option>
                            <option value="OPENING">Pembukaan / Sambutan</option>
                            <option value="AWARDS">Penyerahan Medali</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:col-span-1">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Mulai</span>
                            <input 
                              type="time" 
                              value={item.startTime} 
                              onChange={e => updateRundownItem(item.id, { startTime: e.target.value })} 
                              className="w-full rounded-xl border-slate-100 bg-slate-50 p-3.5 border text-sm font-bold text-slate-900" 
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Selesai</span>
                            <input 
                              type="time" 
                              value={item.endTime} 
                              onChange={e => updateRundownItem(item.id, { endTime: e.target.value })} 
                              className="w-full rounded-xl border-slate-100 bg-slate-50 p-3.5 border text-sm font-bold text-slate-900" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1 flex items-center justify-between">
                            <span>Hari / Tanggal</span>
                            <span className="text-[7px] text-slate-700 lowercase">Opsional</span>
                          </span>
                          <input 
                            type="text" 
                            placeholder={localSettings.eventDate || "DD-MM-YYYY"}
                            value={item.date || ''} 
                            onChange={e => updateRundownItem(item.id, { date: e.target.value })} 
                            className="w-full rounded-xl border-slate-100 bg-slate-50 p-3.5 border text-sm font-bold text-slate-900" 
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">Keterangan Tambahan / Catatan</span>
                        <input 
                          type="text" 
                          value={item.notes || ''} 
                          onChange={e => updateRundownItem(item.id, { notes: e.target.value })} 
                          className="w-full rounded-xl border-slate-100 bg-slate-50 p-3.5 border text-sm font-semibold text-slate-900" 
                          placeholder="Tambahkan info / catatan untuk peserta..."
                        />
                      </div>
                    </div>
                  ))}
                  {(localSettings.rundown || []).length === 0 && (
                    <div className="py-20 text-center space-y-4 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                      <Clock className="w-12 h-12 mx-auto text-slate-600 opacity-30" />
                      <div>
                        <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Belum ada rundown yang dibuat</p>
                        <p className="text-[9px] font-bold text-slate-700 uppercase mt-2 italic">Buat jadwal rundown agar peserta mengetahui jam tanding untuk tiap kategori lomba.</p>
                      </div>
                      <button type="button" onClick={addRundownItem} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest mt-4">
                        Buat Rundown Pertama
                      </button>
                    </div>
                  )}
                </div>
               </div>
            </div>
          )}

          {/* DANGER ZONE: DELETE EVENT */}
          {isSuperAdmin && (
            <div className="bg-red-50 rounded-[3rem] p-12 border-2 border-dashed border-red-200 space-y-8">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg">
                     <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-2xl font-black font-oswald uppercase italic text-red-900 leading-none">Danger Zone</h3>
                     <p className="text-xs font-bold text-red-700 uppercase tracking-widest mt-2">Gunakan dengan sangat hati-hati!</p>
                  </div>
               </div>
               
               <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <p className="text-sm font-medium text-red-800 leading-relaxed max-w-2xl italic">
                     Jika turnamen ini tidak jadi dilaksanakan atau terdapat kesalahan fatal, Anda dapat menghapusnya. <strong>Tindakan ini permanen</strong> dan akan menghapus seluruh database peserta serta skor yang sudah terekam.
                  </p>
                  <button 
                    type="button" 
                    onClick={handleDeleteClick}
                    className="bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-95 transition-all whitespace-nowrap"
                  >
                     Hapus {isPractice ? 'Latihan' : 'Turnamen'}
                  </button>
               </div>
            </div>
          )}

          <div className="pt-10 sticky bottom-8 z-40 px-12 pb-12 bg-gradient-to-t from-white via-white/95 to-transparent -mx-12">
            <button type="submit" className={`w-full text-white font-black py-5 rounded-[2rem] shadow-xl transition-all flex items-center justify-center gap-4 text-xl font-oswald uppercase tracking-[0.2em] italic ${isPractice ? 'bg-teal-700' : 'bg-arcus-red shadow-arcus-red/30'}`}>
              <Save className="w-6 h-6" /> {isPractice ? 'Simpan Latihan' : 'Simpan Konfigurasi'}
            </button>
          </div>
        </form>
        )}
      </div>

      {showDraftConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center space-y-8 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 border-2 border-amber-100 flex items-center justify-center mx-auto shadow-xl">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black font-oswald uppercase italic tracking-tight text-slate-900">Pengaturan Belum Lengkap</h3>
              <p className="text-slate-800 font-medium leading-relaxed">
                Beberapa informasi penting belum diisi. Tetap simpan sebagai draft?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowDraftConfirm(false)} className="py-4 bg-slate-100 text-slate-800 rounded-2xl font-black uppercase text-[10px]">Lengkapi</button>
              <button onClick={executeFinalSave} className="py-4 bg-arcus-dark text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">Ya, Simpan Draft</button>
            </div>
          </div>
        </div>
      )}

      {showModeConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
              <Repeat className="w-8 h-8 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Ubah Mode?</h3>
              <p className="text-slate-800 text-sm">{showModeConfirm.msg}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowModeConfirm({ ...showModeConfirm, isOpen: false })} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">Batal</button>
              <button 
                onClick={() => {
                  updateSettings({ isPractice: showModeConfirm.next });
                  setShowModeConfirm({ ...showModeConfirm, isOpen: false });
                }} 
                className="py-3 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Ya, Ubah
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnsavedConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Belum Disimpan</h3>
              <p className="text-slate-800 text-sm">
                Perubahan yang Anda buat belum disimpan. Tetap kembali ke dashboard?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowUnsavedConfirm(false)} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">Batal</button>
              <button onClick={onBack} className="py-3 bg-red-600 text-white rounded-xl font-bold text-xs shadow-md">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${isPractice ? 'bg-teal-50' : 'bg-amber-50'}`}>
              {isPractice ? <Zap className="w-8 h-8 text-teal-500" /> : <AlertTriangle className="w-8 h-8 text-amber-500" />}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Simpan Perubahan?</h3>
              <p className="text-slate-800 text-sm">Data konfigurasi akan segera diterapkan.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">Batal</button>
              <button onClick={handleFinalSave} className={`py-3 text-white rounded-xl font-bold text-xs shadow-md ${isPractice ? 'bg-teal-700' : 'bg-slate-900'}`}>Ya, Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Hapus {isPractice ? 'Latihan' : 'Turnamen'}?</h3>
              <p className="text-slate-800 text-sm">
                Tindakan ini permanen. Semua data peserta, skor, dan pengaturan akan dihapus selamanya.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">Batal</button>
              <button onClick={executeDelete} className="py-3 bg-red-600 text-white rounded-xl font-bold text-xs shadow-md">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {showTimerModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-950 w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-800 flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="p-6 md:p-8 shrink-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-400">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg md:text-xl font-bold font-oswald text-white uppercase italic tracking-wide">Archery Timer &amp; Shooting Clock</h3>
                  <p className="text-[10px] font-black uppercase text-teal-400 tracking-widest mt-0.5">Sirkuit Stop-watch &amp; Hitung Mundur Official</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <a 
                  href="https://ais-pre-ihwvpfbazwbyenzfsn3unw-238734823836.asia-southeast1.run.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2.5 px-4 border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md"
                >
                  <ExternalLink className="w-4 h-4" /> Buka Tab Baru
                </a>
                <button 
                  onClick={() => setShowTimerModal(false)} 
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-700 hover:text-white transition-all border border-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Display / Launch Dashboard instead of blocked iframe */}
            <div className="flex-1 bg-slate-950 overflow-y-auto p-8 md:p-12 text-slate-600">
              <div className="max-w-3xl mx-auto space-y-10 text-center">
                {/* Visual Timer Mockup */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 relative overflow-hidden shadow-inner flex flex-col md:flex-row items-center justify-between gap-8">
                  {/* Neon backlight effect */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-teal-500/10 rounded-full blur-[80px]" />

                  {/* Left: Mock Clock Visual */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="flex gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-red-600 animate-pulse shadow-[0_0_12px_rgba(220,38,38,0.7)]" />
                      <div className="w-5 h-5 rounded-full bg-amber-500/20" />
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20" />
                    </div>
                    <div className="font-mono text-7xl font-bold text-teal-400 tracking-tighter drop-shadow-[0_0_15px_rgba(45,212,191,0.3)]">
                      120
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-800">Giliran: AB (Sesi-1)</span>
                  </div>

                  {/* Divider */}
                  <div className="h-px w-full md:w-px md:h-24 bg-slate-800" />

                  {/* Right: Key Info & Quick Connect */}
                  <div className="relative z-10 text-left space-y-3 flex-1">
                    <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-300 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-teal-500/20">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                      Ready to Sync
                    </div>
                    <h4 className="text-xl font-bold text-white uppercase italic font-oswald">Integrasi Timer Sukses</h4>
                    <p className="text-slate-700 text-xs leading-relaxed max-w-sm">
                      Aplikasi Timer &amp; Shooting Clock telah berhasil disinkronkan secara mulus dengan sistem turnamen Arcus.
                    </p>
                  </div>
                </div>

                {/* Main Call to Action Button */}
                <div className="space-y-4">
                  <a 
                    href="https://ais-pre-ihwvpfbazwbyenzfsn3unw-238734823836.asia-southeast1.run.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs md:text-sm uppercase tracking-widest px-10 py-5 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(20,184,166,0.3)] hover:shadow-[0_0_40px_rgba(20,184,166,0.5)] group"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Buka Timer Turnamen Resmi
                  </a>
                  <p className="text-slate-450 text-[11px] font-medium max-w-lg mx-auto leading-relaxed">
                    Browser Anda membatasi pemuatan aplikasi dalam iframe karena aturan privasi cookie (Cross-Site Auth). 
                    Silakan gunakan tombol di atas untuk membuka timer langsung pada tab penuh baru.
                  </p>
                </div>

                {/* Setup Recommendations / Guide */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left pt-4">
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-2">
                    <span className="text-teal-400 text-xs font-black uppercase tracking-wider font-mono">01. Dual Monitor Setup</span>
                    <p className="text-slate-405 text-xs leading-relaxed">
                      Luncurkan timer di tab baru, lalu seret tab tersebut ke layar monitor kedua / Proyektor Bantalan agar terlihat jelas oleh seluruh atlet di garis tembak.
                    </p>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-2">
                    <span className="text-teal-400 text-xs font-black uppercase tracking-wider font-mono">02. Auto Synchronized</span>
                    <p className="text-slate-405 text-xs leading-relaxed">
                      Semua perubahan divisi, sesi target, dan pemanggilan shooter akan selaras secara real-time demi kelancaran manajemen official.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer hints */}
            <div className="p-4 bg-slate-900/80 border-t border-slate-800 text-center shrink-0">
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-relaxed">
                Tekan tombol &quot;Buka Tab Baru&quot; jika ingin memproyeksikan timer ke layar sekunder (TV Bantalan / Proyektor)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Official Stage & Round Report Print Modal */}
      {showPrintReportModal && (
        <PrintRoundReportModal 
          event={({
            ...(event || {}),
            id: eventId,
            status: event?.status || 'ACTIVE',
            settings: localSettings,
            archers: archers.length > 0 ? archers : (event?.archers || []),
            officials: officials.length > 0 ? officials : (event?.officials || []),
            scores: event?.scores || [],
            matches: event?.matches || {},
            registrations: event?.registrations || [],
            scoreLogs: event?.scoreLogs || []
          } as any)}
          onClose={() => setShowPrintReportModal(false)}
        />
      )}
    </div>
  );
};

export default AdminPanel;
