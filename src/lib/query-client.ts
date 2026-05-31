import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  onelineArtCatalog: ['oneline-art-catalog'] as const,
  figletFontCatalog: ['figlet-font-catalog'] as const,
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
