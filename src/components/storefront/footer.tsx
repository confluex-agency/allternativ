import Link from "next/link";

export function StorefrontFooter() {
  return (
    <footer className="border-t bg-neutral-950 text-neutral-400">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-sm font-medium text-white mb-4">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="hover:text-white transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/products?type=SUNGLASSES" className="hover:text-white transition-colors">
                  Sunglasses
                </Link>
              </li>
              <li>
                <Link href="/products?type=OPTICAL" className="hover:text-white transition-colors">
                  Optical
                </Link>
              </li>
              <li>
                <Link href="/products?type=BLUE_LIGHT" className="hover:text-white transition-colors">
                  Blue Light
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Contact
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Shipping
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Returns
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  About
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Privacy
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Terms
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white mb-4">Follow</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Instagram
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  TikTok
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-neutral-800 text-xs">
          © {new Date().getFullYear()} Allternativ. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
