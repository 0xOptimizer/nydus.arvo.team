import { signIn } from "@/auth"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/")

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-sm border border-border bg-card shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="font-bold text-foreground tracking-tight uppercase flex items-baseline gap-1">
            Nydus <span className="text-muted-foreground text-xs">.arvo.team</span>
          </div>
          <i className="fa-solid fa-circle text-primary text-xs animate-pulse"></i>
        </div>

        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="space-y-2">
            <h1 className="text-xl text-center font-bold text-foreground uppercase tracking-wide">
              Authentication Required
            </h1>
            <p className="text-sm text-center text-muted-foreground">
              Please login with your Discord account connected to Arvo.
            </p>
            <p className="text-sm text-center text-muted-foreground">
              Nydus uses Discord accounts for authentication.
            </p>
          </div>

          <div className="h-px w-full bg-border"></div>

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
              <span>Authenticate via Discord</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
