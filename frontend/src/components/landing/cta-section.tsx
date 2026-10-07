import { PrimaryCta } from "./primary-cta";
import { Reveal } from "./reveal";

export function CtaSection() {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-36">
      <Reveal className="mx-auto flex max-w-6xl flex-col items-start gap-8 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">
          Stop digging through folders.
          <br />
          <span className="text-muted-foreground">Start asking.</span>
        </h2>
        <PrimaryCta />
      </Reveal>
    </section>
  );
}
