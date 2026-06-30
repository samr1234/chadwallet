import Link from "next/link";
import Image from "next/image";
import TokenTicker from "@/components/TokenTicker";
import AuthButton from "@/components/AuthButton";
import StartTradingButton from "@/components/StartTradingButton";

const features = [
  { tag: "DEPOSITS",    title: "Secure deposits & instant withdrawals",   img: "/images/feat-deposit.png" },
  { tag: "LIVE TRADES", title: "Take the guesswork out of trading",       img: "/images/feat-trades.png"  },
  { tag: "TOP TRADERS", title: "Meet top traders who win consistently",   img: "/images/feat-traders.png" },
];

export default function Home() {
  return (
    <div className="relative isolate flex flex-col min-h-svh bg-[#060510] overflow-x-hidden">

      {/* ── Space background — absolute, full width, at top (NOT fixed) ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/space-bg.webp"
        alt=""
        aria-hidden="true"
        className="absolute top-0 left-0 w-full -z-10 pointer-events-none select-none"
      />

      {/* ── Top ticker ──────────────────────────────────────────────────── */}
      <TokenTicker direction="left" speed={80} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      {/* Desktop */}
      <header className="items-center h-13 pt-3 px-5 justify-between hidden md:flex">
        <Link href="/" className="flex items-center gap-2.5 text-[#eaedff]">
          <Image src="/logo.png" alt="ChadWallet" width={48} height={48} className="rounded-xl" />
          <span className="text-[22px] font-black tracking-tight">
            Chad<span className="text-[#606AF7]">Wallet</span>
          </span>
        </Link>
        <div className="flex gap-2">
          <Link
            href="https://apps.apple.com/us/app/chadwallet/id6757367474"
            target="_blank" rel="noopener noreferrer"
            aria-label="Download on the App Store"
            className="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-md hover:ring-white/40 hover:ring-1 hover:opacity-90 px-4 h-10 text-sm font-semibold border border-white/10"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            App Store
          </Link>
          <Link
            href="https://play.google.com/store/apps/details?id=xyz.chadwallet.www"
            target="_blank" rel="noopener noreferrer"
            aria-label="Get it on Google Play"
            className="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-md hover:ring-white/40 hover:ring-1 hover:opacity-90 px-4 h-10 text-sm font-semibold border border-white/10"
          >
            <GooglePlayIcon className="w-5 h-5 shrink-0" />
            Google Play
          </Link>
          <AuthButton size="md" />
        </div>
      </header>

      {/* Mobile header */}
      <header className="flex md:hidden items-center h-13 pt-3 px-5 justify-between">
        <Link href="/" className="flex items-center gap-2 text-[#eaedff]">
          <Image src="/logo.png" alt="ChadWallet" width={40} height={40} className="rounded-lg" />
          <span className="text-lg font-black tracking-tight">
            Chad<span className="text-[#606AF7]">Wallet</span>
          </span>
        </Link>
        <div className="flex gap-2">
          <Link
            href="https://apps.apple.com/us/app/chadwallet/id6757367474"
            target="_blank" rel="noopener noreferrer"
            className="bg-white/20 backdrop-blur-md border border-white/10 rounded-md px-3 h-9 flex items-center text-xs font-semibold"
          >
            App Store
          </Link>
          <AuthButton size="sm" />
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex flex-col items-center justify-center flex-1 h-full w-full">

        {/* Hero text block */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-col gap-2 items-center text-center pt-10 px-6 md:pt-20">
            <h1 className="text-[72px] md:text-[120px] font-black tracking-tighter text-[#eaedff] leading-none select-none">
              Chad<span className="text-[#606AF7]">Wallet</span>
            </h1>
            <p className="text-[20px] md:text-[32px] text-[#eaedff] text-center md:leading-10 tracking-tight font-semibold">
              trade solana like a chad.
            </p>
            <p className="md:text-[18px] text-[rgba(209,216,255,0.6)] text-center md:leading-6 tracking-tight max-w-lg">
              From memecoins to viral tokens, trade any Solana token in seconds.
            </p>
          </div>

          {/* CTAs — all screens */}
          <div className="flex gap-3">
            <StartTradingButton className="group flex items-center justify-center overflow-hidden bg-[#606AF780] hover:bg-[#606AF7CC] backdrop-blur-md transition-colors duration-150 py-3 w-44 md:w-48 rounded-xl text-base font-bold border border-white/10 z-2">
              <span>Start trading</span>
              <div className="flex items-center overflow-hidden w-0 opacity-0 group-hover:w-6 group-hover:opacity-100 transition-all duration-150 ease-out">
                <span className="ml-2 text-sm">→</span>
              </div>
            </StartTradingButton>
            <Link
              href="https://play.google.com/store/apps/details?id=xyz.chadwallet.www"
              target="_blank" rel="noopener noreferrer"
              className="cursor-pointer z-2 group bg-white/12 hover:bg-white/20 backdrop-blur-md transition-colors duration-150 border border-white/10 rounded-xl text-base font-bold w-44 md:w-48 flex items-center justify-center overflow-hidden"
            >
              <div className="flex items-center overflow-hidden w-0 opacity-0 group-hover:w-6 group-hover:opacity-100 transition-all duration-150 ease-out">
                <svg className="w-4 h-4 mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <span>Download app</span>
            </Link>
          </div>
        </div>

        {/* Hero mockup — mobile */}
        <Image
          src="/images/hero-mockup.png"
          alt="ChadWallet App"
          width={800}
          height={600}
          priority
          className="md:hidden -mt-4 w-[95vw] object-contain select-none animate-float"
        />

        {/* Hero mockup — desktop */}
        <Image
          src="/images/hero-mockup.png"
          alt="ChadWallet App"
          width={1000}
          height={750}
          priority
          className="hidden md:block w-[60vw] max-w-4xl -mt-8 object-contain select-none animate-float"
        />

        {/* ── "Trade from anywhere" — desktop ────────────────────────── */}
        <div className="hidden md:flex flex-col items-center py-4 px-8 gap-10 w-full max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="font-mono font-bold text-[#606AF7] text-sm tracking-widest">NOW AVAILABLE ON WEB</div>
            <h2 className="text-[56px] leading-tight tracking-tight text-center">
              trade from anywhere.<br />never lose a beat.
            </h2>
            <p className="text-[rgba(209,216,255,0.6)] text-[20px] tracking-tight text-center max-w-xl">
              Open a trade on your phone, close it on your desktop — all in one app.
            </p>
          </div>
          {/* Monitor + phone composite */}
          {/* Outer container is relative so phone can overlap monitor edge */}
          <div className="relative w-[82%]">
            <Image
              src="/images/desk.png?v=2"
              alt="ChadWallet desktop app"
              width={504}
              height={495}
              priority
              unoptimized
              className="w-full h-auto"
            />
            <Image
              src="/images/mobile.png"
              alt="ChadWallet mobile app"
              width={380}
              height={700}
              priority
              unoptimized
              className="absolute right-[-14%] bottom-[14%] w-[28%] h-auto animate-float"
            />
          </div>
        </div>

        {/* ── "Trade from anywhere" — mobile ─────────────────────────── */}
        <div className="flex md:hidden flex-col items-center gap-6 px-6 py-10 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="font-mono font-bold text-[#606AF7] text-xs tracking-widest">NOW AVAILABLE ON WEB</div>
            <h2 className="text-[36px] leading-tight tracking-tighter">
              trade from anywhere.<br />never lose a beat.
            </h2>
            <p className="text-[rgba(209,216,255,0.6)] text-[15px] tracking-tight">
              Pick up a trade on your phone, close it on your desktop.
            </p>
          </div>
          <Image
            src="/images/mobile.png"
            alt="ChadWallet mobile app"
            width={380}
            height={700}
            unoptimized
            className="w-[65vw] max-w-[260px] h-auto object-contain animate-float"
          />
        </div>

        {/* ── Feature cards ──────────────────────────────────────────── */}
        <div className="pt-8 md:py-4 px-5 md:px-14 flex flex-col self-stretch min-[500px]:self-center gap-6 max-w-[1600px]">
          <div className="flex flex-col gap-3 pl-2 md:pl-4">
            <h2 className="text-[32px] md:text-[60px] tracking-tighter leading-tight">never miss out again</h2>
            <p className="text-[rgba(209,216,255,0.6)] text-[18px] md:text-[28px] tracking-tight">the only Solana-first trading app</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:gap-6 items-start">
            {features.map((f) => <FeatureCard key={f.tag} {...f} />)}
          </div>
        </div>

        {/* ── Social proof / CTA ─────────────────────────────────────── */}
        <SocialProof />

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="px-10 pt-8 pb-12 flex flex-col md:flex-row gap-10 items-start justify-between w-full border-t border-white/5">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Link href="/" className="flex items-center gap-2.5 text-[#eaedff]">
                <Image src="/logo.png" alt="ChadWallet" width={44} height={44} className="rounded-xl" />
                <span className="text-[22px] font-black tracking-tight">
                  Chad<span className="text-[#606AF7]">Wallet</span>
                </span>
              </Link>
              <div className="text-xl text-[rgba(209,216,255,0.6)] leading-7 tracking-tighter">
                trade solana like a chad.
              </div>
            </div>
            <div className="text-[rgba(209,216,255,0.3)] hidden md:block text-sm">
              © 2026 ChadWallet. All rights reserved.
            </div>
          </div>

          <div className="flex items-start flex-col md:flex-row gap-8 md:gap-2">
            <div className="flex flex-col items-start gap-2 min-w-40">
              <div className="text-[rgba(209,216,255,0.4)] font-mono text-sm tracking-widest">APP</div>
              <Link href="https://apps.apple.com/us/app/chadwallet/id6757367474" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-white transition-colors">iOS App</Link>
              <Link href="https://play.google.com/store/apps/details?id=xyz.chadwallet.www" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-white transition-colors">Android App</Link>
            </div>
            <div className="flex flex-col items-start gap-2 min-w-40">
              <div className="text-[rgba(209,216,255,0.4)] font-mono text-sm tracking-widest">LEGAL</div>
              <Link href="/privacy-policy" className="text-sm hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-sm hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>

          <div className="text-[rgba(209,216,255,0.3)] block md:hidden text-sm">
            © 2026 ChadWallet. All rights reserved.
          </div>
        </footer>

        {/* ── Bottom ticker ───────────────────────────────────────────────── */}
        <TokenTicker direction="right" speed={45} />

      </main>

    </div>
  );
}

/* ── Orbiting avatar data ────────────────────────────────────────────── */
const innerAvatars = [
  { angle: 270, bg: "#606AF7", label: "🚀", dur: 30 },
  { angle: 90,  bg: "#22c55e", label: "💎", dur: 30 },
];
const outerAvatars = [
  { angle: 350, bg: "#f59e0b", label: "⚡", dur: 45 },
  { angle: 80,  bg: "#ef4444", label: "🔥", dur: 45 },
  { angle: 170, bg: "#8b5cf6", label: "👑", dur: 45 },
  { angle: 250, bg: "#06b6d4", label: "🌊", dur: 45 },
];

function SocialProof() {
  return (
    <div className="relative self-stretch flex items-center justify-center overflow-hidden" style={{ minHeight: "100vh", paddingTop: "clamp(120px, 15vw, 200px)", paddingBottom: "clamp(120px, 15vw, 200px)" }}>

      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/legends.webp"
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#0a0818]/70" />

      {/* Fade top/bottom */}
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-[#060510] to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-[#060510] to-transparent pointer-events-none z-10" />

      {/* Orbit rings + avatars */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">

        {/* Inner ring — spins CCW (reverse), 30s */}
        <div
          className="absolute rounded-full border border-dashed border-white/20"
          style={{ width: "min(380px,35vw)", height: "min(380px,35vw)", animation: "spin 30s linear infinite reverse" }}
        />
        {innerAvatars.map((a) => (
          <div
            key={a.label}
            className="absolute flex items-center justify-center w-10 h-10 rounded-full text-base shadow-lg shadow-black/40 select-none pointer-events-none"
            style={{
              backgroundColor: a.bg,
              "--r": "min(190px,17.5vw)",
              animation: `orbit-ccw ${a.dur}s linear infinite`,
              animationDelay: `-${(a.angle / 360) * a.dur}s`,
            } as React.CSSProperties}
          >
            {a.label}
          </div>
        ))}

        {/* Outer ring — spins CW, 45s */}
        <div
          className="absolute rounded-full border border-dashed border-white/10"
          style={{ width: "min(700px,60vw)", height: "min(700px,60vw)", animation: "spin 45s linear infinite" }}
        />
        {outerAvatars.map((a) => (
          <div
            key={a.label}
            className="absolute flex items-center justify-center w-11 h-11 rounded-full text-lg shadow-lg shadow-black/40 select-none pointer-events-none"
            style={{
              backgroundColor: a.bg,
              "--r": "min(350px,30vw)",
              animation: `orbit-cw ${a.dur}s linear infinite`,
              animationDelay: `-${(a.angle / 360) * a.dur}s`,
            } as React.CSSProperties}
          >
            {a.label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center gap-4 text-center px-8">
        <h2 className="text-[36px] md:text-[56px] leading-tight tracking-tighter">
          a trading app<br />for the rest of us
        </h2>
        <p className="text-[rgba(209,216,255,0.6)] text-[16px] md:text-[20px] tracking-tight max-w-md">
          join thousands of traders making their name on ChadWallet
        </p>
        <div className="pt-4 flex gap-3">
          {/* Mobile */}
          <Link
            href="https://play.google.com/store/apps/details?id=xyz.chadwallet.www"
            target="_blank" rel="noopener noreferrer"
            className="md:hidden text-center bg-white/12 backdrop-blur-md border border-white/10 rounded-xl text-base font-bold w-44 py-3"
          >
            Download app
          </Link>
          {/* Desktop */}
          <StartTradingButton className="hidden md:flex group items-center justify-center overflow-hidden bg-[#606AF780] hover:bg-[#606AF7CC] backdrop-blur-md transition-colors py-3 w-48 rounded-xl text-base font-bold border border-white/10 gap-1">
            <span>Start trading</span>
            <span className="w-0 overflow-hidden opacity-0 group-hover:w-5 group-hover:opacity-100 transition-all duration-150">→</span>
          </StartTradingButton>
          <Link
            href="https://play.google.com/store/apps/details?id=xyz.chadwallet.www"
            target="_blank" rel="noopener noreferrer"
            className="cursor-pointer hidden md:flex group bg-white/12 hover:bg-white/20 backdrop-blur-md transition-colors border border-white/10 rounded-xl text-base font-bold w-48 items-center justify-center gap-1 overflow-hidden"
          >
            <svg className="w-0 h-4 overflow-hidden opacity-0 group-hover:w-5 group-hover:opacity-100 transition-all duration-150 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Download app</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#FBBC05" d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z" />
      <path fill="#34A853" d="M1.337.924a1.487 1.487 0 0 0-.227.796v20.558c0 .295.084.571.227.796l14.432-11.08L1.337.924z" />
      <path fill="#4285F4" d="M8.882 8.445L1.337.924 21.338 12.43a1.49 1.49 0 0 0 .68-.594L8.882 8.445z" />
      <path fill="#EA4335" d="M8.882 15.555l-7.545 7.519 20.001-7.519a1.49 1.49 0 0 0-.68-.594L8.882 15.555z" />
    </svg>
  );
}

function FeatureCard({ tag, title, img }: { tag: string; title: string; img: string }) {
  return (
    <div className="group flex-1 min-w-0 shrink pt-8 pb-0 rounded-[25px] flex flex-col overflow-hidden gap-5 border border-white/[0.07] hover:border-white/[0.14] transition-colors duration-300 bg-[#0e0c1e] aspect-square">
      <div className="font-mono text-[#606AF7] px-6 font-bold text-xs tracking-widest">{tag}</div>
      <h3 className="text-[24px] md:text-[32px] leading-8 tracking-tight px-6">{title}</h3>
      <div className="min-h-0 flex-1 flex justify-center items-end px-4">
        <Image
          src={img}
          alt={title}
          width={600}
          height={600}
          loading="lazy"
          className="w-[95%] h-full object-contain object-bottom transition-transform duration-500 ease-out group-hover:scale-[1.12]"
        />
      </div>
    </div>
  );
}
