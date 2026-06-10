"use client";

import { useCallback, useEffect, useState } from "react";
import { propertyManagementExtension } from "@/extensions/property-management/extension";
import {
  PROPERTY_MANAGEMENT_DEPARTMENTS,
  type PropertyManagementDepartmentId,
} from "@/extensions/property-management/types";

export const PM_ACTIVE_DEPARTMENT_STORAGE_KEY = "echo-mirage-pm-department-v1";

export const PM_DEPARTMENT_CHANGE_EVENT = "echo-mirage:pm-department-change";

function readStoredDepartment(): PropertyManagementDepartmentId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PM_ACTIVE_DEPARTMENT_STORAGE_KEY);
    if (
      raw &&
      (PROPERTY_MANAGEMENT_DEPARTMENTS as readonly string[]).includes(raw)
    ) {
      return raw as PropertyManagementDepartmentId;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function persistActiveDepartment(id: PropertyManagementDepartmentId) {
  try {
    window.localStorage.setItem(PM_ACTIVE_DEPARTMENT_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent<PropertyManagementDepartmentId>(PM_DEPARTMENT_CHANGE_EVENT, {
      detail: id,
    }),
  );
}

export function useActiveDepartment(
  initial: PropertyManagementDepartmentId = propertyManagementExtension.defaultDepartment,
) {
  const [activeDepartment, setActiveDepartment] = useState<PropertyManagementDepartmentId>(
    () => readStoredDepartment() ?? initial,
  );

  useEffect(() => {
    const onDepartmentChange = (event: Event) => {
      const detail = (event as CustomEvent<PropertyManagementDepartmentId>).detail;
      if (detail) setActiveDepartment(detail);
    };
    window.addEventListener(PM_DEPARTMENT_CHANGE_EVENT, onDepartmentChange);
    return () => window.removeEventListener(PM_DEPARTMENT_CHANGE_EVENT, onDepartmentChange);
  }, []);

  const selectDepartment = useCallback((id: PropertyManagementDepartmentId) => {
    setActiveDepartment(id);
    persistActiveDepartment(id);
  }, []);

  return { activeDepartment, selectDepartment };
}
