import React from 'react';
import { DriveItem } from '../types/drive';

interface FileGridProps {
  items: DriveItem[];
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  activeFile: DriveItem | null;
  setActiveFile: (file: DriveItem | null) => void;
  navigateTo: (id: string | null, name: string) => void;
  handleDelete: (e: React.MouseEvent, id: string, name: string) => void;
  deletingId: string | null;
}

export const FileGrid = ({
  items, selectedIds, toggleSelect, activeFile, setActiveFile, navigateTo, handleDelete, deletingId
}: FileGridProps) => {
  return (
    <div className={`grid gap-6 ${activeFile ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
      {items.map((item) => (
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
  );
};
