import Link from "next/link"
import { AlertTriangle, ArrowLeft } from "lucide-react"

import type { LegalOperator } from "../../lib/legal-operator"
import { LEGAL_OPERATOR_ENV_KEYS } from "../../lib/legal-operator"

type LegalKind = "privacy" | "terms" | "imprint"

const pageCopy = {
  privacy: {
    eyebrow: "Rechtliches",
    title: "Datenschutzhinweise",
    description: "Welche Daten SitePitch je nach verwendeter Funktion verarbeitet und wo betriebliche Angaben ergänzt werden müssen.",
  },
  terms: {
    eyebrow: "Rechtliches",
    title: "Nutzungsbedingungen",
    description: "Produktgrenzen und Verantwortlichkeiten bei Audits, Reports und Outreach-Entwürfen.",
  },
  imprint: {
    eyebrow: "Rechtliches",
    title: "Impressum",
    description: "Zentrale Betreiber- und Kontaktangaben für dieses SitePitch-Angebot.",
  },
} as const

function MissingOperatorNotice() {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />Betreiberangaben fehlen</div>
      <p className="mt-2 text-sm leading-6">
        Vor Veröffentlichung müssen die zentralen Variablen {LEGAL_OPERATOR_ENV_KEYS.join(", ")} vollständig gesetzt werden. SitePitch zeigt bewusst keine erfundenen Platzhalterdaten.
      </p>
    </div>
  )
}

function OperatorDetails({ operator }: { operator: LegalOperator | null }) {
  if (!operator) return <MissingOperatorNotice />
  return (
    <address className="not-italic leading-7">
      <strong>{operator.name}</strong><br />
      <span className="whitespace-pre-line">{operator.address}</span><br />
      <a href={`mailto:${operator.email}`} className="text-primary underline-offset-4 hover:underline">{operator.email}</a>
    </address>
  )
}

function PrivacyContent({ operator }: { operator: LegalOperator | null }) {
  return (
    <>
      <section aria-labelledby="privacy-responsible">
        <h2 id="privacy-responsible">Verantwortliche Stelle</h2>
        <OperatorDetails operator={operator} />
      </section>
      <section aria-labelledby="privacy-scope">
        <h2 id="privacy-scope">Produkt- und Datenumfang</h2>
        <p>
          SitePitch verarbeitet Account- und Workspace-Daten, eingegebene Website-URLs, Audit-Ergebnisse, Report-Inhalte, Credit- und Abrechnungsstatus sowie betriebliche Ereignisse, soweit die jeweils verwendete Funktion dies erfordert.
        </p>
        <p>
          Öffentlich geteilte Reports können vom Workspace-Inhaber deaktiviert oder zusätzlich geschützt werden. Die statischen Beispielreports unter <Link href="/examples">/examples</Link> verwenden fiktive Unternehmensdaten und rufen keine Audit-Anbieter auf.
        </p>
      </section>
      <section aria-labelledby="privacy-providers">
        <h2 id="privacy-providers">Anbieter und Empfänger</h2>
        <p>
          Je nach Konfiguration können Hosting-, Datenbank-, Audit-, KI-, Monitoring- und Zahlungs-Anbieter Daten erhalten, die für die konkrete Funktion erforderlich sind. Die tatsächlich eingesetzten Anbieter, Verarbeitungsorte, Auftragsverarbeitungsverträge und Rechtsgrundlagen müssen vom Betreiber vor Veröffentlichung vollständig dokumentiert werden.
        </p>
      </section>
      <section aria-labelledby="privacy-demo">
        <h2 id="privacy-demo">Öffentlicher Demo-Audit</h2>
        <p>
          Der Demo-Flow erfasst die eingegebene URL, ein Turnstile-Prüfergebnis und begrenzte Missbrauchsschutz-Signale. Er ist auf einen Versuch pro IP und Tag sowie ein globales Tageslimit ausgelegt. Solange die Demo-API nicht verbunden ist, wird kein erfolgreicher Audit vorgetäuscht.
        </p>
      </section>
      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">Speicherung, Löschung und Rechte</h2>
        <p>
          Aufbewahrungsfristen richten sich nach Datentyp, Workspace-Einstellungen sowie gesetzlichen und abrechnungsbezogenen Pflichten. Betroffene Personen können sich für Auskunft, Berichtigung, Löschung, Einschränkung oder Widerspruch an die oben konfigurierte Kontaktadresse wenden.
        </p>
      </section>
      <aside>
        Diese Seite beschreibt Produktgrenzen und ersetzt keine Rechtsberatung. Der Betreiber muss die Hinweise für den tatsächlichen Betrieb, die eingesetzten Anbieter und die geltenden Rechtsgrundlagen prüfen lassen.
      </aside>
    </>
  )
}

function TermsContent({ operator }: { operator: LegalOperator | null }) {
  return (
    <>
      <section aria-labelledby="terms-provider">
        <h2 id="terms-provider">Anbieter und Geltungsbereich</h2>
        <OperatorDetails operator={operator} />
        <p>Diese Bedingungen beschreiben die Nutzung von SitePitch für Website-Audits, Reports, Lead-Arbeit und Outreach-Entwürfe.</p>
      </section>
      <section aria-labelledby="terms-output">
        <h2 id="terms-output">Audits und generierte Inhalte</h2>
        <p>
          Scores, Findings und Textentwürfe sind Arbeitsgrundlagen. Sie können unvollständig oder fehlerhaft sein und müssen vor externer Verwendung fachlich geprüft werden. SitePitch garantiert weder Antwortquoten noch Kundengewinne oder bestimmte Website-Ergebnisse.
        </p>
      </section>
      <section aria-labelledby="terms-outreach">
        <h2 id="terms-outreach">Kontaktaufnahme und Outreach</h2>
        <p>
          SitePitch bietet im MVP keine automatische Massenversendung. Nutzer sind selbst für Auswahl, Prüfung und Versand einer Ansprache sowie für die rechtmäßige Kontaktaufnahme, erforderliche Einwilligungen und Widerspruchsmöglichkeiten verantwortlich. SitePitch gibt keine Compliance-Garantie.
        </p>
      </section>
      <section aria-labelledby="terms-credits">
        <h2 id="terms-credits">Credits und Abrechnung</h2>
        <p>
          Ein erfolgreich abgeschlossener Audit verbraucht einen Credit. Eine sofort ungültige URL verbraucht keinen Credit; fehlgeschlagene Läufe werden nach der im Produkt ausgewiesenen Regel behandelt. Checkout, Abo-Verwaltung und Extra-Credits werden im geschützten Workspace angeboten.
        </p>
      </section>
      <section aria-labelledby="terms-use">
        <h2 id="terms-use">Zulässige Nutzung</h2>
        <p>
          Missbrauch, Umgehung von Rate Limits, unerlaubtes Scannen, rechtswidrige Inhalte und eine Nutzung gegen Rechte Dritter sind nicht gestattet. Nutzer dürfen nur Websites und Daten verarbeiten, für die eine rechtmäßige Grundlage besteht.
        </p>
      </section>
      <aside>Diese Produktinformation ist keine Rechtsberatung und ersetzt keine auf den konkreten Einsatz zugeschnittenen Bedingungen.</aside>
    </>
  )
}

function ImprintContent({ operator }: { operator: LegalOperator | null }) {
  return (
    <>
      <section aria-labelledby="imprint-operator">
        <h2 id="imprint-operator">Betreiberangaben</h2>
        <OperatorDetails operator={operator} />
      </section>
      <section aria-labelledby="imprint-contact">
        <h2 id="imprint-contact">Kontakt</h2>
        <p>
          Die verantwortliche Kontaktadresse wird ausschließlich aus der zentralen Betreiber-Konfiguration übernommen. Rechtsform, Vertretungsberechtigte, Register-, Umsatzsteuer- und Aufsichtsangaben müssen ergänzt werden, falls sie für den tatsächlichen Betreiber zutreffen.
        </p>
      </section>
      <aside>Es werden bewusst keine Musterperson, Musteranschrift oder sonstige nicht bestätigte Betreiberdetails angezeigt.</aside>
    </>
  )
}

export function LegalArticle({ kind, operator }: { kind: LegalKind; operator: LegalOperator | null }) {
  const copy = pageCopy[kind]
  return (
    <article data-registry-block="blogpost3" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zur Startseite
      </Link>
      <header className="mt-10 max-w-3xl border-b pb-10">
        <p className="text-sm font-semibold text-primary">{copy.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{copy.title}</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">{copy.description}</p>
        <p className="mt-4 text-sm text-muted-foreground">Stand: 16. Juli 2026</p>
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-10 [&_a]:text-primary [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:max-w-3xl [&_p]:leading-7 [&_p]:text-muted-foreground [&_section]:scroll-mt-24 [&_aside]:rounded-lg [&_aside]:border [&_aside]:bg-muted/30 [&_aside]:p-5 [&_aside]:text-sm [&_aside]:leading-6">
          {kind === "privacy" ? <PrivacyContent operator={operator} /> : null}
          {kind === "terms" ? <TermsContent operator={operator} /> : null}
          {kind === "imprint" ? <ImprintContent operator={operator} /> : null}
        </div>
        <nav aria-label="Rechtliche Seiten" className="h-fit border-t pt-4 lg:sticky lg:top-24">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Weitere Seiten</p>
          <ul className="mt-3 grid gap-2 text-sm">
            <li><Link href="/privacy" className="hover:underline">Datenschutz</Link></li>
            <li><Link href="/terms" className="hover:underline">Nutzungsbedingungen</Link></li>
            <li><Link href="/imprint" className="hover:underline">Impressum</Link></li>
          </ul>
        </nav>
      </div>
    </article>
  )
}
