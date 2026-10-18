import type { CSSProperties, ReactNode } from "react";

export function PageTitle({ title }: { title: string }) {
  return (
    <h1 className="title-ribbon" title={title} style={{ "--ribbon-letters": [...title].length } as CSSProperties}>
      {title}
    </h1>
  );
}

/** One title row and one optional line of supporting copy on every page. */
export function PageHead({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="page-heading-row">
        <PageTitle title={title} />
        {children && <div className="page-heading-actions">{children}</div>}
      </div>
      {eyebrow && <p className="page-tagline">{eyebrow}</p>}
    </header>
  );
}
