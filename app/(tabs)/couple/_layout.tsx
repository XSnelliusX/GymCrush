import React from 'react';
import { Stack } from 'expo-router';
import { useTabStackOptions } from '../../../src/ui/navigation';

export default function CoupleStack() {
  return <Stack screenOptions={useTabStackOptions()} />;
}
