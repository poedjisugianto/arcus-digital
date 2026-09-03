import React, { useState, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2, 
  RefreshCw,
  Search,
  Filter,
  Users,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { Archer, CategoryType, GlobalSettings, RegistrationStatus, TournamentSettings } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { 
  downloadArcherImportTemplate, 
  parseArchersFromExcel, 
  ParsedArcherRow 
} from '../lib/excelHelper';

interface ArcherImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (archers: Archer[]) => Promise<void> | void;
  currentArchersCount: number;
  totalTargets: number;
  settings: TournamentSettings;
  globalSettings: GlobalSettings;
}

export const ArcherImportModal: React.FC<ArcherImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentArchersCount,
  totalTargets,
  settings,
  globalSettings
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedArcherRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [defaultCategory, setDefaultCategory] = useState<CategoryType>(CategoryType.ADULT_PUTRA);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available categories list
  const availableCategories = useMemo(() => {
    return (Object.keys(CategoryType) as CategoryType[])
      .filter(cat => cat !== CategoryType.OFFICIAL)
      .map(cat => ({
        key: cat,
        label: CATEGORY_LABELS[cat] || cat
      }));
  }, []);

  // Handle template download
  const handleDownloadTemplate = () => {
    try {
      downloadArcherImportTemplate(availableCategories);
      toast.success('Template Excel berhasil diunduh! Silakan isi dan unggah kembali.');
    } catch (err: any) {
      toast.error('Gagal mengunduh template: ' + err.message);
    }
  };

  // Process File
  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValidType = validExtensions.some(ext => lowerName.endsWith(ext));

    if (!isValidType) {
      toast.error('Format file harus berupa Excel (.xlsx, .xls) atau .csv');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    try {
      const result = await parseArchersFromExcel(selectedFile, availableCategories, defaultCategory);
      if (result.rows.length === 0) {
        toast.warning('Tidak ada baris data peserta yang ditemukan dalam file.');
        setParsedRows([]);
      } else {
        setParsedRows(result.rows);
        const validCount = result.rows.filter(r => r.isValid).length;
        toast.success(`Berhasil membaca ${result.rows.length} baris data (${validCount} siap diimpor).`);
      }
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      toast.error('Gagal membaca file Excel: ' + (err.message || 'Format tidak dikenali'));
      setFile(null);
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Row selection toggle
  const toggleRowSelect = (tempId: string) => {
    setParsedRows(prev =>
      prev.map(row => (row.tempId === tempId ? { ...row, selected: !row.selected } : row))
    );
  };

  const toggleSelectAll = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    const allSelected = validRows.every(r => r.selected);
    setParsedRows(prev =>
      prev.map(row => (row.isValid ? { ...row, selected: !allSelected } : row))
    );
  };

  // Change category of a single row in preview
  const handleRowCategoryChange = (tempId: string, newCategory: string) => {
    const catObj = availableCategories.find(c => c.key === newCategory);
    setParsedRows(prev =>
      prev.map(row =>
        row.tempId === tempId
          ? {
              ...row,
              category: newCategory,
              categoryLabel: catObj?.label || newCategory
            }
          : row
      )
    );
  };

  // Filtered rows for preview
  const filteredRows = useMemo(() => {
    return parsedRows.filter(row => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.club.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.categoryLabel.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'ALL' || row.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [parsedRows, searchTerm, filterCategory]);

  const selectedCount = parsedRows.filter(r => r.selected && r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  // Execute Import
  const handleCommitImport = async () => {
    const rowsToImport = parsedRows.filter(r => r.selected && r.isValid);
    if (rowsToImport.length === 0) {
      toast.warning('Pilih setidaknya satu peserta yang valid untuk diimpor.');
      return;
    }

    setIsSubmitting(true);

    try {
      const eventName = settings?.tournamentName || 'Kejuaraan Panahan';
      const words = eventName.trim().split(/\s+/);
      const abbreviation =
        words
          .map(word => {
            const clean = word.replace(/[^a-zA-Z0-9]/g, '');
            return clean ? clean[0].toUpperCase() : '';
          })
          .join('') || 'ARC';

      const startOrder = currentArchersCount + 1;

      const createdArchers: Archer[] = rowsToImport.map((row, index) => {
        const orderNum = startOrder + index;
        const registrationNo = `${abbreviation}-${orderNum.toString().padStart(3, '0')}`;

        const isKids = [
          CategoryType.U18_PUTRA,
          CategoryType.U18_PUTRI,
          CategoryType.U12_PUTRA,
          CategoryType.U12_PUTRI,
          CategoryType.U9_PUTRA,
          CategoryType.U9_PUTRI
        ].includes(row.category as CategoryType);

        const platformFee = isKids ? globalSettings.feeKids : globalSettings.feeAdult;

        return {
          id: 'm-arc-' + Math.random().toString(36).substring(2, 11),
          registrationNo,
          name: row.name,
          club: row.club || '-',
          category: row.category,
          status: RegistrationStatus.APPROVED,
          paymentType: 'MANUAL',
          platformFee: platformFee || 0,
          totalPaid: 0,
          createdAt: Date.now(),
          targetNo: row.targetNo ? Math.min(totalTargets, row.targetNo) : 1,
          position: row.position || 'A',
          wave: row.wave || 1,
          phone: row.phone || '-',
          email: row.email || '-',
          pin: Math.floor(1000 + Math.random() * 9000).toString(),
          registeredVia: 'EXCEL_IMPORT'
        };
      });

      await onImport(createdArchers);
      toast.success(`Berhasil mengimpor ${createdArchers.length} peserta ke dalam turnamen!`);
      handleReset();
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error('Gagal mengimpor peserta: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setSearchTerm('');
    setFilterCategory('ALL');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-white to-white shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl md:text-2xl font-black font-oswald uppercase italic text-slate-900 tracking-tight">
                  Import Peserta dari Excel
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                  XLSX / CSV
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Tambahkan atlet dan atur bantalan secara massal sekaligus dalam hitungan detik.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">

          {/* STEP 1: Upload or Download Template */}
          {!file && (
            <div className="space-y-6">
              {/* Template Download Card */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest">
                      Langkah 1
                    </span>
                    <h4 className="text-sm font-black uppercase text-slate-900">
                      Gunakan Template Resmi
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Unduh file format Excel yang sudah disiapkan dengan kolom Nama, Klub, Kategori, Bantalan, dan kontak peserta.
                  </p>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  type="button"
                  className="bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-300 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Unduh Template (.xlsx)
                </button>
              </div>

              {/* Default Category selector if unmapped */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-amber-950 block">Kategori Default (Opsi Cadangan):</span>
                  <span className="text-amber-800">
                    Akan digunakan otomatis jika kolom kategori pada baris Excel kosong.
                  </span>
                </div>
                <select
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value as CategoryType)}
                  className="bg-white border border-amber-300 text-slate-800 font-bold text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  {availableCategories.map(cat => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50/40 scale-[1.01]'
                    : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm md:text-base font-black text-slate-800">
                    Seret & Lepaskan file Excel (.xlsx / .xls) di sini
                  </p>
                  <p className="text-xs text-slate-500">
                    atau klik untuk memilih file dari komputer / ponsel Anda
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">
                    .XLSX
                  </span>
                  <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">
                    .XLS
                  </span>
                  <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">
                    .CSV
                  </span>
                </div>
              </div>

              {isParsing && (
                <div className="flex items-center justify-center gap-3 p-6 text-emerald-700 bg-emerald-50 rounded-2xl">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs font-bold">Membaca dan memvalidasi baris data Excel...</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview & Validation Table */}
          {file && (
            <div className="space-y-5">
              {/* File Info Bar */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-black tracking-wide truncate max-w-[260px] md:max-w-md">
                      {file.name}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} total baris dibaca
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    type="button"
                    className="text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Ganti File
                  </button>
                </div>
              </div>

              {/* Stats & Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                      Siap Diimpor
                    </span>
                    <span className="text-base font-black text-emerald-950">
                      {selectedCount} Peserta
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
                  <div className="p-2 bg-slate-700 text-white rounded-xl">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider block">
                      Total Terbaca
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {parsedRows.length} Baris
                    </span>
                  </div>
                </div>

                {invalidCount > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-3">
                    <div className="p-2 bg-red-600 text-white rounded-xl">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-red-800 tracking-wider block">
                        Perlu Perhatian
                      </span>
                      <span className="text-base font-black text-red-950">
                        {invalidCount} Baris Tidak Valid
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-center gap-3">
                    <div className="p-2 bg-purple-600 text-white rounded-xl">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider block">
                        Status Validasi
                      </span>
                      <span className="text-xs font-black text-purple-950">
                        Semua Baris Lengkap
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Table Search & Category Filter */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari nama, klub, atau kategori..."
                    className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="ALL">Semua Kategori ({parsedRows.length})</option>
                    {availableCategories.map(cat => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-all"
                  >
                    {parsedRows.filter(r => r.isValid).every(r => r.selected)
                      ? 'Batalkan Semua'
                      : 'Pilih Semua'}
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 sticky top-0 z-10 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center">Pilih</th>
                      <th className="p-3 w-10">No</th>
                      <th className="p-3">Nama Lengkap</th>
                      <th className="p-3">Klub / Instansi</th>
                      <th className="p-3">Kategori Lomba</th>
                      <th className="p-3 text-center">Bantalan</th>
                      <th className="p-3 text-center">Posisi</th>
                      <th className="p-3 text-center">Wave</th>
                      <th className="p-3">Kontak WA</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400">
                          Tidak ada peserta yang cocok dengan pencarian / filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => (
                        <tr
                          key={row.tempId}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !row.isValid ? 'bg-red-50/30' : row.selected ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              disabled={!row.isValid}
                              onChange={() => toggleRowSelect(row.tempId)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {row.name || (
                              <span className="text-red-500 italic flex items-center gap-1 text-[10px]">
                                <ShieldAlert className="w-3 h-3" /> Nama Kosong
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700">
                            {row.club}
                          </td>
                          <td className="p-3">
                            <select
                              value={row.category}
                              onChange={(e) => handleRowCategoryChange(row.tempId, e.target.value)}
                              className="bg-slate-50 border border-slate-200 text-slate-900 text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[180px]"
                            >
                              {availableCategories.map(cat => (
                                <option key={cat.key} value={cat.key}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-700">
                            {row.targetNo || '-'}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-700">
                            <span className="bg-slate-100 text-slate-800 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                              {row.position || 'A'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-slate-600">
                            {row.wave || 1}
                          </td>
                          <td className="p-3 text-slate-600 font-mono text-[11px]">
                            {row.phone || '-'}
                          </td>
                          <td className="p-3 text-center">
                            {row.isValid ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                Siap
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full" title={row.validationError}>
                                Tidak Lengkap
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 md:px-8 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {file && (
              <span>
                <strong className="text-slate-900">{selectedCount}</strong> dari{' '}
                <strong className="text-slate-900">{parsedRows.length}</strong> peserta dipilih untuk diimpor.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
            >
              Batal
            </button>

            {file && (
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={isSubmitting || selectedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan Data...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Impor {selectedCount} Peserta
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ArcherImportModal;
