# Building APK for DICOM Viewer Mobile App

This guide will help you build an APK file for your React Native Expo app.

## Prerequisites

1. **Expo Account**: Create a free account at [expo.dev](https://expo.dev)
2. **Node.js**: Make sure you have Node.js installed
3. **EAS CLI**: We'll install this in the next step

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

Enter your Expo account credentials when prompted.

## Step 3: Configure EAS (if needed)

If this is your first time using EAS, you may need to initialize it:

```bash
eas build:configure
```

## Step 4: Build the APK

### Option A: Build APK for Testing (Recommended for first build)

```bash
npm run build:android
```

This will:
- Build an APK file
- Upload it to Expo's servers
- Give you a download link when complete

### Option B: Build Production APK

```bash
npm run build:android:prod
```

## Step 5: Download Your APK

After the build completes:

1. You'll see a URL in the terminal (e.g., `https://expo.dev/...`)
2. Open the URL in your browser
3. Click "Download" to get your APK file
4. The APK will be saved to your computer

## Alternative: Local Build (Advanced)

If you want to build locally without using Expo's servers:

```bash
# Install Android build tools first
eas build --platform android --profile preview --local
```

**Note**: Local builds require:
- Android SDK installed
- Java Development Kit (JDK)
- More setup complexity

## Installing the APK

1. Transfer the APK file to your Android device
2. Enable "Install from Unknown Sources" in Android settings
3. Tap the APK file to install
4. Open the app and it will load the DICOM viewer from Vercel

## Troubleshooting

### Build fails with authentication error
- Make sure you're logged in: `eas whoami`
- If not logged in: `eas login`

### Build takes too long
- First builds can take 10-20 minutes
- Subsequent builds are usually faster

### Need to update the app
- Change the version in `app.json` (increment `versionCode` for Android)
- Run the build command again

## Build Profiles Explained

- **preview**: Builds APK for testing/internal distribution
- **production**: Builds APK optimized for production release

Both profiles are configured to build APK files (not AAB).

## Notes

- The APK file will be around 50-100MB depending on dependencies
- Builds are done on Expo's servers (cloud builds)
- You can monitor build progress at [expo.dev](https://expo.dev)
- APK files can be installed directly on Android devices without Google Play Store
