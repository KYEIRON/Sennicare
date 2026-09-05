import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DAYS, Day, meals } from '../lib/data';
import { ageBand, missingIngredients } from '../lib/logic';

export type Profile = {
  name?: string;
  dob?: string;
  age?: string | null;
  gender?: string;
  diet?: string;
  priorities: string[];
  allergies: string[];
  birthdaySurprises: boolean;
};

export type Account = {
  provider: string;
  email?: string;
  name?: string;
  createdAt: string;
};

export type Week = Partial<Record<Day, { meal: number; addedAt: string }>>;

const emptyProfile: Profile = {
  priorities: [],
  allergies: [],
  birthdaySurprises: true,
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
  toastMessage: string | null;
  dailyOffset: number;

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

  addPantryItem: (value: string) => void;
  removePantryItem: (index: number) => void;
  addShoppingForMeal: (index: number) => void;
  addShoppingText: (text: string) => void;
  toggleShoppingItem: (index: number) => void;
  removeShoppingItem: (index: number) => void;
  demoScan: (shoppingList: boolean) => void;

  plannedMealIndex: (day: Day) => number | null;
  plannedDaysCount: () => number;
  plannedCalories: () => number;
  dayIsLocked: (day: Day) => boolean;
  planMeal: (mealIndex: number, day: Day) => boolean;
  removePlanMeal: (day: Day) => void;
  movePlanMeal: (from: Day, to: Day) => void;
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
      ] = await Promise.all([
        readJson<Profile>(KEYS.profile, emptyProfile),
        readJson<Account | null>(KEYS.account, null),
        readJson<string[]>(KEYS.pantry, []),
        readJson<string[]>(KEYS.shopping, []),
        readJson<string[]>(KEYS.shoppingDone, []),
        readJson<Week>(KEYS.week, {}),
        readJson<number[]>(KEYS.explored, []),
        readJson<number[]>(KEYS.completed, []),
      ]);

      setProfileState({ ...emptyProfile, ...storedProfile });
      setAccount(storedAccount);
      setPantry(storedPantry);
      setShopping(storedShopping);
      setShoppingDone(storedDone);
      setWeek(storedWeek);
      setExplored(storedExplored);
      setCompleted(storedCompleted);

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
  }, []);

  const awardTokens = useCallback(
    (n: number, reason: string) => {
      setTokens((current) => {
        const next = current + n;
        AsyncStorage.setItem(KEYS.tokens, String(next)).catch(() => {});
        return next;
      });
      toast(`+${n} Nourish tokens · ${reason}`);
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
      toast(value ? 'Nourish+ is active in this demo.' : 'Nourish+ preview is off.');
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

  const plannedMealIndex = useCallback(
    (day: Day) => {
      const entry = week[day];
      if (!entry) return null;
      return Number.isInteger(entry.meal) && meals[entry.meal] ? entry.meal : null;
    },
    [week]
  );

  const plannedDaysCount = useCallback(
    () => DAYS.filter((d) => plannedMealIndex(d) !== null).length,
    [plannedMealIndex]
  );

  const plannedCalories = useCallback(
    () =>
      DAYS.reduce((sum, day) => {
        const index = plannedMealIndex(day);
        return index === null ? sum : sum + (meals[index]?.cal || 0);
      }, 0),
    [plannedMealIndex]
  );

  const dayIsLocked = useCallback(
    (day: Day) => !plus && plannedMealIndex(day) === null && plannedDaysCount() >= 3,
    [plus, plannedMealIndex, plannedDaysCount]
  );

  /** `replacePlanMeal(day, i)` — false when Nourish+ is required. */
  const planMeal = useCallback(
    (mealIndex: number, day: Day) => {
      const occupied = plannedMealIndex(day) !== null;
      if (!plus && !occupied && plannedDaysCount() >= 3) return false;
      setWeek((current) => {
        const next = { ...current, [day]: { meal: mealIndex, addedAt: new Date().toISOString() } };
        writeJson(KEYS.week, next);
        return next;
      });
      toast(`${meals[mealIndex].name} is now planned for ${day}.`);
      return true;
    },
    [plannedDaysCount, plannedMealIndex, plus, toast]
  );

  const removePlanMeal = useCallback(
    (day: Day) => {
      setWeek((current) => {
        const next = { ...current };
        delete next[day];
        writeJson(KEYS.week, next);
        return next;
      });
      toast(`${day} is open again.`);
    },
    [toast]
  );

  const movePlanMeal = useCallback(
    (from: Day, to: Day) => {
      setWeek((current) => {
        const entry = current[from];
        if (!entry) return current;
        const next = { ...current, [to]: entry };
        delete next[from];
        writeJson(KEYS.week, next);
        return next;
      });
      toast(`Meal moved to ${to}.`);
    },
    [toast]
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
      addPantryItem,
      removePantryItem,
      addShoppingForMeal,
      addShoppingText,
      toggleShoppingItem,
      removeShoppingItem,
      demoScan,
      plannedMealIndex,
      plannedDaysCount,
      plannedCalories,
      dayIsLocked,
      planMeal,
      removePlanMeal,
      movePlanMeal,
    }),
    [
      ready, profile, account, pantry, shopping, shoppingDone, week, tokens, plus, explored,
      completed, toastMessage, dailyOffset, setProfile, togglePriority, toggleAllergy, setDob,
      signIn, resetDemo, toast, awardTokens, markExplored, markMealComplete, setPlus,
      addPantryItem, removePantryItem, addShoppingForMeal, addShoppingText, toggleShoppingItem,
      removeShoppingItem, demoScan, plannedMealIndex, plannedDaysCount, plannedCalories,
      dayIsLocked, planMeal, removePlanMeal, movePlanMeal,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
