import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Platform, Share } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SymbolView } from 'expo-symbols';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const STORAGE_KEY = '@safe_scan_history';

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
              Alert.alert('Success', 'All scan history has been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history');
            }
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <SymbolView name="chevron.left" size={24} tintColor="#007AFF" />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>Settings</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {/* Data Export Section */}
        <ThemedText style={styles.sectionTitle}>Data Export</ThemedText>
        
        <TouchableOpacity style={styles.listItem} onPress={exportToCSV}>
          <View style={styles.itemContent}>
            <View style={styles.itemTextContainer}>
              <ThemedText style={styles.itemTitle}>Export as CSV</ThemedText>
              <ThemedText style={styles.itemSubtitle}>
                Download scan history in spreadsheet format
              </ThemedText>
            </View>
            <ThemedText style={styles.chevron}>›</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listItem} onPress={exportToJSON}>
          <View style={styles.itemContent}>
            <View style={styles.itemTextContainer}>
              <ThemedText style={styles.itemTitle}>Export as JSON</ThemedText>
              <ThemedText style={styles.itemSubtitle}>
                Download full data with metadata
              </ThemedText>
            </View>
            <ThemedText style={styles.chevron}>›</ThemedText>
          </View>
        </TouchableOpacity>

        {/* Data Management Section */}
        <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>
        
        <TouchableOpacity style={styles.listItem} onPress={getStorageInfo}>
          <View style={styles.itemContent}>
            <View style={styles.itemTextContainer}>
              <ThemedText style={styles.itemTitle}>Storage Information</ThemedText>
              <ThemedText style={styles.itemSubtitle}>
                View data usage and statistics
              </ThemedText>
            </View>
            <ThemedText style={styles.chevron}>›</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listItem} onPress={clearHistory}>
          <View style={styles.itemContent}>
            <View style={styles.itemTextContainer}>
              <ThemedText style={styles.itemTitle}>Clear All History</ThemedText>
              <ThemedText style={styles.itemSubtitle}>
                Permanently delete all scan records
              </ThemedText>
            </View>
            <ThemedText style={styles.chevron}>›</ThemedText>
          </View>
        </TouchableOpacity>

        {/* Privacy Section */}
        <ThemedText style={styles.sectionTitle}>Privacy</ThemedText>
        
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => {
            Alert.alert(
              'Privacy Information',
              'SafeScan processes QR codes locally on your device. Scan history is stored only on your device and is not transmitted to external servers unless you explicitly export it.\n\nVirusTotal integration (when available) may send URLs to VirusTotal for security analysis. Community ratings are aggregated anonymously.',
              [{ text: 'OK' }]
            );
          }}
        >
          <View style={styles.itemContent}>
            <View style={styles.itemTextContainer}>
              <ThemedText style={styles.itemTitle}>Privacy Policy</ThemedText>
              <ThemedText style={styles.itemSubtitle}>
                How we handle your data
              </ThemedText>
            </View>
            <ThemedText style={styles.chevron}>›</ThemedText>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 44,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#666666',
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E7',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'normal',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 18,
    opacity: 0.4,
    fontWeight: '300',
  },
});