/**
 * TabBarContext — Tier 2 context tests.
 * Reference-counted hide/show so overlays don't race each other.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { TabBarProvider, useTabBar } from '../TabBarContext';

let snapshot: ReturnType<typeof useTabBar>;
function Probe() {
    snapshot = useTabBar();
    return null;
}

function mount() {
    return render(
        <TabBarProvider>
            <Probe />
        </TabBarProvider>
    );
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe('TabBarContext', () => {
    it('starts visible', () => {
        mount();
        expect(snapshot.isTabBarVisible).toBe(true);
    });

    it('single hide conceals the bar', () => {
        mount();
        act(() => snapshot.hideTabBar());
        expect(snapshot.isTabBarVisible).toBe(false);
    });

    it('is reference-counted: two hides require two shows', () => {
        mount();
        act(() => {
            snapshot.hideTabBar();
            snapshot.hideTabBar();
        });
        expect(snapshot.isTabBarVisible).toBe(false);
        act(() => snapshot.showTabBar());
        expect(snapshot.isTabBarVisible).toBe(false); // still one hide pending
        act(() => snapshot.showTabBar());
        expect(snapshot.isTabBarVisible).toBe(true);
    });

    it('show never underflows below zero (extra shows are clamped)', () => {
        mount();
        act(() => {
            snapshot.showTabBar();
            snapshot.showTabBar();
        });
        expect(snapshot.isTabBarVisible).toBe(true);
        // And a subsequent single hide still works (counter wasn't negative)
        act(() => snapshot.hideTabBar());
        expect(snapshot.isTabBarVisible).toBe(false);
    });

    it('setTabBarVisible(false) resets the counter fully', () => {
        mount();
        act(() => {
            snapshot.hideTabBar();
            snapshot.hideTabBar();
        });
        act(() => snapshot.setTabBarVisible(true));
        expect(snapshot.isTabBarVisible).toBe(true);
    });

    it('setTabBarVisible(false) hides regardless of counter', () => {
        mount();
        act(() => snapshot.setTabBarVisible(false));
        expect(snapshot.isTabBarVisible).toBe(false);
    });

    it('provides safe defaults when used outside provider (no crash)', () => {
        render(<Probe />);
        expect(snapshot.isTabBarVisible).toBe(true);
        // default no-ops
        snapshot.hideTabBar();
        snapshot.showTabBar();
        expect(snapshot.isTabBarVisible).toBe(true);
    });
});
