module.exports = {
    // Use react-native preset (simpler than jest-expo, avoids its broken setup)
    preset: 'react-native',
    setupFiles: ['./jest.setup.js'],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': [
            'babel-jest',
            {
                configFile: './babel.config.test.js',
                babelrc: false,
            },
        ],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(' +
        '(jest-)?react-native|' +
        '@react-native(-community)?|' +
        'expo(nent)?|' +
        '@expo(nent)?/.*|' +
        '@expo-google-fonts/.*|' +
        'react-navigation|' +
        '@react-navigation/.*|' +
        '@supabase/supabase-js|' +
        'react-native-url-polyfill|' +
        'react-native-reanimated|' +
        'react-native-gesture-handler|' +
        'react-native-screens|' +
        'react-native-safe-area-context|' +
        'react-native-svg|' +
        'react-native-qrcode-svg|' +
        'date-fns|' +
        'date-fns-tz|' +
        'base64-arraybuffer' +
        ')/)',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/asyncStorage.ts',
    },
    testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
    collectCoverageFrom: [
        'src/utils/**/*.ts',
        'src/services/**/*.ts',
        'src/contexts/**/*.tsx',
        'src/lib/supabaseApi.ts',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/__mocks__/**',
    ],
};
