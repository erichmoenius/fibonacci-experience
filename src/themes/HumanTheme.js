import { DevelopmentTheme } from "./DevelopmentTheme.js";

export class HumanTheme extends DevelopmentTheme {
  constructor(container, gui) {
    super(container, {
      name: "HumanTheme",
      label: "5 - HUMAN",
      color: 0xff8a4c,
    });
  }
}
