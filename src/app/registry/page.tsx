import type { Metadata } from 'next';

import { RegistryShowroom } from './registry-showroom';

export const metadata: Metadata = {
  title: 'Realmorphism Registry',
  description: 'Echo Mirage shadcn registry showroom for the Realmorphism theme.',
};

export default function RegistryPage() {
  return <RegistryShowroom variant="page" />;
}
