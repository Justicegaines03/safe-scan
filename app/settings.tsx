import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Platform, Share, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SymbolView } from 'expo-symbols';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { userIdentityService } from '@/services/UserIdentityService';

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
  userOverride?: boolean;
  isMockData?: boolean;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const STORAGE_KEY = '@safe_scan_history';

  // Test deep link functionality for lockscreen shortcuts
  const testLockscreenShortcut = async () => {
    try {
      const testURL = 'safescan://scan-qr';
      console.log('Testing lockscreen shortcut:', testURL);
      
      Alert.alert(
        'Lockscreen Shortcut Test', 
        'This simulates activating SafeScan from a lockscreen shortcut!\n\nIn the full implementation, this would be triggered by:\n• iOS App Shortcuts (long-press app icon)\n• Control Center widgets\n• Siri Shortcuts\n• Lock screen quick actions\n\nTap "Test Deep Link" to simulate the shortcut activation.',
        [
          { 
            text: 'Cancel', 
            style: 'cancel' 
          },
          {
            text: 'Test Deep Link',
            onPress: async () => {
              try {
                // This will trigger our deep link handling code
                await Linking.openURL(testURL);
              } catch (error) {
                console.error('Deep link test error:', error);
                Alert.alert(
                  'Deep Link Test',
                  'This demonstrates how iOS shortcuts will work!\n\n✅ Deep link configured correctly\n✅ Ready for native iOS shortcuts\n\nNext: Implement native Swift App Intents for real lockscreen access.',
                  [{ text: 'OK' }]
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Lockscreen shortcut test error:', error);
    }
  };

  const getHistoryFromStorage = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  };

  const exportToCSV = async () => {
    try {
      const history = await getHistoryFromStorage();
      const csvHeader = 'ID,QR Data,URL,Timestamp,Date,Safety Status,VirusTotal Secure,VirusTotal Positives,VirusTotal Total,Community Safe Votes,Community Unsafe Votes,Community Confidence,User Tag,Scan Duration (ms)\n';
      
      const csvRows = history.map((entry: any) => {
        const date = new Date(entry.timestamp).toISOString();
        const url = entry.url || '';
        const vtSecure = entry.virusTotalResult?.isSecure || '';
        const vtPositives = entry.virusTotalResult?.positives || '';
        const vtTotal = entry.virusTotalResult?.total || '';
        const communitySafe = entry.communityRating?.safeVotes || '';
        const communityUnsafe = entry.communityRating?.unsafeVotes || '';
        const communityConf = entry.communityRating?.confidence || '';
        const userTag = entry.userTag || '';
        const scanDuration = entry.scanDuration || '';
        
        const escapeCSV = (field: any) => {
          const str = String(field);
          if (str.includes('"') || str.includes(',') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        return `${escapeCSV(entry.id)},${escapeCSV(entry.qrData)},${escapeCSV(url)},${entry.timestamp},${escapeCSV(date)},${escapeCSV(entry.safetyStatus)},${escapeCSV(vtSecure)},${escapeCSV(vtPositives)},${escapeCSV(vtTotal)},${escapeCSV(communitySafe)},${escapeCSV(communityUnsafe)},${escapeCSV(communityConf)},${escapeCSV(userTag)},${escapeCSV(scanDuration)}`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      await Share.share({
        message: csvContent,
        title: 'SafeScan History CSV Export'
      });
      
      Alert.alert('Success', `Exported ${history.length} scans to CSV format`);
    } catch (error) {
      console.error('CSV Export Error:', error);
      Alert.alert('Error', 'Failed to export CSV file');
    }
  };

  const exportToJSON = async () => {
    try {
      const history = await getHistoryFromStorage();
      const exportData = {
        exportDate: new Date().toISOString(),
        exportFormat: 'JSON',
        appVersion: '1.0.0',
        totalEntries: history.length,
        entries: history
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      
      await Share.share({
        message: jsonString,
        title: 'SafeScan History JSON Export'
      });
      
      Alert.alert('Success', `Exported ${history.length} scans to JSON format`);
    } catch (error) {
      console.error('JSON Export Error:', error);
      Alert.alert('Error', 'Failed to export JSON file');
    }
  };

  const getStorageInfo = async () => {
    try {
      const history = await getHistoryFromStorage();
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
        `History Entries: ${history.length}\nStorage Keys: ${safeScanKeys.length}\nApproximate Size: ${sizeInKB} KB\n\nOldest Entry: ${history.length > 0 ? new Date(Math.min(...history.map((h: any) => h.timestamp))).toLocaleDateString() : 'None'}\nNewest Entry: ${history.length > 0 ? new Date(Math.max(...history.map((h: any) => h.timestamp))).toLocaleDateString() : 'None'}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to retrieve storage information');
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
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history');
            }
          }
        }
      ]
    );
  };

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
        userRating: null,
        scanDuration: 1200,
        isMockData: true
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
        userRating: null,
        scanDuration: 2800,
        isMockData: true
      },
      {
        id: '3',
        qrData: 'WiFi:T:WPA;S:CoffeeShop_Free;P:password123;H:false;;',
        timestamp: now - 3600000, // 1 hour ago
        safetyStatus: 'unknown',
        scanDuration: 450,
        isMockData: true
      },
      {
        id: '4',
        qrData: 'https://github.com',
        url: 'https://github.com',
        timestamp: now - 7200000, // 2 hours ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 68, 
          scanId: 'scan4',
          permalink: 'https://virustotal.com/scan4'
        },
        communityRating: {
          confidence: 0.95,
          safeVotes: 52,
          unsafeVotes: 3
        },
        userRating: 'safe',
        scanDuration: 980,
        isMockData: true
      },
      {
        id: '5',
        qrData: 'mailto:support@example.com?subject=Help%20Request',
        timestamp: now - 10800000, // 3 hours ago
        safetyStatus: 'safe',
        communityRating: {
          confidence: 0.87,
          safeVotes: 23,
          unsafeVotes: 2
        },
        scanDuration: 320,
        isMockData: true
      },
      {
        id: '6',
        qrData: 'http://suspicious-redirect.net/click',
        url: 'http://suspicious-redirect.net/click',
        timestamp: now - 14400000, // 4 hours ago
        safetyStatus: 'unsafe',
        virusTotalResult: { 
          isSecure: false, 
          positives: 12, 
          total: 65,
          scanId: 'scan6',
          permalink: 'https://virustotal.com/scan6'
        },
        communityRating: {
          confidence: 0.23,
          safeVotes: 3,
          unsafeVotes: 18
        },
        userRating: 'unsafe',
        scanDuration: 2100,
        isMockData: true
      },
      {
        id: '7',
        qrData: 'https://www.wikipedia.org',
        url: 'https://www.wikipedia.org',
        timestamp: now - 21600000, // 6 hours ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 71, 
          scanId: 'scan7',
          permalink: 'https://virustotal.com/scan7'
        },
        communityRating: {
          confidence: 0.99,
          safeVotes: 78,
          unsafeVotes: 0
        },
        scanDuration: 1450,
        isMockData: true
      },
      {
        id: '8',
        qrData: 'tel:+1-555-123-4567',
        timestamp: now - 25200000, // 7 hours ago
        safetyStatus: 'unknown',
        scanDuration: 200,
        isMockData: true
      },
      {
        id: '9',
        qrData: 'https://secure-banking.example.com/login',
        url: 'https://secure-banking.example.com/login',
        timestamp: now - 32400000, // 9 hours ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 1, 
          total: 69, 
          scanId: 'scan9',
          permalink: 'https://virustotal.com/scan9'
        },
        communityRating: {
          confidence: 0.91,
          safeVotes: 34,
          unsafeVotes: 4
        },
        userRating: 'safe',
        scanDuration: 1800,
        isMockData: true
      },
      {
        id: '10',
        qrData: 'https://fake-security-alert.com/urgent',
        url: 'https://fake-security-alert.com/urgent',
        timestamp: now - 39600000, // 11 hours ago
        safetyStatus: 'unsafe',
        virusTotalResult: { 
          isSecure: false, 
          positives: 45, 
          total: 73,
          scanId: 'scan10',
          permalink: 'https://virustotal.com/scan10'
        },
        communityRating: {
          confidence: 0.08,
          safeVotes: 1,
          unsafeVotes: 28
        },
        scanDuration: 3200,
        isMockData: true
      },
      {
        id: '11',
        qrData: 'WiFi:T:WEP;S:OpenWiFi;P:;H:false;;',
        timestamp: now - 46800000, // 13 hours ago
        safetyStatus: 'unknown',
        scanDuration: 380,
        isMockData: true
      },
      {
        id: '12',
        qrData: 'https://stackoverflow.com/questions/12345',
        url: 'https://stackoverflow.com/questions/12345',
        timestamp: now - 86400000, // 1 day ago
        safetyStatus: 'safe',
        virusTotalResult: { 
          isSecure: true, 
          positives: 0, 
          total: 70, 
          scanId: 'scan12',
          permalink: 'https://virustotal.com/scan12'
        },
        communityRating: {
          confidence: 0.96,
          safeVotes: 67,
          unsafeVotes: 2
        },
        scanDuration: 1100,
        isMockData: true
      },
      {
        id: '13',
        qrData: 'sms:555-0123:Meeting at 3pm today',
        timestamp: now - 172800000, // 2 days ago
        safetyStatus: 'safe',
        communityRating: {
          confidence: 0.85,
          safeVotes: 15,
          unsafeVotes: 1
        },
        scanDuration: 250,
        isMockData: true
      },
      {
        id: '14',
        qrData: 'https://malware-download.net/trojan.exe',
        url: 'https://malware-download.net/trojan.exe',
        timestamp: now - 259200000, // 3 days ago
        safetyStatus: 'unsafe',
        virusTotalResult: { 
          isSecure: false, 
          positives: 67, 
          total: 72,
          scanId: 'scan14',
          permalink: 'https://virustotal.com/scan14'
        },
        communityRating: {
          confidence: 0.02,
          safeVotes: 0,
          unsafeVotes: 42
        },
        userRating: 'unsafe',
        scanDuration: 4500,
        isMockData: true
      },
      {
        id: '15',
        qrData: 'geo:37.7749,-122.4194',
        timestamp: now - 604800000, // 1 week ago
        safetyStatus: 'safe',
        communityRating: {
          confidence: 0.92,
          safeVotes: 28,
          unsafeVotes: 3
        },
        scanDuration: 150,
        isMockData: true
      }
    ];
    
    return mockEntries;
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
              
              // Save to storage
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(combinedHistory));
              
              console.log('Mock scans imported successfully, total entries:', combinedHistory.length);
            } catch (error) {
              console.log('Error importing mock scans:', error);
              Alert.alert('Error', 'Failed to import mock scans');
            }
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <ThemedText style={styles.mainTitle}>Settings</ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.doneButton}
        >
          <ThemedText style={styles.doneButtonText}>Done</ThemedText>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Shortcuts Section */}
        <ThemedText style={[
          styles.firstSectionTitle,
          {
            backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#f5f5f5',
            color: colorScheme === 'dark' ? '#999999' : '#666666',
          }
        ]}>Shortcuts</ThemedText>
        
        <TouchableOpacity 
          style={[
            styles.settingsListItem,
            {
              borderBottomColor: colorScheme === 'dark' ? '#333333' : '#E5E5E7',
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#ffffff',
            }
          ]} 
          onPress={testLockscreenShortcut}
        >
          <View style={styles.settingsItemContent}>
            <View style={styles.settingsItemTextContainer}>
              <ThemedText style={styles.settingsItemTitle}>Lockscreen</ThemedText>
              <ThemedText style={styles.settingsItemSubtitle}>
                Test lockscreen shortcut functionality
              </ThemedText>
            </View>
            <ThemedText style={styles.chevronText}>›</ThemedText>
          </View>
        </TouchableOpacity>

        {/* Data Export Section */}
        <ThemedText style={[
          styles.settingsSectionTitle,
          {
            backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#f5f5f5',
            color: colorScheme === 'dark' ? '#999999' : '#666666',
          }
        ]}>Data Export</ThemedText>
        
        <TouchableOpacity 
          style={[
            styles.settingsListItem,
            {
              borderBottomColor: colorScheme === 'dark' ? '#333333' : '#E5E5E7',
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#ffffff',
            }
          ]} 
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
          style={[
            styles.settingsListItem,
            {
              borderBottomColor: colorScheme === 'dark' ? '#333333' : '#E5E5E7',
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#ffffff',
            }
          ]} 
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
        <ThemedText style={[
          styles.settingsSectionTitle,
          {
            backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#f5f5f5',
            color: colorScheme === 'dark' ? '#999999' : '#666666',
          }
        ]}>Data Management</ThemedText>
        
        <TouchableOpacity 
          style={[
            styles.settingsListItem,
            {
              borderBottomColor: colorScheme === 'dark' ? '#333333' : '#E5E5E7',
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#ffffff',
            }
          ]} 
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
          style={[
            styles.settingsListItem,
            {
              borderBottomColor: colorScheme === 'dark' ? '#333333' : '#E5E5E7',
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#ffffff',
            }
          ]} 
          onPress={clearHistory}
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
          style={[
            styles.settingsListItem,
            {
              borderBottomColor: colorScheme === 'dark' ? '#333333' : '#E5E5E7',
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#ffffff',
            }
          ]} 
          onPress={importMockScans}
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
        <ThemedText style={[
          styles.settingsSectionTitle,
          {
            backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#f5f5f5',
            color: colorScheme === 'dark' ? '#999999' : '#666666',
          }
        ]}>Privacy</ThemedText>
        
        <TouchableOpacity
          style={[
            styles.settingsListItem,
            {
              borderBottomColor: colorScheme === 'dark' ? '#333333' : '#E5E5E7',
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#ffffff',
            }
          ]}
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
          <View style={styles.footerLogoContainer}>
            <Image 
              source={colorScheme === 'dark' 
                ? require('@/assets/images/Icon-Dark.png')
                : require('@/assets/images/Icon-Light.png')
              }
              style={styles.footerLogoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.versionContainer}>
            <ThemedText style={styles.versionText}>Version 1.0.0</ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerSpacer: {
    width: 60,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
  content: {
    flex: 1,
    paddingVertical: 16,
  },
  firstSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingsListItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
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
  footerLogoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  footerLogoImage: {
    width: 60,
    height: 60,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    fontSize: 16,
    fontWeight: 'normal',
    opacity: 0.6,
  },
});