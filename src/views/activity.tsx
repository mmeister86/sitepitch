"use client"

import { ArrowDown, CheckCircle2 } from "lucide-react"
import { usePaginatedQuery } from "convex/react"

import { ActivityEmptyState, ActivityFeed } from "@/components/activity-feed"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api } from "../../convex/_generated/api"

const PAGE_SIZE = 25

export function ActivityView() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.reports.listActivity,
    {},
    { initialNumItems: PAGE_SIZE },
  )

  const loadingFirstPage = status === "LoadingFirstPage"
  const loadingMore = status === "LoadingMore"

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Aktivität</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Report-Interaktionen, geteilte Links, PDF-Exporte, Outreach-Aktionen und
          abgeschlossene Audits – neueste zuerst.
        </p>
      </div>

      <section
        aria-labelledby="activity-feed-heading"
        className="rounded-xl border bg-card shadow-sm"
      >
        <div className="border-b px-4 py-4 sm:px-6">
          <h3 id="activity-feed-heading" className="text-sm font-semibold">
            Aktivitätsverlauf
          </h3>
        </div>

        {loadingFirstPage ? (
          <div
            className="flex min-h-72 items-center justify-center"
            aria-label="Aktivitäten werden geladen"
          >
            <Spinner className="size-6 text-primary" />
          </div>
        ) : results.length === 0 ? (
          <ActivityEmptyState className="min-h-72 px-6" />
        ) : (
          <div className="px-4 py-2 sm:px-6">
            <ActivityFeed
              items={results}
              label="Alle Aktivitäten"
              itemClassName="py-4 first:pt-2 last:border-b-0"
            />
          </div>
        )}

        {!loadingFirstPage && results.length > 0 ? (
          <div className="flex min-h-16 items-center justify-center border-t px-4 py-3">
            {status === "CanLoadMore" || loadingMore ? (
              <Button
                variant="outline"
                className="min-w-36 gap-2"
                disabled={loadingMore}
                onClick={() => loadMore(PAGE_SIZE)}
              >
                {loadingMore ? <Spinner className="size-4" /> : <ArrowDown className="size-4" />}
                {loadingMore ? "Wird geladen …" : "Mehr laden"}
              </Button>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Alle verfügbaren Aktivitäten geladen
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
