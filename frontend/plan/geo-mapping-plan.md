# Supplier Geo Mapping Heatmap Plan

## Summary

Rewrite the supplier-side geo mapping as a regional heat-tile visualization that correctly reflects the 3-tier supply chain data flow: `supplier <- distributor`. The supplier sees demand from their distributor partners by region — not retailer data, not "downstream" demand. Data source is exclusively `GET /analytics/supplier/regional` with the contract-shape fields (`demand_score`, `growth_pct`). No retailer hooks, no retailer page state, no retailer semantics.

## Key Changes

### 1. Lock data source semantics in frontend contract

- Treat `GET /analytics/supplier/regional` as the single source of truth for supplier geo mapping.
- Do NOT read from `useRetailers`, retailer detail, retailer demand intel, or any retailer-side page state.
- The data represents **distributor order demand per region** — i.e.: how much the supplier's distributor partners are ordering from each region. Not retailer/consumer demand.
- Update `useGeoDemand` so its types and mock data reflect the actual API contract: `{ region: string; demand_score: number; growth_pct: number }[]`.
- Add optional `item_id` query support in `useGeoDemand(itemId?)` to match PRD acceptance criteria.
- Remove `order_volume`, `revenue`, `top_category` from `RegionData` type — these are not in the current API contract and should not be part of the frontend model.

### 2. Normalize the geo data model

Replace the current `RegionData` type with the API contract shape:

```ts
export type RegionData = {
  region: string;
  demand_score: number;
  growth_pct: number;
};

export type GeoDemandResponse = {
  regions: RegionData[];
};
```

Remove `total_regions_served` and `top_growth_region` from the response type — they are not in the contract. Compute these as UI-derived KPIs from the `regions` array if needed.

Frontend-derived KPIs (not from API, computed in-page):
- `total_regions` = `regions.length`
- `top_growth_region` = `regions.reduce((best, r) => r.growth_pct > best.growth_pct ? r : best).region`
- `highest_demand_region` = region with max `demand_score`

### 3. Build the supplier heatmap UI

Replace the current placeholder map and incorrect ranking table in `app/dashboard/geo/page.tsx` with a heat-tile board:

- Region tiles sorted by highest `demand_score`
- Color intensity mapped to normalized `demand_score` (min-max across dataset -> low to high color)
- Growth badge per region (positive = green, negative = red, flat = neutral)
- Active legend from low to high intensity
- Selected-region detail panel or inline summary on click
- Keep the ranking table but render it from the same normalized source as the heatmap; columns should be: Region | Demand Score | Growth — remove the Orders and Revenue columns (not in contract).

Product filter control at the top of the page:
- Default "All products"
- Filter values sourced from supplier-facing product insight/inventory data, NOT retailer data
- Changing filter refetches `useGeoDemand` with `item_id`

### 4. Clarify supplier wording — no retailer references

Update ALL page copy to explicitly frame the view as:

- Title: **"Permintaan Distributor per Wilayah"** (Distributor Demand by Region)
- NOT "market demand", NOT "downstream demand", NOT generic "demand" that implies end-consumer
- Subtitle/caption: **"Distribusi permintaan dari jaringan distributor berdasarkan wilayah geografis."** (Distribution of demand from distributor network by geographic region.)
- Add a small caption in the heatmap card: **"Data berdasarkan pesanan dari distributor partner."** (Data based on orders from distributor partners.)
- KPI labels:
  - "Total Wilayah Aktif" instead of "Total Regions Served"
  - "Wilayah Tumbuh Tertinggi" instead of "Top Growth Region"

### 5. Public Interfaces / Types

```ts
useGeoDemand(itemId?: string)
```

- Frontend query calls `/analytics/supplier/regional` (no `item_id` param by default)
- When product filter is selected, calls `/analytics/supplier/regional?item_id=...`
- Response shape aligned to API contract: `{ regions: { region: string; demand_score: number; growth_pct: number }[] }`

## Implementation Checklist

1. **`hooks/useGeoDemand.ts`** — Rewrite types to match API contract (`RegionData` = `{ region, demand_score, growth_pct }`), remove `total_regions_served`/`top_growth_region`, update mock data, add `itemId?` parameter.
2. **`app/dashboard/geo/page.tsx`** — Replace placeholder map with heat-tile board, update ranking table columns (remove Orders/Revenue), compute KPIs from `regions` array, update all copy/wording.
3. **Product filter** — Add product filter dropdown sourced from supplier inventory data, wire to `useGeoDemand(itemId)`.

## Test Plan

- Supplier role can access `/dashboard/geo`; non-supplier roles see access denied.
- Heatmap and ranking list render from the same dataset and stay in sync after filter changes.
- No retailer hooks or retailer page data imported in the supplier geo page path.
- Changing product filter triggers a new query with `item_id` and updates heat intensity/ranking correctly.
- Empty state renders cleanly when `regions` is empty.
- Error and loading states work for both KPI section and heatmap section.
- Mock mode: all displayed regions modeled as distributor order demand, not retailer demand.
- Page copy explicitly says "distributor" not "retailer" or generic "market".

## Assumptions

- **Data scope: distributor order demand only.** The supplier sees how much their distributor partners order from each region. The supplier has no direct relationship with retailers, and no retailer data should appear in this page.
- **UI: regional heat tiles**, NOT a literal choropleth map. The repo has no map asset or geo library.
- If backend expands `/analytics/supplier/regional` to include additional fields (order volume, revenue, top category), those can be added to the UI later. For now, the frontend model strictly follows the current contract.
- This plan covers the **supplier** geo mapping page only. Distributor regional analytics remain in the analytics page (`/dashboard/analytics`) as-is.
