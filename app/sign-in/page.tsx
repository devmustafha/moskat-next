import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { SignInForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next) ?? "/account";
  if (await getSession()) redirect(next);

  return (
    <AuthPage
      title="Sign in"
      description="Patients, doctors and hospital staff all sign in here."
      footer={
        <>
          New patient?{" "}
          <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="link">
            Create an account
          </Link>
          . You can also book a consultation without one.
        </>
      }
    >
      <SignInForm next={next} />
    </AuthPage>
  );
}
