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
    existingConfig?.bodyTextTemplate || 'Atas dedikasi, sportivitas, dan partisipasi gemilang dalam kejuaraan {TOURNAMENT_NAME} Kategori {CATEGORY}, yang diselenggarakan pada {DATE} di {LOCATION}.'
  );
  const [showTournamentLogo, setShowTournamentLogo] = useState<boolean>(existingConfig?.showTournamentLogo ?? true);
  const [showClubLogo, setShowClubLogo] = useState<boolean>(existingConfig?.showClubLogo ?? true);
  const [showSecondaryLogo, setShowSecondaryLogo] = useState<boolean>(existingConfig?.showSecondaryLogo ?? true);
  const [showMedalBadge, setShowMedalBadge] = useState<boolean>(existingConfig?.showMedalBadge ?? true);
  const [showQrVerification, setShowQrVerification] = useState<boolean>(existingConfig?.showQrVerification ?? true);
  const [showDateLocation, setShowDateLocation] = useState<boolean>(existingConfig?.showDateLocation ?? true);
  const [nameOffsetY, setNameOffsetY] = useState<number>(existingConfig?.nameOffsetY ?? 0);
  const [nameFontSize, setNameFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(existingConfig?.nameFontSize || 'lg');
  const [titleFontSize, setTitleFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(existingConfig?.titleFontSize || 'lg');
  const [fontFamily, setFontFamily] = useState<'PLAYFAIR' | 'CINZEL' | 'GARAMOND' | 'OSWALD' | 'MONTSERRAT'>(
    existingConfig?.fontFamily || 'PLAYFAIR'
  );
  const [sectionSpacing, setSectionSpacing] = useState<'COMPACT' | 'BALANCED' | 'SPREAD'>(
    existingConfig?.sectionSpacing || 'COMPACT'
  );
  const [sectionGap, setSectionGap] = useState<number>(existingConfig?.sectionGap ?? 14);
  const [manualCertNumbers, setManualCertNumbers] = useState<Record<string, string>>(
    existingConfig?.manualCertNumbers || {}
  );
  const [manualCertNumberFormat, setManualCertNumberFormat] = useState<string>(
    existingConfig?.manualCertNumberFormat || ''
  );
  const [primaryTextColor, setPrimaryTextColor] = useState<string>(existingConfig?.primaryTextColor || '#0f172a');
  const [customStampUrl, setCustomStampUrl] = useState<string>(existingConfig?.customStampUrl || '');
  const [participantPredicateStyle, setParticipantPredicateStyle] = useState<'PESERTA_ONLY' | 'WITH_RANK'>(
    existingConfig?.participantPredicateStyle || 'PESERTA_ONLY'
  );
  const [participantCustomLabel, setParticipantCustomLabel] = useState<string>(() => {
    const raw = existingConfig?.participantCustomLabel;
    if (raw && /resmi/i.test(raw)) return 'Peserta';
    return raw || 'Peserta';
  });
  const [centerOffsetY, setCenterOffsetY] = useState<number>(existingConfig?.centerOffsetY ?? 0);

  // Helper font family styling
  const getFontFamilyStyle = (font: string) => {
    switch (font) {
      case 'CINZEL':
        return "'Cinzel', Georgia, serif";
      case 'GARAMOND':
        return "'Cormorant Garamond', Georgia, serif";
      case 'OSWALD':
        return "'Oswald', sans-serif";
      case 'MONTSERRAT':
        return "'Montserrat', sans-serif";
      case 'PLAYFAIR':
      default:
        return "'Playfair Display', Georgia, serif";
    }
  };

  const handleUpdateRecipientCertNumber = (archerId: string, newNumber: string) => {
    setManualCertNumbers(prev => ({
      ...prev,
      [archerId]: newNumber
    }));
  };

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
      const styleEl = document.getElementById('arcus-cert-print-landscape-style');
      if (styleEl) styleEl.remove();
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-certificate-active');
      const styleEl = document.getElementById('arcus-cert-print-landscape-style');
      if (styleEl) styleEl.remove();
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

        const defaultPodiumNum = `CERT/${eventCode}/${catCode}/POD-${String(p.rank).padStart(2, '0')}`;
        const finalCertNum = manualCertNumbers[archer.id]
          ? manualCertNumbers[archer.id]
          : manualCertNumberFormat && manualCertNumberFormat.trim()
          ? manualCertNumberFormat.replace('{NUMBER}', String(p.rank).padStart(3, '0')).replace('{NUM}', String(p.rank))
          : defaultPodiumNum;

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
          certificateNumber: finalCertNum
        });
      });

      // Build Participant list
      const participantList: CertificateRecipient[] = rankedArchers.map((archer, idx) => {
        const numStr = String(idx + 1).padStart(3, '0');
        const defaultLabel = participantCustomLabel?.trim() || 'Peserta';
        const cleanLabel = defaultLabel.replace(/\bresmi\b/gi, '').trim() || 'Peserta';
        const participantPredicate = participantPredicateStyle === 'WITH_RANK' && archer.total > 0
          ? `${cleanLabel} (Peringkat ke-${idx + 1})`
          : cleanLabel;

        const defaultPartNum = `CERT/${eventCode}/${catCode}/${numStr}`;
        const finalCertNum = manualCertNumbers[archer.id]
          ? manualCertNumbers[archer.id]
          : manualCertNumberFormat && manualCertNumberFormat.trim()
          ? manualCertNumberFormat.replace('{NUMBER}', numStr).replace('{NUM}', String(idx + 1))
          : defaultPartNum;

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
          predicate: participantPredicate,
          medalType: 'PARTICIPANT',
          scoreTotal: archer.total,
          rank: idx + 1,
          certificateNumber: finalCertNum
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
  }, [event, selectedCategory, recipientFilter, selectedArcherIds, participantPredicateStyle, participantCustomLabel, manualCertNumbers, manualCertNumberFormat]);

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
      titleFontSize,
      fontFamily,
      sectionSpacing,
      sectionGap,
      manualCertNumbers,
      manualCertNumberFormat,
      primaryTextColor,
      participantPredicateStyle,
      participantCustomLabel,
      centerOffsetY
    };

    onSaveSettings({
      ...event.settings,
      certificateConfig: newConfig
    });
    toast.success('Pengaturan & desain sertifikat berhasil disimpan!');
  };

  // Apply batch manual certificate numbering
  const handleApplyManualNumberFormat = () => {
    if (!manualCertNumberFormat || !manualCertNumberFormat.trim()) {
      toast.warning('Masukkan format nomor sertifikat terlebih dahulu (contoh: {NUMBER}/PAN-KEBUMEN/2026)');
      return;
    }
    const newNumbers: Record<string, string> = {};
    recipients.forEach((rec, idx) => {
      const numStr = String(idx + 1).padStart(3, '0');
      newNumbers[rec.archerId] = manualCertNumberFormat
        .replace('{NUMBER}', numStr)
        .replace('{NUM}', String(idx + 1))
        .replace('{YEAR}', String(new Date().getFullYear()));
    });
    setManualCertNumbers(newNumbers);
    toast.success(`Format nomor manual diterapkan ke ${recipients.length} sertifikat!`);
  };

  const handleResetCertNumbers = () => {
    setManualCertNumbers({});
    setManualCertNumberFormat('');
    toast.info('Nomor sertifikat dikembalikan ke penomoran otomatis sistem.');
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
    // Inject print page orientation rule directly into head for landscape A4 guarantee
    let styleEl = document.getElementById('arcus-cert-print-landscape-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'arcus-cert-print-landscape-style';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `@page { size: 297mm 210mm landscape !important; margin: 0 !important; } @media print { @page { size: 297mm 210mm landscape !important; margin: 0 !important; } }`;

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

    // Sanitize participant display predicate strictly: Never show "Peserta Resmi", only "Peserta"
    const isParticipant = recipient.awardType === 'PARTICIPANT';
    const displayPredicate = isParticipant
      ? (recipient.predicate.replace(/\bresmi\b/gi, '').trim() || 'Peserta').toUpperCase()
      : recipient.predicate;

    // Format body text
    const renderedBody = bodyTemplate
      .replace('{PREDICATE}', displayPredicate)
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

    // Font size classes for name - substantial and commanding
    const nameSizeClass = {
      sm: 'text-2xl sm:text-3xl md:text-4xl print:text-4xl',
      md: 'text-3xl sm:text-4xl md:text-5xl print:text-5xl',
      lg: 'text-4xl sm:text-5xl md:text-6xl print:text-5xl',
      xl: 'text-5xl sm:text-6xl md:text-7xl print:text-6xl'
    }[nameFontSize];

    // Font size classes for title
    const titleSizeClass = {
      sm: 'text-2xl sm:text-3xl md:text-4xl print:text-4xl',
      md: 'text-3xl sm:text-4xl md:text-5xl print:text-5xl',
      lg: 'text-4xl sm:text-5xl md:text-6xl print:text-6xl',
      xl: 'text-5xl sm:text-6xl md:text-7xl print:text-7xl'
    }[titleFontSize];

    return (
      <div 
        key={recipient.id}
        className={`certificate-sheet-page relative w-full aspect-[297/210] flex flex-col overflow-hidden select-none ${
          printTextOnlyMode ? 'bg-transparent text-slate-900' : 'bg-white'
        }`}
        style={{
          fontFamily: getFontFamilyStyle(fontFamily),
          boxSizing: 'border-box'
        }}
      >
        {/* Print Landscape Orientation Style Injector */}
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: 297mm 210mm landscape !important;
            margin: 0 !important;
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

        {/* 2. FOREGROUND CONTENT LAYER - CLOSE, DENSE & PROPORTIONAL */}
        <div 
          className={`relative z-10 w-full h-full flex flex-col items-center px-8 sm:px-12 md:px-14 print:px-10 transition-all ${
            sectionSpacing === 'SPREAD'
              ? 'justify-between py-6 sm:py-8 md:py-9 print:py-7'
              : 'justify-center py-4 print:py-4'
          }`}
          style={{
            rowGap: sectionSpacing === 'SPREAD' ? undefined : `${sectionGap}px`,
            transform: centerOffsetY ? `translateY(${centerOffsetY}px)` : undefined
          }}
        >
          
          {/* HEADER: Logos Kiri & Kanan, Judul Sertifikat & Nomor di Tengah */}
          <div className="w-full flex items-center justify-between gap-3 shrink-0">
            {/* Left Logos */}
            <div className="flex items-center gap-2.5 w-32 sm:w-40 justify-start">
              {showTournamentLogo && tournamentLogo && (
                <img 
                  src={tournamentLogo} 
                  alt="Tournament Logo" 
                  className="h-10 sm:h-12 md:h-14 w-auto object-contain max-w-[100px]" 
                  referrerPolicy="no-referrer"
                />
              )}
              {showClubLogo && clubLogo && (
                <img 
                  src={clubLogo} 
                  alt="Club Logo" 
                  className="h-9 sm:h-11 md:h-12 w-auto object-contain max-w-[85px]" 
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* Center: Kop Event, Judul SERTIFIKAT, dan Nomor Sertifikat */}
            <div className="text-center flex-1 px-2">
              <p className="text-[10px] sm:text-xs md:text-sm tracking-[0.22em] font-black uppercase text-amber-900/90 mb-0.5 font-sans">
                {tournamentName}
              </p>
              <h1 
                className={`${titleSizeClass} font-black tracking-wider text-slate-900 uppercase leading-none drop-shadow-2xs`}
                style={{ fontFamily: getFontFamilyStyle(fontFamily) }}
              >
                {certTitle}
              </h1>
              {/* Nomor Sertifikat tepat di bawah tulisan SERTIFIKAT */}
              <p className="text-xs sm:text-[13px] font-sans font-bold text-slate-700 tracking-wider mt-1">
                Nomor : <span className="font-mono font-black text-slate-900">{recipient.certificateNumber}</span>
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className="w-16 sm:w-28 h-0.5 bg-gradient-to-r from-transparent to-amber-600" />
                <div className="w-1.5 h-1.5 bg-amber-600 rotate-45 shrink-0 shadow-xs" />
                <div className="w-16 sm:w-28 h-0.5 bg-gradient-to-l from-transparent to-amber-600" />
              </div>
            </div>

            {/* Right Logos & Medal/Badge */}
            <div className="flex items-center gap-2.5 w-32 sm:w-40 justify-end">
              {showSecondaryLogo && secondaryLogo && (
                <img 
                  src={secondaryLogo} 
                  alt="Organization Logo" 
                  className="h-9 sm:h-11 md:h-12 w-auto object-contain max-w-[85px]" 
                  referrerPolicy="no-referrer"
                />
              )}
              {showMedalBadge && (isGold || isSilver || isBronze || isFourth) && (
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-md border-2 ${
                    isGold ? 'bg-amber-400 border-amber-300 text-amber-950' :
                    isSilver ? 'bg-slate-300 border-slate-200 text-slate-900' :
                    isBronze ? 'bg-amber-700 border-amber-600 text-amber-100' :
                    'bg-indigo-600 border-indigo-400 text-white'
                  }`}>
                    {isGold ? <Trophy className="w-5 h-5 sm:w-6 sm:h-6" /> : <Medal className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <span className="text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider font-sans mt-0.5 text-slate-800">
                    {isGold ? 'Emas' : isSilver ? 'Perak' : isBronze ? 'Perunggu' : 'Podium'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* MAIN BODY: Center Page Focused, Dense, Close to Header and Footer */}
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center px-4 shrink-0">
            {/* Kalimat Pengantar */}
            <p className="text-xs sm:text-sm font-serif italic text-slate-700 tracking-wide mb-1 leading-none font-medium">
              {certSubtitle}
            </p>

            {/* Nama Atlet - Besar, Gagah, Berwibawa */}
            <div className="w-full max-w-xl px-2 my-1">
              <h2 
                className={`${nameSizeClass} font-black tracking-wide uppercase px-2 truncate leading-tight drop-shadow-xs`}
                style={{ 
                  fontFamily: getFontFamilyStyle(fontFamily),
                  color: primaryTextColor
                }}
              >
                {recipient.archerName}
              </h2>
              {/* Garis tegas di bawah nama atlet */}
              <div className="w-48 sm:w-72 h-[1.5px] bg-slate-900/80 mx-auto mt-1" />
            </div>

            {/* Asal Klub / Kontingen - Menempel Rapat & Rapi */}
            {recipient.club && recipient.club !== 'Individu / Bebas' && (
              <p className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest font-sans mb-1.5 leading-none">
                {`Klub : ${recipient.club}`}
              </p>
            )}

            {/* Teks Sebagai */}
            <p className="text-[11px] sm:text-xs font-serif italic text-slate-600 mb-0.5 leading-none">
              Sebagai :
            </p>

            {/* Predikat - Murni Tipografi Tanpa Pill, Bersih & Gagah (Contoh: PESERTA / JUARA 1) */}
            <p className="text-xl sm:text-2xl md:text-3xl font-black tracking-[0.16em] text-slate-950 uppercase font-sans mb-1.5 leading-none">
              {displayPredicate}
            </p>

            {/* Kalimat Narasi Turnamen - Padat, Rapat, Mengalir & Menyatu */}
            <p className="max-w-xl text-[11px] sm:text-xs md:text-[13px] text-slate-700 font-serif leading-snug px-2 text-center italic">
              {renderedBody}
            </p>
          </div>

          {/* FOOTER: Tanggal/Kota di atas tanda tangan kanan, 2 Penandatangan, Stempel, dan QR Verifikasi */}
          <div className="w-full shrink-0 flex items-end justify-between gap-6 pt-1 font-sans">
            
            {/* Kiri: QR Verification & Keaslian Dokumen */}
            <div className="flex items-center gap-3">
              {showQrVerification && (
                <div className="p-1.5 bg-white rounded-lg border border-slate-300 shadow-xs shrink-0">
                  <QRCodeSVG 
                    value={`https://arcus-archery.web.app/verify?cert=${encodeURIComponent(recipient.certificateNumber)}&archer=${encodeURIComponent(recipient.archerName)}`}
                    size={46}
                    level="M"
                  />
                </div>
              )}
              <div className="text-left font-sans">
                <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                  Verifikasi Sertifikat Resmi:
                </p>
                <p className="text-[9px] sm:text-[10px] font-mono font-black text-slate-800 uppercase">
                  {recipient.certificateNumber}
                </p>
                <p className="text-[7.5px] text-slate-400">
                  Scan QR untuk cek keaslian data atlet & skor
                </p>
              </div>
            </div>

            {/* Kanan: Titik Mangsa (Kota, Tanggal) & Kolom Tanda Tangan */}
            <div className="flex flex-col items-end">
              {showDateLocation && (
                <p className="text-xs sm:text-sm font-serif italic text-slate-800 mb-2 font-medium">
                  {location}, {eventDate}
                </p>
              )}

              <div className="relative flex items-end justify-end gap-10 sm:gap-16">
                {/* Stempel Panitia menimpa tanda tangan secara otentik */}
                {customStampUrl && (
                  <div className="absolute right-12 sm:right-20 bottom-3 w-20 h-20 sm:w-28 sm:h-28 pointer-events-none opacity-85 -rotate-12 z-20">
                    <img 
                      src={resolveGoogleDriveUrl(customStampUrl)} 
                      alt="Official Stamp" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* Kolom Penandatangan */}
                {signatories.map((sig, idx) => (
                  <div key={sig.id || idx} className="text-center w-36 sm:w-44 shrink-0 flex flex-col items-center">
                    <p className="text-[9px] sm:text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {sig.role}
                    </p>
                    
                    {/* Gambar Tanda Tangan */}
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
                          <span className="text-[8.5px] text-slate-300 font-sans italic">(Tanda Tangan)</span>
                        </div>
                      )}
                    </div>

                    {/* Garis & Nama Penandatangan */}
                    <div className="w-full border-t border-slate-900 pt-1 mt-0.5">
                      <p className="text-[10px] sm:text-xs font-black uppercase text-slate-900 truncate">
                        {sig.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
                          <p className={`text-[8.5px] font-mono truncate ${currentPreviewIndex === idx ? 'text-slate-900 font-bold' : 'text-amber-400/80'}`}>
                            No: {rec.certificateNumber}
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

                      {/* Manual Cert Number Editor for Currently Viewed Archer */}
                      {currentRecipient && (
                        <div className="hidden sm:flex items-center gap-1.5 ml-2 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">No. Sertifikat:</span>
                          <input
                            type="text"
                            value={currentRecipient.certificateNumber}
                            onChange={e => handleUpdateRecipientCertNumber(currentRecipient.archerId, e.target.value)}
                            className="bg-slate-950 border border-white/20 rounded-md px-2 py-0.5 text-xs font-mono font-bold text-amber-300 w-44 md:w-56 focus:outline-hidden focus:border-amber-400"
                            placeholder="Nomor manual..."
                            title="Edit langsung nomor sertifikat untuk pemanah ini"
                          />
                        </div>
                      )}
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

                  {/* SECTION 3: KUSTOMISASI JARAK, FONT & PENOMORAN MANUAL */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-6">
                    <h5 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>Penyesuaian Jarak, Font &amp; Penomoran Manual</span>
                    </h5>

                    {/* 1. JARAK VERTIKAL ANTAR BAGIAN (HEADER - NAMA - TANDA TANGAN) */}
                    <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-amber-400/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>📐 Kerapatan Vertikal (Jarak Judul &amp; Tanda Tangan ke Teks Tengah):</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30">
                          {sectionSpacing === 'SPREAD' ? 'Menyebar ke Tepi' : `${sectionGap} px (${sectionSpacing === 'COMPACT' ? 'Sangat Dekat' : 'Seimbang'})`}
                        </span>
                      </div>

                      {/* 3 Presets for Closeness */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSectionSpacing('COMPACT');
                            setSectionGap(10);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            sectionSpacing === 'COMPACT'
                              ? 'bg-amber-400/20 border-amber-400 text-white shadow-xs'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-xs font-black uppercase text-white">Sangat Dekat &amp; Padat</p>
                          <p className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">
                            Jarak pendek 10px. Judul, Nama, dan Tanda Tangan saling berdekatan di tengah kertas (Rekomendasi).
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSectionSpacing('BALANCED');
                            setSectionGap(22);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            sectionSpacing === 'BALANCED'
                              ? 'bg-amber-400/20 border-amber-400 text-white shadow-xs'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-xs font-black uppercase text-white">Proporsional Seimbang</p>
                          <p className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">
                            Jarak sedang 22px. Tata letak elegan dengan ruang napas teratur.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSectionSpacing('SPREAD')}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            sectionSpacing === 'SPREAD'
                              ? 'bg-amber-400/20 border-amber-400 text-white shadow-xs'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-xs font-black uppercase text-white">Menyebar ke Tepi</p>
                          <p className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">
                            Judul di tepi paling atas, Tanda Tangan di tepi paling bawah kertas.
                          </p>
                        </button>
                      </div>

                      {/* Fine-Tuning Slider for Section Gap */}
                      {sectionSpacing !== 'SPREAD' && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold text-slate-300">
                            <span>Atur Jarak Pendek / Panjang secara Presisi:</span>
                            <span className="font-mono text-amber-400 font-bold">{sectionGap} px</span>
                          </div>
                          <input 
                            type="range"
                            min="4"
                            max="48"
                            value={sectionGap}
                            onChange={e => setSectionGap(parseInt(e.target.value))}
                            className="w-full accent-amber-400"
                          />
                          <p className="text-[9px] text-slate-400">
                            Semakin kecil angkanya, tulisan judul atas dan tanda tangan bawah semakin menempel dekat ke nama peserta di tengah.
                          </p>
                        </div>
                      )}

                      {/* Center Page Vertical Offset */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-300">
                            <span>Geser Seluruh Blok Tengah (Center Page Offset):</span>
                            <span className="font-mono text-amber-400">{centerOffsetY} px</span>
                          </div>
                          <input 
                            type="range"
                            min="-40"
                            max="40"
                            value={centerOffsetY}
                            onChange={e => setCenterOffsetY(parseInt(e.target.value))}
                            className="w-full accent-amber-400 mt-1"
                          />
                        </div>
                        {centerOffsetY !== 0 && (
                          <button
                            type="button"
                            onClick={() => setCenterOffsetY(0)}
                            className="text-[10px] text-amber-400 hover:underline font-bold shrink-0 self-end mb-1"
                          >
                            Reset Tengah
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2. PILIHAN JENIS FONT (FONT FAMILY) */}
                    <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-xs font-bold text-white block">
                        🔤 Pilihan Jenis Huruf (Font Family) Sertifikat:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: 'PLAYFAIR', name: 'Playfair Display', label: 'Serif Mewah', fontCss: "'Playfair Display', serif" },
                          { id: 'CINZEL', name: 'Cinzel', label: 'Royal Formal', fontCss: "'Cinzel', serif" },
                          { id: 'GARAMOND', name: 'Garamond', label: 'Klasik Piagam', fontCss: "'Cormorant Garamond', serif" },
                          { id: 'OSWALD', name: 'Oswald', label: 'Modern Sport', fontCss: "'Oswald', sans-serif" },
                          { id: 'MONTSERRAT', name: 'Montserrat', label: 'Clean Elegan', fontCss: "'Montserrat', sans-serif" }
                        ].map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setFontFamily(f.id as any)}
                            className={`p-2.5 rounded-xl border text-center transition-all ${
                              fontFamily === f.id
                                ? 'bg-amber-400/20 border-amber-400 text-white shadow-xs'
                                : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'
                            }`}
                          >
                            <p 
                              className="text-xs font-black truncate"
                              style={{ fontFamily: f.fontCss }}
                            >
                              {f.name}
                            </p>
                            <p className="text-[8.5px] text-slate-400 mt-0.5">{f.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. PILIHAN UKURAN FONT & WARNA */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Title Font Size */}
                      <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-xs font-bold text-slate-300 block">
                          Ukuran Judul (SERTIFIKAT):
                        </span>
                        <div className="flex gap-1.5">
                          {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setTitleFontSize(size)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                                titleFontSize === size 
                                  ? 'bg-amber-400 text-slate-950 shadow-xs' 
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Name Font Size */}
                      <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-xs font-bold text-slate-300 block">
                          Ukuran Nama Atlet:
                        </span>
                        <div className="flex gap-1.5">
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

                      {/* Name Text Color */}
                      <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-xs font-bold text-slate-300 block">
                          Warna Huruf Nama:
                        </span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color"
                            value={primaryTextColor}
                            onChange={e => setPrimaryTextColor(e.target.value)}
                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <input 
                            type="text"
                            value={primaryTextColor}
                            onChange={e => setPrimaryTextColor(e.target.value)}
                            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. PENOMORAN SERTIFIKAT MANUAL OLEH PENYELENGGARA */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-blue-400/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>🔢 Format &amp; Penomoran Manual oleh Penyelenggara:</span>
                        </span>
                        {Object.keys(manualCertNumbers).length > 0 && (
                          <span className="text-[10px] text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-500/30 font-mono">
                            {Object.keys(manualCertNumbers).length} nomor manual terpasang
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-400 leading-tight">
                        Penyelenggara bebas menentukan format penomoran sendiri. Masukkan template format di bawah (gunakan <code className="text-amber-300 font-mono">{'{NUMBER}'}</code> untuk urutan nomor 001, 002, dst). Anda juga bisa langsung mengedit nomor perorangan di atas tampilan preview.
                      </p>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={manualCertNumberFormat}
                          onChange={e => setManualCertNumberFormat(e.target.value)}
                          placeholder="Contoh: NOMOR: {NUMBER}/PAN-KEBUMEN/2026"
                          className="flex-1 bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400"
                        />
                        <button
                          type="button"
                          onClick={handleApplyManualNumberFormat}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
                        >
                          Terapkan ke Semua Peserta
                        </button>
                        {Object.keys(manualCertNumbers).length > 0 && (
                          <button
                            type="button"
                            onClick={handleResetCertNumbers}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all shrink-0"
                          >
                            Reset Nomor
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 5. Pengaturan Tulisan Predikat Peserta */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-400/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>🏷️ Format Tulisan Predikat Peserta:</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          {participantPredicateStyle === 'PESERTA_ONLY' ? 'Hanya "Peserta"' : 'Dengan Peringkat'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setParticipantPredicateStyle('PESERTA_ONLY');
                            setParticipantCustomLabel('Peserta');
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            participantPredicateStyle === 'PESERTA_ONLY'
                              ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-xs'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-xs font-black uppercase text-white">Hanya "Peserta" (Rekomendasi)</p>
                          <p className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">
                            Menampilkan tulisan "Peserta" saja secara bersih tanpa tambahan kata "Resmi" atau peringkat.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setParticipantPredicateStyle('WITH_RANK')}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            participantPredicateStyle === 'WITH_RANK'
                              ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-xs'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-xs font-black uppercase text-white">Sertakan Peringkat</p>
                          <p className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">
                            Menampilkan peringkat kualifikasi (contoh: "Peserta (Peringkat ke-5)").
                          </p>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">Label Kata Peserta:</span>
                        <input
                          type="text"
                          value={participantCustomLabel}
                          onChange={e => setParticipantCustomLabel(e.target.value)}
                          placeholder="Peserta"
                          className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-bold"
                        />
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
