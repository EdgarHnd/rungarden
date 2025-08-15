import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

// Key used to remember if the "Subscribe" event was already logged for the current active subscription period.
const SUBSCRIBE_LOGGED_KEY = 'koko_subscribe_logged_v1';

// Use keys from you RevenueCat API Keys
const APIKeys = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY!,
  // google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY!,
};

interface RevenueCatProps {
  purchasePackage?: (pack: PurchasesPackage) => Promise<void>;
  restorePermissions?: () => Promise<CustomerInfo>;
  user: UserState;
  packages: PurchasesPackage[];
  isReady: boolean;
}

export interface UserState {
  items: string[];
  pro: boolean;
}

const RevenueCatContext = createContext<RevenueCatProps | null>(null);

// Provide RevenueCat functions to our app
export const RevenueCatProvider = ({ children }: any) => {
  const [user, setUser] = useState<UserState>({ items: [], pro: false });
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [previousCustomerInfo, setPreviousCustomerInfo] = useState<CustomerInfo | null>(null);
  const [subscribeLogged, setSubscribeLogged] = useState<boolean>(false);
  const subscribeLoggedRef = useRef<boolean>(false);

  // Keep ref in sync with state so listener closure always has latest value
  useEffect(() => {
    subscribeLoggedRef.current = subscribeLogged;
  }, [subscribeLogged]);

  // Load persisted flag on mount so we know if Subscribe was already fired earlier.
  useEffect(() => {
    (async () => {
      try {
        const val = await SecureStore.getItemAsync(SUBSCRIBE_LOGGED_KEY);
        if (val === 'true') {
          setSubscribeLogged(true);
        }
      } catch (err) {
        console.warn('Failed to read subscribe flag:', err);
      }
    })();
  }, []);

  useEffect(() => {
    const init = async () => {
      console.log('Initializing RevenueCat...');

      // Load Subscribe flag BEFORE configuring Purchases so listener uses correct state
      try {
        const stored = await SecureStore.getItemAsync(SUBSCRIBE_LOGGED_KEY);
        if (stored === 'true') {
          setSubscribeLogged(true);
          subscribeLoggedRef.current = true;
        }
      } catch (err) {
        console.warn('Failed to read subscribe flag (init):', err);
      }

      // Configure RevenueCat
      try {
        await Purchases.configure({
          apiKey: APIKeys.apple // We'll default to Apple for iOS, can add Android later
        });

        // Use more logging during debug if want!
        if (process.env.NODE_ENV === 'development') {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }

        setIsReady(true);
        console.log('RevenueCat configured successfully');

        // Listen for customer updates
        Purchases.addCustomerInfoUpdateListener(async (info) => {
          console.log('Customer info updated:', info);

          // Detect first time Premium entitlement activation and log Subscribe
          const hadPremiumPreviously = Boolean(previousCustomerInfo?.entitlements.active['Premium']);
          const hasPremiumNow = Boolean(info.entitlements.active['Premium']);

          // Fire Subscribe event only once per actual subscription period.
          if (!hadPremiumPreviously && hasPremiumNow && !subscribeLoggedRef.current) {
            console.log('User subscribed to Premium');
            setSubscribeLogged(true);
            subscribeLoggedRef.current = true;
            try {
              await SecureStore.setItemAsync(SUBSCRIBE_LOGGED_KEY, 'true');
            } catch (err) {
              console.warn('Failed to persist subscribe flag:', err);
            }
          }

          // Reset the flag if the Premium entitlement is no longer active
          if (!hasPremiumNow && subscribeLogged) {
            setSubscribeLogged(false);
            try {
              await SecureStore.deleteItemAsync(SUBSCRIBE_LOGGED_KEY);
            } catch (err) {
              console.warn('Failed to reset subscribe flag:', err);
            }
          }

          updateCustomerInformation(info);
          setPreviousCustomerInfo(info);
        });

        // Load all offerings and the user object with entitlements
        await loadOfferings();

      } catch (error) {
        console.error('Failed to configure RevenueCat:', error);
      }
    };
    init();
  }, []);

  // Load all offerings a user can (currently) purchase
  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      console.log('Received offerings:', JSON.stringify(offerings, null, 2));
      if (offerings.current) {
        setPackages(offerings.current.availablePackages);
      } else {
        console.warn('No current offerings available');
      }
    } catch (error) {
      console.error('Failed to load offerings:', error);
    }
  };

  // Update user state based on previous purchases
  const updateCustomerInformation = async (customerInfo: CustomerInfo) => {
    const newUser: UserState = { items: [], pro: false };

    // Check for Premium entitlement
    if (customerInfo?.entitlements.active['Super'] !== undefined) {
      newUser.pro = true;
    }

    setUser(newUser);
  };

  // Purchase a package
  const purchasePackage = async (pack: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pack);
      console.log('Purchase successful:', customerInfo);

      // Log the monetary value for analytics
      console.log(`Purchase completed: ${pack.product.price} ${pack.product.currencyCode}`);

      // Update user state
      updateCustomerInformation(customerInfo);
    } catch (e: any) {
      // Handle user cancellation gracefully (don't throw error)
      if (e.userCancelled) {
        console.log('Purchase cancelled by user');
        return;
      }

      // For actual errors, log and re-throw
      console.error('Purchase failed:', e);
      throw e;
    }
  };

  // Restore previous purchases
  const restorePermissions = async () => {
    try {
      const customer = await Purchases.restorePurchases();
      console.log('Purchases restored:', customer);
      updateCustomerInformation(customer);
      return customer;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      throw error;
    }
  };

  const value = {
    restorePermissions,
    user,
    packages,
    purchasePackage,
    isReady,
  };

  // Return empty fragment if provider is not ready (Purchase not yet initialised)
  if (!isReady) return <></>;

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
};

// Export context for easy usage
export const useRevenueCat = () => {
  return useContext(RevenueCatContext) as RevenueCatProps;
};