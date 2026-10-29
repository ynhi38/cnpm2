import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { theme } from '../config';
import { useApp } from '../store';
import { Btn, LangBar, s } from '../ui';

export default function StoriesScreen({ navigation }) {
  const { t, lang, ticket } = useApp();
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setErr('');
    api.stories({ lang, zone, q }).then(setItems).catch((e) => setErr(e.message));
  }, [lang, zone, q]);
  useEffect(() => { api.zones(lang).then(setZones).catch(() => {}); }, [lang]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  return (
    <View style={s.screen}>
      <LangBar />
      <View style={{ paddingHorizontal: 16 }}>
        <TextInput value={q} onChangeText={setQ} placeholder={t('search')} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: theme.line, borderRadius: 10, padding: 10 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
          {[{ zoneId: '', name: t('all') }, ...zones].map((z) => (
            <Pressable key={z.zoneId} onPress={() => setZone(z.zoneId)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginRight: 6, borderWidth: 1, borderColor: theme.line, backgroundColor: z.zoneId === zone ? theme.forest : '#fff' }}>
              <Text style={{ color: z.zoneId === zone ? '#fff' : theme.ink }}>{z.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {!!err && <View style={s.pad}><Text style={s.err}>{err}</Text><Btn title={t('retry')} onPress={load} /></View>}
      {!items && !err && <ActivityIndicator style={{ marginTop: 30 }} color={theme.gold} />}
      <FlatList data={items || []} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('Story', { id: item.id })} style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.muted}>#{item.order} · {item.zone.name}</Text>
              <Text style={[s.muted, { color: item.isPreview ? '#1e5e22' : theme.danger }]}>{item.isPreview ? t('free') : ticket ? '' : `🔒 ${t('locked')}`}</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.goldDark, marginVertical: 4 }}>{item.title}</Text>
            <Text numberOfLines={3} style={{ color: theme.muted }}>{item.summary}</Text>
          </Pressable>
        )} />
    </View>
  );
}
