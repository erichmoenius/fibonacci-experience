import { DevelopmentTheme } from "./DevelopmentTheme.js";

export class MolecularTheme extends DevelopmentTheme {
  constructor(container, gui) {
    super(container, {
      name: "MolecularTheme",
      label: "6 - MOLECULAR WORLD",
      color: 0x35d9e8,
    });
  }
}
