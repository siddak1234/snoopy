type Props = { state: "none" } | { state: "set"; domain: string };

export function OrgDomainSection(props: Props) {
  if (props.state === "none") {
    return (
      <p className="text-sm text-[var(--muted)]">
        No domain associated with this workspace.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono text-[var(--text)]">{props.domain}</span>
    </div>
  );
}
