import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Linking } from 'react-native';
import { Button, ErrorText, Loading, Muted, ScrollScreen } from '../src/components';
import { useAsync } from '../src/hooks/useAsync';
import { receiptUrl } from '../src/lib/api';

// Visor de comprobante. El enlace es temporal y Storage solo lo concede a quien puede ver ese comprobante.
export default function Comprobante() {
  const { path, mime } = useLocalSearchParams<{ path: string; mime: string }>();
  const router = useRouter();
  const { data: url, error, loading } = useAsync(() => (path ? receiptUrl(path) : Promise.reject(new Error('sin comprobante'))), [path]);
  if (!path) return <Redirect href="/" />;   // se llegó sin elegir un comprobante: volver al inicio
  const isPdf = mime === 'application/pdf';
  return (
    <ScrollScreen>
      <Stack.Screen options={{ headerShown: true, title: 'Comprobante', headerStyle: { backgroundColor: '#13224A' }, headerTintColor: '#F3F6FF' }} />
      {loading ? <Loading /> : null}
      {error ? <ErrorText>No se pudo abrir el comprobante.</ErrorText> : null}
      {error ? <Button label="Volver" kind="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
      {url && !isPdf && <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 0.75, borderRadius: 16, backgroundColor: '#13224A' }} resizeMode="contain" />}
      {url && isPdf && <Muted>Es un archivo PDF. Ábralo para verlo o guardarlo.</Muted>}
      {url && <Button label={isPdf ? 'Abrir PDF' : 'Descargar / abrir en el navegador'} onPress={() => void Linking.openURL(url)} />}
      <Muted>El enlace es temporal y solo funciona para usted.</Muted>
    </ScrollScreen>
  );
}
