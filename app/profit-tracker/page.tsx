import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase-server";
import ProfitTrackerClient from "../components/ProfitTrackerClient";

export default async function ProfitTrackerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <ProfitTrackerClient />;
}