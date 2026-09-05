/**
 * Notifications.
 *
 * The rule from the brief: every notification is about food, at a moment when
 * food is on the person's mind. No streak nags, no guilt, nothing counting days
 * since last use, nothing about weight.
 *
 * This module is the decision layer and holds no platform code, so the rules
 * can be tested rather than trusted.
 */

export type NotificationCategory =
  | 'cookReminder'
  | 'shoppingNudge'
  | 'birthday'
  | 'newCountry'
  | 'weeklyDiscovery'
  | 'timer';

/** Timers are functional: they are not marketing and are never rate limited. */
export const FUNCTIONAL: NotificationCategory[] = ['timer'];

export type NotificationSettings = {
  /** Asked for after the first cook, never on launch. */
  permissionGranted: boolean;
  enabled: Record<NotificationCategory, boolean>;
  quietHours: { start: number; end: number };
  /** Outside timers. The brief's default is two a week. */
  weeklyCap: number;
  timezone: string;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  permissionGranted: false,
  enabled: {
    cookReminder: true,
    shoppingNudge: true,
    birthday: true,
    newCountry: true,
    weeklyDiscovery: true,
    timer: true,
  },
  quietHours: { start: 21, end: 8 },
  weeklyCap: 2,
  timezone: 'Europe/London',
};

export type PlannedNotification = {
  category: NotificationCategory;
  at: Date;
  title: string;
  body: string;
};

export type NotificationContext = {
  settings: NotificationSettings;
  now: Date;
  /** When the notifications already sent went out, most recent last. */
  sentAt: Date[];
  /** Has this person cooked anything yet? The permission ask waits for it. */
  cooksLogged: number;
};

/** The ask converts far better once the value is proven. */
export function shouldAskPermission(context: NotificationContext): boolean {
  return !context.settings.permissionGranted && context.cooksLogged >= 1;
}

export function inQuietHours(at: Date, quiet: { start: number; end: number }): boolean {
  const hour = at.getHours();
  if (quiet.start === quiet.end) return false;
  // Quiet hours usually wrap midnight: 21:00 to 08:00.
  return quiet.start > quiet.end ? hour >= quiet.start || hour < quiet.end : hour >= quiet.start && hour < quiet.end;
}

/** Move a notification out of quiet hours rather than dropping it. */
export function shiftOutOfQuietHours(at: Date, quiet: { start: number; end: number }): Date {
  if (!inQuietHours(at, quiet)) return at;
  const shifted = new Date(at);
  shifted.setHours(quiet.end, 0, 0, 0);
  if (shifted <= at) shifted.setDate(shifted.getDate() + 1);
  return shifted;
}

function sentInLastWeek(sentAt: Date[], now: Date): number {
  const weekAgo = now.getTime() - 7 * 86400000;
  return sentAt.filter((d) => d.getTime() >= weekAgo).length;
}

/**
 * Should this notification be sent at all?
 *
 * Returns the reason when it should not, so the decision is inspectable rather
 * than a silent no.
 */
export function allow(
  candidate: PlannedNotification,
  context: NotificationContext
): { send: boolean; reason?: string; at: Date } {
  const { settings } = context;

  if (!settings.permissionGranted) return { send: false, reason: 'no permission yet', at: candidate.at };
  if (!settings.enabled[candidate.category]) return { send: false, reason: 'category off', at: candidate.at };

  // A timer alert is the whole point of cook mode running in the background.
  if (FUNCTIONAL.includes(candidate.category)) return { send: true, at: candidate.at };

  if (sentInLastWeek(context.sentAt, context.now) >= settings.weeklyCap) {
    return { send: false, reason: 'weekly cap reached', at: candidate.at };
  }

  const at = shiftOutOfQuietHours(candidate.at, settings.quietHours);
  return { send: true, at };
}

/* ---------- the six things Girki may say ---------- */

export type PlanEntry = { day: string; slot: string; dish: string; at: Date; missing: string[] };

/** 45 minutes before a planned meal, and only if one is planned. */
export function cookReminder(entry: PlanEntry): PlannedNotification {
  const missing = entry.missing.length
    ? `You have everything except ${entry.missing.slice(0, 2).join(' and ')}.`
    : 'You have everything for it.';
  return {
    category: 'cookReminder',
    at: new Date(entry.at.getTime() - 45 * 60000),
    title: `${entry.dish} tonight.`,
    body: missing,
  };
}

/** Saturday morning, if the week is planned and the list has unbought items. */
export function shoppingNudge(
  now: Date,
  plannedDays: number,
  unbought: number
): PlannedNotification | null {
  if (plannedDays < 1 || unbought < 1) return null;
  const at = new Date(now);
  const daysUntilSaturday = (6 - at.getDay() + 7) % 7;
  at.setDate(at.getDate() + daysUntilSaturday);
  at.setHours(9, 30, 0, 0);
  return {
    category: 'shoppingNudge',
    at,
    title: 'Your week is planned.',
    body: `${unbought} ${unbought === 1 ? 'thing' : 'things'} still to buy for it.`,
  };
}

/** One dish, chosen properly, on the morning. */
export function birthdayNote(dish: string, at: Date): PlannedNotification {
  const morning = new Date(at);
  morning.setHours(9, 0, 0, 0);
  return {
    category: 'birthday',
    at: morning,
    title: 'Happy birthday.',
    body: `If you fancy cooking today, ${dish} would be a good one.`,
  };
}

/** When the passport reaches a milestone or a region opens. */
export function newCountryNote(country: string, countriesCooked: number, at: Date): PlannedNotification {
  return {
    category: 'newCountry',
    at,
    title: `${country} is stamped.`,
    body: `That is ${countriesCooked} ${countriesCooked === 1 ? 'country' : 'countries'} you have cooked from.`,
  };
}

/** One dish a week from a region they have never cooked. */
export function weeklyDiscovery(dish: string, country: string, at: Date): PlannedNotification {
  return {
    category: 'weeklyDiscovery',
    at,
    title: `Something from ${country}.`,
    body: `${dish} — a part of the world you have not cooked from yet.`,
  };
}

/** When a cook-mode step finishes and the app is in the background. */
export function timerAlert(step: number, dish: string, at: Date): PlannedNotification {
  return {
    category: 'timer',
    at,
    title: `Step ${step} is up.`,
    body: dish,
  };
}

/**
 * Copy discipline, enforced.
 *
 * The brief lists what must never be sent. This is the check that keeps a
 * well-meaning growth idea from becoming a streak nag.
 */
const FORBIDDEN = [
  /streak/i, /don'?t lose/i, /keep it going/i, /we miss you/i, /come back/i,
  /haven'?t (cooked|opened|used)/i, /days since/i, /\bweight\b/i, /calorie/i,
  /you forgot/i, /still there\?/i,
];

export function isPermitted(notification: PlannedNotification): { ok: boolean; matched?: string } {
  const text = `${notification.title} ${notification.body}`;
  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) return { ok: false, matched: String(pattern) };
  }
  return { ok: true };
}
