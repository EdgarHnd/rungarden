import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useAnalytics } from '../provider/AnalyticsProvider';

export const useTrackNavigation = () => {
  const analytics = useAnalytics();
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (pathname !== previousPathname.current) {
      analytics.track({
        name: 'screen_view',
        properties: {
          screen_name: pathname,
          previous_screen: previousPathname.current,
        },
      });
      previousPathname.current = pathname;
    }
  }, [pathname, analytics]);
}; 