import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Tab = 'today' | 'food' | 'pantry' | 'plan' | 'wellbeing' | 'you';

/** Everything V28 opens through `openSheet(type)` and friends. */
export type Sheet =
  | { type: 'meal'; index: number }
  | { type: 'cooking'; index: number }
  | { type: 'culture'; place: string }
  | { type: 'country'; name: string }
  | { type: 'morningDiscovery' }
  | { type: 'globalDish'; id: string }
  | { type: 'ask'; seed?: string }
  | { type: 'plusManage' }
  | { type: 'ingredientDiscovery' }
  | { type: 'pantry' }
  | { type: 'shopping' }
  | { type: 'smartKitchen' }
  | { type: 'plus' }
  | { type: 'planPreferences' }
  | { type: 'profile' }
  | { type: 'planDayPicker'; mealIndex?: number; globalId?: string }
  | { type: 'mealPickerForDay'; dayIndex: number }
  | { type: 'swap'; day: string }
  | { type: 'move'; day: string }
  | { type: 'morning' }
  | { type: 'movement' }
  | { type: 'breathing' }
  | { type: 'recovery' }
  | { type: 'discovery' }
  | { type: 'aiSleep' }
  | { type: 'aiEnergy' }
  | { type: 'aiDecide' }
  | { type: 'aiBeta' }
  | { type: 'legal' }
  | { type: 'wellbeingFood' }
  | { type: 'sleep' }
  | { type: 'cultureWellbeing' };

type Router = {
  tab: Tab;
  sheet: Sheet | null;
  filterTerm: string | null;
  show: (tab: Tab) => void;
  present: (sheet: Sheet) => void;
  close: () => void;
  /** `closeSheet(); show('food')` */
  closeAndShow: (tab: Tab) => void;
  /** `filterFood(term)` */
  filterFood: (term: string) => void;
  clearFilter: () => void;
};

const RouterContext = createContext<Router | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>('today');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [filterTerm, setFilterTerm] = useState<string | null>(null);

  const show = useCallback((next: Tab) => {
    setSheet(null);
    setFilterTerm(null);
    setTab(next);
  }, []);

  const present = useCallback((next: Sheet) => setSheet(next), []);
  const close = useCallback(() => setSheet(null), []);

  const closeAndShow = useCallback((next: Tab) => {
    setSheet(null);
    setFilterTerm(null);
    setTab(next);
  }, []);

  const filterFood = useCallback((term: string) => {
    setSheet(null);
    setTab('food');
    setFilterTerm(term);
  }, []);

  const clearFilter = useCallback(() => setFilterTerm(null), []);

  const value = useMemo(
    () => ({ tab, sheet, filterTerm, show, present, close, closeAndShow, filterFood, clearFilter }),
    [tab, sheet, filterTerm, show, present, close, closeAndShow, filterFood, clearFilter]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): Router {
  const router = useContext(RouterContext);
  if (!router) throw new Error('useRouter must be used inside RouterProvider');
  return router;
}
