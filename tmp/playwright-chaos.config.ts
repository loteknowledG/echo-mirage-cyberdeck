import base from "../playwright.config";

export default {
  ...base,
  testDir: ".",
  testMatch: /chaos-property-manager\.spec\.ts$/,
};
