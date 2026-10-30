import { AccountNav } from "@/components/account/account-nav";
import { Container } from "@/components/ui/container";

/**
 * Every account page: the account menu (sidebar from lg, tabs above the page
 * below it) beside the page. Static, so each page streams its own data.
 */
export default function AccountLayout({ children }: LayoutProps<"/[lang]/account">) {
  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
        <AccountNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Container>
  );
}
