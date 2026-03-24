import React from 'react';

interface HeaderActionsProps {
  path: {id: string | null, name: string}[];
  navigateTo: (id: string | null, name: string) => void;
  session: any;
  onSignOut: () => void;
  activeFolderId: string | null;
  currentFolderName: string;
  searchInput: string;
  setSearchInput: (val: string) => void;
  setIsTyping: (val: boolean) => void;
  filterType: string;
  setFilterType: (val: string) => void;
  filterDate: string;
  setFilterDate: (val: string) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (val: 'list' | 'grid') => void;
  openFolderModal: () => void;
  openUploadModal: () => void;
  uploading: boolean;
}

export const HeaderActions = ({
  path, navigateTo, session, onSignOut, activeFolderId, currentFolderName,
  searchInput, setSearchInput, setIsTyping, filterType, setFilterType,
  filterDate, setFilterDate, viewMode, setViewMode, openFolderModal, openUploadModal, uploading
}: HeaderActionsProps) => {
  return (
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
                  onClick={onSignOut}
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
                placeholder={activeFolderId === null ? "Cari dokumen..." : `Cari di ${currentFolderName}...`}
                className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 hover:bg-white focus:bg-white transition-colors text-sm text-gray-800 placeholder:text-gray-400"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setIsTyping(true); }}
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
                  onClick={openFolderModal}
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-semibold shadow-sm transition-all flex items-center gap-2 text-sm cursor-pointer"
                >
                  <span className="text-lg">📁+</span> <span className="hidden sm:inline">Folder Baru</span>
                </button>
                
                <button
                  onClick={openUploadModal}
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
  );
};
