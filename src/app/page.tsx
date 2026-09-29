import { createClient } from "@/lib/supabase/server";
import ProspectingApp from "@/components/ProspectingApp";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <ProspectingApp userEmail={user?.email ?? ""} />;
}
