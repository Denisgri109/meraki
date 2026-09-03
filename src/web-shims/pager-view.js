/**
 * Web shim for react-native-pager-view, whose native component cannot bundle for web.
 * Renders the active page only; the imperative setPage API that react-native-tab-view drives
 * still works, so tabs change — they just do not swipe.
 */
const React = require('react');
const { View } = require('react-native');

const PagerView = React.forwardRef(function PagerView(props, ref) {
  const { children, initialPage = 0, style, onPageSelected, ...rest } = props;
  const [page, setPage] = React.useState(initialPage);

  React.useImperativeHandle(ref, () => ({
    setPage: (index) => {
      setPage(index);
      onPageSelected?.({ nativeEvent: { position: index } });
    },
    setPageWithoutAnimation: setPage,
    setScrollEnabled: () => {},
  }));

  const pages = React.Children.toArray(children);
  return React.createElement(View, { style: [{ flex: 1 }, style], ...rest }, pages[page] ?? null);
});

module.exports = PagerView;
module.exports.default = PagerView;
module.exports.PagerView = PagerView;
