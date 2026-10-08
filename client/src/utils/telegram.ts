declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export const tg = {
  get webApp() {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  },

  isAvailable(): boolean {
    return Boolean(this.webApp && this.webApp.initData);
  },

  init() {
    if (this.webApp) {
      try {
        this.webApp.ready();
        this.webApp.expand();
        this.webApp.enableClosingConfirmation?.();
      } catch (e) {
        // ignore in dev preview
      }
    }
  },

  getInitData(): string {
    return this.webApp?.initData || '';
  },

  getUser() {
    return this.webApp?.initDataUnsafe?.user;
  },

  // Haptic feedback methods (section 33)
  impact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
    try {
      this.webApp?.HapticFeedback?.impactOccurred(style);
    } catch (e) {}
  },

  notification(type: 'error' | 'success' | 'warning') {
    try {
      this.webApp?.HapticFeedback?.notificationOccurred(type);
    } catch (e) {}
  },

  selection() {
    try {
      this.webApp?.HapticFeedback?.selectionChanged();
    } catch (e) {}
  },

  openLink(url: string) {
    if (this.webApp?.openTelegramLink && url.includes('t.me')) {
      this.webApp.openTelegramLink(url);
    } else if (this.webApp?.openLink) {
      this.webApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
};
