import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGS, theme } from './config';
import { useApp } from './store';

export function LangBar() {
  const { lang, setLang } = useApp();
  return (
    <View style={s.langBar}>
      {LANGS.map((l) => (
        <Pressable key={l.code} onPress={() => setLang(l.code)} style={[s.langBtn, lang === l.code && s.langOn]}>
          <Text style={[s.langTxt, lang === l.code && { color: '#fff' }]}>{l.short}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Btn = ({ title, onPress, kind = 'primary', disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} style={[s.btn, kind === 'primary' ? s.btnP : s.btnS, disabled && { opacity: 0.5 }]}>
    <Text style={[s.btnTxt, kind !== 'primary' && { color: theme.ink }]}>{title}</Text>
  </Pressable>
);

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.cream },
  pad: { padding: 16 },
  h1: { fontSize: 24, fontWeight: '700', color: theme.goldDark, marginBottom: 8 },
  muted: { color: theme.muted, fontSize: 13 },
  card: { backgroundColor: theme.paper, borderRadius: 12, borderWidth: 1, borderColor: theme.line, padding: 14, marginBottom: 12 },
  langBar: { flexDirection: 'row', alignSelf: 'flex-end', borderWidth: 1, borderColor: theme.line, borderRadius: 999, overflow: 'hidden', backgroundColor: '#fff', margin: 12 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6 }, langOn: { backgroundColor: theme.gold }, langTxt: { fontSize: 13, color: theme.ink },
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', marginVertical: 4 },
  btnP: { backgroundColor: theme.gold }, btnS: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.line }, btnTxt: { color: '#fff', fontWeight: '600', fontSize: 15 },
  err: { color: theme.danger, marginVertical: 8 },
});
