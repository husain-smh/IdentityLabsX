'use client';

import { useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import { geoMercator } from 'd3-geo';

// World map TopoJSON - using CDN for simplicity
// You can also download and host locally: https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export interface LocationHeatmapData {
  location: string;
  country_codes: string[];
  region_type: 'country' | 'region';
  confidence: 'high' | 'medium' | 'low';
  engagement_count: number;
  unique_users: number;
  importance_score_avg: number;
  importance_score_max: number;
}

interface WorldHeatmapProps {
  data: LocationHeatmapData[];
  onCountryClick?: (countryCode: string, data: LocationHeatmapData | undefined) => void;
  height?: number;
}

/**
 * Calculate color intensity based on engagement count
 * Uses logarithmic scale for better distribution
 */
function getColorForEngagementCount(
  count: number,
  maxCount: number,
  minCount: number = 0
): string {
  if (count === 0 || maxCount === 0) {
    return '#E5E7EB'; // Gray for no data
  }
  
  // Use logarithmic scale for better color distribution
  const logMax = Math.log10(maxCount + 1);
  const logCount = Math.log10(count + 1);
  const normalized = logCount / logMax;
  
  // Interpolate between light and dark blue (matching design system)
  if (normalized < 0.2) {
    return '#E0E7FF'; // Lightest blue
  } else if (normalized < 0.4) {
    return '#C7D2FE'; // Light blue
  } else if (normalized < 0.6) {
    return '#A5B4FC'; // Medium-light blue
  } else if (normalized < 0.8) {
    return '#6366F1'; // Medium blue (primary)
  } else {
    return '#312E81'; // Darkest blue
  }
}

export function WorldHeatmap({ data, onCountryClick, height = 400 }: WorldHeatmapProps) {
  // Create a map of country code to location data
  const countryDataMap = useMemo(() => {
    const map = new Map<string, LocationHeatmapData>();
    
    for (const location of data) {
      for (const countryCode of location.country_codes) {
        const existing = map.get(countryCode);
        if (!existing || location.engagement_count > existing.engagement_count) {
          map.set(countryCode, location);
        }
      }
    }
    
    return map;
  }, [data]);
  
  // Calculate max engagement count for color scaling
  const maxCount = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map(d => d.engagement_count));
  }, [data]);
  
  // Handle country click
  const handleCountryClick = (countryCode: string) => {
    if (onCountryClick) {
      const locationData = countryDataMap.get(countryCode);
      onCountryClick(countryCode, locationData);
    }
  };
  
  return (
    <div className="w-full" style={{ height }}>
      <ComposableMap
        projectionConfig={{
          scale: 147,
          center: [0, 20],
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const countryCode = geo.properties.ISO_A2;
              const locationData = countryDataMap.get(countryCode);
              const engagementCount = locationData?.engagement_count || 0;
              const fillColor = getColorForEngagementCount(engagementCount, maxCount);
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke="#FFFFFF"
                  strokeWidth={0.5}
                  style={{
                    default: {
                      outline: 'none',
                      transition: 'all 0.2s ease',
                    },
                    hover: {
                      fill: '#4D4DFF',
                      outline: 'none',
                      cursor: onCountryClick ? 'pointer' : 'default',
                      stroke: '#312E81',
                      strokeWidth: 1.5,
                    },
                    pressed: {
                      outline: 'none',
                    },
                  }}
                  onClick={() => handleCountryClick(countryCode)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}

/**
 * Tooltip component for showing location data on hover
 */
export function HeatmapTooltip({
  countryName,
  locationData,
  x,
  y,
}: {
  countryName: string;
  locationData: LocationHeatmapData | undefined;
  x: number;
  y: number;
}) {
  if (!locationData || locationData.engagement_count === 0) {
    return null;
  }
  
  return (
    <div
      className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-3 pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y - 10}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="text-sm font-semibold text-foreground mb-1">
        {countryName}
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div>
          <span className="font-medium">{locationData.engagement_count.toLocaleString()}</span> engagements
        </div>
        <div>
          <span className="font-medium">{locationData.unique_users.toLocaleString()}</span> unique users
        </div>
        {locationData.region_type === 'region' && (
          <div className="text-xs text-muted-foreground italic">
            Region data
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Legend component for the heatmap
 */
export function HeatmapLegend({ maxCount }: { maxCount: number }) {
  const colorStops = [
    { label: 'Low', color: '#E0E7FF', value: 0 },
    { label: 'Medium', color: '#6366F1', value: maxCount * 0.5 },
    { label: 'High', color: '#312E81', value: maxCount },
  ];
  
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="font-medium">Engagement Level:</span>
      <div className="flex items-center gap-2">
        {colorStops.map((stop, index) => (
          <div key={index} className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: stop.color }}
            />
            <span>{stop.label}</span>
          </div>
        ))}
      </div>
      {maxCount > 0 && (
        <span className="text-muted-foreground">
          (Max: {maxCount.toLocaleString()})
        </span>
      )}
    </div>
  );
}

