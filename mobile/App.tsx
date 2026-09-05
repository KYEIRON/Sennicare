import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Header, TabBar, Toast } from './src/components/shell';
import { useLayout } from './src/lib/responsive';
import { RouterProvider, useRouter } from './src/nav/router';
import { Auth } from './src/screens/Auth';
import { Food } from './src/screens/Food';
import { Onboarding } from './src/screens/Onboarding';
import { Pantry } from './src/screens/Pantry';
import { Passport } from './src/screens/Passport';
import { Plan } from './src/screens/Plan';
import { Today } from './src/screens/Today';
import { Wellbeing } from './src/screens/Wellbeing';
import { You } from './src/screens/You';
import { prepareOffline } from './src/lib/girki/offline';
import { SheetHost } from './src/sheets';
import { StoreProvider, useStore } from './src/state/store';
import { colors } from './src/theme/tokens';

type Stage = 'loading' | 'onboarding' | 'auth' | 'app';

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <RouterProvider>
          <Root />
          <StatusBar style="dark" />
        </RouterProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

/**
 * V28's three top level states: onboarding, the account screen and the app,
 * skipping straight to the app when a profile and an account are stored.
 */
function Root() {
  const store = useStore();
  const [stage, setStage] = useState<Stage>('loading');

  // Warm the image cache in the background so a kitchen with no signal still
  // has photographs. Content is bundled, so it never needs the network.
  useEffect(() => {
    if (!store.ready) return;
    prepareOffline().catch(() => {});
  }, [store.ready]);

  useEffect(() => {
    if (!store.ready || stage !== 'loading') return;
    setStage(store.account && store.profile.diet ? 'app' : 'onboarding');
  }, [store.ready, store.account, store.profile.diet, stage]);

  // Resetting the demo returns to onboarding, as `resetDemo()` does.
  useEffect(() => {
    if (stage === 'app' && store.ready && !store.account) setStage('onboarding');
  }, [stage, store.ready, store.account]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {stage === 'onboarding' ? <Onboarding onFinished={() => setStage('auth')} /> : null}
      {stage === 'auth' ? (
        <Auth onBack={() => setStage('onboarding')} onEnter={() => setStage('app')} />
      ) : null}
      {stage === 'app' ? <AppShell /> : null}

      <SheetHost />
      {store.toastMessage ? <Toast message={store.toastMessage} /> : null}
    </View>
  );
}

function AppShell() {
  const router = useRouter();
  const layout = useLayout();

  const screen =
    router.tab === 'today' ? (
      <Today />
    ) : router.tab === 'food' ? (
      <Food />
    ) : router.tab === 'passport' ? (
      <Passport />
    ) : router.tab === 'pantry' ? (
      <Pantry />
    ) : router.tab === 'plan' ? (
      <Plan />
    ) : router.tab === 'wellbeing' ? (
      <Wellbeing />
    ) : (
      <You />
    );

  // Tablet: a left rail beside the content. Phone: a bottom tab bar.
  if (layout.tablet) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.tabletBg }}>
        <TabBar />
        <View style={{ flex: 1 }}>
          <Header />
          {screen}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header />
      {screen}
      <TabBar />
    </View>
  );
}
