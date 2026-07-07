import { useWindowDimensions, Platform } from 'react-native';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export interface ResponsiveInfo {
    width: number;
    height: number;
    breakpoint: Breakpoint;
    isSmall: boolean;
    isTablet: boolean;
    isLandscape: boolean;
    scale: number;
    columns: number;
}

const BREAKPOINTS: Record<Breakpoint, number> = {
    sm: 0,
    md: 768,
    lg: 1024,
    xl: 1280,
};

export function useResponsive(): ResponsiveInfo {
    const { width, height, scale } = useWindowDimensions();

    let breakpoint: Breakpoint = 'sm';
    if (width >= BREAKPOINTS.xl) breakpoint = 'xl';
    else if (width >= BREAKPOINTS.lg) breakpoint = 'lg';
    else if (width >= BREAKPOINTS.md) breakpoint = 'md';

    const isSmall = width < BREAKPOINTS.md;
    const isTablet = width >= BREAKPOINTS.md;
    const isLandscape = width > height;

    let columns = 1;
    if (width >= BREAKPOINTS.xl) columns = 4;
    else if (width >= BREAKPOINTS.lg) columns = 3;
    else if (width >= BREAKPOINTS.md) columns = 2;

    return {
        width,
        height,
        breakpoint,
        isSmall,
        isTablet,
        isLandscape,
        scale,
        columns,
    };
}

export function useCardWidth(cardCount: number = 2, gap: number = 16, padding: number = 24): number {
    const { width, isTablet } = useResponsive();
    const cols = isTablet ? Math.min(cardCount, 3) : cardCount;
    const totalGap = gap * (cols - 1);
    return (width - padding * 2 - totalGap) / cols;
}
