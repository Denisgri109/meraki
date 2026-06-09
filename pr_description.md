🔒 [Security Fix: Remove Hardcoded API Key Fallback]

🎯 **What:** Removed the empty string fallback for the EXPO_PUBLIC_COUNTRY_STATE_CITY_API_KEY environment variable.

⚠️ **Risk:** Having a fallback value, even an empty string, can bypass security checks that rely on the variable being explicitly undefined or can mask missing configuration issues. It can also cause issues with scanners finding false positive hardcoded API keys.

🛡️ **Solution:** The fallback `|| ''` was removed so the variable remains undefined when not set. The headers object was updated with a type cast to satisfy TypeScript, and the test suite was updated to expect `undefined` instead of a string when the environment variable is not provided.
