import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Printer, Image as ImageIcon, Plus, Trash2, 
  Settings, User, MapPin, Calendar, Layout, Download,
  Type, Move, Maximize, Activity, CreditCard, ShieldCheck, Star, Trophy, Crown, Crosshair, Target,
  Barcode as BarcodeIcon, QrCode, Upload, Eye, EyeOff, Sliders, Palette, Check, Sparkles, RefreshCw, Layers, FileImage, HelpCircle
} from 'lucide-react';
import { Archer, TournamentSettings, CategoryType } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { Barcode } from './Barcode';
import { safeFormatDate } from '../lib/dateUtils';

interface Props {
  archers: Archer[];
  settings: TournamentSettings;
  onBack: () => void;
}

interface Logo {
  id: string;
  url: string;
  name: string;
  x: number;
  y: number;
  size: number;
}

type BgPattern = 'CLEAN' | 'SPORTY_MESH' | 'DIAGONAL_SPEED' | 'DYNAMIC_WAVES' | 'CARBON' | 'HERITAGE_PAPER' | 'BAMBOO_WEAVE' | 'ETHNIC_MODERN' | 'SPORTY_BURST';
type CardTheme = 'SPORTY_MODERN' | 'TRADITIONAL_LEGACY' | 'STEALTH_ELITE' | 'ASYMETRIC_PRO' | 'GLORY_ULTIMATE' | 'CHAMPION_ELITE' | 'PRO_ARCHER_X';
type DesignMode = 'TEMPLATE' | 'CUSTOM_UPLOAD';

export interface CustomCardConfig {
  athleteBgUrl: string | null;
  officialBgUrl: string | null;
  useSeparateOfficialBg: boolean;
  textColorMode: 'LIGHT' | 'DARK';
  accentColor: string;
  showHeader: boolean;
  showFooter: boolean;
  showPhoto: boolean;
  photoShape: 'ROUNDED' | 'SQUIRCLE' | 'CIRCLE' | 'SQUARE';
  photoSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  showName: boolean;
  showClub: boolean;
  showCategory: boolean;
  showTargetSession: boolean;
  showCode: boolean;
  codeType: 'BARCODE_128' | 'QR_CODE';
  codeBg: 'WHITE_SOLID' | 'WHITE_GLASS' | 'TRANSPARENT';
  verticalOffset: number; // in percent (-30 to +30)
  contentAlignment: 'CENTER' | 'LEFT';
  cardPadding: number; // in px
  nameFontSize: 'MEDIUM' | 'LARGE' | 'XLARGE';
}

const DEFAULT_CUSTOM_CONFIG: CustomCardConfig = {
  athleteBgUrl: null,
  officialBgUrl: null,
  useSeparateOfficialBg: false,
  textColorMode: 'LIGHT',
  accentColor: '#f59e0b',
  showHeader: false, // Default false because custom designs usually have headers pre-designed
  showFooter: false, // Default false because custom designs usually have footers pre-designed
  showPhoto: true,
  photoShape: 'ROUNDED',
  photoSize: 'MEDIUM',
  showName: true,
  showClub: true,
  showCategory: true,
  showTargetSession: true,
  showCode: true,
  codeType: 'BARCODE_128',
  codeBg: 'WHITE_SOLID',
  verticalOffset: 0,
  contentAlignment: 'CENTER',
  cardPadding: 24,
  nameFontSize: 'LARGE'
};

const IdCardEditor: React.FC<Props> = ({ archers, settings, onBack }) => {
  const storageKey = useMemo(() => {
    return `arcus_idcard_config_${settings?.tournamentName ? encodeURIComponent(settings.tournamentName) : 'default'}`;
  }, [settings?.tournamentName]);

  // Design Mode: Preset Template vs Custom Upload
  const [designMode, setDesignMode] = useState<DesignMode>('TEMPLATE');
  
  // Custom Card Configuration
  const [customConfig, setCustomConfig] = useState<CustomCardConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return { ...DEFAULT_CUSTOM_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Could not load custom ID card config from localStorage", e);
    }
    return DEFAULT_CUSTOM_CONFIG;
  });

  // Preset Template States
  const [logos, setLogos] = useState<Logo[]>([]);
  const [cardTitle, setCardTitle] = useState(settings?.tournamentName || 'KARTU PESERTA');
  const [cardSubtitle, setCardSubtitle] = useState(settings?.location || 'ARCUS ARCHERY TOURNAMENT');
  const [cardDate, setCardDate] = useState(safeFormatDate(settings?.eventDate, { day: 'numeric', month: 'long', year: 'numeric' }));
  const [accentColor, setAccentColor] = useState('#ef4444');
  const [bgPattern, setBgPattern] = useState<BgPattern>('SPORTY_MESH');
  const [cardTheme, setCardTheme] = useState<CardTheme>('SPORTY_MODERN');
  const [barcodeFormat, setBarcodeFormat] = useState<'BARCODE_128' | 'QR_CODE'>('BARCODE_128');
  const [showEditor, setShowEditor] = useState(true);
  const [viewMode, setViewMode] = useState<'DESIGNER' | 'FULL_PREVIEW'>('DESIGNER');
  
  // File inputs for custom backgrounds & logos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const athleteBgInputRef = useRef<HTMLInputElement>(null);
  const officialBgInputRef = useRef<HTMLInputElement>(null);

  // Save custom config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(customConfig));
    } catch (e) {
      console.warn("Could not save custom ID card config", e);
    }
  }, [customConfig, storageKey]);

  const participants = useMemo(() => archers.filter(a => a.category !== CategoryType.OFFICIAL), [archers]);
  const officials = useMemo(() => archers.filter(a => a.category === CategoryType.OFFICIAL), [archers]);

  const handleAthleteBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomConfig(prev => ({
            ...prev,
            athleteBgUrl: event.target?.result as string
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOfficialBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomConfig(prev => ({
            ...prev,
            officialBgUrl: event.target?.result as string
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newLogo: Logo = {
            id: 'logo_' + Math.random().toString(36).substr(2, 9),
            url: event.target.result as string,
            name: file.name,
            x: 20,
            y: 20,
            size: 60
          };
          setLogos([...logos, newLogo]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = (id: string) => {
    setLogos(logos.filter(l => l.id !== id));
  };

  const handlePrint = () => {
    setShowEditor(false);
    setTimeout(() => {
      window.print();
      setShowEditor(true);
    }, 500);
  };

  const getPatternStyles = (pattern: BgPattern, color: string) => {
    switch (pattern) {
      case 'SPORTY_MESH':
        return {
          backgroundImage: `radial-gradient(${color}22 1px, transparent 1px)`,
          backgroundSize: '10px 10px'
        };
      case 'DIAGONAL_SPEED':
        return {
          backgroundImage: `repeating-linear-gradient(45deg, ${color}08, ${color}08 10px, transparent 10px, transparent 20px)`
        };
      case 'DYNAMIC_WAVES':
        return {
          backgroundImage: `linear-gradient(135deg, ${color}05 25%, transparent 25%), linear-gradient(225deg, ${color}05 25%, transparent 25%)`,
          backgroundSize: '40px 40px'
        };
      case 'CARBON':
        return {
          backgroundColor: '#f8fafc',
          backgroundImage: `linear-gradient(45deg, ${color}05 25%, transparent 25%, transparent 75%, ${color}05 75%, ${color}05), linear-gradient(45deg, ${color}05 25%, transparent 25%, transparent 75%, ${color}05 75%, ${color}05)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px'
        };
      case 'HERITAGE_PAPER':
        return {
          backgroundColor: '#fdf6e3',
          backgroundImage: `url("https://www.transparenttextures.com/patterns/pinstripe-light.png"), radial-gradient(${color}11 1px, transparent 1px)`,
          backgroundSize: 'auto, 20px 20px'
        };
      case 'BAMBOO_WEAVE':
        return {
          backgroundColor: '#f4f4f5',
          backgroundImage: `linear-gradient(90deg, ${color}08 1px, transparent 1px), linear-gradient(${color}08 1px, transparent 1px)`,
          backgroundSize: '15px 15px'
        };
      case 'ETHNIC_MODERN':
        return {
          backgroundColor: '#ffffff',
          backgroundImage: `repeating-linear-gradient(45deg, ${color}05 0px, ${color}05 2px, transparent 2px, transparent 8px), repeating-linear-gradient(-45deg, ${color}05 0px, ${color}05 2px, transparent 2px, transparent 8px)`,
          backgroundSize: '20px 20px'
        };
      case 'SPORTY_BURST':
        return {
          backgroundImage: `linear-gradient(120deg, ${color}11 0%, transparent 50%), linear-gradient(-120deg, ${color}08 0%, transparent 50%), repeating-linear-gradient(45deg, transparent, transparent 15px, ${color}05 15px, ${color}05 16px)`
        };
      default:
        return {};
    }
  };

  // Render Custom Card with user uploaded background and dynamic overlay
  const renderCustomCard = (person: Archer, isOfficial: boolean) => {
    const bgUrl = isOfficial 
      ? (customConfig.useSeparateOfficialBg && customConfig.officialBgUrl ? customConfig.officialBgUrl : customConfig.athleteBgUrl)
      : customConfig.athleteBgUrl;

    const isLightText = customConfig.textColorMode === 'LIGHT';
    const textPrimary = isLightText ? 'text-white' : 'text-slate-900';
    const textSecondary = isLightText ? 'text-slate-200' : 'text-slate-600';
    const textMuted = isLightText ? 'text-slate-600/80' : 'text-slate-700';
    const textAccent = customConfig.accentColor;

    // Photo styling
    const photoShapeClasses = {
      ROUNDED: 'rounded-2xl',
      SQUIRCLE: 'rounded-[1.75rem]',
      CIRCLE: 'rounded-full aspect-square',
      SQUARE: 'rounded-none'
    }[customConfig.photoShape];

    const photoSizeClasses = {
      SMALL: 'w-[70px] h-[90px]',
      MEDIUM: 'w-[84px] h-[110px]',
      LARGE: 'w-[100px] h-[130px]'
    }[customConfig.photoSize];

    const nameSizeClasses = {
      MEDIUM: 'text-2xl',
      LARGE: 'text-3xl sm:text-4xl',
      XLARGE: 'text-4xl sm:text-5xl'
    }[customConfig.nameFontSize];

    return (
      <div 
        key={person.id} 
        className="w-full aspect-[2/3] border border-slate-200 overflow-hidden flex flex-col break-inside-avoid shadow-sm print:shadow-none relative transition-all duration-300 bg-slate-900 select-none"
        style={{
          backgroundImage: bgUrl ? `url("${bgUrl}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Placeholder if no background is uploaded yet */}
        {!bgUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-6 text-center z-0">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <FileImage className="w-8 h-8 text-white/80" />
            </div>
            <p className="text-white text-xs font-bold uppercase tracking-wider">Belum Ada Background</p>
            <p className="text-[9px] text-white/90 mt-1 max-w-[200px]">Upload desain latar (rasio 2:3) pada panel kontrol di sebelah kiri.</p>
          </div>
        )}

        {/* Optional Header Banner */}
        {customConfig.showHeader && (
          <div className="p-4 flex items-center justify-between relative z-10 bg-black/20 backdrop-blur-xs">
            <div className="flex -space-x-2">
              {logos.map(logo => (
                <img 
                  key={logo.id} 
                  src={logo.url} 
                  alt="" 
                  style={{ maxHeight: logo.size / 2, width: 'auto' }}
                  className="object-contain ring-2 ring-white rounded-lg bg-white shadow-lg"
                />
              ))}
              {logos.length === 0 && <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{cardTitle}</span>}
            </div>
            <div className="text-right">
              <div className="text-[9px] font-mono font-bold text-white/80">{person.id.substring(0, 8)}</div>
            </div>
          </div>
        )}

        {/* Dynamic Content Overlay with vertical offset */}
        <div 
          className={`flex-1 flex flex-col justify-center p-5 relative z-10 ${customConfig.contentAlignment === 'CENTER' ? 'items-center text-center' : 'items-start text-left'}`}
          style={{
            transform: `translateY(${customConfig.verticalOffset * 2}px)`,
            padding: `${customConfig.cardPadding}px`
          }}
        >
          {/* Athlete / Official Identifier Pill */}
          {customConfig.showCategory && (
            <div className="mb-3">
              <span 
                className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-md inline-block text-white"
                style={{ backgroundColor: isOfficial ? '#2563eb' : textAccent }}
              >
                {isOfficial ? 'OFFICIAL CREW' : person.category}
              </span>
            </div>
          )}

          {/* Name & Club Area */}
          <div className="space-y-1 w-full mb-4">
            {customConfig.showName && (
              <h1 className={`${nameSizeClasses} font-black font-oswald uppercase italic leading-none drop-shadow-md tracking-tight ${textPrimary}`}>
                <span className="block">{person.name.split(' ')[0]}</span>
                <span className="block mt-0.5" style={{ color: textAccent }}>
                  {person.name.split(' ').slice(1).join(' ')}
                </span>
              </h1>
            )}
            {customConfig.showClub && (
              <p className={`text-xs font-black uppercase tracking-wider drop-shadow-sm ${textSecondary}`}>
                {person.club || 'INDEPENDENT'}
              </p>
            )}
          </div>

          {/* Photo & Barcode/QR Section */}
          <div className="flex items-center justify-center gap-3 my-2 w-full">
            {/* Athlete Photo */}
            {customConfig.showPhoto && (
              <div className={`p-1 ${photoShapeClasses} ${photoSizeClasses} overflow-hidden relative shadow-xl border-2 flex items-center justify-center shrink-0 bg-white/10 backdrop-blur-sm`}
                style={{ borderColor: textAccent }}
              >
                {person.photoUrl ? (
                  <img src={person.photoUrl} alt="" className={`w-full h-full object-cover ${photoShapeClasses}`} />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-slate-600">
                    <User className="w-8 h-8 opacity-60" />
                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 opacity-80">NO PHOTO</span>
                  </div>
                )}
              </div>
            )}

            {/* Code: Barcode 1D or QR Code */}
            {customConfig.showCode && (
              <div className={`shrink-0 ${
                customConfig.codeBg === 'WHITE_SOLID' 
                  ? 'bg-white p-2 rounded-2xl shadow-lg border border-slate-200' 
                  : customConfig.codeBg === 'WHITE_GLASS'
                  ? 'bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-white/40'
                  : 'p-1'
              }`}>
                {customConfig.codeType === 'QR_CODE' ? (
                  <div className="flex flex-col items-center">
                    <QRCodeSVG value={person.id} size={customConfig.photoSize === 'LARGE' ? 84 : 70} level="H" />
                    <span className="text-[7px] font-mono font-bold text-slate-800 mt-1 uppercase">{person.id.substring(0, 8)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-[130px]">
                    <Barcode 
                      value={person.id}
                      width={1.1}
                      height={34}
                      fontSize={8}
                      displayValue={true}
                      text={person.registrationNo || person.id.substring(0, 10)}
                      background="transparent"
                      lineColor="#0f172a"
                    />
                    <span className="text-[7px] font-mono font-bold text-slate-600 uppercase tracking-tight">
                      {person.targetNo ? `T-${person.targetNo}${person.position}` : 'E-ID PASS'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Target & Session Badge (For non-officials) */}
          {customConfig.showTargetSession && !isOfficial && (
            <div className="mt-3 w-full max-w-[240px] grid grid-cols-2 gap-2 bg-black/40 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 shadow-lg">
              <div className="text-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 block">Target</span>
                <span className="text-xl font-black text-white" style={{ color: textAccent }}>
                  {person.targetNo ? `${person.targetNo}${person.position || ''}` : '-'}
                </span>
              </div>
              <div className="text-center border-l border-white/10">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 block">Sesi / Gelombang</span>
                <span className="text-xl font-black text-white">
                  {person.wave || '1'}
                </span>
              </div>
            </div>
          )}

          {/* Official Verification Badge */}
          {isOfficial && (
            <div className="mt-3 w-full max-w-[240px] bg-blue-600/30 backdrop-blur-md p-2 rounded-2xl border border-blue-400/30 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-white">Verified Official</span>
            </div>
          )}
        </div>

        {/* Optional Footer Banner */}
        {customConfig.showFooter && (
          <div className="p-3 bg-black/40 backdrop-blur-xs text-center border-t border-white/10 relative z-10">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/80">
              • {cardSubtitle} •
            </span>
          </div>
        )}
      </div>
    );
  };

  // Render Preset Template Card
  const renderTemplateCard = (person: Archer, isOfficial: boolean) => {
    const isLegacy = cardTheme === 'TRADITIONAL_LEGACY';
    const isStealth = cardTheme === 'STEALTH_ELITE';
    const isAsymmetric = cardTheme === 'ASYMETRIC_PRO';
    const isGlory = cardTheme === 'GLORY_ULTIMATE';
    const isChampion = cardTheme === 'CHAMPION_ELITE';
    const isProX = cardTheme === 'PRO_ARCHER_X';
    
    const cardAccent = isStealth ? '#E61E2A' : (isOfficial ? (isLegacy ? '#78350f' : '#2563eb') : accentColor);
    const textPrimary = (isStealth || isChampion || isProX) ? 'text-white' : 'text-slate-900';
    const textSecondary = (isStealth || isChampion || isProX) ? 'text-slate-100/70' : 'text-slate-600';
    const bgBase = isStealth ? 'bg-[#0a0a0a]' : isChampion ? 'bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900' : isProX ? 'bg-[#0f172a]' : 'bg-white';

    return (
      <div key={person.id} className={`w-full aspect-[2/3] border border-slate-200 overflow-hidden flex flex-col break-inside-avoid shadow-sm print:shadow-none relative transition-all duration-700 ${bgBase}`}>
        {/* Pattern Layer */}
        {!isChampion && !isProX && <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={getPatternStyles(bgPattern, cardAccent)} />}
        
        {/* Pro Archer X specific Graphics */}
        {isProX && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -right-24 top-0 bottom-0 w-72 border-l-[35px] border-white/5 rounded-full z-0" />
            <div className="absolute -right-28 top-10 bottom-10 w-72 border-l-[2px] border-yellow-500/30 rounded-full z-0" />
            <div className="absolute top-[42%] -left-10 w-full h-[0.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-[-12deg] z-0" />
            <div className="absolute top-[44%] -left-10 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent rotate-[-12deg] z-0" />
            <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-yellow-500/5 skew-x-[-25deg] rotate-[-15deg] z-0" />
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
          </div>
        )}

        {/* Champion Mesh Gradient / Atmosphere */}
        {isChampion && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/20 blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/20 blur-[100px]" />
            <div className="absolute top-[30%] right-[-20%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[80px]" />
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(255,255,255,0.2)_20px,rgba(255,255,255,0.2)_21px)]" />
          </div>
        )}

        {/* Target Motif */}
        {isGlory || isChampion || isProX ? (
          <div className={`absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] aspect-square ${isChampion || isProX ? 'opacity-30 scale-125' : 'opacity-20'} pointer-events-none`}>
             <div className="absolute inset-0 rounded-full border-[20px] border-white/80 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)]" />
             <div className="absolute inset-[20px] rounded-full border-[20px] border-slate-900/90 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)]" />
             <div className="absolute inset-[40px] rounded-full border-[20px] border-blue-600/90 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)]" />
             <div className="absolute inset-[60px] rounded-full border-[20px] border-red-600/90 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)]" />
             <div className="absolute inset-[80px] rounded-full bg-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.4),inset_0_0_30px_rgba(0,0,0,0.2)]" />
             
             {isGlory && (
               <>
                 <div className="absolute inset-0 bg-[repeating-linear-gradient(60deg,transparent,transparent_40px,rgba(255,255,255,0.1)_40px,rgba(255,255,255,0.1)_41px)]" />
                 <div className="absolute inset-0 bg-[repeating-linear-gradient(-30deg,transparent,transparent_60px,rgba(255,255,255,0.05)_60px,rgba(255,255,255,0.05)_61px)]" />
               </>
             )}
          </div>
        ) : (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-slate-200/20 pointer-events-none">
             <div className="absolute inset-10 rounded-full border border-slate-200/20" />
             <div className="absolute inset-20 rounded-full border border-slate-200/20" />
             <div className="absolute inset-30 rounded-full border border-slate-200/20" />
          </div>
        )}

        {/* Framing */}
        {isProX ? (
          <>
             <div className="absolute inset-2 border-[12px] border-double opacity-10 z-20 pointer-events-none" style={{ borderColor: accentColor }} />
             <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-yellow-500 z-30" />
             <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-yellow-500 z-30" />
             <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-yellow-500 z-30" />
             <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-yellow-500 z-30" />
             <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-yellow-500 z-30" />
          </>
        ) : isChampion ? (
          <>
            <div className="absolute inset-2 border-[6px] border-double pointer-events-none z-20 shadow-[0_0_20px_rgba(234,179,8,0.2)]" 
                 style={{ borderColor: '#eab30866', borderStyle: 'double' }} />
            <div className="absolute inset-[10px] border-[1px] border-white/10 pointer-events-none z-20" />
            <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none z-30 opacity-80">
              <div className="absolute top-3 left-3 w-4 h-4 border-t-4 border-l-4 border-yellow-500 rounded-tl-sm" />
              <div className="absolute top-5 left-5 w-8 h-8 border-t-2 border-l-2 border-yellow-500/40" />
            </div>
            <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none z-30 opacity-80">
              <div className="absolute top-3 right-3 w-4 h-4 border-t-4 border-r-4 border-yellow-500 rounded-tr-sm" />
              <div className="absolute top-5 right-5 w-8 h-8 border-t-2 border-r-2 border-yellow-500/40" />
            </div>
            <div className="absolute bottom-0 left-0 w-16 h-16 pointer-events-none z-30 opacity-80">
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-4 border-l-4 border-yellow-500 rounded-bl-sm" />
              <div className="absolute bottom-5 left-5 w-8 h-8 border-b-2 border-l-2 border-yellow-500/40" />
            </div>
            <div className="absolute bottom-0 right-0 w-16 h-16 pointer-events-none z-30 opacity-80">
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-4 border-r-4 border-yellow-500 rounded-br-sm" />
              <div className="absolute bottom-5 right-5 w-8 h-8 border-b-2 border-r-2 border-yellow-500/40" />
            </div>
          </>
        ) : isGlory ? (
          <>
            <div className="absolute inset-3 border-4 pointer-events-none z-20" style={{ borderColor: `${cardAccent}22`, borderStyle: 'double' }} />
            <div className="absolute inset-5 border border-dashed pointer-events-none z-20 opacity-30" style={{ borderColor: cardAccent }} />
            <div className="absolute top-2 left-2 w-10 h-10 border-t-4 border-l-4 z-30" style={{ borderColor: cardAccent, borderRadius: '8px 0 20px 0' }} />
            <div className="absolute top-2 right-2 w-10 h-10 border-t-4 border-r-4 z-30" style={{ borderColor: cardAccent, borderRadius: '0 8px 0 20px' }} />
            <div className="absolute bottom-2 left-2 w-10 h-10 border-b-4 border-l-4 z-30" style={{ borderColor: cardAccent, borderRadius: '0 20px 8px 0' }} />
            <div className="absolute bottom-2 right-2 w-10 h-10 border-b-4 border-r-4 z-30" style={{ borderColor: cardAccent, borderRadius: '20px 0 0 8px' }} />
          </>
        ) : isLegacy ? (
          <div className="absolute inset-4 border border-double pointer-events-none z-20" style={{ borderColor: `${cardAccent}33`, borderWidth: '3px' }} />
        ) : (
          !isAsymmetric && <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: cardAccent }} />
        )}

        {/* Header */}
        <div className={`h-24 p-5 flex items-center justify-between relative z-10 ${isAsymmetric ? 'flex-row-reverse' : ''}`}>
          <div className="flex -space-x-2">
            {logos.map(logo => (
              <img 
                key={logo.id} 
                src={logo.url} 
                alt="" 
                style={{ maxHeight: logo.size / 2, width: 'auto' }}
                className="object-contain ring-2 ring-white rounded-lg bg-white shadow-lg"
              />
            ))}
            {logos.length === 0 && <div className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 bg-white/50 backdrop-blur-sm"><ImageIcon className="w-5 h-5 text-slate-600" /></div>}
          </div>
          <div className="text-right">
             <div className={`text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1 ${isChampion || isProX ? 'text-yellow-400 opacity-100' : 'opacity-40'}`}>E-PASS ID</div>
             <div className={`text-[12px] font-mono font-black ${isChampion || isProX ? 'text-white' : ''}`} style={{ color: (isChampion || isProX) ? undefined : cardAccent }}>{person.id.substring(0, 8)}</div>
          </div>
        </div>

        {/* Dynamic Sporty Lines for Glory/Champion theme */}
        {(isGlory || isChampion) && (
          <div className="absolute top-24 left-0 w-full h-1 opacity-20 z-10" style={{ background: `linear-gradient(90deg, transparent, ${isChampion ? '#eab308' : cardAccent}, transparent)` }} />
        )}

        {/* Main Content Area */}
        <div className={`p-6 flex flex-col flex-1 relative z-10 ${isAsymmetric ? 'items-start pl-8' : 'items-center'}`}>
          <div className={`w-full mb-6 ${isAsymmetric ? 'text-left' : 'text-center'}`}>
            <h2 className={`text-[12px] font-black uppercase tracking-[0.3em] mb-1 scale-y-110 ${isLegacy || isGlory || isChampion || isProX ? 'font-serif italic' : 'font-oswald'} ${textPrimary}`}>
              {cardTitle}
            </h2>
            <div className={`h-px w-16 mx-auto mt-2 ${isChampion || isProX ? 'bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent' : 'bg-slate-200'}`} style={{ backgroundColor: (isAsymmetric || isChampion || isProX) ? undefined : `${cardAccent}33` }} />
          </div>

          <div className={`flex flex-col gap-6 w-full ${isAsymmetric ? 'items-start' : 'items-center'}`}>
            {/* Name Section with Custom Typography */}
            <div className="relative group text-center">
              {(isLegacy || isGlory || isChampion || isProX) && (
                <div className={`absolute -top-4 left-0 w-full text-center text-[10px] uppercase font-black tracking-[0.3em] ${isChampion || isProX ? 'text-yellow-500' : 'font-serif italic text-slate-700 opacity-50'}`}>
                  {isChampion || isProX ? 'Elite Pro Archer' : 'Grand Athlete'}
                </div>
              )}
              <h1 className={`text-4xl leading-[0.85] font-black uppercase mb-1 drop-shadow-sm ${isProX ? 'font-oswald italic tracking-tighter' : isLegacy || isGlory || isChampion ? 'font-serif tracking-normal' : 'font-oswald italic tracking-tighter'} ${textPrimary}`}>
                {isChampion || isProX ? (
                  <>
                    <span className="block drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{person.name.split(' ')[0]}</span>
                    <span className="text-yellow-400 block mt-1 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">{person.name.split(' ').slice(1).join(' ')}</span>
                  </>
                ) : (
                  <>
                    {person.name.split(' ')[0]}<br/>
                    <span style={{ color: (isLegacy || isGlory) ? '#78350f' : cardAccent }}>{person.name.split(' ').slice(1).join(' ')}</span>
                  </>
                )}
              </h1>
              <p className={`text-[12px] font-black mt-2 tracking-widest ${textSecondary}`}>
                {person.club || 'INDEPENDENT'}
              </p>
            </div>

            {/* Visual Identification Area (Photo + Barcode Batang / QR Code) */}
            <div className="flex flex-col items-center justify-center gap-3 w-full">
              <div className="flex items-center justify-center gap-3 w-full">
                {/* Profile Photo */}
                <div className={`p-1 w-[80px] h-[105px] rounded-2xl overflow-hidden relative shadow-md border flex items-center justify-center shrink-0 ${
                  isChampion || isProX 
                    ? 'border-yellow-500/40 bg-slate-900/40' 
                    : isStealth 
                    ? 'border-white/10 bg-slate-850' 
                    : isGlory 
                    ? 'border-amber-200 bg-white' 
                    : 'border-slate-200 bg-slate-50'
                }`}>
                  {person.photoUrl ? (
                    <img src={person.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-slate-600">
                      <User className="w-8 h-8 opacity-40" />
                      <span className="text-[6px] font-black uppercase tracking-widest text-slate-700 opacity-60">NO PHOTO</span>
                    </div>
                  )}
                </div>

                {/* Code Container: Barcode Batang 1D or QR Code */}
                {barcodeFormat === 'QR_CODE' ? (
                  <div className={`p-3 rounded-2xl shadow-md relative group shrink-0 ${isChampion || isProX ? 'bg-white/10 backdrop-blur-md border border-white/20' : isStealth || isGlory ? 'bg-white' : 'bg-white shadow-slate-200'}`}>
                     <div className="bg-white p-1 rounded-lg">
                        <QRCodeSVG value={person.id} size={70} level="H" />
                     </div>
                  </div>
                ) : (
                  <div className={`p-2 rounded-2xl shadow-md relative group flex flex-col items-center justify-center shrink-0 w-[140px] ${isChampion || isProX ? 'bg-white border-2 border-yellow-500/30' : isStealth || isGlory ? 'bg-white border border-slate-200' : 'bg-white border border-slate-200 shadow-slate-200'}`}>
                    <div className="w-full flex items-center justify-center overflow-hidden py-1">
                      <Barcode 
                        value={person.id}
                        width={1.2}
                        height={38}
                        fontSize={8}
                        displayValue={true}
                        text={person.registrationNo || person.id.substring(0, 10)}
                        background="transparent"
                        lineColor="#0f172a"
                      />
                    </div>
                    <div className="text-[7px] font-mono font-bold text-slate-700 uppercase tracking-wider text-center mt-0.5">
                      {person.targetNo ? `T-${person.targetNo}${person.position}` : 'E-ID'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Category / Status Badge */}
            <div className="flex flex-col items-center gap-1">
              <span className={`text-[10px] font-black px-6 py-2 rounded-full text-white uppercase tracking-[0.2em] shadow-lg ${isLegacy || isGlory || isChampion || isProX ? 'rounded-none border-y-2 border-white/20' : 'skew-x-[-10deg]'}`} style={{ backgroundColor: (isChampion || isProX) ? '#ca8a04' : cardAccent }}>
                {isOfficial ? 'CREW' : person.category}
              </span>
              {(isChampion || isProX) && <div className="text-[8px] font-black uppercase text-yellow-500 tracking-[0.4em] mt-1">Official Member</div>}
            </div>
          </div>

          {/* Technical Data Grid */}
          {!isOfficial && (
            <div className={`mt-auto w-full grid grid-cols-2 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden shadow-2xl ${isChampion || isProX ? 'border-white/10 bg-white/5 backdrop-blur-md' : isGlory ? 'border-amber-200/50' : ''}`}>
               <div className={`${isStealth ? 'bg-slate-900' : (isChampion || isProX) ? 'bg-white/5' : 'bg-white/50'} p-4 flex flex-col items-center relative overflow-hidden`}>
                  {(isGlory || isChampion || isProX) && <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: (isChampion || isProX) ? '#eab308' : cardAccent }} />}
                  <span className={`text-[7px] font-black uppercase tracking-widest mb-1 ${(isChampion || isProX) ? 'text-yellow-500' : 'text-slate-700'}`}>Target</span>
                  <span className={`text-2xl font-black ${textPrimary}`}>{person.targetNo}{person.position}</span>
               </div>
               <div className={`${isStealth ? 'bg-slate-900' : (isChampion || isProX) ? 'bg-white/5' : 'bg-white/50'} p-4 flex flex-col items-center relative overflow-hidden`}>
                  {(isGlory || isChampion || isProX) && <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: (isChampion || isProX) ? '#eab308' : cardAccent }} />}
                  <span className={`text-[7px] font-black uppercase tracking-widest mb-1 ${(isChampion || isProX) ? 'text-yellow-500' : 'text-slate-700'}`}>Session</span>
                  <span className={`text-2xl font-black ${textPrimary}`}>{person.wave}</span>
               </div>
            </div>
          )}
          
          {isOfficial && (
            <div className={`mt-auto w-full p-4 rounded-3xl border flex items-center justify-between ${(isChampion || isProX) ? 'border-yellow-500/30 bg-yellow-500/5 backdrop-blur-md' : isStealth || isGlory ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
               <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl shadow-lg ${(isChampion || isProX) ? 'bg-yellow-500' : 'bg-blue-600'}`}>
                     <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                     <p className={`text-[12px] font-black leading-none uppercase ${(isChampion || isProX) ? 'text-white' : isGlory ? 'text-slate-900' : textPrimary}`}>Full Access</p>
                     <p className={`text-[8px] font-bold uppercase mt-1.5 ${(isChampion || isProX) ? 'text-yellow-500' : 'text-slate-700'}`}>Verified Personnel</p>
                  </div>
               </div>
               <div className={`text-[10px] font-black font-mono rotate-90 opacity-40 italic ${(isChampion || isProX) ? 'text-yellow-500' : ''}`}>AUTHORIZED</div>
            </div>
          )}
        </div>

        {/* Global Footer */}
        {(!isAsymmetric && !isGlory && !isChampion && !isProX) && (
          <div className="h-12 flex items-center justify-center relative z-10 pt-2" style={{ borderTop: `1px solid ${cardAccent}22` }}>
             <span className={`text-[9px] font-black uppercase tracking-[0.4em] ${textSecondary}`}>
                • {cardSubtitle} •
             </span>
          </div>
        )}

        {(isGlory || isChampion || isProX) && (
           <div className={`h-12 flex items-center justify-between px-6 relative z-10 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.2)]`} 
                style={{ backgroundColor: (isChampion || isProX) ? (isProX ? '#eab308' : '#ca8a04') : cardAccent }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] translate-x-[-100%] animate-[shimmer_3s_infinite]" />
              <div className="flex flex-col items-start relative z-10">
                 <span className={`text-[11px] font-black uppercase italic tracking-[0.2em] ${isProX ? 'text-slate-900' : 'text-white'} drop-shadow-sm`}>
                   {cardSubtitle}
                 </span>
              </div>
              {isProX && <Target className="w-5 h-5 text-slate-900 opacity-80 relative z-10" />}
           </div>
        )}
      </div>
    );
  };

  const renderCard = (person: Archer, isOfficial: boolean) => {
    return designMode === 'CUSTOM_UPLOAD'
      ? renderCustomCard(person, isOfficial)
      : renderTemplateCard(person, isOfficial);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Editor UI - Hidden on Print */}
      {showEditor && (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 print:hidden">
          {/* Top Bar Navigation */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack} 
                className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-900 transition-all active:scale-90 shadow-sm hover:bg-slate-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-black font-oswald uppercase italic leading-none text-slate-900">
                  ID Card Forge & Printing
                </h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-1">
                  Desain Template Otomatis & Custom Desain Sendiri
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setViewMode('DESIGNER')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'DESIGNER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-700 hover:text-slate-600'}`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  Designer
                </button>
                <button 
                  onClick={() => setViewMode('FULL_PREVIEW')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'FULL_PREVIEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-700 hover:text-slate-600'}`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Preview Semua ({archers.length})
                </button>
              </div>
              
              <div className="hidden md:flex items-center gap-2 bg-slate-200/50 p-1.5 rounded-xl">
                 <div className="px-3 text-[9px] font-black text-slate-800 uppercase tracking-widest">
                   {participants.length} Atlet • {officials.length} Ofisial
                 </div>
              </div>
              
              <button 
                onClick={handlePrint}
                className="bg-arcus-red text-white px-7 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl shadow-red-600/20 active:scale-95 transition-all hover:bg-red-700"
              >
                <Printer className="w-4 h-4" />
                Cetak {archers.length} Kartu
              </button>
            </div>
          </div>

          {viewMode === 'DESIGNER' ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Left Column: Design Controls */}
              <div className="space-y-6">
                
                {/* 1. Mode Selection Tab (Template Bawaan vs Upload Desain Sendiri) */}
                <div className="bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setDesignMode('TEMPLATE')}
                      className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        designMode === 'TEMPLATE' 
                          ? 'bg-white text-slate-900 shadow-md font-bold' 
                          : 'text-slate-800 hover:text-slate-800'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Template Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setDesignMode('CUSTOM_UPLOAD')}
                      className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        designMode === 'CUSTOM_UPLOAD' 
                          ? 'bg-slate-900 text-white shadow-md font-bold' 
                          : 'text-slate-800 hover:text-slate-800'
                      }`}
                    >
                      <Upload className="w-4 h-4 text-emerald-400" />
                      Upload Desain
                    </button>
                  </div>
                </div>

                {/* MODE A: CUSTOM UPLOAD DESIGN CONTROLS */}
                {designMode === 'CUSTOM_UPLOAD' && (
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-black font-oswald uppercase italic text-slate-900 text-lg">Custom ID Card Upload</h3>
                          <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Gunakan Desain Latar Master Panitia</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomConfig(DEFAULT_CUSTOM_CONFIG)}
                        className="text-[9px] font-black uppercase text-slate-700 hover:text-red-500 flex items-center gap-1"
                        title="Reset Pengaturan"
                      >
                        <RefreshCw className="w-3 h-3" /> Reset
                      </button>
                    </div>

                    {/* Upload Background Image Controls */}
                    <div className="space-y-4">
                      {/* Athlete Background */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest block flex items-center justify-between">
                          <span>Latar Kartu Atlet (Rasio 2:3)</span>
                          {customConfig.athleteBgUrl && (
                            <span className="text-[8px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Terpasang</span>
                          )}
                        </span>
                        
                        <div className="flex items-center gap-3">
                          {customConfig.athleteBgUrl ? (
                            <div className="relative group w-16 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 bg-slate-900">
                              <img src={customConfig.athleteBgUrl} alt="Latar Atlet" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setCustomConfig(prev => ({ ...prev, athleteBgUrl: null }))}
                                className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Hapus Background"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => athleteBgInputRef.current?.click()}
                              className="w-16 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-700 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all shrink-0"
                            >
                              <FileImage className="w-6 h-6 opacity-40" />
                              <span className="text-[6px] font-black uppercase mt-1">PNG/JPG</span>
                            </div>
                          )}

                          <div className="flex-1 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => athleteBgInputRef.current?.click()}
                              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              {customConfig.athleteBgUrl ? 'Ganti Desain Atlet' : 'Unggah Desain Atlet'}
                            </button>
                            <input 
                              type="file" 
                              ref={athleteBgInputRef} 
                              onChange={handleAthleteBgUpload} 
                              className="hidden" 
                              accept="image/png,image/jpeg,image/webp" 
                            />
                            <p className="text-[8px] text-slate-700 font-medium">Format: PNG/JPG. Resolusi anjuran: 600×900 px atau 1000×1500 px.</p>
                          </div>
                        </div>
                      </div>

                      {/* Official Background (Toggle separate or same) */}
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                            Gunakan Desain Beda untuk Ofisial
                          </span>
                          <input
                            type="checkbox"
                            checked={customConfig.useSeparateOfficialBg}
                            onChange={e => setCustomConfig(prev => ({ ...prev, useSeparateOfficialBg: e.target.checked }))}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                        </label>

                        {customConfig.useSeparateOfficialBg && (
                          <div className="flex items-center gap-3 pt-2">
                            {customConfig.officialBgUrl ? (
                              <div className="relative group w-16 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 bg-slate-900">
                                <img src={customConfig.officialBgUrl} alt="Latar Ofisial" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setCustomConfig(prev => ({ ...prev, officialBgUrl: null }))}
                                  className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div 
                                onClick={() => officialBgInputRef.current?.click()}
                                className="w-16 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-700 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all shrink-0"
                              >
                                <FileImage className="w-6 h-6 opacity-40" />
                                <span className="text-[6px] font-black uppercase mt-1">OFISIAL</span>
                              </div>
                            )}

                            <div className="flex-1 space-y-1.5">
                              <button
                                type="button"
                                onClick={() => officialBgInputRef.current?.click()}
                                className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                {customConfig.officialBgUrl ? 'Ganti Desain Ofisial' : 'Unggah Desain Ofisial'}
                              </button>
                              <input 
                                type="file" 
                                ref={officialBgInputRef} 
                                onChange={handleOfficialBgUpload} 
                                className="hidden" 
                                accept="image/png,image/jpeg,image/webp" 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Text Contrast & Accent Color */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                        Kontras Teks & Warna Aksen
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomConfig(prev => ({ ...prev, textColorMode: 'LIGHT' }))}
                          className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-2 justify-center ${
                            customConfig.textColorMode === 'LIGHT' 
                              ? 'border-slate-900 bg-slate-900 text-white shadow-md' 
                              : 'border-slate-100 bg-white text-slate-800 hover:border-slate-200'
                          }`}
                        >
                          <div className="w-3 h-3 rounded-full bg-white border border-slate-400" />
                          <span className="text-[9px] font-black uppercase">Teks Terang (Putih)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomConfig(prev => ({ ...prev, textColorMode: 'DARK' }))}
                          className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-2 justify-center ${
                            customConfig.textColorMode === 'DARK' 
                              ? 'border-slate-900 bg-slate-900 text-white shadow-md' 
                              : 'border-slate-100 bg-white text-slate-800 hover:border-slate-200'
                          }`}
                        >
                          <div className="w-3 h-3 rounded-full bg-slate-900" />
                          <span className="text-[9px] font-black uppercase">Teks Gelap (Hitam)</span>
                        </button>
                      </div>

                      {/* Accent Color Palette */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest mr-1">Warna Aksen:</span>
                        {['#f59e0b', '#eab308', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#ffffff', '#000000'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCustomConfig(prev => ({ ...prev, accentColor: c }))}
                            className={`w-7 h-7 rounded-xl border-2 transition-all ${
                              customConfig.accentColor === c ? 'border-slate-900 scale-110 shadow-md ring-2 ring-emerald-400' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Vertical Position Tuning (Offset Slider) */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                          <Move className="w-3.5 h-3.5 text-slate-700" />
                          Posisi Vertikal Data Overlay
                        </span>
                        <span className="text-[9px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                          {customConfig.verticalOffset > 0 ? `+${customConfig.verticalOffset}` : customConfig.verticalOffset}%
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="-20" 
                        max="20" 
                        value={customConfig.verticalOffset}
                        onChange={e => setCustomConfig(prev => ({ ...prev, verticalOffset: parseInt(e.target.value) || 0 }))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <div className="flex justify-between text-[8px] font-bold text-slate-700 uppercase">
                        <span>Geser Ke Atas</span>
                        <span>Tengah (0)</span>
                        <span>Geser Ke Bawah</span>
                      </div>
                    </div>

                    {/* Element Visibility Toggles */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                        Elemen Data yang Ditampilkan
                      </span>

                      <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showPhoto}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showPhoto: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>Foto Peserta</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showName}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showName: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>Nama Atlet</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showClub}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showClub: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>Asal Klub / Tim</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showCategory}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showCategory: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>Badge Kategori</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showTargetSession}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showTargetSession: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>No. Target & Sesi</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showCode}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showCode: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>Barcode / QR Pass</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showHeader}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showHeader: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>Header Event</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={customConfig.showFooter}
                            onChange={e => setCustomConfig(prev => ({ ...prev, showFooter: e.target.checked }))}
                            className="rounded text-emerald-600"
                          />
                          <span>Footer Tagline</span>
                        </label>
                      </div>
                    </div>

                    {/* Barcode Format for Custom Upload */}
                    {customConfig.showCode && (
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                          Format Kode Identifikasi
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setCustomConfig(prev => ({ ...prev, codeType: 'BARCODE_128' }))}
                            className={`p-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${
                              customConfig.codeType === 'BARCODE_128' 
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' 
                                : 'border-slate-100 bg-white text-slate-800'
                            }`}
                          >
                            <BarcodeIcon className="w-4 h-4 text-emerald-600" />
                            <span className="text-[9px] uppercase">Barcode 1D</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomConfig(prev => ({ ...prev, codeType: 'QR_CODE' }))}
                            className={`p-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${
                              customConfig.codeType === 'QR_CODE' 
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' 
                                : 'border-slate-100 bg-white text-slate-800'
                            }`}
                          >
                            <QrCode className="w-4 h-4 text-emerald-600" />
                            <span className="text-[9px] uppercase">QR Code 2D</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE B: PRESET TEMPLATE CONTROLS */}
                {designMode === 'TEMPLATE' && (
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                          <Layout className="w-4 h-4" />
                        </div>
                        <h3 className="font-black font-oswald uppercase italic text-slate-900">Preset Theme Template</h3>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Pilih Tema Kartu</span>
                        <div className="grid grid-cols-2 gap-2">
                           {([
                             { id: 'PRO_ARCHER_X', name: 'X-Dynamic', icon: Crosshair, color: '#eab308', pattern: 'SPORTY_BURST' },
                             { id: 'CHAMPION_ELITE', name: 'Champion Elite', icon: Trophy, color: '#eab308', pattern: 'SPORTY_BURST' },
                             { id: 'GLORY_ULTIMATE', name: 'Glory Ultimate', icon: Star, color: '#f59e0b', pattern: 'SPORTY_BURST' },
                             { id: 'SPORTY_MODERN', name: 'Modern Sporty', icon: Activity, color: '#ef4444', pattern: 'SPORTY_MESH' },
                             { id: 'TRADITIONAL_LEGACY', name: 'Legacy Heritage', icon: ShieldCheck, color: '#78350f', pattern: 'HERITAGE_PAPER' },
                             { id: 'STEALTH_ELITE', name: 'Elite Stealth', icon: Maximize, color: '#E61E2A', pattern: 'CARBON' },
                             { id: 'ASYMETRIC_PRO', name: 'Asymmetric Pro', icon: Layout, color: '#2563eb', pattern: 'BAMBOO_WEAVE' }
                           ] as const).map(t => (
                             <button 
                               key={t.id}
                               type="button"
                               onClick={() => {
                                 setCardTheme(t.id);
                                 setAccentColor(t.color);
                                 setBgPattern(t.pattern);
                               }}
                               className={`p-3 rounded-2xl border-2 transition-all flex flex-col gap-2 items-start group relative overflow-hidden ${cardTheme === t.id ? 'border-slate-900 bg-slate-900 text-white shadow-xl' : 'border-slate-100 bg-white text-slate-700 hover:border-slate-300'}`}
                             >
                               <t.icon className={`w-4 h-4 ${cardTheme === t.id ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'}`} />
                               <div className="flex flex-col items-start">
                                 <span className="text-[8px] font-black uppercase tracking-tighter text-left leading-tight">{t.name}</span>
                                 {t.id === 'CHAMPION_ELITE' && <span className="text-[6px] font-bold text-yellow-500 uppercase tracking-widest mt-0.5">Ultra Premium</span>}
                                 {t.id === 'PRO_ARCHER_X' && <span className="text-[6px] font-bold text-yellow-500 uppercase tracking-widest mt-0.5">Sports Dynamic</span>}
                               </div>
                               {cardTheme === t.id && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20" />}
                             </button>
                           ))}
                        </div>
                      </div>

                      {/* Logo Sponsor / Organisasi */}
                      <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Logo Sponsor / Organisasi</span>
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all"
                          >
                            <Plus className="w-3 h-3" /> Tambah Logo
                          </button>
                          <input type="file" ref={fileInputRef} onChange={handleAddLogo} className="hidden" accept="image/*" />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {logos.map(logo => (
                            <div key={logo.id} className="relative group">
                              <img src={logo.url} alt="" className="w-12 h-12 object-contain bg-slate-50 rounded-xl border border-slate-100 p-1" />
                              <button 
                                type="button"
                                onClick={() => removeLogo(logo.id)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Barcode Format */}
                      <div className="space-y-3 pt-4 border-t border-slate-50">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Format Kode Identifikasi</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setBarcodeFormat('BARCODE_128')}
                            className={`p-3 rounded-2xl border-2 transition-all flex flex-col gap-1 items-start ${
                              barcodeFormat === 'BARCODE_128' 
                                ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm' 
                                : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200'
                            }`}
                          >
                            <BarcodeIcon className={`w-5 h-5 ${barcodeFormat === 'BARCODE_128' ? 'text-purple-600' : 'text-slate-700'}`} />
                            <span className="text-[9px] font-black uppercase tracking-tight">Barcode Batang</span>
                            <span className="text-[7px] font-bold text-slate-700">Code 128 (Laser/USB)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setBarcodeFormat('QR_CODE')}
                            className={`p-3 rounded-2xl border-2 transition-all flex flex-col gap-1 items-start ${
                              barcodeFormat === 'QR_CODE' 
                                ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm' 
                                : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200'
                            }`}
                          >
                            <QrCode className={`w-5 h-5 ${barcodeFormat === 'QR_CODE' ? 'text-purple-600' : 'text-slate-700'}`} />
                            <span className="text-[9px] font-black uppercase tracking-tight">QR Code 2D</span>
                            <span className="text-[7px] font-bold text-slate-700">Standard Matrix</span>
                          </button>
                        </div>
                      </div>

                      {/* Background Pattern */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Pola Latar Preset</span>
                        <div className="grid grid-cols-2 gap-2">
                           {(['CLEAN', 'SPORTY_MESH', 'DIAGONAL_SPEED', 'DYNAMIC_WAVES', 'CARBON', 'HERITAGE_PAPER', 'BAMBOO_WEAVE', 'ETHNIC_MODERN', 'SPORTY_BURST'] as BgPattern[]).map(p => (
                             <button 
                               key={p}
                               type="button"
                               onClick={() => setBgPattern(p)}
                               className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${bgPattern === p ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'}`}
                             >
                               {p.replace('_', ' ')}
                             </button>
                           ))}
                        </div>
                      </div>

                      {/* Card Titles */}
                      <div className="pt-4 border-t border-slate-50 space-y-4">
                        <label className="block space-y-2">
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <Type className="w-3 h-3" /> Nama Event
                          </span>
                          <input 
                            type="text" 
                            value={cardTitle}
                            onChange={e => setCardTitle(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm text-slate-900 focus:ring-2 ring-slate-100"
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <MapPin className="w-3 h-3" /> Tagline / Lokasi
                          </span>
                          <input 
                            type="text" 
                            value={cardSubtitle}
                            onChange={e => setCardSubtitle(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm text-slate-900 focus:ring-2 ring-slate-100"
                          />
                        </label>
                      </div>

                      {/* Accent Color Palette */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Warna Aksen</span>
                        <div className="flex flex-wrap gap-2">
                          {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#000000', '#78350f', '#166534', '#991b1b'].map(color => (
                            <button 
                              key={color}
                              type="button"
                              onClick={() => setAccentColor(color)}
                              className={`w-10 h-10 rounded-2xl border-2 transition-all ${accentColor === color ? 'border-amber-400 scale-110 shadow-lg' : 'border-transparent'}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Smart Printing Engine Info Card */}
                <div className="bg-[#1e293b] p-6 rounded-[2rem] text-white shadow-xl shadow-slate-900/20">
                  <div className="flex gap-4">
                     <Activity className="w-6 h-6 text-emerald-400 mt-1 shrink-0" />
                     <div>
                       <h4 className="text-xs font-black uppercase italic tracking-widest text-emerald-400">Smart Printing Engine</h4>
                       <p className="text-[10px] font-medium text-slate-700 leading-relaxed mt-2 uppercase">
                         Sistem secara otomatis memformat lembar cetak A4 dan memisahkan <span className="text-white font-bold">{participants.length} Atlet</span> dan <span className="text-white font-bold">{officials.length} Official</span> secara akurat.
                       </p>
                     </div>
                  </div>
                </div>
              </div>

              {/* Right Columns: Live Interactive Preview */}
              <div className="xl:col-span-2 space-y-8">
                <div className="flex flex-col md:flex-row gap-6">
                   {/* Athlete Preview */}
                   <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between px-4">
                         <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-arcus-red" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-700">Kartu Atlet</span>
                         </div>
                         <span className="text-[9px] font-bold text-slate-700 uppercase">{participants.length} Peserta</span>
                      </div>
                      
                      <div className="max-w-xs mx-auto">
                         {participants[0] ? renderCard(participants[0], false) : (
                            <div className="aspect-[2/3] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-700 p-10 text-center">
                               <User className="w-12 h-12 mb-4 opacity-20" />
                               <span className="text-[10px] font-black uppercase tracking-widest">Belum Ada Data Atlet</span>
                            </div>
                         )}
                      </div>
                   </div>

                   {/* Official Preview */}
                   <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between px-4">
                         <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-700">Kartu Official</span>
                         </div>
                         <span className="text-[9px] font-bold text-slate-700 uppercase">{officials.length} Ofisial</span>
                      </div>

                      <div className="max-w-xs mx-auto">
                         {officials[0] ? renderCard(officials[0], true) : (
                            <div className="aspect-[2/3] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-700 p-10 text-center">
                               <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
                               <span className="text-[10px] font-black uppercase tracking-widest">Belum Ada Data Official</span>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            /* FULL PREVIEW ALL CARDS */
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 min-h-screen">
              <div className="flex items-center justify-between mb-12 px-6">
                 <div>
                   <h3 className="text-2xl font-black font-oswald uppercase italic text-slate-900">Pre-Print Inspection</h3>
                   <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-1">Reviewing {archers.length} generated identifiers</p>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex flex-col items-end">
                       <span className="text-[10px] font-black text-slate-700 uppercase">Perkiraan Kertas</span>
                       <span className="text-xl font-black text-slate-900">{Math.ceil(archers.length / 4)} × Lembar A4</span>
                    </div>
                 </div>
              </div>

              <div className="space-y-16">
                 {participants.length > 0 && (
                   <div className="space-y-6">
                      <div className="flex items-center gap-3 border-l-4 border-arcus-red pl-4">
                         <span className="font-black font-oswald uppercase italic text-slate-900 text-xl">Daftar Atlet</span>
                         <span className="px-3 py-1 bg-red-50 text-arcus-red text-[10px] font-black rounded-full uppercase italic">{participants.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                         {participants.map(p => (
                            <div key={p.id} className="scale-100 transform transform-gpu origin-top">
                               {renderCard(p, false)}
                            </div>
                         ))}
                      </div>
                   </div>
                 )}

                 {officials.length > 0 && (
                   <div className="space-y-6 pt-12 border-t border-slate-100">
                      <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-4">
                         <span className="font-black font-oswald uppercase italic text-slate-900 text-xl">Daftar Official</span>
                         <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase italic">{officials.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                         {officials.map(o => (
                            <div key={o.id} className="scale-100 transform transform-gpu origin-top">
                               {renderCard(o, true)}
                            </div>
                         ))}
                      </div>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actual Printable Layout for Standard Browser Print */}
      <div className={`${showEditor ? 'hidden' : 'block'} bg-white`}>
        {/* Participants Group */}
        {participants.length > 0 && (
           <div className="mb-12">
             <div className="grid grid-cols-2 gap-4 p-4">
               {participants.map(archer => renderCard(archer, false))}
             </div>
           </div>
        )}

        {/* Officials Group */}
        {officials.length > 0 && (
           <div className="page-break-before">
             <div className="grid grid-cols-2 gap-4 p-4">
               {officials.map(official => renderCard(official, true))}
             </div>
           </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          body {
            background: white !important;
          }
          .page-break-before {
             page-break-before: always;
          }
          .animate-in {
            animation: none !important;
          }
          .aspect-[2/3] {
             width: 9.5cm !important;
             height: 14.25cm !important;
             margin: 0 auto;
             page-break-inside: avoid;
          }
        }
      `}} />
    </div>
  );
};

export default IdCardEditor;
