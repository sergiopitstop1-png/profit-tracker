

import ProfitTrackerClient from "../components/ProfitTrackerClient";

export default async function ProfitTrackerPage() {


  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
   
  }

  return <ProfitTrackerClient />;
}
