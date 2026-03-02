// Babel config for Jest tests only.
// Disables react-native-reanimated/plugin (requires react-native-worklets native module).
// babel-preset-expo checks platformOptions.reanimated and platformOptions.worklets
// before loading the plugin — setting both to false prevents the load.
module.exports = {
    presets: [
        [
            'babel-preset-expo',
            {
                reanimated: false,
                worklets: false,
            },
        ],
    ],
};
