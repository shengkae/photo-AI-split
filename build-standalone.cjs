const fs = require('fs');

const appTsx = fs.readFileSync('App.tsx', 'utf-8');
const geminiServiceTs = fs.readFileSync('services/geminiService.ts', 'utf-8');
const typesTs = fs.readFileSync('types.ts', 'utf-8');
const iconsTsx = fs.readFileSync('components/Icons.tsx', 'utf-8');
const spinnerTsx = fs.readFileSync('components/Spinner.tsx', 'utf-8');
const imageUploaderTsx = fs.readFileSync('components/ImageUploader.tsx', 'utf-8');
const photoDisplayTsx = fs.readFileSync('components/PhotoDisplay.tsx', 'utf-8');
const splitPhotoGalleryTsx = fs.readFileSync('components/SplitPhotoGallery.tsx', 'utf-8');

function stripImports(code) {
  return code
    .replace(/^import\s+.*?;\s*$/gm, '')
    .replace(/^export\s+default\s+.*?;\s*$/gm, '')
    .replace(/^export\s+/gm, '');
}

const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photo Splitter AI - Single File Standalone</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19",
      "react-dom/client": "https://esm.sh/react-dom@19/client"
    }
  }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="bg-slate-900 text-slate-200 min-h-screen selection:bg-sky-500/30">
  <div id="root"></div>

  <script type="text/babel" data-type="module" data-presets="react,typescript">
    import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
    import ReactDOM from 'react-dom/client';

    // --- Types ---
    ${stripImports(typesTs)}

    // --- Services ---
    ${stripImports(geminiServiceTs)}

    // --- Icons ---
    ${stripImports(iconsTsx).replace(/const\s+(\w+Icon)\s*=/g, 'const $1 =')}
    
    // --- Spinner ---
    ${stripImports(spinnerTsx)}

    // --- Components ---
    ${stripImports(imageUploaderTsx)}
    ${stripImports(photoDisplayTsx)}
    ${stripImports(splitPhotoGalleryTsx)}

    // --- App ---
    ${stripImports(appTsx)}

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
`;

fs.writeFileSync('github-export/index.html', htmlTemplate);
console.log('Successfully wrote github-export/index.html');
