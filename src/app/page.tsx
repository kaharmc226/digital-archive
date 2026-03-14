'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useSession, signOut } from "next-auth/react";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  iconLink: string;
  thumbnailLink?: string;
  size?: string;
  createdTime: string;
  isFolder?: boolean;
}

export default function Home() {
  const { data: session } = useSession();
  const [data, setData] = useState<{ 
    currentFolderName: string,
    categories: {id: string, name: string}[],
    folders: DriveItem[], 
    files: DriveItem[] 
  }>({ currentFolderName: 'Semua Dokumen', categories: [], folders: [], files: [] });
  
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [path, setPath] = useState<{id: string | null, name: string}[]>([{id: null, name: 'Semua Dokumen'}]);
  
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View mode state: 'list' | 'grid'
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Preview Pane state
  const [activeFile, setActiveFile] = useState<DriveItem | null>(null);

  // Merged and sorted items
  const mergedItems = useMemo(() => {
    const folders = data.folders.map(f => ({ ...f, isFolder: true }));
    const files = data.files.map(f => ({ ...f, isFolder: false }));
    return [...folders, ...files].sort((a, b) => {
      // Folders first
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [data.folders, data.files]);

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === mergedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mergedItems.map(item => item.id));
    }
  };

  // Debounce logic for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchItems = async (folderId: string | null = null, search: string = '', type: string = '', date: string = '') => {
    try {
      setLoading(true);
      setError(null);
      setSelectedIds([]); // Clear selection on new fetch
      let url = folderId ? `/api/drive?folderId=${folderId}` : '/api/drive';
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (type) params.append('type', type);
      if (date) params.append('date', date);
      
      const queryString = params.toString();
      if (queryString) {
        url += url.includes('?') ? `&${queryString}` : `?${queryString}`;
      }
      
      const res = await fetch(url);
      const resData = await res.json();
      if (resData.error) throw new Error(resData.error);
      setData(resData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat file');
      toast.error(err.message || 'Gagal memuat file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(activeFolderId, debouncedSearch, filterType, filterDate);
    setActiveFile(null); // Close preview when navigating or searching
  }, [activeFolderId, debouncedSearch, filterType, filterDate]);

  const navigateTo = (id: string | null, name: string, isTopCategory: boolean = false) => {
    setSearchInput('');
    setDebouncedSearch('');
    setActiveFile(null); // Close preview on navigation
    setSelectedIds([]); // Clear selection
    
    if (id === null) {
      setPath([{id: null, name: 'Semua Dokumen'}]);
      setActiveFolderId(null);
      return;
    }
    
    if (isTopCategory) {
      setPath([{id: null, name: 'Semua Dokumen'}, {id, name}]);
    } else {
      const index = path.findIndex(p => p.id === id);
      if (index !== -1) {
        setPath(path.slice(0, index + 1));
      } else {
        setPath([...path, {id, name}]);
      }
    }
    setActiveFolderId(id);
  };

  const processUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setIsUploadModalOpen(false);
    setSelectedIds([]);

    let successCount = 0;
    let failCount = 0;

    const toastId = toast.loading(`Mengunggah ${files.length} file...`);

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      if (activeFolderId) formData.append('folderId', activeFolderId);

      try {
        const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Unggah gagal');
        successCount++;
      } catch (err) {
        failCount++;
        console.error('Upload failed for', file.name, err);
      }
    }

    if (successCount > 0) {
      await fetchItems(activeFolderId, debouncedSearch, filterType, filterDate);
    }

    if (failCount === 0) {
      toast.success(<b>Berhasil mengunggah {successCount} file!</b>, { id: toastId });
    } else if (successCount === 0) {
      toast.error(<b>Gagal mengunggah {failCount} file.</b>, { id: toastId });
    } else {
      toast.success(<b>Berhasil {successCount}, Gagal {failCount} file.</b>, { id: toastId });
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const res = await fetch('/api/drive/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName, parentId: activeFolderId }),
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal membuat folder');
      
      toast.success(<b>Folder "{newFolderName}" berhasil dibuat!</b>);
      setIsFolderModalOpen(false);
      setNewFolderName('');
      await fetchItems(activeFolderId, debouncedSearch, filterType, filterDate);
    } catch (err: any) {
      toast.error(<b>{err.message || 'Gagal membuat folder'}</b>);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    
    const filesArray: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList.item(i);
      if (file) filesArray.push(file);
    }
    
    if (filesArray.length > 0) {
      processUpload(filesArray);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin menghapus "${name}"?`)) return;
    setDeletingId(id);
    
    if (activeFile?.id === id) {
      setActiveFile(null);
    }

    const deletePromise = fetch(`/api/drive/${id}`, { method: 'DELETE' })
      .then(async (res) => {
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Hapus gagal');
        setData(prev => ({ 
          ...prev, 
          files: prev.files.filter(f => f.id !== id), 
          folders: prev.folders.filter(f => f.id !== id) 
        }));
        setSelectedIds(prev => prev.filter(i => i !== id));
      });

    toast.promise(deletePromise, {
      loading: `Menghapus "${name}"...`,
      success: <b>File berhasil dihapus!</b>,
      error: (err) => <b>{err.message || 'Gagal menghapus file.'}</b>,
    });

    try {
      await deletePromise;
    } catch (err) {
      // Error handled by toast
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} item terpilih?`)) return;

    const idsToDelete = [...selectedIds];
    setDeletingId('batch'); // Global deleting state for batch
    const toastId = toast.loading(`Menghapus ${idsToDelete.length} item...`);

    let successCount = 0;
    let failCount = 0;

    for (const id of idsToDelete) {
      try {
        const res = await fetch(`/api/drive/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        successCount++;
        // Optimistic update
        setData(prev => ({ 
          ...prev, 
          files: prev.files.filter(f => f.id !== id), 
          folders: prev.folders.filter(f => f.id !== id) 
        }));
      } catch (err) {
        failCount++;
      }
    }

    setSelectedIds([]);
    setDeletingId(null);

    if (failCount === 0) {
      toast.success(<b>Berhasil menghapus {successCount} item!</b>, { id: toastId });
    } else if (successCount === 0) {
      toast.error(<b>Gagal menghapus item.</b>, { id: toastId });
    } else {
      toast.success(<b>Berhasil {successCount}, Gagal {failCount} item.</b>, { id: toastId });
    }
    
    if (activeFile && idsToDelete.includes(activeFile.id)) {
      setActiveFile(null);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processUpload(files);
    }
  }, [activeFolderId]);

  const formatBytes = (bytes: string | undefined, decimals = 2) => {
    if (!bytes) return '-';
    const num = parseInt(bytes);
    if (num === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const SkeletonGridCard = () => (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 h-full animate-pulse flex flex-col">
      <div className="aspect-square mb-4 bg-gray-200 rounded-xl"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mt-auto"></div>
    </div>
  );

  const SkeletonListRow = () => (
    <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-4 animate-pulse">
      <div className="w-6 h-6 bg-gray-200 rounded shrink-0"></div>
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/6 hidden sm:block ml-auto"></div>
      <div className="h-4 bg-gray-200 rounded w-1/6 hidden md:block"></div>
      <div className="h-6 bg-gray-200 rounded w-6 ml-auto"></div>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col relative bg-gray-50 overflow-hidden h-screen">
      
      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
            <button 
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-xl font-bold mb-4 text-gray-800">Unggah Dokumen</h2>
            <p className="text-sm text-gray-500 mb-6">File akan diunggah ke: <strong className="text-gray-700">{data.currentFolderName}</strong></p>
            
            <div 
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center group
                ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
            >
              <span className={`text-5xl mb-4 transition-transform ${dragActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {dragActive ? '☁️' : '📁'}
              </span>
              <p className="text-gray-700 font-medium text-lg mb-1">
                {dragActive ? 'Lepaskan file di sini' : 'Seret & letakkan file di sini'}
              </p>
              <p className="text-gray-500 text-sm">atau klik untuk memilih file</p>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Folder Baru</h2>
            <form onSubmit={handleCreateFolder}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nama Folder</label>
                <input 
                  autoFocus
                  type="text"
                  placeholder="Masukkan nama folder..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all text-gray-800"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {creatingFolder ? 'Memproses...' : 'Buat Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Sticky Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Row: Breadcrumbs & Profile */}
          <div className="flex items-center justify-between py-4">
            {/* Breadcrumbs Navigation */}
            <nav className="flex items-center text-lg md:text-xl font-bold text-gray-800 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 mr-4">
              {path.map((p, i) => (
                <span key={p.id || 'root'} className="flex items-center">
                  <button 
                    onClick={() => navigateTo(p.id, p.name)}
                    className="hover:text-blue-600 transition-colors flex items-center gap-2"
                  >
                    {i === 0 ? '📂' : ''} {p.name}
                  </button>
                  {i < path.length - 1 && <span className="mx-2 text-gray-400 font-normal text-sm">/</span>}
                </span>
              ))}
            </nav>

            {/* Profile & Logout */}
            <div className="flex items-center gap-3 shrink-0">
               {session?.user?.image && (
                  <img src={session.user.image} referrerPolicy="no-referrer" alt="" className="w-8 h-8 rounded-full border border-gray-200" />
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-bold text-gray-900 leading-tight">{session?.user?.name}</p>
                  <button 
                    onClick={() => signOut()}
                    className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
                  >
                    Keluar
                  </button>
                </div>
            </div>
          </div>

          {/* Bottom Row: Search, Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
            
            {/* Search Bar & Filters */}
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-2 max-w-4xl">
              <div className="relative flex-1 w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder={activeFolderId === null ? "Cari dokumen..." : `Cari di ${data.currentFolderName}...`}
                  className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 hover:bg-white focus:bg-white transition-colors text-sm text-gray-800 placeholder:text-gray-400"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    title="Bersihkan pencarian"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="py-2 pl-3 pr-8 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 hover:bg-white transition-colors text-sm text-gray-700 cursor-pointer appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
                >
                  <option value="">Semua Tipe</option>
                  <option value="document">📄 Dokumen</option>
                  <option value="spreadsheet">📊 Spreadsheet</option>
                  <option value="presentation">📈 Presentasi</option>
                  <option value="pdf">📕 PDF</option>
                  <option value="image">🖼️ Gambar</option>
                  <option value="video">🎥 Video</option>
                  <option value="archive">📦 Arsip</option>
                </select>

                <select 
                  value={filterDate} 
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="py-2 pl-3 pr-8 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 hover:bg-white transition-colors text-sm text-gray-700 cursor-pointer appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
                >
                  <option value="">Kapan Saja</option>
                  <option value="today">Hari Ini</option>
                  <option value="last7days">7 Hari Terakhir</option>
                  <option value="last30days">30 Hari Terakhir</option>
                  <option value="thisyear">Tahun Ini</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 shrink-0">
               <div className="bg-gray-100 p-1 rounded-lg flex items-center gap-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    title="Tampilan Daftar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    title="Tampilan Grid"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFolderModalOpen(true)}
                    className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-semibold shadow-sm transition-all flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <span className="text-lg">📁+</span> <span className="hidden sm:inline">Folder Baru</span>
                  </button>
                  
                  <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" multiple />
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <span className="text-lg leading-none">+</span> <span className="hidden sm:inline">Tambah File</span>
                  </button>
                </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area Layout with Preview Pane */}
      <div className="flex-1 overflow-hidden flex flex-row w-full max-w-screen-2xl mx-auto">
        
        {/* Left Column: File List */}
        <div className={`flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-300 ${activeFile ? 'hidden lg:block lg:pr-4' : ''}`}>
          {loading ? (
            <div className="space-y-8 mt-2">
               <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Memuat Dokumen...</h2>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {[1, 2, 3, 4, 5, 6].map(i => <SkeletonGridCard key={i} />)}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {[1, 2, 3, 4, 5].map(i => <SkeletonListRow key={i} />)}
                    </div>
                  )}
               </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm text-red-700 mt-2"><strong>Error:</strong> {error}</div>
          ) : mergedItems.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 mt-2">
              <p className="text-gray-500 text-lg mb-2">
                {debouncedSearch ? `Hasil tidak ditemukan untuk "${debouncedSearch}"` : "Folder ini kosong."}
              </p>
              {!debouncedSearch && (
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setIsFolderModalOpen(true)} className="text-blue-600 hover:underline font-medium">Buat folder</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setIsUploadModalOpen(true)} className="text-blue-600 hover:underline font-medium">Unggah file pertama</button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 mt-2 pb-20">
              {viewMode === 'grid' ? (
                <div className={`grid gap-6 ${activeFile ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
                  {mergedItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`group relative bg-white rounded-2xl border p-4 transition-all hover:shadow-xl flex flex-col h-full ${selectedIds.includes(item.id) ? 'border-blue-500 ring-2 ring-blue-100 shadow-md bg-blue-50/10' : activeFile?.id === item.id ? 'border-blue-500 ring-2 ring-blue-100 shadow-md' : 'border-gray-200 hover:border-blue-300'}`}
                    >
                      {/* Checkbox overlay for grid */}
                      <div className={`absolute top-3 left-3 z-10 transition-opacity ${selectedIds.includes(item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                        />
                      </div>

                      <button 
                        onClick={() => item.isFolder ? navigateTo(item.id, item.name) : setActiveFile(item)} 
                        onDoubleClick={() => !item.isFolder && window.open(item.webViewLink, '_blank')}
                        className="flex-1 flex flex-col text-left"
                      >
                        <div className="aspect-square mb-4 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center relative w-full">
                          {item.isFolder ? (
                            <span className="text-5xl group-hover:scale-110 transition-transform">📁</span>
                          ) : item.thumbnailLink ? (
                            <img src={item.thumbnailLink.replace('=s220', '=s400')} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <img src={item.iconLink} alt="" className="w-12 h-12" />
                          )}
                        </div>
                        <div className="flex-1 flex flex-col w-full">
                          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600 text-sm" title={item.name}>{item.name}</h3>
                          <div className="flex items-center justify-between mt-auto pt-2">
                            <p className="text-[10px] text-gray-400 uppercase font-extrabold tracking-widest">
                              {item.isFolder ? 'Folder' : item.mimeType.split('/').pop()?.split('.').pop()}
                            </p>
                            <p className="text-[10px] text-gray-500 font-medium">{new Date(item.createdTime).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={(e) => handleDelete(e, item.id, item.name)}
                        disabled={deletingId === item.id || deletingId === 'batch'}
                        className="absolute top-2 right-2 p-1.5 bg-white/95 rounded-full text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all shadow-md border border-gray-100"
                      >
                        {deletingId === item.id ? <div className="animate-spin h-4 w-4 border-2 border-red-600 border-b-transparent rounded-full"></div> : <span className="text-xs">🗑️</span>}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                          <th className="p-4 w-10">
                            <input 
                              type="checkbox"
                              checked={mergedItems.length > 0 && selectedIds.length === mergedItems.length}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </th>
                          <th className="p-4 font-semibold w-1/2">Nama</th>
                          <th className="p-4 font-semibold hidden md:table-cell">Ukuran</th>
                          <th className="p-4 font-semibold hidden sm:table-cell">Tipe</th>
                          <th className="p-4 font-semibold hidden md:table-cell">Tanggal Diubah</th>
                          <th className="p-4 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {mergedItems.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`group transition-colors cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-50/30' : activeFile?.id === item.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                            onClick={() => !item.isFolder && setActiveFile(item)}
                            onDoubleClick={() => {
                              if (item.isFolder) {
                                navigateTo(item.id, item.name);
                              } else {
                                window.open(item.webViewLink, '_blank');
                              }
                            }}
                          >
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                               <input 
                                  type="checkbox"
                                  checked={selectedIds.includes(item.id)}
                                  onChange={() => toggleSelect(item.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </td>
                            <td className="p-4">
                              {item.isFolder ? (
                                <button onClick={(e) => { e.stopPropagation(); navigateTo(item.id, item.name); }} className="flex items-center gap-3 w-full text-left group">
                                  <span className="text-xl group-hover:scale-110 transition-transform">📁</span>
                                  <span className="font-semibold text-gray-700 group-hover:text-blue-600 truncate max-w-[200px] lg:max-w-md xl:max-w-lg">
                                    {item.name}
                                  </span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                    <img src={item.iconLink} alt="" className="w-5 h-5" />
                                  </div>
                                  <span className="font-medium text-gray-900 group-hover:text-blue-600 truncate max-w-[200px] lg:max-w-md xl:max-w-lg" title={item.name}>
                                    {item.name}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-sm text-gray-500 hidden md:table-cell whitespace-nowrap">
                              {item.isFolder ? '-' : formatBytes(item.size)}
                            </td>
                            <td className="p-4 text-sm text-gray-500 hidden sm:table-cell whitespace-nowrap">
                              {item.isFolder ? 'Folder' : item.mimeType.split('/').pop()?.split('.').pop()?.toUpperCase()}
                            </td>
                            <td className="p-4 text-sm text-gray-500 hidden md:table-cell whitespace-nowrap">
                              {new Date(item.createdTime).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={(e) => handleDelete(e, item.id, item.name)}
                                disabled={deletingId === item.id || deletingId === 'batch'}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                                title="Hapus"
                              >
                                {deletingId === item.id ? <div className="animate-spin h-4 w-4 border-2 border-red-600 border-b-transparent rounded-full inline-block"></div> : <span>🗑️</span>}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Batch Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center gap-4 border-r border-gray-700 pr-8">
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md">{selectedIds.length}</span>
              <span className="text-sm font-semibold">Item Terpilih</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={handleDeleteSelected}
                disabled={deletingId === 'batch'}
                className="flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                {deletingId === 'batch' ? (
                  <div className="animate-spin h-4 w-4 border-2 border-red-400 border-b-transparent rounded-full"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                Hapus Terpilih
              </button>
              
              <button 
                onClick={() => setSelectedIds([])}
                disabled={deletingId === 'batch'}
                className="text-sm font-bold text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Right Column: Preview Pane */}
        {activeFile && (
          <div className="w-full lg:w-[500px] xl:w-[650px] bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.05)] absolute lg:relative inset-y-0 right-0 z-30 transform transition-transform animate-in slide-in-from-right-8 duration-300">
            
            {/* Preview Pane Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <img src={activeFile.iconLink} alt="" className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-gray-900 truncate text-sm" title={activeFile.name}>{activeFile.name}</h3>
              </div>
              <div className="flex items-center gap-1">
                <a 
                  href={activeFile.webViewLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                  title="Buka di Google Drive"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                </a>
                <button 
                  onClick={() => setActiveFile(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Preview Pane Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
              
              {/* Document Preview (iframe or Image) - Highly Optimized for Vertical Space */}
              <div className="flex-1 bg-white relative group overflow-hidden flex items-start justify-center p-2 lg:p-4">
                <div className="w-full h-full shadow-lg rounded-sm overflow-hidden bg-white max-w-[95%] mx-auto">
                  {activeFile.mimeType.includes('image') && activeFile.thumbnailLink ? (
                    <img src={activeFile.thumbnailLink.replace('=s220', '=s1200')} referrerPolicy="no-referrer" alt={activeFile.name} className="w-full h-full object-contain bg-white" />
                  ) : (
                    <iframe 
                      src={`https://drive.google.com/file/d/${activeFile.id}/preview`} 
                      className="w-full h-full border-0"
                      allow="autoplay"
                      title="Pratinjau Dokumen"
                    ></iframe>
                  )}
                </div>
              </div>

              {/* Action Buttons & Metadata - Compact version */}
              <div className="px-5 py-4 bg-white border-t border-gray-100 shrink-0">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{activeFile.name}</h4>
                    <p className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">
                      {activeFile.mimeType.split('/').pop()?.toUpperCase()} • {formatBytes(activeFile.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeFile.webContentLink ? (
                      <a 
                        href={activeFile.webContentLink} 
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                        title="Unduh File"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    ) : activeFile.mimeType.includes('google-apps') && (
                      <a 
                        href={`${activeFile.webViewLink.replace(/\/view.*$/, '/export?format=pdf')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                        title="Unduh sebagai PDF"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}
                    <button 
                      onClick={(e) => handleDelete(e, activeFile.id, activeFile.name)}
                      disabled={deletingId === activeFile.id || deletingId === 'batch'}
                      className="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded-lg font-semibold transition-colors shrink-0"
                      title="Hapus Dokumen"
                    >
                       {deletingId === activeFile.id ? (
                         <div className="animate-spin h-4 w-4 border-2 border-red-600 border-b-transparent rounded-full"></div>
                       ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                         </svg>
                       )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                  <div className="flex flex-col gap-0.5 px-2 py-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Dibuat</span>
                    <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap">{new Date(activeFile.createdTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 px-2 py-1 border-l border-gray-200">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Ukuran</span>
                    <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap">{formatBytes(activeFile.size)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

    </main>
  );
}
