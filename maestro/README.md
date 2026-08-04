# Maestro E2E flows — Tier 3 (device/emulator execution)
#
# STATUS: Scaffolds. Meraki Mobile currently has ONE production testID
# (src/screens/owner/academy/ManageAcademyScreen.tsx) and Maestro is NOT
# installed in this repo. Before these flows can run end-to-end you must:
#
#   1. npm i -D maestro               (or brew install maestro)
#   2. Add testID props to the elements referenced below (a grep-for-
#      `testID="login-` will list the exact slots). Every text-based selector
#      here uses the real copy pulled from the screens, but testIDs remove
#      localisation / copy-drift flakiness.
#   3. Boot an emulator with the EAS dev-client build of this app and a
#      seeded Supabase test org (TEST_EMAIL/TEST_PASSWORD env vars).
#
# Run all flows:
#   maestro test maestro/
#
# No credentials are real. Never commit live test-account passwords here.
