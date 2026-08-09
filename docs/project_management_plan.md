# JoeKnock - Project Management Plan

## Purpose

This document defines the project management approach used to plan, organize, and track development of JoeKnock.

The goal is to maintain a professional software development workflow while allowing requirements to evolve as the product is refined.

JoeKnock will use GitHub Projects to manage development tasks, track progress, and maintain visibility into remaining work.

---

# Project Management System

JoeKnock will use:

- GitHub Repository
- GitHub Issues
- GitHub Projects Board
- GitHub Pull Requests

These tools provide a centralized location for:

- Planning features
- Tracking progress
- Documenting decisions
- Reviewing completed work

---

# Development Workflow

The development workflow will follow:

```text
Requirement
 ↓
User Story
 ↓
Epic
 ↓
GitHub Issue
 ↓
Implementation
 ↓
Review
 ↓
Completed Feature
```

Features will be broken into smaller issues rather than attempting to build large features all at once.

---

# GitHub Project Board

## Backlog

Future ideas and deferred functionality.

Examples:

- CRM integrations
- Heat maps
- Territory management
- Advanced analytics

---

## Ready

Approved MVP work ready to begin.

Requirements:

- Clear purpose
- Defined acceptance criteria
- Known dependencies

---

## In Progress

Currently active development.

Only actively worked-on tasks should be placed here.

---

## Review

Completed implementation awaiting:

- Testing
- Code review
- Documentation updates

---

## Done

Completed and verified work.

---

# Issue Organization

Issues will use labels to organize work.

## Feature

New functionality.

Example:

```
feature: interaction capture
```

---

## Frontend

React-related work.

Examples:

- Components
- Pages
- UI state
- Routing

---

## Backend

API and server-related work.

Examples:

- Express routes
- Authentication
- Business logic

---

## Database

Data modeling and persistence.

Examples:

- Tables
- Relationships
- Queries
- Migrations

---

## Documentation

Project documentation.

Examples:

- Architecture decisions
- README updates
- Technical documentation

---

## Bug

Unexpected behavior requiring correction.

---

## Security

Authentication and authorization tasks.

---

## Stretch

Future functionality outside MVP scope.

---

# Development Epics

## EPIC 1: Project Foundation

### Goal

Create the base structure required for development.

Tickets:

- Create GitHub repository structure
- Configure React frontend
- Configure Express backend
- Configure PostgreSQL connection
- Establish development environment
- Create documentation structure

---

# EPIC 2: Authentication and Authorization

### Goal

Allow secure user access.

Tickets:

- Design authentication flow
- Create user model
- Create login functionality
- Implement authentication middleware
- Protect frontend routes
- Implement role-based permissions

---

# EPIC 3: Organization Management

### Goal

Support organization-based SaaS structure.

Tickets:

- Create organization model
- Associate users with organizations
- Add organization settings
- Create user management interface
- Support administrator controls

---

# EPIC 4: Team Management

### Goal

Allow organizations to organize users.

Tickets:

- Create team model
- Create user/team relationships
- Support multiple teams per user
- Support multiple managers per team
- Implement visibility rules

---

# EPIC 5: Map Experience

### Goal

Create the primary field workflow.

Tickets:

- Integrate mapping library
- Display user location
- Center map on user
- Display property markers
- Select properties
- Retrieve address information

---

# EPIC 6: Interaction Capture

### Goal

Allow users to quickly record field activity.

Tickets:

- Design interaction data model
- Create interaction endpoints
- Create interaction entry overlay
- Add status selection
- Add notes
- Save interactions
- Implement interaction history tracking

---

# EPIC 7: Reporting

### Goal

Provide basic operational visibility.

Tickets:

- Create reporting endpoints
- Display interaction counts
- Display status counts
- Add date filtering
- Build reporting interface

---

# EPIC 8: Data Export

### Goal

Allow organizations to use JoeKnock data externally.

Tickets:

- Define export format
- Create export endpoint
- Generate downloadable file
- Validate exported data

---

# EPIC 9: Deployment and Final Polish

### Goal

Prepare JoeKnock for demonstration.

Tickets:

- Configure production environment
- Deploy frontend
- Deploy backend
- Configure environment variables
- Verify production workflow

---

# Ticket Assignment

JoeKnock is currently developed by one person.

Assignments represent ownership and responsibility.

## Project Owner / Developer

Responsible for:

- Requirements
- Architecture decisions
- Frontend development
- Backend development
- Database design
- Testing
- Documentation
- Prioritization

---

Future team development could divide responsibilities:

## Frontend Developer

Responsible for:

- React components
- UI implementation
- State management

---

## Backend Developer

Responsible for:

- APIs
- Authentication
- Server logic

---

## Database Developer

Responsible for:

- Schema design
- Queries
- Data integrity

---

# Definition of Done

A feature is complete when:

- Acceptance criteria are met.
- Code follows project standards.
- Tests have been completed where appropriate.
- Documentation is updated.
- Feature works in development environment.
- Changes are committed to GitHub.

---

# Development Philosophy

JoeKnock development prioritizes:

1. Understanding the problem before writing code.
2. Building the smallest useful version.
3. Documenting important decisions.
4. Reviewing tradeoffs before adding complexity.
5. Maintaining a professional codebase.

The goal is not only to complete a working application, but to demonstrate professional software engineering practices.
