export default function PortalSkeleton() {
  return (
    <main className="pp-shell" aria-busy="true" aria-label="Loading invoice">
      <div className="pp-topbar">
        <div className="pp-brand">
          <span className="pp-skeleton pp-skeleton--mark" />
          <div className="pp-brand__copy">
            <span className="pp-skeleton pp-skeleton--line pp-skeleton--w-40" />
            <span className="pp-skeleton pp-skeleton--line pp-skeleton--w-24" />
          </div>
        </div>
        <span className="pp-skeleton pp-skeleton--pill" />
      </div>

      <div className="pp-layout">
        <div className="pp-stub">
          <div className="pp-skeleton pp-skeleton--line pp-skeleton--w-40" />
          <div className="pp-skeleton pp-skeleton--amount" />
          <div className="pp-skeleton pp-skeleton--line pp-skeleton--w-70" />
          <div className="pp-skeleton pp-skeleton--line pp-skeleton--w-55" />
          <div className="pp-skeleton pp-skeleton--block" />
        </div>

        <section className="pp-chat">
          <div className="pp-chat__head">
            <span className="pp-skeleton pp-skeleton--mark" />
            <div className="pp-brand__copy">
              <span className="pp-skeleton pp-skeleton--line pp-skeleton--w-40" />
              <span className="pp-skeleton pp-skeleton--line pp-skeleton--w-55" />
            </div>
          </div>
          <div className="pp-skeleton-thread">
            <span className="pp-skeleton pp-skeleton--bubble" />
            <span className="pp-skeleton pp-skeleton--bubble pp-skeleton--bubble-right" />
            <span className="pp-skeleton pp-skeleton--bubble" />
          </div>
          <div className="pp-skeleton-composer">
            <span className="pp-skeleton pp-skeleton--input" />
          </div>
        </section>
      </div>
    </main>
  );
}
