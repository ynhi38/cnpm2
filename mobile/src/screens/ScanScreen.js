import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useApp } from '../store';
import { Btn, s } from '../ui';

/** QR trên vé: mã vé (MS-XXXX-XXXX hoặc URL chứa ?code=...). QR tại điểm tham quan: mã câu chuyện (MS01...). */
export function parseQr(raw) {
  const v = String(raw || '').trim();
  const q = v.match(/[?&]code=([A-Za-z0-9-]+)/);
  const tail = (q ? q[1] : v.split('/').pop()).toUpperCase();
  if (/^MS\d{1,3}$/.test(tail)) return { type: 'story', ref: tail };
  if (/^[A-Z0-9-]{6,20}$/.test(tail)) return { type: 'ticket', code: tail };
  return null;
}

export default function ScanScreen({ navigation }) {
  const { t, activate } = useApp();
  const [perm, ask] = useCameraPermissions();
  const [msg, setMsg] = useState('');
  const busy = useRef(false);

  const onScan = async ({ data }) => {
    if (busy.current) return;
    busy.current = true;
    const r = parseQr(data);
    try {
      if (!r) setMsg(t('scanned'));
      else if (r.type === 'story') navigation.navigate('Story', { id: r.ref });
      else { await activate(r.code); navigation.navigate('Stories'); }
    } catch (e) { setMsg(e.message); }
    setTimeout(() => { busy.current = false; }, 2500);
  };

  if (!perm) return <View style={s.screen} />;
  if (!perm.granted) return <View style={[s.screen, s.pad]}><Text style={s.h1}>{t('scanTitle')}</Text><Btn title={t('camera')} onPress={ask} /></View>;
  return (
    <View style={s.screen}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
      <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#000a', padding: 12, borderRadius: 10 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>{msg || t('scanTitle')}</Text>
      </View>
    </View>
  );
}
