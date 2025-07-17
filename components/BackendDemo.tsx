/**
 * Backend Integration Example
 * Shows how to integrate the backend services with the main app
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { backendInfrastructure, UserScanData } from '../services';

const BackendDemo = () => {
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [scanHistory, setScanHistory] = useState<UserScanData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeBackend();
  }, []);

  const initializeBackend = async () => {
    try {
      await backendInfrastructure.initialize();
      setIsInitialized(true);
      updateSystemHealth();
      loadScanHistory();
    } catch (error) {
      console.error('Backend initialization failed:', error);
      Alert.alert('Error', 'Failed to initialize backend services');
    }
  };

  const updateSystemHealth = () => {
    const health = backendInfrastructure.getSystemHealth();
    setSystemHealth(health);
  };

  const loadScanHistory = async () => {
    const history = await backendInfrastructure.getScanHistory();
    setScanHistory(history);
  };

  const testStoreScan = async () => {
    const testScan = {
      userId: 'demo_user',
      qrData: 'https://example.com/test',
      timestamp: Date.now(),
      safetyTag: 'safe' as const,
      sessionId: 'demo_session'
    };

    const result = await backendInfrastructure.storeScanData(testScan);
    
    if (result.success) {
      Alert.alert('Success', 'Test scan stored successfully!');
      loadScanHistory();
    } else {
      Alert.alert('Error', result.error || 'Failed to store scan');
    }
  };

  const testCommunityVote = async () => {
    const testVote = {
      userId: 'demo_user',
      qrHash: 'test_hash_123',
      vote: 'safe' as const,
      timestamp: Date.now()
    };

    const result = await backendInfrastructure.submitVote(testVote);
    
    if (result.success) {
      Alert.alert('Success', 'Community vote submitted!');
    } else {
      Alert.alert('Error', result.error || 'Failed to submit vote');
    }
  };

  const performMaintenance = async () => {
    const cleanupResult = await backendInfrastructure.performMaintenanceCleanup();
    Alert.alert('Maintenance Complete', 
      `Local storage: ${cleanupResult.localStorage.used} bytes used\n` +
      `Community cleanup: ${cleanupResult.community.removed} entries removed`
    );
  };

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Initializing backend services...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        Backend Infrastructure Demo
      </Text>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>System Health:</Text>
        <Text>Services Online: {systemHealth ? Object.values(systemHealth.services).filter(Boolean).length : 0}/4</Text>
        <Text>Cache Hit Rate: {systemHealth ? (systemHealth.cache.hitRate * 100).toFixed(1) : 0}%</Text>
        <Text>WebSocket: {systemHealth ? (systemHealth.webSocket.isConnected ? 'Connected' : 'Disconnected') : 'Unknown'}</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Scan History:</Text>
        <Text>{scanHistory.length} scans stored locally</Text>
      </View>

      <View style={{ gap: 10 }}>
        <Button title="Test Store Scan" onPress={testStoreScan} />
        <Button title="Test Community Vote" onPress={testCommunityVote} />
        <Button title="Refresh Health" onPress={updateSystemHealth} />
        <Button title="Perform Maintenance" onPress={performMaintenance} />
      </View>

      <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f0f0f0' }}>
        <Text style={{ fontSize: 12, fontStyle: 'italic' }}>
          Backend Features Implemented:
          {'\n'}• Local data persistence with AsyncStorage
          {'\n'}• Cloud synchronization with offline queuing
          {'\n'}• Community rating system with spam protection
          {'\n'}• Real-time updates via WebSocket
          {'\n'}• Intelligent caching with TTL
          {'\n'}• Circuit breaker pattern for resilience
          {'\n'}• Data privacy and security measures
          {'\n'}• Scalability features and performance optimization
        </Text>
      </View>
    </View>
  );
};

export default BackendDemo;
