import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

// Guarda el CSV en un archivo temporal y abre el menú de compartir (WhatsApp, correo, Drive…). Excel lo abre directo.
export async function exportCSV(csv: string, name = 'historial-appfamiliar.csv'): Promise<void> {
  try {
    const f = new File(Paths.cache, name);
    f.create({ overwrite: true });
    f.write(csv);
    if (!(await Sharing.isAvailableAsync())) return Alert.alert('No disponible', 'Este teléfono no permite compartir archivos.');
    await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar historial' });
  } catch {
    Alert.alert('No se pudo exportar', 'Intente de nuevo.');
  }
}
