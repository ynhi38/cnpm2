import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { api, assetUrl } from '../api';
import { LANGS, theme } from '../config';
import { useApp } from '../store';
import { Btn, LangBar, s } from '../ui';

export default function StoryScreen({ route, navigation }) {
  const { id, auto } = route.params;
  const { t, lang, ticket, clear } = useApp();
  const [story, setStory] = useState(null);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState(false);
  const sound = useRef(null);
  const logged = useRef(false);

  const stop = useCallback(async () => {
    Speech.stop();
    if (sound.current) { await sound.current.unloadAsync().catch(() => {}); sound.current = null; }
    setPlaying(false);
  }, []);

  useEffect(() => {
    let alive = true;
    setErr(''); setStory(null); logged.current = false;
    api.story(id, lang).then((r) => alive && setStory(r)).catch((e) => {
      if (!alive) return;
      if (e.status === 401 || e.status === 410) clear();
      setErr(e.message);
    });
    return () => { alive = false; stop(); };
  }, [id, lang, ticket?.code, stop, clear]);

  useEffect(() => { if (story) navigation.setOptions({ title: story.title }); }, [story, navigation]);

  const play = useCallback(async () => {
    if (!story || story.locked) return;
    await stop();
    if (!logged.current) { logged.current = true; api.listen(story.id, { lang: story.contentLang, mode: auto ? 'auto' : 'manual' }); }
    setPlaying(true);
    if (story.audioUrl) {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: snd } = await Audio.Sound.createAsync({ uri: assetUrl(story.audioUrl) }, { shouldPlay: true });
      sound.current = snd;
      snd.setOnPlaybackStatusUpdate((st) => { if (st.didJustFinish) setPlaying(false); });
    } else {
      const locale = LANGS.find((l) => l.code === story.contentLang)?.locale || 'vi-VN';
      Speech.speak(story.content, { language: locale, rate: 0.95, onDone: () => setPlaying(false), onStopped: () => setPlaying(false), onError: () => setPlaying(false) });
    }
  }, [story, stop, auto]);

  useEffect(() => { if (auto && story && !story.locked) play(); }, [auto, story]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err && !story) return <View style={[s.screen, s.pad]}><Text style={s.err}>{err}</Text></View>;
  if (!story) return <View style={s.screen}><ActivityIndicator style={{ marginTop: 40 }} color={theme.gold} /></View>;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <LangBar />
      <View style={s.pad}>
        <Text style={s.muted}>#{story.order} · {story.zone.name}</Text>
        <Text style={s.h1}>{story.title}</Text>
        {story.contentLang !== lang && <Text style={s.muted}>{t('fallback')}</Text>}
        {story.locked ? (
          <View style={s.card}>
            <Text>{story.summary}</Text>
            <Text style={{ fontWeight: '700', marginVertical: 8 }}>🔒 {t('unlock')}</Text>
            <Btn title={t('enterCode')} onPress={() => navigation.navigate('Tabs', { screen: 'Code' })} />
          </View>
        ) : (
          <>
            <Btn title={playing ? `■ ${t('stop')}` : `▶ ${t('play')}`} onPress={playing ? stop : play} />
            <Text style={{ fontSize: 17, lineHeight: 28, color: theme.ink, marginTop: 8 }}>{story.content}</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}
