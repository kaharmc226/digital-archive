import React, { useRef, useState, useCallback } from 'react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderName: string;
  onUpload: (files: File[]) => Promise<void>;
  uploading?: boolean;
}

export const UploadModal = ({ isOpen, onClose, currentFolderName, onUpload, uploading }: UploadModalProps) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      onUpload(files);
    }
  }, [onUpload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    
    const filesArray: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList.item(i);
        if (file) filesArray.push(file);
    }
    
    if (filesArray.length > 0) {
        onUpload(filesArray);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h2 className="text-xl font-bold mb-4 text-gray-800">Unggah Dokumen</h2>
          <p className="text-sm text-gray-500 mb-6">File akan diunggah ke: <strong className="text-gray-700">{currentFolderName}</strong></p>
          
          <div 
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center group ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
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
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
    </>
  );
};
