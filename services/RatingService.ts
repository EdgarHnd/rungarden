import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const RATING_KEY = '@blaze:last_rating_prompt';
const RATING_ACTIONS_KEY = '@blaze:rating_actions';
const MIN_ACTIONS_BEFORE_RATING = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 1;

// Add this flag for development testing
// Set to true to test rating flow in development (shows console logs instead of actual rating dialog)
const FORCE_RATING_IN_DEV = __DEV__ && false;

export async function trackRatingAction() {
  try {
    const actionsStr = await AsyncStorage.getItem(RATING_ACTIONS_KEY);
    const actions = actionsStr ? parseInt(actionsStr) : 0;
    await AsyncStorage.setItem(RATING_ACTIONS_KEY, (actions + 1).toString());
  } catch (error) {
    console.error('Error tracking rating action:', error);
  }
}

export async function shouldShowRating(isManualRequest: boolean = false): Promise<boolean> {
  try {
    // Allow testing in development if flag is set
    if (FORCE_RATING_IN_DEV) {
      return true;
    }

    // Check if rating is available
    const isAvailable = await StoreReview.isAvailableAsync();
    
    // For manual requests (like onboarding), show the UI even if StoreReview isn't available
    // This allows the onboarding flow to continue and shows fallback behavior in dev/simulator
    if (isManualRequest) {
      return true;
    }

    // For automatic prompts, require StoreReview to be available
    if (!isAvailable) return false;

    // Check last prompt date
    const lastPromptStr = await AsyncStorage.getItem(RATING_KEY);
    if (lastPromptStr) {
      const lastPrompt = new Date(lastPromptStr);
      const daysSinceLastPrompt = (new Date().getTime() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastPrompt < MIN_DAYS_BETWEEN_PROMPTS) {
        return false;
      }
    }

    // Check number of actions
    const actionsStr = await AsyncStorage.getItem(RATING_ACTIONS_KEY);
    const actions = actionsStr ? parseInt(actionsStr) : 0;
    return actions >= MIN_ACTIONS_BEFORE_RATING;
  } catch (error) {
    console.error('Error checking rating status:', error);
    return false;
  }
}

export async function requestRating(isManualRequest: boolean = false) {
  try {
    const canRate = await shouldShowRating(isManualRequest);
    if (!canRate) {
      return;
    }

    // Check if StoreReview is actually available for the native prompt
    const isAvailable = await StoreReview.isAvailableAsync();

    // Only update the last prompt date and reset counter for automatic prompts
    if (!isManualRequest) {
      await AsyncStorage.setItem(RATING_KEY, new Date().toISOString());
      await AsyncStorage.setItem(RATING_ACTIONS_KEY, '0');
    }
    
    // Request the rating if available, otherwise log for development
    if (isAvailable) {
      await StoreReview.requestReview();
    } else {
      // In development/simulator, the onboarding will still proceed
      // The actual rating dialog will only work in production builds on physical devices
    }
  } catch (error) {
    console.error('Error requesting rating:', error);
  }
}

export async function openAppStore() {
  if (await StoreReview.hasAction()) {
    await StoreReview.storeUrl();
  }
} 