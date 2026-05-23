"use client";
import ProfitTrackerClient from "../components/ProfitTrackerClient";
import AuthGuard from "../components/AuthGuard";

export default function ProfitTrackerPage() {
  return (
    <AuthGuard>
      <ProfitTrackerClient />
    </AuthGuard>
  );
}
