import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  NotificationContext, NotificationSettings, PlannedNotification, allow, isPermitted,
} from './notifications';

/**
 * The platform side of notifications.
 *
 * Every send goes through `allow()` first, so the rules in notifications.ts are
 * the only place a decision is made, and `isPermitted()` is a final guard that
 * a forbidden message cannot reach a person even by mistake.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * The SDK's permission response resolves through `expo`'s own types, which are
 * not always visible here; read the two fields it is documented to carry.
 */
type PermissionLike = { granted?: boolean; status?: string };

export async function requestPermission(): Promise<boolean> {
  const isGranted = (r: PermissionLike) => Boolean(r.granted) || r.status === 'granted';
  const existing = (await Notifications.getPermissionsAsync()) as PermissionLike;
  if (isGranted(existing)) return true;
  const asked = (await Notifications.requestPermissionsAsync()) as PermissionLike;
  return isGranted(asked);
}

/** Schedule one notification, if the rules allow it. */
export async function schedule(
  candidate: PlannedNotification,
  context: NotificationContext
): Promise<{ scheduled: boolean; reason?: string; id?: string }> {
  const guard = isPermitted(candidate);
  if (!guard.ok) return { scheduled: false, reason: `forbidden copy: ${guard.matched}` };

  const decision = allow(candidate, context);
  if (!decision.send) return { scheduled: false, reason: decision.reason };

  const seconds = Math.max(1, Math.round((decision.at.getTime() - context.now.getTime()) / 1000));
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: candidate.title,
      body: candidate.body,
      data: { category: candidate.category },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
  });
  return { scheduled: true, id };
}

/** Cook-mode timers, cancelled together when cooking stops. */
export async function cancelCategory(category: string): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => (n.content.data as { category?: string })?.category === category)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Android needs a channel before anything will arrive. */
export async function prepareChannels(settings: NotificationSettings): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('timers', {
    name: 'Cooking timers',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('food', {
    name: 'Food and planning',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  void settings;
}
