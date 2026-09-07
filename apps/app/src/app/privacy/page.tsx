import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — AriTrips" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: August 2026.</p>

      <p>
        This policy covers AriTrips across aritrips.com and app.aritrips.com. AriTrips helps you find
        travel destinations that fit a budget you set, and links you to third-party partners to book
        flights, hotels, activities, insurance, and eSIMs.
      </p>

      <h2>What we collect</h2>
      <p>
        When you use the search tool, we process what you enter — origin, budget, travel dates,
        number of travelers, and interests — to compute recommendations.
      </p>
      <p>
        We also store a record of each search and which destinations it showed and which ones you
        clicked, so we can measure and improve how well recommendations work. This record is a
        randomly generated search ID, your origin airport, your budget, and the destinations/rankings
        involved — it is not linked to your name, email, or any account, even if you&apos;re signed
        in.
      </p>
      <p>
        If you sign in with Google, we store your name, email address, and profile picture as they
        come from your Google account, and whatever trips or deals you choose to save as favorites.
        This is only used to show you your own favorites when you sign in again — we don&apos;t use
        it for anything else, and it&apos;s never linked to the anonymous search records described
        above.
      </p>
      <p>
        Our hosting provider (Cloudflare) processes standard web request data (like IP address and
        browser type) as part of normal operation, the same as any website.
      </p>

      <h2>Cookies and advertising</h2>
      <p>
        aritrips.com is enrolled in Google AdSense to show ads. Google and its advertising partners
        may use cookies to serve ads and measure their performance, including based on your visits to
        this and other sites. If you&apos;re in the EEA, UK, or Switzerland, you&apos;ll see a consent
        prompt before any of that happens. Anywhere, you can review and control ad personalization at{" "}
        <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">
          adssettings.google.com
        </a>
        . The search tool itself, at app.aritrips.com, does not set advertising cookies.
      </p>

      <h2>What we don&apos;t collect</h2>
      <ul>
        <li>No passwords — signing in only works through Google, we never see or store one</li>
        <li>No payment information — we never process bookings or payments directly</li>
        <li>Signing in is optional — you can search and browse the whole site without an account</li>
      </ul>

      <h2>Delete your account</h2>
      <p>
        If you&apos;ve signed in with Google, you can permanently delete your profile and every
        favorite you&apos;ve saved at any time from the{" "}
        <Link href="/account">My Profile</Link> page — look for &quot;Delete account&quot; at
        the bottom. It takes effect immediately and can&apos;t be undone. This removes everything
        tied to your account; it doesn&apos;t touch the anonymous search records described above,
        since those were never linked to you in the first place.
      </p>

      <h2>Third-party links</h2>
      <p>
        Some links on this site are affiliate links to travel partners (flights, hotels, activities,
        insurance, eSIM providers). When you click through, you leave our site and that partner&apos;s
        own privacy policy applies. Some of those links carry our internal search ID as a tracking
        parameter so the partner can attribute the referral to us — it doesn&apos;t carry any personal
        information. We don&apos;t control or receive data about what you do on the partner&apos;s
        site beyond, eventually, whether a booking was made, for affiliate commission purposes.
      </p>

      <h2>Changes</h2>
      <p>
        As the product grows (price alerts, more ways to personalize a search), we&apos;ll update
        this page to reflect what we actually do, and update the date above when we do.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy:{" "}
        <a href="mailto:hello@aritrips.com">hello@aritrips.com</a>.
      </p>
    </LegalPage>
  );
}
