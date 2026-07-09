"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 768px)";

export function useMobileCyberdeckLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches;
  });
  const [mobileContentSplit, setMobileContentSplit] = useState<number[]>([0.58, 0.42]);

  const handleContentSplitSizesChange = useCallback((sizes: number[]) => {
    setMobileContentSplit(sizes);
  }, []);

  const mirageHeaderCollapse = useMemo(() => {
    if (!isMobileLayout || mobileContentSplit.length < 2) return 0;
    const gatewayFraction = mobileContentSplit[1];
    const collapseStart = 0.46;
    const collapseEnd = 0.58;
    if (gatewayFraction <= collapseStart) return 0;
    if (gatewayFraction >= collapseEnd) return 1;
    return (gatewayFraction - collapseStart) / (collapseEnd - collapseStart);
  }, [isMobileLayout, mobileContentSplit]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    const apply = () => setIsMobileLayout(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return {
    isMobileLayout,
    mobileContentSplit,
    handleContentSplitSizesChange,
    mirageHeaderCollapse,
  };
}
