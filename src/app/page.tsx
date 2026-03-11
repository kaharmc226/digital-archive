'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSession, signOut } from "next-auth/react";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
  thumbnailLink?: string;
  size?: string;
  createdTime: string;
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
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce logic for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchItems = async (folderId: string | null = null, search: string = '') => {
    try {
      setLoading(true);
      setError(null);
      let url = folderId ? `/api/drive?folderId=${folderId}` : '/api/drive';
      if (search) {
        url += url.includes('?') ? `&search=${encodeURIComponent(search)}` : `?search=${encodeURIComponent(search)}`;
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
    fetchItems(activeFolderId, debouncedSearch);
  }, [activeFolderId, debouncedSearch]);

  const navigateTo = (id: string | null, name: string, isTopCategory: boolean = false) => {
    setSearchInput('');
    setDebouncedSearch('');
    
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

  const processUpload = async (file: File) => {
    setUploading(true);
    setIsUploadModalOpen(false);
    const formData = new FormData();
    formData.append('file', file);
    if (activeFolderId) formData.append('folderId', activeFolderId);

    const uploadPromise = fetch('/api/drive/upload', { method: 'POST', body: formData })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unggah gagal');
        await fetchItems(activeFolderId, debouncedSearch);
        return 'File berhasil diunggah!';
      });

    toast.promise(uploadPromise, {
      loading: `Mengunggah "${file.name}"...`,
      success: <b>File berhasil diunggah!</b>,
      error: <b>Gagal mengunggah file.</b>,
    });

    try {
      await uploadPromise;
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin menghapus "${name}"?`)) return;
    setDeletingId(id);
    
    const deletePromise = fetch(`/api/drive/${id}`, { method: 'DELETE' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Hapus gagal');
        setData(prev => ({ 
          ...prev, 
          files: prev.files.filter(f => f.id !== id), 
          folders: prev.folders.filter(f => f.id !== id) 
        }));
      });

    toast.promise(deletePromise, {
      loading: `Menghapus "${name}"...`,
      success: <b>File berhasil dihapus!</b>,
      error: <b>Gagal menghapus file.</b>,
    });

    try {
      await deletePromise;
    } finally {
      setDeletingId(null);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUpload(e.dataTransfer.files[0]);
    }
  }, [activeFolderId]);

  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 h-full animate-pulse flex flex-col">
      <div className="aspect-square mb-4 bg-gray-200 rounded-xl"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mt-auto"></div>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col relative bg-gray-50">
      
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

      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => navigateTo(null, 'Semua Dokumen')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeFolderId === null ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📂 Semua Dokumen
          </button>
          {data.categories.length > 0 && <div className="h-4 w-px bg-gray-300 shrink-0 mx-1"></div>}
          {data.categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => navigateTo(cat.id, cat.name, true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                activeFolderId === cat.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📁 {cat.name}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">
              {path.map((p, i) => (
                <span key={p.id || 'root'} className="flex items-center gap-2">
                  <button 
                    onClick={() => navigateTo(p.id, p.name)}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {p.name}
                  </button>
                  {i < path.length - 1 && <span>/</span>}
                </span>
              ))}
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-900">{data.currentFolderName === 'All Documents' ? 'Semua Dokumen' : data.currentFolderName}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
                  {session?.user?.image && (
                    <img src={session.user.image} referrerPolicy="no-referrer" alt="" className="w-8 h-8 rounded-full border border-gray-200" />
                  )}
                  <div className="hidden sm:block">
                    <p className="text-sm font-bold text-gray-900 leading-tight">{session?.user?.name}</p>
                    <button 
                      onClick={() => signOut()}
                      className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
                    >
                      Keluar
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-xl">+</span> Tambah File
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="mb-8">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">🔍</span>
              <input
                type="text"
                placeholder={activeFolderId === null ? "Cari di semua kategori..." : `Cari di ${data.currentFolderName}...`}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-8">
               <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Memuat Dokumen...</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                  </div>
               </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm text-red-700"><strong>Error:</strong> {error}</div>
          ) : data.folders.length === 0 && data.files.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-gray-500 text-lg mb-2">
                {debouncedSearch ? `Hasil tidak ditemukan untuk "${debouncedSearch}"` : "Folder ini kosong."}
              </p>
              {!debouncedSearch && (
                <button onClick={() => setIsUploadModalOpen(true)} className="text-blue-600 hover:underline font-medium">Unggah file pertama</button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {data.folders.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Subfolder</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {data.folders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => navigateTo(folder.id, folder.name)}
                        className="group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all text-left"
                      >
                        <span className="text-2xl">📁</span>
                        <span className="font-semibold text-gray-700 truncate text-sm">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {data.files.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Dokumen</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {data.files.map((file) => (
                      <div key={file.id} className="group relative bg-white rounded-2xl border border-gray-200 p-4 transition-all hover:shadow-xl hover:border-blue-300 flex flex-col h-full">
                        <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="flex-1 flex flex-col">
                          <div className="aspect-square mb-4 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center relative">
                            {file.thumbnailLink ? (
                              <img src={file.thumbnailLink.replace('=s220', '=s400')} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <img src={file.iconLink} alt="" className="w-12 h-12" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600 text-sm" title={file.name}>{file.name}</h3>
                            <div className="flex items-center justify-between mt-auto">
                              <p className="text-[10px] text-gray-400 uppercase font-extrabold tracking-widest">
                                {file.mimeType.split('/').pop()?.split('.').pop()}
                              </p>
                              <p className="text-[10px] text-gray-500 font-medium">{new Date(file.createdTime).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </a>
                        <button
                          onClick={(e) => handleDelete(e, file.id, file.name)}
                          disabled={deletingId === file.id}
                          className="absolute top-3 right-3 p-2 bg-white/95 rounded-full text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all shadow-md border border-gray-100"
                        >
                          {deletingId === file.id ? <div className="animate-spin h-4 w-4 border-2 border-red-600 border-b-transparent rounded-full"></div> : <span className="text-xs">🗑️</span>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
