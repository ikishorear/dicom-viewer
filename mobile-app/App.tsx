import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Platform, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useState } from 'react';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  // Production URL - deployed on Vercel
  const PRODUCTION_URL = 'https://dicom-viewer-beta.vercel.app';
  
  // For development, use your local dev server URL
  // IMPORTANT: Make sure Vite is configured with host: '0.0.0.0' in vite.config.ts
  // For Android emulator, try 'http://10.0.2.2:5173' first, then fallback to local IP
  // For iOS simulator, 'http://localhost:5173' should work
  // For physical devices, use your computer's local IP (e.g., 'http://192.168.1.100:5173')
  
  const getWebViewerUrl = () => {
    // Always use production URL (Vercel deployment)
    return PRODUCTION_URL;
    
    // Uncomment below for local development
    // if (__DEV__) {
    //   if (Platform.OS === 'android') {
    //     // Use your actual local IP address for Android emulator
    //     // Update this IP if your network changes
    //     return 'http://172.26.215.113:5173';
    //   } else if (Platform.OS === 'ios') {
    //     return 'http://localhost:5173';
    //   } else {
    //     return 'http://localhost:5173';
    //   }
    // }
    // return PRODUCTION_URL;
  };

  const WEB_VIEWER_URL = getWebViewerUrl();

  // Inject CSS to ensure fullscreen experience
  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.textContent = \`
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        #root {
          width: 100vw;
          height: 100vh;
        }
      \`;
      document.head.appendChild(style);
      true; // Required for iOS
    })();
  `;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="light" />
      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading DICOM Viewer...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Unable to connect to the DICOM viewer.{'\n\n'}
            Current URL: {WEB_VIEWER_URL}{'\n\n'}
            Please check:{'\n'}
            1. Your internet connection{'\n'}
            2. The Vercel deployment is accessible{'\n'}
            3. Try opening the URL in a browser first
          </Text>
        </View>
      )}
      <WebView
        source={{ uri: WEB_VIEWER_URL }}
        style={[styles.webview, (loading || error) && styles.webviewHidden]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScript={injectedJavaScript}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error: ', nativeEvent);
          const errorMsg = nativeEvent.description || 'Connection error';
          setError(`Failed to load: ${errorMsg}\n\nTrying: ${WEB_VIEWER_URL}\n\nPlease check your internet connection and ensure the Vercel deployment is accessible.`);
          setLoading(false);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('HTTP error: ', nativeEvent);
          setError(`HTTP ${nativeEvent.statusCode || 'Error'}: ${nativeEvent.description || 'Failed to load'}`);
          setLoading(false);
        }}
        onLoadEnd={() => {
          console.log('WebView loaded successfully');
          setLoading(false);
          setError(null);
        }}
        onLoadStart={() => {
          setLoading(true);
          setError(null);
        }}
      />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  webviewHidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    zIndex: 1,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 20,
    zIndex: 1,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorHint: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
});
