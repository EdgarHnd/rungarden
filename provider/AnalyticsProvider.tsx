import React, { createContext, useContext } from 'react';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
}

export interface AnalyticsProvider {
  initialize(): Promise<void>;
  identify(userId: string, traits?: Record<string, any>): void;
  track(event: AnalyticsEvent): void;
  reset(): void;
}

interface AnalyticsContextType {
  analytics: AnalyticsProvider;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context.analytics;
};

interface AnalyticsProviderProps {
  provider: AnalyticsProvider;
  children: React.ReactNode;
}

export const AnalyticsProviderComponent: React.FC<AnalyticsProviderProps> = ({
  provider,
  children
}) => {
  return (
    <AnalyticsContext.Provider value={{ analytics: provider }}>
      {children}
    </AnalyticsContext.Provider>
  );
}; 