import React, { useState, useMemo, useEffect } from "react";
import {
  Layers,
  Sparkles,
  Shuffle,
  ListOrdered,
  Users,
  Target,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  X,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { Archer, CategoryType, TournamentSettings } from "../types";
import { CATEGORY_LABELS } from "../constants";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  archers: Archer[];
  settings: TournamentSettings;
  onApplyAllocation: (updatedArchers: Archer[]) => void;
}

type AllocationMode = "SMART_CLUB_SPREAD" | "SEQUENTIAL_REG" | "PURE_RANDOM";

interface CategoryAllocationPlan {
  category: string;
  categoryLabel: string;
  archersCount: number;
  targetsNeeded: number;
  startTarget: number;
  endTarget: number;
  enabled: boolean;
  assignments: {
    archer: Archer;
    targetNo: number;
    position: "A" | "B" | "C" | "D";
    wave: number;
  }[];
}

// Default standard age/division sequence for archery tournaments
const DEFAULT_CATEGORY_ORDER: string[] = [
  CategoryType.U9_PUTRA,
  CategoryType.U9_PUTRI,
  CategoryType.U12_PUTRA,
  CategoryType.U12_PUTRI,
  CategoryType.U18_PUTRA,
  CategoryType.U18_PUTRI,
  CategoryType.ADULT_PUTRA,
  CategoryType.ADULT_PUTRI,
];

export const AutoTargetAllocationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  archers,
  settings,
  onApplyAllocation,
}) => {
  // Settings
  const [archersPerTarget, setArchersPerTarget] = useState<number>(() => {
    return settings.archersPerTarget || 4;
  });
  const [startTargetNumber, setStartTargetNumber] = useState<number>(1);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("SMART_CLUB_SPREAD");
  const [onlyApproved, setOnlyApproved] = useState<boolean>(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Active categories present in current archers list (excluding OFFICIAL)
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    archers.forEach((a) => {
      if (a.category && a.category !== CategoryType.OFFICIAL) {
        cats.add(a.category);
      }
    });

    const list = Array.from(cats);
    // Sort by default standard order first
    return list.sort((a, b) => {
      const idxA = DEFAULT_CATEGORY_ORDER.indexOf(a);
      const idxB = DEFAULT_CATEGORY_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [archers]);

  // User re-orderable category sequence
  const [categorySequence, setCategorySequence] = useState<string[]>([]);
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (availableCategories.length > 0) {
      setCategorySequence(availableCategories);
      const initialEnabled: Record<string, boolean> = {};
      availableCategories.forEach((c) => {
        initialEnabled[c] = true;
      });
      setEnabledCategories(initialEnabled);
    }
  }, [availableCategories]);

  // Move category up
  const moveCategoryUp = (index: number) => {
    if (index <= 0) return;
    setCategorySequence((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Move category down
  const moveCategoryDown = (index: number) => {
    if (index >= categorySequence.length - 1) return;
    setCategorySequence((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Toggle category enabled state
  const toggleCategory = (cat: string) => {
    setEnabledCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Positions based on capacity
  const positionSlots = useMemo(() => {
    const slots = ["A", "B", "C", "D"] as const;
    return slots.slice(0, Math.min(4, Math.max(1, archersPerTarget)));
  }, [archersPerTarget]);

  // Live calculation of target allocations
  const allocationPlan = useMemo(() => {
    let currentTargetPointer = Math.max(1, startTargetNumber);
    const plans: CategoryAllocationPlan[] = [];
    const validArchers = archers.filter(
      (a) =>
        a.category !== CategoryType.OFFICIAL &&
        (!onlyApproved || (a.status as any) === "APPROVED" || (a.status as any) === "CONFIRMED")
    );

    categorySequence.forEach((cat) => {
      const isEnabled = enabledCategories[cat] !== false;
      const catArchers = validArchers.filter((a) => a.category === cat);
      const count = catArchers.length;

      if (count === 0) {
        plans.push({
          category: cat,
          categoryLabel: CATEGORY_LABELS[cat as CategoryType] || cat,
          archersCount: 0,
          targetsNeeded: 0,
          startTarget: currentTargetPointer,
          endTarget: currentTargetPointer,
          enabled: isEnabled,
          assignments: [],
        });
        return;
      }

      if (!isEnabled) {
        plans.push({
          category: cat,
          categoryLabel: CATEGORY_LABELS[cat as CategoryType] || cat,
          archersCount: count,
          targetsNeeded: 0,
          startTarget: 0,
          endTarget: 0,
          enabled: false,
          assignments: [],
        });
        return;
      }

      // Calculate targets needed for this category
      const targetsNeeded = Math.ceil(count / archersPerTarget);
      const startTarget = currentTargetPointer;
      const endTarget = currentTargetPointer + targetsNeeded - 1;

      // Arrange archers based on selected mode
      let orderedArchers: Archer[] = [];

      if (allocationMode === "SEQUENTIAL_REG") {
        // Sort by registration timestamp / natural order
        orderedArchers = [...catArchers].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      } else if (allocationMode === "PURE_RANDOM") {
        // Random shuffle
        orderedArchers = [...catArchers].sort(() => Math.random() - 0.5);
      } else {
        // SMART_CLUB_SPREAD: Disperse athletes from the same club across different targets
        const clubMap: Record<string, Archer[]> = {};
        catArchers.forEach((a) => {
          const clubName = (a.club || "INDEPENDENT").trim().toUpperCase();
          if (!clubMap[clubName]) clubMap[clubName] = [];
          clubMap[clubName].push(a);
        });

        // Shuffle within each club bucket
        Object.keys(clubMap).forEach((club) => {
          clubMap[club] = clubMap[club].sort(() => Math.random() - 0.5);
        });

        // Sort clubs by size (largest club first) to distribute evenly
        const sortedClubs = Object.keys(clubMap).sort(
          (a, b) => clubMap[b].length - clubMap[a].length
        );

        // Flatten using round-robin across clubs
        const spreadList: Archer[] = [];
        let hasMore = true;
        let roundIndex = 0;

        while (hasMore) {
          hasMore = false;
          for (const club of sortedClubs) {
            if (clubMap[club][roundIndex]) {
              spreadList.push(clubMap[club][roundIndex]);
              if (clubMap[club][roundIndex + 1]) {
                hasMore = true;
              }
            }
          }
          roundIndex++;
        }
        orderedArchers = spreadList;
      }

      // Distribute orderedArchers across target positions (Target startTarget..endTarget, Slot A..D)
      const assignments: {
        archer: Archer;
        targetNo: number;
        position: "A" | "B" | "C" | "D";
        wave: number;
      }[] = [];

      orderedArchers.forEach((archer, idx) => {
        const targetOffset = Math.floor(idx / archersPerTarget);
        const posOffset = idx % archersPerTarget;
        const targetNo = startTarget + targetOffset;
        const position = (positionSlots[posOffset] || "A") as "A" | "B" | "C" | "D";

        assignments.push({
          archer,
          targetNo,
          position,
          wave: 1,
        });
      });

      plans.push({
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat as CategoryType] || cat,
        archersCount: count,
        targetsNeeded,
        startTarget,
        endTarget,
        enabled: true,
        assignments,
      });

      // Increment target pointer for the next category
      currentTargetPointer = endTarget + 1;
    });

    return plans;
  }, [
    archers,
    categorySequence,
    enabledCategories,
    archersPerTarget,
    startTargetNumber,
    allocationMode,
    onlyApproved,
    positionSlots,
  ]);

  // Overall Statistics
  const totalAllocatedArchers = useMemo(() => {
    return allocationPlan.reduce((acc, p) => acc + (p.enabled ? p.assignments.length : 0), 0);
  }, [allocationPlan]);

  const totalTargetsRequired = useMemo(() => {
    return allocationPlan.reduce((acc, p) => acc + (p.enabled ? p.targetsNeeded : 0), 0);
  }, [allocationPlan]);

  const endTargetNumber = useMemo(() => {
    if (totalTargetsRequired === 0) return startTargetNumber;
    return startTargetNumber + totalTargetsRequired - 1;
  }, [startTargetNumber, totalTargetsRequired]);

  // Apply Changes
  const handleApply = () => {
    if (totalAllocatedArchers === 0) {
      toast.error("Tidak ada peserta yang dialokasikan.");
      return;
    }

    const assignedMap = new Map<string, { targetNo: number; position: string; wave: number }>();
    allocationPlan.forEach((plan) => {
      if (plan.enabled) {
        plan.assignments.forEach((asg) => {
          assignedMap.set(asg.archer.id, {
            targetNo: asg.targetNo,
            position: asg.position,
            wave: asg.wave,
          });
        });
      }
    });

    // Update archers list preserving other fields
    const updatedArchers = archers.map((a) => {
      const assignment = assignedMap.get(a.id);
      if (assignment) {
        return {
          ...a,
          targetNo: assignment.targetNo,
          position: assignment.position,
          wave: assignment.wave,
        };
      }
      return a;
    });

    onApplyAllocation(updatedArchers);
    toast.success(
      `Berhasil menata ${totalAllocatedArchers} atlet ke Bantalan ${startTargetNumber} s.d. ${endTargetNumber} secara otomatis!`
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10 blur-xl pointer-events-none">
            <Target className="w-80 h-80" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-arcus-red/20 border border-arcus-red/40 flex items-center justify-center text-arcus-red shadow-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-arcus-red text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest">
                  Otomatisasi Cerdas
                </span>
                <span className="text-slate-400 text-[10px] font-semibold">
                  Field of Play Optimization
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-oswald uppercase italic tracking-tight mt-1 text-white">
                Penataan Bantalan Otomatis &amp; Menerus
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all z-10 active:scale-95"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* Top Control Settings Panel */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-arcus-red" /> Parameter Pembagian Bantalan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Archers per Target */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                  Kapasitas per Bantalan
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setArchersPerTarget(num)}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                        archersPerTarget === num
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {num} Orang ({num === 2 ? "A, B" : num === 3 ? "A, B, C" : "A..D"})
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Target Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                  Nomor Bantalan Mulai
                </label>
                <div className="flex items-center">
                  <span className="bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-l-xl border border-r-0 border-slate-300">
                    Bantalan
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={startTargetNumber}
                    onChange={(e) => setStartTargetNumber(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-r-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:border-arcus-red"
                  />
                </div>
              </div>

              {/* Filter Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                  Status Registrasi Peserta
                </label>
                <button
                  type="button"
                  onClick={() => setOnlyApproved(!onlyApproved)}
                  className={`w-full py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center justify-center gap-2 transition-all ${
                    onlyApproved
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {onlyApproved ? "Hanya Status Terkonfirmasi" : "Semua Status (Lengkap)"}
                </button>
              </div>
            </div>

            {/* Allocation Strategy Selection */}
            <div className="pt-2 border-t border-slate-200">
              <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider block mb-2">
                Metode Pembagian Slot (Urutan &amp; Posisi)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* Mode 1: Smart Club Spread */}
                <button
                  type="button"
                  onClick={() => setAllocationMode("SMART_CLUB_SPREAD")}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    allocationMode === "SMART_CLUB_SPREAD"
                      ? "bg-purple-50 border-purple-500 shadow-xs ring-1 ring-purple-500"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-black uppercase text-slate-900">
                      1. Sebar Klub Cerdas
                    </span>
                    <span className="text-[8px] bg-purple-600 text-white font-black px-1.5 py-0.2 rounded ml-auto">
                      FAIRPLAY
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-600 leading-snug">
                    Mengacak atlet per kategori dan memisahkan atlet satu klub ke bantalan berbeda.
                  </p>
                </button>

                {/* Mode 2: Sequential Registration */}
                <button
                  type="button"
                  onClick={() => setAllocationMode("SEQUENTIAL_REG")}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    allocationMode === "SEQUENTIAL_REG"
                      ? "bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ListOrdered className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black uppercase text-slate-900">
                      2. Urut Pendaftaran
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-600 leading-snug">
                    Mengisi nomor urut bantalan sesuai tanggal &amp; waktu pendaftaran atlet masuk.
                  </p>
                </button>

                {/* Mode 3: Pure Random */}
                <button
                  type="button"
                  onClick={() => setAllocationMode("PURE_RANDOM")}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    allocationMode === "PURE_RANDOM"
                      ? "bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-500"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Shuffle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black uppercase text-slate-900">
                      3. Acak Bebas Murni
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-600 leading-snug">
                    Mengacak urutan penempatan posisi atlet di dalam kategori secara murni.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-arcus-red">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total Atlet</span>
                <p className="text-xl font-black font-oswald text-white leading-none mt-0.5">
                  {totalAllocatedArchers} Atlet
                </p>
              </div>
            </div>

            <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/60 flex items-center justify-center text-emerald-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-300">Total Kebutuhan Bantalan</span>
                <p className="text-xl font-black font-oswald text-emerald-200 leading-none mt-0.5">
                  {totalTargetsRequired} Bantalan
                </p>
              </div>
            </div>

            <div className="bg-indigo-950 text-indigo-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-900/60 flex items-center justify-center text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-indigo-300">Rentang Bantalan Lapangan</span>
                <p className="text-lg font-black font-oswald text-indigo-200 leading-none mt-0.5">
                  {totalTargetsRequired > 0 ? `Target ${startTargetNumber} s.d. ${endTargetNumber}` : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Sequential Category Ordering & Live Breakdown Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-arcus-red" />
                  Urutan Kategori &amp; Rincian Alokasi Berurutan
                </h3>
                <p className="text-[10px] text-slate-700 font-bold">
                  Gunakan tombol panah (↑ / ↓) untuk mengatur urutan kategori sesuai jadwal &amp; susunan lapangan.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs">
              {allocationPlan.map((plan, idx) => {
                const isExpanded = expandedCategory === plan.category;
                return (
                  <div key={plan.category} className={`transition-colors ${plan.enabled ? "bg-white" : "bg-slate-50 opacity-60"}`}>
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Re-order and Category Name */}
                      <div className="flex items-center gap-2.5">
                        {/* Order badge & buttons */}
                        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                          <span className="w-5 h-5 rounded-lg bg-white text-slate-900 text-[10px] font-black flex items-center justify-center shadow-xs">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => moveCategoryUp(idx)}
                            disabled={idx === 0}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 transition-all rounded"
                            title="Pindah ke Atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCategoryDown(idx)}
                            disabled={idx === categorySequence.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 transition-all rounded"
                            title="Pindah ke Bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Checkbox toggle */}
                        <input
                          type="checkbox"
                          checked={plan.enabled}
                          onChange={() => toggleCategory(plan.category)}
                          className="w-4 h-4 rounded text-arcus-red focus:ring-arcus-red accent-arcus-red"
                        />

                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase">
                            {plan.categoryLabel}
                          </h4>
                          <span className="text-[9px] font-bold text-slate-700">
                            {plan.archersCount} Atlet Terdaftar
                          </span>
                        </div>
                      </div>

                      {/* Right: Allocated Target Range Badge & Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {plan.enabled && plan.targetsNeeded > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase">
                              {plan.targetsNeeded} Bantalan
                            </span>
                            <span className="bg-slate-900 text-white px-3 py-1 rounded-xl text-xs font-black font-oswald uppercase tracking-wider">
                              Target {plan.startTarget === plan.endTarget ? plan.startTarget : `${plan.startTarget} - ${plan.endTarget}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-700 italic">
                            {plan.archersCount === 0 ? "Tidak ada peserta" : "Dinonaktifkan"}
                          </span>
                        )}

                        {plan.enabled && plan.assignments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedCategory(isExpanded ? null : plan.category)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                            title={isExpanded ? "Tutup Detail" : "Lihat Posisi Atlet"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail View of Targets & Athletes */}
                    {isExpanded && plan.assignments.length > 0 && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50/80 border-t border-slate-100 animate-in fade-in">
                        <div className="text-[9px] font-black uppercase text-slate-700 tracking-wider mb-2">
                          Pratinjau Penempatan Atlet ({plan.assignments.length} Atlet):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {plan.assignments.map((asg, aIdx) => (
                            <div
                              key={aIdx}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded font-black text-[10px] shrink-0 font-oswald">
                                  {asg.targetNo}{asg.position}
                                </span>
                                <div className="truncate">
                                  <p className="font-black text-slate-900 truncate">{asg.archer.name}</p>
                                  <p className="text-[9px] text-slate-700 font-semibold truncate">{asg.archer.club || "Independen"}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Informational Guidance Box */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-amber-900">
            <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="text-[10px] font-medium leading-relaxed">
              <strong>Catatan Lapangan:</strong> Penataan otomatis ini akan menyusun nomor bantalan secara berkelanjutan tanpa ada nomor yang melompat. Atlet dapat langsung melihat nomor bantalannya di <em>Kartu Peserta</em>, lembar <em>Scoring Sheet</em>, dan <em>Live Score</em>.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider hover:bg-slate-100 transition-all"
          >
            Batal
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleApply}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-arcus-red hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-arcus-red/30 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              Terapkan &amp; Pasang Nomor Bantalan
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AutoTargetAllocationModal;
