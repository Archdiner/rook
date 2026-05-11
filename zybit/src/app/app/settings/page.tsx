export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { createPhase1Repository } from "@/lib/phase1";
import { getDb } from "@/lib/db/client";
import { zybitSiteMeta } from "@/lib/db/schema";
import SettingsView from "@/components/app/SettingsView";

export default async function SettingsPage() {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  const repository = createPhase1Repository();
  const sites = await repository.listSites({ organizationId: auth.orgId, limit: 1 });
  const site = sites[0] ?? null;

  const integrations = site
    ? await repository.listIntegrations({
        organizationId: auth.orgId,
        siteId: site.id,
        limit: 10,
      })
    : [];

  const db = getDb();
  const metaRows = site
    ? await db.select().from(zybitSiteMeta).where(eq(zybitSiteMeta.siteId, site.id)).limit(1)
    : [];
  const meta = metaRows[0] ?? null;

  return (
    <SettingsView
      site={site}
      integrations={integrations}
      mrrCents={meta?.monthlyRevenueCents ?? null}
      aovCents={meta?.avgOrderValueCents ?? null}
    />
  );
}
