import { ScatterplotLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { Map, type MapRef } from '@vis.gl/react-maplibre';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { screenEngine } from '../lib/realtime/engines/screen-engine';
import { countWithin } from '../lib/realtime/step-free-data';
import { useScreenStore } from '../lib/realtime/stores/screen-store';
import { getOriginName, isHalfRevealed, type WallHalf } from '../lib/realtime/story';
import type { OriginTimes, Station, StepFreeDataset } from '../lib/realtime/types';
import {
    bandFor,
    NO_ROUTE,
    ORIGIN_RING,
    TRAVEL_BANDS,
    UNREVEALED,
    type Rgb
} from '../lib/travel-bands';
import {
    deriveTileView,
    fitHalfView,
    locateTile,
    parseScreenCoordinate,
    parseWallSize,
    SCREEN_HEIGHT,
    type WallTile
} from '../lib/wall';

import 'maplibre-gl/dist/maplibre-gl.css';

// Sizes are fractions of one screen's height so dots stay legible from across the room.
const STATION_RADIUS_PX = Math.round(SCREEN_HEIGHT * 0.012);
const ORIGIN_RING_RADIUS_PX = STATION_RADIUS_PX * 3;
const ORIGIN_RING_WIDTH_PX = Math.round(SCREEN_HEIGHT * 0.004);
// Slow colour fades keep scene and origin changes comfortable to watch on a wraparound wall.
const COLOUR_TRANSITION_MS = 1500;
// MapLibre can't animate data-driven colours, so its path dims the dots, swaps data, then
// brightens them again: a gentle dip instead of a sudden switch.
const MAPLIBRE_FADE_MS = 700;
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STATIONS_SOURCE_ID = 'stations-source';
const STATIONS_LAYER_ID = 'stations-layer';
const ORIGIN_SOURCE_ID = 'origin-source';
const ORIGIN_LAYER_ID = 'origin-layer';

// Each `/screen` instance represents one wall tile (`c`,`r`). The left half of the wall shows
// travel times with stairs, the right half step-free travel times, each as one continuous map.
// Optional `cols`/`rows` let the simulator run a smaller wall with the same code.

type StationMark = {
    position: [number, number];
    fill: Rgb;
    hollow: boolean;
};

export const Route = createFileRoute('/screen')({
    component: ScreenPage
});

function ScreenPage() {
    const { search } = useLocation();
    // Query params identify which physical panel this route instance represents.
    const searchParams = (search as Record<string, unknown>) ?? {};
    const wall = parseWallSize(searchParams.cols, searchParams.rows);
    const screenC = parseScreenCoordinate(searchParams.c, wall.cols);
    const screenR = parseScreenCoordinate(searchParams.r, wall.rows);
    const tile = useMemo(
        () => locateTile(screenC, screenR, wall),
        [screenC, screenR, wall.cols, wall.rows]
    );

    const dataset = useScreenStore((state) => state.dataset);
    const origin = useScreenStore((state) => state.origin);
    const scene = useScreenStore((state) => state.scene);
    const [isClient, setIsClient] = useState(false);
    const [useDeckWrapper, setUseDeckWrapper] = useState(false);
    const [mapInstance, setMapInstance] = useState<ReturnType<MapRef['getMap']> | null>(null);
    const fadeTimerRef = useRef<number | null>(null);
    const wantsDeckRenderer = searchParams.renderer === 'deck';

    const setMapRef = useCallback((instance: MapRef | null) => {
        setMapInstance(instance?.getMap() ?? null);
    }, []);

    useEffect(() => {
        setIsClient(true);
        // MapLibre is the default renderer everywhere: it draws the same marks, is iframe-safe,
        // and is what the wall needs. The DeckGL path is opt-in (`?renderer=deck`, own tab only)
        // because luma.gl 9.2.6 throws on startup ("reading 'maxTextureDimension2D'": its
        // CanvasContext resize handler runs without a ready device) and then draws nothing.
        setUseDeckWrapper(wantsDeckRenderer && window.self === window.top);
        void screenEngine.ensureDatasetLoaded();
    }, [wantsDeckRenderer]);

    const originTimes = dataset?.origins.find((candidate) => candidate.id === origin) ?? null;
    const revealed = isHalfRevealed(scene, tile.half);
    const minutes = originTimes
        ? tile.half === 'with-stairs'
            ? originTimes.any
            : originTimes.stepFree
        : null;

    const tileView = useMemo(() => {
        if (!dataset) return null;
        return deriveTileView(fitHalfView(dataset.stations, tile.halfCols, tile.rows), tile);
    }, [dataset, tile]);

    const marks = useMemo(
        () =>
            dataset && originTimes && minutes
                ? buildStationMarks(dataset.stations, minutes, revealed, originTimes.stationIndex)
                : [],
        [dataset, originTimes, minutes, revealed]
    );
    const hollowMarks = useMemo(() => marks.filter((mark) => mark.hollow), [marks]);
    const originPosition = useMemo<[number, number] | null>(() => {
        if (!dataset || !originTimes) return null;
        const station = dataset.stations[originTimes.stationIndex];
        return [station.lon, station.lat];
    }, [dataset, originTimes]);

    const deckLayers = useMemo(
        () => [
            new ScatterplotLayer<StationMark>({
                id: 'stations',
                // Every station stays in this layer (hollow ones fully transparent) so indices
                // never shift and each station's colour fades from its own previous colour.
                data: marks,
                getPosition: (d) => d.position,
                getFillColor: (d) => [...d.fill, d.hollow ? 0 : 255],
                getRadius: STATION_RADIUS_PX,
                radiusUnits: 'pixels',
                // Fade colours instead of snapping, for viewer comfort.
                transitions: { getFillColor: COLOUR_TRANSITION_MS },
                pickable: false
            }),
            new ScatterplotLayer<StationMark>({
                id: 'no-route',
                data: hollowMarks,
                getPosition: (d) => d.position,
                getRadius: STATION_RADIUS_PX,
                radiusUnits: 'pixels',
                filled: false,
                stroked: true,
                getLineColor: NO_ROUTE.rgb,
                lineWidthUnits: 'pixels',
                getLineWidth: ORIGIN_RING_WIDTH_PX / 2,
                pickable: false
            }),
            new ScatterplotLayer<[number, number]>({
                id: 'origin',
                data: originPosition ? [originPosition] : [],
                getPosition: (d) => d,
                getRadius: ORIGIN_RING_RADIUS_PX,
                radiusUnits: 'pixels',
                filled: false,
                stroked: true,
                getLineColor: ORIGIN_RING.rgb,
                lineWidthUnits: 'pixels',
                getLineWidth: ORIGIN_RING_WIDTH_PX,
                pickable: false
            })
        ],
        [marks, hollowMarks, originPosition]
    );

    const stationsGeojson = useMemo(
        () =>
            ({
                type: 'FeatureCollection',
                features: marks.map((mark) => ({
                    type: 'Feature',
                    // Hollow (no-route) stations get a transparent fill and a visible ring.
                    properties: {
                        color: rgbaToCss(mark.fill, mark.hollow ? 0 : 1),
                        hollow: mark.hollow
                    },
                    geometry: { type: 'Point', coordinates: mark.position }
                }))
            }) as const,
        [marks]
    );
    const originGeojson = useMemo(
        () =>
            ({
                type: 'FeatureCollection',
                features: originPosition
                    ? [
                          {
                              type: 'Feature',
                              properties: {},
                              geometry: { type: 'Point', coordinates: originPosition }
                          }
                      ]
                    : []
            }) as const,
        [originPosition]
    );

    useEffect(() => {
        if (!isClient || useDeckWrapper || !mapInstance) return;

        const syncLayers = () => {
            if (!mapInstance.isStyleLoaded()) return;

            const stationsSource = mapInstance.getSource(STATIONS_SOURCE_ID) as
                | { setData: (data: unknown) => void }
                | undefined;
            const originSource = mapInstance.getSource(ORIGIN_SOURCE_ID) as
                | { setData: (data: unknown) => void }
                | undefined;

            if (stationsSource && originSource) {
                // Fast path after first mount: update data in place instead of rebuilding layers,
                // dimming first so the change reads as a soft fade rather than a jump.
                setLayerOpacity(mapInstance, 0);
                if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
                fadeTimerRef.current = window.setTimeout(() => {
                    fadeTimerRef.current = null;
                    stationsSource.setData(stationsGeojson);
                    originSource.setData(originGeojson);
                    setLayerOpacity(mapInstance, 1);
                }, MAPLIBRE_FADE_MS);
                return;
            }

            mapInstance.addSource(STATIONS_SOURCE_ID, {
                type: 'geojson',
                data: stationsGeojson as never
            });
            mapInstance.addLayer({
                id: STATIONS_LAYER_ID,
                type: 'circle',
                source: STATIONS_SOURCE_ID,
                paint: {
                    'circle-radius': STATION_RADIUS_PX,
                    'circle-color': ['get', 'color'],
                    'circle-stroke-color': NO_ROUTE.hex,
                    // Stations with no route are drawn as hollow rings.
                    'circle-stroke-width': ['case', ['get', 'hollow'], ORIGIN_RING_WIDTH_PX / 2, 0],
                    // Opacity stays a constant (not data-driven) so MapLibre can animate it.
                    'circle-opacity': 1,
                    'circle-stroke-opacity': 1,
                    'circle-opacity-transition': { duration: MAPLIBRE_FADE_MS },
                    'circle-stroke-opacity-transition': { duration: MAPLIBRE_FADE_MS }
                }
            });
            mapInstance.addSource(ORIGIN_SOURCE_ID, {
                type: 'geojson',
                data: originGeojson as never
            });
            mapInstance.addLayer({
                id: ORIGIN_LAYER_ID,
                type: 'circle',
                source: ORIGIN_SOURCE_ID,
                paint: {
                    'circle-radius': ORIGIN_RING_RADIUS_PX,
                    'circle-opacity': 0,
                    'circle-stroke-color': ORIGIN_RING.hex,
                    'circle-stroke-width': ORIGIN_RING_WIDTH_PX,
                    'circle-stroke-opacity': 1,
                    'circle-stroke-opacity-transition': { duration: MAPLIBRE_FADE_MS }
                }
            });
        };

        syncLayers();
        mapInstance.on('load', syncLayers);

        return () => {
            mapInstance.off('load', syncLayers);
        };
    }, [isClient, mapInstance, originGeojson, stationsGeojson, useDeckWrapper]);

    useEffect(() => {
        // Cancel a pending fade when the screen unmounts.
        return () => {
            if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
        };
    }, []);

    return (
        <main className="pointer-events-none relative h-screen w-screen overflow-hidden bg-[#1f2029] text-[#f0efec]">
            <div className="absolute inset-0">
                {isClient && tileView && useDeckWrapper ? (
                    <DeckGL
                        controller={false}
                        viewState={tileView}
                        layers={deckLayers}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <Map reuseMaps attributionControl={false} mapStyle={MAP_STYLE} />
                    </DeckGL>
                ) : null}

                {isClient && tileView && !useDeckWrapper ? (
                    // Iframe-safe fallback implementation: direct map rendering + imperative layers.
                    <Map
                        ref={setMapRef}
                        reuseMaps
                        attributionControl={false}
                        mapStyle={MAP_STYLE}
                        longitude={tileView.longitude}
                        latitude={tileView.latitude}
                        zoom={tileView.zoom}
                        bearing={tileView.bearing}
                        pitch={tileView.pitch}
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : null}
            </div>

            {/* Client-only, like the map: the dataset can arrive before hydration, and rendering
                it then would make the client's first render differ from the server HTML. */}
            {isClient && dataset && originTimes ? (
                <TileOverlay
                    tile={tile}
                    dataset={dataset}
                    originTimes={originTimes}
                    revealed={revealed}
                />
            ) : null}
        </main>
    );
}

type TileOverlayProps = {
    tile: WallTile;
    dataset: StepFreeDataset;
    originTimes: OriginTimes;
    revealed: boolean;
};

function TileOverlay({ tile, dataset, originTimes, revealed }: TileOverlayProps) {
    // Text lives on whole screens (never across a bezel): each half's top-left screen carries its
    // label, and the wall's bottom-right screen carries the legend and credits.
    if (tile.localC === 0 && tile.r === 0) {
        return (
            <HalfLabel
                half={tile.half}
                dataset={dataset}
                originTimes={originTimes}
                revealed={revealed}
            />
        );
    }
    if (
        tile.half === 'step-free' &&
        tile.localC === tile.halfCols - 1 &&
        tile.r === tile.rows - 1
    ) {
        return <Legend />;
    }
    return null;
}

type HalfLabelProps = {
    half: WallHalf;
    dataset: StepFreeDataset;
    originTimes: OriginTimes;
    revealed: boolean;
};

function HalfLabel({ half, dataset, originTimes, revealed }: HalfLabelProps) {
    const threshold = dataset.reachThresholdMin;
    const withStairsReach = countWithin(originTimes.any, threshold);
    const stepFreeReach = countWithin(originTimes.stepFree, threshold);
    const reach = half === 'with-stairs' ? withStairsReach : stepFreeReach;
    // Share of the with-stairs reach a step-free traveller keeps: the headline comparison.
    const sharePercent =
        withStairsReach > 0 ? Math.round((stepFreeReach / withStairsReach) * 100) : 0;

    return (
        <section className="absolute inset-0 flex flex-col justify-center gap-[3vh] bg-[#1f2029]/90 px-[7vh]">
            {/* Primary text at 20% of screen height, the starter's legibility baseline for ~10 m. */}
            <h1 className="text-[20vh] leading-none font-bold tracking-tight">
                {half === 'with-stairs' ? 'With stairs' : 'Step-free'}
            </h1>
            <p className="text-[8vh] leading-tight">
                {revealed
                    ? `${reach} stations within ${threshold} min`
                    : half === 'with-stairs'
                      ? 'Who can get where?'
                      : "If you can't use stairs"}
            </p>
            {revealed && half === 'step-free' ? (
                <p className="text-[8vh] leading-tight text-[#cde2fb]">
                    {sharePercent}% of the reach with stairs
                </p>
            ) : null}
            <p className="text-[5vh] text-[#c3c2b7]">
                from {getOriginName(originTimes.id)}, weekday 9am
            </p>
        </section>
    );
}

function Legend() {
    return (
        <section className="absolute inset-0 flex flex-col justify-center gap-[2.5vh] bg-[#1f2029]/90 px-[7vh] text-[5vh] text-[#c3c2b7]">
            {TRAVEL_BANDS.map((band) => (
                <LegendRow key={band.label} label={band.label}>
                    <span
                        className="block h-full w-full rounded-full"
                        style={{ backgroundColor: band.hex }}
                    />
                </LegendRow>
            ))}
            <LegendRow label="no step-free route">
                <span
                    className="block h-full w-full rounded-full border-[0.4vh]"
                    style={{ borderColor: NO_ROUTE.hex }}
                />
            </LegendRow>
            <LegendRow label="starting station">
                <span
                    className="block h-full w-full rounded-full border-[0.6vh]"
                    style={{ borderColor: ORIGIN_RING.hex }}
                />
            </LegendRow>
            <p className="mt-[2vh] text-[2.4vh] leading-snug text-[#8a8984]">
                Powered by the Transport for London Journey Planner API.
                <br />© OpenStreetMap contributors © CARTO
            </p>
        </section>
    );
}

function LegendRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-[3vh]">
            <span className="block h-[5vh] w-[5vh] shrink-0">{children}</span>
            <span>{label}</span>
        </div>
    );
}

function buildStationMarks(
    stations: Station[],
    minutes: Array<number | null>,
    revealed: boolean,
    originIndex: number
): StationMark[] {
    // Station order stays fixed (never sorted by time) so colour transitions interpolate each
    // station's own colour rather than blending between different stations.
    const marks: StationMark[] = [];
    stations.forEach((station, index) => {
        if (index === originIndex) return; // drawn as the origin ring instead
        const value = minutes[index];
        marks.push({
            position: [station.lon, station.lat],
            fill: !revealed ? UNREVEALED.rgb : value === null ? NO_ROUTE.rgb : bandFor(value).rgb,
            hollow: revealed && value === null
        });
    });
    return marks;
}

function rgbaToCss([r, g, b]: Rgb, alpha: number) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setLayerOpacity(map: ReturnType<MapRef['getMap']>, opacity: number) {
    map.setPaintProperty(STATIONS_LAYER_ID, 'circle-opacity', opacity);
    map.setPaintProperty(STATIONS_LAYER_ID, 'circle-stroke-opacity', opacity);
    map.setPaintProperty(ORIGIN_LAYER_ID, 'circle-stroke-opacity', opacity);
}
