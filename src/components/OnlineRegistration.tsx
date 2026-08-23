import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ArcheryEvent, GlobalSettings, ParticipantRegistration, CategoryType, RegistrationStatus } from '../types';
import { compressPhoto, uploadPhotoToStorage } from '../lib/photoService';

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: any) => void;
    };
  }
}
import { CATEGORY_LABELS } from '../constants';
import { isValidDate } from '../lib/dateUtils';
import { 
  ArrowLeft, User, Mail, ShieldCheck, CreditCard, 
  Upload, Check, AlertCircle, Zap, Sparkles, 
  Target, Trophy, Users, Activity, Info, FileText, Landmark, Smartphone,
  Camera, Loader2, ExternalLink, ShieldAlert, QrCode, RefreshCw, Printer
} from 'lucide-react';

interface Props {
  event: ArcheryEvent;
  globalSettings: GlobalSettings;
  onRegister: (r: ParticipantRegistration[]) => void;
  onBack: () => void;
  onViewParticipants: () => void;
}

export default function OnlineRegistration({ event, globalSettings, onRegister, onBack, onViewParticipants }: Props) {
  const [regMode, setRegMode] = useState<'INDIVIDUAL' | 'COLLECTIVE'>('INDIVIDUAL');
  const [step, setStep] = useState(1);
  const [recentRegistrations, setRecentRegistrations] = useState<ParticipantRegistration[]>([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [activePaymentSession, setActivePaymentSession] = useState<{
    orderId: string;
    redirectUrl: string;
    token?: string;
    registrations: ParticipantRegistration[];
    isReal?: boolean;
    qrData?: string;
  } | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  
  const isRegistrationClosed = (event.settings?.registrationDeadline && isValidDate(event.settings?.registrationDeadline)) 
    ? new Date() > new Date(event.settings?.registrationDeadline) 
    : false;

  const getCategoryRegisteredCount = (cat: string) => {
    return (event.registrations || []).filter(
      r => r.category === cat && 
      r.status !== RegistrationStatus.REJECTED
    ).length;
  };

  const getCategoryQuota = (cat: string): number | undefined => {
    return event.settings?.categoryConfigs?.[cat as CategoryType]?.quota;
  };

  const isCategoryFull = (cat: string): boolean => {
    const quota = getCategoryQuota(cat);
    if (quota === undefined || quota === null || quota <= 0) return false;
    return getCategoryRegisteredCount(cat) >= quota;
  };

  const getSimulatedCountForCategory = (cat: string) => {
    const dbCount = getCategoryRegisteredCount(cat);
    const localCount = collectiveMembers.filter(m => m.category === cat).length;
    return dbCount + localCount;
  };

  const [collectiveMembers, setCollectiveMembers] = useState<{name: string, category: string, photoUrl?: string}[]>([]);
  const [newMember, setNewMember] = useState({ name: '', category: '', photoUrl: '' });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const isGatewayEnabled = event.settings?.enableGateway !== false;

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    club: string;
    category: string;
    paymentProof: string;
    paymentType: 'MANUAL' | 'GATEWAY';
    selectedPaymentMethodId: string;
    regType: 'ARCHER' | 'OFFICIAL';
    photoUrl?: string;
  }>({
    name: '', email: '', phone: '', club: '', category: '', paymentProof: '',
    paymentType: isGatewayEnabled ? 'GATEWAY' : 'MANUAL', 
    selectedPaymentMethodId: '', regType: 'ARCHER', photoUrl: ''
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, isForNewMember: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingPhoto(true);
      try {
        const { base64, blob } = await compressPhoto(file, 250, 0.7);
        let finalUrl = base64; // Fallback to base64

        try {
          const randomId = Math.random().toString(36).substring(2, 11);
          finalUrl = await uploadPhotoToStorage(blob, `registrations/${randomId}.jpg`);
          toast.success("Foto berhasil diunggah");
        } catch (storageErr) {
          console.warn("Storage upload failed, using secure base64 local fallback:", storageErr);
          toast.success("Foto diproses secara lokal");
        }

        if (isForNewMember) {
          setNewMember(prev => ({ ...prev, photoUrl: finalUrl }));
        } else {
          setFormData(prev => ({ ...prev, photoUrl: finalUrl }));
        }
      } catch (err: any) {
        toast.error("Gagal memproses foto: " + err.message);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  // Removed localStorage sync to prevent "stale" form data complaints

  const ensureSnapLoaded = (clientKey: string, isProduction: boolean): Promise<any> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).snap) {
        return resolve((window as any).snap);
      }
      const snapSrc = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
      const existing = document.getElementById('midtrans-snap');
      if (existing) {
        if (existing.getAttribute('data-client-key') === clientKey && (window as any).snap) {
          return resolve((window as any).snap);
        }
        existing.remove();
      }

      const script = document.createElement('script');
      script.src = snapSrc;
      script.id = 'midtrans-snap';
      script.setAttribute('data-client-key', clientKey);
      script.async = true;
      script.onload = () => {
        resolve((window as any).snap || null);
      };
      script.onerror = () => {
        console.warn("[MIDTRANS] Failed to load snap.js");
        resolve(null);
      };
      document.body.appendChild(script);

      setTimeout(() => {
        resolve((window as any).snap || null);
      }, 3000);
    });
  };

  useEffect(() => {
    if (globalSettings.paymentGatewayProvider === 'MIDTRANS') {
      const clientKey = (globalSettings.paymentGatewayClientKey && globalSettings.paymentGatewayClientKey !== 'YOUR_MIDTRANS_CLIENT_KEY') 
        ? globalSettings.paymentGatewayClientKey 
        : "Mid-client-dZqaZ7wEUS4n0Cxc";
      const isProduction = globalSettings.paymentGatewayIsProduction === true || String(globalSettings.paymentGatewayIsProduction) === "true";
      ensureSnapLoaded(clientKey, isProduction);
    }
  }, [globalSettings.paymentGatewayClientKey, globalSettings.paymentGatewayProvider, globalSettings.paymentGatewayIsProduction]);

  const categories = event.settings?.categoryConfigs && Object.keys(event.settings.categoryConfigs).length > 0
    ? Object.keys(event.settings.categoryConfigs).filter(cat => cat !== CategoryType.OFFICIAL) 
    : (Object.keys(CategoryType) as CategoryType[]).filter(cat => cat !== CategoryType.OFFICIAL);

  useEffect(() => {
    if (categories.length > 0) {
      if (!formData.category || !categories.includes(formData.category)) {
        setFormData(prev => ({ ...prev, category: categories[0] }));
      }
      if (!newMember.category || !categories.includes(newMember.category)) {
        setNewMember(prev => ({ ...prev, category: categories[0] }));
      }
    }
  }, [categories, formData.category, newMember.category]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Relaxed limit since we compress and server now accepts 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File terlalu besar (Maks 10MB)");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 1200px
          const maxDim = 1200;
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const compressedData = canvas.toDataURL('image/jpeg', 0.7);
          setFormData({ ...formData, paymentProof: compressedData });
          toast.success("Bukti pembayaran siap diunggah");
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const availableManualMethods = (event.settings?.paymentMethods && event.settings.paymentMethods.length > 0)
    ? event.settings.paymentMethods
    : [{ 
        id: 'global_default', 
        provider: globalSettings.bankProvider, 
        accountNumber: globalSettings.bankAccountNumber, 
        accountName: globalSettings.bankAccountName 
      }];

  const activeMethod = availableManualMethods.find((m: any) => m.id === formData.selectedPaymentMethodId) || availableManualMethods[0];

  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [simulatedQR, setSimulatedQR] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const completeSimulation = async (newReg: ParticipantRegistration) => {
    setIsSimulatingPayment(false);
    setIsSubmitting(true);
    try {
      setRecentRegistrations([newReg]);
      await onRegister([newReg]);
      localStorage.removeItem(`reg_draft_${event.id}`);
      localStorage.removeItem(`reg_step_${event.id}`);
      setStep(3);
    } catch (err) {
      toast.error("Gagal simpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetRegistration = () => {
    setFormData({
      name: '', email: '', phone: '', club: '', category: '', paymentProof: '',
      paymentType: 'MANUAL', selectedPaymentMethodId: '', regType: 'ARCHER', photoUrl: ''
    });
    setAgreedToTerms(false);
    setStep(1);
    setActivePaymentSession(null);
  };

  const checkPaymentStatus = async (silent = false) => {
    if (!activePaymentSession) return;
    if (!silent) setIsCheckingPayment(true);
    try {
      const res = await fetch(`/api/payment/status/${activePaymentSession.orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.status === 'PAID') {
          toast.success("Sip! Pembayaran berhasil terverifikasi.");
          const approvedRegs = activePaymentSession.registrations.map(r => ({
            ...r,
            status: RegistrationStatus.APPROVED,
            paymentId: activePaymentSession.orderId
          }));
          setRecentRegistrations(approvedRegs);
          await onRegister(approvedRegs);
          setActivePaymentSession(null);
          setStep(3);
        } else {
          if (!silent) {
            toast.info("Status pembayaran: Masih PENDING. Silakan bayar melalui portal pembayaran.");
          }
        }
      }
    } catch (err) {
      console.error("Gagal periksa pembayaran:", err);
    } finally {
      if (!silent) setIsCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (!activePaymentSession) return;
    const interval = setInterval(() => {
      checkPaymentStatus(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [activePaymentSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isRegistrationClosed) {
      toast.error("Maaf, pendaftaran sudah ditutup karena melewati batas tanggal pendaftaran.");
      return;
    }

    if (!agreedToTerms) {
      toast.error("Anda harus menyetujui Syarat & Ketentuan untuk melanjutkan");
      return;
    }

    if (regMode === 'INDIVIDUAL') {
      if (formData.regType === 'ARCHER') {
        const quota = getCategoryQuota(formData.category);
        if (quota !== undefined && quota !== null && quota > 0) {
          const count = getCategoryRegisteredCount(formData.category);
          if (count >= quota) {
            toast.error(`Kategori ${CATEGORY_LABELS[formData.category as CategoryType] || formData.category} sudah penuh (maksimal ${quota} pemanah).`);
            return;
          }
        }
      }
    } else {
      // Untuk kolektif, periksa kuota masing-masing kategori satu-satu
      const catCounts: Record<string, number> = {};
      for (const m of collectiveMembers) {
        if (m.category === 'OFFICIAL') continue;
        catCounts[m.category] = (catCounts[m.category] || 0) + 1;
      }

      for (const cat of Object.keys(catCounts)) {
        const quota = getCategoryQuota(cat);
        if (quota !== undefined && quota !== null && quota > 0) {
          const currentCount = getCategoryRegisteredCount(cat);
          const additionCount = catCounts[cat];
          if (currentCount + additionCount > quota) {
            toast.error(`Kategori ${CATEGORY_LABELS[cat as CategoryType] || cat} melebihi kuota. Kuota sisa/tersedia: ${quota - currentCount} pemanah, Anda mencoba mendaftarkan ${additionCount} pemanah.`);
            return;
          }
        }
      }
    }
    
    // Check for duplicates in current event data
    const isDuplicate = (name: string, cat: string) => {
      const lowerName = name.toLowerCase().trim();
      return (
        (event.registrations || []).some(r => r.name.toLowerCase().trim() === lowerName && r.category === cat) ||
        (event.archers || []).some(a => a.name.toLowerCase().trim() === lowerName && a.category === cat) ||
        (event.officials || []).some(o => o.name.toLowerCase().trim() === lowerName && o.category === cat)
      );
    };

    if (regMode === 'INDIVIDUAL') {
      if (isDuplicate(formData.name, formData.regType === 'OFFICIAL' ? 'OFFICIAL' : formData.category)) {
        toast.error("Nama ini sudah terdaftar di kategori tersebut.");
        return;
      }
    } else {
      const duplicateMember = collectiveMembers.find(m => isDuplicate(m.name, m.category));
      if (duplicateMember) {
        toast.error(`Anggota "${duplicateMember.name}" sudah terdaftar di kategori ${duplicateMember.category}.`);
        return;
      }
    }
    
    if (formData.paymentType === 'MANUAL' && !formData.paymentProof) {
      toast.error("Silakan unggah bukti pembayaran terlebih dahulu");
      return;
    }

    const registrations: ParticipantRegistration[] = [];
    const year = new Date().getFullYear();
    const eventName = event.settings?.tournamentName || "Kejuaraan Panahan Tradisional";
    const words = eventName.trim().split(/\s+/);
    const abbreviation = words
      .map(word => {
        const clean = word.replace(/[^a-zA-Z0-9]/g, '');
        return clean ? clean[0].toUpperCase() : '';
      })
      .join('') || "ARC";
    const baseCount = event.registrations?.length || 0;

    if (regMode === 'INDIVIDUAL') {
      const orderNum = baseCount + 1;
      const registrationNo = `${abbreviation}-${orderNum.toString().padStart(3, '0')}`;
      
      let regFee = 0;
      if (formData.regType === 'OFFICIAL') {
        regFee = event.settings?.officialFee || 0;
      } else {
        const config = event.settings?.categoryConfigs?.[formData.category as CategoryType];
        regFee = config?.registrationFee || 0;
      }
      
      const isKids = [
        CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
        CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
      ].includes(formData.category as CategoryType);

      const platformFee = isKids ? globalSettings.feeKids : globalSettings.feeAdult;
      const totalPaid = regFee + platformFee;

      registrations.push({
        id: 'reg_' + Math.random().toString(36).substr(2, 9),
        registrationNo,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        club: formData.club,
        category: formData.regType === 'OFFICIAL' ? 'OFFICIAL' : formData.category,
        regType: formData.regType,
        paymentProof: formData.paymentType === 'MANUAL' ? (formData.paymentProof || "") : "",
        photoUrl: formData.photoUrl || "",
        totalPaid,
        platformFee,
        status: RegistrationStatus.PENDING,
        paymentType: formData.paymentType,
        timestamp: Date.now()
      });
    } else {
      // Collective logic
      if (collectiveMembers.length === 0) {
        toast.error("Tambahkan minimal satu anggota");
        return;
      }

      collectiveMembers.forEach((member, idx) => {
        const orderNum = baseCount + 1 + idx;
        const registrationNo = `${abbreviation}-${orderNum.toString().padStart(3, '0')}`;
        
        let regFee = 0;
        const isOfficial = member.category === CategoryType.OFFICIAL || member.category === 'OFFICIAL';
        if (isOfficial) {
          regFee = event.settings?.officialFee || 0;
        } else {
          const config = event.settings?.categoryConfigs?.[member.category as CategoryType];
          regFee = config?.registrationFee || 0;
        }
        
        const isKids = [
          CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
          CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
        ].includes(member.category as CategoryType);

        const platformFee = isKids ? globalSettings.feeKids : globalSettings.feeAdult;
        const totalPaid = regFee + platformFee;

        registrations.push({
          id: 'reg_' + Math.random().toString(36).substr(2, 9),
          registrationNo,
          name: member.name,
          email: formData.email, // Use club contact email
          phone: formData.phone, // Use club contact phone
          club: formData.club,
          category: member.category,
          regType: (member.category === 'OFFICIAL' || member.category === CategoryType.OFFICIAL) ? 'OFFICIAL' : 'ARCHER',
          paymentProof: formData.paymentType === 'MANUAL' ? (formData.paymentProof || "") : "",
          photoUrl: member.photoUrl || "",
          totalPaid,
          platformFee,
          status: RegistrationStatus.PENDING,
          paymentType: formData.paymentType,
          timestamp: Date.now()
        });
      });
    }

    const totalAmount = registrations.reduce((sum, r) => sum + r.totalPaid, 0);

    if (formData.paymentType === 'GATEWAY') {
      setIsSubmitting(true);
      const loadingToastId = toast.loading("Menghubungkan ke gerbang pembayaran Midtrans...");
      try {
        console.log("Initiating payment gateway for:", totalAmount);

        const res = await fetch('/api/payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: totalAmount,
            method: 'GATEWAY',
            provider: globalSettings.paymentGatewayProvider || 'MIDTRANS',
            customerDetails: { name: formData.name || formData.club, email: formData.email },
            itemDetails: registrations.map(r => ({ id: r.category || 'REG', price: r.totalPaid, quantity: 1, name: `Reg ${r.name} - ${r.category}` }))
          })
        });
        
        toast.dismiss(loadingToastId);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || "Gagal membuat transaksi pembayaran di server");
        }
        
        const data = await res.json();
        
        if (data.success) {
          // Set active payment session for backup modal / failover
          setActivePaymentSession({
            orderId: data.transactionId,
            redirectUrl: data.redirectUrl || '',
            token: data.token,
            registrations,
            isReal: !!data.isReal,
            qrData: data.qrData
          });

          const clientKey = (globalSettings.paymentGatewayClientKey && globalSettings.paymentGatewayClientKey !== 'YOUR_MIDTRANS_CLIENT_KEY') 
            ? globalSettings.paymentGatewayClientKey 
            : "Mid-client-dZqaZ7wEUS4n0Cxc";
          const isProduction = globalSettings.paymentGatewayIsProduction === true || String(globalSettings.paymentGatewayIsProduction) === "true";

          const snapInstance = await ensureSnapLoaded(clientKey, isProduction);

          // Standard Snap popup if available
          if (data.token && snapInstance) {
            console.log("Snap token received, opening Midtrans Snap popup...");
            try {
              snapInstance.pay(data.token, {
                onSuccess: (result: any) => { 
                  console.log("Payment success", result);
                  const approvedRegs = registrations.map(r => ({ ...r, status: RegistrationStatus.APPROVED, paymentId: result.transaction_id || data.transactionId }));
                  setRecentRegistrations(approvedRegs);
                  onRegister(approvedRegs); 
                  setActivePaymentSession(null);
                  setStep(3); 
                },
                onPending: (result: any) => { 
                  console.log("Payment pending", result);
                  const pendingRegs = registrations.map(r => ({ ...r, status: RegistrationStatus.PENDING, paymentId: result.transaction_id || data.transactionId }));
                  setRecentRegistrations(pendingRegs);
                  onRegister(pendingRegs); 
                  setActivePaymentSession(null);
                  setStep(3); 
                },
                onError: (result: any) => { 
                  console.error("Payment error", result);
                  toast.error("Pembayaran Gagal atau Dibatalkan.");
                  setIsSubmitting(false);
                },
                onClose: () => {
                  console.log("Payment popup closed");
                  setIsSubmitting(false);
                }
              });
            } catch (snapErr) {
              console.warn("Snap pay error, falling back to direct redirect:", snapErr);
              if (data.redirectUrl) {
                window.open(data.redirectUrl, '_blank');
              }
            }
          } else if (data.redirectUrl) {
            console.log("Opening Midtrans payment page directly via redirectUrl:", data.redirectUrl);
            const opened = window.open(data.redirectUrl, '_blank');
            if (!opened) {
              // If popup blocker stopped window.open, navigate directly
              window.location.href = data.redirectUrl;
            }
          }
        } else {
          console.warn("API returned success = false", data);
          toast.error(data.error || data.message || "Gagal membuat transaksi pembayaran.");
          setIsSubmitting(false);
        }
      } catch (err: any) {
        toast.dismiss(loadingToastId);
        console.error("Payment registration error:", err);
        toast.error(err.message || "Terjadi kesalahan sistem pendaftaran.");
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(true);
      console.log("Manual registration started", registrations.length, "regs");
      try {
        // Refresh event context before registering to ensure data is absolute live
        // We add a try-catch specifically for this pre-check so it doesn't block registration if it fails
        try {
          const freshRes = await fetch(`/api/event-details/${event.id}`);
          if (freshRes.ok) {
            const freshData = await freshRes.json();
            console.log("Cloud verify success", !!freshData.success);
          }
        } catch (fetchErr) {
          console.warn("Cloud pre-verify failed (non-critical):", fetchErr);
        }

        setRecentRegistrations(registrations);
        await onRegister(registrations);
        console.log("onRegister success, switching to step 3");
        setStep(3);
      } catch (err: any) {
        console.error("Manual registration error:", err);
        toast.error(err.message || "Gagal sinkron cloud. Silakan coba lagi.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-12 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              tabIndex={-1}
              onClick={onBack} 
              className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl text-slate-400 hover:text-arcus-red transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xs md:text-lg font-black font-oswald uppercase italic text-slate-900 tracking-tighter leading-none">REGISTRASI</h1>
              <p className="text-[6px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] italic truncate max-w-[100px] md:max-w-[200px]">{event.settings?.tournamentName}</p>
            </div>
          </div>
          <button onClick={onViewParticipants} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-[7px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
            <Users className="w-2.5 h-2.5 md:w-3 md:h-3" /> PESERTA
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-2 md:py-4 relative z-10">
        {step === 3 && (
          <div className="text-center py-10 md:py-16 space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-1000">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20" />
              <div className="relative w-20 h-20 md:w-24 md:h-24 bg-emerald-500 rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl">
                <Check className="w-10 h-10 md:w-12 md:h-12 stroke-[3]" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl md:text-5xl font-black font-oswald text-slate-900 uppercase italic leading-none">BERHASIL!</h1>
              <p className="text-sm md:text-xl text-slate-500 font-bold italic tracking-tight max-w-xs md:max-w-md mx-auto">Selamat <strong>{formData.name}</strong>, pendaftaran Anda telah tercatat.</p>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-100 max-w-sm mx-auto space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Pendaftaran Anda Berhasil</p>
                <button 
                  onClick={onViewParticipants} 
                  className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-xs hover:bg-arcus-red transition-all flex items-center justify-center gap-3"
                >
                  <Users className="w-4 h-4" /> CEK DAFTAR PESERTA
                </button>
                <button 
                  onClick={() => setShowInvoice(true)} 
                  className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-xs hover:bg-amber-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20"
                >
                  <FileText className="w-4 h-4" /> UNDUH / CETAK INVOICE
                </button>
                <p className="text-[9px] font-bold text-slate-400 italic">Pastikan nama Anda sudah muncul di daftar peserta.</p>
              </div>

              {event.settings?.waGroupLink && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">GABUNG GRUP WHATSAPP</p>
                  <a 
                    href={event.settings.waGroupLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Smartphone className="w-4 h-4" /> KLIK GABUNG GRUP WA
                  </a>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <button 
                  onClick={resetRegistration} 
                  className="w-full py-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl font-black uppercase text-xs hover:bg-emerald-100 transition-all"
                >
                  DAFTAR PESERTA LAIN
                </button>
                <button 
                  onClick={onBack} 
                  className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
                >
                  KEMBALI KE BERANDA
                </button>
              </div>
            </div>
          </div>
        )}

        {step !== 3 && (
          <div className="space-y-6">
            {isRegistrationClosed && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <p className="text-[10px] font-black text-rose-900 uppercase">Maaf, pendaftaran lomba telah ditutup secara otomatis karena melewati batas waktu pendaftaran yang telah ditentukan oleh panitia.</p>
              </div>
            )}
            <div className="flex items-center justify-center gap-6 mb-6">
              {[1, 2].map(i => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm transition-all ${step >= i ? 'bg-slate-900 text-white' : 'bg-white text-slate-300 border border-slate-100'}`}>{i}</div>
                  <span className={`text-[7px] font-black uppercase tracking-widest ${step >= i ? 'text-slate-900' : 'text-slate-300'}`}>{i === 1 ? 'BIODATA' : 'PEMBAYARAN'}</span>
                </div>
              ))}
            </div>

            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="bg-white p-4 md:p-6 rounded-[2rem] shadow-xl space-y-4">
                <div className="flex gap-3 bg-slate-50 p-1 rounded-xl">
                  <button type="button" onClick={() => setRegMode('INDIVIDUAL')} className={`flex-1 py-2.5 rounded-lg font-black text-[10px] transition-all ${regMode === 'INDIVIDUAL' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>INDIVIDU</button>
                  <button type="button" onClick={() => setRegMode('COLLECTIVE')} className={`flex-1 py-2.5 rounded-lg font-black text-[10px] transition-all ${regMode === 'COLLECTIVE' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>KOLEKTIF (KLUB)</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 space-y-0.5">
                    <span className="text-[7.5px] font-black text-slate-400 uppercase ml-2 italic">Nama Klub</span>
                    <input 
                      required 
                      type="text"
                      placeholder="NAMA KLUB" 
                      value={formData.club} 
                      onChange={e => setFormData({...formData, club: e.target.value.toUpperCase()})} 
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-black italic border border-slate-100 outline-none focus:border-arcus-red text-[11px]" 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-black text-slate-400 uppercase ml-2 italic">Email Kontak</span>
                    <input required type="email" placeholder="EMAIL" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 bg-slate-50 rounded-xl font-black italic border border-slate-100 outline-none focus:border-arcus-red text-[11px]" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-black text-slate-400 uppercase ml-2 italic">Nomor WA Pengurus</span>
                    <input 
                      required 
                      type="text"
                      placeholder="NOMOR TELEPON (WA)" 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-black italic border border-slate-100 outline-none focus:border-arcus-red text-[11px]" 
                    />
                  </div>
                  
                  {regMode === 'INDIVIDUAL' ? (
                    <>
                      <div className="md:col-span-2 bg-slate-50 p-1 rounded-xl flex gap-1">
                        <button type="button" onClick={() => setFormData({...formData, regType: 'ARCHER'})} className={`flex-1 py-2 rounded-lg font-black text-[9px] transition-all ${formData.regType === 'ARCHER' ? 'bg-arcus-red text-white' : 'text-slate-400'}`}>ATLET</button>
                        <button type="button" onClick={() => setFormData({...formData, regType: 'OFFICIAL', category: 'OFFICIAL'})} className={`flex-1 py-2 rounded-lg font-black text-[9px] transition-all ${formData.regType === 'OFFICIAL' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>OFFICIAL</button>
                      </div>
                      <div className="md:col-span-2 space-y-0.5">
                        <span className="text-[7.5px] font-black text-slate-400 uppercase ml-2 italic">Nama Peserta</span>
                        <input required type="text" placeholder="NAMA LENGKAP" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-50 rounded-xl font-black italic border border-slate-100 outline-none focus:border-arcus-red text-[11px]" />
                      </div>
                      <div className="md:col-span-2 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Foto Peserta (Untuk Kartu ID Card)</span>
                        <div className="flex items-center gap-4">
                          <div className="relative w-16 h-16 rounded-2xl bg-slate-200 border-2 border-white overflow-hidden shadow-md flex items-center justify-center text-slate-400 shrink-0">
                            {formData.photoUrl ? (
                              <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <Camera className="w-6 h-6" />
                            )}
                            {isUploadingPhoto && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <label className="cursor-pointer bg-slate-900 text-white hover:bg-arcus-red px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all inline-block">
                              {formData.photoUrl ? "Ganti Foto" : "Pilih Foto Anda"}
                              <input type="file" accept="image/*" onChange={(e) => handlePhotoChange(e, false)} className="hidden" />
                            </label>
                            <p className="text-[7.5px] font-bold text-slate-400 mt-1 uppercase">Sangat direkomendasikan rasio 3x4 atau pasfoto formal.</p>
                          </div>
                        </div>
                      </div>
                      {formData.regType === 'ARCHER' && (
                        <div className="md:col-span-2 space-y-0.5">
                          <span className="text-[7.5px] font-black text-slate-400 uppercase ml-2 italic">Kategori</span>
                          <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2.5 bg-slate-50 rounded-xl font-black italic border border-slate-100 outline-none appearance-none text-[11px]">
                            <option value="">PILIH KATEGORI</option>
                            {categories.map(cat => {
                              const count = getCategoryRegisteredCount(cat);
                              const quota = getCategoryQuota(cat);
                              const isFull = quota !== undefined && quota !== null && quota > 0 && count >= quota;
                              const label = CATEGORY_LABELS[cat as CategoryType] || cat;
                              const quotaStr = quota !== undefined && quota !== null && quota > 0 
                                ? ` (Sisa Slot: ${quota - count}/${quota}${isFull ? ' - PENUH' : ''})` 
                                : '';
                              return (
                                <option key={cat} value={cat} disabled={isFull}>
                                  {label}{quotaStr}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase">Daftar Anggota Klub ({collectiveMembers.length})</h4>
                      </div>
                      
                      {collectiveMembers.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                          {collectiveMembers.map((m, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-400">
                                  {m.photoUrl ? (
                                    <img src={m.photoUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="text-left">
                                  <p className="text-[10px] font-black text-slate-900 uppercase italic">{m.name}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">{CATEGORY_LABELS[m.category as CategoryType] || m.category}</p>
                                </div>
                              </div>
                              <button onClick={() => setCollectiveMembers(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-300 hover:text-arcus-red transition-colors">
                                <AlertCircle className="w-4 h-4 rotate-45" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <p className="text-[8px] font-black text-slate-400 uppercase italic text-center">Tambah Anggota Baru</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input type="text" placeholder="NAMA ANGGOTA" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-white rounded-xl font-black italic border border-slate-200 text-[10px]" />
                          <select value={newMember.category} onChange={e => setNewMember({...newMember, category: e.target.value})} className="w-full p-2.5 bg-white rounded-xl font-black italic border border-slate-200 text-[10px]">
                            <option value="">PILIH KATEGORI</option>
                            {categories.map(cat => {
                              const count = getSimulatedCountForCategory(cat);
                              const quota = getCategoryQuota(cat);
                              const isFull = quota !== undefined && quota !== null && quota > 0 && count >= quota;
                              const label = CATEGORY_LABELS[cat as CategoryType] || cat;
                              const quotaStr = quota !== undefined && quota !== null && quota > 0 
                                ? ` (Sisa Slot: ${quota - count}/${quota}${isFull ? ' - PENUH' : ''})` 
                                : '';
                              return (
                                <option key={cat} value={cat} disabled={isFull}>
                                  {label}{quotaStr}
                                </option>
                              );
                            })}
                            {!categories.includes(CategoryType.OFFICIAL as any) && (
                              <option value={CategoryType.OFFICIAL}>{CATEGORY_LABELS[CategoryType.OFFICIAL]}</option>
                            )}
                          </select>
                          
                          <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                              {newMember.photoUrl ? (
                                <img src={newMember.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Camera className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all block text-center border border-slate-200">
                                {newMember.photoUrl ? "Ganti Foto Anggota" : "Unggah Foto Anggota"}
                                <input type="file" accept="image/*" onChange={(e) => handlePhotoChange(e, true)} className="hidden" />
                              </label>
                            </div>
                          </div>

                          <button 
                            type="button" 
                            onClick={() => {
                              if (!newMember.name || !newMember.category) {
                                toast.error("Isi nama dan kategori");
                                return;
                              }
                              if (newMember.category !== 'OFFICIAL') {
                                const quota = getCategoryQuota(newMember.category);
                                if (quota !== undefined && quota !== null && quota > 0) {
                                  const simulatedCount = getSimulatedCountForCategory(newMember.category);
                                  if (simulatedCount >= quota) {
                                    toast.error(`Kategori ${CATEGORY_LABELS[newMember.category as CategoryType] || newMember.category} sudah penuh (maksimal ${quota} pemanah).`);
                                    return;
                                  }
                                }
                              }
                              setCollectiveMembers([...collectiveMembers, { ...newMember }]);
                              setNewMember({ name: '', category: '', photoUrl: '' });
                            }}
                            className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px]"
                          >
                            TAMBAH KE DAFTAR
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  type="submit" 
                  disabled={isRegistrationClosed || (regMode === 'COLLECTIVE' && collectiveMembers.length === 0)} 
                  className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 text-[10px] disabled:opacity-50 ${isRegistrationClosed ? 'bg-rose-600 hover:bg-rose-600 text-white cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-arcus-red'}`}
                >
                  {isRegistrationClosed ? 'Pendaftaran Ditutup (Batas Waktu Lewat)' : 'Lanjut ke Pembayaran'}
                </button>
              </form>
            )}

            {step === 2 && (
              <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-xl space-y-5">
                {/* Rincian Biaya Pendaftaran */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-2 relative p-4 md:p-5 space-y-3.5 rounded-2xl">
                  <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2.5">
                    <FileText className="w-4.5 h-4.5 text-slate-900" />
                    <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-wider italic">Rincian Biaya Pembayaran</h4>
                  </div>

                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {regMode === 'INDIVIDUAL' ? (
                      <div className="flex items-start justify-between text-[11px] md:text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 leading-tight">{formData.name || 'Pendaftar'}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">
                            {formData.regType === 'OFFICIAL' ? 'OFFICIAL / PANITIA' : (CATEGORY_LABELS[formData.category as CategoryType] || formData.category)}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="font-extrabold text-slate-900">
                            Rp {((formData.regType === 'OFFICIAL' ? event.settings?.officialFee : event.settings?.categoryConfigs?.[formData.category as CategoryType]?.registrationFee) || 0).toLocaleString()}
                          </p>
                          <p className="text-[8px] font-medium text-slate-500 leading-none">
                            Platform: Rp {([
                              CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                              CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                            ].includes(formData.category as CategoryType) ? globalSettings.feeKids : globalSettings.feeAdult).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      collectiveMembers.map((member, idx) => {
                        const regFee = (member.category === 'OFFICIAL' || member.category === CategoryType.OFFICIAL) 
                          ? (event.settings?.officialFee || 0) 
                          : (event.settings?.categoryConfigs?.[member.category as CategoryType]?.registrationFee || 0);
                          
                        const isKids = [
                          CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                          CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                        ].includes(member.category as CategoryType);
                        const pFee = isKids ? globalSettings.feeKids : globalSettings.feeAdult;

                        return (
                          <div key={idx} className="flex items-start justify-between text-[11px] md:text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 leading-tight">{member.name}</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">
                                {member.category === 'OFFICIAL' ? 'OFFICIAL / PANITIA' : (CATEGORY_LABELS[member.category as CategoryType] || member.category)}
                              </p>
                            </div>
                            <div className="text-right space-y-0.5">
                              <p className="font-extrabold text-slate-900">Rp {regFee.toLocaleString()}</p>
                              <p className="text-[8px] font-medium text-slate-500 leading-none">Platform: Rp {pFee.toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-2.5 space-y-1.5 text-[10px] md:text-xs">
                    <div className="flex justify-between items-center text-slate-500 font-bold">
                      <span>Subtotal Biaya Pendaftaran:</span>
                      <span>
                        Rp {(() => {
                          if (regMode === 'INDIVIDUAL') {
                            return ((formData.regType === 'OFFICIAL' ? event.settings?.officialFee : event.settings?.categoryConfigs?.[formData.category as CategoryType]?.registrationFee) || 0).toLocaleString();
                          } else {
                            return collectiveMembers.reduce((sum, member) => {
                              const regFee = (member.category === 'OFFICIAL' || member.category === CategoryType.OFFICIAL) 
                                ? (event.settings?.officialFee || 0) 
                                : (event.settings?.categoryConfigs?.[member.category as CategoryType]?.registrationFee || 0);
                              return sum + regFee;
                            }, 0).toLocaleString();
                          }
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 font-bold">
                      <span>Subtotal Biaya Platform:</span>
                      <span>
                        Rp {(() => {
                          if (regMode === 'INDIVIDUAL') {
                            const isKids = [
                              CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                              CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                            ].includes(formData.category as CategoryType);
                            return (isKids ? globalSettings.feeKids : globalSettings.feeAdult).toLocaleString();
                          } else {
                            return collectiveMembers.reduce((sum, member) => {
                              const isKids = [
                                CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                                CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                              ].includes(member.category as CategoryType);
                              const pFee = isKids ? globalSettings.feeKids : globalSettings.feeAdult;
                              return sum + pFee;
                            }, 0).toLocaleString();
                          }
                        })()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-slate-900">
                      <span className="font-extrabold uppercase text-[9px] md:text-[10px] tracking-wide">TOTAL YANG HARUS DIBAYAR:</span>
                      <span className="font-black text-xs md:text-sm text-arcus-red font-mono italic">
                        Rp {(() => {
                          let regTotal = 0;
                          let platTotal = 0;
                          if (regMode === 'INDIVIDUAL') {
                            regTotal = (formData.regType === 'OFFICIAL' ? event.settings?.officialFee : event.settings?.categoryConfigs?.[formData.category as CategoryType]?.registrationFee) || 0;
                            const isKids = [
                              CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                              CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                            ].includes(formData.category as CategoryType);
                            platTotal = isKids ? globalSettings.feeKids : globalSettings.feeAdult;
                          } else {
                            regTotal = collectiveMembers.reduce((sum, member) => {
                              const regFee = (member.category === 'OFFICIAL' || member.category === CategoryType.OFFICIAL) 
                                ? (event.settings?.officialFee || 0) 
                                : (event.settings?.categoryConfigs?.[member.category as CategoryType]?.registrationFee || 0);
                              return sum + regFee;
                            }, 0);
                            platTotal = collectiveMembers.reduce((sum, member) => {
                              const isKids = [
                                CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                                CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                              ].includes(member.category as CategoryType);
                              return sum + (isKids ? globalSettings.feeKids : globalSettings.feeAdult);
                            }, 0);
                          }
                          return (regTotal + platTotal).toLocaleString();
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {isGatewayEnabled ? (
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setFormData({...formData, paymentType: 'MANUAL'})} className={`flex-1 py-2.5 rounded-lg font-black text-[9px] transition-all ${formData.paymentType === 'MANUAL' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>TRANSFER MANUAL</button>
                    <button onClick={() => setFormData({...formData, paymentType: 'GATEWAY'})} className={`flex-1 py-2.5 rounded-lg font-black text-[9px] transition-all ${formData.paymentType === 'GATEWAY' ? 'bg-arcus-red text-white shadow-md' : 'text-slate-400'}`}>PAYMENT GATEWAY</button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-2">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <p className="text-[10px] font-black text-slate-900 uppercase italic">Pembayaran via Transfer Bank</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">Pembayaran instan sedang tidak aktif untuk turnamen ini</p>
                  </div>
                )}

                {formData.paymentType === 'MANUAL' ? (
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-slate-950 rounded-2xl text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-10"><Landmark className="w-10 h-10" /></div>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{activeMethod.provider}</p>
                      <p className="text-xl md:text-2xl font-black font-mono text-arcus-red my-0.5 tracking-widest italic">{activeMethod.accountNumber}</p>
                      <p className="text-[8px] font-bold text-white/30 uppercase italic leading-none">A/N {activeMethod.accountName}</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase italic">Upload Bukti Transfer</p>
                        <p className="text-[6px] font-bold text-slate-300 uppercase italic">Otomatis Dikompresi</p>
                      </div>
                      <div className="relative group">
                        <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className={`p-4 border-2 border-dashed rounded-xl transition-all flex flex-col items-center gap-1.5 ${formData.paymentProof ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                          {formData.paymentProof ? (
                            <>
                              <div className="p-1.5 bg-emerald-500 rounded-full text-white"><Check className="w-3 h-3" /></div>
                              <p className="text-[9px] font-black text-emerald-600 uppercase">Bukti Terpilih</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-slate-300" />
                              <p className="text-[9px] font-black text-slate-400 uppercase">Klik/Drag Bukti Transfer</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-950 rounded-2xl text-center space-y-2.5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-arcus-red/10 to-transparent" />
                    <Zap className="w-8 h-8 text-arcus-red mx-auto animate-pulse relative z-10" />
                    <h3 className="text-lg font-black text-white uppercase italic relative z-10">Pembayaran Instan</h3>
                    <p className="text-white/40 text-[9px] italic relative z-10 tracking-tight">Portal pembayaran aman Midtrans.</p>
                  </div>
                )}

                <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <input type="checkbox" id="terms" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-arcus-red focus:ring-arcus-red transition-all cursor-pointer" />
                  <label htmlFor="terms" className="text-[8.5px] text-slate-500 italic leading-snug cursor-pointer select-none">
                    Saya menyatakan data benar dan menyetujui seluruh <strong>Syarat & Ketentuan</strong> Arcus Archery.
                  </label>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="px-5 py-3.5 bg-slate-50 text-slate-400 rounded-xl font-black uppercase text-[10px] hover:bg-slate-100 transition-all">Kembali</button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || isRegistrationClosed} 
                    className={`flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] transition-all shadow-lg active:scale-95 disabled:opacity-50 ${isRegistrationClosed ? 'bg-rose-600 hover:bg-rose-600 text-white cursor-not-allowed' : 'bg-arcus-red text-white hover:bg-red-600'}`}
                  >
                    {isSubmitting ? 'Memproses...' : isRegistrationClosed ? 'Batas Waktu Lewat' : 'Proses Pendaftaran'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {activePaymentSession && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-6 md:p-8 space-y-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
                <CreditCard className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-xl font-black font-oswald uppercase italic tracking-tight text-slate-900">Portal Pembayaran Aman</h3>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Midtrans Gateway</p>
            </div>

            {/* Total Amount to Pay */}
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-center space-y-1.5 shadow-sm">
              <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest">TOTAL YANG HARUS DIBAYAR</span>
              <p className="text-3xl font-black font-oswald text-rose-600 italic leading-none">
                Rp {activePaymentSession.registrations.reduce((sum, r) => sum + (r.totalPaid || 0), 0).toLocaleString()}
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-700 uppercase">Deteksi Sandbox / Sandbox Iframe</p>
                  <p className="text-[9px] font-medium text-slate-500 leading-normal">
                    Karena keterbatasan iFrame browser pada layar preview sandbox, popup Midtrans Snap dapat terhalang muat secara langsung. 
                    Klik tombol di bawah ini untuk membuka halaman pembayaran resmi secara mandiri.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">ORDER ID:</span>
                <span className="font-extrabold text-slate-900">{activePaymentSession.orderId}</span>
              </div>
            </div>

            {/* Action Buttons – Multi-routing for Sandbox/WebView Iframe compatibility */}
            {activePaymentSession.redirectUrl && (
              <div className="space-y-2.5">
                {/* Method 1: Open in New Tab (Target Blank) */}
                <a 
                  href={activePaymentSession.redirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase text-[11px] transition-all shadow-lg shadow-rose-600/20 group cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  <span>Metode 1: Buka di Tab Baru</span>
                </a>

                {/* Method 2: Same Window Redirect (Absolute Bypass for Popup Blockers) */}
                <button
                  onClick={() => {
                    toast.loading("Mengalihkan ke portal pembayaran Midtrans...");
                    setTimeout(() => {
                      window.location.href = activePaymentSession.redirectUrl;
                    }, 500);
                  }}
                  className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-[11px] transition-all shadow-md group cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>Metode 2: Buka di Layar Ini (Rekomendasi HP)</span>
                </button>

                {/* Method 3: Copy URL manually */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activePaymentSession.redirectUrl);
                    toast.success("Link pembayaran disalin! Silakan tempel (paste) di browser Anda.");
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold uppercase text-[10px] transition-all cursor-pointer"
                >
                  <span>Salin Link Pembayaran</span>
                </button>
              </div>
            )}

            {/* Simulated Block Check Status */}
            <div className="space-y-3 pt-2 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-wider animate-pulse">Menghubungkan & Memantau Status...</span>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => checkPaymentStatus(false)}
                  disabled={isCheckingPayment}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl font-black uppercase text-[10px] transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingPayment ? 'animate-spin' : ''}`} />
                  {isCheckingPayment ? 'Memperbarui...' : 'Cek Status'}
                </button>

                <button 
                  onClick={async () => {
                    try {
                      setIsCheckingPayment(true);
                      const approvedRegs = activePaymentSession.registrations.map(r => ({
                        ...r,
                        status: RegistrationStatus.APPROVED,
                        paymentId: activePaymentSession.orderId
                      }));
                      await onRegister(approvedRegs);
                      setActivePaymentSession(null);
                      setStep(3);
                      toast.success("Simulasi Sukses: Pendaftaran telah disetujui!");
                    } catch (e) {
                      toast.error("Gagal melakukan simulasi pembayaran.");
                    } finally {
                      setIsCheckingPayment(false);
                    }
                  }}
                  className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 rounded-xl font-black uppercase text-[10px] transition-all"
                >
                  Simulasikan Sukses
                </button>
              </div>
            </div>

            {/* Cancel Button */}
            <div className="text-center pt-2">
              <button 
                onClick={() => {
                  setActivePaymentSession(null);
                  setIsSubmitting(false);
                }} 
                className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Batal & Kembali ke Pendaftaran
              </button>
            </div>

          </div>
        </div>
      )}

      {isSimulatingPayment && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center space-y-6 shadow-2xl">
            <h3 className="text-2xl font-black font-oswald italic">SIMULASI PEMBAYARAN</h3>
            <img src={simulatedQR || ""} alt="QR" className="w-48 h-48 mx-auto border-4 border-slate-100 rounded-2xl" />
                  <button 
                    onClick={async () => {
                      try {
                        const evName = event.settings?.tournamentName || "Kejuaraan Panahan Tradisional";
                        const wordsList = evName.trim().split(/\s+/);
                        const abbrevPattern = wordsList
                          .map(word => {
                            const clean = word.replace(/[^a-zA-Z0-9]/g, '');
                            return clean ? clean[0].toUpperCase() : '';
                          })
                          .join('') || "ARC";
                        const simBaseCount = event.registrations?.length || 0;
                        const orderNum = simBaseCount + 1;
                        const simRegistrationNo = `${abbrevPattern}-${orderNum.toString().padStart(3, '0')}`;

                        const newReg = { 
                          id: 'sim_' + Date.now(), 
                          registrationNo: simRegistrationNo, 
                          name: formData.name || 'SIMULASI USER', 
                          email: formData.email, 
                          club: formData.club, 
                          category: formData.category || 'UMUM', 
                          totalPaid: 0, 
                          platformFee: 0, 
                          status: RegistrationStatus.APPROVED, 
                          paymentType: 'GATEWAY' as const, 
                          timestamp: Date.now() 
                        };
                        await completeSimulation(newReg);
                      } catch (e) {
                        toast.error("Gagal simpan simulasi");
                      }
                    }} 
                    className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase"
                  >
                    Berhasil (Mock)
                  </button>
            <button onClick={() => setIsSimulatingPayment(false)} className="text-slate-400 text-xs font-bold uppercase">Batal</button>
          </div>
        </div>
      )}

      {showInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto no-print animate-in fade-in duration-300">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              body > * {
                display: none !important;
              }
              #printable-invoice-container {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                padding: 24px !important;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}} />
          <div id="printable-invoice-container" className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-6 md:p-8 space-y-6 relative border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-5 gap-4">
              <div>
                <h2 className="text-xl font-black font-oswald text-slate-900 italic tracking-wide uppercase">ARCUS ARCHERY</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REGISTRATION INVOICE</p>
              </div>
              <div className="text-left md:text-right text-xs">
                <p className="font-extrabold text-slate-800">
                  No. Invoice: <span className="font-mono text-arcus-red italic">{recentRegistrations[0]?.registrationNo || `INV-${Date.now().toString().slice(-6)}`}</span>
                </p>
                <p className="text-[10px] font-bold text-slate-400">
                  Tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Tournament Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/50 text-xs">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Turnamen / Event</p>
                <p className="font-extrabold text-slate-800 uppercase leading-tight">{event.settings?.tournamentName || 'Turnamen Panahan Arcus'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Kontak Pembayar</p>
                <p className="font-extrabold text-slate-800">{formData.name || 'Pendaftar'} ({formData.club || 'Umum'})</p>
                <p className="text-[10px] font-bold text-slate-500 leading-none">{formData.phone || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Metode Pembayaran</p>
                <p className="font-extrabold text-slate-800">
                  {formData.paymentType === 'GATEWAY' ? 'Payment Gateway (Midtrans)' : 'Transfer Bank Manual'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Status Pembayaran</p>
                {(() => {
                  const sampleStatus = recentRegistrations[0]?.status || RegistrationStatus.PENDING;
                  const isPaid = sampleStatus === RegistrationStatus.APPROVED || sampleStatus === 'PAID';
                  return (
                    <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {isPaid ? 'LUNAS / DISETUJUI' : 'MENUNGGU VERIFIKASI / PENDING'}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Rincian Komponen Pendaftar</p>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-[10px] uppercase">
                      <th className="p-3">Nama</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3 text-right">Biaya Registrasi</th>
                      <th className="p-3 text-right">Biaya Platform</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const items = recentRegistrations.length > 0 
                        ? recentRegistrations 
                        : (regMode === 'INDIVIDUAL' 
                            ? [{
                                id: 'temp_inv',
                                name: formData.name || 'Pendaftar',
                                category: formData.regType === 'OFFICIAL' ? 'OFFICIAL' : formData.category,
                                club: formData.club || '-',
                                totalPaid: ((formData.regType === 'OFFICIAL' ? event.settings?.officialFee : event.settings?.categoryConfigs?.[formData.category as CategoryType]?.registrationFee) || 0) + ([
                                  CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                                  CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                                ].includes(formData.category as CategoryType) ? globalSettings.feeKids : globalSettings.feeAdult),
                                platformFee: [
                                  CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                                  CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                                ].includes(formData.category as CategoryType) ? globalSettings.feeKids : globalSettings.feeAdult,
                                status: formData.paymentType === 'GATEWAY' ? RegistrationStatus.APPROVED : RegistrationStatus.PENDING,
                                paymentType: formData.paymentType,
                                timestamp: Date.now()
                              }]
                            : collectiveMembers.map((m, idx) => {
                                const regFee = (m.category === 'OFFICIAL' || m.category === CategoryType.OFFICIAL) 
                                  ? (event.settings?.officialFee || 0) 
                                  : (event.settings?.categoryConfigs?.[m.category as CategoryType]?.registrationFee || 0);
                                const isKids = [
                                  CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                                  CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                                ].includes(m.category as CategoryType);
                                const pFee = isKids ? globalSettings.feeKids : globalSettings.feeAdult;
                                return {
                                  id: `temp_inv_${idx}`,
                                  name: m.name,
                                  category: m.category,
                                  club: formData.club || '-',
                                  totalPaid: regFee + pFee,
                                  platformFee: pFee,
                                  status: formData.paymentType === 'GATEWAY' ? RegistrationStatus.APPROVED : RegistrationStatus.PENDING,
                                  paymentType: formData.paymentType,
                                  timestamp: Date.now()
                                };
                              })
                          );

                      return items.map((item, idx) => {
                        const baseFee = item.totalPaid - (item.platformFee || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">{item.name}</td>
                            <td className="p-3 text-slate-400 font-extrabold uppercase text-[9px] tracking-wide">
                              {item.category === 'OFFICIAL' ? 'OFFICIAL / PANITIA' : (CATEGORY_LABELS[item.category as CategoryType] || item.category)}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-600">Rp {baseFee.toLocaleString()}</td>
                            <td className="p-3 text-right font-medium text-slate-500">Rp {(item.platformFee || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-extrabold text-slate-900">Rp {item.totalPaid.toLocaleString()}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Calculation */}
            <div className="border-t border-dashed border-slate-200 pt-4 flex flex-col items-end text-xs space-y-1">
              <div className="flex justify-between w-full max-w-xs text-slate-500 font-semibold">
                <span>Subtotal Biaya Pendaftaran:</span>
                <span>
                  Rp {(() => {
                    if (regMode === 'INDIVIDUAL') {
                      return ((formData.regType === 'OFFICIAL' ? event.settings?.officialFee : event.settings?.categoryConfigs?.[formData.category as CategoryType]?.registrationFee) || 0).toLocaleString();
                    } else {
                      return collectiveMembers.reduce((sum, member) => {
                        const regFee = (member.category === 'OFFICIAL' || member.category === CategoryType.OFFICIAL) 
                          ? (event.settings?.officialFee || 0) 
                          : (event.settings?.categoryConfigs?.[member.category as CategoryType]?.registrationFee || 0);
                        return sum + regFee;
                      }, 0).toLocaleString();
                    }
                  })()}
                </span>
              </div>
              <div className="flex justify-between w-full max-w-xs text-slate-500 font-semibold">
                <span>Subtotal Biaya Platform:</span>
                <span>
                  Rp {(() => {
                    if (regMode === 'INDIVIDUAL') {
                      const isKids = [
                        CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                        CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                      ].includes(formData.category as CategoryType);
                      return (isKids ? globalSettings.feeKids : globalSettings.feeAdult).toLocaleString();
                    } else {
                      return collectiveMembers.reduce((sum, member) => {
                        const isKids = [
                          CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                          CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                        ].includes(member.category as CategoryType);
                        const pFee = isKids ? globalSettings.feeKids : globalSettings.feeAdult;
                        return sum + pFee;
                      }, 0).toLocaleString();
                    }
                  })()}
                </span>
              </div>
              <div className="flex justify-between w-full max-w-xs border-t border-slate-200 pt-2 text-slate-900 font-black">
                <span className="uppercase text-[9px] tracking-wide">TOTAL PEMBAYARAN:</span>
                <span className="text-arcus-red text-sm font-mono italic">
                  Rp {(() => {
                    let regTotal = 0;
                    let platTotal = 0;
                    if (regMode === 'INDIVIDUAL') {
                      regTotal = (formData.regType === 'OFFICIAL' ? event.settings?.officialFee : event.settings?.categoryConfigs?.[formData.category as CategoryType]?.registrationFee) || 0;
                      const isKids = [
                        CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                        CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                      ].includes(formData.category as CategoryType);
                      platTotal = isKids ? globalSettings.feeKids : globalSettings.feeAdult;
                    } else {
                      regTotal = collectiveMembers.reduce((sum, member) => {
                        const regFee = (member.category === 'OFFICIAL' || member.category === CategoryType.OFFICIAL) 
                          ? (event.settings?.officialFee || 0) 
                          : (event.settings?.categoryConfigs?.[member.category as CategoryType]?.registrationFee || 0);
                        return sum + regFee;
                      }, 0);
                      platTotal = collectiveMembers.reduce((sum, member) => {
                        const isKids = [
                          CategoryType.U18_PUTRA, CategoryType.U18_PUTRI, CategoryType.U12_PUTRA,
                          CategoryType.U12_PUTRI, CategoryType.U9_PUTRA, CategoryType.U9_PUTRI,
                        ].includes(member.category as CategoryType);
                        return sum + (isKids ? globalSettings.feeKids : globalSettings.feeAdult);
                      }, 0);
                    }
                    return (regTotal + platTotal).toLocaleString();
                  })()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 justify-end border-t border-slate-100 pt-5 no-print">
              <button 
                onClick={() => setShowInvoice(false)} 
                className="px-5 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold uppercase text-[10px] hover:bg-slate-200 transition-all"
              >
                Tutup
              </button>
              <button 
                onClick={() => window.print()} 
                className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] hover:bg-arcus-red transition-all flex items-center gap-2 shadow-lg animate-pulse"
              >
                <Printer className="w-3.5 h-3.5" /> CETAK / SIMPAN BUKTI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
