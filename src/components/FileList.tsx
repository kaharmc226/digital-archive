import React from 'react';
import { DriveItem } from '../types/drive';

interface FileListProps {
  items: DriveItem[];
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  activeFile: DriveItem | null;
  setActiveFile: (file: DriveItem | null) => void;
  navigateTo: (id: string | null, name: string) => void;
  handleDelete: (e: React.MouseEvent, id: string, name: string) => void;
  deletingId: string | null;
  formatBytes: (bytes: string | undefined, decimals?: number) => string;
}

export const FileList = ({
  items, selectedIds, toggleSelect, toggleSelectAll, activeFile, setActiveFile, navigateTo, handleDelete, deletingId, formatBytes
}: FileListProps) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <th className="p-4 w-10">
                <input 
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.length === items.length}
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
            {items.map((item) => (
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
  );
};
