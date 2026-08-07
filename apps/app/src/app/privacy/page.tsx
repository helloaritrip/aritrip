import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — AriTrips" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: August 2026.</p>

      <h2>What we collect</h2>
      <p>
        When you use the search form, we process what you enter — origin, budget, travel dates,
        number of travelers, and interests — to compute recommendations. As of today, this
        information is <strong>not stored in a database</strong>: it&apos;s used in memory to answer
        your request and then discarded. That will change once we connect a real database, and this
        policy will be updated when it does.
      </p>
      <p>
        Our hosting provider (Cloudflare) processes standard web request data (like IP address and
        browser type) as part of normal operation, the same as any website.
      </p>

      <h2>What we don&apos;t collect (yet)</h2>
      <ul>
        <li>No account creation, no passwords</li>
        <li>No payment information — we never process bookings or payments directly</li>
        <li>No tracking cookies at this stage</li>
      </ul>

      <h2>Third-party links</h2>
      <p>
        Some links on this site are affiliate links to travel partners (flights, hotels, activities,
        insurance, eSIM providers). When you click through, you leave our site and that partner&apos;s
        own privacy policy applies — we don&apos;t control or receive data about what you do on their
        site beyond, eventually, whether a booking was made (for affiliate commission purposes, once
        we have approved partner accounts).
      </p>

      <h2>Changes</h2>
      <p>
        As the product grows (accounts, saved searches, price alerts), this policy will be updated to
        reflect what we actually do — not in advance of building it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy:{" "}
        <a href="mailto:helloari.trip@gmail.com">helloari.trip@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
