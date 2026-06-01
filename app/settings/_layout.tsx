import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="profile" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="payouts" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="faq" />
      <Stack.Screen name="legal" />
    </Stack>
  );
}
