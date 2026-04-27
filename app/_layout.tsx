import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../db/drizzle';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import CustomSplashScreen from '../components/CustomSplashScreen';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Migration Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <>
      {!success ? (
        <CustomSplashScreen />
      ) : (
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#FF9800',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'SDIT Canteen Menu' }} />
          <Stack.Screen name="login" options={{ title: 'Admin Login' }} />
          <Stack.Screen name="admin/index" options={{ title: 'Admin Dashboard' }} />
          <Stack.Screen
            name="admin/add-edit"
            options={{
              title: 'Manage Item',
              presentation: 'modal'
            }}
          />
        </Stack>
      )}
      <StatusBar style="light" />
    </>
  );
}
