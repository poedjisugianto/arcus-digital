import * as XLSX from 'xlsx';

export interface ExcelMetadataRow {
  label: string;
  value: string | number;
}

export interface ExportTableOptions {
  fileName: string;
  sheetName?: string;
  title: string;
  metadata?: ExcelMetadataRow[];
  headers: string[];
  rows: (string | number | null | undefined)[][];
  colWidths?: number[];
}

/**
 * Export data to a true Microsoft Excel (.xlsx) file with clean table layout,
 * document headers in separate cells, auto-adjusted column widths, and proper cell types.
 */
export function exportToExcel(options: ExportTableOptions) {
  const {
    fileName,
    sheetName = 'Data Turnamen',
    title,
    metadata = [],
    headers,
    rows,
    colWidths
  } = options;

  // Build matrix of data
  const sheetData: (string | number | null | undefined)[][] = [];

  // 1. Title row
  sheetData.push([title]);

  // 2. Metadata rows (Key in col A, Value in col B)
  metadata.forEach(item => {
    sheetData.push([item.label, item.value]);
  });

  // 3. Blank spacer row
  sheetData.push([]);

  // 4. Table Header Row (Each header is in its own cell / column)
  sheetData.push(headers);

  // 5. Table Data Rows (Each value is in its own cell / column)
  rows.forEach(row => {
    sheetData.push(row);
  });

  // Create WorkSheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto-calculate column widths if not explicitly provided
  const maxCols = Math.max(headers.length, 2);
  const calculatedWidths: { wch: number }[] = [];

  for (let c = 0; c < maxCols; c++) {
    if (colWidths && colWidths[c]) {
      calculatedWidths.push({ wch: colWidths[c] });
      continue;
    }

    let maxLen = 10;
    // Check header length
    if (headers[c]) {
      maxLen = Math.max(maxLen, String(headers[c]).length);
    }
    // Check row data length
    rows.forEach(r => {
      if (r[c] !== undefined && r[c] !== null) {
        maxLen = Math.max(maxLen, String(r[c]).length);
      }
    });

    // Add padding
    calculatedWidths.push({ wch: Math.min(Math.max(maxLen + 3, 10), 45) });
  }

  ws['!cols'] = calculatedWidths;

  // Create WorkBook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  // Write file
  const fullFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(wb, fullFileName);
}

/**
 * Export data to a CSV file with UTF-8 BOM and standard delimiter
 */
export function exportToCSV(options: ExportTableOptions) {
  const {
    fileName,
    title,
    metadata = [],
    headers,
    rows
  } = options;

  const csvRows: string[] = [];

  // Title
  csvRows.push(`"${title.replace(/"/g, '""')}"`);

  // Metadata
  metadata.forEach(m => {
    csvRows.push(`"${m.label.replace(/"/g, '""')}","${String(m.value).replace(/"/g, '""')}"`);
  });

  csvRows.push('""'); // Empty line

  // Headers
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

  // Rows
  rows.forEach(r => {
    const formatted = r.map(val => {
      if (val === null || val === undefined) return '""';
      if (typeof val === 'number') return val;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(formatted.join(','));
  });

  const fullFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('download', fullFileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedArcherRow {
  tempId: string;
  name: string;
  club: string;
  category: string;
  categoryLabel: string;
  targetNo?: number;
  position: 'A' | 'B' | 'C' | 'D';
  wave: number;
  phone?: string;
  email?: string;
  selected: boolean;
  isValid: boolean;
  validationError?: string;
}

/**
 * Downloads a pre-formatted Excel template for participant imports
 */
export function downloadArcherImportTemplate(
  availableCategories: { key: string; label: string }[] = []
) {
  const headers = [
    'Nama Lengkap',
    'Klub / Instansi',
    'Kategori',
    'Nomor Bantalan',
    'Posisi',
    'Sesi (Wave)',
    'Nomor WhatsApp',
    'Email'
  ];

  const sampleRows = [
    [
      'Ahmad Fauzi',
      'Fast Archery Club',
      availableCategories[0]?.label || 'Dewasa Putra',
      1,
      'A',
      1,
      '081234567890',
      'ahmad@example.com'
    ],
    [
      'Siti Nurhaliza',
      'Surabaya Archery Team',
      availableCategories[1]?.label || 'Dewasa Putri',
      1,
      'B',
      1,
      '081298765432',
      'siti@example.com'
    ],
    [
      'Bambang Pamungkas',
      'Focus Archery Academy',
      availableCategories[2]?.label || 'U18 Putra',
      2,
      'A',
      1,
      '085612345678',
      'bambang@example.com'
    ],
    [
      'Aisyah Maharani',
      'An-Nur Archery Club',
      availableCategories[3]?.label || 'U12 Putri',
      2,
      'B',
      1,
      '087812345678',
      'aisyah@example.com'
    ],
    [
      'Rizky Pratama',
      'Nusantara Bow Club',
      availableCategories[0]?.label || 'Dewasa Putra',
      3,
      'A',
      1,
      '081399887766',
      'rizky@example.com'
    ]
  ];

  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Peserta
  const ws1Data = [
    ['TEMPLATE RESMI IMPORT PESERTA PANAHAN'],
    ['Petunjuk: Kolom Nama Lengkap dan Klub wajib diisi. Kolom lainnya bersifat opsional.'],
    [],
    headers,
    ...sampleRows
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  ws1['!cols'] = [
    { wch: 26 }, // Nama
    { wch: 26 }, // Klub
    { wch: 22 }, // Kategori
    { wch: 16 }, // Bantalan
    { wch: 10 }, // Posisi
    { wch: 14 }, // Sesi
    { wch: 18 }, // WA
    { wch: 24 }  // Email
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Template Peserta');

  // Sheet 2: Panduan & Daftar Kategori
  const catRows: (string | number)[][] = [
    ['PANDUAN PENGISIAN TEMPLATE IMPORT PESERTA'],
    [],
    ['Nama Kolom', 'Keterangan', 'Contoh Nilai'],
    ['Nama Lengkap', 'Wajib. Nama lengkap atlet / peserta.', 'Ahmad Fauzi'],
    ['Klub / Instansi', 'Wajib. Nama klub, kontingen daerah, atau sekolah.', 'Fast Archery Club'],
    ['Kategori', 'Pilih sesuai daftar kategori lomba.', 'Dewasa Putra / U18 Putra / Barebow'],
    ['Nomor Bantalan', 'Opsional. Nomor bantalan panahan (angka 1, 2, 3...).', '1'],
    ['Posisi', 'Opsional. Pilihan posisi berdiri: A, B, C, atau D.', 'A'],
    ['Sesi (Wave)', 'Opsional. Gelombang tembakan (default: 1).', '1'],
    ['Nomor WhatsApp', 'Opsional. Nomor telepon/WhatsApp untuk pemberitahuan.', '081234567890'],
    ['Email', 'Opsional. Alamat email peserta.', 'peserta@email.com'],
    [],
    ['DAFTAR KATEGORI YANG TERSEDIA / DIREKOMENDASIKAN:'],
    ['Kode Sistem', 'Nama Tampilan Kategori']
  ];

  availableCategories.forEach(cat => {
    catRows.push([cat.key, cat.label]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(catRows);
  ws2['!cols'] = [{ wch: 24 }, { wch: 50 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Panduan Kategori');

  XLSX.writeFile(wb, 'Template_Import_Peserta_Panahan.xlsx');
}

/**
 * Intelligent category matcher against known category list
 */
function matchCategory(
  rawCat: string,
  categories: { key: string; label: string }[]
): { key: string; label: string } {
  if (!rawCat) {
    const fallback = categories[0] || { key: 'ADULT_PUTRA', label: 'Dewasa Putra' };
    return fallback;
  }

  const cleanRaw = rawCat.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Direct key match
  const directKey = categories.find(c => c.key.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanRaw);
  if (directKey) return directKey;

  // 2. Direct label match
  const directLabel = categories.find(c => c.label.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanRaw);
  if (directLabel) return directLabel;

  // 3. Partial or substring match
  for (const cat of categories) {
    const keyClean = cat.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const labelClean = cat.label.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (cleanRaw.includes(keyClean) || keyClean.includes(cleanRaw)) return cat;
    if (cleanRaw.includes(labelClean) || labelClean.includes(cleanRaw)) return cat;
  }

  // 4. Common Indonesian Archery aliases
  if (cleanRaw.includes('dewasaputra') || cleanRaw.includes('umumputra') || cleanRaw.includes('adultputra') || (cleanRaw.includes('dewasa') && cleanRaw.includes('pa'))) {
    const found = categories.find(c => c.key === 'ADULT_PUTRA');
    if (found) return found;
  }
  if (cleanRaw.includes('dewasaputri') || cleanRaw.includes('umumputri') || cleanRaw.includes('adultputri') || (cleanRaw.includes('dewasa') && cleanRaw.includes('pi'))) {
    const found = categories.find(c => c.key === 'ADULT_PUTRI');
    if (found) return found;
  }
  if (cleanRaw.includes('u18') && (cleanRaw.includes('putra') || cleanRaw.includes('pa'))) {
    const found = categories.find(c => c.key === 'U18_PUTRA');
    if (found) return found;
  }
  if (cleanRaw.includes('u18') && (cleanRaw.includes('putri') || cleanRaw.includes('pi'))) {
    const found = categories.find(c => c.key === 'U18_PUTRI');
    if (found) return found;
  }
  if (cleanRaw.includes('u12') && (cleanRaw.includes('putra') || cleanRaw.includes('pa'))) {
    const found = categories.find(c => c.key === 'U12_PUTRA');
    if (found) return found;
  }
  if (cleanRaw.includes('u12') && (cleanRaw.includes('putri') || cleanRaw.includes('pi'))) {
    const found = categories.find(c => c.key === 'U12_PUTRI');
    if (found) return found;
  }
  if (cleanRaw.includes('u9') && (cleanRaw.includes('putra') || cleanRaw.includes('pa'))) {
    const found = categories.find(c => c.key === 'U9_PUTRA');
    if (found) return found;
  }
  if (cleanRaw.includes('u9') && (cleanRaw.includes('putri') || cleanRaw.includes('pi'))) {
    const found = categories.find(c => c.key === 'U9_PUTRI');
    if (found) return found;
  }

  // If no match found, keep raw as custom category if available, otherwise return first
  const fallback = categories[0] || { key: 'ADULT_PUTRA', label: 'Dewasa Putra' };
  return {
    key: rawCat.trim(),
    label: rawCat.trim()
  };
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file into typed participant rows
 */
export async function parseArchersFromExcel(
  file: File,
  availableCategories: { key: string; label: string }[],
  defaultCategoryKey?: string
): Promise<{
  rows: ParsedArcherRow[];
  totalRawRows: number;
  headersFound: string[];
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

  if (!rawData || rawData.length === 0) {
    throw new Error('File Excel kosong atau tidak memiliki data.');
  }

  // Find the header row (look within the first 15 rows)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rawData.length, 15); i++) {
    const row = rawData[i];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map(c => String(c || '').toLowerCase().trim()).join(' ');
    if (
      (rowStr.includes('nama') || rowStr.includes('name') || rowStr.includes('archer') || rowStr.includes('peserta')) &&
      (rowStr.includes('klub') || rowStr.includes('club') || rowStr.includes('kategori') || rowStr.includes('bantalan') || rowStr.includes('target'))
    ) {
      headerRowIndex = i;
      break;
    }
  }

  // If not found, check if row 0 has strings
  if (headerRowIndex === -1 && rawData.length > 0) {
    headerRowIndex = 0;
  }

  const rawHeaders = (rawData[headerRowIndex] || []).map(h => String(h || '').trim());

  // Map header columns flexibly
  let nameCol = -1;
  let clubCol = -1;
  let catCol = -1;
  let targetCol = -1;
  let posCol = -1;
  let waveCol = -1;
  let phoneCol = -1;
  let emailCol = -1;

  rawHeaders.forEach((h, idx) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameCol === -1 && (clean.includes('nama') || clean === 'name' || clean.includes('peserta') || clean.includes('archer') || clean.includes('atlet'))) {
      nameCol = idx;
    } else if (clubCol === -1 && (clean.includes('klub') || clean.includes('club') || clean.includes('kontingen') || clean.includes('instansi') || clean.includes('sekolah') || clean.includes('daerah'))) {
      clubCol = idx;
    } else if (catCol === -1 && (clean.includes('kategori') || clean.includes('category') || clean.includes('divisi') || clean.includes('kelas'))) {
      catCol = idx;
    } else if (targetCol === -1 && (clean.includes('bantalan') || clean.includes('target') || clean === 'no' || clean.includes('targetno'))) {
      // Avoid matching standard "No" counter column if another column has "bantalan"
      if (clean === 'no' && rawHeaders.some(other => other.toLowerCase().includes('bantalan') || other.toLowerCase().includes('target'))) {
        // Skip this "no" column as it's likely a row sequence counter
      } else {
        targetCol = idx;
      }
    } else if (posCol === -1 && (clean === 'posisi' || clean === 'position' || clean === 'pos' || clean.includes('posisibantalan'))) {
      posCol = idx;
    } else if (waveCol === -1 && (clean.includes('gelombang') || clean.includes('wave') || clean.includes('sesi') || clean.includes('session'))) {
      waveCol = idx;
    } else if (phoneCol === -1 && (clean.includes('telepon') || clean.includes('phone') || clean.includes('hp') || clean.includes('wa') || clean.includes('whatsapp') || clean.includes('kontak'))) {
      phoneCol = idx;
    } else if (emailCol === -1 && (clean.includes('email') || clean.includes('mail') || clean.includes('surel'))) {
      emailCol = idx;
    }
  });

  // Fallbacks by position if headers were generic
  if (nameCol === -1 && rawHeaders.length > 0) nameCol = 0;
  if (clubCol === -1 && rawHeaders.length > 1) clubCol = 1;

  const defaultCategory = availableCategories.find(c => c.key === defaultCategoryKey) || availableCategories[0] || { key: 'ADULT_PUTRA', label: 'Dewasa Putra' };

  const parsedRows: ParsedArcherRow[] = [];
  const dataRows = rawData.slice(headerRowIndex + 1);

  dataRows.forEach((row, rIdx) => {
    if (!Array.isArray(row) || row.length === 0) return;

    const rawName = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
    const rawClub = clubCol >= 0 ? String(row[clubCol] || '').trim() : '';
    const rawCat = catCol >= 0 ? String(row[catCol] || '').trim() : '';
    const rawTarget = targetCol >= 0 ? row[targetCol] : undefined;
    const rawPos = posCol >= 0 ? String(row[posCol] || '').trim().toUpperCase() : '';
    const rawWave = waveCol >= 0 ? row[waveCol] : undefined;
    const rawPhone = phoneCol >= 0 ? String(row[phoneCol] || '').trim() : '';
    const rawEmail = emailCol >= 0 ? String(row[emailCol] || '').trim() : '';

    // If completely empty row, ignore
    if (!rawName && !rawClub && !rawCat && !rawPhone) return;

    const matchedCat = rawCat ? matchCategory(rawCat, availableCategories) : defaultCategory;

    let targetNo: number | undefined = undefined;
    if (rawTarget !== undefined && rawTarget !== null && rawTarget !== '') {
      const parsedNum = parseInt(String(rawTarget).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        targetNo = parsedNum;
      }
    }

    let position: 'A' | 'B' | 'C' | 'D' = 'A';
    if (rawPos) {
      const firstChar = rawPos[0];
      if (['A', 'B', 'C', 'D'].includes(firstChar)) {
        position = firstChar as 'A' | 'B' | 'C' | 'D';
      }
    }

    let wave = 1;
    if (rawWave !== undefined && rawWave !== null && rawWave !== '') {
      const parsedWave = parseInt(String(rawWave).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedWave) && parsedWave > 0) {
        wave = parsedWave;
      }
    }

    const isValid = rawName.length >= 2;
    let validationError: string | undefined = undefined;
    if (!isValid) {
      validationError = 'Nama peserta tidak boleh kosong (minimal 2 karakter)';
    }

    parsedRows.push({
      tempId: `imp_${Date.now()}_${rIdx}_${Math.random().toString(36).substring(2, 7)}`,
      name: rawName,
      club: rawClub || '-',
      category: matchedCat.key,
      categoryLabel: matchedCat.label,
      targetNo,
      position,
      wave,
      phone: rawPhone || '-',
      email: rawEmail || '-',
      selected: isValid,
      isValid,
      validationError
    });
  });

  return {
    rows: parsedRows,
    totalRawRows: dataRows.length,
    headersFound: rawHeaders
  };
}
