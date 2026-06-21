## 2026-06-21 - SafeBackButton touch targets & a11y
**Learning:** Found that custom header and navigation back buttons were sometimes difficult to tap on mobile due to strict bounding boxes.
**Action:** Use `hitSlop` for small navigation icons to provide a larger, more forgiving touch target without altering the layout. Also consistently add `accessibilityRole` and `accessibilityLabel` to all icon-only buttons like SafeBackButton.
