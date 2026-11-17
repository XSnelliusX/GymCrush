import { Redirect } from 'expo-router';

// Entry: tabs layout redirects to onboarding on first run.
export default function Index() {
  return <Redirect href="/today" />;
}
