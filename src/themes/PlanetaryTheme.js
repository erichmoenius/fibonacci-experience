import { DevelopmentTheme } from "./DevelopmentTheme.js";

export class PlanetaryTheme extends DevelopmentTheme {
  constructor(container, gui) {
    super(container, {
      name: "PlanetaryTheme",
      label: "3 - OUR WORLD",
      color: 0x3d8bff,
    });
  }
}
