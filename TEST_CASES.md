# Feature Test Cases - Multi-Master Platform

## 📋 Testing Checklist

Use this document to manually test all the new features. Mark items with ✅ when passed.

---

## 🎛️ Phase 1: Business Settings (Master Dashboard → Policies)

### Access Test
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.1 | Navigate to Policies | Master Dashboard → Tap "Policies" button | BusinessSettingsScreen opens |  |
| 1.2 | Screen loads data | Wait for screen to load | Shows current settings (or defaults) |  |

### Confirmation Timing
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.3 | Change confirmation timing | Tap different timing option (12h/24h/72h) | Option highlights, save button enabled |  |
| 1.4 | Save timing | Tap "Save Changes" | Success alert, data persists on reload |  |

### Late Arrival
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.5 | Adjust late threshold | Tap different late arrival option (10/15/20/30 min) | Option highlights |  |
| 1.6 | Save late threshold | Save and reload | Value persists |  |

### Cancellation & No-Show Charges
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.7 | Set cancellation % | Use slider to set 50% | Percentage displays correctly |  |
| 1.8 | Set no-show % | Use slider to set 100% | Percentage displays correctly |  |
| 1.9 | Set 0% | Slide to 0% | Shows "No charge" |  |

### Terms & Conditions
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.10 | Open T&C editor | Tap "Edit Terms" button | Modal opens with text editor |  |
| 1.11 | Add T&C text | Type terms text | Text appears in editor |  |
| 1.12 | Save T&C | Tap "Save" in modal | Modal closes, T&C preview shown |  |
| 1.13 | Toggle require acceptance | Toggle "Require T&C Acceptance" | Switch changes state | |

### Visibility Settings
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.14 | Toggle new clients | Toggle "Accept New Clients" | Switch changes |  |
| 1.15 | Toggle discovery | Toggle "Show in Discovery" | Switch changes |  |
| 1.16 | Verify discovery effect | Toggle off, check from client account | Master should not appear in DiscoverMasters |  |

---

## 🔍 Phase 2: Discover Masters (Client Home → See All)

### Access Test
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.1 | Navigate to Discovery | Client Home → Featured Masters → "See All" | DiscoverMastersScreen opens |  |
| 2.2 | Masters load | Wait for data | List of masters appears |  |

### Location Features
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.3 | Location permission | First open (or reset permissions) | Permission dialog appears | ⬜ |
| 2.4 | Location detected | Grant permission | City name appears in header | ⬜ |
| 2.5 | Nearby sorting | With location | Masters in same city appear first | ⬜ |

### Search
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.6 | Search by name | Type master's name | Filtered results show |  |
| 2.7 | Search by city | Type city name | Masters in that city show | ⬜ |
| 2.8 | Clear search | Clear text field | All masters show again |  |

### Navigation
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.9 | Tap master card | Tap on any master | Navigates to MasterDetailScreen | ⬜ |
| 2.10 | Back navigation | Tap back button | Returns to previous screen | ⬜ |

---

## 🎫 Phase 3: Loyalty Card Builder (Master Dashboard → Loyalty)

### Access Test
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.1 | Navigate to Loyalty | Master Dashboard → Tap "Loyalty" button | LoyaltyCardBuilderScreen opens |  |
| 3.2 | Empty state | No cards created yet | Empty state with "Create" button |  |

### Create Card
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.3 | Open creator | Tap "+" or "Create" button | Card creation modal opens |  |
| 3.4 | Enter card name | Type "Coffee Loyalty" | Text appears in field |  |
| 3.5 | Select stamps required | Tap stamp count (3-12) | Count highlights |  |
| 3.6 | Choose reward type | Select Free Service/% Off/€ Off | Type highlights |  |
| 3.7 | Set reward value | Enter "Free Haircut" or "20" | Value shows |  |
| 3.8 | Save card | Tap "Save" | Card appears in list |  |

### Manage Cards
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.9 | View card details | See card in list | Shows name, stamps, reward |  |
| 3.10 | Edit card | Tap "Edit" on card | Modal opens with data |  |
| 3.11 | Pause card | Tap "Pause" on active card | Status changes to "Paused" |  |
| 3.12 | Activate card | Tap "Activate" on paused card | Status changes to "Active" |  |
| 3.13 | Delete card | Tap "Delete", confirm | Card removed from list |  |

---

## 📧 Phase 4: Campaigns (Master Dashboard → Campaigns)

### Access Test
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.1 | Navigate to Campaigns | Master Dashboard → Tap "Campaigns" button | AftercareCampaignScreen opens |  |
| 4.2 | Empty state | No campaigns yet | Empty state message |  |

### Create Aftercare Campaign
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.3 | Open creator | Tap "+" button | Creation modal opens |  |
| 4.4 | Select Aftercare type | Tap "Aftercare Reminder" | Type highlights |  |
| 4.5 | Enter name | Type "Brow Touch-up" | Name appears |  |
| 4.6 | Enter message | Type reminder message | Text appears |  |
| 4.7 | Select days after | Tap 30 days | Option highlights |  |
| 4.8 | Toggle recurring | Toggle on/off | Switch changes |  |
| 4.9 | Save campaign | Tap "Save" | Campaign appears in list |  |

### Create Vacation Notice
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.10 | Select Vacation type | Tap "Vacation Notice" | Type highlights | ⬜ |
| 4.11 | Set date range | Select start and end dates | Dates display | ⬜ |
| 4.12 | Save vacation | Tap "Save" | Campaign with date range shows | ⬜ |

### Create Promotion
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.13 | Select Promotion type | Tap "Promotion" | Type highlights | ⬜ |
| 4.14 | Set promo dates | Select start and end dates | Dates display | ⬜ |
| 4.15 | Save promotion | Tap "Save" | Campaign shows in list | ⬜ |

### Manage Campaigns
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.16 | Edit campaign | Tap "Edit" | Modal opens with data | ⬜ |
| 4.17 | Pause campaign | Tap "Pause" | Status shows "Paused" | ⬜ |
| 4.18 | Delete campaign | Tap "Delete", confirm | Campaign removed | ⬜ |

---

## 🔔 Phase 5: Push Notifications

> ⚠️ **Note**: Push notifications require a development or preview build. They do NOT work in Expo Go.

### Build Requirements
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.1 | Create dev build | Run `npx eas build --profile development --platform android` | Build completes | ⬜ |
| 5.2 | Install on device | Download and install APK | App opens on device | ⬜ |

### Permission & Registration
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.3 | Permission prompt | Log in on physical device | Notification permission dialog | ⬜ |
| 5.4 | Grant permission | Tap "Allow" | Permission granted | ⬜ |
| 5.5 | Token registered | Check console/Supabase | push_token saved to profile | ⬜ |

### Appointment Confirmations
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.6 | Trigger confirmation | Book appointment 24h ahead, wait or trigger Edge Function | Push notification received | ⬜ |
| 5.7 | Notification content | View notification | Shows "📅 Confirm Your Appointment" | ⬜ |
| 5.8 | Tap notification | Tap on notification | Opens appointment details | ⬜ |

### Message Notifications
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.9 | Receive message | Another user sends message | Push notification received | ⬜ |
| 5.10 | Notification content | View notification | Shows "💬 [Sender Name]" | ⬜ |
| 5.11 | Tap message notification | Tap notification | Opens chat screen | ⬜ |

### Appointment Reminders
| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.12 | 24h reminder | Appointment in ~24 hours | Reminder notification | ⬜ |
| 5.13 | 1h reminder | Appointment in ~1 hour | Reminder notification | ⬜ |

---

## 🗄️ Database Verification (Supabase Dashboard)

### New Tables
| # | Table | Check | Status |
|---|-------|-------|--------|
| 6.1 | `master_settings` | Table exists with RLS | ⬜ |
| 6.2 | `loyalty_cards` | Table exists with RLS | ⬜ |
| 6.3 | `client_stamps` | Table exists | ⬜ |
| 6.4 | `stamp_history` | Table exists | ⬜ |
| 6.5 | `consultation_responses` | Table exists | ⬜ |
| 6.6 | `tc_acceptances` | Table exists | ⬜ |
| 6.7 | `aftercare_campaigns` | Table exists | ⬜ |
| 6.8 | `notification_log` | Table exists | ⬜ |

### Profile Columns
| # | Column | Check | Status |
|---|--------|-------|--------|
| 6.9 | `push_token` | Column exists in profiles | ⬜ |
| 6.10 | `notification_preferences` | JSONB column exists | ⬜ |

---

## 🐛 Known Issues / Edge Cases

| # | Issue | Reproduce | Workaround |
|---|-------|-----------|------------|
| - | Push won't work in Expo Go | Try sending notification in Expo Go | Use development build |
| - | Location permission on iOS | Test on iOS simulator | Use physical device |
| - | Deno lint errors in IDE | View Edge Function files | Ignore - they run in Deno runtime |

---

## ✅ Summary

| Phase | Total Tests | Passed | Failed |
|-------|-------------|--------|--------|
| Business Settings | 16 | _ | _ |
| Discover Masters | 10 | _ | _ |
| Loyalty Cards | 13 | _ | _ |
| Campaigns | 18 | _ | _ |
| Push Notifications | 13 | _ | _ |
| Database | 10 | _ | _ |
| **TOTAL** | **80** | _ | _ |

---

*Last Updated: 2026-02-03*
s