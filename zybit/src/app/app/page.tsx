import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { getCockpitData } from "@/lib/dashboard/cockpit";
import CockpitView from "@/components/app/CockpitView";

export default async function CockpitPage() {
  const authResult = await getServerAuth();
  if (!authResult.ok) redirect("/sign-in");

  const data = await getCockpitData(authResult.orgId);

  return <CockpitView data={data} orgId={authResult.orgId} />;
}
