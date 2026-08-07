import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — AriTrips" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>Last updated: August 2026.</p>

      <h2>What this is</h2>
      <p>
        AriTrips helps you discover destinations that fit a budget you set, and points
        you to third-party partners to book flights, hotels, activities, insurance, and eSIMs. We are
        not a travel agency, we do not sell tickets, and we do not process payments — every booking
        happens on the partner&apos;s own site, under their own terms.
      </p>

      <h2>Estimates, not quotes</h2>
      <p>
        Costs shown (flight, hotel, activities, total) are <strong>estimates</strong> based on our own
        curated data, not live prices. The actual price you find on a partner site may be higher or
        lower. We do our best to keep estimates reasonable, but they are not a guarantee or a quote.
      </p>

      <h2>Affiliate relationships</h2>
      <p>
        Links to partner sites may be affiliate links. We may earn a commission if you book through
        them, at no extra cost to you. This doesn&apos;t change what you pay, and it doesn&apos;t
        change which destinations we surface — recommendations are based on our scoring model, not on
        which partner pays the highest commission.
      </p>

      <h2>No warranty</h2>
      <p>
        The service is provided &quot;as is,&quot; without warranty of any kind, during this MVP
        stage. We&apos;re a small, early-stage product — treat it accordingly.
      </p>

      <h2>Changes</h2>
      <p>These terms will be replaced with a version reviewed by a lawyer before real launch.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:helloari.trip@gmail.com">helloari.trip@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
