module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Strip Flow types BEFORE private-field transforms so the plugins
            // see clean JS (babel-preset-expo strips Flow as a preset, which
            // runs AFTER plugins — too late for the field transforms).
            '@babel/plugin-transform-flow-strip-types',
            ['@babel/plugin-transform-class-properties', {loose: true}],
            ['@babel/plugin-transform-private-methods', {loose: true}],
            ['@babel/plugin-transform-private-property-in-object', {loose: true}],
            // MUST stay last (Reanimated 4 moved its babel plugin into worklets).
            'react-native-worklets/plugin',
        ],
    };
};
