import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { translations, Translations, Locale } from './locales';
import { getSetting, setSetting } from '../utils/commands';

interface I18nContextType {
  t: Translations;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('system');
  const [t, setT] = useState<Translations>(translations.zh);

  const getEffectiveLocale = (loc: Locale): 'zh' | 'en' => {
    if (loc === 'system') {
      const browserLang = navigator.language.toLowerCase();
      return browserLang.startsWith('zh') ? 'zh' : 'en';
    }
    return loc;
  };

  useEffect(() => {
    // Load saved locale from settings
    const loadLocale = async () => {
      try {
        const saved = await getSetting('locale');
        if (saved && (saved === 'zh' || saved === 'en' || saved === 'system')) {
          setLocaleState(saved as Locale);
          setT(translations[getEffectiveLocale(saved as Locale)]);
        } else {
          // Use system default
          setT(translations[getEffectiveLocale('system')]);
        }
      } catch {
        // Fallback to system
        setT(translations[getEffectiveLocale('system')]);
      }
    };
    loadLocale();
  }, []);

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    setT(translations[getEffectiveLocale(newLocale)]);
    try {
      await setSetting('locale', newLocale);
    } catch (error) {
      console.error('Failed to save locale:', error);
    }
  };

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useLocale must be used within an I18nProvider');
  }
  return context;
}
