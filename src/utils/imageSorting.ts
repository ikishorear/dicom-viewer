import * as cornerstone from '@cornerstonejs/core';

/**
 * Sort imageIds by InstanceNumber or ImagePositionPatient[2]
 */
export const sortImageIds = async (imageIds: string[]): Promise<string[]> => {
  if (imageIds.length === 0) return imageIds;

  try {
    const imageMetadata = await Promise.all(
      imageIds.map(async (imageId, index) => {
        try {
          const image = await cornerstone.imageLoader.loadImage(imageId);
          const metadata = (image as any).data || {};
          
          let sortValue: number | null = null;
          
          if (metadata.instanceNumber !== undefined && metadata.instanceNumber !== null) {
            sortValue = Number(metadata.instanceNumber);
          } else if (metadata.imagePositionPatient && Array.isArray(metadata.imagePositionPatient) && metadata.imagePositionPatient.length >= 3) {
            sortValue = Number(metadata.imagePositionPatient[2]);
          } else {
            sortValue = index;
          }

          if (isNaN(sortValue) || sortValue === null) {
            sortValue = index;
          }

          return { imageId, sortValue };
        } catch (err) {
          return { imageId, sortValue: index };
        }
      })
    );

    imageMetadata.sort((a, b) => {
      if (a.sortValue === null && b.sortValue === null) return 0;
      if (a.sortValue === null) return 1;
      if (b.sortValue === null) return -1;
      return a.sortValue - b.sortValue;
    });

    return imageMetadata.map(m => m.imageId);
  } catch (error) {
    console.warn('Error sorting images, using original order:', error);
    return imageIds;
  }
};
