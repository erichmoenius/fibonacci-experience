import { DevelopmentTheme } from "./DevelopmentTheme.js";

export class GalaxyTheme extends DevelopmentTheme {
  constructor(container, gui) {
    super(container, {
      name: "GalaxyTheme",
      label: "2 - SPIRAL GALAXY",
      color: 0xa66cff,
    });
  }
}
