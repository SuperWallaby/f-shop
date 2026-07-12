import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Faséa Pilates",
  description:
    "How Faséa Pilates Studio collects, uses, and protects personal information on fasea.studio and the Faséa mobile app.",
};

const effectiveDate = "27 June 2026";
const contactEmail = "faseabooking@gmail.com";
const whatsappLink = "https://wa.me/60145403560";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F6] text-[#2C2A27]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-[#716D64] mb-3">
          Legal
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm sm:text-base leading-relaxed text-[#5C574F] mb-10">
          Effective date: {effectiveDate}. This policy applies to{" "}
          <strong className="text-[#2C2A27]">fasea.studio</strong>, our web
          booking experience, and the <strong className="text-[#2C2A27]">Faséa</strong>{" "}
          mobile app for iOS and Android.
        </p>

        <PolicySection title="Who we are">
          <p>
            Faséa Pilates Studio (&ldquo;Faséa&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;) operates a Pilates studio in Kuala Terengganu,
            Malaysia. We use this website and app so members can book classes,
            manage credits, and receive studio updates.
          </p>
        </PolicySection>

        <PolicySection title="Information we collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Account details</strong>: name, email address, and
              WhatsApp number when you sign in, complete your profile, or
              recover an account.
            </li>
            <li>
              <strong>Sign-in identifiers</strong>: if you use Google Sign-In,
              we receive your Google account email and a stable Google user ID
              to link your account. We do not receive your Google password.
            </li>
            <li>
              <strong>Booking and membership data</strong>: class reservations,
              session credits, plan purchases, cancellations, and related
              studio records needed to run bookings.
            </li>
            <li>
              <strong>Push notification tokens</strong>: if you allow
              notifications on the mobile app, we store a device push token
              (via Firebase Cloud Messaging) so we can send booking
              confirmations, class reminders, and—only if you opt in—promotions
              or event updates.
            </li>
            <li>
              <strong>Session data</strong>: a secure session cookie on the
              website to keep you signed in, plus basic server logs (such as
              request time and IP address) for security and troubleshooting.
            </li>
            <li>
              <strong>Website analytics</strong>: on fasea.studio we may use
              Google tags to measure visits and ad conversions. This may
              involve cookies or similar technologies handled by Google.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="How we use information">
          <ul className="list-disc pl-5 space-y-2">
            <li>Create and manage your member account.</li>
            <li>Process class bookings, credits, and cancellations.</li>
            <li>
              Send booking confirmations, reminders, and service messages by
              push notification and/or WhatsApp.
            </li>
            <li>
              Send optional promotional or event updates on your device when you
              enable them in the app.
            </li>
            <li>Respond to support requests and improve our services.</li>
            <li>Protect against fraud, abuse, and technical issues.</li>
          </ul>
        </PolicySection>

        <PolicySection title="How we share information">
          <p className="mb-4">
            We do not sell your personal information. We share data only with
            service providers that help us operate the studio and our systems,
            such as:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Cloud hosting and database providers for our booking platform.</li>
            <li>Google (Sign-In and, on the website, measurement tags).</li>
            <li>Firebase / Google Cloud Messaging for app push notifications.</li>
            <li>WhatsApp messaging providers used to send booking updates.</li>
          </ul>
          <p className="mt-4">
            We may also disclose information if required by law or to protect
            the rights, safety, and property of Faséa, our members, or others.
          </p>
        </PolicySection>

        <PolicySection title="Your choices">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              You can turn off promotional push notifications in the app under{" "}
              <strong>Account → Notifications</strong>. Booking-related alerts
              are sent when notifications are enabled and a device is registered.
            </li>
            <li>
              You can disable push permissions in your phone&apos;s system
              settings at any time.
            </li>
            <li>
              You can sign out of the website or app. To update or delete
              account information, use our{" "}
              <Link
                href="/delete-my-data"
                className="underline underline-offset-4 hover:text-[#A66A4A]"
              >
                data deletion request form
              </Link>{" "}
              or contact us using the details below.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Retention">
          <p>
            We keep account and booking records for as long as needed to provide
            services, meet legal or accounting requirements, and resolve
            disputes. Push tokens are removed when you sign out, unregister a
            device, or when they are no longer valid.
          </p>
        </PolicySection>

        <PolicySection title="Security">
          <p>
            We use reasonable technical and organisational measures to protect
            personal information. No method of transmission or storage is
            completely secure; please use a strong email account and keep your
            device secure.
          </p>
        </PolicySection>

        <PolicySection title="Children">
          <p>
            Our services are not directed to children under 13, and we do not
            knowingly collect personal information from them. Contact us if you
            believe a child has provided us data.
          </p>
        </PolicySection>

        <PolicySection title="International transfers">
          <p>
            Our providers may process data in countries other than Malaysia.
            Where this occurs, we take steps appropriate to the nature of the
            data and the service provided.
          </p>
        </PolicySection>

        <PolicySection title="Changes">
          <p>
            We may update this policy from time to time. We will revise the
            effective date at the top of this page when we do. Continued use of
            our website or app after changes means you accept the updated
            policy.
          </p>
        </PolicySection>

        <PolicySection title="Contact us">
          <p className="mb-4">
            For privacy questions, access requests, data deletion, or
            corrections, contact Faséa Pilates Studio:
          </p>
          <p className="mb-4 text-sm sm:text-base">
            <Link
              href="/delete-my-data"
              className="underline underline-offset-4 hover:text-[#A66A4A]"
            >
              Request deletion of my data
            </Link>
          </p>
          <ul className="space-y-2 text-sm sm:text-base">
            <li>
              WhatsApp:{" "}
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-[#A66A4A]"
              >
                +60 14-540 3560
              </a>
            </li>
            <li>
              Email:{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="underline underline-offset-4 hover:text-[#A66A4A]"
              >
                {contactEmail}
              </a>
            </li>
            <li>
              Website:{" "}
              <a
                href="https://fasea.studio"
                className="underline underline-offset-4 hover:text-[#A66A4A]"
              >
                fasea.studio
              </a>
            </li>
          </ul>
        </PolicySection>

        <div className="flex flex-wrap gap-3 mt-12">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white/80 border border-[#E8DDD4] text-sm font-medium text-[#2C2A27] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-white"
          >
            Back to home
          </Link>
          <Link
            href="/booking"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#2C2A27] text-white text-sm font-medium shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-90"
          >
            Book a class
          </Link>
        </div>
      </div>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-6 sm:p-8 mb-8">
      <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-3">
        {title}
      </h2>
      <div className="text-sm sm:text-base leading-relaxed text-[#5C574F] space-y-3">
        {children}
      </div>
    </section>
  );
}
