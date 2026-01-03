# SocialsGenie Project Roadmap & TODO

## 🚀 Immediate Next Steps (Core Integrations)
- [ ] **Instagram API Application**: Finalize app settings in Meta Developer Portal (Review Permissions: `instagram_basic`, `instagram_content_publish`).
- [ ] **Threads Integration**: Research API availability (currently in beta/limited access). Apply for access if available.
- [x] **Bluesky Integration**: Implement AT Protocol integration for posting.
- [ ] **Mastodon Integration**: Implement ActivityPub/Mastodon API posting.
- [ ] **Tumblr Integration**: Add Tumblr API support (text + image posts).

## 🧪 Testing & Stability
- [ ] **Testing Suite Setup**: 
    - [ ] Install Jest/Vitest for unit testing utils.
    - [ ] Setup Playwright/Cypress for E2E testing of the composer flow.
- [ ] **Edge Case Handling**: Verified handling of API rate limits and token expirations for all connected platforms.

## 💰 Monetization (Payment Plans)
- [ ] **Database Schema**: Update DB to track user plan (Free vs Pro) and usage limits (posts per month).
- [ ] **Stripe Integration**:
    - [ ] Setup Stripe Checkout.
    - [ ] Create Webhook handler for subscription events.
- [ ] **UI Implementation**:
    - [ ] Create Upgrade/Pricing page.
    - [ ] Gate "Pro" features (e.g., specific platforms, unlimited AI usage) in the UI.

## 🔍 External Approvals (Waiting Game)
- [x] **LinkedIn**: Awaiting "Marketing Developer Platform" access approval for Company Page posting.
- [ ] **Instagram**: Complete App Review if requesting public permissions (usually needed for "live" mode).

## 📝 Backlog / Future
- [ ] **Analytics Dashboard**: Aggregate metrics (likes, views) from all platforms.
- [ ] **Team Collaboration**: Allow multiple users to manage one workspace.
- [ ] **Browser Extension**: Quick share from any page.
- [ ] **Review Pricing**: Finalize pricing tiers and payment flow, quantify AI usage limits for each tier.
- [ ] **Brand DNA Improvements**: Improve brand DNA generation and integration
- [ ] **Disaster Prevention** Think through potential issues and implement measures to prevent them (e.g. catastrohpic data loss, etc.)
- [ ] **Bluesky Posting** Implement Bluesky posting functionality.
- [ ] **Responsive Design**: Ensure the app is mobile-friendly and responsive.
- [ ] **Video Media**: Confirm video media support for all platforms.
- [ ] **Success/ Error Toasts**: Implement toast notifications for success and error messages. 
- [ ] **Social Copilot**: Implement social copilot functionality.
- [ ] **Pinterest**: Implement Pinterest posting functionality.
- [ ] **Admin Route**: Implement admin route for managing users and their subscriptions, among other things (i.e. feature flags)