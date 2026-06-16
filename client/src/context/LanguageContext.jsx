import { createContext, useState, useEffect, useContext } from 'react';
import en from '../locales/en.json';
import ro from '../locales/ro.json';

//We combine our language objects
const translations = { en, ro };

//Create the context
const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [currentLang, setCurrentLang] = useState('en');

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        const localLang = localStorage.getItem('app_language');

        if (loggedInUser) {
            const userObj = JSON.parse(loggedInUser);
            if (userObj.language) setCurrentLang(userObj.language);
        } else if (localLang) {
            setCurrentLang(localLang);
        }
    }, []);

    const t = (path) => {
        const keys = path.split('.');
        let text = translations[currentLang];
        
        for (let key of keys) {
            if (text[key] === undefined) return path;
            text = text[key];
        }
        return text;
    };

    const formatMoney = (amount) => {
        const numericAmount = parseFloat(amount) || 0; 
        
        const locale = currentLang === 'ro' ? 'ro-RO' : 'en-US';
        
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numericAmount);
    };

    return (
        <LanguageContext value={{ currentLang, setCurrentLang, t, formatMoney }}>
            {children}
        </LanguageContext>
    );
}

export const useLanguage = () => useContext(LanguageContext);