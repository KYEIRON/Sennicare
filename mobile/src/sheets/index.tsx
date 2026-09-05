import React from 'react';
import { Day } from '../lib/data';
import { useRouter } from '../nav/router';
import { AskGirkiSheet } from './AskGirki';
import { CookingSheet } from './CookingSheet';
import { GirkiDishSheet } from './GirkiDish';
import { GirkiPreferencesSheet } from './GirkiPreferences';
import { NotificationsAskSheet } from './NotificationsAsk';
import { GlobalDishSheet } from './GlobalDishSheet';
import { OccasionSheet } from './Occasion';
import {
  CountrySheet, CultureSheet, IngredientDiscoverySheet, MorningDiscoverySheet,
} from './DiscoverySheets';
import {
  AiBetaSheet, AiDecideSheet, AiEnergySheet, AiSleepSheet, BreathingSheet, CultureWellbeingSheet,
  DiscoverySheet, MorningSheet, MovementSheet, RecoverySheet, SleepSheet, WellbeingFoodSheet,
} from './InfoSheets';
import { PantrySheet, ShoppingSheet, SmartKitchenSheet } from './KitchenSheets';
import { MealSheet } from './MealSheet';
import {
  MealPickerSheet, MoveSheet, PlanDayPickerSheet, PlanPreferencesSheet, SwapSheet,
} from './PlanSheets';
import { LegalSheet, PlusManageSheet, PlusSheet, ProfileSheet } from './ProfileSheets';

/** Routes every overlay — the equivalent of `openSheet(type)`. */
export function SheetHost() {
  const { sheet } = useRouter();
  if (!sheet) return null;

  switch (sheet.type) {
    case 'meal':
      return <MealSheet index={sheet.index} />;
    case 'cooking':
      return <CookingSheet index={sheet.index} />;
    case 'culture':
      return <CultureSheet place={sheet.place} />;
    case 'country':
      return <CountrySheet name={sheet.name} />;
    case 'morningDiscovery':
      return <MorningDiscoverySheet />;
    case 'globalDish':
      return <GlobalDishSheet id={sheet.id} />;
    case 'girkiDish':
      return <GirkiDishSheet id={sheet.id} />;
    case 'girkiRecipe':
      return <GirkiDishSheet id={sheet.id} kind="recipe" />;
    case 'girkiPreferences':
      return <GirkiPreferencesSheet />;
    case 'notificationsAsk':
      return <NotificationsAskSheet />;
    case 'occasion':
      return <OccasionSheet id={sheet.id} />;
    case 'ask':
      return <AskGirkiSheet seed={sheet.seed} />;
    case 'plusManage':
      return <PlusManageSheet />;
    case 'ingredientDiscovery':
      return <IngredientDiscoverySheet />;
    case 'pantry':
      return <PantrySheet />;
    case 'shopping':
      return <ShoppingSheet />;
    case 'smartKitchen':
      return <SmartKitchenSheet />;
    case 'plus':
      return <PlusSheet />;
    case 'planPreferences':
      return <PlanPreferencesSheet />;
    case 'profile':
      return <ProfileSheet />;
    case 'planDayPicker':
      return <PlanDayPickerSheet mealIndex={sheet.mealIndex} globalId={sheet.globalId} />;
    case 'mealPickerForDay':
      return <MealPickerSheet dayIndex={sheet.dayIndex} />;
    case 'swap':
      return <SwapSheet day={sheet.day as Day} />;
    case 'move':
      return <MoveSheet day={sheet.day as Day} />;
    case 'morning':
      return <MorningSheet />;
    case 'movement':
      return <MovementSheet />;
    case 'breathing':
      return <BreathingSheet />;
    case 'recovery':
      return <RecoverySheet />;
    case 'discovery':
      return <DiscoverySheet />;
    case 'aiSleep':
      return <AiSleepSheet />;
    case 'aiEnergy':
      return <AiEnergySheet />;
    case 'aiDecide':
      return <AiDecideSheet />;
    case 'aiBeta':
      return <AiBetaSheet />;
    case 'legal':
      return <LegalSheet />;
    case 'wellbeingFood':
      return <WellbeingFoodSheet />;
    case 'sleep':
      return <SleepSheet />;
    case 'cultureWellbeing':
      return <CultureWellbeingSheet />;
    default:
      return null;
  }
}
