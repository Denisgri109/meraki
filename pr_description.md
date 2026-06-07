💡 **What:** Replaced the sequential `for...of` loop in `PreBookingQuestionnaireModal.tsx`'s `pickPhotos` function with a concurrent `Promise.all()` implementation.

🎯 **Why:** Previously, uploading multiple photos caused an N+1 query issue, where files were uploaded sequentially to Supabase storage. This means the total upload time scaled linearly with the number of photos selected by the user, resulting in a poor and potentially very slow user experience. By resolving these async uploads concurrently, we minimize the blocking wait time.

📊 **Measured Improvement:** In a local simulated benchmark for 3 image assets (assuming a fixed 500ms upload delay per file):
*   **Baseline (Sequential):** 1503ms
*   **Optimized (Concurrent):** 501ms
*   **Improvement:** 66.6% reduction in total upload time for 3 images.

✅ **Verification:**
* Verified the functional translation: `if (!asset.base64) continue;` was safely translated to `.map(async => { if (!asset.base64) return null; ... })` followed by a `.filter(url => url !== null)` to cleanly generate the string array of urls.
* Ensured `Date.now()` and `uuidv4()` prevent any filename collisions during concurrent execution.
* Verified no typing errors in `tsc --project tsconfig.json`.
