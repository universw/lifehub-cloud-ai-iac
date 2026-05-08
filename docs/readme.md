# LifeHub AI Cloud

LifeHub AI Cloud is a secure personal productivity and document management web app built with **React**, **Firebase**, **Google Cloud**, and **Terraform**.

It helps users organize personal files, private notes, useful links, important items, profile settings, and safe activity history in one cloud-based workspace.

**Live app:** https://lifehub-ai-cloud.web.app

---

## Overview

LifeHub AI Cloud is designed as a portfolio-ready cloud application that demonstrates full-stack product thinking, Firebase development, serverless architecture, cloud security rules, infrastructure-as-code, and deployment workflow.

The app includes:

- Public landing page
- Authentication
- Dashboard
- File library
- Notes
- Saved links
- Important item tracking
- Activity log
- Profile settings
- Security center
- Firebase Cloud Functions backend
- Gemini AI summary prototype

AI note summary support is implemented through Firebase Cloud Functions and Gemini API integration, but Gemini API billing is currently disabled/skipped for cost control.

A strong README helps people understand why a project is useful, what they can do with it, and how to use it. GitHub also recommends creating a README for every repository.  
References: GitHub README docs, GitHub repository best practices.

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
- Strong password validation
- Confirm password validation
- Show/hide password controls
- Friendly authentication error messages
- Email verification support

Firebase Authentication supports email/password sign-in for web apps.

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
- Future encrypted Vault placeholder

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

Firebase Hosting provides fast and secure hosting for web apps and is optimized for static and single-page apps.

### Infrastructure / DevOps

- Terraform
- Google Cloud Provider
- Firebase CLI
- Google Cloud CLI
- Git / GitHub

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
            - AI note summary callable function
            - Gemini API integrations
## Author

**Henry Hoang Quan Nguyen — All rights reserved**

Cloud / DevOps / Full-stack portfolio project.