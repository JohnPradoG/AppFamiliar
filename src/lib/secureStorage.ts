import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { joinChunks, splitChunks } from './chunks';

// Almacenamiento de la sesión: en el teléfono va CIFRADO (Keystore de Android) y en trozos; en web usa el del navegador.
const native = Platform.OS !== 'web';
const k = (key: string, i?: number) => `af_${key.replace(/[^A-Za-z0-9._-]/g, '_')}${i === undefined ? '_n' : `_${i}`}`;

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!native) return AsyncStorage.getItem(key);
    const n = Number(await SecureStore.getItemAsync(k(key)));
    if (!Number.isInteger(n) || n <= 0) return null;
    return joinChunks(await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(k(key, i)))));
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!native) return AsyncStorage.setItem(key, value);
    const parts = splitChunks(value);
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(k(key, i), p)));
    await SecureStore.setItemAsync(k(key), String(parts.length));
  },
  async removeItem(key: string): Promise<void> {
    if (!native) return AsyncStorage.removeItem(key);
    const n = Number(await SecureStore.getItemAsync(k(key)));
    if (Number.isInteger(n)) await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(k(key, i))));
    await SecureStore.deleteItemAsync(k(key));
  },
};
