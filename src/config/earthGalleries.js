// One destination record per EARTH satellite. Only SPHERICAL is implemented;
// plannedLayout documents future personalities without selecting them today.
export const EARTH_GALLERIES = Object.freeze([
  { number: 1, id: "cities", name: "Cities", content: "cities", plannedLayout: "SPHERICAL", radiusControl: true },
  { number: 2, id: "countries", name: "Countries", content: "placeholders", plannedLayout: "CUBE" },
  { number: 3, id: "water", name: "Water", content: "placeholders", plannedLayout: "IMMERSIVE_SPHERE" },
  { number: 4, id: "animals", name: "Animals", content: "placeholders", plannedLayout: "SPIRAL" },
  { number: 5, id: "events", name: "Events", content: "placeholders", plannedLayout: "TIMELINE_TUNNEL" },
  { number: 6, id: "ethnicity", name: "Ethnicity", content: "placeholders", plannedLayout: "CONSTELLATION" },
].map(config => Object.freeze({ layout: "SPHERICAL", radiusControl: false, ...config })));
