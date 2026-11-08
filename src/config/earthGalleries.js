// Owner-approved HOME values; independent user presets remain separate.
export const CITIES_HOME = Object.freeze({ pictureSize: 102, gap: 12, radius: 0 });
export const COUNTRIES_HOME = Object.freeze({ pictureSize: 93, gap: -4, radius: 0 });
export const WATER_HOME = Object.freeze({ pictureSize: 150, gap: -50, radius: 5 });
export const ANIMALS_HOME = Object.freeze({ pictureSize: 150, gap: -22, radius: 1.8 });
export const EVENTS_HOME = Object.freeze({ pictureSize: 150, gap: -22, radius: 1.1 });
export const ETHNICITY_HOME = Object.freeze({ pictureSize: 150, gap: 9, radius: -3.3 });
export const PLANTS_HOME = Object.freeze({ pictureSize: 150, gap: 2, radius: -3.3 });

// One destination record per Earth satellite, with an independent active geometry.
export const EARTH_GALLERIES = Object.freeze([
  { number: 1, id: "cities", name: "Cities", content: "cities", home: CITIES_HOME, plannedLayout: "SPHERICAL", radiusControl: true },
  { number: 2, id: "countries", name: "Countries", content: "countries", home: COUNTRIES_HOME, layout: "CUBE", plannedLayout: "CUBE", radiusControl: false },
  { number: 3, id: "water", name: "Water", content: "water", home: WATER_HOME, layout: "IMMERSIVE_SPHERE", plannedLayout: "IMMERSIVE_SPHERE" },
  { number: 4, id: "animals", name: "Animals", content: "animals", home: ANIMALS_HOME, layout: "SPIRAL", plannedLayout: "SPIRAL", radiusControl: false },
  { number: 5, id: "events", name: "Events", content: "events", home: EVENTS_HOME, layout: "TIMELINE_TUNNEL", plannedLayout: "TIMELINE_TUNNEL", radiusControl: false },
  { number: 6, id: "ethnicity", name: "Ethnicity", content: "ethnicity", home: ETHNICITY_HOME, layout: "CONSTELLATION", plannedLayout: "CONSTELLATION", radiusControl: false },
  { number: 7, id: "plants", name: "Plants", content: "plants", home: PLANTS_HOME, layout: "PHYLLOTAXIS", plannedLayout: "PHYLLOTAXIS", radiusControl: false },
].map(config => Object.freeze({ layout: "SPHERICAL", radiusControl: true, ...config })));
