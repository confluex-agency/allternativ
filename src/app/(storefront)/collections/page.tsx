import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLiveCollections } from "@/lib/catalog";

// The shop's front door (section 02: "COLLECTIONS is the main ecommerce entry
// point"). `/products` and `/catalogo` redirect here.
//
// With one drop live, an index would be a page holding a single card and one
// wasted click, so it forwards straight to that drop. It does NOT hardcode
// that: the moment a second collection goes live the list below takes over on
// its own. Sending everyone to the first drop forever is the kind of shortcut
// that quietly hides Collection 02 on launch day.

// Rendered per request rather than at build time, for the reason spelled out
// on the home page: Hostinger's build container cannot reach the database.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Collections",
};

export default async function CollectionsPage() {
  const collections = await getLiveCollections();

  if (collections.length === 0) notFound();
  if (collections.length === 1) redirect(`/collections/${collections[0].slug}`);

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-6 md:py-20 lg:px-12 lg:py-32">
      <p className="eyebrow text-brand-muted mb-3 md:mb-4">collections</p>
      <h1 className="display text-[clamp(2.25rem,8vw,5rem)] text-brand-ink">
        Every drop.
      </h1>

      <ul className="mt-10 grid gap-4 md:mt-16 md:grid-cols-2 md:gap-6">
        {collections.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/collections/${c.slug}`}
              className="glass group flex min-h-32 items-end rounded-[1.5rem] p-8 fluid-transition hover:-translate-y-1 md:rounded-[2rem] md:p-10"
            >
              <h2 className="display text-2xl text-brand-ink md:text-4xl">
                {c.name}
              </h2>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
