"use client"

import { MapPin } from "lucide-react"

import { Map, MapMarker, MarkerContent, MarkerPopup, MapControls } from "@/registry/map"
import { cn } from "@/lib/utils"

export function LeadMap({
  latitude,
  longitude,
  name,
  address,
  className,
}: {
  latitude?: number
  longitude?: number
  name: string
  address?: string
  className?: string
}) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return (
      <div
        className={cn(
          "flex h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 text-center",
          className,
        )}
      >
        <MapPin className="size-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Keine Kartenkoordinaten gespeichert</p>
        {address && <p className="max-w-[90%] break-words text-xs text-muted-foreground/60">{address}</p>}
      </div>
    )
  }

  return (
    <div className={cn("h-[240px] overflow-hidden rounded-xl border", className)}>
      <Map center={[longitude, latitude]} zoom={14}>
        <MapMarker longitude={longitude} latitude={latitude}>
          <MarkerContent>
            <MapPin className="size-7 fill-primary stroke-background drop-shadow" />
          </MarkerContent>
          <MarkerPopup closeButton offset={16}>
            <div className="space-y-1 p-2">
              <p className="font-medium">{name}</p>
              {address && <p className="text-xs text-muted-foreground">{address}</p>}
            </div>
          </MarkerPopup>
        </MapMarker>
        <MapControls position="top-right" showZoom />
      </Map>
    </div>
  )
}
