# JoeKnock - Frontend Wireframes

## Purpose

This document defines the frontend structure and user experience for JoeKnock.

The primary goal of the application is to provide a fast, map-first workflow for field interactions while providing visibility tools for managers and administrators.

The frontend is designed around three principles:

1. The map is the primary workspace.
2. Data entry should require minimal interruption.
3. Each user should see information appropriate to their permissions.

---

# Application Structure

## Primary Routes

```text
/login
```

Authentication page.

---

```text
/map
```

Primary field interaction workspace.

---

```text
/reports
```

Activity and reporting dashboard.

---

```text
/settings
```

Organization configuration.

---

```text
/settings/users
```

User management.

---

```text
/profile
```

Individual user settings.

---

# Global Layout

JoeKnock uses a minimal navigation design.

The goal is to avoid distracting users during field work.

---

# Top Navigation

## Left Side

Hamburger Menu

Contains:

- Map
- Reports

---

## Center

JoeKnock Logo

---

## Right Side

User Profile Menu

Contains:

- Profile
- Organization Settings
- Users (Admin only)
- Logout

---

# Page: Login

Route:

```text
/login
```

## Purpose

Allow users to securely access JoeKnock.

---

## Components

Fields:

- Email
- Password

Action:

- Login

---

# Page: Map Workspace

Route:

```text
/map
```

## Purpose

The map is the core feature of JoeKnock.

All users have access to field interaction functionality.

---

# Layout

```text
------------------------------------------------

 Hamburger       JoeKnock        User Profile


------------------------------------------------

                  MAP

              User Location
                   ●

          Property Markers


------------------------------------------------
```

---

# Map Components

## User Location Marker

Displays:

- Current user location

Behavior:

- Centers map on user by default
- Updates location while moving

---

## Property Marker

Displays:

- Locations with recorded interactions

Behavior:

- Visibility depends on user permissions
- Can be selected to view current interaction information

MVP:

- Simple marker only
- No colors
- No status-based indicators

---

# Property Selection Flow

## Step 1

User selects a property on the map.

---

## Step 2

JoeKnock identifies the location.

Information retrieved:

- Latitude
- Longitude
- Address

---

## Step 3

Interaction entry panel appears without leaving the map.

---

# Interaction Entry Overlay

## Design Goal

The user should not leave the map to record an interaction.

The selected property remains visible.

---

## Required Information

MVP:

- Property/location
- Status

---

## Optional Information

- Notes

---

## User Protection Features

The system should:

- Lock map interaction while entering data
- Preserve selected property visibility
- Save unfinished drafts locally

Purpose:

Prevent accidental data loss.

---

# Page: Reports

Route:

```text
/reports
```

## Purpose

Provide simple visibility into field activity.

---

## MVP Components

### Status Summary

Example:

```text
No Answer        42

Interested       15

Appointment       8
```

---

### Interaction Count

Displays:

- Total interactions
- Selected date range

Reports are based on interaction activity dates and status changes, not simple record edits.

---

### Date Filter

Allows users to select:

- Start date
- End date

---

# Page: Settings

Route:

```text
/settings
```

## Purpose

Allow administrators to configure organization behavior.

---

# Organization Settings

Fields:

- Organization name
- Business address
- Billing address
- Phone number

---

# Status Management

Administrators can:

- Create statuses
- Edit statuses
- Disable statuses

---

# Visibility Settings

Administrators define representative visibility.

Options:

## Self

Users see only their own interactions.

---

## Team

Users see interactions from assigned teams.

---

## Organization

Users see organization-wide interactions.

---

# Page: User Management

Route:

```text
/settings/users
```

## Purpose

Allow administrators to manage organization users.

---

## Components

User List:

Displays:

- Name
- Email
- Role
- Teams

Actions:

- Create user
- Edit user
- Disable user

---

# Page: Profile

Route:

```text
/profile
```

## Purpose

Allow users to manage personal information.

---

Fields:

- Name
- Email
- Password

---

# Component Structure

Suggested React organization:

```text
src/

├── components/
│
│   ├── Navigation/
│   ├── Map/
│   ├── PropertyMarker/
│   ├── InteractionForm/
│   ├── Reports/
│   └── Settings/

├── pages/
│
│   ├── Login.jsx
│   ├── Map.jsx
│   ├── Reports.jsx
│   ├── Settings.jsx
│   └── Profile.jsx

├── context/
│
│   └── AuthContext.jsx

└── services/
    |
    └── api.js
```

---

# Core User Journey

## Field User

1. Logs in.
2. Opens map.
3. Views current location.
4. Selects property.
5. Records interaction.
6. Continues working.

---

## Manager

1. Logs in.
2. Uses map and reports.
3. Reviews assigned team activity.
4. Performs field interactions when needed.

---

## Administrator

1. Logs in.
2. Manages organization settings.
3. Creates users.
4. Configures statuses.
5. Reviews organization activity.
6. Performs field interactions when needed.

---

# Frontend Design Principle

JoeKnock should feel like a field tool, not an office application.

Every screen should answer:

> "Does this help the user complete their next interaction faster?"
