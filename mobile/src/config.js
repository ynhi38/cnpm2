import Constants from 'expo-constants';

// Đặt EXPO_PUBLIC_API_URL (vd: http://192.168.1.10:4000) hoặc sửa extra.apiUrl trong app.json.
// Android emulator truy cập máy host qua 10.0.2.2; điện thoại thật dùng IP LAN của máy chạy backend.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://10.0.2.2:4000').replace(/\/$/, '');

export const LANGS = [
  { code: 'vi', short: 'VI', locale: 'vi-VN' },
  { code: 'en', short: 'EN', locale: 'en-US' },
  { code: 'zh', short: '中文', locale: 'zh-CN' },
];

export const theme = { gold: '#a67c2d', goldDark: '#6b4a12', forest: '#2f4a2a', cream: '#f7f1e2', paper: '#fffdf7', ink: '#2b2417', muted: '#7a6e58', line: '#e4d9bf', danger: '#b3261e' };
