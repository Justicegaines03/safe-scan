import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useColorScheme } from '@/hooks/useColorScheme';

interface AppHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
}

const AppHeader = React.memo(({ showBackButton = false, onBackPress }: AppHeaderProps) => {
  const colorScheme = useColorScheme();
  
  // Pre-calculated theme variants to prevent flickering
  const headerStyles = React.useMemo(() => ({
    backgroundColor: colorScheme === 'dark' ? '#174534' : '#007031',
    textColor: colorScheme === 'dark' ? '#fce023' : '#fffb00',
  }), [colorScheme]);

  // Pre-load images to prevent loading delays
  const logoSource = React.useMemo(() => {
    return colorScheme === 'dark' 
      ? require('@/assets/images/Icon-Dark.png')
      : require('@/assets/images/Icon-Light.png');
  }, [colorScheme]);

  const handleSettingsPress = React.useCallback(() => {
    router.push('/settings');
  }, []);

  const handleBackPress = React.useCallback(() => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  }, [onBackPress]);

  return (
    <View style={[styles.headerContainer, { backgroundColor: headerStyles.backgroundColor }]}>
      {showBackButton ? (
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <SymbolView 
            name="chevron.left" 
            size={24}
            tintColor="#FFFFFF" 
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.logoTextContainer}>
          <Image 
            source={logoSource}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.logoText, { color: headerStyles.textColor }]}>
            SafeScan
          </Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.settingsButton}
        onPress={handleSettingsPress}
      >
        <SymbolView 
          name="gear" 
          size={35}
          tintColor="#FFFFFF" 
        />
      </TouchableOpacity>
    </View>
  );
});

AppHeader.displayName = 'AppHeader';

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 25,
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
    marginLeft: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppHeader;