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
  const [endsCount, setEndsCount] = useState<number>(6);
  const [arrowsPerEnd, setArrowsPerEnd] = useState<number>(6);

  if (!isOpen) return null;

  const tournamentName = event.settings?.tournamentName || 'Turnamen Panahan Arcus';
  const tournamentDate = event.settings?.eventDate || '-';
  const tournamentLocation = event.settings?.location || 'Indonesia';
  const eventLogo = event.settings?.logoUrl ? resolveGoogleDriveUrl(event.settings.logoUrl) : null;
  const secondaryLogo = event.settings?.secondaryLogoUrl ? resolveGoogleDriveUrl(event.settings.secondaryLogoUrl) : null;
  const clubLogo = event.settings?.clubLogoUrl ? resolveGoogleDriveUrl(event.settings.clubLogoUrl) : null;

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
    return Array.from(set);
  }, [event.archers]);

  // Sheets to render
  const sheetsToRender: Array<{
    id: string;
    archerName: string;
    club: string;
    category: string;
    targetNo?: number | string;
    position?: string;
  }> = useMemo(() => {
    if (sheetType === 'BLANK') {
      return Array.from({ length: blankCount }).map((_, idx) => ({
        id: `blank_${idx}`,
        archerName: '',
        club: '',
        category: selectedCategory === 'ALL' ? '' : (CATEGORY_LABELS[selectedCategory as CategoryType] || selectedCategory),
        targetNo: '',
        position: ''
      }));
    }

    if (filteredArchers.length === 0) {
      return [
        {
          id: 'sample_blank',
          archerName: '',
          club: '',
          category: selectedCategory === 'ALL' ? '' : (CATEGORY_LABELS[selectedCategory as CategoryType] || selectedCategory),
          targetNo: '',
          position: ''
        }
      ];
    }

    return filteredArchers.map(a => ({
      id: a.id,
      archerName: a.name,
      club: a.club || '-',
      category: CATEGORY_LABELS[a.category as CategoryType] || a.category,
      targetNo: a.targetNo || '',
      position: a.position || ''
    }));
  }, [sheetType, blankCount, filteredArchers, selectedCategory]);

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
                Format Standar World Archery / PERPANI dengan Kop Multi-Logo Turnamen
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
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-black uppercase text-slate-400">Format:</span>
            <select
              value={`${endsCount}x${arrowsPerEnd}`}
              onChange={e => {
                const [eCount, aCount] = e.target.value.split('x').map(Number);
                setEndsCount(eCount);
                setArrowsPerEnd(aCount);
              }}
              className="bg-slate-900 border border-slate-750 text-white rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:border-red-500"
            >
              <option value="6x6">6 Rambahan × 6 Panah (Total 36)</option>
              <option value="10x3">10 Rambahan × 3 Panah (Total 30)</option>
              <option value="5x3">5 Rambahan × 3 Panah (Aduan / 15)</option>
            </select>
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

                  {/* Right Logos: Organization / PERPANI + Arcus */}
                  <div className="flex items-center justify-end gap-2.5 max-w-[140px] shrink-0">
                    {secondaryLogo && (
                      <img 
                        src={secondaryLogo} 
                        alt="PERPANI Logo" 
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
                  </div>
                </div>

                {/* SCORING TABLE */}
                <div className="border border-slate-900 rounded overflow-hidden">
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider">
                        <th className="p-1.5 border-r border-slate-700 w-10">End</th>
                        {Array.from({ length: arrowsPerEnd }).map((_, aIdx) => (
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
                      {Array.from({ length: endsCount }).map((_, eIdx) => (
                        <tr key={eIdx} className="h-8">
                          <td className="font-bold bg-slate-100 border-r border-slate-300 font-sans text-xs">
                            {eIdx + 1}
                          </td>
                          {Array.from({ length: arrowsPerEnd }).map((_, aIdx) => (
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
                        <td colSpan={arrowsPerEnd + 1} className="text-right pr-3 uppercase font-black tracking-wider">
                          TOTAL SKOR SESI:
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
