# LifeHub AI Cloud Architecture

LifeHub AI Cloud is a secure personal productivity and document management web application built with React, Firebase, Google Cloud, and Terraform.

This document explains the system architecture, major components, data flow, security boundaries, and future architecture improvements.

---

## 1. Architecture Goals

LifeHub AI Cloud is designed around these goals:

- Secure user-isolated personal data
- Simple and scalable serverless architecture
- Low-cost cloud operation for portfolio/demo usage
- Clean product experience for files, notes, links, activity, and settings
- Future-ready architecture for AI and encrypted vault features
- Infrastructure-as-code support through Terraform

---

## 2. High-Level Architecture

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
            - Gemini API integration
            - Secret Manager integration