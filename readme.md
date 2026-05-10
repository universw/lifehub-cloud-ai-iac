# LifeHub AI Cloud

![Frontend CI](https://github.com/universw/lifehub-cloud-ai-iac/actions/workflows/frontend-ci.yml/badge.svg)
![Firebase Hosting](https://github.com/universw/lifehub-cloud-ai-iac/actions/workflows/firebase-hosting-merge.yml/badge.svg)

LifeHub AI Cloud is a secure personal productivity and document management web app built with **React**, **Firebase**, **Google Cloud**, and **Terraform**.

It helps users organize personal files, private notes, useful links, important items, profile settings, and safe activity history in one cloud-based workspace.

**Live App:** https://lifehub-ai-cloud.web.app  
**Main Portfolio:** https://portfo-38945.web.app/  
**Author:** Henry HoangQuan Nguyen  
**Location:** Ho Chi Minh City, Vietnam

---

## Project Purpose

LifeHub AI Cloud was built as a portfolio-ready cloud project to demonstrate practical skills in:

- Full-stack cloud application development
- Firebase and Google Cloud architecture
- Authentication and user-isolated data
- Cloud Firestore and Firebase Storage security rules
- Serverless backend development
- Infrastructure-as-Code with Terraform
- CI/CD with GitHub Actions
- Secure file and data management
- Cloud portfolio documentation
- Cost-aware cloud development

This project is designed to show how a modern personal cloud workspace can be built using managed cloud services, serverless backend logic, secure deployment practices, and infrastructure automation.

---

## Screenshots

Screenshots are stored using relative image paths so they render correctly inside GitHub.

### Landing Page

![LifeHub AI Cloud landing page](docs/images/landing-page.png)

### Dashboard

![LifeHub AI Cloud dashboard](docs/images/dashboard.png)

### File Library

![LifeHub AI Cloud file library](docs/images/files-page.png)

### Security Center

![LifeHub AI Cloud security center](docs/images/security-center.png)

---

## Overview

LifeHub AI Cloud provides a secure personal workspace where users can manage files, notes, links, profile settings, important items, and account activity.

The app includes:

- Public landing page
- Email/password authentication
- Password reset
- Email verification support
- Authenticated dashboard
- File library
- Notes module
- Saved links module
- Important item tracking
- Activity log
- User profile settings
- Security center
- Firebase Cloud Functions backend
- Gemini AI summary prototype
- Firebase Hosting deployment
- GitHub Actions CI/CD workflows
- Terraform infrastructure folder

AI note summary support is implemented as a Firebase Cloud Functions prototype using Gemini API integration. Gemini API calls may be disabled or skipped when billing/quota is not available.

---

## Key Features

### Public Landing Page

- SaaS-style public home page
- Product overview and feature explanation
- Sign in and create account entry points
- Cloud/security stack preview
- Portfolio-ready first impression

### Authentication

- Email/password registration
- Email/password login
- Password reset email flow
- Strong password validation
- Confirm password validation
- Show/hide password controls
- Friendly authentication error messages
- Email verification support
- Account deletion flow with typed confirmation

### Dashboard

- Workspace overview
- File, note, link, activity, important item, and storage stats
- Quick actions
- Recent files
- Recent notes
- Recent links
- Important items overview
- Recent safe activity feed

### File Library

- Upload personal files
- Store files in Firebase Storage
- Save file metadata in Cloud Firestore
- Search files by name
- Filter files by category
- Sort files by newest, oldest, name, or size
- Mark files as important
- Delete files safely
- Block risky file types such as `.env`, `.pem`, `.key`, `.json`, `.js`, and `.py`

### Notes

- Create private notes
- Edit notes
- Delete notes
- Search notes by title or content
- Sort notes
- Mark notes as important
- AI summary button connected to backend Cloud Function

### Links

- Save useful URLs
- Organize links by category
- Search links
- Sort links
- Mark links as important
- Edit saved links
- Delete saved links

### Activity Log

- Safe audit history
- Tracks generic user actions only
- Search activity
- Filter by activity type
- Portfolio-ready audit logging story

### Settings

- User profile settings
- Workspace name settings
- Usage overview
- Email verification status
- Security center
- Logout
- Account deletion
- Future encrypted Vault placeholder

### Security Center

- Email verification status
- App Check monitoring status
- Firestore security rules
- Storage security rules
- Risky file type blocking
- Safe activity logging
- Future MFA roadmap note

---

## Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Backend / Cloud

- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Hosting
- Firebase Cloud Functions
- Firebase App Check
- Google Cloud Platform
- Gemini API prototype

### Infrastructure / DevOps

- Terraform
- Google Cloud Provider
- Firebase CLI
- Google Cloud CLI
- Git
- GitHub
- GitHub Actions

---

## Architecture

```text
User Browser
    |
    v
React + Vite Frontend
    |
    v
Firebase Hosting
    |
    +--> Firebase Authentication
    |       - email/password login
    |       - password reset
    |       - email verification
    |
    +--> Cloud Firestore
    |       - user profile
    |       - file metadata
    |       - notes
    |       - links
    |       - activity logs
    |
    +--> Firebase Storage
    |       - uploaded user files
    |
    +--> Firebase Cloud Functions
    |       - callable backend functions
    |       - AI note summary prototype
    |       - Gemini API integration
    |       - Secret Manager integration
    |
    +--> Firebase App Check
            - backend abuse protection monitorings