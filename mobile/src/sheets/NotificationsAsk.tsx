import React, { useState } from 'react';
import { Sheet } from '../components/shell';
import { Button, Card, Eyebrow, H2, H3, P, Small } from '../components/ui';
import { requestPermission } from '../lib/girki/notifyPlatform';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';

/**
 * The permission ask, after the first meal is cooked.
 *
 * It says exactly what will be sent and what will not, because the honest
 * version is also the one that converts.
 */
export function NotificationsAskSheet() {
  const store = useStore();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const last = store.passport.last;

  return (
    <Sheet>
      <Eyebrow>One thing</Eyebrow>
      <H2>{last ? `You cooked ${last.dish}.` : 'You cooked something.'}</H2>
      <P>
        Girki can tell you when a planned meal is coming up, when a cooking timer finishes, and
        once a week about somewhere you have not cooked from.
      </P>

      <Card>
        <H3>What it will send</H3>
        <Small>
          A reminder forty-five minutes before a meal you planned. A shopping note on a Saturday
          if the week is planned. Your cooking timers. One discovery a week. Your birthday, if you
          gave a date.
        </Small>
        <H3>What it will never send</H3>
        <Small>
          Streak warnings. Anything counting the days since you last cooked. Anything about weight
          or calories. Outside timers, it sends at most two a week.
        </Small>
      </Card>

      <Button
        title={asking ? 'Asking…' : 'Turn them on'}
        onPress={async () => {
          setAsking(true);
          const granted = await requestPermission();
          store.setNotificationSettings({ permissionGranted: granted });
          setAsking(false);
          router.close();
          store.toast(granted ? 'Notifications are on.' : 'Left off. Nothing will be sent.');
        }}
      />
      <Button title="Not now" variant="secondary" onPress={router.close} />
      <Small>You can change this any time in your preferences.</Small>
    </Sheet>
  );
}
