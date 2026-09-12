import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Target, Trophy, Filter, Users, 
  CheckCircle2, AlertCircle, FileText, Download, ShieldCheck
} from 'lucide-react';
import { ArcheryEvent, CategoryType, Archer } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { resolveGoogleDriveUrl } from '../lib/photoService';
import ArcusLogo from './ArcusLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: ArcheryEvent;
}

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

  if (!isOpen) return null;

  const tournamentName = event.settings?.tournamentName || 'Turnamen Panahan Arcus';
  const tournamentDate = event.settings?.eventDate || '-';
  const tournamentLocation = event.settings?.location || 'Indonesia';
  const eventLogo = event.settings?.logoUrl ? resolveGoogleDriveUrl(event.settings.logoUrl) : null;
  const secondaryLogo = event.settings?.secondaryLogoUrl ? resolveGoogleDriveUrl(event.settings.secondaryLogoUrl) : null;
  const clubLogo = event.settings?.clubLogoUrl ? resolveGoogleDriveUrl(event.settings.clubLogoUrl) : null;

  // Helper to extract category configuration from Admin settings
  const getCategoryConfig = (cat?: string) => {
    if (!cat) return null;
    return event.settings?.categoryConfigs?.[cat as CategoryType] || null;
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

  // Sheets to render with per-category ends and arrows
  const sheetsToRender: Array<{
    id: string;
    archerName: string;
    club: string;
    category: string;
    rawCategory?: string;
    distance?: string;
    targetNo?: number | string;
    position?: string;
    endsCount: number;
    arrowsPerEnd: number;
  }> = useMemo(() => {
    if (sheetType === 'BLANK') {
      const targetCat = selectedCategory !== 'ALL' ? selectedCategory : (categories[0] || undefined);
      const format = getEffectiveFormat(targetCat);
      const catConfig = getCategoryConfig(targetCat);

      return Array.from({ length: blankCount }).map((_, idx) => ({
        id: `blank_${idx}`,
        archerName: '',
        club: '',
        category: selectedCategory === 'ALL' ? '' : (CATEGORY_LABELS[selectedCategory as CategoryType] || selectedCategory),
        rawCategory: selectedCategory === 'ALL' ? undefined : selectedCategory,
        distance: catConfig?.distance || '',
        targetNo: '',
        position: '',
        endsCount: format.ends,
        arrowsPerEnd: format.arrows
      }));
    }

    if (filteredArchers.length === 0) {
      const targetCat = selectedCategory !== 'ALL' ? selectedCategory : (categories[0] || undefined);
      const format = getEffectiveFormat(targetCat);
      const catConfig = getCategoryConfig(targetCat);

      return [
        {
          id: 'sample_blank',
          archerName: '',
          club: '',
          category: selectedCategory === 'ALL' ? '' : (CATEGORY_LABELS[selectedCategory as CategoryType] || selectedCategory),
          rawCategory: selectedCategory === 'ALL' ? undefined : selectedCategory,
          distance: catConfig?.distance || '',
          targetNo: '',
          position: '',
          endsCount: format.ends,
          arrowsPerEnd: format.arrows
        }
      ];
    }

    return filteredArchers.map(a => {
      const format = getEffectiveFormat(a.category);
      const catConfig = getCategoryConfig(a.category);

      return {
        id: a.id,
        archerName: a.name,
        club: a.club || '-',
        category: CATEGORY_LABELS[a.category as CategoryType] || a.category,
        rawCategory: a.category,
        distance: catConfig?.distance || '',
        targetNo: a.targetNo || '',
        position: a.position || '',
        endsCount: format.ends,
        arrowsPerEnd: format.arrows
      };
    });
  }, [sheetType, blankCount, filteredArchers, selectedCategory, formatMode, customEnds, customArrows, event.settings?.categoryConfigs, categories]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto no-print animate-in fade-in duration-300">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
          body {
            background: white !important;
            color: black !important;
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
            padding: 4mm;
            border: 2px solid #000;
            margin-bottom: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Modal Top Control Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-950/60 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black font-oswald uppercase tracking-wide italic">
                Cetak Lembar Skor Resmi (Score Sheet)
              </h3>
              <p className="text-[10px] text-slate-400">
                Format Standar World Archery / INORGA dengan Kop Multi-Logo Turnamen
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
              />
            </div>
          )}

          {/* Ends & Arrows Config */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <span className="text-[10px] font-black uppercase text-slate-400">Format Lembar Skor:</span>
            <select
              value={formatMode}
              onChange={e => setFormatMode(e.target.value as any)}
              className="bg-slate-900 border border-slate-750 text-white rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:border-red-500"
            >
              <option value="AUTO">
                {selectedCategory !== 'ALL'
                  ? `🎯 Sesuai Kategori (${getEffectiveFormat(selectedCategory).ends} Rambahan × ${getEffectiveFormat(selectedCategory).arrows} Panah)`
                  : '🎯 Otomatis Sesuai Kategori (Dashboard Admin)'}
              </option>
              <option value="6x6">Manual: 6 Rambahan × 6 Panah (Total 36)</option>
              <option value="10x3">Manual: 10 Rambahan × 3 Panah (Total 30)</option>
              <option value="6x3">Manual: 6 Rambahan × 3 Panah (Total 18)</option>
              <option value="5x3">Manual: 5 Rambahan × 3 Panah (Aduan / 15)</option>
              <option value="CUSTOM">Manual: Custom (Tentukan Sendiri)...</option>
            </select>

            {/* Custom Ends & Arrows Inputs when CUSTOM is picked */}
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

            {/* Auto Mode Info Tag */}
            {formatMode === 'AUTO' && (
              <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-red-950/60 border border-red-500/30 text-red-300 rounded-lg hidden sm:inline-block">
                {selectedCategory !== 'ALL'
                  ? `${getEffectiveFormat(selectedCategory).ends} Rambahan × ${getEffectiveFormat(selectedCategory).arrows} Panah`
                  : 'Sinkron Kategori Masing-masing'}
              </span>
            )}
          </div>
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/40">
          <div id="printable-scoresheets-container" className="space-y-6 max-w-3xl mx-auto">
            {sheetsToRender.map((sheet, index) => (
              <div 
                key={sheet.id || index}
                className="scoresheet-page bg-white text-slate-950 p-5 sm:p-6 rounded-2xl shadow-xl border-2 border-slate-900 space-y-4"
              >
                {/* OFFICIAL MULTI-LOGO KOP DOKUMEN */}
                <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3 gap-3">
                  {/* Left Logos: Event Logo + Club Logo */}
                  <div className="flex items-center gap-2.5 max-w-[140px] shrink-0">
                    {eventLogo ? (
                      <img 
                        src={eventLogo} 
                        alt="Event Logo" 
                        className="h-12 max-w-[70px] object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center font-black font-oswald text-red-600 text-xs text-center leading-none p-1">
                        EVENT LOGO
                      </div>
                    )}

                    {clubLogo && (
                      <img 
                        src={clubLogo} 
                        alt="Club Logo" 
                        className="h-11 max-w-[65px] object-contain"
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
                    <div className="mt-1 inline-block px-3 py-0.5 bg-slate-900 text-white rounded font-black text-[9px] uppercase tracking-widest font-mono">
                      OFFICIAL SCORE SHEET
                    </div>
                  </div>

                  {/* Right Logos: Organization / INORGA + Arcus */}
                  <div className="flex items-center justify-end gap-2.5 max-w-[140px] shrink-0">
                    {secondaryLogo && (
                      <img 
                        src={secondaryLogo} 
                        alt="Logo INORGA" 
                        className="h-11 max-w-[65px] object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <ArcusLogo className="h-10 w-10 shrink-0" />
                  </div>
                </div>

                {/* Athlete Metadata Box */}
                <div className="grid grid-cols-4 gap-2 text-xs border border-slate-900 p-2.5 rounded-lg bg-slate-50/70 font-sans">
                  <div className="border-r border-slate-300 pr-2">
                    <span className="text-[7.5px] font-black text-slate-600 uppercase block leading-none">Target / Bantalan</span>
                    <span className="text-sm sm:text-base font-black font-oswald text-red-600 block">
                      {sheet.targetNo ? `Target ${sheet.targetNo}${sheet.position || ''}` : '.........................'}
                    </span>
                  </div>
                  <div className="border-r border-slate-300 pr-2 col-span-2">
                    <span className="text-[7.5px] font-black text-slate-600 uppercase block leading-none">Nama Atlet</span>
                    <span className="text-xs sm:text-sm font-black uppercase text-slate-900 truncate block">
                      {sheet.archerName || '...................................................'}
                    </span>
                    <span className="text-[9px] text-slate-600 uppercase font-bold block truncate">
                      Klub: {sheet.club || '...........................................'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[7.5px] font-black text-slate-600 uppercase block leading-none">Kategori</span>
                    <span className="text-[10px] sm:text-xs font-black uppercase text-slate-900 leading-tight block">
                      {sheet.category || '......................................'}
                    </span>
                    <span className="text-[8px] font-black text-red-600 uppercase tracking-tight block mt-0.5">
                      {sheet.endsCount} Rambahan × {sheet.arrowsPerEnd} Panah {sheet.distance ? `• Jarak ${sheet.distance}` : ''}
                    </span>
                  </div>
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
                        <th className="p-1.5 border-r border-slate-700 w-9">10</th>
                        <th className="p-1.5 border-r border-slate-700 w-9">X</th>
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
                              {/* Empty box for score writing */}
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
                        <td className="border-r border-slate-400 font-black"></td>
                        <td className="border-r border-slate-400 font-black"></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* SIGNATURE & CONFIRMATION BOX */}
                <div className="grid grid-cols-3 gap-3 pt-2 text-[10px] font-sans">
                  <div className="border border-slate-400 rounded-lg p-2 text-center h-20 flex flex-col justify-between">
                    <span className="font-black uppercase text-slate-600 block text-[8px]">Tanda Tangan Atlet</span>
                    <span className="border-b border-dotted border-slate-600 mx-3 mb-1"></span>
                    <span className="font-bold text-[8.5px] truncate">({sheet.archerName || 'Nama Atlet'})</span>
                  </div>

                  <div className="border border-slate-400 rounded-lg p-2 text-center h-20 flex flex-col justify-between">
                    <span className="font-black uppercase text-slate-600 block text-[8px]">Pencatat Skor (Scorer)</span>
                    <span className="border-b border-dotted border-slate-600 mx-3 mb-1"></span>
                    <span className="font-bold text-[8.5px]">( ............................................ )</span>
                  </div>

                  <div className="border border-slate-400 rounded-lg p-2 text-center h-20 flex flex-col justify-between">
                    <span className="font-black uppercase text-slate-600 block text-[8px]">Wasit Lapangan (Judge)</span>
                    <span className="border-b border-dotted border-slate-600 mx-3 mb-1"></span>
                    <span className="font-bold text-[8.5px]">( ............................................ )</span>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="flex justify-between items-center text-[7.5px] text-slate-500 font-medium pt-1 border-t border-slate-200">
                  <span>* Setiap koreksi angka skor WAJIB diparaf oleh Wasit (Judge).</span>
                  <span>ARCUS Archery Tournament System</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrintScoreSheetsModal;
