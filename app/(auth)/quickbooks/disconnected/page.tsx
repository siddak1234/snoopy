import { Button } from "@/components/ui/Button";

/**
 * QuickBooks' Disconnect page (backend §12.1 #252, S1-8): where Intuit sends a
 * person who disconnected Autom8x in QuickBooks — the owner sets this page as
 * the app's Disconnect URL. Static: it reads nothing, so it is drawn with no
 * backend too. Reconnect QuickBooks opens Connections, where its row says
 * "Disconnected in QuickBooks" with Reconnect (a visitor signs in first).
 */
export default function QuickBooksDisconnectedPage() {
  return (
    <section className="bubble p-6 text-center sm:p-8">
      <h1 className="text-2xl font-medium sm:text-3xl">
        QuickBooks is disconnected
      </h1>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button href="/account/connections" prefetch={false}>
          Reconnect QuickBooks
        </Button>
      </div>
    </section>
  );
}
