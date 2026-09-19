import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, Download, Award, Trophy, Medal, Target, 
  Settings2, Image as ImageIcon, Upload, Trash2, Check, 
  X, ChevronLeft, ChevronRight, RefreshCw, Sliders, 
  Palette, Eye, Sparkles, ShieldCheck, FileText, CheckCircle2,
  Users, Layers, ExternalLink, HelpCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ArcheryEvent, CategoryType, Archer, Match, TournamentSettings, CertificateConfig, CertificateTemplateStyle, CertificateSignatory } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { resolveGoogleDriveUrl } from '../lib/photoService';
import { toast } from 'sonner';

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  event: ArcheryEvent;
  initialCategory?: CategoryType;
  onSaveSettings?: (settings: TournamentSettings) => void;
}

export interface CertificateRecipient {
  id: string;
  archerId: string;
  archerName: string;
  club: string;
  category: CategoryType;
  categoryLabel: string;
  targetNo?: number;
  position?: string;
  awardType: 'PODIUM' | 'PARTICIPANT';
  predicate: string; // e.g. "JUARA 1 (MEDALI EMAS)", "PESERTA RESMI", dll.
  medalType?: 'GOLD' | 'SILVER' | 'BRONZE' | 'FOURTH' | 'PARTICIPANT';
  scoreTotal?: number;
  rank?: number;
  certificateNumber: string;
}

export default function PrintCertificateModal({
  isOpen = true,
  onClose,
  event,
  initialCategory = CategoryType.ADULT_PUTRA,
  onSaveSettings
}: Props) {
  if (!isOpen) return null;

  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'ALL'>(initialCategory);
  const [recipientFilter, setRecipientFilter] = useState<'WINNERS_ONLY' | 'ALL_PARTICIPANTS' | 'CUSTOM_SELECTION'>('WINNERS_ONLY');
  const [selectedArcherIds, setSelectedArcherIds] = useState<string[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'SETTINGS'>('PREVIEW');
  const [isPrintingNow, setIsPrintingNow] = useState(false);
  const [printScope, setPrintScope] = useState<'ALL' | 'SINGLE'>('ALL');

  // Load existing certificate config or establish robust defaults
  const existingConfig = event.settings?.certificateConfig;
  const [templateStyle, setTemplateStyle] = useState<CertificateTemplateStyle>(existingConfig?.templateStyle || 'ROYAL_GOLD');
  const [customBgUrl, setCustomBgUrl] = useState<string>(existingConfig?.customBackgroundUrl || '');
  const [useCustomBgOnly, setUseCustomBgOnly] = useState<boolean>(existingConfig?.useCustomBackgroundOnly || false);
  const [printTextOnlyMode, setPrintTextOnlyMode] = useState<boolean>(existingConfig?.printTextOnlyMode || false);
  const [certTitle, setCertTitle] = useState<string>(existingConfig?.title || 'SERTIFIKAT PENGHARGAAN');
  const [certSubtitle, setCertSubtitle] = useState<string>(existingConfig?.subtitle || 'Diberikan dengan penuh kehormatan dan apresiasi kepada:');
  const [bodyTemplate, setBodyTemplate] = useState<string>(
    existingConfig?.bodyTextTemplate || 'Atas dedikasi, sportivitas, dan pencapaian gemilang sebagai {PREDICATE} pada kategori {CATEGORY} dalam kejuaraan {TOURNAMENT_NAME}.'
  );
  const [showTournamentLogo, setShowTournamentLogo] = useState<boolean>(existingConfig?.showTournamentLogo ?? true);
  const [showClubLogo, setShowClubLogo] = useState<boolean>(existingConfig?.showClubLogo ?? true);
  const [showSecondaryLogo, setShowSecondaryLogo] = useState<boolean>(existingConfig?.showSecondaryLogo ?? true);
  const [showMedalBadge, setShowMedalBadge] = useState<boolean>(existingConfig?.showMedalBadge ?? true);
  const [showQrVerification, setShowQrVerification] = useState<boolean>(existingConfig?.showQrVerification ?? true);
  const [showDateLocation, setShowDateLocation] = useState<boolean>(existingConfig?.showDateLocation ?? true);
  const [nameOffsetY, setNameOffsetY] = useState<number>(existingConfig?.nameOffsetY ?? 0);
  const [nameFontSize, setNameFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(existingConfig?.nameFontSize || 'lg');
  const [primaryTextColor, setPrimaryTextColor] = useState<string>(existingConfig?.primaryTextColor || '#0f172a');
  const [customStampUrl, setCustomStampUrl] = useState<string>(existingConfig?.customStampUrl || '');

  // Signatories
  const [signatories, setSignatories] = useState<CertificateSignatory[]>(() => {
    if (existingConfig?.signatories && existingConfig.signatories.length > 0) {
      return existingConfig.signatories;
    }
    return [
      {
        id: '1',
        name: 'Ketua Panitia Pelaksana',
        role: 'Ketua Panitia',
        signatureUrl: ''
      },
      {
        id: '2',
        name: 'Technical Delegate / Wasit',
        role: 'Technical Delegate',
        signatureUrl: ''
      }
    ];
  });

  const fileBgInputRef = useRef<HTMLInputElement>(null);
  const fileStampInputRef = useRef<HTMLInputElement>(null);

  // Sync category if initialCategory changes
  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  // Handle printing isolation
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('printing-certificate-active');
      setIsPrintingNow(true);
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-certificate-active');
      setIsPrintingNow(false);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-certificate-active');
    };
  }, []);

  // Calculate Winners & Recipients per category (Juara Podium and Participants)
  const recipients = useMemo(() => {
    const archers = event.archers || [];
    const scores = event.scores || [];
    const matchesObj = event.matches || {};
    const categoriesToProcess: CategoryType[] = selectedCategory === 'ALL' 
      ? (Object.keys(CATEGORY_LABELS) as CategoryType[]).filter(c => archers.some(a => a.category === c))
      : [selectedCategory];

    const resultList: CertificateRecipient[] = [];

    categoriesToProcess.forEach(cat => {
      const catArchers = archers.filter(a => a.category === cat);
      if (catArchers.length === 0) return;

      const eventCode = (event.settings?.tournamentName || 'ARCUS').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
      const catCode = cat.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();

      // 1. Calculate qualification scores & ranking
      const rankedArchers = catArchers.map(archer => {
        const archerScores = scores.filter(s => s.archerId === archer.id && s.sessionId === 'QUAL' && !s.isDeleted);
        const total = archerScores.reduce((acc, curr) => acc + (curr.total || 0), 0);
        return { ...archer, total };
      }).sort((a, b) => (b.total || 0) - (a.total || 0));

      // 2. Check elimination matches for medals (Podium)
      const catMatches = (matchesObj[cat] || []) as Match[];
      const finalMatch = catMatches.find(m => m.round === '2' && m.status === 'COMPLETED');
      const bronzeMatch = catMatches.find(m => m.round === '1' && m.status === 'COMPLETED');

      let goldId: string | undefined;
      let silverId: string | undefined;
      let bronzeId: string | undefined;
      let fourthId: string | undefined;

      if (finalMatch?.winnerId) {
        goldId = finalMatch.winnerId;
        silverId = finalMatch.winnerId === finalMatch.archerAId ? finalMatch.archerBId : finalMatch.archerAId;
      }
      if (bronzeMatch?.winnerId) {
        bronzeId = bronzeMatch.winnerId;
        fourthId = bronzeMatch.winnerId === bronzeMatch.archerAId ? bronzeMatch.archerBId : bronzeMatch.archerAId;
      }

      // If no elimination matches, fallback to qualification rankings
      if (!goldId && rankedArchers.length > 0 && rankedArchers[0].total > 0) {
        goldId = rankedArchers[0].id;
        if (rankedArchers[1] && rankedArchers[1].total > 0) silverId = rankedArchers[1].id;
        if (rankedArchers[2] && rankedArchers[2].total > 0) bronzeId = rankedArchers[2].id;
        if (rankedArchers[3] && rankedArchers[3].total > 0) fourthId = rankedArchers[3].id;
      }

      // Build Podium Recipients
      const podiumList: CertificateRecipient[] = [];
      const podiumDefs = [
        { id: goldId, predicate: 'JUARA 1 (MEDALI EMAS)', medalType: 'GOLD' as const, rank: 1 },
        { id: silverId, predicate: 'JUARA 2 (MEDALI PERAK)', medalType: 'SILVER' as const, rank: 2 },
        { id: bronzeId, predicate: 'JUARA 3 (MEDALI PERUNGGU)', medalType: 'BRONZE' as const, rank: 3 },
        { id: fourthId, predicate: 'JUARA 4 / HARAPAN 1', medalType: 'FOURTH' as const, rank: 4 },
      ];

      podiumDefs.forEach(p => {
        if (!p.id) return;
        const archer = rankedArchers.find(a => a.id === p.id);
        if (!archer || (archer.total || 0) <= 0) return;

        podiumList.push({
          id: `${cat}-pod-${archer.id}`,
          archerId: archer.id,
          archerName: archer.name,
          club: archer.club || 'Individu / Bebas',
          category: cat,
          categoryLabel: CATEGORY_LABELS[cat] || cat,
          targetNo: archer.targetNo,
          position: archer.position,
          awardType: 'PODIUM',
          predicate: p.predicate,
          medalType: p.medalType,
          scoreTotal: archer.total,
          rank: p.rank,
          certificateNumber: `CERT/${eventCode}/${catCode}/POD-${String(p.rank).padStart(2, '0')}`
        });
      });

      // Build Participant list
      const participantList: CertificateRecipient[] = rankedArchers.map((archer, idx) => {
        const numStr = String(idx + 1).padStart(3, '0');
        return {
          id: `${cat}-part-${archer.id}`,
          archerId: archer.id,
          archerName: archer.name,
          club: archer.club || 'Individu / Bebas',
          category: cat,
          categoryLabel: CATEGORY_LABELS[cat] || cat,
          targetNo: archer.targetNo,
          position: archer.position,
          awardType: 'PARTICIPANT',
          predicate: archer.total > 0 ? `PESERTA (PERINGKAT KE-${idx + 1})` : 'PESERTA RESMI',
          medalType: 'PARTICIPANT',
          scoreTotal: archer.total,
          rank: idx + 1,
          certificateNumber: `CERT/${eventCode}/${catCode}/${numStr}`
        };
      });

      // Filter based on recipientFilter
      if (recipientFilter === 'WINNERS_ONLY') {
        resultList.push(...podiumList);
      } else if (recipientFilter === 'ALL_PARTICIPANTS') {
        resultList.push(...participantList);
      } else if (recipientFilter === 'CUSTOM_SELECTION') {
        const customSelected = participantList.filter(p => selectedArcherIds.includes(p.archerId));
        resultList.push(...customSelected);
      }
    });

    return resultList;
  }, [event, selectedCategory, recipientFilter, selectedArcherIds]);

  // Ensure current preview index is safe
  useEffect(() => {
    if (currentPreviewIndex >= recipients.length) {
      setCurrentPreviewIndex(Math.max(0, recipients.length - 1));
    }
  }, [recipients.length, currentPreviewIndex]);

  // Active recipient being viewed in preview
  const currentRecipient = recipients[currentPreviewIndex] || null;

  // Handle Save Settings
  const handleSaveCertificateConfig = () => {
    if (!onSaveSettings) return;
    const newConfig: CertificateConfig = {
      templateStyle,
      customBackgroundUrl: customBgUrl,
      useCustomBackgroundOnly: useCustomBgOnly,
      printTextOnlyMode,
      title: certTitle,
      subtitle: certSubtitle,
      bodyTextTemplate: bodyTemplate,
      showTournamentLogo,
      showClubLogo,
      showSecondaryLogo,
      showMedalBadge,
      showQrVerification,
      showDateLocation,
      signatories,
      customStampUrl,
      nameOffsetY,
      nameFontSize,
      primaryTextColor
    };

    onSaveSettings({
      ...event.settings,
      certificateConfig: newConfig
    });
    toast.success('Pengaturan & desain sertifikat berhasil disimpan!');
  };

  // Upload Custom Background Handlers
  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCustomBgUrl(reader.result as string);
        setUseCustomBgOnly(true);
        setTemplateStyle('CUSTOM_BACKGROUND');
        toast.success('File desain sertifikat berhasil diunggah!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload Stamp Handler
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCustomStampUrl(reader.result as string);
        toast.success('Stempel resmi panitia berhasil diunggah!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload Signatory Signature Handler
  const handleSignatureUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const next = [...signatories];
        next[index] = { ...next[index], signatureUrl: reader.result as string };
        setSignatories(next);
        toast.success(`Tanda tangan ${next[index].role} berhasil diunggah!`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Print Execution
  const handlePrint = (scope: 'ALL' | 'SINGLE') => {
    setPrintScope(scope);
    document.body.classList.add('printing-certificate-active');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Render a Single Certificate Page Sheet (used for both Preview and Print Portal)
  const renderCertificateSheet = (recipient: CertificateRecipient, isSinglePrintMode = false) => {
    const tournamentName = event.settings?.tournamentName || 'TURNAMEN PANAHAN RESMI';
    const location = event.settings?.location || 'Lapangan Panahan';
    const eventDate = event.settings?.eventDate 
      ? new Date(event.settings.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Format body text
    const renderedBody = bodyTemplate
      .replace('{PREDICATE}', recipient.predicate)
      .replace('{CATEGORY}', recipient.categoryLabel)
      .replace('{TOURNAMENT_NAME}', tournamentName)
      .replace('{DATE}', eventDate)
      .replace('{LOCATION}', location);

    const isGold = recipient.medalType === 'GOLD';
    const isSilver = recipient.medalType === 'SILVER';
    const isBronze = recipient.medalType === 'BRONZE';
    const isFourth = recipient.medalType === 'FOURTH';

    // Logo URLs
    const tournamentLogo = event.settings?.logoUrl ? resolveGoogleDriveUrl(event.settings.logoUrl) : null;
    const clubLogo = event.settings?.clubLogoUrl ? resolveGoogleDriveUrl(event.settings.clubLogoUrl) : null;
    const secondaryLogo = event.settings?.secondaryLogoUrl ? resolveGoogleDriveUrl(event.settings.secondaryLogoUrl) : null;
    const customBg = customBgUrl ? resolveGoogleDriveUrl(customBgUrl) : null;

    // Font size classes for name
    const nameSizeClass = {
      sm: 'text-2xl sm:text-3xl md:text-4xl',
      md: 'text-3xl sm:text-4xl md:text-5xl',
      lg: 'text-4xl sm:text-5xl md:text-6xl',
      xl: 'text-5xl sm:text-6xl md:text-7xl'
    }[nameFontSize];

    return (
      <div 
        key={recipient.id}
        className={`certificate-sheet-page relative w-full aspect-[297/210] flex flex-col justify-between overflow-hidden select-none ${
          printTextOnlyMode ? 'bg-transparent text-slate-900' : 'bg-white'
        }`}
        style={{
          fontFamily: "'Playfair Display', serif, sans-serif",
          boxSizing: 'border-box'
        }}
      >
        {/* Print Landscape Orientation Style Injector */}
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: A4 landscape;
            margin: 0;
          }
        `}} />

        {/* 1. BACKGROUND LAYER */}
        {!printTextOnlyMode && (
          <>
            {/* Custom Uploaded Background Image */}
            {customBg && (
              <img 
                src={customBg} 
                alt="Certificate Blanko" 
                className="absolute inset-0 w-full h-full object-cover object-center z-0" 
                referrerPolicy="no-referrer"
              />
            )}

            {/* If NOT using custom background ONLY, render beautiful built-in frames */}
            {(!useCustomBgOnly || !customBg) && (
              <>
                {/* Style: ROYAL GOLD */}
                {templateStyle === 'ROYAL_GOLD' && (
                  <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F5] via-[#FFFDF9] to-[#F5EFEB]" />
                    {/* Outer Gold Border */}
                    <div className="absolute inset-3 sm:inset-4 md:inset-5 border-[3px] sm:border-[4px] border-[#D4AF37]" />
                    {/* Inner Fine Border */}
                    <div className="absolute inset-5 sm:inset-6 md:inset-7 border border-[#B8860B]/50" />
                    {/* Corner Ornaments */}
                    <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-[#B8860B]" />
                    <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-[#B8860B]" />
                    <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-[#B8860B]" />
                    <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-[#B8860B]" />
                    {/* Watermark Target Rings */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-amber-900/5 pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border border-amber-900/5 pointer-events-none" />
                  </div>
                )}

                {/* Style: MODERN SPORT */}
                {templateStyle === 'MODERN_SPORT' && (
                  <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-br from-slate-50 via-white to-red-50/40">
                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-red-600 via-amber-500 to-slate-900" />
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-r from-slate-900 via-amber-500 to-red-600" />
                    <div className="absolute inset-4 sm:inset-6 border-2 border-slate-900/15" />
                    <div className="absolute top-6 left-6 w-8 h-8 bg-red-600/10 rotate-45" />
                    <div className="absolute top-6 right-6 w-8 h-8 bg-slate-900/10 rotate-45" />
                    <div className="absolute bottom-6 left-6 w-8 h-8 bg-slate-900/10 rotate-45" />
                    <div className="absolute bottom-6 right-6 w-8 h-8 bg-red-600/10 rotate-45" />
                  </div>
                )}

                {/* Style: TRADITIONAL HERITAGE */}
                {templateStyle === 'TRADITIONAL_HERITAGE' && (
                  <div className="absolute inset-0 pointer-events-none z-0 bg-[#FDFBF7]">
                    <div className="absolute inset-4 sm:inset-6 border-4 border-[#78350F]/70" />
                    <div className="absolute inset-6 sm:inset-8 border border-dashed border-[#B45309]/50" />
                    {/* Vintage Corner Brackets */}
                    <div className="absolute top-7 left-7 w-10 h-10 border-t-2 border-l-2 border-[#78350F]" />
                    <div className="absolute top-7 right-7 w-10 h-10 border-t-2 border-r-2 border-[#78350F]" />
                    <div className="absolute bottom-7 left-7 w-10 h-10 border-b-2 border-l-2 border-[#78350F]" />
                    <div className="absolute bottom-7 right-7 w-10 h-10 border-b-2 border-r-2 border-[#78350F]" />
                  </div>
                )}

                {/* Style: MINIMAL CLEAN */}
                {templateStyle === 'MINIMAL_CLEAN' && (
                  <div className="absolute inset-0 pointer-events-none z-0 bg-white">
                    <div className="absolute inset-6 sm:inset-8 border border-slate-900" />
                    <div className="absolute inset-7 sm:inset-9 border border-slate-300" />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 2. FOREGROUND CONTENT LAYER */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-6 sm:p-10 md:p-12">
          
          {/* TOP HEADER: Logos & Tournament Identity */}
          <div className="w-full flex items-center justify-between gap-4">
            {/* Left Logos */}
            <div className="flex items-center gap-3">
              {showTournamentLogo && tournamentLogo && (
                <img 
                  src={tournamentLogo} 
                  alt="Tournament Logo" 
                  className="h-10 sm:h-14 md:h-16 w-auto object-contain max-w-[120px]" 
                  referrerPolicy="no-referrer"
                />
              )}
              {showClubLogo && clubLogo && (
                <img 
                  src={clubLogo} 
                  alt="Club Logo" 
                  className="h-9 sm:h-12 md:h-14 w-auto object-contain max-w-[100px]" 
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* Center Header: Official Title */}
            <div className="text-center flex-1 px-2">
              <p className="text-[9px] sm:text-xs tracking-[0.3em] font-black uppercase text-amber-700/90 mb-1 font-sans">
                {tournamentName}
              </p>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-wider text-slate-900 uppercase leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>
                {certTitle}
              </h1>
              <div className="w-24 sm:w-36 h-0.5 bg-gradient-to-r from-transparent via-amber-600 to-transparent mx-auto mt-2" />
            </div>

            {/* Right Logos & Medal/Badge */}
            <div className="flex items-center gap-3 justify-end">
              {showSecondaryLogo && secondaryLogo && (
                <img 
                  src={secondaryLogo} 
                  alt="Organization Logo" 
                  className="h-9 sm:h-12 md:h-14 w-auto object-contain max-w-[100px]" 
                  referrerPolicy="no-referrer"
                />
              )}
              {showMedalBadge && (isGold || isSilver || isBronze || isFourth) && (
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-md border-2 ${
                    isGold ? 'bg-amber-400 border-amber-300 text-amber-950' :
                    isSilver ? 'bg-slate-300 border-slate-200 text-slate-900' :
                    isBronze ? 'bg-amber-700 border-amber-600 text-amber-100' :
                    'bg-indigo-600 border-indigo-400 text-white'
                  }`}>
                    {isGold ? (
                      <Trophy className="w-5 h-5 sm:w-7 sm:h-7" />
                    ) : (
                      <Medal className="w-5 h-5 sm:w-7 sm:h-7" />
                    )}
                  </div>
                  <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider font-sans mt-0.5 text-slate-800">
                    {isGold ? 'Emas' : isSilver ? 'Perak' : isBronze ? 'Perunggu' : 'Podium'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* MAIN BODY: Awardee Name & Predicate */}
          <div 
            className="w-full text-center flex flex-col items-center justify-center my-auto transition-transform"
            style={{ transform: `translateY(${nameOffsetY}px)` }}
          >
            <p className="text-xs sm:text-sm md:text-base font-medium text-slate-600 italic mb-2 tracking-wide font-serif">
              {certSubtitle}
            </p>

            {/* Awardee Full Name */}
            <div className="relative inline-block my-1 sm:my-2 max-w-full px-4">
              <h2 
                className={`${nameSizeClass} font-black tracking-wide uppercase px-4 truncate leading-tight`}
                style={{ 
                  fontFamily: "'Playfair Display', serif",
                  color: primaryTextColor
                }}
              >
                {recipient.archerName}
              </h2>
              <div className="h-0.5 w-full bg-slate-900/40 mt-1" />
            </div>

            {/* Club / Contingent */}
            <p className="text-xs sm:text-base font-bold text-slate-700 uppercase tracking-widest font-sans mt-0.5">
              {recipient.club}
            </p>

            {/* Predicate Ribbon / Box */}
            <div className="mt-3 sm:mt-4 inline-flex items-center gap-2 px-5 py-1.5 sm:px-8 sm:py-2 rounded-full border shadow-xs"
              style={{
                backgroundColor: isGold ? '#FEF3C7' : isSilver ? '#F1F5F9' : isBronze ? '#FFEDD5' : '#F8FAFC',
                borderColor: isGold ? '#F59E0B' : isSilver ? '#94A3B8' : isBronze ? '#EA580C' : '#CBD5E1',
                color: isGold ? '#92400E' : isSilver ? '#334155' : isBronze ? '#9A3412' : '#1E293B'
              }}
            >
              <Award className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="text-xs sm:text-base md:text-lg font-black tracking-wider uppercase font-sans">
                {recipient.predicate}
              </span>
            </div>

            {/* Narrative Body Description */}
            <p className="max-w-2xl text-[10px] sm:text-xs md:text-sm text-slate-600 font-sans leading-relaxed mt-3 sm:mt-4 px-6 text-center">
              {renderedBody}
            </p>
          </div>

          {/* BOTTOM FOOTER: Signatures, Stamp & QR Code */}
          <div className="w-full flex items-end justify-between gap-4 pt-2">
            
            {/* Left Column: QR Verification & Cert ID */}
            <div className="flex items-center gap-3">
              {showQrVerification && (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs shrink-0">
                  <QRCodeSVG 
                    value={`https://arcus-archery.web.app/verify?cert=${encodeURIComponent(recipient.certificateNumber)}&archer=${encodeURIComponent(recipient.archerName)}`}
                    size={48}
                    level="M"
                  />
                </div>
              )}
              <div className="text-left font-sans">
                <p className="text-[7.5px] sm:text-[8.5px] text-slate-700 font-bold uppercase tracking-wider">
                  Nomor Sertifikat:
                </p>
                <p className="text-[9px] sm:text-[11px] font-mono font-black text-slate-900 uppercase">
                  {recipient.certificateNumber}
                </p>
                {showDateLocation && (
                  <p className="text-[7.5px] sm:text-[8.5px] text-slate-700 font-medium">
                    {location}, {eventDate}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Signatories & Official Stamp */}
            <div className="relative flex items-end justify-end gap-6 sm:gap-10 font-sans">
              
              {/* Optional Official Stamp (Stempel Panitia) layered over signatures */}
              {customStampUrl && (
                <div className="absolute right-12 sm:right-20 bottom-3 w-20 h-20 sm:w-28 sm:h-28 pointer-events-none opacity-80 -rotate-12 z-20">
                  <img 
                    src={resolveGoogleDriveUrl(customStampUrl)} 
                    alt="Official Stamp" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Signatories list */}
              {signatories.map((sig, idx) => (
                <div key={sig.id || idx} className="text-center w-36 sm:w-44 shrink-0 flex flex-col items-center">
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {sig.role}
                  </p>
                  
                  {/* Signature line / image box */}
                  <div className="h-12 sm:h-16 w-full flex items-center justify-center overflow-hidden">
                    {sig.signatureUrl ? (
                      <img 
                        src={resolveGoogleDriveUrl(sig.signatureUrl)} 
                        alt={`Signature ${sig.name}`} 
                        className="max-h-12 sm:max-h-16 w-auto max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-end justify-center pb-1">
                        <span className="text-[8px] text-slate-300 font-sans italic">Tanda Tangan</span>
                      </div>
                    )}
                  </div>

                  {/* Signatory Name */}
                  <div className="w-full border-t border-slate-900/80 pt-1 mt-0.5">
                    <p className="text-[9px] sm:text-xs font-black uppercase text-slate-900 underline truncate">
                      {sig.name}
                    </p>
                  </div>
                </div>
              ))}

            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. INTERACTIVE MODAL (Screen Display) */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 md:p-6 print-hidden">
        <div className="w-full max-w-7xl h-[94vh] bg-slate-900 rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200">
          
          {/* TOP BAR */}
          <div className="p-4 sm:px-6 bg-slate-950 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black font-oswald uppercase tracking-wider text-white flex items-center gap-2">
                  <span>E-Sertifikat Turnamen Panahan</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono border border-amber-400/30">
                    A4 Landscape
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-medium truncate max-w-md">
                  {event.settings?.tournamentName} • Cetak &amp; Personalisasi E-Sertifikat per Kategori
                </p>
              </div>
            </div>

            {/* Navigation & Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Tab Selector: Preview vs Settings */}
              <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('PREVIEW')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'PREVIEW' ? 'bg-amber-400 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Pratinjau</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('SETTINGS')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'SETTINGS' ? 'bg-amber-400 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Desain &amp; Blanko</span>
                </button>
              </div>

              {/* Print Single Button */}
              {currentRecipient && (
                <button
                  type="button"
                  onClick={() => handlePrint('SINGLE')}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all border border-white/10 active:scale-95 flex items-center gap-1.5"
                  title="Cetak hanya 1 sertifikat atlet yang sedang tampil"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Cetak Atlet Ini</span>
                </button>
              )}

              {/* Print All Button */}
              <button
                type="button"
                onClick={() => handlePrint('ALL')}
                disabled={recipients.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Semua ({recipients.length})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN MODAL CONTAINER */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* SIDEBAR: Category Selector & Recipient Controls */}
            <div className="w-full md:w-80 lg:w-96 bg-slate-950/60 border-r border-white/10 p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto shrink-0">
              
              {/* 1. Pilih Kategori Pertandingan */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-400" /> 1. Kategori Pertandingan
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value as any)}
                  className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                >
                  <option value="ALL">🌟 SEMUA KATEGORI (CETAK BATCH)</option>
                  {(Object.keys(CATEGORY_LABELS) as CategoryType[]).map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Filter Penerima Sertifikat */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" /> 2. Target Penerima Sertifikat
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRecipientFilter('WINNERS_ONLY')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-all ${
                      recipientFilter === 'WINNERS_ONLY'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hanya Juara / Podium</span>
                    </span>
                    {recipientFilter === 'WINNERS_ONLY' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecipientFilter('ALL_PARTICIPANTS')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-all ${
                      recipientFilter === 'ALL_PARTICIPANTS'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Seluruh Peserta (Partisipasi)</span>
                    </span>
                    {recipientFilter === 'ALL_PARTICIPANTS' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecipientFilter('CUSTOM_SELECTION')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-all ${
                      recipientFilter === 'CUSTOM_SELECTION'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Pilih Atlet Tertentu (Manual)</span>
                    </span>
                    {recipientFilter === 'CUSTOM_SELECTION' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Recipient List Navigation / Selection */}
              <div className="flex-1 flex flex-col min-h-[160px] bg-slate-900/90 rounded-2xl border border-white/10 p-3 overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Daftar Sertifikat ({recipients.length})
                  </span>
                  {recipientFilter === 'CUSTOM_SELECTION' && (
                    <button
                      type="button"
                      onClick={() => {
                        const catArchers = (event.archers || []).filter(a => selectedCategory === 'ALL' || a.category === selectedCategory);
                        setSelectedArcherIds(selectedArcherIds.length === catArchers.length ? [] : catArchers.map(a => a.id));
                      }}
                      className="text-[9px] text-amber-400 font-bold hover:underline"
                    >
                      Pilih Semua
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {recipients.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">
                      Tidak ada pemanah pada filter ini.
                    </div>
                  ) : (
                    recipients.map((rec, idx) => (
                      <div
                        key={rec.id}
                        onClick={() => setCurrentPreviewIndex(idx)}
                        className={`p-2 rounded-xl cursor-pointer text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                          currentPreviewIndex === idx
                            ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                            : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold leading-tight">
                            {idx + 1}. {rec.archerName}
                          </p>
                          <p className={`text-[9px] truncate ${currentPreviewIndex === idx ? 'text-slate-800' : 'text-slate-400'}`}>
                            {rec.predicate} • {rec.club}
                          </p>
                        </div>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded font-mono shrink-0 ${
                          rec.medalType === 'GOLD' ? 'bg-amber-400/30 text-amber-950 border border-amber-500/40' :
                          rec.medalType === 'SILVER' ? 'bg-slate-200 text-slate-800 border border-slate-300' :
                          rec.medalType === 'BRONZE' ? 'bg-orange-200 text-orange-950 border border-orange-300' :
                          rec.awardType === 'PODIUM' ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' :
                          'bg-slate-700/50 text-slate-400'
                        }`}>
                          {rec.awardType === 'PODIUM' 
                            ? `Podium ${rec.rank}` 
                            : 'Peserta'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Summary Box */}
              <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-xl text-[10px] text-amber-200 leading-relaxed">
                💡 <strong>Tips Cetak:</strong> Sertifikat didesain presisi untuk kertas <strong>A4 Landscape</strong>. Klik <em>"Cetak Semua"</em> untuk langsung menyimpan satu file PDF berisi seluruh sertifikat.
              </div>

            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
              
              {/* TAB 1: PREVIEW DISPLAY */}
              {activeTab === 'PREVIEW' && (
                <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
                  
                  {/* Preview Toolbar */}
                  <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPreviewIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentPreviewIndex === 0}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors"
                        title="Sertifikat Sebelumnya"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {recipients.length > 0 ? `${currentPreviewIndex + 1} / ${recipients.length}` : '0 / 0'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPreviewIndex(prev => Math.min(recipients.length - 1, prev + 1))}
                        disabled={currentPreviewIndex >= recipients.length - 1}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors"
                        title="Sertifikat Selanjutnya"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">
                        Gaya Desain: <strong className="text-amber-400 font-mono">{templateStyle}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('SETTINGS')}
                        className="text-xs font-black text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Kustomisasi Desain &amp; Blanko</span>
                      </button>
                    </div>
                  </div>

                  {/* Certificate Paper Sheet Canvas (Interactive Zoom / Fit) */}
                  <div className="flex-1 overflow-auto bg-slate-900/60 rounded-2xl border border-white/10 p-2 sm:p-6 flex items-center justify-center">
                    {currentRecipient ? (
                      <div className="w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden ring-1 ring-white/10">
                        {renderCertificateSheet(currentRecipient)}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <Award className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-400">Tidak ada sertifikat untuk ditampilkan.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SETTINGS & CUSTOM BLANKO UPLOAD */}
              {activeTab === 'SETTINGS' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h4 className="text-lg font-black font-oswald uppercase text-white flex items-center gap-2">
                        <Palette className="w-5 h-5 text-amber-400" />
                        <span>Pengaturan Desain &amp; Blanko Sertifikat</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Pilih template bawaan resmi atau unggah file desain sertifikat buatan panitia sendiri.
                      </p>
                    </div>
                    {onSaveSettings && (
                      <button
                        type="button"
                        onClick={handleSaveCertificateConfig}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Simpan Desain</span>
                      </button>
                    )}
                  </div>

                  {/* SECTION 1: UPLOAD DESAIN SENDIRI (PENYELENGGARA) */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-amber-400/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-black">
                          🎨
                        </div>
                        <div>
                          <h5 className="text-sm font-black uppercase tracking-wider text-white">
                            Upload Desain Sertifikat Sendiri (Blanko Custom)
                          </h5>
                          <p className="text-xs text-slate-400">
                            Penyelenggara dapat mengunggah gambar latar sertifikat sendiri (Format PNG/JPG ukuran A4 Landscape).
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileBgInputRef.current?.click()}
                        className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Unggah File Desain</span>
                      </button>
                      <input 
                        ref={fileBgInputRef}
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleBgFileUpload}
                      />
                    </div>

                    {/* URL Input Fallback */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Atau Salin Link Gambar (URL / Google Drive):
                      </span>
                      <input 
                        type="url"
                        value={customBgUrl}
                        onChange={e => {
                          setCustomBgUrl(e.target.value);
                          if (e.target.value) setTemplateStyle('CUSTOM_BACKGROUND');
                        }}
                        placeholder="https://... atau Google Drive URL gambar sertifikat..."
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-amber-400"
                      />
                    </div>

                    {/* Custom Background Options */}
                    {customBgUrl && (
                      <div className="p-3 bg-slate-950/80 rounded-xl border border-white/10 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={resolveGoogleDriveUrl(customBgUrl)} 
                            alt="Background Preview" 
                            className="w-16 h-11 object-cover rounded-lg border border-white/20"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <p className="text-xs font-bold text-white">Desain Blanko Aktif</p>
                            <label className="flex items-center gap-2 mt-1 cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={useCustomBgOnly}
                                onChange={e => setUseCustomBgOnly(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-amber-400"
                              />
                              <span className="text-[10px] text-slate-300">
                                Sembunyikan bingkai bawaan (Tampilkan murni background custom)
                              </span>
                            </label>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomBgUrl('');
                            setUseCustomBgOnly(false);
                            setTemplateStyle('ROYAL_GOLD');
                          }}
                          className="text-xs font-bold text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg hover:bg-red-400/10 transition-colors"
                        >
                          Hapus Desain
                        </button>
                      </div>
                    )}

                    {/* Print Text Only Mode (For Physical Pre-printed Certificates) */}
                    <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">Mode Cetak Teks Saja (Text-Only)</p>
                        <p className="text-[10px] text-slate-400">
                          Aktifkan jika Anda mencetak ke kertas fisik piagam berdesain/hologram yang sudah dicetak dari percetakan.
                        </p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={printTextOnlyMode}
                        onChange={e => setPrintTextOnlyMode(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* SECTION 2: PILIHAN TEMPLATE BAWAAN */}
                  <div className="space-y-3">
                    <h5 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Atau Pilih Template Desain Resmi Arcus</span>
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: 'ROYAL_GOLD', name: 'Royal Gold Classic', desc: 'Resmi & Mewah bernuansa Emas' },
                        { id: 'MODERN_SPORT', name: 'Modern Athletic', desc: 'Sporty & Kontemporer' },
                        { id: 'TRADITIONAL_HERITAGE', name: 'Traditional Heritage', desc: 'Klasik Jemparingan / Perkamen' },
                        { id: 'MINIMAL_CLEAN', name: 'Minimalist Clean', desc: 'Sederhana & Elegan' }
                      ].map(tmpl => (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => {
                            setTemplateStyle(tmpl.id as CertificateTemplateStyle);
                            setUseCustomBgOnly(false);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            templateStyle === tmpl.id && !useCustomBgOnly
                              ? 'bg-amber-400/20 border-amber-400 text-white shadow-sm'
                              : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-xs font-black uppercase text-white">{tmpl.name}</p>
                          <p className="text-[9px] text-slate-400 mt-1">{tmpl.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 3: KUSTOMISASI POSISI & UKURAN TEKS */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-4">
                    <h5 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>Penyesuaian Posisi &amp; Teks</span>
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name Vertical Offset Slider (Very important for custom blankos!) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>Geser Posisi Vertikal Nama:</span>
                          <span className="font-mono text-amber-400">{nameOffsetY} px</span>
                        </div>
                        <input 
                          type="range"
                          min="-120"
                          max="120"
                          value={nameOffsetY}
                          onChange={e => setNameOffsetY(parseInt(e.target.value))}
                          className="w-full accent-amber-400"
                        />
                        <p className="text-[9px] text-slate-400">
                          Atur agar nama atlet tepat berada di atas garis blanko sertifikat Anda.
                        </p>
                      </div>

                      {/* Name Font Size */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-300 block">
                          Ukuran Huruf Nama:
                        </span>
                        <div className="flex gap-2">
                          {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setNameFontSize(size)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                                nameFontSize === size 
                                  ? 'bg-amber-400 text-slate-950 shadow-xs' 
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Judul & Subtitle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">Judul Utama Sertifikat:</span>
                        <input 
                          type="text"
                          value={certTitle}
                          onChange={e => setCertTitle(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">Teks Pengantar:</span>
                        <input 
                          type="text"
                          value={certSubtitle}
                          onChange={e => setCertSubtitle(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Template Narasi */}
                    <div className="space-y-1 pt-2">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        Template Narasi Kalimat Sertifikat:
                      </span>
                      <textarea
                        rows={2}
                        value={bodyTemplate}
                        onChange={e => setBodyTemplate(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white resize-none"
                      />
                      <p className="text-[9px] text-slate-400 font-mono">
                        Variabel otomatis: {'{PREDICATE}'}, {'{CATEGORY}'}, {'{TOURNAMENT_NAME}'}, {'{DATE}'}, {'{LOCATION}'}
                      </p>
                    </div>
                  </div>

                  {/* SECTION 4: TANDA TANGAN & STEMPEL RESMI */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Penandatangan &amp; Stempel Resmi Panitia</span>
                      </h5>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileStampInputRef.current?.click()}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                          <Upload className="w-3 h-3 text-emerald-400" />
                          <span>Unggah Stempel</span>
                        </button>
                        <input 
                          ref={fileStampInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleStampUpload}
                        />
                      </div>
                    </div>

                    {customStampUrl && (
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img 
                            src={resolveGoogleDriveUrl(customStampUrl)} 
                            alt="Stempel" 
                            className="w-8 h-8 object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs text-slate-300 font-bold">Stempel Resmi Terpasang</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomStampUrl('')}
                          className="text-[10px] text-red-400 font-bold hover:underline"
                        >
                          Hapus Stempel
                        </button>
                      </div>
                    )}

                    {/* 2 Signatories inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {signatories.map((sig, idx) => (
                        <div key={sig.id || idx} className="p-4 bg-slate-950 rounded-xl border border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-amber-400 font-mono">
                              Penandatangan #{idx + 1}
                            </span>
                            <label className="cursor-pointer text-[10px] font-bold text-amber-300 hover:underline flex items-center gap-1">
                              <Upload className="w-3 h-3" />
                              <span>Upload TTD</span>
                              <input 
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => handleSignatureUpload(idx, e)}
                              />
                            </label>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Jabatan / Role:</span>
                            <input 
                              type="text"
                              value={sig.role}
                              onChange={e => {
                                const next = [...signatories];
                                next[idx].role = e.target.value;
                                setSignatories(next);
                              }}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              placeholder="e.g. Ketua Panitia Pelaksana"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Nama Lengkap &amp; Gelar:</span>
                            <input 
                              type="text"
                              value={sig.name}
                              onChange={e => {
                                const next = [...signatories];
                                next[idx].name = e.target.value;
                                setSignatories(next);
                              }}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                              placeholder="e.g. Ir. Fulan, S.T."
                            />
                          </div>

                          {sig.signatureUrl && (
                            <div className="flex items-center justify-between text-[10px] text-emerald-400 pt-1">
                              <span>✓ File TTD Terpasang</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...signatories];
                                  next[idx].signatureUrl = '';
                                  setSignatories(next);
                                }}
                                className="text-red-400 hover:underline"
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save Settings Action */}
                  <div className="pt-2 pb-6">
                    <button
                      type="button"
                      onClick={handleSaveCertificateConfig}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Simpan &amp; Terapkan Konfigurasi E-Sertifikat</span>
                    </button>
                  </div>

                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* 2. PURE PRINT PORTAL (Only rendered for browser window.print()) */}
      {typeof document !== 'undefined' && createPortal(
        <div className="certificate-print-portal">
          {printScope === 'SINGLE' && currentRecipient ? (
            renderCertificateSheet(currentRecipient, true)
          ) : (
            recipients.map(recipient => renderCertificateSheet(recipient, false))
          )}
        </div>,
        document.body
      )}
    </>
  );
}
