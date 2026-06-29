
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import PhotoDisplay from './components/PhotoDisplay';
import SplitPhotoGallery from './components/SplitPhotoGallery';
import Spinner from './components/Spinner';
import { MagicWandIcon, CropIcon, AddIcon, UndoIcon, RedoIcon, RotateIcon } from './components/Icons';
import { findPhotoBoundaries, restorePhoto } from './services/geminiService';
import { Boundary, CroppedImage, SourceScan } from './types';

const MAX_HISTORY = 50;

function App() {
  const [scans, setScans] = useState<SourceScan[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [selectedBoundaryId, setSelectedBoundaryId] = useState<string | null>(null);
  const [splitImages, setSplitImages] = useState<CroppedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeScan = useMemo(() => 
    scans.find(s => s.id === activeScanId) || null
  , [scans, activeScanId]);

  const selectedBoundary = useMemo(() => {
    if (!activeScan || !selectedBoundaryId) return null;
    return activeScan.boundaries.find(b => b.id === selectedBoundaryId) || null;
  }, [activeScan, selectedBoundaryId]);

  const labelOffset = useMemo(() => {
    if (!activeScanId) return splitImages.length;
    const activeScanIndex = scans.findIndex(s => s.id === activeScanId);
    if (activeScanIndex === -1) return splitImages.length;
    const previousScansBoundariesCount = scans
      .slice(0, activeScanIndex)
      .reduce((acc, scan) => acc + scan.boundaries.length, 0);
    return splitImages.length + previousScansBoundariesCount;
  }, [scans, activeScanId, splitImages.length]);

  const updateScanState = useCallback((id: string, updates: Partial<SourceScan>) => {
    setScans(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const pushToHistory = useCallback((id: string, currentBoundaries: Boundary[]) => {
    setScans(prev => prev.map(s => {
      if (s.id !== id) return s;
      const history = [...(s.history || []), [...s.boundaries]].slice(-MAX_HISTORY);
      return { ...s, history, future: [] }; // Reset future when a new action is performed
    }));
  }, []);

  const handleUndo = useCallback(() => {
    if (!activeScan || !activeScan.history || activeScan.history.length === 0) return;
    
    setScans(prev => prev.map(s => {
      if (s.id !== activeScan.id || !s.history || s.history.length === 0) return s;
      
      const newHistory = [...s.history];
      const previousState = newHistory.pop()!;
      const newFuture = [[...s.boundaries], ...(s.future || [])].slice(0, MAX_HISTORY);
      
      return {
        ...s,
        boundaries: previousState,
        history: newHistory,
        future: newFuture
      };
    }));
    setSelectedBoundaryId(null);
  }, [activeScan]);

  const handleRedo = useCallback(() => {
    if (!activeScan || !activeScan.future || activeScan.future.length === 0) return;

    setScans(prev => prev.map(s => {
      if (s.id !== activeScan.id || !s.future || s.future.length === 0) return s;
      
      const newFuture = [...s.future];
      const nextState = newFuture.shift()!;
      const newHistory = [...(s.history || []), [...s.boundaries]].slice(-MAX_HISTORY);
      
      return {
        ...s,
        boundaries: nextState,
        history: newHistory,
        future: newFuture
      };
    }));
    setSelectedBoundaryId(null);
  }, [activeScan]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBoundaryId && activeScanId) {
          handleDeleteBoundary(selectedBoundaryId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedBoundaryId, activeScanId]);

  const resetAll = () => {
    setScans([]);
    setActiveScanId(null);
    setSelectedBoundaryId(null);
    setSplitImages([]);
    setError(null);
  };

  const handleImagesUpload = (uploads: { dataUrl: string; file: File }[]) => {
    const newScans: SourceScan[] = uploads.map(u => ({
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dataUrl: u.dataUrl,
      file: u.file,
      boundaries: [],
      isDetected: false,
      isProcessing: false,
      statusText: '',
      history: [],
      future: []
    }));
    setScans(prev => [...prev, ...newScans]);
    if (!activeScanId && newScans.length > 0) setActiveScanId(newScans[0].id);
  };

  const removeScan = (id: string) => {
    setScans(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (activeScanId === id) setActiveScanId(filtered.length > 0 ? filtered[0].id : null);
      return filtered;
    });
  };

  const cropImages = useCallback(async (imageSrc: string, boundariesToCrop: Boundary[]): Promise<CroppedImage[]> => {
    return new Promise((resolve) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const cropped: CroppedImage[] = boundariesToCrop.map((box, index) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return { id: `err-${index}`, dataUrl: '' };

          const pixelWidth = (box.width / 100) * image.naturalWidth;
          const pixelHeight = (box.height / 100) * image.naturalHeight;
          const pixelCenterX = (box.centerX / 100) * image.naturalWidth;
          const pixelCenterY = (box.centerY / 100) * image.naturalHeight;
          
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;

          ctx.translate(pixelWidth / 2, pixelHeight / 2);
          ctx.rotate((-box.rotation * Math.PI) / 180);
          ctx.drawImage(image, -pixelCenterX, -pixelCenterY);
          
          return { id: `crop-${index}-${Date.now()}`, dataUrl: canvas.toDataURL('image/png') };
        });
        resolve(cropped.filter(img => img.dataUrl));
      };
      image.onerror = () => resolve([]);
    });
  }, []);

  const handleRotate90 = useCallback((id: string) => {
    setSplitImages(prev => prev.map(item => {
      if (item.id !== id) return item;
      const img = new Image();
      img.src = item.dataUrl;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return item;
      canvas.width = img.height;
      canvas.height = img.width;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      return { ...item, dataUrl: canvas.toDataURL('image/png') };
    }));
  }, []);

  const handleBoundaryRotate = (direction: 'cw' | 'ccw') => {
    if (!activeScanId || !selectedBoundaryId || !selectedBoundary) return;
    pushToHistory(activeScanId, activeScan!.boundaries);
    const amount = direction === 'cw' ? 90 : -90;
    const updated = { ...selectedBoundary, rotation: (selectedBoundary.rotation + amount) % 360 };
    handleUpdateBoundary(updated);
  };

  const handleRestoreImage = useCallback(async (id: string) => {
    const target = splitImages.find(img => img.id === id);
    if (!target || target.isRestoring) return;
    setSplitImages(prev => prev.map(img => img.id === id ? { ...img, isRestoring: true } : img));
    try {
      const base64Data = target.dataUrl.split(',')[1];
      const restoredDataUrl = await restorePhoto(base64Data, 'image/png');
      setSplitImages(prev => prev.map(img => img.id === id ? { ...img, dataUrl: restoredDataUrl, isRestoring: false } : img));
    } catch (e: any) {
      setError(`Restoration failed: ${e.message}`);
      setSplitImages(prev => prev.map(img => img.id === id ? { ...img, isRestoring: false } : img));
    }
  }, [splitImages]);
  
  const handleAutoSplit = async (id: string) => {
    const scan = scans.find(s => s.id === id);
    if (!scan) return;
    updateScanState(id, { isProcessing: true, statusText: 'Precision AI Analysis...' });
    setError(null);
    try {
      const base64Data = scan.dataUrl.split(',')[1];
      const detectedBoundaries = await findPhotoBoundaries(base64Data, scan.file.type);
      
      setScans(prev => prev.map(s => s.id === id ? {
        ...s,
        boundaries: detectedBoundaries,
        isDetected: true,
        isProcessing: false,
        history: [...(s.history || []), [...s.boundaries]].slice(-MAX_HISTORY),
        future: []
      } : s));
    } catch (e: any) {
      setError(e.message);
      updateScanState(id, { isProcessing: false });
    }
  };

  const handleConfirmAndCrop = async (id: string) => {
    const scan = scans.find(s => s.id === id);
    if (!scan) return;
    updateScanState(id, { isProcessing: true, statusText: 'Straightening & Exporting...' });
    try {
      const cropped = await cropImages(scan.dataUrl, scan.boundaries);
      setSplitImages(prev => [...prev, ...cropped]);
      removeScan(id);
    } catch (e: any) {
      setError(e.message);
      updateScanState(id, { isProcessing: false });
    }
  };

  const handleUpdateBoundary = (updated: Boundary) => {
    if (!activeScanId) return;
    setScans(prev => prev.map(s => s.id === activeScanId ? {
      ...s, boundaries: s.boundaries.map(b => b.id === updated.id ? updated : b)
    } : s));
  };

  const handleAddBoundary = () => {
    if (!activeScanId || !activeScan) return;
    pushToHistory(activeScanId, activeScan.boundaries);
    const newB: Boundary = { id: `m-${Date.now()}`, centerX: 50, centerY: 50, width: 30, height: 40, rotation: 0 };
    setScans(prev => prev.map(s => s.id === activeScanId ? { ...s, boundaries: [...s.boundaries, newB] } : s));
    setSelectedBoundaryId(newB.id);
  };

  const handleDeleteBoundary = (id: string) => {
    if (!activeScanId || !activeScan) return;
    pushToHistory(activeScanId, activeScan.boundaries);
    setScans(prev => prev.map(s => s.id === activeScanId ? { ...s, boundaries: s.boundaries.filter(b => b.id !== id) } : s));
    if (selectedBoundaryId === id) setSelectedBoundaryId(null);
  };

  const downloadImage = (dataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `photo-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllImages = () => {
    splitImages.forEach((img, index) => {
      downloadImage(img.dataUrl, index);
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8 font-sans selection:bg-sky-500/30">
      <main className="container mx-auto max-w-7xl">
        <header className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 tracking-tight">
            Photo Splitter AI
          </h1>
          <p className="mt-4 text-slate-400 max-w-2xl mx-auto text-lg font-medium leading-relaxed">
            Batch-process old photo scans. Our precision AI automatically isolates, levels, and restores every individual shot.
          </p>
        </header>

        <section className="space-y-10 mb-16">
          {scans.length === 0 && <ImageUploader onImagesUpload={handleImagesUpload} disabled={false} />}

          {scans.length > 0 && (
            <div className="bg-slate-800/40 rounded-3xl border border-slate-700/50 p-8 shadow-2xl backdrop-blur-sm transition-all">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <h3 className="text-2xl font-black text-white flex items-center gap-4">
                  Current Batch
                  <span className="bg-sky-500/10 text-sky-400 text-xs px-3 py-1 rounded-full border border-sky-500/20 uppercase tracking-widest">{scans.length} Scan{scans.length > 1 ? 's' : ''}</span>
                </h3>
                <div className="flex gap-4 w-full md:w-auto">
                  <button onClick={() => {
                    const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.onchange = (e: any) => handleImagesUpload(e.target.files); i.click();
                  }} className="flex-1 md:flex-none text-sm px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all font-bold shadow-lg shadow-black/20 hover:-translate-y-0.5">+ Add Scans</button>
                  <button onClick={resetAll} className="flex-1 md:flex-none text-sm px-6 py-2.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-xl border border-red-900/40 transition-all font-bold">Reset All</button>
                </div>
              </div>

              <div className="flex gap-5 overflow-x-auto pb-8 scrollbar-hide mb-8 border-b border-slate-700/40">
                {scans.map(scan => (
                  <div key={scan.id} onClick={() => setActiveScanId(scan.id)} className={`relative flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden cursor-pointer transition-all border-2 ${activeScanId === scan.id ? 'border-sky-400 ring-4 ring-sky-400/20 scale-110 shadow-2xl z-10' : 'border-slate-700 opacity-60 hover:opacity-100 hover:scale-105'}`}>
                    <img src={scan.dataUrl} className="w-full h-full object-cover" alt="Scan Thumbnail" />
                    {scan.isProcessing && <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center"><Spinner size={8} /></div>}
                  </div>
                ))}
              </div>

              {activeScan && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-wrap gap-4 justify-center items-center">
                    <button onClick={() => handleAutoSplit(activeScan.id)} disabled={activeScan.isProcessing || activeScan.boundaries.length > 0} className="px-8 py-4 bg-sky-600 text-white font-black rounded-2xl hover:bg-sky-500 disabled:opacity-50 transition-all flex items-center gap-3 shadow-xl shadow-sky-600/30 border border-sky-400/30 uppercase tracking-widest text-sm">
                      <MagicWandIcon className="w-6 h-6" /> AI Auto-Detect
                    </button>
                    {activeScan.boundaries.length > 0 && (
                      <>
                        <button onClick={() => handleConfirmAndCrop(activeScan.id)} disabled={activeScan.isProcessing} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center gap-3 shadow-xl shadow-indigo-600/30 border border-indigo-400/30 uppercase tracking-widest text-sm"><CropIcon className="w-6 h-6" />Straighten & Split</button>
                        
                        <div className="flex gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-700 shadow-inner">
                          <button 
                            onClick={handleUndo} 
                            disabled={!activeScan.history || activeScan.history.length === 0} 
                            className="p-3 text-slate-300 hover:bg-slate-700 disabled:opacity-20 rounded-xl transition-all"
                            title="Undo (Ctrl+Z)"
                          >
                            <UndoIcon className="w-6 h-6" />
                          </button>
                          <button 
                            onClick={handleRedo} 
                            disabled={!activeScan.future || activeScan.future.length === 0} 
                            className="p-3 text-slate-300 hover:bg-slate-700 disabled:opacity-20 rounded-xl transition-all"
                            title="Redo (Ctrl+Y)"
                          >
                            <RedoIcon className="w-6 h-6" />
                          </button>
                        </div>

                        <div className="h-10 w-px bg-slate-700 mx-2 hidden sm:block" />

                        <div className="flex gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-700 shadow-inner">
                          <button 
                            onClick={() => handleBoundaryRotate('ccw')} 
                            disabled={!selectedBoundaryId} 
                            className="p-3 text-slate-300 hover:bg-slate-700 disabled:opacity-20 rounded-xl transition-all"
                            title="Rotate Boundary -90°"
                          >
                            <RotateIcon className="w-6 h-6 -scale-x-100" />
                          </button>
                          <button 
                            onClick={() => handleBoundaryRotate('cw')} 
                            disabled={!selectedBoundaryId} 
                            className="p-3 text-slate-300 hover:bg-slate-700 disabled:opacity-20 rounded-xl transition-all"
                            title="Rotate Boundary +90°"
                          >
                            <RotateIcon className="w-6 h-6" />
                          </button>
                        </div>

                        <button onClick={handleAddBoundary} disabled={activeScan.isProcessing} className="px-8 py-4 bg-slate-700 text-slate-200 font-black rounded-2xl hover:bg-slate-600 transition-all flex items-center gap-3 border border-slate-600 uppercase tracking-widest text-sm">
                          <AddIcon className="w-6 h-6" />Manual Box
                        </button>
                      </>
                    )}
                  </div>
                  <div className="relative">
                    <PhotoDisplay 
                      imageUrl={activeScan.dataUrl} 
                      boundaries={activeScan.boundaries} 
                      selectedBoundaryId={selectedBoundaryId} 
                      onSelectBoundary={setSelectedBoundaryId} 
                      onUpdateBoundary={handleUpdateBoundary} 
                      onDeleteBoundary={handleDeleteBoundary} 
                      labelOffset={labelOffset} 
                      onInteractionStart={() => pushToHistory(activeScan.id, activeScan.boundaries)}
                    />
                    {activeScan.isProcessing && (
                      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-50 rounded-2xl transition-all">
                        <div className="bg-slate-800/95 p-10 rounded-3xl shadow-3xl border border-slate-700 flex flex-col items-center gap-6 max-w-sm text-center">
                          <Spinner size={12} />
                          <div className="space-y-2">
                            <p className="text-sky-400 font-black text-lg uppercase tracking-[0.2em] animate-pulse">{activeScan.statusText}</p>
                            <p className="text-slate-500 text-sm font-medium">Sit back, our AI is doing the heavy lifting...</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {activeScan.boundaries.length > 0 && !selectedBoundaryId && (
                    <p className="text-center text-slate-500 font-medium italic animate-bounce">
                      Select a box to manually adjust its rotation and size
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {error && (
          <div className="max-w-2xl mx-auto p-6 mb-12 bg-red-950/40 border-2 border-red-500/30 text-red-100 rounded-3xl text-center shadow-2xl animate-in shake duration-300">
            <h4 className="font-black uppercase tracking-widest text-red-400 mb-2">Processing Error</h4>
            <p className="font-medium opacity-90">{error}</p>
            <button onClick={() => setError(null)} className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-full text-xs font-black uppercase tracking-widest transition-colors">Dismiss</button>
          </div>
        )}

        <div className="relative">
          <SplitPhotoGallery images={splitImages} onDownload={downloadImage} onDownloadAll={downloadAllImages} onRotate={handleRotate90} onRestore={handleRestoreImage} />
        </div>
      </main>
      <footer className="text-center mt-32 text-slate-600 text-sm border-t border-slate-800/50 pt-10 pb-16 font-medium">
        <p>Built with Gemini 3 Pro & Flash 2.5 • Professional Archival Digitization Pipeline</p>
        <p className="mt-2 opacity-60">Preserving history, one pixel at a time.</p>
      </footer>
    </div>
  );
}

export default App;
