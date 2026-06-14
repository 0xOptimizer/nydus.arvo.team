import { signIn } from "@/auth"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { Section } from "@/components/ui/section"

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/")

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <Section
          title={
            <span className="flex items-baseline gap-1 text-foreground">
              Nydus <span className="text-[10px] text-muted-foreground">.arvo.team</span>
            </span>
          }
          actions={<i className="fa-solid fa-circle animate-pulse text-xs text-primary" />}
        >
          <div className="flex flex-col gap-6">
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-bold uppercase tracking-wide text-foreground">
                Authentication Required
              </h1>
              <p className="text-sm text-muted-foreground">
                Please login with your Discord account connected to Arvo.
              </p>
              <p className="text-sm text-muted-foreground">
                Nydus uses Discord accounts for authentication.
              </p>
            </div>

            <div className="h-px w-full bg-border" />

            <form
              action={async () => {
                "use server"
                await signIn("discord")
              }}
              className="w-full"
            >
              <Button
                type="submit"
                size="lg"
                className="w-full font-semibold uppercase hover:shadow-[0_0_20px_-4px_var(--primary)]"
              >
                <i className="fa-brands fa-discord" />
                <span>Authenticate via Discord</span>
              </Button>
            </form>
          </div>
        </Section>
      </div>
    </div>
  )
}
