

# PRD: Sales Quotation Memory System (Gmail-Aware)

## 1. Problem Statement

The business sends/receives many quotation emails. Prices vary by **material** and **client**, but today the historical knowledge lives in:

* Gmail threads,
* ad-hoc spreadsheets,
* people’s memory.

We want a web app (built in Cursor) that becomes a **pricing memory layer**:

1. It can **start from a complete master list** of products and clients that the user already has.
2. It can **continuously ingest** quotation-like emails from Gmail to discover new materials/clients/prices.
3. It can **suggest** the right price when preparing a new quote.
4. It can **output** a Gmail-pasteable quotation table in the exact format the business uses.

This removes manual hunting through email and keeps pricing consistent.

---

## 2. Important Input from Business (must be supported)

**The user can provide a complete list of:**

1. **All products/materials** they quote (name, description, optional HSN).
2. **All clients** they sell to (name, email/contact).

The system must be able to **ingest these master lists up front** (via CSV/JSON/manual admin page) and treat them as authoritative. After that, the Gmail ingestion can **add to** or **enrich** these lists (e.g. new client appears in email), but it should not fight the master list.

This is important because it means Gmail is **not** the only source — it’s a supplemental source.

---

## 3. Goals & Non-Goals

### 3.1 Goals

* Maintain a **canonical materials master** that can be initially seeded from the user’s full list.
* Maintain a **canonical clients master** that can be initially seeded from the user’s full list.
* Maintain **price history** at (material × client) level.
* Provide a **quote builder UI** with dropdowns sourced from the canonical lists.
* Suggest prices using the rule:

  1. last quote for this client + this material
  2. else last quote for this material (any client)
  3. else N/A
* Generate Gmail-ready Markdown with exact columns:

  * `No | Materials | QTY | Unit | Rate/Unit | Ex Works | Delivery`
* Run a **daily Gmail ingestion** to discover new items / prices.
* Keep it **customisable** (extra columns like HSN can be added later).

### 3.2 Non-Goals

* No complex discounting logic.
* No multi-tenant permissions yet.
* No automatic Gmail send in v1.

---

## 4. Sources of Truth

1. **Primary source (manual/master):**

   * User-supplied full list of products/materials.
   * User-supplied full list of clients.
   * These should populate the DB directly and appear in dropdowns immediately.

2. **Secondary source (Gmail):**

   * Used to **discover** new materials/clients if they weren’t in the master.
   * Used to **append** price history.
   * Should try to match to existing items using normalisation (e.g. “Shubh Ceramics (India) Pvt. Ltd.” ↔ “SHUBH CERAMICS”).

This order must be stated clearly so Cursor doesn’t assume Gmail is the only source.

---

## 5. High-Level Flow

1. **Admin seeds data**

   * Upload/import master materials list
   * Upload/import master clients list
     → DB now has all products and clients.

2. **Ingestion job runs**

   * Pulls Gmail
   * For each quotation email, tries to match to existing clients/materials
   * If matches → append price_history
   * If no match → create new client/material but mark as “discovered_from_email”

3. **Sales user builds quote**

   * Picks client from full list (seeded + discovered)
   * Adds line items from material list (seeded + discovered)
   * System suggests price
   * User edits
   * System generates Gmail Markdown

---

## 6. Functional Requirements

### 6.1 Master Data Ingestion (Manual)

* System must expose a way (API or admin page) to **import**:

  * materials: `name`, `description?`, `hsnCode?`
  * clients: `name`, `email?`
* Imported entries must be immediately available in the quote builder.
* Imported entries should be marked as `source = "manual"` or `source = "master"`.

### 6.2 Gmail Ingestion (Automatic, Daily)

* System must also ingest from Gmail.
* When Gmail finds a material/client that is **not** in master:

  * create it with `source = "gmail"`
  * but do **not** overwrite master versions
* If Gmail finds the same name as master (after normalisation), update only price history.

### 6.3 Quote Builder

(Same as before — now explicitly says dropdowns are filled from master + discovered.)

---

## 7. Architecture (updated to reflect master lists)

* **DB layer** must support a `source` column on materials and clients: `"master" | "gmail" | "manual_ui"`.
* **Ingestion service** must first try to match Gmail-found entities to `source="master"` records.
* **UI** must display both master and discovered items in dropdowns, but optionally mark discovered ones (e.g. “(auto)”).

---

## 8. Acceptance Criteria (updated)

* When I provide a full list of products, they appear in the materials dropdown **even if Gmail ingestion has not run yet**.

* When I provide a full list of clients, they appear in the clients dropdown **even if Gmail ingestion has not run yet**.

* When Gmail finds a quote for “Shreeji Enterprise” that is not in master, it is added and appears in the client dropdown.

* When I generate a quote, the output table is:

  ```text
  | No | Materials | QTY | Unit | Rate/Unit | Ex Works | Delivery |
  |----|-----------|-----|------|-----------|----------|----------|
  ...
  ```

* When there is no prior price, the system shows N/A and does not crash.

* Price suggestions always prefer the master-list match over a newly discovered name that looks similar.

---

