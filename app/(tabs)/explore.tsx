import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  Platform,
  Share,
  Text,
  Image,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { backendInfrastructure } from '@/services';
import { userIdentityService } from '@/services/UserIdentityService';

// Types
interface ScanHistoryEntry {
  id: string;
  scanDuration?: number;
  timestamp: number;
  qrData: string;
  virusTotalResult?: {
    isSecure: boolean;
    positives: number;
    total: number;
    scanId: string;
    permalink: string;
  };
  safetyStatus: 'safe' | 'unsafe' | 'unknown';
  communityRating?: {
    confidence: number;
    safeVotes: number;
    unsafeVotes: number;
  };
  url?: string;
  userRating?: 'safe' | 'unsafe' | null;
  userOverride?: boolean; // Flag to indicate user has overridden the assessment
  isMockData?: boolean; // Flag to identify mock training data
}

interface HistoryFilter {
  dateRange?: { start: Date; end: Date };
  safetyStatus?: 'safe' | 'unsafe' | 'unknown' | 'all';
  hasUserTag?: boolean;
  searchQuery?: string;
}

const STORAGE_KEY = '@safe_scan_history';
const MAX_HISTORY_DAYS = 30;

// Simple hash function for QR data (same as in scanner tab)
const hashUrl = async (url: string): Promise<string> => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export default function ScanHistoryScreen() {
  console.log('History screen component initialized');
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  console.log('Color scheme detected:', colorScheme);

  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ScanHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'safe' | 'unsafe' | 'unknown'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScanHistoryEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserRating, setShowUserRating] = useState(false);
  const [userRating, setUserRating] = useState<'safe' | 'unsafe' | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  console.log('State variables initialized');

  // Reloads history every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('History tab focused - loading data');
      loadHistory();
    }, [])
  );

  // Runs whenever the history data changes
  useEffect(() => {
    console.log('History data changed - applying filters');
    console.log('- Current history entries:', history.length);
    console.log('- Search query:', searchQuery);
    console.log('- Selected filter:', selectedFilter);
    applyFilters();
  }, [history, searchQuery, selectedFilter]);

//History Tab
  //Loads the History tab
  const loadHistory = async () => {
    console.log('Loading history from storage...');
    try {
      setIsLoading(true);
      
      /// Load existing history from storage
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      let existingHistory: ScanHistoryEntry[] = data ? JSON.parse(data) : [];
      console.log('Loaded history entries from storage:', existingHistory.length);
      
      /// Log each entry for debugging
      existingHistory.forEach((entry, index) => {
        console.log(`Entry ${index}: ID=${entry.id}, Mock=${entry.isMockData}, Safety=${entry.safetyStatus}, Type=${typeof entry.safetyStatus}`);
      });
      
      /// Separate real scans from mock data
      const existingMockData = existingHistory.filter(entry => entry.isMockData);
      const realScans = existingHistory.filter(entry => !entry.isMockData);
      
      console.log('Mock data entries:', existingMockData.length);
      console.log('Real scan entries:', realScans.length);
      console.log('Real scan entries:', realScans.length);
      console.log('Mock data entries:', existingMockData.length);
      
      /// Combine real scans (newest first) with mock data
      const combinedHistory = [...realScans, ...existingMockData];
      
      /// Sort by timestamp (newest first)
      combinedHistory.sort((a, b) => b.timestamp - a.timestamp);
      console.log('Combined and sorted history entries:', combinedHistory.length);
      
      setHistory(combinedHistory);
      
      
    } catch (error) {
      console.log('Error loading history:', error);
      // Generate mock data on error for development
      console.log('Generating mock history data for development');
      const mockData = generateMockHistory();
      console.log('Generated mock entries:', mockData.length);
      setHistory(mockData);
    } finally {
      setIsLoading(false);
      console.log('History loading completed');
    }
  };

  // Updates the History tab with real scans
  const updateHistory = async (newHistory: ScanHistoryEntry[]) => {
    console.log('Updating history in storage with', newHistory.length, 'entries');
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      console.log('History successfully saved to storage');
    } catch (error) {
      console.log('Error saving history:', error);
    }
  };

  // Mock scans for user education
  const generateMockHistory = (): ScanHistoryEntry[] => {
    console.log('Generating mock history data for user education');
    const now = Date.now();
    const mockEntries: ScanHistoryEntry[] = [
      {
        id: '1',
        qrData: 'https://www.google.com',
        url: 'https://www.google.com',
        timestamp: now - 300000, // 5 minutes ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 72, 
          scanId: 'scan1',
          permalink: 'https://virustotal.com/scan1'
        },
        communityRating: {
          confidence: 0.98,
          safeVotes: 45,
          unsafeVotes: 1
        },
        userRating: 'safe',
        scanDuration: 1200,
        isMockData: true // Add flag to identify mock data
      },
      {
        id: '2',
        qrData: 'http://malicious-phishing-site.com/steal-data',
        url: 'http://malicious-phishing-site.com/steal-data',
        timestamp: now - 1800000, // 30 minutes ago
        safetyStatus: 'unsafe',
        virusTotalResult: { 
          isSecure: false, 
          positives: 28, 
          total: 70,
          scanId: 'scan2',
          permalink: 'https://virustotal.com/scan2'
        },
        communityRating: {
          confidence: 0.15,
          safeVotes: 1,
          unsafeVotes: 12
        },
        userRating: 'unsafe',
        scanDuration: 2800,
        isMockData: true
      },
      {
        id: '3',
        qrData: 'WiFi:T:WPA;S:CoffeeShop_Free;P:password123;H:false;;',
        timestamp: now - 3600000, // 1 hour ago
        safetyStatus: 'unknown',
        communityRating: {
          confidence: 0.5,
          safeVotes: 0,
          unsafeVotes: 0
        },
        userRating: null,
        scanDuration: 650,
        isMockData: true
      },
      {
        id: '4',
        qrData: 'https://github.com/facebook/react-native',
        url: 'https://github.com/facebook/react-native',
        timestamp: now - 7200000, // 2 hours ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 68,
          scanId: 'scan3',
          permalink: 'https://virustotal.com/scan3'
        },
        communityRating: {
          confidence: 0.92,
          safeVotes: 23,
          unsafeVotes: 2
        },
        userRating: 'safe',
        scanDuration: 980,
        isMockData: true
      },
      {
        id: '5',
        qrData: 'BEGIN:VCARD\nVERSION:3.0\nFN:John Smith\nORG:Tech Corp\nTEL:+1-555-123-4567\nEMAIL:john@techcorp.com\nEND:VCARD',
        timestamp: now - 14400000, // 4 hours ago
        safetyStatus: 'unknown',
        communityRating: {
          confidence: 0.8,
          safeVotes: 8,
          unsafeVotes: 1
        },
        userRating: 'safe',
        scanDuration: 450,
        isMockData: true
      },
      {
        id: '6',
        qrData: 'https://suspicious-shortened-url.bit.ly/x7h2k9',
        url: 'https://suspicious-shortened-url.bit.ly/x7h2k9',
        timestamp: now - 21600000, // 6 hours ago
        safetyStatus: 'unsafe',
        virusTotalResult: { 
          isSecure: false, 
          positives: 8, 
          total: 65,
          scanId: 'scan4',
          permalink: 'https://virustotal.com/scan4'
        },
        communityRating: {
          confidence: 0.35,
          safeVotes: 3,
          unsafeVotes: 7
        },
        userRating: null,
        scanDuration: 3200,
        isMockData: true
      },
      {
        id: '7',
        qrData: 'https://www.netflix.com/browse',
        url: 'https://www.netflix.com/browse',
        timestamp: now - 43200000, // 12 hours ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 71,
          scanId: 'scan5',
          permalink: 'https://virustotal.com/scan5'
        },
        communityRating: {
          confidence: 0.95,
          safeVotes: 38,
          unsafeVotes: 2
        },
        userRating: 'safe',
        scanDuration: 1100,
        isMockData: true
      },
      {
        id: '8',
        qrData: 'tel:+1-800-555-0199',
        timestamp: now - 86400000, // 1 day ago
        safetyStatus: 'unknown',
        communityRating: {
          confidence: 0.6,
          safeVotes: 3,
          unsafeVotes: 2
        },
        userRating: null,
        scanDuration: 320,
        isMockData: true
      },
      {
        id: '9',
        qrData: 'https://crypto-scam-investment.com/get-rich-quick',
        url: 'https://crypto-scam-investment.com/get-rich-quick',
        timestamp: now - 172800000, // 2 days ago
        safetyStatus: 'unsafe',
        virusTotalResult: { 
          isSecure: false, 
          positives: 35, 
          total: 69,
          scanId: 'scan6',
          permalink: 'https://virustotal.com/scan6'
        },
        communityRating: {
          confidence: 0.08,
          safeVotes: 0,
          unsafeVotes: 15
        },
        userRating: 'unsafe',
        scanDuration: 4500,
        isMockData: true
      },
      {
        id: '10',
        qrData: 'https://stackoverflow.com/questions/react-native',
        url: 'https://stackoverflow.com/questions/react-native',
        timestamp: now - 259200000, // 3 days ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 70,
          scanId: 'scan7',
          permalink: 'https://virustotal.com/scan7'
        },
        communityRating: {
          confidence: 0.89,
          safeVotes: 17,
          unsafeVotes: 2
        },
        userRating: null,
        scanDuration: 850,
        isMockData: true
      },
      {
        id: '11',
        qrData: 'WIFI:T:WPA2;S:HomeNetwork5G;P:supersecurepassword2023;H:true;;',
        timestamp: now - 345600000, // 4 days ago
        safetyStatus: 'unknown',
        communityRating: {
          confidence: 0.7,
          safeVotes: 5,
          unsafeVotes: 1
        },
        userRating: 'safe',
        scanDuration: 580,
        isMockData: true
      },
      {
        id: '12',
        qrData: 'mailto:support@legitcompany.com?subject=Product%20Inquiry&body=Hello%20team',
        timestamp: now - 432000000, // 5 days ago
        safetyStatus: 'unknown',
        communityRating: {
          confidence: 0.5,
          safeVotes: 0,
          unsafeVotes: 0
        },
        userRating: null,
        scanDuration: 410,
        isMockData: true
      },
      {
        id: '13',
        qrData: 'https://fake-bank-login.phishing-site.ru/secure',
        url: 'https://fake-bank-login.phishing-site.ru/secure',
        timestamp: now - 518400000, // 6 days ago
        safetyStatus: 'unsafe',
        virusTotalResult: { 
          isSecure: false, 
          positives: 42, 
          total: 68,
          scanId: 'scan8',
          permalink: 'https://virustotal.com/scan8'
        },
        communityRating: {
          confidence: 0.02,
          safeVotes: 0,
          unsafeVotes: 25
        },
        userRating: 'unsafe',
        scanDuration: 5200,
        isMockData: true
      },
      {
        id: '14',
        qrData: 'https://www.apple.com/iphone',
        url: 'https://www.apple.com/iphone',
        timestamp: now - 604800000, // 7 days ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 73,
          scanId: 'scan9',
          permalink: 'https://virustotal.com/scan9'
        },
        communityRating: {
          confidence: 0.97,
          safeVotes: 52,
          unsafeVotes: 1
        },
        userRating: 'safe',
        scanDuration: 920,
        isMockData: true
      },
      {
        id: '15',
        qrData: 'Event: Team Meeting\nDate: 2024-01-15\nTime: 2:00 PM\nLocation: Conference Room A\nNotes: Bring laptop and quarterly reports',
        timestamp: now - 691200000, // 8 days ago
        safetyStatus: 'unknown',
        communityRating: {
          confidence: 0.9,
          safeVotes: 12,
          unsafeVotes: 0
        },
        userRating: null,
        scanDuration: 380,
        isMockData: true
      }
    ];
    console.log('Mock history generated with', mockEntries.length, 'entries');
    return mockEntries;
  };

  const applyFilters = () => {
    console.log('Applying filters to history');
    console.log('- Original history length:', history.length);
    console.log('- Search query:', searchQuery);
    console.log('- Status filter:', selectedFilter);
    
    let filtered = [...history];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      console.log('Applying search filter with query:', query);
      const beforeCount = filtered.length;
      filtered = filtered.filter(entry => 
        getQRDataString(entry.qrData).toLowerCase().includes(query) ||
        entry.url?.toLowerCase().includes(query)
      );
      console.log('Search filter applied, entries reduced from', beforeCount, 'to', filtered.length);
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      console.log('Applying status filter:', selectedFilter);
      const beforeCount = filtered.length;
      filtered = filtered.filter(entry => entry.safetyStatus === selectedFilter);
      console.log('Status filter applied, entries reduced from', beforeCount, 'to', filtered.length);
    }

    console.log('Final filtered history length:', filtered.length);
    setFilteredHistory(filtered);
  };

  // Submit user rating as community vote
  const submitCommunityVote = async (url: string, rating: 'safe' | 'unsafe') => {
    if (!backendInfrastructure) {
      console.log('Backend infrastructure not available for community voting');
      return { success: false, error: 'Backend infrastructure not available', timestamp: Date.now() };
    }

    try {
      // Create QR hash for the community database
      const qrHash = await hashUrl(url);
      
      // Get persistent user ID instead of generating random one
      const userId = await userIdentityService.getUserId();
      
      console.log('=== VOTE SUBMISSION DEBUG (History Tab) ===');
      console.log('URL:', url);
      console.log('Rating:', rating);
      console.log('User ID:', userId);
      console.log('QR Hash:', qrHash);
      console.log('==========================================');
      
      const vote = {
        userId: userId,
        qrHash: qrHash,
        vote: rating,
        timestamp: Date.now()
      };

      console.log('Submitting community vote from History tab:', vote);
      const result = await backendInfrastructure.submitVote(vote);
      
      if (result.success && result.data) {
        console.log('Community vote submitted successfully from History tab!');
        console.log('Updated community rating:', result.data);
        console.log(`Safe votes: ${result.data.safeVotes}, Unsafe votes: ${result.data.unsafeVotes}, Total: ${result.data.totalVotes}`);
      } else {
        console.log('Failed to submit community vote:', result.error);
      }
      
      return result;
    } catch (error) {
      console.log('Error submitting community vote:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: Date.now() };
    }
  };

  // Retract user's community vote
  const retractCommunityVote = async (url: string) => {
    if (!backendInfrastructure) {
      console.log('Backend infrastructure not available for community voting');
      return { success: false, error: 'Backend infrastructure not available', timestamp: Date.now() };
    }

    try {
      // Create QR hash for the community database
      const qrHash = await hashUrl(url);
      
      // Get persistent user ID
      const userId = await userIdentityService.getUserId();
      
      console.log('=== VOTE RETRACTION DEBUG (History Tab) ===');
      console.log('URL:', url);
      console.log('User ID:', userId);
      console.log('QR Hash:', qrHash);
      console.log('===========================================');
      
      console.log('Retracting community vote from History tab');
      const result = await backendInfrastructure.retractVote(userId, qrHash);
      
      if (result.success && result.data) {
        console.log('Community vote retracted successfully from History tab!');
        console.log('Updated community rating:', result.data);
        console.log(`Safe votes: ${result.data.safeVotes}, Unsafe votes: ${result.data.unsafeVotes}, Total: ${result.data.totalVotes}`);
      } else {
        console.log('Failed to retract community vote:', result.error);
      }
      
      return result;
    } catch (error) {
      console.log('Error retracting community vote:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: Date.now() };
    }
  };

  // Calculate app security assessment based on VirusTotal and community data
  const calculateAppSecurityAssessment = (entry: ScanHistoryEntry): 'safe' | 'unsafe' | 'unknown' => {
    const virusTotalResult = entry.virusTotalResult;
    const communityRating = entry.communityRating;

    // Handle different data availability scenarios (similar to safetyAssessment function)
    if (!virusTotalResult && !communityRating) {
      // No data from either source
      return 'unknown';
    } else if (!virusTotalResult && communityRating) {
      // Only community data available
      const confidence = communityRating.confidence || 0;
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
        const confidence = communityRating.confidence || 0;
        return confidence > 0.7 ? 'safe' : (confidence < 0.3 ? 'unsafe' : 'unknown');
      } else {
        // Both sources have valid data - use VirusTotal as primary
        let isSafe = virusTotalResult.isSecure;
        
        // Only modify VirusTotal result if there's significant community data
        if (communityRating.safeVotes + communityRating.unsafeVotes >= 3) {
          const communityConfidence = communityRating.confidence || 0;
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

  const updateUserTag = async (entryId: string, newTag: 'safe' | 'unsafe' | null) => {
    console.log('Updating user tag for entry:', entryId, 'to:', newTag);
    
    // Find the entry to get its URL for community voting
    const entryToUpdate = history.find(entry => entry.id === entryId);
    
    const updatedHistory = history.map(entry => {
      if (entry.id === entryId) {
        const updatedEntry = { ...entry, userRating: newTag };
        
        // If user provided a rating, override the safety status
        if (newTag) {
          updatedEntry.safetyStatus = newTag;
          updatedEntry.userOverride = true;
          console.log('User override applied - safety status changed to:', newTag);
        } else {
          // If user removed their rating, revert to app security assessment
          updatedEntry.safetyStatus = calculateAppSecurityAssessment(entry);
          updatedEntry.userOverride = false;
          console.log('User override removed - reverted to app assessment:', updatedEntry.safetyStatus);
        }
        
        return updatedEntry;
      }
      return entry;
    });
    
    // Find the updated entry to log the user rating at save time
    const updatedEntry = updatedHistory.find(entry => entry.id === entryId);
    if (updatedEntry) {
      console.log('User Rating at save time:', updatedEntry.userRating);
      console.log('Safety Status at save time:', updatedEntry.safetyStatus);
      console.log('User Override at save time:', updatedEntry.userOverride);
    }
    
    console.log('User tag updated in memory, saving to storage');
    setHistory(updatedHistory);
    await updateHistory(updatedHistory);
    
    // Submit to community database if rating is not null and we have a URL
    if (newTag && entryToUpdate && (entryToUpdate.url || entryToUpdate.qrData)) {
      const urlToUse = entryToUpdate.url || entryToUpdate.qrData;
      const result = await submitCommunityVote(urlToUse, newTag);
      
      // Update the entry with new community data if vote was successful
      if (result.success && result.data) {
        const finalUpdatedHistory = updatedHistory.map(entry => 
          entry.id === entryId ? { 
            ...entry, 
            communityRating: {
              confidence: result.data!.confidence,
              safeVotes: result.data!.safeVotes,
              unsafeVotes: result.data!.unsafeVotes
            }
          } : entry
        );
        setHistory(finalUpdatedHistory);
        await updateHistory(finalUpdatedHistory);
        console.log('Community rating updated in history entry');
      }
    } else if (newTag === null && entryToUpdate && (entryToUpdate.url || entryToUpdate.qrData)) {
      // User is removing their rating - retract from community database
      const urlToUse = entryToUpdate.url || entryToUpdate.qrData;
      const result = await retractCommunityVote(urlToUse);
      
      // Update the entry with new community data if retraction was successful
      if (result.success && result.data) {
        const finalUpdatedHistory = updatedHistory.map(entry => 
          entry.id === entryId ? { 
            ...entry, 
            communityRating: {
              confidence: result.data!.confidence,
              safeVotes: result.data!.safeVotes,
              unsafeVotes: result.data!.unsafeVotes
            }
          } : entry
        );
        setHistory(finalUpdatedHistory);
        await updateHistory(finalUpdatedHistory);
        console.log('Community rating updated after vote retraction in history entry');
      }
    }
    
    setEditingTag(null);
    setShowUserRating(false);
    setSelectedEntry(null);
    console.log('User tag update completed');
  };

  const updateBulkUserTags = async (entryIds: string[], newTag: 'safe' | 'unsafe' | null) => {
    console.log('Updating user tags for entries:', entryIds, 'to:', newTag);
    
    // Get the entries before updating for community voting
    const entriesToUpdate = history.filter(entry => entryIds.includes(entry.id));
    
    let updatedHistory = history.map(entry => {
      if (entryIds.includes(entry.id)) {
        const updatedEntry = { ...entry, userRating: newTag };
        
        // If user provided a rating, override the safety status
        if (newTag) {
          updatedEntry.safetyStatus = newTag;
          updatedEntry.userOverride = true;
          console.log('User override applied to entry', entry.id, '- safety status changed to:', newTag);
        } else {
          // If user removed their rating, revert to app security assessment
          updatedEntry.safetyStatus = calculateAppSecurityAssessment(entry);
          updatedEntry.userOverride = false;
          console.log('User override removed from entry', entry.id, '- reverted to app assessment:', updatedEntry.safetyStatus);
        }
        
        return updatedEntry;
      }
      return entry;
    });
    
    console.log('Bulk user tags updated in memory, saving to storage');
    setHistory(updatedHistory);
    await updateHistory(updatedHistory);
    
    // Submit community votes if rating is not null
    if (newTag) {
      for (const entry of entriesToUpdate) {
        if (entry.url || entry.qrData) {
          const urlToUse = entry.url || entry.qrData;
          const result = await submitCommunityVote(urlToUse, newTag);
          
          // Update the entry with new community data if vote was successful
          if (result.success && result.data) {
            updatedHistory = updatedHistory.map(historyEntry => 
              historyEntry.id === entry.id ? { 
                ...historyEntry, 
                communityRating: {
                  confidence: result.data!.confidence,
                  safeVotes: result.data!.safeVotes,
                  unsafeVotes: result.data!.unsafeVotes
                }
              } : historyEntry
            );
          }
        }
      }
      
      // Save the final updated history with community data
      setHistory(updatedHistory);
      await updateHistory(updatedHistory);
      console.log('Community ratings updated for bulk entries');
    } else if (newTag === null) {
      // User is removing ratings - retract from community database
      for (const entry of entriesToUpdate) {
        if (entry.url || entry.qrData) {
          const urlToUse = entry.url || entry.qrData;
          const result = await retractCommunityVote(urlToUse);
          
          // Update the entry with new community data if retraction was successful
          if (result.success && result.data) {
            updatedHistory = updatedHistory.map(historyEntry => 
              historyEntry.id === entry.id ? { 
                ...historyEntry, 
                communityRating: {
                  confidence: result.data!.confidence,
                  safeVotes: result.data!.safeVotes,
                  unsafeVotes: result.data!.unsafeVotes
                }
              } : historyEntry
            );
          }
        }
      }
      
      // Save the final updated history with community data
      setHistory(updatedHistory);
      await updateHistory(updatedHistory);
      console.log('Community ratings updated after bulk vote retractions');
    }
    
    setShowUserRating(false);
    setSelectedEntry(null);
    setSelectedEntries(new Set());
    setIsSelectMode(false);
    console.log('Bulk user tag update completed');
  };

  const deleteEntry = async (entryId: string) => {
    console.log('Delete entry requested for ID:', entryId);
    
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this scan from your history?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('Delete entry cancelled by user')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed delete, removing entry:', entryId);
            const beforeCount = history.length;
            const updatedHistory = history.filter(entry => entry.id !== entryId);
            console.log('Entry removed from history, count reduced from', beforeCount, 'to', updatedHistory.length);
            setHistory(updatedHistory);
            await updateHistory(updatedHistory);
            console.log('Entry delete completed');
          }
        }
      ]
    );
  };

  const handleBulkRate = () => {
    if (selectedEntries.size === 0) return;
    
    // Set the first selected entry as the main entry for rating
    const firstSelectedId = Array.from(selectedEntries)[0];
    const firstEntry = history.find(entry => entry.id === firstSelectedId);
    if (firstEntry) {
      setSelectedEntry(firstEntry);
      setUserRating(firstEntry.userRating || null);
      setShowUserRating(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedEntries.size === 0) return;
    
    Alert.alert(
      'Delete Selected Entries',
      `Are you sure you want to delete ${selectedEntries.size} selected entries from your history?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel'
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const selectedIds = Array.from(selectedEntries);
            const updatedHistory = history.filter(entry => !selectedIds.includes(entry.id));
            setHistory(updatedHistory);
            await updateHistory(updatedHistory);
            setSelectedEntries(new Set());
            setIsSelectMode(false);
            console.log('Bulk delete completed for', selectedIds.length, 'entries');
          }
        }
      ]
    );
  };

  const exportHistory = async () => {
    console.log('Export history requested, total entries:', history.length);
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalEntries: history.length,
        entries: history
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      console.log('Export data prepared, JSON size:', jsonString.length, 'characters');
      
      if (Platform.OS === 'web') {
        console.log('Exporting history for web platform');
        // For web, create download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `safe_scan_history_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        console.log('Web download triggered for history export');
      } else {
        console.log('Exporting history for mobile platform using Share API');
        // For mobile, use Share API
        await Share.share({
          message: jsonString,
          title: 'SafeScan History Export'
        });
        console.log('Mobile share completed for history export');
      }
    } catch (error) {
      console.log('Error exporting history:', error);
      Alert.alert('Error', 'Failed to export history');
    }
  };

  const clearHistory = () => {
    console.log('Clear history requested');
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all scan history? This action cannot be undone.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('Clear history cancelled by user')
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed clear all history');
            const beforeCount = history.length;
            setHistory([]);
            await AsyncStorage.removeItem(STORAGE_KEY);
            console.log('History cleared -', beforeCount, 'entries removed');
          }
        }
      ]
    );
  };

  const importMockScans = () => {
    console.log('Import mock scans requested');
    Alert.alert(
      'Import Mock Scans',
      'This will add sample scan data for demonstration purposes. Mock scans will be clearly labeled with a "Mock" tag.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('Import mock scans cancelled by user')
        },
        {
          text: 'Import',
          onPress: async () => {
            console.log('User confirmed import mock scans');
            try {
              const mockData = generateMockHistory();
              console.log('Generated mock data entries:', mockData.length);
              
              // Load existing history
              const existingData = await AsyncStorage.getItem(STORAGE_KEY);
              const existingHistory: ScanHistoryEntry[] = existingData ? JSON.parse(existingData) : [];
              
              // Filter out any existing mock data to avoid duplicates
              const realScans = existingHistory.filter(entry => !entry.isMockData);
              
              // Combine real scans with new mock data
              const combinedHistory = [...realScans, ...mockData];
              combinedHistory.sort((a, b) => b.timestamp - a.timestamp);
              
              // Save to storage and update state
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(combinedHistory));
              setHistory(combinedHistory);
              
              console.log('Mock scans imported successfully, total entries:', combinedHistory.length);
              Alert.alert('Success', `Imported ${mockData.length} mock scans for demonstration`);
            } catch (error) {
              console.log('Error importing mock scans:', error);
              Alert.alert('Error', 'Failed to import mock scans');
            }
          }
        }
      ]
    );
  };

  const exportToCSV = async () => {
    console.log('CSV export requested for', history.length, 'entries');
    try {
      const csvHeader = 'ID,QR Data,URL,Timestamp,Date,Safety Status,VirusTotal Secure,VirusTotal Positives,VirusTotal Total,Community Safe Votes,Community Unsafe Votes,Community Confidence,User Tag,Scan Duration (ms)\n';
      
      const csvRows = history.map(entry => {
        const date = new Date(entry.timestamp).toISOString();
        const url = entry.url || '';
        const vtSecure = entry.virusTotalResult?.isSecure || '';
        const vtPositives = entry.virusTotalResult?.positives || '';
        const vtTotal = entry.virusTotalResult?.total || '';
        const communitySafe = entry.communityRating?.safeVotes || '';
        const communityUnsafe = entry.communityRating?.unsafeVotes || '';
        const communityConf = entry.communityRating?.confidence || '';
        const userRating = entry.userRating || '';
        const scanDuration = entry.scanDuration || '';
        
        // Escape quotes and commas in data
        const escapeCSV = (field: any) => {
          const str = String(field);
          if (str.includes('"') || str.includes(',') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        return `${escapeCSV(entry.id)},${escapeCSV(getQRDataString(entry.qrData))},${escapeCSV(url)},${entry.timestamp},${escapeCSV(date)},${escapeCSV(entry.safetyStatus)},${escapeCSV(vtSecure)},${escapeCSV(vtPositives)},${escapeCSV(vtTotal)},${escapeCSV(communitySafe)},${escapeCSV(communityUnsafe)},${escapeCSV(communityConf)},${escapeCSV(userRating)},${escapeCSV(scanDuration)}`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      const fileName = `safescan_history_${new Date().toISOString().split('T')[0]}.csv`;
      console.log('CSV content prepared, size:', csvContent.length, 'characters');
      
      if (Platform.OS === 'web') {
        console.log('Exporting CSV for web platform');
        // For web, create download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        console.log('Web CSV download triggered');
      } else {
        console.log('Exporting CSV for mobile platform');
        // For mobile, use Share API
        const result = await Share.share({
          message: csvContent,
          title: 'SafeScan History CSV Export'
        });
        
        // Only show success if share was not dismissed/cancelled
        if (result.action === Share.sharedAction) {
          console.log('Mobile CSV share completed successfully');
          Alert.alert('Success', `Exported ${history.length} scans to CSV format`);
        } else {
          console.log('Mobile CSV share was cancelled or dismissed');
        }
        return; // Exit early to avoid showing alert below
      }
      
      console.log('CSV export completed successfully');
      Alert.alert('Success', `Exported ${history.length} scans to CSV format`);
    } catch (error) {
      console.log('CSV Export Error:', error);
      Alert.alert('Error', 'Failed to export CSV file');
    }
  };

  const exportToJSON = async () => {
    console.log('JSON export requested for', history.length, 'entries');
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        exportFormat: 'JSON',
        appVersion: '1.0.0',
        totalEntries: history.length,
        entries: history
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `safescan_history_${new Date().toISOString().split('T')[0]}.json`;
      console.log('JSON content prepared, size:', jsonString.length, 'characters');
      
      if (Platform.OS === 'web') {
        console.log('Exporting JSON for web platform');
        // For web, create download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        console.log('Web JSON download triggered');
      } else {
        console.log('Exporting JSON for mobile platform');
        // For mobile, use Share API
        const result = await Share.share({
          message: jsonString,
          title: 'SafeScan History JSON Export'
        });
        
        // Only show success if share was not dismissed/cancelled
        if (result.action === Share.sharedAction) {
          console.log('Mobile JSON share completed successfully');
          Alert.alert('Success', `Exported ${history.length} scans to JSON format`);
        } else {
          console.log('Mobile JSON share was cancelled or dismissed');
        }
        return; // Exit early to avoid showing alert below
      }
      
      console.log('JSON export completed successfully');
      Alert.alert('Success', `Exported ${history.length} scans to JSON format`);
    } catch (error) {
      console.log('JSON Export Error:', error);
      Alert.alert('Error', 'Failed to export JSON file');
    }
  };

  const getStorageInfo = async () => {
    console.log('Storage info requested');
    try {
      const keys = await AsyncStorage.getAllKeys();
      const safeScanKeys = keys.filter(key => key.includes('safe_scan'));
      console.log('Found storage keys:', keys.length, 'total,', safeScanKeys.length, 'SafeScan related');
      
      let totalSize = 0;
      for (const key of safeScanKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
      
      const sizeInKB = (totalSize / 1024).toFixed(2);
      console.log('Storage analysis completed - Size:', sizeInKB, 'KB');
      
      Alert.alert(
        'Storage Information',
        `History Entries: ${history.length}\nStorage Keys: ${safeScanKeys.length}\nApproximate Size: ${sizeInKB} KB\n\nOldest Entry: ${history.length > 0 ? new Date(Math.min(...history.map(h => h.timestamp))).toLocaleDateString() : 'None'}\nNewest Entry: ${history.length > 0 ? new Date(Math.max(...history.map(h => h.timestamp))).toLocaleDateString() : 'None'}`
      );
    } catch (error) {
      console.log('Error retrieving storage information:', error);
      Alert.alert('Error', 'Failed to retrieve storage information');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    // Super quick time display for college students
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  // Helper function to safely display QR data
  const getQRDataString = (qrData: any): string => {
    if (typeof qrData === 'string') {
      return qrData;
    }
    if (typeof qrData === 'object' && qrData !== null) {
      // If it's an object, try to extract the URL or convert to string
      if (qrData.url) {
        return qrData.url;
      }
      return JSON.stringify(qrData);
    }
    return 'Invalid QR Data';
  };

  const truncateText = (text: string, maxLength: number = 40) => {
    // Shorter truncation for quick scanning
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const getStatusIcon = (status: string) => {
    // High contrast icons for quick recognition
    switch (status) {
      case 'safe': return '';
      case 'unsafe': return '';
      case 'unknown': return '';
      default: return '';
    }
  };

  const getStatusColor = (status: string, userOverride?: boolean) => {
    // Bold colors for instant recognition
    // If user has overridden, use brighter colors to indicate user control
    switch (status) {
      case 'safe': return userOverride ? '#00FF00' : '#00E676';   // Brighter green for user override
      case 'unsafe': return userOverride ? '#FF0000' : '#FF1744'; // Brighter red for user override  
      case 'unknown': return '#FFC107'; // Bright yellow
      default: return '#FFC107';
    }
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

  const renderHistoryItem = ({ item }: { item: ScanHistoryEntry }) => {
    const isSelected = selectedEntries.has(item.id);

    const handlePress = () => {
      if (isSelectMode) {
        // In select mode, toggle selection
        const newSelectedEntries = new Set(selectedEntries);
        if (isSelected) {
          newSelectedEntries.delete(item.id);
        } else {
          newSelectedEntries.add(item.id);
        }
        setSelectedEntries(newSelectedEntries);
        console.log('Entry selection toggled:', item.id, 'Selected:', !isSelected);
      } else {
        // Normal mode, open rating interface
        console.log('History item selected:', item.id, '- Opening rating interface');
        setSelectedEntry(item);
        setUserRating(item.userRating || null);
        setShowUserRating(true);
      }
    };

    // Function to signal scanner tab to reset to scanning mode
    const signalScannerReset = async () => {
      try {
        const timestamp = Date.now().toString();
        await AsyncStorage.setItem('resetScanner', timestamp);
        console.log('Signal sent to reset scanner tab - timestamp:', timestamp);
        
        // Verify the signal was stored
        const verification = await AsyncStorage.getItem('resetScanner');
        console.log('Signal verification - stored value:', verification);
      } catch (error) {
        console.error('Error signaling scanner reset:', error);
      }
    };

    const handleOpenLink = async (e: any) => {
      e.stopPropagation(); // Prevent triggering the main item press
      console.log('Open button clicked for item:', item.id);
      const urlToOpen = item.url || item.qrData;
      
      // Signal scanner to reset
      await signalScannerReset();
      
      // Check if it's a valid URL that can be opened
      if (urlToOpen && isOpenableUrl(urlToOpen)) {
        openLink(urlToOpen);
      } else {
        // For non-openable content, show an informative message
        Alert.alert('Cannot Open', 'This content cannot be opened as a link.');
      }
    };

    const handleRate = async (e: any) => {
      e.stopPropagation(); // Prevent triggering the main item press
      console.log('Rate button clicked for item:', item.id);
      
      // Signal scanner to reset
      await signalScannerReset();
      
      setSelectedEntry(item);
      setUserRating(item.userRating || null);
      setShowUserRating(true);
    };

    // Check if the QR data looks like a URL that can be opened
    const isOpenableUrl = (data: string): boolean => {
      if (!data || typeof data !== 'string') return false;
      const lowerData = data.toLowerCase();
      return lowerData.startsWith('http://') || 
             lowerData.startsWith('https://') || 
             lowerData.includes('.com') || 
             lowerData.includes('.org') || 
             lowerData.includes('.net') ||
             lowerData.includes('.edu') ||
             lowerData.includes('.gov');
    };

    const showButtons = !isSelectMode; // Show buttons when not in select mode

    return (
      <View style={styles.historyItemWrapper}>
        <View
          style={[
            styles.historyItem, 
            { 
              backgroundColor: colors.background, 
              borderColor: isSelected ? '#007AFF' : getStatusColor(item.safetyStatus, item.userOverride),
              borderWidth: isSelected ? 3 : (item.userOverride ? 3 : 1.5), // Thicker border for user overrides
              opacity: isSelectMode && !isSelected ? 0.6 : 1
            }
          ]}
        >
          {/* Selection indicator - make it clickable in select mode */}
          {isSelectMode && (
            <TouchableOpacity 
              style={styles.selectionIndicatorTouchable}
              onPress={handlePress}
              activeOpacity={0.7}
            >
              <View style={styles.selectionIndicator}>
                <View style={[
                  styles.selectionCircle,
                  { backgroundColor: isSelected ? '#007AFF' : 'transparent' }
                ]}>
                  {isSelected && (
                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Safety status at the top */}
          <View style={styles.topStatusContainer}>
            <View style={styles.statusContainer}>
              <ThemedText type="title" style={[styles.statusText, { fontSize: 20}]}>
                {typeof item.safetyStatus === 'string' ? 
                  (item.userOverride ? 
                    '★ ' + item.safetyStatus.charAt(0).toUpperCase() + item.safetyStatus.slice(1) :
                    item.safetyStatus.charAt(0).toUpperCase() + item.safetyStatus.slice(1)
                  ) : 
                  'Unknown'
                }
              </ThemedText>
              {/* Quick scan time indicator and mock tag */}
              <View style={styles.scanTimeContainer}>
                {item.scanDuration && (
                  <ThemedText style={styles.scanTime}>
                    ({Math.round(item.scanDuration / 100) / 10}s)
                  </ThemedText>
                )}
                {/* Mock tag for training data */}
                {item.isMockData && (
                  <View style={styles.mockTag}>
                    <ThemedText style={styles.mockTagText}>Mock</ThemedText>
                  </View>
                )}
                {/* User override indicator */}
              </View>
            </View>
            <ThemedText style={styles.timestamp}>
              {formatTimestamp(item.timestamp)}
            </ThemedText>
          </View>
          
          {/* Link/QR Data in the middle */}
          <ThemedText style={[styles.qrData, showButtons && { paddingRight: 140 }]} numberOfLines={1}>
            {truncateText(getQRDataString(item.qrData), showButtons ? 40 : 60)}
          </ThemedText>
          
          {/* VirusTotal score and Community votes below the link */}
          <View style={styles.bottomScoresContainer}>
            {/* Always show VirusTotal section, even if no data */}
            <View style={[
              styles.scoreCard,
              { 
                backgroundColor: !item.virusTotalResult 
                  ? '#9E9E9E' // Gray for unknown/unavailable
                  : item.virusTotalResult.positives === 0 ? '#2E7D32' : '#C62828' 
              }
            ]}>
              <SymbolView
                name="shield.checkered"
                size={16}
                type="monochrome"
                tintColor="#FFFFFF"
                fallback={<ThemedText style={styles.scoreIcon}>VT</ThemedText>}
              />
              <ThemedText style={styles.scoreCardText}>
                {!item.virusTotalResult 
                  ? ' Unknown' 
                  : item.virusTotalResult.positives === 0 ? ' Clean' : ' Threat'}
              </ThemedText>
            </View>
            
            {/* Always show Community rating section, even if no data */}
            <View style={styles.communityCard}>
              <SymbolView
                name="person.3"
                size={23}
                type="monochrome"
                tintColor="#000000"
                fallback={<ThemedText style={styles.scoreIcon}>U</ThemedText>}
              />
              <ThemedText style={styles.communityCardText}>
                {!item.communityRating || item.communityRating.safeVotes + item.communityRating.unsafeVotes === 0 
                  ? '  No votes yet' 
                  : (() => {
                      const safeVotes = item.communityRating.safeVotes || 0;
                      const unsafeVotes = item.communityRating.unsafeVotes || 0;
                      
                      if (safeVotes > unsafeVotes) {
                        return safeVotes === 1 ? `  ${safeVotes} safe vote` : `  ${safeVotes} safe votes`;
                      } else if (unsafeVotes > safeVotes) {
                        return unsafeVotes === 1 ? `  ${unsafeVotes} unsafe vote` : `  ${unsafeVotes} unsafe votes`;
                      } else {
                        // Equal votes, show safe votes by default
                        return safeVotes === 1 ? `  ${safeVotes} safe vote` : `  ${safeVotes} safe votes`;
                      }
                    })()}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Action Buttons - Rate and Open */}
        {(() => {
          console.log('Rendering button container for item:', item.id, 'showButtons:', showButtons, 'isSelectMode:', isSelectMode);
          return null;
        })()}
        {showButtons && (
          <View style={styles.historyActionButtonsContainer}>
            
            {/* Rate Button */}
            {(() => {
              console.log('Rate button rendered for item:', item.id);
              return null;
            })()}
            <TouchableOpacity
              style={styles.historyActionButton}
              onPress={handleRate}
              activeOpacity={0.7}
            >
              <SymbolView
                name="star.fill"
                size={18}
                type="monochrome"
                tintColor="#2672ffff"
                fallback={<ThemedText style={styles.historyActionButtonIcon}>★</ThemedText>}
              />
              <Text style={styles.historyActionButtonText}>Rate</Text>
            </TouchableOpacity>

            {/* Open Link Button */}
            {(() => {
              console.log('Open button rendered for item:', item.id);
              return null;
            })()}
            <TouchableOpacity
              style={styles.historyActionButton}
              onPress={handleOpenLink}
              activeOpacity={0.7}
            >
                <SymbolView
                  name="arrow.up.forward"
                  size={18}
                  type="monochrome"
                  tintColor="#00AA00"
                  fallback={<ThemedText style={styles.historyActionButtonIcon}>↗</ThemedText>}
                />
                <Text style={styles.historyActionButtonText}>Open</Text>
              </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderDetailsModal = () => {
    if (!selectedEntry) return null;

    return (
      <Modal
        visible={showDetails}
        animationType="slide"
        onRequestClose={() => setShowDetails(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <ScrollView style={styles.detailsContent}>
            <View style={styles.detailsHeader}>
              <ThemedText type="title">Scan Details</ThemedText>
              <TouchableOpacity
                onPress={() => setShowDetails(false)}
                style={styles.closeButton}
              >
                <ThemedText style={styles.closeButtonText}>X</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={[styles.statusCard, { backgroundColor: getStatusColor(selectedEntry.safetyStatus, selectedEntry.userOverride) }]}>
              <ThemedText style={styles.statusCardTitle}>
                {getStatusIcon(selectedEntry.safetyStatus)} {selectedEntry.userOverride ? '★ ' : ''}{selectedEntry.safetyStatus.toUpperCase()}
              </ThemedText>
              <ThemedText style={styles.statusCardTime}>
                Scanned {formatTimestamp(selectedEntry.timestamp)}
                {selectedEntry.userOverride && <ThemedText> • User Override</ThemedText>}
              </ThemedText>
            </View>

            <ThemedView style={styles.detailCard}>
              <ThemedText type="subtitle">QR Code Content</ThemedText>
              <ThemedText style={styles.qrContent} selectable>
                {getQRDataString(selectedEntry.qrData)}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.detailCard}>
              <ThemedText type="subtitle">VirusTotal Analysis</ThemedText>
              {selectedEntry.virusTotalResult ? (
                <>
                  <ThemedText>Status: {selectedEntry.virusTotalResult.isSecure ? 'Secure' : 'Threat Detected'}</ThemedText>
                  <ThemedText>Detections: {selectedEntry.virusTotalResult.positives}/{selectedEntry.virusTotalResult.total}</ThemedText>
                  <ThemedText style={styles.linkText} selectable>
                    Report: {selectedEntry.virusTotalResult.permalink}
                  </ThemedText>
                </>
              ) : (
                <ThemedText>Status: No VirusTotal data available</ThemedText>
              )}
            </ThemedView>

            <ThemedView style={styles.detailCard}>
              <ThemedText type="subtitle">Community Rating</ThemedText>
              {selectedEntry.communityRating ? (
                <>
                  <ThemedText>Confidence: {Math.round(selectedEntry.communityRating.confidence * 100)}%</ThemedText>
                  <ThemedText>Safe votes: {selectedEntry.communityRating.safeVotes}</ThemedText>
                  <ThemedText>Unsafe votes: {selectedEntry.communityRating.unsafeVotes}</ThemedText>
                </>
              ) : (
                <>
                  <ThemedText>Confidence: No community data available</ThemedText>
                  <ThemedText>Safe votes: 0</ThemedText>
                  <ThemedText>Unsafe votes: 0</ThemedText>
                </>
              )}
            </ThemedView>

            <ThemedView style={styles.detailCard}>
              <ThemedText type="subtitle">User Tag</ThemedText>
              <View style={styles.tagContainer}>
                <ThemedText>Current tag: {selectedEntry.userRating || 'None'}</ThemedText>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.tint }]}
                  onPress={() => setEditingTag(selectedEntry.id)}
                >
                  <ThemedText style={styles.buttonText}>Edit Tag</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={() => {
                  setShowDetails(false);
                  deleteEntry(selectedEntry.id);
                }}
              >
                <ThemedText style={styles.buttonText}>Delete Entry</ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </ThemedView>
      </Modal>
    );
  };

  const renderUserRatingModal = () => {
    if (!selectedEntry) return null;

    return (
      <Modal
        visible={showUserRating}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowUserRating(false);
          setSelectedEntry(null);
          setUserRating(null);
        }}
      >
        <View style={styles.userRatingOverlay}>
          <ThemedView style={styles.userRatingModalContent}>
            <ThemedText type="subtitle" style={styles.userRatingModalTitle}>
              {isSelectMode && selectedEntries.size > 1 
                ? `Rate ${selectedEntries.size} QR codes` 
                : 'Rate this QR code'}
            </ThemedText>
            
            <ThemedText style={styles.qrDataPreview} numberOfLines={2}>
              {truncateText(getQRDataString(selectedEntry.qrData), 80)}
            </ThemedText>
            
            <ThemedText style={styles.userRatingInstructions}>
              What do you think about this QR code's safety?
            </ThemedText>

            <View style={styles.ratingButtonsContainer}>
              <TouchableOpacity 
                style={[
                  styles.ratingButton,
                  styles.safeButton,
                  userRating === 'safe' && styles.selectedButton
                ]}
                onPress={() => {
                  const newRating = userRating === 'safe' ? null : 'safe';
                  setUserRating(newRating);
                  if (selectedEntry) {
                    if (isSelectMode && selectedEntries.size > 0) {
                      // Bulk update all selected entries
                      updateBulkUserTags(Array.from(selectedEntries), newRating);
                    } else {
                      // Single entry update
                      updateUserTag(selectedEntry.id, newRating);
                    }
                  }
                }}
              >
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
                  const newRating = userRating === 'unsafe' ? null : 'unsafe';
                  setUserRating(newRating);
                  if (selectedEntry) {
                    if (isSelectMode && selectedEntries.size > 0) {
                      // Bulk update all selected entries
                      updateBulkUserTags(Array.from(selectedEntries), newRating);
                    } else {
                      // Single entry update
                      updateUserTag(selectedEntry.id, newRating);
                    }
                  }
                }}
              >
                <Text style={[
                  styles.ratingButtonText,
                  userRating === 'unsafe' && styles.selectedButtonText
                ]}>
                  Unsafe
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setShowUserRating(false);
                setSelectedEntry(null);
                setUserRating(null);
              }}
            >
              <ThemedText style={[styles.buttonText]}>Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>
    );
  };

  const renderTagEditModal = () => (
    <Modal
      visible={editingTag !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setEditingTag(null)}
    >
      <View style={styles.tagModalOverlay}>
        <ThemedView style={styles.tagModalContent}>
          <ThemedText type="subtitle" style={styles.tagModalTitle}>
            Update User Tag
          </ThemedText>
          <View style={styles.tagOptions}>
            <TouchableOpacity
              style={[styles.tagOption, { backgroundColor: '#4CAF50' }]}
              onPress={() => editingTag && updateUserTag(editingTag, 'safe')}
            >
              <ThemedText style={styles.tagOptionText}>Safe</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tagOption, { backgroundColor: '#F44336' }]}
              onPress={() => editingTag && updateUserTag(editingTag, 'unsafe')}
            >
              <ThemedText style={styles.tagOptionText}>Unsafe</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tagOption, { backgroundColor: '#9E9E9E' }]}
              onPress={() => editingTag && updateUserTag(editingTag, null)}
            >
              <ThemedText style={styles.tagOptionText}>Remove Tag</ThemedText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setEditingTag(null)}
          >
            <ThemedText style={[styles.buttonText, { color: colors.tint }]}>Cancel</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      onRequestClose={() => setShowSettings(false)}
    >
      <ThemedView style={styles.modalContainer}>
        <ScrollView style={styles.detailsContent}>
          <View style={styles.detailsHeader}>
            <View style={styles.headerSpacer} />
            <ThemedText type="subtitle" style={styles.centeredTitle}>Settings</ThemedText>
            <TouchableOpacity
              onPress={() => setShowSettings(false)}
              style={styles.doneButton}
            >
              <ThemedText style={styles.doneButtonText}>Done</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Data Export Section */}
          <ThemedText style={styles.firstSectionTitle}>Data Export</ThemedText>
          
          <TouchableOpacity
            style={styles.settingsListItem}
            onPress={exportToCSV}
          >
            <View style={styles.settingsItemContent}>
              <View style={styles.settingsItemTextContainer}>
                <ThemedText style={styles.settingsItemTitle}>Export as CSV</ThemedText>
                <ThemedText style={styles.settingsItemSubtitle}>
                  Download scan history in spreadsheet format
                </ThemedText>
              </View>
              <ThemedText style={styles.chevronText}>›</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsListItem}
            onPress={exportToJSON}
          >
            <View style={styles.settingsItemContent}>
              <View style={styles.settingsItemTextContainer}>
                <ThemedText style={styles.settingsItemTitle}>Export as JSON</ThemedText>
                <ThemedText style={styles.settingsItemSubtitle}>
                  Download full data with metadata
                </ThemedText>
              </View>
              <ThemedText style={styles.chevronText}>›</ThemedText>
            </View>
          </TouchableOpacity>

          {/* Data Management Section */}
          <ThemedText style={styles.settingsSectionTitle}>Data Management</ThemedText>
          
          <TouchableOpacity
            style={styles.settingsListItem}
            onPress={getStorageInfo}
          >
            <View style={styles.settingsItemContent}>
              <View style={styles.settingsItemTextContainer}>
                <ThemedText style={styles.settingsItemTitle}>Storage Information</ThemedText>
                <ThemedText style={styles.settingsItemSubtitle}>
                  View data usage and statistics
                </ThemedText>
              </View>
              <ThemedText style={styles.chevronText}>›</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsListItem}
            onPress={() => {
              clearHistory();
            }}
          >
            <View style={styles.settingsItemContent}>
              <View style={styles.settingsItemTextContainer}>
                <ThemedText style={styles.settingsItemTitle}>Clear All History</ThemedText>
                <ThemedText style={styles.settingsItemSubtitle}>
                  Permanently delete all scan records
                </ThemedText>
              </View>
              <ThemedText style={styles.chevronText}>›</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsListItem}
            onPress={() => {
              importMockScans();
            }}
          >
            <View style={styles.settingsItemContent}>
              <View style={styles.settingsItemTextContainer}>
                <ThemedText style={styles.settingsItemTitle}>Import Mock Scans</ThemedText>
                <ThemedText style={styles.settingsItemSubtitle}>
                  Add sample scan data for demonstration
                </ThemedText>
              </View>
              <ThemedText style={styles.chevronText}>›</ThemedText>
            </View>
          </TouchableOpacity>

          {/* Privacy Section */}
          <ThemedText style={styles.settingsSectionTitle}>Privacy</ThemedText>
          
          <TouchableOpacity
            style={styles.settingsListItem}
            onPress={() => {
              Alert.alert(
                'Privacy Information',
                'SafeScan processes QR codes locally on your device. Scan history is stored only on your device and is not transmitted to external servers unless you explicitly export it.\n\nVirusTotal integration (when available) may send URLs to VirusTotal for security analysis. Community ratings are aggregated anonymously.',
                [{ text: 'OK' }]
              );
            }}
          >
            <View style={styles.settingsItemContent}>
              <View style={styles.settingsItemTextContainer}>
                <ThemedText style={styles.settingsItemTitle}>Privacy Policy</ThemedText>
                <ThemedText style={styles.settingsItemSubtitle}>
                  How we handle your data
                </ThemedText>
              </View>
              <ThemedText style={styles.chevronText}>›</ThemedText>
            </View>
          </TouchableOpacity>

          {/* Logo and Version Footer */}
          <View style={styles.logoFooter}>
            <Image 
              source={require('@/assets/images/Icon-Light.png')} 
              style={styles.footerLogoImage}
              resizeMode="contain"
            />
            <View style={styles.versionContainer}>
              <ThemedText style={styles.versionText}>Version 1.0.0</ThemedText>
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    </Modal>
  );

  const onRefresh = async () => {
    console.log('History refresh triggered by pull-to-refresh');
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
    console.log('History refresh completed');
  };

  if (isLoading) {
    console.log('Displaying loading screen');
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading scan history...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  console.log('Rendering history screen with', filteredHistory.length, 'visible entries');

  return (
    <ThemedView style={styles.container}>
      {/* Header with SafeScan logo and settings (copied from scanner tab) */}
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
            console.log('Settings button pressed');
            setShowSettings(true);
          }}
        >
          <SymbolView 
            name="gear" 
            size={35}
            tintColor="#FFFFFF" 
          />
        </TouchableOpacity>
      </View>

      {/* History section with title and action icons (below main header) */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>History</ThemedText>
        <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: '#D3D3D3'}]}
              onPress={() => {
              console.log('Select mode toggled, current state:', isSelectMode);
              setIsSelectMode(!isSelectMode);
              setSelectedEntries(new Set()); // Clear selections when toggling
              }}
            >
              <ThemedText style={[styles.selectButtonText, { color: '#007AFF' }]}>
              {isSelectMode ? 'Cancel' : 'Select'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: '#D3D3D3', marginRight: 8 }]}
              onPress={() => {
                console.log('Filter toggle pressed, current state:', showFilters);
                setShowFilters(!showFilters);
              }}
            >
              <SymbolView
              name="slider.horizontal.3"
              size={24}
              type="monochrome"
              tintColor="#007AFF"
              fallback={<ThemedText style={styles.quickButtonText}>Filter</ThemedText>}
              />
            </TouchableOpacity>
        </View>
      </View>

      {showFilters && (
        <ThemedView style={styles.filterContainer}>
          <TextInput
            style={[styles.searchInput, { borderColor: colors.tabIconDefault, color: colors.text }]}
            placeholder="Quick search..."
            placeholderTextColor={colors.tabIconDefault}
            value={searchQuery}
            onChangeText={(text) => {
              console.log('Search query changed to:', text);
              setSearchQuery(text);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.quickFilters}>
            {[
              { key: 'all', label: 'All', symbol: 'list.bullet' as const },
              { key: 'safe', label: 'Safe', symbol: 'checkmark.shield.fill' as const },
              { key: 'unsafe', label: 'Unsafe', symbol: 'xmark.shield.fill' as const },
              { key: 'unknown', label: 'Unknown', symbol: 'questionmark.circle.fill' as const }
            ].map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.quickFilterButton,
                  { 
                    backgroundColor: selectedFilter === filter.key ? getStatusColor(filter.key === 'all' ? 'safe' : filter.key) : 'transparent',
                    borderColor: getStatusColor(filter.key === 'all' ? 'safe' : filter.key),
                    borderWidth: 1.5
                  }
                ]}
                onPress={() => {
                  console.log('Filter selected:', filter.key);
                  setSelectedFilter(filter.key as any);
                }}
              >
                <View style={styles.filterButtonContent}>
                  <SymbolView
                    name={filter.symbol}
                    size={16}
                    type="hierarchical"
                    tintColor={selectedFilter === filter.key ? '#fff' : getStatusColor(filter.key === 'all' ? 'safe' : filter.key)}
                    fallback={
                    <ThemedText style={{ color: selectedFilter === filter.key ? '#fff' : getStatusColor(filter.key === 'all' ? 'safe' : filter.key) }}>
                        {filter.label}
                      </ThemedText>
                    }
                  />
                  <ThemedText style={[
                    styles.quickFilterText,
                    { color: selectedFilter === filter.key ? '#fff' : getStatusColor(filter.key === 'all' ? 'safe' : filter.key) }
                  ]}>
                    {filter.label}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>
      )}

      <ThemedView style={styles.statsContainer}>
        <ThemedText style={styles.statsText}>
          {filteredHistory.length} of {history.length} scans
        </ThemedText>
        <View style={styles.quickStats}>
          <ThemedText style={[styles.quickStat, { color: '#00E676' }]}>
            Safe {history.filter(h => h.safetyStatus === 'safe').length}
          </ThemedText>
          <ThemedText style={[styles.quickStat, { color: '#FF1744' }]}>
            Unsafe {history.filter(h => h.safetyStatus === 'unsafe').length}
          </ThemedText>
          <ThemedText style={[styles.quickStat, { color: '#FFC107' }]}>
            Unknown {history.filter(h => h.safetyStatus === 'unknown').length}
          </ThemedText>
        </View>
      </ThemedView>

      {filteredHistory.length === 0 ? (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyTitle}>
            {history.length === 0 ? 'No scans yet!' : 'No matches found'}
          </ThemedText>
          <ThemedText style={styles.emptyText}>
            {history.length === 0 
              ? 'Start scanning QR codes to build your history'
              : 'Try adjusting your search or filters'
            }
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={filteredHistory}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          style={styles.historyList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bulk action buttons - only show when in select mode and have selections */}
      {isSelectMode && selectedEntries.size > 0 && (
        <View style={styles.bulkActionContainer}>
          <TouchableOpacity
            style={styles.bulkActionButton}
            onPress={handleBulkRate}
          >
            <ThemedText style={styles.bulkActionText}>Rate</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bulkActionButton, styles.deleteActionButton]}
            onPress={handleBulkDelete}
          >
            <ThemedText style={[styles.bulkActionText, styles.deleteActionText]}>Trash</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {renderDetailsModal()}
      {renderUserRatingModal()}
      {renderTagEditModal()}
      {renderSettingsModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0, // Changed to 0 to reach the very top
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
    backgroundColor: '#007031', // Green background to match app theme
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 25, // Add top padding for status bar/notch
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 130 : 100, // Increased padding for more space from green header
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 16,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  filterContainer: {
    padding: 16,
    paddingTop: 0,
  },
  searchInput: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  quickFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickFilterText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickStats: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStat: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  scanTime: {
    fontSize: 10,
    opacity: 0.6,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  historyList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historyItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    flex: 1,
  },
  //Open Link Button
  historyItemWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  historyActionButton: {
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D4D4D4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  historyActionButtonIcon: {
    fontSize: 18,
    color: '#00AA00',
  },
  historyActionButtonText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#333333',
    marginTop: 1,
  },
  topStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statusText: {
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.6,
  },
  qrData: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 18,
    fontWeight: '500',
  },
  bottomScoresContainer: {
    gap: 4,
    marginTop: 4,
  },
  scoreIcon: {
    fontSize: 14,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  scoreCardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 0,
  },
  communityCardText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsContent: {
    flex: 1,
    paddingVertical: 16,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusCardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusCardTime: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  detailCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  qrContent: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 4,
  },
  tagContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtons: {
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00000',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  tagModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagModalContent: {
    width: '80%',
    padding: 24,
    borderRadius: 12,
    maxWidth: 400,
  },
  tagModalTitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  tagOptions: {
    gap: 12,
    marginBottom: 20,
  },
  tagOption: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  tagOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsSection: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
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
  settingsOptionButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButtonIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsButtonTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingsButtonTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingsButtonSubtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.9,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  settingsFooter: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
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
  settingsItemIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
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
  headerSpacer: {
    width: 60, // Same width as the Done button to balance the layout
  },
  centeredTitle: {
    textAlign: 'center',
    flex: 1,
  },
  doneButton: {
    padding: 6,
    width: 60,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  scanTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  mockTag: {
    backgroundColor: '#666666',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 18,
  },
  mockTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userRatingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  userRatingModalContent: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  userRatingModalTitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  qrDataPreview: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333',
  },
  userRatingInstructions: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    lineHeight: 20,
  },
  ratingButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  ratingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    minWidth: 100,
    justifyContent: 'center',
  },
  safeButton: {
    backgroundColor: 'transparent',
    borderColor: '#2E7D32',
  },
  unsafeButton: {
    backgroundColor: 'transparent',
    borderColor: '#C62828',
  },
  selectedButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  selectButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectionIndicatorTouchable: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    padding: 4, // Increase touch area
  },
  historyActionButtonsContainer: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -25 }], // Center vertically
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10, // Bring buttons to front
  },
  bulkActionContainer: {
    position: 'absolute',
    bottom: 90, // Moved up to be above the tab bar (typically 80-90px height)
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bulkActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionButton: {
    backgroundColor: '#FF3B30',
  },
  bulkActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteActionText: {
    color: '#FFFFFF',
  },
});
