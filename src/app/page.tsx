'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useSession, signOut } from "next-auth/react";
import { UploadModal } from '../components/UploadModal';
import { NewFolderModal } from '../components/NewFolderModal';
import { FileGrid } from '../components/FileGrid';
import { FileList } from '../components/FileList';
import { HeaderActions } from '../components/HeaderActions';

import { DriveItem } from '../types/drive';
import { SkeletonGridCard, SkeletonListRow } from '../components/Skeletons';

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
  const [isTyping, setIsTyping] = useState(false);
  
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
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
      setIsTyping(false);
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
      
      // Update root breadcrumb name to match currentFolderName
      if (folderId === null) {
        setPath(prev => {
          const newPath = [...prev];
          if (newPath.length > 0 && newPath[0].id === null) {
            newPath[0].name = resData.currentFolderName || 'Semua Dokumen';
          }
          return newPath;
        });
      }
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
      setPath([{id: null, name: data.currentFolderName || 'Semua Dokumen'}]);
      setActiveFolderId(null);
      return;
    }
    
    if (isTopCategory) {
      setPath([{id: null, name: data.currentFolderName || 'Semua Dokumen'}, {id, name}]);
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
  };

  const handleCreateFolder = async (name: string) => {
    try {
      const res = await fetch('/api/drive/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: activeFolderId }),
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal membuat folder');
      
      toast.success(<b>Folder "{name}" berhasil dibuat!</b>);
      await fetchItems(activeFolderId, debouncedSearch, filterType, filterDate);
    } catch (err: any) {
      toast.error(<b>{err.message || 'Gagal membuat folder'}</b>);
      throw err;
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



  return (
    <main className="min-h-screen flex flex-col relative bg-gray-50 overflow-hidden h-screen">
      
      {/* Upload Modal */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        currentFolderName={data.currentFolderName}
        onUpload={processUpload}
        uploading={uploading}
      />

      {/* New Folder Modal */}
      <NewFolderModal 
        isOpen={isFolderModalOpen} 
        onClose={() => setIsFolderModalOpen(false)} 
        onSubmit={handleCreateFolder}
      />

      <HeaderActions 
        path={path}
        navigateTo={navigateTo}
        session={session}
        onSignOut={() => signOut()}
        activeFolderId={activeFolderId}
        currentFolderName={data.currentFolderName}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        setIsTyping={setIsTyping}
        filterType={filterType}
        setFilterType={setFilterType}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        viewMode={viewMode}
        setViewMode={setViewMode}
        openFolderModal={() => setIsFolderModalOpen(true)}
        openUploadModal={() => setIsUploadModalOpen(true)}
        uploading={uploading}
      />

      {/* Main Content Area Layout with Preview Pane */}
      <div className="flex-1 overflow-hidden flex flex-row w-full max-w-screen-2xl mx-auto">
        
        {/* Left Column: File List */}
        <div className={`flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-300 ${activeFile ? 'hidden lg:block lg:pr-4' : ''}`}>
          {(loading || isTyping) ? (
            <div className="space-y-8 mt-2">
               <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                    {isTyping ? "Mengetik..." : "Memuat Dokumen..."}
                  </h2>
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
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 mt-2 flex flex-col items-center justify-center">
              <div className="bg-gray-50 rounded-full p-6 mb-4">
                <span className="text-5xl text-gray-400">
                  {debouncedSearch ? '🔍' : '📭'}
                </span>
              </div>
              <h3 className="text-gray-800 font-bold text-xl mb-2">
                {debouncedSearch ? `Pencarian tidak ditemukan` : "Folder ini kosong"}
              </h3>
              <p className="text-gray-500 max-w-sm mx-auto mb-6">
                {debouncedSearch ? `Kami tidak dapat menemukan hasil untuk "${debouncedSearch}". Coba gunakan kata kunci yang berbeda.` : "Belum ada dokumen atau file yang diunggah ke folder ini."}
              </p>
              {!debouncedSearch && (
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setIsFolderModalOpen(true)} className="text-blue-600 hover:text-blue-800 font-semibold transition-colors">Buat folder</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setIsUploadModalOpen(true)} className="text-blue-600 hover:text-blue-800 font-semibold transition-colors">Unggah file pertama</button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 mt-2 pb-20">
              {viewMode === 'grid' ? (
                <FileGrid 
                  items={mergedItems}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  activeFile={activeFile}
                  setActiveFile={setActiveFile}
                  navigateTo={navigateTo}
                  handleDelete={handleDelete}
                  deletingId={deletingId}
                />
              ) : (
                <FileList 
                  items={mergedItems}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  toggleSelectAll={toggleSelectAll}
                  activeFile={activeFile}
                  setActiveFile={setActiveFile}
                  navigateTo={navigateTo}
                  handleDelete={handleDelete}
                  deletingId={deletingId}
                  formatBytes={formatBytes}
                />
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
