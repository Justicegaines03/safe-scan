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
  Linking
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

  const toggleCamera = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open URL');
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
              {/* Results overlay */}
              <View style={styles.resultsOverlay}>
                <ScrollView 
                  contentContainerStyle={styles.overlayContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Quick Result Header */}
                  <ThemedView style={[
                    styles.quickResultCard,
                    { backgroundColor: validationResult.isSecure ? '#2E7D32' : '#D32F2F' }
                  ]}>
                    <ThemedText type="title" style={styles.quickResultTitle}>
                      {validationResult.isSecure ? 'SAFE TO PROCEED' : 'BLOCKED - UNSAFE'}
                    </ThemedText>
                    <ThemedText style={styles.quickConfidence}>
                      {Math.round(validationResult.confidence * 100)}% confidence
                    </ThemedText>
                  </ThemedView>

                  {/* Swipe Gesture Area */}
                  <PanGestureHandler onGestureEvent={handleSwipeGesture}>
                    <Animated.View style={[styles.swipeContainer, animatedStyle]}>
                      <ThemedView style={styles.swipeCard}>
                        <ThemedView style={styles.swipeInstructions}>
                        </ThemedView>

                        {/* App Rating and Community */}
                        {isQuickSafe ? (
                          <>
                            {validationResult.virusTotal && (
                              <ThemedView style={styles.quickDetailCard}>
                                <ThemedText style={styles.detailTitle}>App Rating</ThemedText>
                                <ThemedText style={styles.detailValue}>
                                  {validationResult.virusTotal.positives === 0 ? 'Clean' : `${validationResult.virusTotal.positives} threats detected`}
                                </ThemedText>
                              </ThemedView>
                            )}

                            <ThemedView style={styles.quickDetailCard}>
                              <ThemedText style={styles.detailTitle}>Community Rating</ThemedText>
                              <ThemedText style={styles.detailValue}>
                                {validationResult.community?.totalVotes === 0 ? 'No votes yet' : `${validationResult.community?.safeVotes || 0} safe votes`}
                              </ThemedText>
                            </ThemedView>
                          </>
                        ) : (
                          <ThemedView style={styles.warningBox}>
                            <ThemedText style={styles.warningTitle}>⚠️ SECURITY WARNING</ThemedText>
                            <ThemedText style={styles.warningSubtext}>
                              This QR code may be unsafe. Swipe left to acknowledge risk and continue scanning.
                            </ThemedText>
                          </ThemedView>
                        )}

                        {/* Visual swipe indicators */}
                        <ThemedView style={styles.swipeIndicators}>
                          <View style={[styles.swipeIndicator, styles.leftIndicator]}>
                            <Text style={styles.indicatorText}>← SCAN</Text>
                          </View>
                          <View style={[styles.swipeIndicator, styles.rightIndicator]}>
                            <Text style={styles.indicatorText}>OPEN →</Text>
                          </View>
                        </ThemedView>
                      </ThemedView>
                    </Animated.View>
                  </PanGestureHandler>
                </ScrollView>
              </View>
            </CameraView>
          </View>

          {/* Keep controls visible */}
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
          </ThemedView>

          {/* Manual input modal */}
          <Modal
            visible={showManualInput}
            transparent
            animationType="slide"
            onRequestClose={() => setShowManualInput(false)}
          >
            <View style={styles.modalOverlay}>
              <ThemedView style={styles.modalContent}>
                <ThemedText type="subtitle" style={styles.modalTitle}>
                  Enter URL Manually
                </ThemedText>
                <TextInput
                  style={[styles.textInput, { borderColor: colors.tabIconDefault, color: colors.text }]}
                  placeholder="Enter URL to validate..."
                  placeholderTextColor={colors.tabIconDefault}
                  value={manualUrl}
                  onChangeText={setManualUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => setShowManualInput(false)}
                  >
                    <Text style={[styles.buttonText, { color: colors.tint }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.tint }]}
                    onPress={handleManualInput}
                  >
                    <Text style={styles.buttonText}>Validate</Text>
                  </TouchableOpacity>
                </View>
              </ThemedView>
            </View>
          </Modal>
        </ThemedView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemedView style={styles.container}>
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
        </ThemedView>

        {isValidating && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#00E676" />
            <ThemedText style={styles.loadingText}>⚡ Analyzing QR code...</ThemedText>
            <ThemedText style={[styles.loadingText, { fontSize: 14, marginTop: 4, opacity: 0.8 }]}>
              Checking with security databases
            </ThemedText>
          </View>
        )}

        <Modal
          visible={showManualInput}
          transparent
          animationType="slide"
          onRequestClose={() => setShowManualInput(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Enter URL Manually
              </ThemedText>
              <TextInput
                style={[styles.textInput, { borderColor: colors.tabIconDefault, color: colors.text }]}
                placeholder="Enter URL to validate..."
                placeholderTextColor={colors.tabIconDefault}
                value={manualUrl}
                onChangeText={setManualUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => setShowManualInput(false)}
                >
                  <Text style={[styles.buttonText, { color: colors.tint }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: colors.tint }]}
                  onPress={handleManualInput}
                >
                  <Text style={styles.buttonText}>Validate</Text>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </Modal>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
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
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12, // Increased elevation for better visibility
  },
  quickResultTitle: {
    color: '#fff',
    fontSize: 20,
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Semi-transparent dark overlay
    justifyContent: 'center',
  },
  overlayContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60, // Account for status bar
    paddingBottom: 20,
  },
});

