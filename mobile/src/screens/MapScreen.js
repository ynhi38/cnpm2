import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api';
import { theme } from '../config';
import { useApp } from '../store';
import { Btn, LangBar, s } from '../ui';

function distanceM(a, b, c, d) {
  const R = 6371000, r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function MapScreen({ navigation }) {
  const { t, lang } = useApp();
  const [stories, setStories] = useState([]);
  const [picked, setPicked] = useState(null);
  const [auto, setAuto] = useState(false);
  const [msg, setMsg] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const seen = useRef(new Map());
  const list = useRef([]);
  list.current = stories;

  useEffect(() => { api.stories({ lang }).then(setStories).catch((e) => setMsg(e.message)); setPicked(null); }, [lang]);

  // Tự động mở câu chuyện khi vào bán kính của điểm tham quan
  useEffect(() => {
    if (!auto) return undefined;
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setMsg('Location permission denied'); setAuto(false); return; }
      setMsg('');
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (p) => {
        let best = null;
        for (const st of list.current) {
          if (st.latitude == null) continue;
          const d = distanceM(p.coords.latitude, p.coords.longitude, Number(st.latitude), Number(st.longitude));
          if (d <= (st.triggerRadiusM || 30) && (!best || d < best.d)) best = { st, d };
        }
        if (best && Date.now() - (seen.current.get(best.st.id) || 0) > 10 * 60 * 1000) {
          seen.current.set(best.st.id, Date.now());
          navigation.navigate('Story', { id: best.st.id, auto: true });
        }
      });
    })();
    return () => sub?.remove();
  }, [auto, navigation]);

  return (
    <ScrollView style={s.screen}>
      <LangBar />
      <View style={[s.pad, { paddingTop: 0 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>{t('auto')}</Text><Switch value={auto} onValueChange={setAuto} trackColor={{ true: theme.gold }} />
        </View>
        {!!msg && <Text style={s.err}>{msg}</Text>}
        <View onLayout={(e) => setSize(e.nativeEvent.layout)} style={{ height: 360, backgroundColor: '#b9cf9c', borderRadius: 12, marginTop: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
          {stories.filter((x) => x.mapX != null).map((x) => (
            <Pressable key={x.id} onPress={() => setPicked(x)} hitSlop={6}
              style={{ position: 'absolute', left: (Number(x.mapX) / 100) * size.w - 13, top: (Number(x.mapY) / 100) * size.h - 13, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: picked?.id === x.id ? theme.danger : theme.goldDark }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{x.order}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.muted, { marginTop: 6 }]}>{t('mapNote')}</Text>
        {picked && (
          <View style={[s.card, { marginTop: 10 }]}>
            <Text style={s.muted}>#{picked.order} · {picked.zone.name}</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.goldDark }}>{picked.title}</Text>
            <Text style={{ color: theme.muted, marginVertical: 6 }}>{picked.summary}</Text>
            <Btn title={t('play')} onPress={() => navigation.navigate('Story', { id: picked.id })} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
