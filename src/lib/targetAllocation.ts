import { ArcheryEvent, Archer, ParticipantRegistration, CategoryType, AutoTargetConfig, CategoryTargetBlock, TargetFillOrder } from '../types';
import { CATEGORY_LABELS } from '../constants';

export interface TargetSlotResult {
  targetNo: number;
  position: 'A' | 'B' | 'C' | 'D';
  wave: number;
  sessionName: string;
}

const DEFAULT_POSITIONS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

/**
 * Otomatis membagi total bantalan ke kategori-kategori (untuk Model 2)
 * berdasarkan kuota peserta atau dibagi rata
 */
export function generateDefaultCategoryBlocks(
  categories: CategoryType[],
  totalTargets: number,
  categoryConfigs?: Record<string, { quota?: number }>
): Partial<Record<CategoryType, CategoryTargetBlock>> {
  const result: Partial<Record<CategoryType, CategoryTargetBlock>> = {};
  if (!categories || categories.length === 0 || totalTargets <= 0) return result;

  // Filter kategori valid (kecuali OFFICIAL)
  const activeCats = categories.filter(c => c !== CategoryType.OFFICIAL);
  if (activeCats.length === 0) return result;

  // Cek apakah ada kuota
  const quotas = activeCats.map(c => categoryConfigs?.[c]?.quota || 0);
  const totalQuota = quotas.reduce((a, b) => a + b, 0);

  let currentStart = 1;

  if (totalQuota > 0) {
    // Alokasi proporsional berdasarkan kuota
    let remainingTargets = totalTargets;
    activeCats.forEach((cat, idx) => {
      const q = categoryConfigs?.[cat]?.quota || 0;
      let allocated = 1;
      if (idx === activeCats.length - 1) {
        allocated = Math.max(1, remainingTargets);
      } else {
        allocated = Math.max(1, Math.round((q / totalQuota) * totalTargets));
        if (remainingTargets - allocated < (activeCats.length - 1 - idx)) {
          allocated = Math.max(1, remainingTargets - (activeCats.length - 1 - idx));
        }
      }
      const endTarget = Math.min(totalTargets, currentStart + allocated - 1);
      result[cat] = {
        startTarget: currentStart,
        endTarget,
        sessionName: `Bantalan ${currentStart}-${endTarget}`
      };
      remainingTargets -= (endTarget - currentStart + 1);
      currentStart = endTarget + 1;
    });
  } else {
    // Bagi rata jika tidak ada kuota
    const targetsPerCat = Math.max(1, Math.floor(totalTargets / activeCats.length));
    activeCats.forEach((cat, idx) => {
      const startTarget = currentStart;
      const endTarget = (idx === activeCats.length - 1)
        ? totalTargets
        : Math.min(totalTargets, startTarget + targetsPerCat - 1);
      result[cat] = {
        startTarget,
        endTarget,
        sessionName: `Bantalan ${startTarget}-${endTarget}`
      };
      currentStart = endTarget + 1;
    });
  }

  return result;
}

/**
 * Menghitung slot bantalan berikutnya untuk satu peserta yang baru mendaftar
 */
export function getNextTargetSlot(
  category: string,
  event: ArcheryEvent,
  simulatedExistingList?: (Archer | ParticipantRegistration)[]
): TargetSlotResult | null {
  const settings = event.settings;
  const config = settings?.autoTargetConfig;

  // Jika fitur dinonaktifkan
  if (!config || !config.enabled) return null;

  // Official tidak dapat nomor bantalan lomba
  if (category === 'OFFICIAL' || category === CategoryType.OFFICIAL) return null;

  const totalTargets = settings.totalTargets || 10;
  const archersPerTarget = Math.min(4, Math.max(1, config.archersPerTarget || settings.archersPerTarget || 4));
  const fillOrder: TargetFillOrder = config.fillOrder || 'PARALLEL';
  const positions = DEFAULT_POSITIONS.slice(0, archersPerTarget);

  // Kumpulkan semua peserta yang sudah memiliki target di kategori ini
  const existingList = simulatedExistingList || [
    ...(event.archers || []),
    ...(event.registrations || [])
  ];

  // Filter hanya yang di kategori yang sama dan sudah memiliki targetNo valid
  const assignedInCat = existingList.filter(p => {
    return (
      p.category === category &&
      p.targetNo &&
      p.targetNo > 0 &&
      p.position
    );
  });

  const nextIndex = assignedInCat.length; // Index urutan pendaftar ke-(nextIndex + 1)

  // ==========================================
  // MODEL 1: BEDA SESI / JAM PER KATEGORI
  // Setiap kategori menggunakan Bantalan 1 s/d totalTargets
  // Jika lebih dari kapasitas 1 sesi, otomatis masuk Sesi/Gelombang 2, 3, dst.
  // ==========================================
  if (config.model === 'MODEL_1_DEDICATED_SESSION') {
    const waveCapacity = totalTargets * archersPerTarget;
    const wave = Math.floor(nextIndex / waveCapacity) + 1;
    const slotInWave = nextIndex % waveCapacity;

    let targetOffset = 0;
    let posOffset = 0;

    if (fillOrder === 'PARALLEL') {
      // Distribusi merata (1A, 2A, 3A... 10A, lalu 1B, 2B... 10B)
      targetOffset = slotInWave % totalTargets;
      posOffset = Math.floor(slotInWave / totalTargets);
    } else {
      // Sekuensial penuh (1A, 1B, 1C, 1D, lalu 2A, 2B...)
      targetOffset = Math.floor(slotInWave / archersPerTarget);
      posOffset = slotInWave % archersPerTarget;
    }

    const targetNo = 1 + targetOffset;
    const position = positions[posOffset % positions.length] || 'A';
    const waveLabel = config.waveLabels?.[wave] || `Sesi ${wave}`;

    return {
      targetNo,
      position,
      wave,
      sessionName: waveLabel
    };
  }

  // ==========================================
  // MODEL 2: PEMBAGIAN BLOK BANTALAN BERSAMAAN
  // Bantalan fisik dibagi per kategori (misal Putra 1-5, Putri 6-10)
  // ==========================================
  if (config.model === 'MODEL_2_SPLIT_BLOCKS') {
    // Ambil range bantalan kategori
    let block = config.categoryBlocks?.[category as CategoryType];
    
    // Jika belum diatur panitia, fallback hitung otomatis
    if (!block || !block.startTarget || !block.endTarget || block.startTarget > block.endTarget) {
      const activeCats = Object.keys(event.settings.categoryConfigs || {}) as CategoryType[];
      const defaultBlocks = generateDefaultCategoryBlocks(activeCats, totalTargets, event.settings.categoryConfigs as any);
      block = defaultBlocks[category as CategoryType] || { startTarget: 1, endTarget: totalTargets, sessionName: 'Sesi Utama' };
    }

    const startTarget = Math.max(1, block.startTarget);
    const endTarget = Math.min(totalTargets, Math.max(startTarget, block.endTarget));
    const numTargetsInBlock = endTarget - startTarget + 1;

    const blockCapacity = numTargetsInBlock * archersPerTarget;
    const wave = Math.floor(nextIndex / blockCapacity) + 1;
    const slotInBlock = nextIndex % blockCapacity;

    let targetOffset = 0;
    let posOffset = 0;

    if (fillOrder === 'PARALLEL') {
      // Distribusi merata dalam blok (misal 1A, 2A, 3A, 4A, 5A, lalu 1B, 2B..)
      targetOffset = slotInBlock % numTargetsInBlock;
      posOffset = Math.floor(slotInBlock / numTargetsInBlock);
    } else {
      // Sekuensial dalam blok (1A, 1B, 1C, 1D, lalu 2A, 2B..)
      targetOffset = Math.floor(slotInBlock / archersPerTarget);
      posOffset = slotInBlock % archersPerTarget;
    }

    const targetNo = startTarget + targetOffset;
    const position = positions[posOffset % positions.length] || 'A';
    const waveLabel = config.waveLabels?.[wave] || `Sesi ${wave}`;
    const sessionName = block.sessionName
      ? (wave > 1 ? `${block.sessionName} (${waveLabel})` : block.sessionName)
      : waveLabel;

    return {
      targetNo,
      position,
      wave,
      sessionName
    };
  }

  return null;
}

/**
 * Mengalokasikan seluruh peserta secara massal (untuk tombol sinkronisasi ulang di Admin Panel)
 */
export function reallocateAllParticipants(
  event: ArcheryEvent,
  overrideConfig?: AutoTargetConfig
): { updatedArchers: Archer[]; updatedRegistrations: ParticipantRegistration[] } {
  const config = overrideConfig || event.settings.autoTargetConfig;
  if (!config || !config.enabled) {
    return {
      updatedArchers: event.archers || [],
      updatedRegistrations: event.registrations || []
    };
  }

  // Clone data
  const archers = [...(event.archers || [])];
  const registrations = [...(event.registrations || [])];

  // Reset target untuk peserta lomba (kecuali OFFICIAL)
  const simulatedList: (Archer | ParticipantRegistration)[] = [];

  // Group per kategori
  const cats = new Set<string>();
  archers.forEach(a => { if (a.category && a.category !== 'OFFICIAL') cats.add(a.category); });
  registrations.forEach(r => { if (r.category && r.category !== 'OFFICIAL') cats.add(r.category); });

  const updatedArchersMap = new Map<string, Archer>();
  const updatedRegsMap = new Map<string, ParticipantRegistration>();

  // Process kategori demi kategori secara terurut
  cats.forEach(cat => {
    // Kumpulkan peserta kategori ini, urutkan berdasarkan waktu daftar
    const catArchers = archers.filter(a => a.category === cat).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const catRegs = registrations.filter(r => r.category === cat).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Gabungkan dengan menjaga keunikan id
    const allInCat: (Archer | ParticipantRegistration)[] = [];
    const seenIds = new Set<string>();

    catArchers.forEach(a => {
      seenIds.add(a.id);
      allInCat.push(a);
    });
    catRegs.forEach(r => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        allInCat.push(r);
      }
    });

    // Alokasikan satu per satu
    allInCat.forEach(p => {
      const slot = getNextTargetSlot(cat, {
        ...event,
        settings: { ...event.settings, autoTargetConfig: config }
      }, simulatedList);

      if (slot) {
        const allocated = {
          ...p,
          targetNo: slot.targetNo,
          position: slot.position,
          wave: slot.wave,
          sessionName: slot.sessionName
        };
        simulatedList.push(allocated as any);

        if (archers.some(a => a.id === p.id)) {
          updatedArchersMap.set(p.id, allocated as Archer);
        }
        if (registrations.some(r => r.id === p.id)) {
          updatedRegsMap.set(p.id, allocated as ParticipantRegistration);
        }
      }
    });
  });

  return {
    updatedArchers: archers.map(a => updatedArchersMap.get(a.id) || a),
    updatedRegistrations: registrations.map(r => updatedRegsMap.get(r.id) || r)
  };
}
