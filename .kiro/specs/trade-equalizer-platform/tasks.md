# Implementation Plan

## P0 MVP Scope (Pilot-Ready)
Focus on MTG-only, USD pricing from TCGplayer Market, enhanced security, and core trading functionality for LGS trials.

## P1 Beta Features (Post-Pilot)
Multi-game support, enhanced offline functionality, notifications, and operational improvements based on pilot learnings.

## P2 Future Features
Multi-currency, LGS buylist integration, and advanced features based on user demand.

## Task Prioritization for P0 MVP
**Critical Path (Must Complete First):**
- Tasks 1-3: Project setup and database foundation
- Task 4: MTG card catalog (P0 scope)
- Task 7: TCGplayer Market pricing (P0 scope)
- Task 9: Secure QR sessions (P0 enhanced security)
- Task 30: Immutable snapshots & concurrency (P0 elevated)
- Task 35: Security hardening (P0 critical)

**Core Trading Flow:**
- Tasks 5-6: Inventory and want list management
- Task 8: Matching algorithm with printing constraints
- Tasks 10-13: Real-time trading and receipt generation
- Task 16: Stripe integration for subscriptions

**Event & Compliance:**
- Task 14: Event system with privacy controls
- Task 15: Kiosk mode (anonymous)
- Tasks 18-20: Security, legal, accessibility

**Launch Preparation:**
- Tasks 21-24: Performance, testing, deployment
- Task 37: Final integration and pilot launch

- [x] 1. Initialize Next.js PWA project with core dependencies





  - Set up Next.js 14+ with App Router and TypeScript configuration
  - Install and configure PWA dependencies (next-pwa, workbox)
  - Create basic project structure with mobile-first responsive layout
  - Ensure application builds and runs locally for immediate testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-1-completion.md with build instructions and testing steps
  - _Requirements: 9.4, 9.5_

- [x] 2. Configure Supabase integration and authentication





  - Review development-rules.md for compliance and approach
  - Initialize Supabase project and configure environment variables
  - Set up Supabase client with TypeScript types generation
  - Implement email-based authentication with Supabase Auth
  - Create protected route middleware and auth context providers
  - Ensure authentication flow works in browser for testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-2-completion.md with authentication testing procedures
  - _Requirements: 8.3_

- [x] 3. Create database schema and migrations





  - Review development-rules.md for compliance and approach
  - Write SQL migrations for all core tables (users, items, inventory, wants, prices, trade_sessions, events)
  - Set up database indexes for performance optimization
  - Configure row-level security policies for data protection
  - Create database seed scripts with sample MTG card data
  - _Requirements: 1.1, 1.4, 6.1, 8.1_

- [ ] 4. Implement MTG-only card catalog system with search functionality [P0]
  - Review development-rules.md for compliance and approach
  - Create Item model supporting MTG with language and finish variants (multi-game deferred to P1)
  - Build full-text search API endpoint with PostgreSQL search vectors for MTG cards
  - Implement Scryfall API integration for bulk MTG card data import
  - Create background job for daily MTG card catalog synchronization
  - Ensure search functionality works in browser with test data
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-4-completion.md with search testing procedures and sample queries
  - _Requirements: 1.2, 6.1 (P0 scope: MTG-only)_

- [ ] 5. Build inventory management system with printing specifics
  - Review development-rules.md for compliance and approach
  - Create Inventory model with language, finish, and condition tracking
  - Implement inventory API endpoints with printing-specific validation
  - Build mobile-first inventory management UI with printing selection controls
  - Add CSV import functionality supporting printing details and language variants
  - Create inventory filtering by condition, language, finish, and tradable status
  - Implement subscription tier limits for inventory count (Free: 100 items)
  - Ensure inventory management works in browser with sample data
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-5-completion.md with inventory testing procedures and CSV import examples
  - _Requirements: 1.1, 1.5, 11.1, 16.1_

- [ ] 6. Implement want list management system with printing constraints
  - Review development-rules.md for compliance and approach
  - Create Want model with language preferences, finish options, and condition constraints
  - Build want list API endpoints with printing-specific validation
  - Design mobile-optimized want list interface with priority and constraint indicators
  - Implement want list CRUD operations with real-time updates and constraint checking
  - Add bulk want list management with printing specification features
  - Implement subscription tier limits for want list count (Free: 50 wants)
  - Ensure want list functionality works in browser with constraint testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-6-completion.md with want list testing procedures and constraint examples
  - _Requirements: 1.4, 11.2, 11.4, 16.1_

- [ ] 7. Integrate TCGplayer Market pricing system with condition multipliers [P0]
  - Review development-rules.md for compliance and approach
  - Set up TCGplayer Market API integration (multi-source deferred to P1/P2)
  - Create Price model with USD-only pricing, condition multipliers (NM 1.0, LP 0.9, MP 0.75, HP 0.5), and finish multipliers
  - Implement daily price synchronization with version tracking for audit trails
  - Build price caching layer with Redis for TCGplayer Market data
  - Add price staleness indicators and as-of timestamps in UI
  - Ensure pricing data displays correctly in browser with sample cards
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-7-completion.md with pricing testing procedures and API integration verification
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5 (P0 scope: Market pricing, USD only)_

- [ ] 8. Develop core matching algorithm with printing awareness
  - Review development-rules.md for compliance and approach
  - Implement coverage-first matching algorithm respecting language and finish constraints
  - Create configurable trade fairness validation (±5% default, ±2-10% for LGS)
  - Build make-it-even suggestion system preferring small cards and printing swaps
  - Add coverage scoring with Must/Want/Nice counters and visual badges
  - Implement P95 <3s performance target with skeleton UI for slower responses
  - Add conflict detection for items becoming non-tradable during sessions
  - Ensure matching algorithm works in browser with test inventory and want lists
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-8-completion.md with matching testing scenarios and performance verification
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 11.3, 11.4_

- [x] 9. Build secure QR code trading session system [P0]



  - Review development-rules.md for compliance and approach
  - Create TradeSession model with MTG-only, TCGplayer Market pricing, and ±5% fairness threshold
  - Implement single-use QR token generation with 2-minute TTL and 10/min/IP rate limiting
  - Build session joining functionality via QR code scanning with strict expiry handling
  - Add real-time WebSocket connections for trade sessions
  - Create session state management, cleanup processes, and conflict resolution
  - Implement QR rate limiting table and IP-based abuse prevention
  - Ensure QR session creation and joining works in browser with mobile testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-9-completion.md with QR testing procedures and security verification steps
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 14.1 (P0 scope: Enhanced security)_

- [ ] 10. Implement real-time trade proposal system
  - Review development-rules.md for compliance and approach
  - Create TradeProposal model with status tracking
  - Build WebSocket handlers for real-time trade communication
  - Implement trade proposal creation and validation
  - Add proposal acceptance/rejection functionality
  - Create conflict resolution for concurrent trade actions
  - Ensure real-time proposals work in browser with multiple tabs/devices
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-10-completion.md with real-time testing procedures and WebSocket verification
  - _Requirements: 2.1, 2.5_

- [ ] 11. Develop mobile-first trading interface
  - Review development-rules.md for compliance and approach
  - Design touch-optimized trade proposal UI with swipe gestures
  - Implement camera integration for QR code scanning
  - Build responsive trade session interface with real-time updates
  - Add haptic feedback for trade confirmations
  - Create gesture navigation between trade screens
  - Ensure mobile interface works properly in browser on mobile devices
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-11-completion.md with mobile testing procedures and gesture verification
  - _Requirements: 3.1, 9.3, 9.4_

- [ ] 12. Create PDF receipt generation system with audit trail
  - Review development-rules.md for compliance and approach
  - Implement PDF generation using PDFKit with complete trade details and price versions
  - Design receipt template showing printing details, price sources, and manual overrides
  - Add email delivery functionality with consent verification for receipts
  - Create receipt storage, retrieval system, and offline queuing for poor connectivity
  - Optimize PDF generation performance (P95 <2s including cold starts)
  - Implement immutable trade record storage for audit compliance
  - Ensure PDF generation works in browser and receipts display correctly
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-12-completion.md with receipt testing procedures and PDF verification steps
  - _Requirements: 4.1, 4.2, 4.4, 4.5, 6.5, 12.4, 13.4_

- [ ] 13. Build inventory update system for completed trades
  - Review development-rules.md for compliance and approach
  - Implement atomic inventory updates for trade completion
  - Create trade history tracking and audit trail
  - Add rollback functionality for failed trade updates
  - Build inventory reconciliation and validation
  - Create trade completion notifications and confirmations
  - Write integration tests for inventory update accuracy
  - _Requirements: 4.3_

- [ ] 14. Implement event system with privacy controls and game-specific settings
  - Review development-rules.md for compliance and approach
  - Create Event and EventMember models with game type, price source defaults, and privacy settings
  - Build event creation with configurable fairness thresholds and time-boxed visibility
  - Implement event-scoped trade matching with P95 <1s performance for 50+ users
  - Add event joining via unique codes with explicit consent for visibility and contact sharing
  - Create event member visibility controls with automatic expiry and privacy defaults
  - Implement subscription tier limits for event creation (Free: 1 event/month)
  - Write tests for event isolation, privacy controls, and performance under load
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 10.1, 10.2, 13.1, 13.2, 13.4, 13.5, 14.3, 16.1_

- [ ] 15. Develop privacy-focused kiosk mode for LGS displays
  - Review development-rules.md for compliance and approach
  - Create kiosk-optimized UI showing only anonymous aggregated match data
  - Implement anonymous match board with rotating prompts and no personal information
  - Build event-scoped nearby matches display respecting privacy settings
  - Add auto-refresh functionality and co-branding options for LGS subscribers
  - Create kiosk configuration interface with privacy compliance controls
  - Ensure kiosk pulls only anonymous aggregates without exposing user details
  - Write tests for kiosk privacy compliance and performance with 50+ users
  - _Requirements: 5.3, 5.5, 13.3, 16.3_

- [ ] 16. Integrate Stripe payment system
  - Review development-rules.md for compliance and approach
  - Set up Stripe integration with subscription plans (Free/Pro/LGS)
  - Implement checkout flow for subscription upgrades
  - Build webhook handlers for payment events
  - Create subscription entitlement enforcement system
  - Add billing portal integration for subscription management
  - Write tests for payment processing and webhook handling
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 17. Implement PWA features and basic offline functionality [P0]
  - Review development-rules.md for compliance and approach
  - Configure service worker with price snapshot caching strategies
  - Add PWA manifest with mobile-optimized settings for installation
  - Implement offline price cache for trade calculations (P0)
  - Create offline indicator and stale data banners (P1: full offline sessions)
  - Build "Clear offline data" controls and storage quota monitoring (P1)
  - Write tests for PWA installation and price caching
  - _Requirements: 12.1, 12.2 (P0), 12.3, 12.4, 12.5 (P1)_

- [ ] 18. Add security and rate limiting systems
  - Review development-rules.md for compliance and approach
  - Implement API rate limiting with Redis-based counters
  - Add input validation and sanitization middleware
  - Create PII protection in logging systems
  - Build security headers and CORS configuration
  - Add request monitoring and abuse detection
  - Ensure security measures work properly in browser testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-18-completion.md with security testing procedures and rate limiting verification
  - _Requirements: 8.1, 8.2, 8.4_

- [ ] 19. Create analytics and monitoring system
  - Review development-rules.md for compliance and approach
  - Integrate Plausible Analytics with privacy-focused tracking
  - Implement custom event tracking for key user actions
  - Build performance monitoring and error reporting
  - Add health check endpoints for system monitoring
  - Create user behavior analytics dashboard
  - Ensure analytics tracking works properly in browser with privacy compliance
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-19-completion.md with analytics testing procedures and privacy verification
  - _Requirements: 8.5_

- [ ] 20. Build legal compliance and user safety features
  - Review development-rules.md for compliance and approach
  - Create Terms of Service and Privacy Policy pages
  - Add disclaimer about TCG compatibility and non-affiliation
  - Implement user data export and deletion functionality
  - Build content moderation and reporting systems
  - Add age verification and parental consent flows
  - Ensure legal pages display correctly and data export/deletion works in browser
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-20-completion.md with compliance testing procedures and legal requirement verification
  - _Requirements: 8.4, 8.5_

- [ ] 21. Optimize performance for mobile networks
  - Review development-rules.md for compliance and approach
  - Implement code splitting and lazy loading for mobile performance
  - Add image optimization and responsive image delivery
  - Create performance budgets and monitoring
  - Optimize database queries and add query performance monitoring
  - Build CDN integration for static asset delivery
  - Ensure performance optimizations work properly in browser on mobile devices
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-21-completion.md with performance testing procedures and mobile network verification
  - _Requirements: 9.1, 9.2_

- [ ] 22. Prepare application for comprehensive manual testing
  - Review development-rules.md for compliance and approach
  - Ensure all features work end-to-end in browser for complete trade flows
  - Verify mobile functionality works properly with device testing
  - Optimize application performance for manual load testing scenarios
  - Implement accessibility features for manual accessibility verification
  - Ensure cross-browser compatibility for manual browser testing
  - Verify UI consistency across different screen sizes and devices
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-22-completion.md with manual testing procedures and browser compatibility checklist
  - _Requirements: 9.3, 9.5_

- [ ] 23. Implement deployment and DevOps pipeline
  - Review development-rules.md for compliance and approach
  - Set up production deployment pipeline with Vercel/Netlify
  - Configure environment-specific configurations and secrets
  - Add database migration and rollback procedures
  - Create monitoring and alerting for production issues
  - Build backup and disaster recovery procedures
  - Ensure deployment pipeline works and application deploys successfully
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-23-completion.md with deployment procedures and verification steps
  - _Requirements: 8.1, 8.2_

- [ ] 24. Create user onboarding and help system
  - Review development-rules.md for compliance and approach
  - Build interactive onboarding flow for new users
  - Create in-app help system and tooltips
  - Add tutorial mode for first-time trading
  - Implement contextual help and feature discovery
  - Build user feedback and support request system
  - Ensure onboarding flow works properly in browser for new user experience
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-24-completion.md with onboarding testing procedures and help system verification
  - _Requirements: 7.2_

- [ ] 25. Implement comprehensive audit logging and monitoring system
  - Review development-rules.md for compliance and approach
  - Create audit log system tracking all trade actions, user activities, and system events
  - Build admin dashboard for monitoring key metrics and SLO compliance
  - Implement health check endpoints with detailed system status information
  - Add error budget tracking and alerting for SLO violations
  - Create user usage tracking for subscription tier limit enforcement
  - Build abuse detection and rate limiting monitoring
  - Ensure audit logging and monitoring dashboard work properly in browser
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-25-completion.md with audit logging testing procedures and monitoring verification
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 26. Build data export and account deletion system
  - Review development-rules.md for compliance and approach
  - Implement comprehensive data export functionality (CSV/JSON for inventory, wants, receipts)
  - Create account deletion system with PII purging and configurable receipt retention
  - Build data portability features with standard format exports
  - Add user-initiated data export with email delivery
  - Implement GDPR-compliant data deletion with audit trails
  - Create data lifecycle management with automated cleanup processes
  - Ensure data export and deletion functionality works properly in browser
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-26-completion.md with data export testing procedures and deletion verification steps
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 27. Implement subscription tier system with graceful limit enforcement
  - Review development-rules.md for compliance and approach
  - Build subscription tier management with clear feature differentiation
  - Implement graceful limit banners and upgrade modals for Free tier users
  - Add Pro tier features (unlimited inventory/wants, notifications, CSV import)
  - Create LGS tier features (kiosk mode, event codes, co-branding)
  - Build usage tracking and limit enforcement with reset periods
  - Add subscription upgrade flows and entitlement checking
  - Ensure subscription tiers and limit enforcement work properly in browser
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-27-completion.md with subscription testing procedures and limit verification steps
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 28. Enhance offline functionality and data synchronization
  - Review development-rules.md for compliance and approach
  - Implement comprehensive offline data caching for inventory and want lists
  - Build background sync for trade proposals and receipt delivery
  - Add stale data indicators and offline mode notifications
  - Create conflict resolution for offline-to-online data synchronization
  - Implement PWA installation prompts and offline-first architecture
  - Add push notification system for trade updates and event announcements
  - Ensure offline functionality works properly in browser with network simulation
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-28-completion.md with offline testing procedures and sync verification steps
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 29. Prepare pilot-ready scenarios for manual quality assurance
  - Review development-rules.md for compliance and approach
  - Create manual test scenarios for multi-price source validation (market vs buylist)
  - Prepare printing/language/condition constraint testing procedures
  - Set up offline event testing scenarios with cached prices and queued receipts
  - Prepare QR expiry testing and session regeneration validation procedures
  - Create free-tier limit testing scenarios with banner triggers and recovery
  - Prepare load testing scenarios for event scenarios with 50+ concurrent users
  - Ensure all pilot scenarios work properly in browser for manual testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-29-completion.md with comprehensive pilot testing procedures and scenario validation
  - _Requirements: All pilot test scenarios_

- [ ] 30. Implement immutable trade snapshots and concurrency control [P0 - ELEVATED]
  - Review development-rules.md for compliance and approach
  - Create item reservation system to prevent double-spend during active proposals (5-minute timeout)
  - Build immutable trade snapshot storage with complete printing details, price versions, fairness thresholds, and manual overrides
  - Implement automatic reservation cleanup and conflict detection with graceful failure
  - Add "Recalculate" banners and clear conflict resolution UI
  - Create reservation monitoring and cleanup background jobs
  - Ensure concurrency control works properly in browser with multiple session testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-30-completion.md with concurrency testing procedures and double-spend prevention verification
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5 (P0 - Critical for pilot integrity)_

- [ ] 31. Build LGS buylist integration system
  - Review development-rules.md for compliance and approach
  - Create LGS buylist upload functionality with CSV parsing and validation
  - Implement buylist price computation with market fallback for missing SKUs
  - Build buylist management interface with SKU mapping and price override capabilities
  - Add buylist vs market pricing badges and clear indicators throughout the UI
  - Create receipt generation showing buylist vs market pricing sources used
  - Ensure buylist integration works properly in browser with CSV upload testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-31-completion.md with buylist testing procedures and price accuracy verification
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 32. Implement currency support and regional pricing
  - Review development-rules.md for compliance and approach
  - Add multi-currency support starting with USD and EUR with clear labeling
  - Build daily FX rate integration and conversion display with timestamps
  - Create currency selection per event and session with conversion indicators
  - Implement native regional price source integration where available
  - Add currency conversion display in receipts with rates and methods used
  - Ensure currency conversion works properly in browser with different currency testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-32-completion.md with currency testing procedures and conversion accuracy verification
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 33. Build Pro notifications and LGS event reminder system
  - Review development-rules.md for compliance and approach
  - Implement push notification system for Pro users with Must-want match alerts
  - Create email notification preferences with granular opt-in controls
  - Build LGS event reminder system with participant opt-in and unsubscribe links
  - Add notification rate limiting and queue management for high-volume events
  - Create notification preference management UI with clear privacy controls
  - Ensure notification system works properly in browser with preference testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-33-completion.md with notification testing procedures and opt-in flow verification
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [ ] 34. Implement feature flags and operational safety systems
  - Review development-rules.md for compliance and approach
  - Create feature flag system for kiosk mode, notifications, and multi-TCG functionality
  - Build nightly encrypted backup system with documented restore procedures
  - Implement comprehensive health check endpoints with DB, worker, and queue status
  - Add data retention policy enforcement with configurable backup retention periods
  - Create incident monitoring and alerting for all critical system components
  - Ensure feature flags and health monitoring work properly in browser
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-34-completion.md with feature flag testing procedures and operational safety verification
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [ ] 35. Enhance security with QR token management and RLS hardening [P0 - CRITICAL]
  - Review development-rules.md for compliance and approach
  - Implement single-use QR tokens with strict 2-minute TTL (no device scoping for P0)
  - Add QR token invalidation on use and rate limiting (10/min/IP) with IP tracking table
  - Harden row-level security policies on Inventory, Want, Trade, EventMember tables
  - Create comprehensive PII protection in logging and analytics systems (aggregate only)
  - Implement rate limiting alerts and abuse detection monitoring
  - Ensure security enhancements work properly in browser with token expiry testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-35-completion.md with security testing procedures and RLS policy verification
  - _Requirements: 8.1, 14.1 (P0 - Enhanced security for pilot)_

- [ ] 36. Prepare comprehensive pilot test scenarios for manual testing
  - Review development-rules.md for compliance and approach
  - Prepare manual test procedures for concurrent session conflicts with chase cards
  - Create manual override persistence testing procedures for trade snapshots and receipts
  - Set up kiosk PII protection testing procedures with event scope validation
  - Prepare offline event testing procedures with stale price banners and receipt queuing
  - Create buylist vs market mode testing procedures for fairness and coverage differences
  - Prepare load testing scenarios for 50+ concurrent users in events
  - Ensure all pilot scenarios work properly in browser for comprehensive manual testing
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-36-completion.md with comprehensive pilot testing procedures and edge case validation
  - _Requirements: All pilot test scenarios_

- [ ] 37. Final P0 integration testing and pilot launch preparation
  - Review development-rules.md for compliance and approach
  - Conduct comprehensive end-to-end testing for MTG-only, USD-only, Market pricing scenarios
  - Perform security audit focusing on QR token security, rate limiting, and RLS policies
  - Execute performance testing with P95 targets: suggestions <3s, event matches <1s, receipts <2s
  - Validate all P0 business requirements, acceptance criteria, and pilot test scenarios
  - Create production deployment checklist with feature flags for kiosk, notifications, multi-TCG
  - Prepare pilot monitoring, incident response, and 7-day account deletion SLA procedures
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-37-completion.md with final validation checklist and launch readiness verification
  - _Requirements: All P0 requirements validation for LGS pilot readiness_

## Integration & Automation Testing (End of Development Cycle)

- [ ] 38. Build comprehensive integration test suite
  - Review development-rules.md for compliance and approach
  - Create automated end-to-end test scenarios covering complete trade workflows
  - Build API integration tests for all external services (Scryfall, TCGplayer, Stripe)
  - Implement database operation validation tests
  - Create performance benchmarking tests for matching algorithm and receipt generation
  - Build security validation tests for QR token management and rate limiting
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-38-completion.md with integration test execution procedures

- [ ] 39. Implement automation scripts and deployment pipeline
  - Review development-rules.md for compliance and approach
  - Create deployment automation scripts for production environment
  - Build database migration and rollback automation
  - Implement environment setup and configuration automation
  - Create monitoring and health check automation scripts
  - Build backup and disaster recovery automation
  - Review implementation against development-rules.md for compliance
  - Create completion-docs/task-39-completion.md with automation script documentation and execution procedures