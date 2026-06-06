export const PROPERTY_MANAGEMENT_DEPARTMENTS = [
  "overview",
  "properties",
  "maintenance",
  "leasing",
  "accounting",
  "inspections",
  "documents",
  "map",
] as const;

export type PropertyManagementDepartmentId = (typeof PROPERTY_MANAGEMENT_DEPARTMENTS)[number];

export type PropertyManagementExtensionKind = "app-extension";

export type PropertyManagementExtensionManifest = {
  id: "property-management";
  name: string;
  kind: PropertyManagementExtensionKind;
  defaultDepartment: PropertyManagementDepartmentId;
  departments: readonly PropertyManagementDepartmentId[];
  bannerAscii: string;
};

export type DepartmentRailItem = {
  id: PropertyManagementDepartmentId;
  label: string;
  hint: string;
};
