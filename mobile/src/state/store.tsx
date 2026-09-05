import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DAYS, Day, meals } from '../lib/data';
import { UserContext } from '../lib/discovery';
import { CookLogEntry, Passport, passportFrom } from '../lib/girki/passport';
import {
  DEFAULT_SETTINGS, NotificationCategory, NotificationSettings,
} from '../lib/girki/notifications';
import { FoodRecord, recordsById } from '../lib/foodGraph';
import {
  Week, canMove, canPlanGlobal, canPlanMeal, dayIsLocked as isDayLocked,
  plannedCalories as calories, plannedDaysCount as daysCount, plannedMealIndex as mealIndexFor,
  plannedRecord as recordFor, planOccupied as occupied, withGlobal, withMeal, withMove, withoutDay,
} from '../lib/planning';
import { ageBand, missingIngredients, pantryHas } from '../lib/logic';

export type PlusPlan = 'monthly' | 'yearly';

export type GirkiPreferences = {
  /** Regions of the world the person wants more of. */
  regions: string[];
  /** How much explanation a method should carry. */
  confidence: string | null;
  /** What a weeknight realistically allows. */
  weeknightMinutes: string | null;
  household: string | null;
  foodInterests: string[];
  discovery: string | null;
};

export type Profile = {
  name?: string;
  dob?: string;
  age?: string | null;
  gender?: string;
  diet?: string;
  priorities: string[];
  allergies: string[];
  birthdaySurprises: boolean;
  girki: GirkiPreferences;
};

export type Account = {
  provider: string;
  email?: string;
  name?: string;
  createdAt: string;
};

export type { PlannedEntry, Week } from '../lib/planning';

const emptyGirki: GirkiPreferences = {
  regions: [],
  confidence: null,
  weeknightMinutes: null,
  household: null,
  foodInterests: [],
  discovery: null,
};

const emptyProfile: Profile = {
  priorities: [],
  allergies: [],
  birthdaySurprises: true,
  girki: emptyGirki,
};

/**
 * Every key here is the key the V28 prototype used in `localStorage`, so the
 * behaviour (and the free vs Plus gating) is the prototype's, not a new one.
 */
const KEYS = {
  profile: 'nourishProfile',
  account: 'nourishAccount',
  pantry: 'nourishPantry',
  shopping: 'nourishShopping',
  shoppingDone: 'nourishShoppingDone',
  week: 'nourishWeek',
  tokens: 'nourishTokens',
  plus: 'nourishPlus',
  explored: 'nourishExplored',
  completed: 'nourishCompleted',
  lastDay: 'nourishLastDay',
  dailySeed: 'nourishDailySeed',
  exploredCountries: 'nourishExploredCountries',
  savedMeals: 'nourishSavedMeals',
  rejectedMeals: 'nourishRejectedMeals',
  plusPlan: 'nourishPlusPlan',
  cookLog: 'girkiCookLog',
  notifications: 'girkiNotifications',
} as const;

type Store = {
  ready: boolean;
  profile: Profile;
  account: Account | null;
  pantry: string[];
  shopping: string[];
  shoppingDone: string[];
  week: Week;
  tokens: number;
  plus: boolean;
  explored: number[];
  completed: number[];
  /** Countries whose food the person has opened — feeds "somewhere new". */
  exploredCountries: string[];
  savedMeals: number[];
  rejectedMeals: number[];
  plusPlan: PlusPlan;
  toastMessage: string | null;
  dailyOffset: number;
  /** The passport: every cook, keyed by dish name and country. */
  cookLog: CookLogEntry[];
  passport: Passport;
  notifications: NotificationSettings;

  setProfile: (update: Partial<Profile>) => void;
  togglePriority: (value: string) => void;
  toggleAllergy: (value: string) => void;
  setDob: (value: string) => void;

  signIn: (provider: string, email?: string, name?: string) => void;
  resetDemo: () => void;

  toast: (message: string) => void;
  awardTokens: (n: number, reason: string) => void;
  markExplored: (index: number) => void;
  markMealComplete: (index: number) => void;
  setPlus: (value: boolean) => void;
  setPlusPlan: (plan: PlusPlan) => void;
  markCountryExplored: (country: string) => void;
  /** Record a cook. Never keyed by an array index — the brief is explicit. */
  recordCook: (entry: CookLogEntry) => void;
  setGirkiPreferences: (update: Partial<GirkiPreferences>) => void;
  setNotificationSettings: (update: Partial<NotificationSettings>) => void;
  toggleNotificationCategory: (category: NotificationCategory) => void;
  toggleSavedMeal: (index: number) => void;
  rejectMeal: (index: number) => void;
  /** Everything the recommendation engine needs about this person. */
  discoveryContext: () => UserContext;

  addPantryItem: (value: string) => void;
  removePantryItem: (index: number) => void;
  addShoppingForMeal: (index: number) => void;
  addShoppingText: (text: string) => void;
  toggleShoppingItem: (index: number) => void;
  removeShoppingItem: (index: number) => void;
  demoScan: (shoppingList: boolean) => void;
  pantryHas: (ingredient: string) => boolean;

  plannedMealIndex: (day: Day) => number | null;
  /** What is planned for a day, recipe or discovery, as one graph record. */
  plannedRecord: (day: Day) => FoodRecord | null;
  planOccupied: (day: Day) => boolean;
  plannedDaysCount: () => number;
  plannedCalories: () => number;
  dayIsLocked: (day: Day) => boolean;
  planMeal: (mealIndex: number, day: Day) => boolean;
  /** Plan a dish from the country atlas. Girki+ only, as in V32.6. */
  planGlobalDish: (recordId: string, day: Day) => boolean;
  removePlanMeal: (day: Day) => void;
  movePlanMeal: (from: Day, to: Day) => boolean;
};

const StoreContext = createContext<Store | null>(null);

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile>(emptyProfile);
  const [account, setAccount] = useState<Account | null>(null);
  const [pantry, setPantry] = useState<string[]>([]);
  const [shopping, setShopping] = useState<string[]>([]);
  const [shoppingDone, setShoppingDone] = useState<string[]>([]);
  const [week, setWeek] = useState<Week>({});
  const [tokens, setTokens] = useState(0);
  const [plus, setPlusState] = useState(false);
  const [explored, setExplored] = useState<number[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [exploredCountries, setExploredCountries] = useState<string[]>([]);
  const [savedMeals, setSavedMeals] = useState<number[]>([]);
  const [rejectedMeals, setRejectedMeals] = useState<number[]>([]);
  const [plusPlan, setPlusPlanState] = useState<PlusPlan>('monthly');
  const [cookLog, setCookLog] = useState<CookLogEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dailyOffset, setDailyOffset] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [
        storedProfile,
        storedAccount,
        storedPantry,
        storedShopping,
        storedDone,
        storedWeek,
        storedExplored,
        storedCompleted,
        storedCountries,
        storedSaved,
        storedRejected,
      ] = await Promise.all([
        readJson<Profile>(KEYS.profile, emptyProfile),
        readJson<Account | null>(KEYS.account, null),
        readJson<string[]>(KEYS.pantry, []),
        readJson<string[]>(KEYS.shopping, []),
        readJson<string[]>(KEYS.shoppingDone, []),
        readJson<Week>(KEYS.week, {}),
        readJson<number[]>(KEYS.explored, []),
        readJson<number[]>(KEYS.completed, []),
        readJson<string[]>(KEYS.exploredCountries, []),
        readJson<number[]>(KEYS.savedMeals, []),
        readJson<number[]>(KEYS.rejectedMeals, []),
      ]);
      setCookLog(await readJson<CookLogEntry[]>(KEYS.cookLog, []));
      setNotifications(await readJson<NotificationSettings>(KEYS.notifications, DEFAULT_SETTINGS));

      setProfileState({
        ...emptyProfile,
        ...storedProfile,
        girki: { ...emptyGirki, ...(storedProfile.girki || {}) },
      });
      setAccount(storedAccount);
      setPantry(storedPantry);
      setShopping(storedShopping);
      setShoppingDone(storedDone);
      setWeek(storedWeek);
      setExplored(storedExplored);
      setCompleted(storedCompleted);
      setExploredCountries(storedCountries);
      setSavedMeals(storedSaved);
      setRejectedMeals(storedRejected);
      const storedPlan = await AsyncStorage.getItem(KEYS.plusPlan);
      setPlusPlanState(storedPlan === 'yearly' ? 'yearly' : 'monthly');

      const storedTokens = await AsyncStorage.getItem(KEYS.tokens);
      setTokens(Number(storedTokens) || 0);
      const storedPlus = await AsyncStorage.getItem(KEYS.plus);
      setPlusState(storedPlus === '1');

      // The daily rotation seed, reseeded once per calendar day.
      const key = new Date().toISOString().slice(0, 10);
      const lastDay = await AsyncStorage.getItem(KEYS.lastDay);
      let seed = Number(await AsyncStorage.getItem(KEYS.dailySeed)) || 1;
      if (lastDay !== key) {
        seed = Math.floor(Math.random() * 100000);
        AsyncStorage.setItem(KEYS.lastDay, key).catch(() => {});
        AsyncStorage.setItem(KEYS.dailySeed, String(seed)).catch(() => {});
      }
      setDailyOffset(meals.length ? seed % meals.length : 0);

      setReady(true);
    })();
  }, []);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  const setProfile = useCallback((update: Partial<Profile>) => {
    setProfileState((current) => {
      const next = { ...current, ...update };
      writeJson(KEYS.profile, next);
      return next;
    });
  }, []);

  const togglePriority = useCallback((value: string) => {
    setProfileState((current) => {
      const priorities = current.priorities.includes(value)
        ? current.priorities.filter((p) => p !== value)
        : [...current.priorities, value];
      const next = { ...current, priorities };
      writeJson(KEYS.profile, next);
      return next;
    });
  }, []);

  /** `toggleAllergy(x)` — "None" clears the list. */
  const toggleAllergy = useCallback((value: string) => {
    setProfileState((current) => {
      let allergies: string[];
      if (value === 'None') {
        allergies = [];
      } else {
        const base = current.allergies.filter((a) => a !== 'None');
        allergies = base.includes(value) ? base.filter((a) => a !== value) : [...base, value];
      }
      const next = { ...current, allergies };
      writeJson(KEYS.profile, next);
      return next;
    });
  }, []);

  const setDob = useCallback((value: string) => {
    setProfileState((current) => {
      const next = { ...current, dob: value, age: value ? ageBand(value) : null };
      writeJson(KEYS.profile, next);
      return next;
    });
  }, []);

  const signIn = useCallback(
    (provider: string, email?: string, name?: string) => {
      const next: Account = {
        provider,
        email,
        name: name || profile.name,
        createdAt: new Date().toISOString(),
      };
      setAccount(next);
      writeJson(KEYS.account, next);
    },
    [profile.name]
  );

  const resetDemo = useCallback(() => {
    AsyncStorage.multiRemove(Object.values(KEYS)).catch(() => {});
    setProfileState(emptyProfile);
    setAccount(null);
    setPantry([]);
    setShopping([]);
    setShoppingDone([]);
    setWeek({});
    setTokens(0);
    setPlusState(false);
    setExplored([]);
    setCompleted([]);
    setExploredCountries([]);
    setSavedMeals([]);
    setRejectedMeals([]);
    setPlusPlanState('monthly');
    setCookLog([]);
    setNotifications(DEFAULT_SETTINGS);
  }, []);

  const awardTokens = useCallback(
    (n: number, reason: string) => {
      setTokens((current) => {
        const next = current + n;
        AsyncStorage.setItem(KEYS.tokens, String(next)).catch(() => {});
        return next;
      });
      toast(`+${n} Girki tokens · ${reason}`);
    },
    [toast]
  );

  const markExplored = useCallback(
    (index: number) => {
      setExplored((current) => {
        if (current.includes(index)) return current;
        const next = [...current, index];
        writeJson(KEYS.explored, next);
        awardTokens(2, 'food explored');
        return next;
      });
    },
    [awardTokens]
  );

  const markMealComplete = useCallback(
    (index: number) => {
      setCompleted((current) => {
        if (current.includes(index)) {
          toast('Already completed.');
          return current;
        }
        const next = [...current, index];
        writeJson(KEYS.completed, next);
        awardTokens(10, 'meal cooked');
        return next;
      });
    },
    [awardTokens, toast]
  );

  const setPlus = useCallback(
    (value: boolean) => {
      setPlusState(value);
      AsyncStorage.setItem(KEYS.plus, value ? '1' : '0').catch(() => {});
      toast(value ? 'Girki+ is active in this demo.' : 'Girki+ preview is off.');
    },
    [toast]
  );

  const setPlusPlan = useCallback(
    (plan: PlusPlan) => {
      setPlusPlanState(plan);
      AsyncStorage.setItem(KEYS.plusPlan, plan).catch(() => {});
      toast(plan === 'yearly' ? 'Yearly plan selected.' : 'Monthly plan selected.');
    },
    [toast]
  );

  /** Discovery history: what "somewhere new" is measured against. */
  const markCountryExplored = useCallback((country: string) => {
    if (!country || country === 'Modern home kitchen') return;
    setExploredCountries((current) => {
      if (current.includes(country)) return current;
      const next = [...current, country].slice(-40);
      writeJson(KEYS.exploredCountries, next);
      return next;
    });
  }, []);

  const setGirkiPreferences = useCallback((update: Partial<GirkiPreferences>) => {
    setProfileState((current) => {
      const next = { ...current, girki: { ...current.girki, ...update } };
      writeJson(KEYS.profile, next);
      return next;
    });
  }, []);

  const setNotificationSettings = useCallback((update: Partial<NotificationSettings>) => {
    setNotifications((current) => {
      const next = { ...current, ...update };
      writeJson(KEYS.notifications, next);
      return next;
    });
  }, []);

  const toggleNotificationCategory = useCallback((category: NotificationCategory) => {
    setNotifications((current) => {
      const next = {
        ...current,
        enabled: { ...current.enabled, [category]: !current.enabled[category] },
      };
      writeJson(KEYS.notifications, next);
      return next;
    });
  }, []);

  /**
   * Record a cook. Keyed by dish name and country, never by an array index —
   * the prototype's index keying scrambled its own history.
   */
  const recordCook = useCallback(
    (entry: CookLogEntry) => {
      setCookLog((current) => {
        const next = [...current, entry];
        writeJson(KEYS.cookLog, next);
        return next;
      });
      markCountryExplored(entry.country);
      awardTokens(10, 'meal cooked');
    },
    [markCountryExplored, awardTokens]
  );

  const toggleSavedMeal = useCallback(
    (index: number) => {
      setSavedMeals((current) => {
        const next = current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index];
        writeJson(KEYS.savedMeals, next);
        return next;
      });
      toast(savedMeals.includes(index) ? 'Removed from saved.' : 'Saved for later.');
    },
    [savedMeals, toast]
  );

  const rejectMeal = useCallback(
    (index: number) => {
      setRejectedMeals((current) => {
        if (current.includes(index)) return current;
        const next = [...current, index];
        writeJson(KEYS.rejectedMeals, next);
        return next;
      });
      toast('Noted — I will show you less like that.');
    },
    [toast]
  );

  const addPantryItem = useCallback(
    (value: string) => {
      const item = value.trim();
      if (!item) return;
      setPantry((current) => {
        if (current.includes(item)) return current;
        const next = [...current, item];
        writeJson(KEYS.pantry, next);
        return next;
      });
      toast(`${item} added to your pantry.`);
    },
    [toast]
  );

  const removePantryItem = useCallback((index: number) => {
    setPantry((current) => {
      const next = current.filter((_, i) => i !== index);
      writeJson(KEYS.pantry, next);
      return next;
    });
  }, []);

  const addShoppingForMeal = useCallback(
    (index: number) => {
      const meal = meals[index];
      if (!meal) return;
      const missing = missingIngredients(pantry, meal);
      if (!missing.length) {
        toast('You already have everything needed in your pantry.');
        return;
      }
      setShopping((current) => {
        const next = Array.from(new Set([...current, ...missing]));
        writeJson(KEYS.shopping, next);
        return next;
      });
      toast(
        `${missing.length} missing ingredient${missing.length === 1 ? '' : 's'} added to your shopping list.`
      );
    },
    [pantry, toast]
  );

  const addShoppingText = useCallback(
    (text: string) => {
      const items = text
        .split(/\n|,/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (!items.length) return;
      setShopping((current) => {
        const next = Array.from(new Set([...current, ...items]));
        writeJson(KEYS.shopping, next);
        return next;
      });
      toast(`${items.length} shopping item${items.length === 1 ? '' : 's'} added.`);
    },
    [toast]
  );

  const toggleShoppingItem = useCallback(
    (index: number) => {
      const item = shopping[index];
      if (item === undefined) return;
      setShoppingDone((current) => {
        const next = current.includes(item)
          ? current.filter((x) => x !== item)
          : [...current, item];
        writeJson(KEYS.shoppingDone, next);
        return next;
      });
    },
    [shopping]
  );

  const removeShoppingItem = useCallback(
    (index: number) => {
      const item = shopping[index];
      setShopping((current) => {
        const next = current.filter((_, i) => i !== index);
        writeJson(KEYS.shopping, next);
        return next;
      });
      setShoppingDone((current) => {
        const next = current.filter((x) => x !== item);
        writeJson(KEYS.shoppingDone, next);
        return next;
      });
    },
    [shopping]
  );

  /** `handleScan(file, type)` — the prototype's demo item set. */
  const demoScan = useCallback(
    (shoppingList: boolean) => {
      const demo = shoppingList
        ? ['Bananas', 'Avocado', 'Brown rice', 'Broccoli', 'Chicken', 'Greek yoghurt']
        : ['Onions', 'Tinned tomatoes', 'Chickpeas', 'Rice', 'Spinach', 'Eggs'];
      if (shoppingList) {
        setShopping((current) => {
          const next = Array.from(new Set([...current, ...demo]));
          writeJson(KEYS.shopping, next);
          return next;
        });
        toast('Demo scan added 6 shopping items. Review the list below.');
      } else {
        setPantry((current) => {
          const next = Array.from(new Set([...current, ...demo]));
          writeJson(KEYS.pantry, next);
          return next;
        });
        toast('Demo scan found 6 kitchen items. Review the list below.');
      }
    },
    [toast]
  );

  const pantryHasItem = useCallback(
    (ingredient: string) => pantryHas(pantry, ingredient),
    [pantry]
  );

  const plannedMealIndex = useCallback((day: Day) => mealIndexFor(week, day), [week]);

  /** The planned record for a day, whichever kind it is. */
  const plannedRecord = useCallback((day: Day): FoodRecord | null => recordFor(week, day), [week]);

  const planOccupied = useCallback((day: Day) => occupied(week, day), [week]);

  const plannedDaysCount = useCallback(() => daysCount(week), [week]);

  const plannedCalories = useCallback(() => calories(week), [week]);

  const dayIsLocked = useCallback((day: Day) => isDayLocked(week, day, plus), [week, plus]);

  /** `replacePlanMeal(day, i)` — false when Girki+ is required. */
  const planMeal = useCallback(
    (mealIndex: number, day: Day) => {
      if (!canPlanMeal(week, day, plus)) return false;
      const next = withMeal(week, day, mealIndex);
      setWeek(next);
      writeJson(KEYS.week, next);
      toast(`${meals[mealIndex].name} is now planned for ${day}.`);
      return true;
    },
    [week, plus, toast]
  );

  /**
   * Planning a dish from the atlas is a Girki+ capability: free members can
   * see the whole world, Plus members can place it in a day.
   */
  const planGlobalDish = useCallback(
    (recordId: string, day: Day) => {
      if (!canPlanGlobal(plus, recordId)) return false;
      const record = recordsById.get(recordId);
      if (!record) return false;
      const next = withGlobal(week, day, recordId);
      setWeek(next);
      writeJson(KEYS.week, next);
      toast(`${record.title} added to ${day}.`);
      return true;
    },
    [week, plus, toast]
  );

  const removePlanMeal = useCallback(
    (day: Day) => {
      const next = withoutDay(week, day);
      setWeek(next);
      writeJson(KEYS.week, next);
      toast(`${day} is open again.`);
    },
    [week, toast]
  );

  /** Moving onto an occupied day would silently overwrite it, so it is refused. */
  const movePlanMeal = useCallback(
    (from: Day, to: Day) => {
      if (!canMove(week, from, to)) return false;
      const next = withMove(week, from, to);
      setWeek(next);
      writeJson(KEYS.week, next);
      toast(`Meal moved to ${to}.`);
      return true;
    },
    [week, toast]
  );

  const discoveryContext = useCallback(
    (): UserContext => ({
      allergies: profile.allergies,
      diet: profile.diet,
      priorities: profile.priorities,
      pantry,
      plus,
      exploredCountries,
      recentMeals: [...completed, ...Object.values(week).map((w) => w?.meal ?? -1)].filter((i) => i >= 0),
      rejectedMeals,
    }),
    [profile.allergies, profile.diet, profile.priorities, pantry, plus, exploredCountries, completed, week, rejectedMeals]
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      profile,
      account,
      pantry,
      shopping,
      shoppingDone,
      week,
      tokens,
      plus,
      explored,
      completed,
      exploredCountries,
      cookLog,
      passport: passportFrom(cookLog),
      notifications,
      savedMeals,
      rejectedMeals,
      plusPlan,
      toastMessage,
      dailyOffset,
      setProfile,
      togglePriority,
      toggleAllergy,
      setDob,
      signIn,
      resetDemo,
      toast,
      awardTokens,
      markExplored,
      markMealComplete,
      setPlus,
      setPlusPlan,
      markCountryExplored,
      recordCook,
      setGirkiPreferences,
      setNotificationSettings,
      toggleNotificationCategory,
      toggleSavedMeal,
      rejectMeal,
      discoveryContext,
      addPantryItem,
      removePantryItem,
      addShoppingForMeal,
      addShoppingText,
      toggleShoppingItem,
      removeShoppingItem,
      demoScan,
      pantryHas: pantryHasItem,
      plannedMealIndex,
      plannedRecord,
      planOccupied,
      plannedDaysCount,
      plannedCalories,
      dayIsLocked,
      planMeal,
      planGlobalDish,
      removePlanMeal,
      movePlanMeal,
    }),
    [
      ready, profile, account, pantry, shopping, shoppingDone, week, tokens, plus, explored,
      completed, exploredCountries, savedMeals, rejectedMeals, plusPlan, toastMessage, dailyOffset,
      setProfile, togglePriority, toggleAllergy, setDob, signIn, resetDemo, toast, awardTokens,
      markExplored, markMealComplete, setPlus, setPlusPlan, markCountryExplored, recordCook,
      cookLog, notifications, setGirkiPreferences, setNotificationSettings,
      toggleNotificationCategory, toggleSavedMeal,
      rejectMeal, discoveryContext, addPantryItem, removePantryItem, addShoppingForMeal,
      addShoppingText, toggleShoppingItem, removeShoppingItem, demoScan, pantryHasItem,
      plannedMealIndex,
      plannedRecord, planOccupied, plannedDaysCount, plannedCalories, dayIsLocked, planMeal,
      planGlobalDish, removePlanMeal, movePlanMeal,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
