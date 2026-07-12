import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import { PublicScheduleView } from "./PublicScheduleView";

export default function BookingSchedulePage() {
  return (
    <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
      <SiteHeader />
      <main className="max-w-6xl mx-auto mt-16 space-y-6">
        <Link
          href="/booking"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to booking
        </Link>
        <PublicScheduleView />
      </main>
    </div>
  );
}
