"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";
import {
  AllCommunityModule,
  ModuleRegistry,
  ValidationModule,
  themeQuartz,
} from "ag-grid-community";
import {
  Send,
  ExternalLink,
  Download,
  Search,
  Check,
  Loader2,
  Calendar,
} from "lucide-react";
import type { InvoiceWithClient } from "@/types/database";
import { StatusBadge, PriorityBadge } from "./Badges";

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

const customTheme = themeQuartz.withParams({
  rowHeight: 64,
  headerHeight: 46,
  borderRadius: 10,
  wrapperBorder: true,
  borderColor: "#E4E8DA",
  rowBorder: true,
  headerBackgroundColor: "#EEF2E3",
  headerTextColor: "#5F6862",
  backgroundColor: "#FFFFFF",
  foregroundColor: "#242524",
  cellHorizontalPadding: 16,
});

interface AgingGridProps {
  invoices: InvoiceWithClient[];
  loading?: boolean;
  onRefresh?: () => void;
  onSelectInvoice?: (invoice: InvoiceWithClient) => void;
}

export function AgingGrid({ invoices, loading, onRefresh, onSelectInvoice }: AgingGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBucket, setActiveBucket] = useState<string>("ALL");
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [actionSuccessUrl, setActionSuccessUrl] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const enrichedRows = useMemo(() => {
    const currentTime = now || new Date(0);
    return (invoices || []).map((inv) => {
      const dueDate = new Date(inv.due_date);
      const diffTime = currentTime.getTime() - dueDate.getTime();
      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      let bucket = "CURRENT";
      if (inv.status === "PAID") {
        bucket = "PAID";
      } else if (diffDays > 60) {
        bucket = "60+";
      } else if (diffDays > 30) {
        bucket = "31-60";
      } else if (diffDays > 0) {
        bucket = "1-30";
      }

      return {
        ...inv,
        daysLate: diffDays,
        agingBucket: bucket,
      };
    });
  }, [invoices, now]);

  const filteredRows = useMemo(() => {
    return enrichedRows.filter((row) => {
      if (activeBucket !== "ALL") {
        if (activeBucket === "OVERDUE") {
          if (row.daysLate <= 0 || row.status === "PAID") return false;
        } else if (row.agingBucket !== activeBucket) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = row.client?.name?.toLowerCase() || "";
        const clientEmail = row.client?.email?.toLowerCase() || "";
        const invId = row.paypal_invoice_id?.toLowerCase() || "";
        return (
          clientName.includes(query) ||
          clientEmail.includes(query) ||
          invId.includes(query)
        );
      }

      return true;
    });
  }, [enrichedRows, activeBucket, searchQuery]);

  const handleTriggerFollowUp = useCallback(
    async (invoiceId: string) => {
      try {
        setTriggeringId(invoiceId);
        const res = await fetch(`/api/invoices/${invoiceId}/follow-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to trigger follow-up");
        }

        const data = await res.json();
        setActionSuccessUrl({ id: invoiceId, url: data.client_page_url });
        if (onRefresh) onRefresh();
      } catch (err: any) {
        alert(err.message || "Failed to trigger follow-up");
      } finally {
        setTriggeringId(null);
      }
    },
    [onRefresh]
  );

  const colDefs = useMemo<ColDef[]>(() => {
    return [
      {
        headerName: "Client",
        field: "client.name",
        minWidth: 260,
        flex: 1.4,
        cellRenderer: (p: ICellRendererParams) => {
          const client = p.data?.client;
          return (
            <div className="flex items-center gap-3 h-full overflow-hidden">
              {/* Avatar initial */}
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white select-none shadow-xs"
                style={{ background: "var(--pp-primary)" }}
              >
                {(client?.name || "?")[0].toUpperCase()}
              </div>
              <div className="flex flex-col justify-center min-w-0 leading-tight">
                <span className="font-semibold text-[13.5px] text-[var(--pp-ink)] truncate block">
                  {client?.name || "Unknown Client"}
                </span>
                <span className="text-[11.5px] text-[var(--pp-ink-faint)] truncate block mt-0.5">
                  {client?.email || p.data?.paypal_invoice_id}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        headerName: "Amount",
        field: "amount",
        width: 130,
        type: "numericColumn",
        valueFormatter: (p: ValueFormatterParams) => {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: p.data?.currency || "USD",
          }).format(p.value || 0);
        },
        // Setting cellClass replaces numericColumn's right-align class, so re-add it
        // to line values up with the right-aligned header.
        cellClass: "ag-right-aligned-cell tnum font-bold text-[var(--pp-ink)]",
        headerClass: "ag-right-aligned-header",
      },
      {
        headerName: "Aging / Due",
        field: "daysLate",
        width: 130,
        cellRenderer: (p: ICellRendererParams) => {
          const days = p.value as number;
          const isPaid = p.data?.status === "PAID";

          if (isPaid) {
            return (
              <div className="flex items-center h-full leading-normal">
                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full border bg-[var(--pp-recovered-soft)] text-[var(--pp-recovered)] border-[var(--pp-recovered-border)]">
                  <Check className="w-3 h-3" /> Cleared
                </span>
              </div>
            );
          }

          if (days <= 0) {
            return (
              <div className="flex items-center h-full leading-normal">
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-0.5 rounded-full border bg-[var(--pp-surface-muted)] text-[var(--pp-ink-soft)] border-[var(--pp-line)]">
                  <Calendar className="w-3 h-3" /> Due soon
                </span>
              </div>
            );
          }

          const isSevere = days > 30;
          return (
            <div className="flex items-center h-full leading-normal">
              <span
                className={`text-[11.5px] font-bold tnum px-2.5 py-0.5 rounded-full border ${
                  isSevere
                    ? "bg-[var(--pp-overdue-soft)] text-[var(--pp-overdue)] border-[var(--pp-overdue-border)]"
                    : "bg-[var(--pp-due-soft)] text-[var(--pp-due)] border-[var(--pp-due-border)]"
                }`}
              >
                {days}d late
              </span>
            </div>
          );
        },
      },
      {
        headerName: "AI Priority",
        field: "priority_score",
        width: 115,
        tooltip: (p) =>
          p.data?.priority_reason
            ? `AI Rationale: ${p.data.priority_reason}`
            : null,
        cellRenderer: (p: ICellRendererParams) => {
          return (
            <div className="flex items-center h-full leading-normal">
              <PriorityBadge
                score={p.value ?? 0}
                reason={p.data?.priority_reason}
              />
            </div>
          );
        },
      },
      {
        headerName: "Status",
        field: "status",
        width: 130,
        cellRenderer: (p: ICellRendererParams) => {
          return (
            <div className="flex items-center h-full leading-normal">
              <StatusBadge status={p.value} />
            </div>
          );
        },
      },
      {
        headerName: "Agent Action",
        colId: "actions",
        minWidth: 165,
        sortable: false,
        filter: false,
        cellRenderer: (p: ICellRendererParams) => {
          const id = p.data?.id;
          const isPaid = p.data?.status === "PAID";
          const isTriggering = triggeringId === id;

          if (isPaid) {
            return (
              <div className="flex items-center h-full leading-normal">
                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--pp-recovered-soft)] text-[var(--pp-recovered)] border border-[var(--pp-recovered-border)]">
                  <Check className="w-3 h-3" /> Settled
                </span>
              </div>
            );
          }

          if (actionSuccessUrl && actionSuccessUrl.id === id) {
            return (
              <a
                href={actionSuccessUrl.url}
                target="_blank"
                rel="noreferrer"
                className="apple-press inline-flex items-center gap-1 leading-none text-[12px] font-semibold text-[var(--pp-accent)] hover:underline"
              >
                Open Portal <ExternalLink className="w-3 h-3" />
              </a>
            );
          }

          return (
            <button
              onClick={() => handleTriggerFollowUp(id)}
              disabled={isTriggering}
              className="apple-press inline-flex items-center gap-1.5 px-3 py-1.5 leading-none rounded-[4px] text-[12px] font-semibold bg-[var(--pp-accent-soft)] hover:bg-[var(--pp-accent-tint)] text-[var(--pp-accent)] border border-[var(--pp-accent-border)] disabled:opacity-50"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  Follow Up
                </>
              )}
            </button>
          );
        },
      },
    ];
  }, [triggeringId, actionSuccessUrl, handleTriggerFollowUp]);

  const handleExportCsv = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `pulsepay-receivables-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    }
  };

  const buckets = [
    { key: "ALL", label: "All Invoices" },
    { key: "OVERDUE", label: "Overdue Only" },
    { key: "1-30", label: "1–30 Days" },
    { key: "31-60", label: "31–60 Days" },
    { key: "60+", label: "60+ Days" },
    { key: "PAID", label: "Settled" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Bucket Segmented Control */}
        <div className="inline-flex p-1 rounded-[10px] bg-[var(--pp-surface)] border border-[var(--pp-line)]">
          {buckets.map((b) => (
            <button
              key={b.key}
              onClick={() => setActiveBucket(b.key)}
              className={`apple-press px-3.5 py-1.5 text-[12px] font-semibold rounded-[4px] ${
                activeBucket === b.key
                  ? "bg-[var(--pp-primary)] text-[var(--pp-on-primary)]"
                  : "text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pp-ink-tertiary)]" />
            <input
              type="text"
              placeholder="Search clients or invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3.5 py-1.5 text-[12.5px] bg-[var(--pp-surface)] border border-[var(--pp-line)] rounded-[10px] text-[var(--pp-ink)] placeholder:text-[var(--pp-ink-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--pp-accent)] transition-[box-shadow,border-color] duration-150 w-56 sm:w-64"
            />
          </div>

          <button
            onClick={handleExportCsv}
            title="Export CSV"
            className="apple-press inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)] bg-[var(--pp-surface)] border border-[var(--pp-line)] rounded-[4px] hover:border-[var(--pp-line-strong)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Grid Container */}
      {/* Fill the remaining viewport height (header + title + toolbar ≈ 250px) */}
      <div className="w-full h-[calc(100dvh-250px)] min-h-[420px] rounded-[10px] overflow-hidden border border-[var(--pp-line)] bg-[var(--pp-surface)]">
        <AgGridReact
          ref={gridRef}
          theme={customTheme}
          rowHeight={64}
          headerHeight={46}
          rowData={filteredRows}
          columnDefs={colDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
          }}
          tooltipShowDelay={400}
          tooltipHideDelay={3000}
          onRowClicked={(event) => {
            if (event.data && onSelectInvoice) {
              onSelectInvoice(event.data);
            }
          }}
          rowClass="cursor-pointer"
          animateRows={true}
          loading={loading}
          overlayNoRowsTemplate="<span class='text-[var(--pp-ink-soft)] font-medium'>No receivables found matching the criteria.</span>"
        />
      </div>
    </div>
  );
}
