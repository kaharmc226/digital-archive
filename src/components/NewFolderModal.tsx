import React, { useState } from 'react';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (folderName: string) => Promise<void>;
}

export const NewFolderModal = ({ isOpen, onClose, onSubmit }: NewFolderModalProps) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
      await onSubmit(newFolderName);
      setNewFolderName('');
      onClose();
    } catch(err) {
      // error handled by parent
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Folder Baru</h2>
        <form onSubmit={handleSubmit}>
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
              onClick={onClose}
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
  );
};
