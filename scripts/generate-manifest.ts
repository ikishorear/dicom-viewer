import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { writeFileSync } from 'fs';

const dicomsPath = join(process.cwd(), 'public', 'dicoms');

interface Series {
  seriesId: string;
  imageIds: string[];
}

const manifest: { series: Series[] } = { series: [] };

function scanDirectory(dir: string, basePath: string = ''): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    // Check for root-level DICOM files
    const dcmFiles = entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.dcm'))
      .map(f => `wadouri:/dicoms/${basePath}${f.name}`);
    
    if (dcmFiles.length > 0) {
      // Remove trailing slash from seriesId
      const seriesId = basePath ? basePath.replace(/\/$/, '') : 'root';
      manifest.series.push({
        seriesId: seriesId,
        imageIds: dcmFiles
      });
      console.log(`✓ Added ${seriesId} series with ${dcmFiles.length} files`);
    }
    
    // Process subdirectories
    entries
      .filter(e => e.isDirectory())
      .forEach(dirEntry => {
        const subDirPath = join(dir, dirEntry.name);
        const newBasePath = basePath ? `${basePath}${dirEntry.name}/` : `${dirEntry.name}/`;
        scanDirectory(subDirPath, newBasePath);
      });
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
}

// Check if dicoms directory exists
try {
  const stats = statSync(dicomsPath);
  if (!stats.isDirectory()) {
    console.error('Error: dicoms path exists but is not a directory');
    process.exit(1);
  }
  
  console.log('Scanning DICOM files...');
  scanDirectory(dicomsPath);
  
  const manifestPath = join(dicomsPath, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✓ Generated manifest.json with ${manifest.series.length} series`);
  console.log(`  Total image IDs: ${manifest.series.reduce((sum, s) => sum + s.imageIds.length, 0)}`);
} catch (error) {
  console.error('Error generating manifest:', error);
  process.exit(1);
}
