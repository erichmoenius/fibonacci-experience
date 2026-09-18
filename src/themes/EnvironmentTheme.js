import { DevelopmentTheme } from "./DevelopmentTheme.js";

export class EnvironmentTheme extends DevelopmentTheme {
  constructor(container, gui) {
    super(container, {
      name: "EnvironmentTheme",
      label: "4 - ENVIRONMENT",
      color: 0x45d483,
    });
  }
}
