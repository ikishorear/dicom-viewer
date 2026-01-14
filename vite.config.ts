import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import { resolve } from 'path';
import { readdirSync, statSync, existsSync, createReadStream } from 'fs';
import type { Plugin } from 'vite';

// Vite plugin to serve DICOM files
function dicomServerPlugin(): Plugin {
  return {
    name: 'dicom-server',
    configureServer(server) {
      const dicomsPath = resolve(process.cwd(), 'dicoms');
      
      // Serve dicoms folder - handle manifest, directory listing, and individual files
      // This runs before Vite's history API fallback
      server.middlewares.use('/dicoms', (req, res, next) => {
        try {
          console.log(`[DICOM Middleware] Request: ${req.url}`);
          
          if (!existsSync(dicomsPath)) {
            res.statusCode = 404;
            return res.end('dicoms directory not found');
          }

          // Handle manifest.json request
          if (req.url === '/manifest.json' || req.url === '/dicoms/manifest.json') {
            try {
              const series: Array<{ seriesId: string; imageIds: string[] }> = [];
              const entries = readdirSync(dicomsPath, { withFileTypes: true });
              
              // First, check for root-level DICOM files
              const rootFiles = entries
                .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.dcm'))
                .map(f => `wadouri:/dicoms/${f.name}`);
              
              if (rootFiles.length > 0) {
                series.push({
                  seriesId: 'root',
                  imageIds: rootFiles
                });
                console.log(`Added root series with ${rootFiles.length} files`);
              }
              
              // Then process directories
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const seriesPath = resolve(dicomsPath, entry.name);
                  const files = readdirSync(seriesPath);
                  const dcmFiles = files
                    .filter(f => f.toLowerCase().endsWith('.dcm'))
                    .map(f => `wadouri:/dicoms/${entry.name}/${f}`);
                  
                  if (dcmFiles.length > 0) {
                    series.push({
                      seriesId: entry.name,
                      imageIds: dcmFiles
                    });
                    console.log(`Added series ${entry.name} with ${dcmFiles.length} files`);
                  }
                }
              }
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.end(JSON.stringify({ series }, null, 2));
            } catch (err) {
              console.error('Error generating manifest:', err);
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: 'Failed to generate manifest' }));
            }
          }

          // Handle root directory listing
          // req.url will be relative to /dicoms, so '/' means /dicoms/
          if (req.url === '/' || req.url === '' || req.url === '/dicoms/') {
            console.log(`[DICOM Middleware] Serving root directory listing`);
            const entries = readdirSync(dicomsPath, { withFileTypes: true });
            const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
            const files = entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.dcm')).map(e => e.name);
            
            console.log(`[DICOM Middleware] Found ${dirs.length} directories and ${files.length} root files`);
            
            const html = `
              <!DOCTYPE html>
              <html>
              <head><title>DICOM Series</title></head>
              <body>
                <h1>DICOM Series</h1>
                <h2>Series Folders:</h2>
                <ul>
                  ${dirs.map(d => `<li><a href="/dicoms/${d}/">${d}</a></li>`).join('\n')}
                </ul>
                ${files.length > 0 ? `<h2>Root Files:</h2><ul>${files.map(f => `<li><a href="/dicoms/${f}">${f}</a></li>`).join('\n')}</ul>` : ''}
              </body>
              </html>
            `;
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(html);
          }

          // Handle series subfolder listing
          const urlParts = req.url?.split('/').filter(p => p) || [];
          if (urlParts.length === 1 && !urlParts[0].endsWith('.dcm')) {
            // Series folder listing
            const seriesName = urlParts[0];
            const seriesPath = resolve(dicomsPath, seriesName);
            
            if (!existsSync(seriesPath) || !statSync(seriesPath).isDirectory()) {
              res.statusCode = 404;
              return res.end(`Series not found: ${seriesName}`);
            }
            
            const files = readdirSync(seriesPath);
            const dcmFiles = files.filter(f => f.toLowerCase().endsWith('.dcm')).sort();
            
            console.log(`Serving series ${seriesName} with ${dcmFiles.length} DICOM files`);
            
            const html = `
              <!DOCTYPE html>
              <html>
              <head><title>${seriesName}</title></head>
              <body>
                <h1>Series: ${seriesName}</h1>
                <p>Found ${dcmFiles.length} DICOM files</p>
                <ul>
                  ${dcmFiles.map(f => `<li><a href="/dicoms/${seriesName}/${f}">${f}</a></li>`).join('\n')}
                </ul>
              </body>
              </html>
            `;
            res.setHeader('Content-Type', 'text/html');
            return res.end(html);
          }

          // Handle individual file request (can be in subfolder or root)
          // req.url is relative to /dicoms, so remove leading / if present
          const urlPath = req.url?.replace(/^\//, '') || '';
          const filePath = resolve(dicomsPath, urlPath);
          
          console.log(`[DICOM Middleware] File request - urlPath: ${urlPath}, filePath: ${filePath}`);
          
          // Security check: ensure file is within dicoms directory
          const normalizedDicomsPath = resolve(dicomsPath);
          const normalizedFilePath = resolve(filePath);
          
          if (!normalizedFilePath.startsWith(normalizedDicomsPath)) {
            console.log(`[DICOM Middleware] Security check failed: ${normalizedFilePath} not in ${normalizedDicomsPath}`);
            res.statusCode = 403;
            return res.end('Forbidden');
          }

          // Try to serve the file
          if (existsSync(filePath)) {
            const stats = statSync(filePath);
            if (stats.isFile()) {
              console.log(`[DICOM Middleware] Serving file: ${urlPath} (${stats.size} bytes)`);
              res.setHeader('Content-Type', 'application/dicom');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Content-Length', stats.size.toString());
              
              try {
                const fileStream = createReadStream(filePath);
                fileStream.on('error', (err) => {
                  console.error(`[DICOM Middleware] Stream error for ${urlPath}:`, err);
                  if (!res.headersSent) {
                    res.statusCode = 500;
                    res.end('Error reading file');
                  }
                });
                fileStream.pipe(res);
                return; // Don't call next() - we're handling the response
              } catch (streamError) {
                console.error(`[DICOM Middleware] Error creating stream for ${urlPath}:`, streamError);
                res.statusCode = 500;
                return res.end('Error reading file');
              }
            } else {
              console.log(`[DICOM Middleware] Path exists but is not a file: ${urlPath}`);
              res.statusCode = 404;
              return res.end('Not a file');
            }
          } else {
            console.log(`[DICOM Middleware] File not found: ${urlPath} (resolved to: ${filePath})`);
            res.statusCode = 404;
            return res.end('File not found');
          }
        } catch (error) {
          console.error('[DICOM Middleware] Error:', error);
          res.statusCode = 500;
          res.end('Internal server error');
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [dicomServerPlugin(), react(), tailwindcss(), viteCommonjs()  ],
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
    include: ['dicom-parser']
  },
  worker : {
    format: 'es',
  },
  server: {
    fs: {
      // Allow serving files from the project root
      allow: ['..']
    }
  }
})
