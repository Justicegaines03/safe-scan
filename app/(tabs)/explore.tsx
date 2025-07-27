import React, { useState, useEffect } from 'react';
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
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Types
interface ScanHistoryEntry {
  id: string;
  qrData: string;
  url?: string;
  timestamp: number;
  safetyStatus: 'safe' | 'unsafe' | 'unknown';
  virusTotalResult?: {
    isSecure: boolean;
    positives: number;
    total: number;
    scanId: string;
    permalink: string;
  };
  communityRating?: {
    confidence: number;
    safeVotes: number;
    unsafeVotes: number;
  };
  userTag?: 'safe' | 'unsafe' | null;
  scanDuration?: number;
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

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [history, searchQuery, selectedFilter]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      
      // Force regenerate mock data to ensure consistency between devices
      const mockData = generateMockHistory();
      setHistory(mockData);
      // Save the mock data
      await saveHistory(mockData);
      
    } catch (error) {
      console.error('Error loading history:', error);
      // Generate mock data on error for development
      const mockData = generateMockHistory();
      setHistory(mockData);
    } finally {
      setIsLoading(false);
    }
  };

  const saveHistory = async (newHistory: ScanHistoryEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

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
        userTag: 'safe',
        scanDuration: 1200
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
        userTag: 'unsafe',
        scanDuration: 2800
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
        userTag: null,
        scanDuration: 650
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
        userTag: 'safe',
        scanDuration: 980
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
        userTag: 'safe',
        scanDuration: 450
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
        userTag: null,
        scanDuration: 3200
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
        userTag: 'safe',
        scanDuration: 1100
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
        userTag: null,
        scanDuration: 320
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
        userTag: 'unsafe',
        scanDuration: 4500
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
        userTag: null,
        scanDuration: 850
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
        userTag: 'safe',
        scanDuration: 580
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
        userTag: null,
        scanDuration: 410
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
        userTag: 'unsafe',
        scanDuration: 5200
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
        userTag: 'safe',
        scanDuration: 920
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
        userTag: null,
        scanDuration: 380
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
      entry.id === entryId ? { ...entry, userTag: newTag } : entry
    );
    setHistory(updatedHistory);
    await saveHistory(updatedHistory);
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
            await saveHistory(updatedHistory);
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
          {/* Quick scan time indicator */}
          {item.scanDuration && (
            <ThemedText style={styles.scanTime}>
              ({Math.round(item.scanDuration / 100) / 10}s)
            </ThemedText>
          )}
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
                <ThemedText>Current tag: {selectedEntry.userTag || 'None'}</ThemedText>
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
              // { key: 'all', label: 'All', symbol: 'list.bullet' as const },
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
                  {filter.key === 'all' && (
                    <SymbolView
                      name={filter.symbol}
                      size={16}
                      type="hierarchical"
                      tintColor={selectedFilter === filter.key ? '#fff' : getStatusColor(filter.key === 'all' ? 'safe' : filter.key)}
                      fallback={
                      <ThemedText style={{ color: selectedFilter === filter.key ? '#fff' : getStatusColor(filter.key === 'all' ? 'safe' : filter.key) }}>
                          All
                        </ThemedText>
                      }
                    />
                  )}
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
            Warning {history.filter(h => h.safetyStatus === 'unknown').length}
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
  },
  detailsContent: {
    flex: 1,
    padding: 16,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
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
});
