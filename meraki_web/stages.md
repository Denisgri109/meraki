# Merakí Web Platform - Development Stages

## Stage 1: Critical UI & Layout Fixes ✅
- [x] **Fix Vertical Text Bug:** Ensure all text in hero banners and other parts of the website is placed horizontally, not vertically. (Completed: Converted all 7 dashboard hero banners to use inline styles, bypassing Tailwind flex constraints).
- [x] **Fix Search Bar Widths:** The search bar seems to be very small in length almost everywhere on the website. Expand them to full width. (Completed).
- [x] **Clean Up Academy Page:** Remove the "Master the Art of Beauty" section. Fix the vertical text inside the Academy banners. (Completed).
- [x] **Database Column Mismatches:** Fixed specialty to specialties to restore data flow. (Completed).
- [x] **Auth Lock Contention:** Converted Supabase client to a singleton to prevent connection dropping and empty data. (Completed).

## Stage 2: Page Redesigns & Polish (Current) 🟠
- [x] **Redesign Schedule Page:** The schedule page is "very messed up". It needs a complete structural redesign to be user-friendly, responsive, and visually cohesive with the glassmorphism theme. (Completed).
- [x] **Redesign Services Page:** Needs a cleaner UI for Masters to manage their service offerings. (Completed).
- [ ] **General UI Polish:** Ensure all pages maintain the premium, whitish theme with vibrant colors and animations as requested earlier.

## Stage 3: Core Functional Features 🟡
- [x] **Implement Service Booking:**
  - I want to be able to actually book a service.
  - Flow: Select Service → Select Professional → Select Date/Time → Confirm Booking.
  - Must write to the appointments database table. *(Completed).*
- [x] **Implement Academy Purchases:**
  - Be able to buy academy courses.
  - Flow: Browse Courses → View Details → Purchase/Enroll.
  - Must write to the course_enrollments database table. *(Completed).*

## Stage 4: Advanced Integration & Security 🟢
- [ ] **Stripe Payment Gateway:** Integrate Stripe for taking deposits during booking and processing payments for Academy courses.
- [ ] **Supabase Realtime:** Enable live chat functionality.
- [ ] **Role-Based Access Guarding:** Ensure Clients cannot access Owner/Master pages, and vice-versa.
