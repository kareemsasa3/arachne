import Link from "next/link";
import ChatExperience from "@/components/ChatExperience";
import AiBackendStatus from "@/components/AiBackendStatus";
import ArachneStatus from "@/components/ArachneStatus";
import ArachneLogo from "@/components/ArachneLogo";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <section className="space-y-6 text-center pt-48 pb-24">
          <div className="space-y-3">
            <ArachneLogo className="drop-shadow-sm mx-auto w-full max-w-[420px]" />
            <p className="text-lg text-gray-600 dark:text-gray-200">
              Launch scrapes with Arachne, summarize results, and chat with an
              assistant that speaks web data.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/chat"
              className="px-5 py-3 rounded-lg bg-blue-600 text-white font-medium shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
            >
              Open full chat
            </Link>
            <Link
              href="/jobs"
              className="px-5 py-3 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 font-medium hover:bg-blue-100 hover:border-blue-300 transition-colors dark:border-blue-400/60 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/25"
            >
              Start a scrape
            </Link>
            <Link
              href="/history"
              className="px-5 py-3 rounded-lg border border-gray-200 text-gray-800 bg-white font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors dark:border-white/20 dark:text-gray-100 dark:bg-white/10 dark:hover:bg-white/15"
            >
              View history
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <ArachneStatus />
            <AiBackendStatus />
          </div>
        </section>

        <section className="space-y-6 text-center pt-24 pb-24">
          <div className="text-center space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">
              Capabilities
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white drop-shadow-sm">
              What Arachne does best
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-gray-200/80 bg-white/90 backdrop-blur shadow-sm hover:-translate-y-0.5 transition-transform dark:border-white/20 dark:bg-white/5">
              <h3 className="text-lg text-center font-semibold text-gray-900 mb-1 dark:text-white">
                Guided jobs
              </h3>
              <p className="text-sm text-center text-gray-600 dark:text-gray-200">
                Kick off scraping runs with URLs and structured targets.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-gray-200/80 bg-white/90 backdrop-blur shadow-sm hover:-translate-y-0.5 transition-transform dark:border-white/20 dark:bg-white/5">
              <h3 className="text-lg text-center font-semibold text-gray-900 mb-1 dark:text-white">
                Memory-aware
              </h3>
              <p className="text-sm text-center text-gray-600 dark:text-gray-200">
                Query and summarize your stored snapshots instantly.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-gray-200/80 bg-white/90 backdrop-blur shadow-sm hover:-translate-y-0.5 transition-transform dark:border-white/20 dark:bg-white/5">
              <h3 className="text-lg text-center font-semibold text-gray-900 mb-1 dark:text-white">
                JSON extraction
              </h3>
              <p className="text-sm text-center text-gray-600 dark:text-gray-200">
                Ask for structured fields and receive ready-to-use JSON.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-gray-200/80 bg-white/90 backdrop-blur shadow-sm hover:-translate-y-0.5 transition-transform dark:border-white/20 dark:bg-white/5">
              <h3 className="text-lg text-center font-semibold text-gray-900 mb-1 dark:text-white">
                Human-friendly
              </h3>
              <p className="text-sm text-center text-gray-600 dark:text-gray-200">
                Chat-first interface with history, jobs, and quick prompts.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 text-center pt-24 pb-24">
          <div className="text-center space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">
              Overview
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white drop-shadow-sm">
              Stay on top of your work
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-gray-200 bg-white/80 shadow-sm dark:border-white/15 dark:bg-white/5">
              <p className="text-sm text-gray-500 uppercase tracking-[0.2em] dark:text-gray-200">
                Status
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                Live backend
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-200">
                Arachne API connected
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-white/80 shadow-sm dark:border-white/15 dark:bg-white/5">
              <p className="text-sm text-gray-500 uppercase tracking-[0.2em] dark:text-gray-200">
                History
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                Browse snapshots
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-200">
                Resume, rescrape, or export
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-white/80 shadow-sm dark:border-white/15 dark:bg-white/5">
              <p className="text-sm text-gray-500 uppercase tracking-[0.2em] dark:text-gray-200">
                Chat
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                Ask the assistant
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-200">
                Crawl, summarize, extract
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6 text-center pt-24">
          <div className="text-center space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">
              Try it now
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white drop-shadow-sm">
              Quick start
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ask me to scrape a URL, summarize a page, or pull structured data.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/70 bg-gradient-to-b from-white to-gray-50/80 p-4 shadow-sm sm:p-8 dark:border-white/10 dark:from-white/5 dark:to-white/0">
            <div className="mx-auto">
              <ChatExperience variant="home" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
