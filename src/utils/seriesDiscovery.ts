import type { Series } from '../types';

/**
 * Discover all series from /dicoms subfolders
 */
export const discoverSeries = async (): Promise<Series[]> => {
  try {
    // Try manifest.json first
    try {
      const manifestResponse = await fetch('/dicoms/manifest.json');
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        if (manifest.series && Array.isArray(manifest.series) && manifest.series.length > 0) {
          console.log(`✓ Found ${manifest.series.length} series from manifest.json`);
          return manifest.series.map((s: any) => ({
            seriesId: s.seriesId,
            imageIds: s.imageIds || [],
            instanceCount: s.imageIds?.length || 0
          }));
        }
      }
    } catch (e) {
      console.log('Manifest.json not available, using directory listing...');
    }

    // Fallback to directory listing
    const dirResponse = await fetch('/dicoms/');
    if (!dirResponse.ok) {
      throw new Error('Could not access /dicoms directory');
    }

    const text = await dirResponse.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const links = doc.querySelectorAll('a[href]');
    
    const series: Series[] = [];
    
    // Check for root-level DICOM files
    const rootDcmLinks = doc.querySelectorAll('a[href$=".dcm"]');
    if (rootDcmLinks.length > 0) {
      const rootImageIds = Array.from(rootDcmLinks).map(link => {
        const href = link.getAttribute('href') || '';
        let fileName = href;
        if (href.startsWith('/dicoms/')) {
          fileName = href.replace('/dicoms/', '');
        } else if (href.startsWith('/')) {
          fileName = href.substring(1);
        }
        return `wadouri:/dicoms/${fileName}`;
      });
      
      if (rootImageIds.length > 0) {
        series.push({
          seriesId: 'root',
          imageIds: rootImageIds,
          instanceCount: rootImageIds.length
        });
      }
    }
    
    // Process subdirectories
    for (const link of Array.from(links)) {
      const href = link.getAttribute('href');
      if (!href) continue;
      
      if (href.endsWith('/') && href !== '/' && href !== '/dicoms/') {
        let seriesId = href.replace(/\/$/, '');
        
        if (seriesId.startsWith('/dicoms/')) {
          seriesId = seriesId.replace(/^\/dicoms\//, '');
        } else if (seriesId.startsWith('/')) {
          seriesId = seriesId.substring(1);
        }
        
        if (!seriesId || seriesId.includes('/')) {
          continue;
        }
        
        try {
          const seriesUrl = `/dicoms/${encodeURIComponent(seriesId)}/`;
          const seriesResponse = await fetch(seriesUrl);
          
          if (seriesResponse.ok) {
            const seriesText = await seriesResponse.text();
            const seriesDoc = parser.parseFromString(seriesText, 'text/html');
            const fileLinks = seriesDoc.querySelectorAll('a[href$=".dcm"]');
            
            const imageIds = Array.from(fileLinks).map(link => {
              const fileHref = link.getAttribute('href') || '';
              let fileName = fileHref;
              
              if (fileHref.startsWith('/dicoms/')) {
                const pathParts = fileHref.split('/');
                const seriesIndex = pathParts.indexOf(seriesId);
                if (seriesIndex >= 0 && seriesIndex < pathParts.length - 1) {
                  fileName = pathParts.slice(seriesIndex + 1).join('/');
                } else {
                  fileName = fileHref.replace(`/dicoms/${seriesId}/`, '');
                }
              } else if (fileHref.startsWith('/')) {
                fileName = fileHref.substring(1);
              } else {
                fileName = fileHref.split('/').pop() || fileHref;
              }
              
              return `wadouri:/dicoms/${seriesId}/${fileName}`;
            });

            if (imageIds.length > 0) {
              series.push({
                seriesId,
                imageIds,
                instanceCount: imageIds.length
              });
            }
          }
        } catch (e) {
          console.error(`Error loading series ${seriesId}:`, e);
        }
      }
    }

    return series;
  } catch (error) {
    console.error('Error discovering series:', error);
    throw error;
  }
};
