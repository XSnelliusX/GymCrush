import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

export async function saveMachinePhoto(uri: string): Promise<string> {
  const image = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
    compress: 0.75, format: SaveFormat.JPEG, base64: Platform.OS === 'web',
  });
  if (Platform.OS === 'web') return `data:image/jpeg;base64,${image.base64}`;
  const directory = `${FileSystem.documentDirectory}machine-photos/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const path = `${directory}${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  await FileSystem.copyAsync({ from: image.uri, to: path });
  return path;
}
