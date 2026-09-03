import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, ShieldCheck, Building2, Phone, Mail, 
  Camera, Trash2, Loader2 
} from 'lucide-react';
import { ParticipantRegistration, RegistrationStatus, TournamentSettings } from '../types';
import { compressPhoto, uploadPhotoToStorage } from '../lib/photoService';
import { toast } from 'sonner';

interface OfficialEditModalProps {
  isOpen: boolean;
  official: ParticipantRegistration | null;
  onClose: () => void;
  onSave: (updatedOfficial: ParticipantRegistration) => Promise<void> | void;
  settings?: TournamentSettings;
  eventId?: string;
}

export const OfficialEditModal: React.FC<OfficialEditModalProps> = ({
  isOpen,
  official,
  onClose,
  onSave,
  eventId
}) => {
  const [formData, setFormData] = useState({
    name: '',
    club: '',
    phone: '',
    email: '',
    status: RegistrationStatus.APPROVED,
    photoUrl: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (official) {
      setFormData({
        name: official.name || '',
        club: official.club || '',
        phone: official.phone === '-' ? '' : (official.phone || ''),
        email: official.email === '-' ? '' : (official.email || ''),
        status: official.status || RegistrationStatus.APPROVED,
        photoUrl: official.photoUrl || ''
      });
    }
  }, [official]);

  if (!isOpen || !official) return null;

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
            `events/${eventId}/photos/${Date.now()}_official_${official.id}.jpg`
          );
          if (downloadUrl) finalUrl = downloadUrl;
        } catch (storageErr) {
          console.warn("Storage upload fallback to base64:", storageErr);
        }
      }

      setFormData(prev => ({ ...prev, photoUrl: finalUrl }));
      toast.success("Foto official berhasil diperbarui.");
    } catch (err: any) {
      console.error("Gagal memproses foto:", err);
      toast.error("Gagal mengunggah foto: " + (err.message || "format tidak didukung"));
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nama lengkap official wajib diisi.");
      return;
    }

    if (!formData.club.trim()) {
      toast.error("Klub atau instansi wajib diisi.");
      return;
    }

    setIsSaving(true);
    try {
      const updated: ParticipantRegistration = {
        ...official,
        name: formData.name.trim(),
        club: formData.club.trim(),
        phone: formData.phone.trim() || '-',
        email: formData.email.trim() || '-',
        status: formData.status,
        photoUrl: formData.photoUrl || undefined
      };

      await onSave(updated);
      toast.success(`Data official ${updated.name} berhasil disimpan!`);
      onClose();
    } catch (err: any) {
      console.error("Gagal menyimpan official:", err);
      toast.error("Gagal menyimpan data: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[115] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black font-oswald uppercase italic tracking-wide text-white">
                Edit Data Official
              </h3>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Perbarui nama, kontingen, kontak, status, dan pasfoto official / pelatih.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Pasfoto */}
          <div className="flex items-center gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="relative w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center text-slate-400 shrink-0">
              {formData.photoUrl ? (
                <img src={formData.photoUrl} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <ShieldCheck className="w-8 h-8 text-blue-400" />
              )}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-1 flex-1">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider block">
                Pasfoto ID Card Official
              </span>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer bg-slate-900 hover:bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5 active:scale-95 shadow-sm">
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
                    className="px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 transition-all border border-red-200 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                Nama Lengkap Official <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama official / manajer / pelatih..."
                className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-bold outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                Klub / Pengcab / Instansi <span className="text-red-500">*</span>
              </span>
              <div className="relative mt-1.5">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.club}
                  onChange={(e) => setFormData({ ...formData, club: e.target.value })}
                  placeholder="Klub atau kontingen..."
                  className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 font-bold outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 text-sm"
                />
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Nomor WhatsApp / HP
                </span>
                <div className="relative mt-1.5">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0812xxxxxxxx"
                    className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 font-bold outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 text-sm"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Alamat Email
                </span>
                <div className="relative mt-1.5">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="official@email.com"
                    className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 font-bold outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 text-sm"
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                Status Pendaftaran
              </span>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as RegistrationStatus })}
                className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-black text-xs uppercase tracking-wider outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all bg-white cursor-pointer"
              >
                <option value={RegistrationStatus.APPROVED}>APPROVED (Disetujui / Aktif)</option>
                <option value={RegistrationStatus.CONFIRMED}>CONFIRMED (Terkonfirmasi)</option>
                <option value={RegistrationStatus.PAID}>PAID (Lunas)</option>
                <option value={RegistrationStatus.PENDING}>PENDING (Menunggu)</option>
                <option value={RegistrationStatus.REJECTED}>REJECTED (Dibatalkan)</option>
              </select>
            </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
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

export default OfficialEditModal;
