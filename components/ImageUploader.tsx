import React, { useState, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface ImageUploaderProps {
  onImagesUpload: (uploads: { dataUrl: string; file: File }[]) => void;
  disabled: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesUpload, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const uploadPromises = fileArray.map((file) => {
      return new Promise<{ dataUrl: string; file: File }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target && typeof e.target.result === 'string') {
            resolve({ dataUrl: e.target.result, file });
          } else {
            reject(new Error("Failed to read file"));
          }
        };
        reader.onerror = () => reject(new Error("File error"));
        reader.readAsDataURL(file);
      });
    });

    try {
      const results = await Promise.all(uploadPromises);
      onImagesUpload(results);
    } catch (err) {
      console.error("Error uploading images:", err);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files) {
      handleFileChange(e.dataTransfer.files);
    }
  }, [disabled]);


  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex justify-center w-full h-64 px-4 transition bg-slate-800 border-2 ${isDragging ? 'border-sky-400' : 'border-slate-600'} border-dashed rounded-md appearance-none cursor-pointer hover:border-slate-400 focus:outline-none`}>
        <span className="flex flex-col items-center justify-center space-x-2">
          <UploadIcon className="w-12 h-12 text-slate-500"/>
          <span className="font-medium text-slate-400">
            Drop multiple scans here, or <span className="text-sky-400 underline">browse</span>
          </span>
          <span className="text-xs text-slate-500">PNG, JPG, WEBP • Batch upload supported</span>
        </span>
        <input
            type="file"
            name="file_upload"
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={(e) => handleFileChange(e.target.files)}
            disabled={disabled}
            multiple
        />
      </label>
    </div>
  );
};

export default ImageUploader;