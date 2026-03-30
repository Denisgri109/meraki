# iOS vs Android Compatibility Report

The codebase is built on React Native (Expo), which is excellent for cross-platform compatibility. However, there are several **critical differences** between iOS and Android that must be addressed before publishing to the Apple App Store. 

Currently, the app will face rejection or crashes on iOS due to the following missing implementations/configurations:

---

## 🚨 CRITICAL FIXES NEEDED FOR iOS

### 1. The "Apple Tax" (App Store Guideline 3.1.1)
*   **The Problem:** The app currently uses **Stripe** (`@stripe/stripe-react-native`) for purchasing Merakí Academy Courses in `CoursePurchaseScreen.tsx`. 
*   **iOS Rule:** Apple strictly prohibits using third-party payment gateways (like Stripe) for unlocking **digital content** consumed inside the app (e.g., recorded video courses). You *must* use Apple's native **In-App Purchases (IAP)**, which takes a 15-30% commission cut.
*   **The Fix:** You must implement a library like `react-native-iap` specifically for the Academy section on iOS devices. (Note: Stripe is perfectly legal to use for physical Shop products and physical Booking appointments, so those sections are safe!).

### 2. Missing Photo Library Permissions (`NSPhotoLibraryUsageDescription`)
*   **The Problem:** The app has features where users upload photos (Photo Consultations, Academy Homework). When iOS users try to open their photo gallery, the app will crash or be rejected during App Review because it fails to explain *why* it needs photo access.
*   **The Fix:** In your `app.json`, you need to configure the `expo-image-picker` plugin with a privacy string explaining why you need access to their photos.
    ```json
    [
      "expo-image-picker",
      {
        "photosPermission": "Merakí needs access to your photos so you can upload consultation pictures and academy homework."
      }
    ]
    ```

### 3. APNs Setup for Push Notifications
*   **The Problem:** While your `NotificationContext.tsx` is perfectly coded to handle Expo push notifications, iOS requires strict server-side configuration that Android does not.
*   **The Fix:** You must create an APNs (Apple Push Notification service) Auth Key in your Apple Developer account and explicitly upload it to your Expo project using the EAS CLI (`eas credentials`). Unlike Android, where things often work out-of-the-box with just the `google-services.json` file, iOS will silently fail to deliver notifications without this certificate uploaded to Expo's servers.

---

## 💡 UX DIFFERENCES TO EXPECT ON iOS

1.  **NFC Scanning (`NFCScannerScreen.tsx`)**
    *   **Android:** NFC scanning can happen silently. A user holds the phone near the tag, and the app reads it immediately.
    *   **iOS:** Apple forces a native system modal to slide up from the bottom of the screen that says "Ready to Scan", blocking the rest of your custom UI. Your current implementation handles this correctly via `react-native-nfc-manager`, but be aware the visual experience looks very different.
2.  **Notification Permissions**
    *   **Android:** Historically, notifications were allowed by default (though Android 13+ now requires a prompt).
    *   **iOS:** Users must explicitly tap "Allow" on a native OS popup the very first time the app tries to register for notifications. It is best practice to show a custom screen explaining *why* they should accept notifications before triggering the native popup, otherwise they might instantly hit "Deny" and you can never ask them again.
3.  **Keyboard Behavior**
    *   iOS does not naturally push the screen up when the keyboard opens, often hiding text inputs. Your code smartly uses `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>` in several places (like `CheckoutScreen`), which is the correct cross-platform fix! Keep doing this anywhere there is a bottom text input.
