// Same palette as the poster figures (poster/analysis/make_poster_figures.py), validated for
// colour-blind separation and contrast on a dark surface. Brightest = closest, so what you can
// reach "glows"; everything past the threshold drops to a dim grey.
export type Rgb = [number, number, number];

export type TravelBand = {
    maxMin: number;
    label: string;
    hex: string;
    rgb: Rgb;
};

export const TRAVEL_BANDS: TravelBand[] = [
    { maxMin: 15, label: '≤15 min', hex: '#cde2fb', rgb: [205, 226, 251] },
    { maxMin: 30, label: '15–30', hex: '#86b6ef', rgb: [134, 182, 239] },
    { maxMin: 45, label: '30–45', hex: '#3987e5', rgb: [57, 135, 229] },
    { maxMin: Number.POSITIVE_INFINITY, label: 'over 45', hex: '#4a4c5c', rgb: [74, 76, 92] }
];

// Station colour before a half is revealed: visible network, no travel-time information.
export const UNREVEALED = { hex: '#8a8984', rgb: [138, 137, 132] as Rgb };
// Stations the planner found no route to: shown as hollow rings in the same muted grey.
export const NO_ROUTE = UNREVEALED;
export const ORIGIN_RING = { hex: '#f0efec', rgb: [240, 239, 236] as Rgb };

export function bandFor(minutes: number) {
    return (
        TRAVEL_BANDS.find((band) => minutes <= band.maxMin) ?? TRAVEL_BANDS[TRAVEL_BANDS.length - 1]
    );
}
