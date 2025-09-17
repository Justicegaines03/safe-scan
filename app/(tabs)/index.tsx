/**
 * QR Code Scanner with Deep Link Support
 * 
 * This component supports launching via shortcuts and deep links:
 * - safescan://scan-qr - Launches QR scanner
 * - safescan://quick-scan - Launches quick scanner mode
 * 
 * Features:
 * - iOS App Shortcuts support (configured in app.json)
 * - Android App Shortcuts support (configured in app.json)
 * - Deep link handling for both launch and running app scenarios
 * - Enhanced scanning mode when launched via shortcuts (faster response)
 * - Visual feedback when activated via shortcut
 * - Development test button (only in __DEV__ mode)
 * 
 * To test deep links in development:
 * - iOS Simulator: Use simulator menu Device > Device > URL
 * - Android Emulator: Use adb command: adb shell am start -W -a android.intent.action.VIEW -d "safescan://scan-qr" com.justicegaines03.safe-scan
 * - Use the "Test Shortcut" button (development only)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  StyleSheet, 
  View, 
  Text, 
  Alert, 
  Dimensions, 
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Platform,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from 'expo-symbols';
import Constants from 'expo-constants';
import { backendInfrastructure } from '@/services';
import { userIdentityService } from '@/services/UserIdentityService';


// Simple hash function that works in React Native for the  Web Crypto API
const hashUrl = async (url: string): Promise<string> => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

// VirusTotal API v3 expects URLs to be base64 encoded without padding
const createUrlId = (url: string): string => {
  const base64Url = btoa(url).replace(/=/g, '');
  return base64Url;
};

// Types
export interface VirusTotalResult {
  positives: number;
  total: number;
  isSecure: boolean;
  scanId: string;
  permalink: string;
}

export interface CommunityRating {
  safeVotes: number;
  totalVotes: number;
  communityConfidence: number;
}

export interface SafetyAssessment {
  virusTotal?: VirusTotalResult
  community?: CommunityRating
  safety: 'safe' | 'unsafe' | 'unknown';
}

export interface ResultsOverlay {
  virusTotal?: VirusTotalResult;
  community?: CommunityRating;
  safety?: SafetyAssessment
}

export interface ValidationResult {
  virusTotal?: VirusTotalResult
  community?: CommunityRating;
  safety?: SafetyAssessment
  url: string
}

const { width, height } = Dimensions.get('window');

export default function CameraScannerScreen() {
  const colorScheme = useColorScheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [userRating, setUserRating] = useState<'safe' | 'unsafe' | null>(null);
  const [showUserRating, setShowUserRating] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [isTabFocused, setIsTabFocused] = useState(true); // Track if this tab is focused
  const [launchedViaShortcut, setLaunchedViaShortcut] = useState(false); // Track shortcut launches
  const [cameraReady, setCameraReady] = useState(false); // Track camera initialization
  const scanCooldown = useRef(500); // Reduced from 2000ms to 500ms for faster scanning
  const isProcessing = useRef(false); // Immediate flag to prevent duplicate processing
  const isSaving = useRef(false); // Immediate flag to prevent duplicate saves
  const cameraPreloadTimer = useRef<NodeJS.Timeout | null>(null); // Camera preload timer

  const colors = Colors[colorScheme ?? 'light'];

  // Optimized camera props to prevent unnecessary re-renders
  const scanningCameraProps = useCallback(() => ({
    style: styles.camera,
    facing: 'back' as const,
    onBarcodeScanned: (isScanning && isTabFocused && cameraReady) ? handleQRCodeScanned : undefined,
    barcodeScannerSettings: { barcodeTypes: ['qr'] as const }
  }), [isScanning, isTabFocused, cameraReady, handleQRCodeScanned]);

  const resultsCameraProps = useCallback(() => ({
    style: styles.camera,
    facing: 'back' as const,
    onBarcodeScanned: undefined,
    barcodeScannerSettings: { barcodeTypes: ['qr'] as const }
  }), []);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    } else {
      // Preload camera when permission is available
      setCameraReady(true);
    }
  }, [permission, requestPermission]);

  // Camera preloading effect - keeps camera "warm"
  useEffect(() => {
    if (permission?.granted && isTabFocused) {
      // Clear any existing timer
      if (cameraPreloadTimer.current) {
        clearTimeout(cameraPreloadTimer.current);
      }
    }
    
    return () => {
      if (cameraPreloadTimer.current) {
        clearTimeout(cameraPreloadTimer.current);
      }
    };
  }, [permission?.granted, isTabFocused]);

  // Handle deep link launches and shortcut detection
  useEffect(() => {
    const handleShortcutLaunch = async () => {
      try {
        // Check if app was launched via deep link/shortcut
        const initialURL = await Linking.getInitialURL();
        console.log('Initial URL detected:', initialURL);
        
        if (initialURL && (initialURL.includes('scan-qr') || initialURL.includes('quick-scan'))) {
          console.log('App launched via QR scanning shortcut');
          setLaunchedViaShortcut(true);
          
          // Clear any existing validation results to show fresh scanner
          setValidationResult(null);
          setUserRating(null);
          setShowUserRating(false);
          setIsValidating(false);
          
          // Reduce scan cooldown for faster response when launched via shortcut
          scanCooldown.current = 200; // Faster scanning for shortcut launches
          
          // Enable scanning if we have permission
          if (permission?.granted) {
            setIsScanning(true);
            console.log('Shortcut launch: Camera scanning enabled with fast mode');
          } else {
            console.log('Shortcut launch: Requesting camera permission');
            requestPermission().then(() => {
              setIsScanning(true);
            });
          }
          
          // Auto-clear shortcut indicator after 3 seconds
          setTimeout(() => {
            setLaunchedViaShortcut(false);
            scanCooldown.current = 500; // Reset to normal cooldown
          }, 3000);
        }
      } catch (error) {
        console.error('Error handling shortcut launch:', error);
      }
    };

    // Handle app launch from shortcut
    handleShortcutLaunch();

    // Listen for URL changes while app is running
    const handleDeepLink = (event: { url: string }) => {
      console.log('Deep link received while app running:', event.url);
      
      if (event.url && (event.url.includes('scan-qr') || event.url.includes('quick-scan'))) {
        console.log('Switching to QR scanner via deep link');
        setLaunchedViaShortcut(true);
        
        // Reset scanner state
        setValidationResult(null);
        setUserRating(null);
        setShowUserRating(false);
        setIsValidating(false);
        
        // Enable fast scanning mode
        scanCooldown.current = 200;
        setIsScanning(true);
        
        // Request permission if needed
        if (!permission?.granted) {
          requestPermission();
        }
        
        // Auto-clear shortcut indicator after 3 seconds
        setTimeout(() => {
          setLaunchedViaShortcut(false);
          scanCooldown.current = 500; // Reset to normal cooldown
        }, 3000);
      }
    };

    // Add event listener for URLs received while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Cleanup
    return () => {
      subscription?.remove();
    };
  }, [permission, requestPermission]);

  // Check for reset signal when tab becomes focused (only if user interacted with history buttons)
  useFocusEffect(
    useCallback(() => {
      console.log('Scanner tab focused - checking for reset signal...');
      setIsTabFocused(true); // Mark tab as focused
      
      const checkForResetSignal = async () => {
        try {
          const resetSignal = await AsyncStorage.getItem('resetScanner');
          console.log('Reset signal check result:', resetSignal ? `Found: ${resetSignal}` : 'No signal found');
          
          if (resetSignal) {
            console.log('RESETTING SCANNER STATE - Signal timestamp:', resetSignal);
            console.log('Current state before reset:', {
              isScanning,
              hasValidationResult: !!validationResult,
              showUserRating,
              userRating,
              isValidating
            });
            
            // Reset scanner state only if user clicked Rate/Open in history
            setIsScanning(true);
            setValidationResult(null);
            setShowUserRating(false);
            setUserRating(null);
            setIsValidating(false);
            
            // Clear the signal
            await AsyncStorage.removeItem('resetScanner');
            console.log('Scanner reset completed and signal cleared');
          } else {
            console.log('No reset signal - keeping current state');
          }
        } catch (error) {
          console.error('Error checking reset signal on focus:', error);
        }
      };

      checkForResetSignal();
      
      // // Return cleanup function to handle when tab loses focus
      // return () => {
      //   console.log('Scanner tab lost focus - preparing for smooth transition');
      //   // Use setTimeout to prevent jarring immediate state changes
      //   setTimeout(() => {
      //     setIsTabFocused(false); // Mark tab as not focused
      //   }, 50); // Small delay for smoother transition
      // };
    }, [isScanning, validationResult, showUserRating, userRating, isValidating])
  );

  // Determine if the URL is http or https
  const validateHTTP = (url: string): string | null => {

    /// Trim URL
    let trimmedUrl = url.trim();
    
    /// Remove any surrounding whitespace and invalid characters
    trimmedUrl = trimmedUrl.replace(/[\s\n\r\t]/g, '');
    
    if (trimmedUrl.match(/^https:\/\//)) {
      console.log('HTTPS URL detected:', trimmedUrl);
      return trimmedUrl;
    } else if (trimmedUrl.match(/^http:\/\//)) {
      console.log('HTTP URL detected:', trimmedUrl);
      return trimmedUrl;
    } else {
      // If it's not HTTP/HTTPS, it's not suitable for VirusTotal
      console.warn('Non-HTTP/HTTPS protocol detected:', trimmedUrl);
      return null;
    }
  };

  // Validate the URL with the VirusTotal API
  const validateWithVirusTotal = async (url: string): Promise<VirusTotalResult | null> => {
      const apiKey = Constants.expoConfig?.extra?.VIRUSTOTAL_API_KEY;

      /// Check if API key is available
      if (!!apiKey) {
        console.log('VirusTotal API key configured')
      }
      else {
        console.error('VirusTotal API key not configured');
        return null;
      }
      
      /// Create URL ID for VirusTotal API v3
      const urlId = createUrlId(url);
      console.log('VirusTotal URL ID:', urlId, 'for URL:', url);
      
      try{
        let reportResponse = await fetch(
          `https://www.virustotal.com/api/v3/urls/${urlId}`,
          {
            method: 'GET',
            headers: {
              'x-apikey': apiKey,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!reportResponse.ok) {
          if (reportResponse.status === 403) {
            console.warn('VirusTotal API: Access forbidden. Check API key permissions.');
          } else if (reportResponse.status === 429) {
            console.warn('VirusTotal API: Rate limit exceeded.');
          } else {
            console.warn(`VirusTotal report failed: ${reportResponse.status}`);
          }
          return null;
        }

        const reportData = await reportResponse.json();
        console.log('VirusTotal response:', reportData);

        /// Extract scan results from the response
        const attributes = reportData.data?.attributes;
        if (!attributes) {
          console.warn('No attributes found in VirusTotal response');
          return null;
        }

        const stats = attributes.last_analysis_stats;
        if (!stats) {
          console.warn('No analysis stats found in VirusTotal response');
          return null;
        }

        /// Calculate positives and total
        const positives = stats.malicious + stats.suspicious;
        const total = stats.harmless + stats.malicious + stats.suspicious + stats.undetected;
        const isSecure = positives/total <0.02;

        console.log(`VirusTotal Results - Positives: ${positives}, Total: ${total}, Secure: ${isSecure}`);

        return {
          positives: positives,
          total: total,
          isSecure: isSecure,
          scanId: reportData.data?.id || '',
          permalink: `https://www.virustotal.com/gui/url/${urlId}` || ''
        };
    } catch (error) {
      console.error('VirusTotal API error:', error);
      return null;
    }
  };

  // Gather the Community Rating
  const getCommunityRating = async (url: string): Promise<CommunityRating | null> => {
    if (!backendInfrastructure) {
      console.error('Backend infrastructure not initialized');
      return null;
    }

    try {
      const qrHash = await hashUrl(url);
      const rating = await backendInfrastructure.getCommunityRating(qrHash);
      
      if (!rating) {
        console.log('No community rating found for this URL.');
        return null;
      }

      const communityConfidence = rating.totalVotes > 0 ? rating.safeVotes / rating.totalVotes : 0;

      return {
        safeVotes: rating.safeVotes,
        totalVotes: rating.totalVotes,
        communityConfidence: communityConfidence
      };
    } catch (error) {
      console.error('Error getting community rating:', error);
      return null;
    }
  };

  // Call the VirusTotal and Community Ratings 
  // to make a Safety Assessment
  const safetyAssessment = async (processedUrl: string, skipVirusTotal: boolean = false): Promise<ResultsOverlay> => {
    let virusTotalResult: VirusTotalResult | null = null;
    let communityRating: CommunityRating | null = null;

    /// Call VirusTotal API only for HTTP/HTTPS URLs
    if (!skipVirusTotal) {
      console.log('Calling VirusTotal for HTTP/HTTPS URL');
      virusTotalResult = await validateWithVirusTotal(processedUrl);
    } else {
      console.log('Skipping VirusTotal for non-HTTP/HTTPS QR code');
    }

    /// Call community rating API for all URLs/QR data
    console.log('Calling community rating for QR data');
    communityRating = await getCommunityRating(processedUrl);

    /// Calculate final safety assessment
    let isSafe = false; // Fix: declare isSafe variable
    let confidence = 0.5;
    let warning: string | undefined;

    /// Log the safety assessment calculation
    console.log('Safety Assessment Calculation:');
    console.log('- Skipped VirusTotal:', skipVirusTotal);
    console.log('- VirusTotal available:', !!virusTotalResult);
    console.log('- Community data available:', !!communityRating);

    if (virusTotalResult) {
      console.log('- VirusTotal positives:', virusTotalResult.positives);
      console.log('- VirusTotal total:', virusTotalResult.total);
      console.log('- VirusTotal secure:', virusTotalResult.isSecure);
    }

    if (communityRating) {
      console.log('- Community safe votes:', communityRating.safeVotes);
      console.log('- Community total votes:', communityRating.totalVotes);
      console.log('- Community confidence:', communityRating.communityConfidence);
    }

    /// Handle different data availability scenarios
    if (!virusTotalResult && !communityRating) {
      /// No data from either source
      if (skipVirusTotal) {
        warning = 'Non-web content detected - no security data available';
      } else {
        warning = 'No security data available from VirusTotal or community - status unknown';
      }
      confidence = 0;
      isSafe = false;
    } else if (!virusTotalResult && communityRating) {
      /// Only community data available
      if (skipVirusTotal) {
        warning = 'Non-web content - relying on community assessment only';
      } else {
        warning = 'VirusTotal scan unavailable - relying on community data only';
      }
      confidence = communityRating.communityConfidence * 0.6; // Reduced confidence without VirusTotal
      isSafe = confidence > 0.7;
    } else if (virusTotalResult && !communityRating) {
      /// Only VirusTotal data available
      if (virusTotalResult.positives === -1) {
        /// VirusTotal scan is pending/unknown
        warning = 'VirusTotal scan in progress - status unknown';
        confidence = 0;
        isSafe = false;
      } else {
        /// VirusTotal scan completed successfully
        warning = 'No community votes available';
        isSafe = virusTotalResult.isSecure;
        /// Calculate confidence based on detection ratio
        const detectionRatio = virusTotalResult.total > 0 ? virusTotalResult.positives / virusTotalResult.total : 0;
        if (virusTotalResult.isSecure) {
          confidence = Math.max(0.7, 0.95 - (detectionRatio * 2)); // High confidence for clean scans
        } else {
          confidence = Math.min(0.3, detectionRatio); // Low confidence for detected threats
        }
      }
    } else if (virusTotalResult && communityRating) {
      /// Both data sources available
      if (virusTotalResult.positives === -1) {
        /// VirusTotal scan is pending, rely more on community
        warning = 'VirusTotal scan in progress - relying on community data';
        confidence = communityRating.communityConfidence * 0.8;
        isSafe = confidence > 0.7;
      } else {
        /// Both sources have valid data
        let vtConfidence = 0.5;
        isSafe = virusTotalResult.isSecure;
        /// Calculate confidence based on detection ratio
        const detectionRatio = virusTotalResult.total > 0 ? virusTotalResult.positives / virusTotalResult.total : 0;
        if (virusTotalResult.isSecure) {
          vtConfidence = Math.max(0.7, 0.95 - (detectionRatio * 2)); // High confidence for clean scans
        } else {
          vtConfidence = Math.min(0.3, detectionRatio); // Low confidence for detected threats
        }
        confidence = vtConfidence;

        /// Only modify VirusTotal result if there's significant community data
        if (communityRating.totalVotes >= 3) {
          const communityConfidence = communityRating.communityConfidence;
          /// Combine when there's actual community input (≥3 votes)
          const vtWeight = 0.75;
          const communityWeight = 0.25;
          confidence = (confidence * vtWeight) + (communityConfidence * communityWeight);
          isSafe = confidence > 0.85;
          /// If community strongly disagrees with VirusTotal, add warning
          if (Math.abs(confidence - communityConfidence) > 0.4) {
            warning = 'Community opinion differs from VirusTotal scan - use caution';
          }
        }
      }
    }

    /// Add warnings based on confidence levels
    if (confidence < 0.3) {
      warning = 'High risk detected - strongly recommend avoiding this link';
    } else if (confidence < 0.6) {
      warning = warning || 'Moderate risk detected - proceed with caution';
    } else if (confidence < 0.8 && !warning) {
      warning = 'Some uncertainty in safety assessment';
    }

    /// Determine final safety status
    let finalSafetyStatus: 'safe' | 'unsafe' | 'unknown';
    if (confidence === 0 || (!virusTotalResult && !communityRating)) {
      finalSafetyStatus = 'unknown';
    } else {
      finalSafetyStatus = isSafe ? 'safe' : 'unsafe';
    }

    /// Create a safety assessment object
    const safetyResult: SafetyAssessment = {
      virusTotal: virusTotalResult || undefined,
      community: communityRating || undefined,
      safety: finalSafetyStatus
    };

    console.log(`Final Safety Assessment: ${finalSafetyStatus.toUpperCase()}`);
    
    return {
      virusTotal: virusTotalResult || undefined,
      community: communityRating || undefined,
      safety: safetyResult
    };
  };  

  // Check if QR code already exists in scan history
  // This prevents duplicate processing and preserves existing user ratings
  const checkForDuplicateQR = async (qrData: string): Promise<boolean> => {
    try {
      const STORAGE_KEY = '@safe_scan_history';
      const existingHistory = await AsyncStorage.getItem(STORAGE_KEY);
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      
      const validatedUrl = validateHTTP(qrData);
      const urlForProcessing = validatedUrl || qrData;
      
      return history.some((entry: any) => {
        // Compare both qrData and url fields to catch different storage formats
        return entry.qrData === urlForProcessing || 
               entry.url === urlForProcessing ||
               entry.qrData === qrData ||
               entry.url === qrData;
      });
    } catch (error) {
      console.error('Error checking for duplicate QR codes:', error);
      return false; // If check fails, allow processing to continue
    }
  };

  // Display the Results Overlay
  const handleQRCodeScanned = async ({ data }: { data: string }) => {
    /// Handle empty or null data
    if (!data || data.trim().length === 0) {
      Alert.alert('Error', 'Empty QR code detected');
      setIsScanning(true);
      return;
    }

    /// Prevent scanning when tab is not focused
    if (!isTabFocused) {
      console.log('Scanner tab not focused, ignoring QR code scan');
      return;
    }

    const now = Date.now();
    
    /// Prevent duplicate scans within cooldown period
    if (now - lastScanTime < scanCooldown.current) {
      return;
    }

    /// Check if already processing (immediate flag to prevent race conditions)
    if (isProcessing.current) {
      console.log('Already processing a scan, ignoring duplicate');
      return;
    }

    /// Check for duplicate QR codes in history BEFORE processing
    const isDuplicate = await checkForDuplicateQR(data);
    if (isDuplicate) {
      console.log('Duplicate QR code detected, but allowing processing:', data);
      // Set lastScanTime to trigger cooldown and prevent immediate re-scanning
      setLastScanTime(now);
      // Continue processing instead of returning early
    }

    const scanStartTime = now;
    setLastScanTime(now);
    setIsScanning(false);
    isProcessing.current = true; // Set immediate flag
    setScanCount(prev => prev + 1);
    
    try {
      setIsValidating(true);
      
      /// Check if it's a valid HTTP/HTTPS URL for VirusTotal processing
      const validatedUrl = validateHTTP(data);
      const urlForProcessing = validatedUrl || data; // Use original data if not HTTP/HTTPS

      console.log('QR Code scanned:', data);
      console.log('Valid HTTP/HTTPS URL:', !!validatedUrl);
      console.log('Processing with URL:', urlForProcessing);
      
      /// Perform safety assessment (will handle non-HTTP URLs appropriately)
      const safetyResult = await safetyAssessment(urlForProcessing, !validatedUrl);

      const validationResult: ValidationResult = {
        virusTotal: safetyResult.virusTotal,
        community: safetyResult.community,
        safety: safetyResult.safety,
        url: urlForProcessing
      };

      setValidationResult(validationResult);
      setIsValidating(false);

      /// Save to history
      await saveToHistory(validationResult, scanStartTime);
    } catch (error) {
      console.error('Scan processing error:', error);
      setIsScanning(true);
      setIsValidating(false);
    } finally {
      /// Always clear the processing flag
      isProcessing.current = false;
    }
  };

  // Save the scan to the History tab
  const saveToHistory = async (scanData: ValidationResult, scanStartTime: number) => {
    // Prevent concurrent save operations
    if (isSaving.current) {
      console.log('Already saving to history, skipping duplicate save operation');
      return;
    }

    try {
      isSaving.current = true;
      
      const STORAGE_KEY = '@safe_scan_history';
      const existingHistory = await AsyncStorage.getItem(STORAGE_KEY);
      const currentHistory = existingHistory ? JSON.parse(existingHistory) : [];
      
      // Double-check for duplicates at save time to prevent race conditions
      const validatedUrl = validateHTTP(scanData.url);
      const urlForProcessing = validatedUrl || scanData.url;
      
      const hasDuplicate = currentHistory.some((entry: any) => {
        return entry.qrData === urlForProcessing || 
               entry.url === urlForProcessing ||
               entry.qrData === scanData.url ||
               entry.url === scanData.url;
      });
      
      if (hasDuplicate) {
        console.log('Duplicate entry detected at save time, skipping save:', scanData.url);
        return;
      }
      
      const scanEndTime = Date.now();
      const scanDuration = scanEndTime - scanStartTime;
      
      // Generate ID starting from 16 to avoid conflict with mock data (IDs 1-15)
      const getNextScanId = () => {
        const realScans = currentHistory.filter((entry: any) => !entry.isMockData);
        const existingIds = realScans.map((entry: any) => parseInt(entry.id)).filter((id: number) => !isNaN(id));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 15;
        return (maxId + 1).toString();
      };
      
      // Extract safety status string from the nested safety object or user override
      const getSafetyStatus = (): string => {
        // If user has provided a rating, override the system assessment
        if (userRating) {
          return userRating; // 'safe' or 'unsafe'
        }
        if (scanData.safety?.safety) {
          return scanData.safety.safety; // This is the string: 'safe', 'unsafe', or 'unknown'
        }
        return 'unknown';
      };
      
      const newEntry = {
        id: getNextScanId(),
        scanDuration: scanDuration,
        timestamp: scanEndTime,
        qrData: scanData.url, // Use the URL as qrData for consistency
        virusTotalResult: scanData.virusTotal, 
        safetyStatus: getSafetyStatus(), // Now correctly a string with user override
        originalSafetyStatus: scanData.safety?.safety || 'unknown', // Store original assessment for revert
        communityRating: scanData.community, 
        url: scanData.url,
        userRating: userRating, // Add user's safety rating
        userOverride: !!userRating, // Flag to indicate user has overridden the assessment
        isMockData: false // Mark as real scan data
      };
      
      // Add to beginning of history array
      currentHistory.unshift(newEntry);
      
      // Keep only last 100 entries to prevent storage overflow
      const trimmedHistory = currentHistory.slice(0, 100);
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
      console.log('Saved to History - ID:', newEntry.id, 'Safety:', newEntry.safetyStatus, 'User Rating:', newEntry.userRating, 'User Override:', newEntry.userOverride, 'Mock:', newEntry.isMockData);
    } catch (error) {
      console.error('Error saving to history:', error);
    } finally {
      isSaving.current = false;
    }
  };

  // Submit user rating as community vote
  const submitCommunityVote = async (url: string, rating: 'safe' | 'unsafe') => {
    if (!backendInfrastructure) {
      console.error('Backend infrastructure not available for community voting');
      return { success: false, error: 'Backend infrastructure not available', timestamp: Date.now() };
    }

    try {
      // Create QR hash for the community database
      const qrHash = await hashUrl(url);
      
      // Get persistent user ID instead of generating random one
      const userId = await userIdentityService.getUserId();
      
      console.log('=== VOTE SUBMISSION DEBUG ===');
      console.log('URL:', url);
      console.log('Rating:', rating);
      console.log('User ID:', userId);
      console.log('QR Hash:', qrHash);
      console.log('============================');
      
      const vote = {
        userId: userId,
        qrHash: qrHash,
        vote: rating,
        timestamp: Date.now()
      };

      console.log('Submitting community vote:', vote);
      const result = await backendInfrastructure.submitVote(vote);
      
      if (result.success && result.data) {
        console.log('Community vote submitted successfully!');
        console.log('Updated community rating:', result.data);
        console.log(`Safe votes: ${result.data.safeVotes}, Unsafe votes: ${result.data.unsafeVotes}, Total: ${result.data.totalVotes}`);
      } else {
        console.log('Failed to submit community vote:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Error submitting community vote:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: Date.now() };
    }
  };

  // Retract user's community vote
  const retractCommunityVote = async (url: string) => {
    if (!backendInfrastructure) {
      console.error('Backend infrastructure not available for community voting');
      return { success: false, error: 'Backend infrastructure not available', timestamp: Date.now() };
    }

    try {
      // Create QR hash for the community database
      const qrHash = await hashUrl(url);
      
      // Get persistent user ID
      const userId = await userIdentityService.getUserId();
      
      console.log('=== VOTE RETRACTION DEBUG ===');
      console.log('URL:', url);
      console.log('User ID:', userId);
      console.log('QR Hash:', qrHash);
      console.log('=============================');
      
      console.log('Retracting community vote');
      const result = await backendInfrastructure.retractVote(userId, qrHash);
      
      if (result.success && result.data) {
        console.log('Community vote retracted successfully!');
        console.log('Updated community rating:', result.data);
        console.log(`Safe votes: ${result.data.safeVotes}, Unsafe votes: ${result.data.unsafeVotes}, Total: ${result.data.totalVotes}`);
      } else {
        console.log('Failed to retract community vote:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Error retracting community vote:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: Date.now() };
    }
  };

  // Calculate app security assessment based on VirusTotal and community data
  const calculateAppSecurityAssessment = (virusTotalResult?: VirusTotalResult, communityRating?: CommunityRating): 'safe' | 'unsafe' | 'unknown' => {
    // Handle different data availability scenarios (similar to safetyAssessment function)
    if (!virusTotalResult && !communityRating) {
      // No data from either source
      return 'unknown';
    } else if (!virusTotalResult && communityRating) {
      // Only community data available
      const confidence = communityRating.communityConfidence || 0;
      return confidence > 0.7 ? 'safe' : (confidence < 0.3 ? 'unsafe' : 'unknown');
    } else if (virusTotalResult && !communityRating) {
      // Only VirusTotal data available
      if (virusTotalResult.positives === -1) {
        // VirusTotal scan is pending/unknown
        return 'unknown';
      } else {
        // VirusTotal scan completed successfully
        return virusTotalResult.isSecure ? 'safe' : 'unsafe';
      }
    } else if (virusTotalResult && communityRating) {
      // Both data sources available
      if (virusTotalResult.positives === -1) {
        // VirusTotal scan is pending, rely more on community
        const confidence = communityRating.communityConfidence || 0;
        return confidence > 0.7 ? 'safe' : (confidence < 0.3 ? 'unsafe' : 'unknown');
      } else {
        // Both sources have valid data - use VirusTotal as primary
        let isSafe = virusTotalResult.isSecure;
        
        // Only modify VirusTotal result if there's significant community data
        if (communityRating.safeVotes + (communityRating.totalVotes - communityRating.safeVotes) >= 3) {
          const communityConfidence = communityRating.communityConfidence || 0;
          const vtConfidence = virusTotalResult.isSecure ? 0.9 : 0.1;
          
          // Combine when there's actual community input (≥3 votes)
          const vtWeight = 0.75;
          const communityWeight = 0.25;
          const combinedConfidence = (vtConfidence * vtWeight) + (communityConfidence * communityWeight);
          isSafe = combinedConfidence > 0.85;
        }
        
        return isSafe ? 'safe' : 'unsafe';
      }
    }
    
    return 'unknown';
  };

  // Sync user rating to existing history entry
  const syncUserRatingToHistory = async (newRating: 'safe' | 'unsafe' | null, communityData?: { safeVotes: number; totalVotes: number; confidence: number }) => {
    try {
      const STORAGE_KEY = '@safe_scan_history';
      const existingHistory = await AsyncStorage.getItem(STORAGE_KEY);
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      
      // Find the most recent entry (should be the one we just saved)
      const mostRecentEntry = history.find((entry: any) => !entry.isMockData);
      
      if (mostRecentEntry && validationResult?.url) {
        // Check if this is the entry we want to update (match by URL and timestamp proximity)
        const timeDiff = Date.now() - mostRecentEntry.timestamp;
        if (mostRecentEntry.url === validationResult.url && timeDiff < 60000) { // Within 1 minute
          console.log('Syncing user rating to history entry:', mostRecentEntry.id);
          console.log('Previous rating:', mostRecentEntry.userRating);
          console.log('New rating:', newRating);
          
          // Update the entry's user rating
          mostRecentEntry.userRating = newRating;
          
          // If user provided a rating, override the safety status
          if (newRating) {
            mostRecentEntry.safetyStatus = newRating;
            mostRecentEntry.userOverride = true;
            console.log('User override applied - safety status changed to:', newRating);
          } else {
            // If user removed their rating, revert to original safety assessment
            const originalAssessment = mostRecentEntry.originalSafetyStatus || 'unknown';
            mostRecentEntry.safetyStatus = originalAssessment;
            mostRecentEntry.userOverride = false;
            console.log('User override removed - reverted to original assessment:', originalAssessment);
          }
          
          // Update community data if provided
          if (communityData) {
            mostRecentEntry.communityRating = {
              confidence: communityData.confidence,
              safeVotes: communityData.safeVotes,
              unsafeVotes: communityData.totalVotes - communityData.safeVotes
            };
            console.log('Updated community data in history entry:', mostRecentEntry.communityRating);
          }
          
          // Save back to storage
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
          console.log('User rating and community data synced successfully to entry:', mostRecentEntry.id);
        }
      }
    } catch (error) {
      console.error('Error syncing user rating to history:', error);
    }
  };


  // Reset the scanner
  const resetScanner = () => {
    setValidationResult(null);
    setUserRating(null);
    setShowUserRating(false);
    setIsScanning(isTabFocused); // Only enable scanning if tab is focused
    setLaunchedViaShortcut(false); // Reset shortcut indicator
    isProcessing.current = false; // Reset processing flag
    isSaving.current = false; // Reset saving flag
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


  
//JSX UX
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
        </ThemedView>
      </ThemedView>
    );
  }

  //Results Overlay UX
  if (validationResult) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <ThemedView style={styles.container}>

          {/* Camera background */}
          <View style={styles.cameraContainer}>
            {cameraReady ? (
              <CameraView
                {...resultsCameraProps()}
              />
            ) : (
              <View style={[styles.camera, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#00E676" />
                <ThemedText style={{ color: '#fff', marginTop: 10 }}>Initializing camera...</ThemedText>
              </View>
            )}
            
            {/* Camera darkening overlay - positioned absolutely */}
            <View style={styles.cameraDarkenOverlay} />
            
            {/* Results overlay - positioned absolutely */}
            <View style={styles.resultsOverlay}>
              <ThemedView style={styles.overlayContent}>
                {/* VirusTotal Status */}
                <ThemedView style={[
                  styles.quickDetailCard,
                  { 
                    backgroundColor: !validationResult.virusTotal 
                      ? '#FFA726' // Orange for unknown/unavailable
                      : validationResult.virusTotal.isSecure === null
                      ? '#FFA726' // Orange for pending scans
                      : (validationResult.virusTotal.isSecure === true ? '#2E7D32' : '#C62828'), // Green for clean, red for threat
                      padding: 6, 
                      borderRadius: 20, 
                      marginBottom: 8
                    }
                    ]}>
                    <SymbolView  
                      name="shield.checkered"
                    size={styles.virusTotalIconSize.fontSize} 
                    tintColor="#FFFFFF" 
                  />
                    <ThemedText style={[
                    styles.detailTitle,
                    { color: '#FFFFFF' }
                    ]}>
                    {validationResult.virusTotal 
                      ? (validationResult.virusTotal.positives === 0 ? ' Clean' : ' Threat')
                      : ' Warning'
                    } 
                    </ThemedText>
                </ThemedView>

                {/* Security Status */}
                <ThemedText type="title" style={[styles.quickResultTitle, { backgroundColor: 'transparent', fontSize: 28 }]}>
                  {userRating ? 
                    (userRating === 'safe' ? 'Safe' : 'Unsafe') : 
                    (() => {
                      // When user rating is null, use the app's comprehensive safety assessment
                      const appAssessment = validationResult.safety?.safety;
                      switch (appAssessment) {
                        case 'safe': return 'Safe';
                        case 'unsafe': return 'Unsafe';
                        case 'unknown': return 'Unknown';
                        default: return 'Unknown';
                      }
                    })()
                  }
                </ThemedText>

                {/* Community Rating */}
                <ThemedView style={[styles.quickDetailCard, { backgroundColor: 'transparent', padding: 0 }]}>
                  <SymbolView 
                    name="person.3" 
                    size={styles.communityRatingIconSize.fontSize + 7} 
                    tintColor="#FFFFFF" 
                  />
                  <ThemedText style={[
                    styles.detailTitle,
                    { color: '#FFFFFF' }
                  ]}>
                    {!validationResult.community || validationResult.community.totalVotes === 0 
                      ? '  No votes yet' 
                      : (() => {
                          const safeVotes = validationResult.community.safeVotes || 0;
                          const unsafeVotes = (validationResult.community.totalVotes || 0) - safeVotes;
                          
                          if (safeVotes > unsafeVotes) {
                            return safeVotes === 1 ? '  1 safe vote' : `  ${safeVotes} safe votes`;
                          } else if (unsafeVotes > safeVotes) {
                            return unsafeVotes === 1 ? '  1 unsafe vote' : `  ${unsafeVotes} unsafe votes`;
                          } else {
                            // Equal votes, show safe votes by default
                            return safeVotes === 1 ? '  1 safe vote' : `  ${safeVotes} safe votes`;
                          }
                        })()}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </View>

            {/* User Rating Section - positioned absolutely */}
            {showUserRating && (
              <View style={styles.userRatingContainer}>
                <ThemedView style={styles.userRatingContent}>
                  <ThemedText style={styles.userRatingTitle}>
                    What do you think about this QR code?
                  </ThemedText>
                  
                  <View style={styles.ratingButtonsContainer}>
                    <TouchableOpacity 
                      style={[
                        styles.ratingButton,
                        styles.safeButton,
                        userRating === 'safe' && styles.selectedButton
                      ]}
                      onPress={() => {
                        // Toggle selection - if already safe, deselect; otherwise select safe
                        const newRating = userRating === 'safe' ? null : 'safe';
                        setUserRating(newRating);
                        console.log('User rated QR code as:', newRating || 'deselected');
                        
                        // Submit to community database if rating is not null
                        if (newRating && validationResult?.url) {
                          submitCommunityVote(validationResult.url, newRating).then((result) => {
                            // Update validation result with new community data
                            if (result.success && result.data) {
                              setValidationResult(prev => prev ? {
                                ...prev,
                                community: {
                                  safeVotes: result.data!.safeVotes,
                                  totalVotes: result.data!.totalVotes,
                                  communityConfidence: result.data!.confidence
                                }
                              } : null);
                              
                              // Sync the rating and community data to the already-saved history entry
                              syncUserRatingToHistory(newRating, {
                                safeVotes: result.data!.safeVotes,
                                totalVotes: result.data!.totalVotes,
                                confidence: result.data!.confidence
                              });
                            } else {
                              // Sync just the rating if community vote failed
                              syncUserRatingToHistory(newRating);
                            }
                          });
                        } else if (newRating === null && validationResult?.url) {
                          // User is deselecting their rating - retract from community database
                          retractCommunityVote(validationResult.url).then((result) => {
                            // Update validation result with new community data and reset safety to original
                            if (result.success && result.data) {
                              setValidationResult(prev => prev ? {
                                ...prev,
                                community: {
                                  safeVotes: result.data!.safeVotes,
                                  totalVotes: result.data!.totalVotes,
                                  communityConfidence: result.data!.confidence
                                },
                                // Reset safety to original assessment (don't recalculate)
                                safety: prev.safety ? {
                                  ...prev.safety,
                                  safety: prev.safety.safety // Keep original safety status
                                } : undefined
                              } : null);
                              
                              // Sync the rating removal and community data to the already-saved history entry
                              syncUserRatingToHistory(null, {
                                safeVotes: result.data!.safeVotes,
                                totalVotes: result.data!.totalVotes,
                                confidence: result.data!.confidence
                              });
                            } else {
                              // Sync just the rating removal if community vote retraction failed
                              // Also reset the validation result safety to original status
                              setValidationResult(prev => prev ? {
                                ...prev,
                                safety: prev.safety ? {
                                  ...prev.safety,
                                  safety: prev.safety.safety // Keep original safety status
                                } : undefined
                              } : null);
                              syncUserRatingToHistory(null);
                            }
                          });
                        } else {
                          // Sync the rating to the already-saved history entry
                          syncUserRatingToHistory(newRating);
                        }
                        // Auto-hide after selection
                        setTimeout(() => setShowUserRating(false));
                      }}
                    >
                      {/* <SymbolView 
                        name="checkmark.circle.fill" 
                        size={20}
                        tintColor={userRating === 'safe' ? "#FFFFFF" : "#2E7D32"} 
                      /> */}
                      <Text style={[
                        styles.ratingButtonText,
                        userRating === 'safe' && styles.selectedButtonText
                      ]}>
                        Safe
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.ratingButton,
                        styles.unsafeButton,
                        userRating === 'unsafe' && styles.selectedButton
                      ]}
                      onPress={() => {
                        // Toggle selection - if already unsafe, deselect; otherwise select unsafe
                        const newRating = userRating === 'unsafe' ? null : 'unsafe';
                        setUserRating(newRating);
                        console.log('User rated QR code as:', newRating || 'deselected');
                        
                        // Submit to community database if rating is not null
                        if (newRating && validationResult?.url) {
                          submitCommunityVote(validationResult.url, newRating).then((result) => {
                            // Update validation result with new community data
                            if (result.success && result.data) {
                              setValidationResult(prev => prev ? {
                                ...prev,
                                community: {
                                  safeVotes: result.data!.safeVotes,
                                  totalVotes: result.data!.totalVotes,
                                  communityConfidence: result.data!.confidence
                                }
                              } : null);
                              
                              // Sync the rating and community data to the already-saved history entry
                              syncUserRatingToHistory(newRating, {
                                safeVotes: result.data!.safeVotes,
                                totalVotes: result.data!.totalVotes,
                                confidence: result.data!.confidence
                              });
                            } else {
                              // Sync just the rating if community vote failed
                              syncUserRatingToHistory(newRating);
                            }
                          });
                        } else if (newRating === null && validationResult?.url) {
                          // User is deselecting their rating - retract from community database
                          retractCommunityVote(validationResult.url).then((result) => {
                            // Update validation result with new community data and reset safety to original
                            if (result.success && result.data) {
                              setValidationResult(prev => prev ? {
                                ...prev,
                                community: {
                                  safeVotes: result.data!.safeVotes,
                                  totalVotes: result.data!.totalVotes,
                                  communityConfidence: result.data!.confidence
                                },
                                // Reset safety to original assessment (don't recalculate)
                                safety: prev.safety ? {
                                  ...prev.safety,
                                  safety: prev.safety.safety // Keep original safety status
                                } : undefined
                              } : null);
                              
                              // Sync the rating removal and community data to the already-saved history entry
                              syncUserRatingToHistory(null, {
                                safeVotes: result.data!.safeVotes,
                                totalVotes: result.data!.totalVotes,
                                confidence: result.data!.confidence
                              });
                            } else {
                              // Sync just the rating removal if community vote retraction failed
                              // Also reset the validation result safety to original status
                              setValidationResult(prev => prev ? {
                                ...prev,
                                safety: prev.safety ? {
                                  ...prev.safety,
                                  safety: prev.safety.safety // Keep original safety status
                                } : undefined
                              } : null);
                              syncUserRatingToHistory(null);
                            }
                          });
                        } else {
                          // Sync the rating to the already-saved history entry
                          syncUserRatingToHistory(newRating);
                        }
                        // Auto-hide after selection
                        setTimeout(() => setShowUserRating(false));
                      }}
                    >
                      {/* <SymbolView 
                        name="xmark.circle.fill" 
                        size={20}
                        tintColor={userRating === 'unsafe' ? "#FFFFFF" : "#C62828"} 
                      /> */}
                      <Text style={[
                        styles.ratingButtonText,
                        userRating === 'unsafe' && styles.selectedButtonText
                      ]}>
                        Unsafe
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <ThemedText style={styles.userRatingSubtitle}>
                    You can change this later in the history tab
                  </ThemedText>
                </ThemedView>
              </View>
            )}

            {/* Action Buttons - positioned absolutely */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={resetScanner}>
                <SymbolView 
                name="xmark" 
                size={styles.scanNewIconSize.fontSize}
                tintColor="#FF0000" 
                />
                <Text style={styles.actionButtonText}>Scan New</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => {
                  console.log('Rate button pressed');
                  setShowUserRating(!showUserRating);
                }}
              >
                <SymbolView 
                name="star.fill" 
                size={styles.rateIconSize.fontSize}
                tintColor="#2672ffff" 
                />
                <Text style={styles.actionButtonText}>Rate</Text>
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
                size={styles.openIconSize.fontSize}
                tintColor="#00AA00" 
                />
                <Text style={styles.actionButtonText}>Open</Text>
              </TouchableOpacity>
            </View>

            {/* Loading overlay - positioned absolutely */}
            {isValidating && (
              <View style={styles.cameraLoadingOverlay}>
                <ActivityIndicator size="large" color="#00E676" />
              </View>
            )}
          </View>
        </ThemedView>
      </GestureHandlerRootView>
    );
  }

  //Scanning UX
  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemedView style={styles.container}>

        {/* Camera and scanner */}
        <View style={styles.cameraContainer}>
          {cameraReady ? (
            <CameraView
              {...scanningCameraProps()}
            />
          ) : (
            <View style={[styles.camera, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="large" color="#00E676" />
              <ThemedText style={{ color: '#fff', marginTop: 10 }}>Initializing camera...</ThemedText>
            </View>
          )}
          
          {/* Overlay - positioned absolutely */}
          <View style={styles.overlay}>
            {!isValidating && (
              <>
                <View style={styles.scanFrame} />
                <ThemedText style={styles.scanText}>
                  {launchedViaShortcut ? 'Shortcut activated - Ready to scan!' : 'Point camera at QR code'}
                </ThemedText>
                <ThemedText style={[styles.scanText, { fontSize: 14, marginTop: 8, opacity: 0.8 }]}>
                  {launchedViaShortcut ? 'Fast scanning mode enabled' : ''}
                </ThemedText>
              </>
            )}
          </View>

          {/* Loading overlay - positioned absolutely */}
          {isValidating && (
              <View style={styles.cameraLoadingOverlay}>
              <ActivityIndicator size="large" color="#00E676" />
              </View>
          )}
        </View>

      </ThemedView>
    </GestureHandlerRootView>
  );
}


//JSX UI
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  
  virusTotalIconSize: {
    fontSize: 22
  },

  communityRatingIconSize: {
    fontSize: 22
  },

  scanNewIconSize: {
    fontSize: 35, 
  },

  rateIconSize:{
    fontSize: 35,
  },
  openIconSize: {
    fontSize: 35, 
  },

  //Camera
  cameraContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 110 : 80, // Padding for persistent header
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 16,
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
  userRatingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: [{ translateY: -50 }],
    paddingHorizontal: 0,
    zIndex: 3,
  },
  userRatingContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  userRatingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8, 
    marginBottom: 8,
  },
  userRatingSubtitle: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  ratingButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  safeButton: {
    backgroundColor: 'transparent',
    borderColor: '#2E7D32',
    borderWidth: 2,
  },
  unsafeButton: {
    backgroundColor: 'transparent',
    borderColor: '#C62828',
    borderWidth: 2,
  },
  selectedButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 3,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  ratingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedButtonText: {
    color: '#FFFFFF',
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
  // Settings modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsContent: {
    flex: 1,
    paddingVertical: 16,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 16,
  },
  headerSpacer: {
    width: 60, // Same width as the Done button to balance the layout
  },
  centeredTitle: {
    textAlign: 'center',
    flex: 1,
  },
  doneButton: {
    padding: 8,
    width: 60,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  firstSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    color: '#666666',
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    color: '#666666',
  },
  settingsListItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E7',
    backgroundColor: '#ffffff',
  },
  settingsItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemTextContainer: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 16,
    fontWeight: 'normal',
    marginBottom: 2,
  },
  settingsItemSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    lineHeight: 18,
  },
  chevronText: {
    fontSize: 18,
    opacity: 0.4,
    fontWeight: '300',
  },
  logoFooter: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 20,
  },
  footerLogoImage: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#666666',
  },
});
