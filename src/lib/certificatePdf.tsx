import React from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { Trophy, Medal } from 'lucide-react';
import { ArcheryEvent, Archer, CategoryType, Match, CertificateSignatory } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { resolveGoogleDriveUrl } from './photoService';

export interface ResolvedCertificateRecipient {
  id: string;
  archerId: string;
  archerName: string;
  club: string;
  category: CategoryType;
  categoryLabel: string;
  awardType: 'PODIUM' | 'PARTICIPANT';
  predicate: string;
  medalType: 'GOLD' | 'SILVER' | 'BRONZE' | 'FOURTH' | 'PARTICIPANT';
  scoreTotal: number;
  rank: number;
  certificateNumber: string;
}

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

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to convert blob to data URL'));
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });

const fetchImageAsDataUrl = async (rawUrl?: string | null): Promise<string | null> => {
  const cleaned = (rawUrl || '').trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('data:image/')) return cleaned;

  const tryUrls = [
    `/api/cert-image-proxy?url=${encodeURIComponent(cleaned)}`,
    resolveGoogleDriveUrl(cleaned)
  ];

  for (const url of tryUrls) {
    if (!url) continue;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size > 0 && (blob.type.startsWith('image/') || blob.type === 'application/octet-stream')) {
        return await blobToDataUrl(blob);
      }
    } catch {
      // Fallback to next candidate
    }
  }
  return null;
};

export function resolveArcherCertificateRecipient(
  event: ArcheryEvent,
  targetArcher: Archer
): ResolvedCertificateRecipient {
  const cfg = event.settings?.certificateConfig;
  const cat = (targetArcher.category || CategoryType.ADULT_PUTRA) as CategoryType;

  const baseArchers = event.archers || [];
  const allArchers = baseArchers.some(a => a.id === targetArcher.id)
    ? baseArchers
    : [...baseArchers, targetArcher];
  const catArchers = allArchers.filter(a => a.category === cat);
  const scores = event.scores || [];
  const matchesObj = event.matches || {};

  const eventCode = (event.settings?.tournamentName || 'ARCUS')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 4)
    .toUpperCase();
  const catCode = String(cat).replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();

  const rankedArchers = catArchers
    .map(archer => {
      const archerScores = scores.filter(s => s.archerId === archer.id && s.sessionId === 'QUAL' && !s.isDeleted);
      const total = archerScores.reduce((acc, curr) => acc + (curr.total || 0), 0);
      return { ...archer, total };
    })
    .sort((a, b) => (b.total || 0) - (a.total || 0));

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

  if (!goldId && rankedArchers.length > 0 && rankedArchers[0].total > 0) {
    goldId = rankedArchers[0].id;
    if (rankedArchers[1] && rankedArchers[1].total > 0) silverId = rankedArchers[1].id;
    if (rankedArchers[2] && rankedArchers[2].total > 0) bronzeId = rankedArchers[2].id;
    if (rankedArchers[3] && rankedArchers[3].total > 0) fourthId = rankedArchers[3].id;
  }

  const manualCertNumbers = cfg?.manualCertNumbers || {};
  const manualFormat = (cfg?.manualCertNumberFormat || '').trim();
  const participantPredicateStyle = cfg?.participantPredicateStyle || 'PESERTA_ONLY';
  const rawLabel = cfg?.participantCustomLabel;
  const participantCustomLabel = rawLabel && /resmi/i.test(rawLabel) ? 'Peserta' : (rawLabel || 'Peserta');

  const podiumDefs = [
    { id: goldId, predicate: 'JUARA 1 (MEDALI EMAS)', medalType: 'GOLD' as const, rank: 1 },
    { id: silverId, predicate: 'JUARA 2 (MEDALI PERAK)', medalType: 'SILVER' as const, rank: 2 },
    { id: bronzeId, predicate: 'JUARA 3 (MEDALI PERUNGGU)', medalType: 'BRONZE' as const, rank: 3 },
    { id: fourthId, predicate: 'JUARA 4 / HARAPAN 1', medalType: 'FOURTH' as const, rank: 4 },
  ];

  const matchedPodium = podiumDefs.find(p => p.id === targetArcher.id);
  const rankedIndex = rankedArchers.findIndex(a => a.id === targetArcher.id);
  const archerTotal = rankedIndex >= 0 ? rankedArchers[rankedIndex].total : 0;

  if (matchedPodium && archerTotal > 0) {
    const defaultPodiumNum = `CERT/${eventCode}/${catCode}/POD-${String(matchedPodium.rank).padStart(2, '0')}`;
    const finalCertNum = manualCertNumbers[targetArcher.id]
      ? manualCertNumbers[targetArcher.id]
      : manualFormat
      ? manualFormat.replace('{NUMBER}', String(matchedPodium.rank).padStart(3, '0')).replace('{NUM}', String(matchedPodium.rank))
      : defaultPodiumNum;

    return {
      id: `${cat}-pod-${targetArcher.id}`,
      archerId: targetArcher.id,
      archerName: targetArcher.name,
      club: targetArcher.club || 'Individu / Bebas',
      category: cat,
      categoryLabel: CATEGORY_LABELS[cat] || String(cat),
      awardType: 'PODIUM',
      predicate: matchedPodium.predicate,
      medalType: matchedPodium.medalType,
      scoreTotal: archerTotal,
      rank: matchedPodium.rank,
      certificateNumber: finalCertNum
    };
  }

  const idx = rankedIndex >= 0 ? rankedIndex : 0;
  const numStr = String(idx + 1).padStart(3, '0');
  const cleanLabel = participantCustomLabel.replace(/\bresmi\b/gi, '').trim() || 'Peserta';
  const participantPredicate =
    participantPredicateStyle === 'WITH_RANK' && archerTotal > 0
      ? `${cleanLabel} (Peringkat ke-${idx + 1})`
      : cleanLabel;

  const defaultPartNum = `CERT/${eventCode}/${catCode}/${numStr}`;
  const finalCertNum = manualCertNumbers[targetArcher.id]
    ? manualCertNumbers[targetArcher.id]
    : manualFormat
    ? manualFormat.replace('{NUMBER}', numStr).replace('{NUM}', String(idx + 1))
    : defaultPartNum;

  return {
    id: `${cat}-part-${targetArcher.id}`,
    archerId: targetArcher.id,
    archerName: targetArcher.name,
    club: targetArcher.club || 'Individu / Bebas',
    category: cat,
    categoryLabel: CATEGORY_LABELS[cat] || String(cat),
    awardType: 'PARTICIPANT',
    predicate: participantPredicate,
    medalType: 'PARTICIPANT',
    scoreTotal: archerTotal,
    rank: idx + 1,
    certificateNumber: finalCertNum
  };
}

interface ExportCanvasProps {
  event: ArcheryEvent;
  recipient: ResolvedCertificateRecipient;
  customBgDataUrl: string | null;
  tournamentLogoDataUrl: string | null;
  clubLogoDataUrl: string | null;
  secondaryLogoDataUrl: string | null;
  stampDataUrl: string | null;
  signatorySigUrls: (string | null)[];
  signatories: CertificateSignatory[];
}

function CertificateExportCanvas({
  event,
  recipient,
  customBgDataUrl,
  tournamentLogoDataUrl,
  clubLogoDataUrl,
  secondaryLogoDataUrl,
  stampDataUrl,
  signatorySigUrls,
  signatories
}: ExportCanvasProps) {
  const cfg = event.settings?.certificateConfig;
  const templateStyle = cfg?.templateStyle || 'ROYAL_GOLD';
  const useCustomBgOnly = cfg?.useCustomBackgroundOnly || false;
  const printTextOnlyMode = cfg?.printTextOnlyMode || false;
  const certTitle = cfg?.title || 'SERTIFIKAT PENGHARGAAN';
  const certSubtitle = cfg?.subtitle || 'Diberikan dengan penuh kehormatan dan apresiasi kepada:';
  const bodyTemplate =
    cfg?.bodyTextTemplate ||
    'Atas dedikasi, sportivitas, dan partisipasi gemilang dalam kejuaraan {TOURNAMENT_NAME} Kategori {CATEGORY}, yang diselenggarakan pada {DATE} di {LOCATION}.';

  const showTournamentLogo = cfg?.showTournamentLogo ?? true;
  const showClubLogo = cfg?.showClubLogo ?? true;
  const showSecondaryLogo = cfg?.showSecondaryLogo ?? true;
  const showMedalBadge = cfg?.showMedalBadge ?? true;
  const showQrVerification = cfg?.showQrVerification ?? true;
  const showDateLocation = cfg?.showDateLocation ?? true;

  const nameFontSize = cfg?.nameFontSize || 'lg';
  const titleFontSize = cfg?.titleFontSize || 'lg';
  const bodyFontSize = cfg?.bodyFontSize || 'lg';
  const logoSize = (cfg?.logoSize as 'sm' | 'md' | 'lg' | 'xl' | '2xl') || 'lg';
  const qrCodeSize = cfg?.qrCodeSize || 'lg';
  const fontFamily = cfg?.fontFamily || 'PLAYFAIR';
  const sectionSpacing = cfg?.sectionSpacing || 'COMPACT';
  const sectionGap = cfg?.sectionGap ?? 14;
  const centerOffsetY = cfg?.centerOffsetY ?? 0;
  const primaryTextColor = cfg?.primaryTextColor || '#0f172a';

  const tournamentName = event.settings?.tournamentName || 'TURNAMEN PANAHAN RESMI';
  const location = event.settings?.location || 'Lapangan Panahan';
  const eventDate = event.settings?.eventDate
    ? new Date(event.settings.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const isParticipant = recipient.awardType === 'PARTICIPANT';
  const displayPredicate = isParticipant
    ? (recipient.predicate.replace(/\bresmi\b/gi, '').trim() || 'Peserta').toUpperCase()
    : recipient.predicate;

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

  const nameFontPx = { sm: '36px', md: '48px', lg: '58px', xl: '70px' }[nameFontSize] || '58px';
  const titleFontPx = { sm: '36px', md: '48px', lg: '58px', xl: '70px' }[titleFontSize] || '58px';
  const bodyFontPx = { sm: '16px', md: '18px', lg: '20px', xl: '23px' }[bodyFontSize] || '20px';
  const logoHeightPx = { sm: '54px', md: '72px', lg: '92px', xl: '110px', '2xl': '128px' }[logoSize] || '92px';
  const qrPixelSize = { sm: 56, md: 68, lg: 84, xl: 104 }[qrCodeSize] || 84;

  return (
    <div
      style={{
        width: '1123px',
        height: '794px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        fontFamily: getFontFamilyStyle(fontFamily),
        boxSizing: 'border-box',
        color: '#0f172a'
      }}
    >
      {/* 1. BACKGROUND LAYER */}
      {!printTextOnlyMode && (
        <>
          {customBgDataUrl && (
            <img
              src={customBgDataUrl}
              alt="Certificate Blanko"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                zIndex: 0
              }}
            />
          )}

          {(!useCustomBgOnly || !customBgDataUrl) && (
            <>
              {templateStyle === 'ROYAL_GOLD' && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                  {!customBgDataUrl && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, #FAF8F5, #FFFDF9, #F5EFEB)'
                      }}
                    />
                  )}
                  <div style={{ position: 'absolute', inset: '20px', border: '4px solid #D4AF37' }} />
                  <div style={{ position: 'absolute', inset: '28px', border: '1px solid rgba(184, 134, 11, 0.5)' }} />
                  <div style={{ position: 'absolute', top: '16px', left: '16px', width: '48px', height: '48px', borderTop: '4px solid #B8860B', borderLeft: '4px solid #B8860B' }} />
                  <div style={{ position: 'absolute', top: '16px', right: '16px', width: '48px', height: '48px', borderTop: '4px solid #B8860B', borderRight: '4px solid #B8860B' }} />
                  <div style={{ position: 'absolute', bottom: '16px', left: '16px', width: '48px', height: '48px', borderBottom: '4px solid #B8860B', borderLeft: '4px solid #B8860B' }} />
                  <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '48px', height: '48px', borderBottom: '4px solid #B8860B', borderRight: '4px solid #B8860B' }} />
                </div>
              )}

              {templateStyle === 'MODERN_SPORT' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 1,
                    background: !customBgDataUrl ? 'linear-gradient(to bottom right, #f8fafc, #ffffff, rgba(254, 242, 242, 0.4))' : undefined
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '16px', background: 'linear-gradient(to right, #dc2626, #f59e0b, #0f172a)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '16px', background: 'linear-gradient(to right, #0f172a, #f59e0b, #dc2626)' }} />
                  <div style={{ position: 'absolute', inset: '24px', border: '2px solid rgba(15, 23, 42, 0.15)' }} />
                </div>
              )}

              {templateStyle === 'TRADITIONAL_HERITAGE' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 1,
                    backgroundColor: !customBgDataUrl ? '#FDFBF7' : undefined
                  }}
                >
                  <div style={{ position: 'absolute', inset: '24px', border: '4px solid rgba(120, 53, 15, 0.7)' }} />
                  <div style={{ position: 'absolute', inset: '32px', border: '1px dashed rgba(180, 83, 9, 0.5)' }} />
                  <div style={{ position: 'absolute', top: '28px', left: '28px', width: '40px', height: '40px', borderTop: '2px solid #78350F', borderLeft: '2px solid #78350F' }} />
                  <div style={{ position: 'absolute', top: '28px', right: '28px', width: '40px', height: '40px', borderTop: '2px solid #78350F', borderRight: '2px solid #78350F' }} />
                  <div style={{ position: 'absolute', bottom: '28px', left: '28px', width: '40px', height: '40px', borderBottom: '2px solid #78350F', borderLeft: '2px solid #78350F' }} />
                  <div style={{ position: 'absolute', bottom: '28px', right: '28px', width: '40px', height: '40px', borderBottom: '2px solid #78350F', borderRight: '2px solid #78350F' }} />
                </div>
              )}

              {templateStyle === 'MINIMAL_CLEAN' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 1,
                    backgroundColor: !customBgDataUrl ? '#ffffff' : undefined
                  }}
                >
                  <div style={{ position: 'absolute', inset: '32px', border: '1px solid #0f172a' }} />
                  <div style={{ position: 'absolute', inset: '36px', border: '1px solid #cbd5e1' }} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 2. FOREGROUND CONTENT LAYER */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: sectionSpacing === 'SPREAD' ? 'space-between' : 'center',
          padding: sectionSpacing === 'SPREAD' ? '34px 56px' : '22px 56px',
          rowGap: sectionSpacing === 'SPREAD' ? undefined : `${sectionGap}px`,
          transform: centerOffsetY ? `translateY(${centerOffsetY}px)` : undefined,
          boxSizing: 'border-box'
        }}
      >
        {/* HEADER */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {showMedalBadge && (isGold || isSilver || isBronze || isFourth) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '4px solid #fef9c3',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.18)',
                  background: isGold
                    ? 'linear-gradient(135deg, #fef08a, #fbbf24, #d97706)'
                    : isSilver
                    ? 'linear-gradient(135deg, #ffffff, #e2e8f0, #94a3b8)'
                    : isBronze
                    ? 'linear-gradient(135deg, #fbbf24, #d97706, #78350f)'
                    : 'linear-gradient(135deg, #818cf8, #4f46e5, #6b21a8)',
                  color: isGold ? '#451a03' : isSilver ? '#0f172a' : '#ffffff'
                }}
              >
                {isGold ? <Trophy size={48} strokeWidth={2.2} /> : <Medal size={48} strokeWidth={2.2} />}
              </div>
              <div
                style={{
                  marginTop: '6px',
                  padding: '3px 16px',
                  borderRadius: '9999px',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 900,
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  backgroundColor: isGold ? '#fef3c7' : isSilver ? '#f1f5f9' : isBronze ? '#78350f' : '#312e81',
                  color: isGold ? '#451a03' : isSilver ? '#0f172a' : '#fef3c7',
                  border: '1px solid rgba(217, 119, 6, 0.4)'
                }}
              >
                ★ {isGold ? 'MEDALI EMAS • JUARA 1' : isSilver ? 'MEDALI PERAK • JUARA 2' : isBronze ? 'MEDALI PERUNGGU • JUARA 3' : 'PODIUM 4'} ★
              </div>
            </div>
          )}

          {((showTournamentLogo && tournamentLogoDataUrl) || (showClubLogo && clubLogoDataUrl) || (showSecondaryLogo && secondaryLogoDataUrl)) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '36px', marginBottom: '8px', flexShrink: 0 }}>
              {showTournamentLogo && tournamentLogoDataUrl && (
                <img src={tournamentLogoDataUrl} alt="Tournament Logo" style={{ height: logoHeightPx, width: 'auto', maxWidth: '190px', objectFit: 'contain' }} />
              )}
              {showClubLogo && clubLogoDataUrl && (
                <img src={clubLogoDataUrl} alt="Club Logo" style={{ height: logoHeightPx, width: 'auto', maxWidth: '190px', objectFit: 'contain' }} />
              )}
              {showSecondaryLogo && secondaryLogoDataUrl && (
                <img src={secondaryLogoDataUrl} alt="Organization Logo" style={{ height: logoHeightPx, width: 'auto', maxWidth: '190px', objectFit: 'contain' }} />
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', width: '100%', padding: '0 8px' }}>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '15px',
                letterSpacing: '0.24em',
                fontWeight: 900,
                textTransform: 'uppercase',
                color: 'rgba(69, 26, 3, 0.9)',
                margin: '0 0 4px 0'
              }}
            >
              {tournamentName}
            </p>
            <h1
              style={{
                fontFamily: getFontFamilyStyle(fontFamily),
                fontSize: titleFontPx,
                fontWeight: 900,
                letterSpacing: '0.05em',
                color: '#0f172a',
                textTransform: 'uppercase',
                lineHeight: 1,
                margin: 0
              }}
            >
              {certTitle}
            </h1>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '15px',
                fontWeight: 700,
                color: '#334155',
                letterSpacing: '0.06em',
                margin: '6px 0 0 0'
              }}
            >
              Nomor : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, color: '#0f172a' }}>{recipient.certificateNumber}</span>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
              <div style={{ width: '140px', height: '2px', background: 'linear-gradient(to right, transparent, #d97706)' }} />
              <div style={{ width: '8px', height: '8px', backgroundColor: '#d97706', transform: 'rotate(45deg)' }} />
              <div style={{ width: '140px', height: '2px', background: 'linear-gradient(to left, transparent, #d97706)' }} />
            </div>
          </div>
        </div>

        {/* MAIN BODY */}
        <div
          style={{
            width: '100%',
            maxWidth: '820px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 16px',
            flexShrink: 0
          }}
        >
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '18px', color: '#1e293b', margin: '0 0 4px 0', fontWeight: 500 }}>
            {certSubtitle}
          </p>
          <div style={{ width: '100%', maxWidth: '720px', padding: '0 8px', margin: '4px 0' }}>
            <h2
              style={{
                fontFamily: getFontFamilyStyle(fontFamily),
                fontSize: nameFontPx,
                fontWeight: 900,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: primaryTextColor,
                lineHeight: 1.15,
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {recipient.archerName}
            </h2>
            <div style={{ width: '280px', height: '1.5px', backgroundColor: 'rgba(15, 23, 42, 0.8)', margin: '4px auto 0 auto' }} />
          </div>

          {recipient.club && recipient.club !== 'Individu / Bebas' && (
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '15px',
                fontWeight: 700,
                color: '#334155',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                margin: '2px 0 6px 0'
              }}
            >
              {`Klub : ${recipient.club}`}
            </p>
          )}

          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '15px', color: '#334155', margin: '0 0 2px 0', fontWeight: 500 }}>
            Sebagai :
          </p>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '34px',
              fontWeight: 900,
              letterSpacing: '0.16em',
              color: '#020617',
              textTransform: 'uppercase',
              margin: '0 0 8px 0',
              lineHeight: 1.05
            }}
          >
            {displayPredicate}
          </p>
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontSize: bodyFontPx,
              lineHeight: 1.5,
              color: '#1e293b',
              textAlign: 'center',
              maxWidth: '780px',
              margin: 0,
              fontWeight: 500
            }}
          >
            {renderedBody}
          </p>
        </div>

        {/* FOOTER */}
        <div
          style={{
            width: '100%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '24px',
            paddingTop: '4px',
            fontFamily: "'Inter', sans-serif"
          }}
        >
          {/* QR Verification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {showQrVerification && (
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  flexShrink: 0
                }}
              >
                <QRCodeSVG
                  value={`https://arcus-archery.web.app/verify?cert=${encodeURIComponent(recipient.certificateNumber)}&archer=${encodeURIComponent(recipient.archerName)}`}
                  size={qrPixelSize}
                  level="M"
                />
              </div>
            )}
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Verifikasi Sertifikat Resmi:
              </p>
              <p style={{ fontSize: '15px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', margin: '2px 0' }}>
                {recipient.certificateNumber}
              </p>
              <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, maxWidth: '210px', margin: 0 }}>
                Scan QR untuk cek keaslian data atlet, peringkat &amp; skor
              </p>
            </div>
          </div>

          {/* Date & Signatories */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {showDateLocation && (
              <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '14px', color: '#1e293b', margin: '0 0 8px 0', fontWeight: 500 }}>
                {location}, {eventDate}
              </p>
            )}

            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '56px' }}>
              {stampDataUrl && (
                <div
                  style={{
                    position: 'absolute',
                    right: '80px',
                    bottom: '12px',
                    width: '108px',
                    height: '108px',
                    pointerEvents: 'none',
                    opacity: 0.85,
                    transform: 'rotate(-12deg)',
                    zIndex: 20
                  }}
                >
                  <img src={stampDataUrl} alt="Official Stamp" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}

              {signatories.map((sig, idx) => {
                const sigImg = signatorySigUrls[idx];
                return (
                  <div
                    key={sig.id || idx}
                    style={{
                      textAlign: 'center',
                      width: '176px',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}
                  >
                    <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px 0' }}>
                      {sig.role}
                    </p>
                    <div style={{ height: '62px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {sigImg ? (
                        <img src={sigImg} alt={`Signature ${sig.name}`} style={{ maxHeight: '62px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '4px' }}>
                          <span style={{ fontSize: '9px', color: '#cbd5e1', fontStyle: 'italic' }}>(Tanda Tangan)</span>
                        </div>
                      )}
                    </div>
                    <div style={{ width: '100%', borderTop: '1px solid #0f172a', paddingTop: '4px', marginTop: '2px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sig.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function downloadArcherCertificatePdf(event: ArcheryEvent, archer: Archer): Promise<void> {
  const cfg = event.settings?.certificateConfig;
  const recipient = resolveArcherCertificateRecipient(event, archer);

  const signatories: CertificateSignatory[] =
    cfg?.signatories && cfg.signatories.length > 0
      ? cfg.signatories
      : [
          { id: '1', name: 'Ketua Panitia Pelaksana', role: 'Ketua Panitia', signatureUrl: '' },
          { id: '2', name: 'Technical Delegate / Wasit', role: 'Technical Delegate', signatureUrl: '' }
        ];

  // Fetch all external assets as lossless same-origin data URLs (zero compression, zero CORS taint)
  const [
    customBgDataUrl,
    tournamentLogoDataUrl,
    clubLogoDataUrl,
    secondaryLogoDataUrl,
    stampDataUrl,
    ...signatorySigUrls
  ] = await Promise.all([
    fetchImageAsDataUrl(cfg?.customBackgroundUrl),
    fetchImageAsDataUrl(event.settings?.logoUrl),
    fetchImageAsDataUrl(event.settings?.clubLogoUrl),
    fetchImageAsDataUrl(event.settings?.secondaryLogoUrl),
    fetchImageAsDataUrl(cfg?.customStampUrl),
    ...signatories.map(s => fetchImageAsDataUrl(s.signatureUrl))
  ]);

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = '1123px';
  host.style.height = '794px';
  host.style.overflow = 'hidden';
  host.style.pointerEvents = 'none';
  host.style.backgroundColor = '#ffffff';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    root.render(
      <CertificateExportCanvas
        event={event}
        recipient={recipient}
        customBgDataUrl={customBgDataUrl}
        tournamentLogoDataUrl={tournamentLogoDataUrl}
        clubLogoDataUrl={clubLogoDataUrl}
        secondaryLogoDataUrl={secondaryLogoDataUrl}
        stampDataUrl={stampDataUrl}
        signatorySigUrls={signatorySigUrls}
        signatories={signatories}
      />
    );

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Allow React commit & browser paint cycles to finish
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 120))));

    // Ensure every rendered image is decoded before capturing
    const imgs = Array.from(host.querySelectorAll('img'));
    await Promise.all(
      imgs.map(img =>
        img.complete
          ? img.decode?.().catch(() => undefined)
          : new Promise<void>(res => {
              img.onload = () => res();
              img.onerror = () => res();
            })
      )
    );

    const sheetEl = host.firstElementChild as HTMLElement | null;
    if (!sheetEl) {
      throw new Error('Gagal menyiapkan lembar sertifikat.');
    }

    // Lossless PNG capture at 2.5x scale (2808x1985 px crisp print quality, no lossy JPEG compression)
    let pngDataUrl: string;
    try {
      pngDataUrl = await toPng(sheetEl, {
        width: 1123,
        height: 794,
        pixelRatio: 2.5,
        cacheBust: false
      });
    } catch {
      pngDataUrl = await toPng(sheetEl, {
        width: 1123,
        height: 794,
        pixelRatio: 2.5,
        cacheBust: false,
        skipFonts: true
      });
    }

    // Build A4 Landscape PDF with no compression ('NONE' image compression, compress: false)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: false
    });

    pdf.addImage(pngDataUrl, 'PNG', 0, 0, 297, 210, undefined, 'NONE');

    const safeArcherName = (archer.name || 'Peserta')
      .trim()
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/\s+/g, '_');
    const fileName = `E-Sertifikat_${safeArcherName}.pdf`;
    pdf.save(fileName);
  } finally {
    root.unmount();
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}
