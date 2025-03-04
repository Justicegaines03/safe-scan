import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'QR Scanner',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="qr-code-scanner" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
