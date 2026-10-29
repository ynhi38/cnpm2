import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useApp } from '../store';
import { Btn, LangBar, s } from '../ui';

export default function CodeScreen({ navigation, route }) {
  const { t, ticket, activate, clear } = useApp();
  const [code, setCode] = useState(route.params?.code || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(''); setBusy(true);
    try { await activate(code); navigation.navigate('Stories'); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      <LangBar />
      <View style={s.pad}>
        <Text style={s.h1}>{t('enterCode')}</Text>
        {ticket && (
          <View style={s.card}>
            <Text style={{ fontWeight: '700' }}>{t('active')}: {ticket.code}</Text>
            <Text style={s.muted}>{new Date(ticket.expiresAt).toLocaleString()}</Text>
            <Btn kind="secondary" title={t('remove')} onPress={clear} />
          </View>
        )}
        <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="MS-XXXX-XXXX" autoCapitalize="characters" autoCorrect={false}
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4d9bf', borderRadius: 10, padding: 14, fontSize: 22, textAlign: 'center', letterSpacing: 2 }} />
        {!!err && <Text style={s.err}>{err}</Text>}
        <Btn title={t('confirm')} onPress={submit} disabled={busy || !code.trim()} />
      </View>
    </ScrollView>
  );
}
