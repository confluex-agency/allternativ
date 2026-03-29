import { StorefrontNavbar } from "@/components/storefront/navbar";
import { StorefrontFooter } from "@/components/storefront/footer";
import { TrackerInit } from "@/components/storefront/tracker-init";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StorefrontNavbar />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      <TrackerInit />
    </>
  );
}
