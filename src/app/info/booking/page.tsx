import Link from "next/link";

export const metadata = {
  title: "Booking reference | Faséa Pilates",
  description:
    "Reference information for booking messages, including what status updates mean and where to find your schedule.",
};

export default function BookingInfoPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F6] text-[#2C2A27]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
          Booking reference
        </h1>
        <p className="text-sm sm:text-base leading-relaxed text-[#5C574F] mb-10">
          This page is referenced from automated WhatsApp booking status messages.
          It provides background information only.
        </p>

        <section className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-6 sm:p-8 mb-8">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-3">
            Status types
          </h2>
          <ul className="space-y-2 text-sm sm:text-base leading-relaxed text-[#5C574F]">
            <li>
              <strong className="text-[#2C2A27]">Booking confirmed</strong>: a
              reservation is recorded for the listed class and time.
            </li>
            <li>
              <strong className="text-[#2C2A27]">Reminder</strong>: an upcoming
              session is scheduled for the listed date and time.
            </li>
            <li>
              <strong className="text-[#2C2A27]">Booking cancelled</strong>: a
              reservation was cancelled.
            </li>
            <li>
              <strong className="text-[#2C2A27]">Class cancelled</strong>: a
              session was cancelled by the studio.
            </li>
            <li>
              <strong className="text-[#2C2A27]">No-show recorded</strong>: a
              session was recorded as not attended.
            </li>
          </ul>
        </section>

        <section className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-6 sm:p-8 mb-10">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-3">
            Schedule link
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-[#5C574F] mb-5">
            The live schedule is maintained externally.
          </p>
          <a
            target="_blank"
            rel="noreferrer"
            href="https://burly-elbow-f4a.notion.site/ebd/1ebcbfc9f2c9803faae2d3168073b0a0"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#2C2A27] text-white text-sm font-medium shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-90"
          >
            Open schedule
          </a>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white/80 border border-[#E8DDD4] text-sm font-medium text-[#2C2A27] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-white"
          >
            Back to home
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white/80 border border-[#E8DDD4] text-sm font-medium text-[#2C2A27] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-white"
          >
            About Faséa
          </Link>
        </div>
      </div>
    </main>
  );
}

