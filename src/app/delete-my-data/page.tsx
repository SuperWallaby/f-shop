import Link from "next/link";
import { DeleteMyDataForm } from "./DeleteMyDataForm";

export const metadata = {
  title: "Delete My Data | Faséa Pilates",
  description:
    "Request deletion of your personal data from Faséa Pilates Studio website and mobile app.",
};

export default function DeleteMyDataPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F6] text-[#2C2A27]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-[#716D64] mb-3">
          Privacy
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
          Delete my data
        </h1>
        <p className="text-sm sm:text-base leading-relaxed text-[#5C574F] mb-8">
          Use this form to request deletion of personal information we hold about
          you on <strong className="text-[#2C2A27]">fasea.studio</strong> and
          the <strong className="text-[#2C2A27]">Faséa</strong> mobile app. We
          may contact you to verify your identity before processing the request.
        </p>

        <section className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-6 sm:p-8 mb-8">
          <h2 className="font-serif text-xl font-semibold mb-3">What we delete</h2>
          <ul className="text-sm sm:text-base leading-relaxed text-[#5C574F] list-disc pl-5 space-y-2">
            <li>Member account profile (name, email, WhatsApp)</li>
            <li>App push notification tokens and marketing preferences</li>
            <li>Sign-in links (Google / Apple identifiers) where applicable</li>
          </ul>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#5C574F]">
            Some booking, payment, or accounting records may be retained where
            required by law. See our{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-[#A66A4A]"
            >
              Privacy Policy
            </Link>{" "}
            for details.
          </p>
        </section>

        <DeleteMyDataForm />
      </div>
    </main>
  );
}
