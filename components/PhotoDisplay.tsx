
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Boundary } from '../types';
import { TrashIcon, RotateIcon } from './Icons';

interface PhotoDisplayProps {
  imageUrl: string;
  boundaries: Boundary[];
  selectedBoundaryId: string | null;
  onSelectBoundary: (id: string | null) => void;
  onUpdateBoundary: (boundary: Boundary) => void;
  onDeleteBoundary: (id: string) => void;
  labelOffset?: number;
  onInteractionStart?: () => void;
}

const HANDLE_NAMES = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'] as const;
type Handle = typeof HANDLE_NAMES[number] | 'move' | 'rotate';

const SNAP_THRESHOLD = 1.2; 
const MIN_SIZE = 1.5; // Min 1.5% of parent

const PhotoDisplay: React.FC<PhotoDisplayProps> = ({ 
    imageUrl, 
    boundaries,
    selectedBoundaryId,
    onSelectBoundary,
    onUpdateBoundary,
    onDeleteBoundary,
    labelOffset = 0,
    onInteractionStart
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeGuidelines, setActiveGuidelines] = useState<{ x?: number[]; y?: number[] }>({});
  const [readout, setReadout] = useState<string | null>(null);
  const [isShiftDown, setIsShiftDown] = useState(false);
  
  const interactionRef = useRef<{ 
    handle: Handle, 
    initialBoundary: Boundary,
    anchorGlobalX: number,
    anchorGlobalY: number,
    startAngle: number,
    startMouseX: number,
    startMouseY: number,
    aspectRatio: number
  } | null>(null);

  // Monitor Shift Key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => setIsShiftDown(e.shiftKey);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  const getCursorClass = (handle: Handle) => {
    switch(handle) {
      case 'move': return 'cursor-move';
      case 'rotate': return 'cursor-alias';
      case 'tl': case 'br': return 'cursor-nwse-resize';
      case 'tr': case 'bl': return 'cursor-nesw-resize';
      case 't': case 'b': return 'cursor-ns-resize';
      case 'l': case 'r': return 'cursor-ew-resize';
      default: return '';
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, boundary: Boundary, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (onInteractionStart) onInteractionStart();
    onSelectBoundary(boundary.id);
    
    const containerRect = containerRef.current!.getBoundingClientRect();
    const centerX = (boundary.centerX / 100) * containerRect.width + containerRect.left;
    const centerY = (boundary.centerY / 100) * containerRect.height + containerRect.top;
    
    const rad = (boundary.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    let localAnchorX = 0;
    let localAnchorY = 0;

    if (handle.includes('l')) localAnchorX = boundary.width / 2;
    if (handle.includes('r')) localAnchorX = -boundary.width / 2;
    if (handle.includes('t')) localAnchorY = boundary.height / 2;
    if (handle.includes('b')) localAnchorY = -boundary.height / 2;

    const anchorGlobalX = centerX + (localAnchorX * cos - localAnchorY * sin) * (containerRect.width / 100);
    const anchorGlobalY = centerY + (localAnchorX * sin + localAnchorY * cos) * (containerRect.height / 100);

    interactionRef.current = { 
        handle, 
        initialBoundary: { ...boundary },
        anchorGlobalX,
        anchorGlobalY,
        startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        aspectRatio: boundary.width / boundary.height
    };
    containerRef.current?.classList.add(getCursorClass(handle));
  };

  const handleMouseUp = useCallback(() => {
    if (interactionRef.current) {
        containerRef.current?.classList.remove(getCursorClass(interactionRef.current.handle));
    }
    interactionRef.current = null;
    setActiveGuidelines({});
    setReadout(null);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const interaction = interactionRef.current;
    const container = containerRef.current;
    if (!interaction || !container) return;

    const { handle, initialBoundary, anchorGlobalX, anchorGlobalY, startAngle, startMouseX, startMouseY, aspectRatio } = interaction;
    const containerRect = container.getBoundingClientRect();
    
    let { centerX, centerY, width, height, rotation } = initialBoundary;

    if (handle === 'move') {
      const dxPerc = ((e.clientX - startMouseX) / containerRect.width) * 100;
      const dyPerc = ((e.clientY - startMouseY) / containerRect.height) * 100;
      centerX = Math.max(0, Math.min(100, initialBoundary.centerX + dxPerc));
      centerY = Math.max(0, Math.min(100, initialBoundary.centerY + dyPerc));
      setReadout(`${centerX.toFixed(1)}%, ${centerY.toFixed(1)}%`);
    } else if (handle === 'rotate') {
        const cx = (initialBoundary.centerX / 100) * containerRect.width + containerRect.left;
        const cy = (initialBoundary.centerY / 100) * containerRect.height + containerRect.top;
        const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
        rotation = (initialBoundary.rotation + angleDiff) % 360;
        if (rotation < 0) rotation += 360;
        
        // Smart Snap to 90deg steps
        if (Math.abs(rotation % 90) < 3 || Math.abs(rotation % 90) > 87) {
          rotation = Math.round(rotation / 90) * 90;
        }
        setReadout(`${rotation.toFixed(1)}°`);
    } else {
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const vGlobalX = e.clientX - anchorGlobalX;
        const vGlobalY = e.clientY - anchorGlobalY;

        const vLocalX = (vGlobalX * cos + vGlobalY * sin) / (containerRect.width / 100);
        const vLocalY = (-vGlobalX * sin + vGlobalY * cos) / (containerRect.height / 100);

        let newLocalWidth = width;
        let newLocalHeight = height;

        if (handle.includes('r')) newLocalWidth = Math.max(MIN_SIZE, vLocalX);
        else if (handle.includes('l')) newLocalWidth = Math.max(MIN_SIZE, -vLocalX);

        if (handle.includes('b')) newLocalHeight = Math.max(MIN_SIZE, vLocalY);
        else if (handle.includes('t')) newLocalHeight = Math.max(MIN_SIZE, -vLocalY);

        // ASPECT RATIO LOCK (Shift Key)
        if (isShiftDown) {
            if (handle.length === 2) { // Corners
                const scale = Math.max(newLocalWidth / width, newLocalHeight / height);
                newLocalWidth = width * scale;
                newLocalHeight = height * scale;
            } else if (handle === 'l' || handle === 'r') {
                newLocalHeight = newLocalWidth / aspectRatio;
            } else if (handle === 't' || handle === 'b') {
                newLocalWidth = newLocalHeight * aspectRatio;
            }
        }

        width = newLocalWidth;
        height = newLocalHeight;

        let localCenterXOffset = 0;
        let localCenterYOffset = 0;
        if (handle.includes('r')) localCenterXOffset = width / 2;
        else if (handle.includes('l')) localCenterXOffset = -width / 2;
        if (handle.includes('b')) localCenterYOffset = height / 2;
        else if (handle.includes('t')) localCenterYOffset = -height / 2;

        centerX = ((anchorGlobalX - containerRect.left) / containerRect.width) * 100 + (localCenterXOffset * cos - localCenterYOffset * sin);
        centerY = ((anchorGlobalY - containerRect.top) / containerRect.height) * 100 + (localCenterXOffset * sin + localCenterYOffset * cos);

        setReadout(`${width.toFixed(1)}% × ${height.toFixed(1)}%`);
    }

    // ENHANCED SNAPPING
    const isSnappedRot = Math.abs(rotation % 90) < 0.1 || Math.abs(rotation % 90) > 89.9;
    if (handle !== 'rotate' && isSnappedRot) {
      const snapX: number[] = [0, 50, 100]; 
      const snapY: number[] = [0, 50, 100];
      
      boundaries.forEach(b => {
        if (b.id === initialBoundary.id) return;
        snapX.push(b.centerX, b.centerX - b.width/2, b.centerX + b.width/2);
        snapY.push(b.centerY, b.centerY - b.height/2, b.centerY + b.height/2);
      });

      const activeX: number[] = [];
      const activeY: number[] = [];

      [centerX, centerX - width/2, centerX + width/2].forEach((val) => {
        for (const target of snapX) {
          if (Math.abs(val - target) < SNAP_THRESHOLD) {
            centerX += (target - val);
            activeX.push(target);
            break;
          }
        }
      });

      [centerY, centerY - height/2, centerY + height/2].forEach((val) => {
        for (const target of snapY) {
          if (Math.abs(val - target) < SNAP_THRESHOLD) {
            centerY += (target - val);
            activeY.push(target);
            break;
          }
        }
      });

      setActiveGuidelines({ x: activeX, y: activeY });
    }
    
    // Clamp to Scan Area
    centerX = Math.max(width/2, Math.min(100 - width/2, centerX));
    centerY = Math.max(height/2, Math.min(100 - height/2, centerY));

    onUpdateBoundary({ ...initialBoundary, centerX, centerY, width, height, rotation });
  }, [onUpdateBoundary, boundaries, isShiftDown]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div 
        ref={containerRef}
        className="relative w-full max-w-4xl mx-auto border-2 border-slate-700 rounded-xl shadow-2xl overflow-hidden bg-slate-950 group/display cursor-crosshair select-none"
        onClick={() => onSelectBoundary(null)}
    >
      <img src={imageUrl} alt="Scanned photos" className="block w-full h-auto select-none opacity-90 transition-opacity group-hover/display:opacity-85" draggable="false" />
      
      {/* Smart Snapping Guidelines */}
      {activeGuidelines.x?.map((x, i) => (
        <div key={`guideline-x-${x}-${i}`} className="absolute top-0 bottom-0 border-l border-sky-400/60 z-[100] pointer-events-none shadow-[0_0_10px_rgba(56,189,248,0.5)]" style={{ left: `${x}%` }} />
      ))}
      {activeGuidelines.y?.map((y, i) => (
        <div key={`guideline-y-${y}-${i}`} className="absolute left-0 right-0 border-t border-sky-400/60 z-[100] pointer-events-none shadow-[0_0_10px_rgba(56,189,248,0.5)]" style={{ top: `${y}%` }} />
      ))}

      {boundaries.map((box, index) => {
        const isSelected = box.id === selectedBoundaryId;
        return (
          <div
            key={box.id}
            className={`absolute ${isSelected ? 'border-sky-400 z-30 ring-2 ring-sky-400/40 shadow-[0_0_50px_rgba(56,189,248,0.4)]' : 'border-white/20 hover:border-sky-400/50 hover:bg-sky-400/5 z-10'} border-2 transition-all duration-100`}
            style={{
              left: `${box.centerX}%`,
              top: `${box.centerY}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
              transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
              transformOrigin: 'center center'
            }}
            onMouseDown={(e) => handleMouseDown(e, box, 'move')}
          >
            {/* Box ID Label */}
            <div 
                className={`absolute -top-10 -left-1 px-3 py-1.5 text-[10px] font-black tracking-widest uppercase ${isSelected ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'} rounded-lg shadow-2xl pointer-events-none flex items-center gap-2 whitespace-nowrap z-50 border border-white/10`}
                style={{ transform: `rotate(${-box.rotation}deg)`, transformOrigin: 'bottom left' }}
            >
              <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
              PRINT #{index + 1 + labelOffset}
            </div>

            {/* Readout HUD */}
            {isSelected && readout && (
                <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 backdrop-blur-2xl px-5 py-2.5 rounded-2xl border border-sky-400/40 text-sky-300 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap z-[100] shadow-3xl pointer-events-none border-t-sky-400/60"
                    style={{ transform: `translate(-50%, -50%) rotate(${-box.rotation}deg)` }}
                >
                    {readout}
                    {isShiftDown && <span className="ml-2 text-white/50">• ASPECT LOCKED</span>}
                </div>
            )}
            
            {isSelected && (
              <>
                {/* Delete Trigger */}
                <button 
                  className="absolute -top-6 -right-6 w-12 h-12 bg-slate-900 border-2 border-red-500/60 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all z-[60] shadow-3xl hover:scale-110 active:scale-90 group/del"
                  onMouseDown={(e) => { e.stopPropagation(); onDeleteBoundary(box.id); }}
                  style={{ transform: `rotate(${-box.rotation}deg)` }}
                  title="Remove Box (Del)"
                >
                  <TrashIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                </button>

                {/* Primary Rotation Handle */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 flex flex-col items-center z-[55]">
                    <div 
                        className="w-14 h-14 rounded-full bg-slate-900 border-2 border-sky-400/80 shadow-3xl cursor-alias flex items-center justify-center text-sky-400 hover:bg-sky-400 hover:text-slate-900 transition-all active:scale-90 group/rot"
                        onMouseDown={(e) => handleMouseDown(e, box, 'rotate')}
                    >
                        <RotateIcon className="w-7 h-7 transition-transform duration-500 group-hover:rotate-180" />
                    </div>
                    <div className="w-0.5 h-12 bg-gradient-to-t from-sky-400/80 to-transparent" />
                </div>

                {/* Resize Handles */}
                {HANDLE_NAMES.map(handle => {
                  const positions = {
                    t: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
                    b: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
                    l: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
                    r: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
                    tl: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
                    tr: 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
                    bl: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
                    br: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
                  }
                  
                  const isCorner = handle.length === 2;
                  
                  return (
                    <div
                      key={handle}
                      className={`absolute ${isCorner ? 'w-6 h-6 border-[3px]' : 'w-4 h-4 border-2'} bg-slate-950 border-sky-400 rounded-lg z-[55] ${getCursorClass(handle)} ${positions[handle]} hover:scale-125 hover:bg-sky-400 transition-all shadow-xl active:bg-white active:border-white`}
                      onMouseDown={(e) => handleMouseDown(e, box, handle)}
                    />
                  )
                })}
              </>
            )}
          </div>
        )
      })}
    </div>
  );
};

export default PhotoDisplay;
