# CareFlow HMS - Hospital Management System

CareFlow HMS is an improved hospital management dashboard inspired by the public `Rajan-Barnwal/hospital` project, rebuilt as a cleaner and more presentation-ready system for `dhuor2001-debug/Hospital_Management`.

## What the reference project has done

The reference project is a React hospital dashboard with separate areas for:

- Admin: add doctors, nurses, ambulances, beds, admins, rooms, and payment checks.
- Doctor: view appointments, patient details, reports, profile, and discharge slip pages.
- Nurse: add patients, book appointments, and view nurse profile.
- Redux state files for authentication and data.
- Basic dashboard navigation and static assets.

## What it should have done better

- Add a backend or clear local data layer instead of leaving many screens as static/mock pages.
- Fix invalid JSX route comments that can break compilation.
- Complete reducer logic, especially discharge handling.
- Add cleaner UX for real hospital workflows: triage, bed pressure, ambulance status, and fast intake.
- Add stronger project documentation and setup instructions.
- Make the first screen immediately useful as an operations dashboard.
- Avoid deeply nested folders and inconsistent naming.

## What is new in this version

- Live hospital command dashboard.
- Role switcher for Admin, Doctor, Nurse, and Emergency views.
- Smart triage queue that highlights the highest-risk patient.
- Bed occupancy pressure by ward.
- Ambulance availability and ETA tracking.
- Appointment overview.
- Nurse intake form for adding new patients.
- Local-first persistence using `localStorage`, so demo data survives page refresh.
- Clean responsive UI for laptop and mobile screens.

## Tech stack

- React
- Vite
- CSS
- Browser local storage

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Future backend upgrades

This frontend is ready to connect to a backend later. Good next steps:

- Node/Express or Django REST API.
- MongoDB/PostgreSQL patient records.
- Authentication with role-based access.
- PDF discharge summaries and invoices.
- SMS/email reminders for appointments.
- Audit logs for sensitive medical operations.
