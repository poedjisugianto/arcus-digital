import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, User, Target, Phone, Mail, Camera, 
  Trash2, KeyRound, Sparkles, RefreshCw, Loader2, 
  CheckCircle2, Building2, Layers, DollarSign, 
  AlertCircle, ShieldCheck, Check
} from 'lucide-react';
import { Archer, CategoryType, RegistrationStatus, TournamentSettings } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { compressPhoto, uploadPhotoToStorage } from '../lib/photoService';
import { toast } from 'sonner';

interface ArcherEditModalProps {
  isOpen: boolean;
  archer: Archer | null;
  onClose: () => void;
  onSave: (updatedArcher: Archer) => Promise<void> | void;
  totalTargets?: number;
  settings?: TournamentSettings;
  eventId?: string;
}

export const ArcherEditModal: React.FC<ArcherEditModalProps> = ({
  isOpen,
  archer,
  onClose,
  onSave,
  totalTargets = 30,
  settings,
  eventId
}) => {
  const [formData, setFormData] = useState({
    name: '',
    registrationNo: '',
    club: '',
    category: CategoryType.ADULT_PUTRA as string,
    targetNo: 1,
    position: 'A' as 'A' | 'B' | 'C' | 'D',
    wave: 1,
    phone: '',
    email: '',
    status: RegistrationStatus.APPROVED,
    paymentType: 'MANUAL',
    totalPaid: 0,
    platformFee: 0,
    pin: '',
    photoUrl: '',
    checkedIn: false,
    checkInTimestamp: undefined as number | undefined
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever selected archer changes
  useEffect(() => {
    if (archer) {
      setFormData({
        name: archer.name || '',
        registrationNo: archer.registrationNo || '',
        club: archer.club || '',
        category: archer.category || CategoryType.ADULT_PUTRA,
        targetNo: Number(archer.targetNo) || 1,
        position: (archer.position || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D',
        wave: Number(archer.wave) || 1,
        phone: archer.phone === '-' ? '' : (archer.phone || ''),
        email: archer.email === '-' ? '' : (archer.email || ''),
        status: archer.status || RegistrationStatus.APPROVED,
        paymentType: archer.paymentType || 'MANUAL',
        totalPaid: archer.totalPaid || 0,
        platformFee: archer.platformFee || 0,
        pin: archer.pin || '',
        photoUrl: archer.photoUrl || '',
        checkedIn: !!archer.checkedIn,
        checkInTimestamp: archer.checkInTimestamp
      });
    }
  }, [archer]);

  if (!isOpen || !archer) return null;

  // Categories list (combines tournament configured categories and standard enum)
  const availableCategories = (() => {
    const fromConfig = settings?.categoryConfigs ? Object.keys(settings.categoryConfigs) : [];
    const fromEnum = (Object.keys(CategoryType) as CategoryType[]).filter(c => c !== CategoryType.OFFICIAL);
    const combined = Array.from(new Set([...fromConfig, ...fromEnum]));
    return combined.map(catKey => ({
      key: catKey,
      label: CATEGORY_LABELS[catKey as CategoryType] || catKey.replace(/_/g, ' ')
    }));
  })();

  // Handle photo file change
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const { base64, blob } = await compressPhoto(file, 400, 0.8);
      let finalUrl = base64;

      if (eventId) {
        try {
          const downloadUrl = await uploadPhotoToStorage(
            blob, 
            `events/${eventId}/photos/${Date.now()}_${archer.id}.jpg`
          );
          if (downloadUrl) finalUrl = downloadUrl;
        } catch (storageErr) {
          console.warn("Storage upload fallback to base64:", storageErr);
        }
      }

      setFormData(prev => ({ ...prev, photoUrl: finalUrl }));
      toast.success("Foto peserta berhasil diperbarui.");
    } catch (err: any) {
      console.error("Gagal memproses foto:", err);
      toast.error("Gagal mengunggah foto: " + (err.message || "format tidak didukung"));
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Generate random 4-digit PIN for scoring
  const handleGeneratePin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData(prev => ({ ...prev, pin: newPin }));
    toast.info(`PIN Skoring baru: ${newPin}`);
  };

  // Handle save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nama lengkap pemanah wajib diisi.");
      return;
    }

    if (!formData.club.trim()) {
      toast.error("Klub atau instansi pemanah wajib diisi.");
      return;
    }

    setIsSaving(true);
    try {
      const updated: Archer = {
        ...archer,
        name: formData.name.trim(),
        registrationNo: formData.registrationNo.trim() || archer.registrationNo,
        club: formData.club.trim(),
        category: formData.category,
        targetNo: Number(formData.targetNo) || 1,
        position: formData.position,
        wave: Number(formData.wave) || 1,
        phone: formData.phone.trim() || '-',
        email: formData.email.trim() || '-',
        status: formData.status,
        paymentType: formData.paymentType,
        totalPaid: Number(formData.totalPaid) || 0,
        platformFee: Number(formData.platformFee) || 0,
        pin: formData.pin.trim() || archer.pin || Math.floor(1000 + Math.random() * 9000).toString(),
        photoUrl: formData.photoUrl || undefined,
        checkedIn: formData.checkedIn,
        checkInTimestamp: formData.checkedIn 
          ? (formData.checkInTimestamp || Date.now()) 
          : undefined,
        updatedAt: Date.now()
      };

      await onSave(updated);
      toast.success(`Data peserta ${updated.name} berhasil diperbarui!`);
      onClose();
    } catch (err: any) {
      console.error("Gagal menyimpan perubahan peserta:", err);
      toast.error("Gagal menyimpan data: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[115] flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-arcus-red shrink-0 shadow-inner">
              <User className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl md:text-2xl font-black font-oswald uppercase italic tracking-wide text-white">
                  Edit Data Peserta
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-arcus-red/80 text-white px-2.5 py-0.5 rounded-full">
                  ID: {archer.id.slice(0, 10)}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Perbarui identitas atlet, penempatan nomor bantalan, sesi, status bayar, dan autentikasi skoring.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 divide-y divide-slate-100">
          {/* Bagian 1: Identitas & Foto */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-arcus-red" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Identitas Pemanah & Pasfoto
              </h4>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="relative w-20 h-20 rounded-2xl bg-white border-2 border-slate-200 overflow-hidden shadow-md flex items-center justify-center text-slate-400 shrink-0 group">
                {formData.photoUrl ? (
                  <img 
                    src={formData.photoUrl} 
                    alt={formData.name || 'Pemanah'} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-300" />
                )}
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                  Pasfoto Atlet (ID Card & Profil)
                </span>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <label className="cursor-pointer bg-slate-900 hover:bg-arcus-red text-white px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95">
                    <Camera className="w-3.5 h-3.5" />
                    {formData.photoUrl ? 'Ganti Foto' : 'Unggah Foto'}
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoFileChange} 
                      className="hidden" 
                      disabled={isUploadingPhoto || isSaving}
                    />
                  </label>
                  {formData.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                      className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 transition-all border border-red-200 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus Foto
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-slate-500 font-medium">
                  Maksimal foto 5MB. Otomatis dikompresi untuk ketajaman kartu ID dan scoring card.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama lengkap atlet..."
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-bold outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all text-slate-900 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  Klub / Instansi / Pengcab <span className="text-red-500">*</span>
                </span>
                <div className="relative mt-1.5">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.club}
                    onChange={(e) => setFormData({ ...formData, club: e.target.value })}
                    placeholder="Nama klub atau kontingen..."
                    className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 font-bold outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all text-slate-900 text-sm"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  Kategori Perlombaan <span className="text-red-500">*</span>
                </span>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-bold outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all text-slate-900 text-sm bg-white cursor-pointer"
                >
                  {availableCategories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Nomor Registrasi Resmi
                </span>
                <input
                  type="text"
                  value={formData.registrationNo}
                  onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                  placeholder="e.g. REG-0042 atau INV-1234"
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-mono font-bold outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all text-slate-900 text-sm"
                />
              </label>
            </div>
          </div>

          {/* Bagian 2: Penempatan Bantalan & Sesi */}
          <div className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-arcus-red" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Penempatan Bantalan & Gelombang (Wave)
                </h4>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Preview Target:</span>
                <span className="text-xs font-black text-arcus-red">
                  {formData.targetNo > 0 ? `${formData.targetNo}${formData.position}` : 'TBA'}
                  {formData.wave > 1 ? ` - Sesi ${formData.wave}` : ''}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Nomor Bantalan (Target)
                </span>
                <input
                  type="number"
                  min={1}
                  max={totalTargets * 2}
                  value={formData.targetNo}
                  onChange={(e) => setFormData({ ...formData, targetNo: parseInt(e.target.value) || 1 })}
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-black text-slate-900 text-sm outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all"
                />
                <span className="text-[9px] text-slate-600 mt-1 block">Tersedia 1 s/d {totalTargets} bantalan</span>
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Posisi Atlet di Bantalan
                </span>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-black text-slate-900 text-sm outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all bg-white cursor-pointer"
                >
                  <option value="A">Posisi A</option>
                  <option value="B">Posisi B</option>
                  <option value="C">Posisi C</option>
                  <option value="D">Posisi D</option>
                </select>
                <span className="text-[9px] text-slate-600 mt-1 block">Urutan berdirinya atlet di garis tembak</span>
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Sesi / Gelombang (Wave)
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.wave}
                  onChange={(e) => setFormData({ ...formData, wave: parseInt(e.target.value) || 1 })}
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-black text-slate-900 text-sm outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all"
                />
                <span className="text-[9px] text-slate-600 mt-1 block">Wave 1 = Sesi Pagi / Sesi 1</span>
              </label>
            </div>
          </div>

          {/* Bagian 3: Status Pembayaran & Kehadiran (Check-In) */}
          <div className="pt-6 space-y-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Status Pembayaran & Kehadiran
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Status Pendaftaran & Bayar
                </span>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as RegistrationStatus })}
                  className={`mt-1.5 block w-full rounded-2xl border px-4 py-2.5 font-black text-xs uppercase tracking-wider outline-none focus:ring-4 ring-slate-500/10 transition-all cursor-pointer ${
                    formData.status === RegistrationStatus.APPROVED || formData.status === RegistrationStatus.CONFIRMED
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : formData.status === RegistrationStatus.PAID
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : formData.status === RegistrationStatus.REJECTED
                      ? 'bg-red-50 text-red-800 border-red-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value={RegistrationStatus.APPROVED}>APPROVED (Disetujui / Sah)</option>
                  <option value={RegistrationStatus.CONFIRMED}>CONFIRMED (Terkonfirmasi)</option>
                  <option value={RegistrationStatus.PAID}>PAID (Sudah Bayar)</option>
                  <option value={RegistrationStatus.PENDING}>PENDING (Menunggu Verifikasi)</option>
                  <option value={RegistrationStatus.REJECTED}>REJECTED (Ditolak / Dibatalkan)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Metode Pembayaran
                </span>
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-bold text-xs uppercase tracking-wider outline-none focus:ring-4 ring-slate-500/10 focus:border-slate-800 transition-all bg-white cursor-pointer"
                >
                  <option value="MANUAL">MANUAL (Input Admin)</option>
                  <option value="TRANSFER">TRANSFER BANK</option>
                  <option value="CASH">TUNAI (CASH ON DESK)</option>
                  <option value="GATEWAY">PAYMENT GATEWAY</option>
                </select>
              </label>
            </div>

            {/* Check-In Kehadiran Switch */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Status Registrasi Ulang (Check-In Lapangan)
                  </span>
                  {formData.checkedIn ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                      Hadir
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-200 text-slate-600 uppercase">
                      Belum Hadir
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  {formData.checkedIn && formData.checkInTimestamp
                    ? `Dicatat hadir pada: ${new Date(formData.checkInTimestamp).toLocaleString('id-ID')}`
                    : 'Peserta belum melakukan registrasi ulang di meja panitia / barcode scanner.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextCheckedIn = !formData.checkedIn;
                  setFormData(prev => ({
                    ...prev,
                    checkedIn: nextCheckedIn,
                    checkInTimestamp: nextCheckedIn ? (prev.checkInTimestamp || Date.now()) : undefined
                  }));
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-95 ${
                  formData.checkedIn
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                {formData.checkedIn ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Tandai Belum Hadir
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Tandai Hadir Sekarang
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bagian 4: Kontak & PIN Skoring Atlet */}
          <div className="pt-6 space-y-6">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-arcus-red" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Kontak & PIN Skoring Atlet
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  Nomor WhatsApp / HP
                </span>
                <div className="relative mt-1.5">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0812xxxxxxxx"
                    className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 font-bold outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all text-slate-900 text-sm"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  Alamat Email
                </span>
                <div className="relative mt-1.5">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@archer.com"
                    className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 font-bold outline-none focus:ring-4 ring-red-500/10 focus:border-arcus-red transition-all text-slate-900 text-sm"
                  />
                </div>
              </label>

              <div className="sm:col-span-2 p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                      PIN Skoring Atlet (4 Digit)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePin}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-amber-200 hover:bg-amber-300 text-amber-900 transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Acak PIN Baru
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="Contoh: 1234"
                    className="w-40 px-4 py-2 rounded-xl border border-amber-300 font-mono text-lg font-black tracking-widest text-center text-slate-900 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-amber-900 font-medium">
                    Digunakan oleh pemanah untuk mencatat skor secara mandiri di gadget mereka tanpa perlu akun login rumit.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-6 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-arcus-red hover:bg-red-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ArcherEditModal;
