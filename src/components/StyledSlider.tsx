import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';

// Styled Material UI Slider with white track
export const WhiteSlider = styled(Slider)(() => ({
  color: '#ffffff',
  height: 8,
  '& .MuiSlider-track': {
    border: 'none',
    backgroundColor: '#ffffff',
  },
  '& .MuiSlider-thumb': {
    width: 20,
    height: 20,
    backgroundColor: '#ffffff',
    border: '2px solid #3b82f6',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
    '&:hover': {
      boxShadow: '0 3px 8px rgba(0, 0, 0, 0.6)',
    },
    '&.Mui-active': {
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.7)',
    },
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#4b5563',
    opacity: 1,
  },
}));

// Mobile styled slider
export const WhiteSliderMobile = styled(Slider)(() => ({
  color: '#ffffff',
  height: 12,
  '& .MuiSlider-track': {
    border: 'none',
    backgroundColor: '#ffffff',
  },
  '& .MuiSlider-thumb': {
    width: 24,
    height: 24,
    backgroundColor: '#ffffff',
    border: '3px solid #3b82f6',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
    '&:hover': {
      boxShadow: '0 3px 8px rgba(0, 0, 0, 0.6)',
    },
    '&.Mui-active': {
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.7)',
    },
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#4b5563',
    opacity: 1,
  },
}));
