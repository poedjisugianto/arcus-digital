import React from 'react';
import { Archer, CategoryType, TournamentSettings, TargetType } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { QRCodeSVG } from 'qrcode.react';

export type ScoringSheetSize = 'A4' | 'A5' | 'A6';

interface Props {
  settings: TournamentSettings;
  eventId: string;
  archer: Archer;
  isA6?: boolean;
  size?: ScoringSheetSize;
}

const ScoringSheet: React.FC<Props> = ({ 
  settings, 
  eventId, 
  archer, 
  isA6 = false, 
  size 
}) => {
  // Determine effective sheet size: 'A4' (1 per page), 'A5' (2 per page), or 'A6' (4 per page)
  const effectiveSize: ScoringSheetSize = size || (isA6 ? 'A6' : 'A4');

  const config = (settings.categoryConfigs || {})[archer.category as CategoryType] || { 
    arrows: 3, 
    ends: 6, 
    distance: '?', 
    targetType: TargetType.STANDARD 
  };

  const qrData = JSON.stringify({
    type: 'SCORING_SHEET',
    eventId: eventId,
    archerId: archer.id,
    targetNo: archer.targetNo,
    position: archer.position,
    wave: archer.wave
  });

  const highCol1Label = (config.targetType === TargetType.PUTA || config.targetType === TargetType.TRADITIONAL_PUTA)
    ? '2'
    : (config.targetType === TargetType.FACE_5_RING ? '5' : (config.targetType === TargetType.TRADITIONAL_6_RING ? '6' : '10/X'));

  const highCol2Label = (config.targetType === TargetType.PUTA || config.targetType === TargetType.TRADITIONAL_PUTA)
    ? '1'
    : (config.targetType === TargetType.FACE_5_RING ? '4' : (config.targetType === TargetType.TRADITIONAL_6_RING ? '5' : '9'));

  // -------------------------------------------------------------
  // 1. A6 MINI (4 PER A4 SHEET)
  // -------------------------------------------------------------
  if (effectiveSize === 'A6') {
    return (
      <div className="bg-white p-2.5 border border-black w-full h-full flex flex-col justify-between font-sans text-black relative box-border overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-black pb-1 mb-1">
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-5 h-5 bg-black flex items-center justify-center rounded shrink-0">
                <span className="text-white text-[10px] font-black italic">A</span>
              </div>
              <h1 className="text-[10px] font-black uppercase tracking-tight leading-tight truncate">
                {settings.tournamentName}
              </h1>
            </div>
            
            <div className="grid grid-cols-1 gap-0.5 mt-0.5 text-[8.5px]">
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-black uppercase text-slate-700 shrink-0 w-7">Nama</span>
                <span className="text-[9px] font-black uppercase border-b border-black flex-1 truncate pb-0.5">{archer.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-black uppercase text-slate-700 shrink-0 w-7">Klub</span>
                <span className="text-[9px] font-black uppercase border-b border-black flex-1 truncate pb-0.5">{archer.club || '-'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-black uppercase text-slate-700 shrink-0 w-7">Kelas</span>
                <span className="text-[8.5px] font-black uppercase border-b border-black flex-1 truncate pb-0.5 leading-none">{CATEGORY_LABELS[archer.category]} ({config.distance})</span>
              </div>
            </div>
          </div>
          
          <div className="text-right flex flex-col items-end gap-1 shrink-0">
            <div className="border border-black px-1.5 py-0.5 text-center min-w-[50px] bg-slate-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[6px] font-black uppercase tracking-wider leading-none">Bantalan</p>
              <p className="text-lg font-black italic font-oswald leading-none mt-0.5">{archer.targetNo}{archer.position}</p>
              <p className="text-[6px] font-black uppercase border-t border-black mt-0.5 pt-0.5 leading-none">Sesi {archer.wave}</p>
            </div>
            <div className="w-9 h-9 border border-black p-0.5 bg-white flex items-center justify-center">
              <QRCodeSVG value={qrData} size={32} level="M" />
            </div>
          </div>
        </div>

        {/* Scoring Table */}
        <table className="w-full border-collapse border border-black text-center my-0.5">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black py-0.5 w-5 font-black text-[8px]">R</th>
              {Array.from({ length: config.arrows }).map((_, i) => (
                <th key={i} className="border border-black py-0.5 font-black text-[8px]">A{i + 1}</th>
              ))}
              <th className="border border-black py-0.5 w-7 font-black text-[8px]">Tot</th>
              <th className="border border-black py-0.5 w-5 font-black text-[8px]">{highCol1Label}</th>
              <th className="border border-black py-0.5 w-5 font-black text-[8px]">{highCol2Label}</th>
              <th className="border border-black py-0.5 w-8 font-black text-[8px]">Kum.</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: config.ends }).map((_, endIdx) => (
              <tr key={endIdx} className="h-5 text-[9px]">
                <td className="border border-black font-black bg-slate-50">{endIdx + 1}</td>
                {Array.from({ length: config.arrows }).map((_, arrowIdx) => (
                  <td key={arrowIdx} className="border border-black"></td>
                ))}
                <td className="border border-black bg-slate-50"></td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black bg-slate-100 font-black"></td>
              </tr>
            ))}
            <tr className="h-5 font-black bg-slate-200">
              <td colSpan={config.arrows + 1} className="border border-black text-right pr-1 text-[7.5px] uppercase italic">TOTAL</td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black bg-black text-white text-[9px]"></td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-1 grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="h-5 border-b border-black mb-0.5"></div>
            <p className="text-[6px] font-black uppercase tracking-wider italic">Tanda Tangan Pemanah</p>
          </div>
          <div className="text-center">
            <div className="h-5 border-b border-black mb-0.5"></div>
            <p className="text-[6px] font-black uppercase tracking-wider italic">Scorer / Judge</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-1 pt-0.5 text-[6px] text-slate-700 font-bold flex justify-between items-center border-t border-slate-100">
          <p className="uppercase tracking-wider">ARCUS Archery</p>
          <p className="uppercase">#{archer.id ? archer.id.slice(-6).toUpperCase() : 'SCORESHEET'}</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. A5 HEMAT (2 PER A4 SHEET)
  // -------------------------------------------------------------
  if (effectiveSize === 'A5') {
    const rowHeightClass = config.ends > 8 ? "h-5 text-[9px]" : "h-6 text-[10px]";

    return (
      <div className="bg-white p-3.5 sm:p-4 border-2 border-black w-full h-full max-h-[141mm] flex flex-col justify-between font-sans text-black box-border overflow-hidden relative">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-1.5 mb-1.5 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-black flex items-center justify-center rounded shrink-0">
                <span className="text-white text-xs font-black italic">A</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-black font-oswald uppercase tracking-tight leading-tight truncate">
                  {settings.tournamentName}
                </h1>
                <p className="text-[8px] font-bold text-slate-700 uppercase tracking-wide truncate">
                  {settings.location} | {settings.eventDate}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 text-[9.5px]">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[7.5px] font-black uppercase text-slate-700 shrink-0 w-8">Nama</span>
                <span className="text-[10px] font-black uppercase border-b border-black flex-1 truncate pb-0.5">{archer.name}</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[7.5px] font-black uppercase text-slate-700 shrink-0 w-9">Klub</span>
                <span className="text-[10px] font-black uppercase border-b border-black flex-1 truncate pb-0.5">{archer.club || '-'}</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[7.5px] font-black uppercase text-slate-700 shrink-0 w-8">Kelas</span>
                <span className="text-[9px] font-black uppercase border-b border-black flex-1 truncate pb-0.5">{CATEGORY_LABELS[archer.category]}</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[7.5px] font-black uppercase text-slate-700 shrink-0 w-9">Jarak</span>
                <span className="text-[10px] font-black uppercase border-b border-black flex-1 truncate pb-0.5">{config.distance}</span>
              </div>
            </div>
          </div>

          <div className="text-right flex items-center gap-2 shrink-0">
            <div className="border-2 border-black p-1 text-center min-w-[65px] bg-slate-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[6.5px] font-black uppercase tracking-wider leading-none">Bantalan</p>
              <p className="text-2xl font-black italic font-oswald leading-none mt-0.5">{archer.targetNo}{archer.position}</p>
              <p className="text-[7px] font-black uppercase border-t border-black mt-0.5 pt-0.5 leading-none">Sesi {archer.wave}</p>
            </div>
            <div className="w-12 h-12 border border-black p-0.5 bg-white flex flex-col items-center justify-center">
              <QRCodeSVG value={qrData} size={42} level="M" />
            </div>
          </div>
        </div>

        {/* Scoring Table */}
        <table className="w-full border-collapse border border-black text-center my-0.5">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black py-0.5 w-6 font-black text-[9px]">R</th>
              {Array.from({ length: config.arrows }).map((_, i) => (
                <th key={i} className="border border-black py-0.5 font-black text-[9px]">A{i + 1}</th>
              ))}
              <th className="border border-black py-0.5 w-8 font-black text-[9px]">Tot</th>
              <th className="border border-black py-0.5 w-6 font-black text-[9px]">{highCol1Label}</th>
              <th className="border border-black py-0.5 w-6 font-black text-[9px]">{highCol2Label}</th>
              <th className="border border-black py-0.5 w-10 font-black text-[9px]">Kum.</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: config.ends }).map((_, endIdx) => (
              <tr key={endIdx} className={rowHeightClass}>
                <td className="border border-black font-black bg-slate-50">{endIdx + 1}</td>
                {Array.from({ length: config.arrows }).map((_, arrowIdx) => (
                  <td key={arrowIdx} className="border border-black"></td>
                ))}
                <td className="border border-black bg-slate-50"></td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black bg-slate-100 font-black"></td>
              </tr>
            ))}
            <tr className="h-6 font-black bg-slate-200">
              <td colSpan={config.arrows + 1} className="border border-black text-right pr-2 text-[8.5px] uppercase italic">TOTAL AKHIR</td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black bg-black text-white text-[11px]"></td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-1.5 grid grid-cols-2 gap-6">
          <div className="text-center">
            <div className="h-7 border-b border-black mb-0.5"></div>
            <p className="text-[7.5px] font-black uppercase tracking-wider italic">Tanda Tangan Pemanah</p>
          </div>
          <div className="text-center">
            <div className="h-7 border-b border-black mb-0.5"></div>
            <p className="text-[7.5px] font-black uppercase tracking-wider italic">Scorer / Judge Lapangan</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-1 pt-1 text-[7px] text-slate-700 font-bold flex justify-between items-center border-t border-slate-200">
          <p className="uppercase tracking-widest">ARCUS Digital Archery • Lembar Skor Resmi A5</p>
          <p className="uppercase">ID: #{archer.id ? archer.id.slice(-6).toUpperCase() : 'SCORESHEET'}</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. A4 STANDAR PAS (1 PER HALAMAN PENUH - ANTI TERPOTONG)
  // -------------------------------------------------------------
  // Proportional row height based on number of ends to guarantee 100% single page fit
  const rowHeightClass = config.ends > 9 
    ? "h-6 text-[10px]" 
    : config.ends > 6 
    ? "h-7 sm:h-8 text-xs" 
    : "h-8 sm:h-9 text-xs sm:text-sm";

  return (
    <div className="bg-white p-5 sm:p-6 border-2 border-black w-full max-w-[210mm] h-[288mm] max-h-[288mm] mx-auto font-sans text-black box-border flex flex-col justify-between overflow-hidden relative print:border-2 print:m-0 print:p-4 print:h-[285mm] print:max-h-[285mm]">
      {/* Decorative Book Edge */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-100 border-r border-slate-300 print:hidden"></div>

      {/* Header */}
      <div className="border-b-2 border-black pb-2.5 mb-2">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 bg-black flex items-center justify-center rounded-md shrink-0">
                <span className="text-white text-base font-black italic">A</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-black font-oswald uppercase tracking-tight leading-tight truncate">
                  {settings.tournamentName}
                </h1>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider truncate">
                  {settings.location} | {settings.eventDate}
                </p>
              </div>
            </div>

            {/* Archer Data in Clean 2x2 Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
              <div className="flex items-center gap-2 border-b border-black pb-0.5">
                <span className="text-[9px] font-black uppercase text-slate-600 shrink-0 w-14">Nama</span>
                <span className="text-xs sm:text-sm font-black uppercase text-slate-900 truncate flex-1">{archer.name}</span>
              </div>
              <div className="flex items-center gap-2 border-b border-black pb-0.5">
                <span className="text-[9px] font-black uppercase text-slate-600 shrink-0 w-14">Klub</span>
                <span className="text-xs sm:text-sm font-black uppercase text-slate-900 truncate flex-1">{archer.club || '-'}</span>
              </div>
              <div className="flex items-center gap-2 border-b border-black pb-0.5">
                <span className="text-[9px] font-black uppercase text-slate-600 shrink-0 w-14">Kategori</span>
                <span className="text-xs sm:text-sm font-black uppercase text-slate-900 truncate flex-1">{CATEGORY_LABELS[archer.category]}</span>
              </div>
              <div className="flex items-center gap-2 border-b border-black pb-0.5">
                <span className="text-[9px] font-black uppercase text-slate-600 shrink-0 w-14">Jarak</span>
                <span className="text-xs sm:text-sm font-black uppercase text-slate-900 truncate flex-1">{config.distance}</span>
              </div>
            </div>
          </div>

          {/* Right Badges: Bantalan & Scorer QR Code */}
          <div className="text-right flex items-center gap-2.5 shrink-0 pl-1">
            <div className="border-2 border-black p-1.5 text-center min-w-[85px] bg-slate-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[7.5px] font-black uppercase tracking-widest leading-none">Bantalan</p>
              <p className="text-3xl font-black italic font-oswald leading-none mt-0.5">{archer.targetNo}{archer.position}</p>
              <p className="text-[8.5px] font-black uppercase border-t border-black mt-1 pt-0.5 leading-none">Sesi {archer.wave}</p>
            </div>
            <div className="w-18 h-18 border border-black p-1 bg-white flex flex-col items-center justify-center">
              <QRCodeSVG value={qrData} size={62} level="M" />
              <p className="text-[6.5px] font-black uppercase tracking-tight bg-black text-white px-1 py-0.2 mt-0.5 leading-none">
                Scan Skor
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scoring Table */}
      <div className="my-auto">
        <table className="w-full border-collapse border-2 border-black text-center scoresheet-table">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black py-1.5 w-10 font-black text-xs">R</th>
              {Array.from({ length: config.arrows }).map((_, i) => (
                <th key={i} className="border border-black py-1.5 font-black text-xs">A{i + 1}</th>
              ))}
              <th className="border border-black py-1.5 w-12 font-black text-xs">Tot</th>
              <th className="border border-black py-1.5 w-10 font-black text-xs">{highCol1Label}</th>
              <th className="border border-black py-1.5 w-10 font-black text-xs">{highCol2Label}</th>
              <th className="border border-black py-1.5 w-14 font-black text-xs">Kum.</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: config.ends }).map((_, endIdx) => (
              <tr key={endIdx} className={rowHeightClass}>
                <td className="border border-black font-black bg-slate-50">{endIdx + 1}</td>
                {Array.from({ length: config.arrows }).map((_, arrowIdx) => (
                  <td key={arrowIdx} className="border border-black"></td>
                ))}
                <td className="border border-black bg-slate-50"></td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black bg-slate-100 font-black"></td>
              </tr>
            ))}
            <tr className="h-8 sm:h-9 font-black bg-slate-200">
              <td colSpan={config.arrows + 1} className="border border-black text-right pr-4 text-xs sm:text-sm uppercase italic">TOTAL AKHIR</td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black bg-black text-white text-base"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signatures */}
      <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-16 sm:gap-24">
        <div className="text-center">
          <div className="h-12 sm:h-14 border-b-2 border-black mb-1"></div>
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider italic">Tanda Tangan Pemanah</p>
        </div>
        <div className="text-center">
          <div className="h-12 sm:h-14 border-b-2 border-black mb-1"></div>
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider italic">Scorer / Judge Lapangan</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-1.5 text-[8.5px] text-slate-600 font-bold flex justify-between items-center border-t border-slate-200">
        <div>
          <p className="uppercase tracking-widest font-black text-slate-800">ARCUS Digital Archery • Official Scoresheet</p>
          <p className="text-[7.5px] text-slate-500 mt-0.5">Dicetak pada {new Date().toLocaleString('id-ID')}</p>
        </div>
        <div className="text-right">
          <p className="uppercase font-mono">ID: #{archer.id ? archer.id.slice(-8).toUpperCase() : 'SCORESHEET'}</p>
          <p className="text-[7.5px] text-slate-500 mt-0.5">Sistem Skoring Terintegrasi v3.0</p>
        </div>
      </div>
    </div>
  );
};

export default ScoringSheet;
