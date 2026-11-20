import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create a patient account",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string }> };

/** Public sign-up always creates a patient account; doctors and staff get accounts from an admin. */
export default async function SignUpPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next) ?? "/account";
  if (await getSession()) redirect(next);

  return (
    <AuthPage
      title="Create a patient account"
      description="See your bookings in one place. We only ask for your name and email."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="link">
            Sign in
          </Link>
          . Doctors and hospital staff are given accounts by the hospital.
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthPage>
  );
}
