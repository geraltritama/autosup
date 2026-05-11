"use client";

import { useCallback, useState } from "react";
import { ArchiveX, Boxes, CircleAlert, Download, FileSpreadsheet, FileText, Plus, Upload } from "lucide-react";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryFilterBar } from "@/components/inventory/inventory-filter-bar";
import { InventoryLoadingState } from "@/components/inventory/inventory-loading-state";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { DeleteConfirmDialog } from "@/components/inventory/delete-confirm-dialog";
import { RestockPanel } from "@/components/inventory/restock-panel";
import { OrderFormDialog } from "@/components/orders/order-form-dialog";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useInventory,
  useImportInventory,
  useRestockRecommendation,
  type InventoryItem,
  type InventoryImportRow,
  type RestockRecommendation,
} from "@/hooks/useInventory";

type ExportColumn = "name" | "category" | "stock" | "min_stock" | "unit" | "price";

const EXPORT_COLUMNS_BY_ROLE: Record<string, ExportColumn[]> = {
  supplier: ["name", "category", "stock", "min_stock", "unit", "price"],
  distributor: ["name", "category", "stock", "min_stock", "unit", "price"],
  retailer: ["name", "category", "stock", "min_stock", "unit"],
};

const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  name: "name",
  category: "category",
  stock: "stock",
  min_stock: "min_stock",
  unit: "unit",
  price: "price",
};

const ROLE_COPY = {
  supplier: {
    badge: "Supplier · Product Inventory",
    title: "Product Inventory",
    description: "Manage products you supply to distributors. Set selling prices, minimum thresholds, and monitor stock levels.",
    kpi1Label: "Total Products",
    kpi1Meta: "All SKUs you sell",
    showPrice: true,
    priceLabel: "Selling price to distributors (IDR)",
  },
  distributor: {
    badge: "Distributor · Distribution Stock",
    title: "Distribution Stock",
    description: "Manage product stock you distribute to retailers. Monitor availability and restock thresholds.",
    kpi1Label: "Total SKU",
    kpi1Meta: "All distribution products",
    showPrice: true,
    priceLabel: "Selling price to retailers (IDR)",
  },
  retailer: {
    badge: "Retailer · Operational Stock",
    title: "Operational Stock",
    description: "Monitor your store's operational stock. Track availability and create restock orders before running out.",
    kpi1Label: "Total Item",
    kpi1Meta: "All operational stock",
    showPrice: false,
    priceLabel: "",
  },
} as const;

type DialogState =
  | { type: "closed" }
  | { type: "add" }
  | { type: "edit"; item: InventoryItem }
  | { type: "delete"; item: InventoryItem };

export default function InventoryPage() {
  const role = useAuthStore((s) => s.user?.role) ?? "distributor";
  const copy = ROLE_COPY[role];
  const exportColumns = EXPORT_COLUMNS_BY_ROLE[role] ?? EXPORT_COLUMNS_BY_ROLE.distributor;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const [restock, setRestock] = useState<RestockRecommendation | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderPrefill, setOrderPrefill] = useState<{ sellerId?: string; sellerType?: "supplier" | "distributor"; itemName?: string; qty?: number; unit?: string } | undefined>();
  const [exportOpen, setExportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; total: number } | null>(null);

  const { data, isLoading, isError, refetch } = useInventory({ search, category, status });
  const restockMutation = useRestockRecommendation();
  const importInventory = useImportInventory();

  const openAdd = useCallback(() => setDialog({ type: "add" }), []);
  const openEdit = useCallback((item: InventoryItem) => setDialog({ type: "edit", item }), []);
  const openDelete = useCallback((item: InventoryItem) => setDialog({ type: "delete", item }), []);
  const closeDialog = useCallback(() => setDialog({ type: "closed" }), []);

  async function handleRestock(item: InventoryItem) {
    setRestock(null);
    try {
      const rec = await restockMutation.mutateAsync(item.id);
      setRestock(rec);
    } catch {
      /* silently fail — user can retry */
    }
  }

  function handleCreateOrder(rec: RestockRecommendation) {
    setOrderPrefill({
      sellerId: rec.suggested_seller?.seller_id,
      sellerType: rec.suggested_seller?.seller_type,
      itemName: rec.item_name,
      qty: rec.suggested_qty,
      unit: rec.suggested_unit,
    });
    setRestock(null);
    setOrderOpen(true);
  }

  function getExportRows(sourceItems: InventoryItem[]) {
    return sourceItems.map((item) => {
      const row: Record<ExportColumn, string | number> = {
        name: item.name,
        category: item.category,
        stock: item.stock,
        min_stock: item.min_stock,
        unit: item.unit,
        price: item.price,
      };
      return exportColumns.reduce<Record<string, string | number>>((acc, column) => {
        acc[column] = row[column];
        return acc;
      }, {});
    });
  }

  function escapeCsvValue(value: string | number) {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replaceAll("\"", "\"\"")}"`;
    }
    return text;
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportCsv() {
    const headers = exportColumns.map((column) => EXPORT_COLUMN_LABELS[column]);
    const rows = getExportRows(items);
    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        exportColumns.map((column) => escapeCsvValue(row[column] ?? "")).join(","),
      ),
    ];
    downloadFile(
      csvLines.join("\n"),
      `${role}-inventory-export.csv`,
      "text/csv;charset=utf-8;",
    );
  }

  function handleExportExcel() {
    const headers = exportColumns.map((column) => EXPORT_COLUMN_LABELS[column]);
    const rows = getExportRows(items);
    const html = `
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>${exportColumns
                  .map((column) => `<td>${String(row[column] ?? "")}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;
    downloadFile(
      html,
      `${role}-inventory-export.xls`,
      "application/vnd.ms-excel;charset=utf-8;",
    );
  }

  function handleDownloadTemplate() {
    const headers = exportColumns.map((column) => EXPORT_COLUMN_LABELS[column]);
    const sampleRow =
      role === "retailer"
        ? ["Sample Item", "operational", "120", "20", "pcs"]
        : ["Sample Item", "finished_goods", "120", "20", "pcs", "15000"];
    downloadFile(
      [headers.join(","), sampleRow.join(",")].join("\n"),
      `${role}-inventory-upload-template.csv`,
      "text/csv;charset=utf-8;",
    );
  }

  function splitCsvLines(content: string) {
    const lines: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      const next = content[i + 1];

      if (char === "\"") {
        if (inQuotes && next === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (current.trim()) lines.push(current);
        current = "";
        if (char === "\r" && next === "\n") i += 1;
        continue;
      }

      current += char;
    }

    if (current.trim()) lines.push(current);
    return lines;
  }

  function parseCsvRow(line: string) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === "\"") {
        if (inQuotes && next === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  }

  function parseNumberValue(value: string, label: string, rowNumber: number) {
    const normalized = value.trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid ${label} value on row ${rowNumber}.`);
    }
    return parsed;
  }

  function validateHeaders(headers: string[]) {
    const normalized = headers.map((header) => header.trim().toLowerCase());
    const expected = exportColumns.map((column) => EXPORT_COLUMN_LABELS[column]);
    const sameLength = normalized.length === expected.length;
    const sameOrder = expected.every((column, index) => normalized[index] === column);
    if (!sameLength || !sameOrder) {
      throw new Error(`Invalid columns. Use exactly: ${expected.join(", ")}.`);
    }
  }

  function parseCsvContent(content: string) {
    const lines = splitCsvLines(content);
    if (lines.length < 2) {
      throw new Error("The file is empty or only contains headers.");
    }

    const headers = parseCsvRow(lines[0]);
    validateHeaders(headers);

    return lines.slice(1).map((line, index) => {
      const rowNumber = index + 2;
      const values = parseCsvRow(line);
      if (values.length !== exportColumns.length) {
        throw new Error(`Column count mismatch on row ${rowNumber}.`);
      }

      const row = exportColumns.reduce<Record<string, string>>((acc, column, columnIndex) => {
        acc[column] = values[columnIndex] ?? "";
        return acc;
      }, {});

      const itemName = row.name?.trim();
      if (!itemName) {
        throw new Error(`Item name is required on row ${rowNumber}.`);
      }

      return {
        name: itemName,
        category: row.category?.trim() || "general",
        stock: parseNumberValue(row.stock ?? "0", "stock", rowNumber),
        min_stock: parseNumberValue(row.min_stock ?? "0", "min_stock", rowNumber),
        unit: row.unit?.trim() || "pcs",
        price: parseNumberValue(row.price ?? "0", "price", rowNumber),
      } satisfies InventoryImportRow;
    });
  }

  function parseExcelHtml(content: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr"));
    if (rows.length < 2) {
      throw new Error("The Excel file is empty or only contains headers.");
    }

    const headerCells = Array.from(rows[0].querySelectorAll("th,td")).map((cell) => cell.textContent?.trim() ?? "");
    validateHeaders(headerCells);

    return rows.slice(1).map((row, index) => {
      const rowNumber = index + 2;
      const values = Array.from(row.querySelectorAll("td,th")).map((cell) => cell.textContent?.trim() ?? "");
      if (values.length !== exportColumns.length) {
        throw new Error(`Column count mismatch on row ${rowNumber}.`);
      }

      const mapped = exportColumns.reduce<Record<string, string>>((acc, column, columnIndex) => {
        acc[column] = values[columnIndex] ?? "";
        return acc;
      }, {});

      const itemName = mapped.name?.trim();
      if (!itemName) {
        throw new Error(`Item name is required on row ${rowNumber}.`);
      }

      return {
        name: itemName,
        category: mapped.category?.trim() || "general",
        stock: parseNumberValue(mapped.stock ?? "0", "stock", rowNumber),
        min_stock: parseNumberValue(mapped.min_stock ?? "0", "min_stock", rowNumber),
        unit: mapped.unit?.trim() || "pcs",
        price: parseNumberValue(mapped.price ?? "0", "price", rowNumber),
      } satisfies InventoryImportRow;
    });
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportError(null);
    setImportResult(null);

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xls")) {
      setImportError("Only .csv or .xls files are supported for import.");
      return;
    }

    try {
      const content = await file.text();
      const rows = lowerName.endsWith(".csv")
        ? parseCsvContent(content)
        : parseExcelHtml(content);

      const result = await importInventory.mutateAsync(rows);
      setImportResult(result);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  const summary = data?.summary ?? { total_items: 0, low_stock_count: 0, out_of_stock_count: 0 };
  const items = data?.items ?? [];

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">{copy.badge}</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">{copy.title}</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {copy.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="gap-2" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label={copy.kpi1Label}
          value={String(summary.total_items)}
          meta={copy.kpi1Meta}
          tone="info"
          icon={Boxes}
        />
        <KpiCard
          label="Low Stock"
          value={String(summary.low_stock_count)}
          meta="Needs attention soon"
          tone="warning"
          icon={CircleAlert}
        />
        <KpiCard
          label="Out of Stock"
          value={String(summary.out_of_stock_count)}
          meta="Immediate action needed"
          tone="danger"
          icon={ArchiveX}
        />
      </section>

      {/* AI Restock panel (shown after recommendation is fetched) */}
      {restock && role !== "supplier" && (
        <RestockPanel
          recommendation={restock}
          onClose={() => setRestock(null)}
          onCreateOrder={handleCreateOrder}
        />
      )}

      {/* Loading restock */}
      {restockMutation.isPending && role !== "supplier" && (
        <div className="rounded-2xl border border-blue-100 bg-[#EFF6FF] px-5 py-4 text-sm text-[#2563EB]">
          Fetching restock recommendations from AI...
        </div>
      )}

      {/* Filter bar */}
      <InventoryFilterBar
        search={search}
        category={category}
        status={status}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        onReset={() => { setSearch(""); setCategory(""); setStatus(""); }}
      />

      {/* Main content states */}
      {isLoading && <InventoryLoadingState />}

      {isError && !isLoading && (
        <InventoryErrorState onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <InventoryEmptyState onAdd={openAdd} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
        {role === "supplier" && data?.insight && (
          <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <span className="text-lg">🔥</span>
            <p className="text-sm font-medium text-orange-800">{data.insight}</p>
          </div>
        )}
        <InventoryTable
          items={items}
          onEdit={openEdit}
          onDelete={openDelete}
          onRestock={role !== "supplier" ? handleRestock : undefined}
          showPrice={copy.showPrice}
          showDemand={role === "supplier"}
        />
        </>
      )}

      {/* Dialogs */}
      <ItemFormDialog
        open={dialog.type === "add" || dialog.type === "edit"}
        onClose={closeDialog}
        editItem={dialog.type === "edit" ? dialog.item : null}
        showPrice={copy.showPrice}
        priceLabel={copy.priceLabel}
      />

      <DeleteConfirmDialog
        open={dialog.type === "delete"}
        onClose={closeDialog}
        item={dialog.type === "delete" ? dialog.item : null}
      />

      <OrderFormDialog
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        prefill={orderPrefill}
      />

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Inventory"
        description="Download inventory data in CSV or Excel format. For CSV or Excel uploads, keep the column names exactly the same."
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Button
              variant="secondary"
              className="h-auto flex-col items-start gap-2 px-4 py-4 text-left"
              onClick={handleExportCsv}
              disabled={items.length === 0}
            >
              <FileText className="h-4 w-4" />
              <span>Export CSV</span>
              <span className="text-xs font-normal text-[#64748B]">Download current inventory as `.csv`.</span>
            </Button>
            <Button
              variant="secondary"
              className="h-auto flex-col items-start gap-2 px-4 py-4 text-left"
              onClick={handleExportExcel}
              disabled={items.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Excel</span>
              <span className="text-xs font-normal text-[#64748B]">Download current inventory as `.xls`.</span>
            </Button>
            <Button
              variant="secondary"
              className="h-auto flex-col items-start gap-2 px-4 py-4 text-left"
              onClick={handleDownloadTemplate}
            >
              <Upload className="h-4 w-4" />
              <span>Download Upload Template</span>
              <span className="text-xs font-normal text-[#64748B]">Use this template before uploading CSV or Excel files.</span>
            </Button>
          </div>

          {role === "distributor" && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4">
              <div className="flex items-center gap-2">
                <Badge tone="success">Distributor Import</Badge>
                <p className="text-sm font-medium text-[#0F172A]">Upload CSV or Excel</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#475569]">
                Upload a `.csv` or `.xls` file with the exact column format below. Existing items will be updated by item name. New items will be created automatically.
              </p>
              <div className="mt-4">
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.xls"
                    className="hidden"
                    onChange={handleImportFile}
                    disabled={importInventory.isPending}
                  />
                  <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#E2E8F0] px-4 text-sm font-medium text-[#0F172A] transition hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    {importInventory.isPending ? "Importing..." : "Upload Inventory File"}
                  </span>
                </label>
              </div>
              {importError && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                  {importError}
                </div>
              )}
              {importResult && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                  Import completed. {importResult.created} created, {importResult.updated} updated, {importResult.total} total rows processed.
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-[#E2E8F0] bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Badge tone="info">Upload Format</Badge>
              <p className="text-sm font-medium text-[#0F172A]">Required columns</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#475569]">
              When uploading `.csv` or `.xls`, the file must use these exact column names and order.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {exportColumns.map((column) => (
                <code
                  key={column}
                  className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-medium text-[#0F172A]"
                >
                  {EXPORT_COLUMN_LABELS[column]}
                </code>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            Files that use different column names will fail validation during upload. Download the template first if you need a safe starting format.
          </div>
        </div>
      </Dialog>
    </main>
  );
}
