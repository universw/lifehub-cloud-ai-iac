# LifeHub AI Cloud Roadmap

LifeHub AI Cloud is a secure personal productivity and document management app built with React, Firebase, Google Cloud, and Terraform.

This roadmap explains completed work, current limitations, and planned improvements across product, security, cloud architecture, DevOps, and AI.

---

## 1. Product Vision

LifeHub AI Cloud aims to become a personal cloud workspace where users can securely organize:

- Personal files
- Private notes
- Useful links
- Important records
- Activity history
- Future encrypted vault data
- Future AI-assisted summaries and reminders

The long-term goal is to build a secure, practical, and portfolio-ready cloud application that demonstrates real Cloud/DevOps and full-stack engineering skills.

---

## 2. Completed Milestones

### Foundation

- React + Vite frontend created
- Firebase project configured
- Firebase CLI configured
- Google Cloud CLI configured
- Terraform project structure created
- Firebase Hosting deployed
- Git repository initialized

### Authentication

- Email/password registration
- Email/password login
- Strong password validation
- Confirm password validation
- Friendly authentication error messages
- Auth state handling
- User profile document creation

### Frontend Product

- Public landing page
- Auth page
- Dashboard
- Sidebar navigation
- Responsive layout
- Workspace overview
- Quick actions
- Profile/settings page
- Security center page

### Files

- File upload
- Firebase Storage integration
- Firestore metadata storage
- File search
- File category filtering
- File sorting
- Important file toggle
- File deletion
- Safer upload blocking for risky extensions

### Notes

- Create notes
- Edit notes
- Delete notes
- Search notes
- Sort notes
- Important note toggle
- AI summary button connected to backend function

### Links

- Create saved links
- Edit links
- Delete links
- Search links
- Sort links
- Category support
- Important link toggle

### Activity

- Safe activity logging
- Recent activity dashboard card
- Full activity log page
- Activity search
- Activity type filter

### Security

- Firestore Security Rules
- Storage Security Rules
- User-scoped Firestore paths
- User-scoped Storage paths
- Firebase App Check setup
- App Check monitoring
- Gemini API key stored as backend secret

### Backend / AI

- Firebase Functions setup
- Callable `summarizeNote` function
- Auth-protected backend function
- Gemini SDK installed
- Secret Manager integration
- Frontend AI summary call
- AI billing paused for cost control

### Documentation

- README
- Architecture documentation
- Security documentation
- Roadmap documentation

---

## 3. Current Limitations

- Gemini billing is paused
- Password reset is not implemented yet
- Account deletion is not implemented yet
- No GitHub Actions CI/CD pipeline yet
- No automated tests yet
- No Firestore Rules test suite yet
- App Check is in monitoring mode, not enforced
- File upload validation is mostly frontend-based
- No file preview page yet
- No tagging system yet
- No encrypted Vault yet
- Dashboard code should eventually be split into smaller React components

---

## 4. Short-Term Roadmap

### Authentication Improvements

- Add password reset flow
- Add better email verification reminders
- Add re-send verification from settings
- Add account deletion request flow
- Add re-authentication before sensitive account actions

### UI/UX Improvements

- Improve mobile layout
- Add loading skeletons
- Add toast notifications
- Add better empty states
- Add dashboard welcome checklist
- Add landing page screenshots
- Add app screenshots to README

### File Library Improvements

- Add file preview page
- Add file download button
- Add tags
- Add favorite/important filters
- Add better file type icons
- Add upload progress bar
- Add file size limits

### Notes Improvements

- Add note tags
- Add pinned notes
- Add note folders
- Add markdown preview
- Add note templates
- Add reminder date field

### Links Improvements

- Add link favicon preview
- Add link health check
- Add link tags
- Add link notes/description
- Add copy link button

---

## 5. Security Roadmap

### Firestore Rules

- Add stricter schema validation
- Split broad read/write rules into create, read, update, delete rules
- Restrict activity log fields
- Prevent users from changing protected fields
- Add Firebase Rules unit tests

### Storage Rules

- Add upload size validation
- Add MIME type restrictions where practical
- Split read/write/delete permissions
- Add safer delete behavior

### App Check

- Continue monitoring verified request percentages
- Enable Firestore enforcement
- Enable Storage enforcement
- Enable callable Functions enforcement after testing
- Add debug provider process for local development

### Account Security

- Password reset
- Account deletion
- Re-authentication before sensitive actions
- Data export
- Data deletion confirmation
- Clear privacy notice

### Secret Security

- Keep API keys out of frontend code
- Rotate Gemini API key when needed
- Keep `.env` files ignored by Git
- Add GitHub secret scanning awareness

---

## 6. DevOps Roadmap

### CI/CD

- Add GitHub Actions workflow
- Run frontend build on pull requests
- Run lint checks
- Deploy Hosting from main branch
- Add manual approval for production deploys
- Add separate preview channel deployment

Firebase CLI supports deploying Firebase resources such as Hosting and Functions from a local project. Firebase Hosting is designed for fast, secure hosting of static and single-page web apps. 

### Infrastructure

- Expand Terraform coverage
- Manage more Google Cloud resources with Terraform
- Add budget alerts
- Add monitoring dashboards
- Add logging documentation
- Add environment separation later

### Quality

- Add ESLint
- Add Prettier
- Add component refactor
- Add reusable hooks
- Add automated tests
- Add Firebase emulator testing

---

## 7. AI Roadmap

### Current AI Status

Implemented:

- Firebase callable function
- Auth check
- Gemini API secret
- Gemini SDK integration
- Frontend AI summary button
- AI summary UI
- AI activity logging

Paused:

- Gemini billing / prepaid credits

### Future AI Features

- Re-enable Gemini billing when ready
- Add monthly AI usage limits
- Add usage tracking per user
- Add AI summary caching
- Add AI reminder extraction
- Add AI document classification
- Add AI note cleanup
- Add AI search assistant
- Add cost monitoring

---

## 8. Encrypted Vault Roadmap

Future encrypted Vault feature:

- Dedicated vault section
- Client-side encryption
- User-controlled encryption key
- Encrypted metadata option
- Recovery key warning
- Secure document categories
- Sensitive file mode
- Stronger access confirmation

Potential vault use cases:

- Passport scans
- Visa documents
- Certificates
- Insurance files
- Personal finance records
- Emergency records

---

## 9. Portfolio Roadmap

To make this project stronger for internship and Cloud/DevOps applications:

- Add screenshots to README
- Add architecture diagram image
- Add live demo section
- Add security design section
- Add CI/CD badge
- Add Terraform explanation
- Add cost estimate
- Add monitoring screenshots
- Add short demo video
- Add Japanese README summary
- Add English/Japanese portfolio write-up

---

## 10. Priority Order

Recommended next development order:

1. Password reset
2. Screenshot section in README
3. File preview/download improvements
4. GitHub Actions build workflow
5. Firestore/Storage rule hardening
6. App Check enforcement
7. Account deletion
8. Tags system
9. File preview page
10. Encrypted Vault
11. AI billing and usage limits
12. Monitoring and cost dashboard

---

## 11. Success Criteria

LifeHub AI Cloud is considered portfolio-ready when it has:

- Deployed public URL
- Clear README
- Architecture documentation
- Security documentation
- Roadmap documentation
- Authentication
- Firestore and Storage rules
- File upload
- Notes
- Links
- Activity log
- Settings
- Firebase Hosting deployment
- Firebase Functions backend
- Terraform infrastructure folder
- Screenshots
- GitHub commit history

---

## 12. Summary

LifeHub AI Cloud is already a strong portfolio project because it demonstrates:

- Real product design
- React frontend development
- Firebase Authentication
- Firestore database design
- Firebase Storage upload flow
- Firebase Security Rules
- Firebase Hosting deployment
- Firebase Cloud Functions
- Secret Manager usage
- App Check setup
- Terraform infrastructure planning
- Security documentation
- Product roadmap planning

The next priority is to improve account features, deployment automation, and security hardening.