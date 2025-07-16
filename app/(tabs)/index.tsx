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
  Platform
} from 'react-native';
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
  const scanCooldown = useRef(2000); // 2 seconds cooldown between scans

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
      }, 1500);
    });
  };

  // Mock Community Rating (replace with actual backend)
  const getCommunityRating = async (url: string): Promise<CommunityRating> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock community data
        const safeVotes = Math.floor(Math.random() * 20) + 1;
        const unsafeVotes = Math.floor(Math.random() * 5);
        const totalVotes = safeVotes + unsafeVotes;
        
        resolve({
          safeVotes,
          unsafeVotes,
          totalVotes,
          confidence: totalVotes > 0 ? safeVotes / totalVotes : 0.5
        });
      }, 800);
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
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <ThemedView style={[
            styles.resultCard,
            { backgroundColor: validationResult.isSecure ? '#4CAF50' : '#f44336' }
          ]}>
            <ThemedText type="title" style={styles.resultTitle}>
              {validationResult.isSecure ? '🛡️ SECURE' : '⚠️ UNSAFE'}
            </ThemedText>
            <ThemedText style={styles.confidenceText}>
              Confidence: {Math.round(validationResult.confidence * 100)}%
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.urlContainer}>
            <ThemedText type="subtitle">Scanned URL:</ThemedText>
            <ThemedText style={styles.urlText} selectable>
              {validationResult.url}
            </ThemedText>
          </ThemedView>

          {validationResult.warning && (
            <ThemedView style={styles.warningContainer}>
              <ThemedText style={styles.warningText}>
                ⚠️ {validationResult.warning}
              </ThemedText>
            </ThemedView>
          )}

          {validationResult.virusTotal && (
            <ThemedView style={styles.detailCard}>
              <ThemedText type="subtitle">VirusTotal Analysis</ThemedText>
              <ThemedText>
                Detections: {validationResult.virusTotal.positives}/{validationResult.virusTotal.total}
              </ThemedText>
              <ThemedText style={styles.linkText} selectable>
                Report: {validationResult.virusTotal.permalink}
              </ThemedText>
            </ThemedView>
          )}

          {validationResult.community && validationResult.community.totalVotes > 0 && (
            <ThemedView style={styles.detailCard}>
              <ThemedText type="subtitle">Community Rating</ThemedText>
              <ThemedText>
                Safe votes: {validationResult.community.safeVotes}
              </ThemedText>
              <ThemedText>
                Unsafe votes: {validationResult.community.unsafeVotes}
              </ThemedText>
              <ThemedText>
                Community confidence: {Math.round(validationResult.community.confidence * 100)}%
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView style={styles.actionContainer}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.tint }]}
              onPress={resetScanner}
            >
              <Text style={styles.buttonText}>Scan Another</Text>
            </TouchableOpacity>
            
            {validationResult.isSecure && (
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  // Here you could open the URL in a secure browser
                  Alert.alert('Safe URL', 'This URL appears to be safe. You can proceed with caution.');
                }}
              >
                <Text style={[styles.buttonText, { color: colors.tint }]}>Open URL</Text>
              </TouchableOpacity>
            )}
          </ThemedView>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
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
              Position QR code within the frame
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
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>Validating URL...</ThemedText>
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
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanText: {
    marginTop: 20,
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  controlButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
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
    padding: 20,
  },
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
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
});
