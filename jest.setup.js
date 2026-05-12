// Jest setup file — global mocks for React Native modules

// Mock expo-modules-core (required by jest-expo setup)
jest.mock('expo-modules-core', () => ({
    EventEmitter: jest.fn(),
    NativeModule: jest.fn(),
    SharedObject: jest.fn(),
    SharedRef: jest.fn(),
    requireNativeModule: jest.fn(() => ({})),
    requireOptionalNativeModule: jest.fn(() => null),
    NativeModulesProxy: new Proxy({}, { get: () => jest.fn() }),
    uuid: { v4: () => 'test-uuid' },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
    appOwnership: 'standalone',
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
    easConfig: { projectId: 'test-project-id' },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
    isDevice: true,
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    MediaTypeOptions: { Images: 'Images', Videos: 'Videos' },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getCurrentPositionAsync: jest.fn().mockResolvedValue({
        coords: { latitude: 53.3498, longitude: -6.2603 },
    }),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
    setStringAsync: jest.fn(),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock react-native-reanimated (v4 does not have a /mock export)
jest.mock('react-native-reanimated', () => ({
    default: { call: jest.fn() },
    useSharedValue: jest.fn((init) => ({ value: init })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((val) => val),
    withSpring: jest.fn((val) => val),
    withDelay: jest.fn((_, val) => val),
    Easing: { linear: jest.fn(), ease: jest.fn(), bezier: jest.fn(() => jest.fn()) },
    FadeIn: { duration: jest.fn().mockReturnThis() },
    FadeOut: { duration: jest.fn().mockReturnThis() },
    SlideInRight: { duration: jest.fn().mockReturnThis() },
    SlideOutLeft: { duration: jest.fn().mockReturnThis() },
    Layout: { duration: jest.fn().mockReturnThis() },
    runOnJS: jest.fn((fn) => fn),
    runOnUI: jest.fn((fn) => fn),
    createAnimatedComponent: jest.fn((comp) => comp),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
    GestureHandlerRootView: ({ children }) => children,
    Swipeable: 'Swipeable',
    PanGestureHandler: 'PanGestureHandler',
    Gesture: { Pan: jest.fn(), Tap: jest.fn() },
    GestureDetector: ({ children }) => children,
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
    LinearGradient: 'LinearGradient',
}));

// Mock @stripe/stripe-react-native
jest.mock('@stripe/stripe-react-native', () => ({
    StripeProvider: ({ children }) => children,
    useStripe: () => ({
        initPaymentSheet: jest.fn(),
        presentPaymentSheet: jest.fn(),
        confirmSetupIntent: jest.fn(),
    }),
    CardField: 'CardField',
}));

// Mock react-native Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
    alert: jest.fn(),
}));

// Silence console noise in tests
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
};
