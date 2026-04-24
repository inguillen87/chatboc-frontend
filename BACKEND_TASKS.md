# Backend Tasks for Advanced Analytics & AI Consultancy Module

To fully realize the "Consultancy-grade" Analytics SaaS vision, the following backend enhancements are required. These tasks should be prioritized to support the high-end frontend UI.

## 1. AI Consultant Endpoints (OpenAI Integration)
*   **Endpoint:** `POST /api/analytics/generate-report`
*   **Description:** Accepts a date range and segment (municipio/pyme). Aggregates current stats and sends them to OpenAI GPT-4 with a system prompt acting as a "Senior Business Analyst".
*   **Response:** Returns a structured JSON with:
    *   `summary`: Executive summary text.
    *   `opportunities`: List of specific growth opportunities (e.g., "Increase stock of X", "Patrol zone Y on weekends").
    *   `threats`: Potential issues (e.g., "Rising complaints in Zone Z").
    *   `tone`: Professional/Consultative.

## 2. Dedicated Commerce Analytics (PyMEs)
*   **Endpoint:** `GET /api/analytics/sales`
*   **Description:** Currently, the frontend reuses `/api/estadisticas/tickets` for everything. We need a dedicated sales endpoint.
*   **Metrics Required:**
    *   `revenue`: Total revenue in currency.
    *   `average_ticket`: Average order value (AOV).
    *   `conversion_rate`: Visitors vs. Orders (if tracking visitors).
    *   `sales_by_product`: Top selling items.
    *   `sales_by_hour`: Peak ordering times (Heatmap of time).
*   **Leads:**
    *   `lead_source`: Where did the chat start? (QR, Web, WhatsApp, Instagram).
    *   `chat_conversion`: % of chats that result in a sale/ticket.

## 3. Geospatial Intelligence (GIS)
*   **Endpoint:** `GET /api/geo/polygons?city_id=X`
*   **Description:** Return GeoJSON `Polygon` or `MultiPolygon` features for neighborhoods/barrios.
*   **Purpose:** Allows the frontend to render **Chloropleth Maps** (coloring entire districts based on density) rather than just point-based heatmaps. This is standard in high-end government dashboards (Waze/GovTech style).

## 4. Historical Benchmarking
*   **Endpoint:** `GET /api/analytics/benchmarks`
*   **Description:** Compare current period vs previous period (MoM, YoY) pre-calculated on the backend for speed.
*   **Metrics:**
    *   `growth_percentage`: e.g., "+15% vs last month".
    *   `industry_average`: (Optional) Compare against anonymous aggregate data of other tenants in the same sector.

## 5. User Behavior / Funnel
*   **Endpoint:** `GET /api/analytics/funnel`
*   **Description:** Return step-by-step counts for the sales/claim funnel.
    *   Step 1: Opened Chat
    *   Step 2: Selected Option
    *   Step 3: Started Form/Order
    *   Step 4: Completed
*   **Purpose:** To populate the "Funnel" visualization tab in the dashboard.

## 6. Citizen Participation & Survey Analytics (New)
*   **Endpoint:** `GET /api/analytics/surveys/summary`
*   **Description:** Aggregate results for active surveys.
*   **Metrics:**
    *   `total_votes`: Total participation count.
    *   `participation_rate`: Votes / Estimated Population (or Active Users).
    *   `results_by_option`: Histogram data for poll options.
*   **Endpoint:** `GET /api/analytics/surveys/sentiment`
*   **Description:** AI-processed sentiment analysis of open-ended answers.
    *   `sentiment_score`: -1.0 (Negative) to 1.0 (Positive).
    *   `keywords`: Top recurring terms in open answers (Word Cloud data).
*   **Endpoint:** `GET /api/analytics/surveys/geo`
*   **Description:** Geo-tagged voting data. Similar to the ticket heatmap but for votes.
    *   Allows generating "Opinion Maps" (e.g., "Which zones voted 'Yes' vs 'No'").

## 7. Cost Optimization & Caching Strategy (Critical)
*   **Objective:** Minimize calls to the expensive OpenAI API.
*   **Endpoint:** `GET /api/analytics/report/latest`
    *   **Description:** Fetches the *last generated report* from the database.
    *   **Response:** JSON of the report content + `generated_at` timestamp.
    *   **Logic:** Frontend should call this *first*. Only if it returns 404 or `generated_at` is too old (e.g., > 1 week) should the user be prompted to generate a new one.
*   **Endpoint:** `POST /api/analytics/report/generate`
    *   **Description:** Triggers a *fresh* analysis.
    *   **Constraints:** Implement rate limiting (e.g., max 1 request per hour per admin).
*   **Background Job:** Configure a weekly cron job on the backend to automatically generate and store the report during low-traffic hours (e.g., Sunday night), ensuring freshness without user latency.
