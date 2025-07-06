# Chatboc Feature Summary

This document outlines the main features currently available in the Chatboc platform. It is intended as a quick reference to design infographics or marketing material.

## 24/7 AI Agent

- Continuous assistance for users through an AI-powered chatbot that can handle queries at any time of day.

## Widget Integration

- Embeddable chat widget that preserves the look and feel of the main site.
- Works via a simple `<script>` or `<iframe>` snippet, with options to customize theme, size, positioning and a one-time call-to-action bubble.
- Supports GPS permissions and clipboard access for a better user experience.

## Municipal Features

- Statistics dashboards with filters to visualize tickets and response times.
- Automatic email or SMS notifications when a ticket is updated.
- Downloadable catalog of municipal procedures.
- Internal user management with roles for employees and administrators.
- WhatsApp integration for citizen service.
- Incident map displaying tickets with location data.
- Integrations with systems such as SIGEM or GDE.
- Satisfaction surveys once a ticket is resolved.

## Pyme Features

- Product catalog uploads in PDF or Excel formats and direct downloads from the chat.
- Automatic quotation generation in PDF.
- Customer interaction history including past questions and uploaded files.
- Reminders for invoice or order due dates.
- CRM integrations (e.g. Tango, Colppy) with real-time ticket updates and business metrics.

## Ticket and Profile Maps

- Tickets display a location map when the backend provides coordinates or an address.
- The administrator profile page includes a map to adjust the business or municipality location using Google Places.

## Roles and Accounts

- Distinct profiles for administrators, employees and end users, each with access levels enforced by the backend.
- CRM endpoints to list customers and filter by name or marketing preferences.

## Catalog File Mapping

- Configurable column mapping for catalog files so businesses can import product lists from CSV or Excel.
- Automatic suggestions for column mappings with a similarity threshold.

## Error Handling and Permissions

- Clear messages when a user lacks the required role to access a resource (HTTP 403), referencing backend logs.

---

This summary is based on the documentation in the repository and reflects the frontend capabilities that rely on data from the backend. All texts, actions and suggestions in the UI must come from the backend as stated in `AGENTS.md`.
