# BRISK Backend (Monolith API)

Welcome to **BRISK Monolith Backend** — the core API engine powering the BRISK platform across Ireland for on-demand trade services, property & utility management, and marketplace transactions.

---

## 📚 Complete Developer Onboarding Guide

If you are a new developer or joining the team today, please review our comprehensive guide:

👉 **[Complete Project Overview & Developer Onboarding Guide](./PROJECT_OVERVIEW.md)**

It covers:
- **Product Overview & Architecture** (Modular Monolith, Tech Stack, Client Apps)
- **Core Domain & Personas** (Customers, Traders - Solo vs Company, Admins)
- **End-to-End Business Workflows** (Onboarding, Job Posting, Quotes, Site Visits, Stripe Payments, Loyalty BRP, Property/Meters)
- **Folder Structure & Tour of all 24 Modules**
- **Database Schema & Prisma Models**
- **Day-1 Local Setup & Docker Instructions**
- **Coding Standards, Conventions & Seed Accounts**

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start local PostgreSQL
docker-compose up -d

# 4. Migrate & Seed Database
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start dev server
npm run dev
```

- **Health Check:** `http://localhost:3000/health`
- **Swagger API Docs:** `http://localhost:3000/api-docs`
