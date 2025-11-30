import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <Text className="text-2xl font-bold text-green-500">Nora Mobile</Text>
      <Text className="text-sm text-gray-600 mt-2">Phase 1 Complete! 🎉</Text>
      <Text className="text-xs text-gray-400 mt-4">@nora/core linked ✓</Text>
      <StatusBar style="auto" />
    </View>
  );
}
