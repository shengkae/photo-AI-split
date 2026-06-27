import React, { useState, useEffect, useCallback } from 'react';
import { CroppedImage } from '../types';
import { DownloadIcon, PreviewIcon, CloseIcon, RotateIcon, SparklesIcon } from './Icons';
import Spinner from './Spinner';

interface SplitPhotoGalleryProps {
  images: CroppedImage[];
  onDownload: (dataUrl: string, index: number) => void;
  onDownloadAll: () => void;
  onRotate: (id: string) => void;
  onRestore: (id: string) => void;
}

const SplitPhotoGallery: React.FC<SplitPhotoGalleryProps> = ({ images, onDownload, onDownloadAll, onRotate, onRestore }) => {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const closePreview = useCallback(() => setPreviewIndex(null), []);

  const navigatePreview = useCallback((direction: 'next' | 'prev') => {
    if (previewIndex === null) return;
    if (direction === 'next') {
      setPreviewIndex((previewIndex + 1) % images.length);
    } else {
      setPreviewIndex((previewIndex - 1 + images.length) % images.length);
    }
  }, [previewIndex, images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewIndex === null) return;
      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowRight') navigatePreview('next');
      if (e.key === 'ArrowLeft') navigatePreview('prev');
      if (e.key === 'r' || e.key === 'R') onRotate(images[previewIndex].id);
      if (e.key === 'e' || e.key === 'E') onRestore(images[previewIndex].id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, closePreview, navigatePreview, onRotate, onRestore, images]);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-6xl mx-auto mt-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Detected Photos</h2>
          <p className="text-slate-400 text-sm">{images.length} items ready to save</p>
        </div>
        <button
            onClick={onDownloadAll}
            className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20"
        >
            <DownloadIcon />
            Download All
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.map((image, index) => (
          <div 
            key={image.id} 
            className="group relative bg-slate-800 rounded-xl overflow-hidden shadow-md border border-slate-700 hover:border-sky-500/50 transition-all hover:shadow-xl hover:shadow-sky-500/10"
          >
            <div 
              className={`aspect-[3/4] cursor-zoom-in overflow-hidden relative ${image.isRestoring ? 'opacity-50' : ''}`}
              onClick={() => !image.isRestoring && setPreviewIndex(index)}
            >
              <img 
                src={image.dataUrl} 
                alt={`Split photo ${index + 1}`} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
              {image.isRestoring && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                  <Spinner size={8} />
                </div>
              )}
            </div>
            
            {!image.isRestoring && (
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <button
                  onClick={() => setPreviewIndex(index)}
                  className="w-32 py-1.5 bg-white text-slate-900 rounded-lg hover:bg-sky-50 focus:outline-none transition-colors flex items-center justify-center gap-2 font-bold text-xs shadow-lg"
                >
                  <PreviewIcon className="w-3.5 h-3.5" />
                  Preview
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRestore(image.id); }}
                  className="w-32 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 focus:outline-none transition-colors flex items-center justify-center gap-2 font-bold text-xs shadow-lg border border-indigo-400/30"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  AI Restore
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRotate(image.id); }}
                  className="w-32 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 focus:outline-none transition-colors flex items-center justify-center gap-2 font-bold text-xs shadow-lg"
                >
                  <RotateIcon className="w-3.5 h-3.5" />
                  Rotate 90°
                </button>
                <button
                  onClick={() => onDownload(image.dataUrl, index)}
                  className="w-32 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-500 focus:outline-none transition-colors flex items-center justify-center gap-2 font-bold text-xs shadow-lg"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            )}

            <div className="absolute top-3 left-3 px-2 py-1 bg-slate-900/80 backdrop-blur-md rounded-md text-[10px] font-bold text-sky-400 border border-slate-700">
                #{index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Lightbox */}
      {previewIndex !== null && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && closePreview()}
        >
          <button 
            onClick={closePreview}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
            aria-label="Close preview"
          >
            <CloseIcon className="w-8 h-8" />
          </button>

          <div className="relative w-full max-w-4xl max-h-[75vh] flex items-center justify-center group">
            {/* Nav Arrows */}
            <button 
              onClick={() => navigatePreview('prev')}
              className="absolute -left-4 sm:-left-12 p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-full transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            <div className="relative">
              <img 
                src={images[previewIndex].dataUrl} 
                alt="Full preview" 
                className={`max-w-full max-h-[75vh] object-contain shadow-2xl rounded-sm animate-in zoom-in-95 duration-300 ${images[previewIndex].isRestoring ? 'blur-sm grayscale' : ''}`} 
              />
              {images[previewIndex].isRestoring && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 rounded-sm">
                  <Spinner size={12} />
                  <p className="mt-4 text-white font-bold bg-slate-950/60 px-4 py-2 rounded-full backdrop-blur-md">AI Restoration in Progress...</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => navigatePreview('next')}
              className="absolute -right-4 sm:-right-12 p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-full transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4 px-4">
            <div className="w-full flex justify-center mb-2">
              <div className="px-4 py-1.5 bg-slate-800 rounded-full text-sm font-medium text-slate-300 border border-slate-700">
                Photo {previewIndex + 1} of {images.length}
              </div>
            </div>
            
            <button
              onClick={() => onRestore(images[previewIndex].id)}
              disabled={images[previewIndex].isRestoring}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 focus:outline-none transition-all flex items-center gap-2 font-bold shadow-xl shadow-indigo-600/20 border border-indigo-400/40 disabled:opacity-50"
            >
              <SparklesIcon className="w-6 h-6" />
              AI Magic Restore
            </button>

            <button
              onClick={() => onRotate(images[previewIndex].id)}
              disabled={images[previewIndex].isRestoring}
              className="px-8 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 focus:outline-none transition-all flex items-center gap-2 font-bold shadow-xl shadow-black/20"
            >
              <RotateIcon className="w-6 h-6" />
              Rotate 90°
            </button>

            <button
              onClick={() => onDownload(images[previewIndex].dataUrl, previewIndex)}
              disabled={images[previewIndex].isRestoring}
              className="px-8 py-3 bg-sky-600 text-white rounded-xl hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all flex items-center gap-2 font-bold shadow-xl shadow-sky-600/20"
            >
              <DownloadIcon className="w-6 h-6" />
              Save Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SplitPhotoGallery;