import Link from "next/link";

export function DraftOffBanner({ href = "/" }: { href?: string }) {
  const className = "site-banner title";
  const label = (
    <>
      <span className="site-banner-star" aria-hidden>
        ★
      </span>
      <span className="site-banner-mark">DRAFTOFF</span>
      <span className="site-banner-star" aria-hidden>
        ★
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label="DraftOff home">
        {label}
      </Link>
    );
  }

  return <div className={className}>{label}</div>;
}
