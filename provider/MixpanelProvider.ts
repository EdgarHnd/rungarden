import { Mixpanel } from 'mixpanel-react-native';
import { AnalyticsEvent, AnalyticsProvider } from './AnalyticsProvider';

export class MixpanelProvider implements AnalyticsProvider {
  private client: Mixpanel | null = null;

  constructor(
    private readonly token: string,
    private readonly trackAutomaticEvents = true
  ) {}

  async initialize(): Promise<void> {
    try {
      this.client = new Mixpanel(this.token, this.trackAutomaticEvents);
      await this.client.init();
    } catch (error) {
      console.error('Failed to initialize Mixpanel:', error);
    }
  }

  identify(userId: string, traits?: Record<string, any>): void {
    if (!this.client) return;

    this.client.identify(userId);
    if (traits) {
      this.client.getPeople().set(traits);
    }
  }

  track(event: AnalyticsEvent): void {
    if (!this.client) return;

    this.client.track(event.name, event.properties);
  }

  reset(): void {
    if (!this.client) return;
    
    this.client.reset();
  }
} 