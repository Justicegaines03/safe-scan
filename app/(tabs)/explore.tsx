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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

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

export default function ScanHistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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

  // Reloads history every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  // Runs whenever the history data changes
  useEffect(() => {
    applyFilters();
  }, [history, searchQuery, selectedFilter]);

//History Tab
  //Loads the History tab
  const loadHistory = async () => {
    try {
      setIsLoading(true);
      
      /// Load existing history from storage
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      let existingHistory: ScanHistoryEntry[] = data ? JSON.parse(data) : [];
      
      /// Separate real scans from mock data
      const existingMockData = existingHistory.filter(entry => entry.isMockData);
      const realScans = existingHistory.filter(entry => !entry.isMockData);
      
      /// Combine real scans (newest first) with mock data
      const combinedHistory = [...realScans, ...existingMockData];
      
      /// Sort by timestamp (newest first)
      combinedHistory.sort((a, b) => b.timestamp - a.timestamp);
      
      setHistory(combinedHistory);
      
      
    } catch (error) {
      console.error('Error loading history:', error);
      // Generate mock data on error for development
      const mockData = generateMockHistory();
      setHistory(mockData);
    } finally {
      setIsLoading(false);
    }
  };

  // Updates the History tab with real scans
  const updateHistory = async (newHistory: ScanHistoryEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  // Mock scans for user education
  const generateMockHistory = (): ScanHistoryEntry[] => {
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
    return mockEntries;
  };

  const applyFilters = () => {
    let filtered = [...history];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.qrData.toLowerCase().includes(query) ||
        entry.url?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(entry => entry.safetyStatus === selectedFilter);
    }

    setFilteredHistory(filtered);
  };

  const updateUserTag = async (entryId: string, newTag: 'safe' | 'unsafe' | null) => {
    const updatedHistory = history.map(entry => 
      entry.id === entryId ? { ...entry, userRating: newTag } : entry
    );
    setHistory(updatedHistory);
    await updateHistory(updatedHistory);
    setEditingTag(null);
  };

  const deleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this scan from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedHistory = history.filter(entry => entry.id !== entryId);
            setHistory(updatedHistory);
            await updateHistory(updatedHistory);
          }
        }
      ]
    );
  };

  const exportHistory = async () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalEntries: history.length,
        entries: history
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      
      if (Platform.OS === 'web') {
        // For web, create download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `safe_scan_history_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      } else {
        // For mobile, use Share API
        await Share.share({
          message: jsonString,
          title: 'SafeScan History Export'
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export history');
    }
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all scan history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setHistory([]);
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      ]
    );
  };

  const exportToCSV = async () => {
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
        
        return `${escapeCSV(entry.id)},${escapeCSV(entry.qrData)},${escapeCSV(url)},${entry.timestamp},${escapeCSV(date)},${escapeCSV(entry.safetyStatus)},${escapeCSV(vtSecure)},${escapeCSV(vtPositives)},${escapeCSV(vtTotal)},${escapeCSV(communitySafe)},${escapeCSV(communityUnsafe)},${escapeCSV(communityConf)},${escapeCSV(userRating)},${escapeCSV(scanDuration)}`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      const fileName = `safescan_history_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (Platform.OS === 'web') {
        // For web, create download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // For mobile, use Share API
        const result = await Share.share({
          message: csvContent,
          title: 'SafeScan History CSV Export'
        });
        
        // Only show success if share was not dismissed/cancelled
        if (result.action === Share.sharedAction) {
          Alert.alert('Success', `Exported ${history.length} scans to CSV format`);
        }
        return; // Exit early to avoid showing alert below
      }
      
      Alert.alert('Success', `Exported ${history.length} scans to CSV format`);
    } catch (error) {
      console.error('CSV Export Error:', error);
      Alert.alert('Error', 'Failed to export CSV file');
    }
  };

  const exportToJSON = async () => {
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
      
      if (Platform.OS === 'web') {
        // For web, create download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // For mobile, use Share API
        const result = await Share.share({
          message: jsonString,
          title: 'SafeScan History JSON Export'
        });
        
        // Only show success if share was not dismissed/cancelled
        if (result.action === Share.sharedAction) {
          Alert.alert('Success', `Exported ${history.length} scans to JSON format`);
        }
        return; // Exit early to avoid showing alert below
      }
      
      Alert.alert('Success', `Exported ${history.length} scans to JSON format`);
    } catch (error) {
      console.error('JSON Export Error:', error);
      Alert.alert('Error', 'Failed to export JSON file');
    }
  };

  const getStorageInfo = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const safeScanKeys = keys.filter(key => key.includes('safe_scan'));
      
      let totalSize = 0;
      for (const key of safeScanKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
      
      const sizeInKB = (totalSize / 1024).toFixed(2);
      
      Alert.alert(
        'Storage Information',
        `History Entries: ${history.length}\nStorage Keys: ${safeScanKeys.length}\nApproximate Size: ${sizeInKB} KB\n\nOldest Entry: ${history.length > 0 ? new Date(Math.min(...history.map(h => h.timestamp))).toLocaleDateString() : 'None'}\nNewest Entry: ${history.length > 0 ? new Date(Math.max(...history.map(h => h.timestamp))).toLocaleDateString() : 'None'}`
      );
    } catch (error) {
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

  const getStatusColor = (status: string) => {
    // Bold colors for instant recognition
    switch (status) {
      case 'safe': return '#00E676';   // Bright green
      case 'unsafe': return '#FF1744'; // Bright red
      case 'unknown': return '#FFC107'; // Bright yellow
      default: return '#FFC107';
    }
  };

  const renderHistoryItem = ({ item }: { item: ScanHistoryEntry }) => (
    <TouchableOpacity
      style={[styles.historyItem, { 
        backgroundColor: colors.background, 
        borderColor: getStatusColor(item.safetyStatus),
        borderWidth: 1.5
      }]}
      onPress={() => {
        setSelectedEntry(item);
        setShowDetails(true);
      }}
      activeOpacity={0.7}
    >
      {/* Safety status at the top */}
      <View style={styles.topStatusContainer}>
        <View style={styles.statusContainer}>
          <ThemedText type="title" style={[styles.statusText, { fontSize: 20}]}>
            {item.safetyStatus.charAt(0).toUpperCase() + item.safetyStatus.slice(1)}
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
          </View>
        </View>
        <ThemedText style={styles.timestamp}>
          {formatTimestamp(item.timestamp)}
        </ThemedText>
      </View>
      
      {/* Link/QR Data in the middle */}
      <ThemedText style={styles.qrData} numberOfLines={1}>
        {truncateText(item.qrData, 60)}
      </ThemedText>
      
      {/* VirusTotal score and Community votes below the link */}
      <View style={styles.bottomScoresContainer}>
        {item.virusTotalResult && (
          <View style={[
            styles.scoreCard,
            { backgroundColor: item.virusTotalResult.positives === 0 ? '#2E7D32' : '#C62828' }
          ]}>
            <SymbolView
              name="shield.checkered"
              size={16}
              type="monochrome"
              tintColor="#FFFFFF"
              fallback={<ThemedText style={styles.scoreIcon}>VT</ThemedText>}
            />
            <ThemedText style={styles.scoreCardText}>
              {item.virusTotalResult.positives === 0 ? ' Clean' : ' Threat'}
            </ThemedText>
          </View>
        )}
        {item.communityRating && (
          <View style={styles.communityCard}>
            <SymbolView
              name="person.3"
              size={23}
              type="monochrome"
              tintColor="#000000"
              fallback={<ThemedText style={styles.scoreIcon}>U</ThemedText>}
            />
            <ThemedText style={styles.communityCardText}>
              {item.communityRating.safeVotes + item.communityRating.unsafeVotes === 0 
                ? '  No votes yet' 
                : item.communityRating.safeVotes === 1 
                  ? `  ${item.communityRating.safeVotes} safe vote`
                  : `  ${item.communityRating.safeVotes} safe votes`}
            </ThemedText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

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

            <View style={[styles.statusCard, { backgroundColor: getStatusColor(selectedEntry.safetyStatus) }]}>
              <ThemedText style={styles.statusCardTitle}>
                {getStatusIcon(selectedEntry.safetyStatus)} {selectedEntry.safetyStatus.toUpperCase()}
              </ThemedText>
              <ThemedText style={styles.statusCardTime}>
                Scanned {formatTimestamp(selectedEntry.timestamp)}
              </ThemedText>
            </View>

            <ThemedView style={styles.detailCard}>
              <ThemedText type="subtitle">QR Code Content</ThemedText>
              <ThemedText style={styles.qrContent} selectable>
                {selectedEntry.qrData}
              </ThemedText>
            </ThemedView>

            {selectedEntry.virusTotalResult && (
              <ThemedView style={styles.detailCard}>
                <ThemedText type="subtitle">VirusTotal Analysis</ThemedText>
                <ThemedText>Status: {selectedEntry.virusTotalResult.isSecure ? 'Secure' : 'Threat Detected'}</ThemedText>
                <ThemedText>Detections: {selectedEntry.virusTotalResult.positives}/{selectedEntry.virusTotalResult.total}</ThemedText>
                <ThemedText style={styles.linkText} selectable>
                  Report: {selectedEntry.virusTotalResult.permalink}
                </ThemedText>
              </ThemedView>
            )}

            {selectedEntry.communityRating && (
              <ThemedView style={styles.detailCard}>
                <ThemedText type="subtitle">Community Rating</ThemedText>
                <ThemedText>Confidence: {Math.round(selectedEntry.communityRating.confidence * 100)}%</ThemedText>
                <ThemedText>Safe votes: {selectedEntry.communityRating.safeVotes}</ThemedText>
                <ThemedText>Unsafe votes: {selectedEntry.communityRating.unsafeVotes}</ThemedText>
              </ThemedView>
            )}

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
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading scan history...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

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
          onPress={() => setShowSettings(true)}
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
              style={[styles.quickButton, { backgroundColor: 'transparent', marginRight: 8 }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <SymbolView
              name="line.3.horizontal.decrease.circle"
              size={35}
              type="monochrome"
              tintColor="#000000"
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
            onChangeText={setSearchQuery}
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
                onPress={() => setSelectedFilter(filter.key as any)}
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

      {renderDetailsModal()}
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
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
    padding: 8,
    width: 60,
    alignItems: 'center',
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
});
