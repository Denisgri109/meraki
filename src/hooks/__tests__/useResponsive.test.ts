/**
 * useResponsive — Tier 1 hook tests.
 * Breakpoint/column math that drives every grid layout in the app.
 */
import { renderHook } from '@testing-library/react-native';
import { useResponsive, useCardWidth } from '../useResponsive';
import { useWindowDimensions } from 'react-native';

jest.mock('react-native', () => ({
    useWindowDimensions: jest.fn(),
    Platform: { OS: 'android', select: (o: any) => o.android },
}));

const dims = useWindowDimensions as jest.Mock;

function setWindow(width: number, height: number, scale = 2) {
    dims.mockReturnValue({ width, height, scale, fontScale: 1 });
}

describe('useResponsive — breakpoints', () => {
    it.each([
        [320, 'sm'],
        [767, 'sm'],
        [768, 'md'],
        [1023, 'md'],
        [1024, 'lg'],
        [1279, 'lg'],
        [1280, 'xl'],
        [1920, 'xl'],
    ])('width %d -> breakpoint %s', (width, bp) => {
        setWindow(width, 800);
        const { result } = renderHook(() => useResponsive());
        expect(result.current.breakpoint).toBe(bp);
    });

    it('isSmall / isTablet split exactly at 768', () => {
        setWindow(767, 800);
        let { result } = renderHook(() => useResponsive());
        expect(result.current.isSmall).toBe(true);
        expect(result.current.isTablet).toBe(false);

        setWindow(768, 1024);
        ({ result } = renderHook(() => useResponsive()));
        expect(result.current.isSmall).toBe(false);
        expect(result.current.isTablet).toBe(true);
    });

    it('isLandscape is a strict width > height comparison', () => {
        setWindow(800, 800);
        let { result } = renderHook(() => useResponsive());
        expect(result.current.isLandscape).toBe(false); // equal is NOT landscape

        setWindow(801, 800);
        ({ result } = renderHook(() => useResponsive()));
        expect(result.current.isLandscape).toBe(true);
    });
});

describe('useResponsive — columns', () => {
    it.each([
        [320, 1],
        [768, 2],
        [1024, 3],
        [1280, 4],
    ])('width %d -> %d column(s)', (width, cols) => {
        setWindow(width, 900);
        const { result } = renderHook(() => useResponsive());
        expect(result.current.columns).toBe(cols);
    });
});

describe('useCardWidth', () => {
    it('splits a phone width (375) into 2 equal cards with gap & padding', () => {
        setWindow(375, 812);
        const { result } = renderHook(() => useCardWidth(2, 16, 24));
        // (375 - 48 - 16) / 2 = 155.5
        expect(result.current).toBeCloseTo(155.5);
    });

    it('caps tablet cards at 3 columns even when 4 requested', () => {
        setWindow(1024, 768);
        const { result } = renderHook(() => useCardWidth(4, 16, 24));
        // cols = 3 → (1024 - 48 - 32) / 3 ≈ 314.67
        expect(result.current).toBeCloseTo((1024 - 48 - 32) / 3);
    });

    it('produces a positive, finite width on the smallest phones (320)', () => {
        setWindow(320, 568);
        const { result } = renderHook(() => useCardWidth(2));
        expect(result.current).toBeGreaterThan(0);
        expect(Number.isFinite(result.current)).toBe(true);
    });
});
