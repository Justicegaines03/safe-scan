import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Alert, 
  Dimensions, 
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Linking,
  Image
} from 'react-native';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  runOnJS 
} from 'react-native-reanimated';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from 'expo-symbols';

// Types
interface QRScanResult {
  data: string;
  type: string;
  timestamp: number;
}

interface VirusTotalResult {
  isSecure: boolean;
  positives: number;
  total: number;
  scanId: string;
  permalink: string;
}

interface CommunityRating {
  safeVotes: number;
  unsafeVotes: number;
  totalVotes: number;
  confidence: number;
}

interface ValidationResult {
  url: string;
  isSecure: boolean;
  virusTotal?: VirusTotalResult;
  community?: CommunityRating;
  confidence: number;
  warning?: string;
}

/**
 * QR Code Scanner with Security Validation
 * 
 * Icon Size Configuration:
 * - To change icon sizes, modify the 'iconSize' and 'largeIconSize' values in the styles
 * - iconSize.fontSize controls small icons (shield, person)
 * - largeIconSize.fontSize controls action button icons
 */

const { width, height } = Dimensions.get('window');

export default function CameraScannerScreen() {
  const colorScheme = useColorScheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [isScanning, setIsScanning] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const scanCooldown = useRef(500); // Reduced from 2000ms to 500ms for faster scanning

  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Mock VirusTotal API validation (replace with actual API)
  const validateWithVirusTotal = async (url: string): Promise<VirusTotalResult> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock response - in real implementation, use actual VirusTotal API
        const mockResult: VirusTotalResult = {
          isSecure: !url.includes('malicious') && !url.includes('suspicious'),
          positives: url.includes('malicious') ? 15 : 0,
          total: 70,
          scanId: `scan-${Date.now()}`,
          permalink: `https://virustotal.com/gui/url/${btoa(url)}`
        };
        resolve(mockResult);
      }, 300); // Reduced from 1500ms to 300ms
    });
  };

  // Mock Community Rating (replace with actual backend)
  const getCommunityRating = async (url: string): Promise<CommunityRating> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Show "No votes yet" for new URLs
        resolve({
          safeVotes: 0,
          unsafeVotes: 0,
          totalVotes: 0,
          confidence: 0.5
        });
      }, 150); // Reduced from 800ms to 150ms
    });
  };

  const validateUrl = async (url: string): Promise<ValidationResult> => {
    try {
      setIsValidating(true);

      // Validate URL format
      let processedUrl = url.trim();
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        if (processedUrl.startsWith('www.')) {
          processedUrl = `https://${processedUrl}`;
        } else if (!processedUrl.includes('://')) {
          // Could be a domain, try adding https
          processedUrl = `https://${processedUrl}`;
        }
      }

      // Check for dangerous protocols
      const dangerousProtocols = ['javascript:', 'data:', 'file:', 'ftp:'];
      const urlObj = new URL(processedUrl);
      
      if (dangerousProtocols.some(protocol => urlObj.protocol.startsWith(protocol))) {
        return {
          url: processedUrl,
          isSecure: false,
          confidence: 0,
          warning: 'Blocked dangerous protocol'
        };
      }

      // Run both validations in parallel
      const [virusTotalResult, communityResult] = await Promise.all([
        validateWithVirusTotal(processedUrl).catch(() => null),
        getCommunityRating(processedUrl).catch(() => null)
      ]);

      // Calculate final security assessment
      let isSecure = true;
      let confidence = 0.5;
      let warning: string | undefined;

      if (virusTotalResult) {
        isSecure = virusTotalResult.isSecure;
        confidence = virusTotalResult.isSecure ? 0.9 : 0.1;
      }

      if (communityResult && communityResult.totalVotes >= 3) {
        const communityConfidence = communityResult.confidence;
        if (!virusTotalResult) {
          // Use community rating if VirusTotal unavailable
          isSecure = communityConfidence > 0.6;
          confidence = communityConfidence;
        } else {
          // Combine both scores, giving VirusTotal priority
          confidence = (confidence * 0.7) + (communityConfidence * 0.3);
        }
      }

      if (confidence < 0.6) {
        warning = 'Low confidence rating - proceed with caution';
      }

      return {
        url: processedUrl,
        isSecure,
        virusTotal: virusTotalResult || undefined,
        community: communityResult || undefined,
        confidence,
        warning
      };

    } catch (error) {
      console.error('URL validation error:', error);
      return {
        url,
        isSecure: false,
        confidence: 0,
        warning: 'Invalid URL format'
      };
    } finally {
      setIsValidating(false);
    }
  };

  const handleQRCodeScanned = async ({ data }: { data: string }) => {
    const now = Date.now();
    
    // Prevent duplicate scans within cooldown period
    if (now - lastScanTime < scanCooldown.current) {
      return;
    }

    setLastScanTime(now);
    setIsScanning(false);
    setScanCount(prev => prev + 1);

    // Handle empty or null data
    if (!data || data.trim().length === 0) {
      Alert.alert('Error', 'Empty QR code detected');
      setIsScanning(true);
      return;
    }

    // Truncate very long data
    const truncatedData = data.length > 2048 ? data.substring(0, 2048) : data;

    try {
      const result = await validateUrl(truncatedData);
      setValidationResult(result);
    } catch (error) {
      console.error('Scan processing error:', error);
      Alert.alert('Error', 'Failed to process QR code');
      setIsScanning(true);
    }
  };

  const handleManualInput = async () => {
    if (!manualUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    setShowManualInput(false);
    const result = await validateUrl(manualUrl);
    setValidationResult(result);
    setManualUrl('');
  };

  const resetScanner = () => {
    setValidationResult(null);
    setIsScanning(true);
  };

  const testOpenLink = () => {
    const testUrl = 'https://www.google.com';
    console.log('Testing with known good URL:', testUrl);
    openLink(testUrl);
  };

  const toggleCamera = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  const openLink = async (url: string) => {
    try {
      console.log('Attempting to open URL:', url);
      
      // Validate URL format first
      if (!url || typeof url !== 'string') {
        console.error('Invalid URL provided:', url);
        Alert.alert('Error', 'Invalid URL provided');
        return;
      }

      // Ensure URL has a proper protocol
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
        console.log('Added https protocol, new URL:', formattedUrl);
      }

      console.log('Checking if URL can be opened:', formattedUrl);
      const supported = await Linking.canOpenURL(formattedUrl);
      console.log('URL supported:', supported);
      
      if (supported) {
        console.log('Opening URL...');
        await Linking.openURL(formattedUrl);
        console.log('URL opened successfully');
      } else {
        console.error('URL not supported by device:', formattedUrl);
        Alert.alert('Error', `Cannot open this URL: ${formattedUrl}\n\nThis URL format may not be supported on your device.`);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to open URL: ${errorMessage}`);
    }
  };

  const translateX = useSharedValue(0);
  const swipeThreshold = 100;

  const handleSwipeGesture = (event: any) => {
    'worklet';
    const { translationX, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      translateX.value = translationX;
    } else if (state === State.END) {
      if (translationX > swipeThreshold) {
        // Swipe right - Open link
        translateX.value = withSpring(0);
        if (validationResult) {
          runOnJS(openLink)(validationResult.url);
        }
      } else if (translationX < -swipeThreshold) {
        // Swipe left - Continue scanning (acknowledge risk)
        translateX.value = withSpring(0);
        runOnJS(handleSwipeLeftAcknowledge)();
      } else {
        // Snap back to center
        translateX.value = withSpring(0);
      }
    }
  };

  const handleSwipeLeftAcknowledge = () => {
    if (!validationResult?.isSecure) {
      Alert.alert(
        'Security Risk Acknowledged',
        'You have acknowledged the security risk and chosen not to proceed with this QR code.',
        [{ text: 'OK', onPress: resetScanner }]
      );
    } else {
      resetScanner();
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText>Loading camera permissions...</ThemedText>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.permissionContainer}>
          <ThemedText type="title" style={styles.permissionTitle}>
            Camera Permission Required
          </ThemedText>
          <ThemedText style={styles.permissionText}>
            SafeScan needs camera access to scan QR codes and validate URLs for your security.
          </ThemedText>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.tint }]} 
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={() => setShowManualInput(true)}
          >
            <Text style={[styles.buttonText, { color: colors.tint }]}>Enter URL Manually</Text>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  }

  if (validationResult) {
    const isQuickSafe = validationResult.isSecure && validationResult.confidence > 0.8;
    
    return (
      <GestureHandlerRootView style={styles.container}>
        <ThemedView style={styles.container}>
          {/* Header with logo and settings */}
          <View style={styles.headerContainer}>
            <View style={styles.logoTextContainer}>
              <Image 
              source={require('@/assets/images/Icon-Light.png')}
              style={styles.logoImage}
              resizeMode="contain"
              />
              <Text style={[styles.logoText, { marginLeft: 2 }]}>SafeScan</Text>
            </View>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => {
                // Add settings functionality here
                console.log('Settings pressed');
              }}
            >
              <SymbolView 
                name="gear" 
                size={35}
                tintColor="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>

          {/* Camera background */}
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing={cameraType}
              onBarcodeScanned={undefined} // Disable scanning while showing results
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
            >
              {/* Camera darkening overlay */}
              <View style={styles.cameraDarkenOverlay} />
              
              {/* Results overlay */}
              <View style={styles.resultsOverlay}>
                <ThemedView style={styles.overlayContent}>
                  {/* App Rating */}
                  {isQuickSafe ? (
                  <>
                  {validationResult.virusTotal && (
                    <ThemedView style={[
                    styles.quickDetailCard,
                    { backgroundColor: validationResult.virusTotal.positives === 0 ? '#2E7D32' : '#C62828', padding: 6, borderRadius: 20, marginBottom: 8}
                    ]}>
                    <SymbolView  
                    name="shield.checkered" 
                    size={styles.iconSize.fontSize} 
                    tintColor="#FFFFFF" 
                    />
                    <ThemedText style={[
                    styles.detailTitle,
                    { color: '#FFFFFF' }
                    ]}>
                    {validationResult.virusTotal.positives === 0 ? ' Clean' : ` Threat`}
                    </ThemedText>
                    </ThemedView>
                    )}

                  {/* Safe or Unsafe */}
                  <ThemedText type="title" style={[styles.quickResultTitle, { backgroundColor: 'transparent', fontSize: 28 },]}>
                  {validationResult.isSecure ? 'Safe' : 'Unsafe'}
                  </ThemedText>

                  {/* Community Rating */}
                  <ThemedView style={[styles.quickDetailCard, { backgroundColor: 'transparent', padding: 0 }]}>
                  <SymbolView 
                  name="person.3" 
                  size={styles.iconSize.fontSize + 7} 
                  tintColor="#FFFFFF" 
                  />
                  <ThemedText style={[
                  styles.detailTitle,
                  { color: '#FFFFFF' }
                  ]}>
                  {validationResult.community?.totalVotes === 0 ? '  No votes yet' : `  ${validationResult.community?.safeVotes || 0} safe votes`}
                  </ThemedText>
                  </ThemedView>
                  </>
                  ) : (
                  <ThemedView style={styles.warningBox}>
                  <ThemedText style={styles.warningTitle}>⚠️ SECURITY WARNING</ThemedText>
                  <ThemedText style={styles.warningSubtext}>
                    This QR code may be unsafe. Tap to continue scanning.
                  </ThemedText>
                  </ThemedView>
                  )}
                </ThemedView>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={resetScanner}>
                  <SymbolView 
                  name="xmark" 
                  size={styles.iconSize.fontSize}
                  tintColor="#FF0000" 
                  />
                  <Text style={styles.actionButtonText}>Scan New</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => {
                    console.log('Open button pressed');
                    console.log('validationResult:', validationResult);
                    console.log('URL to open:', validationResult?.url);
                    if (validationResult?.url) {
                      openLink(validationResult.url);
                    } else {
                      console.error('No URL available in validationResult');
                      Alert.alert('Error', 'No URL available to open');
                    }
                  }}
                >
                  <SymbolView 
                  name="arrow.up.forward" 
                  size={styles.largeIconSize.fontSize}
                  tintColor="#00AA00" 
                  />
                  <Text style={styles.actionButtonText}>Open</Text>
                </TouchableOpacity>
              </View>

              {isValidating && (
                <View style={styles.cameraLoadingOverlay}>
                  <ActivityIndicator size="large" color="#00E676" />
                  <ThemedText style={styles.loadingText}>⚡ Analyzing QR code...</ThemedText>
                  <ThemedText style={[styles.loadingText, { fontSize: 14, marginTop: 4, opacity: 0.8 }]}>
                    Checking with security databases
                  </ThemedText>
                </View>
              )}
            </CameraView>
          </View>
        </ThemedView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemedView style={styles.container}>
        {/* Header with logo and settings */}
        <View style={styles.headerContainer}>
          <View style={styles.logoTextContainer}>
            <Image 
              source={require('@/assets/images/Icon-Light.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>SafeScan</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {
              // Add settings functionality here
              console.log('Settings pressed');
            }}
          >
            <SymbolView 
              name="gear" 
              size={24}
              tintColor="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={cameraType}
            onBarcodeScanned={isScanning ? handleQRCodeScanned : undefined}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
              <ThemedText style={styles.scanText}>
                Point camera at QR code
              </ThemedText>
              <ThemedText style={[styles.scanText, { fontSize: 14, marginTop: 8, opacity: 0.8 }]}>
              </ThemedText>
            </View>

            {isValidating && (
              <View style={styles.cameraLoadingOverlay}>
                <ActivityIndicator size="large" color="#00E676" />
                <ThemedText style={styles.loadingText}>⚡ Analyzing QR code...</ThemedText>
                <ThemedText style={[styles.loadingText, { fontSize: 14, marginTop: 4, opacity: 0.8 }]}>
                  Checking with security databases
                </ThemedText>
              </View>
            )}
          </CameraView>
        </View>

        <ThemedView style={styles.controlsContainer}>
          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: colors.tint }]}
            onPress={toggleCamera}
          >
            <Text style={styles.buttonText}>Flip Camera</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={() => setShowManualInput(true)}
          >
            <Text style={[styles.buttonText, { color: colors.tint }]}>Manual Input</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: '#4CAF50' }]}
            onPress={testOpenLink}
          >
            <Text style={styles.buttonText}>Test Link</Text>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 65 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10, // Ensure it's above everything
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 40,
    height: 40,
  },

  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fffb00',
    marginLeft: 8,
  },

  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    
  },
  iconSize: {
    fontSize: 20, // Changed from 18 to 20 - you can adjust this value
  },
  largeIconSize: {
    fontSize: 28, // Changed from 24 to 28 - you can adjust this value
  },
  cameraContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 115 : 75, // Reduced padding to bring camera closer to header
    backgroundColor: '#007031', // Changed to green
    },
    camera: {
    flex: 1,
    },
    cameraDarkenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent dark overlay
    zIndex: 1, // Ensure it's above the camera but below other overlays
    pointerEvents: 'none', // Allow touch events to pass through
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#00E676',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanText: {
    marginTop: 20,
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 0, // Remove all padding
    paddingVertical: 12, // Add minimal vertical padding only
    paddingHorizontal: 16, // Keep horizontal padding for button spacing
    paddingBottom: Platform.OS === 'ios' ? 20 : 12, // Minimal bottom padding for safe area
  },
  controlButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    minHeight: height - 100, // Ensure full height minus some padding
  },
  
  // New optimized styles for college students
  quickResultCard: {
    padding: 0.1, // Reduced from 24
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12, // Increased elevation for better visibility
    width: '35%', // Make it wider
  },
  quickResultTitle: {
    color: '#fff',
    fontSize: 12, // Reduced from 20
    fontWeight: 'bold',
    textAlign: 'center',
  },
  quickConfidence: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  quickActionContainer: {
    marginBottom: 20,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    padding: 16,
    backgroundColor: 'rgba(255, 243, 224, 0.95)', // Semi-transparent warning background
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 14,
    color: '#BF360C',
    lineHeight: 20,
  },
  statsContainer: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  urlPreview: {
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    marginBottom: 20,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  urlValue: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333',
    lineHeight: 20,
  },
  detailsSection: {
    marginTop: 8,
  },
  detailsHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 12,
  },
  quickDetailCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(248, 249, 250, 0.9)', // Semi-transparent background
    borderRadius: 8,
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
  },
  
  // Legacy styles (keeping for compatibility)
  resultCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  confidenceText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
  },
  urlContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
  },
  urlText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  warningContainer: {
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
  },
  detailCard: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 4,
  },
  actionContainer: {
    marginTop: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    padding: 20,
    borderRadius: 12,
    maxWidth: 400,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swipeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  swipeCard: {
    width: '90%',
    backgroundColor: 'rgba(248, 249, 250, 0.95)', // Semi-transparent background
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backdropFilter: 'blur(10px)', // For iOS blur effect
  },
  swipeInstructions: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
  },
  swipeInstructionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    textAlign: 'center',
    marginVertical: 2,
  },
  swipeIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  swipeIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    opacity: 0.6,
  },
  leftIndicator: {
    backgroundColor: '#FF9800',
  },
  rightIndicator: {
    backgroundColor: '#4CAF50',
  },
  indicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultsOverlay: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    backgroundColor: 'transparent', // Remove dark background
    zIndex: 3, // Ensure it's above the camera darkening overlay
  },
  overlayContent: { 
    alignItems: 'flex-start',
    padding: 16,
    paddingLeft: 20,
    backgroundColor: 'transparent', // Remove background color
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    zIndex: 3, // Ensure it's above the camera darkening overlay
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333333',
    marginTop: 2, // Add small margin between icon and text
  },
  actionButtonIconGreen: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00AA00',
    marginBottom: 2,
  },
  cameraLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2, // Ensure it's above the camera overlay but below other elements
  },
});
