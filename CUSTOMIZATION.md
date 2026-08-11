# Owner customization (mobile)

How an owner changes the text and images in the Merakí app, and how the code
enforces that only an owner can.

## Where content lives

Every customizable value is one row in the Supabase `global_settings` table
(`key` → `value`). RLS on that table already restricts writes to owners:

- `global_settings_public_read` — anyone may read
- `global_settings_owner_insert` / `_update` / `_delete` — `is_owner_user(auth.uid())`

So a tampered client cannot write content even if it bypassed the UI. The
client-side checks below are for affordances and clear error messages, not for
security.

### Key namespaces

| Prefix | Scope |
|---|---|
| `mobile.*` | Screens that only exist in the app |
| `brand.*`, `footer.*` | Brand name and tagline — **shared with the website** |
| `support.*`, `faq_items`, `support_settings` | Support page and FAQ — **shared** |
| `legal.*` | Terms of Service and Privacy Policy bodies — **shared** |
| `image.*` | Logo and shared imagery — **shared** |
| `theme.*` | Website colours only (see `WEB_PARITY_AUDIT.md`) |

`src/lib/mobileContent.ts` is the single registry of editable keys, their
labels, and their factory defaults. Screens and the Customize App screen both
read it, so an inline edit and a dashboard edit can never disagree about what
"restore original" means.

## How an owner edits

1. **Menu → Customize App**, then **Turn On** Visual Edit Mode.
2. A floating toolbar appears on every screen (`EditToolbar`). Editable text
   gets a dashed pink outline; editable images get a pink border and a pencil
   button.
3. Tapping opens a save/cancel editor. Saving publishes immediately to every
   user; other devices and the website pick the change up over Supabase
   Realtime.
4. **Client View** on the toolbar swaps the app to the client tab set so the
   owner can edit client-facing screens, which the owner navigator otherwise
   never shows. Editing rights are unchanged in Client View — turn edit mode off
   to see exactly what a client sees.
5. Customize App also has **Text**, **Images**, **Support** and **Reset** tabs
   for editing everything from one place, including sign-in copy that cannot be
   reached while signed in.

## Components

| File | Purpose |
|---|---|
| `contexts/EditContext.tsx` | Content map, owner gating, optimistic writes with rollback, realtime sync, offline cache, edit mode and Client View state |
| `components/editable/EditableText.tsx` | Tap-to-edit text. Renders a plain `Text` when not editing, so enabling edit mode never reflows a screen |
| `components/editable/EditableImage.tsx` | Tap-to-replace image with reset-to-default |
| `components/editable/EditableLegalBody.tsx` | Whole-document editor for Terms / Privacy; empty override restores the built-in document |
| `components/editable/EditToolbar.tsx` | Floating owner toolbar, mounted once in `AppNavigator` |
| `screens/owner/CustomizeAppScreen.tsx` | Full editor: Text / Images / Support / Reset |

## Adding a new editable string

1. Add `{ key, label, fallback }` to the right group in
   `src/lib/mobileContent.ts`.
2. Replace the literal in the screen:
   ```tsx
   <EditableText contentKey="mobile.home.hero_button" label="Hero Button Label" style={styles.x} />
   ```
   The fallback comes from the registry; pass `fallback` only to override it.

The string is then editable inline *and* from Customize App, and is covered by
the matching Reset section automatically.

## Guarantees under test

`src/components/__tests__/editable.test.tsx` and
`src/contexts/__tests__/EditContext.test.tsx` lock:

- clients and masters get no edit affordance and cannot open an editor
- an owner with edit mode off gets no edit affordance
- failed writes roll the optimistic value back rather than showing a lie
- `clearContent` deletes the row so the factory default applies again
- Client View does not silently drop the owner's edit rights
