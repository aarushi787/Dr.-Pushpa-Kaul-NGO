# Dr. Pushpa Kaul NGO - Application Features & Workflows

This document outlines the key features implemented in the Dr. Pushpa Kaul NGO (SJM Healthcare) website and their respective workflows.

## 1. User Authentication & Email Verification
**Objective:** Secure user access and ensure valid email addresses.

### Workflow:
1.  **Sign In:** Users sign in using Google Authentication.
2.  **Account Creation:** On first sign-in, a user profile is created in Firestore (`/users/{uid}`).
3.  **Verification Check:** The application checks if the user's email is verified (`user.emailVerified`).
4.  **Verification Banner:** If unverified, a global banner appears at the top of the site.
5.  **Resend Link:** Users can click "Resend Verification" to receive a new link via Firebase Auth.
6.  **Access Control:** Certain features (like submitting feedback or contact forms) are restricted to verified users via Firestore Security Rules.

## 2. SEO Optimization
**Objective:** Improve search engine visibility and social media presence.

### Workflow:
1.  **Dynamic Metadata:** The `SEO` component uses `react-helmet-async` to inject `<title>`, `<meta name="description">`, and Open Graph tags into the `<head>`.
2.  **Page-Specific Tags:** Each major route (Home, Programs, Profile, Admin) sets its own unique metadata.
3.  **Social Preview:** When a link is shared, platforms like Facebook or Twitter display the configured title, description, and preview image.

## 3. Cookie Consent Banner
**Objective:** Comply with privacy regulations and inform users about cookie usage.

### Workflow:
1.  **Detection:** On page load, the app checks `localStorage` for `cookie-consent`.
2.  **Display:** If no preference is found, a banner slides up from the bottom after a 2-second delay.
3.  **Action:**
    *   **Accept:** Sets `localStorage` to `accepted` and hides the banner.
    *   **Reject:** Sets `localStorage` to `rejected` and hides the banner.
4.  **Persistence:** The banner will not reappear on subsequent visits once a choice is made.

## 4. Feedback Mechanism
**Objective:** Gather user input on website experience.

### Workflow:
1.  **Trigger:** A floating "Feedback" button is available on the bottom right of every page.
2.  **Form:** Users can select a star rating (1-5) and provide optional comments.
3.  **Submission:**
    *   The app captures the current URL, user ID (if logged in), and timestamp.
    *   Data is saved to the `/feedback` collection in Firestore.
4.  **Success:** A "Thank You" message is displayed, and the form closes automatically after 3 seconds.

## 5. Social Media Sharing
**Objective:** Increase reach by allowing users to share NGO programs and success stories.

### Workflow:
1.  **Integration:** Sharing buttons (Facebook, Twitter, LinkedIn) are integrated into the "Programs" and "Success Stories" sections.
2.  **Dynamic Links:** The buttons automatically use the current page URL and relevant content titles.
3.  **Interaction:** Clicking a button opens the respective platform's sharing dialog in a new window.

## 6. Donations (Stripe & Firestore Integration)
**Objective:** Facilitate secure financial support and track impact.

### Workflow:
1.  **Selection:** Users choose a donation amount, frequency (one-time/monthly), and fund allocation (e.g., General, Medical, Surgical).
2.  **Progress Tracking:** A dynamic progress bar on the donation page shows real-time progress toward fundraising goals.
3.  **Confirmation:** A summary modal allows users to review their donation details before proceeding.
4.  **Checkout:** Clicking "Donate" calls the backend API `/api/create-checkout-session`.
5.  **Redirection:** The backend creates a Stripe Checkout session and returns a URL. The user is redirected to Stripe's secure payment page.
6.  **Recording:** Upon session creation, the donation attempt is recorded in the `/donations` Firestore collection for analytics.
7.  **Completion:** After payment, Stripe redirects the user back to a "Success" or "Cancel" page on the NGO site.

## 7. Contact & Newsletter
**Objective:** Enable communication and community building.

### Workflow (Contact):
1.  **Submission:** Users fill out the contact form.
2.  **Processing:** Data is sent to `/api/contact` (backend) and also saved to Firestore `/contact_submissions`.
3.  **Notification:** The backend logs the submission and is prepared for integration with email services (e.g., SendGrid).

### Workflow (Newsletter):
1.  **Subscription:** Users enter their email in the footer.
2.  **Storage:** The email is added to the `/newsletter_subscribers` collection in Firestore.

## 8. Admin Dashboard (Enhanced)
**Objective:** Comprehensive management of NGO operations and data-driven insights.

### Workflow:
1.  **Authorization:** Only users with the `admin` role in their Firestore profile can access `/admin`.
2.  **Analytics:**
    *   **Donation Trends:** Line charts visualize donation growth over time.
    *   **Engagement:** Bar charts show subscriber, inquiry, and event counts.
    *   **Fund Allocation:** Pie charts display the distribution of total donated amounts across different categories (General, Medical, etc.).
3.  **Event Management:** Admins can perform full CRUD operations (Create, Read, Update, Delete) on NGO events like medical camps and awareness programs.
4.  **User Role Management:** Admins can view all registered users and toggle their roles between `user` and `admin`.
5.  **Data Management:** Advanced filtering (by search/date) and sorting are available for newsletter subscribers and contact inquiries.

## 9. User Profile & Personalization
**Objective:** Allow users to manage their identity and track their involvement.

### Workflow:
1.  **Profile Management:** Users can update their display name and profile information.
2.  **Image Upload:** Users can upload a profile picture directly from their device.
3.  **Storage:** Images are securely stored in Firebase Storage under `/profile_pictures/{uid}/`.
4.  **Persistence:** Profile changes are synced across Firebase Auth and the Firestore `/users` collection.

## 10. System Robustness & Error Handling
**Objective:** Ensure a stable and diagnosable application environment.

### Workflow:
1.  **Resilient Initialization:** The backend server handles missing Firebase configuration files gracefully, falling back to environment variables.
2.  **Firestore Error Spec:** All Firestore operations use a standardized error handler that captures detailed context (operation type, path, auth state) for easier debugging.
3.  **Error Boundaries:** React Error Boundaries catch and display user-friendly messages for runtime exceptions.

---
# Run and deploy app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
