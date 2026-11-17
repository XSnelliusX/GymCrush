import React from 'react';
import { Stack } from 'expo-router';
import { useTabStackOptions } from '../../../src/ui/navigation';

export default function TodayStack() {
  return <Stack screenOptions={useTabStackOptions()} />;
}
