# DICOM Viewer Mobile App

React Native mobile application using Expo that displays the DICOM viewer in a WebView.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure your web DICOM viewer is running:
   - Navigate to the parent directory: `cd ..`
   - Start the web app: `npm run dev`
   - The web app should be running on `http://localhost:5173` (or your configured port)

3. Update the URL in `App.tsx` if your web viewer is running on a different port or URL.

## Running the App

### Development

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS (requires macOS)
npm run ios

# Run on Web
npm run web
```

### Production

For production, update the `WEB_VIEWER_URL` in `App.tsx` to point to your deployed web application URL.

## Configuration

- The app uses a WebView to load the web-based DICOM viewer
- Landscape orientation is enabled for better viewing experience
- Fullscreen mode is configured for optimal DICOM image viewing
- The app automatically detects the platform and uses the correct localhost address:
  - Android emulator: `http://10.0.2.2:5173`
  - iOS simulator: `http://localhost:5173`
  - Web: `http://localhost:5173`

## Important Notes

### Local Development

- **Android Emulator**: The app automatically uses `10.0.2.2` which maps to `localhost` on your development machine
- **iOS Simulator**: Uses `localhost` directly
- **Physical Devices**: You'll need to use your computer's local IP address (e.g., `http://192.168.1.100:5173`)

### Finding Your Local IP Address

To use the app on a physical device during development:

1. Find your computer's local IP address:
   - **Mac/Linux**: Run `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - **Windows**: Run `ipconfig` and look for IPv4 Address

2. Update `App.tsx` to use your IP address:
   ```typescript
   const WEB_VIEWER_URL = 'http://YOUR_IP_ADDRESS:5173';
   ```

3. Make sure your web dev server allows connections from your network (check Vite config if needed)

### Production Deployment

For production, deploy your web DICOM viewer and update the `WEB_VIEWER_URL` in `App.tsx` to the production URL.

## Troubleshooting

- **WebView not loading**: Make sure the web app is running and accessible
- **Connection refused**: Check that the port matches and firewall isn't blocking
- **Blank screen**: Check the console logs for WebView errors
- **Android emulator issues**: Ensure you're using `10.0.2.2` instead of `localhost`
