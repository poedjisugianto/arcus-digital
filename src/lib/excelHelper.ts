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
