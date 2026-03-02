import React, { createContext, useContext, useState, useCallback } from 'react';

type TabBarContextType = {
    isTabBarVisible: boolean;
    setTabBarVisible: (visible: boolean) => void;
    hideTabBar: () => void;
    showTabBar: () => void;
};

const TabBarContext = createContext<TabBarContextType>({
    isTabBarVisible: true,
    setTabBarVisible: () => { },
    hideTabBar: () => { },
    showTabBar: () => { },
});

export function TabBarProvider({ children }: { children: React.ReactNode }) {
    const [hiddenCount, setHiddenCount] = useState(0);

    const hideTabBar = useCallback(() => {
        setHiddenCount((prev) => prev + 1);
    }, []);

    const showTabBar = useCallback(() => {
        setHiddenCount((prev) => Math.max(0, prev - 1));
    }, []);

    // Explicit override
    const setTabBarVisible = useCallback((visible: boolean) => {
        if (visible) {
            setHiddenCount(0);
        } else {
            setHiddenCount(1);
        }
    }, []);

    const isTabBarVisible = hiddenCount === 0;

    return (
        <TabBarContext.Provider value={{ isTabBarVisible, setTabBarVisible, hideTabBar, showTabBar }}>
            {children}
        </TabBarContext.Provider>
    );
}

export function useTabBar() {
    return useContext(TabBarContext);
}
