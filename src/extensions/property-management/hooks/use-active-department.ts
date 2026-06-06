"use client";

import { useCallback, useState } from "react";
import { propertyManagementExtension } from "@/extensions/property-management/extension";
import type { PropertyManagementDepartmentId } from "@/extensions/property-management/types";

export function useActiveDepartment(
  initial: PropertyManagementDepartmentId = propertyManagementExtension.defaultDepartment,
) {
  const [activeDepartment, setActiveDepartment] =
    useState<PropertyManagementDepartmentId>(initial);

  const selectDepartment = useCallback((id: PropertyManagementDepartmentId) => {
    setActiveDepartment(id);
  }, []);

  return { activeDepartment, selectDepartment };
}
