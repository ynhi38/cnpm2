import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider, useApp } from './src/store';
import { theme } from './src/config';
import ScanScreen from './src/screens/ScanScreen';
import CodeScreen from './src/screens/CodeScreen';
import StoriesScreen from './src/screens/StoriesScreen';
import StoryScreen from './src/screens/StoryScreen';
import MapScreen from './src/screens/MapScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const icon = (ch) => ({ color }) => <Text style={{ color, fontSize: 18 }}>{ch}</Text>;

function Tabs() {
  const { t } = useApp();
  return (
    <Tab.Navigator initialRouteName="Stories" screenOptions={{ tabBarActiveTintColor: theme.gold, headerStyle: { backgroundColor: theme.goldDark }, headerTintColor: '#fff' }}>
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: t('qr'), tabBarIcon: icon('▣') }} />
      <Tab.Screen name="Code" component={CodeScreen} options={{ title: t('code'), tabBarIcon: icon('⌗') }} />
      <Tab.Screen name="Stories" component={StoriesScreen} options={{ title: t('stories'), tabBarIcon: icon('♫') }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t('map'), tabBarIcon: icon('⌖') }} />
    </Tab.Navigator>
  );
}

function Root() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.goldDark }, headerTintColor: '#fff' }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Story" component={StoryScreen} options={{ title: '' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Root />
    </AppProvider>
  );
}
