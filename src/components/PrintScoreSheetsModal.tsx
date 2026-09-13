import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Target, Trophy, Filter, Users, 
  CheckCircle2, AlertCircle, FileText, Download, ShieldCheck,
  QrCode, Barcode as BarcodeIcon
} from 'lucide-react';
import { ArcheryEvent, CategoryType, Archer, TargetType, CategoryConfig } from '../types';
import { CATEGORY_LABELS, TARGET_LABELS } from '../constants';
import { resolveGoogleDriveUrl } from '../lib/photoService';
import { findCategoryConfig } from '../lib/firestoreUtils';
import ArcusLogo from './ArcusLogo';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from './Barcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: ArcheryEvent;
}

export const getTargetScoringInfo = (targetType?: TargetType, catConfig?: CategoryConfig | null) => {
  // Prioritize explicit highest point settings configured by admin
  if (catConfig?.highestScore1 || catConfig?.highestScore2) {
    const col1 = catConfig.highestScore1 || (targetType === TargetType.TRADITIONAL_6_RING ? '6' : targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA ? '2' : targetType === TargetType.FACE_5_RING ? '5' : '10');
    const col2 = catConfig.highestScore2 || (targetType === TargetType.TRADITIONAL_6_RING ? '5' : targetType === TargetType.PUTA || targetType === TargetType.TRADITIONAL_PUTA ? '1' : targetType === TargetType.FACE_5_RING ? '4' : 'X');
    return {
      highCol1: col1,
      highCol2: col2,
      maxPoint: parseInt(col1) || 10,
      label: `Settingan Kategori Admin (${col1} & ${col2})`
    };
  }

  switch (targetType) {
    case TargetType.PUTA:
    case TargetType.TRADITIONAL_PUTA:
      return {
        highCol1: '2',
        highCol2: '1',
        maxPoint: 2,
        label: 'Puta Turkey (Point 2 & 1)'
      };
    case TargetType.TRADITIONAL_6_RING:
      return {
        highCol1: '6',
        highCol2: '5',
        maxPoint: 6,
        label: '6-Ring Traditional (Point 6 & 5)'
      };
    case TargetType.FACE_5_RING:
      return {
        highCol1: '5',
        highCol2: '4',
        maxPoint: 5,
        label: '5-Ring U9/U12 (Point 5 & 4)'
      };
    case TargetType.FACE_MEGA_MENDUNG:
      return {
        highCol1: '10',
        highCol2: '9',
        maxPoint: 10,
        label: 'Face Mega Mendung (Point 10 & 9)'
      };
    case TargetType.FACE_122:
    case TargetType.FACE_80:
    case TargetType.FACE_60:
    case TargetType.FACE_40:
    case TargetType.FACE_3X20:
    case TargetType.STANDARD:
    default:
      return {
        highCol1: '10',
        highCol2: 'X',
        maxPoint: 10,
        label: '10-Zone Standard (Point 10 & X)'
      };
  }
};

export const PrintScoreSheetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  event
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'ALL'>('ALL');
  const [sheetType, setSheetType] = useState<'REGISTERED' | 'BLANK'>('REGISTERED');
  const [blankCount, setBlankCount] = useState<number>(4);
  const [formatMode, setFormatMode] = useState<'AUTO' | '6x6' | '10x3' | '6x3' | '5x3' | 'CUSTOM'>('AUTO');
  const [customEnds, setCustomEnds] = useState<number>(6);
  const [customArrows, setCustomArrows] = useState<number>(6);
  const [targetTypeMode, setTargetTypeMode] = useState<string>('AUTO');
  const [showBarcode, setShowBarcode] = useState<boolean>(true);
  const [barcodeStyle, setBarcodeStyle] = useState<'QR' | 'BARCODE' | 'BOTH'>('QR');

  if (!isOpen) return null;

  const tournamentName = event.settings?.tournamentName || 'Turnamen Panahan Arcus';
  const tournamentDate = event.settings?.eventDate || '-';
  const tournamentLocation = event.settings?.location || 'Indonesia';
  const eventLogo = event.settings?.logoUrl ? resolveGoogleDriveUrl(event.settings.logoUrl) : null;
  const secondaryLogo = event.settings?.secondaryLogoUrl ? resolveGoogleDriveUrl(event.settings.secondaryLogoUrl) : null;
  const clubLogo = event.settings?.clubLogoUrl ? resolveGoogleDriveUrl(event.settings.clubLogoUrl) : null;

  // Helper to extract category configuration from Admin settings with robust name/alias resolution
  const getCategoryConfig = (cat?: string): CategoryConfig | null => {
    if (!cat) return null;
    return findCategoryConfig(cat, event.settings?.categoryConfigs);
  };

  // Helper to calculate effective ends and arrows for any category
  const getEffectiveFormat = (cat?: string) => {
    if (formatMode === '6x6') return { ends: 6, arrows: 6 };
    if (formatMode === '10x3') return { ends: 10, arrows: 3 };
    if (formatMode === '6x3') return { ends: 6, arrows: 3 };
    if (formatMode === '5x3') return { ends: 5, arrows: 3 };
    if (formatMode === 'CUSTOM') return { ends: Math.max(1, customEnds), arrows: Math.max(1, customArrows) };

    // AUTO Mode: Synchronize directly with category config from admin dashboard
    const catConfig = getCategoryConfig(cat);
    const configuredEnds = Number(catConfig?.ends);
    const configuredArrows = Number(catConfig?.arrows);

    const ends = configuredEnds > 0 
      ? configuredEnds 
      : (Number(event.settings?.totalEnds) > 0 ? Number(event.settings?.totalEnds) : 6);

    const arrows = configuredArrows > 0 
      ? configuredArrows 
      : (Number(event.settings?.arrowsPerEnd) > 0 ? Number(event.settings?.arrowsPerEnd) : 6);

    return { ends, arrows, distance: catConfig?.distance };
  };

  // Helper to resolve effective target type
  const resolveTargetType = (cat?: string): TargetType => {
    if (targetTypeMode !== 'AUTO') {
      return targetTypeMode as TargetType;
    }
    const catConfig = getCategoryConfig(cat);
    return catConfig?.targetType || TargetType.STANDARD;
  };

  // Filter archers based on category selection
  const filteredArchers = useMemo(() => {
    let list = (event.archers || []).filter(a => a.category !== 'OFFICIAL' && a.category !== CategoryType.OFFICIAL);
    if (selectedCategory !== 'ALL') {
      list = list.filter(a => a.category === selectedCategory);
    }
    // Sort by target number and position (e.g. 1A, 1B, 2A...)
    return list.sort((a, b) => {
      const targetA = a.targetNo || 999;
      const targetB = b.targetNo || 999;
      if (targetA !== targetB) return targetA - targetB;
      return (a.position || '').localeCompare(b.position || '');
    });
  }, [event.archers, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set<CategoryType>();
    (event.archers || []).forEach(a => {
      if (a.category && a.category !== 'OFFICIAL' && a.category !== CategoryType.OFFICIAL) {
        set.add(a.category as CategoryType);
      }
    });
    // Also include categories configured in settings if not present in archers yet
    if (event.settings?.categoryConfigs) {
      Object.keys(event.settings.categoryConfigs).forEach(cat => {
        if (cat !== 'OFFICIAL' && cat !== CategoryType.OFFICIAL) {
          set.add(cat as CategoryType);
        }
      });
    }
    return Array.from(set);
  }, [event.archers, event.settings?.categoryConfigs]);

  // Sheets to render with per-category ends, arrows, and targetType
  const sheetsToRender: Array<{
    id: string;
    archerId?: string;
    archerName: string;
    club: string;
    category: string;
    rawCategory?: string;
    distance?: string;
    targetNo?: number | string;
    position?: string;
    wave?: number;
    endsCount: number;
    arrowsPerEnd: number;
    targetType: TargetType;
  }> = useMemo(() => {
    if (sheetType === 'BLANK') {
      const targetCat = selectedCategory !== 'ALL' ? selectedCategory : (categories[0] || undefined);
      const format = getEffectiveFormat(targetCat);
      const catConfig = getCategoryConfig(targetCat);
      const effTarget = resolveTargetType(targetCat);

      return Array.from({ length: blankCount }).map((_, idx) => ({
        id: `blank_${idx}`,
        archerId: undefined,
        archerName: '',
        club: '',
        category: selectedCategory === 'ALL' ? '' : (CATEGORY_LABELS[selectedCategory as CategoryType] || selectedCategory),
        rawCategory: selectedCategory === 'ALL' ? undefined : selectedCategory,
        distance: catConfig?.distance || '',
        targetNo: '',
        position: '',
        wave: 1,
        endsCount: format.ends,
        arrowsPerEnd: format.arrows,
        targetType: effTarget
      }));
    }

    if (filteredArchers.length === 0) {
      const targetCat = selectedCategory !== 'ALL' ? selectedCategory : (categories[0] || undefined);
      const format = getEffectiveFormat(targetCat);
      const catConfig = getCategoryConfig(targetCat);
      const effTarget = resolveTargetType(targetCat);

      return [
        {
          id: 'sample_blank',
          archerId: undefined,
          archerName: '',
          club: '',
          category: selectedCategory === 'ALL' ? '' : (CATEGORY_LABELS[selectedCategory as CategoryType] || selectedCategory),
          rawCategory: selectedCategory === 'ALL' ? undefined : selectedCategory,
          distance: catConfig?.distance || '',
          targetNo: '',
          position: '',
          wave: 1,
          endsCount: format.ends,
          arrowsPerEnd: format.arrows,
          targetType: effTarget
        }
      ];
    }

    return filteredArchers.map(a => {
      const format = getEffectiveFormat(a.category);
      const catConfig = getCategoryConfig(a.category);
      const effTarget = resolveTargetType(a.category);

      return {
        id: a.id,
        archerId: a.id,
        archerName: a.name,
        club: a.club || '-',
        category: CATEGORY_LABELS[a.category as CategoryType] || a.category,
        rawCategory: a.category,
        distance: catConfig?.distance || '',
        targetNo: a.targetNo || '',
        position: a.position || '',
        wave: a.wave || 1,
        endsCount: format.ends,
        arrowsPerEnd: format.arrows,
        targetType: effTarget
      };
    });
  }, [sheetType, blankCount, filteredArchers, selectedCategory, formatMode, customEnds, customArrows, targetTypeMode, event.settings?.categoryConfigs, categories]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto no-print animate-in fade-in duration-300">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > * {
            display: none !important;
          }
          #printable-scoresheets-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
          }
          .scoresheet-page {
            page-break-after: always;
            break-after: page;
            padding: 4mm !important;
            border: 2px solid #000 !important;
            margin-bottom: 0 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .scoresheet-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[95vh] my-auto">
        
        {/* Modal Top Control Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-950/70 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black font-oswald uppercase tracking-wide italic">
                Cetak Lembar Skor Resmi (Score Sheet)
              </h3>
              <p className="text-[10px] text-slate-400">
                Format Standar World Archery / INORGA • Dilengkapi Barcode & QR Scanner Lapangan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-red-600/25 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" /> Cetak Lembar Skor ({sheetsToRender.length})
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Customization Toolbar */}
        <div className="p-4 bg-slate-850 border-b border-slate-800/80 flex flex-wrap items-center gap-3 text-xs no-print">
          {/* Sheet Mode */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-750">
            <button
              onClick={() => setSheetType('REGISTERED')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${sheetType === 'REGISTERED' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Terisi Nama Peserta & Bantalan ({filteredArchers.length})
            </button>
            <button
              onClick={() => setSheetType('BLANK')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${sheetType === 'BLANK' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Blanko Kosong
            </button>
          </div>

          {/* Category Filter if REGISTERED */}
          {sheetType === 'REGISTERED' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value as any)}
                className="bg-slate-900 border border-slate-750 text-white rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:border-red-500"
              >
                <option value="ALL">Semua Kategori ({event.archers?.length || 0})</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] || cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Blank count if BLANK */}
          {sheetType === 'BLANK' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">Jumlah Lembar:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={blankCount}
                onChange={e => setBlankCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-slate-900 border border-slate-750 text-white rounded-xl px-3 py-1.5 font-bold text-xs text-center outline-none focus:border-red-500"
              >
              </input>
            </div>
          )}

          {/* Ends & Arrows Config */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400">Format Rambahan:</span>
            <select
              value={formatMode}
              onChange={e => setFormatMode(e.target.value as any)}
              className="bg-slate-900 border border-slate-750 text-white rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:border-red-500"
            >
              <option value="AUTO">
                {selectedCategory !== 'ALL'
                  ? `🎯 Sesuai Kategori (${getEffectiveFormat(selectedCategory).ends} Rambahan × ${getEffectiveFormat(selectedCategory).arrows} Panah)`
                  : '🎯 Otomatis Sesuai Kategori Admin'}
              </option>
              <option value="6x6">Manual: 6 Rambahan × 6 Panah (Total 36)</option>
              <option value="10x3">Manual: 10 Rambahan × 3 Panah (Total 30)</option>
              <option value="6x3">Manual: 6 Rambahan × 3 Panah (Total 18)</option>
              <option value="5x3">Manual: 5 Rambahan × 3 Panah (Aduan / 15)</option>
              <option value="CUSTOM">Manual: Custom (Tentukan Sendiri)...</option>
            </select>

            {formatMode === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-750">
                <span className="text-[9px] font-bold text-slate-400 pl-1">Rambahan:</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={customEnds}
                  onChange={e => setCustomEnds(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-1 text-center font-bold text-xs"
                />
                <span className="text-[9px] font-bold text-slate-400">Panah:</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={customArrows}
                  onChange={e => setCustomArrows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-1 text-center font-bold text-xs"
                />
              </div>
            )}
          </div>

          {/* Target Face / Point Tertinggi Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400">Kolom Poin Tertinggi:</span>
            <select
              value={targetTypeMode}
              onChange={e => setTargetTypeMode(e.target.value)}
              className="bg-slate-900 border border-slate-750 text-white rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:border-red-500"
            >
              <option value="AUTO">🎯 Otomatis (Sesuai Settingan Kategori Admin)</option>
              <option value={TargetType.STANDARD}>Standard 10-Zone (Point 10 &amp; X)</option>
              <option value={TargetType.TRADITIONAL_6_RING}>Traditional 6-Ring (Point 6 &amp; 5)</option>
              <option value={TargetType.FACE_5_RING}>Face 5-Ring U9/U12 (Point 5 &amp; 4)</option>
              <option value={TargetType.PUTA}>Puta Turkey (Point 2 &amp; 1)</option>
              <option value={TargetType.FACE_MEGA_MENDUNG}>Face Mega Mendung (Point 10 &amp; 9)</option>
            </select>
          </div>

          {/* Barcode & QR Options */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-750 cursor-pointer hover:border-slate-600 transition-all select-none">
              <input 
                type="checkbox" 
                checked={showBarcode} 
                onChange={e => setShowBarcode(e.target.checked)}
                className="accent-red-600 w-4 h-4 rounded"
              />
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-red-400" />
                Barcode / QR Scorer
              </span>
            </label>

            {showBarcode && (
              <select
                value={barcodeStyle}
                onChange={e => setBarcodeStyle(e.target.value as any)}
                className="bg-slate-900 border border-slate-750 text-white rounded-xl px-2.5 py-1.5 font-bold text-xs outline-none focus:border-red-500"
              >
                <option value="QR">QR Code (Kamera HP)</option>
                <option value="BARCODE">Barcode Garis 1D</option>
                <option value="BOTH">QR + Barcode</option>
              </select>
            )}
          </div>
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/40">
          <div id="printable-scoresheets-container" className="space-y-6 max-w-3xl mx-auto">
            {sheetsToRender.map((sheet, index) => {
              const catConfig = getCategoryConfig(sheet.rawCategory || sheet.category);
              const scoringInfo = targetTypeMode !== 'AUTO'
                ? getTargetScoringInfo(sheet.targetType)
                : getTargetScoringInfo(sheet.targetType, catConfig);

              return (
                <div 
                  key={sheet.id || index}
                  className="scoresheet-page bg-white text-slate-950 p-4 sm:p-5 rounded-2xl shadow-xl border-2 border-slate-900 space-y-3 font-sans"
                >
                  {/* OFFICIAL MULTI-LOGO KOP DOKUMEN */}
                  <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2.5 gap-3">
                    {/* Left Logos: Event Logo + Club Logo */}
                    <div className="flex items-center gap-2 max-w-[140px] shrink-0">
                      {eventLogo ? (
                        <img 
                          src={eventLogo} 
                          alt="Event Logo" 
                          className="h-11 max-w-[65px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center font-black font-oswald text-red-600 text-xs text-center leading-none p-1">
                          EVENT LOGO
                        </div>
                      )}

                      {clubLogo && (
                        <img 
                          src={clubLogo} 
                          alt="Club Logo" 
                          className="h-10 max-w-[60px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>

                    {/* Center Info */}
                    <div className="text-center flex-1 min-w-0 px-2">
                      <h2 className="text-sm sm:text-base font-black font-oswald uppercase tracking-tight leading-tight">
                        {tournamentName}
                      </h2>
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                        {tournamentDate} • {tournamentLocation}
                      </p>
                      <div className="mt-0.5 inline-block px-2.5 py-0.5 bg-slate-900 text-white rounded font-black text-[8.5px] uppercase tracking-widest font-mono">
                        OFFICIAL SCORE SHEET
                      </div>
                    </div>

                    {/* Right Logos: Organization / INORGA + Arcus */}
                    <div className="flex items-center justify-end gap-2 max-w-[140px] shrink-0">
                      {secondaryLogo && (
                        <img 
                          src={secondaryLogo} 
                          alt="Logo INORGA" 
                          className="h-10 max-w-[60px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <ArcusLogo className="h-9 w-9 shrink-0" />
                    </div>
                  </div>

                  {/* Athlete Metadata Box with Participant Barcode */}
                  <div className="grid grid-cols-12 gap-2 text-xs border border-slate-900 p-2.5 rounded-lg bg-slate-50/70 font-sans items-center">
                    {/* Bantalan */}
                    <div className="col-span-2 border-r border-slate-300 pr-2">
                      <span className="text-[7.5px] font-black text-slate-600 uppercase block leading-none">Target / Bantalan</span>
                      <span className="text-base sm:text-lg font-black font-oswald text-red-600 block leading-tight">
                        {sheet.targetNo ? `Target ${sheet.targetNo}${sheet.position || ''}` : '.........................'}
                      </span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase block mt-0.5">
                        Sesi {sheet.wave || 1}
                      </span>
                    </div>

                    {/* Nama Atlet & Klub */}
                    <div className={`border-r border-slate-300 pr-2 ${showBarcode ? 'col-span-4' : 'col-span-6'}`}>
                      <span className="text-[7.5px] font-black text-slate-600 uppercase block leading-none">Nama Atlet</span>
                      <span className="text-xs sm:text-sm font-black uppercase text-slate-900 truncate block leading-tight">
                        {sheet.archerName || '...................................................'}
                      </span>
                      <span className="text-[9px] text-slate-600 uppercase font-bold block truncate mt-0.5">
                        Klub: {sheet.club || '...........................................'}
                      </span>
                    </div>

                    {/* Kategori, Format, & Sasaran Target */}
                    <div className={`border-r border-slate-300 pr-2 ${showBarcode ? 'col-span-3' : 'col-span-4'}`}>
                      <span className="text-[7.5px] font-black text-slate-600 uppercase block leading-none">Kategori & Sasaran</span>
                      <span className="text-[10px] sm:text-xs font-black uppercase text-slate-900 leading-tight block truncate">
                        {sheet.category || '......................................'}
                      </span>
                      <span className="text-[8px] font-black text-red-600 uppercase tracking-tight block mt-0.5">
                        {sheet.endsCount} Rambahan × {sheet.arrowsPerEnd} Panah {sheet.distance ? `• ${sheet.distance}` : ''}
                      </span>
                      <span className="text-[7.5px] font-black text-slate-700 uppercase tracking-tight block truncate">
                        Face: {TARGET_LABELS[sheet.targetType] || sheet.targetType} (Maks: {scoringInfo.highCol1})
                      </span>
                    </div>

                    {/* Barcode Peserta untuk Memudahkan Scorer Lapangan */}
                    {showBarcode && (
                      <div className="col-span-3 flex items-center justify-end pl-1">
                        {sheet.archerId ? (
                          <div className="flex items-center gap-1.5 bg-white p-1 rounded-md border border-slate-300 shadow-2xs">
                            {barcodeStyle === 'BARCODE' ? (
                              <div className="flex flex-col items-center">
                                <Barcode 
                                  value={`${sheet.targetNo || 1}${sheet.position || 'A'}-${sheet.archerId.slice(-4)}`} 
                                  width={1.2} 
                                  height={26} 
                                  fontSize={8} 
                                  margin={0}
                                />
                                <span className="text-[6.5px] font-black uppercase text-slate-500 font-mono mt-0.5">
                                  SCAN SCORER
                                </span>
                              </div>
                            ) : barcodeStyle === 'BOTH' ? (
                              <div className="flex items-center gap-1.5">
                                <QRCodeSVG 
                                  value={JSON.stringify({
                                    type: 'SCORING_SHEET',
                                    eventId: event.id,
                                    archerId: sheet.archerId,
                                    targetNo: sheet.targetNo,
                                    position: sheet.position,
                                    wave: sheet.wave || 1
                                  })}
                                  size={38}
                                  level="M"
                                />
                                <div className="flex flex-col items-center">
                                  <Barcode 
                                    value={`${sheet.targetNo || 1}${sheet.position || 'A'}`} 
                                    width={0.9} 
                                    height={22} 
                                    fontSize={7} 
                                    margin={0}
                                  />
                                  <span className="text-[6.5px] font-black uppercase text-slate-600 font-mono">
                                    {sheet.targetNo}{sheet.position || ''}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <QRCodeSVG 
                                  value={JSON.stringify({
                                    type: 'SCORING_SHEET',
                                    eventId: event.id,
                                    archerId: sheet.archerId,
                                    targetNo: sheet.targetNo,
                                    position: sheet.position,
                                    wave: sheet.wave || 1
                                  })}
                                  size={44}
                                  level="M"
                                  className="shrink-0"
                                />
                                <div className="text-left font-mono leading-tight">
                                  <span className="text-[6.5px] font-black uppercase tracking-wider bg-slate-900 text-white px-1 py-0.5 rounded block whitespace-nowrap">
                                    SCAN SCORER
                                  </span>
                                  <span className="text-[10px] font-black text-slate-900 block mt-0.5 tracking-tight">
                                    Target {sheet.targetNo}{sheet.position || ''}
                                  </span>
                                  <span className="text-[7px] text-slate-500 font-bold block truncate max-w-[55px]">
                                    #{sheet.archerId.slice(-4).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-1 border border-dashed border-slate-300 rounded text-center w-full h-[46px] bg-white">
                            <span className="text-[7px] font-black uppercase text-slate-400 leading-tight">BARCODE PESERTA</span>
                            <span className="text-[6px] text-slate-400 italic mt-0.5">(Isi Manual Lapangan)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SCORING TABLE */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider">
                          <th className="p-1.5 border-r border-slate-700 w-10">End</th>
                          {Array.from({ length: sheet.arrowsPerEnd }).map((_, aIdx) => (
                            <th key={aIdx} className="p-1.5 border-r border-slate-700">
                              {aIdx + 1}
                            </th>
                          ))}
                          <th className="p-1.5 border-r border-slate-700 w-14">Score</th>
                          <th className="p-1.5 border-r border-slate-700 w-16">Running</th>
                          <th className="p-1.5 border-r border-slate-700 w-9 font-mono bg-slate-800 text-amber-300">{scoringInfo.highCol1}</th>
                          <th className="p-1.5 border-r border-slate-700 w-9 font-mono bg-slate-800 text-amber-300">{scoringInfo.highCol2}</th>
                          <th className="p-1.5 w-12">Initials</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 font-mono text-[11px]">
                        {Array.from({ length: sheet.endsCount }).map((_, eIdx) => (
                          <tr key={eIdx} className={sheet.endsCount > 8 ? "h-7" : "h-8"}>
                            <td className="font-bold bg-slate-100 border-r border-slate-300 font-sans text-xs">
                              {eIdx + 1}
                            </td>
                            {Array.from({ length: sheet.arrowsPerEnd }).map((_, aIdx) => (
                              <td key={aIdx} className="border-r border-slate-300">
                                {/* Empty cell for score writing */}
                              </td>
                            ))}
                            <td className="border-r border-slate-300 font-bold bg-slate-50/50"></td>
                            <td className="border-r border-slate-300 font-bold bg-slate-50/50"></td>
                            <td className="border-r border-slate-300"></td>
                            <td className="border-r border-slate-300"></td>
                            <td></td>
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr className="bg-slate-100 font-bold h-9 border-t-2 border-slate-900 font-sans text-xs">
                          <td colSpan={sheet.arrowsPerEnd + 1} className="text-right pr-3 uppercase font-black tracking-wider">
                            TOTAL SKOR SESI ({sheet.endsCount * sheet.arrowsPerEnd} PANAH):
                          </td>
                          <td className="border-r border-slate-400 font-black text-sm"></td>
                          <td className="border-r border-slate-400 font-black text-sm"></td>
                          <td className="border-r border-slate-400 font-black text-center text-[9px] text-slate-500 font-mono"></td>
                          <td className="border-r border-slate-400 font-black text-center text-[9px] text-slate-500 font-mono"></td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* SIGNATURE & CONFIRMATION BOX */}
                  <div className="grid grid-cols-3 gap-3 pt-1 text-[10px] font-sans">
                    <div className="border border-slate-400 rounded-lg p-2 text-center h-18 flex flex-col justify-between">
                      <span className="font-black uppercase text-slate-600 block text-[8px]">Tanda Tangan Atlet</span>
                      <span className="border-b border-dotted border-slate-600 mx-3 mb-1"></span>
                      <span className="font-bold text-[8.5px] truncate">({sheet.archerName || 'Nama Atlet'})</span>
                    </div>

                    <div className="border border-slate-400 rounded-lg p-2 text-center h-18 flex flex-col justify-between">
                      <span className="font-black uppercase text-slate-600 block text-[8px]">Pencatat Skor (Scorer)</span>
                      <span className="border-b border-dotted border-slate-600 mx-3 mb-1"></span>
                      <span className="font-bold text-[8.5px]">( ............................................ )</span>
                    </div>

                    <div className="border border-slate-400 rounded-lg p-2 text-center h-18 flex flex-col justify-between">
                      <span className="font-black uppercase text-slate-600 block text-[8px]">Wasit Lapangan (Judge)</span>
                      <span className="border-b border-dotted border-slate-600 mx-3 mb-1"></span>
                      <span className="font-bold text-[8.5px]">( ............................................ )</span>
                    </div>
                  </div>

                  {/* Footer notes */}
                  <div className="flex justify-between items-center text-[7.5px] text-slate-500 font-medium pt-1 border-t border-slate-200">
                    <span>* Setiap koreksi angka skor WAJIB diparaf oleh Wasit (Judge). Scan barcode di pojok atas untuk penginputan cepat.</span>
                    <span>ARCUS Archery Tournament System</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrintScoreSheetsModal;
