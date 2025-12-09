# TradeEqualizer Work Plan - Ben & Josh
**Target Launch Date:** January 15, 2025  
**Meeting Date:** December 9, 2024  
**Ben's Availability:** 6 hours/week

---

## Current Status

### ✅ Completed (Josh)
- **Task 1**: Next.js PWA project setup
- **Task 2**: Supabase authentication
- **Task 3**: Database schema and migrations
- **Task 4**: MTG card catalog with search (just completed!)

### 🔄 In Progress (Ben)
- **Task 6**: Want list CRUD - Need to review PR and confirm completion status

---

## Josh's Focus (Next 5 Weeks)

### Week 1-2 (Dec 9-22): Core Trading Engine
**Task 9: QR Code Trading Sessions** [Priority 1]
- Single-use QR tokens with 2-minute expiry
- Rate limiting (10/min/IP)
- Session creation and joining flow
- Real-time connection status
- **Deliverable**: Two users can connect via QR code

**Task 10: Trade Proposals** [Priority 2]
- Create/accept/reject trade proposals
- Real-time proposal updates
- Basic conflict detection
- **Deliverable**: Users can propose and accept trades

### Week 3-4 (Dec 23-Jan 5): Receipts & Matching
**Task 12: PDF Receipt Generation** [Priority 1]
- PDF generation with trade details
- Price versions and printing details
- Immutable trade snapshots
- **Deliverable**: Trades generate professional PDF receipts

**Task 8: Matching Algorithm** [Priority 2]
- Coverage-first matching logic
- Fairness validation (±5%)
- Make-it-even suggestions
- **Deliverable**: System suggests fair trades automatically

### Week 5 (Jan 6-12): Polish & Integration
**Task 37: Final Integration Testing**
- End-to-end testing of complete trade flow
- Performance validation
- Bug fixes and polish
- **Deliverable**: Production-ready core trading flow

---

## Ben's Assignments (6 hrs/week × 5 weeks = 30 hours)

### Week 1 (Dec 9-15): Complete Current Work [6 hours]
**Task 6: Want List Management** [FINISH]
- Review and complete current PR
- Ensure CRUD operations work
- Add priority field (Must/Want/Nice)
- Test with real card data
- **Deliverable**: Users can manage want lists with priorities

**Acceptance Criteria:**
- [ ] Can add cards to want list
- [ ] Can set priority (1=Must, 2=Want, 3=Nice)
- [ ] Can edit quantity and conditions
- [ ] Can delete wants
- [ ] Works with card search integration

---

### Week 2 (Dec 16-22): Inventory Management [6 hours]
**Task 5: Inventory Management System** [NEW]
- Build inventory CRUD operations
- Add condition tracking (NM/LP/MP/HP)
- Add finish variants (normal/foil/etched)
- Language support
- Tradable toggle
- **Deliverable**: Users can manage their card inventory

**Acceptance Criteria:**
- [ ] Can add cards to inventory
- [ ] Can set condition, finish, language
- [ ] Can mark cards as tradable/not tradable
- [ ] Can edit quantities
- [ ] Can delete inventory items
- [ ] Free tier limit: 100 items (show warning at 90)

**Files to Create:**
- `src/app/api/inventory/route.ts` - API endpoints
- `src/app/inventory/page.tsx` - Inventory management UI
- `src/components/InventoryForm.tsx` - Add/edit form
- `src/components/InventoryList.tsx` - Display component

---

### Week 3 (Dec 23-29): PWA & Offline [6 hours]
**Task 17: PWA Features** [NEW]
- Configure service worker
- Add PWA manifest
- Implement offline caching
- Add install prompts
- **Deliverable**: App works offline and can be installed

**Acceptance Criteria:**
- [ ] App installs on mobile (iOS/Android)
- [ ] Offline indicator shows when disconnected
- [ ] Basic pages work offline
- [ ] "Add to Home Screen" prompt works
- [ ] App icon and splash screen configured

**Files to Create/Modify:**
- `public/manifest.json` - PWA manifest
- `next.config.js` - PWA configuration
- `src/app/layout.tsx` - Add install prompt
- `public/sw.js` - Service worker (if needed)

---

### Week 4 (Dec 30-Jan 5): Security & Testing [6 hours]
**Task 18: Security Middleware** [NEW]
- Add security headers
- Input validation on API routes
- Rate limiting for sensitive endpoints
- PII protection in logs
- **Deliverable**: Basic security hardening complete

**Acceptance Criteria:**
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] API input validation with Zod schemas
- [ ] Rate limiting on auth endpoints
- [ ] No PII in console logs
- [ ] CORS configured for production

**Task 22: Testing Documentation** [NEW]
- Create manual testing scripts
- Document test scenarios
- Browser compatibility checklist
- **Deliverable**: Complete testing playbook

**Files to Create:**
- `src/middleware.ts` - Security middleware
- `src/lib/validation.ts` - Input validation schemas
- `src/lib/rateLimit.ts` - Rate limiting utilities
- `docs/testing/manual-test-plan.md` - Testing guide

---

### Week 5 (Jan 6-12): Polish & Launch Prep [6 hours]
**Task 24: Onboarding & Help** [NEW]
- First-run tutorial
- Contextual help tooltips
- Help documentation
- **Deliverable**: New users understand how to use the app

**Acceptance Criteria:**
- [ ] Welcome modal on first login
- [ ] Tooltips on key features
- [ ] Help icon with documentation links
- [ ] FAQ page created
- [ ] "Getting Started" guide

**Task 20: Legal Pages** [NEW]
- Terms of Service page
- Privacy Policy page
- Disclaimer footer
- **Deliverable**: Legal compliance basics

**Files to Create:**
- `src/app/terms/page.tsx` - Terms of Service
- `src/app/privacy/page.tsx` - Privacy Policy
- `src/components/OnboardingModal.tsx` - First-run tutorial
- `src/components/HelpTooltip.tsx` - Contextual help
- `docs/help/getting-started.md` - User guide

---

## Critical Dependencies

### Ben Needs from Josh:
1. **Week 1**: Card search API working (✅ DONE)
2. **Week 2**: Database schema for inventory (✅ DONE)
3. **Week 3**: Auth context and protected routes (✅ DONE)
4. **Week 4**: API structure and patterns to follow

### Josh Needs from Ben:
1. **Week 1**: Want list complete for matching algorithm
2. **Week 2**: Inventory complete for trade proposals
3. **Week 3**: PWA setup for mobile testing
4. **Week 4**: Security middleware for production readiness

---

## Success Metrics (Jan 15 Launch)

### Must Have (P0):
- ✅ Users can search for cards
- ✅ Users can sign up and log in
- 🎯 Users can add cards to inventory (Ben - Week 2)
- 🎯 Users can add cards to want list (Ben - Week 1)
- 🎯 Users can connect via QR code (Josh - Week 1)
- 🎯 Users can propose trades (Josh - Week 2)
- 🎯 Users can accept trades (Josh - Week 2)
- 🎯 Trades generate PDF receipts (Josh - Week 3)
- 🎯 App works on mobile (Ben - Week 3)

### Nice to Have (P1):
- 🔄 Matching algorithm suggests trades (Josh - Week 4)
- 🔄 Onboarding tutorial (Ben - Week 5)
- 🔄 Help documentation (Ben - Week 5)
- 🔄 Legal pages (Ben - Week 5)

---

## Weekly Check-ins

### Every Monday @ 9am:
1. Review last week's deliverables
2. Demo completed features
3. Identify blockers
4. Confirm this week's priorities
5. Update this document

### Communication:
- **Slack/Discord**: Daily updates, quick questions
- **GitHub**: All code reviews, PR discussions
- **This Doc**: Source of truth for priorities

---

## Ben's Task Checklist (30 hours total)

### Week 1 (6h): Want List ✅
- [ ] Review and merge current PR
- [ ] Fix any bugs from testing
- [ ] Add priority field UI
- [ ] Test with real cards
- [ ] Document API endpoints

### Week 2 (6h): Inventory 📦
- [ ] Create inventory API routes
- [ ] Build inventory management UI
- [ ] Add condition/finish/language fields
- [ ] Implement free tier limits
- [ ] Test CRUD operations

### Week 3 (6h): PWA 📱
- [ ] Configure PWA manifest
- [ ] Set up service worker
- [ ] Add offline caching
- [ ] Test mobile installation
- [ ] Add install prompts

### Week 4 (6h): Security 🔒
- [ ] Add security headers
- [ ] Implement input validation
- [ ] Set up rate limiting
- [ ] Create testing documentation
- [ ] Test security measures

### Week 5 (6h): Polish ✨
- [ ] Build onboarding flow
- [ ] Create help documentation
- [ ] Write legal pages
- [ ] Final testing pass
- [ ] Launch prep

---

## Questions for Tomorrow's Meeting

1. **Want List Status**: What's left to complete on Task 6?
2. **Blockers**: Any issues preventing progress?
3. **Availability**: Confirm 6 hours/week through Jan 15?
4. **Skills**: Comfortable with React, TypeScript, API routes?
5. **Priorities**: Any concerns about the task assignments?

---

## Notes

- **Focus on completion over perfection** - MVP quality is fine
- **Test in browser frequently** - No unit tests required per dev rules
- **Ask questions early** - Don't get stuck for hours
- **Document as you go** - Future you will thank you
- **Mobile-first** - Always test on phone screen sizes

---

**Last Updated:** December 8, 2024  
**Next Review:** December 9, 2024 (Meeting with Ben)