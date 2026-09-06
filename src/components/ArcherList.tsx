import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  ArrowLeft,
  Shuffle,
  Loader2,
  QrCode,
  X,
  Check,
  FileDown,
  FileSpreadsheet,
  Plus,
  UserPlus,
  Printer,
  Image as ImageIcon,
  RefreshCw,
  Cloud,
  Camera,
  Barcode as BarcodeIcon,
  UserCheck,
  CheckCircle2,
  XCircle,
  ScanLine,
  Layers,
  Sparkles,
  Pencil,
  AlertCircle
} from "lucide-react";
import {
  Archer,
  CategoryType,
  TournamentSettings,
  GlobalSettings,
  RegistrationStatus,
  ArcheryEvent
} from "../types";
import { CATEGORY_LABELS } from "../constants";
import { compressPhoto, uploadPhotoToStorage } from "../lib/photoService";
import { exportToExcel, exportToCSV } from "../lib/excelHelper";
import ScoringSheet from "./ScoringSheet";
import ParticipantScannerModal from "./ParticipantScannerModal";
import AutoTargetAllocationModal from "./AutoTargetAllocationModal";
import ArcherImportModal from "./ArcherImportModal";
import ArcherEditModal from "./ArcherEditModal";

interface Props {
  archers: Archer[];
  onAdd: (archer: Archer) => void;
  onUpdate: (archer: Archer) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onBulkUpdate: (updated: Archer[]) => void;
  onBulkAdd?: (newArchers: Archer[]) => Promise<void> | void;
  onGoToIdCardEditor: () => void;
  onRefreshData?: () => void;
  onPushToCloud?: () => void;
  isPushing?: boolean;
  archersPerTarget: number;
  totalTargets: number;
  settings: TournamentSettings;
  eventId: string;
  globalSettings: GlobalSettings;
}

const ArcherList: React.FC<Props> = ({
  archers,
  onAdd,
  onUpdate,
  onRemove,
  onBack,
  onBulkUpdate,
  onBulkAdd,
  onGoToIdCardEditor,
  onRefreshData,
  onPushToCloud,
  isPushing,
  archersPerTarget,
  totalTargets,
  settings,
  eventId,
  globalSettings,
}) => {
  const [isShuffling, setIsShuffling] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryType | "ALL">(
    "ALL",
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printArcherId, setPrintArcherId] = useState<string | "ALL" | null>(
    null,
  );
  const [filterWave, setFilterWave] = useState<number | "ALL">("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [filterCheckIn, setFilterCheckIn] = useState<"ALL" | "CHECKED_IN" | "NOT_CHECKED_IN">("ALL");
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [editingArcher, setEditingArcher] = useState<Archer | null>(null);
  const [archerToDelete, setArcherToDelete] = useState<Archer | null>(null);
  const [isDeletingParticipant, setIsDeletingParticipant] = useState(false);
  const [showAutoAllocationModal, setShowAutoAllocationModal] = useState(false);
  const [initialScanQuery, setInitialScanQuery] = useState("");
  const [printAllCategories, setPrintAllCategories] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [scoringSheetSize, setScoringSheetSize] = useState<'A4' | 'A6'>('A4');
  const [showScoringSheetOptions, setShowScoringSheetOptions] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [newArcher, setNewArcher] = useState({
    name: "",
    ktaNumber: "",
    email: "",
    phone: "",
    club: "",
    category: CategoryType.ADULT_PUTRA,
    targetNo: 1,
    position: "A" as "A" | "B" | "C" | "D",
    wave: 1,
    photoUrl: "",
  });

  const handleManualPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        } catch (stErr) {
          console.warn("Storage upload failed, using secure base64 local fallback:", stErr);
          toast.success("Foto diproses secara lokal");
        }

        setNewArcher(prev => ({ ...prev, photoUrl: finalUrl }));
      } catch (err: any) {
        toast.error("Gagal memproses foto: " + err.message);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArcher.name || !newArcher.club) return;

    if (Boolean(settings?.requireKta) && !newArcher.ktaNumber.trim()) {
      alert("Nomor KTA wajib diisi karena turnamen ini diatur sebagai Event Resmi (Wajib KTA).");
      return;
    }

    const isKids = [
      CategoryType.U18_PUTRA,
      CategoryType.U18_PUTRI,
      CategoryType.U12_PUTRA,
      CategoryType.U12_PUTRI,
      CategoryType.U9_PUTRA,
      CategoryType.U9_PUTRI,
    ].includes(newArcher.category);
    const platformFee = isKids
      ? globalSettings.feeKids
      : globalSettings.feeAdult;

    const eventName = settings?.tournamentName || "Kejuaraan Panahan Tradisional";
    const words = eventName.trim().split(/\s+/);
    const abbreviation = words
      .map(word => {
        const clean = word.replace(/[^a-zA-Z0-9]/g, '');
        return clean ? clean[0].toUpperCase() : '';
      })
      .join('') || "ARC";
    const orderNum = archers.length + 1;
    const registrationNo = `${abbreviation}-${orderNum.toString().padStart(3, '0')}`;

    const archer: Archer = {
      id: "m-arc-" + Math.random().toString(36).substr(2, 9),
      eventId: "", // Will be handled by parent if needed, but App.tsx just spreads it
      registrationNo: registrationNo,
      name: newArcher.name,
      ktaNumber: newArcher.ktaNumber.trim() ? newArcher.ktaNumber.trim().toUpperCase() : undefined,
      email: newArcher.email || "-",
      club: newArcher.club,
      category: newArcher.category,
      phone: newArcher.phone || "-",
      status: RegistrationStatus.APPROVED,
      paymentType: "MANUAL",
      photoUrl: newArcher.photoUrl || undefined,
      platformFee: platformFee,
      totalPaid: 0,
      createdAt: Date.now(),
      targetNo: newArcher.targetNo,
      position: newArcher.position,
      wave: newArcher.wave,
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
    };

    onAdd(archer);
    setShowAddForm(false);
    setNewArcher({
      name: "",
      ktaNumber: "",
      email: "",
      phone: "",
      club: "",
      category: CategoryType.ADULT_PUTRA,
      targetNo: 1,
      position: "A",
      wave: 1,
      photoUrl: "",
    });
  };

  const handleSmartRandomize = () => {
    const isAll = (activeCategory as any) === "ALL";
    const categoryArchers = isAll ? [...archers] : archers.filter(
      (a) => a.category === activeCategory,
    );
    
    if (categoryArchers.length === 0) {
      alert("Tidak ada peserta yang bisa diacak.");
      return;
    }

    const effectiveArchersPerTarget = Number(archersPerTarget) || 4;
    const effectiveTotalTargets = Number(totalTargets) || 20;

    const categoryLabel = (activeCategory as any) === "ALL" ? "SEMUA KATEGORI" : CATEGORY_LABELS[activeCategory];
    if (
      !confirm(
        `Sistem akan mengacak posisi pemanah untuk ${categoryLabel} dan menyusun nomor bantalan secara otomatis (Kapasitas: ${effectiveTotalTargets} Bantalan x ${effectiveArchersPerTarget} Pemanah). Lanjutkan?`,
      )
    )
      return;

    setIsShuffling(true);
    const shuffleToastId = toast.loading(`Mengacak ${categoryArchers.length} peserta...`);

    setTimeout(() => {
      try {
        console.log(`Starting shuffle for: ${categoryLabel}. Archers to shuffle:`, categoryArchers.map(a => a.name));
        
        // Use a high-quality shuffle
        const shuffled = [...categoryArchers];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const archersPerWave = effectiveTotalTargets * effectiveArchersPerTarget;
        
        const updatedCategoryArchers = shuffled.map((a, index) => {
          const wave = Math.floor(index / archersPerWave) + 1;
          const indexInWave = index % archersPerWave;
          const targetNo = Math.floor(indexInWave / effectiveArchersPerTarget) + 1;
          const posIndex = indexInWave % effectiveArchersPerTarget;
          const position = ["A", "B", "C", "D"][posIndex] as "A" | "B" | "C" | "D";

          console.log(`Assigning ${a.name} to ${targetNo}${position}`);
          return { ...a, targetNo, position, wave };
        });

        if ((activeCategory as any) === "ALL") {
          // If in "ALL" tab, we still need to preserve OFFICIALS if they were excluded from shuffle
          const officials = archers.filter(a => a.category === CategoryType.OFFICIAL);
          onBulkUpdate([...updatedCategoryArchers, ...officials]);
        } else {
          const otherArchers = archers.filter((a) => a.category !== activeCategory);
          console.log(`Updating ${updatedCategoryArchers.length} archers. Keeping ${otherArchers.length} from other categories.`);
          onBulkUpdate([...otherArchers, ...updatedCategoryArchers]);
        }
        
        toast.success(`Berhasil mengacak ${updatedCategoryArchers.length} peserta!`, { id: shuffleToastId });
      } catch (err: any) {
        console.error("Shuffle Error:", err);
        toast.error("Gagal mengacak bantalan: " + err.message, { id: shuffleToastId });
      } finally {
        setIsShuffling(false);
      }
    }, 500); // Reduced delay for better UX
  };

  const [isPrintingList, setIsPrintingList] = useState(false);

  useEffect(() => {
    if (isPrintingList || printArcherId) {
      document.body.classList.add("printing-active");
    } else {
      document.body.classList.remove("printing-active");
    }
    return () => {
      document.body.classList.remove("printing-active");
    };
  }, [isPrintingList, printArcherId]);

  const handlePrint = (all: boolean = false) => {
    setPrintAllCategories(all);
    setIsPrintingList(true);
    setTimeout(() => {
      window.print();
      setPrintAllCategories(false);
      setIsPrintingList(false);
    }, 100);
  };

  const handlePrintScoringSheet = (id: string | "ALL") => {
    setPrintArcherId(id);
    setTimeout(() => {
      window.print();
      setPrintArcherId(null);
    }, 500);
  };

  const getExportData = () => {
    const dataToExport = filtered;
    if (dataToExport.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return null;
    }

    const tournamentName = settings.tournamentName || "TURNAMEN PANAHAN RESMI";
    const location = settings.location || "-";
    const eventDate = settings.eventDate 
      ? new Date(settings.eventDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
      : "-";
    const categoryLabel = (activeCategory as any) === "ALL" 
      ? "SEMUA KATEGORI" 
      : (CATEGORY_LABELS[activeCategory as CategoryType] || activeCategory);
    const exportTime = new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const metadata = [
      { label: "Nama Turnamen:", value: tournamentName },
      { label: "Lokasi / Venue:", value: location },
      { label: "Tanggal Pelaksanaan:", value: eventDate },
      { label: "Kategori Lomba:", value: categoryLabel },
      { label: "Waktu Unduh / Ekspor:", value: `${exportTime} WIB` },
      { label: "Total Peserta Diekspor:", value: `${dataToExport.length} Peserta` },
    ];

    const headers = [
      "No",
      "Nama Lengkap Peserta",
      "No KTA",
      "Klub / Kontingen / Sekolah",
      "Kategori",
      "Nomor Bantalan",
      "Posisi Bantalan",
      "Gelombang (Wave)",
      "PIN Akses Scorer",
      "Email Peserta",
      "Nomor WhatsApp / HP",
      "Status Registrasi"
    ];

    const rows = dataToExport.map((a, index) => {
      const catName = CATEGORY_LABELS[a.category as CategoryType] || a.category || "-";
      return [
        index + 1,
        a.name || "",
        a.ktaNumber || "-",
        a.club || "-",
        catName,
        a.targetNo || "-",
        a.position || "-",
        a.wave || "-",
        a.pin || "-",
        a.email || "-",
        a.phone || "-",
        a.status || "APPROVED"
      ];
    });

    const safeBaseFileName = `Data_Peserta_${tournamentName.replace(/[^a-zA-Z0-9]/g, '_')}_${categoryLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}`;

    return {
      title: "DOKUMEN RESMI TURNAMEN PANAHAN - DATA MASTER REGISTRASI PESERTA",
      metadata,
      headers,
      rows,
      safeBaseFileName,
      count: dataToExport.length
    };
  };

  const handleExportExcel = () => {
    try {
      const exportPayload = getExportData();
      if (!exportPayload) return;

      exportToExcel({
        fileName: exportPayload.safeBaseFileName,
        sheetName: "Data Peserta",
        title: exportPayload.title,
        metadata: exportPayload.metadata,
        headers: exportPayload.headers,
        rows: exportPayload.rows
      });

      toast.success(`Berhasil mengunduh Excel (.xlsx) dengan ${exportPayload.count} data peserta dalam format tabel terpisah!`);
    } catch (err: any) {
      toast.error("Gagal mengekspor Excel: " + err.message);
    }
  };

  const handleExportCSV = () => {
    try {
      const exportPayload = getExportData();
      if (!exportPayload) return;

      exportToCSV({
        fileName: exportPayload.safeBaseFileName,
        title: exportPayload.title,
        metadata: exportPayload.metadata,
        headers: exportPayload.headers,
        rows: exportPayload.rows
      });

      toast.success(`Berhasil mengunduh CSV dengan ${exportPayload.count} data peserta!`);
    } catch (err: any) {
      toast.error("Gagal mengekspor CSV: " + err.message);
    }
  };

  const clubs = useMemo(() => {
    const uniqueClubs = Array.from(new Set(archers.map((a) => a.club))).sort();
    return ["ALL", ...uniqueClubs];
  }, [archers]);

  const filtered = useMemo(() => {
    return (archers || [])
      .filter((a) => {
        if (!a) return false;
        const search = (searchTerm || "").toLowerCase();
        const matchesSearch =
          (a.name || "").toLowerCase().includes(search) ||
          (a.ktaNumber || "").toLowerCase().includes(search) ||
          (a.club || "").toLowerCase().includes(search) ||
          (a.registrationNo || "").toLowerCase().includes(search) ||
          (a.id || "").toLowerCase().includes(search) ||
          (String(a.targetNo || "") + String(a.position || "")).toLowerCase().includes(search);

        const matchesCategory =
        (activeCategory as any) === "ALL" || a.category === activeCategory;
        const matchesWave = filterWave === "ALL" || a.wave === filterWave;
        const matchesClub = filterClub === "ALL" || a.club === filterClub;
        const matchesCheckIn = 
          filterCheckIn === "ALL" || 
          (filterCheckIn === "CHECKED_IN" && a.checkedIn) || 
          (filterCheckIn === "NOT_CHECKED_IN" && !a.checkedIn);

        return matchesSearch && matchesCategory && matchesWave && matchesClub && matchesCheckIn;
      })
      .sort((a: Archer, b: Archer) => {
        const wA = a.wave || 1;
        const wB = b.wave || 1;
        if (wA !== wB) return wA - wB;

        const tA = (a.targetNo === 0 || a.targetNo === undefined) ? 9999 : a.targetNo;
        const tB = (b.targetNo === 0 || b.targetNo === undefined) ? 9999 : b.targetNo;
        if (tA !== tB) return tA - tB;

        return (a.position || "").localeCompare(b.position || "");
      });
  }, [archers, activeCategory, searchTerm, filterWave, filterClub, filterCheckIn]);

  return (
    <div className="space-y-6">
      <div className="bg-[#FBFBFD] p-4 sm:p-5 rounded-3xl border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:bg-slate-50 transition-all active:scale-95"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-black font-oswald uppercase italic tracking-tighter text-slate-900">
              Manajemen Peserta
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                Total: {archers.length} Archer
              </p>
              {searchTerm && (
                <p className="text-[10px] font-black text-arcus-red uppercase tracking-widest">
                  • Filtered: {filtered.length}
                </p>
              )}
            </div>
          </div>
          {onRefreshData && (
            <div className="flex items-center gap-1">
              <button 
                onClick={onRefreshData}
                className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-emerald-500 hover:bg-emerald-50 transition-all active:scale-90"
                title="Tarik Data dari Cloud (Pull)"
              >
                <RefreshCw className={`w-4 h-4 ${(onRefreshData as any).isSyncing ? 'animate-spin' : ''}`} />
              </button>
              {onPushToCloud && (
                <button 
                  onClick={onPushToCloud}
                  disabled={isPushing}
                  className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-blue-500 hover:bg-blue-50 transition-all active:scale-90 disabled:opacity-50"
                  title="Kirim Data ke Cloud (Push)"
                >
                  {isPushing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar - Grouped & Tidied */}
        <div className="flex flex-col items-stretch xl:items-end gap-2.5">
          {/* Baris 1: Aksi Utama Peserta (Tambah Peserta, Import Peserta, Alokasi, Acak) */}
          <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-arcus-red text-white px-4 py-2.5 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-red-700 transition-all active:scale-95 shadow-md shadow-arcus-red/25 border border-red-600"
              title="Tambah Peserta Manual"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Peserta
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-[11px] font-black flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-600/25 border border-emerald-500"
              title="Import Peserta dari File Excel (.xlsx / .xls / .csv)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import Peserta
            </button>
            <button
              onClick={() => setShowAutoAllocationModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-purple-600/20"
              title="Tata nomor bantalan otomatis dan menerus per kategori (U9 -> U12 -> U18 -> Dewasa) dengan opsi sebar klub"
            >
              <Layers className="w-3.5 h-3.5 text-purple-200" />
              Alokasi Otomatis
            </button>
            <button
              onClick={handleSmartRandomize}
              disabled={isShuffling}
              className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
              title="Acak posisi pemanah untuk kategori yang sedang aktif"
            >
              {isShuffling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Shuffle className="w-3.5 h-3.5 text-arcus-red" />
              )}
              Acak Kategori
            </button>
          </div>

          {/* Baris 2: Operasional Lapangan & Dokumen Cetak */}
          <div className="flex flex-wrap items-center justify-start xl:justify-end gap-1.5 sm:gap-2 pt-1 border-t border-slate-100 xl:border-t-0 xl:pt-0">
            <button
              onClick={() => setShowScannerModal(true)}
              className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
              title="Scan Barcode / QR Code Kehadiran"
            >
              <BarcodeIcon className="w-4 h-4" />
              Scan / Registrasi Ulang
            </button>
            <button
              onClick={onGoToIdCardEditor}
              className="bg-blue-600 text-white px-3.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
              title="Cetak & Desain Kartu Peserta"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Kartu Peserta
            </button>
            <div className="relative">
              <button
                onClick={() => setShowScoringSheetOptions(!showScoringSheetOptions)}
                className="bg-purple-100 text-purple-700 px-3.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-purple-200 transition-all active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                Scoring Sheet
              </button>
              {showScoringSheetOptions && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowScoringSheetOptions(false)}
                  ></div>
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2 space-y-3 font-sans">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase text-slate-700 tracking-wider">Ukuran & Format Cetak</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setScoringSheetSize('A4')}
                          className={`text-[9px] font-black uppercase py-1.5 rounded-lg border transition-all ${scoringSheetSize === 'A4' ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
                        >
                          📄 A4 Besar
                        </button>
                        <button
                          type="button"
                          onClick={() => setScoringSheetSize('A6')}
                          className={`text-[9px] font-black uppercase py-1.5 rounded-lg border transition-all ${scoringSheetSize === 'A6' ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
                        >
                          📑 A6 Grid A4
                        </button>
                      </div>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-2 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          handlePrintScoringSheet("ALL");
                          setShowScoringSheetOptions(false);
                        }}
                        className="w-full text-left py-2 px-3 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-between"
                      >
                        <span>Cetak Kategori Aktif ({filtered.length})</span>
                        <span className="text-[8px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-black uppercase">Mulai</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative flex items-center gap-1.5">
              <button
                onClick={() => setShowPrintOptions(!showPrintOptions)}
                className="bg-slate-100 text-slate-700 px-3.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 hover:bg-slate-200 transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Daftar
              </button>
              <button
                onClick={handleExportExcel}
                className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80 px-3.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                title="Unduh format tabel Excel (.xlsx) rapi dalam sel-sel terpisah"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Ekspor Excel
              </button>
              <button
                onClick={handleExportCSV}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all active:scale-95"
                title="Unduh format teks CSV (.csv)"
              >
                <FileDown className="w-3.5 h-3.5" />
                CSV
              </button>
              {showPrintOptions && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPrintOptions(false)}
                  ></div>
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <button
                      onClick={() => {
                        handlePrint(false);
                        setShowPrintOptions(false);
                      }}
                      className="w-full text-left px-4 py-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-50"
                    >
                      Kategori Aktif
                    </button>
                    <button
                      onClick={() => {
                        handlePrint(true);
                        setShowPrintOptions(false);
                      }}
                      className="w-full text-left px-4 py-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Semua Kategori
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 space-y-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 rounded-2xl">
                  <UserPlus className="w-6 h-6 text-arcus-red" />
                </div>
                <div>
                  <h3 className="text-2xl font-black font-oswald uppercase italic text-slate-900">
                    Tambah Peserta
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Input data pemanah manual atau import banyak sekaligus via Excel.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5">
              <button
                type="button"
                className="flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 bg-white text-slate-900 shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4 text-arcus-red" />
                Input Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setShowImportModal(true);
                }}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 text-slate-600 hover:text-emerald-700 hover:bg-white/60 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Import Peserta (Excel)
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Nama Lengkap
                  </span>
                  <input
                    type="text"
                    required
                    value={newArcher.name}
                    onChange={(e) =>
                      setNewArcher({ ...newArcher, name: e.target.value })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none focus:ring-4 ring-red-500/10 transition-all text-slate-900"
                  />
                </label>

                <label className="block">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                      Nomor KTA (Kartu Tanda Anggota) {Boolean(settings?.requireKta) && <span className="text-red-500 font-black">*</span>}
                    </span>
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      Boolean(settings?.requireKta)
                        ? 'text-red-700 bg-red-50 border-red-200 font-black'
                        : 'text-slate-500 bg-slate-100 border-slate-200'
                    }`}>
                      {Boolean(settings?.requireKta) ? 'Wajib (Event Resmi)' : 'Tidak Wajib (Opsional)'}
                    </span>
                  </div>
                  <input
                    type="text"
                    required={Boolean(settings?.requireKta)}
                    value={newArcher.ktaNumber}
                    onChange={(e) =>
                      setNewArcher({ ...newArcher, ktaNumber: e.target.value.toUpperCase() })
                    }
                    className={`mt-1 block w-full rounded-2xl border px-4 py-2.5 font-bold outline-none focus:ring-4 ring-blue-500/10 transition-all text-slate-900 placeholder:text-slate-400 placeholder:font-normal ${
                      Boolean(settings?.requireKta) && !newArcher.ktaNumber.trim() ? 'border-amber-400' : 'border-slate-200'
                    }`}
                    placeholder={Boolean(settings?.requireKta) ? "Nomor KTA wajib diisi (Contoh: KTA-2024-001)" : "Contoh: KTA-2024-001 (Bisa diabaikan / Latber)"}
                  />
                </label>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Pasfoto Peserta (ID Card)</span>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-2xl bg-slate-200 border-2 border-white overflow-hidden shadow-md flex items-center justify-center text-slate-700 shrink-0">
                      {newArcher.photoUrl ? (
                        <img src={newArcher.photoUrl} alt="Preview" className="w-full h-full object-cover" />
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
                        {newArcher.photoUrl ? "Ganti Foto" : "Unggah Foto"}
                        <input type="file" accept="image/*" onChange={handleManualPhotoChange} className="hidden" />
                      </label>
                      <p className="text-[7.5px] font-bold text-slate-700 mt-1 uppercase">Opsional. Membantu pembuatan kartu tanda pengenal.</p>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Email Archer (Opsional)
                  </span>
                  <input
                    type="email"
                    value={newArcher.email}
                    onChange={(e) =>
                      setNewArcher({ ...newArcher, email: e.target.value })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none focus:ring-4 ring-red-500/10 transition-all text-slate-900 placeholder:text-slate-700"
                    placeholder="email@archer.com"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Nomor Telepon (WA)
                  </span>
                  <input
                    type="text"
                    value={newArcher.phone}
                    onChange={(e) =>
                      setNewArcher({ ...newArcher, phone: e.target.value })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none focus:ring-4 ring-red-500/10 transition-all text-slate-900"
                    placeholder="0812..."
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Klub / Instansi
                  </span>
                  <input
                    type="text"
                    required
                    value={newArcher.club}
                    onChange={(e) =>
                      setNewArcher({ ...newArcher, club: e.target.value })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none focus:ring-4 ring-red-500/10 transition-all text-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Kategori
                  </span>
                  <select
                    value={newArcher.category}
                    onChange={(e) =>
                      setNewArcher({
                        ...newArcher,
                        category: e.target.value as CategoryType,
                      })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none focus:ring-4 ring-red-500/10 transition-all text-slate-900"
                  >
                    {(Object.keys(CategoryType) as CategoryType[])
                      .filter((cat) => cat !== CategoryType.OFFICIAL)
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Bantalan
                  </span>
                  <input
                    type="number"
                    value={newArcher.targetNo}
                    onChange={(e) =>
                      setNewArcher({
                        ...newArcher,
                        targetNo: Math.min(
                          totalTargets,
                          parseInt(e.target.value) || 1,
                        ),
                      })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none focus:ring-4 ring-red-500/10 transition-all text-slate-900"
                    min="1"
                    max={totalTargets}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Posisi
                  </span>
                  <select
                    value={newArcher.position}
                    onChange={(e) =>
                      setNewArcher({
                        ...newArcher,
                        position: e.target.value as any,
                      })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none text-slate-900"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest px-1">
                    Sesi (Wave)
                  </span>
                  <input
                    type="number"
                    value={newArcher.wave}
                    onChange={(e) =>
                      setNewArcher({
                        ...newArcher,
                        wave: parseInt(e.target.value) || 1,
                      })
                    }
                    className="mt-1 block w-full rounded-2xl border-slate-200 px-4 py-2.5 border font-bold outline-none text-slate-900 focus:ring-4 ring-red-500/10 transition-all"
                    min="1"
                  />
                </label>
              </div>

              {/* Excel Import Callout */}
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-black text-emerald-950 block">Punya Banyak Peserta?</span>
                    <span className="text-[10px] text-emerald-800">Gunakan fitur Import Peserta untuk upload puluhan / ratusan atlet sekaligus via file Excel.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setShowImportModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shrink-0 transition-all shadow-sm"
                >
                  Import Peserta
                </button>
              </div>

              <button
                type="submit"
                className="w-full bg-arcus-red text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-95 transition-all"
              >
                Simpan Peserta
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 print:hidden">
        <button
          onClick={() => setActiveCategory("ALL" as any)}
          className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
            (activeCategory as any) === "ALL"
              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
              : "bg-white border-slate-100 text-slate-900 hover:text-arcus-red hover:border-arcus-red"
          }`}
        >
          Semua Kategori
        </button>
        {(Object.keys(CategoryType) as CategoryType[])
          .filter((cat) => cat !== CategoryType.OFFICIAL)
          .map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeCategory === cat ? "bg-arcus-red border-arcus-red text-white shadow-sm" : "bg-white border-slate-100 text-slate-900 hover:text-arcus-red hover:border-arcus-red"}`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
      </div>

      {/* Printable Area (Hidden in UI, visible in Print) */}
      {isPrintingList && createPortal(
        <div className="print-area-portal bg-white p-4 min-h-screen">
          {printAllCategories ? (
            (Object.keys(CategoryType) as CategoryType[]).map((cat, idx) => {
              const catArchers = archers
                .filter((a) => a.category === cat)
                .sort((a, b) => {
                  const wA = a.wave || 1;
                  const wB = b.wave || 1;
                  if (wA !== wB) return wA - wB;
                  const tA = a.targetNo || 999;
                  const tB = b.targetNo || 999;
                  if (tA !== tB) return tA - tB;
                  return a.position.localeCompare(b.position);
                });

              if (catArchers.length === 0) return null;

              return (
                <div
                  key={cat}
                  className={idx > 0 ? "page-break-before-always mt-10" : ""}
                >
                  <div className="text-center mb-8 border-b-2 border-black pb-4">
                    <h1 className="text-2xl font-bold uppercase">
                      {settings.tournamentName}
                    </h1>
                    <h2 className="text-xl font-bold uppercase mt-1">
                      Daftar Peserta & Penempatan Bantalan
                    </h2>
                    <p className="text-lg font-bold uppercase mt-2 bg-slate-100 inline-block px-4 py-1 rounded">
                      Kategori: {CATEGORY_LABELS[cat]}
                    </p>
                  </div>

                  <table className="w-full border-collapse border border-black">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black py-2 px-1 text-[10px] font-bold uppercase w-8">
                          No
                        </th>
                        <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase w-20">
                          Bantalan
                        </th>
                        <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase">
                          Nama Pemanah
                        </th>
                        <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase w-28">
                          No KTA
                        </th>
                        <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase">
                          Klub / Kota
                        </th>
                        <th className="border border-black py-2 px-1 text-[10px] font-bold uppercase w-16">
                          Sesi
                        </th>
                        <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase w-24">
                          Tanda Tangan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {catArchers.map((a: Archer, aIdx: number) => (
                        <tr key={`${a.id || 'cat-arch'}-${aIdx}`}>
                          <td className="border border-black py-2 px-1 text-center text-[10px]">
                            {aIdx + 1}
                          </td>
                          <td className="border border-black py-1 px-1 text-center font-bold text-base">
                            {a.targetNo}
                            {a.position}
                          </td>
                          <td className="border border-black py-1 px-2 text-[11px] font-bold uppercase">
                            {a.name}
                          </td>
                          <td className="border border-black py-1 px-2 text-center text-[10px] font-mono font-bold">
                            {a.ktaNumber || "-"}
                          </td>
                          <td className="border border-black py-1 px-2 text-[10px] uppercase">
                            {a.club}
                          </td>
                          <td className="border border-black py-1 px-1 text-center text-[10px] font-bold">
                            {a.wave}
                          </td>
                          <td className="border border-black py-1 px-2 text-center text-[9px] text-slate-600 italic min-h-[30px]">
                            ....................
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-12 flex justify-between items-end">
                    <div className="text-center w-48">
                      <p className="text-[10px] mb-12">
                        Dicetak: {new Date().toLocaleDateString("id-ID")}
                      </p>
                      <div className="border-b border-black mb-1"></div>
                      <p className="font-bold uppercase text-[10px]">
                        Koordinator Lapangan
                      </p>
                    </div>
                    <div className="text-center w-48">
                      <p className="text-[10px] mb-12">
                        {settings.location || "Panitia Pelaksana"}
                      </p>
                      <div className="border-b border-black mb-1"></div>
                      <p className="font-bold uppercase text-[10px]">
                        Ketua Panitia
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div>
              <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold uppercase">
                  {settings.tournamentName}
                </h1>
                <h2 className="text-xl font-bold uppercase mt-1">
                  Daftar Peserta & Penempatan Bantalan
                </h2>
                <p className="text-lg font-bold uppercase mt-2 bg-slate-100 inline-block px-4 py-1 rounded">
                  Kategori: {CATEGORY_LABELS[activeCategory]}
                </p>
              </div>

              <table className="w-full border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black py-2 px-1 text-[10px] font-bold uppercase w-8">
                      No
                    </th>
                    <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase w-20">
                      Bantalan
                    </th>
                    <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase">
                      Nama Pemanah
                    </th>
                    <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase w-28">
                      No KTA
                    </th>
                    <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase">
                      Klub / Kota
                    </th>
                    <th className="border border-black py-2 px-1 text-[10px] font-bold uppercase w-16">
                      Sesi
                    </th>
                    <th className="border border-black py-2 px-2 text-[10px] font-bold uppercase w-24">
                      Tanda Tangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a: Archer, aIdx: number) => (
                    <tr key={`${a.id || 'arch'}-${aIdx}`}>
                      <td className="border border-black py-2 px-1 text-center text-[10px]">
                        {aIdx + 1}
                      </td>
                      <td className="border border-black py-1 px-1 text-center font-bold text-base">
                        {a.targetNo}
                        {a.position}
                      </td>
                      <td className="border border-black py-1 px-2 text-[11px] font-bold uppercase">
                        <div>{a.name}</div>
                      </td>
                      <td className="border border-black py-1 px-2 text-center text-[10px] font-mono font-bold">
                        {a.ktaNumber || "-"}
                      </td>
                      <td className="border border-black py-1 px-2 text-[10px] uppercase">
                        {a.club}
                      </td>
                      <td className="border border-black py-1 px-1 text-center text-[10px] font-bold">
                        {a.wave}
                      </td>
                      <td className="border border-black py-1 px-2 text-center text-[9px] text-slate-600 italic min-h-[30px]">
                        ....................
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-12 flex justify-between items-end">
                <div className="text-center w-48">
                  <p className="text-[10px] mb-12">
                    Dicetak: {new Date().toLocaleDateString("id-ID")}
                  </p>
                  <div className="border-b border-black mb-1"></div>
                  <p className="font-bold uppercase text-[10px]">
                    Koordinator Lapangan
                  </p>
                </div>
                <div className="text-center w-48">
                  <p className="text-[10px] mb-12">
                    {settings.location || "Panitia Pelaksana"}
                  </p>
                  <div className="border-b border-black mb-1"></div>
                  <p className="font-bold uppercase text-[10px]">Ketua Panitia</p>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Scoring Sheet Print View */}
      {printArcherId && createPortal(
        <div className="print-area-portal bg-white">
          {printArcherId === "ALL" ? (
            scoringSheetSize === 'A6' ? (
              (() => {
                // Group archers by wave and targetNo
                const groups: Record<string, Archer[]> = {};
                filtered.forEach(a => {
                  const waveKey = a.wave || 1;
                  const targetKey = a.targetNo || 999;
                  const key = `W${waveKey}_T${targetKey}`;
                  if (!groups[key]) {
                    groups[key] = [];
                  }
                  groups[key].push(a);
                });

                // Sort keys: compare wave first, then targetNo
                const sortedKeys = Object.keys(groups).sort((a, b) => {
                  const matchA = a.match(/W(\d+)_T(\d+)/);
                  const matchB = b.match(/W(\d+)_T(\d+)/);
                  if (matchA && matchB) {
                    const wA = parseInt(matchA[1]);
                    const wB = parseInt(matchB[1]);
                    if (wA !== wB) return wA - wB;
                    const tA = parseInt(matchA[2]);
                    const tB = parseInt(matchB[2]);
                    return tA - tB;
                  }
                  return a.localeCompare(b);
                });

                return sortedKeys.map(key => {
                  const groupArchers = groups[key];
                  
                  // Map A, B, C, D to grid slots [0, 1, 2, 3]
                  const grid: (Archer | null)[] = [null, null, null, null];
                  groupArchers.forEach(a => {
                    const pos = (a.position || '').toUpperCase();
                    if (pos === 'A') grid[0] = a;
                    else if (pos === 'B') grid[1] = a;
                    else if (pos === 'C') grid[2] = a;
                    else if (pos === 'D') grid[3] = a;
                    else {
                      const emptyIdx = grid.findIndex(cell => cell === null);
                      if (emptyIdx !== -1) {
                        grid[emptyIdx] = a;
                      }
                    }
                  });

                  return (
                    <div key={key} className="w-[210mm] h-[297mm] p-6 grid grid-cols-2 grid-rows-2 gap-4 bg-white page-break-after-always box-border overflow-hidden relative">
                      {grid.map((a, idx) => {
                        if (a) {
                          return (
                            <div key={`${a.id || 'sheet'}-${idx}`} className="border border-slate-300 rounded-2xl p-1 overflow-hidden relative max-h-[141mm]">
                              <ScoringSheet
                                archer={a}
                                settings={settings}
                                eventId={eventId}
                                isA6={true}
                              />
                            </div>
                          );
                        } else {
                          const posLabel = idx === 0 ? 'A' : idx === 1 ? 'B' : idx === 2 ? 'C' : 'D';
                          const firstArcher = groupArchers[0];
                          const targetNo = firstArcher?.targetNo || '?';
                          const wave = firstArcher?.wave || '?';
                          return (
                            <div key={`empty-${idx}`} className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-50">
                              <p className="text-[12px] font-black text-slate-700 font-sans uppercase tracking-widest">Bantalan {targetNo}{posLabel}</p>
                              <p className="text-[10px] font-bold text-slate-600 font-sans uppercase mt-0.5">Sesi {wave} - Kosong</p>
                            </div>
                          );
                        }
                      })}
                    </div>
                  );
                });
              })()
            ) : (
              filtered.map((a: Archer, aIdx: number) => (
                <div key={`${a.id || 'sheet'}-${aIdx}`} className="page-break-after-always">
                  <ScoringSheet
                    archer={a}
                    settings={settings}
                    eventId={eventId}
                    isA6={false}
                  />
                </div>
              ))
            )
          ) : (
            <div className={scoringSheetSize === 'A6' ? "w-[105mm] h-[148.5mm] border border-slate-300 rounded-xl p-1 overflow-hidden bg-white" : ""}>
              <ScoringSheet
                archer={archers.find((a) => a.id === printArcherId)!}
                settings={settings}
                eventId={eventId}
                isA6={scoringSheetSize === 'A6'}
              />
            </div>
          )}
        </div>,
        document.body
      )}

      <div className="bg-white border-y border-slate-100 overflow-hidden print:hidden">
        <div className="p-4 bg-[#FBFBFD] flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
            <input
              type="text"
              placeholder="Cari nama, No. KTA, ID barcode, No. Registrasi, klub, atau bantalan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-arcus-red transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterCheckIn}
              onChange={(e) => setFilterCheckIn(e.target.value as any)}
              className={`border rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none transition-all ${
                filterCheckIn === 'CHECKED_IN' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                  : filterCheckIn === 'NOT_CHECKED_IN'
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="ALL">Semua Kehadiran</option>
              <option value="CHECKED_IN">✓ Hadir (Registrasi Ulang)</option>
              <option value="NOT_CHECKED_IN">⏳ Belum Hadir</option>
            </select>
            <select
              value={filterWave}
              onChange={(e) =>
                setFilterWave(
                  e.target.value === "ALL" ? "ALL" : parseInt(e.target.value),
                )
              }
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none focus:border-arcus-red"
            >
              <option value="ALL">Semua Sesi</option>
              {Array.from(new Set(archers.map((a) => a.wave)))
                .sort((a: any, b: any) => (a as number) - (b as number))
                .map((w) => (
                  <option key={w as number} value={w as number}>
                    Sesi {w as number}
                  </option>
                ))}
            </select>
            <select
              value={filterClub}
              onChange={(e) => setFilterClub(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none focus:border-arcus-red max-w-[150px]"
            >
              {clubs.map((club: string) => (
                <option key={club} value={club}>
                  {club === "ALL" ? "Semua Klub" : club}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto min-h-[300px] flex flex-col">
          <table className="w-full text-left text-xs flex-grow">
            <thead>
              <tr className="bg-white border-b text-slate-700 font-black uppercase">
                <th className="p-4 w-12">No.</th>
                <th className="p-4">Bantalan</th>
                <th className="p-4">Nama Pemanah</th>
                <th className="p-4">No. KTA</th>
                <th className="p-4">Registrasi Ulang</th>
                <th className="p-4">Kontak</th>
                <th className="p-4">Klub</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Status Bayar</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a: Archer, idx: number) => (
                <tr key={`${a.id || 'arch'}-${idx}`} className={`border-b transition-colors ${a.checkedIn ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                  <td className="p-4 font-black text-slate-600">{idx + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-arcus-red text-lg">
                        {a.targetNo > 0 ? `${a.targetNo}${a.position}` : "TBA"}
                        {a.wave > 1 ? `-${a.wave}` : ""}
                      </span>
                      {a.wave > 1 && (
                        <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase border border-blue-100">
                          Sesi {a.wave}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold uppercase text-slate-900 leading-tight">
                        {a.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[8px] font-mono text-slate-700">
                          ID: {a.id.substring(0, 10)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {a.ktaNumber ? (
                      <span className="font-mono font-bold text-[11px] text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block uppercase tracking-wide">
                        {a.ktaNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-bold italic text-xs">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !a.checkedIn;
                        onUpdate({
                          ...a,
                          checkedIn: nextState,
                          checkInTimestamp: nextState ? Date.now() : 0
                        });
                        if (nextState) {
                          toast.success(`Check-in berhasil: ${a.name}`);
                        } else {
                          toast.info(`Check-in dibatalkan: ${a.name}`);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border shadow-sm ${
                        a.checkedIn 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                      }`}
                      title="Klik untuk toggle status kehadiran / registrasi ulang"
                    >
                      {a.checkedIn ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Hadir</span>
                          {a.checkInTimestamp && (
                            <span className="text-[7.5px] opacity-75 font-normal">
                              ({new Date(a.checkInTimestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 opacity-60" />
                          <span>Belum Hadir</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-700 leading-none">
                        {a.phone || "-"}
                      </span>
                      <span className="text-[8px] font-bold text-slate-700 mt-1 leading-none">
                        {a.email || "-"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-800 font-medium">{a.club}</td>
                  <td className="p-4 text-slate-700 uppercase font-black tracking-tighter">
                    {CATEGORY_LABELS[a.category as CategoryType] || (a.category || "").replace("ADULT_", "")}
                  </td>
                  <td className="p-4 px-2">
                    <select
                      value={a.status}
                      onChange={(e) => onUpdate({ ...a, status: e.target.value as RegistrationStatus })}
                      className={`w-full px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${
                        a.status === RegistrationStatus.APPROVED || a.status === RegistrationStatus.CONFIRMED
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : a.status === RegistrationStatus.REJECTED
                          ? 'bg-red-50 text-red-600 border-red-100'
                          : a.status === RegistrationStatus.PAID
                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}
                    >
                      <option value={RegistrationStatus.PENDING}>Pending</option>
                      <option value={RegistrationStatus.PAID}>Paid</option>
                      <option value={RegistrationStatus.APPROVED}>Approved</option>
                      <option value={RegistrationStatus.CONFIRMED}>Confirmed</option>
                      <option value={RegistrationStatus.REJECTED}>Rejected</option>
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingArcher(a)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Edit Data Peserta"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setInitialScanQuery(a.id);
                          setShowScannerModal(true);
                        }}
                        className="p-2 text-slate-700 hover:text-emerald-600 transition-colors"
                        title="Scan / Detail Registrasi Barcode"
                      >
                        <BarcodeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrintScoringSheet(a.id)}
                        className="p-2 text-slate-300 hover:text-purple-600 transition-colors"
                        title="Cetak Scoring Sheet"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setArcherToDelete(a)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Hapus Peserta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-6 h-6 text-slate-200" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900 uppercase italic">
                  {archers.length > 0 ? "Hasil Filter Kosong" : "Belum Ada Peserta"}
                </p>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest italic">
                  {archers.length > 0 
                    ? "Coba ubah kata kunci pencarian atau kategori filter." 
                    : "Belum ada peserta yang terdaftar atau data cloud belum terunduh."}
                </p>
              </div>
              {onRefreshData && (
                <button 
                  onClick={onRefreshData}
                  className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm"
                >
                  Segarkan dari Cloud
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Participant Modal */}
      <ArcherEditModal
        isOpen={!!editingArcher}
        archer={editingArcher}
        onClose={() => setEditingArcher(null)}
        onSave={async (updated) => {
          await onUpdate(updated);
          setEditingArcher(null);
        }}
        totalTargets={totalTargets}
        settings={settings}
        eventId={eventId}
      />

      {/* Delete Participant Confirmation Modal */}
      {archerToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 sm:p-7 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0 shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black font-oswald uppercase italic tracking-wide text-slate-900 leading-tight">
                  Hapus Data Peserta?
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
              <p className="font-black text-slate-900 text-sm">{archerToDelete.name}</p>
              <p className="text-slate-600 font-medium">Klub: <span className="font-bold text-slate-800">{archerToDelete.club}</span></p>
              <p className="text-slate-600 font-medium">Kategori: <span className="font-bold text-slate-800">{CATEGORY_LABELS[archerToDelete.category as CategoryType] || archerToDelete.category}</span></p>
              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-red-600 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Seluruh riwayat nilai skoring dan registrasi peserta ini akan ikut terhapus.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setArcherToDelete(null)}
                disabled={isDeletingParticipant}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingParticipant}
                onClick={async () => {
                  if (!archerToDelete) return;
                  setIsDeletingParticipant(true);
                  try {
                    await onRemove(archerToDelete.id);
                    setArcherToDelete(null);
                  } catch (err: any) {
                    console.error("Gagal menghapus:", err);
                    toast.error("Gagal menghapus peserta: " + (err.message || ""));
                  } finally {
                    setIsDeletingParticipant(false);
                  }
                }}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isDeletingParticipant ? 'Menghapus...' : 'Hapus Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participant Scanner & Check-in Modal */}
      <ParticipantScannerModal
        isOpen={showScannerModal}
        onClose={() => {
          setShowScannerModal(false);
          setInitialScanQuery("");
        }}
        archers={archers}
        onUpdateParticipant={(updated) => {
          onUpdate(updated);
        }}
        eventTitle={settings.tournamentName}
        initialQuery={initialScanQuery}
      />

      {/* Auto Target Allocation Modal */}
      <AutoTargetAllocationModal
        isOpen={showAutoAllocationModal}
        onClose={() => setShowAutoAllocationModal(false)}
        archers={archers}
        settings={settings}
        onApplyAllocation={(updatedArchers) => {
          onBulkUpdate(updatedArchers);
        }}
      />

      {/* Excel Participant Import Modal */}
      {showImportModal && (
        <ArcherImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={async (newArchers) => {
            if (onBulkAdd) {
              await onBulkAdd(newArchers);
            } else {
              const combined = [...archers, ...newArchers];
              onBulkUpdate(combined);
            }
          }}
          currentArchersCount={archers.length}
          totalTargets={totalTargets}
          settings={settings}
          globalSettings={globalSettings}
        />
      )}
    </div>
  );
};

export default ArcherList;
