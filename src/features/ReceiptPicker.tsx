import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorText, Muted } from '../components';
import type { PickedFile } from '../lib/api';
import { validateReceipt } from '../lib/receipts';

// Elegir un archivo (JPG/PNG/PDF) o tomar una foto. Valida tipo y tamaño antes de aceptarlo.
export function ReceiptPicker({ value, onChange }: { value: PickedFile | null; onChange: (f: PickedFile | null) => void }) {
  const [error, setError] = useState<string | null>(null);

  const accept = (f: PickedFile) => {
    const v = validateReceipt(f);
    if (!v.ok) return setError(v.error);
    setError(null); onChange(f);
  };

  const pickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    accept({ uri: a.uri, name: a.name, mime: a.mimeType, size: a.size });
  };
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError('Necesito permiso de la cámara para tomar la foto.');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    accept({ uri: a.uri, name: a.fileName ?? 'foto.jpg', mime: a.mimeType ?? 'image/jpeg', size: a.fileSize });
  };

  return (
    <View style={{ gap: 8 }}>
      <Muted>Comprobante (opcional)</Muted>
      {value ? (
        <>
          <Muted>📎 {value.name}{value.size ? ` · ${(value.size / 1024).toFixed(0)} KB` : ''}</Muted>
          <Button label="Quitar comprobante" kind="ghost" onPress={() => onChange(null)} />
        </>
      ) : (
        <>
          <Button label="Elegir archivo (foto o PDF)" kind="ghost" onPress={pickFile} />
          <Button label="Tomar foto" kind="ghost" onPress={takePhoto} />
        </>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </View>
  );
}
