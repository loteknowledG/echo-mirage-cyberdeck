import {
  PROPERTY_MANAGEMENT_DEPARTMENTS,
  type PropertyManagementExtensionManifest,
} from "@/extensions/property-management/types";

export const PROPERTY_MANAGEMENT_BANNER_ASCII = [
  "╔══════════════════════════════════════════╗",
  "║  ECHO MIRAGE // PROPERTY MANAGEMENT      ║",
  "║  EXTENSION HOST // DEPARTMENT WORKSPACE   ║",
  "╚══════════════════════════════════════════╝",
].join("\n");

export const propertyManagementExtension: PropertyManagementExtensionManifest = {
  id: "property-management",
  name: "Property Management",
  kind: "app-extension",
  defaultDepartment: "overview",
  departments: PROPERTY_MANAGEMENT_DEPARTMENTS,
  bannerAscii: PROPERTY_MANAGEMENT_BANNER_ASCII,
};

export default propertyManagementExtension;
