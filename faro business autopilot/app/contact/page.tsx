import { LeadForm } from "./lead-form";

export default function ContactPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Get in touch</h1>
        <p className="mt-1 text-sm text-black/60">
          Tell us about your business and we&apos;ll follow up with the right next step.
        </p>
      </div>
      <LeadForm />
    </main>
  );
}
