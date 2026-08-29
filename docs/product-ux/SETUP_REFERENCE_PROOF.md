# Balcona Setup — Prototype Brief

Status: LOCKED FOR PROTOTYPE
Date: 2026-08-29
Surface: Balcona Setup
Base: ux/product-ia-overhaul

## Product job

Balcona Setup is the temporary implementation/readiness layer used to get one cafe location live.

It is not:
- a permanent peer of daily Service/Kitchen navigation;
- another Office dashboard;
- a generic SaaS onboarding wizard;
- a place to invent setup capability that the backend does not have.

Primary mental model:

**Get this location live**

## Reference stack

### Toast onboarding / launch
Take:
- explicit journey from configuration through go-live;
- readiness and implementation thinking;
- configuration/training/installation/go-live sequencing.

### Square restaurant setup
Take:
- clear service/device configuration steps;
- menu/device/location dependencies;
- practical setup defaults and explicit completion steps.

### Balcona
Use:
- computed company/branch onboarding readiness;
- launch summary and blockers;
- company/branch profile;
- floors;
- bulk tables + QR readiness;
- staff role coverage and invites;
- menu readiness;
- printer/station readiness signals;
- operating/service mode;
- Smart Cashier/settings signals;
- SaaS entitlements/blockers;
- payment readiness state without exposing secrets.

Formula:

**Toast orchestration + Square configuration clarity + Balcona readiness truth**

## Setup phases

1. Business
2. Locations
3. Menu
4. Tables & QR
5. Team
6. Kitchen / Devices
7. Payments
8. Experience
9. Operations / Automation
10. Final readiness

## Layout grammar

Desktop:
- compact Setup identity/header;
- left phase rail with progress/state;
- main current-step workspace;
- right readiness/blocker rail when useful.

Handheld:
- progress summary first;
- horizontally scrollable phase rail;
- current-step content;
- blockers / next action;
- no desktop sidebar dump before content.

## Required behavior

- switch phases;
- show complete / needs-attention / blocked states;
- show progress derived from representative readiness truth;
- current step explains why it matters;
- explicit primary next action;
- deep-link concept to the owning Office domain;
- branch context always visible;
- payment provider state remains non-secret and fail-closed;
- Arabic / RTL;
- final readiness screen shows blockers before any go-live action.

## Prototype data boundary

Representative static data may model responses already supported by Balcona's onboarding/readiness APIs.

Do not invent:
- merchant credentials;
- successful live provider certification;
- physical device discovery that does not exist;
- menu import/copy behavior if backend support is absent;
- public self-signup;
- a production go-live mutation not represented by backend semantics.

## Visual personality

Setup should feel:
- guided;
- reassuring without being playful;
- implementation-oriented;
- visibly finite;
- clear about blockers;
- warmer than Office, calmer than Guest.

Use Balcona bronze as progress/next-step emphasis.
Use semantic state colors only for readiness.
Do not use giant marketing cards or celebratory confetti.

## Closure gate

Pass only after:
- reference proof is visible in structure;
- every phase maps to real Balcona jobs/capability;
- desktop and handheld reviewed;
- Arabic RTL reviewed;
- blockers and external gates remain explicit;
- final readiness cannot visually imply live readiness when blockers remain;
- automated interaction/overflow QA passes;
- screenshots manually reviewed.
